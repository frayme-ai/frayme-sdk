# Gauge

A single-value half-circle (180°) gauge dial. The arc sweep = (value−min)/(max−min). `thresholds` color the arc by zone; otherwise `tone`/`color` set it. Center shows the value (+unit) and `label`.

## Example

```json
{
  "root": "gauge",
  "elements": {
    "gauge": {
      "type": "Gauge",
      "props": {
        "value": 72,
        "unit": "%",
        "label": "CPU load",
        "tone": "warning"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `number` | The current value to point the dial at (clamped into [min,max]). |
| `min` | `number` | Low end of the dial scale, where the arc sweep starts at 0% (default 0). `value` is clamped into [min,max]. |
| `max` | `number` | High end of the dial scale, the value at which the arc reaches the full 180° sweep (default 100). Must exceed `min`; a non-increasing pair falls back to min+1. |
| `thresholds` | `({ value: number, color: string, label: string })[]` | Colored zones along the arc; each is { value, color?, label? }. When set, the value-arc takes the color of the band the value falls in. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color of the value arc via token (default neutral = a muted grey, unified with ProgressCircle/Tracker). Overridden by `color` or a matching `thresholds` band. |
| `color` | `string` | Exact value-arc color. Wins over `tone` (but a matching `thresholds` band still colors the arc). |
| `trackColor` | `string` | Exact color of the empty background track (default the muted token). |
| `valueColor` | `string` | Exact colour of the centre KPI value text (default the foreground token). The shared value-text channel across Gauge/RadialBar/ProgressCircle. |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | Overall dial scale, dial width plus matching arc stroke and center value/caption text sizes: sm (130px) · md (180px, default) · lg (240px) · xl (320px). |
| `sizeValue` | `string \| number` | Exact dial width (e.g. 200px / 14rem). Overrides the `size` enum for the dial WIDTH only; the arc stroke + centre text sizes stay enum-driven. Parity with ProgressCircle.sizeValue. |
| `showValue` | `boolean` | Show the value (+unit) in the dial center (default true). |
| `showRange` | `boolean` | Show the min/max scale extremes as small captions at the two arc feet (industry gauge convention), tinted by `mutedColor` (default false). |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the center dial value, the dominant KPI (default semibold). Size follows the `size` enum. |
| `label` | `string` | Caption under the center value naming the metric (e.g. "CPU load"). Keep to 1-3 words; when set it replaces the active `thresholds` band label, and it only renders while `showValue` is on. |
| `unit` | `string` | Unit suffix appended to the value (e.g. "%", "ms"). |
| `mutedColor` | `string` | Secondary/muted text colour, the centre unit suffix, the caption under the value, and the min/max range captions (default the muted-foreground token). |
| `ariaLabel` | `string` | Override the screen-reader summary of the dial (default an auto value/range/label summary). |
