/**
 * Intrinsic event payloads — integration through the REAL FraymeRenderer
 * pipeline (emitWith → json-render emit → handlers Proxy → dispatch), using a
 * scratch Probe component so the mechanism is proven independent of the
 * registry migration.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { useIntrinsicEmit } from '../src/react/intrinsic.js';
import type { ComponentRenderProps } from '../src/react/upstream.js';

/** Fires `props.event` with `props.payload` (if set) through useIntrinsicEmit. */
function Probe({ element, emit }: ComponentRenderProps) {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = element.props as { label?: string; event?: string; payload?: Record<string, unknown> };
  return (
    <button type="button" onClick={() => emitWith(p.event ?? 'commit', p.payload)}>
      {p.label ?? 'Fire'}
    </button>
  );
}

const probeSpec = (
  elements: Record<string, unknown>,
  state: Record<string, unknown> = {},
): Spec =>
  ({ root: 'root', elements: { root: { type: 'Stack', props: {}, children: Object.keys(elements) }, ...elements }, state }) as unknown as Spec;

const components = { Probe };
/* The scratch Probe is not a carrier under the dynamic-action gate (core/dynamic-
   gate.ts) — an unknown type's declared action stays local by default, so
   every render here WIDENS the gate to the Probe. This file proves the payload
   plumbing, not the gate; the gate has its own file (dynamic-gate.test.tsx). */
const GATE = ['Button', 'DataTable', 'Probe'];

describe('intrinsic event payloads', () => {
  it('carries the emit-site payload into DynamicActionEvent.params and sets event', () => {
    const onDynamicAction = vi.fn();
    const spec = probeSpec({
      p1: {
        type: 'Probe',
        props: { label: 'Sort', event: 'sort', payload: { sortBy: 'price', sortDir: 'asc' } },
        on: { sort: { action: 'sort_rows', confirm: false } },
      },
    });
    render(
      <FraymeRenderer spec={spec} mode="progressive" components={components} dynamicActionTypes={GATE} onDynamicAction={onDynamicAction} />,
    );
    fireEvent.click(screen.getByText('Sort'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'sort_rows',
      event: 'sort',
      params: { sortBy: 'price', sortDir: 'asc' },
    });
  });

  it('authored params win per-key; intrinsic fills the rest', () => {
    const onDynamicAction = vi.fn();
    const spec = probeSpec({
      p1: {
        type: 'Probe',
        props: { label: 'Sort', event: 'sort', payload: { sortBy: 'intrinsic', sortDir: 'desc' } },
        on: { sort: { action: 'sort_rows', params: { sortBy: 'authored' }, confirm: false } },
      },
    });
    render(
      <FraymeRenderer spec={spec} mode="progressive" components={components} dynamicActionTypes={GATE} onDynamicAction={onDynamicAction} />,
    );
    fireEvent.click(screen.getByText('Sort'));
    expect(onDynamicAction.mock.calls[0]![0].params).toEqual({
      sortBy: 'authored',
      sortDir: 'desc',
    });
  });

  it('an authored $state key that resolves undefined does not clobber the intrinsic value', () => {
    const onDynamicAction = vi.fn();
    const spec = probeSpec({
      p1: {
        type: 'Probe',
        props: { label: 'Go', event: 'commit', payload: { value: 'kept' } },
        on: { commit: { action: 'go', params: { value: { $state: '/missing' }, extra: 'x' }, confirm: false } },
      },
    });
    render(
      <FraymeRenderer spec={spec} mode="progressive" components={components} dynamicActionTypes={GATE} onDynamicAction={onDynamicAction} />,
    );
    fireEvent.click(screen.getByText('Go'));
    const params = onDynamicAction.mock.calls[0]![0].params;
    expect(params.value).toBe('kept');
    expect(params.extra).toBe('x');
  });

  it('sets the TRUE fired verb even when the action is bound to >1 verb across elements', () => {
    const onDynamicAction = vi.fn();
    const spec = probeSpec({
      a: {
        type: 'Probe',
        props: { label: 'ViaCommit', event: 'commit', payload: { from: 'a' } },
        on: { commit: { action: 'multi', confirm: false } },
      },
      b: {
        type: 'Probe',
        props: { label: 'ViaChange', event: 'change', payload: { from: 'b' } },
        on: { change: { action: 'multi', confirm: false } },
      },
    });
    render(
      <FraymeRenderer spec={spec} mode="progressive" components={components} dynamicActionTypes={GATE} onDynamicAction={onDynamicAction} />,
    );
    fireEvent.click(screen.getByText('ViaCommit'));
    fireEvent.click(screen.getByText('ViaChange'));
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ event: 'commit', params: { from: 'a' } });
    expect(onDynamicAction.mock.calls[1]![0]).toMatchObject({ event: 'change', params: { from: 'b' } });
  });

  it('array bindings: BOTH actions receive the payload even when the first handler is async-slow', async () => {
    let releaseA1!: () => void;
    const gate = new Promise<void>((r) => {
      releaseA1 = r;
    });
    const a1 = vi.fn(async (_params: Record<string, unknown>) => {
      await gate;
    });
    const onDynamicAction = vi.fn();
    const spec = probeSpec({
      p1: {
        type: 'Probe',
        props: { label: 'Both', event: 'commit', payload: { value: 42 } },
        on: { commit: [{ action: 'a1', confirm: false }, { action: 'a2', confirm: false }] },
      },
    });
    render(
      <FraymeRenderer
        spec={spec}
        mode="progressive"
        components={components} dynamicActionTypes={GATE}
        actions={{ a1, a2: { kind: 'agent' } }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Both'));
    // a1 (local) runs synchronously up to its await, with the payload merged.
    expect(a1).toHaveBeenCalledTimes(1);
    expect(a1.mock.calls[0]![0]).toEqual({ value: 42 });
    // a2 runs only after a1's execute settles — arbitrarily later.
    expect(onDynamicAction).not.toHaveBeenCalled();
    releaseA1();
    await waitFor(() => expect(onDynamicAction).toHaveBeenCalledTimes(1));
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'a2', params: { value: 42 } });
  });

  it('host-kind dispatch sends the SAME enriched event as the agent sink (verb + params + state)', () => {
    const send = vi.fn();
    const s = probeSpec({
      p1: {
        type: 'Probe',
        props: { label: 'Host', event: 'move', payload: { card: 'X', toColumn: 'Done' } },
        on: { move: { action: 'host_move', confirm: false } },
      },
    });
    render(
      <FraymeRenderer
        spec={s}
        mode="progressive"
        components={components} dynamicActionTypes={GATE}
        actions={{ host_move: { kind: 'host' } }}
        hostTransport={{ send }}
      />,
    );
    fireEvent.click(screen.getByText('Host'));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toBe('frayme:action');
    expect(send.mock.calls[0]![1]).toMatchObject({
      action: 'host_move',
      event: 'move',
      params: { card: 'X', toColumn: 'Done' },
    });
    expect(send.mock.calls[0]![1].state).toBeDefined();
  });

  it('a payload never leaks into a later bare-emit dispatch of the same action', () => {
    const onDynamicAction = vi.fn();
    const spec = probeSpec({
      withPayload: {
        type: 'Probe',
        props: { label: 'With', event: 'commit', payload: { leak: 'no' } },
        on: { commit: { action: 'same', confirm: false } },
      },
      bare: {
        type: 'Probe',
        props: { label: 'Bare', event: 'commit' },
        on: { commit: { action: 'same', params: { src: 'bare' }, confirm: false } },
      },
    });
    render(
      <FraymeRenderer spec={spec} mode="progressive" components={components} dynamicActionTypes={GATE} onDynamicAction={onDynamicAction} />,
    );
    fireEvent.click(screen.getByText('With'));
    fireEvent.click(screen.getByText('Bare'));
    expect(onDynamicAction.mock.calls[0]![0].params).toEqual({ leak: 'no' });
    expect(onDynamicAction.mock.calls[1]![0].params).toEqual({ src: 'bare' });
  });

  it('display-only (interactive=false) fires consume their payload — no stale leak on re-enable', () => {
    const onDynamicAction = vi.fn();
    const spec = probeSpec({
      p1: {
        type: 'Probe',
        props: { label: 'Fire', event: 'commit', payload: { stale: 'yes' } },
        on: { commit: { action: 'act', confirm: false } },
      },
      bare: {
        type: 'Probe',
        props: { label: 'Bare', event: 'commit' },
        on: { commit: { action: 'act', confirm: false } },
      },
    });
    const { rerender } = render(
      <FraymeRenderer
        spec={spec}
        mode="progressive"
        components={components} dynamicActionTypes={GATE}
        interactive={false}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Fire')); // stashed + consumed by the inert closure
    expect(onDynamicAction).not.toHaveBeenCalled();
    rerender(
      <FraymeRenderer
        spec={spec}
        mode="progressive"
        components={components} dynamicActionTypes={GATE}
        interactive={true}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Bare')); // bare emit — must NOT see {stale:'yes'}
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0].params).toEqual({});
  });
});
