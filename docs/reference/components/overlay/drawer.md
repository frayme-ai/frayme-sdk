# Drawer

Edge-docked sheet (bottom by default; left/right/top via `side`). Set openPath to a boolean state path. Use setState to toggle.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "drawer",
  "elements": {
    "drawer": {
      "type": "Drawer",
      "props": {
        "title": "Your cart",
        "description": "3 items",
        "openPath": "cartOpen",
        "side": "right",
        "size": null,
        "radius": null,
        "radiusValue": null,
        "padding": null,
        "dismissable": null,
        "showClose": null,
        "bg": null,
        "color": null,
        "borderColor": null,
        "overlayColor": null,
        "mutedColor": null,
        "shadow": null,
        "motion": null,
        "sizeValue": null,
        "font": null,
        "weight": null,
        "tracking": null,
        "leading": null,
        "fontSize": null,
        "closeLabel": null,
        "closeIcon": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Sheet heading shown in the header; also the accessible name (aria-label) of the drawer. Keep to 2-6 words ("Your cart"). |
| `description` | `string` | Muted supporting line under the title (colored by `mutedColor`). One sentence of context for the sheet. |
| `openPath` | `string` | State path of the boolean that controls visibility, e.g. "cartOpen" with state {"cartOpen": false}. The drawer renders only while that value is true; the × button and backdrop click write false back to this path. |
| `side` | `"bottom" \| "right" \| "left" \| "top"` | Edge the sheet docks to: bottom (default) · right · left · top. |
| `size` | `"sm" \| "md" \| "lg" \| "full"` | Sheet extent (height for top/bottom, width for left/right). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding on the sheet's inner (leading) edge only — the docked edge stays flush: none · sm · md (default) · lg · full. Use `radiusValue` for an exact length. |
| `radiusValue` | `string \| number` | Exact leading-edge corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `padding` | `"sm" \| "md" \| "lg"` | Sheet inner padding: sm (0.75rem) · md (1.25rem, default) · lg (2rem). |
| `dismissable` | `boolean` | Allow backdrop-click + × to close. Set false to force an explicit action. |
| `showClose` | `boolean` | Show the × close button in the header (default true). Set false together with `dismissable:false` to force an explicit action. |
| `bg` | `string` | Sheet background color — the sliding panel surface (default the card token). Pair with `color` so header/body text stays legible. |
| `color` | `string` | On-surface text colour for the sheet — the drawer `title` and all slot/body content that inherits the sheet text — pair it with a custom dark `bg` so the surface stays legible (default the card-foreground token). The `description` line and × close glyph follow `mutedColor` instead; bg + color + borderColor + mutedColor brand the surface together. |
| `borderColor` | `string` | Sheet border colour along its docked edge (default the border token). Set it to tint the divider between the sheet and the page — pairs with `bg`/`color` to brand the surface. |
| `overlayColor` | `string` | Backdrop scrim colour behind the sheet (default black/45). Name a specific tint — e.g. a slate-tinted overlay — or a heavier value to darken the page more. |
| `mutedColor` | `string` | Secondary/muted text colour — the drawer `description` line under the title AND the × close button glyph (default the muted-foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Elevation of the sliding panel (none · sm · md · lg · xl); overrides the default raised shadow. |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for this overlay (fast/normal/slow). Default: no animation — the sheet appears instantly. |
| `sizeValue` | `string \| number` | Exact extent override (escape hatch beyond `size`), e.g. "420px" wide / "60%" tall. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole drawer sheet; cascades to the title + body via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the drawer `title` (light · normal · medium · semibold · bold; default semibold). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the drawer `title` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the drawer `title` (tight · snug · normal · relaxed · loose; default the title default). |
| `fontSize` | `string \| number` | Exact font size of the drawer `title` (e.g. "20px" / "1.25rem"). Default 1.0625rem. |
| `closeLabel` | `string` | Accessible label (aria-label) for the × close button. Default "Close". Localise it for non-English UIs. |
| `closeIcon` | `string` | Close-button glyph — an icon NAME from the closed registry (e.g. "x"). Unknown/omitted → the default × character. Never raw SVG. |

## Events

### dismiss

The drawer was closed via the × button or a backdrop click; params carry {open:false} — the resolved closed state (also written back to `openPath`).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
