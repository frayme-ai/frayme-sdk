/**
 * Frayme charts-radial — 5 data-viz schemas on the truly-dynamic foundation.
 *
 * Same locked contract as the shipped charts group: bounded ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for a
 * color, `dimensionSchema` for a length). Every enum/value prop is `.nullable()`
 * + `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants`, so a
 * props-less spec still renders polished.
 *
 * SECURITY / chart-specific contract (non-negotiable):
 *  - The chart's markup is OURS (svg path/rect/circle/line/text, or positioned
 *    divs). The spec supplies only NUMBERS (value/min/max/OHLC) + labels +
 *    validated colors — never markup, never a CSS-property string. The renderer
 *    filters to finite numbers and computes every coordinate, normalizing into a
 *    fixed viewBox or a 0..100 percentage axis.
 *  - A datum MAY carry its OWN exact `color` (the gate-covered COLOR_KEY `color`).
 *    It is `colorSchema` NESTED inside the array's `z.object` so the catalog Zod
 *    gate validates each one, and the renderer re-validates via `safeColor` at
 *    point-of-use. When omitted, the `palette`/`tone` enum supplies a fixed,
 *    token-based color.
 *  - `palette` is an ENUM → a FIXED set of design-token series colors; never a
 *    value channel. Candlestick is token-driven only (up=success, down=danger) —
 *    no per-candle color override, so no new value key.
 *  - `height` is the shared VALUE dimension (a gate DIM_KEY), bounded 80–800.
 *
 * Channel legend: E enum · C content (numbers/labels) · SC safeColor (VALUE) ·
 * D dimension (VALUE).
 *
 * Components: Gauge · RadialBar · Tracker · Candlestick · Treemap.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Weight } from './_shared.js';

/* The shared chart palette ENUM — names a FIXED, token-based set of series
 * colors the renderer maps. A NAMED set, never a free value; per-datum exact
 * colors use the nested `color` value channel instead. */
const paletteSchema = z
  .enum(['brand', 'cool', 'warm', 'categorical', 'mono'])
  .nullable()
  .describe(
    'Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-datum `color` overrides its slot.',
  );

/* The shared chart height VALUE — a real CSS length (gate DIM_KEY `height`),
 * applied via the renderer's `--fr-<comp>-height` var. */
const chartHeight = dimensionSchema({ units: ['px', 'rem'], min: 80, max: 800 }).describe(
  'Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80–800.',
);

export const chartsRadialComponents = {
  // =========================================================================
  // Gauge — single-value half-circle dial
  // =========================================================================
  Gauge: {
    props: z.object({
      value: z.number().describe('The current value to point the dial at (clamped into [min,max]).'),
      min: z.number().nullable().describe('Low end of the dial scale — where the arc sweep starts at 0% (default 0). `value` is clamped into [min,max].'),
      max: z.number().nullable().describe('High end of the dial scale — the value at which the arc reaches the full 180° sweep (default 100). Must exceed `min`; a non-increasing pair falls back to min+1.'),
      thresholds: z
        .array(
          z.object({
            value: z.number().describe('The value at which this colored zone begins.'),
            color: colorSchema.describe('Exact color for this zone of the arc.'),
            label: z.string().nullable().describe('Optional zone label (shown as the active band caption).'),
          }),
        )
        .nullable()
        .describe('Colored zones along the arc; each is { value, color?, label? }. When set, the value-arc takes the color of the band the value falls in.'),
      tone: z
        .enum(['neutral', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic color of the value arc via token (default neutral = a muted grey, unified with ProgressCircle/Tracker). Overridden by `color` or a matching `thresholds` band.'),
      color: colorSchema.describe('Exact value-arc color. Wins over `tone` (but a matching `thresholds` band still colors the arc).'),
      trackColor: colorSchema.describe('Exact color of the empty background track (default the muted token).'),
      valueColor: colorSchema.describe('Exact colour of the centre KPI value text (default the foreground token). The shared value-text channel across Gauge/RadialBar/ProgressCircle.'),
      size: z
        .enum(['sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Overall dial scale — dial width plus matching arc stroke and center value/caption text sizes: sm (130px) · md (180px, default) · lg (240px) · xl (320px).'),
      sizeValue: dimensionSchema({ units: ['px', 'rem'], min: 80, max: 480 }).describe(
        'Exact dial width (e.g. 200px / 14rem). Overrides the `size` enum for the dial WIDTH only; the arc stroke + centre text sizes stay enum-driven. Parity with ProgressCircle.sizeValue.',
      ),
      showValue: z.boolean().nullable().describe('Show the value (+unit) in the dial center (default true).'),
      showRange: z.boolean().nullable().describe('Show the min/max scale extremes as small captions at the two arc feet (industry gauge convention), tinted by `mutedColor` (default false).'),
      weight: Weight.describe('Font weight of the center dial value — the dominant KPI (default semibold). Size follows the `size` enum.'),
      label: z.string().nullable().describe('Caption under the center value naming the metric (e.g. "CPU load"). Keep to 1–3 words; when set it replaces the active `thresholds` band label, and it only renders while `showValue` is on.'),
      unit: z.string().nullable().describe('Unit suffix appended to the value (e.g. "%", "ms").'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the centre unit suffix, the caption under the value, and the min/max range captions (default the muted-foreground token).'),
      ariaLabel: z.string().nullable().describe('Override the screen-reader summary of the dial (default an auto value/range/label summary).'),
    }),
    description:
      'A single-value half-circle (180°) gauge dial. The arc sweep = (value−min)/(max−min). `thresholds` color the arc by zone; otherwise `tone`/`color` set it. Center shows the value (+unit) and `label`.',
    example: { value: 72, unit: '%', label: 'CPU load', tone: 'warning' },
  },

  // =========================================================================
  // RadialBar — concentric proportional rings
  // =========================================================================
  RadialBar: {
    props: z.object({
      data: z
        .array(
          z.object({
            label: z.string().describe('Ring label (shown in the legend).'),
            value: z.number().describe('Ring value; the arc length = value÷max of a full circle.'),
            color: colorSchema.describe('Exact color for this ring. Overrides the `palette` slot.'),
          }),
        )
        .describe('One ring per datum; each is { label, value, color? }. The first datum is the OUTER ring.'),
      max: z.number().nullable().describe('The value that fills a full circle (default the largest value, or 100).'),
      palette: paletteSchema,
      trackColor: colorSchema.describe('Exact color of each ring’s empty track (default the muted token).'),
      scaleColor: colorSchema.describe('When set, tint every ring as a single-hue scale from this colour (outer ring solid → inner rings lighter), overriding `palette`. Use for one-metric radial scales; leave unset for distinct per-ring colours.'),
      valueColor: colorSchema.describe('Exact colour of the legend value text shown by `showValues` (default the foreground token). The shared value-text channel across Gauge/RadialBar/ProgressCircle.'),
      height: chartHeight,
      showLegend: z.boolean().nullable().describe('Show a legend of ring labels beside the chart (default true).'),
      showValues: z.boolean().nullable().describe('Print each ring’s value in the legend (default false).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the legend ring labels and the empty-state caption (default the muted-foreground token).'),
      emptyText: z.string().nullable().describe('Override the empty-state message shown when there is no valid data (default "No data").'),
      ariaLabel: z.string().nullable().describe('Override the screen-reader summary of the chart (default an auto per-ring summary).'),
    }),
    description:
      'Concentric proportional rings (one per datum). Each ring’s arc = value÷max of a full circle; the first datum is the outermost ring. `palette` colors rings without a per-ring `color`.',
    example: {
      data: [
        { label: 'Mobile', value: 78 },
        { label: 'Desktop', value: 54 },
        { label: 'Tablet', value: 31 },
      ],
    },
  },

  // =========================================================================
  // Tracker — a row of small status blocks (uptime strip)
  // =========================================================================
  Tracker: {
    props: z.object({
      data: z
        .array(
          z.object({
            tone: z
              .enum(['neutral', 'success', 'warning', 'critical', 'info'])
              .nullable()
              .describe('Semantic status color of this block via token (default neutral = a 60% grey block).'),
            color: colorSchema.describe('Exact color for this block. Overrides `tone`.'),
            tooltip: z.string().nullable().describe('Native hover tooltip for this block (e.g. "99.98% — Operational").'),
            label: z.string().nullable().describe('Optional short label rendered under the block when `showLabels`.'),
          }),
        )
        .describe('The blocks, left→right; each is { tone?, color?, tooltip?, label? }. Great for an uptime / health strip.'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Block height: sm (24px) · md (36px, default) · lg (48px). Block width is always equal-flex across the strip.'),
      rounded: z.boolean().nullable().describe('Round each block’s corners at 3px (default true); false renders sharp square blocks.'),
      showLabels: z.boolean().nullable().describe('Render each block’s `label` beneath it (default false).'),
      gap: z
        .enum(['none', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Spacing between blocks: none (0) · sm (2px, default) · md (4px) · lg (6px) · xl (8px).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the per-block labels beneath the blocks and the empty-state caption (default the muted-foreground token).'),
      emptyText: z.string().nullable().describe('Override the empty-state message shown when there are no blocks (default "No data").'),
      ariaLabel: z.string().nullable().describe('Override the screen-reader summary of the tracker (default "Status tracker, N segments").'),
    }),
    description:
      'A row of equal-width status blocks (Tremor-style tracker). Each block is colored by its `tone` token (success/warning/critical/…) or an exact `color`, with a native hover `tooltip`. Ideal for uptime/health strips.',
    example: {
      data: [
        { tone: 'success', tooltip: 'Operational' },
        { tone: 'success', tooltip: 'Operational' },
        { tone: 'warning', tooltip: 'Degraded' },
        { tone: 'success', tooltip: 'Operational' },
      ],
    },
  },

  // =========================================================================
  // Candlestick — OHLC finance chart
  // =========================================================================
  Candlestick: {
    props: z.object({
      data: z
        .array(
          z.object({
            label: z.string().nullable().describe('X-axis label for this candle (e.g. a date).'),
            open: z.number().describe('Opening price.'),
            high: z.number().describe('High price (the wick top).'),
            low: z.number().describe('Low price (the wick bottom).'),
            close: z.number().describe('Closing price.'),
          }),
        )
        .describe('OHLC candles; each is { label?, open, high, low, close }. Up candles (close≥open) use the success token, down candles the danger token.'),
      height: chartHeight,
      showGrid: z.boolean().nullable().describe('Draw horizontal price gridlines behind the candles (default true).'),
      showAxis: z.boolean().nullable().describe('Show the x-axis labels under the candles (default false).'),
      showYAxis: z.boolean().nullable().describe('Show price tick labels down the left edge (default false).'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Candle body width / wick thickness scale (default md).'),
      upColor: colorSchema.describe('Exact fill for rising candles (close≥open). Default the success token.'),
      downColor: colorSchema.describe('Exact fill for falling candles (close<open). Default the danger token.'),
      gridColor: colorSchema.describe('Exact colour of the horizontal price gridlines. Default the border token.'),
      axisColor: colorSchema.describe('Text colour of the x-axis date labels under the plot and the y-axis price tick values down the left gutter (default the muted-foreground token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the empty-state caption (default the muted-foreground token).'),
      emptyText: z.string().nullable().describe('Override the empty-state message shown when there are no valid candles (default "No data").'),
      ariaLabel: z.string().nullable().describe('Override the screen-reader summary of the chart (default "Candlestick chart, N candles").'),
    }),
    description:
      'An OHLC candlestick finance chart. Each candle is { label?, open, high, low, close }; the wick spans low→high and the body open→close. Up candles are colored with the success token, down candles with the danger token; chart-level `upColor`/`downColor` override those tokens (no PER-CANDLE color).',
    example: {
      data: [
        { label: 'Mon', open: 30, high: 36, low: 28, close: 34 },
        { label: 'Tue', open: 34, high: 38, low: 32, close: 31 },
        { label: 'Wed', open: 31, high: 35, low: 29, close: 35 },
      ],
    },
  },

  // =========================================================================
  // Treemap — single-level proportional rectangles
  // =========================================================================
  Treemap: {
    props: z.object({
      data: z
        .array(
          z.object({
            label: z.string().describe('Rectangle label.'),
            value: z.number().describe('Rectangle value; its area is proportional to value÷total.'),
            color: colorSchema.describe('Exact color for this rectangle. Overrides the `palette` slot.'),
          }),
        )
        .describe('The rectangles; each is { label, value, color? }. Area ≈ value ÷ sum of values (slice-and-dice layout).'),
      palette: paletteSchema,
      height: chartHeight,
      showValues: z.boolean().nullable().describe('Print each rectangle’s value under its label (default true).'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Font scale of the in-cell label/value text: sm (10px/9px) · md (12px/10px, default) · lg (14px/12px). Rectangle sizes are value-driven and unaffected.'),
      labelColor: colorSchema.describe('Text colour of the in-cell label and value (default white). Paired with `overlayColor`, the scrim it is printed on — a dark label needs a light `overlayColor` or it will not read.'),
      overlayColor: colorSchema.describe('Exact colour of the dark scrim drawn under each cell’s label so the text stays legible over pale fills (default a translucent black).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the empty-state caption (default the muted-foreground token). The in-cell label colour is set via `labelColor` and the scrim via `overlayColor`.'),
      emptyText: z.string().nullable().describe('Override the empty-state message shown when there is no valid data (default "No data").'),
      ariaLabel: z.string().nullable().describe('Override the screen-reader summary of the chart (default an auto per-cell summary).'),
    }),
    description:
      'A single-level treemap of proportional rectangles (slice-and-dice). Each datum is { label, value, color? }; rectangle area ≈ value÷total. `palette` colors rectangles without a per-rect `color`.',
    example: {
      data: [
        { label: 'Engineering', value: 48 },
        { label: 'Sales', value: 26 },
        { label: 'Marketing', value: 16 },
        { label: 'Support', value: 10 },
      ],
    },
  },
};
