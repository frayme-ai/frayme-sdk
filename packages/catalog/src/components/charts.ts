/**
 * Frayme charts — 5 data-viz schemas on the truly-dynamic foundation.
 *
 * Same locked contract as the shipped catalog: bounded ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for a
 * color, `dimensionSchema` for a length). Every enum/value prop is `.nullable()`
 * + `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants`, so a
 * props-less spec still renders polished.
 *
 * SECURITY / chart-specific contract (non-negotiable):
 *  - The chart's `<svg>` markup is OURS (polyline/path/rect/circle/text). The
 *    spec supplies only NUMBERS (the series) + labels + validated colors — never
 *    markup, never a CSS property string. The renderer filters to finite numbers
 *    and computes every coordinate, normalizing into a fixed viewBox.
 *  - A series / bar / slice MAY carry its OWN exact `color` (the gate-covered
 *    COLOR_KEY `color`). It is `colorSchema` NESTED inside the array's `z.object`
 *    so the catalog Zod gate validates each one, and the renderer re-validates via
 *    `safeColor` at point-of-use. When omitted, the `palette` enum supplies a
 *    fixed, token-based series color.
 *  - `palette` is an ENUM (brand · cool · warm · categorical · mono) → a FIXED set
 *    of design-token series colors; never a value channel.
 *  - `height` is the one shared VALUE dimension (a gate DIM_KEY), bounded
 *    80–800px/rem.
 *
 * Channel legend: E enum · C content (numbers/labels) · SC safeColor (VALUE) ·
 * D dimension (VALUE).
 *
 * Components: AreaChart · BarChart · LineChart · DonutChart · Sparkline.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Weight } from './_shared.js';

/* The shared chart palette ENUM — names a FIXED, token-based set of series
 * colors the renderer maps (brand=[primary,sky,teal,amber,rose], etc.).
 * A NAMED set, never a free value; per-series exact colors use the nested
 * `color` value channel instead. */
const paletteSchema = z
  .enum(['brand', 'cool', 'warm', 'categorical', 'mono'])
  .nullable()
  .describe(
    'Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-series `color` overrides its slot.',
  );

/* The shared chart height VALUE — a real CSS length (gate DIM_KEY `height`),
 * applied via the renderer's `--fr-<comp>-height` var. */
const chartHeight = dimensionSchema({ units: ['px', 'rem'], min: 80, max: 800 }).describe(
  'Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80–800.',
);

/* The shared chart display-size ENUM (stroke/label/dot scale), distinct from the
 * `height` value channel which sets the actual plot box height. */
const chartSize = z
  .enum(['sm', 'md', 'lg'])
  .nullable()
  .describe('Overall scale of strokes, dots, and labels (default md).');

/* ── shared CHROME channels ───────────────────────────────────────
 * Chart chrome — gridlines, axis/tick-label colour, the empty-state message, the
 * aria summary, and the area/bar fill density — all settable from the spec, each
 * defaulting to the current theme token / computed value so a props-less chart is
 * byte-identical. Colours are gate COLOR_KEYs (`gridColor`/`axisColor`); the
 * renderer applies them as SVG attributes reading `var(--fr-…, token)`, NOT as
 * Tailwind classes. `fillOpacity` is a bounded ENUM (density, not a colour);
 * `emptyText`/`ariaLabel` are plain content strings (NOT gated). */
const gridColor = colorSchema.describe(
  'Gridline colour (the horizontal rules behind the plot). Default the border token.',
);
const axisColor = colorSchema.describe(
  'Value-annotation colour — the in-plot numeric `<text>` drawn when `showValues:true` (default the muted-foreground token). These charts render no axis or tick labels, so this is inert unless `showValues` is on.',
);
const fillOpacity = z
  .enum(['solid', 'soft'])
  .nullable()
  .describe(
    'Fill density of the area/bar body: solid (fuller, more saturated) · soft (lighter, more translucent). Default keeps the current subtle fill.',
  );
const emptyText = z
  .string()
  .nullable()
  .describe('Override the empty-state message shown when there is no data (default "No data").');
const chartAriaLabel = z
  .string()
  .nullable()
  .describe('Override the auto-generated screen-reader summary (role="img" aria-label). Default a computed description of the series.');

/* ── shared VALUE-FORMATTING channels ────────────────────────────────────────
 * A bounded ENUM (never author-supplied format code) that shapes how numeric
 * annotations print (bar values, the donut total + legend values), plus optional
 * plain-text prefix/suffix strings. Default `plain` keeps the raw number, so a
 * props-less chart is byte-identical. */
const valueFormat = z
  .enum(['plain', 'compact', 'percent'])
  .nullable()
  .describe(
    'How numeric annotations print: plain (the raw number, default) · compact ("1.2k"/"3.4M" abbreviations) · percent (the value as a "%", 0–100 as-is). Pairs with `valuePrefix`/`valueSuffix`.',
  );
const valuePrefix = z
  .string()
  .nullable()
  .describe('Text prepended to each formatted value (e.g. "$", "£"). Escaped content. Default none.');
const valueSuffix = z
  .string()
  .nullable()
  .describe('Text appended to each formatted value (e.g. " users", "k"). Escaped content. Default none.');

/* The x-axis category labels. Plain content strings (NOT gated) rendered
 * as an HTML row below the plot, aligned to the shared x index. */
const xLabels = z
  .array(z.string())
  .nullable()
  .describe('Category labels drawn as a row under the plot, one per x-index (e.g. ["Mon",…,"Sun"]). Aligned to the shared series index; extras/missing entries are ignored. Coloured by `axisColor`. Omit for no x-axis labels.');

/* Axis TITLES + the y tick column. A chart a reader can take a number
 * off needs three things: tick VALUES on the y axis, and a name for each axis. */
const xAxisTitle = z
  .string()
  .nullable()
  .describe('Name of the x axis, centred under the category labels (e.g. "Month", "Ad spend ($k)"). Say what the axis MEASURES — omit when the labels already say it (a row of month names needs no "Month" title).');
const yAxisTitle = z
  .string()
  .nullable()
  .describe('Name of the y axis with its unit, shown above the plot (e.g. "Value ($k)", "Sessions"). Include the unit here rather than repeating it on every tick.');
const showYAxis = z
  .boolean()
  .nullable()
  .describe('Y-axis tick values down the left edge, aligned to the gridlines (default TRUE — a value chart should be readable). Set false only for a sparkline-style plot where the shape is the whole point.');

export const chartComponents = {
  // =========================================================================
  // AreaChart — filled area + stroke line per series
  // =========================================================================
  AreaChart: {
    props: z.object({
      series: z
        .array(
          z.object({
            name: z.string(),
            points: z.array(z.number()),
            color: colorSchema.describe('Exact color for this series (fill + line). Overrides the `palette` slot.'),
          }),
        )
        .describe('One or more series; each is { name, points:number[], color? }. All series share the same x-axis index.'),
      curve: z
        .enum(['linear', 'smooth', 'step'])
        .nullable()
        .describe('Line interpolation between points: linear (default) · smooth (curved) · step (stairs).'),
      stacked: z.boolean().nullable().describe('Stack series on top of each other (cumulative bands) instead of overlaying.'),
      xLabels,
      xAxisTitle,
      yAxisTitle,
      showYAxis,
      palette: paletteSchema,
      height: chartHeight,
      size: chartSize,
      strokeWidth: dimensionSchema({ units: ['px'], min: 0.5, max: 8 }).describe(
        'Exact area-outline stroke width in px (e.g. 3). Overrides the `size` enum, which is the default.',
      ),
      showGrid: z.boolean().nullable().describe('Draw horizontal gridlines behind the areas (default true).'),
      showLegend: z.boolean().nullable().describe('Show a legend of series names below the chart (default true when >1 series).'),
      showValues: z.boolean().nullable().describe('Annotate each data point with its numeric value (default false; best for sparse series).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the legend series names below the chart and the empty-state caption (default the muted-foreground token).'),
      gridColor,
      axisColor,
      fillOpacity,
      emptyText,
      ariaLabel: chartAriaLabel,
    }),
    description:
      'Filled area chart (one or more series). Each series is { name, points:number[], color? }. `stacked` cumulates bands; `palette` colors the series when no per-series `color` is set.',
    example: {
      series: [{ name: 'Revenue', points: [12, 19, 14, 22, 30, 28, 35] }],
      curve: 'smooth',
    },
  },

  // =========================================================================
  // BarChart — bars scaled to the max value
  // =========================================================================
  BarChart: {
    props: z.object({
      data: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            color: colorSchema.describe('Exact color for this bar. Overrides the `palette` slot.'),
          }),
        )
        .describe('Single-series bars; each is { label, value, color? }, scaled to the largest value. IGNORED when `series` is set (grouped/stacked mode wins).'),
      series: z
        .array(
          z.object({
            name: z.string().describe('Series name (shown in the legend).'),
            values: z.array(z.number()).describe('One value per category, aligned to `labels` by index.'),
            color: colorSchema.describe('Exact color for this series’ bars. Overrides the `palette` slot.'),
          }),
        )
        .nullable()
        .describe('Multi-series grouped/stacked bars; each is { name, values:number[], color? } aligned to `labels` by index. When set, WINS over `data` (grouped/stacked comparison mode). Capped at 5 series (extras are dropped). Use `groupMode` to group vs stack.'),
      labels: z
        .array(z.string())
        .nullable()
        .describe('Category labels (x axis) for the multi-series `series` mode, one per value index (e.g. ["Q1","Q2","Q3","Q4"]). Ignored in single-series `data` mode (bars carry their own label).'),
      groupMode: z
        .enum(['grouped', 'stacked'])
        .nullable()
        .describe('Multi-series layout: grouped (bars sit side-by-side per category, default) · stacked (values stack into one bar per category). Only applies when `series` is set. In horizontal layout, `stacked` falls back to `grouped`.'),
      layout: z
        .enum(['vertical', 'horizontal'])
        .nullable()
        .describe('Bar direction: vertical (columns, default) · horizontal (rows — better for long labels / many categories). Horizontal + `stacked` renders as grouped.'),
      rounded: z.boolean().nullable().describe('Round the far (value) end of each bar for a softer look (default true); set false for square-cut bars matching a denser data-dashboard style.'),
      palette: paletteSchema,
      height: chartHeight,
      xAxisTitle,
      yAxisTitle,
      showYAxis,
      showGrid: z.boolean().nullable().describe('Draw value gridlines behind the bars (default true; vertical layout only — horizontal bars render no gridlines). One line per y tick, so the grid and the tick column agree.'),
      showLegend: z.boolean().nullable().describe('Show a legend mapping color→label below the chart (default false in single-series `data` mode; default true in multi-series `series` mode).'),
      showValues: z.boolean().nullable().describe('Print each bar’s value at its end (default true). In stacked mode, prints the per-segment value.'),
      valueFormat,
      valuePrefix,
      valueSuffix,
      mutedColor: colorSchema.describe('Secondary/muted text colour — the axis category labels, legend names, and the empty-state caption (default the muted-foreground token).'),
      gridColor,
      axisColor: colorSchema.describe(
        'Text colour of BarChart’s numeric and axis annotations — the value printed at each bar’s end when `showValues` is on, the y-axis tick values, the x-axis category labels, and the `xAxisTitle`/`yAxisTitle` rows (default the inherited foreground). In `groupMode:"stacked"` the same colour prints the in-segment value over the series fill, so keep it legible on the bars too.',
      ),
      fillOpacity,
      emptyText,
      ariaLabel: chartAriaLabel,
    }),
    description:
      'Bar/column chart. Single-series: `data` = { label, value, color? }[]. Multi-series (grouped or stacked comparison): `series` = { name, values:number[], color? }[] + `labels` (x categories) + `groupMode` — `series` wins over `data`. `layout:horizontal` for long labels; `palette` colors bars/series without a `color`. Name the measure with `yAxisTitle` — vertical bars render a y tick column beside the plot. In `layout:horizontal` the measure runs along x instead, so name it with `xAxisTitle` (no tick column is drawn there; each bar carries its own value).',
    example: {
      data: [
        { label: 'Mon', value: 12 },
        { label: 'Tue', value: 19 },
        { label: 'Wed', value: 8 },
      ],
    },
  },

  // =========================================================================
  // LineChart — polylines per series
  // =========================================================================
  LineChart: {
    props: z.object({
      series: z
        .array(
          z.object({
            name: z.string(),
            points: z.array(z.number()),
            color: colorSchema.describe('Exact color for this line. Overrides the `palette` slot.'),
          }),
        )
        .describe('One or more line series; each is { name, points:number[], color? } sharing the x-axis index.'),
      curve: z
        .enum(['linear', 'smooth', 'step'])
        .nullable()
        .describe('Line interpolation: linear (default) · smooth (curved) · step (stairs).'),
      showDots: z.boolean().nullable().describe('Draw a marker dot at each data point (default true). Dots are suppressed on series longer than 24 points, even when set to true.'),
      xLabels,
      xAxisTitle,
      yAxisTitle,
      showYAxis,
      palette: paletteSchema,
      height: chartHeight,
      size: chartSize,
      strokeWidth: dimensionSchema({ units: ['px'], min: 0.5, max: 8 }).describe(
        'Exact line stroke width in px (e.g. 3). Overrides the `size` enum, which is the default. Dot radius stays size-driven.',
      ),
      showGrid: z.boolean().nullable().describe('Draw horizontal gridlines behind the lines (default true).'),
      showLegend: z.boolean().nullable().describe('Show a legend of series names below the chart (default true when >1 series).'),
      showValues: z.boolean().nullable().describe('Annotate each point with its numeric value (default false).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the legend series names below the chart and the empty-state caption (default the muted-foreground token).'),
      gridColor,
      axisColor,
      dotColor: colorSchema.describe('Fill of the point-marker dots — the "hole punch" over each line (default the card token). Set to match a tinted surface behind the chart so the dots keep reading as holes.'),
      emptyText,
      ariaLabel: chartAriaLabel,
    }),
    description:
      'Line chart (one or more series). Each series is { name, points:number[], color? }. `palette` colors series without a per-series `color`; `showDots` marks each point.',
    example: {
      series: [
        { name: 'This week', points: [4, 8, 6, 10, 9, 12, 14] },
        { name: 'Last week', points: [3, 5, 7, 6, 8, 7, 9] },
      ],
    },
  },

  // =========================================================================
  // DonutChart — ring of proportional segments
  // =========================================================================
  DonutChart: {
    props: z.object({
      data: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            color: colorSchema.describe('Exact color for this slice. Overrides the `palette` slot.'),
          }),
        )
        .describe('The slices; each is { label, value, color? }. Slice arc = value ÷ sum of values.'),
      thickness: z
        .enum(['thin', 'md', 'thick'])
        .nullable()
        .describe('Ring stroke width: thin · md (default) · thick. `thin` reads as a progress ring, `thick` as a chunky donut.'),
      strokeWidth: dimensionSchema({ units: ['px'], min: 2, max: 48 }).describe(
        'Exact ring stroke width in 100-unit viewBox space (not screen px; e.g. 20). Overrides the `thickness` enum, which is the default.',
      ),
      showTotal: z.boolean().nullable().describe('Show the summed total in the donut’s center hole (default true).'),
      totalLabel: z
        .string()
        .nullable()
        .describe('Caption under the center total when `showTotal` is on (default "Total"). Set it to localise or rename the KPI (e.g. "Sum", "Sessions").'),
      weight: Weight.describe('Font weight of the center total value — the donut’s single KPI (default semibold). Use `bold` to make it heavier, `medium`/`normal` lighter.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe(
        'Exact font size of the center total value (e.g. "1.75rem" or "28px"; default 1.375rem). Bump it up when the donut is large.',
      ),
      palette: paletteSchema,
      height: chartHeight,
      showLegend: z.boolean().nullable().describe('Show a legend mapping color→label beside the ring (default true).'),
      showValues: z.boolean().nullable().describe('Print each slice’s value/percent in the legend (default false).'),
      valueFormat: valueFormat.describe(
        'How the center total prints: plain (the raw sum, default) · compact ("1.2k") · percent. Pairs with `valuePrefix`/`valueSuffix`. The legend still shows each slice’s own percent.',
      ),
      valuePrefix,
      valueSuffix,
      mutedColor: colorSchema.describe('Secondary/muted text colour — the legend slice labels, the center “Total” caption, and the empty-state caption (default the muted-foreground token).'),
      trackColor: colorSchema.describe('The unfilled remainder ring behind the slices (default the muted token).'),
      axisColor: colorSchema.describe(
        'Text colour of the summed total printed in the donut’s centre hole when `showTotal` is on (default the inherited foreground). The family channel for showValues-style numeric annotations.',
      ),
      emptyText,
      ariaLabel: chartAriaLabel,
    }),
    description:
      'Donut / ring chart of proportional segments. Each datum is { label, value, color? }; arcs are value÷total. `showTotal` prints the sum in the center; `palette` colors slices without a per-slice `color`.',
    example: {
      data: [
        { label: 'Direct', value: 45 },
        { label: 'Referral', value: 30 },
        { label: 'Social', value: 25 },
      ],
    },
  },

  // =========================================================================
  // Sparkline — tiny inline trend
  // =========================================================================
  Sparkline: {
    props: z.object({
      points: z
        .array(z.number())
        .describe('The numeric series rendered as a tiny inline trend. The renderer draws OUR own SVG, normalized to [min,max].'),
      type: z
        .enum(['line', 'area', 'bar'])
        .nullable()
        .describe('Render style: line (default) · area (filled under the line) · bar (mini columns).'),
      tone: z
        .enum(['neutral', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic color via token (default neutral). Use `success`/`critical` for an up/down trend. A set tone also tints the no-data placeholder at low opacity.'),
      color: colorSchema.describe('Exact line/fill color. Wins over `tone`. A set color also tints the no-data placeholder at low opacity.'),
      height: chartHeight.describe(
        'Height of the inline trend (default 1.75rem ≈ 28px when unset). If set, the shared chart channel is bounded 80–800 (px/rem), so any explicit height renders far larger than the inline default.',
      ),
      strokeWidth: dimensionSchema({ units: ['px'], min: 0.5, max: 6 }).describe(
        'Exact line stroke width in px (e.g. 2). Overrides the default line weight (1.5).',
      ),
      emptyText,
      ariaLabel: chartAriaLabel,
    }),
    description:
      'A tiny inline trend chart (no axes). `points` is a number[]; `type` picks line/area/bar; `tone` or `color` sets the hue. Drop next to a metric for an at-a-glance trend.',
    example: { points: [4, 6, 5, 8, 7, 9, 12], type: 'area', tone: 'success' },
  },
};
