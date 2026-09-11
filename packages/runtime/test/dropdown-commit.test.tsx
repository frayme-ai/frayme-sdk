import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { DEFAULT_DYNAMIC_ACTION_TYPES } from '../src/core/dynamic-gate.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* These tests pin WHICH VERB a DropdownMenu fires, so they need to see the
   dispatch. Under the carrier gate (core/dynamic-gate.ts) a DropdownMenu
   is not a carrier — its declared action stays local by default — so the gate is
   WIDENED here explicitly, never weakened. The default-gate behaviour for a menu
   is pinned in dynamic-gate.test.tsx. */
const GATE = [...DEFAULT_DYNAMIC_ACTION_TYPES, 'DropdownMenu'];
const draw = (on: any) => {
  const onAction = vi.fn();
  const spec: any = { root: 'm', elements: { m: { type: 'DropdownMenu', props: { label: 'Actions', items: [{ label: 'Archive', value: 'arch' }] }, on } }, state: {}, actions: { doIt: { kind: 'agent' } } };
  const r = render(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onAction} dynamicActionTypes={GATE} />);
  fireEvent.click(r.container.querySelector('button')!);          // open
  const item = [...r.container.querySelectorAll('button')].find((b) => b.textContent?.includes('Archive'))!;
  fireEvent.click(item);
  return onAction.mock.calls.map((c) => c[0]?.event);
};
describe('DropdownMenu commit', () => {
  it('fires commit when bound', () => { expect(draw({ commit: { action: 'doIt', confirm: false } })).toContain('commit'); });
  it('accepts the press alias', () => { expect(draw({ press: { action: 'doIt', confirm: false } })).toContain('commit'); });
  it('still fires select when bound to select', () => { expect(draw({ select: { action: 'doIt', confirm: false } })).toContain('select'); });
  it('does NOT fire a spurious commit on a picker menu', () => {
    const evs = draw({ select: { action: 'doIt', confirm: false } });
    expect(evs.filter((e) => e === 'commit').length, 'no spurious commit').toBe(0);
  });
});
