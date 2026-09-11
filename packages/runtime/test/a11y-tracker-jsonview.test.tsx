/**
 * A11y contract for the two components that promised a pattern:
 *
 *   Tracker  — per-segment data is reachable WITHOUT a mouse and the strip does
 *              not claim to be clickable. The container is a labelled `group`
 *              (an `img` wrapper would hide every segment) and each segment that
 *              carries a reading is its own `img` with that reading as its name.
 *              No tab stops are added: Tracker takes no emit and selects nothing.
 *
 *   JsonView — the declared `tree` is actually implemented: ONE tab stop
 *              (roving tabindex), ArrowDown/ArrowUp between visible rows,
 *              Home/End to the ends, ArrowRight/ArrowLeft + Enter/Space on
 *              branches, `aria-level` per depth, and a named tree. Consumed keys
 *              stop both the default action and the walk to the embedding host.
 */
import { render, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const cls = (el: Element | null): string => el?.getAttribute('class') ?? '';

/* ── Tracker ────────────────────────────────────────────────────────────────── */

describe('Tracker — segment data is reachable without a mouse', () => {
  const weeks = [
    { tone: 'success', tooltip: 'w/c 25 May — 41 active seats · quiet' },
    { tone: 'warning', tooltip: 'w/c 1 Jun — 12 active seats · degraded' },
    { tone: 'neutral' },
  ];

  it('the container is a labelled group, not an img (an img hides its subtree)', () => {
    const { container } = draw('Tracker', { data: weeks });
    const strip = container.querySelector('[role="group"]')!;
    expect(strip).not.toBeNull();
    expect(strip.getAttribute('aria-label')).toBe('Status tracker, 3 segments');
    expect(container.querySelector('[role="group"] [role="img"]')).not.toBeNull();
  });

  it('every titled segment carries the SAME string as its accessible name', () => {
    const { container } = draw('Tracker', { data: weeks });
    const titled = Array.from(container.querySelectorAll('[title]'));
    expect(titled.length).toBe(2);
    for (const el of titled) {
      expect(el.getAttribute('role')).toBe('img');
      expect(el.getAttribute('aria-label')).toBe(el.getAttribute('title'));
    }
  });

  it('a segment with no reading stays out of the accessibility tree', () => {
    const { container } = draw('Tracker', { data: weeks });
    const blocks = Array.from(container.querySelectorAll('[role="group"] > div > div > div'));
    expect(blocks.length).toBe(3);
    expect(blocks[2].getAttribute('role')).toBeNull();
    expect(blocks[2].getAttribute('aria-label')).toBeNull();
  });

  it('a label already rendered as visible text is not read twice', () => {
    const { container } = draw('Tracker', { data: [{ tone: 'success', label: 'Mon' }], showLabels: true });
    const block = container.querySelector('[role="group"] > div > div > div')!;
    expect(block.getAttribute('aria-label')).toBeNull();
  });

  it('the strip activates nothing, so no segment promises activation', () => {
    const { container } = draw('Tracker', { data: weeks });
    for (const block of Array.from(container.querySelectorAll('[role="group"] > div > div > div'))) {
      expect(cls(block)).not.toContain('cursor-pointer');
    }
  });

  it('108 segments add ZERO tab stops', () => {
    const many = Array.from({ length: 108 }, (_, i) => ({ tone: 'neutral', tooltip: `week ${i}` }));
    const { container } = draw('Tracker', { data: many });
    expect(container.querySelectorAll('[tabindex]').length).toBe(0);
    expect(container.querySelectorAll('[role="img"]').length).toBe(108);
  });
});

/* ── JsonView ───────────────────────────────────────────────────────────────── */

const DATA = { a: 1, b: { c: 2 }, d: [3, 4] };

const items = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]'));

describe('JsonView — the declared tree pattern is implemented', () => {
  it('the tree is named and owns only treeitems and groups', () => {
    const { container } = draw('JsonView', { data: DATA, copyable: true });
    const tree = container.querySelector('[role="tree"]')!;
    expect(tree.getAttribute('aria-label')).toBe('JSON viewer');
    // the copy control is a button: it may not sit inside the tree
    expect(tree.querySelector('button')).toBeNull();
    expect(container.querySelector('button[aria-label="Copy JSON"]')).not.toBeNull();
  });

  it('the tree is ONE tab stop — roving tabindex, not one stop per row', () => {
    const { container } = draw('JsonView', { data: DATA });
    const rows = items(container);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.filter((r) => r.getAttribute('tabindex') === '0').length).toBe(1);
    expect(rows[0].getAttribute('tabindex')).toBe('0');
    expect(rows.slice(1).every((r) => r.getAttribute('tabindex') === '-1')).toBe(true);
  });

  it('aria-level states the depth of every row', () => {
    const { container } = draw('JsonView', { data: DATA });
    const rows = items(container);
    expect(rows[0].getAttribute('aria-level')).toBe('1');
    expect(rows.slice(1).every((r) => r.getAttribute('aria-level') === '2')).toBe(true);
  });

  it('every row has an accessible name from its OWN text, not its whole subtree', () => {
    const { container } = draw('JsonView', { data: DATA });
    for (const row of items(container)) {
      const labelledBy = row.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const label = container.querySelector(`[id="${labelledBy}"]`)!;
      expect(label).not.toBeNull();
      expect(label.querySelector('[role="treeitem"]')).toBeNull();
    }
  });

  it('ArrowDown/ArrowUp walk the visible rows and move the tab stop with focus', () => {
    const { container } = draw('JsonView', { data: DATA });
    const rows = items(container);
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items(container)[1]);
    expect(items(container)[1].getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(items(container)[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items(container)[0]);
  });

  it('Home/End jump to the first and last visible rows', () => {
    const { container } = draw('JsonView', { data: DATA });
    const rows = items(container);
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: 'End' });
    const afterEnd = items(container);
    expect(document.activeElement).toBe(afterEnd[afterEnd.length - 1]);
    fireEvent.keyDown(afterEnd[afterEnd.length - 1], { key: 'Home' });
    expect(document.activeElement).toBe(items(container)[0]);
  });

  it('ArrowRight opens a closed branch then steps into it; ArrowLeft closes it', () => {
    const { container } = draw('JsonView', { data: DATA });
    const branch = items(container).find((r) => r.getAttribute('aria-expanded') === 'false')!;
    expect(branch).not.toBeUndefined();
    const before = items(container).length;
    fireEvent.keyDown(branch, { key: 'ArrowRight' });
    const opened = items(container).find((r) => r.getAttribute('aria-level') === '2' && r.getAttribute('aria-expanded') === 'true')!;
    expect(opened).not.toBeUndefined();
    expect(items(container).length).toBeGreaterThan(before);

    act(() => opened.focus());
    fireEvent.keyDown(opened, { key: 'ArrowRight' });
    expect(items(container)[items(container).indexOf(opened) + 1]).toBe(document.activeElement);

    const reFocus = items(container).find((r) => r.getAttribute('aria-expanded') === 'true' && r.getAttribute('aria-level') === '2')!;
    fireEvent.keyDown(reFocus, { key: 'ArrowLeft' });
    expect(items(container).length).toBe(before);
  });

  it('ArrowLeft on a closed row moves to its parent', () => {
    const { container } = draw('JsonView', { data: DATA });
    const rows = items(container);
    act(() => rows[1].focus());
    fireEvent.keyDown(rows[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(items(container)[0]);
  });

  it('Enter and Space toggle a branch', () => {
    const { container } = draw('JsonView', { data: DATA });
    const branch = items(container).find((r) => r.getAttribute('aria-expanded') === 'false')!;
    fireEvent.keyDown(branch, { key: 'Enter' });
    expect(items(container).some((r) => r.getAttribute('aria-level') === '3')).toBe(true);
    const open = items(container).find((r) => r.getAttribute('aria-expanded') === 'true' && r.getAttribute('aria-level') === '2')!;
    fireEvent.keyDown(open, { key: ' ' });
    expect(items(container).some((r) => r.getAttribute('aria-level') === '3')).toBe(false);
  });

  it('a consumed key never reaches the embedding host', () => {
    const { container } = draw('JsonView', { data: DATA });
    const host = container.parentElement!;
    const heard = vi.fn();
    host.addEventListener('keydown', heard);
    try {
      const rows = items(container);
      act(() => rows[0].focus());
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
        const row = items(container).find((r) => r.getAttribute('tabindex') === '0')!;
        const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        fireEvent(row, ev);
        expect(ev.defaultPrevented, `${key} default`).toBe(true);
      }
      expect(heard).not.toHaveBeenCalled();
    } finally {
      host.removeEventListener('keydown', heard);
    }
  });

  it('an unconsumed key is left to the host', () => {
    const { container } = draw('JsonView', { data: DATA });
    const rows = items(container);
    const ev = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true });
    fireEvent(rows[0], ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
