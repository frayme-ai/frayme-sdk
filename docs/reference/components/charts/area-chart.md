# AreaChart

Filled area chart (one or more series). Each series is { name, points:number[], color? }. `stacked` cumulates bands; `palette` colors the series when no per-series `color` is set.

## Example

```json
{
  "root": "area-chart",
  "elements": {
    "area-chart": {
      "type": "AreaChart",
      "props": {
        "series": [
          {
            "name": "Revenue",
            "points": [
              12,
              19,
              14,
              22,
              30,
              28,
              35
            ]
          }
        ],
        "curve": "smooth"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `series` | `({ name: string, points: number[], color: string })[]` | One or more series; each is { name, points:number[], color? }. All series share the same x-axis index. |
| `curve` | `"linear" \| "smooth" \| "step"` | Line interpolation between points: linear (default) · smooth (curved) · step (stairs). |
| `stacked` | `boolean` | Stack series on top of each other (cumulative bands) instead of overlaying. |
| `xLabels` | `string[]` | Category labels drawn as a row under the plot, one per x-index (e.g. ["Mon",…,"Sun"]). Aligned to the shared series index; extras/missing entries are ignored. Coloured by `axisColor`. Omit for no x-axis labels. |
| `xAxisTitle` | `string` | Name of the x axis, centred under the category labels (e.g. "Month", "Ad spend ($k)"). Say what the axis MEASURES — omit when the labels already say it (a row of month names needs no "Month" title). |
| `yAxisTitle` | `string` | Name of the y axis with its unit, shown above the plot (e.g. "Value ($k)", "Sessions"). Include the unit here rather than repeating it on every tick. |
| `showYAxis` | `boolean` | Y-axis tick values down the left edge, aligned to the gridlines (default TRUE — a value chart should be readable). Set false only for a sparkline-style plot where the shape is the whole point. |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-series `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80–800. |
| `size` | `"sm" \| "md" \| "lg"` | Overall scale of strokes, dots, and labels (default md). |
| `strokeWidth` | `string \| number` | Exact area-outline stroke width in px (e.g. 3). Overrides the `size` enum, which is the default. |
| `showGrid` | `boolean` | Draw horizontal gridlines behind the areas (default true). |
| `showLegend` | `boolean` | Show a legend of series names below the chart (default true when >1 series). |
| `showValues` | `boolean` | Annotate each data point with its numeric value (default false; best for sparse series). |
| `mutedColor` | `string` | Secondary/muted text colour — the legend series names below the chart and the empty-state caption (default the muted-foreground token). |
| `gridColor` | `string` | Gridline colour (the horizontal rules behind the plot). Default the border token. |
| `axisColor` | `string` | Value-annotation colour — the in-plot numeric `<text>` drawn when `showValues:true` (default the muted-foreground token). These charts render no axis or tick labels, so this is inert unless `showValues` is on. |
| `fillOpacity` | `"solid" \| "soft"` | Fill density of the area/bar body: solid (fuller, more saturated) · soft (lighter, more translucent). Default keeps the current subtle fill. |
| `emptyText` | `string` | Override the empty-state message shown when there is no data (default "No data"). |
| `ariaLabel` | `string` | Override the auto-generated screen-reader summary (role="img" aria-label). Default a computed description of the series. |
