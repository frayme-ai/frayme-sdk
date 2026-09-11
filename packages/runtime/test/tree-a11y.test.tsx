/**
 * A11y contract for Tree (structure-flow): the component declares `role=tree` /
 * `role=treeitem`, so it owes the APG tree pattern —
 *
 *   ONE tab stop (roving tabindex, not one stop per node) · ArrowDown/ArrowUp
 *   between the VISIBLE rows (a collapsed subtree is not walked) · Home/End to
 *   the ends · ArrowRight opens a closed branch then steps into it · ArrowLeft
 *   closes an open branch, else steps out to the parent · `aria-level` per depth
 *   · `aria-expanded` only where there are children · a named tree. Every key
 *   the tree consumes stops both the default action and the walk up to the
 *   embedding host's own shortcuts.
 */
import { render, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one('Tree', props)} mode="progressive" />);

const items = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]'));

const labelOf = (row: HTMLElement): string => row.querySelector('div > span[title]')?.textContent ?? '';

/* 3 roots · 8 nodes — the shape the rendered defect was measured on. */
const NODES = [
  {
    label: 'src',
    children: [
      { label: 'components', children: [{ label: 'Button.tsx' }, { label: 'Card.tsx' }] },
      { label: 'index.ts' },
    ],
  },
  { label: 'docs', children: [{ label: 'readme.md' }] },
  { label: 'package.json' },
];

/** src + docs open, `components` still closed: 6 visible rows of the 8 nodes. */
const openTop = { nodes: NODES, defaultExpandedDepth: 1 };

describe('Tree — the declared tree pattern is implemented', () => {
  it('the tree carries an accessible name', () => {
    const { container } = draw(openTop);
    expect(container.querySelector('[role="tree"]')!.getAttribute('aria-label')).toBe('Tree');
  });

  it('the tree is ONE tab stop — roving tabindex, not one stop per node', () => {
    const { container } = draw(openTop);
    const rows = items(container);
    expect(rows.length).toBe(6);
    expect(rows.filter((r) => r.getAttribute('tabindex') === '0').length).toBe(1);
    expect(rows[0].getAttribute('tabindex')).toBe('0');
    expect(rows.slice(1).every((r) => r.getAttribute('tabindex') === '-1')).toBe(true);
  });

  it('a fully collapsed tree is still ONE tab stop', () => {
    const { container } = draw({ nodes: NODES });
    const rows = items(container);
    expect(rows.length).toBe(3);
    expect(rows.filter((r) => r.getAttribute('tabindex') === '0').length).toBe(1);
  });

  it('aria-level states the 1-based depth of every row', () => {
    const { container } = draw(openTop);
    const level = (label: string): string | null =>
      items(container).find((r) => labelOf(r) === label)?.getAttribute('aria-level') ?? null;
    expect(level('src')).toBe('1');
    expect(level('package.json')).toBe('1');
    expect(level('components')).toBe('2');
    expect(level('readme.md')).toBe('2');
    // one level deeper once the depth-2 branch is opened
    const branch = items(container).find((r) => labelOf(r) === 'components')!;
    fireEvent.keyDown(branch, { key: 'ArrowRight' });
    expect(level('Button.tsx')).toBe('3');
  });

  it('aria-expanded is set on branches only — never on a leaf', () => {
    const { container } = draw(openTop);
    for (const row of items(container)) {
      const branch = ['src', 'docs', 'components'].includes(labelOf(row));
      expect(row.hasAttribute('aria-expanded'), `${labelOf(row)} aria-expanded`).toBe(branch);
    }
  });

  it('ArrowDown/ArrowUp walk the visible rows and move the tab stop with focus', () => {
    const { container } = draw(openTop);
    const rows = items(container);
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items(container)[1]);
    expect(items(container)[1].getAttribute('tabindex')).toBe('0');
    expect(items(container)[0].getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(items(container)[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items(container)[0]);
  });

  it('ArrowDown steps OVER a collapsed subtree', () => {
    const { container } = draw(openTop);
    const closed = items(container).find((r) => labelOf(r) === 'components')!;
    expect(closed.getAttribute('aria-expanded')).toBe('false');
    act(() => closed.focus());
    fireEvent.keyDown(closed, { key: 'ArrowDown' });
    expect(labelOf(document.activeElement as HTMLElement)).toBe('index.ts');
  });

  it('Home/End jump to the first and last visible rows', () => {
    const { container } = draw(openTop);
    const rows = items(container);
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: 'End' });
    expect(labelOf(document.activeElement as HTMLElement)).toBe('package.json');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(labelOf(document.activeElement as HTMLElement)).toBe('src');
  });

  it('ArrowRight opens a closed branch then steps into it; ArrowLeft closes it again', () => {
    const { container } = draw(openTop);
    const before = items(container).length;
    const branch = items(container).find((r) => labelOf(r) === 'components')!;
    act(() => branch.focus());

    fireEvent.keyDown(branch, { key: 'ArrowRight' });
    const opened = items(container).find((r) => labelOf(r) === 'components')!;
    expect(opened.getAttribute('aria-expanded')).toBe('true');
    expect(items(container).length).toBe(before + 2);

    act(() => opened.focus());
    fireEvent.keyDown(opened, { key: 'ArrowRight' });
    expect(labelOf(document.activeElement as HTMLElement)).toBe('Button.tsx');

    const reopened = items(container).find((r) => labelOf(r) === 'components')!;
    fireEvent.keyDown(reopened, { key: 'ArrowLeft' });
    expect(items(container).length).toBe(before);
    expect(items(container).find((r) => labelOf(r) === 'components')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('ArrowLeft on a closed row (or a leaf) moves to its parent', () => {
    const { container } = draw(openTop);
    const leaf = items(container).find((r) => labelOf(r) === 'index.ts')!;
    act(() => leaf.focus());
    fireEvent.keyDown(leaf, { key: 'ArrowLeft' });
    expect(labelOf(document.activeElement as HTMLElement)).toBe('src');
  });

  it('Enter and Space still toggle a branch', () => {
    const { container } = draw(openTop);
    const branch = items(container).find((r) => labelOf(r) === 'components')!;
    fireEvent.keyDown(branch, { key: 'Enter' });
    expect(items(container).some((r) => labelOf(r) === 'Button.tsx')).toBe(true);
    fireEvent.keyDown(items(container).find((r) => labelOf(r) === 'components')!, { key: ' ' });
    expect(items(container).some((r) => labelOf(r) === 'Button.tsx')).toBe(false);
  });

  // Each key is fired on a row where the tree genuinely owns it (ArrowRight on a
  // leaf, or ArrowLeft on a root, belongs to the host — asserted separately).
  const CONSUMED: Array<[string, string]> = [
    ['ArrowDown', 'src'],
    ['ArrowUp', 'docs'],
    ['Home', 'docs'],
    ['End', 'src'],
    ['ArrowRight', 'components'],
    ['ArrowLeft', 'index.ts'],
    ['Enter', 'components'],
    [' ', 'components'],
  ];

  it('a consumed key never reaches the embedding host', () => {
    for (const [key, from] of CONSUMED) {
      const { container, unmount } = draw(openTop);
      const host = container.parentElement!;
      const heard = vi.fn();
      host.addEventListener('keydown', heard);
      try {
        const row = items(container).find((r) => labelOf(r) === from)!;
        act(() => row.focus());
        const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        fireEvent(row, ev);
        expect(ev.defaultPrevented, `${key} default`).toBe(true);
        expect(heard, `${key} reached the host`).not.toHaveBeenCalled();
      } finally {
        host.removeEventListener('keydown', heard);
        unmount();
      }
    }
  });

  it('an unconsumed key is left to the host', () => {
    const { container } = draw(openTop);
    const host = container.parentElement!;
    const heard = vi.fn();
    host.addEventListener('keydown', heard);
    try {
      const ev = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true });
      fireEvent(items(container)[0], ev);
      expect(ev.defaultPrevented).toBe(false);
      expect(heard).toHaveBeenCalledTimes(1);
    } finally {
      host.removeEventListener('keydown', heard);
    }
  });
});
