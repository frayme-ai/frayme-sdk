import { afterEach, describe, expect, it, vi } from 'vitest';
import { Frayme } from '../src/client.js';
import {
  APIConnectionError,
  APIUserAbortError,
  CompositionFailedError,
  FraymeError,
} from '../src/core/errors.js';
import type { ComposeStreamEvent } from '../src/streaming/events.js';
import { OPS, dyingStream, frame, happyPayload, openStream, sseStream } from './helpers/fixtures.js';
import { buildMockFetch, type ScriptedResponse } from './helpers/mock-fetch.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function client(script: ScriptedResponse[]): { frayme: Frayme; calls: ReturnType<typeof buildMockFetch>['calls'] } {
  const mock = buildMockFetch(script);
  return {
    frayme: new Frayme({ apiKey: 'fr_live_x', baseURL: 'https://api.test', fetch: mock.fetch }),
    calls: mock.calls,
  };
}

describe('ComposeStream', () => {
  it('happy path: ordered events, op handler gets accumulating snapshots, finalSpec resolves', async () => {
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(happyPayload()) }]);
    const stream = frayme.compose.stream({ prompt: 'a card' });

    const seen: string[] = [];
    const snapshots: unknown[] = [];
    stream.on('started', () => seen.push('started'));
    stream.on('op', (_op, snapshot) => {
      seen.push('op');
      snapshots.push(structuredClone(snapshot));
    });
    stream.on('completed', () => seen.push('completed'));

    const iterated: ComposeStreamEvent[] = [];
    for await (const event of stream) iterated.push(event);

    expect(seen).toEqual(['started', 'op', 'op', 'op', 'completed']);
    expect(iterated.map((e) => e.type)).toEqual([
      'compose.started',
      'op',
      'op',
      'op',
      'compose.completed',
    ]);

    const final = await stream.finalSpec();
    expect(final.generationId).toBe('gen_1');
    expect(final.operationCount).toBe(3);
    expect(final.usage).toEqual({ input_tokens: 100, output_tokens: 200 });
    expect(final.replayed).toBe(false);
    const spec = final.spec as { root?: string; elements?: Record<string, unknown> };
    expect(spec.root).toBe('card');
    expect(Object.keys(spec.elements ?? {})).toEqual(['card', 'txt']);
    // snapshots grew progressively
    expect((snapshots[0] as { root?: string }).root).toBe('card');
    expect(Object.keys((snapshots[2] as { elements: object }).elements)).toHaveLength(2);
  });

  it('restart mid-stream: snapshot contains ONLY post-restart ops; final model is the rescuer', async () => {
    const payload =
      frame.started() +
      frame.op(OPS[0]!) +
      frame.op(OPS[1]!) +
      frame.restarted() +
      OPS.map((p) => frame.op(p)).join('') +
      frame.completed({ model: 'frayme/fallback-model' });
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(payload) }]);

    const stream = frayme.compose.stream({ prompt: 'x' });
    let restartReason: string | undefined;
    let snapshotAtRestart: unknown;
    stream.on('restarted', (e) => {
      restartReason = e.reason.code;
      snapshotAtRestart = structuredClone(stream.currentSpec());
    });

    const final = await stream.finalSpec();
    expect(restartReason).toBe('catalog_validation_failed');
    expect(snapshotAtRestart).toEqual({ elements: {} }); // reset before the handler ran, elements seeded
    expect(final.model).toBe('frayme/fallback-model');
    expect((final.spec as { root?: string }).root).toBe('card');
    expect(Object.keys((final.spec as { elements: object }).elements)).toHaveLength(2);
  });

  it('replay burst delivered in ONE chunk parses fully and carries replayed:true', async () => {
    const { frayme } = client([
      { status: 200, sse: true, body: () => sseStream(happyPayload({ replayed: true })) },
    ]);
    const stream = frayme.compose.stream({ prompt: 'x' });
    const final = await stream.finalSpec();
    expect(final.replayed).toBe(true);
  });

  it('pings interleaved anywhere (even split mid-ping) cause zero spurious events', async () => {
    const payload =
      frame.ping() + frame.started() + frame.ping() + frame.op(OPS[0]!) + frame.ping() + frame.completed({ operation_count: 1 });
    const pingByte = payload.indexOf(': ping', 10) + 3;
    const { frayme } = client([
      { status: 200, sse: true, body: () => sseStream(payload, { splitAt: [pingByte] }) },
    ]);
    const events: string[] = [];
    for await (const e of await frayme.compose.create({ prompt: 'x', stream: true })) {
      events.push(e.type);
    }
    expect(events).toEqual(['compose.started', 'op', 'compose.completed']);
  });

  it('abort(): iterator ends cleanly, abort handler fires, error handler does NOT, finalSpec rejects', async () => {
    const { frayme } = client([
      {
        status: 200,
        sse: true,
        body: (signal) => openStream(frame.started() + frame.op(OPS[0]!), signal),
      },
    ]);
    const stream = frayme.compose.stream({ prompt: 'x' });
    const onAbort = vi.fn();
    const onError = vi.fn();
    stream.on('abort', onAbort);
    stream.on('error', onError);

    const types: string[] = [];
    for await (const event of stream) {
      types.push(event.type);
      if (event.type === 'op') stream.abort();
    }

    expect(types).toEqual(['compose.started', 'op']);
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    await expect(stream.finalSpec()).rejects.toBeInstanceOf(APIUserAbortError);
  });

  it('in-band error event: iterator throws the typed error, error handler gets the same instance', async () => {
    const payload =
      frame.started() + frame.op(OPS[0]!) + frame.errorEvent('COMPOSITION_FAILED', 'all attempts failed');
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const stream = frayme.compose.stream({ prompt: 'x' });
    let handlerError: unknown;
    stream.on('error', (e) => (handlerError = e));

    let thrown: unknown;
    try {
      for await (const _ of stream) {
        /* drain */
      }
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(CompositionFailedError);
    expect(handlerError).toBe(thrown);
    await expect(stream.finalSpec()).rejects.toBe(thrown);
  });

  it('retry-then-success for streams: 503 then 200, same Idempotency-Key on both attempts', async () => {
    const { frayme, calls } = client([
      { status: 503, body: JSON.stringify({ success: false, error: { message: 'cold', code: 'MODEL_UNAVAILABLE' } }) },
      { status: 200, sse: true, body: () => sseStream(happyPayload()) },
    ]);
    const stream = frayme.compose.stream({ prompt: 'x' });
    const final = await stream.finalSpec();
    expect(final.generationId).toBe('gen_1');
    expect(calls).toHaveLength(2);
    const key0 = calls[0]!.headers.get('idempotency-key');
    expect(key0).toMatch(/^frayme-node-retry-[0-9a-f-]{36}$/);
    expect(calls[1]!.headers.get('idempotency-key')).toBe(key0);
  });

  it('NO retry once the stream has started: mid-stream death → APIConnectionError, exactly 1 fetch', async () => {
    const { frayme, calls } = client([
      {
        status: 200,
        sse: true,
        body: () => dyingStream(frame.started() + frame.op(OPS[0]!), new TypeError('fetch failed')),
      },
    ]);
    const stream = frayme.compose.stream({ prompt: 'x' });
    let thrown: unknown;
    try {
      for await (const _ of stream) {
        /* drain */
      }
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(APIConnectionError);
    expect(calls).toHaveLength(1);
    await expect(stream.finalSpec()).rejects.toBe(thrown);
  });

  it('first-event timeout: ping-only stream fails with APIConnectionError after the deadline', async () => {
    vi.useFakeTimers();
    const { frayme } = client([
      { status: 200, sse: true, body: (signal) => openStream(frame.ping(), signal) },
    ]);
    const stream = frayme.compose.stream({ prompt: 'x' }, { maxRetries: 0 });
    const finalP = stream.finalSpec();
    const rejection = expect(finalP).rejects.toBeInstanceOf(APIConnectionError);
    await vi.advanceTimersByTimeAsync(90_001);
    await rejection;
  });

  it('malformed JSON in a data line fails LOUD, never silently skipped', async () => {
    const payload = frame.started() + 'event: op\ndata: {not-json\n\n';
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const stream = frayme.compose.stream({ prompt: 'x' });
    await expect(stream.finalSpec()).rejects.toBeInstanceOf(FraymeError);
    await expect(stream.finalSpec()).rejects.toThrow(/Malformed event data/);
  });

  it('stream ending without compose.completed is an error, not a silent success', async () => {
    const payload = frame.started() + frame.op(OPS[0]!); // closes cleanly, no completed
    const { frayme } = client([{ status: 200, sse: true, body: () => sseStream(payload) }]);
    const stream = frayme.compose.stream({ prompt: 'x' });
    await expect(stream.finalSpec()).rejects.toThrow(/ended before compose.completed/);
  });
});
