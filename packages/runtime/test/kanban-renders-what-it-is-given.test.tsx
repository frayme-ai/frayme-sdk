/**
 * KanbanBoard / KanbanCard must DRAW what the spec hands them.
 *
 * Measured on real generated specs.
 * Four things the model wrote and the board silently discarded — each one an
 * idiom that cannot render while the runtime has no slot to draw it in:
 *
 *   (a) `rowActions` — a spec declared [{id:'reassign',label:'Reassign driver'}]
 *       and not one button appeared, so the per-card action the prompt REQUIRED
 *       was unreachable on all 9 cards.
 *   (b) initials — drivers AK/JM/SF/TB rendered as A/J/S/T, because the avatar
 *       took the first letter of each whitespace-separated word and "AK" is one
 *       word.
 *   (c) labels + children — a spec wrote labels:["Queued"] (bare strings, which
 *       the object filter dropped) and put its 'Reassign' Button in the card's
 *       children; another put all nine 'Reassign CSM' Buttons inside KanbanCards.
 *       Zero reached the DOM.
 *   (d) width — boards of 5 x 15rem and 5 x 16rem columns forced
 *       75-80rem of columns into a desktop card, clipping the last column — the
 *       one needing attention — off the right edge with no scroll affordance.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const boardOf = (c: HTMLElement): Element => {
  const root = c.querySelector('.frayme-root')!;
  return root.querySelector('div[class*="overflow-x-auto"]') ?? (root.firstElementChild as Element);
};
const textsOf = (root: ParentNode, sel: string): string[] =>
  [...root.querySelectorAll(sel)].map((n) => (n.textContent ?? '').trim());
// The confirm dialog only. `baseElement` also contains the CARD's own button
// with the same label text, and an unscoped .find() picks that one up — which
// silently re-opened the dialog instead of accepting it.
const dialogBtn = (baseElement: HTMLElement, text: string): HTMLButtonElement => {
  const dlg = baseElement.querySelector('[data-fr-confirm]');
  expect(dlg, 'the confirm dialog should be open').not.toBeNull();
  const btn = [...dlg!.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === text);
  expect(btn, `dialog button "${text}"`).toBeTruthy();
  return btn as HTMLButtonElement;
};
// The label CHIP only — scoped by its pill class. A bare span[title="Queued"]
// also matches the COLUMN HEADER of the same name, which false-passed this
// suite against the unfixed runtime.
const chipsOf = (root: ParentNode): string[] =>
  [...root.querySelectorAll('span[class*="rounded-full"]')].map((n) => (n.textContent ?? '').trim());

/* ── (a) rowActions ───────────────────────────────────────────────────────── */

// The board from (a), reduced: three columns of delivery cards + the per-card
// action the prompt asked for.
const rowActionBoard = (rowActions: unknown, atElementLevel = false): Spec => {
  const el: Record<string, unknown> = {
    type: 'KanbanBoard',
    props: {
      itemWidth: '16rem',
      columns: [
        { title: 'Queued', cards: [{ id: 'D-201', title: 'D-201', assignee: 'AK' }, { id: 'D-202', title: 'D-202', assignee: 'JM' }] },
        { title: 'En route', cards: [{ id: 'D-205', title: 'D-205', assignee: 'TB' }] },
      ],
    },
  };
  if (atElementLevel) el.rowActions = rowActions;
  else (el.props as Record<string, unknown>).rowActions = rowActions;
  return { root: 'board', elements: { board: el }, state: {} } as unknown as Spec;
};

/* KanbanBoard is not a carrier under the dynamic-action gate (core/dynamic-gate.ts)
   — its move and change stay local by default — but a per-card ROW ACTION
   press is the `_rowaction.ts` affordance the gate names ("row / bulk action
   button"), carried on whichever host draws it. So every dispatching test below
   runs under the DEFAULT gate; both sides are pinned in dynamic-gate.test.tsx (l). */

describe('(a) rowActions draw as per-card controls', () => {
  it('renders one button per card, on every card', () => {
    const { container } = render(
      <FraymeRenderer spec={rowActionBoard([{ id: 'reassign', label: 'Reassign driver' }])} mode="progressive" />,
    );
    const btns = [...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign driver'));
    expect(btns).toHaveLength(3); // one per card, not one per board
  });

  it('a rowAction dispatch carries THAT card\'s id', () => {
    const onAction = vi.fn();
    const spec = rowActionBoard([{ id: 'reassign', label: 'Reassign driver', confirm: false }]) as unknown as {
      actions?: unknown;
      elements: Record<string, { on?: unknown }>;
    };
    spec.actions = { reassignDriver: { kind: 'agent' } };
    spec.elements.board.on = { commit: [{ action: 'reassignDriver', confirm: false }] };
    const { container } = render(
      <FraymeRenderer spec={spec as unknown as Spec} mode="progressive" defaultActionKind="agent" onDynamicAction={onAction} />,
    );
    const btns = [...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign driver'));
    fireEvent.click(btns[1]); // the SECOND card — an id the board cannot have guessed
    expect(onAction).toHaveBeenCalledTimes(1);
    const params = (onAction.mock.calls[0][0] as { params: Record<string, unknown> }).params;
    expect(params.id).toBe('D-202');
    expect(params.action).toBe('reassign');
    expect(params.column).toBe('Queued');
  });

  it('tolerates rowActions written beside props instead of inside them', () => {
    // A generated spec wrote it as a SIBLING of props. Same coercion precedent as
    // DataTable's asConfirmCfg: the intent is unambiguous, so read it.
    const { container } = render(
      <FraymeRenderer spec={rowActionBoard([{ id: 'reassign', label: 'Reassign driver' }], true)} mode="progressive" />,
    );
    expect([...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign driver'))).toHaveLength(3);
  });

  it('a card-level rowAction draws on the slot-authored card too', () => {
    const spec = {
      root: 'board',
      elements: {
        board: { type: 'KanbanBoard', props: {}, children: ['c1'] },
        c1: { type: 'BoardColumn', props: { title: 'Signed up' }, children: ['k1'] },
        k1: { type: 'KanbanCard', props: { id: 'wf-1', title: 'Northwind', rowActions: [{ id: 'reassign', label: 'Reassign CSM' }] } },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect([...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign CSM'))).toHaveLength(1);
  });
});

/* ── (b) initials ─────────────────────────────────────────────────────────── */

describe('(b) an assignee renders initials of any length', () => {
  it('keeps a two-letter initials string whole', () => {
    const { container } = render(
      <FraymeRenderer spec={rowActionBoard(null)} mode="progressive" />,
    );
    const avatars = textsOf(container, 'span[title="AK"], span[title="JM"], span[title="TB"]');
    expect(avatars).toEqual(['AK', 'JM', 'TB']); // not A / J / T
  });

  it('still takes one letter per word from a real name, capped at two', () => {
    const spec = {
      root: 'board',
      elements: {
        board: {
          type: 'KanbanBoard',
          props: { columns: [{ title: 'Doing', cards: [{ title: 'x', assignee: 'Priya Gupta' }, { title: 'y', assignee: 'ada' }] }] },
        },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(textsOf(container, 'span[title="Priya Gupta"]')).toEqual(['PG']);
    expect(textsOf(container, 'span[title="ada"]')).toEqual(['AD']);
  });
});

/* ── (c) labels + children ────────────────────────────────────────────────── */

describe('(c) labels and card children reach the DOM', () => {
  it('renders a bare-string label (labels:["Queued"])', () => {
    const spec = {
      root: 'board',
      elements: {
        board: { type: 'KanbanBoard', props: {}, children: ['c1'] },
        c1: { type: 'BoardColumn', props: { title: 'Queued' }, children: ['k1'] },
        k1: { type: 'KanbanCard', props: { id: 'q-201', title: '#D-201', labels: ['Queued'] } },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(chipsOf(container)).toContain('Queued');
  });

  it('renders the object label form unchanged', () => {
    const spec = {
      root: 'board',
      elements: {
        board: { type: 'KanbanBoard', props: {}, children: ['c1'] },
        c1: { type: 'BoardColumn', props: { title: 'Signed up' }, children: ['k1'] },
        k1: { type: 'KanbanCard', props: { title: 'Northwind', labels: [{ text: 'Pro', tone: 'info' }, { text: 'JL' }] } },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(chipsOf(container)).toEqual(expect.arrayContaining(['Pro', 'JL']));
  });

  it('renders a Button placed in the card\'s children (they used to be dropped entirely)', () => {
    const spec = {
      root: 'board',
      elements: {
        board: { type: 'KanbanBoard', props: {}, children: ['c1'] },
        c1: { type: 'BoardColumn', props: { title: 'Signed up' }, children: ['k1', 'k2'] },
        k1: { type: 'KanbanCard', props: { id: 'wf-1', title: 'Northwind' }, children: ['b1'] },
        k2: { type: 'KanbanCard', props: { id: 'wf-2', title: 'Solace Labs' }, children: ['b2'] },
        b1: { type: 'Button', props: { label: 'Reassign CSM' } },
        b2: { type: 'Button', props: { label: 'Reassign CSM' } },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect([...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign CSM'))).toHaveLength(2);
  });
});

/* ── (d) column width ─────────────────────────────────────────────────────── */

const widthBoard = (n: number, itemWidth: string): Spec =>
  ({
    root: 'board',
    elements: {
      board: {
        type: 'KanbanBoard',
        props: {
          itemWidth,
          columns: Array.from({ length: n }, (_, i) => ({ title: `Col ${i + 1}`, cards: [{ title: `t${i}` }] })),
        },
      },
    },
    state: {},
  }) as unknown as Spec;

describe('(d) columns fit up to 5, else scroll with a visible affordance', () => {
  it('every authored column is in the DOM (nothing is dropped)', () => {
    const { container } = render(<FraymeRenderer spec={widthBoard(5, '15rem')} mode="progressive" />);
    // The five-column board: the last one ('Issue') was off-screen, not absent —
    // this pins that the fix does not "solve" overflow by rendering fewer.
    expect([...boardOf(container).children]).toHaveLength(5);
  });

  it('a board of <=5 columns publishes a fit width so the columns shrink to the rail', () => {
    const { container } = render(<FraymeRenderer spec={widthBoard(5, '15rem')} mode="progressive" />);
    const fit = (boardOf(container) as HTMLElement).style.getPropertyValue('--fr-board-col-fit');
    expect(fit).not.toBe(''); // set, so min() can pick the smaller of authored vs fit
    expect(fit).toContain('/ 5');
  });

  it('a board of >5 columns keeps the authored width and scrolls instead', () => {
    const { container } = render(<FraymeRenderer spec={widthBoard(7, '15rem')} mode="progressive" />);
    expect((boardOf(container) as HTMLElement).style.getPropertyValue('--fr-board-col-fit')).toBe('');
  });

  it('the rail carries the shared scroll-edge affordance', () => {
    const { container } = render(<FraymeRenderer spec={widthBoard(7, '15rem')} mode="progressive" />);
    // Same class + measurement hook DataTable and the Tabs rail use — one
    // mechanism, gated on real overflow (see use-scroll-edges.ts).
    expect(boardOf(container).className).toContain('fr-tabscroll');
  });

  it('the slot-authored board gets the same treatment', () => {
    const spec = {
      root: 'board',
      elements: {
        board: { type: 'KanbanBoard', props: { itemWidth: '17rem' }, children: ['c1', 'c2', 'c3'] },
        c1: { type: 'BoardColumn', props: { title: 'Signed up' }, children: [] },
        c2: { type: 'BoardColumn', props: { title: 'Setting up' }, children: [] },
        c3: { type: 'BoardColumn', props: { title: 'Launched' }, children: [] },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    const rail = boardOf(container) as HTMLElement;
    expect(rail.className).toContain('fr-tabscroll');
    expect(rail.style.getPropertyValue('--fr-board-col-fit')).toContain('/ 3');
  });
});

/* ── the confirm gate in front of a card action ───────────────────────────── */

/**
 * PROVE THE GUARD FIRES. data-table.tsx carries the scar: an earlier confirm
 * config threw on every use, and the suite stayed green because 30 fixtures all
 * opted out and nothing asserted the modal ever appeared. A card action is
 * consequential by default ("Reassign driver", "Cancel this booking"), so the
 * gate is the feature, not decoration.
 */
describe('a card action is confirm-gated by default', () => {
  const gated = (confirm?: unknown): Spec => {
    const action: Record<string, unknown> = { id: 'reassign', label: 'Reassign driver' };
    if (confirm !== undefined) action.confirm = confirm;
    return rowActionBoard([action]);
  };

  it('opens the shared modal instead of dispatching straight away', () => {
    const onAction = vi.fn();
    const spec = gated() as unknown as { actions?: unknown; elements: Record<string, { on?: unknown }> };
    spec.actions = { reassignDriver: { kind: 'agent' } };
    spec.elements.board.on = { commit: [{ action: 'reassignDriver' }] };
    const { container, baseElement } = render(
      <FraymeRenderer spec={spec as unknown as Spec} mode="progressive" defaultActionKind="agent" onDynamicAction={onAction} />,
    );
    fireEvent.click([...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign driver'))[0]);
    expect(onAction).not.toHaveBeenCalled(); // gated, not fired
    // the label becomes the question, per deriveConfirm
    expect(baseElement.textContent).toContain('Reassign driver?');
    fireEvent.click(dialogBtn(baseElement, 'Reassign driver'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect((onAction.mock.calls[0][0] as { params: Record<string, unknown> }).params.id).toBe('D-201');
  });

  it('asks exactly ONCE — the board self-guards, so the binder must not add a second', () => {
    const onAction = vi.fn();
    const spec = gated() as unknown as { actions?: unknown; elements: Record<string, { on?: unknown }> };
    spec.actions = { reassignDriver: { kind: 'agent' } };
    // No `confirm` on the BINDING: the binder injects one for un-guarded actions,
    // and KanbanBoard is now in its self-guarding set so it must not here.
    spec.elements.board.on = { commit: [{ action: 'reassignDriver' }] };
    const { container, baseElement } = render(
      <FraymeRenderer spec={spec as unknown as Spec} mode="progressive" defaultActionKind="agent" onDynamicAction={onAction} />,
    );
    fireEvent.click([...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign driver'))[0]);
    fireEvent.click(dialogBtn(baseElement, 'Reassign driver'));
    // One accept is enough: a second dialog would leave onAction uncalled.
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('confirm:false is the opt-out and dispatches immediately', () => {
    const onAction = vi.fn();
    const spec = gated(false) as unknown as { actions?: unknown; elements: Record<string, { on?: unknown }> };
    spec.actions = { reassignDriver: { kind: 'agent' } };
    spec.elements.board.on = { commit: [{ action: 'reassignDriver', confirm: false }] };
    const { container } = render(
      <FraymeRenderer spec={spec as unknown as Spec} mode="progressive" defaultActionKind="agent" onDynamicAction={onAction} />,
    );
    fireEvent.click([...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('Reassign driver'))[0]);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
