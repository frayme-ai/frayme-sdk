# Confirmation

An inline human-in-the-loop gate: a message + an Approve button (emits `commit`) and a Deny button (emits `dismiss`). Use to pause an agent for explicit approval before a consequential action. Bind `decision` with `{ $bindState }` so the agent (or a sibling control) can read the user's verdict ("approved" / "denied", null until answered) from spec.state.

## Example

```json
{
  "root": "confirmation",
  "elements": {
    "confirmation": {
      "type": "Confirmation",
      "props": {
        "message": "Delete 3 files from the project?",
        "confirmLabel": "Delete",
        "tone": "critical"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `message` | `string` | The question / action to approve, shown above the two buttons (e.g. "Send this email to 12 recipients?"). |
| `confirmLabel` | `string` | Label for the primary approve button (default "Approve"). |
| `denyLabel` | `string` | Label for the secondary deny button (default "Deny"). |
| `cancelLabel` | `string` | Accepted alias of `denyLabel` for the secondary deny button — the shared `confirm:{…}` block and DataTable's row editor both spell this button `cancelLabel`, so it is honoured here too. `denyLabel` is the canonical name and wins when both are set. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color of the confirm button (default neutral → primary). Use `critical` for destructive actions, `success` for safe ones. |
| `bg` | `string` | Background fill of the confirmation card surface (default card token). |
| `color` | `string` | On-surface text colour — the confirmation `message` AND the Deny button label — pair it with a custom `bg` so the gate stays legible over a saturated fill (defaults: the foreground token for the message, muted-foreground for Deny). |
| `borderColor` | `string` | Border colour of the confirmation card (default the border token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Card border line style: solid (default) · dashed · dotted. |
| `borderWidthValue` | `string \| number` | Exact card border thickness (e.g. "2px"; default 1px). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow elevation of the confirmation card: none · sm · md · lg · xl. Raise it to make the approval gate float above the transcript (default flat). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole confirmation region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the confirmation `message` (light · normal · medium · semibold · bold; default normal). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the confirmation `message` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the confirmation `message` (tight · snug · normal · relaxed · loose; default normal). |
| `fontSize` | `string \| number` | Exact font size of the confirmation `message` (e.g. "20px" / "1.25rem"). Default 0.875rem. |
| `decision` | `"approved" \| "denied"` | The user's verdict once the gate is answered — "approved" after the confirm button, "denied" after the deny button; null until answered. Bind with { $bindState } so an external element (e.g. a sibling Button) can read whether Approve or Deny was pressed; the renderer writes it into spec.state before emitting commit/dismiss. |

## Events

### commit

The approve button (`confirmLabel`, default "Approve") was clicked; params carry {label} with that button's text.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### dismiss

The deny button (`denyLabel`, default "Deny") was clicked; params carry {label} with that button's text.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
