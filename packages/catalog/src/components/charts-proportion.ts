/**
 * Frayme charts (proportion / distribution) — 5 data-viz schemas on the
 * truly-dynamic foundation: PieChart · FunnelChart · ScatterChart · RadarChart ·
 * Sankey.
 *
 * Same locked contract as the shipped charts group: bounded ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for a
 * color, `dimensionSchema` for a length). Every enum/value prop is `.nullable()`
 * + `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants` / a
 * `?? default`, so a props-less spec still renders polished.
 *
 * SECURITY / chart-specific contract (non-negotiable):
 *  - The chart's `<svg>` markup is OURS (path/rect/circle/line/polygon/text). The
 *    spec supplies only NUMBERS (the series/slices) + labels + validated colors —
 *    never markup, never a CSS property string. The renderer filters to finite
 *    numbers and COMPUTES every coordinate, normalizing into a fixed viewBox.
 *  - A slice / stage / point / node MAY carry its OWN exact `color` (the
 *    gate-covered COLOR_KEY `color`). It is `colorSchema` NESTED inside the
 *    array's `z.object` so the catalog Zod gate validates each one, and the
 *    renderer re-validates via `safeColor` at point-of-use. When omitted, the
 *    `palette` enum supplies a fixed, token-based series color.
 *  - `palette` is an ENUM (brand · cool · warm · categorical · mono); never a
 *    value channel.
 *  - `height` is the one shared VALUE dimension (a gate DIM_KEY), bounded
 *    80-800 px/rem.
 *
 * Channel legend: E enum · C content (numbers/labels) · SC safeColor (VALUE) ·
 * D dimension (VALUE).
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

/* The shared chart palette ENUM — names a FIXED, token-based set of series
 * colors the renderer maps. A NAMED set, never a free value; per-item exact
 * colors use the nested `color` value channel instead. */
const paletteSchema = z
  .enum(['brand', 'cool', 'warm', 'categorical', 'mono'])
  .nullable()
  .describe(
    'Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-item `color` overrides its slot.',
  );

/* The shared chart height VALUE — a real CSS length (gate DIM_KEY `height`). */
const chartHeight = dimensionSchema({ units: ['px', 'rem'], min: 80, max: 800 }).describe(
  'Plot height (e.g. "240px" or "16rem"; default ~220px). Bounded 80-800.',
);

/* The shared chart display-size ENUM (label/dot/stroke scale), distinct from the
 * `height` value channel which sets the actual plot box height. */
const chartSize = z
  .enum(['sm', 'md', 'lg'])
  .nullable()
  .describe('Overall scale of dots, labels, and strokes (default md).');

/* ── shared CHROME channels (settable, each defaulting to the current theme token) ──
 * Colours apply as SVG attributes reading `var(--fr-*, token)` — never Tailwind
 * classes. `fillOpacity` is a bounded ENUM (NOT a colour value). `emptyText`/
 * `ariaLabel` are plain content strings. A props-less chart is byte-identical. */
const fillOpacitySchema = z
  .enum(['solid', 'soft'])
  .nullable()
  .describe('Area-fill weight: solid (the series colour at the chart-default opacity) · soft (a lighter, more translucent fill). Default keeps the current per-chart opacity.');
const emptyTextSchema = z
  .string()
  .nullable()
  .describe('Override the empty-state message shown when there is no renderable data (default "No data").');
const ariaLabelSchema = z
  .string()
  .nullable()
  .describe('Override the chart’s accessible summary (the role="img" aria-label). Default is an auto-computed description of the data.');

/* Axis TITLES + the y tick column — the same three channels the shipped
 * charts group added, mirrored here (this file keeps its own copies of every
 * shared atom; charts.ts does not export them). `yAxisTitle`/`showYAxis` are
 * word-for-word identical so the vocabulary reads as one rule; `xAxisTitle` is
 * re-worded for ScatterChart, whose x axis is a NUMERIC tick row, not category
 * labels — the "omit when the labels already say it" escape hatch would invite
 * dropping the title on the one chart where nothing else names the measure. */
const xAxisTitleSchema = z
  .string()
  .nullable()
  .describe('Name of the x axis with its unit, centred under the tick row (e.g. "Ad spend ($k)", "Weeks since signup"). Say what the axis MEASURES — the ticks are bare numbers, so without this the reader is guessing.');
const yAxisTitleSchema = z
  .string()
  .nullable()
  .describe('Name of the y axis with its unit, shown above the plot (e.g. "Value ($k)", "Sessions"). Include the unit here rather than repeating it on every tick.');
const showYAxisSchema = z
  .boolean()
  .nullable()
  .describe('Y-axis tick values down the left edge, aligned to the gridlines (default TRUE — a value chart should be readable). Set false only for a sparkline-style plot where the shape is the whole point.');

export const chartsProportionComponents = {
  // =========================================================================
  // PieChart — full proportional pie (no center hole)
  // =========================================================================
  PieChart: {
    props: z.object({
      data: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            color: colorSchema.describe('Exact color for this slice. Overrides the `palette` slot.'),
          }),
        )
        .describe('The slices; each is { label, value, color? }. Slice angle = value ÷ sum of values.'),
      palette: paletteSchema,
      height: chartHeight,
      showLegend: z.boolean().nullable().describe('Show a legend mapping color→label beside the pie (default true).'),
      showValues: z.boolean().nullable().describe('Print each slice’s percent of the total in the legend (default false).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the legend labels and the empty-state caption (default the muted-foreground token).'),
      separatorColor: colorSchema.describe('Stroke colour of the thin gap between slices (default the card/background token).'),
      emptyText: emptyTextSchema,
      ariaLabel: ariaLabelSchema,
    }),
    description:
      'Full proportional pie chart (no center hole). Each datum is { label, value, color? }; wedge angle is value÷total. `palette` colors slices without a per-slice `color`.',
    example: {
      data: [
        { label: 'Chrome', value: 64 },
        { label: 'Safari', value: 19 },
        { label: 'Firefox', value: 9 },
        { label: 'Other', value: 8 },
      ],
    },
  },

  // =========================================================================
  // FunnelChart — stacked stages narrowing top-to-bottom (or left-to-right)
  // =========================================================================
  FunnelChart: {
    props: z.object({
      stages: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            color: colorSchema.describe('Exact color for this stage. Overrides the `palette` slot.'),
          }),
        )
        .describe('The funnel stages top→bottom; each is { label, value, color? }. Stage width = value ÷ the largest stage.'),
      orientation: z
        .enum(['vertical', 'horizontal'])
        .nullable()
        .describe('Narrowing direction: vertical (stages stacked top→bottom, default) · horizontal (stages flow left→right).'),
      // A funnel is an ORDERED sequence, so `palette` picks the HEAD of a
      // single-hue ramp rather than a set of per-stage hues — described here so the
      // schema promises what a funnel actually renders.
      palette: paletteSchema.describe(
        'Head colour of the funnel’s single-hue ramp; stages step from it toward the card surface, densest first. It does NOT give each stage a different hue. brand (the primary hue, default) · cool (teal) · warm (amber) · mono (neutral grey tints) · categorical (a set of distinct hues has no ordered reading on a funnel, so this renders the brand ramp). A per-stage `color` overrides that stage.',
      ),
      height: chartHeight,
      size: chartSize,
      showValues: z.boolean().nullable().describe('Print each stage’s value in the stage list below the funnel (default true).'),
      showPercent: z.boolean().nullable().describe('Print each stage’s percent of the FIRST stage (conversion rate; default false).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the conversion-rate percent beside each stage and the empty-state caption (default the muted-foreground token).'),
      fillOpacity: fillOpacitySchema.describe(
        'Band fill weight: solid (the stage ramp at full strength, default) · soft (translucent bands — for a funnel used as a backdrop behind other content). soft shallows the stage ramp so the late stages stay visible, so keep solid when the colour step down the stages is doing the work.',
      ),
      emptyText: emptyTextSchema,
      ariaLabel: ariaLabelSchema,
    }),
    description:
      'Conversion funnel: stacked trapezoid stages narrowing as values drop. Each stage is { label, value, color? }; width is value÷max. `showPercent` annotates conversion vs the first stage.',
    example: {
      stages: [
        { label: 'Visited', value: 1000 },
        { label: 'Signed up', value: 420 },
        { label: 'Activated', value: 180 },
        { label: 'Paid', value: 64 },
      ],
      showPercent: true,
    },
  },

  // =========================================================================
  // ScatterChart — X/Y point distribution
  // =========================================================================
  ScatterChart: {
    props: z.object({
      series: z
        .array(
          z.object({
            name: z.string(),
            points: z
              .array(z.object({ x: z.number(), y: z.number() }))
              .describe('The { x, y } points for this series.'),
            color: colorSchema.describe('Exact color for this series’ points. Overrides the `palette` slot.'),
          }),
        )
        .describe('One or more point series; each is { name, points:{x,y}[], color? }. Axes auto-scale to span all finite points.'),
      xAxisTitle: xAxisTitleSchema,
      yAxisTitle: yAxisTitleSchema,
      showYAxis: showYAxisSchema,
      palette: paletteSchema,
      height: chartHeight,
      size: chartSize,
      sizeValue: dimensionSchema({ units: ['px'], min: 2, max: 24 }).describe(
        'Exact dot diameter in px (e.g. "10px"). Overrides the `size` enum, which is the default dot scale.',
      ),
      showGrid: z.boolean().nullable().describe('Draw background gridlines behind the points (default true).'),
      showLegend: z.boolean().nullable().describe('Show a legend of series names below the chart (default true when >1 series).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the legend series names and the empty-state caption (default the muted-foreground token).'),
      gridColor: colorSchema.describe('Gridline stroke colour behind the points (default the border token).'),
      axisColor: colorSchema.describe('Text colour of the axis annotations — the y-axis tick values down the left gutter, the x-axis tick values in the row under the plot, and the `xAxisTitle`/`yAxisTitle` rows (default the muted-foreground token).'),
      emptyText: emptyTextSchema,
      ariaLabel: ariaLabelSchema,
    }),
    description:
      'Scatter plot of X/Y points across one or more series. Each series is { name, points:{x,y}[], color? }; both axes auto-scale to the data and print numeric ticks (a y column down the left, an x row underneath). `palette` colors series without a per-series `color`. BOTH axes are measures here, so name both with `xAxisTitle` and `yAxisTitle` — unlike a bar chart there are no category labels to say what is being plotted.',
    example: {
      series: [
        {
          name: 'Cohort A',
          points: [
            { x: 1, y: 2 },
            { x: 3, y: 5 },
            { x: 5, y: 4 },
            { x: 7, y: 9 },
          ],
        },
      ],
      xAxisTitle: 'Weeks since signup',
      yAxisTitle: 'Sessions per week',
    },
  },

  // =========================================================================
  // RadarChart — multi-axis comparison polygon
  // =========================================================================
  RadarChart: {
    props: z.object({
      axes: z
        .array(z.string())
        .describe('The spoke labels (one per axis). Each series’ `values` array aligns to these by index.'),
      series: z
        .array(
          z.object({
            name: z.string(),
            values: z.array(z.number()).describe('One value per axis, aligned to `axes` by index. Missing entries read as 0.'),
            color: colorSchema.describe('Exact fill/stroke color for this series’ polygon. Overrides the `palette` slot.'),
          }),
        )
        .describe('One or more series; each is { name, values:number[], color? } where `values` align to `axes`.'),
      palette: paletteSchema,
      height: chartHeight,
      showLegend: z.boolean().nullable().describe('Show a legend of series names below the chart (default true when >1 series).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the legend series names and the empty-state caption (default the muted-foreground token).'),
      gridColor: colorSchema.describe('Stroke colour of the concentric grid rings and the radial spokes (default the border token).'),
      axisColor: colorSchema.describe('Text colour of the spoke (axis) labels drawn around the outside of the chart (default the muted-foreground token).'),
      strokeWidth: dimensionSchema({ units: ['px'], min: 0.5, max: 6 }).describe(
        'Exact outline thickness of each series polygon in viewBox units (e.g. "2px"). Overrides the default series stroke (1.25); the grid rings/spokes stay fixed.',
      ),
      fillOpacity: fillOpacitySchema,
      emptyText: emptyTextSchema,
      ariaLabel: ariaLabelSchema,
    }),
    description:
      'Radar / spider chart comparing series across shared axes. `axes` are the spoke labels; each series is { name, values:number[], color? } aligned to the axes. `palette` colors series without a per-series `color`.',
    example: {
      axes: ['Speed', 'Power', 'Range', 'Cost', 'Comfort'],
      series: [{ name: 'Model X', values: [80, 65, 90, 40, 75] }],
    },
  },

  // =========================================================================
  // Sankey — left-to-right flow bands between nodes
  // =========================================================================
  Sankey: {
    props: z.object({
      nodes: z
        .array(
          z.object({
            label: z.string(),
            color: colorSchema.describe('Exact color for this node’s bar (and its outgoing links). Overrides the `palette` slot.'),
          }),
        )
        .describe('The nodes; each is { label, color? }. Referenced by index from `links`.'),
      links: z
        .array(
          z.object({
            source: z.number().describe('Index of the source node in `nodes`.'),
            target: z.number().describe('Index of the target node in `nodes`.'),
            value: z.number().describe('Flow magnitude; sets the band thickness.'),
            color: colorSchema.describe('Exact colour for this flow band. Overrides the default (the source node’s colour).'),
          }),
        )
        .describe('The flows between nodes; each is { source:index, target:index, value, color? }. Out-of-range / non-finite links are dropped.'),
      nodeWidth: z
        .enum(['thin', 'md', 'thick'])
        .nullable()
        .describe('Width of each node bar: thin · md (default) · thick.'),
      palette: paletteSchema,
      height: chartHeight,
      // the shared chart-family fillOpacity enum, extended to the flow bands
      fillOpacity: fillOpacitySchema.describe('Flow-band fill weight: solid (heavier, more opaque bands) · soft (lighter, more translucent). Default keeps the current band opacity.'),
      showValues: z.boolean().nullable().describe('Print each node’s total throughput in the legend below the chart (default false).'),
      showLegend: z.boolean().nullable().describe('Show the legend mapping colour→node label below the diagram (default true). Hide it when the node labels alone carry the story.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the legend node names and the empty-state caption (default the muted-foreground token).'),
      emptyText: emptyTextSchema,
      ariaLabel: ariaLabelSchema,
    }),
    description:
      'Sankey flow diagram: bands flow left→right between nodes laid out in columns. `nodes` are { label, color? }; `links` are { source, target, value } by node index. Band thickness and node height scale with flow.',
    example: {
      nodes: [{ label: 'Visitors' }, { label: 'Sign-ups' }, { label: 'Trials' }, { label: 'Paid' }],
      links: [
        { source: 0, target: 1, value: 500 },
        { source: 1, target: 2, value: 220 },
        { source: 2, target: 3, value: 90 },
      ],
    },
  },
};
