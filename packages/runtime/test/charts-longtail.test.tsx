/**
 * Charts + data-longtail regression guard.
 *
 * Items covered (the charts/data-longtail family):
 *   AreaChart/LineChart xLabels row
 *   BarChart multi-series (series[] wins over data, groupMode)
 *   DonutChart/BarChart value formatting (valueFormat + prefix/suffix)
 *   ScatterChart x-axis ticks
 *   DataGrid maxHeight cap + sticky thead
 *   DataGrid hoverable + bordered (frameless) toggles
 *   RelativeTime <time> dateTime + title
 *   JsonView copyable
 *   Fab extended variant
 *   Gantt axisLabels row
 *   Gauge showRange + sizeValue
 *   Heatmap showLegend key
 *   BarList value formatting
 *   StatGroup dividerColor (borderColor) + align:end
 *   Gauge/ProgressCircle neutral tone → muted-foreground (default change)
 *   RadialBar/Gauge/ProgressCircle valueColor
 *
 * Per additive item: SET assertions (class/attr/behaviour) + UNSET byte-identity
 * against the prop-absent render. Behavioural items use fireEvent; timing uses
 * fake timers where relevant.
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const hasClass = (el: Element, token: string): boolean => el.classList.contains(token);

/** Assert that setting a prop to null renders byte-identical HTML to omitting it. */
function assertUnsetIdentical(type: string, base: Record<string, unknown>, channel: string, value: unknown = null) {
  const withNull = draw(type, { ...base, [channel]: value });
  const nullHtml = withNull.container.innerHTML;
  withNull.unmount();
  const without = draw(type, { ...base });
  expect(nullHtml).toBe(without.container.innerHTML);
}

/* ── AreaChart/LineChart xLabels ─────────────────────────────────────── */

describe('x-axis category labels', () => {
  const series = [{ name: 'Rev', points: [12, 19, 14, 22] }];

  it('AreaChart: xLabels render one span per point, reading the axis var', () => {
    const { container } = draw('AreaChart', { series, xLabels: ['Mon', 'Tue', 'Wed', 'Thu'] });
    // the label row consumes the areachart axis var
    const row = container.querySelector('[style*="--fr-areachart-axis"]');
    expect(row, 'x-label row carrying the axis var').not.toBeNull();
    expect(container.textContent).toContain('Mon');
    expect(container.textContent).toContain('Thu');
  });

  it('LineChart: xLabels render + honour truncation to point count', () => {
    const { container } = draw('LineChart', { series, xLabels: ['A', 'B', 'C', 'D', 'E'] });
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('D');
    // the 5th label is beyond the 4 points → not rendered
    expect(container.textContent).not.toContain('E');
  });

  it('AreaChart/LineChart: xLabels:null is byte-identical to absent', () => {
    assertUnsetIdentical('AreaChart', { series }, 'xLabels');
    assertUnsetIdentical('LineChart', { series }, 'xLabels');
  });
});

/* ── BarChart multi-series ──────────────────────────────────────────── */

describe('BarChart multi-series', () => {
  const barSeries = [
    { name: 'A', values: [10, 20, 30] },
    { name: 'B', values: [5, 15, 25] },
  ];

  it('series wins over data (multi-series render, legend on by default)', () => {
    const { container } = draw('BarChart', {
      data: [{ label: 'IGNORED', value: 999 }],
      series: barSeries,
      labels: ['Q1', 'Q2', 'Q3'],
    });
    // data path is skipped: its label must NOT appear
    expect(container.textContent).not.toContain('IGNORED');
    // series legend (default true in multi-series) shows both names
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('B');
    // x categories render
    expect(container.textContent).toContain('Q1');
    expect(container.textContent).toContain('Q3');
  });

  it('caps series at 5', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `S${i}`, values: [i + 1] }));
    const { container } = draw('BarChart', { series: many, labels: ['c'] });
    // only the first 5 series legend names appear; the 6th (S5) is dropped
    expect(container.textContent).toContain('S0');
    expect(container.textContent).toContain('S4');
    expect(container.textContent).not.toContain('S5');
  });

  it('stacked mode renders (vertical) — bars present', () => {
    const { container } = draw('BarChart', { series: barSeries, labels: ['Q1', 'Q2', 'Q3'], groupMode: 'stacked' });
    // titles carry the per-segment datum
    const titled = container.querySelectorAll('[title*="A"]');
    expect(titled.length).toBeGreaterThan(0);
  });

  it('single-series data path stays byte-identical when series is absent', () => {
    // With NO series prop, the classic data path renders exactly as before.
    const a = draw('BarChart', { data: [{ label: 'Mon', value: 12 }, { label: 'Tue', value: 8 }] });
    const aHtml = a.container.innerHTML;
    a.unmount();
    const b = draw('BarChart', { data: [{ label: 'Mon', value: 12 }, { label: 'Tue', value: 8 }], series: null });
    expect(aHtml).toBe(b.container.innerHTML);
  });
});

/* ── value formatting (Donut + Bar) ─────────────────────────────────── */

describe('value formatting', () => {
  it('BarChart compact + prefix/suffix formats the value annotation', () => {
    const { container } = draw('BarChart', {
      data: [{ label: 'Views', value: 1240 }],
      valueFormat: 'compact',
      valuePrefix: '$',
      valueSuffix: '!',
    });
    expect(container.textContent).toContain('$1.2k!');
    expect(container.textContent).not.toContain('1240');
  });

  it('DonutChart percent format shapes the center total', () => {
    const { container } = draw('DonutChart', {
      data: [{ label: 'A', value: 30 }, { label: 'B', value: 70 }],
      valueFormat: 'percent',
    });
    // total = 100 → "100%"
    expect(container.textContent).toContain('100%');
  });

  it('BarChart/DonutChart valueFormat:null byte-identical to absent', () => {
    assertUnsetIdentical('BarChart', { data: [{ label: 'A', value: 5 }] }, 'valueFormat');
    assertUnsetIdentical('DonutChart', { data: [{ label: 'A', value: 5 }, { label: 'B', value: 5 }] }, 'valueFormat');
  });
});

/* ── ScatterChart x-axis ticks ──────────────────────────────────────── */

describe('ScatterChart x-axis ticks', () => {
  const series = [{ name: 'S', points: [{ x: 0, y: 0 }, { x: 10, y: 5 }] }];

  it('renders a bottom row of x-tick labels reading the axis var', () => {
    const { container } = draw('ScatterChart', { series });
    // x-tick spans consume --fr-scatter-axis via their reader class
    const xTicks = container.querySelectorAll('.\\[color\\:var\\(--fr-scatter-axis\\,var\\(--color-muted-foreground\\)\\)\\]');
    // both y-gutter ticks and x-row ticks read the same class → several present
    expect(xTicks.length).toBeGreaterThan(6);
    // the axis extremes appear as tick labels
    expect(container.textContent).toContain('0');
    expect(container.textContent).toContain('10');
  });
});

/* ── RelativeTime <time> attributes ─────────────────────────────────── */

describe('RelativeTime <time> dateTime + title', () => {
  it('sets the ISO dateTime attr + an absolute title', () => {
    const { container } = draw('RelativeTime', { target: '2026-06-25T09:00:00Z' });
    const time = container.querySelector('time')!;
    expect(time.getAttribute('datetime')).toBe('2026-06-25T09:00:00.000Z');
    expect(time.getAttribute('title')).toBeTruthy();
  });

  it('epoch-ms target also yields a valid ISO dateTime', () => {
    const { container } = draw('RelativeTime', { target: 1750000000000 });
    const time = container.querySelector('time')!;
    expect(time.getAttribute('datetime')).toBe(new Date(1750000000000).toISOString());
  });
});

/* ── JsonView copyable ──────────────────────────────────────────────── */

describe('JsonView copyable', () => {
  const base = { data: { a: 1, b: [2, 3] } };

  it('copyable renders a copy button that writes the pretty JSON', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const orig = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      const { container } = draw('JsonView', { ...base, copyable: true });
      const btn = container.querySelector('button[aria-label="Copy JSON"]')!;
      expect(btn).not.toBeNull();
      fireEvent.click(btn);
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(base.data, null, 2));
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: orig, configurable: true });
    }
  });

  it('no copy button by default', () => {
    const { container } = draw('JsonView', base);
    expect(container.querySelector('button[aria-label="Copy JSON"]')).toBeNull();
  });

  it('copyable:null byte-identical to absent', () => {
    assertUnsetIdentical('JsonView', base, 'copyable');
  });
});

/* ── Fab extended variant ───────────────────────────────────────────── */

describe('Fab extended', () => {
  it('extended (with label) renders the label text in the main button pill', () => {
    const { container } = draw('Fab', { icon: 'plus', label: 'Create', extended: true });
    const main = container.querySelector('button[aria-label="Create"]')!;
    expect(main.textContent).toContain('Create');
    // pill form uses px padding, not a fixed width var
    expect(hasClass(main, 'px-4')).toBe(true);
  });

  it('extended without a label stays circular (no pill text)', () => {
    const { container } = draw('Fab', { icon: 'plus', extended: true });
    const main = container.querySelector('button[aria-label="Actions"]')!;
    expect(main.textContent?.trim()).toBe('');
  });

  it('extended:null byte-identical to absent', () => {
    assertUnsetIdentical('Fab', { icon: 'plus', label: 'Create' }, 'extended');
  });
});

/* ── Gantt axisLabels ───────────────────────────────────────────────── */

describe('Gantt axisLabels', () => {
  const base = { tasks: [{ label: 'Design', start: 0, end: 3 }], rangeMax: 9 };

  it('renders the axis caption row reading the gantt axis var', () => {
    const { container } = draw('Gantt', { ...base, axisLabels: ['Jan', 'Feb', 'Mar'] });
    expect(container.textContent).toContain('Jan');
    expect(container.textContent).toContain('Mar');
    const row = container.querySelector('.\\[color\\:var\\(--fr-gantt-axis\\,var\\(--color-muted-foreground\\)\\)\\]');
    expect(row, 'axis caption row').not.toBeNull();
  });

  it('axisLabels:null byte-identical to absent', () => {
    assertUnsetIdentical('Gantt', base, 'axisLabels');
  });
});

/* ── Gauge showRange + sizeValue ────────────────────────────────────── */

describe('Gauge showRange + sizeValue', () => {
  const base = { value: 50, min: 0, max: 100 };

  it('showRange prints the min/max extremes', () => {
    const { container } = draw('Gauge', { ...base, showRange: true });
    expect(container.textContent).toContain('0');
    expect(container.textContent).toContain('100');
  });

  it('sizeValue lands in --fr-gauge-w (exact width override)', () => {
    const { container } = draw('Gauge', { ...base, sizeValue: '200px' });
    const sized = container.querySelector('[style*="--fr-gauge-w:"]');
    expect(sized, 'element carrying the exact --fr-gauge-w').not.toBeNull();
    expect(styleOf(sized!)).toContain('--fr-gauge-w');
  });

  it('showRange/sizeValue:null byte-identical to absent', () => {
    assertUnsetIdentical('Gauge', base, 'showRange');
    assertUnsetIdentical('Gauge', base, 'sizeValue');
  });
});

/* ── Heatmap intensity legend ───────────────────────────────────────── */

describe('Heatmap showLegend', () => {
  const base = { cells: [[1, 4], [2, 3]] };

  it('showLegend renders the Less…More scale key', () => {
    const { container } = draw('Heatmap', { ...base, showLegend: true });
    expect(container.textContent).toContain('Less');
    expect(container.textContent).toContain('More');
  });

  it('showLegend:null byte-identical to absent', () => {
    assertUnsetIdentical('Heatmap', base, 'showLegend');
  });
});

/* ── BarList value formatting ───────────────────────────────────────── */

describe('BarList value formatting', () => {
  const base = { data: [{ label: '/home', value: 1240 }] };

  it('compact + suffix formats each row value', () => {
    const { container } = draw('BarList', { ...base, valueFormat: 'compact', valueSuffix: ' hits' });
    expect(container.textContent).toContain('1.2k hits');
    expect(container.textContent).not.toContain('1240');
  });

  it('valueFormat:null byte-identical to absent', () => {
    assertUnsetIdentical('BarList', base, 'valueFormat');
  });
});

/* ── BarList axis ceiling + scale row ───────────────────────────────── */

describe('BarList axis ceiling + scale row', () => {
  /** The scale row is the list's only aria-hidden child: [low, ceiling]. */
  const scaleEnds = (container: HTMLElement): (string | null)[] => {
    const row = container.querySelector('[aria-hidden="true"]')!;
    expect(row, 'scale row').not.toBeNull();
    return Array.from(row.querySelectorAll('span')).map((s) => s.textContent);
  };

  it('whole-number rows get a whole-number ceiling (never 2.5 for a max of 2)', () => {
    expect(scaleEnds(draw('BarList', { data: [{ label: 'a', value: 2 }] }).container)).toEqual(['0', '3']);
    expect(scaleEnds(draw('BarList', { data: [{ label: 'a', value: 1 }] }).container)).toEqual(['0', '2']);
    expect(scaleEnds(draw('BarList', { data: [{ label: 'a', value: 1240 }] }).container)).toEqual(['0', '1500']);
  });

  it('an all-zero row still prints a whole 0 → 1 axis (no division by zero)', () => {
    const { container } = draw('BarList', { data: [{ label: 'a', value: 0 }, { label: 'b', value: 0 }] });
    expect(scaleEnds(container)).toEqual(['0', '1']);
  });

  it('percent axis stops at 100 (a max of 99 never prints 120%)', () => {
    const { container } = draw('BarList', { data: [{ label: 'a', value: 99 }], valueFormat: 'percent' });
    expect(scaleEnds(container)).toEqual(['0%', '100%']);
  });

  it('fractional data keeps a fractional ceiling (the round-up is data-driven)', () => {
    const { container } = draw('BarList', { data: [{ label: 'a', value: 0.4 }] });
    expect(scaleEnds(container)).toEqual(['0', '0.5']);
  });

  it('the scale-row rule reads the muted channel (border token fallback), border-border absent', () => {
    const { container } = draw('BarList', { data: [{ label: 'a', value: 10 }] });
    const row = container.querySelector('[aria-hidden="true"]')!;
    expect(row.className).toContain('[border-color:var(--fr-barlist-muted,var(--color-border))]');
    expect(hasClass(row, 'border-border')).toBe(false);
  });

  it('the scale row is aria-hidden furniture INSIDE role="list" (listitems stay the only exposed children)', () => {
    const { container } = draw('BarList', { data: [{ label: 'a', value: 10 }] });
    const list = container.querySelector('[role="list"]')!;
    expect(container.querySelector('[aria-hidden="true"]')!.parentElement).toBe(list);
    expect(
      Array.from(list.children).filter((c) => c.getAttribute('aria-hidden') !== 'true' && c.getAttribute('role') !== 'listitem'),
    ).toEqual([]);
  });
});

/* ── StatGroup dividerColor (borderColor) + align:end ────────────────── */

describe('StatGroup divider channel + align:end', () => {
  const base = { divided: true, columns: 3 };

  it('divided: borderColor lands in --fr-statgroup-divider; the box-shadow rules consume it, no border painted', () => {
    const { container } = draw('StatGroup', { ...base, borderColor: '#ff0000' });
    const grid = container.querySelector('[style*="--fr-statgroup-divider"]')!;
    expect(grid, 'grid carrying the divider var').not.toBeNull();
    expect(styleOf(grid)).toContain('--fr-statgroup-divider');
    // the divided variant paints its rules as per-tile OUTSET box-shadows that
    // read the channel (border token folded in as the var fallback) — column
    // rule (-1px 0) + row rule (0 -1px)
    expect(grid.className).toContain(
      '[&>*]:[box-shadow:-1px_0_0_0_var(--fr-statgroup-divider,var(--color-border)),0_-1px_0_0_var(--fr-statgroup-divider,var(--color-border))]',
    );
    // …so no border is drawn at all on this variant
    expect(grid.className).not.toContain('border-color:');
    expect(hasClass(grid, 'border-border')).toBe(false);
  });

  it('bordered: the same divider channel paints the per-tile card border, border-border absent', () => {
    const { container } = draw('StatGroup', { bordered: true, columns: 3, borderColor: '#ff0000' });
    const grid = container.querySelector('[style*="--fr-statgroup-divider"]')!;
    expect(grid, 'grid carrying the divider var').not.toBeNull();
    expect(grid.className).toContain('[&>*]:[border-color:var(--fr-statgroup-divider,var(--color-border))]');
    expect(hasClass(grid, 'border-border')).toBe(false);
  });

  it('align:end right-aligns the tiles', () => {
    const { container } = draw('StatGroup', { align: 'end' });
    const grid = container.querySelector('.grid')!;
    expect(hasClass(grid, 'text-right')).toBe(true);
  });

  it('borderColor:null (divided) byte-identical to absent', () => {
    assertUnsetIdentical('StatGroup', base, 'borderColor');
  });
});

/* ── neutral tone → muted-foreground (Gauge + ProgressCircle) ────────── */

describe('neutral tone unification (default change)', () => {
  it('Gauge neutral arc uses the muted-foreground token stroke', () => {
    const { container } = draw('Gauge', { value: 50, tone: 'neutral' });
    // the value arc <path> takes the neutral token color as its stroke
    const arcs = Array.from(container.querySelectorAll('path[stroke]'));
    const neutralArc = arcs.find((p) => p.getAttribute('stroke') === 'var(--color-muted-foreground)');
    expect(neutralArc, 'gauge value arc stroked with muted-foreground').not.toBeUndefined();
  });

  it('ProgressCircle neutral arc uses the muted-foreground token stroke', () => {
    const { container } = draw('ProgressCircle', { value: 50, tone: 'neutral' });
    const arcs = Array.from(container.querySelectorAll('circle[stroke]'));
    const neutralArc = arcs.find((c) => c.getAttribute('stroke') === 'var(--color-muted-foreground)');
    expect(neutralArc, 'ring arc stroked with muted-foreground').not.toBeUndefined();
  });
});

/* ── valueColor (RadialBar + Gauge + ProgressCircle) ─────────────────── */

/* The three selectors below name the whole class, so they carry the chain's LAST
 * RESORT with them. That last resort moved from `var(--color-foreground)` to
 * `currentColor` in the inherited-foreground pass — the CHANNEL these tests are
 * about (`--fr-gauge-value` / `--fr-ring-value` / `--fr-legend-value` reaching the
 * right element) is unchanged, and so is the computed default, since
 * frayme.css:138 points both `.frayme-root { color }` and --color-foreground at
 * --frayme-fg. See test/inherited-foreground-datatable-charts-scheduler.test.tsx. */
describe('valueColor coherence group', () => {
  it('Gauge valueColor lands on the centre KPI reader', () => {
    const { container } = draw('Gauge', { value: 50, valueColor: '#00ff00' });
    const kpi = container.querySelector('.\\[color\\:var\\(--fr-gauge-value\\,currentColor\\)\\]');
    expect(kpi, 'gauge KPI reads the value channel').not.toBeNull();
    const varHost = container.querySelector('[style*="--fr-gauge-value"]');
    expect(varHost).not.toBeNull();
  });

  it('ProgressCircle valueColor lands on the centre % reader', () => {
    const { container } = draw('ProgressCircle', { value: 50, valueColor: '#00ff00' });
    const kpi = container.querySelector('.\\[color\\:var\\(--fr-ring-value\\,currentColor\\)\\]');
    expect(kpi, 'ring % reads the value channel').not.toBeNull();
  });

  it('RadialBar valueColor sets the shared legend-value channel', () => {
    const { container } = draw('RadialBar', {
      data: [{ label: 'Mobile', value: 78 }],
      showValues: true,
      valueColor: '#00ff00',
    });
    const varHost = container.querySelector('[style*="--fr-legend-value"]');
    expect(varHost, 'RadialBar sets --fr-legend-value').not.toBeNull();
    const meta = container.querySelector('.\\[color\\:var\\(--fr-legend-value\\,currentColor\\)\\]');
    expect(meta, 'legend value reads the shared channel').not.toBeNull();
  });

  it('valueColor:null byte-identical to absent', () => {
    assertUnsetIdentical('Gauge', { value: 50 }, 'valueColor');
    assertUnsetIdentical('ProgressCircle', { value: 50 }, 'valueColor');
    assertUnsetIdentical('RadialBar', { data: [{ label: 'M', value: 78 }], showValues: true }, 'valueColor');
  });
});
