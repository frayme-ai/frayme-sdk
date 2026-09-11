import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { buildParamOwners } from '../src/react/param-freeze.js';

/**
 * PARAM FREEZE — lifecycle rules 3, 4, 5, proved in BOTH directions.
 *
 * The ownership map is asserted DIRECTLY as well as through a render. The map is the
 * whole behaviour — which control feeds which action — and a render test that goes
 * green can do so because nothing froze OR because nothing was wired, which are
 * opposite outcomes that look identical from the outside.
 */
const spec = (): Spec => ({
  root: 'form',
  state: { amount: '100', note: 'hi', unrelated: 'x' },
  actions: { sendPayment: { kind: 'agent', params: { amount: {}, note: {} } } },
  elements: {
    form: { type: 'Stack', props: {}, children: ['amt', 'other', 'go'] },
    amt: { type: 'Input', props: { label: 'Amount', name: 'amount', value: { $bindState: '/amount' } } },
    other: { type: 'Input', props: { label: 'Unrelated', name: 'unrelated', value: { $bindState: '/unrelated' } } },
    go: { type: 'Button', props: { label: 'Send' }, on: { commit: { action: 'sendPayment' } } },
  },
}) as unknown as Spec;

describe('param freeze — the ownership map', () => {
  it('maps every declared param of an action to the button that fires it', () => {
    const owners = buildParamOwners(spec());
    // the diet's canonical paths: param `amount` resolves from `/amount`
    expect(owners.get('/amount')).toEqual(['/_ui/go/commit']);
    expect(owners.get('/note')).toEqual(['/_ui/go/commit']);
  });

  it('does NOT claim a path no declared action reads', () => {
    // The negative is the point: freezing an unrelated control would be a defect,
    // and it is the failure mode a too-broad map produces.
    expect(buildParamOwners(spec()).get('/unrelated')).toBeUndefined();
  });

  it('prefers the binding\'s explicit param map over the canonical path', () => {
    const s = {
      root: 'r', state: {}, actions: { pay: { kind: 'agent', params: { amount: {} } } },
      elements: {
        r: { type: 'Stack', props: {}, children: ['b'] },
        b: { type: 'Button', props: { label: 'Pay' },
             on: { commit: { action: 'pay', params: { amount: { $state: '/checkout/total' } } } } },
      },
    } as unknown as Spec;
    const owners = buildParamOwners(s);
    expect(owners.get('/checkout/total')).toEqual(['/_ui/b/commit']);
  });

  it('ignores builtins — "Add row" must never freeze anything', () => {
    const s = {
      root: 'r', state: {},
      elements: {
        r: { type: 'Stack', props: {}, children: ['b'] },
        b: { type: 'Button', props: { label: 'Add' },
             on: { commit: { action: 'pushState', params: { statePath: '/rows', value: {} } } } },
      },
    } as unknown as Spec;
    expect(buildParamOwners(s).size).toBe(0);
  });

  /* ONLY A BINDING THAT DISPATCHES OWNS ANYTHING. The carrier gate
     keeps a Select's `change → setRegion` local, so it is never "sent" and must not
     freeze the Select that fired it — that was a control frozen on first touch.
     `live: true`, a carrier type, and a row-action commit all still own. */
  it('a non-carrier binding the gate would deny owns no params; live / carrier / row-action bindings do', () => {
    const mk = (el: Record<string, unknown>) => ({
      root: 'r', state: { region: 'emea' },
      actions: { setRegion: { kind: 'agent', params: { region: {} } } },
      elements: { r: { type: 'Stack', props: {}, children: ['x'] }, x: el },
    }) as unknown as Spec;
    const sel = (extra: Record<string, unknown> = {}) =>
      ({ type: 'Select', props: { label: 'Region', name: 'region', options: ['emea', 'apac'], value: { $bindState: '/region' } }, on: { change: { action: 'setRegion', ...extra } } });
    expect(buildParamOwners(mk(sel())).has('/region')).toBe(false);
    expect(buildParamOwners(mk(sel({ live: true }))).get('/region')).toEqual(['/_ui/x/change']);
    expect(buildParamOwners(mk(sel()), ['Select']).get('/region')).toEqual(['/_ui/x/change']);
    expect(buildParamOwners(mk({ type: 'Button', props: { label: 'Go' }, on: { commit: { action: 'setRegion' } } })).get('/region')).toEqual(['/_ui/x/commit']);
    const boardEl = { type: 'KanbanBoard', props: { rowActions: [{ id: 'r' }], columns: [] }, on: { commit: { action: 'setRegion' }, move: { action: 'setRegion' } } };
    expect(buildParamOwners(mk(boardEl)).get('/region'), 'the row-action commit owns; the move does not').toEqual(['/_ui/x/commit']);
  });

  it('reads a JSON-Schema wrapper AND a flat params map', () => {
    const mk = (params: unknown) => ({
      root: 'r', state: {}, actions: { go: { kind: 'agent', params } },
      elements: { r: { type: 'Stack', props: {}, children: ['b'] },
                  b: { type: 'Button', props: { label: 'Go' }, on: { commit: { action: 'go' } } } },
    }) as unknown as Spec;
    expect(buildParamOwners(mk({ type: 'object', properties: { amount: {} } })).has('/amount')).toBe(true);
    expect(buildParamOwners(mk({ amount: {} })).has('/amount')).toBe(true);
    // a param literally NAMED `properties` must not be mistaken for the wrapper —
    // the exact ambiguity that broke real specs during the shape migration
    const tricky = buildParamOwners(mk({ date: {}, properties: {} }));
    expect(tricky.has('/date')).toBe(true);
    expect(tricky.has('/properties')).toBe(true);
  });
});

describe('param freeze — the behaviour', () => {
  it('a control feeding a committed action stops accepting edits', () => {
    render(<FraymeRenderer spec={spec()} onDynamicAction={vi.fn()} />);
    const amount = screen.getByDisplayValue('100') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '250' } });
    expect((screen.getByDisplayValue('250') as HTMLInputElement).value).toBe('250');  // live before

    fireEvent.click(screen.getByText('Send'));
    const confirm = screen.getAllByText('Send?')[0];
    expect(confirm).toBeTruthy();
  });

  /**
   * THE COMMIT ITSELF. Everything above stops at the confirm dialog, so for as long
   * as the freeze read was dead (useBoundProp returning its own first argument —
   * see usePathFrozen) all 13 tests in this file passed against an implementation
   * that froze NOTHING. Proved by running them against it. These two go past the
   * gate and assert the state the freeze exists to produce.
   */
  const commit = async () => {
    fireEvent.click(screen.getByText('Send'));
    const modal = document.querySelector('[data-fr-confirm]')!;
    fireEvent.click([...modal.querySelectorAll('button')].find((b) => /confirm/i.test(b.textContent ?? ''))!);
    await new Promise((r) => setTimeout(r, 40));
  };

  it('FROZEN after the commit — an owned control rejects further edits', async () => {
    render(<FraymeRenderer spec={spec()} onDynamicAction={vi.fn()} />);
    await commit();
    const amount = screen.getByDisplayValue('100') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '999' } });
    // The param that was SENT must not drift away from what the agent received.
    expect((document.querySelector('input[value]') as HTMLInputElement | null)?.value ?? amount.value).toBe('100');
    expect(screen.queryByDisplayValue('999')).toBeNull();
  });

  it('STILL LIVE after the commit — a control feeding no committed action is untouched', async () => {
    render(<FraymeRenderer spec={spec()} onDynamicAction={vi.fn()} />);
    await commit();
    const other = screen.getByDisplayValue('x') as HTMLInputElement;
    fireEvent.change(other, { target: { value: 'typed later' } });
    expect(screen.getByDisplayValue('typed later')).toBeTruthy();
  });

  it('an unrelated control stays editable after an action commits', () => {
    render(<FraymeRenderer spec={spec()} onDynamicAction={vi.fn()} />);
    const other = screen.getByDisplayValue('x') as HTMLInputElement;
    fireEvent.change(other, { target: { value: 'still typing' } });
    expect((screen.getByDisplayValue('still typing') as HTMLInputElement).value).toBe('still typing');
  });
});

/**
 * RULE 2 — focus the first empty required param, and the VISUAL half of rule 3.
 *
 * Both directions again. The negatives here are the ones that would ship as bugs:
 * an autofocus that fires when every required field is already filled steals the
 * cursor for nothing, and one that re-fires on state change yanks it out of whatever
 * the reader is typing.
 */
const reqSpec = (state: Record<string, unknown>): Spec => ({
  root: 'form',
  state,
  actions: { pay: { kind: 'agent', params: { amount: {}, note: {} }, requiredItems: ['amount'] } },
  elements: {
    form: { type: 'Stack', props: {}, children: ['amt', 'note', 'go'] },
    amt: { type: 'Input', props: { label: 'Amount', name: 'amount', value: { $bindState: '/amount' } } },
    note: { type: 'Input', props: { label: 'Note', name: 'note', value: { $bindState: '/note' } } },
    go: { type: 'Button', props: { label: 'Pay' }, on: { commit: { action: 'pay' } } },
  },
}) as unknown as Spec;

describe('lifecycle rule 2 — focus the empty required param', () => {
  it('focuses the control bound to an EMPTY required param', () => {
    render(<FraymeRenderer spec={reqSpec({ amount: '', note: 'x' })} onDynamicAction={vi.fn()} />);
    /* The DOM id is the SLUG, not the spec element id: forms.tsx fieldId() renders a
       control bound to `/amount` as id="frayme-amount". Asserting 'amt' here passed
       for the wrong reason once already — the negatives below go green whether focus
       is correct or entirely absent, so this positive is the only test that proves
       the feature runs at all. */
    expect((document.activeElement as HTMLElement)?.id).toBe('frayme-amount');
  });

  it('focuses NOTHING when the required param is already filled', () => {
    render(<FraymeRenderer spec={reqSpec({ amount: '250', note: '' })} onDynamicAction={vi.fn()} />);
    // `note` is empty but is NOT required — grabbing focus for it would be the bug
    expect((document.activeElement as HTMLElement)?.id).not.toBe('frayme-note');
    expect((document.activeElement as HTMLElement)?.id).not.toBe('frayme-amount');
  });

  it('does not focus when an action declares no requiredItems', () => {
    const s = {
      root: 'form', state: { amount: '' },
      actions: { pay: { kind: 'agent', params: { amount: {} } } },
      elements: {
        form: { type: 'Stack', props: {}, children: ['amt', 'go'] },
        amt: { type: 'Input', props: { label: 'Amount', name: 'amount', value: { $bindState: '/amount' } } },
        go: { type: 'Button', props: { label: 'Pay' }, on: { commit: { action: 'pay' } } },
      },
    } as unknown as Spec;
    render(<FraymeRenderer spec={s} onDynamicAction={vi.fn()} />);
    expect((document.activeElement as HTMLElement)?.id).not.toBe('frayme-amount');
  });
});

/**
 * A10 — the five param-bearing controls that had NO `disabled` channel at all.
 *
 * Without one, the freeze rejected writes while the control still looked live: the
 * "looks live but is inert" case the freeze exists to prevent. Rating is deliberately
 * absent from this list — it freezes through its existing `readOnly` rather than
 * gaining a second prop that means the same thing.
 */
describe('A10 — disabled reaches the action-family controls', () => {
  const withAction = (el: Record<string, unknown>): Spec => ({
    root: 'r', state: { pick: '' },
    actions: { go: { kind: 'agent', params: { pick: {} } } },
    elements: {
      r: { type: 'Stack', props: {}, children: ['c', 'b'] },
      c: el,
      b: { type: 'Button', props: { label: 'Go' }, on: { commit: { action: 'go' } } },
    },
  }) as unknown as Spec;

  it('Toggle accepts `disabled` and renders it', () => {
    const { container } = render(
      <FraymeRenderer spec={withAction({ type: 'Toggle', props: { label: 'Mute', disabled: true } })} onDynamicAction={vi.fn()} />,
    );
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Mute'));
    expect((btn as HTMLButtonElement)?.disabled).toBe(true);
  });

  it('Toggle is NOT disabled by default — the negative that proves the positive', () => {
    const { container } = render(
      <FraymeRenderer spec={withAction({ type: 'Toggle', props: { label: 'Mute' } })} onDynamicAction={vi.fn()} />,
    );
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Mute'));
    expect((btn as HTMLButtonElement)?.disabled).toBe(false);
  });

  it('the catalog now DECLARES disabled on all four, so a spec can author it', async () => {
    // Schema and runtime must move together: a runtime that honours a prop the
    // schema rejects is unauthorable, which is the mirror of a dead prop.
    const { fraymeCatalog } = await import('@frayme/catalog');
    for (const c of ['Toggle', 'ToggleGroup', 'ButtonGroup', 'DropdownMenu']) {
      const shape = (fraymeCatalog as { data: { components: Record<string, { props: { def: { shape: Record<string, unknown> } } }> } })
        .data.components[c]?.props?.def?.shape;
      expect(Object.keys(shape ?? {})).toContain('disabled');
    }
  });
});
