# Box

Primitive styled container for padding/border/background/shadow when Card is too much. Children stack VERTICALLY with a small built-in gap (never run together); for a horizontal row or a custom gap put a Stack inside the Box. Reach for it to visually group a few related elements — a callout strip, a framed hint, a soft-tinted summary — without the header chrome a Card implies.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "box",
  "elements": {
    "box": {
      "type": "Box",
      "props": {
        "padding": "md",
        "bordered": true,
        "radius": "md"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `padding` | `"none" \| "xs" \| "sm" \| "md" \| "lg" \| "xl"` | Inner padding scale. Reach for `none` when the Box only positions/borders content; `lg`/`xl` for a roomy standalone panel. |
| `paddingValue` | `string \| number` | Exact inner padding (e.g. "320px" / "2rem"). Overrides the `padding` enum, which is the default. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding. `none` for a flush edge-to-edge box; `full` for a pill/round chip surface. |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "10px" / "0.75rem"). Overrides the `radius` enum, which is the default. |
| `bordered` | `boolean` | Draw a 1px border around the box. Pair with `borderColor` to tint it. |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style when bordered: solid (default) · dashed · dotted. |
| `borderWidthValue` | `string \| number` | Exact border thickness when bordered (e.g. "2px"). Default 1px. |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow depth (default none). Use to lift the box off the page as a floating surface. |
| `align` | `"start" \| "center" \| "end"` | Text alignment of the box content (default start). `center` for a centered callout/empty-state. |
| `bg` | `string` | Background fill color. Names a specific surface color when no theme token fits; omit for transparent. |
| `color` | `string` | On-surface text colour for everything inside the box — cascades to all child text (default the foreground token). Pair with `bg` so a dark fill keeps readable content. |
| `borderColor` | `string` | Border color (implies/with `bordered`). Use to tint the outline, e.g. a soft brand edge. |
| `width` | `string \| number` | Explicit box width (e.g. "480px" or "100%"). Omit to fill/shrink to content. |
| `minHeight` | `string \| number` | Minimum height (e.g. "60vh" for a full-bleed hero box, or "12rem"). Omit for intrinsic height. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for this box and everything inside it (cascades): sans · serif · mono · rounded · display. Omit to inherit the theme font. |
