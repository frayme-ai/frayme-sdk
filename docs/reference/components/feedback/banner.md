# Banner

A full-width, page-level notice bar: leading status icon + optional title + message, with an optional trailing action and a dismiss ×. `tone` colors it by intent; set `dismissible` for a × that hides it and emits `dismiss`. The action renders an &lt;a> when `actionHref` is set, else a button that emits `commit`. Place at the top of a page/section, reach for Callout instead for an in-content note, or Toast for a transient auto-dismissing corner notification. Bind `dismissed` with `{ $bindState }` so the agent (or a sibling control) can read whether the banner has been closed from spec.state.

## Example

```json
{
  "root": "banner",
  "elements": {
    "banner": {
      "type": "Banner",
      "props": {
        "message": "Scheduled maintenance this Sunday 02:00-04:00 UTC.",
        "tone": "warning",
        "dismissible": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `message` | `string` | The notice body (required). One sentence, the banner is a single-line strip, so keep it short enough to read at a glance. |
| `title` | `string` | Optional bold lead line above the `message` (e.g. "Maintenance scheduled"). Rendered at the `weight` semibold default; omit for a message-only strip. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color of the banner via token (default neutral). Use `critical` for outages, `success` for confirmations, `info` for a blue informational tint. |
| `icon` | `string` | Leading status glyph: "auto" (derive from tone), "none" (hide), or a NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "info", "alert-triangle"). Never raw SVG; unknown names render nothing. |
| `actionLabel` | `string` | Label for an optional trailing call-to-action. Omit for a plain notice. |
| `actionHref` | `string` | Make the action a navigable link; omit to make it a button that emits `commit`. Only used when `actionLabel` is set. |
| `actionExternal` | `boolean` | When `actionHref` is set: open in a new tab (target=_blank + rel=noopener noreferrer). |
| `dismissible` | `boolean` | Show a trailing × that hides the banner and emits `dismiss`. Reach for this on dismissable announcements. |
| `dismissed` | `boolean` | Whether the banner has been closed; the component writes true here on dismiss so the closed state is readable from spec.state without replaying the dismiss event. Bind with { $bindState } to read/persist it, or seed true to start hidden. |
| `dismissLabel` | `string` | Accessible label for the dismiss × button (default "Dismiss"). Set for localisation. Only used when `dismissible` is on. |
| `dismissIcon` | `string` | Glyph NAME (closed icon registry) for the dismiss affordance (default "x"). Unknown/absent names fall back to the default ×. Never raw SVG. |
| `align` | `"start" \| "center"` | Content alignment across the full width: start (left, default) · center (centered announcement bar). |
| `bg` | `string` | Exact background fill (brand banner). Wins over tone. Flips the whole surface on-fill: the copy reads `color` and the icon + action follow it unless an explicit `accent` is set, pair with `color` (+ optionally `accent`) to brand the surface. |
| `borderColor` | `string` | Border colour (default the tone/border token). Pair with a custom `bg` to brand the whole surface. |
| `accent` | `string` | Text colour of the leading status icon and of the trailing action label, the action's outline follows it via currentColor (default the tone token; on a custom `bg` both follow the on-fill text unless this is set). |
| `color` | `string` | Text colour of the banner title + message copy. On a custom `bg` the ink is derived from that fill's luminance unless set; on the plain tone surface (no `bg`) it recolours the copy over the inherited foreground. Set independently of `bg`, a text-only recolour is supported. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole banner region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the title + message text (default semibold title, normal message). Set to override the baked weight. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the title + message text (default normal). Use `tight` to condense or `wide` for an airier announcement bar. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the title + message text (default snug). Bump to `normal`/`relaxed` when the message wraps to multiple lines. |
| `fontSize` | `string \| number` | Exact font size of the banner title (e.g. "20px" / "1.25rem"). Default 0.9375rem. |

## Events

### commit

The trailing action button was pressed (no `actionHref` set); params carry {label}, the action label.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### dismiss

The × was pressed (self-hides, `dismissible` must be on); params carry {label}, the banner title, if set.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
