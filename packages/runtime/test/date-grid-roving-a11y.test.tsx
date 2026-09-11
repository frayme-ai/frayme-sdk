/**
 * A11y contract for the shared month grid (DatePicker · DateRangePicker ·
 * Calendar). All three render `role="grid"` → `role="row"` → `role="gridcell"`,
 * so all three owe the APG grid pattern:
 *
 *   ONE tab stop (roving tabindex — not one stop per cell, and not ZERO stops) ·
 *   the arrow keys move FOCUS, not just a ring · ±1 is a day and crosses the
 *   week boundary, ±7 is a week · Home/End go to the ends of the week row ·
 *   out-of-range days are stepped over (a disabled <button> cannot hold focus,
 *   so a stop parked on one would take the grid out of the tab order) · a key
 *   the grid consumes does not also reach the embedding host.
 *
 * The two defects this pins, both measured with an accessibility audit's
 * composite-roles rule run against a
 * local render of an Aug-2026 month, 37 items = 31 gridcells + 6 rows:
 *
 *   - Calendar `selectable:false` → focusable 0. Read-only day cells were plain
 *     <div role="gridcell"> with no tabindex, so a keyboard user could not enter
 *     the grid at all and never heard the per-day event count that lives in the
 *     cell's aria-label. Now 1.
 *   - DatePicker / DateRangePicker / selectable Calendar → focusable 31, i.e.
 *     one tab stop PER DAY and arrow keys that did nothing. Legal but not the
 *     pattern the role promises, and 31 Tab presses to walk past a calendar.
 *     Now 1.
 */
import { render, fireEvent, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown> = {}) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const cells = (c: HTMLElement): HTMLElement[] =>
  Array.from(c.querySelectorAll<HTMLElement>('[role="gridcell"]'));
/** Cells holding the single tab stop — the audit's `focusable` count, restated. */
const tabStop = (c: HTMLElement): HTMLElement[] =>
  cells(c).filter((el) => el.getAttribute('tabindex') === '0');
/** aria-label is the long-formatted date ("14 August" → "August 14, 2026"). */
const at = (el: Element | null): string => el?.getAttribute('aria-label') ?? '';
const press = (key: string): void => {
  fireEvent.keyDown(document.activeElement as HTMLElement, { key });
};
/** Focusing a cell syncs the roving stop to it, which is a state update. */
const focus = (el: HTMLElement): void => {
  act(() => el.focus());
};

/* Every month grid in the file, in the two modes that reach one. */
const GRIDS: Array<[string, Record<string, unknown>]> = [
  ['DatePicker', { mode: 'inline', value: '2026-08-14' }],
  ['DateRangePicker', { mode: 'inline', startValue: '2026-08-14' }],
  ['Calendar', { month: '2026-08', value: '2026-08-14' }],
  ['Calendar (read-only)', { month: '2026-08', value: '2026-08-14', selectable: false }],
];

describe('month grid — the declared grid role is ONE roving tab stop', () => {
  for (const [name, props] of GRIDS) {
    it(`${name}: exactly one cell is tabbable, and it is the anchor day`, () => {
      const { container } = draw(name.startsWith('Calendar') ? 'Calendar' : name, props);
      // Aug 2026 has 31 days; the padding blanks carry no gridcell role.
      expect(cells(container).length).toBe(31);
      expect(tabStop(container).length).toBe(1);
      expect(at(tabStop(container)[0])).toBe('August 14, 2026');
      expect(cells(container).filter((el) => el.getAttribute('tabindex') === '-1').length).toBe(30);
    });
  }

  it('read-only Calendar cells are REACHABLE — the event count is only in the label', () => {
    const { container } = draw('Calendar', {
      month: '2026-08',
      value: '2026-08-14',
      selectable: false,
      events: [{ date: '2026-08-14', label: 'Review' }, { date: '2026-08-14', label: 'Ship' }],
    });
    const stop = tabStop(container)[0];
    expect(stop.tagName).toBe('DIV'); // not a button — read-only, but focusable
    focus(stop);
    expect(document.activeElement).toBe(stop);
    // The anchor lands on the day carrying events, which is where the count is.
    expect(at(document.activeElement)).toBe('August 14, 2026, 2 events');
  });
});

describe('month grid — the arrow keys move FOCUS and take the stop with them', () => {
  it('±1 is a day and crosses the week boundary; ±7 is a week', () => {
    const { container } = draw('DatePicker', { mode: 'inline', value: '2026-08-14' });
    focus(tabStop(container)[0]);
    expect(at(document.activeElement)).toBe('August 14, 2026');

    press('ArrowRight');
    expect(at(document.activeElement)).toBe('August 15, 2026');
    // The stop travels with focus — a ring that walks while activeElement stays
    // put would leave the focused cell at tabindex -1.
    expect(tabStop(container).length).toBe(1);
    expect(at(tabStop(container)[0])).toBe('August 15, 2026');

    press('ArrowDown');
    expect(at(document.activeElement)).toBe('August 22, 2026');
    press('ArrowUp');
    press('ArrowLeft');
    expect(at(document.activeElement)).toBe('August 14, 2026');

    // 2026-08-16 is a Sunday (Monday-first grid), so ArrowRight off its right
    // edge is the next Monday — the cell to the right of a week's last column.
    for (const _ of [1, 2]) press('ArrowRight');
    expect(at(document.activeElement)).toBe('August 16, 2026');
    press('ArrowRight');
    expect(at(document.activeElement)).toBe('August 17, 2026');
  });

  it('Home/End go to the ends of the week row', () => {
    const { container } = draw('Calendar', { month: '2026-08', value: '2026-08-14' });
    focus(tabStop(container)[0]);
    press('Home');
    expect(at(document.activeElement)).toBe('August 10, 2026'); // that week's Monday
    press('End');
    expect(at(document.activeElement)).toBe('August 16, 2026'); // that week's Sunday
  });

  it('a consumed key stops at the grid; an edge key goes back to the host', () => {
    const { container } = draw('Calendar', { month: '2026-08', value: '2026-08-01' });
    focus(tabStop(container)[0]);
    const seen: string[] = [];
    const onHostKey = (e: Event): void => {
      seen.push((e as KeyboardEvent).key);
    };
    document.addEventListener('keydown', onHostKey);
    try {
      // 1 Aug 2026 is a Saturday: ArrowUp runs off the top of the month.
      press('ArrowUp');
      expect(at(document.activeElement)).toBe('August 1, 2026');
      expect(seen).toEqual(['ArrowUp']);
      seen.length = 0;
      press('ArrowRight');
      expect(at(document.activeElement)).toBe('August 2, 2026');
      expect(seen).toEqual([]);
    } finally {
      document.removeEventListener('keydown', onHostKey);
    }
  });

  it('out-of-range days are stepped over, and the stop never parks on one', () => {
    // `value` seeds the month (Aug 2026) and would normally be the anchor, but
    // min cuts the month at the 10th, so the 5th is a disabled <button> that
    // cannot take focus. Anchoring there would have taken the whole grid out of
    // the tab order; the stop falls through to the first OPERABLE day instead.
    const { container } = draw('DatePicker', { mode: 'inline', value: '2026-08-05', min: '2026-08-10' });
    expect(tabStop(container).length).toBe(1);
    expect(at(tabStop(container)[0])).toBe('August 10, 2026');
    focus(tabStop(container)[0]);
    // Every day left of the 10th is out of range → the walk runs off the month
    // and the key goes back to the host rather than landing on the 9th.
    press('ArrowLeft');
    expect(at(document.activeElement)).toBe('August 10, 2026');
    press('Home'); // Mon 10 – Sun 16 is the row; its first OPERABLE day is the 10th
    expect(at(document.activeElement)).toBe('August 10, 2026');
    press('ArrowUp'); // -7 = the 3rd, out of range → keeps walking off the month
    expect(at(document.activeElement)).toBe('August 10, 2026');
    press('ArrowRight');
    expect(at(document.activeElement)).toBe('August 11, 2026');
  });

  it('paging the month re-homes the stop instead of stranding it on a gone day', () => {
    const { container } = draw('Calendar', { month: '2026-08', value: '2026-08-14' });
    focus(tabStop(container)[0]);
    press('ArrowRight');
    expect(at(tabStop(container)[0])).toBe('August 15, 2026');
    fireEvent.click(container.querySelector('[aria-label="Next month"]')!);
    // September has no 2026-08-15; exactly one stop still exists.
    expect(tabStop(container).length).toBe(1);
    expect(at(tabStop(container)[0])).toBe('September 1, 2026');
  });
});

describe('PermissionMatrix — header bulk controls meet the 24px target floor', () => {
  /* WCAG 2.5.8. A bare <button> around header text is only as tall as its line
   * box (16px for the text-xs column header, 20px for the text-sm row header);
   * the <th>'s own padding is not clickable and does not count. The audit's
   * target rule exempts inline targets constrained by a line box, so it does not
   * report these — the criterion still applies, because a column header is the
   * sole content of its cell, not a target sitting inside a sentence. */
  it('both bulk buttons carry the min-h-6 floor', () => {
    const { container } = render(
      <FraymeRenderer spec={one('PermissionMatrix', {})} mode="progressive" />,
    );
    const bulk = Array.from(container.querySelectorAll('th button'));
    expect(bulk.length).toBe(3 + 4); // 3 role rows + 4 capability columns
    for (const b of bulk) {
      expect(b.className).toContain('min-h-6');
      expect(b.className).toContain('min-w-6');
      // inline-flex, so min-height actually applies (a plain inline box ignores it).
      expect(b.className).toContain('inline-flex');
    }
  });

  /* Audit rule (thNoScope). The row headers already declared scope="row"; the
   * column axis — the capability headers and the corner cell that heads the role
   * column — declared nothing, so every header cell on that axis was ambiguous
   * to the table model. Measured on the demo matrix: 5 of 8 <th> without scope. */
  it('every header cell declares its scope', () => {
    const { container } = render(
      <FraymeRenderer spec={one('PermissionMatrix', {})} mode="progressive" />,
    );
    const ths = Array.from(container.querySelectorAll('th'));
    expect(ths.length).toBe(1 + 4 + 3); // corner + 4 capabilities + 3 roles
    expect(ths.filter((t) => !t.hasAttribute('scope')).length).toBe(0);
    expect(ths.filter((t) => t.getAttribute('scope') === 'col').length).toBe(5);
    expect(ths.filter((t) => t.getAttribute('scope') === 'row').length).toBe(3);
  });
});
