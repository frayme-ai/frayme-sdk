import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { Frayme } from '../src/client.js';
import {
  composeOutputs,
  composeErrorRetryable,
  createComposeGuard,
  fraymeModelView,
  ONE_COMPOSE_PER_TURN,
  oneComposePerTurnOutput,
  type ComposeOutputsOptions,
  type FraymeComposeOutput,
} from '../src/agent/index.js';
import type { ComposeRequest } from '../src/api-types.js';
import { OPS, dyingStream, frame, happyPayload, sseStream } from './helpers/fixtures.js';
import { buildMockFetch, type ScriptedResponse } from './helpers/mock-fetch.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// The package ships without Node types; this is the part of `process` the
// tests below listen on.
const nodeProcess = (globalThis as unknown as {
  process: {
    on(event: string, listener: (value: never) => void): void;
    off(event: string, listener: (value: never) => void): void;
  };
}).process;

function client(script: ScriptedResponse[]) {
  const mock = buildMockFetch(script);
  return {
    frayme: new Frayme({ apiKey: 'fr_live_x', baseURL: 'https://api.test', fetch: mock.fetch, maxRetries: 0 }),
    calls: mock.calls,
  };
}

async function collect(
  frayme: Frayme,
  request: Omit<ComposeRequest, 'stream'>,
  options?: ComposeOutputsOptions,
): Promise<FraymeComposeOutput[]> {
  const out: FraymeComposeOutput[] = [];
  for await (const output of composeOutputs(frayme, request, options)) out.push(output);
  return out;
}

/** A response body the test feeds by hand; it errors like fetch when the request aborts. */
function controlled() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let signal: AbortSignal | undefined;
  const body = (s: AbortSignal | undefined): ReadableStream<Uint8Array> => {
    signal = s;
    return new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        s?.addEventListener(
          'abort',
          () => {
            try {
              c.error(new DOMException('The operation was aborted.', 'AbortError'));
            } catch {
              /* already closed */
            }
          },
          { once: true },
        );
      },
    });
  };
  return {
    body,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
    signal: () => signal,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const badRequest = (code = 'BAD_REQUEST', message = 'Invalid request: prior_spec is not a valid spec'): ScriptedResponse => ({
  status: code === 'VALIDATION_ERROR' ? 422 : 400,
  body: JSON.stringify({ success: false, error: { code, message } }),
});

const priorSpec = {
  root: 'card',
  elements: { card: { type: 'Card', props: {}, children: [] } },
} as unknown as Spec;

describe('composeOutputs: what it yields', () => {
  it('yields the first op at once, throttles the rest, and ends with complete', async () => {
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(happyPayload()) }]);
    const outputs = await collect(frayme, { prompt: 'a card' });

    expect(outputs.map((o) => o.status)).toEqual(['streaming', 'complete']);
    const [first, last] = outputs;
    expect(first).toEqual({
      status: 'streaming',
      generation_id: 'gen_1',
      model: 'frayme',
      op_count: 1,
      restart_count: 0,
      spec: { root: 'card', elements: {} },
    });
    expect(last).toEqual({
      status: 'complete',
      generation_id: 'gen_1',
      model: 'frayme',
      op_count: 3,
      restart_count: 0,
      spec: {
        root: 'card',
        elements: { card: OPS[1]!.value, txt: OPS[2]!.value },
      },
    });
    expect(last).not.toHaveProperty('error');
  });

  it('snapshotEveryMs: 0 yields every op, each a separate deep copy', async () => {
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(happyPayload()) }]);
    const outputs = await collect(frayme, { prompt: 'a card' }, { snapshotEveryMs: 0 });

    expect(outputs.map((o) => [o.status, o.op_count])).toEqual([
      ['streaming', 1],
      ['streaming', 2],
      ['streaming', 3],
      ['complete', 3],
    ]);
    expect(Object.keys(outputs[0]!.spec!.elements)).toEqual([]);
    expect(Object.keys(outputs[1]!.spec!.elements)).toEqual(['card']);
    expect(Object.keys(outputs[2]!.spec!.elements)).toEqual(['card', 'txt']);
    // Copies, not the live accumulator: no two outputs share a spec, and
    // mutating one changes nothing else.
    const specs = outputs.map((o) => o.spec);
    expect(new Set(specs).size).toBe(4);
    outputs[2]!.spec!.elements.card!.type = 'Changed';
    expect(outputs[3]!.spec!.elements.card!.type).toBe('Card');
  });

  it('flushes a throttled op when the stream goes quiet, at most once per window', async () => {
    const feed = controlled();
    const { frayme } = client([{ status: 200, sse: true, body: feed.body }]);
    const seen: Array<{ output: FraymeComposeOutput; at: number }> = [];
    const done = (async () => {
      for await (const output of composeOutputs(frayme, { prompt: 'x' }, { snapshotEveryMs: 40 })) {
        seen.push({ output, at: Date.now() });
      }
    })();

    feed.push(frame.started() + frame.op(OPS[0]!) + frame.op(OPS[1]!));
    await sleep(150);
    // The op held back inside the window was shown once the window closed.
    expect(seen.map((s) => s.output.op_count)).toEqual([1, 2]);
    expect(seen[1]!.at - seen[0]!.at).toBeGreaterThanOrEqual(35);
    expect(Object.keys(seen[1]!.output.spec!.elements)).toEqual(['card']);

    feed.push(frame.op(OPS[2]!) + frame.completed());
    feed.close();
    await done;
    // The window had long passed, so op 3 showed at once, then the terminal.
    expect(seen.map((s) => [s.output.status, s.output.op_count])).toEqual([
      ['streaming', 1],
      ['streaming', 2],
      ['streaming', 3],
      ['complete', 3],
    ]);
  });

  it('yields restarted at once with spec null, then streams the new attempt from its first op', async () => {
    const payload =
      frame.started() +
      frame.op(OPS[0]!) +
      frame.op(OPS[1]!) +
      frame.restarted() +
      OPS.map((p) => frame.op(p)).join('') +
      frame.completed({ model: 'frayme/fallback-model' });
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const outputs = await collect(frayme, { prompt: 'x' });

    expect(outputs.map((o) => [o.status, o.op_count, o.restart_count])).toEqual([
      ['streaming', 1, 0],
      ['restarted', 0, 1],
      ['streaming', 1, 1],
      ['complete', 3, 1],
    ]);
    expect(outputs[1]).toEqual({
      status: 'restarted',
      generation_id: 'gen_1',
      model: 'frayme/fallback-model',
      op_count: 0,
      restart_count: 1,
      spec: null,
    });
    // The post-restart snapshot holds only the new attempt's ops.
    expect(outputs[2]!.spec).toEqual({ root: 'card', elements: {} });
    expect(outputs[3]!.model).toBe('frayme/fallback-model');
  });

  it('a consumer that lags gets the latest snapshot of each attempt, each matching its own op count', async () => {
    const feed = controlled();
    const { frayme } = client([{ status: 200, sse: true, body: feed.body }]);
    const outputs = composeOutputs(frayme, { prompt: 'x' }, { snapshotEveryMs: 0 })[Symbol.asyncIterator]();
    const row = (o: FraymeComposeOutput) => [
      o.status,
      o.restart_count,
      o.op_count,
      o.spec ? Object.keys(o.spec.elements).length : null,
    ];

    const first = outputs.next(); // starts the request, which opens the feed
    feed.push(frame.started() + frame.op(OPS[0]!));
    expect(row((await first).value!)).toEqual(['streaming', 0, 1, 0]);

    // The consumer is busy while the stream reads ahead: two ops, a restart,
    // and the whole second attempt.
    feed.push(frame.op(OPS[1]!) + frame.op(OPS[2]!));
    await sleep(10);
    feed.push(frame.restarted() + OPS.map((p) => frame.op(p)).join(''));
    await sleep(10);
    feed.push(frame.completed());
    feed.close();
    await sleep(10);

    const rest: FraymeComposeOutput[] = [];
    for (let next = await outputs.next(); !next.done; next = await outputs.next()) rest.push(next.value);
    expect(rest.map(row)).toEqual([
      ['streaming', 0, 3, 2],
      ['restarted', 1, 0, null],
      ['streaming', 1, 3, 2],
      ['complete', 1, 3, 2],
    ]);
  });

  it('a slow consumer is never handed a backlog of stale snapshots', async () => {
    const feed = controlled();
    const { frayme } = client([{ status: 200, sse: true, body: feed.body }]);
    const seen: Array<{ status: string; ops: number; at: number }> = [];
    const started = Date.now();
    const done = (async () => {
      for await (const output of composeOutputs(frayme, { prompt: 'x' }, { snapshotEveryMs: 10 })) {
        seen.push({ status: output.status, ops: output.op_count, at: Date.now() - started });
        await sleep(100); // a slow writer
      }
    })();

    feed.push(frame.started() + frame.op({ op: 'add', path: '/root', value: 'r' }));
    for (let i = 0; i < 12; i++) {
      await sleep(15);
      feed.push(frame.op({ op: 'add', path: `/elements/e${i}`, value: { type: 'Text', props: { content: 'x' } } }));
    }
    feed.push(frame.completed({ operation_count: 13 }));
    feed.close();
    const closedAt = Date.now() - started;
    await done;

    // At most one streaming output is waiting when the stream ends, so the
    // terminal follows within about two of the consumer's pauses.
    const terminal = seen.at(-1)!;
    expect(terminal.status).toBe('complete');
    expect(terminal.at - closedAt).toBeLessThan(250);
    const afterClose = seen.filter((s) => s.at > closedAt && s.status === 'streaming');
    expect(afterClose.length).toBeLessThanOrEqual(1);
    // What it did get is always newer than what came before.
    const counts = seen.filter((s) => s.status === 'streaming').map((s) => s.ops);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
    expect(new Set(counts).size).toBe(counts.length);
  });

  it('snapshotEveryMs: unusable values fall back or clamp, and never turn the throttle off', async () => {
    const warnings: Error[] = [];
    const onWarning = (warning: Error) => warnings.push(warning);
    nodeProcess.on('warning', onWarning);
    try {
      for (const snapshotEveryMs of [Number.POSITIVE_INFINITY, 2 ** 40]) {
        const feed = controlled();
        const { frayme } = client([{ status: 200, sse: true, body: feed.body }]);
        const statuses: string[] = [];
        const done = (async () => {
          for await (const o of composeOutputs(frayme, { prompt: 'x' }, { snapshotEveryMs })) {
            statuses.push(`${o.status}:${o.op_count}`);
          }
        })();
        feed.push(frame.started() + frame.op(OPS[0]!));
        await sleep(15);
        feed.push(frame.op(OPS[1]!));
        await sleep(15);
        feed.push(frame.op(OPS[2]!) + frame.completed());
        feed.close();
        await done;
        // The first op shows at once; the rest wait for a window that never closes.
        expect(statuses, String(snapshotEveryMs)).toEqual(['streaming:1', 'complete:3']);
      }
      await sleep(5);
      expect(warnings.filter((w) => w.name === 'TimeoutOverflowWarning')).toEqual([]);
    } finally {
      nodeProcess.off('warning', onWarning);
    }

    // NaN, and anything not a number, means the default window: one burst, one snapshot.
    for (const snapshotEveryMs of [Number.NaN, '0' as never, null as never]) {
      const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(happyPayload()) }]);
      const outputs = await collect(frayme, { prompt: 'x' }, { snapshotEveryMs });
      expect(outputs.map((o) => o.status), String(snapshotEveryMs)).toEqual(['streaming', 'complete']);
    }
    // A negative window is no window.
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(happyPayload()) }]);
    expect(await collect(frayme, { prompt: 'x' }, { snapshotEveryMs: -5 })).toHaveLength(4);
  });

  it('builds on prior_spec: snapshots start from it and the final spec is a copy', async () => {
    const patch = { op: 'add', path: '/elements/extra', value: { type: 'Text', props: { content: 'New' } } };
    const payload = frame.started() + frame.op(patch) + frame.completed({ operation_count: 1 });
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const prior = structuredClone(priorSpec);
    const outputs = await collect(frayme, { prompt: 'add a line', mode: 'edit', prior_spec: prior });

    const last = outputs.at(-1)!;
    expect(last.status).toBe('complete');
    expect(Object.keys(last.spec!.elements)).toEqual(['card', 'extra']);
    expect(prior).toEqual(priorSpec); // the caller's prior spec is untouched
  });
});

describe('composeOutputs: errors, aborts and the terminal rule', () => {
  it('an in-band error ends with an error output carrying code, status and message; it never throws', async () => {
    const payload = frame.started() + frame.op(OPS[0]!) + frame.errorEvent('COMPOSITION_FAILED', 'all attempts failed');
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const outputs = await collect(frayme, { prompt: 'x' });

    expect(outputs.map((o) => o.status)).toEqual(['streaming', 'error']);
    expect(outputs.at(-1)).toEqual({
      status: 'error',
      generation_id: 'gen_1',
      model: 'frayme',
      op_count: 1,
      restart_count: 0,
      spec: null,
      error: { message: 'all attempts failed', code: 'COMPOSITION_FAILED', status: 502 },
    });
  });

  it('an HTTP error before the stream carries retry_after when the API sent one', async () => {
    const { frayme } = client([
      {
        status: 429,
        headers: { 'retry-after': '7' },
        body: JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'Slow down.' } }),
      },
    ]);
    const outputs = await collect(frayme, { prompt: 'x' });
    expect(outputs).toEqual([
      {
        status: 'error',
        op_count: 0,
        restart_count: 0,
        spec: null,
        error: { message: 'Slow down.', code: 'RATE_LIMITED', status: 429, retry_after: 7 },
      },
    ]);
  });

  it('a connection that dies mid-stream ends in an error output, not a throw', async () => {
    const { frayme } = client([
      {
        status: 200,
        sse: true,
        body: () => dyingStream(frame.started() + frame.op(OPS[0]!), new TypeError('socket hang up')),
      },
    ]);
    const last = (await collect(frayme, { prompt: 'x' })).at(-1)!;
    expect(last.status).toBe('error');
    expect(last.error!.message).toMatch(/socket hang up/);
    expect(last.spec).toBeNull();
  });

  it('a stream that ends without compose.completed is an error', async () => {
    const payload = frame.started() + frame.op(OPS[0]!);
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const last = (await collect(frayme, { prompt: 'x' })).at(-1)!;
    expect(last.status).toBe('error');
    expect(last.error!.message).toMatch(/ended before compose.completed/);
  });

  it('aborting mid-stream ends with an ABORTED error output and aborts the request', async () => {
    const feed = controlled();
    const { frayme } = client([{ status: 200, sse: true, body: feed.body }]);
    const abort = new AbortController();
    const outputs: FraymeComposeOutput[] = [];
    const done = (async () => {
      for await (const output of composeOutputs(frayme, { prompt: 'x' }, { signal: abort.signal })) {
        outputs.push(output);
        if (output.status === 'streaming') abort.abort();
      }
    })();
    feed.push(frame.started() + frame.op(OPS[0]!));
    await done;

    expect(outputs.map((o) => o.status)).toEqual(['streaming', 'error']);
    expect(outputs[1]!.error).toEqual({ message: 'The compose was aborted.', code: 'ABORTED' });
    expect(feed.signal()?.aborted).toBe(true);
  });

  it('an already aborted signal yields one ABORTED output', async () => {
    const { frayme, calls } = client([{ status: 200, sse: true, body: () => sseStream(happyPayload()) }]);
    const abort = new AbortController();
    abort.abort();
    const outputs = await collect(frayme, { prompt: 'x' }, { signal: abort.signal });
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ status: 'error', spec: null, error: { code: 'ABORTED' } });
    expect(calls).toHaveLength(0);
  });

  it('stopping the iteration early aborts the upstream request', async () => {
    const feed = controlled();
    const { frayme } = client([{ status: 200, sse: true, body: feed.body }]);
    const done = (async () => {
      for await (const output of composeOutputs(frayme, { prompt: 'x' })) {
        if (output.status === 'streaming') break;
      }
    })();
    feed.push(frame.started() + frame.op(OPS[0]!));
    await done;
    expect(feed.signal()?.aborted).toBe(true);
  });

  it('a request that is not an object yields one BAD_REQUEST output and calls nothing', async () => {
    for (const request of [null, undefined, 'a card', ['x'], 5]) {
      const { frayme, calls } = client([]);
      const outputs = await collect(frayme, request as never);
      expect(outputs, String(request)).toEqual([
        {
          status: 'error',
          op_count: 0,
          restart_count: 0,
          spec: null,
          error: { message: 'The compose request must be an object.', code: 'BAD_REQUEST' },
        },
      ]);
      expect(calls).toHaveLength(0);
    }
    // Options that are not an object are ignored rather than read.
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(happyPayload()) }]);
    expect((await collect(frayme, { prompt: 'x' }, null as never)).at(-1)!.status).toBe('complete');
  });

  it('never throws even when the client itself throws', async () => {
    const broken = {
      compose: {
        stream: () => {
          throw new Error('client exploded');
        },
      },
    } as unknown as Frayme;
    const outputs = await collect(broken, { prompt: 'x' });
    expect(outputs).toEqual([
      { status: 'error', op_count: 0, restart_count: 0, spec: null, error: { message: 'client exploded' } },
    ]);
  });
});

describe('composeOutputs: one fresh retry when prior_spec is rejected', () => {
  it('a 400 before any op retries once without prior_spec, and edit becomes a create', async () => {
    const { frayme, calls } = client([
      badRequest(),
      { status: 200, sse: true, body: () => sseStream(happyPayload()) },
    ]);
    const outputs = await collect(frayme, {
      prompt: 'change the header',
      mode: 'edit',
      prior_spec: priorSpec,
      data: { title: 'Q3' },
      action_policy: 'declared_only',
    });

    expect(outputs.at(-1)!.status).toBe('complete');
    expect(outputs.some((o) => o.status === 'error')).toBe(false);
    expect(calls).toHaveLength(2);
    const firstBody = JSON.parse(calls[0]!.body!) as Record<string, unknown>;
    const retryBody = JSON.parse(calls[1]!.body!) as Record<string, unknown>;
    expect(firstBody).toMatchObject({ mode: 'edit', prior_spec: priorSpec });
    expect(retryBody).toEqual({
      prompt: 'change the header',
      data: { title: 'Q3' },
      action_policy: 'declared_only',
      stream: true,
    });
    // Every output of the fresh attempt says the prior screen was dropped.
    expect(outputs.every((o) => o.prior_spec_dropped === true)).toBe(true);
    // The fresh attempt is not seeded with the rejected spec.
    expect(Object.keys(outputs.at(-1)!.spec!.elements)).toEqual(['card', 'txt']);
    expect(outputs.at(-1)!.spec!.elements.card!.type).toBe('Card');
  });

  it('a 422 and an in-band BAD_REQUEST before any op also retry; continue_journey keeps its mode', async () => {
    const { frayme, calls } = client([
      badRequest('VALIDATION_ERROR', 'Request body does not match'),
      { status: 200, sse: true, body: () => sseStream(happyPayload()) },
    ]);
    const request: Omit<ComposeRequest, 'stream'> = {
      prompt: 'next step',
      mode: 'continue_journey',
      prior_spec: priorSpec,
      action_context: { action: 'next' },
    };
    expect((await collect(frayme, request)).at(-1)!.status).toBe('complete');
    expect(JSON.parse(calls[1]!.body!)).toEqual({
      prompt: 'next step',
      mode: 'continue_journey',
      action_context: { action: 'next' },
      stream: true,
    });

    const inBand = frame.started() + frame.errorEvent('BAD_REQUEST', 'prior_spec rejected');
    const second = client([
      { status: 200, sse: true, body: () => sseStream(inBand) },
      { status: 200, sse: true, body: () => sseStream(happyPayload()) },
    ]);
    expect((await collect(second.frayme, request)).at(-1)!.status).toBe('complete');
    expect(second.calls).toHaveLength(2);
  });

  it('does not retry without prior_spec, after an op, twice, on other errors, or when turned off', async () => {
    const cases: Array<{
      name: string;
      script: ScriptedResponse[];
      request: Omit<ComposeRequest, 'stream'>;
      options?: ComposeOutputsOptions;
      calls: number;
      code: string;
    }> = [
      { name: 'no prior_spec', script: [badRequest()], request: { prompt: 'x' }, calls: 1, code: 'BAD_REQUEST' },
      {
        name: 'after an op',
        script: [
          {
            status: 200,
            sse: true,
            body: () => sseStream(frame.started() + frame.op(OPS[0]!) + frame.errorEvent('BAD_REQUEST', 'late')),
          },
        ],
        request: { prompt: 'x', prior_spec: priorSpec },
        calls: 1,
        code: 'BAD_REQUEST',
      },
      {
        name: 'only once',
        script: [badRequest(), badRequest('BAD_REQUEST', 'still bad')],
        request: { prompt: 'x', mode: 'edit', prior_spec: priorSpec },
        calls: 2,
        code: 'BAD_REQUEST',
      },
      {
        name: 'a 502 is not a prior_spec rejection',
        script: [
          { status: 502, body: JSON.stringify({ success: false, error: { code: 'COMPOSITION_FAILED', message: 'no' } }) },
        ],
        request: { prompt: 'x', prior_spec: priorSpec },
        calls: 1,
        code: 'COMPOSITION_FAILED',
      },
      {
        name: 'turned off',
        script: [badRequest()],
        request: { prompt: 'x', prior_spec: priorSpec },
        options: { retryWithoutPriorSpec: false },
        calls: 1,
        code: 'BAD_REQUEST',
      },
    ];
    for (const c of cases) {
      const { frayme, calls } = client(c.script);
      const outputs = await collect(frayme, c.request, c.options);
      expect(outputs.at(-1)!.status, c.name).toBe('error');
      expect(outputs.at(-1)!.error!.code, c.name).toBe(c.code);
      expect(calls, c.name).toHaveLength(c.calls);
    }
  });

  it('the terminal output of a failed retry reports the retry error', async () => {
    const { frayme } = client([badRequest(), badRequest('BAD_REQUEST', 'still bad')]);
    const outputs = await collect(frayme, { prompt: 'x', prior_spec: priorSpec });
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.error).toEqual({ message: 'still bad', code: 'BAD_REQUEST', status: 400 });
  });
});

describe('fraymeModelView', () => {
  const base = { op_count: 3, restart_count: 0, spec: { root: 'r', elements: {} } as Spec };

  it('complete: generation id, status and operation count only', () => {
    const view = fraymeModelView({ ...base, status: 'complete', generation_id: 'gen_9', model: 'm' });
    expect(view).toEqual({ generation_id: 'gen_9', status: 'complete', operation_count: 3 });
  });

  it('error: message, code, whether a retry can help, and when to retry', () => {
    const view = fraymeModelView({
      ...base,
      spec: null,
      status: 'error',
      generation_id: 'gen_9',
      error: { message: 'Slow down.', code: 'RATE_LIMITED', status: 429, retry_after: 7 },
    });
    expect(view).toEqual({
      status: 'error',
      message: 'Slow down.',
      code: 'RATE_LIMITED',
      retryable: false,
      retry_after: 7,
      next: expect.stringContaining('Tell the user'),
    });
    expect(fraymeModelView({ ...base, spec: null, status: 'error', error: { message: 'boom' } })).toEqual({
      status: 'error',
      message: 'boom',
      retryable: true,
    });
    const fixable = fraymeModelView({
      ...base,
      spec: null,
      status: 'error',
      error: { message: 'Bad prompt.', code: 'VALIDATION_ERROR', status: 422 },
    });
    expect(fixable).toEqual({ status: 'error', message: 'Bad prompt.', code: 'VALIDATION_ERROR', retryable: true });
  });

  it('complete: says when the prior screen was dropped', () => {
    expect(fraymeModelView({ ...base, status: 'complete', generation_id: 'gen_9', prior_spec_dropped: true })).toMatchObject({
      status: 'complete',
      prior_screen_dropped: true,
    });
  });

  it('composeErrorRetryable: what a retry this turn could fix', () => {
    const at = (status?: number, code?: string) => composeErrorRetryable({ message: 'x', status, code });
    expect([400, 422, 500, 502, 503].map((s) => at(s))).toEqual([true, true, true, true, true]);
    expect([401, 402, 403, 404, 409, 429].map((s) => at(s))).toEqual([false, false, false, false, false, false]);
    expect(at(undefined)).toBe(true);
    expect(at(undefined, 'ABORTED')).toBe(false);
    expect(at(undefined, ONE_COMPOSE_PER_TURN)).toBe(false);
    expect(composeErrorRetryable({ message: 'x', status: 500, retryable: false })).toBe(false);
    expect(composeErrorRetryable({ message: 'x', status: 401, retryable: true })).toBe(true);
    expect(composeErrorRetryable(undefined)).toBe(false);
  });

  it('a non-terminal output reads as interrupted', () => {
    for (const status of ['streaming', 'restarted'] as const) {
      expect(fraymeModelView({ ...base, status, generation_id: 'gen_9' })).toEqual({
        status: 'interrupted',
        message: 'The screen did not finish rendering.',
      });
    }
  });

  it('never includes the spec', () => {
    for (const status of ['streaming', 'restarted', 'complete', 'error'] as const) {
      expect(JSON.stringify(fraymeModelView({ ...base, status }))).not.toContain('elements');
    }
  });
});

describe('one compose per turn', () => {
  it('a guard lets the first claim through and refuses the rest; guards are independent', () => {
    const turn1 = createComposeGuard();
    const turn2 = createComposeGuard();
    expect(turn1.claim()).toBe(true);
    expect(turn1.claim()).toBe(false);
    expect(turn1.claim()).toBe(false);
    expect(turn2.claim()).toBe(true);
  });

  it('release hands the compose back, once per claim', () => {
    const turn = createComposeGuard();
    expect(turn.claim()).toBe(true);
    turn.release();
    expect(turn.claim()).toBe(true);
    expect(turn.claim()).toBe(false);
  });

  it('the refusal output is a terminal error the model can read', () => {
    const output = oneComposePerTurnOutput();
    expect(ONE_COMPOSE_PER_TURN).toBe('ONE_COMPOSE_PER_TURN');
    expect(output).toMatchObject({
      status: 'error',
      op_count: 0,
      restart_count: 0,
      spec: null,
      refused: true,
      error: { code: ONE_COMPOSE_PER_TURN, retryable: false },
    });
    expect(output.error!.message).toMatch(/already composed this turn/);
    expect(output.error!.message).not.toMatch(/[\u2013\u2014]/);
    expect(fraymeModelView(output)).toEqual({
      status: 'error',
      message: output.error!.message,
      code: ONE_COMPOSE_PER_TURN,
      retryable: false,
    });
    // A fresh object each time, so one caller cannot edit another's copy.
    expect(oneComposePerTurnOutput()).not.toBe(output);
  });
});
