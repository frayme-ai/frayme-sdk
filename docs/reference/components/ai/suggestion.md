# Suggestion

A tappable suggested-prompt chip-button that emits `commit` when clicked. Render several in a row/wrap under a chat to offer quick follow-up prompts. Reach for this when you want to nudge the user toward likely next questions instead of leaving the composer blank — a one-tap shortcut that skips typing. On click it emits `commit` with `{label}` carrying the chip text, which a host typically feeds straight into the PromptInput / send flow; add an `icon` glyph to hint the prompt category.

## Example

```json
{
  "root": "suggestion",
  "elements": {
    "suggestion": {
      "type": "Suggestion",
      "props": {
        "label": "Summarize this thread",
        "icon": "sparkles"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The suggested prompt text shown on the chip (e.g. "Summarize this thread"). |
| `icon` | `string` | Optional leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "sparkles", "search"). Never raw SVG; unknown names render nothing. |
| `size` | `"sm" \| "md"` | Chip padding + font size: sm (compact) · md (default). |
| `accent` | `string` | Resting border + leading-icon color (defaults: the border token for the border, muted-foreground for the icon). Hover and focus-ring styling are fixed (muted hover, primary ring) and unaffected. Names a brand color for the chip. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole suggestion chip; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the chip `label` (light · normal · medium · semibold · bold; default medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the chip `label` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the chip `label` (tight · snug · normal · relaxed · loose; default normal). |
| `fontSize` | `string \| number` | Exact font size of the chip `label` (e.g. "20px" / "1.25rem"). Overrides the `size` enum default (sm 0.8125rem · md 0.875rem). |

## Events

### commit

The chip was clicked; params carry {label} with the suggested prompt text — typically fed straight into the composer/send flow.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
