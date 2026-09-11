/**
 * THE CARRIER GATE — which controls reach the agent (core/dynamic-gate.ts).
 *
 * The rule: only a Button, or a DataTable's row /
 * bulk action button, may dispatch a declared action OUT of the renderer. Every
 * other component's declared action stays LOCAL — it writes `/_ui/<fid>/<verb>`
 * and nothing else — so the next Button press carries what the user did inside
 * `event.state`. `live: true` on the binding is the declared opt-out;
 * `dynamicActionTypes` widens the carrier list per renderer.
 *
 * "A Button" is read as the PRESS (the module header says why): the default list
 * is the press-shaped set + Form + DataTable, and a row / bulk action button is a
 * carrier on any host that draws one. Sections (j)–(t) pin the edge cases:
 * the Form submit path, the press-class hosts, the item-action affordance,
 * the per-verb latch, the param freeze, chains, `watch`, the swept confirm, the
 * host / recompose kinds, the in-flight guard, and the automatic confirm.
 *
 * WHY EVERY CASE HAS A NEGATIVE. Many declared bindings in generated specs sit on
 * non-carrier hosts, so this gate changes real behaviour. A gate
 * that is easier to dodge than to satisfy is the gate's bug, so
 * each rule is pinned from both sides: the carrier goes, the non-carrier stays,
 * the mirror is written either way, the latch never freezes a local control, and
 * the deny path is SILENT — no throw, no console.error, no new validation issue.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import {
  DEFAULT_DYNAMIC_ACTION_TYPES,
  bindingDispatches,
  declaresItemActions,
  decideDynamicDispatch,
  hasAnyLiveBinding,
  hasLiveBinding,
  verbDispatches,
} from '../src/core/dynamic-gate.js';
import { JSON_RENDER_BUILTIN_ACTIONS } from '../src/core/intrinsic.js';
import { dispatch } from '../src/core/dispatch.js';
import type { FraymeActionContext } from '../src/core/handlers.js';
import type { ComponentRenderProps } from '../src/react/upstream.js';

const settle = () => new Promise((r) => setTimeout(r, 40));

/** A Stack of the given elements; every action is declared `agent` unless overridden. */
const page = (
  elements: Record<string, unknown>,
  actions: Record<string, unknown> = {},
  state: Record<string, unknown> = {},
): Spec =>
  ({
    root: 'page',
    elements: { page: { type: 'Stack', props: {}, children: Object.keys(elements) }, ...elements },
    state,
    actions,
  }) as unknown as Spec;

/** Like `page`, but only `rootChildren` hang off the Stack (the rest are nested). */
const tree = (
  elements: Record<string, unknown>,
  rootChildren: string[],
  actions: Record<string, unknown> = {},
  state: Record<string, unknown> = {},
): Spec =>
  ({
    root: 'page',
    elements: { page: { type: 'Stack', props: {}, children: rootChildren }, ...elements },
    state,
    actions,
  }) as unknown as Spec;

/* Every binding here says `confirm: false` unless a test is ABOUT the modal: the
   universal confirm (FraymeRenderer.normalizeSpecProps) would otherwise put a
   modal between the gesture and the handler, and most of these tests are about
   the handler. auto-confirm.test.tsx owns the modal; section (t) pins where the
   gate now keeps it out. */
const bind = (action: string, extra: Record<string, unknown> = {}) => ({ action, confirm: false, ...extra });

const button = (label: string, action: string, extra: Record<string, unknown> = {}) => ({
  type: 'Button',
  props: { label },
  on: { commit: bind(action, extra) },
});

const selectEl = (action: string | null, extra: Record<string, unknown> = {}) => ({
  type: 'Select',
  props: { label: 'Region', name: 'region', options: ['emea', 'apac'] },
  ...(action ? { on: { change: bind(action, extra) } } : {}),
});

const switchEl = (action: string, extra: Record<string, unknown> = {}) => ({
  type: 'Switch',
  props: { label: 'Include drafts', name: 'drafts' },
  on: { change: bind(action, extra) },
});

const board = (action: string, extra: Record<string, unknown> = {}) => ({
  type: 'KanbanBoard',
  props: {
    columns: [
      { title: 'To Do', cards: [{ title: 'Ship it', moveable: true }] },
      { title: 'Done', cards: [] },
    ],
  },
  on: { move: bind(action, extra) },
});

const table = () => ({
  type: 'DataTable',
  props: {
    columns: [{ key: 'name', label: 'Name' }],
    rows: [{ name: 'Ada' }, { name: 'Grace' }],
    selectable: true,
    rowActions: [{ id: 'approve', label: 'Approve', confirm: false }],
    bulkActions: [{ id: 'archive', label: 'Archive', confirm: false }],
  },
  on: { commit: bind('tableAct') },
});

const btnEl = (label: string) =>
  [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label && !b.closest('[data-fr-confirm]'),
  ) as HTMLButtonElement;
const switchNode = () => document.querySelector('[role="switch"]') as HTMLButtonElement;
const selectNode = () => document.querySelector('select') as HTMLSelectElement;
const modal = () => document.querySelector('[data-fr-confirm]');
const modalBtn = (re: RegExp) =>
  [...(modal()?.querySelectorAll('button') ?? [])].find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement;
const uiOf = (ev: { state?: unknown }) => (ev.state as { _ui: Record<string, Record<string, unknown>> })._ui;

afterEach(() => vi.restoreAllMocks());

/* ── (a) the carrier goes, and names itself ─────────────────────────────── */

describe('(a) a Button dispatches out of the renderer and carries element_id', () => {
  it('Button commit → onDynamicAction, event.element_id === the button id', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ approve: button('Approve', 'approveRefund') }, { approveRefund: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'approveRefund',
      event: 'commit',
      element_id: 'approve',
      params: { label: 'Approve' },
    });
  });

  /* The list is the press-shaped set + Form + DataTable (core/dynamic-gate.ts
     says why each is there). Pinned exactly so a change to it is deliberate. */
  it('the default carrier list is the press-shaped set + Form + DataTable', () => {
    expect([...DEFAULT_DYNAMIC_ACTION_TYPES]).toEqual(['Button', 'IconButton', 'Fab', 'Confirmation', 'Form', 'DataTable']);
  });
});

/* ── (b) a non-carrier stays local: mirror written, latch disarmed ──────── */

describe('(b) a Select with a declared change stays LOCAL — mirror written, control live', () => {
  it('onDynamicAction is NOT called, /_ui/<selectId>/change IS written, and the next Button press carries it', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { region: selectEl('setRegion'), send: button('Send', 'submitReport') },
          { setRegion: { kind: 'agent' }, submitReport: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    await settle();
    expect(onDynamicAction, 'the Select change must not leave the renderer').not.toHaveBeenCalled();
    // The control is untouched by the latch...
    expect(selectNode().disabled).toBe(false);
    // ...and the record of what the user did travels with the next Button press.
    fireEvent.click(screen.getByText('Send'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(ev).toMatchObject({ action: 'submitReport', element_id: 'send' });
    expect(uiOf(ev).region.change).toMatchObject({ value: 'apac', name: 'region' });
  });

  /* Select never called useCommitLatch, so the disabled check above is trivially
     true for it. Switch DOES latch (forms.tsx), so it is the real proof that G3
     holds: a control the gate would deny must stay live AND stay repeatable. */
  it('a Switch with a declared change stays live and can be flipped AGAIN (the latch does not arm)', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { drafts: switchEl('recutBasis'), send: button('Send', 'submitReport') },
          { recutBasis: { kind: 'agent' }, submitReport: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(switchNode());
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    expect(switchNode().disabled, 'a denied control must not latch').toBe(false);
    // Flip it back: the second gesture is also recorded — the mirror is latest-wins.
    fireEvent.click(switchNode());
    await settle();
    expect(switchNode().disabled).toBe(false);
    fireEvent.click(screen.getByText('Send'));
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(uiOf(ev).drafts.change).toMatchObject({ checked: false });
  });

  /* PRE-EXISTING LATCH BEHAVIOUR, UNCHANGED BY THE GATE. A live:true binding is
     the gate's opt-out, so the Proxy dispatches it and the latch keeps doing what
     it did before the gate — arms after the first fire. Pinned so that, if it is
     ever decided a live control should never latch, the change is deliberate
     rather than a side effect. */
  it('a Switch whose declared change is live:true dispatches and keeps the latch it always had', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ drafts: switchEl('recutBasis', { live: true }) }, { recutBasis: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(switchNode());
    await settle();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'recutBasis', event: 'change', element_id: 'drafts' });
    expect(switchNode().disabled).toBe(true);
  });

  /* THE LATCH IS PER VERB. The first cut armed on ANY live
     binding on the element while the Proxy decided per action, so a mixed
     control — `change` not live, `commit` live — latched after the DENIED flick:
     disabled by a dispatch that never left the renderer. */
  it('a Switch declaring a non-live change AND a live commit does NOT latch after the denied flick', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          {
            drafts: {
              type: 'Switch',
              props: { label: 'Include drafts', name: 'drafts' },
              on: { change: bind('recutBasis'), commit: bind('applyBasis', { live: true }) },
            },
            send: button('Send', 'submitReport'),
          },
          { recutBasis: { kind: 'agent' }, applyBasis: { kind: 'agent' }, submitReport: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(switchNode());
    await settle();
    expect(onDynamicAction, 'the non-live change is denied').not.toHaveBeenCalled();
    expect(switchNode().disabled, 'a denied verb\'s mirror is not a latch record').toBe(false);
    fireEvent.click(switchNode());
    await settle();
    expect(switchNode().disabled).toBe(false);
    fireEvent.click(screen.getByText('Send'));
    expect(uiOf(onDynamicAction.mock.calls[0]![0]).drafts.change).toMatchObject({ checked: false });
  });
});

/* ── (c) DataTable row + bulk actions are carriers ──────────────────────── */

describe('(c) a DataTable row action and bulk action are forwarded', () => {
  it('a row action button dispatches with the row payload and element_id', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer spec={page({ tbl: table() }, { tableAct: { kind: 'agent' } })} mode="progressive" onDynamicAction={onDynamicAction} />,
    );
    const approves = [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Approve');
    expect(approves).toHaveLength(2);
    fireEvent.click(approves[1]!);
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'tableAct',
      event: 'commit',
      element_id: 'tbl',
      params: { action: 'approve', index: 1, row: { name: 'Grace' } },
    });
  });

  it('a bulk action button dispatches with the selected rows', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer spec={page({ tbl: table() }, { tableAct: { kind: 'agent' } })} mode="progressive" onDynamicAction={onDynamicAction} />,
    );
    fireEvent.click(screen.getByLabelText('Select row 1'));
    fireEvent.click(btnEl('Archive'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'tableAct',
      element_id: 'tbl',
      params: { action: 'archive', selectedRows: [{ name: 'Ada' }] },
    });
  });

  /* The DataTable exception is TYPE-level — every declared verb on it dispatches,
     not only the row / bulk press. The docs say so; this pins it. */
  it('a DataTable `sort` dispatches under the defaults too (the exception is the type, not the verb)', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          {
            tbl: {
              type: 'DataTable',
              props: { columns: [{ key: 'seats', label: 'Seats', sortable: true }], rows: [{ seats: 1 }, { seats: 2 }] },
              on: { sort: bind('reSort') },
            },
          },
          { reSort: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Seats'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'reSort', event: 'sort', element_id: 'tbl', params: { sortBy: 'seats' } });
  });
});

/* ── (d) live:true is the opt-out; without it the move stays local ──────── */

describe('(d) a KanbanBoard move: live:true forwards, otherwise mirror only', () => {
  it('WITH live:true on the binding the move reaches the agent', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer spec={page({ board: board('cardMove', { live: true }) }, { cardMove: { kind: 'agent' } })} mode="progressive" onDynamicAction={onDynamicAction} />,
    );
    fireEvent.click(screen.getByLabelText('Move right'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'cardMove',
      event: 'move',
      element_id: 'board',
      params: { card: 'Ship it', fromColumn: 'To Do', toColumn: 'Done' },
    });
  });

  it('WITHOUT live the move stays local — not forwarded, but /_ui/board/move is written', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ board: board('cardMove'), save: button('Save board', 'saveBoard') }, { cardMove: { kind: 'agent' }, saveBoard: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByLabelText('Move right'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Save board'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(ev.action).toBe('saveBoard');
    expect(uiOf(ev).board.move).toMatchObject({ card: 'Ship it', fromColumn: 'To Do', toColumn: 'Done' });
  });

  it('live:true is found under a LEGACY alias key too (on.press, array form)', () => {
    // The gate reads the raw current spec, whose `on` keys are not canonicalised —
    // a live opt-out written as `press` must count exactly as `commit` would.
    const el = { type: 'FeatureCard', on: { press: [{ action: 'other' }, { action: 'learnMore', live: true }] } };
    expect(hasLiveBinding(el, 'learnMore')).toBe(true);
    expect(hasLiveBinding(el, 'other')).toBe(false);
  });
});

/* ── (e) no element identity → fail-closed ──────────────────────────────── */

/** A component that fires json-render's BARE emit — no useIntrinsicEmit, so no
 *  fid ever reaches the Proxy. Registered under a type the gate is told to allow,
 *  to prove it is the MISSING IDENTITY that denies, not the type. */
function BareProbe({ emit }: ComponentRenderProps) {
  return (
    <button type="button" onClick={() => emit('commit')}>
      Bare
    </button>
  );
}

describe('(e) an action fired with no intrinsic fid is denied (fail-closed)', () => {
  it('a bare emit from a renderer that never identifies itself does not reach the agent', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ p: { type: 'BareProbe', props: {}, on: { commit: bind('go') } } }, { go: { kind: 'agent' } })}
        mode="progressive"
        components={{ BareProbe }}
        onDynamicAction={onDynamicAction}
        dynamicActionTypes={[...DEFAULT_DYNAMIC_ACTION_TYPES, 'BareProbe']}
      />,
    );
    fireEvent.click(screen.getByText('Bare'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('a programmatic dispatch (no renderer, no fid) carries no element_id', () => {
    const emitDynamic = vi.fn();
    const ctx: FraymeActionContext = {
      action: 'go',
      setState: () => undefined,
      getState: () => ({}),
      getSpec: () => ({ elements: {} }),
      emitDynamic,
      signal: new AbortController().signal,
    };
    dispatch({ kind: 'agent' }, { a: 1 }, ctx, {});
    expect(emitDynamic).toHaveBeenCalledTimes(1);
    expect(emitDynamic.mock.calls[0]![0].element_id).toBeUndefined();
  });

  /* A CANCELLED CONFIRM CAN NEVER VOUCH FOR A LATER DISPATCH.
     Declining leaves the Button's intrinsic entry un-taken; before this guard, the
     next fire of the same action name from an UNIDENTIFIED source inherited that
     fid, passed the gate as the Button, and wrote the Button's mirror — so a
     confirm the user refused dispatched anyway and latched the Button. */
  it('after a DECLINED confirm, a bare emit of the same action stays denied and the Button stays live', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          {
            // no `confirm` key: the universal confirm guards this Button
            go: { type: 'Button', props: { label: 'Go' }, on: { commit: { action: 'go' } } },
            p: { type: 'BareProbe', props: {}, on: { commit: bind('go') } },
          },
          { go: { kind: 'agent' } },
        )}
        mode="progressive"
        components={{ BareProbe }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btnEl('Go'));
    expect(modal()).not.toBeNull();
    fireEvent.click(modalBtn(/cancel/i));
    await settle();
    fireEvent.click(screen.getByText('Bare'));
    await settle();
    expect(onDynamicAction, 'the declined entry must not identify the bare emit').not.toHaveBeenCalled();
    expect(btnEl('Go').disabled, 'and the declined Button must not latch').toBe(false);
  });
});

/* ── (f) dynamicActionTypes widens the gate ─────────────────────────────── */

describe('(f) dynamicActionTypes widens the carrier list', () => {
  it("[...defaults, 'KanbanBoard'] lets a plain (non-live) board move through", () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ board: board('cardMove') }, { cardMove: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        dynamicActionTypes={[...DEFAULT_DYNAMIC_ACTION_TYPES, 'KanbanBoard']}
      />,
    );
    fireEvent.click(screen.getByLabelText('Move right'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'cardMove', element_id: 'board' });
  });

  it('the prop REPLACES the default — a list without Button silences a Button', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ approve: button('Approve', 'approveRefund') }, { approveRefund: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        dynamicActionTypes={['DataTable']}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  /* A Select, not a Switch, on purpose: the first (denied) change writes the
     element's mirror, and a control that LATCHES would read that mirror as "already
     fired" the moment its type became a carrier — so a Switch here would be
     disabled by the time the second change arrives. Select never latches, which
     isolates the thing under test: the Proxy consults the live ref, not the list it
     was created with. */
  it('the Proxy reads the LIVE prop — widening on a rerender takes effect without a remount', async () => {
    const onDynamicAction = vi.fn();
    const spec = page({ region: selectEl('setRegion') }, { setRegion: { kind: 'agent' } });
    const { rerender } = render(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    rerender(
      <FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={[...DEFAULT_DYNAMIC_ACTION_TYPES, 'Select']} />,
    );
    fireEvent.change(selectNode(), { target: { value: 'emea' } });
    await settle();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'setRegion', element_id: 'region', params: { value: 'emea' } });
  });
});

/* ── (g) the deny path is silent ────────────────────────────────────────── */

describe('(g) a denied dispatch never throws and never logs console.error', () => {
  it('Select change on a declared action: no throw, no console.error, no InvalidSpec', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onDynamicAction = vi.fn();
    const { container } = render(
      <FraymeRenderer spec={page({ region: selectEl('setRegion') }, { setRegion: { kind: 'agent' } })} mode="progressive" onDynamicAction={onDynamicAction} />,
    );
    expect(() => fireEvent.change(selectNode(), { target: { value: 'apac' } })).not.toThrow();
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    // React's own "not wrapped in act(...)" notice can land on console.error in
    // jsdom for ANY async state update and has nothing to do with the deny path;
    // everything else on console.error would be ours, and there must be none.
    const ours = err.mock.calls.filter((c) => !String(c[0]).includes('act('));
    expect(ours).toEqual([]);
    expect(container.querySelector('.frayme-invalid')).toBeNull();
  });

  it('strict mode: a spec full of non-carrier declared actions still passes the catalog gate (the gate adds no validation path)', () => {
    const spec = page(
      { region: selectEl('setRegion'), drafts: switchEl('recutBasis'), send: button('Send', 'submitReport') },
      { setRegion: { kind: 'agent' }, recutBasis: { kind: 'agent' }, submitReport: { kind: 'agent' } },
    );
    const { container } = render(<FraymeRenderer spec={spec} mode="strict" onDynamicAction={vi.fn()} />);
    expect(container.querySelector('.frayme-invalid')).toBeNull();
    expect(selectNode()).not.toBeNull();
  });
});

/* ── (h) local kinds are never gated; host + recompose ARE ───────────────── */

describe('(h) kind:local handlers on a non-carrier host still run', () => {
  it('a bare function handler runs for a Select change', () => {
    const run = vi.fn();
    render(
      <FraymeRenderer spec={page({ region: selectEl('setRegion') })} mode="progressive" actions={{ setRegion: run }} />,
    );
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]![0]).toMatchObject({ value: 'apac', name: 'region' });
  });

  it('a { kind: "local", run } handler runs for a Switch change, and the mirror is still written', async () => {
    const run = vi.fn();
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ drafts: switchEl('recutBasis'), send: button('Send', 'submitReport') })}
        mode="progressive"
        actions={{ recutBasis: { kind: 'local', run }, submitReport: { kind: 'agent' } }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(switchNode());
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Send'));
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(uiOf(ev).drafts.change).toMatchObject({ checked: true });
  });

  it('an explicit `false` stays inert whoever fires it (no gate involvement)', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ approve: button('Approve', 'approveRefund') })}
        mode="progressive"
        actions={{ approveRefund: false }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  /* The kinds that LEAVE the renderer are all gated, not only `agent`. */
  it('kind:host — a Select is denied (hostTransport.send never called); a Button goes through', async () => {
    const send = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ region: selectEl('sendRegion'), go: button('Go', 'sendRegion') })}
        mode="progressive"
        actions={{ sendRegion: { kind: 'host' } }}
        hostTransport={{ send }}
      />,
    );
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    await settle();
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Go'));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toBe('frayme:action');
    expect(send.mock.calls[0]![1]).toMatchObject({ action: 'sendRegion', element_id: 'go' });
  });

  it('kind:recompose — a Select is denied (compose.create never called); a Button recomposes', async () => {
    const create = vi.fn().mockResolvedValue({ spec: page({}) });
    const onRecompose = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ region: selectEl('recut'), go: button('Go', 'recut') })}
        mode="progressive"
        actions={{ recut: { kind: 'recompose', prompt: 'again' } }}
        compose={{ create }}
        onRecompose={onRecompose}
      />,
    );
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    await settle();
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Go'));
    await settle();
    expect(create).toHaveBeenCalledTimes(1);
    expect(onRecompose).toHaveBeenCalledTimes(1);
  });

  /* THE DENY RETURNS BEFORE THE RE-ENTRANCY GUARD. An inert flick of the same
     action name must not abort a carrier's dispatch that is still in flight —
     otherwise a Select bound beside a Button to the same action could cancel the
     Button's recompose by being touched. The control case proves the guard is
     still armed: a second CARRIER press does abort the first. */
  it('a denied flick of the same action does not abort the carrier\'s in-flight recompose', async () => {
    let resolve!: (v: { spec: unknown }) => void;
    const create = vi.fn(() => new Promise<{ spec: unknown }>((r) => { resolve = r; }));
    const onRecompose = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ go: button('Go', 'recut'), drafts: switchEl('recut') })}
        mode="progressive"
        actions={{ recut: { kind: 'recompose', prompt: 'again' } }}
        compose={{ create }}
        onRecompose={onRecompose}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(create).toHaveBeenCalledTimes(1);
    fireEvent.click(switchNode()); // denied — must not touch the in-flight controller
    await settle();
    expect(create).toHaveBeenCalledTimes(1);
    resolve({ spec: page({}) });
    await settle();
    expect(onRecompose, 'the carrier\'s recompose still lands').toHaveBeenCalledTimes(1);
  });

  it('CONTROL: a second carrier press of the same action DOES abort the first', async () => {
    const pending: Array<(v: { spec: unknown }) => void> = [];
    const create = vi.fn(() => new Promise<{ spec: unknown }>((r) => { pending.push(r); }));
    const onRecompose = vi.fn();
    render(
      <FraymeRenderer
        // latch:false so the Button can be pressed twice (a latched Button cannot)
        spec={page({ go: { type: 'Button', props: { label: 'Go', latch: false }, on: { commit: bind('recut') } } })}
        mode="progressive"
        actions={{ recut: { kind: 'recompose', prompt: 'again' } }}
        compose={{ create }}
        onRecompose={onRecompose}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    fireEvent.click(screen.getByText('Go'));
    expect(create).toHaveBeenCalledTimes(2);
    pending[0]!({ spec: page({}) });
    pending[1]!({ spec: page({}) });
    await settle();
    expect(onRecompose, 'only the newer dispatch lands').toHaveBeenCalledTimes(1);
  });
});

/* ── (i) the pure decision helper, every reason ─────────────────────────── */

describe('(i) decideDynamicDispatch — every reason', () => {
  const spec = {
    elements: {
      btn: { type: 'Button', on: { commit: { action: 'go' } } },
      tbl: { type: 'DataTable', on: { commit: { action: 'go' } } },
      sel: { type: 'Select', on: { change: { action: 'go' } } },
      liveSel: { type: 'Select', on: { change: { action: 'go', live: true } } },
      aliasLive: { type: 'FeatureCard', on: { press: { action: 'go', live: true } } },
      arrLive: { type: 'Slider', on: { change: [{ action: 'setState' }, { action: 'go', live: true }] } },
      otherLive: { type: 'Select', on: { change: { action: 'somethingElse', live: true } } },
      card: { type: 'KanbanCard', props: { rowActions: [{ id: 'reassign' }] }, on: { commit: { action: 'go' } } },
      untyped: { on: { commit: { action: 'go' } } },
      numType: { type: 42 },
    },
  };
  const allowed = DEFAULT_DYNAMIC_ACTION_TYPES;
  const decide = (fid: string | null | undefined, s: unknown = spec, types: readonly string[] = allowed) =>
    decideDynamicDispatch({ spec: s, fid, action: 'go', allowedTypes: types });

  it('carrier — Button and DataTable', () => {
    expect(decide('btn')).toEqual({ allowed: true, reason: 'carrier' });
    expect(decide('tbl')).toEqual({ allowed: true, reason: 'carrier' });
  });

  it('live — the binding for THIS action says live:true (canonical key, legacy alias, array form)', () => {
    expect(decide('liveSel')).toEqual({ allowed: true, reason: 'live' });
    expect(decide('aliasLive')).toEqual({ allowed: true, reason: 'live' });
    expect(decide('arrLive')).toEqual({ allowed: true, reason: 'live' });
  });

  it('item-action — a row / bulk action press carries on a non-carrier host; the same host\'s other fires do not', () => {
    const on = (affordance: 'row-action' | 'bulk-action' | undefined) =>
      decideDynamicDispatch({ spec, fid: 'card', action: 'go', allowedTypes: allowed, affordance });
    expect(on('row-action')).toEqual({ allowed: true, reason: 'item-action' });
    expect(on('bulk-action')).toEqual({ allowed: true, reason: 'item-action' });
    expect(on(undefined)).toEqual({ allowed: false, reason: 'denied:not-carrier' });
    // the affordance never rescues an unidentified fire
    expect(decideDynamicDispatch({ spec, fid: undefined, action: 'go', allowedTypes: allowed, affordance: 'row-action' }))
      .toEqual({ allowed: false, reason: 'denied:unknown-element' });
    // and it outranks a narrowed list, like live does — it is about the fire, not the host
    expect(decideDynamicDispatch({ spec, fid: 'card', action: 'go', allowedTypes: [], affordance: 'row-action' }))
      .toEqual({ allowed: true, reason: 'item-action' });
  });

  it('denied:not-carrier — a known non-carrier without a live binding for this action', () => {
    expect(decide('sel')).toEqual({ allowed: false, reason: 'denied:not-carrier' });
    // live on a DIFFERENT action does not open the gate for this one
    expect(decide('otherLive')).toEqual({ allowed: false, reason: 'denied:not-carrier' });
  });

  it('denied:unknown-element — no fid, unknown fid, untyped element, no elements, no spec', () => {
    expect(decide(undefined)).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide(null)).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide('')).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide('nope')).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide('untyped')).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide('numType')).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide('btn', {})).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide('btn', null)).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide('btn', { elements: 'nope' })).toEqual({ allowed: false, reason: 'denied:unknown-element' });
  });

  it('never resolves a prototype member as an element (own-property only)', () => {
    expect(decide('constructor')).toEqual({ allowed: false, reason: 'denied:unknown-element' });
    expect(decide('__proto__')).toEqual({ allowed: false, reason: 'denied:unknown-element' });
  });

  it('allowedTypes is authoritative — widening admits, narrowing excludes', () => {
    expect(decide('sel', spec, [...allowed, 'Select'])).toEqual({ allowed: true, reason: 'carrier' });
    expect(decide('btn', spec, ['DataTable'])).toEqual({ allowed: false, reason: 'denied:not-carrier' });
    expect(decide('btn', spec, [])).toEqual({ allowed: false, reason: 'denied:not-carrier' });
  });

  it('hasLiveBinding / hasAnyLiveBinding — shape tolerance', () => {
    expect(hasLiveBinding(null, 'go')).toBe(false);
    expect(hasLiveBinding({ on: null }, 'go')).toBe(false);
    expect(hasLiveBinding({ on: { commit: null } }, 'go')).toBe(false);
    expect(hasLiveBinding({ on: { commit: { action: 'go', live: 'yes' } } }, 'go')).toBe(false); // strictly true
    expect(hasLiveBinding({ on: { commit: { action: 'go', live: true } } }, 'go')).toBe(true);
    // the element-wide view: any non-builtin live binding counts; a builtin never does
    expect(hasAnyLiveBinding({ on: { change: { action: 'setState', live: true } } }, JSON_RENDER_BUILTIN_ACTIONS)).toBe(false);
    expect(hasAnyLiveBinding({ on: { change: [{ action: 'setState' }, { action: 'go', live: true }] } }, JSON_RENDER_BUILTIN_ACTIONS)).toBe(true);
    expect(hasAnyLiveBinding({ on: { change: { action: 'go' } } }, JSON_RENDER_BUILTIN_ACTIONS)).toBe(false);
  });

  /* The STATIC predicate the latch, the param freeze and the automatic confirm
     share — it must agree with the runtime decision above. */
  it('bindingDispatches / verbDispatches / declaresItemActions — the static half agrees with the Proxy', () => {
    expect(declaresItemActions({ props: { rowActions: [] } })).toBe(true);
    expect(declaresItemActions({ props: { bulkActions: [{ id: 'x' }] } })).toBe(true);
    expect(declaresItemActions({ props: {}, rowActions: [{ id: 'x' }] })).toBe(true); // element-level placement
    expect(declaresItemActions({ props: { rowActions: 'nope' } })).toBe(false);
    expect(declaresItemActions(null)).toBe(false);

    const sel = { type: 'Select', on: { change: { action: 'go' } } };
    expect(bindingDispatches(sel, 'change', sel.on.change, allowed)).toBe(false);
    expect(bindingDispatches(sel, 'change', { action: 'go', live: true }, allowed)).toBe(true);
    expect(bindingDispatches(sel, 'change', sel.on.change, [...allowed, 'Select'])).toBe(true);
    expect(bindingDispatches({ type: 'Button' }, 'commit', { action: 'go' }, allowed)).toBe(true);
    const boardEl = { type: 'KanbanBoard', props: { rowActions: [{ id: 'r' }] }, on: { commit: { action: 'go' }, move: { action: 'mv' } } };
    expect(bindingDispatches(boardEl, 'commit', boardEl.on.commit, allowed)).toBe(true);   // the row-action press
    expect(bindingDispatches(boardEl, 'move', boardEl.on.move, allowed)).toBe(false);      // the drag stays local

    expect(verbDispatches(sel, 'change', allowed)).toBe(false);
    expect(verbDispatches({ type: 'Switch', on: { change: [{ action: 'setState' }, { action: 'go', live: true }] } }, 'change', allowed)).toBe(true);
    expect(verbDispatches({ type: 'Switch', on: { change: { action: 'a' }, commit: { action: 'b', live: true } } }, 'change', allowed)).toBe(false);
    expect(verbDispatches({ type: 'Switch', on: { change: { action: 'a' }, commit: { action: 'b', live: true } } }, 'commit', allowed)).toBe(true);
    expect(verbDispatches({ type: 'Button' }, 'commit', allowed)).toBe(true);
    expect(verbDispatches(boardEl, 'commit', allowed)).toBe(true);
    expect(verbDispatches(boardEl, 'move', allowed)).toBe(false);
  });
});

/* ── (j) a Form's submit is the submit step ─────────────────────────────── */

describe('(j) a Form\'s declared commit reaches the agent from its submit Button, under the defaults', () => {
  const formPage = (button: Record<string, unknown> = { submit: true }) =>
    tree(
      {
        form: { type: 'Form', props: {}, children: ['note', 'go'], on: { commit: bind('escalate') } },
        note: { type: 'Input', props: { label: 'Note', name: 'note' } },
        go: { type: 'Button', props: { label: 'Escalate', ...button } },
      },
      ['form'],
      { escalate: { kind: 'agent' } },
    );

  it('submit:true → the Form\'s commit dispatches, element_id names the FORM (the declaring element)', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={formPage()} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(btnEl('Escalate'));
    await settle();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'escalate', event: 'commit', element_id: 'form', params: { fields: { note: '' } } });
    // and the submit control dies with it (FormCommitContext), as before
    expect(btnEl('Escalate').disabled).toBe(true);
  });

  it('a bindings-less Button inside the Form submits it too', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={formPage({})} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(btnEl('Escalate'));
    await settle();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'escalate', element_id: 'form' });
  });

  it('Enter in a text field (implicit submission) commits the Form', async () => {
    const onDynamicAction = vi.fn();
    const { container } = render(<FraymeRenderer spec={formPage({})} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.keyDown(container.querySelector('input')!, { key: 'Enter' });
    await settle();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('NEGATIVE: a list without Form keeps the submit local', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={formPage()} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={['Button', 'DataTable']} />);
    fireEvent.click(btnEl('Escalate'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    expect(btnEl('Escalate').disabled).toBe(false);
  });
});

/* ── (k) the press-shaped hosts go; the typed composer stays ────────────── */

describe('(k) press-class hosts dispatch under the defaults; PromptInput does not', () => {
  it('IconButton', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ ib: { type: 'IconButton', props: { icon: 'plus', label: 'Approve' }, on: { commit: bind('approve') } } }, { approve: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByLabelText('Approve'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'approve', event: 'commit', element_id: 'ib', params: { label: 'Approve' } });
    expect(screen.getByLabelText<HTMLButtonElement>('Approve').disabled, 'a carrier latches as it always did').toBe(true);
  });

  it('Fab (single action — the main button is the press)', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ fab: { type: 'Fab', props: { icon: 'plus', label: 'Add' }, on: { commit: bind('add') } } }, { add: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'add', event: 'commit', element_id: 'fab' });
  });

  it('Confirmation — the verdict leaves the renderer and both buttons latch', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { c: { type: 'Confirmation', props: { message: 'Cancel this session?', confirmLabel: 'Cancel session', denyLabel: 'Keep' }, on: { commit: bind('cancelSession'), dismiss: bind('cancelSession') } } },
          { cancelSession: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btnEl('Cancel session'));
    await settle();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'cancelSession', event: 'commit', element_id: 'c' });
    expect(btnEl('Cancel session').disabled).toBe(true);
    expect(btnEl('Keep').disabled).toBe(true);
  });

  /* NOT a carrier by default: PromptInput's `commit` is Enter / the send glyph on
     typed text (the same reason the automatic confirm exempts it — Enter is not a
     press) and its `change` fires per keystroke. A chat surface opts in with
     `live: true` on the binding or `dynamicActionTypes`. Pinned both ways. */
  it('PromptInput send stays local by default; live:true (or widening) carries it', async () => {
    const onDynamicAction = vi.fn();
    const { unmount } = render(
      <FraymeRenderer
        spec={page({ pi: { type: 'PromptInput', props: { value: 'hello' }, on: { commit: bind('send') } } }, { send: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByLabelText('Send message'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    unmount();
    render(
      <FraymeRenderer
        spec={page({ pi: { type: 'PromptInput', props: { value: 'hello' }, on: { commit: bind('send', { live: true }) } } }, { send: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByLabelText('Send message'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'send', element_id: 'pi', params: { value: 'hello' } });
  });

  /* ButtonGroup LOOKS like buttons but is a segmented pick: it fires `change`
     with a value and binds `selected`. A pick stays local, like a Radio. */
  it('NEGATIVE: ButtonGroup is a pick, not a press — its change stays local', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          {
            bg: { type: 'ButtonGroup', props: { buttons: [{ label: 'Day', value: 'day' }, { label: 'Week', value: 'week' }] }, on: { change: bind('setRange') } },
            go: button('Run', 'runReport'),
          },
          { setRange: { kind: 'agent' }, runReport: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btnEl('Week'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    fireEvent.click(btnEl('Run'));
    expect(uiOf(onDynamicAction.mock.calls[0]![0]).bg.change).toMatchObject({ value: 'week' });
  });
});

/* ── (l) the row / bulk action AFFORDANCE is a carrier on any host ──────── */

describe('(l) a row action button carries on a KanbanBoard / KanbanCard; the board\'s move does not', () => {
  const rowActionBoard = () => ({
    type: 'KanbanBoard',
    props: {
      rowActions: [{ id: 'reassign', label: 'Reassign driver', confirm: false }],
      columns: [
        { title: 'Queued', cards: [{ id: 'D-201', title: 'D-201', moveable: true }, { id: 'D-202', title: 'D-202' }] },
        { title: 'En route', cards: [] },
      ],
    },
    on: { commit: bind('reassignDriver'), move: bind('cardMove') },
  });

  it('KanbanBoard rowActions press → dispatched with element_id and the card payload', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer spec={page({ board: rowActionBoard() }, { reassignDriver: { kind: 'agent' }, cardMove: { kind: 'agent' } })} mode="progressive" onDynamicAction={onDynamicAction} />,
    );
    const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign driver'));
    fireEvent.click(btns[1]!);
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'reassignDriver', event: 'commit', element_id: 'board', params: { action: 'reassign', id: 'D-202' } });
  });

  it('NEGATIVE: the same board\'s move is still local', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer spec={page({ board: rowActionBoard() }, { reassignDriver: { kind: 'agent' }, cardMove: { kind: 'agent' } })} mode="progressive" onDynamicAction={onDynamicAction} />,
    );
    fireEvent.click(screen.getAllByLabelText('Move right')[0]!);
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('a slot-mode KanbanCard\'s own rowActions press carries with the CARD\'s element_id', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={tree(
          {
            board: { type: 'KanbanBoard', props: {}, children: ['c1'] },
            c1: { type: 'BoardColumn', props: { title: 'Signed up' }, children: ['k1'] },
            k1: { type: 'KanbanCard', props: { id: 'wf-1', title: 'Northwind', rowActions: [{ id: 'reassign', label: 'Reassign CSM', confirm: false }] }, on: { commit: bind('reassignCsm') } },
          },
          ['board'],
          { reassignCsm: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btnEl('Reassign CSM'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'reassignCsm', event: 'commit', element_id: 'k1', params: { action: 'reassign', id: 'wf-1' } });
  });

  it('narrowing dynamicActionTypes silences a DataTable\'s sort but not its row action (the affordance is about the fire)', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          {
            tbl: {
              type: 'DataTable',
              props: {
                columns: [{ key: 'name', label: 'Name', sortable: true }],
                rows: [{ name: 'Ada' }],
                rowActions: [{ id: 'approve', label: 'Approve', confirm: false }],
              },
              on: { commit: bind('tableAct'), sort: bind('reSort') },
            },
          },
          { tableAct: { kind: 'agent' }, reSort: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        dynamicActionTypes={['Button']}
      />,
    );
    fireEvent.click(screen.getByText('Name'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    fireEvent.click(btnEl('Approve'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'tableAct', params: { action: 'approve' } });
  });
});

/* ── (m) the param freeze follows the gate ──────────────────────────────── */

describe('(m) a control feeding a host-declared param stays writable after a DENIED change', () => {
  /* Rules 3/4/5 freeze the params of an action that was SENT. The first cut
     registered every declared binding as an owner, so a Select's own denied
     `change → setRegion` (with host-declared params) froze the Select on its
     first touch: greyed, writes rejected, bound value one step behind the mirror.
     It must stay writable until a binding that actually leaves the renderer fires. */
  const spec = () =>
    page(
      {
        region: { type: 'Select', props: { label: 'Region', name: 'region', options: ['emea', 'apac'], value: { $bindState: '/region' } }, on: { change: bind('setRegion') } },
        run: button('Run', 'runReport'),
      },
      {
        setRegion: { kind: 'agent', params: { region: {} } },
        runReport: { kind: 'agent', params: { region: {} } },
      },
      { region: 'emea' },
    );

  it('two denied changes both land in the bound value; the carrier press then freezes it', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={spec()} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    expect(selectNode().value).toBe('apac');
    fireEvent.change(selectNode(), { target: { value: 'emea' } });
    await settle();
    expect(selectNode().value, 'the second write must not be rejected').toBe('emea');
    fireEvent.click(screen.getByText('Run'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0]![0];
    expect((ev.state as { region: string }).region, 'state and the batching record agree').toBe('emea');
    expect(uiOf(ev).region.change).toMatchObject({ value: 'emea' });
    // NOW the param is sent: rule 4 — it becomes readonly.
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    await settle();
    expect(selectNode().value, 'frozen once the carrier fired').toBe('emea');
  });
});

/* ── (n) onSuccess / onError chains inherit their trigger's identity ────── */

describe('(n) a binding\'s onSuccess / onError chain gets the trigger\'s decision', () => {
  it('from a Button, both the action and its onSuccess reach the agent with the Button\'s element_id', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { go: { type: 'Button', props: { label: 'Save' }, on: { commit: bind('save', { onSuccess: { action: 'notify' } }) } } },
          { save: { kind: 'agent' }, notify: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Save'));
    await settle();
    expect(onDynamicAction.mock.calls.map((c) => c[0].action)).toEqual(['save', 'notify']);
    expect(onDynamicAction.mock.calls[1]![0]).toMatchObject({ action: 'notify', event: 'commit', element_id: 'go' });
  });

  it('NEGATIVE: from a Select, the chain is denied along with its trigger', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { region: { ...selectEl(null), on: { change: bind('setRegion', { onSuccess: { action: 'notify' } }) } } },
          { setRegion: { kind: 'agent' }, notify: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('the branch that did not run (onError after a success) is swept — it cannot vouch for a later bare emit', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          {
            go: { type: 'Button', props: { label: 'Save' }, on: { commit: bind('save', { onError: { action: 'rollback' } }) } },
            p: { type: 'BareProbe', props: {}, on: { commit: bind('rollback') } },
          },
          { save: { kind: 'agent' }, rollback: { kind: 'agent' } },
        )}
        mode="progressive"
        components={{ BareProbe }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Save'));
    await settle();
    expect(onDynamicAction.mock.calls.map((c) => c[0].action)).toEqual(['save']);
    fireEvent.click(screen.getByText('Bare'));
    await settle();
    expect(onDynamicAction, 'the stale onError identity must not carry the bare emit').toHaveBeenCalledTimes(1);
  });
});

/* ── (o) `watch` has no gesture — it stays local ────────────────────────── */

describe('(o) a `watch` handler naming a declared action stays local (fail-closed); a local handler still runs', () => {
  const watched = (actions: Record<string, unknown>) =>
    page(
      {
        t: { type: 'Text', props: { text: 'hi' }, watch: { '/x': { action: 'onX' } } },
        bump: { type: 'Button', props: { label: 'Bump' }, on: { commit: { action: 'setState', params: { statePath: '/x', value: 2 } } } },
      },
      actions,
      { x: 1 },
    );

  it('the agent kind is denied', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={watched({ onX: { kind: 'agent' } })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(screen.getByText('Bump'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('CONTROL: the watch does fire — a local handler for it runs', async () => {
    const run = vi.fn();
    render(<FraymeRenderer spec={watched({})} mode="progressive" actions={{ onX: run }} />);
    fireEvent.click(screen.getByText('Bump'));
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

/* ── (p) the automatic confirm follows the gate ─────────────────────────── */

describe('(p) the universal confirm is not injected where the gate would deny', () => {
  it('a Select\'s declared change (no authored confirm) opens NO modal, stays local, and is still mirrored', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { region: { ...selectEl(null), on: { change: { action: 'setRegion' } } }, send: button('Send', 'submitReport') },
          { setRegion: { kind: 'agent', description: 'Re-cut the report by region' }, submitReport: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    await settle();
    expect(modal(), 'no "are you sure?" about a gesture that goes nowhere').toBeNull();
    expect(onDynamicAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Send'));
    expect(uiOf(onDynamicAction.mock.calls[0]![0]).region.change).toMatchObject({ value: 'apac' });
  });

  it('CONTROL: a Button\'s declared commit (no authored confirm) still opens the guard', () => {
    render(
      <FraymeRenderer
        spec={page({ go: { type: 'Button', props: { label: 'Go' }, on: { commit: { action: 'go' } } } }, { go: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={vi.fn()}
      />,
    );
    fireEvent.click(btnEl('Go'));
    expect(modal()).not.toBeNull();
  });

  it('an AUTHORED confirm on a non-carrier is left alone — the author decided', () => {
    render(
      <FraymeRenderer
        spec={page({ region: { ...selectEl(null), on: { change: { action: 'setRegion', confirm: { title: 'Sure?', message: '' } } } } }, { setRegion: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={vi.fn()}
      />,
    );
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    expect(modal()).not.toBeNull();
  });

  it('a live:true Select gets no modal either (unchanged: live and confirm are incoherent)', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ region: { ...selectEl(null), on: { change: { action: 'setRegion', live: true } } } }, { setRegion: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.change(selectNode(), { target: { value: 'apac' } });
    expect(modal()).toBeNull();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });
});
