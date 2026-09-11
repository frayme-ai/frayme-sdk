# Result

A full-region outcome screen: a big tone-colored status icon driven by `status` (success/error/warning/info/pending), a title + description, and an optional row of actions. The status is conveyed by icon + color + text (never color alone). Use after a completed operation (payment, submission, deploy) to show the result — reach for NotFound instead for a missing route/resource, not the outcome of a completed action. Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which action label (or index) the user triggered from spec.state.

## Example

```json
{
  "root": "result",
  "elements": {
    "result": {
      "type": "Result",
      "props": {
        "status": "success",
        "title": "Payment successful",
        "description": "Your order is confirmed.",
        "actions": [
          {
            "label": "View order"
          }
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | The outcome headline (required, e.g. "Payment successful"). Short — states the result plainly, paired with the status icon/color. |
| `status` | `"success" \| "error" \| "warning" \| "info" \| "pending"` | Outcome that drives a big tone-colored status icon (default info): success (check) · error (alert) · warning · info · pending (spinner). Pick by the result of the operation. |
| `description` | `string` | Supporting copy under the title explaining the outcome / next steps. |
| `icon` | `string` | Override the auto status glyph with a NAME from the closed icon registry (or a single emoji glyph, rendered as-is). Omit to derive it from `status`. Never raw SVG; unknown names render nothing. |
| `actions` | `({ label: string, href: string, external: boolean, variant: "primary" \| "secondary" })[]` | Optional list of outcome actions (e.g. "View order", "Go back"). Each renders an &lt;a> when `href` is set, else a button that emits `commit`. |
| `activeAction` | `string` | Write target for WHICH action the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting `commit`, so the host can attribute the action. Emit-only when unbound. |
| `align` | `"center" \| "start"` | Content alignment: center (default — classic outcome screen) · start (left-aligned). |
| `bg` | `string` | Panel background fill (default transparent/the page surface). Set to brand the outcome screen. |
| `color` | `string` | Primary text colour — the title + secondary action text (default the foreground token). Pair with a custom `bg` so the copy stays legible. |
| `mutedColor` | `string` | Secondary/muted text colour — the description copy under the title (default the muted-foreground token). |
| `accent` | `string` | Background fill of the primary action button(s) — the label always prints in the card token, so pick a value dark enough to carry that ink (default the foreground token). Completes the panel brand group with `bg` + `color`. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole outcome screen; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the title (default semibold). Reach for `bold` for a heavier outcome headline or `medium` for a lighter one. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the title (default normal). Use `tight`/`tighter` to condense the headline or `wide` for an airier look. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the title (default tight). Bump to `snug`/`normal` when the title wraps to multiple lines. |
| `fontSize` | `string \| number` | Exact font size of the title (e.g. "32px" / "2rem"). Default 1.5rem. |

## Events

### commit

An action button without an `href` was pressed; params carry {label, index} — the pressed button's label and its position in `actions`. `activeAction` (when bound) is written first so the host can attribute which button fired.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
