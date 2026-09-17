import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Frayme } from '@frayme/api';
import type { Spec } from '@json-render/core';
import { MISSING_CLIENT_MESSAGE, useFraymeCompose, type UseFraymeComposeReturn } from '../src/react/useFraymeCompose.js';

type Handler = (...args: unknown[]) => void;

/** Scripted stand-in for @frayme/api's ComposeStream. */
function fakeStream() {
  const handlers: Record<string, Handler[]> = {};
  let resolveFinal!: (v: unknown) => void;
  let rejectFinal!: (e: unknown) => void;
  const final = new Promise((res, rej) => {
    resolveFinal = res;
    rejectFinal = rej;
  });
  final.catch(() => {});
  return {
    stream: {
      on(event: string, handler: Handler) {
        (handlers[event] ??= []).push(handler);
        return this;
      },
      finalSpec: () => final,
      abort: vi.fn(),
      controller: new AbortController(),
    },
    emit: (event: string, ...args: unknown[]) => handlers[event]?.forEach((h) => h(...args)),
    resolveFinal,
    rejectFinal,
  };
}

function fakeClient(streams: ReturnType<typeof fakeStream>[]): Frayme {
  let i = 0;
  return {
    compose: { stream: () => streams[i++]!.stream },
  } as unknown as Frayme;
}

const snap = (root: string): Spec => ({ root, elements: {} }) as unknown as Spec;

describe('useFraymeCompose', () => {
  it('streams ops, handles compose.restarted with a restartKey bump + snapshot discard, commits final', async () => {
    const s = fakeStream();
    const client = fakeClient([s]); // hoisted: a fresh client per render would reset its stream cursor
    const { result } = renderHook(() => useFraymeCompose(client));

    let composePromise!: Promise<unknown>;
    act(() => {
      composePromise = result.current.compose({ prompt: 'a card' });
    });
    expect(result.current.status).toBe('streaming');

    act(() => s.emit('op', { type: 'op' }, snap('a')));
    expect(result.current.spec).toEqual(snap('a'));

    act(() => s.emit('restarted', { type: 'compose.restarted', model: 'fallback', reason: { code: 'x' } }));
    expect(result.current.status).toBe('restarting');
    expect(result.current.spec).toBeNull();
    expect(result.current.restartKey).toBe(1);
    expect(result.current.model).toBe('fallback');

    act(() => s.emit('op', { type: 'op' }, snap('b')));
    expect(result.current.status).toBe('streaming');

    await act(async () => {
      s.resolveFinal({
        spec: snap('b'),
        generationId: 'gen_1',
        model: 'fallback',
        operationCount: 1,
        usage: { input_tokens: 1, output_tokens: 2 },
        replayed: false,
      });
      await composePromise;
    });
    expect(result.current.status).toBe('complete');
    // the committed spec carries the generation_id stamped from the envelope (#6)
    expect(result.current.spec).toEqual({ ...snap('b'), generation_id: 'gen_1' });
  });

  it('surfaces stream errors as status=error and aborts a previous stream on re-compose', async () => {
    const s1 = fakeStream();
    const s2 = fakeStream();
    const client = fakeClient([s1, s2]);
    const { result } = renderHook(() => useFraymeCompose(client));

    let p1!: Promise<unknown>;
    act(() => {
      p1 = result.current.compose({ prompt: 'one' });
    });
    let p2!: Promise<unknown>;
    act(() => {
      p2 = result.current.compose({ prompt: 'two' });
    });
    expect(s1.stream.abort).toHaveBeenCalled();

    const { FraymeError } = await import('@frayme/api');
    await act(async () => {
      s1.rejectFinal(new FraymeError('boom'));
      s2.rejectFinal(new FraymeError('bust'));
      await Promise.all([p1, p2]);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('bust');
  });

  it('throws a setup error when no client is available', () => {
    const { result } = renderHook(() => useFraymeCompose());
    expect(() => result.current.compose({ prompt: 'x' })).rejects.toThrow(/needs a client/);
  });
});

describe('useFraymeCompose: snapshots, generation id, and a stream that cannot start', () => {
  it('hands React a new object for every op, even though the stream reuses one', async () => {
    const s = fakeStream();
    const client = fakeClient([s]);
    const { result } = renderHook(() => useFraymeCompose(client));
    act(() => {
      void result.current.compose({ prompt: 'x' });
    });
    // The real stream passes its live accumulator, patched in place, on every op.
    const live = { root: 'a', elements: {} } as unknown as Record<string, unknown>;
    act(() => s.emit('op', { type: 'op' }, live));
    const first = result.current.spec;
    (live.elements as Record<string, unknown>).a = { type: 'Text', props: { text: 'hi' } };
    act(() => s.emit('op', { type: 'op' }, live));
    const second = result.current.spec;
    expect(first).not.toBe(live);
    expect(second).not.toBe(first);
    expect(second).toEqual(live);
    // A snapshot the host kept does not change under it.
    expect(first).toEqual({ root: 'a', elements: {} });
  });

  it('exposes the generation id from the first event, keeps it through a restart, clears it on a new compose', async () => {
    const s1 = fakeStream();
    const s2 = fakeStream();
    const client = fakeClient([s1, s2]);
    const { result } = renderHook(() => useFraymeCompose(client));
    let p1!: Promise<unknown>;
    act(() => {
      p1 = result.current.compose({ prompt: 'x' });
    });
    expect(result.current.generationId).toBeUndefined();
    act(() => s1.emit('started', { type: 'compose.started', generation_id: 'gen_1', model: 'frayme' }));
    expect(result.current.generationId).toBe('gen_1');
    act(() => s1.emit('restarted', { type: 'compose.restarted', generation_id: 'gen_1', model: 'fallback', reason: { code: 'x' } }));
    expect(result.current.generationId).toBe('gen_1');
    await act(async () => {
      s1.resolveFinal({ spec: snap('a'), generationId: 'gen_1', model: 'fallback', operationCount: 1, usage: { input_tokens: 1, output_tokens: 1 }, replayed: false });
      await p1;
    });
    expect(result.current.generationId).toBe('gen_1');

    act(() => {
      void result.current.compose({ prompt: 'y' });
    });
    expect(result.current.generationId).toBeUndefined();
  });

  it('a stream that throws on creation ends in status error, not stuck streaming', async () => {
    const client = {
      compose: {
        stream: () => {
          throw new TypeError('AbortSignal.any is not a function');
        },
      },
    } as unknown as Frayme;
    const { result } = renderHook(() => useFraymeCompose(client));
    let outcome: unknown = 'pending';
    await act(async () => {
      outcome = await result.current.compose({ prompt: 'x' });
    });
    expect(outcome).toBeUndefined();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toContain('AbortSignal.any is not a function');
  });

  it('a test double written without generationId still satisfies the return type', () => {
    // Type-level: this file is part of the package type-check, so a required
    // field added to the interface would fail it here.
    const double: UseFraymeComposeReturn = {
      compose: async () => undefined,
      spec: null,
      status: 'idle',
      restartKey: 0,
      model: undefined,
      error: undefined,
      abort: () => {},
    };
    expect(double.generationId).toBeUndefined();
  });

  it('the setup error text is the shared constant', () => {
    const { result } = renderHook(() => useFraymeCompose());
    return expect(result.current.compose({ prompt: 'x' })).rejects.toThrow(MISSING_CLIENT_MESSAGE);
  });
});
