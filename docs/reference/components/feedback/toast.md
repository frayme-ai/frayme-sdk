# Toast

Transient corner notification. Bind `openPath` to a boolean state-path; the toast renders only while truthy and dismisses by setting it false (manually via the ×, or automatically after `duration` when set, default sticky, no auto-dismiss). `tone` colors it + picks the auto icon. Reach for Toast over Banner when the notice is transient/dismissable and docked to a screen corner rather than pinned at the top of the page.

## Example

```json
{
  "root": "toast",
  "elements": {
    "toast": {
      "type": "Toast",
      "props": {
        "title": "Saved",
        "message": "Your changes are live.",
        "openPath": "toastOpen",
        "tone": "success"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Toast headline (required, e.g. "Saved"). Short, a few words; the toast is a transient corner notification, not a place for detail. |
| `message` | `string` | Optional one-line supporting detail under the title (e.g. "Your changes are live."). Omit for a title-only toast. |
| `openPath` | `string` | Boolean state-path that shows the toast (exactly like Dialog.openPath). When the path is falsy the toast renders nothing; setState toggles it. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent: neutral (default) · success (saved/done) · warning · critical (error) · info. Drives the accent colour: the auto icon + the left accent bar (the bar shows for any non-neutral tone on subtle/outline; solid is already the tone fill). |
| `position` | `"top-right" \| "top-left" \| "bottom-right" \| "bottom-left" \| "top-center" \| "bottom-center"` | Fixed screen corner the toast docks to (a closed enum → a trusted position:fixed recipe). Default bottom-right. |
| `variant` | `"solid" \| "subtle" \| "outline"` | Fill intensity: solid (high-contrast tone surface) · subtle (plain card surface with a tone-colored icon, the background is not tinted; default) · outline. |
| `duration` | `"short" \| "normal" \| "long" \| "sticky"` | Auto-dismiss delay (a closed timing enum, never a raw ms value): short (3s) · normal (5s) · long (8s) · sticky (default, no auto-dismiss, persists until the host flips openPath). When a timed value elapses the toast sets openPath false and emits dismiss with { auto: true }. |
| `dismissible` | `boolean` | Show an × that sets the openPath false (default true). |
| `dismissLabel` | `string` | Accessible label (aria-label) for the dismiss button (default "Dismiss"). Escaped text, set for localization. |
| `dismissIcon` | `string` | Glyph NAME (closed icon registry) for the dismiss button (default "x"). Unknown/absent → the default glyph; never raw SVG. |
| `icon` | `"auto" \| "none"` | Leading status icon: auto (picks a glyph from `tone`, default) · none. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole toast region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Title font weight (default semibold); a closed enum that overrides the baked weight when set. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the toast title (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Title line-height (default snug); a closed enum that overrides the baked leading when set. |
| `fontSize` | `string \| number` | Exact font size of the toast title (e.g. "20px" / "1.25rem"). Default 0.9375rem. |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow depth of the floating toast: none · sm · md · lg · xl; a closed enum that overrides the baked shadow when set. |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for this toast as it appears (fast/normal/slow). Default: no animation, appears instantly. |
| `bg` | `string` | Custom background fill (overrides the tone/variant surface). Reach for a brand-colored toast. |
| `borderColor` | `string` | Border colour (default the border token). Pair with a custom `bg` to give the toast a matching branded edge. |
| `accent` | `string` | Text colour of the leading status icon glyph, and the colour of the 3px left accent bar beside it (overrides the tone colour; setting it always shows the bar). |

## Events

### dismiss

The toast was dismissed, the × was pressed (only when `dismissible` is on) OR the `duration` timer elapsed (auto-dismiss); both set `openPath` false. Params carry {label} (the toast title) and, on an auto-dismiss, { auto: true }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
