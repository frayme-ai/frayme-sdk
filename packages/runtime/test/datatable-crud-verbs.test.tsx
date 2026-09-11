import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* The model writes `on.add` / `on.update` on a DataTable
   (observed repeatedly in generated specs). The table has ALWAYS been able to add
   and edit rows — it just reported both through one `commit` carrying an `action`
   discriminator — so those spellings validated as errors and the binder replaced
   the wiring with a raw stub button.

   These tests exist because a declared event that nothing dispatches is worse
   than no event at all: they assert the renderer really fires the verb, not just
   that the schema tolerates it. */

/* eslint-disable @typescript-eslint/no-explicit-any */
const COLS = [{ key: 'name', label: 'Name', editable: true }];
const ROWS = [{ name: 'Ada' }];

function draw(on: any, props: any = {}) {
  const onAction = vi.fn();
  const spec: any = {
    root: 't',
    elements: {
      t: {
        type: 'DataTable',
        props: { columns: COLS, rows: ROWS, addable: true, editable: true, ...props },
        on,
      },
    },
    state: {},
    actions: { doIt: { kind: 'agent' } },
  };
  const r = render(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onAction} />);
  /* Buttons OUTSIDE the confirm modal — the row-action strip and the footer. A
     built-in row action is confirm-gated by default (wantsConfirm: anything but an
     explicit false), so the modal shadows the table with its own Cancel/confirm
     pair and a naive text lookup would grab the wrong one. */
  const btn = (text: string) =>
    [...r.container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === text && !b.closest('[data-fr-confirm]'),
    );
  /** Click through the shared confirm modal if one is up. */
  const settle = () => {
    const modal = r.container.querySelector('[data-fr-confirm]');
    if (!modal) return;
    const buttons = [...modal.querySelectorAll('button')];
    fireEvent.click(buttons[buttons.length - 1]!); // the affirmative is last
  };
  return { r, btn, settle, events: () => onAction.mock.calls.map((c) => c[0]?.event), calls: onAction };
}

/** Drive the footer Add-row editor through to Save. */
function addRow(h: ReturnType<typeof draw>) {
  fireEvent.click(h.btn('Add row')!);
  h.settle();
  const input = h.r.container.querySelector('input:not([type="checkbox"])') as HTMLInputElement;
  if (input) fireEvent.change(input, { target: { value: 'Grace' } });
  fireEvent.click(h.btn('Save')!);
  h.settle();
}

/** Drive a row's Edit action through to Save. */
function editRow(h: ReturnType<typeof draw>) {
  fireEvent.click(h.btn('Edit')!);
  h.settle(); // the built-in edit row action is confirm-gated by default
  const input = h.r.container.querySelector('input:not([type="checkbox"])') as HTMLInputElement;
  if (input) fireEvent.change(input, { target: { value: 'Ada L' } });
  fireEvent.click(h.btn('Save')!);
  h.settle();
}

describe('DataTable add / update verbs actually dispatch', () => {
  it('fires `add` when the author bound on.add', () => {
    const h = draw({ add: { action: 'doIt', confirm: false } });
    addRow(h);
    expect(h.events()).toContain('add');
  });

  it('fires `update` when the author bound on.update', () => {
    const h = draw({ update: { action: 'doIt', confirm: false } });
    editRow(h);
    expect(h.events()).toContain('update');
  });

  it('carries the same payload the commit did (action discriminator intact)', () => {
    const h = draw({ add: { action: 'doIt', confirm: false } });
    addRow(h);
    const params = h.calls.mock.calls.map((c) => c[0]?.params).find((p) => p?.action === 'add');
    expect(params, 'add payload still carries {action, row, rows}').toBeTruthy();
    expect(params.rows, 'rows is the full row set after the change').toBeTruthy();
  });

  /* BACKWARD COMPATIBILITY — existing generated specs bind `commit`, never
     add/update. Those tables must behave exactly as before. */
  it('still fires `commit` for an add when only commit is bound', () => {
    const h = draw({ commit: { action: 'doIt', confirm: false } });
    addRow(h);
    expect(h.events()).toContain('commit');
  });

  it('still fires `commit` for an edit when only commit is bound', () => {
    const h = draw({ commit: { action: 'doIt', confirm: false } });
    editRow(h);
    expect(h.events()).toContain('commit');
  });

  /* NO DOUBLE ROUND TRIP. Exactly one verb per interaction — firing both would
     send the agent the same new row twice. */
  it('does not also fire commit when add is bound', () => {
    const h = draw({ add: { action: 'doIt', confirm: false } });
    addRow(h);
    expect(h.events().filter((e) => e === 'commit').length).toBe(0);
  });

  it('an add does not fire `update`, and an edit does not fire `add`', () => {
    const h1 = draw({ add: { action: 'doIt', confirm: false }, update: { action: 'doIt', confirm: false } });
    addRow(h1);
    expect(h1.events()).toContain('add');
    expect(h1.events()).not.toContain('update');

    const h2 = draw({ add: { action: 'doIt', confirm: false }, update: { action: 'doIt', confirm: false } });
    editRow(h2);
    expect(h2.events()).toContain('update');
    expect(h2.events()).not.toContain('add');
  });
});

describe('date pickers accept `commit` as an alias of select', () => {
  const drawPicker = (type: string, on: any) => {
    const onAction = vi.fn();
    const spec: any = {
      root: 'd',
      elements: { d: { type, props: { mode: 'inline' }, on } },
      state: {},
      actions: { doIt: { kind: 'agent' } },
    };
    // Date pickers are not carriers under the dynamic-action gate (their select
    // stays local by default) — widened per picker type so the alias→verb
    // resolution under test is observable at the handler.
    const r = render(
      <FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onAction} dynamicActionTypes={['Button', 'DataTable', type]} />,
    );
    // Click the first enabled day cell in the month grid.
    const day = [...r.container.querySelectorAll('button')].find((b) =>
      /^\d+$/.test(b.textContent?.trim() ?? '') && !(b as HTMLButtonElement).disabled,
    );
    if (day) fireEvent.click(day);
    return onAction.mock.calls.map((c) => c[0]?.event);
  };

  it('DatePicker on.commit fires on a day pick (as select)', () => {
    expect(drawPicker('DatePicker', { commit: { action: 'doIt', confirm: false } })).toContain('select');
  });

  it('DateRangePicker on.commit fires on a day pick (as select)', () => {
    expect(drawPicker('DateRangePicker', { commit: { action: 'doIt', confirm: false } })).toContain('select');
  });

  it('on.select still works untouched', () => {
    expect(drawPicker('DatePicker', { select: { action: 'doIt', confirm: false } })).toContain('select');
  });
});
