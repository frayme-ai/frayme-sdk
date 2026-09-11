# Stat

A KPI/metric tile: muted label, large value, an optional colored delta with an up/down arrow, and an optional inline sparkline. Group several in a StatGroup for a stats row. Reach for this to headline a single number on a dashboard — a metric read-out, not an interactive control or a chart with axes. `value` is a string so you own the formatting (currency symbol, commas, %), and the optional `delta` is tinted and arrowed by `deltaType` (increase→success/up, decrease→danger/down, neutral→muted); pass a `sparkline` number series to draw a tiny trend line under the value. For a richer dashboard card that holds four facts at once — label, a context `caption`, value and delta — set `layout:"split"` (label+caption left, value+delta right) and optionally a muted category `icon`.

## Example

```json
{
  "root": "stat",
  "elements": {
    "stat": {
      "type": "Stat",
      "props": {
        "label": "Total ad spend",
        "caption": "Last 12 months",
        "value": "$1.24M",
        "delta": "+18.3%",
        "deltaType": "increase",
        "icon": "dollar-sign",
        "layout": "split"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The small muted caption above the value (e.g. "Monthly revenue"). Names the metric — keep to 1-4 words, it truncates on one line. |
| `value` | `string` | The big KPI figure (e.g. "£24,500", "1,204"). A string so you control formatting (currency symbol, commas, %) exactly — truncates on one line. |
| `caption` | `string` | A SECOND muted line under the label giving the metric context — a period, scope or definition ("Last 12 months", "Return on ad spend", "Ad Spend ↔ Sales"). Use it to say what the number MEANS or covers, not to repeat the label. Reach for `layout:"split"` when you use it so the tile stays compact. |
| `icon` | `string` | Optional category icon shown in a small muted rounded square before the label — a registry NAME or a single emoji glyph, rendered as-is — a QUIET identifier for the metric TYPE (a "%" for a rate, "$"/"pound-sterling" for money, "activity" for a correlation, "trending-up" for revenue). Use it as a category cue on a rich tile, NOT decoration on every KPI; a bare number rarely needs one. Never coloured — it inherits the muted tile chrome. |
| `layout` | `"stack" \| "split"` | Tile arrangement: stack (default) — label, value and delta stacked vertically, best for a compact figures strip. split — label+caption on the LEFT and value+delta right-aligned on the RIGHT, the dense dashboard-card look that fits four facts (label, caption, value, delta) in one row. Pick split when the tile carries a caption or an icon. |
| `delta` | `string` | Change indicator text (e.g. "+12.5%" or "-3"). Colored + arrowed by `deltaType`. |
| `sparkline` | `number[]` | Optional series of numbers rendered as a tiny inline trend line under the value. The renderer draws OUR own SVG polyline from the numbers. |
| `strokeWidth` | `string \| number` | Exact sparkline line thickness in px (e.g. 2; default 1.5). |
| `deltaType` | `"increase" \| "decrease" \| "neutral"` | Direction of the delta: increase (success, up arrow) · decrease (danger, down arrow) · neutral (muted). Pick by whether the change is good/bad/flat. |
| `size` | `"sm" \| "md" \| "lg"` | Preset value type scale + tile spacing: sm · md (default) · lg. Bump to `lg` for a hero KPI; override just the number via `fontSize` while spacing stays on `size`. |
| `fontSize` | `string \| number` | Exact KPI value font-size (e.g. 40px / 2.5rem). Overrides ONLY the value type scale of the `size` enum (the default); tile spacing stays on `size`. |
| `align` | `"start" \| "center"` | Text alignment of the tile: start (left, default) · center. |
| `accent` | `string` | Text colour of the big KPI `value` figure (default the inherited foreground). Names a specific brand colour for the number; the inline `sparkline` stroke follows it too unless `sparklineColor` overrides. |
| `sparklineColor` | `string` | Stroke colour of the inline `sparkline` trend line ONLY (default follows `accent`, then the foreground token). Set to give a neutral KPI figure a brand-colored trend line — decouples the trend colour from the value colour. |
| `mutedColor` | `string` | Secondary/muted text colour — the `label` above the value, the `caption` line under it, a neutral (flat) delta, and the glyph in the category `icon` chip (default the muted-foreground token). Up/down deltas stay success/danger toned, and the icon chip keeps its own muted background. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | KPI value font weight (default semibold). Reach for `bold` for a heavier figure or `medium` for a lighter one. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | KPI value letter-spacing (default normal). Use `tight`/`tighter` to condense a long number. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | KPI value line-height (default tight). Rarely needed — bump only if the value wraps. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole stat tile; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
