# DatePicker

Single-date picker: a bordered field button (formatted value or placeholder + a leading calendar icon) that opens a month grid on demand. Click a day to set value and emit change; days outside min/max are disabled. Set mode:"inline" to keep the grid permanently visible. Use { $bindState } on value for two-way binding.

## Example

```json
{
  "root": "date-picker",
  "elements": {
    "date-picker": {
      "type": "DatePicker",
      "props": {
        "placeholder": "Pick a date",
        "format": "long"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `string` | Selected date as ISO 'YYYY-MM-DD'. Use { $bindState } for two-way binding; seeds the open month. |
| `placeholder` | `string` | Empty-state field text shown when no date is chosen (e.g. "Pick a date"). |
| `min` | `string` | Earliest selectable date as ISO 'YYYY-MM-DD'; days before it are muted + disabled. |
| `max` | `string` | Latest selectable date as ISO 'YYYY-MM-DD'; days after it are muted + disabled. |
| `size` | `"sm" \| "md" \| "lg"` | Field/grid height/font-size/padding token (default `md`); use `sm` in dense forms, `lg` for touch or roomy layouts. |
| `disabled` | `boolean` | Grey out the field (60% opacity, not-allowed cursor) and hide the inline calendar panel entirely (default false). |
| `format` | `"iso" \| "long" \| "short"` | How the chosen date renders in the field: iso (2026-06-25) · long (June 25, 2026, default) · short (Jun 25). |
| `mode` | `"popover" \| "inline"` | Whether the month grid opens on demand from the field (default `popover` — the field is a real button; opens on click/Enter/Space/ArrowDown, closes on pick/Escape/outside-click) or is permanently visible below the field (`inline`). Reach for `inline` only when the month itself is the point of the screen (a booking calendar, an availability view) — otherwise the grid eats vertical space for a field the user may not touch. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |
| `accent` | `string` | Selected-day fill, focus rings (day cells + month chevrons), and the day-cell/chevron hover wash when set (default primary token). Does NOT tint the field calendar icon — that follows `mutedColor`. |
| `accentText` | `string` | Text color of the selected day, paired with `accent` (default the primary-foreground token). Set when a light/custom accent needs dark text. |
| `borderColor` | `string` | Resting border colour of the field box AND the inline calendar panel (default the border token). |
| `bg` | `string` | Field + calendar background color (default card token). |
| `mutedColor` | `string` | Secondary/muted text colour — the field calendar icon, the weekday header labels, the empty-state placeholder text, the resting prev/next month chevrons, AND the resting out-of-range/disabled day numbers (default the muted-foreground token). |
| `color` | `string` | Base text colour — the regular day numbers, the month title, the chevron hover colour, AND the chosen value shown in the field (default the foreground token). Muted/disabled days keep `mutedColor`; the selected day keeps `accentText`. |
| `radiusValue` | `string \| number` | Exact corner rounding of the field, the calendar panel, AND the day cells (e.g. "0.5rem", "12px"; default the frayme radius token). |
| `monthNames` | `string[]` | i18n: the 12 full month names in calendar order (Jan→Dec), used in the header title + the formatted field value. Escaped text; ignored unless exactly 12 entries (default English). |
| `weekdayLabels` | `string[]` | i18n: the 7 weekday header labels starting Monday (the grid week-start), e.g. ["Lun","Mar","Mer",…]. Escaped text; ignored unless exactly 7 entries (default English). |

## Events

### select

A day cell inside min/max was clicked — a deliberate date selection; params carry { value } (the picked date, ISO YYYY-MM-DD). Fires on EVERY pick (a discrete choice — never gated by emitOnChange). `commit` is accepted as an alias and binds to this same event.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### change

A day cell inside min/max was clicked; params carry { value } (the picked date, ISO YYYY-MM-DD). Only fires when emitOnChange !== false; when false the value still lands in (bindable) state.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### Aliases

- `commit` is accepted on `DatePicker` as an alias of `select`: `on.commit` binds to the same interaction and payload as `on.select`.

See [Events](../../events.md) for the full payload contract.
