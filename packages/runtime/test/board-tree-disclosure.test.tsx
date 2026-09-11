/**
 * board-nav + structure-flow — a disclosure may not name a panel it has not
 * mounted.
 *
 * MEASURED (accessibility audit at 1100px, before this fix): elements carried an
 * `aria-controls` pointing at an id that is NOT in the document, and nearly all of them
 * came from these two files:
 *   BoardColumn's collapse toggle  (`BUTTON expanded=false :: flex min-h-6 w-full …`)
 *   Tree's collapsed branch row    (`LI expanded=false :: m-0 rounded-frayme …`)
 * plus NavigationMenu's flyout trigger, which emits the same shape whenever a
 * spec gives a nav entry children.
 *
 * All three shipped the reference unconditionally, on the reasoning recorded in
 * the code that a dangling IDREF is "legal" because `aria-expanded="false"`
 * already says there is nothing to reach. Legal is not the bar: ARIA merely
 * RECOMMENDS `aria-controls` for the disclosure pattern, so dropping it while
 * collapsed costs a reader nothing, whereas following a reference that resolves
 * to no element strands them — and collapsed is the state a disclosure spends
 * most of its life in. Same defect, same fix, as Toggletip
 * (toggletip-disclosure.test.tsx) and ai-flow's Reasoning/ToolCall
 * (ai-flow-filter-disclosure.test.tsx).
 *
 * `aria-expanded` deliberately stays on the trigger in BOTH states — that is the
 * part of the pattern that is REQUIRED, and it is what announces the collapse.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';

import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (type: string, props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type, props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  );

/** Every id token of every `aria-controls` in the tree must name exactly one
 *  live element. Returns the offenders so a failure names them. */
function danglingRefs(container: HTMLElement): string[] {
  const bad: string[] = [];
  for (const el of container.querySelectorAll('[aria-controls]')) {
    for (const id of (el.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean)) {
      const hits = container.querySelectorAll(`[id="${id}"]`).length;
      if (hits !== 1) bad.push(`${id} -> ${hits} elements`);
    }
  }
  return bad;
}

describe('BoardColumn collapse toggle', () => {
  it('names the card stack only while the stack is mounted', () => {
    const { container } = draw('BoardColumn', { title: 'In review', count: 2, collapsible: true });
    const btn = container.querySelector('button')!;

    // Open (the default): the reference resolves to the one live card stack.
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const id = btn.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(danglingRefs(container)).toEqual([]);

    // Collapsed: the stack is unmounted, so the promise is withdrawn with it.
    // aria-expanded stays — that is what announces the collapsed state.
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls'), 'collapsed stack is not in the document').toBeNull();
    expect(danglingRefs(container)).toEqual([]);

    // …and comes back on re-expand, still resolving to exactly one node.
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-controls')).toBe(id);
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
  });

  it('collapsed via the `collapsed` prop — the state a spec ships in — dangles nothing', () => {
    // Most of the measured dangling references were this: a column authored
    // collapsed, never touched by the user, announcing a stack that is not there.
    const { container } = draw('BoardColumn', { title: 'Done', collapsible: true, collapsed: true });
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBeNull();
    expect(danglingRefs(container)).toEqual([]);
  });

  it('the EMPTY body branch is named too — the two branches are exclusive', () => {
    // ColumnShell renders either the card stack or the emptyText placeholder,
    // both carrying `bodyId`. Gating on `collapsed` (not on which branch won)
    // is what keeps the reference resolving in either.
    const { container } = draw('BoardColumn', { title: 'Blocked', collapsible: true, emptyText: 'Nothing blocked' });
    const btn = container.querySelector('button')!;
    const id = btn.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(container.querySelector(`[id="${id}"]`)!.textContent).toContain('Nothing blocked');
    expect(danglingRefs(container)).toEqual([]);
  });

  it('a KanbanBoard (inline, non-collapsible columns) has no disclosure at all', () => {
    const { container } = draw('KanbanBoard', {
      columns: [
        { title: 'Todo', cards: [{ title: 'Ship it' }] },
        { title: 'Doing', cards: [] },
      ],
    });
    expect(container.querySelectorAll('[aria-expanded]').length).toBe(0);
    expect(danglingRefs(container)).toEqual([]);
  });
});

describe('NavigationMenu flyout trigger', () => {
  it('names the flyout only while it is open', () => {
    const { container } = draw('NavigationMenu', {
      items: [
        { label: 'Docs', href: '/docs' },
        { label: 'Product', children: [{ label: 'Studio', href: '/studio', description: 'Build' }] },
      ],
    });
    const btn = container.querySelector('button[aria-haspopup="menu"]')!;

    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls'), 'the flyout is not mounted while closed').toBeNull();
    // aria-haspopup still announces that a menu is behind this trigger.
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(danglingRefs(container)).toEqual([]);

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const id = btn.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.getAttribute('role')).toBe('menu');
    expect(danglingRefs(container)).toEqual([]);

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-controls')).toBeNull();
  });

  it('sibling parents keep their own flyout: opening one does not strand the other', () => {
    const { container } = draw('NavigationMenu', {
      items: [
        { label: 'Product', children: [{ label: 'Studio', href: '/studio' }] },
        { label: 'Company', children: [{ label: 'About', href: '/about' }] },
      ],
    });
    const [first, second] = [...container.querySelectorAll('button[aria-haspopup="menu"]')];
    fireEvent.click(first);
    expect(first.getAttribute('aria-controls')).toBeTruthy();
    // Only ONE flyout is open at a time (openIndex is a single slot), so the
    // sibling must not still be pointing at a panel that unmounted.
    expect(second.getAttribute('aria-controls')).toBeNull();
    expect(danglingRefs(container)).toEqual([]);
  });
});

describe('Tree branch rows', () => {
  const NODES = [
    { label: 'src', children: [{ label: 'index.ts' }, { label: 'react', children: [{ label: 'registry' }] }] },
    { label: 'README.md' },
  ];

  it('a collapsed branch announces the collapse without naming the absent group', () => {
    const { container } = draw('Tree', { nodes: NODES });
    const branch = container.querySelector('li[role="treeitem"]')!;
    expect(branch.getAttribute('aria-expanded')).toBe('false');
    expect(branch.getAttribute('aria-controls'), 'the group is not rendered while collapsed').toBeNull();
    expect(container.querySelectorAll('[role="group"]').length).toBe(0);
    expect(danglingRefs(container)).toEqual([]);
  });

  it('expanding mounts the group and the reference resolves to exactly it', () => {
    const { container } = draw('Tree', { nodes: NODES });
    const branch = container.querySelector('li[role="treeitem"]')!;
    fireEvent.click(branch);

    expect(branch.getAttribute('aria-expanded')).toBe('true');
    const id = branch.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    const group = container.querySelector(`[id="${id}"]`)!;
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(group.getAttribute('role')).toBe('group');
    // …and it is THIS row's group, not a descendant's.
    expect(group.parentElement).toBe(branch);
    expect(danglingRefs(container)).toEqual([]);

    fireEvent.click(branch);
    expect(branch.getAttribute('aria-controls')).toBeNull();
  });

  it('a nested branch left collapsed inside an open parent dangles nothing', () => {
    // `defaultExpandedDepth: 1` opens the roots and leaves depth-1 branches shut —
    // the mixed state a real file tree ships in, and where the measured LI
    // offenders came from.
    const { container } = draw('Tree', { nodes: NODES, defaultExpandedDepth: 1 });
    const rows = [...container.querySelectorAll('li[role="treeitem"]')];
    const open = rows.filter((r) => r.getAttribute('aria-expanded') === 'true');
    const shut = rows.filter((r) => r.getAttribute('aria-expanded') === 'false');
    // Guard the guard: both states must actually be present or this is vacuous.
    expect(open.length, 'expected an expanded branch').toBeGreaterThan(0);
    expect(shut.length, 'expected a collapsed branch').toBeGreaterThan(0);

    for (const r of open) expect(r.getAttribute('aria-controls')).toBeTruthy();
    for (const r of shut) expect(r.getAttribute('aria-controls')).toBeNull();
    expect(danglingRefs(container)).toEqual([]);
  });

  it('a LEAF row carries neither attribute — it opens nothing', () => {
    const { container } = draw('Tree', { nodes: NODES });
    const leaf = [...container.querySelectorAll('li[role="treeitem"]')].find(
      (r) => (r.textContent ?? '').trim() === 'README.md',
    )!;
    expect(leaf).toBeTruthy();
    expect(leaf.getAttribute('aria-expanded')).toBeNull();
    expect(leaf.getAttribute('aria-controls')).toBeNull();
  });
});
