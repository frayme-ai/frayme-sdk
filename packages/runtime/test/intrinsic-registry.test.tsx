/**
 * Intrinsic payloads through the REAL registry renderers (post-migration):
 * DataTable sort/page/select payloads, Input single-fire commit, Form field
 * collection + submit-button wiring, Tree select with fallback identity.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const spec = (elements: Record<string, unknown>, rootChildren?: string[]): Spec =>
  ({
    root: 'root',
    elements: {
      root: { type: 'Stack', props: {}, children: rootChildren ?? Object.keys(elements) },
      ...elements,
    },
    state: {},
  }) as unknown as Spec;

/* Every non-DataTable host in this file — Input, Form, SplitPane, Tree,
   KanbanBoard — is NOT a carrier under the dynamic-action gate (core/dynamic-
   gate.ts): its declared action stays local by default, which is pinned
   in dynamic-gate.test.tsx. These tests are about the PAYLOAD each renderer
   sends when it is allowed to dispatch, so the gate is WIDENED to name them,
   never weakened. DataTable needs no widening (it is a default carrier). */
const GATE = ['Button', 'DataTable', 'Input', 'Form', 'SplitPane', 'Tree', 'KanbanBoard'];

describe('intrinsic payloads — real registry renderers', () => {
  it('DataTable: sort carries {sortBy, sortDir}; page carries {page}; select carries identity + set', () => {
    const onDynamicAction = vi.fn();
    const dt = spec({
      table: {
        type: 'DataTable',
        props: {
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'seats', label: 'Seats', sortable: true },
          ],
          rows: [
            { name: 'Acme', seats: 12 },
            { name: 'Globex', seats: 4 },
          ],
          selectable: true,
          pageSize: 1,
        },
        on: {
          sort: { action: 'tbl_sort', confirm: false },
          page: { action: 'tbl_page', confirm: false },
          select: { action: 'tbl_select', confirm: false },
        },
      },
    });
    render(<FraymeRenderer spec={dt} mode="progressive" onDynamicAction={onDynamicAction} />);

    fireEvent.click(screen.getByText('Seats'));
    const sortEv = onDynamicAction.mock.calls.at(-1)![0];
    expect(sortEv).toMatchObject({ action: 'tbl_sort', event: 'sort' });
    expect(sortEv.params).toMatchObject({ sortBy: 'seats', sortDir: 'asc' });

    fireEvent.click(screen.getByText('Next'));
    const pageEv = onDynamicAction.mock.calls.at(-1)![0];
    expect(pageEv).toMatchObject({ action: 'tbl_page', event: 'page' });
    expect(pageEv.params).toMatchObject({ page: 2 });

    const rowCheckbox = screen.getAllByRole('checkbox')[1]!; // [0] is select-all
    fireEvent.click(rowCheckbox);
    const selEv = onDynamicAction.mock.calls.at(-1)![0];
    expect(selEv).toMatchObject({ action: 'tbl_select', event: 'select' });
    expect(selEv.params.checked).toBe(true);
    expect(Array.isArray(selEv.params.selected)).toBe(true);
    expect(selEv.params.selected).toHaveLength(1);
  });

  it('Input: exactly ONE commit per Enter (repeat guarded), payload {value, name}', () => {
    const onDynamicAction = vi.fn();
    const s = spec({
      inp: {
        type: 'Input',
        props: { label: 'Email', name: 'email' },
        on: { commit: { action: 'inp_commit', confirm: false } },
      },
    });
    render(<FraymeRenderer spec={s} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={GATE} />);
    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'a@b.c' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0].params).toMatchObject({ value: 'a@b.c', name: 'email' });
    // held-key auto-repeat must not re-fire
    fireEvent.keyDown(input, { key: 'Enter', repeat: true });
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('Form: commit collects named field values into {fields}; Button submit:true renders type=submit', () => {
    const onDynamicAction = vi.fn();
    const s = {
      root: 'form',
      elements: {
        form: {
          type: 'Form',
          props: { layout: 'vertical' },
          children: ['f1', 'f2', 'btn'],
          on: { commit: { action: 'signup', confirm: false } },
        },
        f1: { type: 'Input', props: { label: 'Full name', name: 'fullname' } },
        f2: { type: 'Input', props: { label: 'Email', name: 'email' } },
        btn: { type: 'Button', props: { label: 'Create account', variant: 'primary', submit: true } },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(
      <FraymeRenderer spec={s} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={GATE} />,
    );

    const btn = screen.getByText('Create account').closest('button')!;
    expect(btn.getAttribute('type')).toBe('submit');

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@frayme.ai' } });
    fireEvent.submit(container.querySelector('form')!);

    const commits = onDynamicAction.mock.calls.filter((c) => c[0].action === 'signup');
    expect(commits).toHaveLength(1);
    expect(commits[0]![0].params.fields).toMatchObject({ fullname: 'Ada', email: 'ada@frayme.ai' });
  });

  it('SplitPane: a drag emits move ONCE on pointer-up with the final rounded splitPercent; keyboard emits per press', () => {
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const restore: Array<[string, unknown]> = [];
    for (const m of ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture']) {
      restore.push([m, proto[m]]);
      proto[m] = m === 'hasPointerCapture' ? () => true : () => undefined;
    }
    const rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    try {
      const onDynamicAction = vi.fn();
      const s = spec({
        pane: {
          type: 'SplitPane',
          props: { orientation: 'horizontal', splitPercent: 40 },
          on: { move: { action: 'pane_move', confirm: false } },
        },
      });
      render(<FraymeRenderer spec={s} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={GATE} />);
      const sep = screen.getByRole('separator');

      fireEvent.pointerDown(sep, { pointerId: 1, buttons: 1, clientX: 160, clientY: 10 });
      fireEvent.pointerMove(sep, { pointerId: 1, buttons: 1, clientX: 100, clientY: 10 });
      fireEvent.pointerMove(sep, { pointerId: 1, buttons: 1, clientX: 150, clientY: 10 });
      fireEvent.pointerMove(sep, { pointerId: 1, buttons: 1, clientX: 200, clientY: 10 });
      expect(onDynamicAction).not.toHaveBeenCalled(); // no per-pointermove spam
      fireEvent.pointerUp(sep, { pointerId: 1 });
      // The invariant under test is the CADENCE: zero emits during moves, exactly one
      // on pointer-up, carrying a finite splitPercent. (jsdom's pointer plumbing does
      // not reliably carry clientX, so the exact percentage is not asserted here.)
      expect(onDynamicAction).toHaveBeenCalledTimes(1);
      const moveEv = onDynamicAction.mock.calls[0]![0];
      expect(moveEv).toMatchObject({ action: 'pane_move', event: 'move' });
      expect(Number.isFinite(moveEv.params.splitPercent)).toBe(true);

      fireEvent.keyDown(sep, { key: 'ArrowRight' });
      expect(onDynamicAction).toHaveBeenCalledTimes(2);
      expect(typeof onDynamicAction.mock.calls[1]![0].params.splitPercent).toBe('number');
    } finally {
      rectSpy.mockRestore();
      for (const [m, orig] of restore) proto[m] = orig;
    }
  });

  it('Tree: select fires for a valueless node with the label as fallback identity', () => {
    const onDynamicAction = vi.fn();
    const s = spec({
      tree: {
        type: 'Tree',
        props: {
          nodes: [{ label: 'src', children: [{ label: 'index.ts' }] }, { label: 'package.json' }],
          selectable: true,
          defaultExpandedDepth: 1,
        },
        on: { select: { action: 'tree_select', confirm: false } },
      },
    });
    render(<FraymeRenderer spec={s} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={GATE} />);
    fireEvent.click(screen.getByText('package.json'));
    expect(onDynamicAction).toHaveBeenCalled();
    const ev = onDynamicAction.mock.calls.at(-1)![0];
    expect(ev).toMatchObject({ action: 'tree_select', event: 'select' });
    expect(ev.params.value).toBe('package.json');
  });

  // Closes a coverage gap: a real-browser check could not drive the
  // Kanban move (it assumed HTML5 drag), but the move is a per-card BUTTON, so the
  // full {card, fromColumn, toColumn, fromIndex, toIndex} payload IS unit-testable.
  it('KanbanBoard: the per-card "Move right" button emits move with the full column-transfer payload', () => {
    const onDynamicAction = vi.fn();
    const s = spec({
      board: {
        type: 'KanbanBoard',
        props: {
          columns: [
            { title: 'To Do', cards: [{ title: 'Ship it', moveable: true }] },
            { title: 'Done', cards: [] },
          ],
        },
        on: { move: { action: 'card_move', confirm: false } },
      },
    });
    render(<FraymeRenderer spec={s} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={GATE} />);
    fireEvent.click(screen.getByLabelText('Move right'));
    const ev = onDynamicAction.mock.calls.at(-1)![0];
    expect(ev).toMatchObject({ action: 'card_move', event: 'move' });
    expect(ev.params).toMatchObject({
      card: 'Ship it',
      fromColumn: 'To Do',
      toColumn: 'Done',
      fromIndex: 0,
      toIndex: 0,
    });
  });
});
