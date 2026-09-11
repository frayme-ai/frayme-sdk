# PhoneInput

Phone-number field with a country dial-code prefix select and a tel input (renders the raw national-number digits — no reformatting or validation service, so the caret stays stable on mid-string edits). Two-way bound on `value`. Bind `value`, `country` with `{ $bindState }` so the agent (or a sibling control) can read the national-number digits and the selected country code from spec.state.

## Example

```json
{
  "root": "phone-input",
  "elements": {
    "phone-input": {
      "type": "PhoneInput",
      "props": {
        "label": "Phone",
        "country": "GB",
        "placeholder": "7700 900000"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `string` | The national number digits. Use { $bindState } for two-way binding. |
| `countries` | `({ code: string, dial: string, flag: string })[]` | Country dial-code options; each is { code, dial, flag? }. Omit for a sensible built-in list. |
| `country` | `string` | Selected country code (e.g. "GB"); defaults to the first option. Use { $bindState } for two-way binding so an external Submit can read the full phone value (number + dial-code). |
| `placeholder` | `string` | Empty-input hint text for the number field (e.g. "7700 900000"). |
| `accent` | `string` | Focus-ring color of the field (default primary token). |
| `bg` | `string` | Field background fill behind both the dial-code select and the number input (default the card token; bindable). Set a tinted value to lift the field off a matching card surface. |
| `borderColor` | `string` | Field + dial-code-divider border colour (default the border token). |
| `mutedColor` | `string` | Secondary/muted text colour — the number field’s placeholder text (default the muted-foreground token). |
| `radiusValue` | `string \| number` | Exact corner rounding of the field (e.g. "12px" / "1rem"; default the frayme radius token, overriding the size-derived default). |
| `size` | `"sm" \| "md" \| "lg"` | Control height, font size and padding: `sm` · `md` (default) · `lg`. Reach for `sm` in a dense form row, `lg` for a prominent standalone phone field. |
| `label` | `string` | Field label shown above the input. Keep short (1-3 words), e.g. "Phone". |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the field label (default medium); set to dial the emphasis up or down. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption. |
| `disabled` | `boolean` | Grey out the field (60% opacity, not-allowed cursor) and block the dial-code select and the number field (default false). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |

## Events

### change

The number field was typed into (digits only, stripped of non-numeric chars) or the dial-code select changed; params carry { value } and, from the select, also { country }. Only fires when `emitOnChange` !== false — otherwise the number + country live in bindable state for an external Button to read.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
