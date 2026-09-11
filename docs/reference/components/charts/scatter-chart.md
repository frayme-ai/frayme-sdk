# ScatterChart

Scatter plot of X/Y points across one or more series. Each series is { name, points:{x,y}[], color? }; both axes auto-scale to the data and print numeric ticks (a y column down the left, an x row underneath). `palette` colors series without a per-series `color`. BOTH axes are measures here, so name both with `xAxisTitle` and `yAxisTitle` — unlike a bar chart there are no category labels to say what is being plotted.

## Example

```json
{
  "root": "scatter-chart",
  "elements": {
    "scatter-chart": {
      "type": "ScatterChart",
      "props": {
        "series": [
          {
            "name": "Cohort A",
            "points": [
              {
                "x": 1,
                "y": 2
              },
              {
                "x": 3,
                "y": 5
              },
              {
                "x": 5,
                "y": 4
              },
              {
                "x": 7,
                "y": 9
              }
            ]
          }
        ],
        "xAxisTitle": "Weeks since signup",
        "yAxisTitle": "Sessions per week"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `series` | `({ name: string, points: object[], color: string })[]` | One or more point series; each is { name, points:{x,y}[], color? }. Axes auto-scale to span all finite points. |
| `xAxisTitle` | `string` | Name of the x axis with its unit, centred under the tick row (e.g. "Ad spend ($k)", "Weeks since signup"). Say what the axis MEASURES — the ticks are bare numbers, so without this the reader is guessing. |
| `yAxisTitle` | `string` | Name of the y axis with its unit, shown above the plot (e.g. "Value ($k)", "Sessions"). Include the unit here rather than repeating it on every tick. |
| `showYAxis` | `boolean` | Y-axis tick values down the left edge, aligned to the gridlines (default TRUE — a value chart should be readable). Set false only for a sparkline-style plot where the shape is the whole point. |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-item `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~220px). Bounded 80-800. |
| `size` | `"sm" \| "md" \| "lg"` | Overall scale of dots, labels, and strokes (default md). |
| `sizeValue` | `string \| number` | Exact dot diameter in px (e.g. "10px"). Overrides the `size` enum, which is the default dot scale. |
| `showGrid` | `boolean` | Draw background gridlines behind the points (default true). |
| `showLegend` | `boolean` | Show a legend of series names below the chart (default true when >1 series). |
| `mutedColor` | `string` | Secondary/muted text colour — the legend series names and the empty-state caption (default the muted-foreground token). |
| `gridColor` | `string` | Gridline stroke colour behind the points (default the border token). |
| `axisColor` | `string` | Text colour of the axis annotations — the y-axis tick values down the left gutter, the x-axis tick values in the row under the plot, and the `xAxisTitle`/`yAxisTitle` rows (default the muted-foreground token). |
| `emptyText` | `string` | Override the empty-state message shown when there is no renderable data (default "No data"). |
| `ariaLabel` | `string` | Override the chart’s accessible summary (the role="img" aria-label). Default is an auto-computed description of the data. |
