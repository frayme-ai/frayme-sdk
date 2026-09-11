# NumberInput

Numeric field with −/+ step buttons that clamp to [min,max]. Reach for it over a bare Input when the value is a quantity (qty, age, price) the user nudges. Use { $bindState } on value for two-way binding; the buttons disable at the bounds.

## Example

```json
{
  "root": "number-input",
  "elements": {
    "number-input": {
      "type": "NumberInput",
      "props": {
        "value": 1,
        "min": 0,
        "max": 10,
        "prefix": "£"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `number` | Current numeric value. Use { $bindState } for two-way binding. |
| `min` | `number` | Lower bound; the − button + typed values clamp to this (omit for no minimum). |
| `max` | `number` | Upper bound; the + button + typed values clamp to this (omit for no maximum). |
| `step` | `number` | Increment applied by the −/+ buttons (default 1; e.g. 0.5 for half-steps). |
| `placeholder` | `string` | Empty-state hint text shown when there is no value. |
| `prefix` | `string` | Leading unit shown inside the field (e.g. "£", "$"). |
| `suffix` | `string` | Trailing unit shown inside the field (e.g. "kg", "%"). |
| `size` | `"sm" \| "md" \| "lg"` | Control height/font-size/padding token (default `md`); use `sm` in dense filter rows, `lg` for touch or roomy forms. |
| `disabled` | `boolean` | Grey out (60% opacity, not-allowed cursor) and block typing plus both −/+ step buttons (default false). Set for read-only or gated quantities. |
| `accent` | `string` | Focus-ring colour when the field is active (default the primary token; bindable safeColor). Set to match a branded form or a custom `bg`. |
| `borderColor` | `string` | Resting border colour of the field box (default the border token; bindable safeColor). Set to emphasise the field or pair with a custom `bg`. |
| `bg` | `string` | Field background colour (default the card token; bindable safeColor). Set on tinted surfaces; pair a dark `bg` with `color` for a readable value. |
| `color` | `string` | Entered-value text colour of the number readout (default inherits the ambient foreground). Set it when a dark custom `bg` needs a readable light value. |
| `mutedColor` | `string` | Secondary/muted text colour — the inline prefix/suffix unit annotations, the −/+ step-button glyphs, and the empty-state placeholder (default the muted-foreground token). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |

## Events

### change

A step button was clicked or the field was typed into (clamped to [min,max]); params carry { value } (null when the field is cleared). Only fires when emitOnChange !== false.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
