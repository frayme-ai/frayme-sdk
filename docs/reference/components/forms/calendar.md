# Calendar

Standalone month calendar: a header (month name + prev/next chevrons), weekday labels, and a day grid. Days with events show up to three tone-colored dots (a 4th muted dot signals >3) and an event-count aria-label; the `today` date gets an inset accent ring; when selectable, days are buttons that set value and emit select + change. Use { $bindState } on value.

## Example

```json
{
  "root": "calendar",
  "elements": {
    "calendar": {
      "type": "Calendar",
      "props": {
        "month": "2026-06",
        "events": [
          {
            "date": "2026-06-25",
            "label": "Launch",
            "tone": "success"
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
| `month` | `string` | Displayed month as 'YYYY-MM' (default a sensible constant month); prev/next chevrons page it. Use { $bindState } for two-way binding, the shown month is a bindable value written back to spec.state on paging so an external control can read it. |
| `value` | `string` | Selected day as ISO 'YYYY-MM-DD'. Use { $bindState } for two-way binding. |
| `today` | `string` | The date to mark as 'today' as ISO 'YYYY-MM-DD' (default none, nothing marked). Rendered as an inset accent ring on the matching cell; the selected-day fill wins when a day is both today AND selected. Supply it explicitly, the calendar never reads the wall clock (deterministic render). |
| `events` | `({ date: string, label: string, tone: "neutral" \| "success" \| "warning" \| "critical" \| "info", color: string })[]` | Events to dot onto day cells (up to 3 tone-colored dots per day, plus a 4th muted "+more" dot when a day has more than 3; each event may set an exact dot `color`). |
| `view` | `"month"` | Calendar view granularity (default `month`, the only value supported for now); a forward-compat enum kept for future week/day views. Leave unset. |
| `selectable` | `boolean` | Whether days are clickable buttons that set value (default true). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |
| `weekStartsOn` | `"sunday" \| "monday"` | First column weekday of the grid (default monday); also reorders the default `weekdayLabels` fallback to match. |
| `accent` | `string` | Selected-day fill color, focus rings (day cells + month chevrons), and the day-cell/chevron hover wash when set (default primary token). |
| `accentText` | `string` | Text color of the selected day, paired with `accent` (default the primary-foreground token). Set when a light/custom accent needs dark text. |
| `borderColor` | `string` | Resting panel border color (default border token). |
| `bg` | `string` | Calendar panel background color (default card token). |
| `mutedColor` | `string` | Secondary/muted text colour, the weekday header labels AND the resting prev/next month chevrons (default the muted-foreground token). |
| `color` | `string` | Base text colour, the regular day numbers, the month title, and the chevron hover colour (default the foreground token). The selected day keeps `accentText`. |
| `radiusValue` | `string \| number` | Exact corner rounding of the panel AND the day cells (e.g. "0.5rem", "12px"; default the frayme radius token). |
| `monthNames` | `string[]` | i18n: the 12 full month names in calendar order (Jan→Dec), used in the header title. Escaped text; ignored unless exactly 12 entries (default English). |
| `weekdayLabels` | `string[]` | i18n: the 7 weekday header labels in the SAME order as `weekStartsOn` (Monday-first by default, Sunday-first when weekStartsOn="sunday"). Escaped text; ignored unless exactly 7 entries (default English). |
| `size` | `"sm" \| "md" \| "lg"` | Day-cell size + grid font-size token (default `md`); use `sm` for a compact side-panel calendar, `lg` for touch or a prominent standalone month. |

## Events

### change

A day cell was clicked (selectable only); fires alongside select on the same click; params carry { value } (the picked date, ISO YYYY-MM-DD). Only fires when emitOnChange !== false; select (and the bindable value state) still fire regardless.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### select

A day cell was clicked (selectable only); fires alongside change on the same click; params carry { value } (the picked date, ISO YYYY-MM-DD).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
