# BarList

A ranked list of horizontal bars (Tremor BarList style): each row is a label with a bar sized proportionally to its value and the value at the end, over a shared 0 → ceiling scale row that ends the chart. Use for top-N breakdowns (top pages, sources, categories). Set `sortByValue` to rank descending.

## Example

```json
{
  "root": "bar-list",
  "elements": {
    "bar-list": {
      "type": "BarList",
      "props": {
        "data": [
          {
            "label": "/home",
            "value": 1240
          },
          {
            "label": "/pricing",
            "value": 870
          },
          {
            "label": "/docs",
            "value": 540
          }
        ],
        "sortByValue": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `data` | `({ label: string, value: number, color: string })[]` | The rows to plot, each a { label, value, color? }. Every bar is sized against one shared axis — 0 → a round ceiling picked just above the largest value — and that 0 → ceiling scale prints as a small row under the bars. |
| `palette` | `"brand" \| "cool" \| "warm" \| "neutral"` | Built-in color ramp applied to bars without their own `color`: brand (primary + sky/teal/amber/rose) · cool (blues/teals) · warm (ambers/reds) · neutral (greys). Unset (default): every bar without a `color` renders a single uniform primary fill — no ramp. Set `palette` to any value to opt into the multi-hue ramp. |
| `accent` | `string` | Single fill applied to EVERY bar that has no per-row `color` (wins over `palette`; default the primary token, matching the unset-`palette` resting fill). |
| `sortByValue` | `boolean` | Sort rows descending by value before plotting (ranked bar list). Default false (keep author order). |
| `showValues` | `boolean` | Show the numeric value at the end of each bar (default true). |
| `valueFormat` | `"plain" \| "compact" \| "percent"` | How each row value prints, in the rows AND on the scale row under them: plain (the raw number, default) · compact ("1.2k"/"3.4M") · percent (value as a "%", and the axis stops at 100%). Pairs with `valuePrefix`/`valueSuffix`. |
| `valuePrefix` | `string` | Text prepended to each formatted value (e.g. "$", "£"). Escaped content. Default none. |
| `valueSuffix` | `string` | Text appended to each formatted value (e.g. " views", "%"). Escaped content. Default none. |
| `size` | `"sm" \| "md" \| "lg"` | Bar height + row spacing + font size (default md). |
| `mutedColor` | `string` | Secondary/muted text colour — the numeric value shown beside each row, the 0 → ceiling scale row under the bars (its numbers and its hairline rule), and the empty-state caption (default the muted-foreground token; the rule defaults to the border token). |
| `trackColor` | `string` | Exact colour of the unfilled track behind each bar (default a muted token). |
| `axisColor` | `string` | Category-axis text colour — the row label above each bar (default the foreground token). The same channel Gantt exposes for its task-name labels. |
| `emptyText` | `string` | Override the empty-state message shown when there is no data (default "No data"). |
