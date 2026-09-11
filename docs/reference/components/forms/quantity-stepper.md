# QuantityStepper

Compact −/+ quantity stepper with an editable numeric readout, clamped to [min,max]. Two-way bound on `value`. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the current quantity number from spec.state.

## Example

```json
{
  "root": "quantity-stepper",
  "elements": {
    "quantity-stepper": {
      "type": "QuantityStepper",
      "props": {
        "label": "Quantity",
        "value": 1,
        "min": 1,
        "max": 10
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `number` | Current quantity. Use { $bindState } for two-way binding (defaults to `min`). |
| `min` | `number` | Lower bound; the − button disables here (default 0). |
| `max` | `number` | Upper bound; the + button disables here (default 99). |
| `step` | `number` | Amount added or subtracted per −/+ press, clamped to [`min`,`max`] (default 1). Raise it for coarse counts (e.g. 5, 10, 100); use a decimal for fractional units. |
| `accent` | `string` | Active/hover color of the −/+ buttons (default primary token). |
| `bg` | `string` | Stepper background fill behind the buttons and readout (default the card token; bindable). Set a tinted value to lift it off a matching card surface. |
| `borderColor` | `string` | Stepper border + readout-divider colour (default the border token). |
| `radiusValue` | `string \| number` | Exact corner rounding of the stepper (e.g. "12px" / "1rem"; default the frayme radius token, overriding the size-derived default). |
| `size` | `"sm" \| "md" \| "lg"` | Control height + button + readout scale (default md). |
| `label` | `string` | Field label shown above the stepper. Keep short (1-3 words), e.g. "Quantity". |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the field label (default medium); set to dial the emphasis up or down. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption. |
| `disabled` | `boolean` | Grey out the whole control (60% opacity, not-allowed cursor) and block the readout and both −/+ buttons (default false). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |

## Events

### change

A step button was clicked or the readout was typed into (clamped to [min,max]); params carry { value }. Only fires when `emitOnChange` !== false — otherwise the value lives in bindable state for an external Button to read.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
