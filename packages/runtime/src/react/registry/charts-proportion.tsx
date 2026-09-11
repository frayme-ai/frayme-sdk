'use client';
import type { ReactNode } from 'react';
import type { ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { AxisTitle, compactNum, niceScale } from './charts.js';
import { safeColor } from '@frayme/catalog/validate';

/* Catalog group (charts-proportion): PieChart · FunnelChart · ScatterChart ·
 * RadarChart · Sankey.
 *
 * Same truly-dynamic contract as the shipped charts:
 *   - ENUM props → static classes (a closed set of allowed values).
 *   - VALUE props (a per-item `color`, the `height`) NEVER become classes. The
 *     `height` lands in `--fr-chart-height` via `styleVars(...)`, read by a STATIC
 *     `[height:var(--fr-chart-height,…)]` utility. A per-item `color` is
 *     re-validated here via `safeColor` and applied as an SVG `fill`/`stroke`
 *     ATTRIBUTE (a presentation attribute carrying a validated value — never a
 *     class, never a CSS-property string from the spec).
 *
 * CHART SECURITY (non-negotiable): the `<svg>` markup is OURS (path / rect /
 * circle / line / polygon / polyline / text). The spec supplies only NUMBERS +
 * labels + a validated color. We filter every series to FINITE numbers and
 * COMPUTE every coordinate, normalizing into a fixed viewBox. A spec value never
 * becomes markup. Empty/all-invalid data → a muted "No data" state. Each chart is
 * `role="img"` with an `aria-label` summarizing it (a11y for non-text content).
 */

/* ── palette: the named, token-based series-color sets (local copy) ────────────
 * Adjacent slots must resolve to DIFFERENT colours or two series share one swatch
 * and the legend stops mapping colour→name: `--color-info` resolves to the same hex
 * as `--color-primary`, so `cool` leads with its own cyan instead of that token. */
const PALETTES: Record<string, string[]> = {
  brand: [
    'var(--color-primary)',
    '#38bdf8',
    '#2dd4bf',
    '#fbbf24',
    '#fb7185',
  ],
  cool: ['#0891b2', 'var(--color-primary)', 'var(--color-success)', '#0ea5e9', '#14b8a6'],
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

/** A per-item color: a validated `color` wins, else the palette slot (wrapping).
 *  Re-validated here (defence in depth — the spec is untrusted even past the
 *  gate); an invalid value falls back to the slot. */
function seriesColor(itemColor: unknown, palette: string | null | undefined, index: number): string {
  if (itemColor != null) {
    const safe = safeColor(itemColor);
    if (safe !== null) return safe;
  }
  const set = PALETTES[palette ?? 'brand'] ?? PALETTES.brand;
  return set[index % set.length];
}

const HEIGHT_OPTS = { units: ['px', 'rem'] as Array<'px' | 'rem'>, min: 80, max: 800 };
const heightVar = (value: unknown) =>
  styleVars({ var: '--fr-chart-height', value, kind: 'dim', opts: HEIGHT_OPTS });

/* The settable secondary/muted-text colour channel. Each chart sets a per-component
 * `--fr-<comp>-muted` var on its ROOT from `p.mutedColor` (token fallback baked in),
 * and the shared Legend / empty-state read it via a passed var name. A props-less
 * spec resolves to `--color-muted-foreground` — identical to the default. */
type MutedVar = `--fr-${string}-muted`;
const mutedClass = (cssVar: MutedVar) => `[color:var(${cssVar},var(--color-muted-foreground))]`;

/* Hover affordance for discrete chart marks — a subtle modern "pop" on hover.
 * `_CENTER` scales an SVG mark from the viewBox centre (a pie wedge / radar series
 * grows OUTWARD from the chart centre); `_SELF` scales an SVG mark in place from
 * its own bounding box (a funnel band / sankey node). The scale is gated behind
 * `motion-safe:` so reduced-motion users get the cursor affordance with no
 * movement; `transform-box`/`transform-origin` are the SVG-specific bits that make
 * the scale anchor correctly. cursor-pointer signals the mark is the data point. */
const MARK_POP_CENTER =
  'cursor-pointer transition-transform duration-200 ease-out motion-safe:hover:scale-105 [transform-box:view-box] [transform-origin:50%_50%]';
const MARK_POP_SELF =
  'cursor-pointer transition-transform duration-200 ease-out motion-safe:hover:scale-[1.05] [transform-box:fill-box] [transform-origin:center]';

/* ── shared chrome ──────────────────────────────────────────────────────────── */

const chartWrap = 'flex w-full flex-col gap-2 text-[color:var(--fr-surface-fg,var(--color-foreground))]';
const plotBox = 'relative w-full [height:var(--fr-chart-height,220px)]';
const emptyState =
  'flex w-full items-center justify-center rounded-frayme border border-dashed border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]/40 py-10 text-sm [height:var(--fr-chart-height,160px)]';

function EmptyChart({
  height,
  label,
  mutedVar,
  mutedColor,
  emptyText,
}: {
  height?: unknown;
  label: string;
  mutedVar: MutedVar;
  mutedColor?: unknown;
  emptyText?: unknown;
}): ReactNode {
  const message = typeof emptyText === 'string' && emptyText.trim() !== '' ? emptyText : 'No data';
  return (
    <div
      className={cn(emptyState, mutedClass(mutedVar))}
      role="img"
      aria-label={`${label}: ${message}`}
      style={{ ...heightVar(height), ...styleVars({ var: mutedVar, value: mutedColor, kind: 'color' }) }}
    >
      {message}
    </div>
  );
}

/** Resolve a spec `ariaLabel` override to a usable string, else the computed summary. */
function ariaOf(ariaLabel: unknown, summary: string): string {
  return typeof ariaLabel === 'string' && ariaLabel.trim() !== '' ? ariaLabel : summary;
}

/** A simple legend (color swatch + name + optional meta). The `mutedVar` names the
 *  per-component muted-text var the enclosing chart root sets.
 *  Names WRAP, never clip — the `ul` wraps items already, and a slice key with a
 *  word deleted no longer names the slice it keys. */
function Legend({ items, mutedVar }: { items: Array<{ name: string; color: string; meta?: string | null }>; mutedVar: MutedVar }): ReactNode {
  return (
    <ul className={cn('m-0 flex min-w-0 list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[0.8125rem]', mutedClass(mutedVar))}>
      {items.map((it, i) => (
        <li key={i} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} aria-hidden />
          {/* LEAF: no min-w-0 — the name's own min-content (its longest word) is
              the floor; min-w-0 let the box shrink under it and shattered the key
              one character per line. break-words still breaks an over-long word. */}
          <span className="break-words" title={it.name || undefined}>{it.name}</span>
          {it.meta != null && <span className="shrink-0 tabular-nums text-[color:var(--fr-surface-fg,var(--color-foreground))]">{it.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Finite numbers only — drops NaN/Infinity/non-number. */
function finiteOf(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/* Exact numeric dimension channel for chart presentation attributes (SVG
 * stroke-width, HTML dot px). Parses a spec number or px string, clamps into
 * [lo, hi], and returns null when not finite — so the caller falls back to the
 * enum constant. Per the chart-security contract these land as SVG/HTML
 * presentation values (a NUMBER), never a class or CSS var from the spec. */
function dimNum(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null;
}

/* ── PieChart ───────────────────────────────────────────────────────────────── */

const LABEL_FONT: Record<string, string> = { sm: '0.75rem', md: '0.8125rem', lg: '0.875rem' };

export function PieChart({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    data?: unknown;
    palette?: string | null;
    height?: unknown;
    showLegend?: boolean | null;
    showValues?: boolean | null;
    mutedColor?: unknown;
    separatorColor?: unknown;
    emptyText?: unknown;
    ariaLabel?: unknown;
  };
  const raw = Array.isArray(p.data) ? p.data : [];
  const data = raw
    .map((d) => {
      const o = (d ?? {}) as { label?: unknown; value?: unknown; color?: unknown };
      const value = finiteOf(o.value);
      return {
        label: typeof o.label === 'string' ? o.label : '',
        value: value != null && value > 0 ? value : null,
        color: o.color,
      };
    })
    .filter((d): d is { label: string; value: number; color: unknown } => d.value !== null);

  if (data.length === 0)
    return (
      <EmptyChart
        height={p.height}
        label="Pie chart"
        mutedVar="--fr-pie-muted"
        mutedColor={p.mutedColor}
        emptyText={p.emptyText}
      />
    );

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const showLegend = p.showLegend !== false;
  const showValues = p.showValues === true;

  // Build wedge arcs on a 100x100 viewBox (center 50,50, r 48).
  const CX = 50;
  const CY = 50;
  const R = 48;
  let angle = -Math.PI / 2; // start at top
  const wedges = data.map((d, i) => {
    const frac = d.value / total;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const x1 = CX + R * Math.cos(start);
    const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(end);
    const y2 = CY + R * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    // A single full slice (frac ~ 1) can't be drawn as an arc with identical
    // endpoints — fall back to a full circle.
    const dPath =
      frac >= 0.999
        ? `M ${CX} ${(CY - R).toFixed(3)} A ${R} ${R} 0 1 1 ${CX} ${(CY + R).toFixed(3)} A ${R} ${R} 0 1 1 ${CX} ${(CY - R).toFixed(3)} Z`
        : `M ${CX} ${CY} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
    return { dPath, color: seriesColor(d.color, p.palette, i), pct: Math.round(frac * 100) };
  });

  const summary = `Pie chart: ${data.map((d) => `${d.label || 'slice'} ${Math.round((d.value / total) * 100)}%`).join(', ')}`;

  return (
    <div
      className={cn(chartWrap)}
      style={styleVars(
        { var: '--fr-pie-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-pie-sep', value: p.separatorColor, kind: 'color' },
      )}
    >
      <div
        className="relative mx-auto aspect-square w-full max-w-[220px] shrink-0 [height:var(--fr-chart-height,220px)]"
        role="img"
        aria-label={ariaOf(p.ariaLabel, summary)}
        style={heightVar(p.height)}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
          {wedges.map((w, i) => (
            <path key={i} className={MARK_POP_CENTER} d={w.dPath} fill={w.color} stroke="var(--fr-pie-sep, var(--color-card))" strokeWidth={0.75}>
              <title>{`${data[i].label || `Slice ${i + 1}`} — ${w.pct}%`}</title>
            </path>
          ))}
        </svg>
      </div>
      {showLegend && (
        <Legend
          mutedVar="--fr-pie-muted"
          items={data.map((d, i) => ({
            name: d.label || `Slice ${i + 1}`,
            color: seriesColor(d.color, p.palette, i),
            meta: showValues ? `${Math.round((d.value / total) * 100)}%` : null,
          }))}
        />
      )}
    </div>
  );
}

/* ── FunnelChart ────────────────────────────────────────────────────────────── */

/* A funnel is an ORDINAL SEQUENCE, not a set of categories, so it does NOT take a
 * categorical palette: hue changes down the stages read as "different kinds of
 * thing" (a green mid-stage as "good", a teal one as another series) and the sets
 * wrap after 5-6 slots, so a longer funnel repeats a colour it has already spent.
 * Stages take a single-hue ramp instead — one head stepped toward the card surface
 * — so any stage count reads as one ordered scale, and every step stays theme-
 * correct because it mixes toward `--color-card`, which flips with the theme. The
 * head is keyed off the `palette` ENUM (a closed set), never off a spec value.
 *
 * Each head must render VISIBLY differently from the others or the enum is
 * decoration that the schema then has to lie about. Two constraints follow:
 * `--color-info` resolves to the same hex as `--color-primary`, so `cool` carries
 * its own teal rather than that token; and `categorical` names a set of DISTINCT
 * hues, which is the one thing an ordered funnel must not do, so it resolves to the
 * brand ramp — the schema states that rather than promising distinct hues. */
const RAMP_HEAD: Record<string, string> = {
  brand: 'var(--color-primary)',
  cool: '#14b8a6',
  warm: 'var(--color-warning)',
  categorical: 'var(--color-primary)',
  mono: 'var(--color-foreground)',
};

/* The ramp's tint and `fillOpacity` are ONE channel, not two: a band painted
 * `color-mix(in srgb, head P%, card)` at alpha A over that same card composites to
 * exactly A×P of the head, so a ramp in P and a translucent A MULTIPLY. The ramp is
 * therefore expressed in COMPOSITED ink and the alpha divided back out, with the
 * tail floored at RAMP_TAIL_INK — the least head-ink a band can carry and still be
 * told apart from the card. Under the floor the late stages read as blank card and
 * the ordinal step the ramp exists to carry is gone. */
const RAMP_TAIL_FRACTION = 0.38; // deepest stage = this share of the head's ink
const RAMP_TAIL_INK = 0.16;

/** A stage colour: a validated per-stage `color` wins (re-validated here — the spec
 *  is untrusted even past the gate), else this stage's step on the ramp, densest
 *  first so the widest band carries the most ink. `alpha` is the fill opacity the
 *  band will be painted at; the ramp is cut to fit inside it. */
function stageColor(
  itemColor: unknown,
  palette: string | null | undefined,
  index: number,
  count: number,
  alpha: number,
): string {
  if (itemColor != null) {
    const safe = safeColor(itemColor);
    if (safe !== null) return safe;
  }
  const head = RAMP_HEAD[palette ?? 'brand'] ?? RAMP_HEAD.brand;
  const step = count > 1 ? index / (count - 1) : 0;
  const tailInk = Math.max(alpha * RAMP_TAIL_FRACTION, Math.min(alpha, RAMP_TAIL_INK));
  const ink = alpha - step * (alpha - tailInk);
  return `color-mix(in srgb, ${head} ${Math.round((ink / alpha) * 100)}%, var(--color-card))`;
}

export function FunnelChart({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    stages?: unknown;
    orientation?: string | null;
    palette?: string | null;
    height?: unknown;
    size?: string | null;
    showValues?: boolean | null;
    showPercent?: boolean | null;
    mutedColor?: unknown;
    fillOpacity?: string | null;
    emptyText?: unknown;
    ariaLabel?: unknown;
  };
  const raw = Array.isArray(p.stages) ? p.stages : [];
  const stages = raw
    .map((s) => {
      const o = (s ?? {}) as { label?: unknown; value?: unknown; color?: unknown };
      const value = finiteOf(o.value);
      return {
        label: typeof o.label === 'string' ? o.label : '',
        value: value != null && value >= 0 ? value : null,
        color: o.color,
      };
    })
    .filter((s): s is { label: string; value: number; color: unknown } => s.value !== null);

  if (stages.length === 0)
    return (
      <EmptyChart
        height={p.height}
        label="Funnel chart"
        mutedVar="--fr-funnel-muted"
        mutedColor={p.mutedColor}
        emptyText={p.emptyText}
      />
    );

  const horizontal = (p.orientation ?? 'vertical') === 'horizontal';
  const showValues = p.showValues !== false;
  const showPercent = p.showPercent === true;
  // With both figures off there is nothing for a leader to lead to.
  const hasFigure = showValues || showPercent;
  // Band fill weight: `soft` → a lighter translucent fill; default keeps 0.92.
  // This alpha is also the stage ramp's whole ink budget — `stageColor` cuts the
  // ramp to fit inside it, so a translucent fill shallows the ramp instead of
  // compounding with it.
  const bandFillOpacity = p.fillOpacity === 'soft' ? 0.22 : 0.92;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const fontSize = LABEL_FONT[size] ?? LABEL_FONT.md;
  const max = Math.max(...stages.map((s) => s.value), 1);
  const first = stages[0].value || 1;

  // Lay stages on a fixed 100x100 viewBox. For vertical: each stage is a band
  // of height (100/n), width proportional to value/max, centered. For
  // horizontal we render the same geometry rotated by swapping x/y roles.
  const n = stages.length;
  const VIEW = 100;
  const gap = 1.5;
  const band = (VIEW - gap * (n - 1)) / n;
  // Band and swatch read the same ramp step — resolved once so they cannot drift.
  const stageColors = stages.map((s, i) => stageColor(s.color, p.palette, i, n, bandFillOpacity));

  const summary = `Funnel chart: ${stages.map((s) => `${s.label || 'stage'} ${s.value}`).join(', ')}`;

  return (
    <div className={chartWrap} style={styleVars({ var: '--fr-funnel-muted', value: p.mutedColor, kind: 'color' })}>
      <div className={plotBox} style={heightVar(p.height)}>
        <svg
          className="h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaOf(p.ariaLabel, summary)}
        >
          {stages.map((s, i) => {
            const wThis = (s.value / max) * VIEW;
            const next = stages[i + 1];
            const wNext = next != null ? (Math.max(next.value, 0) / max) * VIEW : wThis;
            const color = stageColors[i];
            // Position along the main axis.
            const a0 = i * (band + gap);
            const a1 = a0 + band;
            // Trapezoid: top edge width wThis, bottom edge width wNext, centered.
            let points: string;
            if (horizontal) {
              // main axis = x; cross axis = y (centered around 50)
              const half0 = wThis / 2;
              const half1 = wNext / 2;
              points = `${a0},${(50 - half0).toFixed(2)} ${a1},${(50 - half1).toFixed(2)} ${a1},${(50 + half1).toFixed(2)} ${a0},${(50 + half0).toFixed(2)}`;
            } else {
              const half0 = wThis / 2;
              const half1 = wNext / 2;
              points = `${(50 - half0).toFixed(2)},${a0} ${(50 + half0).toFixed(2)},${a0} ${(50 + half1).toFixed(2)},${a1} ${(50 - half1).toFixed(2)},${a1}`;
            }
            return (
              <polygon key={i} className={MARK_POP_SELF} points={points} fill={color} fillOpacity={bandFillOpacity}>
                <title>{`${s.label || `Stage ${i + 1}`} — ${s.value}`}</title>
              </polygon>
            );
          })}
        </svg>
      </div>
      {/* Labels in normal flow below — readable regardless of orientation. */}
      <ul className="m-0 flex list-none flex-col gap-1 p-0" style={{ fontSize }}>
        {stages.map((s, i) => {
          const pct = Math.round((s.value / first) * 100);
          return (
            <li key={i} className="flex items-center gap-2">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: stageColors[i] }}
                  aria-hidden
                />
                <span className="break-words text-[color:var(--fr-surface-fg,var(--color-foreground))]" title={s.label || `Stage ${i + 1}`}>{s.label || `Stage ${i + 1}`}</span>
              </span>
              {/* The row spans the card, so label and figure sit at opposite edges:
                  a dotted leader carries the eye across and keeps the pair one unit.
                  It is the only flex-grow item — the label WRAPS onto a second line
                  when the row is tight (a stage name is the datum, not decoration)
                  and the figure never shrinks. */}
              {hasFigure && (
                <>
                  <span className="h-0 min-w-[1rem] flex-1 border-b border-dotted border-border" aria-hidden />
                  <span className={cn('shrink-0 tabular-nums', mutedClass('--fr-funnel-muted'))}>
                    {showValues && <span className="text-[color:var(--fr-surface-fg,var(--color-foreground))]">{s.value}</span>}
                    {showPercent && <span className="ml-2">{pct}%</span>}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── ScatterChart ───────────────────────────────────────────────────────────── */

const VIEW_W = 300;
const VIEW_H = 100;
const PAD = 6;
/* Screen-space dot diameters (px). Scatter dots are rendered as HTML, not SVG
 * <circle>, so they stay perfectly round under the non-uniform (preserveAspect-
 * Ratio="none") plot scale — a circle in a stretched viewBox would squash to an
 * ellipse. */
const DOT_PX: Record<string, number> = { sm: 6, md: 8, lg: 10 };

/** A scatter tick label: compact above 1k (the y gutter is 28px wide — "12000000"
 *  does not fit, "12M" does), 3dp below it. The 3dp rounding is what YAxisTicks'
 *  `toFixed(1)` cannot do: scatter axes are routinely rates and correlations, and
 *  a 0-0.05 domain printed at 1dp is six ticks all reading "0". It also absorbs
 *  the float fuzz a nice step leaves behind (0.8999999999999999 → 0.9). */
/* Precision comes from the STEP, not the magnitude. Routing
 * every value >= 1000 through compactNum keeps only one decimal of the k/M/B unit
 * — 100-unit resolution above 1k — so any domain whose step is finer than that
 * collapsed into a column of identical labels: a year axis (2020 · 2023 · 2026)
 * printed seven "2k", and a 1200-1260ms latency domain printed "1.3k, 1.2k, 1.2k".
 * A tick that cannot identify its own value is exactly the unreadable axis this
 * work exists to kill — the same failure the sub-1k branch already guarded against
 * at the other end of the scale. So compact ONLY when the step is at least the
 * compact unit's own resolution; otherwise print the rounded number in full. */
function tickLabel(v: number, step?: number): string {
  const abs = Math.abs(v);
  if (abs < 1000) return compactNum(Math.round(v * 1000) / 1000);
  const s = typeof step === 'number' && Number.isFinite(step) && step > 0 ? step : Infinity;
  const compactable = (abs >= 1e9 && s >= 1e8) || (abs >= 1e6 && s >= 1e5) || s >= 100;
  return compactable ? compactNum(Math.round(v)) : String(Math.round(v));
}

/* Grid divisions are PASSED IN rather than hardcoded 4×6: the rules now
 * have to land exactly on the tick values the gutters print, so both come from
 * the same `niceScale` row counts. A rule that misses its tick is the same lie an
 * unscaled tick column tells. */
function ScatterGrid({ rows, cols }: { rows: number; cols: number }): ReactNode {
  const lines: ReactNode[] = [];
  for (let i = 0; i <= rows; i++) {
    const y = PAD + (i / rows) * (VIEW_H - PAD * 2);
    lines.push(
      <line
        key={`h${i}`}
        x1={PAD}
        y1={y.toFixed(2)}
        x2={VIEW_W - PAD}
        y2={y.toFixed(2)}
        stroke="var(--fr-scatter-grid, var(--color-border))"
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  for (let i = 0; i <= cols; i++) {
    const x = PAD + (i / cols) * (VIEW_W - PAD * 2);
    lines.push(
      <line
        key={`v${i}`}
        x1={x.toFixed(2)}
        y1={PAD}
        x2={x.toFixed(2)}
        y2={VIEW_H - PAD}
        stroke="var(--fr-scatter-grid, var(--color-border))"
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return <g aria-hidden>{lines}</g>;
}

export function ScatterChart({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    series?: unknown;
    palette?: string | null;
    height?: unknown;
    size?: string | null;
    sizeValue?: unknown;
    showGrid?: boolean | null;
    showLegend?: boolean | null;
    mutedColor?: unknown;
    gridColor?: unknown;
    axisColor?: unknown;
    emptyText?: unknown;
    ariaLabel?: unknown;
    xAxisTitle?: unknown;
    yAxisTitle?: unknown;
    showYAxis?: boolean | null;
  };
  const rawSeries = Array.isArray(p.series) ? p.series : [];
  const series = rawSeries
    .map((s) => {
      const o = (s ?? {}) as { name?: unknown; points?: unknown; color?: unknown };
      const pts = (Array.isArray(o.points) ? o.points : [])
        .map((pt) => {
          const po = (pt ?? {}) as { x?: unknown; y?: unknown };
          const x = finiteOf(po.x);
          const y = finiteOf(po.y);
          return x != null && y != null ? ([x, y] as [number, number]) : null;
        })
        .filter((pt): pt is [number, number] => pt !== null);
      return { name: typeof o.name === 'string' ? o.name : '', points: pts, color: o.color };
    })
    .filter((s) => s.points.length > 0);

  if (series.length === 0)
    return (
      <EmptyChart
        height={p.height}
        label="Scatter chart"
        mutedVar="--fr-scatter-muted"
        mutedColor={p.mutedColor}
        emptyText={p.emptyText}
      />
    );

  const allX = series.flatMap((s) => s.points.map((pt) => pt[0]));
  const allY = series.flatMap((s) => s.points.map((pt) => pt[1]));
  let minX = Math.min(...allX);
  let maxX = Math.max(...allX);
  let minY = Math.min(...allY);
  let maxY = Math.max(...allY);
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  /* ── the two value axes ──────────────────────
   * Scatter is the chart where BOTH axes are measures, so unreadable axes hurt
   * most — and it was printing raw data extremes (0.37 · 4.81 · 9.25) as ticks.
   * Both axes now resolve through the family's `niceScale`, and the DOTS are
   * plotted against that same domain: a tick labelled 600 sits exactly where 600
   * is. The gridline counts come from the same row counts (see ScatterGrid), so
   * rule, tick and point can never disagree.
   * `showYAxis:false` drops the y gutter and, like LineChart, keeps the tight
   * raw domain — a reader who turned the axis off wants the cluster shape, not a
   * zero baseline. x has no such switch (its ticks are the only thing naming the
   * horizontal position), so it is always nice. */
  const showYTicks = p.showYAxis !== false;
  const domX = niceScale(minX, maxX, 6); // 6 → up to 7 columns, the old x density
  const domY = showYTicks ? niceScale(minY, maxY) : { min: minY, max: maxY, rows: 4 };
  const spanX = domX.max - domX.min || 1;
  const spanY = domY.max - domY.min || 1;
  const px = (x: number) => PAD + ((x - domX.min) / spanX) * (VIEW_W - PAD * 2);
  const py = (y: number) => VIEW_H - PAD - ((y - domY.min) / spanY) * (VIEW_H - PAD * 2);

  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  // Exact `sizeValue` (px, clamped 2-24) wins; else the `size` enum's dot scale.
  const dotPx = dimNum(p.sizeValue, 2, 24) ?? DOT_PX[size] ?? DOT_PX.md;
  const showGrid = p.showGrid !== false;
  // Explicit `showLegend: true` always shows the legend (even single-series).
  const showLegend = p.showLegend === true || (p.showLegend !== false && series.length > 1);
  const totalPoints = series.reduce((sum, s) => sum + s.points.length, 0);
  const summary = `Scatter chart: ${series.length} series, ${totalPoints} points`;

  // y-axis tick labels (top→bottom = domY.max→domY.min), one per gridline row.
  // Rendered as HTML (not SVG <text>) so they stay legible under the non-uniform
  // preserveAspectRatio="none" plot scale. Colour reads --fr-scatter-axis.
  // `yView` is `py(value)` reduced — same domain, same formula, so a tick label
  // and the dots it measures cannot drift apart.
  const yTicks = Array.from({ length: domY.rows + 1 }, (_, i) => {
    const frac = i / domY.rows; // 0 = top
    const value = domY.max - frac * (domY.max - domY.min);
    const yView = PAD + frac * (VIEW_H - PAD * 2);
    return { topPct: ((yView / VIEW_H) * 100).toFixed(2), label: tickLabel(value, (domY.max - domY.min) / domY.rows) };
  });

  // x-axis tick labels (left→right = domX.min→domX.max), mirroring the y-tick
  // approach across the x grid. Rendered as an HTML row under the plot,
  // one per gridline, coloured by --fr-scatter-axis. The point positions along x
  // were unreadable without these.
  const xTicks = Array.from({ length: domX.rows + 1 }, (_, i) => {
    const frac = i / domX.rows; // 0 = left
    const value = domX.min + frac * (domX.max - domX.min);
    return { leftPct: (PAD + frac * (VIEW_W - PAD * 2)) / VIEW_W, label: tickLabel(value, (domX.max - domX.min) / domX.rows) };
  });

  // The y gutter's width, spelled as whole static classes (Tailwind scans source
  // text — a computed `left-${n}` would never be generated).
  const gutter = showYTicks ? 'left-7' : 'left-0';
  const padLeft = showYTicks ? 'pl-7' : 'pl-0';

  return (
    <div
      className={chartWrap}
      style={styleVars(
        { var: '--fr-scatter-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-scatter-grid', value: p.gridColor, kind: 'color' },
        { var: '--fr-scatter-axis', value: p.axisColor, kind: 'color' },
      )}
    >
      <AxisTitle text={p.yAxisTitle} axisVar="--fr-scatter-axis" align="left" />
      <div className={plotBox} style={heightVar(p.height)} role="img" aria-label={ariaOf(p.ariaLabel, summary)}>
        {/* y-axis tick labels down the left gutter (HTML so they don't distort).
            Dropped by showYAxis:false — and the plot layers below reclaim the
            gutter (`left-0`) so nothing is left indented against a dead margin. */}
        {showYTicks && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-7" aria-hidden>
            {yTicks.map((t, i) => (
              <span
                key={i}
                className="absolute right-1 -translate-y-1/2 text-[0.625rem] tabular-nums [color:var(--fr-scatter-axis,var(--color-muted-foreground))]"
                style={{ top: `${t.topPct}%` }}
              >
                {t.label}
              </span>
            ))}
          </div>
        )}
        {/* gridlines live in the stretched SVG (distortion is invisible on lines);
            the dots are HTML so they stay perfectly round at any plot aspect. */}
        {/* Wrapper is `left-7 right-0` (the exact plot box, matching the dots
            layer below); the SVG fills it 100%. A bare `left-7 right-0` on the
            SVG itself would size to its viewBox aspect (replaced-element width:auto)
            and fall short, while `w-full` would overflow past `right-0`. */}
        <div className={`absolute inset-y-0 ${gutter} right-0`}>
          <svg className="h-full w-full" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden>
            {showGrid && <ScatterGrid rows={domY.rows} cols={domX.rows} />}
          </svg>
        </div>
        <div className={`absolute inset-y-0 ${gutter} right-0`}>
          {series.map((s, si) => {
            const color = seriesColor(s.color, p.palette, si);
            return s.points.map((pt, i) => (
              <span
                key={`${si}-${i}`}
                title={`${s.name || `Series ${si + 1}`} — (${pt[0]}, ${pt[1]})`}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full opacity-[0.78] transition-transform duration-150 ease-out hover:opacity-100 motion-safe:hover:scale-[1.7]"
                style={{
                  left: `${((px(pt[0]) / VIEW_W) * 100).toFixed(2)}%`,
                  top: `${((py(pt[1]) / VIEW_H) * 100).toFixed(2)}%`,
                  width: dotPx,
                  height: dotPx,
                  background: color,
                }}
              />
            ));
          })}
        </div>
      </div>
      {/* x-axis tick labels under the plot, aligned to its inner `left-7` gutter
          via `pl-7` (both collapse together when the y axis is off); each tick is
          absolutely positioned by its fraction across the plot width. HTML (not
          SVG <text>) so labels stay legible. */}
      <div className={`relative h-4 w-full ${padLeft}`} aria-hidden>
        <div className="relative h-full w-full">
          {xTicks.map((t, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 text-[0.625rem] tabular-nums [color:var(--fr-scatter-axis,var(--color-muted-foreground))]"
              style={{ left: `${(t.leftPct * 100).toFixed(2)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <AxisTitle text={p.xAxisTitle} axisVar="--fr-scatter-axis" />
      {showLegend && (
        <Legend
          mutedVar="--fr-scatter-muted"
          items={series.map((s, si) => ({ name: s.name || `Series ${si + 1}`, color: seriesColor(s.color, p.palette, si) }))}
        />
      )}
    </div>
  );
}

/* ── RadarChart ─────────────────────────────────────────────────────────────── */

export function RadarChart({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    axes?: unknown;
    series?: unknown;
    palette?: string | null;
    height?: unknown;
    showLegend?: boolean | null;
    mutedColor?: unknown;
    gridColor?: unknown;
    axisColor?: unknown;
    strokeWidth?: unknown;
    fillOpacity?: string | null;
    emptyText?: unknown;
    ariaLabel?: unknown;
  };
  const axes = (Array.isArray(p.axes) ? p.axes : []).filter((a): a is string => typeof a === 'string');
  const rawSeries = Array.isArray(p.series) ? p.series : [];
  const series = rawSeries
    .map((s) => {
      const o = (s ?? {}) as { name?: unknown; values?: unknown; color?: unknown };
      const values = (Array.isArray(o.values) ? o.values : []).map((v) => {
        const n = finiteOf(v);
        return n != null ? Math.max(0, n) : 0;
      });
      return { name: typeof o.name === 'string' ? o.name : '', values, color: o.color };
    })
    .filter((s) => s.values.some((v) => v > 0) || s.values.length > 0);

  if (axes.length < 3 || series.length === 0)
    return (
      <EmptyChart
        height={p.height}
        label="Radar chart"
        mutedVar="--fr-radar-muted"
        mutedColor={p.mutedColor}
        emptyText={p.emptyText}
      />
    );

  const N = axes.length;
  const CX = 50;
  const CY = 50;
  const R = 38;
  // Max across all series (clamped values, missing → 0).
  const maxVal =
    series.reduce((m, s) => {
      for (let i = 0; i < N; i++) m = Math.max(m, s.values[i] ?? 0);
      return m;
    }, 0) || 1;

  const angleAt = (i: number) => (i / N) * Math.PI * 2 - Math.PI / 2; // start at top
  const point = (i: number, frac: number): [number, number] => {
    const a = angleAt(i);
    return [CX + R * frac * Math.cos(a), CY + R * frac * Math.sin(a)];
  };

  // Explicit `showLegend: true` always shows the legend (even single-series).
  const showLegend = p.showLegend === true || (p.showLegend !== false && series.length > 1);
  const summary = `Radar chart across ${axes.join(', ')}: ${series.map((s) => s.name || 'series').join(', ')}`;
  // Series area-fill weight: `soft` → a fainter fill; default keeps 0.18.
  const areaFillOpacity = p.fillOpacity === 'soft' ? 0.1 : 0.18;
  // Exact `strokeWidth` (viewBox units, clamped 0.5-6) wins; else the default 1.25.
  // Grid rings/spokes stay fixed (chrome) — only the series polygon is exposed.
  const seriesStroke = dimNum(p.strokeWidth, 0.5, 6) ?? 1.25;

  // Concentric grid rings (4) + spokes.
  const rings = [0.25, 0.5, 0.75, 1].map((frac) =>
    Array.from({ length: N }, (_, i) => point(i, frac))
      .map((pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`)
      .join(' '),
  );

  return (
    <div
      className={cn(chartWrap)}
      style={styleVars(
        { var: '--fr-radar-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-radar-grid', value: p.gridColor, kind: 'color' },
        { var: '--fr-radar-axis', value: p.axisColor, kind: 'color' },
      )}
    >
      <div
        className="relative mx-auto aspect-square w-full max-w-[240px] shrink-0 [height:var(--fr-chart-height,220px)]"
        role="img"
        aria-label={ariaOf(p.ariaLabel, summary)}
        style={heightVar(p.height)}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
          <g aria-hidden>
            {rings.map((pts, i) => (
              <polygon key={i} points={pts} fill="none" stroke="var(--fr-radar-grid, var(--color-border))" strokeWidth={0.5} />
            ))}
            {axes.map((_, i) => {
              const [x, y] = point(i, 1);
              return <line key={i} x1={CX} y1={CY} x2={x.toFixed(2)} y2={y.toFixed(2)} stroke="var(--fr-radar-grid, var(--color-border))" strokeWidth={0.5} />;
            })}
          </g>
          {series.map((s, si) => {
            const color = seriesColor(s.color, p.palette, si);
            const pts = Array.from({ length: N }, (_, i) => point(i, (s.values[i] ?? 0) / maxVal))
              .map((pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`)
              .join(' ');
            return (
              <polygon
                key={si}
                className={cn(MARK_POP_CENTER, 'transition-[transform,fill-opacity] hover:[fill-opacity:0.32]')}
                points={pts}
                fill={color}
                fillOpacity={areaFillOpacity}
                stroke={color}
                strokeWidth={seriesStroke}
                strokeLinejoin="round"
              >
                <title>{s.name || `Series ${si + 1}`}</title>
              </polygon>
            );
          })}
          {/* axis labels */}
          {axes.map((label, i) => {
            const [x, y] = point(i, 1.16);
            const anchor = x < CX - 4 ? 'end' : x > CX + 4 ? 'start' : 'middle';
            return (
              <text key={i} x={x.toFixed(2)} y={y.toFixed(2)} fontSize={4} textAnchor={anchor} dominantBaseline="middle" fill="var(--fr-radar-axis, var(--color-muted-foreground))">
                {label}
              </text>
            );
          })}
        </svg>
      </div>
      {showLegend && (
        <Legend
          mutedVar="--fr-radar-muted"
          items={series.map((s, si) => ({ name: s.name || `Series ${si + 1}`, color: seriesColor(s.color, p.palette, si) }))}
        />
      )}
    </div>
  );
}

/* ── Sankey ─────────────────────────────────────────────────────────────────── */

const NODE_W: Record<string, number> = { thin: 4, md: 8, thick: 14 };

export function Sankey({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    nodes?: unknown;
    links?: unknown;
    palette?: string | null;
    height?: unknown;
    nodeWidth?: string | null;
    showValues?: boolean | null;
    showLegend?: boolean | null;
    fillOpacity?: string | null;
    mutedColor?: unknown;
    emptyText?: unknown;
    ariaLabel?: unknown;
  };
  const rawNodes = Array.isArray(p.nodes) ? p.nodes : [];
  const nodes = rawNodes.map((nd) => {
    const o = (nd ?? {}) as { label?: unknown; color?: unknown };
    return { label: typeof o.label === 'string' ? o.label : '', color: o.color };
  });
  const nodeCount = nodes.length;

  // Drop links with non-finite value or out-of-range / self index.
  const rawLinks = Array.isArray(p.links) ? p.links : [];
  const links = rawLinks
    .map((lk) => {
      const o = (lk ?? {}) as { source?: unknown; target?: unknown; value?: unknown; color?: unknown };
      const source = finiteOf(o.source);
      const target = finiteOf(o.target);
      const value = finiteOf(o.value);
      return source != null && target != null && value != null
        ? { source: Math.trunc(source), target: Math.trunc(target), value: Math.max(0, value), color: o.color }
        : null;
    })
    .filter(
      (lk): lk is { source: number; target: number; value: number; color: unknown } =>
        lk !== null &&
        lk.source >= 0 &&
        lk.source < nodeCount &&
        lk.target >= 0 &&
        lk.target < nodeCount &&
        lk.source !== lk.target &&
        lk.value > 0,
    );

  if (nodeCount === 0 || links.length === 0)
    return (
      <EmptyChart
        height={p.height}
        label="Sankey diagram"
        mutedVar="--fr-sankey-muted"
        mutedColor={p.mutedColor}
        emptyText={p.emptyText}
      />
    );

  // ── level (column) assignment via a bounded longest-path from any "source"
  // node (a node with no incoming links). Defensive: cap iterations so a cycle
  // can never loop forever; unlevelled nodes default to 0.
  const level = new Array<number>(nodeCount).fill(0);
  const hasIncoming = new Array<boolean>(nodeCount).fill(false);
  for (const lk of links) hasIncoming[lk.target] = true;
  // Relax edges up to nodeCount times (Bellman-Ford-style longest path on a DAG;
  // bounded so cycles terminate).
  for (let pass = 0; pass < nodeCount; pass++) {
    let changed = false;
    for (const lk of links) {
      if (level[lk.target] < level[lk.source] + 1) {
        level[lk.target] = level[lk.source] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Nodes with no incoming AND no outgoing stay at column 0; that's fine.
  void hasIncoming;
  const maxLevel = Math.max(...level, 0);
  const columns = maxLevel + 1;

  // Node throughput = max(in, out) so the bar height covers its flows.
  const inFlow = new Array<number>(nodeCount).fill(0);
  const outFlow = new Array<number>(nodeCount).fill(0);
  for (const lk of links) {
    outFlow[lk.source] += lk.value;
    inFlow[lk.target] += lk.value;
  }
  const throughput = nodes.map((_, i) => Math.max(inFlow[i], outFlow[i], 0));

  // ── layout on a fixed 100x100 viewBox.
  const VIEW = 100;
  const nw = NODE_W[p.nodeWidth ?? 'md'] ?? NODE_W.md;
  const colGap = columns > 1 ? (VIEW - nw) / (columns - 1) : 0;
  const colX = (lvl: number) => (columns > 1 ? lvl * colGap : (VIEW - nw) / 2);

  // Group nodes by column, scale heights so each column's nodes + gaps fit 100.
  const VGAP = 3;
  const byCol: number[][] = Array.from({ length: columns }, () => []);
  nodes.forEach((_, i) => byCol[level[i]].push(i));

  type NodeBox = { x: number; y: number; h: number };
  const boxes = new Array<NodeBox>(nodeCount);
  for (let c = 0; c < columns; c++) {
    const ids = byCol[c];
    const sumThru = ids.reduce((s, id) => s + throughput[id], 0) || 1;
    const gaps = VGAP * Math.max(0, ids.length - 1);
    const avail = Math.max(VIEW - gaps, 10);
    let y = 0;
    for (const id of ids) {
      const h = Math.max((throughput[id] / sumThru) * avail, 2);
      boxes[id] = { x: colX(c), y, h };
      y += h + VGAP;
    }
  }

  // ── link bands: track a running offset on each node's source/target edge.
  const srcOffset = new Array<number>(nodeCount).fill(0);
  const tgtOffset = new Array<number>(nodeCount).fill(0);
  // Order links by source column for stable stacking.
  const orderedLinks = [...links].sort((a, b) => level[a.source] - level[b.source]);

  const summary = `Sankey diagram: ${nodeCount} nodes, ${links.length} flows`;
  // The shared chart-family fillOpacity enum, extended to the flow bands:
  // solid = heavier bands, soft = lighter; unset keeps the prior 0.22 exactly.
  const linkFillOpacity = p.fillOpacity === 'solid' ? 0.45 : p.fillOpacity === 'soft' ? 0.12 : 0.22;
  // Completes the showLegend coherence group across the chart family (default
  // true, matching the prior unconditional legend — byte-identical when unset).
  // Sankey legends are often redundant when node labels carry the story.
  const showLegend = p.showLegend !== false;

  return (
    <div className={chartWrap} style={styleVars({ var: '--fr-sankey-muted', value: p.mutedColor, kind: 'color' })}>
      <div className={plotBox} style={heightVar(p.height)}>
        <svg
          className="h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaOf(p.ariaLabel, summary)}
        >
          {/* flow bands (drawn first, under the nodes) */}
          {orderedLinks.map((lk, i) => {
            const sb = boxes[lk.source];
            const tb = boxes[lk.target];
            if (sb == null || tb == null) return null;
            const sThru = throughput[lk.source] || 1;
            const tThru = throughput[lk.target] || 1;
            const sH = (lk.value / sThru) * sb.h;
            const tH = (lk.value / tThru) * tb.h;
            const sy = sb.y + srcOffset[lk.source];
            const ty = tb.y + tgtOffset[lk.target];
            srcOffset[lk.source] += sH;
            tgtOffset[lk.target] += tH;
            const x0 = sb.x + nw;
            const x1 = tb.x;
            const xm = (x0 + x1) / 2;
            // A per-link `color` wins (re-validated in seriesColor); else the
            // source node's colour; else the palette slot.
            const color = seriesColor(lk.color ?? nodes[lk.source]?.color, p.palette, lk.source);
            // Band as a closed path: top edge bezier, down tH, bottom edge bezier back.
            const d = [
              `M ${x0.toFixed(2)} ${sy.toFixed(2)}`,
              `C ${xm.toFixed(2)} ${sy.toFixed(2)} ${xm.toFixed(2)} ${ty.toFixed(2)} ${x1.toFixed(2)} ${ty.toFixed(2)}`,
              `L ${x1.toFixed(2)} ${(ty + tH).toFixed(2)}`,
              `C ${xm.toFixed(2)} ${(ty + tH).toFixed(2)} ${xm.toFixed(2)} ${(sy + sH).toFixed(2)} ${x0.toFixed(2)} ${(sy + sH).toFixed(2)}`,
              'Z',
            ].join(' ');
            return <path key={i} d={d} fill={color} fillOpacity={linkFillOpacity} />;
          })}
          {/* node bars */}
          {nodes.map((nd, i) => {
            const b = boxes[i];
            if (b == null) return null;
            return (
              <rect key={i} className={MARK_POP_SELF} x={b.x.toFixed(2)} y={b.y.toFixed(2)} width={nw} height={b.h.toFixed(2)} rx={1} fill={seriesColor(nd.color, p.palette, i)}>
                <title>{`${nd.label || `Node ${i + 1}`} — ${Math.round(throughput[i])}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      {showLegend && (
        <Legend
          mutedVar="--fr-sankey-muted"
          items={nodes.map((nd, i) => ({
            name: nd.label || `Node ${i + 1}`,
            color: seriesColor(nd.color, p.palette, i),
            meta: p.showValues === true ? String(Math.round(throughput[i])) : null,
          }))}
        />
      )}
    </div>
  );
}
