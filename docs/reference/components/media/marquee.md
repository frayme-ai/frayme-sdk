# Marquee

An auto-scrolling marquee strip. Supply `items` (escaped text) or children; the content is duplicated for a seamless CSS loop. `speed`/`direction` are fixed enums; `pauseOnHover` and `fade` polish it; `color`/`size` tune the item tone and `height` sizes the vertical viewport.

## Example

```json
{
  "root": "marquee",
  "elements": {
    "marquee": {
      "type": "Marquee",
      "props": {
        "items": [
          "Acme",
          "Globex",
          "Initech",
          "Umbrella"
        ],
        "speed": "normal"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `string[]` | The strip’s text items (rendered as escaped text). When omitted, the element’s children are scrolled instead. |
| `direction` | `"left" \| "right" \| "up" \| "down"` | Scroll direction: left (default) · right · up · down. |
| `speed` | `"slow" \| "normal" \| "fast"` | Scroll speed: slow (~28s) · normal (~18s, default) · fast (~10s). |
| `pauseOnHover` | `boolean` | Pause the animation while the pointer is over it (default true). |
| `gap` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Spacing between items: none · sm · md (default) · lg · xl. |
| `fade` | `boolean` | Fade the leading/trailing edges with a mask (default false). |
| `opacity` | `"25" \| "50" \| "75" \| "90" \| "full"` | Dim the whole strip for a background/inactive look: full (default) · 90 · 75 · 50 · 25. |
| `color` | `string` | Text colour of the strip items (default the foreground token). Set a muted value for a subtle logo-cloud tone, or a brand value for a loud ticker. |
| `size` | `"sm" \| "md" \| "lg"` | Item text size: sm (0.75rem) · md (0.875rem, default) · lg (1rem). Logo-cloud marquees typically run larger. |
| `height` | `string \| number` | Viewport height of the VERTICAL strip (direction up/down; e.g. "16rem"; default 12rem). No effect on horizontal marquees. |
