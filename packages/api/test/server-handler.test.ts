import { afterEach, describe, expect, it, vi } from 'vitest';
import { Frayme } from '../src/client.js';
import { composeOutputs } from '../src/agent/index.js';
import { CompositionFailedError, ModelUnavailableError, RateLimitError } from '../src/core/errors.js';
import { createFraymeHandler, type FraymeHandlerOptions } from '../src/server/index.js';
import type { ComposeStreamEvent } from '../src/streaming/events.js';
import { OPS, dyingStream, frame, happyPayload, sseStream } from './helpers/fixtures.js';
import { buildMockFetch, type ScriptedResponse } from './helpers/mock-fetch.js';

const KEY = 'fr_live_TOPSECRET_proxy_key';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function upstream(script: ScriptedResponse[]) {
  const mock = buildMockFetch(script);
  return {
    client: new Frayme({ apiKey: KEY, baseURL: 'https://api.test', fetch: mock.fetch, maxRetries: 0 }),
    calls: mock.calls,
  };
}

function handlerFor(script: ScriptedResponse[], options: Partial<FraymeHandlerOptions> = {}) {
  const up = upstream(script);
  const handler = createFraymeHandler({ authorize: () => true, client: up.client, ...options });
  return { handler, calls: up.calls };
}

function post(
  body: unknown,
  { headers, ...init }: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
  url = 'https://app.test/api/frayme/v1/compose',
): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
}

const happy = (): ScriptedResponse => ({ status: 200, sse: true, body: () => sseStream(happyPayload()) });

async function errorOf(res: Response): Promise<{ code: string; message: string }> {
  expect(res.headers.get('content-type')).toBe('application/json');
  const json = (await res.json()) as { success: boolean; error: { code: string; message: string } };
  expect(json.success).toBe(false);
  expect(Object.keys(json.error).sort()).toEqual(['code', 'message']);
  return json.error;
}

/**
 * A response body the test feeds by hand. The stream exists up front, so the
 * test can push before the handler has reached the API; it errors like fetch
 * when the API request aborts.
 */
function controlled() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let signal: AbortSignal | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const fail = (err: unknown) => {
    try {
      controller.error(err);
    } catch {
      /* already closed */
    }
  };
  return {
    response: {
      status: 200,
      sse: true,
      body: (s: AbortSignal | undefined) => {
        signal = s;
        s?.addEventListener('abort', () => fail(new DOMException('The operation was aborted.', 'AbortError')));
        return stream;
      },
    } satisfies ScriptedResponse,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
    fail,
    signal: () => signal,
  };
}

describe('createFraymeHandler: request gate', () => {
  it('needs an authorize function', () => {
    expect(() => createFraymeHandler({} as never)).toThrow(TypeError);
    expect(() => createFraymeHandler(undefined as never)).toThrow(TypeError);
  });

  it('answers 405 to anything but POST, before authorizing', async () => {
    const authorize = vi.fn(() => true);
    const { handler, calls } = handlerFor([], { authorize });
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await handler(new Request('https://app.test/api/frayme/v1/compose', { method }));
      expect(res.status, method).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
      expect((await errorOf(res)).code).toBe('BAD_REQUEST');
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it('answers 401 when authorize is falsy, and never calls the API', async () => {
    for (const verdict of [false, null, undefined, 0, '']) {
      const { handler, calls } = handlerFor([happy()], { authorize: async () => verdict });
      const res = await handler(post({ prompt: 'x' }));
      expect(res.status).toBe(401);
      expect(await errorOf(res)).toEqual({ code: 'AUTHENTICATION_REQUIRED', message: 'Not authorized.' });
      expect(calls).toHaveLength(0);
    }
  });

  it('answers 401 when authorize throws, without leaking the reason', async () => {
    const { handler, calls } = handlerFor([happy()], {
      authorize: () => {
        throw new Error('session db at 10.0.0.5 refused user alice@example.com');
      },
    });
    const res = await handler(post({ prompt: 'x' }));
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).not.toContain('10.0.0.5');
    expect(text).not.toContain('alice');
    expect(calls).toHaveLength(0);
  });

  it('passes the request to authorize and accepts any truthy verdict', async () => {
    const authorize = vi.fn(async (request: Request) => ({ user: request.headers.get('x-user') }));
    const { handler } = handlerFor([happy()], { authorize });
    const res = await handler(post({ prompt: 'x' }, { headers: { 'x-user': 'u1' } }));
    expect(res.status).toBe(200);
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(authorize.mock.calls[0]![0].headers.get('x-user')).toBe('u1');
    await res.text();
  });

  it('answers 413 past the body cap, by declared length or by bytes read', async () => {
    const { handler, calls } = handlerFor([], { maxBodyBytes: 100 });
    const declared = await handler(post({ prompt: 'x' }, { headers: { 'content-length': '101' } }));
    expect(declared.status).toBe(413);
    expect((await errorOf(declared)).code).toBe('BAD_REQUEST');

    const big = JSON.stringify({ prompt: 'x'.repeat(200) });
    const chunks = [big.slice(0, 50), big.slice(50)];
    const streamed = new ReadableStream<Uint8Array>({
      start(c) {
        for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
        c.close();
      },
    });
    const res = await handler(
      new Request('https://app.test/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: streamed,
        duplex: 'half',
      } as RequestInit),
    );
    expect(res.status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it('accepts a body exactly at the cap, and defaults the cap to 128 KiB', async () => {
    const body = JSON.stringify({ prompt: 'p'.repeat(100) });
    const atCap = handlerFor([happy()], { maxBodyBytes: new TextEncoder().encode(body).length });
    const ok = await atCap.handler(post(body));
    expect(ok.status).toBe(200);
    await ok.text();

    const byDefault = handlerFor([]);
    const over = await byDefault.handler(post({ prompt: 'x', data: { blob: 'b'.repeat(128 * 1024) } }));
    expect(over.status).toBe(413);
  });

  it('answers 400 to a body that is not JSON, or not a JSON object', async () => {
    const { handler, calls } = handlerFor([]);
    for (const body of ['{not json', '', '[1,2]', 'null', '"text"', '5']) {
      const res = await handler(post(body));
      expect(res.status, body).toBe(400);
      expect((await errorOf(res)).code).toBe('BAD_REQUEST');
    }
    expect(calls).toHaveLength(0);
  });

  it('answers 400 naming the key for anything outside the allowlist, including action_policy and intent', async () => {
    const { handler, calls } = handlerFor([]);
    for (const key of ['action_policy', 'intent', 'metadata', 'custom_components', 'ui_type', '__proto__', 'constructor']) {
      const res = await handler(post(`{"prompt":"x","${key}":"open"}`));
      expect(res.status, key).toBe(400);
      expect((await errorOf(res)).message).toBe(`Unknown field "${key}".`);
    }
    expect(calls).toHaveLength(0);
  });

  it('answers 415 to any body not sent as application/json, so a cross-site form cannot compose', async () => {
    const authorize = (request: Request) => request.headers.get('cookie') === 'session=1';
    const { handler, calls } = handlerFor([], { authorize });
    // What an HTML form with enctype="text/plain" sends: a JSON-shaped body, the
    // user's cookie, and no preflight.
    const formBody = '{"prompt":"burn quota","data":{"a":"' + '=' + '"}}';
    const types = ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonx', null];
    for (const type of types) {
      const headers: Record<string, string> = { cookie: 'session=1', origin: 'https://other.example' };
      if (type !== null) headers['content-type'] = type;
      const res = await handler(new Request('https://app.test/api/frayme', { method: 'POST', headers, body: formBody }));
      expect(res.status, String(type)).toBe(415);
      expect(await errorOf(res)).toEqual({
        code: 'BAD_REQUEST',
        message: 'The request body must be sent as application/json.',
      });
    }
    expect(calls).toHaveLength(0);
  });

  it('accepts application/json with parameters and in any case', async () => {
    for (const type of ['application/json; charset=utf-8', 'Application/JSON']) {
      const { handler, calls } = handlerFor([happy()]);
      const res = await handler(post({ prompt: 'x' }, { headers: { 'content-type': type } }));
      expect(res.status, type).toBe(200);
      await res.text();
      expect(calls).toHaveLength(1);
    }
  });

  it('answers 400 to a malformed Idempotency-Key header', async () => {
    const { handler, calls } = handlerFor([]);
    const res = await handler(post({ prompt: 'x' }, { headers: { 'idempotency-key': 'k'.repeat(256) } }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).message).toBe(
      'The Idempotency-Key header must be 1 to 255 printable ASCII characters.',
    );
    expect(calls).toHaveLength(0);
  });

  it('refuses an unusable body cap or action policy when the handler is built', () => {
    for (const maxBodyBytes of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY, '100' as never]) {
      expect(() => createFraymeHandler({ authorize: () => true, maxBodyBytes }), String(maxBodyBytes)).toThrow(
        TypeError,
      );
    }
    expect(() => createFraymeHandler({ authorize: () => true, actionPolicy: 'anything' as never })).toThrow(TypeError);
    expect(() => createFraymeHandler({ authorize: () => true, maxBodyBytes: 1, actionPolicy: 'open' })).not.toThrow();
  });
});

describe('createFraymeHandler: what reaches the API', () => {
  it('forwards the allowed fields, forces action_policy, and streams', async () => {
    const { handler, calls } = handlerFor([happy()]);
    const request = {
      prompt: 'A refund queue',
      signals: { density: 'compact' },
      mode: 'continue_journey',
      context: { theme: 'dark' },
      max_operations: 50,
      data: { rows: [{ id: 1 }] },
      actions: [{ name: 'approve', requiredItems: ['id'] }],
      prior_spec: { root: 'r', elements: {} },
      action_context: { action: 'next' },
      stream: true,
    };
    const res = await handler(post(request));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    await res.text();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.test/v1/compose');
    expect(calls[0]!.headers.get('authorization')).toBe(`Bearer ${KEY}`);
    const { stream: _ignored, ...rest } = request;
    expect(JSON.parse(calls[0]!.body!)).toEqual({ ...rest, action_policy: 'declared_only', stream: true });
  });

  it('streams when the flag is missing or not a boolean, as the API does by default', async () => {
    for (const flag of [undefined, 'false', 0, null]) {
      const { handler, calls } = handlerFor([happy()]);
      const res = await handler(post(flag === undefined ? { prompt: 'x' } : { prompt: 'x', stream: flag }));
      expect(res.headers.get('content-type'), String(flag)).toBe('text/event-stream; charset=utf-8');
      await res.text();
      expect(JSON.parse(calls[0]!.body!)).toEqual({ prompt: 'x', action_policy: 'declared_only', stream: true });
    }
  });

  it('stream: false gets the API\'s JSON envelope, from a buffered API call', async () => {
    const result = {
      generation_id: 'gen_1',
      spec: { root: 'card', elements: {} },
      model: 'frayme',
      operation_count: 1,
      validated: true,
      usage: { input_tokens: 1, output_tokens: 2 },
    };
    const { handler, calls } = handlerFor([{ status: 200, body: JSON.stringify({ success: true, data: result }) }]);
    const res = await handler(post({ prompt: 'x', stream: false }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: true, data: result });
    expect(calls[0]!.headers.get('accept')).toBe('application/json');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ prompt: 'x', action_policy: 'declared_only', stream: false });
  });

  it('stream: false keeps an API error\'s status and envelope', async () => {
    const { handler } = handlerFor([
      { status: 502, body: JSON.stringify({ success: false, error: { code: 'COMPOSITION_FAILED', message: 'no' } }) },
    ]);
    const res = await handler(post({ prompt: 'x', stream: false }));
    expect(res.status).toBe(502);
    expect(await errorOf(res)).toEqual({ code: 'COMPOSITION_FAILED', message: 'no' });
  });

  it('never retries upstream itself, whatever the client is configured to do', async () => {
    const mock = buildMockFetch([
      { status: 503, body: JSON.stringify({ success: false, error: { code: 'MODEL_UNAVAILABLE', message: 'busy' } }) },
      happy(),
    ]);
    // Default client options: two retries.
    const client = new Frayme({ apiKey: KEY, baseURL: 'https://api.test', fetch: mock.fetch });
    const handler = createFraymeHandler({ authorize: () => true, client });
    const res = await handler(post({ prompt: 'x' }));
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toEqual({ code: 'MODEL_UNAVAILABLE', message: 'busy' });
    expect(mock.calls).toHaveLength(1);
  });

  it('forwards the browser\'s Idempotency-Key, and sends none when the browser sent none', async () => {
    const withKey = handlerFor([happy(), { status: 200, body: '{"success":true,"data":{}}' }]);
    const streamed = await withKey.handler(post({ prompt: 'x' }, { headers: { 'idempotency-key': 'order-42 v1' } }));
    await streamed.text();
    const buffered = await withKey.handler(
      post({ prompt: 'x', stream: false }, { headers: { 'idempotency-key': 'order-42 v2' } }),
    );
    await buffered.text();
    expect(withKey.calls.map((c) => c.headers.get('idempotency-key'))).toEqual(['order-42 v1', 'order-42 v2']);

    const withoutKey = handlerFor([happy()]);
    await (await withoutKey.handler(post({ prompt: 'x' }))).text();
    expect(withoutKey.calls[0]!.headers.get('idempotency-key')).toBeNull();
  });

  it('uses the configured action policy, and passes custom_components only when allowed', async () => {
    const { handler, calls } = handlerFor([happy()], { actionPolicy: 'open', allowCustomComponents: true });
    const res = await handler(post({ prompt: 'x', custom_components: [{ name: 'Badge' }] }));
    expect(res.status).toBe(200);
    await res.text();
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      prompt: 'x',
      custom_components: [{ name: 'Badge' }],
      action_policy: 'open',
      stream: true,
    });
  });

  it('ignores the request path, so it can be mounted anywhere', async () => {
    const { handler, calls } = handlerFor([happy()]);
    const res = await handler(post({ prompt: 'x' }, {}, 'https://app.test/some/other/route?x=1'));
    expect(res.status).toBe(200);
    await res.text();
    expect(calls[0]!.url).toBe('https://api.test/v1/compose');
  });

  it('builds the default client on first use from the environment, not at import', async () => {
    vi.stubEnv('FRAYME_API_KEY', '');
    const unconfigured = createFraymeHandler({ authorize: () => true }); // must not throw here
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await unconfigured(post({ prompt: 'x' }));
    expect(res.status).toBe(500);
    expect((await errorOf(res)).message).toBe('The compose proxy is not configured.');
    expect(errorLog).toHaveBeenCalled();

    const mock = buildMockFetch([happy()]);
    vi.stubGlobal('fetch', mock.fetch);
    vi.stubEnv('FRAYME_API_KEY', KEY);
    vi.stubEnv('FRAYME_BASE_URL', 'https://env.api.test');
    const configured = createFraymeHandler({ authorize: () => true });
    const ok = await configured(post({ prompt: 'x' }));
    expect(ok.status).toBe(200);
    await ok.text();
    expect(mock.calls[0]!.url).toBe('https://env.api.test/v1/compose');
    expect(mock.calls[0]!.headers.get('authorization')).toBe(`Bearer ${KEY}`);
  });
});

describe('createFraymeHandler: the stream it sends back', () => {
  it('re-emits the API wire format byte for byte, with no-store and no buffering', async () => {
    const { handler } = handlerFor([happy()]);
    const res = await handler(post({ prompt: 'x' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    expect(await res.text()).toBe(happyPayload());
  });

  it('keeps fields it does not know, such as extra completion data', async () => {
    const payload = frame.started() + frame.op(OPS[0]!) + frame.completed({ components_used: ['Card'], interactions: [] });
    const { handler } = handlerFor([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const text = await (await handler(post({ prompt: 'x' }))).text();
    expect(text).toBe(payload);
  });

  it('forwards event types it does not know, but never an event name that could break the framing', async () => {
    const future = 'event: compose.progress\ndata: {"type":"compose.progress","pct":50}\n\n';
    const forged = 'event: x\ndata: {"type":"op\\ndata: {}\\n\\nevent: compose.completed","path":"/x"}\n\n';
    const payload = frame.started() + future + forged + frame.op(OPS[0]!) + frame.completed({ operation_count: 1 });
    const { handler } = handlerFor([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const text = await (await handler(post({ prompt: 'x' }))).text();
    expect(text).toBe(frame.started() + future + frame.op(OPS[0]!) + frame.completed({ operation_count: 1 }));
  });

  it('sends a keepalive ping every 15 seconds while the stream is open', async () => {
    vi.useFakeTimers();
    const feed = controlled();
    const { handler } = handlerFor([feed.response]);
    const pending = handler(post({ prompt: 'x' }));
    feed.push(frame.started());
    const res = await pending;
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    expect(decoder.decode((await reader.read()).value)).toBe(frame.started());

    await vi.advanceTimersByTimeAsync(15_000);
    expect(decoder.decode((await reader.read()).value)).toBe(': ping\n\n');

    feed.push(frame.op(OPS[0]!) + frame.completed({ operation_count: 1 }));
    feed.close();
    let rest = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest += decoder.decode(value);
    }
    expect(rest).toBe(frame.op(OPS[0]!) + frame.completed({ operation_count: 1 }));
    expect(vi.getTimerCount()).toBe(0); // the ping interval is gone with the stream
  });

  it('an API error before the first event keeps its status and envelope, plus retry-after and request id', async () => {
    const { handler } = handlerFor([
      {
        status: 429,
        headers: { 'retry-after': '7', 'x-request-id': 'req_9' },
        body: JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'Slow down.' } }),
      },
    ]);
    const res = await handler(post({ prompt: 'x' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('7');
    expect(res.headers.get('x-request-id')).toBe('req_9');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await errorOf(res)).toEqual({ code: 'RATE_LIMITED', message: 'Slow down.' });
  });

  it('an in-band error as the first event becomes a JSON error with the mapped status', async () => {
    const payload = frame.errorEvent('COMPOSITION_FAILED', 'all attempts failed');
    const { handler } = handlerFor([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const res = await handler(post({ prompt: 'x' }));
    expect(res.status).toBe(502);
    expect(await errorOf(res)).toEqual({ code: 'COMPOSITION_FAILED', message: 'all attempts failed' });
  });

  it('local failures before the first event get fixed messages, never local detail', async () => {
    const cases: Array<{ script: ScriptedResponse[]; status: number; code: string; message: string }> = [
      {
        // A gateway page with no envelope: the status is kept, the HTML is not.
        script: [{ status: 503, body: '<html>edge-node-7 internal</html>' }],
        status: 503,
        code: 'MODEL_UNAVAILABLE',
        message: 'The Frayme API answered with status 503.',
      },
      {
        // 200 but not a stream.
        script: [{ status: 200, body: '{"success":true}' }],
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The compose request failed.',
      },
    ];
    for (const c of cases) {
      const { handler } = handlerFor(c.script);
      const res = await handler(post({ prompt: 'x' }));
      expect(res.status).toBe(c.status);
      expect(await errorOf(res)).toEqual({ code: c.code, message: c.message });
    }

    const unreachable = new Frayme({
      apiKey: KEY,
      baseURL: 'https://api.test',
      maxRetries: 0,
      fetch: async () => {
        throw new TypeError('getaddrinfo ENOTFOUND internal-host.local');
      },
    });
    const res = await createFraymeHandler({ authorize: () => true, client: unreachable })(post({ prompt: 'x' }));
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toEqual({ code: 'SERVICE_UNAVAILABLE', message: 'The Frayme API could not be reached.' });
  });

  it('an error mid-stream arrives as the in-band error event', async () => {
    const payload = frame.started() + frame.op(OPS[0]!) + frame.errorEvent('COMPOSITION_FAILED', 'all attempts failed');
    const { handler } = handlerFor([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const res = await handler(post({ prompt: 'x' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(payload);
  });

  it('a dead connection or an unfinished stream mid-way ends with a generic in-band error', async () => {
    const feed = controlled();
    const dying = handlerFor([feed.response]);
    feed.push(frame.started());
    const res = await dying.handler(post({ prompt: 'x' }));
    feed.fail(new TypeError('socket hang up at 10.1.2.3'));
    const deadText = await res.text();
    expect(deadText).toBe(
      frame.started() + frame.errorEvent('SERVICE_UNAVAILABLE', 'The Frayme API could not be reached.'),
    );
    expect(deadText).not.toContain('10.1.2.3');

    // Before the first event the same failure is still a real status.
    const early = handlerFor([
      { status: 200, sse: true, body: () => dyingStream('', new TypeError('socket hang up at 10.1.2.3')) },
    ]);
    const earlyRes = await early.handler(post({ prompt: 'x' }));
    expect(earlyRes.status).toBe(503);
    expect(await errorOf(earlyRes)).toEqual({ code: 'SERVICE_UNAVAILABLE', message: 'The Frayme API could not be reached.' });

    const unfinished = handlerFor([{ status: 200, sse: true, body: () => sseStream(frame.started() + frame.op(OPS[0]!)) }]);
    expect(await (await unfinished.handler(post({ prompt: 'x' }))).text()).toBe(
      frame.started() + frame.op(OPS[0]!) + frame.errorEvent('INTERNAL_SERVER_ERROR', 'The compose request failed.'),
    );
  });

  it('an API refusal of the server key is a 500 for the browser, logged on the server', async () => {
    const refusal = (status: number, code: string, message: string): ScriptedResponse => ({
      status,
      headers: { 'x-request-id': 'req_7' },
      body: JSON.stringify({ success: false, error: { code, message } }),
    });
    for (const [status, code] of [
      [401, 'AUTHENTICATION_REQUIRED'],
      [403, 'FORBIDDEN'],
    ] as const) {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      for (const stream of [true, false]) {
        const { handler } = handlerFor([refusal(status, code, 'Invalid API key.')]);
        const res = await handler(post({ prompt: 'x', stream }));
        expect(res.status, `${code} stream=${stream}`).toBe(500);
        expect(res.headers.get('x-request-id')).toBe('req_7');
        expect(await errorOf(res)).toEqual({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The compose proxy is not configured.',
        });
      }
      expect(errorLog).toHaveBeenCalledTimes(2);
      expect(errorLog.mock.calls[0]!.join(' ')).toContain('Invalid API key.');
      errorLog.mockRestore();
    }

    // Mid-stream, the same refusal goes in-band with the same fixed message.
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const payload = frame.started() + frame.errorEvent('AUTHENTICATION_REQUIRED', 'Key revoked.');
    const midStream = handlerFor([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    expect(await (await midStream.handler(post({ prompt: 'x' }))).text()).toBe(
      frame.started() + frame.errorEvent('INTERNAL_SERVER_ERROR', 'The compose proxy is not configured.'),
    );
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('a plan limit on the request itself still reaches the browser as a 403', async () => {
    const { handler } = handlerFor([
      {
        status: 403,
        body: JSON.stringify({ success: false, error: { code: 'FEATURE_LIMIT', message: 'Too many custom components.' } }),
      },
    ]);
    const res = await handler(post({ prompt: 'x' }));
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({ code: 'FEATURE_LIMIT', message: 'Too many custom components.' });
  });

  it('sends each op exactly as the API did, even when its own reading falls behind the stream', async () => {
    // Op 3 appends to the children array op 2 created, and op 4 sets a prop on
    // it: an op sent late must not show what later ops did to its value.
    const ops = [
      { op: 'add', path: '/root', value: 'card' },
      { op: 'add', path: '/elements/card', value: { type: 'Card', props: {}, children: [] } },
      { op: 'add', path: '/elements/card/children/-', value: 'txt' },
      { op: 'replace', path: '/elements/card/props/title', value: 'Hello' },
      { op: 'add', path: '/elements/txt', value: { type: 'Text', props: { content: 'Hi' } } },
    ];
    const payload = frame.started() + ops.map((p) => frame.op(p)).join('') + frame.completed({ operation_count: 5 });
    const up = upstream([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    // Make the handler's own loop lag: every event reaches it a macrotask late,
    // by which time the stream has applied the ops after it.
    const stream = up.client.compose.stream.bind(up.client.compose);
    up.client.compose.stream = (...args: Parameters<typeof stream>) => {
      const compose = stream(...args);
      const events = compose[Symbol.asyncIterator].bind(compose);
      compose[Symbol.asyncIterator] = async function* lagging() {
        for await (const event of events()) {
          await new Promise((resolve) => setTimeout(resolve, 1));
          yield event;
        }
      };
      return compose;
    };
    const handler = createFraymeHandler({ authorize: () => true, client: up.client });
    const text = await (await handler(post({ prompt: 'x' }))).text();
    expect(text).toBe(payload);

    // And the browser that parses it ends with the API's spec, no op applied twice.
    const browser = new Frayme({
      apiKey: null,
      baseURL: 'https://app.test/api/frayme',
      maxRetries: 0,
      fetch: async () => new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    });
    const final = await browser.compose.stream({ prompt: 'x' }).finalSpec();
    expect(final.spec).toEqual({
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Hello' }, children: ['txt'] },
        txt: { type: 'Text', props: { content: 'Hi' } },
      },
    });
  });

  it('never puts the key in a response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const scripts: ScriptedResponse[][] = [
      [happy()],
      [{ status: 401, body: JSON.stringify({ success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Invalid API key.' } }) }],
      [{ status: 200, sse: true, body: () => sseStream(frame.started() + frame.errorEvent('INTERNAL_SERVER_ERROR', 'boom')) }],
      [{ status: 500, body: 'oops' }],
    ];
    for (const script of scripts) {
      const { handler } = handlerFor(script);
      const res = await handler(post({ prompt: 'x' }));
      const text = await res.text();
      const headers = JSON.stringify([...res.headers.entries()]);
      expect(text).not.toContain(KEY);
      expect(headers).not.toContain(KEY);
      expect(headers.toLowerCase()).not.toContain('authorization');
    }
  });

  it('aborting the incoming request aborts the API request', async () => {
    const feed = controlled();
    const { handler } = handlerFor([feed.response]);
    const abort = new AbortController();
    const pending = handler(post({ prompt: 'x' }, { signal: abort.signal }));
    feed.push(frame.started());
    const res = await pending;
    const reader = res.body!.getReader();
    await reader.read();
    abort.abort();
    expect(feed.signal()?.aborted).toBe(true);
    // The stream then ends without an error frame: nobody is listening.
    let rest = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest += new TextDecoder().decode(value);
    }
    expect(rest).toBe('');
  });

  it('cancelling the response body aborts the API request', async () => {
    const feed = controlled();
    const { handler } = handlerFor([feed.response]);
    const pending = handler(post({ prompt: 'x' }));
    feed.push(frame.started());
    const res = await pending;
    await res.body!.cancel();
    expect(feed.signal()?.aborted).toBe(true);
  });

  it('an incoming request aborted before any event gets a closed-request answer', async () => {
    const feed = controlled();
    const { handler } = handlerFor([feed.response]);
    const abort = new AbortController();
    const pending = handler(post({ prompt: 'x' }, { signal: abort.signal }));
    await vi.waitFor(() => expect(feed.signal()).toBeDefined());
    abort.abort();
    const res = await pending;
    expect(res.status).toBe(499);
    expect(feed.signal()?.aborted).toBe(true);
  });
});

describe('round trip: a keyless browser client through the handler', () => {
  function browserClient(handler: (request: Request) => Promise<Response>) {
    const seen: Request[] = [];
    const frayme = new Frayme({
      apiKey: null,
      baseURL: 'https://app.test/api/frayme',
      maxRetries: 0,
      fetch: async (input, init) => {
        const request = new Request(input, init);
        seen.push(request.clone());
        return handler(request);
      },
    });
    return { frayme, seen };
  }

  it('the keyless client parses the proxied stream unchanged', async () => {
    const { handler, calls } = handlerFor([happy()]);
    const { frayme, seen } = browserClient(handler);

    const stream = frayme.compose.stream({ prompt: 'a card', data: { title: 'Hi' } });
    const events: ComposeStreamEvent[] = [];
    const snapshots: unknown[] = [];
    stream.on('op', (_op, snapshot) => snapshots.push(structuredClone(snapshot)));
    for await (const event of stream) events.push(event);
    const final = await stream.finalSpec();

    expect(events.map((e) => e.type)).toEqual(['compose.started', 'op', 'op', 'op', 'compose.completed']);
    expect(snapshots).toHaveLength(3);
    expect(final).toMatchObject({ generationId: 'gen_1', model: 'frayme', operationCount: 3, replayed: false });
    expect(final.spec).toEqual({ root: 'card', elements: { card: OPS[1]!.value, txt: OPS[2]!.value } });

    // The browser called its own route, with no key; the server added the key and the policy.
    expect(seen[0]!.url).toBe('https://app.test/api/frayme/v1/compose');
    expect(seen[0]!.headers.get('authorization')).toBeNull();
    expect(calls[0]!.headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      prompt: 'a card',
      data: { title: 'Hi' },
      action_policy: 'declared_only',
      stream: true,
    });
  });

  it('a mid-stream error reaches the browser as the same typed error', async () => {
    const payload = frame.started() + frame.op(OPS[0]!) + frame.errorEvent('COMPOSITION_FAILED', 'all attempts failed');
    const { handler } = handlerFor([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const { frayme } = browserClient(handler);
    const stream = frayme.compose.stream({ prompt: 'x' });
    const error = await stream.finalSpec().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(CompositionFailedError);
    expect(error).toMatchObject({ code: 'COMPOSITION_FAILED', status: 502, message: 'all attempts failed' });
  });

  it('a connection lost mid-stream reaches the browser as a 503 SERVICE_UNAVAILABLE', async () => {
    const payload = frame.started() + frame.op(OPS[0]!);
    const { handler } = handlerFor([
      { status: 200, sse: true, body: () => dyingStream(payload, new TypeError('socket hang up')) },
    ]);
    const { frayme } = browserClient(handler);
    const error = await frayme.compose.stream({ prompt: 'x' }).finalSpec().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ModelUnavailableError);
    expect(error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 });
  });

  it('compose.create() gets its result through the handler', async () => {
    const result = {
      generation_id: 'gen_2',
      spec: { root: 'card', elements: { card: OPS[1]!.value } },
      model: 'frayme',
      operation_count: 2,
      validated: true,
      usage: { input_tokens: 1, output_tokens: 2 },
    };
    const { handler, calls } = handlerFor([{ status: 200, body: JSON.stringify({ success: true, data: result }) }]);
    const { frayme } = browserClient(handler);
    await expect(frayme.compose.create({ prompt: 'x' })).resolves.toEqual(result);
    expect(JSON.parse(calls[0]!.body!)).toEqual({ prompt: 'x', action_policy: 'declared_only', stream: false });
  });

  it('a browser retry reuses its Idempotency-Key upstream, so it can replay instead of composing again', async () => {
    const { handler, calls } = handlerFor([
      { status: 503, body: JSON.stringify({ success: false, error: { code: 'MODEL_UNAVAILABLE', message: 'busy' } }) },
      happy(),
    ]);
    const frayme = new Frayme({
      apiKey: null,
      baseURL: 'https://app.test/api/frayme',
      maxRetries: 1,
      fetch: async (input, init) => handler(new Request(input, init)),
    });
    vi.spyOn(Math, 'random').mockReturnValue(0); // the shortest backoff
    const final = await frayme.compose.stream({ prompt: 'x' }).finalSpec();
    expect(final.generationId).toBe('gen_1');
    expect(calls).toHaveLength(2);
    const keys = calls.map((c) => c.headers.get('idempotency-key'));
    expect(keys[0]).toMatch(/\S/);
    expect(keys[1]).toBe(keys[0]);
  });

  it('an error before the stream reaches the browser with its class, code and retry-after', async () => {
    const { handler } = handlerFor([
      {
        status: 429,
        headers: { 'retry-after': '7' },
        body: JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'Slow down.' } }),
      },
    ]);
    const { frayme } = browserClient(handler);
    const error = await frayme.compose.stream({ prompt: 'x' }).finalSpec().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAfter: 7 });
  });

  it('a request the proxy refuses reaches the browser as a typed error naming the field', async () => {
    const { handler } = handlerFor([]);
    const { frayme } = browserClient(handler);
    const error = await frayme.compose
      .stream({ prompt: 'x', action_policy: 'open' })
      .finalSpec()
      .catch((err: unknown) => err);
    expect(error).toMatchObject({ status: 400, code: 'BAD_REQUEST', message: 'Unknown field "action_policy".' });
  });

  it('composeOutputs runs over the keyless client', async () => {
    const { handler } = handlerFor([happy()]);
    const { frayme } = browserClient(handler);
    const statuses: string[] = [];
    let last: unknown;
    for await (const output of composeOutputs(frayme, { prompt: 'x' })) {
      statuses.push(output.status);
      last = output;
    }
    expect(statuses.at(-1)).toBe('complete');
    expect(last).toMatchObject({ generation_id: 'gen_1', op_count: 3, spec: { root: 'card' } });
  });
});
