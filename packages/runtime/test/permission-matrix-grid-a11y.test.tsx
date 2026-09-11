/**
 * A11y contract for PermissionMatrix (permission-matrix): the component declares
 * `role="grid"` / `role="gridcell"`, so it owes the APG grid pattern —
 *
 *   ONE tab stop (roving tabindex, not one stop per cell, and not ZERO stops) ·
 *   the arrow keys move FOCUS, not just a selection ring · disabled cells are
 *   stepped over (a disabled <button> cannot hold focus, so a tab stop parked on
 *   one would take the grid out of the tab order entirely) · Home/End to the ends
 *   of the row · a key the grid consumes does not also reach the embedding host.
 *
 * The defect this pins: `tabIndex={sel ? 0 : -1}` with `selected` seeded null put
 * EVERY cell at -1 on first render — 24 cells, zero in the tab order on the
 * access-review matrix — and the arrow keys rotated which cell held the 0
 * without moving document.activeElement, so the tab stop walked away from the
 * focused cell. Both halves are asserted here against real key events.
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (props: Record<string, unknown> = {}) =>
  render(<FraymeRenderer spec={one('PermissionMatrix', props)} mode="progressive" />);

/** The cell buttons in DOM order — the demo matrix is 3 roles × 4 capabilities. */
const cells = (container: HTMLElement): HTMLButtonElement[] =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="gridcell"] button'));

/** Which cell currently holds the single tab stop. */
const tabStop = (container: HTMLElement): HTMLButtonElement[] =>
  cells(container).filter((b) => b.getAttribute('tabindex') === '0');

/** aria-label is `<role> — <capability>: <value>`; the coordinate is its prefix. */
const at = (el: Element | null): string => (el?.getAttribute('aria-label') ?? '').split(':')[0].trim();

const press = (key: string): void => {
  fireEvent.keyDown(document.activeElement as HTMLElement, { key });
};

describe('PermissionMatrix — the declared grid pattern is implemented', () => {
  it('the grid is ONE tab stop, not zero — the first cell holds it before any click', () => {
    const { container } = draw();
    const all = cells(container);
    expect(all.length).toBe(12);
    expect(tabStop(container).length).toBe(1);
    expect(at(tabStop(container)[0])).toBe('Admin — Read');
    expect(all.slice(1).every((b) => b.getAttribute('tabindex') === '-1')).toBe(true);
  });

  it('ArrowRight/ArrowDown move FOCUS and take the tab stop with them', () => {
    const { container } = draw();
    tabStop(container)[0].focus();
    expect(at(document.activeElement)).toBe('Admin — Read');

    press('ArrowRight');
    expect(at(document.activeElement)).toBe('Admin — Write');
    expect(tabStop(container).length).toBe(1);
    expect(at(tabStop(container)[0])).toBe('Admin — Write');

    press('ArrowDown');
    expect(at(document.activeElement)).toBe('Editor — Write');
    expect(at(tabStop(container)[0])).toBe('Editor — Write');

    press('ArrowLeft');
    expect(at(document.activeElement)).toBe('Editor — Read');
    press('ArrowUp');
    expect(at(document.activeElement)).toBe('Admin — Read');
  });

  it('an arrow at the edge leaves focus put and hands the key back to the host', () => {
    const { container } = draw();
    tabStop(container)[0].focus();
    const onHostKey = (e: Event): void => {
      seen.push((e as KeyboardEvent).key);
    };
    const seen: string[] = [];
    document.addEventListener('keydown', onHostKey);
    try {
      // (0,0): up and left run off the matrix.
      press('ArrowUp');
      press('ArrowLeft');
      expect(at(document.activeElement)).toBe('Admin — Read');
      expect(seen).toEqual(['ArrowUp', 'ArrowLeft']);
      seen.length = 0;
      // A consumed key does not also reach the host.
      press('ArrowRight');
      expect(at(document.activeElement)).toBe('Admin — Write');
      expect(seen).toEqual([]);
    } finally {
      document.removeEventListener('keydown', onHostKey);
    }
  });

  it('Home/End go to the ends of the row', () => {
    const { container } = draw();
    tabStop(container)[0].focus();
    press('End');
    expect(at(document.activeElement)).toBe('Admin — Manage');
    press('Home');
    expect(at(document.activeElement)).toBe('Admin — Read');
  });

  it('disabled cells are stepped over — the tab stop never parks on an unfocusable button', () => {
    // Admin/Read + Admin/Write disabled: the opening tab stop is Admin/Delete,
    // and ArrowRight/Home skip the disabled pair rather than landing on it.
    const { container } = draw({
      disabledCells: [
        { role: 'admin', capability: 'read' },
        { role: 'admin', capability: 'write' },
      ],
    });
    expect(tabStop(container).length).toBe(1);
    expect(at(tabStop(container)[0])).toBe('Admin — Delete');
    tabStop(container)[0].focus();
    press('Home');
    expect(at(document.activeElement)).toBe('Admin — Delete');
    press('ArrowDown');
    expect(at(document.activeElement)).toBe('Editor — Delete');
    press('Home');
    expect(at(document.activeElement)).toBe('Editor — Read');
  });

  it('a cell reached by keyboard cycles on Enter and Space', () => {
    const { container } = draw();
    tabStop(container)[0].focus();
    press('ArrowRight');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Admin — Write: allow');
    press('Enter');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Admin — Write: deny');
    press(' ');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Admin — Write: inherit');
  });
});
