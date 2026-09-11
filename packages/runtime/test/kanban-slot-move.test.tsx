/**
 * Kanban move affordances, in both authoring forms.
 *
 * SLOT form (BoardColumn/KanbanCard elements): the runtime resolves each
 * element's children from the spec and a card carries no spec identity, so no
 * component can re-parent a card — a local move is not expressible. What the
 * board CAN do is tell each column its position and each card its column, so
 * the arrows are honest at the edges and a move names the columns it spans for
 * the host to perform.
 *
 * DATA form (the `columns` prop): KanbanBoard owns the arrangement, so a move
 * is a real move.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const slotSpec = (): Spec =>
  ({
    root: 'board',
    elements: {
      board: { type: 'KanbanBoard', props: {}, children: ['c1', 'c2', 'c3'] },
      c1: { type: 'BoardColumn', props: { title: 'Backlog' }, children: ['k1', 'k2'] },
      c2: { type: 'BoardColumn', props: { title: 'Doing' }, children: ['k3'] },
      c3: { type: 'BoardColumn', props: { title: 'Done' }, children: [] },
      k1: { type: 'KanbanCard', props: { id: 'A-1', title: 'Alpha', moveable: true } },
      k2: { type: 'KanbanCard', props: { id: 'A-2', title: 'Beta', moveable: true } },
      k3: { type: 'KanbanCard', props: { id: 'A-3', title: 'Gamma', moveable: true } },
    },
    state: {},
  }) as unknown as Spec;

const dataSpec = (): Spec =>
  ({
    root: 'board',
    elements: {
      board: {
        type: 'KanbanBoard',
        // In the data form the arrows appear only when the board is consumable
        // — a bound `board`, an on.move wiring or showSave — so the affordance
        // is never dead. A binding is the lightest of the three.
        props: {
          board: { $bindState: '/board' },
          columns: [
            { title: 'Backlog', cards: [{ title: 'Alpha' }, { title: 'Beta' }] },
            { title: 'Doing', cards: [{ title: 'Gamma' }] },
            { title: 'Done', cards: [] },
          ],
        },
      },
    },
    state: { board: [] },
  }) as unknown as Spec;

// the scroller holding the columns — one level deeper in the data form, which
// wraps the board in a column stack for its optional save row
const boardOf = (c: HTMLElement): Element => {
  const root = c.querySelector('.frayme-root')!;
  return root.querySelector('div[class*="overflow-x-auto"]') ?? (root.firstElementChild as Element);
};
const cardsPerColumn = (c: HTMLElement) =>
  [...boardOf(c).children].map((col) => [...col.querySelectorAll('button[title]')].map((b) => b.getAttribute('title')));
const arrows = (col: Element, label: string) =>
  [...col.querySelectorAll(`button[aria-label="${label}"]`)] as HTMLButtonElement[];

describe('slot-authored board — honest arrows, host-performed move', () => {
  it('disables the impossible direction at each end and leaves both open in the middle', () => {
    const { container } = render(<FraymeRenderer spec={slotSpec()} mode="progressive" />);
    const cols = [...boardOf(container).children];
    expect(arrows(cols[0], 'Move left').length).toBeGreaterThan(0);
    expect(arrows(cols[0], 'Move left').every((b) => b.disabled)).toBe(true);
    expect(arrows(cols[0], 'Move right').every((b) => !b.disabled)).toBe(true);
    expect(arrows(cols[1], 'Move left').every((b) => !b.disabled)).toBe(true);
    expect(arrows(cols[1], 'Move right').every((b) => !b.disabled)).toBe(true);
  });

  it('a move names the column it leaves and the one it targets', () => {
    const onAction = vi.fn();
    const spec = slotSpec() as unknown as { actions?: unknown };
    spec.actions = { moveIssue: { kind: 'agent' } };
    (spec as unknown as { elements: Record<string, { on?: unknown }> }).elements.k1.on = {
      move: [{ action: 'moveIssue', confirm: false }],
    };
    // KanbanCard is not a carrier under the dynamic-action gate — a slot card's
    // move stays local by default (pinned in dynamic-gate.test.tsx). Widened here
    // because THIS test is about the payload the host receives when it does go.
    const { container } = render(
      <FraymeRenderer
        spec={spec as unknown as Spec}
        mode="progressive"
        defaultActionKind="agent"
        onDynamicAction={onAction}
        dynamicActionTypes={['Button', 'DataTable', 'KanbanCard']}
      />,
    );
    fireEvent.click(arrows([...boardOf(container).children][0], 'Move right')[0]);
    expect(onAction).toHaveBeenCalledTimes(1);
    const params = (onAction.mock.calls[0][0] as { params: Record<string, unknown> }).params;
    expect(params.fromColumn).toBe('Backlog');
    expect(params.toColumn).toBe('Doing');
    expect(params.dir).toBe('right');
    expect(params.id).toBe('A-1');
  });
});

describe('data-authored board — the arrangement is owned, so the card really moves', () => {
  it('Move right relocates the card and Move left brings it back', () => {
    const { container } = render(<FraymeRenderer spec={dataSpec()} mode="progressive" />);
    expect(cardsPerColumn(container)).toEqual([['Alpha', 'Beta'], ['Gamma'], []]);
    fireEvent.click(arrows([...boardOf(container).children][0], 'Move right')[0]);
    expect(cardsPerColumn(container)).toEqual([['Beta'], ['Gamma', 'Alpha'], []]);
    const doing = [...boardOf(container).children][1];
    const alphaCard = [...doing.querySelectorAll('button[title]')].find((b) => b.getAttribute('title') === 'Alpha')!.parentElement!;
    fireEvent.click(alphaCard.querySelector('button[aria-label="Move left"]') as HTMLButtonElement);
    expect(cardsPerColumn(container)).toEqual([['Beta', 'Alpha'], ['Gamma'], []]);
  });

  it('arrows are disabled at the ends here too', () => {
    const { container } = render(<FraymeRenderer spec={dataSpec()} mode="progressive" />);
    const cols = [...boardOf(container).children];
    expect(arrows(cols[0], 'Move left').length).toBeGreaterThan(0);
    expect(arrows(cols[0], 'Move left').every((b) => b.disabled)).toBe(true);
    expect(arrows(cols[0], 'Move right').every((b) => !b.disabled)).toBe(true);
  });
});
