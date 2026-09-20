# Callout

An emphasised in-content note (boxed): leading icon + optional title + body (the `message` prop OR children). `tone` colors it by intent and `variant` picks the surface treatment. Set `dismissible` for a × that hides it and emits `dismiss`. Use inline within a page to flag a tip/warning, NOT as a page-level Banner. Bind `dismissed` with `{ $bindState }` so the agent (or a sibling control) can read whether the callout has been closed from spec.state.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "callout",
  "elements": {
    "callout": {
      "type": "Callout",
      "props": {
        "title": "Heads up",
        "message": "API keys are shown only once, copy it now.",
        "tone": "warning",
        "variant": "left-accent"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `message` | `string` | The note body (or pass rich content via children/the default slot). |
| `title` | `string` | Optional bold heading above the body (e.g. "Heads up"). Short, a few words, not a sentence. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color via token (default info). Use `warning`/`critical` for cautions, `info` for tips. |
| `icon` | `string` | Leading status glyph: "auto" (derive from tone), "none" (hide), or a NAME from the closed icon registry (or a single emoji glyph, rendered as-is). Never raw SVG; unknown names render nothing. |
| `variant` | `"subtle" \| "solid" \| "outline" \| "left-accent"` | Surface treatment: subtle (tinted, default) · solid (high-contrast filled) · outline (border only) · left-accent (tinted with a thick left bar). |
| `dismissible` | `boolean` | Show a × that hides the callout and emits `dismiss`. |
| `dismissed` | `boolean` | Bindable dismissed state, the × writes true here into spec.state (bind with { $bindState }) so a host/agent can read or drive whether the callout was closed; also sets the initial hidden state (true = start hidden). Only meaningful with `dismissible` on. |
| `dismissLabel` | `string` | Accessible label for the dismiss × button (default "Dismiss"). Set for localisation. Only used when `dismissible` is on. |
| `dismissIcon` | `string` | Glyph NAME (closed icon registry) for the dismiss affordance (default "x"). Unknown/absent names fall back to the default ×. Never raw SVG. |
| `bg` | `string` | Exact background fill of the callout surface (default the tone/variant-derived tint). Wins over `tone` and `variant`; set it to brand the note, and pair with `color` for legible copy. |
| `borderColor` | `string` | Border colour (default the tone/variant-derived border). Pair with a custom `bg` to brand the whole surface. |
| `accent` | `string` | Text colour of the leading icon glyph, and the colour of the thick left bar on `variant:'left-accent'`; on `variant:'solid'` the same value is instead the background fill of the whole note, and on subtle/left-accent it also tints the surface at 8% (default the tone token). |
| `color` | `string` | Text colour of the callout title + body copy. On a non-solid variant it recolours the copy over the tone surface (foreground-token default), settable independently of `bg`; on the `solid` variant it is the on-fill text (default white). Set a dark value when a solid warning/light accent fill needs contrast. |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style of the callout frame: solid (default) · dashed · dotted. Reach for dashed/dotted to make a softer, draft-y note. |
| `borderWidthValue` | `string \| number` | Exact border thickness of the callout frame in px (e.g. "2px"; default 1px). Does not affect the left-accent bar. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole callout region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the title + body text (default semibold title, normal body). Set to override the baked weight. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the title + body text (default normal). Use `tight` to condense or `wide` to loosen the note. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the title + body text (default snug title, relaxed body). Set to tighten or open up the copy. |
| `fontSize` | `string \| number` | Exact font size of the callout title (e.g. "20px" / "1.25rem"). Default 0.9375rem. |

## Events

### dismiss

The × was pressed (self-hides, `dismissible` must be on); params carry {label}, the callout title, if set.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
