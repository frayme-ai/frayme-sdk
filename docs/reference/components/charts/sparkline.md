# Sparkline

A tiny inline trend chart (no axes). `points` is a number[]; `type` picks line/area/bar; `tone` or `color` sets the hue. Drop next to a metric for an at-a-glance trend.

## Example

```json
{
  "root": "sparkline",
  "elements": {
    "sparkline": {
      "type": "Sparkline",
      "props": {
        "points": [
          4,
          6,
          5,
          8,
          7,
          9,
          12
        ],
        "type": "area",
        "tone": "success"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `points` | `number[]` | The numeric series rendered as a tiny inline trend. The renderer draws OUR own SVG, normalized to [min,max]. |
| `type` | `"line" \| "area" \| "bar"` | Render style: line (default) · area (filled under the line) · bar (mini columns). |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color via token (default neutral). Use `success`/`critical` for an up/down trend. A set tone also tints the no-data placeholder at low opacity. |
| `color` | `string` | Exact line/fill color. Wins over `tone`. A set color also tints the no-data placeholder at low opacity. |
| `height` | `string \| number` | Height of the inline trend (default 1.75rem ≈ 28px when unset). If set, the shared chart channel is bounded 80-800 (px/rem), so any explicit height renders far larger than the inline default. |
| `strokeWidth` | `string \| number` | Exact line stroke width in px (e.g. 2). Overrides the default line weight (1.5). |
| `emptyText` | `string` | Override the empty-state message shown when there is no data (default "No data"). |
| `ariaLabel` | `string` | Override the auto-generated screen-reader summary (role="img" aria-label). Default a computed description of the series. |
