# DateRangePicker

Date-range picker: a field button showing "start – end" that opens a month grid on demand, where days between the endpoints get a subtle range fill and the two endpoints the accent fill, alongside a column of quick-range presets. First day click sets start (clears end), second sets end (swapping if earlier) and closes. Set mode:"inline" to keep the grid permanently visible. Use { $bindState } on startValue/endValue.

## Example

```json
{
  "root": "date-range-picker",
  "elements": {
    "date-range-picker": {
      "type": "DateRangePicker",
      "props": {
        "presets": [
          {
            "label": "Last 7 days",
            "start": "2026-06-19",
            "end": "2026-06-25"
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
| `startValue` | `string` | Range start as ISO 'YYYY-MM-DD'. Use { $bindState } for two-way binding. |
| `endValue` | `string` | Range end as ISO 'YYYY-MM-DD'. Use { $bindState } for two-way binding. |
| `presets` | `({ label: string, start: string, end: string })[]` | Quick-range buttons that set both ends at once (e.g. Today · Last 7 days · This month). |
| `min` | `string` | Earliest selectable date as ISO 'YYYY-MM-DD'; earlier days are muted + disabled. |
| `max` | `string` | Latest selectable date as ISO 'YYYY-MM-DD'; later days are muted + disabled. |
| `size` | `"sm" \| "md" \| "lg"` | Field/grid height/font-size/padding token (default `md`); use `sm` in dense forms, `lg` for touch or roomy layouts. |
| `disabled` | `boolean` | Grey out the field (60% opacity, not-allowed cursor) and hide the calendar panel + presets entirely (default false). |
| `mode` | `"popover" \| "inline"` | Whether the presets + month grid open on demand from the field (default `popover` — the field is a real button; opens on click/Enter/Space/ArrowDown, closes when the range completes, on Escape, or on outside-click) or sit permanently below it (`inline`). Reach for `inline` only when picking the range IS the screen (a stay-dates booking step) — otherwise the grid eats vertical space for a field the user may not touch. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |
| `accent` | `string` | Range-endpoint fill (the start + end days), the translucent between-days wash, focus rings (day cells + chevrons + presets), and the hover wash when set (default primary token). Does NOT tint the field calendar icon — that follows `mutedColor`. |
| `accentText` | `string` | Text color of the selected range endpoints, paired with `accent` (default the primary-foreground token). |
| `borderColor` | `string` | Resting border colour of the field box, the inline calendar panel, AND the quick-range preset buttons (default the border token). |
| `bg` | `string` | Field + calendar background color (default card token); a set value also fills the quick-range preset buttons (default transparent). |
| `mutedColor` | `string` | Secondary/muted text colour — the field calendar icon, the weekday header labels, the empty-state placeholder text, the resting prev/next month chevrons, AND the resting out-of-range/disabled day numbers (default the muted-foreground token). |
| `color` | `string` | Base text colour — the regular day numbers, the month title, the quick-range preset labels, the chevron hover colour, AND the chosen value shown in the field (default the foreground token). Muted/disabled days keep `mutedColor`; the selected day keeps `accentText`. |
| `radiusValue` | `string \| number` | Exact corner rounding of the field, the calendar panel, the day cells, AND the quick-range preset buttons (e.g. "0.5rem", "12px"; default the frayme radius token). |
| `monthNames` | `string[]` | i18n: the 12 full month names in calendar order (Jan→Dec), used in the grid header title. Escaped text; ignored unless exactly 12 entries (default English). |
| `weekdayLabels` | `string[]` | i18n: the 7 weekday header labels starting Monday (the grid week-start), e.g. ["Lun","Mar","Mer",…]. Escaped text; ignored unless exactly 7 entries (default English). |

## Events

### select

A day cell or a preset was clicked — a deliberate range selection; params carry { startValue, endValue } (endValue is null between the first and second click). Fires on EVERY pick (never gated by emitOnChange). `commit` is accepted as an alias and binds to this same event.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### change

A day cell was clicked (advancing start/end) or a preset button was picked; params carry { startValue, endValue } (endValue is null between the first and second click). Only fires when emitOnChange !== false; when false both endpoints still land in (bindable) state.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### Aliases

- `commit` is accepted on `DateRangePicker` as an alias of `select`: `on.commit` binds to the same interaction and payload as `on.select`.

See [Events](../../events.md) for the full payload contract.
