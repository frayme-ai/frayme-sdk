# Progress

Horizontal progress bar showing `value` against `max` (default 0-100). Use for a determinate task (upload %, form completion, budget usage), reach for Spinner instead when there is no known completion percentage, or `indeterminate:true` here for an unknown-duration task that still wants a bar shape. `showValue` adds a percent/fraction readout; `tone`/`color` set the fill.

## Example

```json
{
  "root": "progress",
  "elements": {
    "progress": {
      "type": "Progress",
      "props": {
        "value": 65,
        "max": 100,
        "label": "Upload progress"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `number` | Current fill amount, in the same units as `max` (e.g. 65 of 100). Clamped to the 0-`max` range when rendering. |
| `max` | `number` | Upper bound `value` is measured against (default 100, treat `value` as a percentage when unset). |
| `label` | `string` | Leading caption above the track (e.g. "Upload progress"). Omit for a bare bar with no caption row. |
| `tone` | `"default" \| "success" \| "warning" \| "critical" \| "info"` | Bar color via token (e.g. critical when over budget). Default is the primary token. |
| `size` | `"xs" \| "sm" \| "md" \| "lg"` | Track (and fill bar) thickness in coarse steps: xs · sm (default) · md · lg. For an exact height use `height`. |
| `height` | `string \| number` | Exact track thickness (e.g. "12px" / "0.75rem"). Overrides the `size` enum, which is the default; the bar follows the track height. |
| `shape` | `"pill" \| "square"` | Track and fill-bar corner shape: pill (fully rounded ends, default) · square (flat corners). |
| `showValue` | `"none" \| "percent" \| "fraction"` | Trailing value readout: none (default) · percent ("65%") · fraction ("13/20"). |
| `striped` | `boolean` | Draw a diagonal-stripe pattern over the filled bar (default false = solid fill). Tint via `overlayColor`. |
| `animated` | `boolean` | Animate the stripes (moving diagonal) or, with `indeterminate`, the shimmer sweep (default false = static). |
| `indeterminate` | `boolean` | Unknown-progress mode: shows a shimmering full-width bar and ignores `value`/`showValue` (default false = determinate, driven by `value`). |
| `color` | `string` | Exact fill-bar color, naming a specific brand color (wins over the `tone` token). |
| `trackColor` | `string` | Exact track (unfilled background) color (default the muted token). |
| `overlayColor` | `string` | Stripe scrim colour drawn over the bar fill when `striped` (default a translucent white). Tint it darker for a light bar fill. |
| `mutedColor` | `string` | Secondary/muted text colour, the trailing value readout (percent/fraction) (default the muted-foreground token). |
