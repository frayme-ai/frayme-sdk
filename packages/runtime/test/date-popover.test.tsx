/**
 * DatePicker / DateRangePicker popover behaviour.
 *
 * Before this: neither picker had any open/close concept — the month grid was
 * rendered unconditionally and the "field" was a plain <div> with input borders
 * (no role, no tabindex, no cursor), so it advertised a picker that was already
 * open and keyboard users could not reach it at all. The visible month was
 * useState(seed) — initial state only — so the grid could show August while the
 * value said September.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);
const trigger = (c: HTMLElement) => c.querySelector('button[aria-haspopup="dialog"]')!;
const grid = (c: HTMLElement) => c.querySelector('[role="gridcell"]');

describe('date pickers — popover is the default mode', () => {
  for (const type of ['DatePicker', 'DateRangePicker'] as const) {
    it(`${type}: closed by default; the field is a real button with the dialog contract`, () => {
      const { container } = draw(type, { value: '2026-09-18', startValue: '2026-09-18' });
      const t = trigger(container);
      expect(t).not.toBeNull();
      expect(t.tagName).toBe('BUTTON');
      expect(t.getAttribute('aria-expanded')).toBe('false');
      expect(grid(container)).toBeNull();
    });

    it(`${type}: click opens, a second click closes`, () => {
      const { container } = draw(type, {});
      fireEvent.click(trigger(container));
      expect(trigger(container).getAttribute('aria-expanded')).toBe('true');
      expect(grid(container)).not.toBeNull();
      fireEvent.click(trigger(container));
      expect(grid(container)).toBeNull();
    });

    it(`${type}: ArrowDown opens the panel from the closed trigger`, () => {
      const { container } = draw(type, {});
      fireEvent.keyDown(trigger(container), { key: 'ArrowDown' });
      expect(grid(container)).not.toBeNull();
    });

    it(`${type}: Escape closes and returns focus to the trigger`, () => {
      const { container } = draw(type, {});
      fireEvent.click(trigger(container));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(grid(container)).toBeNull();
      expect(document.activeElement).toBe(trigger(container));
    });

    it(`${type}: a pointerdown outside the wrapper closes it`, () => {
      const { container } = draw(type, {});
      fireEvent.click(trigger(container));
      fireEvent.pointerDown(document.body);
      expect(grid(container)).toBeNull();
    });

    it(`${type}: mode:'inline' keeps the grid visible with no trigger button`, () => {
      const { container } = draw(type, { mode: 'inline' });
      expect(container.querySelector('button[aria-haspopup="dialog"]')).toBeNull();
      expect(grid(container)).not.toBeNull();
    });
  }

  it('DatePicker: picking a day closes the popover (selection complete)', () => {
    const { container } = draw('DatePicker', { value: '2026-09-18' });
    fireEvent.click(trigger(container));
    const day = [...container.querySelectorAll('[role="gridcell"]')].find((el) => !el.hasAttribute('disabled'))!;
    fireEvent.click(day);
    expect(grid(container)).toBeNull();
  });

  it('DateRangePicker: the FIRST pick keeps it open, the second (range complete) closes it', () => {
    const { container } = draw('DateRangePicker', {});
    fireEvent.click(trigger(container));
    const days = () => [...container.querySelectorAll('[role="gridcell"]')].filter((el) => !el.hasAttribute('disabled'));
    fireEvent.click(days()[4]);
    expect(grid(container)).not.toBeNull();
    fireEvent.click(days()[8]);
    expect(grid(container)).toBeNull();
  });

  it('DateRangePicker: a preset lands a complete range and closes', () => {
    const { container } = draw('DateRangePicker', {
      presets: [{ label: 'Trip', start: '2026-09-18', end: '2026-09-21' }],
    });
    fireEvent.click(trigger(container));
    fireEvent.click(container.querySelector('[role="group"][aria-label="Quick ranges"] button')!);
    expect(grid(container)).toBeNull();
  });
});

describe('date pickers — the displayed month DERIVES from the value', () => {
  // Driven the way it actually fails in the wild: TWO pickers bound to one
  // state key. Page picker A to another month and pick a day there — the bound
  // value moves, and picker B (never touched) must re-derive its month. Under
  // the old useState(seed) B stayed on the mount month, which is exactly the
  // "August grid, September value" bug. A rerender cannot drive
  // this: the store initializes from spec.state once.
  const twoUp = (
    type: string,
    key: string,
    valueProp: string,
    seedDate: string,
    extra: { props?: Record<string, unknown>; state?: Record<string, unknown> } = {},
  ): Spec =>
    ({
      root: 'row',
      elements: {
        row: { type: 'Stack', props: {}, children: ['a', 'b'] },
        a: { type, props: { [valueProp]: { $bindState: key }, mode: 'inline', ...extra.props } },
        b: { type, props: { [valueProp]: { $bindState: key }, mode: 'inline', ...extra.props } },
      },
      state: { [key]: seedDate, ...extra.state },
    }) as unknown as Spec;
  const monthTitles = (c: HTMLElement) =>
    [...c.querySelectorAll('[role="gridcell"]')].map((cell) => cell.getAttribute('aria-label') ?? '');

  it('DatePicker: a bound value change re-derives the month (not initial-state-only)', () => {
    const { container } = render(<FraymeRenderer spec={twoUp('DatePicker', 'd', 'value', '2026-08-03')} mode="progressive" />);
    expect(container.textContent).toContain('August 2026');
    // page picker A forward, then pick a day in the new month
    const pickerA = container.querySelectorAll('.frayme-root > * > *')[0] as HTMLElement;
    fireEvent.click(pickerA.querySelectorAll('button')[1]); // A's next chevron
    const septDay = [...pickerA.querySelectorAll('[role="gridcell"]')].find(
      (el) => !el.hasAttribute('disabled') && (el.getAttribute('aria-label') ?? '').includes('September'),
    )!;
    fireEvent.click(septDay);
    // picker B never paged: its month must follow the new bound value
    const pickerB = container.querySelectorAll('.frayme-root > * > *')[1] as HTMLElement;
    expect(pickerB.textContent).toContain('September 2026');
    expect(pickerB.textContent).not.toContain('August 2026');
  });

  it('DateRangePicker: same — the grid follows the bound range, no stale month', () => {
    // seed a COMPLETE range so the next click starts a fresh range (with only
    // a start set, the click would set `end` and the derived month correctly
    // stays put). Fully seeded → no wall-clock dependency.
    const { container } = render(
      <FraymeRenderer
        spec={twoUp('DateRangePicker', 's', 'startValue', '2026-08-03', {
          props: { endValue: { $bindState: 'e' } },
          state: { e: '2026-08-05' },
        })}
        mode="progressive"
      />,
    );
    const pickerA = container.querySelectorAll('.frayme-root > * > *')[0] as HTMLElement;
    fireEvent.click(pickerA.querySelectorAll('button')[1]);
    const septDay = [...pickerA.querySelectorAll('[role="gridcell"]')].find(
      (el) => !el.hasAttribute('disabled') && (el.getAttribute('aria-label') ?? '').includes('September'),
    )!;
    fireEvent.click(septDay);
    const pickerB = container.querySelectorAll('.frayme-root > * > *')[1] as HTMLElement;
    expect(pickerB.textContent).toContain('September 2026');
  });

  it('chevron paging still overrides the derived month until the value moves again', () => {
    const { container } = render(<FraymeRenderer spec={twoUp('DatePicker', 'd', 'value', '2026-08-03')} mode="progressive" />);
    const pickerA = container.querySelectorAll('.frayme-root > * > *')[0] as HTMLElement;
    fireEvent.click(pickerA.querySelectorAll('button')[1]);
    // paging alone moves only the pager, and its cells really are next month's
    expect(pickerA.textContent).toContain('September 2026');
    expect(monthTitles(pickerA).some((l) => l.includes('September'))).toBe(true);
  });
});

describe('DateRangePicker — inline layout starts the field and the grid on one line', () => {
  it('field and presets stack in a left column; the month grid is their SIBLING', () => {
    const { container } = draw('DateRangePicker', {
      mode: 'inline',
      presets: [{ label: 'Trip', start: '2026-09-18', end: '2026-09-21' }],
    });
    const presets = container.querySelector('[role="group"][aria-label="Quick ranges"]')!;
    const leftCol = presets.parentElement!;
    // the field lives in the same column as the presets, above them
    expect(leftCol.querySelector('[class*="fr-cal-border"]')).not.toBeNull();
    expect(leftCol.querySelector('[role="gridcell"]')).toBeNull();
    // the grid sits BESIDE that column, so both start at the same top line
    const row = leftCol.parentElement!;
    expect(row.className).toContain('items-start');
    expect(row.querySelector('[role="gridcell"]')).not.toBeNull();
  });

  it('wraps instead of using a viewport breakpoint — a host panel is not the viewport', () => {
    const { container } = draw('DateRangePicker', {
      mode: 'inline',
      presets: [{ label: 'Trip', start: '2026-09-18', end: '2026-09-21' }],
    });
    const row = container.querySelector('[role="group"][aria-label="Quick ranges"]')!.parentElement!.parentElement!;
    expect(row.className).toContain('flex-wrap');
    expect(row.className).not.toContain('sm:');
  });
});
