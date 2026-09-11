/**
 * Unified chart hover/tooltip affordances for charts.tsx:
 * AreaChart · BarChart · LineChart · DonutChart · Sparkline.
 *
 * The system is PORTED from charts-proportion.tsx (MARK_POP_CENTER /
 * MARK_POP_SELF, motion-safe-gated, cursor-pointer) + charts-radial.tsx
 * (filter-only hover:brightness-110 for wide/full-width marks that would
 * distort under a transform pop, esp. preserveAspectRatio="none").
 *
 * Per chart we assert the two contract halves:
 *   (a) a native <title> (or the HTML `title` attribute for the div-based
 *       BarChart) exists with the expected 'label — value' text, and
 *   (b) the mark carries cursor-pointer plus the right affordance class
 *       (MARK_POP_* or hover:brightness-110 — never an un-gated transform).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

/** class attr reader that is safe for SVG elements (className is an
 *  SVGAnimatedString there — getAttribute sidesteps it). */
const cls = (el: Element): string => el.getAttribute('class') ?? '';

/* The ported constants' load-bearing tokens (kept in sync with the file-local
 * MARK_POP_CENTER / MARK_POP_SELF in charts.tsx / charts-proportion.tsx). */
const MARK_POP_CENTER_BITS = [
  'cursor-pointer',
  'motion-safe:hover:scale-105',
  '[transform-box:view-box]',
  '[transform-origin:50%_50%]',
];
const MARK_POP_SELF_BITS = [
  'cursor-pointer',
  'motion-safe:hover:scale-[1.05]',
  '[transform-box:fill-box]',
  '[transform-origin:center]',
];

/* ── AreaChart — the filled band is the per-series hover target ────────────── */

describe('AreaChart — per-series <title> + brightness on the filled band', () => {
  it('the area path carries "name — min, max, last" and cursor-pointer + hover:brightness-110 (never a transform pop)', () => {
    const { container } = draw('AreaChart', { series: [{ name: 'Revenue', points: [1, 5, 3] }] });
    const titles = container.querySelectorAll('svg title');
    expect(titles.length).toBe(1);
    expect(titles[0].textContent).toBe('Revenue — min 1, max 5, last 3');
    const mark = titles[0].parentElement!;
    expect(mark.tagName.toLowerCase()).toBe('path');
    expect(cls(mark)).toContain('cursor-pointer');
    expect(cls(mark)).toContain('hover:brightness-110');
    // full-width band under preserveAspectRatio="none" → brightness ONLY
    expect(cls(mark)).not.toContain('scale');
  });

  it('multi-series: one <title> per series band', () => {
    const { container } = draw('AreaChart', {
      series: [
        { name: 'A', points: [1, 2] },
        { name: 'B', points: [3, 4] },
      ],
    });
    const texts = Array.from(container.querySelectorAll('svg title')).map((t) => t.textContent);
    expect(texts).toEqual(['A — min 1, max 2, last 2', 'B — min 3, max 4, last 4']);
  });
});

/* ── LineChart — polyline per-series + MARK_POP_SELF dots ──────────────────── */

describe('LineChart — series polyline <title> + MARK_POP_SELF dots', () => {
  it('the stroke path carries the per-series <title> + brightness; each dot gets MARK_POP_SELF + "name — value"', () => {
    const { container } = draw('LineChart', { series: [{ name: 'Load', points: [2, 4] }] });
    const titleEls = Array.from(container.querySelectorAll('svg title'));
    const texts = titleEls.map((t) => t.textContent);
    expect(texts).toContain('Load — min 2, max 4, last 4');
    expect(texts).toContain('Load — 2');
    expect(texts).toContain('Load — 4');
    expect(titleEls.length).toBe(3); // 1 series + 2 dots

    // (b) the polyline: cursor + brightness, no transform pop (pAR="none")
    const seriesTitle = titleEls.find((t) => t.textContent!.includes('min'))!;
    const path = seriesTitle.parentElement!;
    expect(path.tagName.toLowerCase()).toBe('path');
    expect(cls(path)).toContain('cursor-pointer');
    expect(cls(path)).toContain('hover:brightness-110');
    expect(cls(path)).not.toContain('scale');

    // (b) the dots: the in-place pop, motion-safe-gated
    const dots = Array.from(container.querySelectorAll('svg circle'));
    expect(dots.length).toBe(2);
    for (const dot of dots) for (const bit of MARK_POP_SELF_BITS) expect(cls(dot)).toContain(bit);
    expect(dots[0].querySelector('title')!.textContent).toBe('Load — 2');
    expect(dots[1].querySelector('title')!.textContent).toBe('Load — 4');
  });

  it('unnamed series falls back to "Series N" in the tooltip', () => {
    const { container } = draw('LineChart', { series: [{ points: [7] }] });
    const texts = Array.from(container.querySelectorAll('svg title')).map((t) => t.textContent);
    expect(texts).toContain('Series 1 — min 7, max 7, last 7');
    expect(texts).toContain('Series 1 — 7');
  });
});

/* ── BarChart — HTML div bars: title ATTRIBUTE + brightness ────────────────── */

describe('BarChart — bar divs carry title="label — value" + brightness (transition-all preserved)', () => {
  it('vertical: title attr, cursor-pointer + hover:brightness-110, and transition-all SURVIVES (tw-merge guard)', () => {
    const { container } = draw('BarChart', {
      data: [
        { label: 'Q1', value: 10 },
        { label: 'Q2', value: 20 },
      ],
    });
    const bar = container.querySelector('[title="Q1 — 10"]')!;
    expect(bar).not.toBeNull();
    expect(bar.classList.contains('cursor-pointer')).toBe(true);
    expect(bar.classList.contains('hover:brightness-110')).toBe(true);
    // the resting size animation must survive the merge (transition-transform
    // from MARK_POP_* would have tw-merge-dropped it — the trap we avoid)
    expect(bar.classList.contains('transition-all')).toBe(true);
    // wide packed bars: brightness only, never a transform pop
    expect(cls(bar)).not.toContain('scale');
    expect(container.querySelector('[title="Q2 — 20"]')).not.toBeNull();
  });

  it('horizontal layout: the same affordance on the horizontal bar', () => {
    const { container } = draw('BarChart', { layout: 'horizontal', data: [{ label: 'Q1', value: 10 }] });
    const bar = container.querySelector('[title="Q1 — 10"]')!;
    expect(bar).not.toBeNull();
    expect(bar.classList.contains('cursor-pointer')).toBe(true);
    expect(bar.classList.contains('hover:brightness-110')).toBe(true);
    expect(bar.classList.contains('transition-all')).toBe(true);
  });
});

/* ── DonutChart — segments pop from the viewBox centre ─────────────────────── */

describe('DonutChart — MARK_POP_CENTER segments + "label — value (pct%)" titles', () => {
  it('each segment circle carries MARK_POP_CENTER + its <title>; the track ring stays inert', () => {
    const { container } = draw('DonutChart', {
      data: [
        { label: 'A', value: 3 },
        { label: 'B', value: 1 },
      ],
    });
    const circles = Array.from(container.querySelectorAll('svg circle'));
    expect(circles.length).toBe(3); // 1 track + 2 segments
    const [track, ...segs] = circles;
    // the track is chrome, not a data mark — no affordance, no tooltip
    expect(cls(track)).toBe('');
    expect(track.querySelector('title')).toBeNull();
    for (const seg of segs) for (const bit of MARK_POP_CENTER_BITS) expect(cls(seg)).toContain(bit);
    expect(segs[0].querySelector('title')!.textContent).toBe('A — 3 (75%)');
    expect(segs[1].querySelector('title')!.textContent).toBe('B — 1 (25%)');
  });
});

/* ── Sparkline — one svg-level summary tooltip ─────────────────────────────── */

describe('Sparkline — a single svg <title> summarising min/max/last', () => {
  it('exactly ONE <title> ("N points — min, max, last"); the svg carries cursor-pointer + brightness only', () => {
    const { container } = draw('Sparkline', { points: [1, 9, 4] });
    const svg = container.querySelector('svg')!;
    const titles = svg.querySelectorAll('title');
    expect(titles.length).toBe(1);
    expect(titles[0].textContent).toBe('3 points — min 1, max 9, last 4');
    expect(cls(svg)).toContain('cursor-pointer');
    expect(cls(svg)).toContain('hover:brightness-110');
    // preserveAspectRatio="none" → never a transform pop
    expect(cls(svg)).not.toContain('scale');
  });

  it('bar-type sparkline: still ONE svg-level title, no per-rect marks', () => {
    const { container } = draw('Sparkline', { type: 'bar', points: [2, 6] });
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('title').length).toBe(1);
    expect(svg.querySelector('title')!.textContent).toBe('2 points — min 2, max 6, last 6');
    const rects = Array.from(svg.querySelectorAll('rect'));
    expect(rects.length).toBe(2);
    for (const r of rects) expect(r.querySelector('title')).toBeNull();
  });
});

/* ── motion-safe conformance — every transform pop is gated ────────────────── */

describe('motion-safe conformance across all five charts', () => {
  it('no un-gated hover:scale anywhere in the rendered output', () => {
    const specs: Array<[string, Record<string, unknown>]> = [
      ['AreaChart', { series: [{ name: 'A', points: [1, 2] }] }],
      ['LineChart', { series: [{ name: 'L', points: [1, 2] }] }],
      ['BarChart', { data: [{ label: 'Q', value: 1 }] }],
      ['DonutChart', { data: [{ label: 'A', value: 1 }] }],
      ['Sparkline', { points: [1, 2] }],
    ];
    for (const [type, props] of specs) {
      const { container } = draw(type, props);
      for (const el of Array.from(container.querySelectorAll('*'))) {
        const c = el.getAttribute('class') ?? '';
        // strip the gated form; any hover:scale left over is an un-gated pop
        expect(c.replace(/motion-safe:hover:scale-\S+/g, '')).not.toMatch(/hover:scale/);
      }
    }
  });
});
