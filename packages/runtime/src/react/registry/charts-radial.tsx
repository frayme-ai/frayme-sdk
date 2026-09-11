'use client';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { styleVars, weightClass } from './_style.js';
import { formatReadout, unitGap } from './_num.js';
import { safeColor } from '@frayme/catalog/validate';

/* Catalog group (charts-radial): Gauge · RadialBar · Tracker · Candlestick · Treemap.
 *
 * Same truly-dynamic contract as the shipped charts group:
 *   - ENUM props -> static CVA classes (a closed set of allowed values).
 *   - VALUE props (a per-datum `color`, the `height`) NEVER become classes. The
 *     `height` lands in `--fr-<comp>-height` via `styleVars(...)`, read by a STATIC
 *     arbitrary height utility binding that var with a token fallback. A per-datum
 *     `color` is re-validated via `safeColor` and applied either as an SVG
 *     `fill`/`stroke` ATTRIBUTE (a presentation attribute carrying a validated
 *     value) or, for the CSS-div components (Tracker / Treemap), through a
 *     per-element inline var read by a static arbitrary background utility. Never a
 *     class, never a CSS-property string from the spec.
 *
 * CHART SECURITY (non-negotiable): the markup is OURS (path/rect/circle/line/text,
 * or positioned divs). The spec supplies only NUMBERS (value/min/max/OHLC) + labels
 * + a validated color. We filter every series to FINITE numbers and COMPUTE every
 * coordinate, normalizing into a fixed viewBox / a 0..100 percentage axis. A spec
 * value never becomes markup. Empty/all-invalid data -> a muted "No data" state.
 * Each chart is `role="img"` with an `aria-label` summarizing it — except where
 * the reading is PER-DATUM rather than per-chart (Tracker), since `img` hides
 * everything beneath it: that container is a labelled `group` instead.
 */

/* The named, token-based series-color sets (shared with the charts group). */
const PALETTES: Record<string, string[]> = {
  brand: [
    'var(--color-primary)',
    '#38bdf8',
    '#2dd4bf',
    '#fbbf24',
    '#fb7185',
  ],
  cool: ['var(--color-info)', 'var(--color-primary)', 'var(--color-success)', '#0ea5e9', '#14b8a6'],
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

/* tone enum -> a token color (the value-arc / block default channel).
 * `neutral` unifies to the MUTED-FOREGROUND family across Gauge /
 * ProgressCircle / Tracker (Tracker's block already uses muted-foreground/60). */
const TONE_COLOR: Record<string, string> = {
  neutral: 'var(--color-muted-foreground)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-danger)',
  info: 'var(--color-info)',
};

/* tone enum -> a token background utility (Tracker blocks). */
const TONE_BG: Record<string, string> = {
  neutral: 'bg-muted-foreground/60',
  success: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
  info: 'bg-info',
};

/* A SEMANTIC colour word -> its token. `safeColor` accepts any bare word (it
 * cannot inject), so a threshold written `color: "warning"` sailed through and
 * became `stroke="warning"` — not a real CSS colour, so the UA dropped the
 * paint and the value arc DISAPPEARED ("an empty grey arc"). Map the
 * semantic vocabulary the model actually writes onto the same tokens `tone`
 * uses, and only then fall through to the colour-value channel. */
const SEMANTIC_COLOR: Record<string, string> = {
  ...TONE_COLOR,
  danger: 'var(--color-danger)',
  error: 'var(--color-danger)',
  critical: 'var(--color-danger)',
  destructive: 'var(--color-danger)',
  ok: 'var(--color-success)',
  good: 'var(--color-success)',
  healthy: 'var(--color-success)',
  caution: 'var(--color-warning)',
  warn: 'var(--color-warning)',
  muted: 'var(--color-muted-foreground)',
  primary: 'var(--color-primary)',
};

/** A zone/threshold colour: semantic word -> token, else a validated CSS colour. */
export function semanticColor(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const token = SEMANTIC_COLOR[raw.trim().toLowerCase()];
    if (token !== undefined) return token;
  }
  return safeColor(raw);
}

/** A datum color: a validated per-item `color` wins, else the palette slot
 *  (wrapping). Re-validated here (defence in depth); an invalid value falls back. */
function seriesColor(itemColor: unknown, palette: string | null | undefined, index: number): string {
  if (itemColor != null) {
    const safe = safeColor(itemColor);
    if (safe !== null) return safe;
  }
  const set = PALETTES[palette ?? 'brand'] ?? PALETTES.brand;
  return set[index % set.length];
}

const DIM_OPTS: { units: Array<'px' | 'rem'>; min: number; max: number } = { units: ['px', 'rem'], min: 80, max: 800 };

/* The settable secondary/muted-text colour channel. Each chart sets a per-component
 * `--fr-<comp>-muted` var on its ROOT from `p.mutedColor` (token fallback baked in),
 * and the shared Legend / empty-state read it via a passed var name. A props-less
 * spec resolves to `--color-muted-foreground` — identical to the default. */
type MutedVar = `--fr-${string}-muted`;
const mutedClass = (cssVar: MutedVar) => `[color:var(${cssVar},var(--color-muted-foreground))]`;

/* The chart root paints no surface of its own, so it INHERITS one — `text-current`,
 * not `text-[color:var(--fr-surface-fg,var(--color-foreground))]`. text-[color:var(--fr-surface-fg,var(--color-foreground))] here was the reset that stranded every
 * chart's text at the global token: inside a spec's `Card { bg:"#12161f",
 * color:"#e2e6f0" }` the authored light ink reached this div and was thrown away for
 * rgb(24,24,27) on rgb(18,22,31) = 1.02:1. currentColor is the SAME value at the top
 * level — frayme.css:138 points both `.frayme-root { color }` and --color-foreground
 * at --frayme-fg — so a props-less chart is byte-identical. Mirrors charts.tsx. */
const chartWrap = 'flex w-full flex-col gap-2 text-current';

/* Hover affordance for discrete chart marks — a subtle modern "pop". Scales an SVG
 * mark in place from its own bounding box; gated behind `motion-safe:` so
 * reduced-motion users get the cursor affordance with no movement. */
const MARK_POP_SELF =
  'cursor-pointer transition-transform duration-200 ease-out motion-safe:hover:scale-[1.06] [transform-box:fill-box] [transform-origin:center]';

/* ── axis labels ─────────────────────────────────────────────────────────────
 *
 * An axis label is ATOMIC: it renders WHOLE or not at all. When an axis runs out
 * of room the TICK COUNT gives way — every 2nd, 3rd, kth … slot, with the first
 * and last labelled slot held so the axis still states its range.
 *
 * The budget is measured off the label strip ITSELF: its own box (inline extent
 * for an x axis, block extent for a y axis) and its own computed type size. Both
 * scale together under browser text zoom, so a rem-sized label that gets
 * physically wider buys the axis a proportionally smaller budget. Nothing here
 * reads the viewport — a chart in a 320px pane thins exactly like a 320px
 * viewport would.
 *
 * A strip with no box (server render, first paint, a host that lays it out to
 * zero) reports an UNKNOWN budget, which keeps every label: the server HTML is
 * the whole axis and thinning is a client refinement of it. */
type AxisBox = { extent: number; em: number };

function useAxisBox(ref: RefObject<HTMLElement | null>, axis: 'x' | 'y'): AxisBox | null {
  const [box, setBox] = useState<AxisBox | null>(null);
  // `node` tracks the strip in STATE, not just a ref: a chart that first renders
  // its empty state has no strip to observe, and an effect keyed on the ref alone
  // never re-runs when the strip appears with the data — leaving the axis
  // permanently unmeasured and every label rendered.
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (ref.current !== node) setNode(ref.current);
  });
  useEffect(() => {
    const el = node;
    if (el == null) return;
    const measure = () => {
      const extent = axis === 'x' ? el.clientWidth : el.clientHeight;
      const em = Number.parseFloat(getComputedStyle(el).fontSize);
      if (!(extent > 0) || !(em > 0)) return;
      setBox((prev) => (prev !== null && prev.extent === extent && prev.em === em ? prev : { extent, em }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [node, axis]);
  return box;
}

/* How many labels the strip holds. One inline label claims ~0.62em of advance
 * per character (the mixed-case average of the UI stack) plus a gutter to its
 * neighbour; one stacked label claims a line of leading. */
function tickBudget(box: AxisBox | null, axis: 'x' | 'y', longest: number): number | null {
  if (box === null) return null;
  const per = axis === 'x' ? (Math.max(longest, 1) * 0.62 + 0.9) * box.em : 1.5 * box.em;
  return Math.floor(box.extent / per);
}

/** The labelled slots that survive `budget`. Walks the labelled slots in order,
 *  keeping one whenever it clears the slot spacing the budget implies; the last
 *  labelled slot is held (evicting the neighbour it would crowd) so the axis
 *  keeps stating where the series ends. A null budget keeps every label. */
function keptLabels(hasLabel: boolean[], budget: number | null): boolean[] {
  const n = hasLabel.length;
  const kept = new Array<boolean>(n).fill(false);
  const labelled: number[] = [];
  for (let i = 0; i < n; i++) if (hasLabel[i]) labelled.push(i);
  if (labelled.length === 0) return kept;
  // Unmeasured (SSR, first paint, a zero-width host): render the ENDS only.
  // Rendering every label there overlaps them into mush and spills past the
  // plot; the ends still say where the series starts and finishes.
  if (budget === null) {
    const ends = new Array<boolean>(n).fill(false);
    ends[labelled[0]] = true;
    ends[labelled[labelled.length - 1]] = true;
    return ends;
  }
  if (budget <= 0) return kept;
  const spacing = Math.ceil(n / budget); // slots one whole label needs
  let prev = labelled[0];
  kept[prev] = true;
  for (const i of labelled) {
    if (i - prev >= spacing) {
      kept[i] = true;
      prev = i;
    }
  }
  const last = labelled[labelled.length - 1];
  if (!kept[last] && prev !== labelled[0]) {
    kept[prev] = false;
    kept[last] = true;
  }
  return kept;
}

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
      aria-label={`${label}: ${text.toLowerCase() === 'no data' ? 'no data' : text}`}
      style={{
        ...styleVars({ var: '--fr-chart-height', value: height, kind: 'dim', opts: DIM_OPTS }),
        ...styleVars({ var: mutedVar, value: mutedColor, kind: 'color' }),
      }}
    >
      {text}
    </div>
  );
}

/** A simple legend (color swatch + name). The `mutedVar` names the per-component
 *  muted-text var the enclosing chart root sets.
 *  Names WRAP, never clip — the `ul` wraps items already, so the only thing a
 *  clipped name buys is a deleted word on the key that names the series. */
function Legend({ items, mutedVar }: { items: Array<{ name: string; color: string; meta?: string | null }>; mutedVar: MutedVar }): ReactNode {
  return (
    // The muted colour sits on the NAME span, not on this `ul` — the same move
    // charts.tsx made. With muted here, the `meta` value below had to name
    // --color-foreground to climb back OUT of muted, and that hard reset is what
    // stranded it at near-black inside an authored dark Card. Colouring the one span
    // that wants muted lets everything else inherit the chart's ink, and both
    // computed defaults are unchanged when nothing is authored.
    <ul className="m-0 flex min-w-0 list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[0.8125rem]">
      {items.map((it, i) => (
        <li key={i} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} aria-hidden />
          {/* LEAF: no min-w-0 — the name's own min-content (its longest word) is
              the floor; min-w-0 let the box shrink under it and shattered the key
              one character per line. break-words still breaks an over-long word. */}
          <span className={cn('break-words', mutedClass(mutedVar))} title={it.name}>{it.name}</span>
          {/* legend value text reads the shared `--fr-legend-value` channel, now
              falling through to the INHERITED ink rather than the global token
              (RadialBar still sets it from valueColor). Byte-identical unset: the
              ul no longer re-colours this subtree, so currentColor here is the
              chart root's ink, which is --frayme-fg == --color-foreground. */}
          {it.meta != null && <span className="shrink-0 tabular-nums [color:var(--fr-legend-value,currentColor)]">{it.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ── Gauge ──────────────────────────────────────────────────────────────────── */

/* Half-circle (180deg) dial. We draw OUR own arc <path>s on a fixed viewBox: a
   background track semicircle + a value arc whose sweep = clamp(frac,0,1)*180deg.
   The arc endpoints are pure polar math. If `thresholds` are present, the value
   arc takes the color of the band the value falls in; else tone/color. */
const GAUGE_SIZE: Record<string, { w: number; stroke: number; value: string; cap: string }> = {
  sm: { w: 130, stroke: 11, value: 'text-lg', cap: 'text-[0.625rem]' },
  md: { w: 180, stroke: 13, value: 'text-2xl', cap: 'text-xs' },
  lg: { w: 240, stroke: 15, value: 'text-3xl', cap: 'text-sm' },
  xl: { w: 320, stroke: 17, value: 'text-4xl', cap: 'text-base' },
};

/* Polar point on the gauge arc. The half-circle spans 180deg..0deg (left->right)
   measured so that t=0 is the left end and t=1 is the right end of the top semicircle. */
function gaugePoint(cx: number, cy: number, r: number, t: number): [number, number] {
  const angle = Math.PI * (1 - t); // pi (left) -> 0 (right)
  return [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];
}

/* Arc path `d` from fraction a..b of the 180deg sweep (a<=b), large-arc never. */
function gaugeArc(cx: number, cy: number, r: number, a: number, b: number): string {
  const [x0, y0] = gaugePoint(cx, cy, r, a);
  const [x1, y1] = gaugePoint(cx, cy, r, b);
  // sweep-flag 1 = clockwise along the top semicircle from left to right.
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function Gauge({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: number | null;
    min?: number | null;
    max?: number | null;
    thresholds?: Array<{ value?: number | null; color?: string | null; label?: string | null }> | null;
    tone?: string | null;
    color?: string | null;
    trackColor?: string | null;
    valueColor?: unknown;
    size?: string | null;
    sizeValue?: unknown;
    showValue?: boolean | null;
    showRange?: boolean | null;
    weight?: string | null;
    label?: string | null;
    unit?: string | null;
    mutedColor?: unknown;
    ariaLabel?: string | null;
  };
  const size = (p.size as 'sm' | 'md' | 'lg' | 'xl' | null) ?? 'md';
  const cfg = GAUGE_SIZE[size] ?? GAUGE_SIZE.md;
  const min = typeof p.min === 'number' && Number.isFinite(p.min) ? p.min : 0;
  const maxRaw = typeof p.max === 'number' && Number.isFinite(p.max) ? p.max : 100;
  const max = maxRaw > min ? maxRaw : min + 1;
  // UNRESOLVED VALUE. `value` is a REQUIRED z.number() in the catalog, so the only
  // way it arrives non-numeric is a binding that did not resolve — an unseeded
  // `{$state}`, or a `{$computed}` core could not run (it warns and returns
  // undefined). This used to fall back to `min`, which painted a confident "0"
  // and an aria label reading "Gauge: 0 of 0-100": a fabricated reading, and the
  // one defect class a reader cannot detect. Render the dial EMPTY instead — the
  // track with no arc and a dash where the number goes — so the failure is
  // visible to the person looking at it.
  const resolved = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null;
  const hasValue = resolved !== null;
  const value = resolved ?? min;
  const frac = hasValue ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;

  // Determine the active arc color: a matching threshold band wins, else color/tone.
  const bands = (Array.isArray(p.thresholds) ? p.thresholds : [])
    .map((b) => ({
      value: typeof b?.value === 'number' && Number.isFinite(b.value) ? b.value : null,
      // A semantic word ("warning") maps to its token here; anything else goes
      // through the colour-value channel. Never the raw string.
      color: semanticColor(b?.color),
      label: typeof b?.label === 'string' ? b.label : null,
    }))
    .filter((b): b is { value: number; color: string | null; label: string | null } => b.value !== null)
    .sort((a, b) => a.value - b.value);

  const baseColor =
    (p.color != null ? semanticColor(p.color) : null) ?? TONE_COLOR[p.tone ?? 'neutral'] ?? TONE_COLOR.neutral;
  let arcColor = baseColor;
  let activeLabel: string | null = null;
  if (hasValue && bands.length > 0) {
    // The band the value is ACTUALLY in — the last boundary it has reached.
    // Below every boundary there is NO band: the dial keeps its base tone.
    // (It used to fall back to bands[0], painting 132.4 in the 150-warning
    // colour while the caption beside it said the opposite.)
    let chosen: (typeof bands)[number] | null = null;
    for (const b of bands) {
      if (value >= b.value) chosen = b;
    }
    if (chosen !== null) {
      if (chosen.color !== null) arcColor = chosen.color;
      activeLabel = chosen.label;
    }
  }

  // viewBox geometry: a semicircle that fills the width; height ~ half + stroke pad.
  const VB_W = 100;
  const r = (VB_W - cfg.stroke) / 2;
  const cx = VB_W / 2;
  const cy = r + cfg.stroke / 2;
  const showValue = p.showValue !== false;
  const unit = typeof p.unit === 'string' ? p.unit : '';
  // Readout: grouped digits, float noise trimmed, and a THIN SPACE before the
  // unit unless the unit is one that sits tight (%, °). "874MW" -> "874 MW".
  // No value → an en dash in the readout (the tournament-bracket convention for
  // a missing figure) and the words "no value" in the accessible name, because a
  // dash is not something a screen reader can convey.
  const valueText = hasValue ? formatReadout(value) : '–';
  const gap = unitGap(unit);
  const summary =
    typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0
      ? p.ariaLabel
      : hasValue
        ? `Gauge: ${valueText}${gap}${unit} of ${formatReadout(min)}–${formatReadout(max)}${p.label ? `, ${p.label}` : ''}`
        : `Gauge: no value of ${formatReadout(min)}–${formatReadout(max)}${p.label ? `, ${p.label}` : ''}`;

  // Threshold ZONES along the track + a tick at each boundary. Without these a
  // `thresholds` array was invisible: it only tinted the value arc, so nothing
  // on screen said where the bands were.
  const toFrac = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const zones = bands
    .map((b, i) => ({
      from: toFrac(b.value),
      to: i + 1 < bands.length ? toFrac(bands[i + 1]!.value) : 1,
      color: b.color ?? baseColor,
      label: b.label,
      value: b.value,
    }))
    .filter((z) => z.to > z.from);
  const ticks = bands.map((b) => ({ t: toFrac(b.value), color: b.color ?? baseColor, value: b.value })).filter((k) => k.t > 0 && k.t < 1);

  const showRange = p.showRange === true;
  const hasLabel = showValue && (p.label != null || activeLabel != null);
  // Vertical layout — the value + label sit INSIDE the semicircle hollow (the
  // classic gauge readout), so the chin below the arc only needs room for the
  // optional min/max end labels. Those drop just under the coloured stroke / round
  // caps so they never overlap it. `dialPct` = the dial's share of the box height.
  const chin = 6 + (showRange ? 12 : 0);
  const VB_H = cy + cfg.stroke / 2 + chin;
  const dialPct = ((cy + cfg.stroke / 2) / VB_H) * 100;
  return (
    <div
      className={cn(chartWrap, 'items-center')}
      style={styleVars(
        { var: '--fr-gauge-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-gauge-value', value: p.valueColor, kind: 'color' },
      )}
    >
      <div
        // Pattern B — the size enum px is the DEFAULT var (--fr-gauge-w-default);
        // the exact `sizeValue` (re-validated by styleVars) sets --fr-gauge-w and
        // wins. [width:var(--fr-gauge-w,var(--fr-gauge-w-default))] max-w-full is the SOLE
        // width source (no w-full — it would win the cascade and defeat both).
        className="relative max-w-full [width:var(--fr-gauge-w,var(--fr-gauge-w-default))]"
        style={{
          '--fr-gauge-w-default': `${cfg.w}px`,
          ...styleVars({ var: '--fr-gauge-w', value: p.sizeValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 480 } }),
        } as CSSProperties}
        role="img"
        aria-label={summary}
      >
        <svg viewBox={`0 0 ${VB_W} ${VB_H.toFixed(2)}`} className="w-full" style={styleVars({ var: '--fr-gauge-track', value: p.trackColor, kind: 'color' })}>
          {/* track semicircle */}
          <path
            d={gaugeArc(cx, cy, r, 0, 1)}
            fill="none"
            stroke="var(--fr-gauge-track, var(--color-muted))"
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
          />
          {/* threshold ZONES — a tinted segment of the track per band, so the
              bands are legible even before the needle reaches them. `butt` caps
              keep neighbouring zones from bleeding into each other. */}
          {zones.map((z) => (
            <path
              key={`zone-${z.value}`}
              data-fr-gauge-zone=""
              d={gaugeArc(cx, cy, r, z.from, z.to)}
              fill="none"
              stroke={z.color}
              strokeOpacity={0.22}
              strokeWidth={cfg.stroke}
              strokeLinecap="butt"
            />
          ))}
          {/* threshold TICKS — a full-stroke rule across the track at each
              boundary, in the band's own colour. */}
          {ticks.map((k) => {
            const [x0, y0] = gaugePoint(cx, cy, r - cfg.stroke / 2, k.t);
            const [x1, y1] = gaugePoint(cx, cy, r + cfg.stroke / 2, k.t);
            return (
              <line
                key={`tick-${k.value}`}
                data-fr-gauge-tick=""
                x1={x0.toFixed(2)}
                y1={y0.toFixed(2)}
                x2={x1.toFixed(2)}
                y2={y1.toFixed(2)}
                stroke={k.color}
                strokeWidth={1.6}
                strokeLinecap="butt"
              />
            );
          })}
          {/* value arc */}
          {frac > 0 && (
            <path
              d={gaugeArc(cx, cy, r, 0, frac)}
              fill="none"
              stroke={arcColor}
              strokeWidth={cfg.stroke}
              strokeLinecap="round"
            />
          )}
        </svg>
        {showValue && (
          // READOUT — value + label sit INSIDE the semicircle hollow, centred in the
          // VERTICAL MIDDLE of the whole gauge (not the arc region), so the value
          // drops away from the crown and reads as nestled in the dial. Value
          // dominant (reads the shared `valueColor` channel with the foreground
          // token as fallback), label beneath.
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[6%] text-center">
            {/* The readout sits INSIDE the semicircle hollow — the arc is a stroke,
                nothing is painted under this number — so its surface is the card's
                and its chain ends in the inherited ink. The valueColor channel is
                untouched and the top-level value is unchanged. */}
            <span className={cn('font-semibold leading-none tabular-nums [color:var(--fr-gauge-value,currentColor)]', cfg.value, weightClass(p.weight))}>
              {valueText}
              {hasValue && unit && <span className={mutedClass('--fr-gauge-muted')}>{gap}{unit}</span>}
            </span>
            {hasLabel && (
              <span className={cn('mt-1 leading-tight', mutedClass('--fr-gauge-muted'), cfg.cap)}>{p.label ?? activeLabel}</span>
            )}
          </div>
        )}
        {/* min/max end captions at the arc feet (industry gauge
            convention), pinned to the diameter line so they flank the dial above
            the readout chin. mutedColor-tinted; opt-in. */}
        {showRange && (
          <div className={cn('pointer-events-none absolute inset-x-0 flex justify-between px-[3%] text-[0.625rem] leading-none tabular-nums', mutedClass('--fr-gauge-muted'))} style={{ top: `calc(${dialPct.toFixed(2)}% + 3px)` }} aria-hidden>
            <span>{formatReadout(min)}</span>
            <span>{formatReadout(max)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── RadialBar ──────────────────────────────────────────────────────────────── */

/* Concentric rings on a 0 0 36 36 viewBox. r=15.9155 -> circumference ~100, so
   stroke-dasharray = "<pct> 100" (mirrors ProgressCircle). Outer ring = datum 0;
   each ring radius decreases per index. Each ring has a track circle + a value arc. */
export function RadialBar({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    data?: Array<{ label?: string | null; value?: number | null; color?: string | null }> | null;
    max?: number | null;
    palette?: string | null;
    trackColor?: string | null;
    scaleColor?: string | null;
    valueColor?: unknown;
    height?: string | null;
    showLegend?: boolean | null;
    showValues?: boolean | null;
    mutedColor?: unknown;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const data = (Array.isArray(p.data) ? p.data : [])
    .map((d) => ({
      label: typeof d?.label === 'string' ? d.label : '',
      value: typeof d?.value === 'number' && Number.isFinite(d.value) ? d.value : null,
      color: typeof d?.color === 'string' ? d.color : null,
    }))
    .filter((d): d is { label: string; value: number; color: string | null } => d.value !== null);

  if (data.length === 0)
    return (
      <EmptyChart height={p.height} label="Radial bar chart" mutedVar="--fr-radialbar-muted" mutedColor={p.mutedColor} message={p.emptyText} />
    );

  const maxRaw = typeof p.max === 'number' && Number.isFinite(p.max) && p.max > 0 ? p.max : Math.max(...data.map((d) => Math.abs(d.value)), 100);
  const max = maxRaw > 0 ? maxRaw : 100;
  const showLegend = p.showLegend !== false;
  const showValues = p.showValues === true;

  // scaleColor: when a single valid hue is given, tint every ring from it (outer
  // solid → inner lighter), overriding the palette. Per-datum `color` still wins.
  const scale = typeof p.scaleColor === 'string' ? safeColor(p.scaleColor) : null;
  const ringColor = (color: string | null, index: number): string => {
    if (color != null) {
      const safe = safeColor(color);
      if (safe !== null) return safe;
    }
    if (scale !== null) {
      const pct = Math.max(20, 100 - index * (60 / Math.max(data.length - 1, 1)));
      return pct >= 100 ? scale : `color-mix(in srgb, ${scale} ${pct}%, transparent)`;
    }
    return seriesColor(color, p.palette, index);
  };

  const R0 = 15.9155; // outer ring radius -> circumference ~100
  const n = data.length;
  const ringGap = Math.min(4.2, 14 / Math.max(n, 1)); // shrink the step for many rings
  const stroke = Math.max(1.4, ringGap * 0.7);
  const summary =
    typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0
      ? p.ariaLabel
      : `Radial bar chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`;

  return (
    <div
      className={cn(chartWrap)}
      style={styleVars(
        { var: '--fr-radialbar-muted', value: p.mutedColor, kind: 'color' },
        // the legend value text (shown by showValues) reads this shared
        // `--fr-legend-value` channel with foreground fallback (byte-identical unset).
        { var: '--fr-legend-value', value: p.valueColor, kind: 'color' },
      )}
    >
      <div
        className="relative mx-auto aspect-square w-full max-w-[220px] shrink-0 [height:var(--fr-chart-height,200px)]"
        role="img"
        aria-label={summary}
        style={styleVars({ var: '--fr-chart-height', value: p.height, kind: 'dim', opts: DIM_OPTS })}
      >
        <svg
          viewBox="0 0 36 36"
          className="h-full w-full -rotate-90"
          style={styleVars({ var: '--fr-radial-track', value: p.trackColor, kind: 'color' })}
        >
          {data.map((d, i) => {
            const r = R0 - i * ringGap;
            if (r <= stroke) return null;
            const circ = 2 * Math.PI * r;
            const frac = Math.max(0, Math.min(1, Math.abs(d.value) / max));
            // normalize the dash to this ring's actual circumference.
            const dash = `${(frac * circ).toFixed(2)} ${((1 - frac) * circ + 0.01).toFixed(2)}`;
            return (
              <g key={i} className="cursor-pointer transition-[filter] duration-200 ease-out hover:brightness-110">
                <circle cx={18} cy={18} r={r} fill="none" stroke="var(--fr-radial-track, var(--color-muted))" strokeWidth={stroke} />
                <circle
                  cx={18}
                  cy={18}
                  r={r}
                  fill="none"
                  stroke={ringColor(d.color, i)}
                  strokeWidth={stroke}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                >
                  <title>{`${d.label || `Ring ${i + 1}`} — ${d.value}`}</title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>
      {showLegend && (
        <Legend
          mutedVar="--fr-radialbar-muted"
          items={data.map((d, i) => ({
            name: d.label || `Ring ${i + 1}`,
            color: ringColor(d.color, i),
            meta: showValues ? `${d.value}` : null,
          }))}
        />
      )}
    </div>
  );
}

/* ── Tracker ────────────────────────────────────────────────────────────────── */

// NB: the block sits inside a `flex-col items-center` cell wrapper, so its main
// axis is VERTICAL. `flex-1` here resolves to `flex-basis:0%` on the vertical
// axis and OVERRIDES the explicit `h-*` height → the strip collapses to 0px and
// renders invisible (the equal-width columns are already handled by the wrapper's
// own `flex-1` in the row). Use `w-full` for width and let `h-*` own the height.
// The block activates nothing — Tracker takes no emit and exposes no selection —
// so it carries the hover affordance for its tooltip WITHOUT a pointer cursor: a
// pointer promises activation, and there is none to give.
const trackerBlock = cva('min-w-[3px] w-full origin-center transition-[color,transform] duration-150 ease-out motion-safe:hover:scale-y-[1.35]', {
  variants: {
    size: { sm: 'h-6', md: 'h-9', lg: 'h-12' },
    rounded: { true: 'rounded-[3px]', false: 'rounded-none' },
  },
  defaultVariants: { size: 'md', rounded: true },
});
const TRACKER_GAP: Record<string, string> = {
  none: 'gap-0',
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5',
  xl: 'gap-2',
};

export function Tracker({ element }: ComponentRenderProps): ReactNode {
  // Measured before the empty-data return so the hook order is the same on the
  // render that first receives a `data` patch mid-stream.
  const stripRef = useRef<HTMLDivElement>(null);
  const stripBox = useAxisBox(stripRef, 'x');
  const p = (element.props ?? {}) as {
    data?: Array<{ tone?: string | null; color?: string | null; tooltip?: string | null; label?: string | null }> | null;
    size?: string | null;
    rounded?: boolean | null;
    showLabels?: boolean | null;
    gap?: string | null;
    mutedColor?: unknown;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const blocks = (Array.isArray(p.data) ? p.data : []).map((b) => ({
    tone: typeof b?.tone === 'string' ? b.tone : 'neutral',
    color: typeof b?.color === 'string' ? b.color : null,
    tooltip: typeof b?.tooltip === 'string' ? b.tooltip : null,
    label: typeof b?.label === 'string' ? b.label : null,
  }));

  if (blocks.length === 0) {
    const emptyText = typeof p.emptyText === 'string' && p.emptyText.length > 0 ? p.emptyText : 'No data';
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center rounded-frayme border border-dashed border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]/40 py-2 text-xs',
          mutedClass('--fr-tracker-muted'),
        )}
        role="img"
        aria-label={
          typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0 ? p.ariaLabel : 'Status tracker: no data'
        }
        style={styleVars({ var: '--fr-tracker-muted', value: p.mutedColor, kind: 'color' })}
      >
        {emptyText}
      </div>
    );
  }

  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const rounded = p.rounded !== false;
  const showLabels = p.showLabels === true;
  const gap = TRACKER_GAP[p.gap ?? 'sm'] ?? TRACKER_GAP.sm;
  const summary =
    typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0 ? p.ariaLabel : `Status tracker, ${blocks.length} segments`;

  const labels = blocks.map((b) => b.label ?? '');
  const kept = showLabels
    ? keptLabels(
        labels.map((l) => l.length > 0),
        tickBudget(stripBox, 'x', labels.reduce((m, l) => Math.max(m, l.length), 0)),
      )
    : labels.map(() => false);
  const thinned = labels.some((l, i) => l.length > 0 && !kept[i]);
  const first = kept.indexOf(true);
  const last = kept.lastIndexOf(true);

  return (
    // `img` is a LEAF role: it drops its whole subtree from the accessibility
    // tree, so every per-segment label under it would be unreachable. The strip
    // is the one chart here whose data lives per-segment, so the container is a
    // labelled `group` and each segment carries its own reading.
    <div
      className="flex w-full flex-col gap-1.5"
      role="group"
      aria-label={summary}
      style={styleVars({ var: '--fr-tracker-muted', value: p.mutedColor, kind: 'color' })}
    >
      {/* the strip carries the label type size, so the budget it measures is in
          the labels' OWN em — a text-zoomed label costs proportionally more of
          a strip whose px width has not moved. */}
      <div ref={stripRef} className={cn('flex w-full', gap, showLabels && 'text-[0.625rem]')}>
        {blocks.map((b, i) => {
          // Invalid-colour degradation (mirrors Gauge's safeColor ?? TONE_COLOR):
          // re-validate the per-block colour at point-of-use so a failing value
          // falls back to the tone token class — never a bare `var(--fr-tracker-bg)`
          // read with the var omitted, which would render the block invisible.
          const safe = b.color != null ? safeColor(b.color) : null;
          const hasColor = safe !== null;
          // What the mouse gets from `title`, assistive tech gets from the label.
          // A label that is ALREADY rendered as visible text below the block is
          // left to that text — one segment must not read twice.
          const reading = b.tooltip ?? (kept[i] ? null : b.label);
          const spoken = typeof reading === 'string' && reading.length > 0 ? reading : null;
          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  trackerBlock({ size, rounded }),
                  hasColor ? '[background:var(--fr-tracker-bg)]' : TONE_BG[b.tone] ?? TONE_BG.neutral,
                )}
                style={hasColor ? styleVars({ var: '--fr-tracker-bg', value: safe, kind: 'color' }) : undefined}
                title={b.tooltip ?? undefined}
                role={spoken != null ? 'img' : undefined}
                aria-label={spoken ?? undefined}
              />
              {kept[i] && (
                <span
                  className={cn(
                    // nowrap is EARNED here: `keptLabels` measured the strip and dropped
                    // every label that would not fit on ONE line at its full width, so a
                    // surviving label is a whole label — and nothing clips it (no
                    // truncate, no overflow-hidden), it just sits over its block.
                    'w-full whitespace-nowrap',
                    thinned && i === first ? 'text-left' : thinned && i === last ? 'text-right' : 'text-center',
                    mutedClass('--fr-tracker-muted'),
                  )}
                  title={b.label ?? undefined}
                >
                  {b.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Candlestick ────────────────────────────────────────────────────────────── */

/* OUR own SVG. Normalise all finite OHLC into a fixed viewBox (min=low.min,
   max=high.max). Per candle: a thin high-low <line> (wick) + a body <rect>
   from open..close. Up (close>=open) = success token; down = danger token. */
const CANDLE_SIZE: Record<string, { body: number; wick: number }> = {
  sm: { body: 0.55, wick: 0.9 },
  md: { body: 0.65, wick: 1.1 },
  lg: { body: 0.78, wick: 1.4 },
};

export function Candlestick({ element }: ComponentRenderProps): ReactNode {
  // Measured before the empty-data return so the hook order is the same on the
  // render that first receives a `data` patch mid-stream.
  const xAxisRef = useRef<HTMLDivElement>(null);
  const yAxisRef = useRef<HTMLDivElement>(null);
  const xBox = useAxisBox(xAxisRef, 'x');
  const yBox = useAxisBox(yAxisRef, 'y');
  const p = (element.props ?? {}) as {
    data?: Array<{ label?: string | null; open?: number | null; high?: number | null; low?: number | null; close?: number | null }> | null;
    height?: string | null;
    showGrid?: boolean | null;
    showAxis?: boolean | null;
    showYAxis?: boolean | null;
    size?: string | null;
    upColor?: string | null;
    downColor?: string | null;
    gridColor?: string | null;
    axisColor?: string | null;
    mutedColor?: unknown;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const candles = (Array.isArray(p.data) ? p.data : [])
    .map((c) => {
      const open = typeof c?.open === 'number' && Number.isFinite(c.open) ? c.open : null;
      const high = typeof c?.high === 'number' && Number.isFinite(c.high) ? c.high : null;
      const low = typeof c?.low === 'number' && Number.isFinite(c.low) ? c.low : null;
      const close = typeof c?.close === 'number' && Number.isFinite(c.close) ? c.close : null;
      if (open === null || high === null || low === null || close === null) return null;
      // `date` is the alias the specs actually write for an OHLC candle — every
      // dated Candlestick tested used it and none used `label`, so the
      // axis had nothing to draw even where it was mounted.
      const raw = (c ?? {}) as { label?: unknown; date?: unknown };
      const label = typeof raw.label === 'string' ? raw.label : typeof raw.date === 'string' ? raw.date : '';
      return { label, open, high, low, close };
    })
    .filter((c): c is { label: string; open: number; high: number; low: number; close: number } => c !== null);

  if (candles.length === 0)
    return (
      <EmptyChart height={p.height} label="Candlestick chart" mutedVar="--fr-candle-muted" mutedColor={p.mutedColor} message={p.emptyText} />
    );

  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const cfg = CANDLE_SIZE[size] ?? CANDLE_SIZE.md;
  const showGrid = p.showGrid !== false;
  const showYAxis = p.showYAxis === true;

  const lo = Math.min(...candles.map((c) => c.low));
  const hi = Math.max(...candles.map((c) => c.high));
  const span = hi - lo || 1;

  const VB_W = 300;
  const VB_H = 100;
  const PAD = 4;
  const n = candles.length;
  const slot = (VB_W - PAD * 2) / n;
  const bodyW = slot * cfg.body;
  const yOf = (v: number) => VB_H - PAD - ((v - lo) / span) * (VB_H - PAD * 2);
  const summary = typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0 ? p.ariaLabel : `Candlestick chart, ${n} candles`;
  // y-axis price ticks: hi at top → lo at bottom across the 5 gridlines.
  const yTicks = showYAxis
    ? Array.from({ length: 5 }).map((_, i) => {
        const v = hi - (i / 4) * span;
        return { top: ((i / 4) * 100).toFixed(2), value: Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(2)) };
      })
    : [];
  const yKept = keptLabels(yTicks.map(() => true), tickBudget(yBox, 'y', 0));

  const xLabels = candles.map((c) => c.label);
  // A dated series labels itself. `showAxis` used to default FALSE, so every
  // test candlestick drew bars over an unlabelled axis and no reader could
  // tell which day a bar was. An UNLABELLED series still mounts no axis row
  // (nothing to say), so a props-less, label-less chart is unchanged.
  const showAxis = p.showAxis === true || (p.showAxis !== false && xLabels.some((l) => l.length > 0));
  const xKept = keptLabels(
    xLabels.map((l) => l.length > 0),
    tickBudget(xBox, 'x', xLabels.reduce((m, l) => Math.max(m, l.length), 0)),
  );
  // A surviving label may be wider than the slot it centres on — harmless over a
  // slot whose own label was dropped, but at the ends it would leave the plot
  // box, so the outermost survivors lean inward.
  const xThinned = xLabels.some((l, i) => l.length > 0 && !xKept[i]);
  const xFirst = xKept.indexOf(true);
  const xLast = xKept.lastIndexOf(true);

  return (
    <div
      className={chartWrap}
      style={{
        ...styleVars({ var: '--fr-candle-muted', value: p.mutedColor, kind: 'color' }),
        ...styleVars({ var: '--fr-candle-axis', value: p.axisColor, kind: 'color' }),
      }}
    >
      {/* the height var sits on the wrapper so the tick gutter and the plot it
          labels resolve the SAME height — they are siblings, and a tick placed
          against a different height points at nothing. */}
      <div
        className={cn('relative w-full', showYAxis && 'pl-9')}
        style={styleVars({ var: '--fr-chart-height', value: p.height, kind: 'dim', opts: DIM_OPTS })}
      >
        {showYAxis && (
          <div
            ref={yAxisRef}
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-y-0 left-0 w-9 text-[0.6rem] tabular-nums [height:var(--fr-chart-height,200px)] [color:var(--fr-candle-axis,var(--color-muted-foreground))]',
            )}
          >
            {yTicks.map((t, i) =>
              yKept[i] ? (
                <span key={i} className="absolute right-1 -translate-y-1/2 text-right" style={{ top: `${t.top}%` }}>
                  {t.value}
                </span>
              ) : null,
            )}
          </div>
        )}
        <div className="relative w-full [height:var(--fr-chart-height,200px)]">
          <svg
            className="h-full w-full overflow-visible"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={summary}
            style={styleVars(
              { var: '--fr-candle-grid', value: p.gridColor, kind: 'color' },
              { var: '--fr-candle-up', value: p.upColor, kind: 'color' },
              { var: '--fr-candle-down', value: p.downColor, kind: 'color' },
            )}
          >
            {showGrid && (
              <g aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = PAD + (i / 4) * (VB_H - PAD * 2);
                  return (
                    <line
                      key={i}
                      x1={PAD}
                      y1={y.toFixed(2)}
                      x2={VB_W - PAD}
                      y2={y.toFixed(2)}
                      stroke="var(--fr-candle-grid, var(--color-border))"
                      strokeWidth={0.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>
            )}
            {candles.map((c, i) => {
              const cx = PAD + slot * (i + 0.5);
              const up = c.close >= c.open;
              const color = up ? 'var(--fr-candle-up, var(--color-success))' : 'var(--fr-candle-down, var(--color-danger))';
              const bodyTop = yOf(Math.max(c.open, c.close));
              const bodyBottom = yOf(Math.min(c.open, c.close));
              const bodyH = Math.max(bodyBottom - bodyTop, 0.75);
              return (
                <g key={i} className={cn(MARK_POP_SELF, 'hover:brightness-110')}>
                  <title>{`${c.label || `Candle ${i + 1}`} — O ${c.open} H ${c.high} L ${c.low} C ${c.close}`}</title>
                  <line
                    x1={cx.toFixed(2)}
                    y1={yOf(c.high).toFixed(2)}
                    x2={cx.toFixed(2)}
                    y2={yOf(c.low).toFixed(2)}
                    stroke={color}
                    strokeWidth={cfg.wick}
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={(cx - bodyW / 2).toFixed(2)}
                    y={bodyTop.toFixed(2)}
                    width={bodyW.toFixed(2)}
                    height={bodyH.toFixed(2)}
                    fill={color}
                    rx={0.5}
                  />
                </g>
              );
            })}
          </svg>
        </div>
        {showAxis && (
          <div
            ref={xAxisRef}
            data-fr-candle-axis=""
            className={cn('flex w-full justify-between text-[0.6875rem]', mutedClass('--fr-candle-muted'))}
            style={styleVars({ var: '--fr-candle-axis', value: p.axisColor, kind: 'color' })}
          >
            {candles.map((c, i) => (
              // every candle keeps its slot whether or not it is labelled, so a
              // surviving label still sits over the candle it names. nowrap is EARNED:
              // `keptLabels` measured the axis and kept only labels that fit on one
              // line at full width — a date must not fold in half — and no clip is
              // applied (no truncate, no overflow-hidden), so nothing is deleted.
              <span
                key={i}
                className={cn(
                  'min-w-0 flex-1 whitespace-nowrap [color:var(--fr-candle-axis,var(--color-muted-foreground))]',
                  xThinned && i === xFirst ? 'text-left' : xThinned && i === xLast ? 'text-right' : 'text-center',
                )}
                title={(xKept[i] && c.label) || undefined}
              >
                {xKept[i] ? c.label : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Treemap ────────────────────────────────────────────────────────────────── */

/* Slice-and-dice: sort by value desc, recursively split the box alternating
   horizontal/vertical so each rect's area ~ value/total. Rendered as absolutely
   positioned <div>s within a relative box sized by the height DIM var. */
/* `scrim` is the gradient painted under the in-cell text, and its stops are keyed
   to the SAME font scale as the two text classes beside it — that pairing is the
   whole point, see the measurement on the scrim element below. band = the tallest
   the text stack can be, MEASURED in Chromium rather than assumed: the label is
   line-clamp-2, and `leading-tight` does not survive tw-merge next to line-clamp,
   so each line is the line-height the size actually resolves to — Tailwind's own
   pair for text-xs/text-sm (16/20px), and the root's 1.5 for the arbitrary sizes
   (10px→15, 9px→13.5). Plus the cell's own 6px p-1.5. fade = band + 1.75rem.
     sm  2*15 + 13.5 + 6 = 49.5px → 3.125rem band · 4.875rem fade
     md  2*16 + 15   + 6 = 53px   → 3.375rem      · 5.125rem
     lg  2*20 + 16   + 6 = 62px   → 4rem          · 5.75rem   */
const TREEMAP_FONT: Record<string, { label: string; value: string; scrim: string }> = {
  sm: { label: 'text-[0.625rem]', value: 'text-[0.5625rem]', scrim: 'h-full [background:linear-gradient(to_top,var(--fr-tm-scrim)_0,var(--fr-tm-scrim)_3.125rem,transparent_4.875rem)]' },
  md: { label: 'text-xs', value: 'text-[0.625rem]', scrim: 'h-full [background:linear-gradient(to_top,var(--fr-tm-scrim)_0,var(--fr-tm-scrim)_3.375rem,transparent_5.125rem)]' },
  lg: { label: 'text-sm', value: 'text-xs', scrim: 'h-full [background:linear-gradient(to_top,var(--fr-tm-scrim)_0,var(--fr-tm-scrim)_4rem,transparent_5.75rem)]' },
};

type Rect = { x: number; y: number; w: number; h: number };
type Node = { label: string; value: number; color: string | null; index: number };

function sliceDice(nodes: Node[], rect: Rect, horizontal: boolean): Array<Rect & { node: Node }> {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...rect, node: nodes[0] }];
  const total = nodes.reduce((s, n) => s + n.value, 0) || 1;
  // split into two groups whose value sums are as balanced as possible (in order).
  let acc = 0;
  let splitIdx = 1;
  const half = total / 2;
  for (let i = 0; i < nodes.length; i++) {
    if (acc + nodes[i].value > half && i > 0) {
      splitIdx = i;
      break;
    }
    acc += nodes[i].value;
    splitIdx = i + 1;
  }
  splitIdx = Math.max(1, Math.min(nodes.length - 1, splitIdx));
  const groupA = nodes.slice(0, splitIdx);
  const groupB = nodes.slice(splitIdx);
  const sumA = groupA.reduce((s, n) => s + n.value, 0);
  const fracA = sumA / total;
  let rectA: Rect;
  let rectB: Rect;
  if (horizontal) {
    const wA = rect.w * fracA;
    rectA = { x: rect.x, y: rect.y, w: wA, h: rect.h };
    rectB = { x: rect.x + wA, y: rect.y, w: rect.w - wA, h: rect.h };
  } else {
    const hA = rect.h * fracA;
    rectA = { x: rect.x, y: rect.y, w: rect.w, h: hA };
    rectB = { x: rect.x, y: rect.y + hA, w: rect.w, h: rect.h - hA };
  }
  return [...sliceDice(groupA, rectA, !horizontal), ...sliceDice(groupB, rectB, !horizontal)];
}

export function Treemap({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    data?: Array<{ label?: string | null; value?: number | null; color?: string | null }> | null;
    palette?: string | null;
    height?: string | null;
    showValues?: boolean | null;
    size?: string | null;
    labelColor?: string | null;
    overlayColor?: string | null;
    mutedColor?: unknown;
    emptyText?: string | null;
    ariaLabel?: string | null;
  };
  const nodes: Node[] = (Array.isArray(p.data) ? p.data : [])
    .map((d, index) => ({
      label: typeof d?.label === 'string' ? d.label : '',
      value: typeof d?.value === 'number' && Number.isFinite(d.value) && d.value > 0 ? d.value : null,
      color: typeof d?.color === 'string' ? d.color : null,
      index,
    }))
    .filter((d): d is Node => d.value !== null)
    .sort((a, b) => b.value - a.value);

  if (nodes.length === 0)
    return (
      <EmptyChart height={p.height} label="Treemap" mutedVar="--fr-treemap-muted" mutedColor={p.mutedColor} message={p.emptyText} />
    );

  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const font = TREEMAP_FONT[size] ?? TREEMAP_FONT.md;
  // A scrim only helps when it moves the surface AWAY from the ink, and a
  // full-strength band is what makes that decisive — so it is painted when the
  // two are known to be a pair: the default ink (white, against the default dark
  // overlay) or an ink the author replaced AND gave a scrim to go with. Replace
  // the ink alone and the direction is unknowable — a dark label wants a LIGHT
  // scrim, and strengthening the dark default would bury it (measured: 4.56 →
  // 2.66 on #fde68a) — so that one path keeps the softer legacy ramp, unchanged,
  // and the catalog's "pair with overlayColor" stays the answer.
  const paired = safeColor(p.labelColor) === null || safeColor(p.overlayColor) !== null;
  const scrim = paired ? font.scrim : 'h-2/3 [background:linear-gradient(to_top,var(--fr-tm-scrim),transparent)]';
  const showValues = p.showValues !== false;
  const placed = sliceDice(nodes, { x: 0, y: 0, w: 100, h: 100 }, true);
  const summary =
    typeof p.ariaLabel === 'string' && p.ariaLabel.length > 0
      ? p.ariaLabel
      : `Treemap: ${nodes.map((n) => `${n.label} ${n.value}`).join(', ')}`;

  return (
    <div
      // --fr-tm-scrim resolves the authored overlay ONCE here so the per-size
      // gradient classes stay short and identical apart from their stops.
      className="relative w-full overflow-hidden rounded-frayme [height:var(--fr-chart-height,200px)] [--fr-tm-scrim:var(--fr-treemap-overlay,rgba(0,0,0,0.6))]"
      role="img"
      aria-label={summary}
      style={{
        ...styleVars({ var: '--fr-chart-height', value: p.height, kind: 'dim', opts: DIM_OPTS }),
        ...styleVars({ var: '--fr-treemap-label', value: p.labelColor, kind: 'color' }),
        ...styleVars({ var: '--fr-treemap-overlay', value: p.overlayColor, kind: 'color' }),
      }}
    >
      {placed.map(({ node, x, y, w, h }) => {
        const fill = seriesColor(node.color, p.palette, node.index);
        return (
          <div
            key={node.index}
            className="absolute flex flex-col justify-end overflow-hidden p-1.5 [background:var(--fr-treemap-bg)] ring-1 ring-inset ring-background/20 origin-center cursor-pointer transition-[transform,filter] duration-200 ease-out hover:z-10 hover:brightness-110 motion-safe:hover:scale-[1.03]"
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                width: `${w}%`,
                height: `${h}%`,
                '--fr-treemap-bg': fill,
              } as CSSProperties
            }
            title={node.label}
          >
            {/* fixed-dark scrim under the label so the label text reads on ANY cell
                fill (pale mono-palette tints / light per-datum colors) — the
                sanctioned "text over a fixed-dark scrim" pattern. The scrim colour
                (overlayColor) and the label colour (labelColor) are both settable,
                defaulting to a translucent black + white.

                It reached the text at a FRACTION of that colour. The scrim was one
                ramp from the overlay to transparent across the bottom 2/3 of the
                cell, and the text sits at the BOTTOM of that box — so the alpha
                where the ink lands was never 0.6, it was 0.6 scaled by how far up
                the ramp the text happened to be. Pixel-sampled (screenshot, ink
                blanked, worst pixel under each label box) on a 200px chart, the
                shipped default palette:

                  Engineering #60a5fa   6.77   Cotton  #fef3c7   3.51
                  Sales       #38bdf8   3.95   Linen   #e0f2fe   2.24
                  Marketing   #2dd4bf   3.51   Silk    #fce7f3   2.29
                  Support     #fbbf24   3.16   Wool    #111827  18.73

                — i.e. the stock four-colour treemap fails 4.5:1 on three of its own
                four cells with NO author input, and identically in light and dark
                (this is not the flip defect it was reported as; the cell is a data
                surface and is fixed by design in both modes). A DOM walk cannot see
                any of this: the scrim is a SIBLING of the label, not an ancestor, so
                getComputedStyle-based probes score the ink against the raw cell fill
                and report 1.11-2.54 — wrong numbers for the right conclusion.

                The fix is the surface, not the ink: hold the overlay at FULL strength
                across the band the text occupies, then ramp out above it. At 0.6
                alpha over the worst possible fill (white) the surface is rgb(102),
                which carries the default white label at 5.74:1 and the 85%-alpha
                value line at 5.29:1 — for ANY fill, which is what "reads on ANY cell
                fill" claimed. Stops are absolute (rem, per size) rather than
                percentages so the guarantee does not depend on cell height; a cell
                shorter than the band is covered edge to edge, which is the right
                trade when the alternative is an unreadable label.

                UNCHANGED and still the author's job: an authored `labelColor` that is
                DARK still needs its own `overlayColor` (the catalog prop says so). A
                dark ink on the default black scrim measured 3.14 before this change
                and 2.98 after — both failing, both fixed by pairing the two props. */}
            <div
              aria-hidden
              className={cn('pointer-events-none absolute inset-x-0 bottom-0', scrim)}
            />
            {/* A cell is TALL as often as it is wide (slice-and-dice alternates the
                split axis), so a one-line label threw away rows the cell already had:
                a DECLARED two-line budget spends them, and break-words keeps a long
                single word inside the cell instead of ellipsing it away. The value
                wraps rather than clips for the same reason digits are never elided. */}
            <span className={cn('relative line-clamp-2 break-words font-medium leading-tight [color:var(--fr-treemap-label,#fff)]', font.label)} title={node.label || undefined}>
              {node.label}
            </span>
            {showValues && (
              <span
                className={cn(
                  'relative break-words tabular-nums leading-tight [color:color-mix(in_srgb,var(--fr-treemap-label,#fff)_85%,transparent)]',
                  font.value,
                )}
              >
                {node.value}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
