'use client';
import type { CSSProperties, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { styleVars, weightClass } from './_style.js';
import { formatReadout } from './_num.js';
import { safeColor } from '@frayme/catalog/validate';

/* Catalog group (charts): AreaChart · BarChart · LineChart · DonutChart · Sparkline.
 *
 * Same truly-dynamic contract as the shipped 57:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a per-series `color`, the `height`) NEVER become classes. The
 *     `height` lands in `--fr-<comp>-height` via `styleVars(...)`, read by a STATIC
 *     `[height:var(--fr-…,…)]` utility. A per-series `color` is re-validated here
 *     via `safeColor` and applied as an SVG `fill`/`stroke` ATTRIBUTE (an svg
 *     presentation attribute carrying a validated value — never a class, never a
 *     CSS-property string from the spec).
 *
 * CHART SECURITY (non-negotiable): the `<svg>` markup is OURS (polyline / path /
 * rect / circle / line / text). The spec supplies only NUMBERS + labels + a
 * validated color. We filter every series to FINITE numbers and COMPUTE every
 * coordinate, normalizing into a fixed viewBox. A spec value never becomes
 * markup. Empty/all-invalid data → a muted "No data" state. Each chart is
 * `role="img"` with an `aria-label` summarizing it (a11y for non-text content).
 */

/* ── palette: the named, token-based series-color sets ──────────────────────── */
// ADJACENT CONTRAST IS THE RULE: slots are consumed in series order, so
// slot 0 and slot 1 are what a two-series chart shows — and the old brand set put
// primary-blue next to #38bdf8 (another blue), which read as "every line is blue".
// Each set now alternates hue family so consecutive series are separable at a
// glance, the way a competitor's blue-vs-rose line pair is.
const PALETTES: Record<string, string[]> = {
  brand: [
    'var(--color-primary)', // blue
    '#f43f5e',              // rose — maximum separation from slot 0
    '#2dd4bf',              // teal
    '#f59e0b',              // amber
    '#a855f7',              // violet
    '#84cc16',              // lime
  ],
  cool: [
    'var(--color-info)',    // blue
    '#22d3ee',              // cyan
    'var(--color-success)', // green
    '#818cf8',              // indigo
    '#2dd4bf',              // teal
    '#a78bfa',              // violet
  ],
  warm: ['var(--color-warning)', 'var(--color-danger)', '#f97316', '#e11d48', '#f59e0b'],
  categorical: ['#3b82f6', '#14b8a6', '#f59e0b', '#f43f5e', '#f97316', '#22c55e'],
  mono: [
    'var(--color-primary)',
    'color-mix(in srgb, var(--color-primary) 70%, transparent)',
    'color-mix(in srgb, var(--color-primary) 45%, transparent)',
    'color-mix(in srgb, var(--color-primary) 28%, transparent)',
    'color-mix(in srgb, var(--color-primary) 16%, transparent)',
  ],
};

/** A series/slice color: a validated per-item `color` wins, else the palette slot
 *  (wrapping around). The per-item value is re-validated (defence in depth — the
 *  spec is untrusted even past the gate); an invalid value falls back to the slot. */
function seriesColor(itemColor: unknown, palette: string | null | undefined, index: number): string {
  if (itemColor != null) {
    const safe = safeColor(itemColor);
    if (safe !== null) return safe;
  }
  const set = PALETTES[palette ?? 'brand'] ?? PALETTES.brand;
  return set[index % set.length];
}

/** Finite numbers only — drops NaN/Infinity/non-number so no coordinate is ever
 *  computed from spec garbage. */
function finite(arr: unknown): number[] {
  return Array.isArray(arr) ? (arr.filter((n) => typeof n === 'number' && Number.isFinite(n)) as number[]) : [];
}

/* Tone enum → a token color (the Sparkline default channel; `color` value wins).
 * `neutral` KEEPS the --color-foreground token rather than joining the
 * inherited-ink fix applied to this file's chart TEXT. These values land in SVG
 * `fill`/`stroke` — they are the mark, not body copy — and the sibling table in
 * charts-radial.tsx (Gauge) is a second copy of the same map; moving one and not
 * the other forks a shared vocabulary for a stroke nobody measured failing, so it
 * is deliberately left as it is here. */
const TONE_COLOR: Record<string, string> = {
  neutral: 'var(--color-foreground)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-danger)',
  info: 'var(--color-info)',
};

const STROKE_W: Record<string, number> = { sm: 1.5, md: 2, lg: 2.75 };
const DOT_R: Record<string, number> = { sm: 2, md: 2.75, lg: 3.5 };

/** Resolve an exact numeric dimension (px value or bare number) to a clamped
 *  number for an SVG presentation attribute, or null when not a finite value.
 *  Chart strokes are SVG attributes (the chart-security contract), never a class
 *  or CSS var — so the exact override is a clamped NUMBER, not a `--*` var. */
function dimNum(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null;
}

/* ── value formatting ────────────────────────────────────────────────
 * A bounded `format` enum shapes how a numeric annotation prints; the math lives
 * in OUR literal code (never spec text). Optional plain-text prefix/suffix wrap
 * the result. Default `plain` returns the raw number → byte-identical. */
/* compactNum / niceScale / AxisTitle are EXPORTED for ScatterChart in
 * charts-proportion.tsx: its two value axes have to speak the same visual
 * language as Bar/Line/Area — nice domains, compact ticks, one title row per
 * axis — and a forked copy is how the two drift apart. */
export function compactNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}
function formatValue(
  n: number,
  format: string | null | undefined,
  prefix: string | null | undefined,
  suffix: string | null | undefined,
): string {
  let body: string;
  // The plain branch used `String(n)`, which printed both IEEE float noise
  // ("130.14999999999998") and ungrouped six-figure sums.
  if (format === 'compact') body = compactNum(n);
  else if (format === 'percent') body = `${formatReadout(n)}%`;
  else body = formatReadout(n);
  return `${typeof prefix === 'string' ? prefix : ''}${body}${typeof suffix === 'string' ? suffix : ''}`;
}

/* ── shared chrome ──────────────────────────────────────────────────────────── */

/* INHERITED FOREGROUND. The chart root carries its ink through (`text-current`),
 * it does not re-assert the global token. `text-[color:var(--fr-surface-fg,var(--color-foreground))]` was a hard RESET: a
 * spec authoring `Card { bg:"#12161f", color:"#e2e6f0" }` had that colour inherit
 * down two levels and then a chart snap it back to --color-foreground (#18181b) —
 * near-black ink on dark navy, and the spec did nothing wrong. `currentColor` is the same value at
 * the top level (.frayme-root sets `color: var(--frayme-fg)` and --color-foreground
 * IS var(--frayme-fg)), so the props-less default is byte-identical; only the
 * authored-container case moves. Rejected: leaving the reset and asking specs to
 * restate `color` on every chart — specs are generated, not hand-maintained. */
const chartWrap = 'flex w-full flex-col gap-2 text-current';
const plotBox = 'relative w-full [height:var(--fr-chart-height,200px)]';

/* The settable secondary/muted-text colour channel (mirrors charts-proportion /
 * charts-radial): the empty state reads the per-chart `--fr-<comp>-muted` var with
 * the muted-foreground token folded in as the var fallback, so a props-less chart
 * resolves to the exact same computed colour as the old text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]. */
type MutedVar = `--fr-${string}-muted`;
const mutedClass = (cssVar: MutedVar) => `[color:var(${cssVar},var(--color-muted-foreground))]`;

/* Hover affordance for discrete chart marks — a subtle modern "pop" on hover
 * (ported from charts-proportion — same system, same names, do not fork).
 * `_CENTER` scales an SVG mark from the viewBox centre (a donut segment grows
 * OUTWARD from the ring centre); `_SELF` scales an SVG mark in place from its
 * own bounding box (a line-chart dot). The scale is gated behind `motion-safe:`
 * so reduced-motion users get the cursor affordance with no movement;
 * `transform-box`/`transform-origin` are the SVG-specific bits that make the
 * scale anchor correctly. cursor-pointer signals the mark is the data point.
 *
 * WIDE/FULL-WIDTH marks must NOT scale: under `preserveAspectRatio="none"` a
 * transform pop distorts non-uniformly (the Candlestick lesson), so the area
 * fill, the polyline and the sparkline use the filter-only
 * `hover:brightness-110` (no motion → no motion-safe gate needed), mirroring
 * charts-radial. Every native <title> tooltip interpolates labels/values as
 * React TEXT children (escaped — never markup), per the chart-security
 * contract above. */
const MARK_POP_CENTER =
  'cursor-pointer transition-transform duration-200 ease-out motion-safe:hover:scale-105 [transform-box:view-box] [transform-origin:50%_50%]';
const MARK_POP_SELF =
  'cursor-pointer transition-transform duration-200 ease-out motion-safe:hover:scale-[1.05] [transform-box:fill-box] [transform-origin:center]';

const emptyState =
  'flex w-full items-center justify-center rounded-frayme border border-dashed border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]/40 py-10 text-sm [height:var(--fr-chart-height,160px)]';

function EmptyChart({
  height,
  label,
  mutedVar,
  mutedColor,
  message,
}: {
  height?: string | null;
  label: string;
  mutedVar: MutedVar;
  mutedColor?: unknown;
  message?: string | null;
}): ReactNode {
  const text = typeof message === 'string' && message.length > 0 ? message : 'No data';
  return (
    <div
      className={cn(emptyState, mutedClass(mutedVar))}
      role="img"
      aria-label={`${label}: ${text}`}
      style={{
        ...styleVars({ var: '--fr-chart-height', value: height, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 800 } }),
        ...styleVars({ var: mutedVar, value: mutedColor, kind: 'color' }),
      }}
    >
      {text}
    </div>
  );
}

/** A simple legend (color swatch + name). The muted name color is driven by the
 *  per-chart `--fr-<comp>-muted` var (set on the chart root), falling back to the
 *  muted-foreground token. `mutedVar` names which chart's var to read.
 *  Names WRAP, never clip: the `ul` already wraps items, and a series name with a
 *  word deleted ("Revenue (E…") names nothing — the row growing a line is cheaper. */
function Legend({ items, mutedVar }: { items: Array<{ name: string; color: string; meta?: string | null }>; mutedVar: string }): ReactNode {
  return (
    // The muted colour sits on the NAME span, not on this `ul`. It used to be an
    // inline `color` here, which forced the `meta` value below to re-assert
    // `text-[color:var(--fr-surface-fg,var(--color-foreground))]` to climb back OUT of muted — a hard reset to the global
    // token that stranded the meta value at near-black inside an authored dark
    // Card (the 1.00–1.02 contrast class). Colouring the one span that wants
    // muted leaves everything else in this subtree inheriting the chart's ink,
    // and both computed defaults are unchanged when nothing is authored.
    <ul className="m-0 flex min-w-0 list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[0.8125rem]">
      {items.map((it, i) => (
        <li key={i} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} aria-hidden />
          {/* LEAF: no min-w-0 — the name's own min-content (its longest word) is
              the floor; min-w-0 let the box shrink under it and shattered the key
              one character per line. break-words still breaks an over-long word. */}
          <span className="break-words" style={{ color: `var(${mutedVar},var(--color-muted-foreground))` }} title={it.name}>{it.name}</span>
          {it.meta != null && <span className="shrink-0 tabular-nums">{it.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

const VIEW_W = 300; // fixed normalized plot width (height comes from the CSS var)
const VIEW_H = 100;
const PAD = 4;

/** x position for index i of n points, padded inside the viewBox. */
function xAt(i: number, n: number): number {
  if (n <= 1) return VIEW_W / 2;
  return PAD + (i / (n - 1)) * (VIEW_W - PAD * 2);
}
/** y for value v normalized into [min,max] over the padded plot height. */
function yAt(v: number, min: number, max: number): number {
  const span = max - min || 1;
  return VIEW_H - PAD - ((v - min) / span) * (VIEW_H - PAD * 2);
}

/** A polyline path `d` for one series, honoring the curve enum. */
function linePath(pts: Array<[number, number]>, curve: string): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  if (curve === 'step') {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i];
      const prevX = pts[i - 1][0];
      const midX = (prevX + x) / 2;
      d += ` L ${midX} ${pts[i - 1][1]} L ${midX} ${y} L ${x} ${y}`;
    }
    return d;
  }
  if (curve === 'smooth') {
    // Catmull-Rom → cubic Bézier for a smooth, non-overshooting curve.
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
  }
  // linear
  return 'M ' + pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ');
}

/** Horizontal gridlines. `gridVar` names the per-chart grid-colour var (set on the
 *  chart root via styleVars); it always falls back to the border token so a
 *  props-less chart is byte-identical to before. */
function GridLines({ rows, gridVar }: { rows: number; gridVar: string }): ReactNode {
  const stroke = `var(${gridVar}, var(--color-border))`;
  const lines: ReactNode[] = [];
  for (let i = 0; i <= rows; i++) {
    const y = PAD + (i / rows) * (VIEW_H - PAD * 2);
    lines.push(
      <line
        key={i}
        x1={PAD}
        y1={y.toFixed(2)}
        x2={VIEW_W - PAD}
        y2={y.toFixed(2)}
        stroke={stroke}
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return <g aria-hidden>{lines}</g>;
}

/* An HTML row of x-axis category labels under the plot, one per index over
 * `len` points. Reuses the BarChart label idiom (equal-flex centered spans) and
 * reads the chart's `--fr-<comp>-axis` var (muted-foreground fallback → the row
 * is a muted axis, not the value-annotation foreground). Extras beyond `len` are
 * ignored; missing labels render blank. Returns null when there are no labels so
 * the unset render stays byte-identical. */
/* ── Y axis ────────────────────────────────────────────────────────
 * Line/Area charts previously rendered NO y axis at all — just gridlines and a
 * row of x labels — so a reader could see the shape but never read a value off
 * it. This adds a left tick column whose values sit on the SAME fractions the
 * gridlines use (`rows`), so ticks and rules always align.
 *
 * Ticks are compact-formatted (1.2K, 3.4M) to stay narrow, and the column is
 * rendered as a flex sibling of the plot so the SVG keeps its own viewBox maths
 * untouched — no change to any existing coordinate. */
/**
 * A "nice" axis domain: humans read 0 · 300 · 600 · 900 · 1.2K, not
 * 72 · 330 · 588 · 845 · 1.1k. Rounds the step to a 1/2/2.5/5 × 10^n value and
 * snaps the bounds to multiples of it.
 *
 * Zero baseline: when the data is all-positive and the floor is within the
 * bottom half of the range, the axis starts at 0 — otherwise two series of very
 * different magnitude (ad spend vs revenue) get a cropped baseline that
 * exaggerates the smaller one's movement. A tight cluster far from zero
 * (e.g. 980-1020) keeps its own floor so the detail survives.
 */
export function niceScale(rawMin: number, rawMax: number, maxRows = 5): { min: number; max: number; rows: number } {
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return { min: 0, max: 1, rows: 1 };
  let lo = rawMin;
  const hi = rawMax;
  if (lo >= 0 && lo <= hi / 2) lo = 0;              // zero baseline when honest
  if (lo === hi) return { min: lo, max: lo + 1, rows: 1 };
  const span = hi - lo;
  // Pick the SMALLEST nice step that fits the span in <= maxRows intervals, then
  // derive the row count from it. Choosing the step first is what yields
  // 0/300/600/900/1200 instead of a nice-looking domain cut into ugly 375s.
  const mag = 10 ** Math.floor(Math.log10(span / maxRows));
  for (const mult of [1, 2, 2.5, 3, 4, 5, 10, 20]) {
    const step = mult * mag;
    const min = Math.floor(lo / step) * step;
    const max = Math.ceil(hi / step) * step;
    const rows = Math.round((max - min) / step);
    if (rows >= 1 && rows <= maxRows) return { min, max, rows };
  }
  return { min: lo, max: hi, rows: maxRows };
}

function YAxisTicks({ min, max, rows, axisVar, className }: { min: number; max: number; rows: number; axisVar: string; className?: string }): ReactNode {
  const ticks: number[] = [];
  for (let i = 0; i <= rows; i++) ticks.push(max - (i / rows) * (max - min)); // top→bottom
  return (
    <div
      className={cn('flex shrink-0 flex-col justify-between py-[2px] pr-2 text-right text-[0.6875rem] tabular-nums', className)}
      style={{ color: `var(${axisVar},var(--color-muted-foreground))` }}
      aria-hidden
    >
      {ticks.map((t, i) => (
        <span key={i} className="leading-none">{compactNum(Math.abs(t) < 10 ? +t.toFixed(1) : Math.round(t))}</span>
      ))}
    </div>
  );
}

/** The axis TITLE row/column ("Month", "Value ($k)") — what names the units.
 *  Absent title → null, so an unset chart renders byte-identically. */
export function AxisTitle({ text, axisVar, align = 'center' }: { text: unknown; axisVar: string; align?: 'center' | 'left' }): ReactNode {
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  return (
    <div
      className={`text-[0.6875rem] ${align === 'center' ? 'text-center' : 'text-left'}`}
      style={{ color: `var(${axisVar},var(--color-muted-foreground))` }}
    >
      {text}
    </div>
  );
}

function XAxisLabels({ labels, len, axisVar }: { labels: unknown; len: number; axisVar: string }): ReactNode {
  if (!Array.isArray(labels) || labels.length === 0) return null;
  return (
    <div className="fr-xaxis flex w-full" style={{ color: `var(${axisVar},var(--color-muted-foreground))` }} aria-hidden>
      {/* Each slot keeps its flex-1 share — the label must stay over the column
          it names. But wrapping inside a share this small is not readable: at
          320px this row measured 114px holding SEVEN labels, 16px each, and
          "September" came out one letter per line.

          So the label stays on one line and the ROW thins itself instead
          (frayme.css, keyed on fr-xaxis's own container size, not the page's —
          a chart in a narrow column of a wide screen has the same problem).
          Nothing on this path clips (measured: overflowX visible to the root),
          so a surviving label may overspill into a hidden neighbour's slot
          rather than being cut. `title` keeps every label reachable. */}
      {Array.from({ length: len }).map((_, i) => (
        <span key={i} className="fr-xaxis-label min-w-0 flex-1 break-normal whitespace-nowrap text-center text-[0.6875rem]" title={typeof labels[i] === "string" ? (labels[i] as string) : undefined}>
          {typeof labels[i] === 'string' ? (labels[i] as string) : ''}
        </span>
      ))}
    </div>
  );
}

/* ── normalize series props (shared by Area / Line) ─────────────────────────── */
type RawSeries = { name?: string | null; points?: unknown; color?: string | null };
function normalizeSeries(raw: unknown): Array<{ name: string; points: number[]; color?: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const o = (s ?? {}) as RawSeries;
      return { name: typeof o.name === 'string' ? o.name : '', points: finite(o.points), color: o.color };
    })
    .filter((s) => s.points.length > 0);
}

/* ── AreaChart ──────────────────────────────────────────────────────────────── */

export function AreaChart({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    series?: unknown;
    curve?: string | null;
    stacked?: boolean | null;
    xLabels?: unknown;
    palette?: string | null;
    height?: string | null;
    size?: string | null;
    strokeWidth?: string | number | null;
    showGrid?: boolean | null;
    showLegend?: boolean | null;
    showValues?: boolean | null;
    mutedColor?: string | null;
    gridColor?: string | null;
    axisColor?: string | null;
    fillOpacity?: string | null;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const series = normalizeSeries(p.series);
  if (series.length === 0)
    return <EmptyChart height={p.height} label="Area chart" mutedVar="--fr-areachart-muted" mutedColor={p.mutedColor} message={p.emptyText} />;

  /* A line needs TWO points. A series of one produces a degenerate path, so the
     chart painted its gridlines and NOTHING else — and since the series was not
     empty, an automated no-data check scored it clean (one test spec sent
     five one-point AreaChart series). An empty frame with no caption reads
     as a broken component; say what happened instead.
     AREA ONLY, measured: LineChart draws a DOT per point (showDots defaults on
     up to 24 points), so a one-point line still shows its value and reads as a
     chart — it gets no guard. AreaChart draws no dots, so one point really is
     an empty frame. */
  if (series.every((s) => s.points.length < 2))
    return <EmptyChart height={p.height} label="Area chart" mutedVar="--fr-areachart-muted" mutedColor={p.mutedColor} message={typeof p.emptyText === 'string' && p.emptyText.length > 0 ? p.emptyText : 'Not enough data to plot'} />;

  const curve = p.curve ?? 'linear';
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const showGrid = p.showGrid !== false;
  // Explicit `showLegend: true` always shows the legend (even single-series);
  // unset keeps the multi-series-only default; `false` always hides.
  const showLegend = p.showLegend === true || (p.showLegend !== false && series.length > 1);
  const stacked = p.stacked === true;
  // Area fill opacity: default keeps the current 0.18; `solid` reads fuller, `soft` lighter.
  const fillOp = p.fillOpacity === 'solid' ? 0.4 : p.fillOpacity === 'soft' ? 0.1 : 0.18;
  const len = Math.max(...series.map((s) => s.points.length));

  // For stacking, accumulate per-index; overall min/max spans the rendered values.
  const stackBase = new Array(len).fill(0) as number[];
  const renderable = series.map((s, si) => {
    const tops: number[] = [];
    const bottoms: number[] = [];
    for (let i = 0; i < len; i++) {
      const v = s.points[i] ?? 0;
      const bottom = stacked ? stackBase[i] : 0;
      const top = stacked ? bottom + v : v;
      bottoms.push(bottom);
      tops.push(top);
    }
    if (stacked) for (let i = 0; i < len; i++) stackBase[i] = tops[i];
    return { ...s, tops, bottoms, index: si };
  });

  const allVals = renderable.flatMap((s) => [...s.tops, ...s.bottoms]);
  const min = Math.min(0, ...allVals);
  const max = Math.max(...allVals, 1);
  // Exact `strokeWidth` (px) wins; the `size` enum is the default.
  const strokeW = dimNum(p.strokeWidth, 0.5, 8) ?? STROKE_W[size] ?? STROKE_W.md;
  const computed = `Area chart: ${series.map((s) => s.name || 'series').join(', ')}`;
  const summary = typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0 ? p.ariaLabel : computed;

  return (
    <div
      className={chartWrap}
      style={styleVars(
        { var: '--fr-areachart-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-areachart-grid', value: p.gridColor, kind: 'color' },
        { var: '--fr-areachart-axis', value: p.axisColor, kind: 'color' },
      )}
    >
      <div
        className={plotBox}
        style={styleVars({ var: '--fr-chart-height', value: p.height, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 800 } })}
      >
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={summary}
        >
          {showGrid && <GridLines rows={4} gridVar="--fr-areachart-grid" />}
          {renderable.map((s) => {
            const color = seriesColor(s.color, p.palette, s.index);
            const topPts = s.tops.map((v, i) => [xAt(i, len), yAt(v, min, max)] as [number, number]);
            const botPts = s.bottoms.map((v, i) => [xAt(i, len), yAt(v, min, max)] as [number, number]).reverse();
            const area = `${linePath(topPts, curve)} L ${botPts.map((b) => `${b[0].toFixed(2)} ${b[1].toFixed(2)}`).join(' L ')} Z`;
            const seriesTitle = `${s.name || `Series ${s.index + 1}`} — min ${Math.min(...s.points)}, max ${Math.max(...s.points)}, last ${s.points[s.points.length - 1]}`;
            return (
              <g key={s.index}>
                {/* The filled band IS the series' hover target. A full-width area
                 * under preserveAspectRatio="none" would distort under a transform
                 * pop, so the affordance is the filter-only brightness. */}
                <path
                  d={area}
                  fill={color}
                  fillOpacity={fillOp}
                  stroke="none"
                  className="cursor-pointer transition-[filter] duration-200 ease-out hover:brightness-110"
                >
                  <title>{seriesTitle}</title>
                </path>
                <path
                  d={linePath(topPts, curve)}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {p.showValues === true &&
                  topPts.map(([x, y], i) => {
                    // Edge labels anchor start/end so first/last stay in the viewBox.
                    const first = i === 0;
                    const last = i === topPts.length - 1;
                    return (
                      <text key={i} x={first ? PAD : last ? VIEW_W - PAD : x} y={Math.max(y - 4, 6)} fontSize={5} textAnchor={first ? 'start' : last ? 'end' : 'middle'} fill="var(--fr-areachart-axis, var(--color-muted-foreground))">
                        {s.tops[i]}
                      </text>
                    );
                  })}
              </g>
            );
          })}
        </svg>
      </div>
      <XAxisLabels labels={p.xLabels} len={len} axisVar="--fr-areachart-axis" />
      {showLegend && (
        <Legend mutedVar="--fr-areachart-muted" items={renderable.map((s) => ({ name: s.name || `Series ${s.index + 1}`, color: seriesColor(s.color, p.palette, s.index) }))} />
      )}
    </div>
  );
}

/* ── LineChart ──────────────────────────────────────────────────────────────── */

export function LineChart({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    series?: unknown;
    curve?: string | null;
    showDots?: boolean | null;
    xLabels?: unknown;
    palette?: string | null;
    height?: string | null;
    size?: string | null;
    strokeWidth?: string | number | null;
    showGrid?: boolean | null;
    showLegend?: boolean | null;
    showValues?: boolean | null;
    mutedColor?: string | null;
    gridColor?: string | null;
    axisColor?: string | null;
    dotColor?: string | null;
    emptyText?: string | null;
    ariaLabel?: string | null;
    xAxisTitle?: string | null;
    yAxisTitle?: string | null;
    showYAxis?: boolean | null;
  };
  const series = normalizeSeries(p.series);
  if (series.length === 0)
    return <EmptyChart height={p.height} label="Line chart" mutedVar="--fr-linechart-muted" mutedColor={p.mutedColor} message={p.emptyText} />;

  const curve = p.curve ?? 'linear';
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const showGrid = p.showGrid !== false;
  // Explicit `showLegend: true` always shows the legend (even single-series).
  const showLegend = p.showLegend === true || (p.showLegend !== false && series.length > 1);
  const len = Math.max(...series.map((s) => s.points.length));
  const allVals = series.flatMap((s) => s.points);
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals, rawMin + 1);
  // The plot and the tick column share ONE domain, so a rule always sits exactly
  // on its tick value. Suppressing the y axis keeps the old tight domain (a
  // sparkline wants every pixel of shape, not a zero baseline).
  const domain = p.showYAxis === false ? { min: rawMin, max: rawMax, rows: 4 } : niceScale(rawMin, rawMax);
  const min = domain.min;
  const max = domain.max;
  const gridRows = domain.rows;
  // Exact `strokeWidth` (px) wins; the `size` enum is the default. Dot radius
  // stays size-driven (`dotR`).
  const strokeW = dimNum(p.strokeWidth, 0.5, 8) ?? STROKE_W[size] ?? STROKE_W.md;
  const dotR = DOT_R[size] ?? DOT_R.md;
  const showDots = p.showDots !== false && len <= 24;
  const computed = `Line chart: ${series.map((s) => s.name || 'series').join(', ')}`;
  const summary = typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0 ? p.ariaLabel : computed;

  return (
    <div
      className={chartWrap}
      style={styleVars(
        { var: '--fr-linechart-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-linechart-grid', value: p.gridColor, kind: 'color' },
        { var: '--fr-linechart-axis', value: p.axisColor, kind: 'color' },
        { var: '--fr-linechart-dot', value: p.dotColor, kind: 'color' },
      )}
    >
      <AxisTitle text={p.yAxisTitle} axisVar="--fr-linechart-axis" align="left" />
      <div
        className="flex w-full"
        style={styleVars({ var: '--fr-chart-height', value: p.height, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 800 } })}
      >
        {/* Y ticks sit OUTSIDE the svg (a flex sibling), so the plot's viewBox
            maths is untouched — every existing coordinate renders identically.
            Suppressed only by an explicit showYAxis:false. */}
        {p.showYAxis !== false && <YAxisTicks min={min} max={max} rows={gridRows} axisVar="--fr-linechart-axis" />}
        <div className={`${plotBox} flex-1`}>
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={summary}
        >
          {showGrid && <GridLines rows={gridRows} gridVar="--fr-linechart-grid" />}
          {series.map((s, si) => {
            const color = seriesColor(s.color, p.palette, si);
            const pts = s.points.map((v, i) => [xAt(i, len), yAt(v, min, max)] as [number, number]);
            const seriesName = s.name || `Series ${si + 1}`;
            const seriesTitle = `${seriesName} — min ${Math.min(...s.points)}, max ${Math.max(...s.points)}, last ${s.points[s.points.length - 1]}`;
            return (
              <g key={si}>
                {/* The polyline is a full-width mark under preserveAspectRatio=
                 * "none" — a transform pop distorts, so brightness only. */}
                <path
                  d={linePath(pts, curve)}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer transition-[filter] duration-200 ease-out hover:brightness-110"
                >
                  <title>{seriesTitle}</title>
                </path>
                {showDots &&
                  pts.map(([x, y], i) => (
                    // The dot "hole punch" reads the dotColor channel with the card
                    // token as the var fallback (byte-identical when unset) — so a
                    // chart on a tinted surface can match its dots to it.
                    <circle key={i} className={MARK_POP_SELF} cx={x} cy={y} r={dotR} fill="var(--fr-linechart-dot,var(--color-card))" stroke={color} strokeWidth={strokeW} vectorEffect="non-scaling-stroke">
                      <title>{`${seriesName} — ${s.points[i]}`}</title>
                    </circle>
                  ))}
                {p.showValues === true &&
                  pts.map(([x, y], i) => {
                    // Edge labels anchor start/end so the first/last value never
                    // spills past the viewBox (centered text at x=PAD / x=VIEW_W-PAD
                    // was being clipped — the plot svg has no overflow-visible).
                    const first = i === 0;
                    const last = i === pts.length - 1;
                    return (
                      <text key={i} x={first ? PAD : last ? VIEW_W - PAD : x} y={Math.max(y - 4, 6)} fontSize={5} textAnchor={first ? 'start' : last ? 'end' : 'middle'} fill="var(--fr-linechart-axis, var(--color-muted-foreground))">
                        {s.points[i]}
                      </text>
                    );
                  })}
              </g>
            );
          })}
        </svg>
        </div>
      </div>
      {/* x labels are indented by an INVISIBLE copy of the tick column, so they
          line up under the plot without rendering the tick values twice. */}
      <div className="flex w-full">
        {/* WIDTH-ONLY spacer: h-0 + overflow-hidden so it lines the x labels up
            with the plot without also reserving the tick column's full HEIGHT,
            which left a dead ~70px band above the x-axis title. */}
        {p.showYAxis !== false && (
          <div className="invisible h-0 overflow-hidden" aria-hidden>
            <YAxisTicks min={min} max={max} rows={gridRows} axisVar="--fr-linechart-axis" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <XAxisLabels labels={p.xLabels} len={len} axisVar="--fr-linechart-axis" />
        </div>
      </div>
      <AxisTitle text={p.xAxisTitle} axisVar="--fr-linechart-axis" />
      {showLegend && (
        <Legend mutedVar="--fr-linechart-muted" items={series.map((s, si) => ({ name: s.name || `Series ${si + 1}`, color: seriesColor(s.color, p.palette, si) }))} />
      )}
    </div>
  );
}

/* ── BarChart ───────────────────────────────────────────────────────────────── */

const barTrack = cva('flex w-full gap-2 [height:var(--fr-chart-height,200px)]', {
  variants: {
    layout: {
      // items-stretch (NOT items-end): the columns must fill the track height so
      // each bar's `height: X%` resolves against a definite parent — items-end
      // collapsed columns to content height and every bar fell back to min-h-[2px].
      vertical: 'items-stretch',
      horizontal: 'flex-col justify-center',
    },
  },
  defaultVariants: { layout: 'vertical' },
});

/** Cap + finite-filter a multi-series `series[]` for BarChart. At most 5
 *  series; each carries a name, finite values, and an optional per-series color. */
function normalizeBarSeries(raw: unknown): Array<{ name: string; values: number[]; color?: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 5)
    .map((s) => {
      const o = (s ?? {}) as { name?: string | null; values?: unknown; color?: string | null };
      return { name: typeof o.name === 'string' ? o.name : '', values: finite(o.values), color: o.color };
    })
    .filter((s) => s.values.length > 0);
}

export function BarChart({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    data?: unknown;
    series?: unknown;
    labels?: unknown;
    groupMode?: string | null;
    layout?: string | null;
    rounded?: boolean | null;
    palette?: string | null;
    height?: string | null;
    showGrid?: boolean | null;
    showLegend?: boolean | null;
    showValues?: boolean | null;
    valueFormat?: string | null;
    valuePrefix?: string | null;
    valueSuffix?: string | null;
    mutedColor?: string | null;
    gridColor?: string | null;
    axisColor?: string | null;
    fillOpacity?: string | null;
    emptyText?: string | null;
    ariaLabel?: string | null;
    xAxisTitle?: string | null;
    yAxisTitle?: string | null;
    showYAxis?: boolean | null;
  };

  const layout = (p.layout as 'vertical' | 'horizontal' | null) ?? 'vertical';
  const horizontal = layout === 'horizontal';
  const rounded = p.rounded !== false;
  const showValues = p.showValues !== false;
  const showGrid = p.showGrid !== false;
  // Bar fill opacity: default keeps the bar at full colour; `soft` reads lighter.
  const barOpacity = p.fillOpacity === 'soft' ? 0.6 : 1;
  const radiusClass = rounded ? (horizontal ? 'rounded-r-frayme' : 'rounded-t-frayme') : 'rounded-none';
  const fmt = (n: number): string => formatValue(n, p.valueFormat, p.valuePrefix, p.valueSuffix);

  /* ── value axis ──────────────────────────────
   * A bar chart with no y axis is a row of unlabelled heights. VERTICAL bars now
   * get a real tick column, and the bars scale against the NICE max rather than
   * the raw data max, so a tick labelled 600 sits exactly where 600 is. The
   * category labels move OUT of the plot box into a sibling row (LineChart's
   * proven layout) — inside it, they ate part of the height the gridlines and
   * ticks span, which would have made a truthful-looking axis lie by one text
   * line. HORIZONTAL bars keep their category gutter and per-bar value labels:
   * the measure runs along x there, so it is named with xAxisTitle.
   * Every piece is omitted when unset, so a props-less BarChart is unchanged. */
  const showTicks = !horizontal && p.showYAxis !== false;
  /* The value annotations below read `--fr-barchart-axis` with `currentColor` as
   * the fallback, NOT --color-foreground. A value label sits on the plot's
   * surface, which the chart inherits from whatever contains it; the token was a
   * hard reset that painted it near-black inside an authored dark Card (ratio
   * 1.02, measured). `axisColor` still wins, and the two fallbacks compute to the
   * same colour when nothing is authored. The ONE exception is the stacked bar's
   * in-segment label — see its own note; it is painted over the series fill, not
   * over the inherited surface, so it must not follow a card's ink. */
  const axisVar = '--fr-barchart-axis';
  /** Wraps a plot box in its axis furniture: y title, tick column, x labels, x title. */
  const withAxes = (track: ReactNode, cats: string[], len: number, legend: ReactNode, dom: { min: number; max: number; rows: number }): ReactNode => (
    <div className={chartWrap} style={rootStyle}>
      <AxisTitle text={p.yAxisTitle} axisVar={axisVar} align="left" />
      <div className="flex w-full">
        {showTicks && <YAxisTicks min={dom.min} max={dom.max} rows={dom.rows} axisVar={axisVar} />}
        <div className="min-w-0 flex-1">{track}</div>
      </div>
      {!horizontal && cats.some((c) => c) && (
        <div className="flex w-full">
          {/* Mirrors the tick column's WIDTH so label i sits under column i.
              h-0 + overflow-hidden so it contributes width only — reserving its
              full height left a dead ~70px band above the x-axis title. */}
          {showTicks && (
            <div className="invisible h-0 overflow-hidden" aria-hidden>
              <YAxisTicks min={dom.min} max={dom.max} rows={dom.rows} axisVar={axisVar} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <XAxisLabels labels={cats} len={len} axisVar={axisVar} />
          </div>
        </div>
      )}
      <AxisTitle text={p.xAxisTitle} axisVar={axisVar} />
      {legend}
    </div>
  );

  const rootStyle = styleVars(
    { var: '--fr-barchart-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-barchart-grid', value: p.gridColor, kind: 'color' },
    { var: '--fr-barchart-axis', value: p.axisColor, kind: 'color' },
  );
  const heightStyle = styleVars({ var: '--fr-chart-height', value: p.height, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 800 } });

  // ── Multi-series (grouped / stacked) — WINS over `data` when set ────
  const series = normalizeBarSeries(p.series);
  if (series.length > 0) {
    // stacked is unavailable horizontally → fall back to grouped (scope control).
    const stacked = p.groupMode === 'stacked' && !horizontal;
    const catCount = Math.max(...series.map((s) => s.values.length));
    const labels = Array.isArray(p.labels) ? p.labels : [];
    const showLegend = p.showLegend !== false; // default true in multi-series mode
    // Scale: stacked → the tallest per-category total; grouped → the single max value.
    const rawMax = stacked
      ? Math.max(
          ...Array.from({ length: catCount }, (_, c) => series.reduce((sum, s) => sum + Math.max(0, s.values[c] ?? 0), 0)),
          1,
        )
      : Math.max(...series.flatMap((s) => s.values.map((v) => Math.max(0, v))), 1);
    // Vertical: bars resolve against the nice max so the tick labels are honest.
    const dom = showTicks ? niceScale(0, rawMax) : { min: 0, max: rawMax, rows: 4 };
    const max = dom.max;
    const summary =
      typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0
        ? p.ariaLabel
        : `Bar chart: ${series.map((s) => s.name || 'series').join(', ')} across ${catCount} categories`;
    const track = (
        <div className={cn(barTrack({ layout }), 'relative')} role="img" aria-label={summary} style={heightStyle}>
          {showGrid && !horizontal && (
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
              {Array.from({ length: dom.rows + 1 }).map((_, i) => (
                <div key={i} className="border-t [border-color:var(--fr-barchart-grid,color-mix(in_srgb,var(--color-border)_60%,transparent))]" />
              ))}
            </div>
          )}
          {Array.from({ length: catCount }).map((_, c) => {
            const cat = typeof labels[c] === 'string' ? (labels[c] as string) : '';
            if (horizontal) {
              // grouped rows: a label gutter + a stacked group of thin series bars.
              return (
                <div key={c} className="flex w-full items-center gap-2">
                  {/* The gutter width is UNIFORM by contract — every bar starts at the
                      same x or the lengths stop comparing — but the name wraps inside
                      it rather than clipping: a taller row is honest, "Manufact…" is not. */}
                  <span className="w-20 shrink-0 break-words text-right text-[0.75rem] [color:var(--fr-barchart-muted,var(--color-muted-foreground))]" title={cat || undefined}>{cat}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {series.map((s, si) => {
                      const v = Math.max(0, s.values[c] ?? 0);
                      const pct = Math.max((v / max) * 100, 1.5);
                      const color = seriesColor(s.color, p.palette, si);
                      return (
                        <div key={si} className="flex h-4 items-center">
                          <div className={cn('h-full min-w-[2px] transition-all cursor-pointer hover:brightness-110', radiusClass)} style={{ width: `${pct}%`, background: color, opacity: barOpacity }} title={`${s.name || `Series ${si + 1}`}${cat ? ` — ${cat}` : ''} — ${s.values[c] ?? 0}`} aria-hidden />
                          {showValues && <span className="ml-1.5 shrink-0 text-[0.75rem] tabular-nums text-[color:var(--fr-barchart-axis,currentColor)]">{fmt(s.values[c] ?? 0)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (stacked) {
              // one column per category; series stack bottom-up.
              return (
                // category label moved to the sibling x-labels row (see withAxes)
                <div key={c} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                  <div className="flex w-full flex-1 flex-col-reverse justify-start">
                    {series.map((s, si) => {
                      const v = Math.max(0, s.values[c] ?? 0);
                      const pct = v > 0 ? (v / max) * 100 : 0;
                      const color = seriesColor(s.color, p.palette, si);
                      if (pct <= 0) return null;
                      const isTop = si === series.length - 1;
                      return (
                        <div key={si} className="relative flex w-full items-center justify-center" style={{ height: `${pct}%` }} title={`${s.name || `Series ${si + 1}`}${cat ? ` — ${cat}` : ''} — ${s.values[c] ?? 0}`}>
                          <div className={cn('absolute inset-0 min-h-[2px] transition-all cursor-pointer hover:brightness-110', isTop && rounded ? 'rounded-t-frayme' : 'rounded-none')} style={{ background: color, opacity: barOpacity }} aria-hidden />
                          {/* DELIBERATELY still --color-foreground, unlike every other
                              value label in this file. This one is `relative` on top of
                              the segment's own painted series fill, so it is text on its
                              OWN surface, not on the inherited one; following a dark
                              card's light ink would put near-white on a pale palette
                              slot. It keeps the token — legible over saturated fills —
                              and `axisColor` still overrides it in step with the rest. */}
                          {showValues && pct > 8 && <span className="relative text-[0.6875rem] tabular-nums text-[color:var(--fr-barchart-axis,var(--color-foreground))]">{fmt(s.values[c] ?? 0)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            // grouped columns: a cluster of thin series bars per category.
            return (
              <div key={c} className="flex min-w-0 flex-1 flex-col items-center">
                {/* items-stretch (not items-end): the series columns must fill the
                    bar area so each bar's `height: X%` resolves against a definite
                    parent — otherwise the bars collapse to min-h-[2px]. */}
                <div className="flex w-full min-h-0 flex-1 items-stretch justify-center gap-0.5">
                  {series.map((s, si) => {
                    const v = Math.max(0, s.values[c] ?? 0);
                    const pct = Math.max((v / max) * 100, 1.5);
                    const color = seriesColor(s.color, p.palette, si);
                    return (
                      <div key={si} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5">
                        {showValues && <span className="shrink-0 text-[0.625rem] tabular-nums text-[color:var(--fr-barchart-axis,currentColor)]">{fmt(s.values[c] ?? 0)}</span>}
                        <div className={cn('w-full shrink-0 min-h-[2px] transition-all cursor-pointer hover:brightness-110', radiusClass)} style={{ height: `${pct}%`, background: color, opacity: barOpacity }} title={`${s.name || `Series ${si + 1}`}${cat ? ` — ${cat}` : ''} — ${s.values[c] ?? 0}`} aria-hidden />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
    );
    return withAxes(
      track,
      Array.from({ length: catCount }, (_, c) => (typeof labels[c] === 'string' ? (labels[c] as string) : '')),
      catCount,
      showLegend ? <Legend mutedVar="--fr-barchart-muted" items={series.map((s, si) => ({ name: s.name || `Series ${si + 1}`, color: seriesColor(s.color, p.palette, si) }))} /> : null,
      dom,
    );
  }

  // ── Single-series `data` path ───────────────────────────────────────────────
  const raw = Array.isArray(p.data) ? p.data : [];
  const data = raw
    .map((d) => {
      const o = (d ?? {}) as { label?: string | null; value?: unknown; color?: string | null };
      return { label: typeof o.label === 'string' ? o.label : '', value: typeof o.value === 'number' && Number.isFinite(o.value) ? o.value : null, color: o.color };
    })
    .filter((d): d is { label: string; value: number; color: string | null | undefined } => d.value !== null);

  if (data.length === 0)
    return <EmptyChart height={p.height} label="Bar chart" mutedVar="--fr-barchart-muted" mutedColor={p.mutedColor} message={p.emptyText} />;

  const showLegend = p.showLegend === true;
  const rawMax = Math.max(...data.map((d) => d.value), 1);
  // Vertical: bars resolve against the nice max so the tick labels are honest.
  const dom = showTicks ? niceScale(0, rawMax) : { min: 0, max: rawMax, rows: 4 };
  const max = dom.max;
  const computed = `Bar chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`;
  const summary = typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0 ? p.ariaLabel : computed;

  const track = (
      <div
        className={cn(barTrack({ layout }), 'relative')}
        role="img"
        aria-label={summary}
        style={heightStyle}
      >
        {/* value gridlines behind the bars (vertical layout); decorative.
            One line per tick so the grid and the tick column agree. */}
        {showGrid && !horizontal && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            {Array.from({ length: dom.rows + 1 }).map((_, i) => (
              <div key={i} className="border-t [border-color:var(--fr-barchart-grid,color-mix(in_srgb,var(--color-border)_60%,transparent))]" />
            ))}
          </div>
        )}
        {data.map((d, i) => {
          const pct = Math.max((d.value / max) * 100, 1.5);
          // ONE series, ONE colour. The palette slot is indexed by SERIES, and the
          // `data` path IS a single series — indexing it by the datum painted a
          // three-bar chart in three hues, which reads as three series. A
          // per-datum `color` still wins, so a deliberately colour-coded
          // breakdown is unaffected.
          const color = seriesColor(d.color, p.palette, 0);
          // The bars are HTML divs (not SVG): the hover affordance is the
          // filter-only brightness — MARK_POP_SELF's `transition-transform
          // duration-200 ease-out` would tw-merge-collide with the resting
          // `transition-all` (same group → the size animation would be dropped
          // or retimed), and a full-width bar popping 1.05 overlaps its packed
          // siblings. No transition-* class is added (`transition-all` already
          // animates filter). The native `title` ATTRIBUTE is the HTML analogue
          // of the SVG <title> child (same as the scatter/treemap marks).
          const markTitle = `${d.label || `Bar ${i + 1}`} — ${d.value}`;
          if (horizontal) {
            return (
              <div key={i} className="flex w-full items-center gap-2">
                {/* Same uniform label gutter as the grouped rows: fixed width so the
                    bars share a left edge, wrapping text so no word is deleted. */}
                <span className="w-20 shrink-0 break-words text-right text-[0.75rem] [color:var(--fr-barchart-muted,var(--color-muted-foreground))]" title={d.label || undefined}>{d.label}</span>
                <div className="flex h-5 min-w-0 flex-1 items-center">
                  <div className={cn('h-full min-w-[2px] transition-all cursor-pointer hover:brightness-110', radiusClass)} style={{ width: `${pct}%`, background: color, opacity: barOpacity }} title={markTitle} aria-hidden />
                  {showValues && <span className="ml-1.5 shrink-0 text-[0.75rem] tabular-nums text-[color:var(--fr-barchart-axis,currentColor)]">{fmt(d.value)}</span>}
                </div>
              </div>
            );
          }
          return (
            // The category label now lives in the sibling x-labels row, so this
            // column IS the bar area — the bar's `height: X%` resolves against
            // exactly the box the gridlines and ticks span.
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5">
              {showValues && <span className="shrink-0 text-[0.75rem] tabular-nums text-[color:var(--fr-barchart-axis,currentColor)]">{fmt(d.value)}</span>}
              <div className={cn('w-full shrink-0 min-h-[2px] transition-all cursor-pointer hover:brightness-110', radiusClass)} style={{ height: `${pct}%`, background: color, opacity: barOpacity }} title={markTitle} aria-hidden />
            </div>
          );
        })}
      </div>
  );
  return withAxes(
    track,
    data.map((d) => d.label),
    data.length,
    showLegend ? <Legend mutedVar="--fr-barchart-muted" items={data.map((d) => ({ name: d.label, color: seriesColor(d.color, p.palette, 0) }))} /> : null,
    dom,
  );
}

/* ── DonutChart ─────────────────────────────────────────────────────────────── */

const DONUT_STROKE: Record<string, number> = { thin: 9, md: 16, thick: 26 };

/** A donut legend/tooltip value: prefix+grouped value+suffix, then the computed
 *  share — suppressed when the LABEL already states a percentage. */
function sliceMeta(
  label: string,
  value: number,
  total: number,
  prefix: string | null | undefined,
  suffix: string | null | undefined,
): string {
  const body = `${typeof prefix === 'string' ? prefix : ''}${formatReadout(value)}${typeof suffix === 'string' ? suffix : ''}`;
  if (/\d\s*%/.test(label) || total <= 0) return body;
  return `${body} (${Math.round((value / total) * 100)}%)`;
}

export function DonutChart({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    data?: unknown;
    thickness?: string | null;
    strokeWidth?: string | number | null;
    showTotal?: boolean | null;
    totalLabel?: string | null;
    totalValue?: unknown;
    weight?: string | null;
    fontSize?: string | number | null;
    palette?: string | null;
    height?: string | null;
    showLegend?: boolean | null;
    showValues?: boolean | null;
    valueFormat?: string | null;
    valuePrefix?: string | null;
    valueSuffix?: string | null;
    mutedColor?: string | null;
    trackColor?: string | null;
    axisColor?: string | null;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const raw = Array.isArray(p.data) ? p.data : [];
  const data = raw
    .map((d) => {
      const o = (d ?? {}) as { label?: string | null; value?: unknown; color?: string | null };
      return { label: typeof o.label === 'string' ? o.label : '', value: typeof o.value === 'number' && Number.isFinite(o.value) && o.value > 0 ? o.value : null, color: o.color };
    })
    .filter((d): d is { label: string; value: number; color: string | null | undefined } => d.value !== null);

  if (data.length === 0)
    return <EmptyChart height={p.height} label="Donut chart" mutedVar="--fr-donutchart-muted" mutedColor={p.mutedColor} message={p.emptyText} />;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  // The REPORTED total wins over the summed one. A spec that carries the
  // headline figure (`totalValue: 130.11`) is stating the number the source
  // published; the slice sum is a rounding of it and printing the sum instead
  // contradicts the prose beside the chart.
  const printedTotal = typeof p.totalValue === 'number' && Number.isFinite(p.totalValue) ? p.totalValue : total;
  // Exact `strokeWidth` (100-unit viewBox space) wins; the `thickness` enum is
  // the default. `r` below is recomputed from this single stroke const.
  const stroke = dimNum(p.strokeWidth, 2, 48) ?? DONUT_STROKE[p.thickness ?? 'md'] ?? DONUT_STROKE.md;
  const showLegend = p.showLegend !== false;
  const showTotal = p.showTotal !== false;
  const showValues = p.showValues === true;

  // Geometry: a 100×100 viewBox ring; segments via stroke-dasharray on a circle.
  const r = 50 - stroke / 2 - 1;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const computed = `Donut chart: ${data.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(', ')}`;
  const summary = typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0 ? p.ariaLabel : computed;

  return (
    <div
      className={cn(chartWrap)}
      style={styleVars(
        { var: '--fr-donutchart-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-donutchart-track', value: p.trackColor, kind: 'color' },
        { var: '--fr-donutchart-axis', value: p.axisColor, kind: 'color' },
        { var: '--fr-donutchart-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      <div
        className="relative mx-auto aspect-square w-full max-w-[220px] shrink-0 [height:var(--fr-chart-height,200px)]"
        role="img"
        aria-label={summary}
        style={styleVars({ var: '--fr-chart-height', value: p.height, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 800 } })}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx={50} cy={50} r={r} fill="none" stroke="var(--fr-donutchart-track, var(--color-muted))" strokeWidth={stroke} />
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * circ;
            // A thin GAP between slices so adjacent segments never touch: with
            // butt caps the last-drawn segment's anti-aliased edge otherwise bleeds
            // ~1px over its neighbour at the wrap seam (the "green over blue" tell).
            // The gap shows the muted track through, a standard donut separator.
            const gap = data.length > 1 ? 1.25 : 0;
            const visible = Math.max(dash - gap, 0.01);
            // Uniform viewBox (no preserveAspectRatio="none") → the centre pop
            // is safe: the hovered segment grows OUTWARD from the ring centre.
            const seg = (
              <circle
                key={i}
                className={MARK_POP_CENTER}
                cx={50}
                cy={50}
                r={r}
                fill="none"
                stroke={seriesColor(d.color, p.palette, i)}
                strokeWidth={stroke}
                strokeDasharray={`${visible.toFixed(2)} ${(circ - visible).toFixed(2)}`}
                strokeDashoffset={(-offset).toFixed(2)}
                strokeLinecap="butt"
              >
                <title>{`${d.label || `Slice ${i + 1}`} — ${sliceMeta(d.label, d.value, total, p.valuePrefix, p.valueSuffix)}`}</title>
              </circle>
            );
            offset += dash;
            return seg;
          })}
        </svg>
        {showTotal && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className={cn(
                // The donut's single KPI reads the family value-annotation channel
                // (axisColor -> --fr-donutchart-axis) with the chart's INHERITED ink
                // folded in as the var fallback (byte-identical computed default when
                // unset, since .frayme-root's color and --color-foreground are the same
                // var). It hangs in the donut hole — the container's surface, never its
                // own fill — so the old --color-foreground token was a hard reset that
                // put near-black on an authored dark Card. See chartWrap's note.
                '[font-size:var(--fr-donutchart-fs,1.375rem)] font-semibold leading-none tabular-nums text-[color:var(--fr-donutchart-axis,currentColor)]',
                weightClass(p.weight),
              )}
            >
              {formatValue(printedTotal, p.valueFormat, p.valuePrefix, p.valueSuffix)}
            </span>
            <span className="text-[0.6875rem] uppercase tracking-wide [color:var(--fr-donutchart-muted,var(--color-muted-foreground))]">
              {typeof p.totalLabel === 'string' && p.totalLabel.length > 0 ? p.totalLabel : 'Total'}
            </span>
          </div>
        )}
      </div>
      {showLegend && (
        <Legend
          mutedVar="--fr-donutchart-muted"
          items={data.map((d, i) => ({
            name: d.label || `Slice ${i + 1}`,
            color: seriesColor(d.color, p.palette, i),
            // The slice value carries the chart's own prefix/suffix, and the
            // computed share is appended ONLY when the label does not already
            // state one — "Data Center (88.3%) — 115.2 (89%)" printed two
            // disagreeing percentages for the same slice.
            meta: showValues ? sliceMeta(d.label, d.value, total, p.valuePrefix, p.valueSuffix) : null,
          }))}
        />
      )}
    </div>
  );
}

/* ── Sparkline ──────────────────────────────────────────────────────────────── */

const SPARK_W = 100;
const SPARK_H = 28;

export function Sparkline({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    points?: unknown;
    type?: string | null;
    tone?: string | null;
    color?: string | null;
    height?: string | null;
    strokeWidth?: string | number | null;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const pts = finite(p.points);
  const type = p.type ?? 'line';
  // Exact `strokeWidth` (px) wins; the default line weight is 1.5.
  const strokeW = dimNum(p.strokeWidth, 0.5, 6) ?? 1.5;
  const validColor = p.color != null ? safeColor(p.color) : null;
  const color = validColor ?? TONE_COLOR[p.tone ?? 'neutral'] ?? TONE_COLOR.neutral;
  const computed = `Sparkline trend, ${pts.length} points`;
  const summary = typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0 ? p.ariaLabel : computed;

  const heightStyle = styleVars({ var: '--fr-spark-height', value: p.height, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 800 } });

  if (pts.length === 0) {
    const emptyLabel =
      typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0
        ? p.ariaLabel
        : `Sparkline: ${typeof p.emptyText === 'string' && p.emptyText.length > 0 ? p.emptyText : 'no data'}`;
    // Continuity with the trend hue: a set tone/color tints the placeholder at
    // low opacity via a var + color-mix (mutually-exclusive with the neutral
    // token branch → byte-identical when neither is set). `tint` is either a
    // safeColor-validated value or a closed TONE_COLOR token string; an invalid
    // `color` with no tone keeps the neutral token branch.
    const tint = validColor ?? (p.tone != null ? (TONE_COLOR[p.tone] ?? null) : null);
    return (
      <span
        className={cn(
          'inline-block h-7 w-24 rounded',
          tint != null
            ? '[background:color-mix(in_srgb,var(--fr-spark-tint,var(--color-muted))_15%,transparent)]'
            : 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50',
        )}
        role="img"
        aria-label={emptyLabel}
        style={tint != null ? ({ '--fr-spark-tint': tint } as CSSProperties) : undefined}
      />
    );
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const coords = pts.map((v, i) => {
    const x = pts.length === 1 ? SPARK_W / 2 : (i / (pts.length - 1)) * SPARK_W;
    const y = SPARK_H - 1 - ((v - min) / span) * (SPARK_H - 2);
    return [x, y] as [number, number];
  });

  return (
    // A sparkline is too small for per-point marks: ONE <title> summarising
    // min/max/last rides on the svg, and the whole svg carries the filter-only
    // brightness affordance (preserveAspectRatio="none" → never a transform pop).
    <svg
      className="inline-block w-24 align-middle [height:var(--fr-spark-height,1.75rem)] cursor-pointer transition-[filter] duration-200 ease-out hover:brightness-110"
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={summary}
      style={heightStyle}
    >
      <title>{`${pts.length} points — min ${min}, max ${max}, last ${pts[pts.length - 1]}`}</title>
      {type === 'bar'
        ? (() => {
            const n = pts.length;
            const bw = (SPARK_W / n) * 0.7;
            const gap = (SPARK_W / n) * 0.3;
            return pts.map((v, i) => {
              const h = Math.max(((v - min) / span) * (SPARK_H - 2), 1);
              const x = i * (SPARK_W / n) + gap / 2;
              return <rect key={i} x={x.toFixed(2)} y={(SPARK_H - h).toFixed(2)} width={bw.toFixed(2)} height={h.toFixed(2)} fill={color} rx={0.5} />;
            });
          })()
        : (
            <>
              {type === 'area' && (
                <path
                  d={`M ${coords[0][0].toFixed(2)} ${SPARK_H} L ${coords.map((c) => `${c[0].toFixed(2)} ${c[1].toFixed(2)}`).join(' L ')} L ${coords[coords.length - 1][0].toFixed(2)} ${SPARK_H} Z`}
                  fill={color}
                  fillOpacity={0.2}
                  stroke="none"
                />
              )}
              <polyline
                points={coords.map((c) => `${c[0].toFixed(2)},${c[1].toFixed(2)}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={strokeW}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
    </svg>
  );
}
