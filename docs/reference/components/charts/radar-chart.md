# RadarChart

Radar / spider chart comparing series across shared axes. `axes` are the spoke labels; each series is { name, values:number[], color? } aligned to the axes. `palette` colors series without a per-series `color`.

## Example

```json
{
  "root": "radar-chart",
  "elements": {
    "radar-chart": {
      "type": "RadarChart",
      "props": {
        "axes": [
          "Speed",
          "Power",
          "Range",
          "Cost",
          "Comfort"
        ],
        "series": [
          {
            "name": "Model X",
            "values": [
              80,
              65,
              90,
              40,
              75
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
| `axes` | `string[]` | The spoke labels (one per axis). Each series’ `values` array aligns to these by index. |
| `series` | `({ name: string, values: number[], color: string })[]` | One or more series; each is { name, values:number[], color? } where `values` align to `axes`. |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-item `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~220px). Bounded 80-800. |
| `showLegend` | `boolean` | Show a legend of series names below the chart (default true when >1 series). |
| `mutedColor` | `string` | Secondary/muted text colour — the legend series names and the empty-state caption (default the muted-foreground token). |
| `gridColor` | `string` | Stroke colour of the concentric grid rings and the radial spokes (default the border token). |
| `axisColor` | `string` | Text colour of the spoke (axis) labels drawn around the outside of the chart (default the muted-foreground token). |
| `strokeWidth` | `string \| number` | Exact outline thickness of each series polygon in viewBox units (e.g. "2px"). Overrides the default series stroke (1.25); the grid rings/spokes stay fixed. |
| `fillOpacity` | `"solid" \| "soft"` | Area-fill weight: solid (the series colour at the chart-default opacity) · soft (a lighter, more translucent fill). Default keeps the current per-chart opacity. |
| `emptyText` | `string` | Override the empty-state message shown when there is no renderable data (default "No data"). |
| `ariaLabel` | `string` | Override the chart’s accessible summary (the role="img" aria-label). Default is an auto-computed description of the data. |
