import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Frayme } from '@frayme/api';
import type { Spec } from '@json-render/core';
import { useFraymeCompose } from '../src/react/useFraymeCompose.js';

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
