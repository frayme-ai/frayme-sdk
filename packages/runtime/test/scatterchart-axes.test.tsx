/**
 * ScatterChart / value axes (the sibling of test/barchart-axes.test.tsx).
 * Without axis titles and a nice-scale domain, both measures are anonymous
 * columns of numbers like 0.37 · 4.81 · 9.25.
 *
 * The contract these lock in:
 *   • xAxisTitle / yAxisTitle render when set — on scatter BOTH axes are
 *     measures, so a title is the only thing that ever names them.
 *   • Both axes resolve through `niceScale`, and the DOTS are plotted against
 *     that same domain: the position a tick labels is where its value actually
 *     lands. A tick column that does not share the marks' scale is worse than no
 *     axis at all (same principle as BarChart).
 *   • The gridlines are the tick rows/columns — one rule per tick, never a 4×6
 *     grid drawn over a 5×4 domain.
 *   • showYAxis:false drops the tick column (and the gutter it reserved) but
 *     keeps the titles.
 *   • A props-less ScatterChart renders BYTE-IDENTICALLY to one with the new
 *     props set to null.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'ScatterChart', props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

/* x 5-37 → nice domain 0-40 (rows 4); y 120-940 → nice domain 0-1000 (rows 5).
 * Both raw maxima sit INSIDE their nice max, so a dot pinned to 100% would be
 * the lie this suite exists to catch. */
const SERIES = [
  {
    name: 'Cohort A',
    points: [
      { x: 5, y: 120 },
      { x: 22, y: 640 },
      { x: 37, y: 940 },
    ],
  },
];

const yTicks = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('div.w-7 > span')];
const xTicks = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('div.h-4 span')];
/** The plotted points — the only spans carrying a `title` (their (x, y) readout). */
const dots = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('span[title]')];
const pct = (v: string) => parseFloat(v);

describe('ScatterChart value axes', () => {
  it('renders xAxisTitle and yAxisTitle when set', () => {
    const c = draw({ series: SERIES, xAxisTitle: 'Weeks since signup', yAxisTitle: 'Sessions per week' });
    expect(c.textContent).toContain('Weeks since signup');
    expect(c.textContent).toContain('Sessions per week');
  });

  it('y ticks are nice and compact — 120-940 reads 0…1k, not the raw extremes', () => {
    const c = draw({ series: SERIES });
    const labels = yTicks(c).map((t) => t.textContent);
    expect(labels).toEqual(['1k', '800', '600', '400', '200', '0']);
  });

  it('x ticks are nice — 5-37 reads 0…40, not the raw extremes', () => {
    const c = draw({ series: SERIES });
    expect(xTicks(c).map((t) => t.textContent)).toEqual(['0', '10', '20', '30', '40']);
  });

  it('y: the dots are plotted against the domain the ticks label', () => {
    const c = draw({ series: SERIES });
    const ticks = yTicks(c);
    const top1k = pct(ticks[0].style.top); // where the axis says 1000 is
    const top0 = pct(ticks[ticks.length - 1].style.top); // …and where 0 is
    const highest = Math.min(...dots(c).map((d) => pct(d.style.top))); // y=940
    // 940 must land 94% of the way from the "0" tick to the "1k" tick. Against a
    // raw 120-940 domain it would sit exactly ON the top tick — the classic lie.
    expect(highest).toBeCloseTo(top0 + (940 / 1000) * (top1k - top0), 1);
    expect(highest).toBeGreaterThan(top1k);
  });

  it('x: the dots are plotted against the domain the ticks label', () => {
    const c = draw({ series: SERIES });
    const ticks = xTicks(c);
    const left0 = pct(ticks[0].style.left);
    const left40 = pct(ticks[ticks.length - 1].style.left);
    const rightmost = Math.max(...dots(c).map((d) => pct(d.style.left))); // x=37
    expect(rightmost).toBeCloseTo(left0 + (37 / 40) * (left40 - left0), 1);
    expect(rightmost).toBeLessThan(left40);
  });

  it('one gridline per tick on both axes', () => {
    const c = draw({ series: SERIES });
    const lines = [...c.querySelectorAll('svg line')];
    const horizontal = lines.filter((l) => l.getAttribute('y1') === l.getAttribute('y2'));
    const vertical = lines.filter((l) => l.getAttribute('x1') === l.getAttribute('x2'));
    expect(horizontal.length).toBe(yTicks(c).length);
    expect(vertical.length).toBe(xTicks(c).length);
  });

  it('a fractional domain keeps its precision (rates do not collapse to "0")', () => {
    const c = draw({ series: [{ name: 'Rate', points: [{ x: 1, y: 0.01 }, { x: 2, y: 0.04 }] }] });
    expect(yTicks(c).map((t) => t.textContent)).toEqual(['0.04', '0.03', '0.02', '0.01', '0']);
  });

  it('showYAxis:false suppresses the tick column but keeps the titles', () => {
    const withAxis = draw({ series: SERIES, yAxisTitle: 'Sessions' });
    const without = draw({ series: SERIES, yAxisTitle: 'Sessions', showYAxis: false });
    expect(yTicks(withAxis).length).toBe(6);
    expect(yTicks(without).length).toBe(0);
    expect(without.textContent).toContain('Sessions');
    // the x row is still there, and it reclaims the gutter the ticks vacated
    expect(xTicks(without).length).toBeGreaterThan(0);
    expect(without.querySelector('.pl-0')).not.toBeNull();
    expect(without.querySelector('.pl-7')).toBeNull();
  });

  it('multi-series takes the axis furniture too, legend intact', () => {
    const c = draw({
      series: [
        { name: 'Cohort A', points: [{ x: 1, y: 2 }, { x: 4, y: 9 }] },
        { name: 'Cohort B', points: [{ x: 2, y: 3 }, { x: 6, y: 5 }] },
      ],
      xAxisTitle: 'Tenure (weeks)',
      yAxisTitle: 'Sessions',
    });
    expect(c.textContent).toContain('Tenure (weeks)');
    expect(c.textContent).toContain('Sessions');
    expect(c.textContent).toContain('Cohort B'); // legend survives
  });

  it('a props-less ScatterChart is byte-identical to one with the axis props null', () => {
    const bare = draw({ series: SERIES }).innerHTML;
    const nulled = draw({ series: SERIES, xAxisTitle: null, yAxisTitle: null, showYAxis: null }).innerHTML;
    expect(nulled).toBe(bare);
  });

  it('the empty state is untouched by the axis props', () => {
    const c = draw({ series: [], xAxisTitle: 'X', yAxisTitle: 'Y' });
    expect(yTicks(c).length).toBe(0);
    expect(c.textContent).toContain('No data');
  });
  /* Regression: tick labels were routed
   * through compactNum whenever the VALUE was >= 1000, which keeps only one
   * decimal of the k unit — 100-unit resolution. A year axis printed seven "2k"
   * and a 1200-1260 latency domain printed "1.3k, 1.2k, 1.2k". Precision must
   * come from the tick STEP, not the magnitude: a label that cannot identify its
   * own value is the unreadable axis this whole feature exists to remove. */
  it('tick labels stay DISTINCT on a year axis and a tight >=1k domain', () => {
    const years = draw({
      series: [{ name: 'Revenue', points: [{ x: 2020, y: 12 }, { x: 2023, y: 30 }, { x: 2026, y: 44 }] }],
      xAxisTitle: 'Year',
      yAxisTitle: 'Revenue',
    });
    const xs = xTicks(years).map((t) => t.textContent?.trim());
    expect(new Set(xs).size, `x tick labels must be distinct, got ${JSON.stringify(xs)}`).toBe(xs.length);
    expect(xs.some((t) => /^\d{4}$/.test(t ?? '')), `expected full years, got ${JSON.stringify(xs)}`).toBe(true);

    const tight = draw({
      series: [{ name: 'p95', points: [{ x: 1, y: 1200 }, { x: 2, y: 1230 }, { x: 3, y: 1260 }] }],
      yAxisTitle: 'p95 latency (ms)',
    });
    const ys = yTicks(tight).map((t) => t.textContent?.trim());
    expect(new Set(ys).size, `y tick labels must be distinct, got ${JSON.stringify(ys)}`).toBe(ys.length);
  });

  it('still compacts when the STEP is coarse enough to stay unambiguous', () => {
    const c = draw({
      series: [{ name: 'v', points: [{ x: 1, y: 0 }, { x: 2, y: 12_500_000 }] }],
      yAxisTitle: 'Impressions',
    });
    const ys = yTicks(c).map((t) => t.textContent?.trim());
    expect(ys.some((t) => /M$/.test(t ?? '')), `expected M compaction, got ${JSON.stringify(ys)}`).toBe(true);
    expect(new Set(ys).size).toBe(ys.length);
  });
});
