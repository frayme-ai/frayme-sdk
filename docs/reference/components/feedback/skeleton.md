# Skeleton

Gray placeholder box that mimics the shape of content still loading — a line, card rect, circular avatar, or pill button. Use it wherever a Spinner would be too generic: it reserves the actual layout space so content does not jump in when it arrives. Purely decorative: no children, no events, `aria-hidden`.

## Example

```json
{
  "root": "skeleton",
  "elements": {
    "skeleton": {
      "type": "Skeleton",
      "props": {
        "width": null,
        "height": null,
        "shape": "line",
        "radius": null,
        "radiusValue": null,
        "animation": null,
        "tone": null,
        "lines": 3
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `width` | `string \| number` | Box width, up to 2048px (validated; default 100% — fills its container). Use with `shape:circle` to size an avatar placeholder (pair with matching `height`). |
| `height` | `string \| number` | Box height, up to 2048px (validated; default 1rem — a single text-line height). |
| `shape` | `"line" \| "rect" \| "circle" \| "pill"` | Placeholder shape: line (text bar) · rect (card, default) · circle (avatar) · pill (button). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding for line/rect shapes (default md). |
| `radiusValue` | `string \| number` | Exact corner radius for line/rect shapes (e.g. "6px"). Overrides the `radius` enum, which is the default; circle/pill stay round. |
| `animation` | `"pulse" \| "shimmer" \| "none"` | Loading animation: pulse (default) · shimmer · none. |
| `tone` | `"default" \| "subtle"` | Base gray intensity of the placeholder fill: default · subtle (lighter, for a placeholder inside an already-muted surface). |
| `lines` | `string \| number` | Render N stacked line skeletons instead of one box (1-8, e.g. 3 for a paragraph placeholder); the last line is auto-shortened to 60% width (text-block look). Ignored when unset (single box). |
