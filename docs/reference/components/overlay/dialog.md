# Dialog

Modal dialog: a centered panel over a backdrop scrim with a title/description header, × close, and children as the body. Visibility is state-driven — set `openPath` to a boolean state path and toggle it via setState (e.g. from a Button action); there is no open prop. Choose Dialog for focused confirm/detail moments; Drawer docks to an edge for longer side content, and Popover/Tooltip stay anchored to a trigger instead of taking over.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "dialog",
  "elements": {
    "dialog": {
      "type": "Dialog",
      "props": {
        "title": "Confirm deletion",
        "description": "This action cannot be undone.",
        "openPath": "confirmOpen",
        "size": "md",
        "radius": null,
        "radiusValue": null,
        "padding": null,
        "align": null,
        "dismissable": null,
        "showClose": null,
        "bg": null,
        "color": null,
        "borderColor": null,
        "overlayColor": null,
        "mutedColor": null,
        "shadow": null,
        "motion": null,
        "width": null,
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
| `title` | `string` | Dialog heading shown in the panel header; also the accessible name (aria-label) of the dialog. Keep to 2-6 words ("Confirm deletion"). |
| `description` | `string` | Muted supporting line under the title (colored by `mutedColor`). One sentence explaining what the dialog does or asks. |
| `openPath` | `string` | State path of the boolean that controls visibility, e.g. "confirmOpen" with state {"confirmOpen": false}. The dialog renders only while that value is true; the × button and backdrop click write false back to this path. |
| `size` | `"sm" \| "md" \| "lg" \| "full"` | Panel max width: sm · md (default) · lg · full. Reach for `sm` on a terse confirm, `lg`/`full` for a detail/form panel; use `width` for an exact override. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Panel corner radius: none · sm · md (default, the theme radius) · lg · full. For an exact value use `radiusValue`. |
| `radiusValue` | `string \| number` | Exact panel corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `padding` | `"sm" \| "md" \| "lg"` | Panel inner padding: sm (0.75rem) · md (1.25rem, default) · lg (2rem). |
| `align` | `"start" \| "center"` | Vertical position of the panel: center (default) or start (top-aligned). |
| `dismissable` | `boolean` | Allow backdrop-click + × to close. Set false to force an explicit action (no casual dismiss). |
| `showClose` | `boolean` | Show the × close button in the header (default true). Set false together with `dismissable:false` to force an explicit action button. |
| `bg` | `string` | Panel background color — the dialog surface behind the header + body (default the card token). Pair with `color` for a dark/branded panel so text stays legible. |
| `color` | `string` | On-surface text colour for the panel — the dialog `title` and all slot/body content that inherits the panel text — pair it with a custom dark `bg` so the surface stays legible (default the card-foreground token). The `description` line and × close glyph follow `mutedColor` instead; bg + color + borderColor + mutedColor brand the surface together. |
| `borderColor` | `string` | Panel border colour (default the border token). Set it to tint the panel outline — e.g. a soft brand edge — pairing with `bg`/`color` to brand the whole surface. |
| `overlayColor` | `string` | Backdrop scrim color. Names a specific tint (e.g. a slate-tinted overlay) instead of the default black/45. |
| `mutedColor` | `string` | Secondary/muted text colour — the dialog `description` line under the title AND the × close button glyph (default the muted-foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Elevation of the floating panel (none · sm · md · lg · xl); overrides the default raised shadow. |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for this overlay (fast/normal/slow). Default: no animation — the panel appears instantly. |
| `width` | `string \| number` | Exact panel width override (escape hatch beyond `size`), e.g. "640px". |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole dialog panel; cascades to the title + body via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the dialog `title` (light · normal · medium · semibold · bold; default semibold). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the dialog `title` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the dialog `title` (tight · snug · normal · relaxed · loose; default the title default). |
| `fontSize` | `string \| number` | Exact font size of the dialog `title` (e.g. "20px" / "1.25rem"). Default 1.0625rem. |
| `closeLabel` | `string` | Accessible label (aria-label) for the × close button. Default "Close". Localise it for non-English UIs. |
| `closeIcon` | `string` | Close-button glyph — an icon NAME from the closed registry (e.g. "x"). Unknown/omitted → the default × character. Never raw SVG. |

## Events

### dismiss

The dialog was closed via the × button or a backdrop click; params carry {open:false} — the resolved closed state (also written back to `openPath`).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
