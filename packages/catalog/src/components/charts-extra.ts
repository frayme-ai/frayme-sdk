/**
 * Frayme charts-extra — 5 data-visualization schemas on the truly-dynamic foundation.
 *
 * These ride the SAME established contract as the shipped catalog: bounded
 * ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels
 * (`colorSchema` for color values, the dimension channel for counts/lengths).
 * The chart MARKUP is always OURS (the renderer draws <svg> polyline/rect/circle
 * or CSS bars/grid) — the spec only ever supplies NUMBERS, content labels, and
 * validated colors, never markup and never a real CSS-property string.
 *
 * Nested per-datum colors (a bar/series/task `color`) use `colorSchema` INSIDE the
 * array's z.object, so the catalog gate validates each one and the renderer routes
 * it through a per-element `--*` CSS var read by a static `var()` recipe.
 *
 * Channel legend: E enum · C content · N number (data) · SC safeColor (VALUE) ·
 * D dimension (VALUE). Every enum/value prop is `.nullable()` + `.describe()` (one
 * sentence naming WHEN to reach for it);
 * defaults live in the renderer's CVA `defaultVariants`, so a props-less spec still
 * renders polished and can't crash.
 *
 * Components: BarList · ProgressCircle · StatGroup · Heatmap · Gantt.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Weight } from './_shared.js';

/* The shared empty-state message override (plain content, NOT gated) — mirrors the
 * charts / charts-proportion family channel. */
const emptyTextSchema = z
  .string()
  .nullable()
  .describe('Override the empty-state message shown when there is no data (default "No data").');

export const chartsExtraComponents = {
  // =========================================================================
  // BarList — ranked horizontal bars (label + proportional bar + value)
  // =========================================================================
  BarList: {
    props: z.object({
      data: z
        .array(
          z.object({
            label: z.string().describe('Row label shown over/before the bar.'),
            value: z.number().describe('Numeric magnitude. Bar width = value / the shared axis ceiling (a round number just above the largest value), so the longest bar stops short of a full track.'),
            color: colorSchema.describe('Exact fill color for THIS bar (overrides the palette for this row).'),
          }),
        )
        .describe('The rows to plot, each a { label, value, color? }. Every bar is sized against one shared axis — 0 → a round ceiling picked just above the largest value — and that 0 → ceiling scale prints as a small row under the bars.'),
      palette: z
        .enum(['brand', 'cool', 'warm', 'neutral'])
        .nullable()
        .describe('Built-in color ramp applied to bars without their own `color`: brand (primary + sky/teal/amber/rose) · cool (blues/teals) · warm (ambers/reds) · neutral (greys). Unset (default): every bar without a `color` renders a single uniform primary fill — no ramp. Set `palette` to any value to opt into the multi-hue ramp.'),
      accent: colorSchema.describe('Single fill applied to EVERY bar that has no per-row `color` (wins over `palette`; default the primary token, matching the unset-`palette` resting fill).'),
      sortByValue: z
        .boolean()
        .nullable()
        .describe('Sort rows descending by value before plotting (ranked bar list). Default false (keep author order).'),
      showValues: z
        .boolean()
        .nullable()
        .describe('Show the numeric value at the end of each bar (default true).'),
      valueFormat: z
        .enum(['plain', 'compact', 'percent'])
        .nullable()
        .describe('How each row value prints, in the rows AND on the scale row under them: plain (the raw number, default) · compact ("1.2k"/"3.4M") · percent (value as a "%", and the axis stops at 100%). Pairs with `valuePrefix`/`valueSuffix`.'),
      valuePrefix: z.string().nullable().describe('Text prepended to each formatted value (e.g. "$", "£"). Escaped content. Default none.'),
      valueSuffix: z.string().nullable().describe('Text appended to each formatted value (e.g. " views", "%"). Escaped content. Default none.'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Bar height + row spacing + font size (default md).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the numeric value shown beside each row, the 0 → ceiling scale row under the bars (its numbers and its hairline rule), and the empty-state caption (default the muted-foreground token; the rule defaults to the border token).'),
      trackColor: colorSchema.describe('Exact colour of the unfilled track behind each bar (default a muted token).'),
      axisColor: colorSchema.describe(
        'Category-axis text colour — the row label above each bar (default the foreground token). The same channel Gantt exposes for its task-name labels.',
      ),
      emptyText: emptyTextSchema,
    }),
    description:
      'A ranked list of horizontal bars (Tremor BarList style): each row is a label with a bar sized proportionally to its value and the value at the end, over a shared 0 → ceiling scale row that ends the chart. Use for top-N breakdowns (top pages, sources, categories). Set `sortByValue` to rank descending.',
    example: {
      data: [
        { label: '/home', value: 1240 },
        { label: '/pricing', value: 870 },
        { label: '/docs', value: 540 },
      ],
      sortByValue: true,
    },
  },

  // =========================================================================
  // ProgressCircle — radial progress ring with a center percentage
  // =========================================================================
  ProgressCircle: {
    props: z.object({
      value: z.number().describe('Current amount filled (clamped to 0..max). Drives the arc + the center %.'),
      max: z.number().nullable().describe('The value that represents a full ring (default 100).'),
      size: z
        .enum(['sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Ring diameter + stroke width + label scale: sm · md (default) · lg · xl.'),
      sizeValue: dimensionSchema({ units: ['px', 'rem'], min: 32, max: 320 }).describe(
        'Exact ring diameter (e.g. 128px / 8rem). Overrides the `size` enum (which is the default) for width+height only; stroke + label scale stay enum-driven.',
      ),
      strokeWidth: dimensionSchema({ units: ['px'], min: 1, max: 12 }).describe(
        'Exact ring stroke thickness in px (1-12). Overrides the `size` enum (which is the default) for the track + arc stroke width.',
      ),
      tone: z
        .enum(['neutral', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic arc color via token (default neutral = a muted grey, unified with Gauge/Tracker). Use `success`/`critical` to signal good/bad progress.'),
      weight: Weight.describe('Font weight of the center percentage value (default semibold). Use `bold` for a heavier KPI, `medium` for a lighter one.'),
      showValue: z
        .boolean()
        .nullable()
        .describe('Show the percentage label in the center of the ring (default true).'),
      label: z.string().nullable().describe('Optional small caption shown under the center percentage.'),
      color: colorSchema.describe('Exact fill colour of the progress arc (the filled portion of the ring); wins over the `tone` token. Set to a brand colour when the semantic tones do not fit.'),
      trackColor: colorSchema.describe('Exact color of the unfilled track ring behind the arc (default a muted token).'),
      valueColor: colorSchema.describe('Exact colour of the centre percentage value text (default the foreground token). The shared value-text channel across Gauge/RadialBar/ProgressCircle.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the small caption under the center percentage (default the muted-foreground token).'),
      ariaLabel: z.string().nullable().describe('Override the screen-reader label for the ring (default the computed "<pct>% <label>" summary).'),
    }),
    description:
      'A circular/radial progress ring with the percentage in the center. Use for a single completion metric (storage used, profile completeness, a score). `value`/`max` set the arc; `tone` or `color` set its color.',
    example: { value: 72, max: 100, tone: 'success', label: 'Complete' },
  },

  // =========================================================================
  // StatGroup — responsive grid of child Stat tiles, optional dividers
  // =========================================================================
  StatGroup: {
    props: z.object({
      columns: dimensionSchema({ kind: 'count', min: 1, max: 6 }).describe('Number of tile columns (1-6, default responsive). The grid wraps the child Stat tiles.'),
      divided: z
        .boolean()
        .nullable()
        .describe('Draw thin dividers between the tiles (a segmented stat strip). Default false. Mutually exclusive with `bordered` — pick dividers OR cards, not both.'),
      bordered: z
        .boolean()
        .nullable()
        .describe('Wrap each tile in its own rounded card (a hairline border + padding), the individual-card dashboard look. Default false — tiles sit borderless in the grid. Best paired with rich `layout:"split"` Stat tiles; ignored when `divided` is on.'),
      align: z
        .enum(['start', 'center', 'end'])
        .nullable()
        .describe('Alignment of each tile within its cell: start (default) · center (centered figures) · end (right-aligned figures, e.g. a numbers strip).'),
      gap: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Spacing between tiles (default md). Ignored visually when `divided` supplies the separators.'),
      borderColor: colorSchema.describe('Colour of the hairline rules StatGroup draws around its tiles — the dividers between tiles when `divided` is on, and each tile’s own card border when `bordered` is on (default the border token). Inert when neither is set.'),
    }),
    slots: ['default'],
    description:
      'A responsive grid wrapper around several Stat tiles (children). Lays KPIs out in a row/grid with an optional divider between them. Put Stat components inside; use `columns` to fix the column count.',
    example: { columns: 3, divided: true },
  },

  // =========================================================================
  // Heatmap — 2D grid of cells colored by magnitude
  // =========================================================================
  Heatmap: {
    props: z.object({
      cells: z
        .array(z.array(z.number()))
        .describe('A 2D grid of numbers (rows of columns). Each cell is colored by its value relative to the grid max.'),
      colorScale: z
        .enum(['brand', 'cool', 'warm', 'success'])
        .nullable()
        .describe('Color ramp for cell intensity: cool (blue, default) · brand (the brand hue) · warm (amber/red) · success (green, GitHub-style). Cell opacity scales with value/max.'),
      cellSize: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Square cell size (default md). `sm` for dense calendars, `lg` for a small grid.'),
      showValues: z
        .boolean()
        .nullable()
        .describe('Print each cell value inside the cell (default false; best with `cellSize:lg`).'),
      showLegend: z
        .boolean()
        .nullable()
        .describe('Show a low→high intensity scale key ("Less ▫▫▪▪ More", GitHub/Tremor style) under the grid, tinted by the resolved scale colour (default false).'),
      xLabels: z
        .array(z.string())
        .nullable()
        .describe('Column header labels (content), one per column. Omit for an unlabeled grid.'),
      yLabels: z
        .array(z.string())
        .nullable()
        .describe('Row labels (content), one per row, shown on the left. Omit for an unlabeled grid.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the x/y axis header labels around the grid and the empty-state caption (default the muted-foreground token).'),
      scaleColor: colorSchema.describe('Exact high-end colour of the intensity scale; cells blend from the muted token (low) to this colour (high). Overrides `colorScale`.'),
      valueColor: colorSchema.describe(
        'In-cell value text colour when `showValues` is on — every printed cell number (default the foreground token). Set a light colour when high-intensity cells run dark.',
      ),
      emptyText: emptyTextSchema,
      ariaLabel: z.string().nullable().describe('Override the screen-reader label for the grid (default the computed "Heatmap, N rows by M columns" summary).'),
    }),
    description:
      'A 2D heatmap: a grid of cells where each cell is tinted by its numeric magnitude (value / grid-max). Use for activity/density matrices (contribution calendars, correlation grids, cohort tables). `cells` is rows-of-columns numbers; `xLabels`/`yLabels` annotate the axes.',
    example: {
      cells: [
        [1, 4, 9],
        [3, 0, 6],
        [8, 2, 5],
      ],
      colorScale: 'brand',
      xLabels: ['Mon', 'Tue', 'Wed'],
    },
  },

  // =========================================================================
  // Gantt — read-only timeline of positioned task bars
  // =========================================================================
  Gantt: {
    props: z.object({
      tasks: z
        .array(
          z.object({
            label: z.string().describe('Task name shown on/before its bar.'),
            start: z.number().describe('Start position on the 0..rangeMax axis.'),
            end: z.number().describe('End position on the 0..rangeMax axis (should be >= start).'),
            color: colorSchema.describe('Exact bar color for THIS task (overrides the palette).'),
          }),
        )
        .describe('The rows of the chart, each a { label, start, end, color? } positioned on a shared 0..rangeMax axis.'),
      rangeMax: z
        .number()
        .nullable()
        .describe('The far end of the axis (default = the largest task `end`). Bars are positioned as start/rangeMax .. end/rangeMax.'),
      palette: z
        .enum(['brand', 'cool', 'warm', 'neutral'])
        .nullable()
        .describe('Color ramp for bars without their own `color`: brand (primary, default) · cool · warm · neutral.'),
      showGrid: z
        .boolean()
        .nullable()
        .describe('Show faint vertical gridlines across the timeline (default true).'),
      axisLabels: z
        .array(z.string())
        .nullable()
        .describe('Time-axis scale captions (content) drawn as an evenly-spaced row under the timeline — e.g. ["Jan","Feb","Mar","Apr"] or ["0","3","6","9"]. Author-supplied (not auto-generated from `rangeMax`); coloured by `axisColor`. Omit for no axis row.'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Bar height + row spacing + font size (default md).'),
      gridColor: colorSchema.describe('Exact colour of the faint vertical timeline gridlines (default the border token).'),
      axisColor: colorSchema.describe('Text colour of Gantt’s labels — the task names in the left column and the time-axis captions under the timeline when `axisLabels` is set (default the inherited foreground; the axis-caption row falls back to muted-foreground).'),
      trackColor: colorSchema.describe(
        'Exact colour of the unfilled timeline track behind each task bar (default the muted token). The same unfilled-track channel BarList/ProgressCircle/Gauge/RadialBar expose.',
      ),
      emptyText: emptyTextSchema,
      ariaLabel: z.string().nullable().describe('Override the screen-reader label for the timeline (default the computed "Timeline of N tasks" summary).'),
    }),
    description:
      'A read-only Gantt / timeline chart: each task is a horizontal bar positioned on a shared 0..rangeMax axis (left = start, width = end-start). Use for project schedules, phase plans, or any set of intervals on one axis. Not interactive.',
    example: {
      tasks: [
        { label: 'Design', start: 0, end: 3 },
        { label: 'Build', start: 2, end: 7 },
        { label: 'Launch', start: 7, end: 9 },
      ],
      rangeMax: 9,
    },
  },
};
