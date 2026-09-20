# Link

Anchor link navigating to `href` (unsafe schemes rejected), or bind `on.commit` for a JS-driven click handler instead of real navigation. Reach for it for in-flow navigation, inline prose links, footer links, "Learn more" affordances, where a Button would read as too heavy; `external` opens a new tab with a trailing glyph and safe rel attributes. `variant` sets the look: inline (underlined accent, default) · subtle (muted) · button (renders as a full Button surface for a link that should act like a CTA).

## Example

```json
{
  "root": "link",
  "elements": {
    "link": {
      "type": "Link",
      "props": {
        "label": "View pricing",
        "href": "https://frayme.ai/pricing",
        "external": null,
        "variant": "inline",
        "tone": null,
        "size": null,
        "weight": null,
        "underline": null,
        "color": null,
        "accent": null,
        "accentText": null,
        "radiusValue": null,
        "icon": null,
        "externalIcon": null,
        "font": null,
        "tracking": null,
        "leading": null,
        "fontSize": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The link text. Keep to 1-5 words ("Learn more", "View pricing"), for a link that should look/act like a button use `variant:button`. |
| `href` | `string` | The navigation target URL. javascript:/data:/vbscript:/file: schemes are rejected. Bind `on.commit` instead of `href` for a JS-driven action rather than real navigation. |
| `external` | `boolean` | Add target=_blank + rel=noopener noreferrer + an external-link glyph. |
| `variant` | `"inline" \| "subtle" \| "button"` | inline (underlined accent link, default) · subtle (muted, underline on hover) · button (renders as a Button surface). |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent (decoupled from variant): neutral · success · warning · critical · info |
| `size` | `"sm" \| "md" \| "lg"` | Font size of the link text: sm · md (default) · lg. Drop to `sm` for a footer/secondary link, `lg` for a prominent inline CTA; use `fontSize` for an exact length. |
| `weight` | `"normal" \| "medium" \| "semibold"` | Font weight (bounded, NOT a number; default normal). |
| `underline` | `"always" \| "hover" \| "none"` | Underline behavior: always (default) · hover (underline only on hover) · none. No effect on `variant:button`. |
| `color` | `string` | Custom link text color (default primary token; muted-foreground for `variant:subtle`). No effect on `variant:button`. |
| `accent` | `string` | Background of the button surface (`variant:button` only), repaints the whole button fill. Defaults to the neutral high-contrast fill, matching Button. No effect on inline/subtle text links, whose text uses `color`. |
| `accentText` | `string` | Text colour of the label on the accent-filled button surface (`variant:button` only). Defaults to the card token. Set when a saturated `accent` needs a legible label. |
| `radiusValue` | `string \| number` | Exact corner radius of the button surface (variant:button only), e.g. "12px" / "1rem". Default the theme radius; no effect on inline/subtle text links. |
| `icon` | `string` | Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is). Never raw SVG; unknown names render nothing. |
| `externalIcon` | `string` | Glyph NAME (from the closed icon registry (or a single emoji glyph, rendered as-is)) for the trailing external-link affordance shown when `external` is true. Default "arrow-up-right"; an unknown/absent name falls back to that default. Never raw SVG. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the link; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the link `label` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the link `label` (tight · snug · normal · relaxed · loose; default the size default). |
| `fontSize` | `string \| number` | Exact font size of the link `label` (e.g. "18px" / "1.125rem"). Overrides the `size` enum font size, which is the default (md = 1rem). |

## Events

### commit

The link was clicked (fires when a handler is bound, instead of or alongside native `href` navigation); params carry {href, label, external}, the sanitized destination URL, the visible label, and whether it opens in a new tab.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
