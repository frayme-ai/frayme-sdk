# Tag

Compact chip/tag for labels, filters, and selected tokens. `tone` colors it by intent; set `removable` for a dismissable × that emits `dismiss`. Reach for this for short status/category labels or the selected-token chips of a filter bar — not for a full interactive control (use a Button) or a menu row (use ListItem). Pick `variant` (`solid`/`soft`/`outline`) and `tone` together to set the fill treatment and semantic color; when `removable`, clicking the trailing × emits `dismiss` with the chip `label` so a host can drop the filter.

## Example

```json
{
  "root": "tag",
  "elements": {
    "tag": {
      "type": "Tag",
      "props": {
        "label": "In progress",
        "tone": "info",
        "removable": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The chip text (e.g. "In progress", "Beta"). Keep to 1-3 words — long labels truncate at 12rem. |
| `icon` | `string` | Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "star", "filter"). Never raw SVG; unknown names render nothing. |
| `variant` | `"solid" \| "soft" \| "outline"` | Fill treatment: solid (filled) · soft (tinted, default) · outline (border only). Reach for `outline` on filter chips, `solid` for a strong label. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color of the chip via token (default neutral). Use `success`/`critical` for status tags. |
| `size` | `"sm" \| "md" \| "lg"` | Chip padding + label font size: sm · md (default) · lg. |
| `shape` | `"pill" \| "rounded" \| "square"` | Corner shape: pill (fully round, default) · rounded · square. |
| `removable` | `boolean` | Show a trailing × that emits `dismiss` — use for dismissable filter chips / selected tokens. |
| `removeLabel` | `string` | Accessible label for the remove (×) button (default "Remove {label}"). Escaped text — set for i18n/localized affordances. |
| `removeIcon` | `string` | Glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) for the remove affordance (default "x"). Unknown/absent names fall back to the x glyph. Never raw SVG. |
| `bg` | `string` | Exact background fill (brand chip). Wins over tone/variant. |
| `color` | `string` | Exact label/icon text color. Wins over tone/variant. |
| `borderColor` | `string` | Exact border color of the chip (default derives from `tone`/`variant`). Most useful with `variant:outline`, where the border is the chip; name a brand color to tint it. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole tag chip; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the tag `label` (light · normal · medium · semibold · bold; default medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the tag `label` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the tag `label` (tight · snug · normal · relaxed · loose; default a compact single-line leading). |
| `fontSize` | `string \| number` | Exact font size of the tag `label` (e.g. "13px" / "0.8125rem"). Overrides ONLY the label type scale of the `size` enum (the default); chip padding stays on `size`. |

## Events

### dismiss

The trailing × (remove) button was clicked; params carry {label} with the chip's text. Only fires when `removable` is set.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
