# DonutChart

Donut / ring chart of proportional segments. Each datum is { label, value, color? }; arcs are value÷total. `showTotal` prints the sum in the center; `palette` colors slices without a per-slice `color`.

## Example

```json
{
  "root": "donut-chart",
  "elements": {
    "donut-chart": {
      "type": "DonutChart",
      "props": {
        "data": [
          {
            "label": "Direct",
            "value": 45
          },
          {
            "label": "Referral",
            "value": 30
          },
          {
            "label": "Social",
            "value": 25
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
| `data` | `({ label: string, value: number, color: string })[]` | The slices; each is { label, value, color? }. Slice arc = value ÷ sum of values. |
| `thickness` | `"thin" \| "md" \| "thick"` | Ring stroke width: thin · md (default) · thick. `thin` reads as a progress ring, `thick` as a chunky donut. |
| `strokeWidth` | `string \| number` | Exact ring stroke width in 100-unit viewBox space (not screen px; e.g. 20). Overrides the `thickness` enum, which is the default. |
| `showTotal` | `boolean` | Show the summed total in the donut’s center hole (default true). |
| `totalLabel` | `string` | Caption under the center total when `showTotal` is on (default "Total"). Set it to localise or rename the KPI (e.g. "Sum", "Sessions"). |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the center total value — the donut’s single KPI (default semibold). Use `bold` to make it heavier, `medium`/`normal` lighter. |
| `fontSize` | `string \| number` | Exact font size of the center total value (e.g. "1.75rem" or "28px"; default 1.375rem). Bump it up when the donut is large. |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-series `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80–800. |
| `showLegend` | `boolean` | Show a legend mapping color→label beside the ring (default true). |
| `showValues` | `boolean` | Print each slice’s value/percent in the legend (default false). |
| `valueFormat` | `"plain" \| "compact" \| "percent"` | How the center total prints: plain (the raw sum, default) · compact ("1.2k") · percent. Pairs with `valuePrefix`/`valueSuffix`. The legend still shows each slice’s own percent. |
| `valuePrefix` | `string` | Text prepended to each formatted value (e.g. "$", "£"). Escaped content. Default none. |
| `valueSuffix` | `string` | Text appended to each formatted value (e.g. " users", "k"). Escaped content. Default none. |
| `mutedColor` | `string` | Secondary/muted text colour — the legend slice labels, the center “Total” caption, and the empty-state caption (default the muted-foreground token). |
| `trackColor` | `string` | The unfilled remainder ring behind the slices (default the muted token). |
| `axisColor` | `string` | Text colour of the summed total printed in the donut’s centre hole when `showTotal` is on (default the inherited foreground). The family channel for showValues-style numeric annotations. |
| `emptyText` | `string` | Override the empty-state message shown when there is no data (default "No data"). |
| `ariaLabel` | `string` | Override the auto-generated screen-reader summary (role="img" aria-label). Default a computed description of the series. |
