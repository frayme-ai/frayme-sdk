'use client';
import type { CSSProperties, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { styleVars, weightClass } from './_style.js';

/* Catalog group (charts-extra): BarList, ProgressCircle, StatGroup, Heatmap, Gantt.
 *
 * Same truly-dynamic contract as the shipped 57:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (colors the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed, build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * CHARTS: every bit of <svg> markup (polyline/path/rect/circle/text) and every CSS
 * bar/cell is OURS. Coordinates/sizes are COMPUTED from the spec's NUMBERS only —
 * filtered to Number.isFinite, normalized into a fixed viewBox / a 0..100% axis.
 * The spec supplies numbers + content labels + validated colors, NEVER markup and
 * NEVER a real CSS-property string.
 *
 * Per-datum color (a bar/task `color`) routes through a PER-ELEMENT `--fr-*-fill`
 * inline var (re-validated by styleVars) read by a static arbitrary background
 * class — value > palette precedence, same technique as the shipped components.
 */

/* ── shared helpers ──────────────────────────────────────────────────────────
 * Closed palette ramps: enum key → an array of design-token references. A bar's
 * default fill is `PALETTE[name][index % len]` — the model picks the ENUM, never
 * the token string. A per-datum `color` value overrides via its own inline var. */
const PALETTE: Record<string, readonly string[]> = {
  brand: [
    'var(--color-primary)',
    '#38bdf8',
    '#2dd4bf',
    '#fbbf24',
    '#fb7185',
  ],
  cool: [
    'var(--color-info)',
    'color-mix(in srgb, var(--color-info) 70%, var(--color-success))',
    'var(--color-success)',
    'color-mix(in srgb, var(--color-info) 55%, transparent)',
    'color-mix(in srgb, var(--color-info) 35%, transparent)',
  ],
  warm: [
    'var(--color-warning)',
    'color-mix(in srgb, var(--color-warning) 65%, var(--color-danger))',
    'var(--color-danger)',
    'color-mix(in srgb, var(--color-warning) 50%, transparent)',
    'color-mix(in srgb, var(--color-danger) 40%, transparent)',
  ],
  neutral: [
    'var(--color-muted-foreground)',
    'color-mix(in srgb, var(--color-muted-foreground) 70%, transparent)',
    'color-mix(in srgb, var(--color-muted-foreground) 50%, transparent)',
    'color-mix(in srgb, var(--color-muted-foreground) 35%, transparent)',
    'color-mix(in srgb, var(--color-muted-foreground) 22%, transparent)',
  ],
};

/** Numbers from an untrusted array → only the finite ones (never crashes). */
function finiteNums(a: unknown): number[] {
  return Array.isArray(a) ? a.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [];
}

/** Exact-dimension → a clamped finite NUMBER for an SVG presentation attribute
 * (Pattern C). Accepts a number or a numeric string (e.g. "4" / "4px"); returns
 * null when not finite so the caller falls back to the enum constant. */
function dimNum(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null;
}

/* ── value formatting ────────────────────────────────────────────────
 * A bounded `format` enum shapes how a numeric annotation prints; the math lives
 * in OUR literal code. Optional plain-text prefix/suffix wrap the result. Default
 * `plain` returns the raw number → byte-identical. */
function compactNum(n: number): string {
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
  if (format === 'compact') body = compactNum(n);
  else if (format === 'percent') body = `${n}%`;
  else body = String(n);
  return `${typeof prefix === 'string' ? prefix : ''}${body}${typeof suffix === 'string' ? suffix : ''}`;
}

/* The settable secondary/muted-text colour channel (mirrors charts / charts-radial):
 * the shared empty state reads the per-component `--fr-<comp>-muted` var with the
 * muted-foreground token folded in as the var fallback. */
type MutedVar = `--fr-${string}-muted`;
const mutedClass = (cssVar: MutedVar) => `[color:var(${cssVar},var(--color-muted-foreground))]`;

/* Hover affordance for discrete chart marks — the ONE family system, ported
 * verbatim from charts-proportion / charts-radial. `_CENTER` scales an SVG mark
 * from the viewBox centre; `_SELF` scales a mark in place from its own box —
 * both `motion-safe:`-gated (reduced-motion users keep the cursor affordance
 * with no movement). In THIS family every data mark is a wide/thin CSS bar
 * (BarList fill, Gantt task bar), a small grid cell (Heatmap) or a stroke-only
 * ring (ProgressCircle arc): scaling those distorts or overlaps (the
 * Candlestick lesson), so the marks take the family's brightness affordance
 * (`MARK_BRIGHT`, radial's exact pattern) — a filter-only hover, so it stays
 * ungated. Tooltips are native `title` (attribute on HTML marks, `<title>`
 * child on SVG marks) — always React-escaped TEXT from labels/values, never
 * markup. The MARK_POP constants are kept for family parity / any future
 * uniformly-scalable mark. */
const MARK_POP_CENTER =
  'cursor-pointer transition-transform duration-200 ease-out motion-safe:hover:scale-105 [transform-box:view-box] [transform-origin:50%_50%]';
const MARK_POP_SELF =
  'cursor-pointer transition-transform duration-200 ease-out motion-safe:hover:scale-[1.05] [transform-box:fill-box] [transform-origin:center]';
// REVERTED: cursor-pointer here is a DELIBERATE, documented, tested family
// pattern — four tests assert it, and a chart mark that reveals a tooltip on
// hover is inspectable, which is what the pointer signals in every charting
// library. The dead-affordance audit flagged it because the bar FILL has no
// title of its own (its row carries it); the instrument was too strict, not
// this code. The audit now exempts a mark whose row is titled.
const MARK_BRIGHT = 'cursor-pointer transition-[filter] duration-200 ease-out hover:brightness-110';
// Family-parity re-exports are deliberate even where unused in this file.
void MARK_POP_CENTER;
void MARK_POP_SELF;

const emptyState =
  'flex w-full items-center justify-center rounded-frayme border border-dashed border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]/40 py-10 text-sm [height:var(--fr-chart-height,160px)]';

/** The family-wide empty-data state (same chrome as charts-radial / charts-proportion):
 *  a dashed muted box with a "No data" caption, overridable via `emptyText` and
 *  tinted by the component's mutedColor channel. */
function EmptyChart({
  label,
  mutedVar,
  mutedColor,
  message,
}: {
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
      style={styleVars({ var: mutedVar, value: mutedColor, kind: 'color' })}
    >
      {text}
    </div>
  );
}

/* ── BarList ──────────────────────────────────────────────────────────────── */

/* Bars are measured against a rounded-up CEILING, never the data max: scaled to
   the max, the top bar fills its whole track and reads as "complete" rather than
   "largest". The steps are fractions of a power of ten and the pick clears the
   data max by a margin, so the longest bar always stops short of the track end
   and the ceiling printed on the scale row is a round number the reader can
   calibrate the other bars against. The ceiling must also be a number the DATA
   could have produced: whole-number rows get a whole-number ceiling, and a
   percent axis stops at 100 (past-full is not a scale a reader can calibrate
   against — data that genuinely exceeds 100 keeps its own ceiling). */
const AXIS_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12] as const;
function axisCeiling(max: number, integral: boolean, cap: number | null): number {
  if (!(max > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  const f = (max / mag) * 1.05;
  // toPrecision trims the float dust of step×magnitude (1.5 × 1000) — the
  // ceiling is PRINTED on the scale row, so it has to read as a round number.
  const raw = Number(((AXIS_STEPS.find((s) => s >= f) ?? 12) * mag).toPrecision(12));
  const ceil = integral ? Math.ceil(raw) : raw;
  return cap != null && max <= cap && ceil > cap ? cap : ceil;
}

const barListRow = cva('flex flex-col', {
  variants: {
    size: { sm: 'gap-0.5 text-xs', md: 'gap-1 text-[0.8125rem]', lg: 'gap-1.5 text-sm' },
  },
  defaultVariants: { size: 'md' },
});
const barListTrack = cva('relative w-full overflow-hidden rounded-frayme [background:var(--fr-barlist-track,var(--fr-surface-sunken,var(--color-muted)))]', {
  variants: {
    size: { sm: 'h-5', md: 'h-7', lg: 'h-9' },
  },
  defaultVariants: { size: 'md' },
});

export function BarList({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    data?: Array<{ label?: string; value?: number; color?: string | null }> | null;
    palette?: 'brand' | 'cool' | 'warm' | 'neutral' | null;
    accent?: string | null;
    sortByValue?: boolean | null;
    showValues?: boolean | null;
    valueFormat?: string | null;
    valuePrefix?: string | null;
    valueSuffix?: string | null;
    size?: 'sm' | 'md' | 'lg' | null;
    mutedColor?: string | null;
    trackColor?: string | null;
    axisColor?: string | null;
    emptyText?: string | null;
  };
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  // Tremor convention: rows default to a UNIFORM primary fill (no ramp) unless
  // `palette` is explicitly set (any value) — the multi-hue ramp is then opt-in.
  const paletteSet = p.palette != null;
  const ramp = paletteSet ? (PALETTE[p.palette as string] ?? PALETTE.brand) : null;
  const showValues = p.showValues !== false;
  const rows = (Array.isArray(p.data) ? p.data : []).map((d) => ({
    label: typeof d?.label === 'string' ? d.label : '',
    value: typeof d?.value === 'number' && Number.isFinite(d.value) ? d.value : 0,
    color: typeof d?.color === 'string' ? d.color : null,
  }));

  if (rows.length === 0)
    return <EmptyChart label="Bar list" mutedVar="--fr-barlist-muted" mutedColor={p.mutedColor} message={p.emptyText} />;

  const ordered = p.sortByValue === true ? [...rows].sort((a, b) => b.value - a.value) : rows;
  const max = ordered.reduce((m, d) => Math.max(m, Math.abs(d.value)), 0);
  const axisMax = axisCeiling(
    max,
    ordered.every((d) => Number.isInteger(d.value)),
    p.valueFormat === 'percent' ? 100 : null,
  );

  return (
    // The scale row rides INSIDE role="list" as an aria-hidden sibling of the
    // rows: aria-hidden prunes it from the a11y tree, so the list still exposes
    // listitems only, and the colour channels stay on the same node as the role.
    <div
      className="flex w-full flex-col gap-3"
      role="list"
      style={styleVars(
        { var: '--fr-barlist-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-barlist-track', value: p.trackColor, kind: 'color' },
        { var: '--fr-barlist-axis', value: p.axisColor, kind: 'color' },
      )}
    >
      {ordered.map((d, i) => {
        const pct = Math.max(0, Math.min(100, (Math.abs(d.value) / axisMax) * 100));
        // value > accent > palette > the uniform-primary default. Every var read
        // carries the next link of the chain INSIDE it as the fallback, so an
        // INVALID model-emitted colour (styleVars omits the var) falls back one
        // link instead of deleting the bar (invalid declaration). `palette`
        // must be explicitly set for the multi-hue ramp to apply at all — the
        // resting default (no palette, no accent, no per-row color) is a single
        // uniform primary fill (Tremor convention), not the brand ramp.
        const baseFill = ramp != null ? ramp[i % ramp.length] : 'var(--color-primary)';
        const accentFill = p.accent != null ? `var(--fr-bar-accent, ${baseFill})` : baseFill;
        const fill = d.color != null ? `var(--fr-bar-fill, ${accentFill})` : accentFill;
        return (
          // Native tooltip on the ROW (label — value), the family's hover system.
          <div key={i} className={cn(barListRow({ size }))} role="listitem" title={`${d.label} — ${d.value}`}>
            <div className="flex items-center justify-between gap-2">
              {/* The label WRAPS instead of clipping — it is the only thing naming the
                  bar under it, and the row above a full-width track has room to grow;
                  the value stays shrink-0 (STAT-VALUE-NEVER-CLIPS). It is a LEAF, so
                  it carries NO min-w-0: its automatic minimum (min-content = longest
                  word) is the floor that keeps the label from shrinking to a
                  one-character column; break-words handles the over-long word. */}
              {/* The row label is CONTENT on the card surface — the BarList row
                  paints nothing behind it (the tinted track is the div below) — so
                  its ink chain ends in the inherited colour, not the global token.
                  Inside a spec's `Card { bg:"#12161f", color:"#e2e6f0" }` the old
                  fallback printed rgb(24,24,27) on rgb(18,22,31) = 1.02:1. The
                  --fr-barlist-axis channel is untouched, and currentColor equals
                  --color-foreground at the top level (frayme.css:138), so an
                  un-nested BarList is byte-identical. */}
              <span className="break-words font-medium text-[color:var(--fr-barlist-axis,currentColor)]" title={d.label || undefined}>{d.label}</span>
              {showValues && <span className="shrink-0 tabular-nums [color:var(--fr-barlist-muted,var(--color-muted-foreground))]">{formatValue(d.value, p.valueFormat, p.valuePrefix, p.valueSuffix)}</span>}
            </div>
            <div
              className={cn(barListTrack({ size }))}
              style={styleVars(
                { var: '--fr-bar-fill', value: d.color, kind: 'color' },
                { var: '--fr-bar-accent', value: p.accent, kind: 'color' },
              )}
            >
              <div
                // Brightness hover on the FILL (wide/thin mark — scale would
                // distort). transition-[width] stays the ONLY transition-property
                // here (data-change width animation): do NOT add
                // transition-[filter] — a second arbitrary transition-property
                // utility fights it — so the brightness hover is untransitioned.
                className="h-full cursor-pointer rounded-frayme transition-[width] hover:brightness-110 [background:var(--fr-bar-w-fill)]"
                style={{ width: `${pct}%`, '--fr-bar-w-fill': fill } as CSSProperties}
              />
            </div>
          </div>
        );
      })}
      {/* scale row: the track spans 0 → the axis ceiling, so the two ends are
          all a reader needs to size every bar. Formatted through the same
          format/prefix/suffix as the row values, and aria-hidden — the numbers
          each bar stands for are already in its row tooltip. The rule above it
          is painted by the same muted channel as its numbers, with the border
          token folded in as the var fallback (byte-identical when unset). */}
      <div
        className="flex items-center justify-between border-t [border-color:var(--fr-barlist-muted,var(--color-border))] pt-1 text-[0.6875rem] tabular-nums [color:var(--fr-barlist-muted,var(--color-muted-foreground))]"
        aria-hidden
      >
        <span>{formatValue(0, p.valueFormat, p.valuePrefix, p.valueSuffix)}</span>
        <span>{formatValue(axisMax, p.valueFormat, p.valuePrefix, p.valueSuffix)}</span>
      </div>
    </div>
  );
}

/* ── ProgressCircle ───────────────────────────────────────────────────────── */

/* OUR own SVG ring: two concentric <circle>s on a fixed 0 0 36 36 viewBox. The
   track is the full circle; the progress arc is the same circle with a computed
   stroke-dasharray (pct of the circumference). tone sets the arc token; a `color`
   value overrides via an inline var read by the arc's static stroke utility. */
const RING = {
  sm: { px: 64, stroke: 3.5, label: 'text-sm', cap: 'text-[0.625rem]' },
  md: { px: 96, stroke: 3, label: 'text-xl', cap: 'text-xs' },
  lg: { px: 132, stroke: 2.75, label: 'text-2xl', cap: 'text-sm' },
  xl: { px: 176, stroke: 2.5, label: 'text-4xl', cap: 'text-base' },
} as const;
type RingKey = keyof typeof RING;
/* `neutral` unifies to the MUTED-FOREGROUND family across Gauge /
 * ProgressCircle / Tracker (Tracker's block already uses muted-foreground/60). */
const TONE_ARC: Record<string, string> = {
  neutral: 'var(--color-muted-foreground)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-danger)',
  info: 'var(--color-info)',
};

export function ProgressCircle({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: number | null;
    max?: number | null;
    size?: RingKey | null;
    sizeValue?: string | number | null;
    strokeWidth?: string | number | null;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    weight?: string | null;
    showValue?: boolean | null;
    label?: string | null;
    color?: string | null;
    trackColor?: string | null;
    valueColor?: string | null;
    mutedColor?: string | null;
    ariaLabel?: string | null;
  };
  const size = (p.size as RingKey | null) ?? 'md';
  const cfg = RING[size];
  // Pattern C — exact stroke width resolves to a clamped NUMBER passed straight to
  // the SVG presentation attribute (chart-security contract = SVG attrs, no class /
  // css var); unset → the enum constant cfg.stroke is the byte-identical default.
  const sw = dimNum(p.strokeWidth, 1, 12) ?? cfg.stroke;
  const max = typeof p.max === 'number' && Number.isFinite(p.max) && p.max > 0 ? p.max : 100;
  // UNRESOLVED VALUE. `value` is a REQUIRED z.number() in the catalog, so a
  // non-numeric arrival means a binding did not resolve — an unseeded `{$state}`
  // or a `{$computed}` core could not run (it warns and returns undefined). The
  // old `: 0` fallback turned that into a centred, confident "0%" — a fabricated
  // reading nobody can detect. Render the ring EMPTY instead: full track, no arc,
  // a dash where the percentage goes.
  const resolvedValue = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null;
  const hasValue = resolvedValue !== null;
  const frac = hasValue ? Math.max(0, Math.min(1, resolvedValue / max)) : 0;
  const pct = Math.round(frac * 100);
  // What the reader (and the screen reader) is told when there is no value. A
  // dash carries nothing in audio, so the accessible name says it in words.
  const pctText = hasValue ? `${pct}%` : '–';
  const pctSpoken = hasValue ? `${pct}%` : 'no value';
  // r=15.9155 → circumference ≈ 100, so dasharray = "<pct> 100" maps directly.
  const R = 15.9155;
  const dash = `${(frac * 100).toFixed(2)} 100`;
  const tone = (p.tone as string | null) ?? 'neutral';
  // Invalid-colour degradation: styleVars OMITS a failing `color`, so the tone token
  // rides INSIDE the var read as the fallback — the arc never renders invisible.
  const toneArc = TONE_ARC[tone] ?? TONE_ARC.neutral;
  const arc = p.color != null ? `var(--fr-ring-arc, ${toneArc})` : toneArc;
  const showValue = p.showValue !== false;
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center [height:var(--fr-ring-size,var(--fr-ring-size-default))] [width:var(--fr-ring-size,var(--fr-ring-size-default))] max-w-full"
      // Pattern B — the per-size enum px becomes a DEFAULT var (--fr-ring-size-default);
      // the exact `sizeValue` (re-validated by styleVars) sets --fr-ring-size and wins.
      // ONE declaration per axis (no w-/h- utility here → no tw-merge dedupe trap);
      // unset → the var falls back to cfg.px (byte-identical to the old width/height).
      style={{
        '--fr-ring-size-default': `${cfg.px}px`,
        ...styleVars(
          { var: '--fr-ring-size', value: p.sizeValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 32, max: 320 } },
          { var: '--fr-ring-muted', value: p.mutedColor, kind: 'color' },
          // the centre % KPI reads this shared value-text channel (foreground
          // token as the var fallback → byte-identical when unset).
          { var: '--fr-ring-value', value: p.valueColor, kind: 'color' },
        ),
      } as CSSProperties}
      role="img"
      aria-label={typeof p.ariaLabel === 'string' ? p.ariaLabel : `${pctSpoken}${p.label != null ? ` ${p.label}` : ''}`}
    >
      <svg
        viewBox="0 0 36 36"
        className="h-full w-full -rotate-90"
        style={styleVars(
          { var: '--fr-ring-arc', value: p.color, kind: 'color' },
          { var: '--fr-ring-track', value: p.trackColor, kind: 'color' },
        )}
        aria-hidden
      >
        <circle
          cx={18}
          cy={18}
          r={R}
          fill="none"
          stroke="var(--fr-ring-track, var(--color-muted))"
          strokeWidth={sw}
        />
        <circle
          cx={18}
          cy={18}
          r={R}
          fill="none"
          stroke={arc}
          strokeWidth={sw}
          strokeDasharray={dash}
          strokeLinecap="round"
          // The arc is the data mark: native <title> tooltip (label — value) +
          // the family brightness hover (a stroke-only ring — scaling overlaps
          // the track, so brightness, not MARK_POP). pointer-events hit the
          // painted stroke, so hovering the arc itself shows the tooltip.
          className={MARK_BRIGHT}
        >
          <title>{`${typeof p.label === 'string' && p.label !== '' ? p.label : 'Progress'} — ${pctSpoken}`}</title>
        </circle>
      </svg>
      {showValue && (
        <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {/* The readout sits in the ring's HOLE — the arc is a stroke, so nothing
              is painted under this number and its surface is the card's. Chain ends
              in the inherited ink rather than --color-foreground; the valueColor
              channel is unchanged and the top-level value is the same (see the
              BarList label note above). */}
          <span className={cn('font-semibold leading-none tabular-nums [color:var(--fr-ring-value,currentColor)]', cfg.label, weightClass(p.weight))}>{pctText}</span>
          {/* mutedColor's ONLY consumer is this caption — the channel is inherently
              label-gated (no label → no secondary text to colour). The conditional
              group-form class is a value>token belt: text-[color:…] sorts after any
              text-* colour token, so the channel keeps winning if one is ever added
              here (the bare [color:…] rule alone sorts earlier than tokens). */}
          {p.label != null && (
            <span
              className={cn(
                'mt-0.5 leading-none [color:var(--fr-ring-muted,var(--color-muted-foreground))]',
                cfg.cap,
                p.mutedColor != null && 'text-[color:var(--fr-ring-muted,var(--color-muted-foreground))]',
              )}
            >
              {p.label}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/* ── StatGroup ────────────────────────────────────────────────────────────── */

/* A responsive grid wrapper around child Stat tiles. `columns` is advisory:
   both branches use auto-fit templates (a wider minimum when columns is set),
   so tiles collapse responsively rather than pinning a fixed count. `divided`
   adds thin separators between cells. StatGroup owns no data marks — values
   live in the child Stat tiles. */
/* SHARED LINES: tiles are equal boxes but their CONTENT has to land on the same
   lines too. A tile with a caption pushes its value a line lower than a caption-less
   sibling, so one tile carrying a real caption reveals the empty caption slot every
   Stat already renders — the values then start on one line across the row, with no
   authored prop and no cost when the whole row is caption-less (the empty slots stay
   out of flow). The tiles themselves absorb the leftover height at the bottom
   (grid items stretch; Stat's footer takes the slack), so footers share a line too. */
const statGroupGrid = cva('grid w-full [&:has([data-fr-stat-caption])_[data-fr-stat-caption-slot]]:block', {
  variants: {
    gap: { sm: 'gap-3', md: 'gap-5', lg: 'gap-8' },
    divided: {
      // Every tile draws its leading rules; the container clips the ones that
      // land at a row/column START. :not(:first-child) cannot see grid ROWS, so
      // a wrapped row's first tile always draws one — and CSS has no
      // :first-in-row to exempt it. The rules must be OUTSET box-shadows, not
      // borders or negative margins: a shadow occupies no layout box, so the
      // clip costs no layout shift and the strip stays flush with its siblings.
      // The cost of painting outside the box: a rule sits over the NEIGHBOUR
      // tile's last pixel, so a tile whose subtree creates a stacking context
      // (position/transform/opacity/z-index) with an opaque background paints
      // over its neighbour's rule — tiles have to stay plain flow content.
      // Row rules (the 0 -1px shadow) keep a wrapped 2×2 from reading as one
      // undivided block; tiles fill their row (h-full) or the vertical rules
      // read as disconnected ticks. The rule colour reads the
      // `--fr-statgroup-divider` channel with the border token folded in as the
      // var fallback (byte-identical when unset).
      true: 'gap-0 overflow-hidden [&>*]:px-5 [&>*]:py-3 [&>*]:h-full [&>*]:[box-shadow:-1px_0_0_0_var(--fr-statgroup-divider,var(--color-border)),0_-1px_0_0_var(--fr-statgroup-divider,var(--color-border))]',
      false: '',
    },
    // Per-tile cards: each Stat gets its own hairline border +
    // padding + radius, the individual-dashboard-card look. The border colour reads
    // the same `--fr-statgroup-divider` channel so `borderColor` recolours it. Off
    // by default (byte-identical); `divided` wins when both are set (guarded in the
    // render).
    bordered: {
      true: '[&>*]:rounded-frayme [&>*]:border [&>*]:[border-color:var(--fr-statgroup-divider,var(--color-border))] [&>*]:p-4',
      false: '',
    },
    align: { start: 'text-left', center: 'text-center [&>*]:items-center', end: 'text-right [&>*]:items-end' },
  },
  defaultVariants: { gap: 'md', divided: false, bordered: false, align: 'start' },
});

export function StatGroup({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    columns?: string | number | null;
    divided?: boolean | null;
    bordered?: boolean | null;
    align?: 'start' | 'center' | 'end' | null;
    gap?: 'sm' | 'md' | 'lg' | null;
    borderColor?: unknown;
  };
  const divided = p.divided === true;
  // `divided` (segmented strip) and `bordered` (per-tile cards) are mutually
  // exclusive; dividers win when both are set. Cards keep the tile gap.
  const bordered = !divided && p.bordered === true;
  // STAT-VALUE-NEVER-CLIPS: the grid collapses on CONTENT-FIT,
  // never a fixed breakpoint — every tile carries a MIN width, so `auto-fit` wraps to
  // fewer columns the instant a tile would get too narrow to show its value (the
  // authored `columns` count is advisory; the min width drives the real column count).
  //  · Bare/divided tiles are narrow-friendly (9rem floor) → N-up wide, wrapping
  //    N→…→2→1 the moment values would truncate (the "48,210 → 4…" defect).
  //  · Per-tile CARDS need room (14rem floor) AND cap at 2-up: the 45% min admits at
  //    most two tracks, so 2-up cleanly collapses to 1-up when the container squeezes.
  return (
    <div
      className={cn(
        statGroupGrid({
          gap: divided ? undefined : (p.gap as 'sm' | 'md' | 'lg' | null) ?? undefined,
          divided: divided as true | false,
          bordered: bordered as true | false,
          align: (p.align as 'start' | 'center' | 'end' | null) ?? undefined,
        }),
        bordered
          ? '[grid-template-columns:repeat(auto-fit,minmax(min(100%,max(14rem,45%)),1fr))]'
          // 9rem admitted 4-up tiles too narrow for split-layout
          // values ("Wednesday" → "W…"). 33% then capped rows at
          // 3-up, so a 4-stat group wrapped to 2×2 even with room to spare —
          // that 33% was tuned against the OLD 780px page clamp, which the
          // width law removed. 22% keeps 4-up on a real host width and still
          // wraps before tiles reach the crush point.
          // min(100%,…) around both floors: a track floor that exceeds its own
          // container does not wrap, it overflows — the same defect the Sources
          // grid had, and the one Grid's auto-fit branch already guards.
          : '[grid-template-columns:repeat(auto-fit,minmax(min(100%,max(10rem,22%)),1fr))]',
      )}
      style={styleVars(
        { var: '--fr-statgroup-divider', value: p.borderColor, kind: 'color' },
      )}
    >
      {children}
    </div>
  );
}

/* ── Heatmap ──────────────────────────────────────────────────────────────── */

/* CSS grid of square cells. Each cell's fill = the scale token at a per-cell
   alpha computed from value/max — the alpha is a validated COUNT (0..100) routed
   through a per-cell inline var read by a static color-mix recipe (the percentage
   math lives in OUR literal class, never in spec text). */
const HEAT_COLOR: Record<string, string> = {
  brand: 'var(--color-primary)',
  cool: 'var(--color-info)',
  warm: 'var(--color-warning)',
  success: 'var(--color-success)',
};
const HEAT_CELL = {
  sm: { px: 16, gap: 'gap-0.5', font: 'text-[0.5rem]' },
  md: { px: 28, gap: 'gap-1', font: 'text-[0.625rem]' },
  lg: { px: 44, gap: 'gap-1', font: 'text-xs' },
} as const;
type HeatSizeKey = keyof typeof HEAT_CELL;

export function Heatmap({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    cells?: number[][] | null;
    colorScale?: 'brand' | 'cool' | 'warm' | 'success' | null;
    cellSize?: HeatSizeKey | null;
    showValues?: boolean | null;
    showLegend?: boolean | null;
    xLabels?: string[] | null;
    yLabels?: string[] | null;
    mutedColor?: string | null;
    scaleColor?: string | null;
    valueColor?: string | null;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const grid = Array.isArray(p.cells) ? p.cells.map((row) => finiteNums(row)) : [];
  const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);

  if (grid.length === 0 || cols === 0)
    return <EmptyChart label="Heatmap" mutedVar="--fr-heat-muted" mutedColor={p.mutedColor} message={p.emptyText} />;

  const max = grid.reduce((m, r) => r.reduce((mm, v) => Math.max(mm, Math.abs(v)), m), 0) || 1;
  const scaleColor = HEAT_COLOR[(p.colorScale as string | null) ?? 'cool'] ?? HEAT_COLOR.cool;
  const cell = HEAT_CELL[(p.cellSize as HeatSizeKey | null) ?? 'md'];
  const showValues = p.showValues === true;
  const showLegend = p.showLegend === true;
  const xLabels = Array.isArray(p.xLabels) ? p.xLabels : null;
  const yLabels = Array.isArray(p.yLabels) ? p.yLabels : null;
  const hasY = yLabels != null && yLabels.length > 0;
  // grid-template-columns: an optional leading label column + N cell columns.
  const template = `${hasY ? 'auto ' : ''}repeat(${Math.max(cols, 1)}, ${cell.px}px)`;
  return (
    <div
      // BLOCK + w-full, not inline-block + max-w-full: a shrink-to-fit box inside
      // a content-sized parent has no definite width to cap against, so a
      // 24-column heatmap grew its own container and
      // took the card with it. fr-tabscroll-card is the shared rail treatment —
      // a thin scrollbar plus a right-edge fade painted only while it overflows.
      className="fr-tabscroll-card block w-full max-w-full overflow-x-auto"
      role="img"
      aria-label={typeof p.ariaLabel === 'string' ? p.ariaLabel : `Heatmap, ${grid.length} rows by ${cols} columns`}
      style={
        {
          '--fr-heat-color': scaleColor,
          ...styleVars(
            { var: '--fr-heat-muted', value: p.mutedColor, kind: 'color' },
            // model-named high-end colour wins over the enum-derived token via the
            // cell color-mix `var(--fr-heat-scale, var(--fr-heat-color))` fallback.
            { var: '--fr-heat-scale', value: p.scaleColor, kind: 'color' },
            // in-cell value text (showValues) — cascades down to every Row cell.
            { var: '--fr-heat-value', value: p.valueColor, kind: 'color' },
          ),
        } as CSSProperties
      }
    >
      <div className={cn('grid w-max', cell.gap)} style={{ gridTemplateColumns: template }}>
        {/* optional x-axis header row */}
        {xLabels != null && (
          <>
            {hasY && <span aria-hidden />}
            {Array.from({ length: cols }).map((_, c) => (
              <span key={`x${c}`} className={cn('text-center [color:var(--fr-heat-muted,var(--color-muted-foreground))]', cell.font)}>
                {xLabels[c] ?? ''}
              </span>
            ))}
          </>
        )}
        {grid.map((row, r) => (
          <Row
            key={r}
            row={row}
            cols={cols}
            max={max}
            cellPx={cell.px}
            font={cell.font}
            showValues={showValues}
            yLabel={hasY ? yLabels?.[r] ?? '' : null}
          />
        ))}
      </div>
      {/* intensity scale key: "Less ▫▫▪▪ More" — 5 swatches ramping the
          resolved scale colour from low (muted) to high, mirroring the cell
          color-mix recipe so the strip reads the same hue as the cells. */}
      {showLegend && (
        <div className={cn('mt-1.5 flex w-max items-center gap-1.5 [color:var(--fr-heat-muted,var(--color-muted-foreground))]', cell.font)}>
          <span>Less</span>
          <div className="flex items-center gap-0.5">
            {[15, 40, 65, 90].map((a) => (
              <span
                key={a}
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: `color-mix(in srgb, var(--fr-heat-scale,var(--fr-heat-color)) ${a}%, var(--color-muted))` }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      )}
    </div>
  );
}

function Row({
  row,
  cols,
  max,
  cellPx,
  font,
  showValues,
  yLabel,
}: {
  row: number[];
  cols: number;
  max: number;
  cellPx: number;
  font: string;
  showValues: boolean;
  yLabel: string | null;
}): ReactNode {
  return (
    <>
      {yLabel != null && (
        <span className={cn('flex items-center pr-1.5 text-right [color:var(--fr-heat-muted,var(--color-muted-foreground))]', font)} style={{ height: cellPx }}>
          {yLabel}
        </span>
      )}
      {Array.from({ length: cols }).map((_, c) => {
        const v = row[c];
        const has = typeof v === 'number' && Number.isFinite(v);
        // alpha percentage 0..100 from value/max — a validated count routed through
        // a per-cell var; the color-mix math is in OUR static class, not spec text.
        const alpha = has ? Math.round((Math.abs(v) / max) * 100) : 0;
        // Merge the cell's fixed size with the ONE validated `--fr-heat-a` var
        // (styleVars only ever emits `--*` props, so width/height are plain css).
        const cellStyle: CSSProperties = {
          width: cellPx,
          height: cellPx,
          ...styleVars({ var: '--fr-heat-a', value: alpha, kind: 'dim', opts: { kind: 'count', min: 0, max: 100 } }),
        };
        return (
          <span
            key={c}
            // EVERY valued cell reports its raw value via a native tooltip
            // (GitHub-contributions style) + the family's subtle brightness
            // hover; a valueless cell has nothing to report → no title.
            title={has ? String(v) : undefined}
            className={cn(
              // in-cell value text reads the valueColor channel (--fr-heat-value, set on
              // the Heatmap root) with the foreground token folded in as the fallback —
              // set a light valueColor when high-alpha cells run dark.
              // This fallback KEEPS --color-foreground and did NOT join the
              // inherited-ink fix applied to the BarList/Gantt labels above: the
              // number sits on the cell's OWN opaque fill, a color-mix of the scale
              // colour into --color-muted. A Card's authored `bg` re-points
              // --fr-card-bg, never --color-muted, so a low-alpha cell is still a
              // near-white square inside a dark card — inheriting the card's light
              // ink there would be white-on-white, the same defect reversed.
              'flex items-center justify-center rounded-[3px] [background:color-mix(in_srgb,var(--fr-heat-scale,var(--fr-heat-color))_calc(var(--fr-heat-a,0)*1%),var(--color-muted))] tabular-nums text-[color:var(--fr-heat-value,var(--color-foreground))]',
              MARK_BRIGHT,
              font,
            )}
            style={cellStyle}
          >
            {showValues && has ? v : ''}
          </span>
        );
      })}
    </>
  );
}

/* ── Gantt ────────────────────────────────────────────────────────────────── */

const ganttRow = cva('grid items-center gap-2', {
  variants: {
    size: { sm: 'text-xs', md: 'text-[0.8125rem]', lg: 'text-sm' },
  },
  defaultVariants: { size: 'md' },
});
const ganttBar = cva('rounded-frayme [background:var(--fr-gantt-w-fill)]', {
  variants: {
    size: { sm: 'h-4', md: 'h-6', lg: 'h-8' },
  },
  defaultVariants: { size: 'md' },
});

export function Gantt({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    tasks?: Array<{ label?: string; start?: number; end?: number; color?: string | null }> | null;
    rangeMax?: number | null;
    palette?: 'brand' | 'cool' | 'warm' | 'neutral' | null;
    showGrid?: boolean | null;
    axisLabels?: string[] | null;
    size?: 'sm' | 'md' | 'lg' | null;
    gridColor?: string | null;
    axisColor?: string | null;
    trackColor?: string | null;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const ramp = PALETTE[(p.palette as string | null) ?? 'brand'] ?? PALETTE.brand;
  const showGrid = p.showGrid !== false;
  const tasks = (Array.isArray(p.tasks) ? p.tasks : []).map((t) => ({
    label: typeof t?.label === 'string' ? t.label : '',
    start: typeof t?.start === 'number' && Number.isFinite(t.start) ? t.start : 0,
    end: typeof t?.end === 'number' && Number.isFinite(t.end) ? t.end : 0,
    color: typeof t?.color === 'string' ? t.color : null,
  }));

  if (tasks.length === 0) return <EmptyChart label="Timeline" mutedVar="--fr-gantt-muted" message={p.emptyText} />;

  const autoMax = tasks.reduce((m, t) => Math.max(m, t.start, t.end), 0);
  const rangeMax =
    typeof p.rangeMax === 'number' && Number.isFinite(p.rangeMax) && p.rangeMax > 0 ? p.rangeMax : autoMax || 1;

  return (
    <div
      className="flex w-full flex-col gap-2"
      role="img"
      aria-label={typeof p.ariaLabel === 'string' ? p.ariaLabel : `Timeline of ${tasks.length} tasks`}
      style={styleVars(
        { var: '--fr-gantt-grid', value: p.gridColor, kind: 'color' },
        { var: '--fr-gantt-axis', value: p.axisColor, kind: 'color' },
        { var: '--fr-gantt-track', value: p.trackColor, kind: 'color' },
      )}
    >
      {tasks.map((t, i) => {
        const start = Math.max(0, Math.min(rangeMax, Math.min(t.start, t.end)));
        const end = Math.max(0, Math.min(rangeMax, Math.max(t.start, t.end)));
        const leftPct = (start / rangeMax) * 100;
        const widthPct = Math.max(1.5, ((end - start) / rangeMax) * 100);
        // Invalid-colour degradation: styleVars OMITS a failing per-task colour, so
        // the palette slot rides INSIDE the var read — the bar never goes invisible.
        const rampFill = ramp[i % ramp.length];
        const fill = t.color != null ? `var(--fr-gantt-fill, ${rampFill})` : rampFill;
        return (
          <div key={i} className={cn(ganttRow({ size }))} style={{ gridTemplateColumns: 'minmax(5rem,8rem) 1fr' }}>
            {/* The task-name track is bounded by the grid (minmax(5rem,8rem)) so every
                timeline starts at the same x; the name wraps INSIDE that track — a
                clipped task name ("Migrate data…") is the one thing a Gantt must say.
                LEAF → no min-w-0: the name's own min-content (its longest word) is the
                floor inside that track, where min-w-0 let it shrink below the word and
                spell the task one character per line. break-words still shears a word
                wider than the track. */}
            {/* The task name is CONTENT in the left grid track — nothing is painted
                behind it (the tinted track is the other column) — so its chain ends
                in the inherited ink, not the global token. Same measurement as the
                BarList label above; the axisColor channel and the top-level value
                are unchanged. */}
            <span className="break-words font-medium [color:var(--fr-gantt-axis,currentColor)]" title={t.label || undefined}>{t.label}</span>
            <div
              className={cn(
                'relative w-full rounded-frayme bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
                // trackColor channel (family parity: BarList/ProgressCircle/Gauge/
                // RadialBar): the group-form bg reader dedupes bg-muted when set;
                // unset keeps the class list byte-identical. background-COLOR form
                // (not the shorthand) so the showGrid background-image survives.
                p.trackColor != null && 'bg-[color:var(--fr-gantt-track,var(--color-muted))]',
                showGrid &&
                  '[background-image:repeating-linear-gradient(to_right,transparent,transparent_calc(12.5%_-_1px),var(--fr-gantt-grid,var(--color-border))_calc(12.5%_-_1px),var(--fr-gantt-grid,var(--color-border))_12.5%)]',
              )}
              style={styleVars({ var: '--fr-gantt-fill', value: t.color, kind: 'color' })}
            >
              <div
                // The task bar is the data mark: native tooltip carries the full
                // datum (label: start→end, the normalized values that draw the
                // bar) + the family brightness hover (wide/thin mark — scale
                // would distort; the Candlestick lesson).
                className={cn('relative', ganttBar({ size }), MARK_BRIGHT)}
                style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%`, '--fr-gantt-w-fill': fill } as CSSProperties}
                title={`${t.label}: ${start}→${end}`}
              />
            </div>
          </div>
        );
      })}
      {/* time-axis scale row: author-supplied captions evenly spaced under
          the timeline column (the second grid track), tinted by axisColor. Not
          auto-generated from rangeMax (deterministic, author-controlled). */}
      {Array.isArray(p.axisLabels) && p.axisLabels.length > 0 && (
        <div className={cn(ganttRow({ size }))} style={{ gridTemplateColumns: 'minmax(5rem,8rem) 1fr' }} aria-hidden>
          <span />
          <div className="fr-xaxis flex w-full [color:var(--fr-gantt-axis,var(--color-muted-foreground))]">
            {/* Each caption keeps its flex-1 slot — it has to sit under the stretch
                of timeline it dates. A half-eaten date is a wrong date, but so is a
                date spelled down the page one character at a time, which is what
                wrapping gave at narrow widths. Same treatment as the bar axis: one
                line, and the row thins itself on its OWN container size. */}
            {p.axisLabels.map((lbl, i) => (
              <span key={i} className="fr-xaxis-label min-w-0 flex-1 break-normal whitespace-nowrap text-center text-[0.6875rem] tabular-nums first:text-left last:text-right" title={typeof lbl === 'string' ? lbl || undefined : undefined}>
                {typeof lbl === 'string' ? lbl : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
