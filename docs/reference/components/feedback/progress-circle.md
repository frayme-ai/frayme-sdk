# ProgressCircle

A circular/radial progress ring with the percentage in the center. Use for a single completion metric (storage used, profile completeness, a score). `value`/`max` set the arc; `tone` or `color` set its color.

## Example

```json
{
  "root": "progress-circle",
  "elements": {
    "progress-circle": {
      "type": "ProgressCircle",
      "props": {
        "value": 72,
        "max": 100,
        "tone": "success",
        "label": "Complete"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `number` | Current amount filled (clamped to 0..max). Drives the arc + the center %. |
| `max` | `number` | The value that represents a full ring (default 100). |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | Ring diameter + stroke width + label scale: sm · md (default) · lg · xl. |
| `sizeValue` | `string \| number` | Exact ring diameter (e.g. 128px / 8rem). Overrides the `size` enum (which is the default) for width+height only; stroke + label scale stay enum-driven. |
| `strokeWidth` | `string \| number` | Exact ring stroke thickness in px (1-12). Overrides the `size` enum (which is the default) for the track + arc stroke width. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic arc color via token (default neutral = a muted grey, unified with Gauge/Tracker). Use `success`/`critical` to signal good/bad progress. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the center percentage value (default semibold). Use `bold` for a heavier KPI, `medium` for a lighter one. |
| `showValue` | `boolean` | Show the percentage label in the center of the ring (default true). |
| `label` | `string` | Optional small caption shown under the center percentage. |
| `color` | `string` | Exact fill colour of the progress arc (the filled portion of the ring); wins over the `tone` token. Set to a brand colour when the semantic tones do not fit. |
| `trackColor` | `string` | Exact color of the unfilled track ring behind the arc (default a muted token). |
| `valueColor` | `string` | Exact colour of the centre percentage value text (default the foreground token). The shared value-text channel across Gauge/RadialBar/ProgressCircle. |
| `mutedColor` | `string` | Secondary/muted text colour, the small caption under the center percentage (default the muted-foreground token). |
| `ariaLabel` | `string` | Override the screen-reader label for the ring (default the computed "&lt;pct>% &lt;label>" summary). |
