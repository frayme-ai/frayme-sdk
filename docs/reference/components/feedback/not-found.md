# NotFound

A 404 / not-found route panel: an optional large status code, a title + description, an illustrative icon, and an optional call-to-action. The action renders an &lt;a> when `actionHref` is set, else a button that emits `commit`. Use as a full-route placeholder when a page/resource is missing — reach for Result instead when reporting the outcome of a completed action (payment, submission) rather than a missing route.

## Example

```json
{
  "root": "not-found",
  "elements": {
    "not-found": {
      "type": "NotFound",
      "props": {
        "code": "404",
        "title": "Page not found",
        "description": "The page you are looking for does not exist.",
        "actionLabel": "Go home",
        "actionHref": "/"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | The headline (required, e.g. "Page not found"). Short — the leading message on an otherwise empty screen. |
| `code` | `string` | Large status code shown above the title (e.g. "404", "403"). |
| `description` | `string` | Supporting copy explaining what is missing / what to do next. |
| `icon` | `string` | Illustrative glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "search", "alert-circle"). Never raw SVG; unknown names render nothing. |
| `actionLabel` | `string` | Label for an optional call-to-action (e.g. "Go home"). Omit for no action. |
| `actionHref` | `string` | Make the action a navigable link; omit to make it a button that emits `commit`. Only used when `actionLabel` is set. |
| `actionExternal` | `boolean` | When `actionHref` is set, open the link in a new tab (adds target=_blank + rel=noopener noreferrer). Default false — same-tab navigation. Only used with `actionHref`. |
| `align` | `"center" \| "start"` | Content alignment: center (default — classic centered 404) · start (left-aligned). |
| `bg` | `string` | Panel background fill (default transparent/the page surface). Set to brand the not-found panel. |
| `color` | `string` | Primary text colour — the title (default the foreground token). Pair with a custom `bg` so the title stays legible. |
| `mutedColor` | `string` | Secondary/muted text colour — the large status code, the description copy, and the illustrative icon glyph (default the muted-foreground token). |
| `accent` | `string` | Background fill of the call-to-action button — its label always prints in the card token, so pick a value dark enough to carry that ink (default the foreground token). Completes the panel brand group with `bg` + `color`. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole not-found panel; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the title (default semibold). Reach for `bold` for a heavier headline or `medium` for a lighter one. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the title (default normal). Use `tight`/`tighter` to condense the headline or `wide` for an airier look. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the title (default normal). Bump to `relaxed` when the title wraps to multiple lines. |
| `fontSize` | `string \| number` | Exact font size of the title (e.g. "28px" / "1.75rem"). Default 1.375rem. |

## Events

### commit

The call-to-action button was pressed (no `actionHref` set); params carry {label} — the action label.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
