# LineChart

Line chart (one or more series). Each series is { name, points:number[], color? }. `palette` colors series without a per-series `color`; `showDots` marks each point.

## Example

```json
{
  "root": "line-chart",
  "elements": {
    "line-chart": {
      "type": "LineChart",
      "props": {
        "series": [
          {
            "name": "This week",
            "points": [
              4,
              8,
              6,
              10,
              9,
              12,
              14
            ]
          },
          {
            "name": "Last week",
            "points": [
              3,
              5,
              7,
              6,
              8,
              7,
              9
            ]
          }
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `series` | `({ name: string, points: number[], color: string })[]` | One or more line series; each is { name, points:number[], color? } sharing the x-axis index. |
| `curve` | `"linear" \| "smooth" \| "step"` | Line interpolation: linear (default) · smooth (curved) · step (stairs). |
| `showDots` | `boolean` | Draw a marker dot at each data point (default true). Dots are suppressed on series longer than 24 points, even when set to true. |
| `xLabels` | `string[]` | Category labels drawn as a row under the plot, one per x-index (e.g. ["Mon",…,"Sun"]). Aligned to the shared series index; extras/missing entries are ignored. Coloured by `axisColor`. Omit for no x-axis labels. |
| `xAxisTitle` | `string` | Name of the x axis, centred under the category labels (e.g. "Month", "Ad spend ($k)"). Say what the axis MEASURES — omit when the labels already say it (a row of month names needs no "Month" title). |
| `yAxisTitle` | `string` | Name of the y axis with its unit, shown above the plot (e.g. "Value ($k)", "Sessions"). Include the unit here rather than repeating it on every tick. |
| `showYAxis` | `boolean` | Y-axis tick values down the left edge, aligned to the gridlines (default TRUE — a value chart should be readable). Set false only for a sparkline-style plot where the shape is the whole point. |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-series `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80–800. |
| `size` | `"sm" \| "md" \| "lg"` | Overall scale of strokes, dots, and labels (default md). |
| `strokeWidth` | `string \| number` | Exact line stroke width in px (e.g. 3). Overrides the `size` enum, which is the default. Dot radius stays size-driven. |
| `showGrid` | `boolean` | Draw horizontal gridlines behind the lines (default true). |
| `showLegend` | `boolean` | Show a legend of series names below the chart (default true when >1 series). |
| `showValues` | `boolean` | Annotate each point with its numeric value (default false). |
| `mutedColor` | `string` | Secondary/muted text colour — the legend series names below the chart and the empty-state caption (default the muted-foreground token). |
| `gridColor` | `string` | Gridline colour (the horizontal rules behind the plot). Default the border token. |
| `axisColor` | `string` | Value-annotation colour — the in-plot numeric `<text>` drawn when `showValues:true` (default the muted-foreground token). These charts render no axis or tick labels, so this is inert unless `showValues` is on. |
| `dotColor` | `string` | Fill of the point-marker dots — the "hole punch" over each line (default the card token). Set to match a tinted surface behind the chart so the dots keep reading as holes. |
| `emptyText` | `string` | Override the empty-state message shown when there is no data (default "No data"). |
| `ariaLabel` | `string` | Override the auto-generated screen-reader summary (role="img" aria-label). Default a computed description of the series. |
