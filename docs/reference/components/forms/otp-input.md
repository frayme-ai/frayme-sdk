# OTPInput

Segmented one-time-code entry: a row of single-character boxes. Typing routes characters into the code (respecting pattern + length); emits change on each edit and commit when the code fills. Use { $bindState } on value for two-way binding.

## Example

```json
{
  "root": "otp-input",
  "elements": {
    "otp-input": {
      "type": "OTPInput",
      "props": {
        "length": 6,
        "pattern": "numeric"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `length` | `number` | Number of segments / code length (default 6; clamped 2..12). |
| `value` | `string` | Current code string. Use { $bindState } for two-way binding. |
| `mask` | `boolean` | Show filled segments as dots (•) instead of the typed characters (for secret codes). |
| `pattern` | `"numeric" \| "alphanumeric"` | Allowed characters: numeric (digits only, default) or alphanumeric. |
| `size` | `"sm" \| "md" \| "lg"` | Segment box size in px (default md; sm=36×32, md=44×40, lg=56×48). |
| `label` | `string` | Field label shown above the segments (default none, a bare code row). Keep short (1-3 words), e.g. "Verification code". |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the field label (default medium); set to dial the emphasis up or down. No effect without `label`. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption. No effect without `label`. |
| `groupSize` | `number` | Insert a separator after every N boxes for grouped presentation (e.g. 3 for a 6-digit 3+3 code; default off = one continuous row). Inert when ≤0 or ≥ length. |
| `separator` | `string` | The character drawn between groups when `groupSize` is set (default "-"). Purely decorative. |
| `disabled` | `boolean` | Grey out every segment (60% opacity, not-allowed cursor) and block typing into any box (default false). |
| `accent` | `string` | Focused/next-segment ring + border color (default primary token). |
| `borderColor` | `string` | Resting segment border color (default border token). |
| `bg` | `string` | Background colour of each segment box (default the card token; bindable safeColor). Set on tinted surfaces; pair a dark `bg` with `color` to keep the typed characters legible. |
| `color` | `string` | Entered-character text colour inside each segment, and the group separator glyph (default the foreground token). Set it when a dark custom `bg` needs a readable light character. |
| `radiusValue` | `string \| number` | Exact corner rounding of each segment box (e.g. "12px" / "1rem"; default the frayme radius token, overriding the size-derived default). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |

## Events

### change

A segment was typed into or backspaced; params carry { value } (the full code string so far). Only fires when emitOnChange !== false.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

The code just became fully filled (fires once on the fill transition, not on later edits of a full code); params carry { value } (the complete code).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
