# Vocabulary

Shared enum atoms, the bounded value menus reused across the whole catalog, so every component spells `size`, `tone`, `radius`, and friends the same way.

Every atom is nullable: omit the prop and the renderer applies its default token, so a minimal spec still renders polished.

## Enum atoms

| Atom | Values | Notes |
| --- | --- | --- |
| `Size` | `xs` · `sm` · `md` · `lg` · `xl` | General size scale used by non-form components. |
| `Radius` | `none` · `sm` · `md` · `lg` · `full` | Corner-radius token. |
| `Align` | `start` · `center` · `end` · `stretch` | Cross-axis alignment. |
| `Tone` | `neutral` · `success` · `warning` · `critical` · `info` | Semantic intent, `critical` is the danger sense; there is no separate `danger` value in the canonical vocabulary. |
| `Orient` | `horizontal` · `vertical` | Layout direction. |
| `Variant` | `default` · `primary` · `secondary` · `tertiary` · `ghost` · `outline` · `link` | Visual hierarchy only, semantic intent lives in `Tone`. |
| `Density` | `compact` · `normal` · `comfortable` | Row/item spacing preset. |
| `Justify` | `start` · `center` · `end` · `between` · `around` · `evenly` | Main-axis distribution. |
| `Elevation` | `none` · `sm` · `md` · `lg` · `xl` | Surface elevation preset. |
| `Gap` | `none` · `sm` · `md` · `lg` · `xl` | Spacing between children. |
| `Font` | `sans` · `serif` · `mono` · `rounded` · `display` | Closed typeface menu, never a free font-family string. |
| `BorderStyle` | `solid` · `dashed` · `dotted` | Closed border-style menu. |
| `Weight` | `light` · `normal` · `medium` · `semibold` · `bold` | Font weight preset. |
| `Tracking` | `tighter` · `tight` · `normal` · `wide` · `wider` | Letter-spacing preset. |
| `Leading` | `tight` · `snug` · `normal` · `relaxed` · `loose` | Line-height preset. |
| `Shadow` | `none` · `sm` · `md` · `lg` · `xl` | Box-shadow preset. |
| `Opacity` | `full` · `90` · `75` · `50` · `25` | Opacity preset. |
| `Aspect` | `auto` · `1/1` · `4/3` · `3/2` · `16/9` · `21/9` · `3/4` | Closed aspect-ratio menu (`Image`, `VideoPlayer`, `YouTube`, …). |
| `Motion` | `none` · `fast` · `normal` · `slow` | Opt-in enter-transition speed for floating surfaces; unset means no animation. |

## Value atoms

Two prop channels accept validated free values instead of an enum. Both are nullable and applied as inline CSS variables, data, never arbitrary CSS:

- **Color**, a safe CSS color (hex, `rgb()`, `hsl()`, `oklch()`, or a named color). Used by props like `accent`, `labelColor`, `gradientFrom`. Unsafe strings fail validation.
- **Dimension**, a safe CSS length or unitless count (for example `"12rem"`, `"100%"`, or `3`), bounded per call site (a `columns` prop caps its count range). Used by props like `width` and `minWidth`.

```json
{
  "root": "cta",
  "elements": {
    "cta": {
      "type": "Button",
      "props": {
        "label": "Upgrade",
        "accent": "#6d28d9",
        "minWidth": "12rem",
        "radius": "full"
      }
    }
  }
}
```

Icon names are their own closed vocabulary, see [Icons](icons.md). The canonical event verbs are documented in [Events](events.md).
