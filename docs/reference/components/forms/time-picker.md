# TimePicker

Time-of-day field built on a native time input (SSR-safe, accessible) with a leading clock icon. `minuteStep` sets granularity; two-way bound on `value`. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the selected "HH:MM" 24h time from spec.state.

## Example

```json
{
  "root": "time-picker",
  "elements": {
    "time-picker": {
      "type": "TimePicker",
      "props": {
        "label": "Start time",
        "value": "09:30",
        "minuteStep": 15
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `string` | Selected time as "HH:MM" (24h). Use { $bindState } for two-way binding. The clock face (12h AM/PM vs 24h) follows the user’s locale, it is not spec-controllable. |
| `minuteStep` | `number` | Minute granularity of the picker (default 1; e.g. 15 for quarter-hours). |
| `accent` | `string` | Focus-ring color (default the primary token) and clock-icon tint (default the muted-foreground token). |
| `bg` | `string` | Field background fill (default the card token; bindable). Set a tinted value to lift the field off a matching card, or leave default to blend into the surface. |
| `borderColor` | `string` | Field border colour (default the border token; bindable). Set a brand/accent value to draw attention or an error red to flag an invalid time. |
| `radiusValue` | `string \| number` | Exact corner rounding of the field (e.g. "12px" / "1rem"; default the frayme radius token, overriding the size-derived default). |
| `size` | `"sm" \| "md" \| "lg"` | Control height, font size and padding: `sm` · `md` (default) · `lg`. Reach for `sm` in a dense form row, `lg` for a prominent standalone time field. |
| `label` | `string` | Field label shown above the input. Keep short (1-3 words), e.g. "Start time". |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the field label (default medium); set to dial the emphasis up or down. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption. |
| `disabled` | `boolean` | Grey out the field (60% opacity, not-allowed cursor) and block editing the native time input (default false). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |

## Events

### change

The native time input was edited; params carry { value } (the new "HH:MM" 24h string). Only fires when `emitOnChange` !== false, otherwise the value lives in bindable state for an external Button to read.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
