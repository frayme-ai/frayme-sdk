# Button

Clickable button. Bind on.commit for handler. `variant` sets visual hierarchy; optional `tone` sets semantic intent. `surface:gradient` reads gradientFrom/gradientTo; `accent` overrides the fill.

## Example

```json
{
  "root": "button",
  "elements": {
    "button": {
      "type": "Button",
      "props": {
        "label": "Submit",
        "variant": "primary"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The button text. Keep to 1-4 words; verb-first for an action ("Save changes", "Delete account"). Set to "" for an ICON-ONLY button, provide `icon` + `ariaLabel` for the accessible name. |
| `variant` | `"primary" \| "secondary" \| "danger" \| "ghost" \| "outline"` | Visual hierarchy: primary (solid neutral high-contrast fill, the main CTA, default) · secondary (muted fill) · danger (destructive-action red) · ghost (transparent until hover) · outline (border only, transparent fill). At most one `primary` per view. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent (decoupled from variant): neutral · success · warning · critical · info |
| `disabled` | `boolean` | Grey out the button and block clicks (adds the `disabled` attribute; default false). |
| `loading` | `boolean` | Show a spinner, disable interaction, dim the label (keeps width). |
| `submit` | `boolean` | Render as a form submit button (type=submit) so an enclosing Form commits natively on click/Enter. |
| `iconPosition` | `"start" \| "end"` | Side the `icon` sits relative to the label (default start). |
| `surface` | `"solid" \| "gradient" \| "soft"` | Fill treatment: solid (default) · gradient (reads gradientFrom/gradientTo) · soft (tinted/translucent). |
| `gradientFrom` | `string` | Gradient start colour of the button background (use with `surface:gradient`; pairs with `gradientTo`). |
| `gradientTo` | `string` | Gradient end color (use with `surface:gradient` together with `gradientFrom`). |
| `borderColor` | `string` | Border color (esp. for `variant:outline`/`ghost`; default border token). |
| `minWidth` | `string \| number` | Minimum width (e.g. "180px"), keeps a row of buttons even. |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `icon` | `string` | The button icon, either a NAME from the built-in icon registry (a large lucide set, e.g. "trash-2", "download", "arrow-right", "settings") OR an image URL (https / raster data: URI) for ANY custom/brand icon (rendered as a URL-guarded &lt;img>). Never raw SVG; an unknown name renders nothing. Pair with an empty `label` for an icon-only button. The glyph scales with `size` (sm 14px · md 16px · lg 18px). |
| `ariaLabel` | `string` | Accessible name for the button, REQUIRED for an icon-only button (empty `label` + an `icon`); also used as the tooltip. When a visible `label` is present, this overrides the computed accessible name if set. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole button; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the button `label` (light · normal · medium · semibold · bold; default medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the button `label` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the button `label` (tight · snug · normal · relaxed · loose; default the size default). |
| `fontSize` | `string \| number` | Exact font size of the button `label` (e.g. "15px" / "0.9375rem"). Overrides the `size` enum font size, which is the default. |
| `accent` | `string` | Dominant/active color (button fill, selected pill, active page). Drives `--fr-<comp>-accent`. Defaults to the neutral high-contrast fill, not a brand colour. |
| `accentText` | `string` | Text colour of the label printed on the `accent` fill, the on-fill ink. Defaults to the card token, the inverse of the fill in both light and dark. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner-radius token for the control (default `md`); drop to `sm`/`none` on dense toolbars, `lg` or `full` for a pill-shaped button. |
| `size` | `"sm" \| "md" \| "lg"` | Control height + padding + font-size together (default md). |
| `fullWidth` | `boolean` | Stretch the control to fill its container width (default false); set true for stacked mobile CTAs or a button that spans a form row. |
| `align` | `"start" \| "center" \| "end"` | Inline content / justification within the control (default center). |

## Events

### commit

The button was clicked (and not `loading`); params carry {label}.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
