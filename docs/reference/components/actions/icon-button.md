# IconButton

Icon-only button (square). `icon` names a registry glyph; `label` is the required aria-label. `variant` sets hierarchy, `accent` overrides the fill. Reach for IconButton over Button when the affordance is a single glyph with no visible text (e.g. a toolbar close/settings action).

## Example

```json
{
  "root": "icon-button",
  "elements": {
    "icon-button": {
      "type": "IconButton",
      "props": {
        "icon": "settings",
        "label": "Open settings",
        "variant": "ghost"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `icon` | `string` | Icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "trash", "settings", "search"). Never raw SVG; unknown names render nothing. |
| `label` | `string` | Accessible name (aria-label) for the icon-only button, REQUIRED for a11y (e.g. "Delete row"). |
| `variant` | `"primary" \| "secondary" \| "ghost" \| "outline" \| "danger"` | Visual hierarchy (mirrors Button): primary (filled, default) · secondary · ghost (transparent until hover, for toolbars) · outline · danger. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent, decoupled from variant: neutral · success · warning · critical · info. Reach for it when the action MEANS something (critical = destructive). |
| `size` | `"sm" \| "md" \| "lg"` | Square control size + icon size together (default md). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding (default md; `full` = circular icon button). |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "10px" or "0.75rem"); overrides the `radius` enum when set. |
| `disabled` | `boolean` | Disable the button: 50% opacity + blocks clicks/keyboard activation (native `disabled` attribute; default false). Also forced true while `loading` is on. |
| `loading` | `boolean` | Swap the icon for a spinner and block interaction (keeps the square footprint). |
| `accent` | `string` | Custom fill color (overrides the variant fill). Reach for an exact brand color on the button background. |
| `accentText` | `string` | Text colour of the glyph printed on the `accent` fill, the icon ink paired with `accent` (default the primary-foreground token). |
| `borderColor` | `string` | Border colour for the `outline` variant (default the border token). Use to tint the outline edge to a brand colour. |

## Events

### commit

The button was clicked (blocked while `loading` or `disabled`); params carry {label}, the button's aria-label.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
