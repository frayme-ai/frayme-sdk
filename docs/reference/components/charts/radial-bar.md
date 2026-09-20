# RadialBar

Concentric proportional rings (one per datum). Each ring’s arc = value÷max of a full circle; the first datum is the outermost ring. `palette` colors rings without a per-ring `color`.

## Example

```json
{
  "root": "radial-bar",
  "elements": {
    "radial-bar": {
      "type": "RadialBar",
      "props": {
        "data": [
          {
            "label": "Mobile",
            "value": 78
          },
          {
            "label": "Desktop",
            "value": 54
          },
          {
            "label": "Tablet",
            "value": 31
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
| `data` | `({ label: string, value: number, color: string })[]` | One ring per datum; each is { label, value, color? }. The first datum is the OUTER ring. |
| `max` | `number` | The value that fills a full circle (default the largest value, or 100). |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-datum `color` overrides its slot. |
| `trackColor` | `string` | Exact color of each ring’s empty track (default the muted token). |
| `scaleColor` | `string` | When set, tint every ring as a single-hue scale from this colour (outer ring solid → inner rings lighter), overriding `palette`. Use for one-metric radial scales; leave unset for distinct per-ring colours. |
| `valueColor` | `string` | Exact colour of the legend value text shown by `showValues` (default the foreground token). The shared value-text channel across Gauge/RadialBar/ProgressCircle. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80-800. |
| `showLegend` | `boolean` | Show a legend of ring labels beside the chart (default true). |
| `showValues` | `boolean` | Print each ring’s value in the legend (default false). |
| `mutedColor` | `string` | Secondary/muted text colour, the legend ring labels and the empty-state caption (default the muted-foreground token). |
| `emptyText` | `string` | Override the empty-state message shown when there is no valid data (default "No data"). |
| `ariaLabel` | `string` | Override the screen-reader summary of the chart (default an auto per-ring summary). |
