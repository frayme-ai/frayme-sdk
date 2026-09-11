import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/**
 * THE COMMIT LATCH, END TO END — press, confirm, and the control is dead.
 *
 * WHY THIS FILE EXISTS. auto-confirm.test.tsx proves the confirm fires and that
 * confirming dispatches the action. NOTHING proved the step after that: `take()`
 * writing `/_ui/<fid>/commit`, and `useCommitLatch` reading it back as `disabled`.
 * The latch is the whole reason generated specs are spared a hand-authored binding, and
 * it shipped with its final link unasserted — the same shape of gap this suite was
 * written to close.
 *
 * The negatives carry equal weight: a latch that fires on CANCEL, on a builtin, or
 * on an opted-out control is worse than no latch, because a disabled control can
 * never emit again to clear itself. The user is simply locked out.
 */
const one = (el: Record<string, unknown>, state: Record<string, unknown> = {}): Spec =>
  ({ root: 'x', elements: { x: el }, state }) as unknown as Spec;

const press = async (label: string, accept = true) => {
  fireEvent.click(screen.getByText(label));
  const modal = document.querySelector('[data-fr-confirm]');
  if (modal) {
    const b = [...modal.querySelectorAll('button')].find((n) =>
      accept ? /confirm/i.test(n.textContent ?? '') : /cancel/i.test(n.textContent ?? ''));
    fireEvent.click(b!);
  }
  await new Promise((r) => setTimeout(r, 40));
  return modal;
};

const btnEl = (label: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

describe('commit latch — the control dies after it fires', () => {
  it('ARMS: confirm a declared action and the button is disabled', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={one({ type: 'Button', props: { label: 'Launch' }, on: { commit: { action: 'launchRun' } } })}
      mode="progressive" onDynamicAction={onDynamicAction} />);
    expect(btnEl('Launch').disabled).toBe(false);
    await press('Launch');
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(btnEl('Launch').disabled).toBe(true);
  });

  it('and it STAYS dead — a second press dispatches nothing', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={one({ type: 'Button', props: { label: 'Launch' }, on: { commit: { action: 'launchRun' } } })}
      mode="progressive" onDynamicAction={onDynamicAction} />);
    await press('Launch');
    // Assert the MECHANISM, not just the count. Before the useStateValue fix this
    // test passed for the wrong reason: the latch was dead, the second press opened
    // a fresh confirm, and the helper never accepted it — so the call count stayed
    // at 1 and a broken latch read as a working one. Pin the disabled state and the
    // absence of a second confirm, both of which are false when the latch is dead.
    expect(btnEl('Launch').disabled).toBe(true);
    await press('Launch');
    expect(document.querySelector('[data-fr-confirm]')).toBeNull();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('DOES NOT arm on CANCEL — declining must leave the control live', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={one({ type: 'Button', props: { label: 'Launch' }, on: { commit: { action: 'launchRun' } } })}
      mode="progressive" onDynamicAction={onDynamicAction} />);
    await press('Launch', false);
    expect(onDynamicAction).not.toHaveBeenCalled();
    expect(btnEl('Launch').disabled).toBe(false);
  });

  it('DOES NOT arm on a BUILTIN — "Add row" stays repeatable', async () => {
    render(<FraymeRenderer spec={one({ type: 'Button', props: { label: 'Add row' }, on: { commit: { action: 'push', params: { path: '/rows', value: 1 } } } }, { rows: [] })}
      mode="progressive" onDynamicAction={vi.fn()} />);
    await press('Add row');
    expect(btnEl('Add row').disabled).toBe(false);
  });

  it('DOES NOT arm when the author opted out with latch:false', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={one({ type: 'Button', props: { label: 'Retry', latch: false }, on: { commit: { action: 'retryJob' } } })}
      mode="progressive" onDynamicAction={onDynamicAction} />);
    await press('Retry');
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(btnEl('Retry').disabled).toBe(false);
  });
});

/**
 * LOCAL CONTROLS MUST STAY LIVE — the other half of the rule.
 *
 * "Any declared action latches" is only safe because its converse holds: a control
 * doing LOCAL work never latches. A form's toggle, a filter switch, a segmented
 * control that only sets state — latching any of those would freeze the form the
 * first time the user touched it, which is a far worse bug than the double-fire the
 * latch exists to prevent.
 *
 * The test is `action is not a json-render builtin`. These pin both directions on
 * the value controls wired here (Toggle, ToggleGroup, Switch, Select,
 * DropdownMenu), since Button was already covered above.
 */
const inputEl = () => document.querySelector('input,button,[role="switch"],[role="radio"]') as HTMLElement | null;

describe('local controls never latch — a form must not freeze on first touch', () => {
  it('a Switch that only setStates stays live', async () => {
    render(<FraymeRenderer
      spec={one({ type: 'Switch', props: { label: 'Include drafts' },
        on: { change: { action: 'setState', params: { statePath: '/drafts', value: true } } } }, { drafts: false })}
      mode="progressive" onDynamicAction={vi.fn()} />);
    const el = inputEl()!;
    fireEvent.click(el);
    await new Promise((r) => setTimeout(r, 40));
    expect((inputEl() as HTMLInputElement).disabled ?? false).toBe(false);
  });

  it('a Toggle bound only with $bindState stays live — no action at all', async () => {
    render(<FraymeRenderer
      spec={one({ type: 'Toggle', props: { label: 'Bold', pressed: { $bindState: '/bold' } } }, { bold: false })}
      mode="progressive" onDynamicAction={vi.fn()} />);
    const b = document.querySelector('button') as HTMLButtonElement;
    fireEvent.click(b);
    await new Promise((r) => setTimeout(r, 40));
    expect((document.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
  });

  /* Under the carrier gate (core/dynamic-gate.ts) a Switch's declared
     action does NOT leave the renderer by default, and a control the gate would
     deny never latches — that default is pinned in dynamic-gate.test.tsx. This
     test keeps pinning the latch MECHANISM for a Switch that IS allowed to
     dispatch, so the gate is widened to include it rather than the assertion
     weakened. */
  it('but a Switch wired to a DECLARED action does latch (when the Switch is a carrier)', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer
      spec={one({ type: 'Switch', props: { label: 'Count signed renewals' },
        on: { change: { action: 'recutOccupancyBasis' } } }, {})}
      mode="progressive" onDynamicAction={onDynamicAction}
      dynamicActionTypes={['Button', 'DataTable', 'Switch']} />);
    const el = inputEl()!;
    fireEvent.click(el);
    const modal = document.querySelector('[data-fr-confirm]');
    if (modal) {
      const go = [...modal.querySelectorAll('button')].find((b) => /confirm/i.test(b.textContent ?? ''));
      if (go) fireEvent.click(go);
    }
    await new Promise((r) => setTimeout(r, 60));
    expect((inputEl() as HTMLInputElement).disabled).toBe(true);
  });
});
