/**
 * RECEIPT ENRICHMENT, END TO END — `label` and `description` on the dispatched
 * event (core/action-enrich.ts, wired in FraymeRenderer's handlers Proxy).
 *
 * The card in the thread is headed by the control's
 * own label, VERBATIM, and says what the action does in the host's words. So the
 * event must carry both, resolved from the FIRE:
 *   · label       — the intrinsic payload's `label` (Button / IconButton / Fab /
 *                   Confirmation / Link), else the matching rowActions / bulkActions
 *                   entry on the host that drew a row / bulk action press; a Form's
 *                   submit names none ({ fields } only) — and we do not guess.
 *   · description — `actionContract` (the host's ActionDecl[]) → the server-stamped
 *                   `spec.actions[name].description` → undefined.
 *
 * Every case has its negative: a source that is absent yields `undefined`, never
 * a fallback string, never a throw, never a validation issue.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { resolveControlLabel } from '../src/core/action-enrich.js';

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
): Spec =>
  ({
    root: 'page',
    elements: { page: { type: 'Stack', props: {}, children: rootChildren }, ...elements },
    state: {},
    actions,
  }) as unknown as Spec;

/* `confirm: false` everywhere: auto-confirm.test.tsx owns the modal, and these
   tests are about what reaches the handler. */
const bind = (action: string, extra: Record<string, unknown> = {}) => ({ action, confirm: false, ...extra });

const button = (label: string | undefined, action: string, extra: Record<string, unknown> = {}) => ({
  type: 'Button',
  props: label === undefined ? { icon: 'plus' } : { label },
  on: { commit: bind(action, extra) },
});

const btnEl = (label: string) =>
  [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label && !b.closest('[data-fr-confirm]'),
  ) as HTMLButtonElement;

/* A synthesized DataTable delete confirms by default (_rowaction.ts wantsConfirm:
   `undefined` means CONFIRM); its modal's confirm button reads
   the action's label, or "Confirm" when the action drew none. */
const confirmIn = (label: string) => {
  const modal = document.querySelector('[data-fr-confirm]');
  expect(modal, 'the shared confirm modal should be open').not.toBeNull();
  fireEvent.click([...modal!.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!);
};

const DESCRIBED = 'Runs the save playbook for an at-risk account.';
const contract = [{ name: 'approveRefund', description: DESCRIBED }];
const specDescribed = { approveRefund: { kind: 'agent', description: 'Stamped by the server.' } };

afterEach(() => vi.restoreAllMocks());

/* ── (a) a Button press: label verbatim, description by precedence ────────── */

describe('(a) a Button press carries its label and the host\'s description', () => {
  it('event.label === the button label; event.description from actionContract', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ approve: button('Approve', 'approveRefund') }, { approveRefund: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        actionContract={contract}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(ev).toMatchObject({ action: 'approveRefund', element_id: 'approve', label: 'Approve', description: DESCRIBED });
  });

  it('with only spec.actions[name].description → that description', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ approve: button('Approve', 'approveRefund') }, specDescribed)}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ label: 'Approve', description: 'Stamped by the server.' });
  });

  it('actionContract WINS over spec.actions when both describe the action', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ approve: button('Approve', 'approveRefund') }, specDescribed)}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        actionContract={contract}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction.mock.calls[0]![0].description).toBe(DESCRIBED);
  });

  it('a contract entry WITHOUT a description falls through to spec.actions', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ approve: button('Approve', 'approveRefund') }, specDescribed)}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        actionContract={[{ name: 'approveRefund' }]}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction.mock.calls[0]![0].description).toBe('Stamped by the server.');
  });

  it('NEGATIVE: an icon-only Button and no description anywhere → BOTH undefined, nothing thrown', () => {
    const onDynamicAction = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <FraymeRenderer
        spec={page({ go: button(undefined, 'approveRefund') }, { approveRefund: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(container.querySelector('button')!);
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(ev.label).toBeUndefined();
    expect(ev.description).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
  });

  it('a blank spec description is no description', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ approve: button('Approve', 'approveRefund') }, { approveRefund: { kind: 'agent', description: '   ' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction.mock.calls[0]![0].description).toBeUndefined();
  });

  it('the description is trimmed; the label is NOT re-cased — German and Japanese arrive verbatim', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { de: button('Auf die Warteliste setzen', 'warteliste'), jp: button('選考枠を押さえる', 'reserve') },
          { warteliste: { kind: 'agent' }, reserve: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        actionContract={[{ name: 'warteliste', description: '  Setzt den Bewerber auf die Warteliste.\n' }]}
      />,
    );
    fireEvent.click(btnEl('Auf die Warteliste setzen'));
    fireEvent.click(btnEl('選考枠を押さえる'));
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      label: 'Auf die Warteliste setzen',
      description: 'Setzt den Bewerber auf die Warteliste.',
    });
    expect(onDynamicAction.mock.calls[1]![0].label).toBe('選考枠を押さえる');
    expect(onDynamicAction.mock.calls[1]![0].description).toBeUndefined();
  });

  /**
   * THE CONSUMER MAP IS A SOURCE. A host that routes through an
   * `actions` map and writes `description` on its entry must get its own words,
   * not the server-stamped copy the map was passed precisely to override; the
   * contract, the host's declaration to compose, still beats it.
   */
  it('a consumer `actions` MAP entry\'s description is read — above spec.actions, below the contract', () => {
    const onDynamicAction = vi.fn();
    const spec = page({ approve: button('Approve', 'approveRefund') }, specDescribed);
    const map = { approveRefund: { kind: 'agent' as const, description: 'Refunds the order in full.' } };
    const { rerender } = render(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} actions={map} />);
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0].description).toBe('Refunds the order in full.');
    // The latch disabled the first button; a fresh restartKey gives a live one.
    rerender(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} actions={map} actionContract={contract} restartKey={1} />);
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction.mock.calls[1]![0].description).toBe(DESCRIBED);
    // a map entry with no description falls through to the stamped spec text
    rerender(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} actions={{ approveRefund: { kind: 'agent' } }} restartKey={2} />);
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction.mock.calls[2]![0].description).toBe('Stamped by the server.');
  });

  it('actionContract is read LIVE — a contract passed after mount is seen by the next press', () => {
    const onDynamicAction = vi.fn();
    const spec = page({ approve: button('Approve', 'approveRefund') }, { approveRefund: { kind: 'agent' } });
    const { rerender } = render(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction.mock.calls[0]![0].description).toBeUndefined();
    rerender(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} actionContract={contract} />);
    // The latch disabled the first button; a fresh restartKey gives a live one.
    rerender(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} actionContract={contract} restartKey={1} />);
    fireEvent.click(screen.getByText('Approve'));
    expect(onDynamicAction.mock.calls[1]![0].description).toBe(DESCRIBED);
  });
});

/* ── (b) the other press-shaped carriers name themselves too ─────────────── */

describe('(b) IconButton and Confirmation presses carry their labels', () => {
  it('IconButton → event.label === its (accessible) label', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ ib: { type: 'IconButton', props: { icon: 'check', label: 'Approve' }, on: { commit: bind('approve') } } }, { approve: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByLabelText('Approve'));
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ element_id: 'ib', label: 'Approve' });
  });

  it('Confirmation → event.label === the confirm button\'s label', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { c: { type: 'Confirmation', props: { title: 'Ship it?', confirmLabel: 'Ship now' }, on: { commit: bind('ship') } } },
          { ship: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btnEl('Ship now'));
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ element_id: 'c', label: 'Ship now' });
  });
});

/* ── (c) a row / bulk action press resolves its label from the host's list ── */

describe('(c) a row / bulk action press → the matching rowActions / bulkActions entry\'s label', () => {
  const table = () => ({
    type: 'DataTable',
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ name: 'Ada' }, { name: 'Grace' }],
      selectable: true,
      rowActions: [{ id: 'approve', label: 'Approve claim', confirm: false }],
      bulkActions: [{ id: 'archive', label: 'Archive selected', confirm: false }],
    },
    on: { commit: bind('tableAct') },
  });

  it('DataTable row action → event.label === the rowAction\'s label (the payload has no `label` key)', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ tbl: table() }, { tableAct: { kind: 'agent', description: 'Approves the claim on this row.' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    const approves = [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Approve claim');
    fireEvent.click(approves[1]!);
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(ev).toMatchObject({ action: 'tableAct', element_id: 'tbl', params: { action: 'approve', index: 1 }, label: 'Approve claim' });
    expect(ev.description).toBe('Approves the claim on this row.');
    expect(ev.params).not.toHaveProperty('label');
  });

  it('DataTable bulk action → event.label === the bulkAction\'s label', () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={page({ tbl: table() }, { tableAct: { kind: 'agent' } })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(screen.getByLabelText('Select row 1'));
    fireEvent.click(btnEl('Archive selected'));
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ params: { action: 'archive' }, label: 'Archive selected' });
  });

  it('KanbanBoard rowActions press → the board\'s entry label', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          {
            board: {
              type: 'KanbanBoard',
              props: {
                rowActions: [{ id: 'reassign', label: 'Reassign driver', confirm: false }],
                columns: [{ title: 'Queued', cards: [{ id: 'D-201', title: 'D-201' }] }],
              },
              on: { commit: bind('reassignDriver') },
            },
          },
          { reassignDriver: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Reassign driver'))!);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ element_id: 'board', params: { action: 'reassign', id: 'D-201' }, label: 'Reassign driver' });
  });

  it('a slot-mode KanbanCard with its OWN rowActions → its own entry label', () => {
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
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ element_id: 'k1', label: 'Reassign CSM' });
  });

  it('a slot-mode KanbanCard drawing the BOARD\'s rowActions → the board\'s entry label (the renderer\'s own inheritance)', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={tree(
          {
            board: { type: 'KanbanBoard', props: { rowActions: [{ id: 'reassign', label: 'Reassign CSM', confirm: false }] }, children: ['c1'] },
            c1: { type: 'BoardColumn', props: { title: 'Signed up' }, children: ['k1'] },
            k1: { type: 'KanbanCard', props: { id: 'wf-1', title: 'Northwind' }, on: { commit: bind('reassignCsm') } },
          },
          ['board'],
          { reassignCsm: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btnEl('Reassign CSM'));
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ element_id: 'k1', params: { action: 'reassign' }, label: 'Reassign CSM' });
  });

  /**
   * THE BUILT-IN DELETES. `delete` and `__delete__` bypass the
   * custom-action emits: the row delete fires `dismiss` with `action: 'delete'`
   * and the bulk delete `dismiss` with `action: 'bulkDelete'`, and neither used
   * to assert an affordance or carry a label — so a "Remove claim" press was
   * carded as "Table act". The emit now stashes the label it DREW (a synthesized
   * `deletable: true` delete has no `rowActions[]` entry for the lookup to find)
   * and asserts the row / bulk affordance like every other item-action press.
   */
  it('DataTable built-in row delete → event.label === the drawn delete label (an authored `delete` entry)', () => {
    const onDynamicAction = vi.fn();
    const base = table();
    render(
      <FraymeRenderer
        spec={page(
          { tbl: { ...base, props: { ...base.props, rowActions: [{ id: 'delete', label: 'Remove claim', confirm: false }] }, on: { dismiss: bind('tableAct') } } },
          { tableAct: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btnEl('Remove claim'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'tableAct',
      event: 'dismiss',
      element_id: 'tbl',
      params: { action: 'delete', label: 'Remove claim', index: 0, row: { name: 'Ada' } },
      label: 'Remove claim',
    });
  });

  it('DataTable `deletable: true` (synthesized) → event.label === deleteLabel; icon-only → undefined', () => {
    const onDynamicAction = vi.fn();
    const cols = { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }, { name: 'Grace' }] };
    render(
      <FraymeRenderer
        spec={page({ tbl: { type: 'DataTable', props: { ...cols, deletable: true, deleteLabel: 'Entfernen' }, on: { dismiss: bind('tableAct') } } }, { tableAct: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btnEl('Entfernen'));
    confirmIn('Entfernen'); // the shorthand delete confirms by default
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ event: 'dismiss', params: { action: 'delete', label: 'Entfernen' }, label: 'Entfernen' });

    // NEGATIVE: an icon-only delete draws no text, so it names nothing — not even its id.
    const iconOnly = vi.fn();
    render(
      <FraymeRenderer
        spec={page({ tbl2: { type: 'DataTable', props: { ...cols, deletable: true, actionIcons: true }, on: { dismiss: bind('tableAct') } } }, { tableAct: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={iconOnly}
      />,
    );
    fireEvent.click(screen.getAllByLabelText('delete')[0]!);
    confirmIn('Confirm'); // no label → the modal's generic confirm
    expect(iconOnly).toHaveBeenCalledTimes(1);
    expect(iconOnly.mock.calls[0]![0].label).toBeUndefined();
    expect(iconOnly.mock.calls[0]![0].params).not.toHaveProperty('label');
  });

  it('DataTable built-in bulk delete → event.label === "Delete selected" (the text it drew)', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { tbl: { type: 'DataTable', props: { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }, { name: 'Grace' }], selectable: true, deletable: true }, on: { dismiss: bind('tableAct') } } },
          { tableAct: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByLabelText('Select row 1'));
    fireEvent.click(btnEl('Delete selected'));
    confirmIn('Delete selected'); // inherits the row delete's confirm-by-default
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      event: 'dismiss',
      element_id: 'tbl',
      params: { action: 'bulkDelete', label: 'Delete selected', removed: [{ name: 'Ada' }] },
      label: 'Delete selected',
    });
  });

  it('NEGATIVE: a row action entry with no label → event.label undefined (the id is not promoted)', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={page(
          { tbl: { ...table(), props: { ...table().props, rowActions: [{ id: 'approve', confirm: false }] } } },
          { tableAct: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    // An unlabelled row action renders its id as the button text.
    fireEvent.click(btnEl('approve'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0].label).toBeUndefined();
  });
});

/* ── (d) a Form's submit names no control ─────────────────────────────────── */

describe('(d) a Form submit carries NO label — its payload is { fields } and we do not guess', () => {
  /* forms-extended.tsx `useFormCommit`: the Form's commit emits `{ fields }` and
     nothing else — it does not know whether a submit Button, a bindings-less
     Button or Enter in a field submitted it. The contract wants the label the fire
     names, so it is left undefined rather than recovered by scanning the Form's
     children; the card falls back to humanizeName(action). */
  it('event.label is undefined; event.description still resolves from the contract', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={tree(
          {
            form: { type: 'Form', props: {}, children: ['note', 'go'], on: { commit: bind('escalate') } },
            note: { type: 'Input', props: { label: 'Note', name: 'note' } },
            go: { type: 'Button', props: { label: 'Escalate', submit: true } },
          },
          ['form'],
          { escalate: { kind: 'agent' } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        actionContract={[{ name: 'escalate', description: 'Escalates the ticket to tier 2.' }]}
      />,
    );
    fireEvent.click(btnEl('Escalate'));
    await settle();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(ev).toMatchObject({ action: 'escalate', element_id: 'form', params: { fields: { note: '' } } });
    expect(ev.label, 'a Form fire names no control').toBeUndefined();
    expect(ev.description).toBe('Escalates the ticket to tier 2.');
  });
});

/* ── (e) the pure resolver, edge by edge ───────────────────────────────────── */

describe('(e) resolveControlLabel — structural, fail-quiet', () => {
  const entry = (payload: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ({ event: 'commit', payload, ts: 0, fid: 'tbl', ...extra }) as Parameters<typeof resolveControlLabel>[1];
  const spec = { elements: { tbl: { type: 'DataTable', props: { rowActions: [{ id: 'a', label: 'Act' }], bulkActions: [{ id: 'b', label: 'Bulk' }] } } } };

  it('the payload label wins, verbatim, whatever the affordance', () => {
    expect(resolveControlLabel(spec, entry({ label: ' Ok ' }))).toBe(' Ok ');
    expect(resolveControlLabel(spec, entry({ label: 'Ok', action: 'a' }, { affordance: 'row-action' }))).toBe('Ok');
  });

  it('row-action reads rowActions; bulk-action reads bulkActions; neither crosses over', () => {
    expect(resolveControlLabel(spec, entry({ action: 'a' }, { affordance: 'row-action' }))).toBe('Act');
    expect(resolveControlLabel(spec, entry({ action: 'b' }, { affordance: 'bulk-action' }))).toBe('Bulk');
    expect(resolveControlLabel(spec, entry({ action: 'b' }, { affordance: 'row-action' }))).toBeUndefined();
    expect(resolveControlLabel(spec, entry({ action: 'a' }, { affordance: 'bulk-action' }))).toBeUndefined();
  });

  it('honours the element-level `rowActions` placement the renderer also draws', () => {
    const s = { elements: { tbl: { type: 'DataTable', props: {}, rowActions: [{ id: 'a', label: 'Sibling' }] } } };
    expect(resolveControlLabel(s, entry({ action: 'a' }, { affordance: 'row-action' }))).toBe('Sibling');
  });

  it('no affordance, no payload label → undefined; a blank payload label → undefined', () => {
    expect(resolveControlLabel(spec, entry({ action: 'a' }))).toBeUndefined();
    expect(resolveControlLabel(spec, entry({ label: '   ' }))).toBeUndefined();
    expect(resolveControlLabel(spec, entry({ label: 7 }))).toBeUndefined();
  });

  it('no entry, no fid, no elements, a missing host, a prototype id → undefined, never a throw', () => {
    expect(resolveControlLabel(spec, undefined)).toBeUndefined();
    expect(resolveControlLabel(spec, entry({ action: 'a' }, { affordance: 'row-action', fid: null }))).toBeUndefined();
    expect(resolveControlLabel({}, entry({ action: 'a' }, { affordance: 'row-action' }))).toBeUndefined();
    expect(resolveControlLabel(spec, entry({ action: 'a' }, { affordance: 'row-action', fid: 'nope' }))).toBeUndefined();
    expect(resolveControlLabel(spec, entry({ action: 'a' }, { affordance: 'row-action', fid: 'constructor' }))).toBeUndefined();
  });

  it('a KanbanCard without its own list walks up to the nearest KanbanBoard — and a cyclic children graph cannot loop it', () => {
    const s = {
      elements: {
        board: { type: 'KanbanBoard', props: { rowActions: [{ id: 'r', label: 'From board' }] }, children: ['col'] },
        col: { type: 'BoardColumn', props: {}, children: ['card', 'board'] }, // cycle: col → board → col
        card: { type: 'KanbanCard', props: {} },
      },
    };
    expect(resolveControlLabel(s, entry({ action: 'r' }, { affordance: 'row-action', fid: 'card' }))).toBe('From board');
    // an orphan card has no board above it
    const orphan = { elements: { card: { type: 'KanbanCard', props: {} } } };
    expect(resolveControlLabel(orphan, entry({ action: 'r' }, { affordance: 'row-action', fid: 'card' }))).toBeUndefined();
    // a card that DECLARES an (empty) list of its own does not inherit
    const own = { elements: { ...s.elements, card: { type: 'KanbanCard', props: { rowActions: [] } } } };
    expect(resolveControlLabel(own, entry({ action: 'r' }, { affordance: 'row-action', fid: 'card' }))).toBeUndefined();
  });
});
