import { afterEach, describe, expect, it, vi } from 'vitest';
import { Frayme } from '../src/client.js';
import { RateLimitError } from '../src/core/errors.js';
import { buildMockFetch } from './helpers/mock-fetch.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const RESULT = {
  success: true,
  data: {
    generation_id: 'gen_9',
    spec: { root: 'card', elements: { card: { type: 'Card', props: {} } } },
    model: 'frayme',
    operation_count: 2,
    validated: true,
    usage: { input_tokens: 10, output_tokens: 20 },
  },
};

describe('compose.create (non-streaming)', () => {
  it('unwraps the success envelope and sends stream:false + correct headers', async () => {
    const mock = buildMockFetch([{ status: 200, body: JSON.stringify(RESULT) }]);
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch });
    const result = await frayme.compose.create({ prompt: 'a card', stream: false });

    expect(result.generation_id).toBe('gen_9');
    expect(result.spec.root).toBe('card');

    const call = mock.calls[0]!;
    expect(call.url).toBe('https://api.test/v1/compose');
    expect(call.method).toBe('POST');
    expect(call.headers.get('authorization')).toBe('Bearer fr_live_k');
    expect(call.headers.get('accept')).toBe('application/json');
    expect(call.headers.get('content-type')).toBe('application/json');
    expect(call.headers.get('user-agent')).toMatch(/^frayme-node\//);
    expect(JSON.parse(call.body!)).toEqual({ prompt: 'a card', stream: false });
  });

  it('retry-then-success: 500 → 429+Retry-After → 200, exact delays, ONE idempotency key', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter factor 0.75 → integer delays
    const mock = buildMockFetch([
      { status: 500, body: JSON.stringify({ success: false, error: { message: 'oops', code: 'INTERNAL_SERVER_ERROR' } }) },
      {
        status: 429,
        headers: { 'retry-after': '1' },
        body: JSON.stringify({ success: false, error: { message: 'slow down', code: 'RATE_LIMITED' } }),
      },
      { status: 200, body: JSON.stringify(RESULT) },
    ]);
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch });

    const promise = frayme.compose.create({ prompt: 'x', stream: false });
    const settled = expect(promise).resolves.toMatchObject({ generation_id: 'gen_9' });

    // attempt 1 fires immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.calls).toHaveLength(1);
    // backoff(0) = 500 × 0.75 = 375ms before attempt 2
    await vi.advanceTimersByTimeAsync(374);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(2);
    // Retry-After 1s (1000ms) beats backoff(1) = 750ms before attempt 3
    await vi.advanceTimersByTimeAsync(999);
    expect(mock.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(3);

    await settled;
    const keys = mock.calls.map((c) => c.headers.get('idempotency-key'));
    expect(keys[0]).toMatch(/^frayme-node-retry-/);
    expect(new Set(keys).size).toBe(1);
  });

  it('non-retryable errors throw immediately with the typed class', async () => {
    const mock = buildMockFetch([
      {
        status: 429,
        headers: { 'retry-after': '3' },
        body: JSON.stringify({ success: false, error: { message: 'limited', code: 'RATE_LIMITED' } }),
      },
    ]);
    const frayme = new Frayme({
      apiKey: 'fr_live_k',
      baseURL: 'https://api.test',
      fetch: mock.fetch,
      maxRetries: 0,
    });
    const err = await frayme.compose.create({ prompt: 'x', stream: false }).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfter).toBe(3);
    expect(mock.calls).toHaveLength(1);
  });

  it('a user-supplied Idempotency-Key passes through verbatim; none is sent on GETs', async () => {
    const mock = buildMockFetch([
      { status: 200, body: JSON.stringify(RESULT) },
      { status: 200, body: JSON.stringify({ success: true, data: { status: 'ok', service: 's', catalog_version: '0.1.0' } }) },
    ]);
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch });
    await frayme.compose.create({ prompt: 'x', stream: false }, { idempotencyKey: 'my-key-123' });
    await frayme.health();
    expect(mock.calls[0]!.headers.get('idempotency-key')).toBe('my-key-123');
    expect(mock.calls[1]!.headers.get('idempotency-key')).toBeNull();
  });

  it('replayed results surface the replayed flag', async () => {
    const replayed = { ...RESULT, data: { ...RESULT.data, replayed: true } };
    const mock = buildMockFetch([{ status: 200, body: JSON.stringify(replayed) }]);
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch });
    const result = await frayme.compose.create({ prompt: 'x', stream: false });
    expect(result.replayed).toBe(true);
  });
});
