# Alert

Inline status banner with a leading SVG status icon (from the closed registry, info/check-circle/alert-triangle/alert-circle by status, or any registry name via `icon`), `title`, and optional `message`. Choose Alert over Banner for page/section-level feedback tied to a specific action (form errors, save confirmations) and over Callout for transient status rather than an evergreen tip. `type` (info/success/warning/error) is the legacy channel; `tone` is the unified one. When `dismissible`, the × hides it locally and emits `dismiss`. Bind `dismissed` with { $bindState } so the agent (or a sibling control) can read whether the alert has been closed from spec.state.

## Example

```json
{
  "root": "alert",
  "elements": {
    "alert": {
      "type": "Alert",
      "props": {
        "title": "Note",
        "message": "Your changes have been saved.",
        "type": "success"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Bold headline of the alert. Keep to a short phrase ("Changes saved", "Payment failed"), the `message` carries the detail. |
| `message` | `string` | Muted body line under the `title` giving the detail/next step (default none, title-only alert). One or two short sentences; longer explanations belong in a Card. |
| `type` | `"info" \| "success" \| "warning" \| "error"` | Legacy semantic channel driving the default icon + color (default info). Prefer `tone` (success/warning/critical/info) going forward, `critical` maps to the same visual as `error`. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent (decoupled from variant): neutral · success · warning · critical · info |
| `variant` | `"subtle" \| "solid" \| "outline"` | Fill intensity: subtle (tinted, default) · solid (high-contrast) · outline. |
| `size` | `"sm" \| "md" \| "lg"` | Padding + font size of the title/message (default md). |
| `align` | `"left" \| "center"` | Content alignment of the icon + title/message block (default left). |
| `icon` | `string` | Leading status icon rendered as a 16px SVG from the closed registry. Special values: "auto" (derive the status glyph from type/tone, default) · "none" (no icon) · one of the status keywords "info"/"success"/"warning"/"error" (its status glyph). Any OTHER value is treated as a registry icon NAME (e.g. "bell", "shield") and rendered directly; an unknown name falls back to the status glyph. Never raw SVG. |
| `dismissible` | `boolean` | Show a close (×) button that hides the alert on click (also emits `dismiss`). |
| `dismissed` | `boolean` | Whether the alert has been closed; written back here on dismiss. Bind with { $bindState } to read/persist the closed state so a Button/agent knows the alert was hidden. |
| `dismissLabel` | `string` | Accessible label for the dismiss (×) button (default "Dismiss"). Escaped text, set for i18n/localized affordances. |
| `dismissIcon` | `string` | Glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) for the dismiss affordance (default the literal "×"). Unknown/absent names keep the × char. Never raw SVG. |
| `accentBar` | `boolean` | Show a leading 3px vertical accent bar down the alert's left edge, coloured by `accent` (default false = no bar). Turn it on to give the banner a stronger status stripe. |
| `bg` | `string` | Exact background fill (brand/announcement banner). Wins over tone/type. |
| `borderColor` | `string` | Exact border colour of the alert box, naming a specific edge colour; wins over the `tone`/`type` token. Set it to tint the outline to match a custom `bg`. |
| `accent` | `string` | Ink colour of the leading status icon, the glyph is drawn ON the alert surface, so treat it like text colour, never as a fill, and of the optional `accentBar` stripe down the left edge. Default follows the semantic `tone`/`type` token (success/warning/critical/info); on the neutral `type:info` the icon inherits the alert text colour and the bar uses the foreground token; on `variant:solid` both follow the on-fill text. An explicit value wins everywhere. |
| `accentText` | `string` | On-fill text colour for the title/message, set with `variant:solid` (or a custom `bg`) so text stays legible over a saturated fill (default the on-primary token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole alert region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the alert `title` (light · normal · medium · semibold · bold; default semibold). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the alert `title` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the alert `title` (tight · snug · normal · relaxed · loose; default the title default). |
| `fontSize` | `string \| number` | Exact font size of the alert `title` (e.g. "18px" / "1.125rem"). Default 0.9375rem. |

## Events

### dismiss

The × close button was clicked; the alert hides itself locally and `label` carries the `title`.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
