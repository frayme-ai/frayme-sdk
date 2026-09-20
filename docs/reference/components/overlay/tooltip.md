# Tooltip

Small hover/focus bubble showing `content` next to its `text` trigger. Use for a brief clarifying hint on a label, icon, or truncated value, reach for Popover instead when the panel needs its own interactive content (buttons, a form) or should open on click rather than hover. Set `maxWidthValue` to let a longer hint wrap.

## Example

```json
{
  "root": "tooltip",
  "elements": {
    "tooltip": {
      "type": "Tooltip",
      "props": {
        "content": "Used to authenticate requests from your server.",
        "text": "API key",
        "placement": "top",
        "size": null,
        "bg": null,
        "color": null,
        "radiusValue": null,
        "maxWidth": null,
        "shadow": null,
        "motion": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `content` | `string` | The bubble text shown on hover/focus. Keep to a short phrase, a tooltip is a hint, not a Popover-length explanation. |
| `text` | `string` | The always-visible trigger label the tooltip attaches to (e.g. an underlined term or an icon caption). |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | Which side of the `text` trigger the bubble appears on (default top). |
| `size` | `"sm" \| "md"` | Density of the hover bubble, its padding and font size together: sm (tighter, for a terse hint) · md (default). Only two steps; a tooltip stays small by design. |
| `bg` | `string` | Bubble background color (default is the dark foreground token). |
| `color` | `string` | Bubble text color (default is the light card token). |
| `radiusValue` | `string \| number` | Exact corner radius of the hover bubble (e.g. "8px" / "0.5rem"). Default the theme radius / 2. |
| `maxWidthValue` | `string \| number` | Cap on the bubble width (e.g. "16rem"). Default: no cap, the bubble is a single nowrap line. Set it for a sentence-length `content` so the bubble wraps onto multiple lines instead of overflowing the viewport. |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Elevation of the hover bubble (none · sm · md · lg · xl). Default: none (flat). Reach for a value to lift the bubble off the surface. |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for the bubble (fast/normal/slow). Default: the current fade, no extra animation. |
