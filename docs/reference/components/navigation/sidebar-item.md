# SidebarItem

A single Sidebar entry. Renders a safe anchor when `href` is set, otherwise a button (bind on.commit). `active` gives the current-page highlight; `icon` shows a leading glyph.

## Example

```json
{
  "root": "sidebar-item",
  "elements": {
    "sidebar-item": {
      "type": "SidebarItem",
      "props": {
        "label": "Dashboard",
        "href": "/dashboard",
        "icon": "home",
        "active": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The item text (e.g. "Dashboard", "Settings"). Stays in the DOM as the accessible name when the parent Sidebar is `collapsed`, just visually hidden — and is ALSO surfaced as a native hover tooltip (the anchor/button `title`) on the collapsed icon rail so a sighted user can identify the icon. Keep to 1-3 words. |
| `href` | `string` | Destination. With an href the item renders as a safe anchor; omit it to render a &lt;button> (bind on.commit for handler-driven nav). |
| `badge` | `string` | Trailing count/status pill (e.g. "3", "New"). Omit for none. |
| `icon` | `string` | Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "home", "settings", "user"). Never raw SVG; unknown names render nothing. Required look when the parent Sidebar is `collapsed`. |
| `active` | `boolean` | Mark this item as the current page (adds aria-current + the accent highlight). Exactly one item per rail is usually active. |
| `size` | `"sm" \| "md" \| "lg"` | Row height + font size (default md). Match the parent Sidebar `size`. |
| `external` | `boolean` | Open the href in a new tab (adds target=_blank + rel=noopener noreferrer + an external-link glyph). Only meaningful with an href. |
| `accent` | `string` | Highlight color for the active state (background tint + text). Names a specific brand color; default the primary token (and inherits the parent Sidebar accent). |
| `trackColor` | `string` | Resting (non-active) row background fill — the unselected item track (default transparent; only the active item gets the accent tint). Set a subtle surface to lift every resting row. |
| `color` | `string` | Resting (non-active) row text colour — the label of an unselected item (default the foreground token). Does NOT touch the active item, which uses `accent`. |
| `mutedColor` | `string` | Secondary/muted text colour — the trailing badge pill (its label AND, when set, a soft 15% tinted pill fill in place of the muted token) and the external-link glyph (default the muted-foreground token / muted pill). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole item row; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the item `label` (light · normal · medium · semibold · bold; default medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the item `label` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the item `label` (tight · snug · normal · relaxed · loose; default the size default). |
| `fontSize` | `string \| number` | Exact font size of the item `label` (e.g. "18px" / "1.125rem"). Overrides the `size` enum font size, which is the default. |

## Events

### commit

The item (anchor or button) was clicked; params carry {label}. With an href the browser also navigates natively — bind on.commit for handler-driven nav or analytics alongside/instead of the link.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
