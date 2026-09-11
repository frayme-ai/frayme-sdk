# PieChart

Full proportional pie chart (no center hole). Each datum is { label, value, color? }; wedge angle is value÷total. `palette` colors slices without a per-slice `color`.

## Example

```json
{
  "root": "pie-chart",
  "elements": {
    "pie-chart": {
      "type": "PieChart",
      "props": {
        "data": [
          {
            "label": "Chrome",
            "value": 64
          },
          {
            "label": "Safari",
            "value": 19
          },
          {
            "label": "Firefox",
            "value": 9
          },
          {
            "label": "Other",
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
| `data` | `({ label: string, value: number, color: string })[]` | The slices; each is { label, value, color? }. Slice angle = value ÷ sum of values. |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-item `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~220px). Bounded 80-800. |
| `showLegend` | `boolean` | Show a legend mapping color→label beside the pie (default true). |
| `showValues` | `boolean` | Print each slice’s percent of the total in the legend (default false). |
| `mutedColor` | `string` | Secondary/muted text colour — the legend labels and the empty-state caption (default the muted-foreground token). |
| `separatorColor` | `string` | Stroke colour of the thin gap between slices (default the card/background token). |
| `emptyText` | `string` | Override the empty-state message shown when there is no renderable data (default "No data"). |
| `ariaLabel` | `string` | Override the chart’s accessible summary (the role="img" aria-label). Default is an auto-computed description of the data. |
