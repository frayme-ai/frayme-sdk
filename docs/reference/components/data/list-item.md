# ListItem

A single list/menu row: leading icon + title/description stack + trailing text/badge. Renders an &lt;a> when `href` is set, otherwise a button that emits `commit`. Group several inside a Stack or Card.

## Example

```json
{
  "root": "list-item",
  "elements": {
    "list-item": {
      "type": "ListItem",
      "props": {
        "title": "Account settings",
        "description": "Profile, security, billing",
        "leadingIcon": "settings"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | The row's primary label (e.g. "Account settings"). Keep to a short noun phrase, it truncates on one line. |
| `value` | `string` | Stable identifier for this row (e.g. a route key, record id, or slug like "settings-billing"). Echoed unchanged in the `commit` payload so a handler can route/track by id even when two rows share the same `title`. Omit only when the visible title is already unique. |
| `description` | `string` | Secondary muted line under the `title` (e.g. "Profile, security, billing"). Truncates on one line; omit for a title-only row. |
| `leadingIcon` | `string` | Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "user", "mail"). Never raw SVG; unknown names render nothing. |
| `trailingText` | `string` | Right-aligned meta text (e.g. a timestamp or count). |
| `badge` | `string` | Short trailing badge chip after the title (e.g. "New" or an unread count "3"; default none). Keep it 1-3 chars/one word; its tint derives from `mutedColor`. Set to flag row status or a count. |
| `href` | `string` | Make the row a navigable link. Omit to render an interactive button row that emits `commit`. |
| `external` | `boolean` | When `href` is set: open in a new tab (adds target=_blank + rel=noopener noreferrer + an external-link glyph). |
| `active` | `boolean` | Mark the row selected/current (highlights it + sets aria-current). |
| `size` | `"sm" \| "md" \| "lg"` | Row horizontal padding + font size: sm · md (default) · lg. Vertical row height is controlled separately by `density`. |
| `density` | `"compact" \| "normal" \| "comfortable"` | Vertical row height: compact (tight lists) · normal (default) · comfortable (roomy). |
| `accent` | `string` | Text colour of the row `title` on a selected/active row, and the ink of its leading icon; the same colour also paints the 3px active bar down the row's left edge (default the primary token). Applies only when `active`. |
| `mutedColor` | `string` | Secondary/muted text colour, the description line, trailing meta text, the leading icon (non-active rows), and the external-link arrow (default the muted-foreground token). When set, the trailing badge chip’s fill derives from it as a 14% tint (default the muted token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole list row; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the row `title` (light · normal · medium · semibold · bold; default medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the row `title` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the row `title` (tight · snug · normal · relaxed · loose; default normal). |
| `fontSize` | `string \| number` | Exact font size of the row `title` (e.g. "15px" / "0.9375rem"). Overrides ONLY the title; secondary text and row padding stay on the `size` enum (the default). |

## Events

### commit

The row (anchor or button) was clicked; params carry {value, label, href}, the stable `value` id (null if unset), the row `title` as `label`, and the resolved `href` (null on a button row) so a handler can route/track without re-deriving the target from the title. With an href the browser also navigates natively, bind on.commit for handler-driven nav or analytics alongside/instead of the link.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
