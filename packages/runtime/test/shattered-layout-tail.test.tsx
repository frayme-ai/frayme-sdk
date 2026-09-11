/**
 * SHATTERED TEXT + panel ink — the layout tail:
 * inputs-overlay.tsx (FileUpload) · data-display.tsx (Table) · ai-content.tsx (DiffView).
 *
 * THE RULE, verbatim from the render audit:
 *
 *     r.width < fs * 3 && r.height / (fs * 1.2) > 3
 *
 * a text leaf narrower than three of its own characters while taller than three
 * lines. Measured on a real Chromium at a 320px viewport, spec shaped the way
 * generated specs actually shape one — a padded root holding a Card holding the component:
 *
 *   FileUpload  row 148px → name  20px × 300px  (17.9 lines)  fs 14, threshold 42
 *   Table       (size:sm, CJK)   33px × 341px  (21.8 lines)  fs 13, threshold 39
 *
 * Both are the SAME defect wearing different clothes: something that should have
 * had a width floor did not, so the last flexible box absorbed all the narrowing.
 *
 *   · FileUpload — every sibling in the row is shrink-0, so the name is the only
 *     item that can yield and it yields everything. `min-w-0` let it yield to
 *     nothing; the fix is the same override with a floor (10ch) plus `flex-wrap`,
 *     so the metadata drops to a second line instead of the name overflowing.
 *   · Table — auto table layout hands a squeezed table each column's MIN-CONTENT
 *     width. `break-words` (overflow-wrap:break-word) does not lower min-content,
 *     which is why Latin tables measure clean: the longest word holds the column
 *     open and the wrapper's overflow-x-auto takes the strain. Text that breaks
 *     between every character has no such floor, so the column collapsed to one
 *     glyph and the wrapper — sitting at 214px client / 217px scroll — never
 *     scrolled at all. A 5ch cell floor puts the missing stop back.
 *
 * WHY THIS FILE COMPUTES RATHER THAN GREPS. jsdom has no layout, so it cannot
 * re-measure the boxes above. What it CAN do is evaluate the audit's inequality
 * against the floor the component actually declares — so `min-w-[2ch]`, or a
 * font-size step raised without the floor, fails here rather than in the next
 * render audit. The ch→px step uses a deliberately conservative 1ch >= 0.5em
 * (system-ui's "0" advance is ~0.55em, and every font this stylesheet ships is
 * wider still), which makes the assertion a lower bound on the real width.
 *
 * The last describe is the OVER-APPLICATION guard, and it is not decoration: the
 * neighbouring defect in this same file is `currentColor` applied where it does
 * not belong. DiffView's <figure> paints its own opaque `bg-card`, so its body
 * span — written `[color:inherit]` — took a spec's authored `Card { color:
 * "#e2e6f0" }` ink onto the panel's own white fill and measured 1.25:1, while the
 * caption two elements above it read 17.72:1. The code in a code diff was the one
 * thing on the panel you could not read. Any change that "fixes contrast" by
 * sweeping currentColor across Artifact/WebPreview/DiffView reintroduces exactly
 * that, so those three are pinned to the token here.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* ── the audit's own inequality, in px ─────────────────────────────────────── */

/** The width below which the audit calls a >3-line leaf shattered. */
const shatterFloorPx = (fontSizePx: number): number => fontSizePx * 3;

/** Conservative lower bound for a `ch` length — see the header. */
const CH_PER_EM = 0.5;

/** Tailwind spacing steps used by the cells/rows below, in px (1 step = 0.25rem). */
const step = (n: number): number => n * 4;

/* ── reading the declared floor off the rendered element ───────────────────── */

/** The px width `min-w-[…]` guarantees this element, given its font-size.
 *  Returns 0 when no arbitrary min-width class is present — which is the case
 *  the audit found, and which every assertion below is written to reject. */
function declaredMinWidthPx(el: Element, fontSizePx: number): number {
  const m = /(?:^|\s)min-w-\[([0-9.]+)(ch|rem|px)\]/.exec(el.className);
  if (!m) return 0;
  const n = Number(m[1]);
  if (m[2] === 'px') return n;
  if (m[2] === 'rem') return n * 16;
  return n * fontSizePx * CH_PER_EM;
}

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const has = (el: Element, cls: string): boolean => el.className.split(/\s+/).includes(cls);

/* ── FileUpload — inputs-overlay.tsx ───────────────────────────────────────── */

describe('FileUpload file row — the name has a floor, and the row can wrap to honour it', () => {
  const FILES = [{ name: 'burst-pipe-kitchen-2026-08-01.pdf', size: '2.4MB', status: 'done' }];
  // The row inherits the zone's `text-sm` (0.875rem = 14px); the measured leaf
  // reported fs 14, so the threshold the audit applied was 42px.
  const ROW_FS = 14;

  const nameSpan = (container: HTMLElement): Element => {
    const el = container.querySelector('li div span.break-words');
    expect(el, 'the filename leaf should still be a break-words span').not.toBeNull();
    return el!;
  };

  it('the filename floor clears the audit threshold (3 x font-size)', () => {
    const { container } = draw('FileUpload', { label: 'Attach', multiple: true, files: FILES });
    const name = nameSpan(container);
    const floor = declaredMinWidthPx(name, ROW_FS);
    expect(
      floor,
      `filename declares ${floor}px of floor; the audit shatters below ${shatterFloorPx(ROW_FS)}px`,
    ).toBeGreaterThan(shatterFloorPx(ROW_FS));
  });

  it('the floor is an override of flex min-width:auto, not a removal of it', () => {
    // `min-width:auto` on a flex item is min-content — the whole filename as one
    // unbreakable box — which overflows the card instead of wrapping. An explicit
    // min-width is what defeats it; `0` and `10ch` both do, `none` does not.
    const { container } = draw('FileUpload', { label: 'Attach', multiple: true, files: FILES });
    expect(/min-w-\[/.test(nameSpan(container).className)).toBe(true);
  });

  it('the name still WRAPS — the floor must not have been bought with truncation', () => {
    // The two ways to make a narrow box stop shattering that this codebase has
    // already tried and rejected: hide the tail, or stop wrapping.
    const { container } = draw('FileUpload', { label: 'Attach', multiple: true, files: FILES });
    const name = nameSpan(container);
    expect(has(name, 'break-words')).toBe(true);
    expect(has(name, 'truncate')).toBe(false);
    expect(name.className).not.toMatch(/\bline-clamp-/);
  });

  it('the row wraps, so the floor cannot be paid for in overflow', () => {
    // Measured both ways at a 320px viewport. Rigid row: name 20px, section
    // overflow 41-72px across the narrow widths. Wrapping row with the floor: no
    // shattered leaf, and overflow FELL at every width (41->1, 61->21, 72->41),
    // because the metadata has somewhere to go.
    const { container } = draw('FileUpload', { label: 'Attach', multiple: true, files: FILES });
    const row = container.querySelector('li div')!;
    expect(has(row, 'flex')).toBe(true);
    expect(has(row, 'flex-wrap')).toBe(true);
  });

  it('the name is still the item that grows — the floor caps yielding, not use', () => {
    const { container } = draw('FileUpload', { label: 'Attach', multiple: true, files: FILES });
    expect(has(nameSpan(container), 'flex-1')).toBe(true);
  });
});

/* ── Table — data-display.tsx ──────────────────────────────────────────────── */

describe('Table cells — a min-content floor for text that breaks between glyphs', () => {
  // size → [font-size px (tableBase), horizontal padding px (tableCell/tableHead)]
  const SIZES: Array<[string, number, number]> = [
    ['sm', 13, step(2.5) * 2],
    ['md', 14, step(3) * 2],
    ['lg', 16, step(4) * 2],
  ];

  for (const [size, fs, padX] of SIZES) {
    it(`size=${size}: cell border box clears 3 x ${fs}px even at min-content`, () => {
      const { container } = draw('Table', {
        size,
        columns: ['受付番号', 'タイトル'],
        rows: [['R-1', '受付申請元タイトル希望掲載日担当者']],
      });
      for (const cell of [container.querySelector('th')!, container.querySelector('td')!]) {
        // getBoundingClientRect covers the padding box, which is what the audit
        // measured, so the padding counts toward clearing the threshold.
        const box = declaredMinWidthPx(cell, fs) + padX;
        expect(
          box,
          `${cell.tagName} floor ${box}px vs shatter threshold ${shatterFloorPx(fs)}px`,
        ).toBeGreaterThan(shatterFloorPx(fs));
      }
    });
  }

  it('the floor is on the cells, where column min-width is decided', () => {
    // Auto table layout takes a column's minimum from its CELLS. A min-width on
    // the <table> would set the whole table's floor and force a scroll on a
    // two-column table that never needed one.
    const { container } = draw('Table', { columns: ['A', 'B'], rows: [['1', '2']] });
    expect(/min-w-\[/.test(container.querySelector('table')!.className)).toBe(false);
    expect(/min-w-\[/.test(container.querySelector('td')!.className)).toBe(true);
    expect(/min-w-\[/.test(container.querySelector('th')!.className)).toBe(true);
  });

  it('the scroll wrapper is still there to absorb the widened min-content', () => {
    // The floor only helps because the table is allowed to exceed its container
    // and the wrapper scrolls. Take the wrapper away and the floor becomes page
    // overflow, which is the trade this fix exists to avoid.
    const { container } = draw('Table', { columns: ['A', 'B'], rows: [['1', '2']] });
    const wrap = container.querySelector('table')!.parentElement!;
    expect(has(wrap, 'overflow-x-auto')).toBe(true);
  });

  it('cells still wrap — the floor is not truncation in disguise', () => {
    const { container } = draw('Table', { columns: ['A'], rows: [['one two three']] });
    const td = container.querySelector('td')!;
    expect(has(td, 'break-words')).toBe(true);
    expect(has(td, 'truncate')).toBe(false);
  });

  it('an out-of-enum `align` still gets the floor (cva drops its default there)', () => {
    // The shape the audit reported carried no text-* alignment class,
    // which is cva's documented behaviour when a supplied value matches no
    // variant key: the defaultVariant is skipped. The floor lives in the cva
    // BASE precisely so that path keeps it.
    const { container } = draw('Table', {
      align: 'start',
      columns: ['A'],
      rows: [['受付申請元タイトル希望掲載日担当者']],
    });
    const td = container.querySelector('td')!;
    expect(td.className).not.toMatch(/\btext-(left|center|right)\b/);
    expect(/min-w-\[/.test(td.className)).toBe(true);
  });
});

/* ── OVER-APPLICATION — the same rule pointing the other way ───────────────── */

describe('panels that paint their own fill keep the token — currentColor is the bug here', () => {
  /** The colour source an element sets, if any. */
  const inkOf = (el: Element): string | null => {
    for (const c of el.className.split(/\s+/)) {
      const m = /^text-\[color:(.+)\]$/.exec(c) ?? /^\[color:(.+)\]$/.exec(c);
      if (m) return m[1];
      if (c === 'text-foreground') return 'var(--color-foreground)';
      if (c === 'text-current') return 'currentColor';
    }
    return null;
  };

  it('DiffView body text sets the token, NOT inherit/currentColor', () => {
    // The regression this replaces: `[color:inherit]` measured 1.25:1 inside a
    // spec's `Card { bg:"#12161f", color:"#e2e6f0" }` — near-white ink on the
    // figure's OWN white bg-card — while the caption beside it read 17.72:1.
    const { container } = draw('DiffView', {
      filename: 'pricing.ts',
      mode: 'unified',
      before: 'const a = 1;',
      after: 'const a = 2;',
    });
    const body = [...container.querySelectorAll('span')].find((s) =>
      has(s, 'whitespace-pre'),
    )!;
    expect(body, 'the diff body span').toBeTruthy();
    expect(inkOf(body)).toBe('var(--color-foreground)');
    expect(inkOf(body)).not.toBe('currentColor');
    expect(inkOf(body)).not.toBe('inherit');
  });

  it('DiffView body agrees with its own caption', () => {
    // Both sit on the same self-painted surface, so they must resolve the same
    // way. This is the assertion that catches "fix the caption, forget the body"
    // as well as the reverse.
    const { container } = draw('DiffView', {
      filename: 'pricing.ts',
      mode: 'unified',
      before: 'a',
      after: 'b',
    });
    const caption = container.querySelector('figcaption span.break-words')!;
    const body = [...container.querySelectorAll('span')].find((s) => has(s, 'whitespace-pre'))!;
    expect(inkOf(body)).toBe(inkOf(caption));
  });

  for (const [type, props, sel] of [
    ['Artifact', { title: 'pricing.ts', kind: 'code', content: 'const a = 1;' }, 'figcaption span.break-words'],
    ['WebPreview', { title: 'Ofgem price cap', url: 'https://www.ofgem.gov.uk/a' }, 'span.break-words'],
  ] as const) {
    it(`${type} title KEEPS its --color-foreground fallback — it paints bg-card itself`, () => {
      // Measured inside the same authored dark Card, these read 17.72:1 exactly
      // BECAUSE they do not inherit. Swapping in currentColor here would take
      // them to 1.25:1, which is the defect above, re-created.
      const { container } = draw(type, props as Record<string, unknown>);
      const title = container.querySelector(sel)!;
      expect(inkOf(title)).toMatch(/var\(--color-foreground\)\)?$/);
      expect(inkOf(title)).not.toMatch(/currentColor/);
    });
  }
});
