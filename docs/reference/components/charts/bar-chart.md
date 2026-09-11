# BarChart

Bar/column chart. Single-series: `data` = { label, value, color? }[]. Multi-series (grouped or stacked comparison): `series` = { name, values:number[], color? }[] + `labels` (x categories) + `groupMode` — `series` wins over `data`. `layout:horizontal` for long labels; `palette` colors bars/series without a `color`. Name the measure with `yAxisTitle` — vertical bars render a y tick column beside the plot. In `layout:horizontal` the measure runs along x instead, so name it with `xAxisTitle` (no tick column is drawn there; each bar carries its own value).

## Example

```json
{
  "root": "bar-chart",
  "elements": {
    "bar-chart": {
      "type": "BarChart",
      "props": {
        "data": [
          {
            "label": "Mon",
            "value": 12
          },
          {
            "label": "Tue",
            "value": 19
          },
          {
            "label": "Wed",
            "value": 8
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
| `data` | `({ label: string, value: number, color: string })[]` | Single-series bars; each is { label, value, color? }, scaled to the largest value. IGNORED when `series` is set (grouped/stacked mode wins). |
| `series` | `({ name: string, values: number[], color: string })[]` | Multi-series grouped/stacked bars; each is { name, values:number[], color? } aligned to `labels` by index. When set, WINS over `data` (grouped/stacked comparison mode). Capped at 5 series (extras are dropped). Use `groupMode` to group vs stack. |
| `labels` | `string[]` | Category labels (x axis) for the multi-series `series` mode, one per value index (e.g. ["Q1","Q2","Q3","Q4"]). Ignored in single-series `data` mode (bars carry their own label). |
| `groupMode` | `"grouped" \| "stacked"` | Multi-series layout: grouped (bars sit side-by-side per category, default) · stacked (values stack into one bar per category). Only applies when `series` is set. In horizontal layout, `stacked` falls back to `grouped`. |
| `layout` | `"vertical" \| "horizontal"` | Bar direction: vertical (columns, default) · horizontal (rows — better for long labels / many categories). Horizontal + `stacked` renders as grouped. |
| `rounded` | `boolean` | Round the far (value) end of each bar for a softer look (default true); set false for square-cut bars matching a denser data-dashboard style. |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-series `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80–800. |
| `xAxisTitle` | `string` | Name of the x axis, centred under the category labels (e.g. "Month", "Ad spend ($k)"). Say what the axis MEASURES — omit when the labels already say it (a row of month names needs no "Month" title). |
| `yAxisTitle` | `string` | Name of the y axis with its unit, shown above the plot (e.g. "Value ($k)", "Sessions"). Include the unit here rather than repeating it on every tick. |
| `showYAxis` | `boolean` | Y-axis tick values down the left edge, aligned to the gridlines (default TRUE — a value chart should be readable). Set false only for a sparkline-style plot where the shape is the whole point. |
| `showGrid` | `boolean` | Draw value gridlines behind the bars (default true; vertical layout only — horizontal bars render no gridlines). One line per y tick, so the grid and the tick column agree. |
| `showLegend` | `boolean` | Show a legend mapping color→label below the chart (default false in single-series `data` mode; default true in multi-series `series` mode). |
| `showValues` | `boolean` | Print each bar’s value at its end (default true). In stacked mode, prints the per-segment value. |
| `valueFormat` | `"plain" \| "compact" \| "percent"` | How numeric annotations print: plain (the raw number, default) · compact ("1.2k"/"3.4M" abbreviations) · percent (the value as a "%", 0–100 as-is). Pairs with `valuePrefix`/`valueSuffix`. |
| `valuePrefix` | `string` | Text prepended to each formatted value (e.g. "$", "£"). Escaped content. Default none. |
| `valueSuffix` | `string` | Text appended to each formatted value (e.g. " users", "k"). Escaped content. Default none. |
| `mutedColor` | `string` | Secondary/muted text colour — the axis category labels, legend names, and the empty-state caption (default the muted-foreground token). |
| `gridColor` | `string` | Gridline colour (the horizontal rules behind the plot). Default the border token. |
| `axisColor` | `string` | Text colour of BarChart’s numeric and axis annotations — the value printed at each bar’s end when `showValues` is on, the y-axis tick values, the x-axis category labels, and the `xAxisTitle`/`yAxisTitle` rows (default the inherited foreground). In `groupMode:"stacked"` the same colour prints the in-segment value over the series fill, so keep it legible on the bars too. |
| `fillOpacity` | `"solid" \| "soft"` | Fill density of the area/bar body: solid (fuller, more saturated) · soft (lighter, more translucent). Default keeps the current subtle fill. |
| `emptyText` | `string` | Override the empty-state message shown when there is no data (default "No data"). |
| `ariaLabel` | `string` | Override the auto-generated screen-reader summary (role="img" aria-label). Default a computed description of the series. |
