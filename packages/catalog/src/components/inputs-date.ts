/**
 * Frayme inputs-date — date inputs + a month-grid calendar built on the
 * established "truly-dynamic" foundation (matches forms-extended.ts byte-for-byte
 * in style).
 *
 * Three components sharing ONE deterministic month-grid surface in the renderer:
 * a single-date DatePicker, a start/end DateRangePicker with quick presets, and a
 * standalone Calendar with event dots. All dates are ISO 'YYYY-MM-DD' strings;
 * `month` is 'YYYY-MM'. The grid is computed purely from a year+month (no
 * Date.now()) so a props-less spec renders a stable, polished month.
 *
 * Channel legend (mirrors _shared.ts): E enum · C content · SC safeColor (VALUE)
 * · D dimension (VALUE). Every enum/value prop is `.nullable()` + `.describe()`
 * (one sentence naming WHEN to reach for it);
 * defaults live in the renderer's CVA `defaultVariants`, NOT here, so a
 * props-less spec still renders polished. Closed enums only — never z.string()
 * for a visual/behavioral selector. (min/max/month/value are ISO date STRINGS,
 * not gate value-channels, so they stay plain z.string().)
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

export const inputsDateComponents = {
  // =========================================================================
  // DatePicker — single-date field that reveals an inline month grid. Click a
  // day to set value + emit('change'); prev/next chevrons page the month.
  // =========================================================================
  DatePicker: {
    props: z.object({
      value: z
        .string()
        .nullable()
        .describe("Selected date as ISO 'YYYY-MM-DD'. Use { $bindState } for two-way binding; seeds the open month."),
      placeholder: z.string().nullable().describe('Empty-state field text shown when no date is chosen (e.g. "Pick a date").'),
      min: z.string().nullable().describe("Earliest selectable date as ISO 'YYYY-MM-DD'; days before it are muted + disabled."),
      max: z.string().nullable().describe("Latest selectable date as ISO 'YYYY-MM-DD'; days after it are muted + disabled."),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Field/grid height/font-size/padding token (default `md`); use `sm` in dense forms, `lg` for touch or roomy layouts.'),
      disabled: z.boolean().nullable().describe('Grey out the field (60% opacity, not-allowed cursor) and hide the inline calendar panel entirely (default false).'),
      format: z
        .enum(['iso', 'long', 'short'])
        .nullable()
        .describe('How the chosen date renders in the field: iso (2026-06-25) · long (June 25, 2026, default) · short (Jun 25).'),
      mode: z
        .enum(['popover', 'inline'])
        .nullable()
        .describe('Whether the month grid opens on demand from the field (default `popover` — the field is a real button; opens on click/Enter/Space/ArrowDown, closes on pick/Escape/outside-click) or is permanently visible below the field (`inline`). Reach for `inline` only when the month itself is the point of the screen (a booking calendar, an availability view) — otherwise the grid eats vertical space for a field the user may not touch.'),
      emitOnChange: z
        .boolean()
        .nullable()
        .describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      accent: colorSchema.describe('Selected-day fill, focus rings (day cells + month chevrons), and the day-cell/chevron hover wash when set (default primary token). Does NOT tint the field calendar icon — that follows `mutedColor`.'),
      accentText: colorSchema.describe('Text color of the selected day, paired with `accent` (default the primary-foreground token). Set when a light/custom accent needs dark text.'),
      borderColor: colorSchema.describe('Resting border colour of the field box AND the inline calendar panel (default the border token).'),
      bg: colorSchema.describe('Field + calendar background color (default card token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the field calendar icon, the weekday header labels, the empty-state placeholder text, the resting prev/next month chevrons, AND the resting out-of-range/disabled day numbers (default the muted-foreground token).'),
      color: colorSchema.describe('Base text colour — the regular day numbers, the month title, the chevron hover colour, AND the chosen value shown in the field (default the foreground token). Muted/disabled days keep `mutedColor`; the selected day keeps `accentText`.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the field, the calendar panel, AND the day cells (e.g. "0.5rem", "12px"; default the frayme radius token).'),
      monthNames: z
        .array(z.string())
        .nullable()
        .describe('i18n: the 12 full month names in calendar order (Jan→Dec), used in the header title + the formatted field value. Escaped text; ignored unless exactly 12 entries (default English).'),
      weekdayLabels: z
        .array(z.string())
        .nullable()
        .describe('i18n: the 7 weekday header labels starting Monday (the grid week-start), e.g. ["Lun","Mar","Mer",…]. Escaped text; ignored unless exactly 7 entries (default English).'),
    }),
    events: ['select', 'change'],
    eventsDoc: {
      select: 'A day cell inside min/max was clicked — a deliberate date selection; params carry { value } (the picked date, ISO YYYY-MM-DD). Fires on EVERY pick (a discrete choice — never gated by emitOnChange). `commit` is accepted as an alias and binds to this same event.',
      change: 'A day cell inside min/max was clicked; params carry { value } (the picked date, ISO YYYY-MM-DD). Only fires when emitOnChange !== false; when false the value still lands in (bindable) state.',
    },
    description:
      'Single-date picker: a bordered field button (formatted value or placeholder + a leading calendar icon) that opens a month grid on demand. Click a day to set value and emit change; days outside min/max are disabled. Set mode:"inline" to keep the grid permanently visible. Use { $bindState } on value for two-way binding.',
    example: { placeholder: 'Pick a date', format: 'long' },
  },

  // =========================================================================
  // DateRangePicker — start/end range over one month grid, with quick presets.
  // First click sets start (clears end); second sets end (swaps if before).
  // =========================================================================
  DateRangePicker: {
    props: z.object({
      startValue: z
        .string()
        .nullable()
        .describe("Range start as ISO 'YYYY-MM-DD'. Use { $bindState } for two-way binding."),
      endValue: z
        .string()
        .nullable()
        .describe("Range end as ISO 'YYYY-MM-DD'. Use { $bindState } for two-way binding."),
      presets: z
        .array(
          z.object({
            label: z.string().describe('Preset button text (e.g. "Last 7 days").'),
            start: z.string().describe("Preset start date as ISO 'YYYY-MM-DD'."),
            end: z.string().describe("Preset end date as ISO 'YYYY-MM-DD'."),
          }),
        )
        .nullable()
        .describe('Quick-range buttons that set both ends at once (e.g. Today · Last 7 days · This month).'),
      min: z.string().nullable().describe("Earliest selectable date as ISO 'YYYY-MM-DD'; earlier days are muted + disabled."),
      max: z.string().nullable().describe("Latest selectable date as ISO 'YYYY-MM-DD'; later days are muted + disabled."),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Field/grid height/font-size/padding token (default `md`); use `sm` in dense forms, `lg` for touch or roomy layouts.'),
      disabled: z.boolean().nullable().describe('Grey out the field (60% opacity, not-allowed cursor) and hide the calendar panel + presets entirely (default false).'),
      mode: z
        .enum(['popover', 'inline'])
        .nullable()
        .describe('Whether the presets + month grid open on demand from the field (default `popover` — the field is a real button; opens on click/Enter/Space/ArrowDown, closes when the range completes, on Escape, or on outside-click) or sit permanently below it (`inline`). Reach for `inline` only when picking the range IS the screen (a stay-dates booking step) — otherwise the grid eats vertical space for a field the user may not touch.'),
      emitOnChange: z
        .boolean()
        .nullable()
        .describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      accent: colorSchema.describe('Range-endpoint fill (the start + end days), the translucent between-days wash, focus rings (day cells + chevrons + presets), and the hover wash when set (default primary token). Does NOT tint the field calendar icon — that follows `mutedColor`.'),
      accentText: colorSchema.describe('Text color of the selected range endpoints, paired with `accent` (default the primary-foreground token).'),
      borderColor: colorSchema.describe('Resting border colour of the field box, the inline calendar panel, AND the quick-range preset buttons (default the border token).'),
      bg: colorSchema.describe('Field + calendar background color (default card token); a set value also fills the quick-range preset buttons (default transparent).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the field calendar icon, the weekday header labels, the empty-state placeholder text, the resting prev/next month chevrons, AND the resting out-of-range/disabled day numbers (default the muted-foreground token).'),
      color: colorSchema.describe('Base text colour — the regular day numbers, the month title, the quick-range preset labels, the chevron hover colour, AND the chosen value shown in the field (default the foreground token). Muted/disabled days keep `mutedColor`; the selected day keeps `accentText`.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the field, the calendar panel, the day cells, AND the quick-range preset buttons (e.g. "0.5rem", "12px"; default the frayme radius token).'),
      monthNames: z
        .array(z.string())
        .nullable()
        .describe('i18n: the 12 full month names in calendar order (Jan→Dec), used in the grid header title. Escaped text; ignored unless exactly 12 entries (default English).'),
      weekdayLabels: z
        .array(z.string())
        .nullable()
        .describe('i18n: the 7 weekday header labels starting Monday (the grid week-start), e.g. ["Lun","Mar","Mer",…]. Escaped text; ignored unless exactly 7 entries (default English).'),
    }),
    events: ['select', 'change'],
    eventsDoc: {
      select: 'A day cell or a preset was clicked — a deliberate range selection; params carry { startValue, endValue } (endValue is null between the first and second click). Fires on EVERY pick (never gated by emitOnChange). `commit` is accepted as an alias and binds to this same event.',
      change: 'A day cell was clicked (advancing start/end) or a preset button was picked; params carry { startValue, endValue } (endValue is null between the first and second click). Only fires when emitOnChange !== false; when false both endpoints still land in (bindable) state.',
    },
    description:
      'Date-range picker: a field button showing "start – end" that opens a month grid on demand, where days between the endpoints get a subtle range fill and the two endpoints the accent fill, alongside a column of quick-range presets. First day click sets start (clears end), second sets end (swapping if earlier) and closes. Set mode:"inline" to keep the grid permanently visible. Use { $bindState } on startValue/endValue.',
    example: { presets: [{ label: 'Last 7 days', start: '2026-06-19', end: '2026-06-25' }] },
  },

  // =========================================================================
  // Calendar — standalone month grid with event dots. Selectable days are
  // buttons that set value + emit('select','change').
  // =========================================================================
  Calendar: {
    props: z.object({
      month: z.string().nullable().describe("Displayed month as 'YYYY-MM' (default a sensible constant month); prev/next chevrons page it. Use { $bindState } for two-way binding — the shown month is a bindable value written back to spec.state on paging so an external control can read it."),
      value: z
        .string()
        .nullable()
        .describe("Selected day as ISO 'YYYY-MM-DD'. Use { $bindState } for two-way binding."),
      today: z
        .string()
        .nullable()
        .describe("The date to mark as 'today' as ISO 'YYYY-MM-DD' (default none — nothing marked). Rendered as an inset accent ring on the matching cell; the selected-day fill wins when a day is both today AND selected. Supply it explicitly — the calendar never reads the wall clock (deterministic render)."),
      events: z
        .array(
          z.object({
            date: z.string().describe("Event date as ISO 'YYYY-MM-DD'."),
            label: z.string().describe('Event title (used in the day cell aria-label).'),
            tone: z
              .enum(['neutral', 'success', 'warning', 'critical', 'info'])
              .nullable()
              .describe('Dot color for this event (default neutral).'),
            color: colorSchema.describe('Exact per-event dot color override — when set, paints THIS event dot in this colour instead of its tone (default the tone color).'),
          }),
        )
        .nullable()
        .describe('Events to dot onto day cells (up to 3 tone-colored dots per day, plus a 4th muted "+more" dot when a day has more than 3; each event may set an exact dot `color`).'),
      view: z.enum(['month']).nullable().describe('Calendar view granularity (default `month`, the only value supported for now); a forward-compat enum kept for future week/day views. Leave unset.'),
      selectable: z.boolean().nullable().describe('Whether days are clickable buttons that set value (default true).'),
      emitOnChange: z
        .boolean()
        .nullable()
        .describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      weekStartsOn: z
        .enum(['sunday', 'monday'])
        .nullable()
        .describe('First column weekday of the grid (default monday); also reorders the default `weekdayLabels` fallback to match.'),
      accent: colorSchema.describe('Selected-day fill color, focus rings (day cells + month chevrons), and the day-cell/chevron hover wash when set (default primary token).'),
      accentText: colorSchema.describe('Text color of the selected day, paired with `accent` (default the primary-foreground token). Set when a light/custom accent needs dark text.'),
      borderColor: colorSchema.describe('Resting panel border color (default border token).'),
      bg: colorSchema.describe('Calendar panel background color (default card token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the weekday header labels AND the resting prev/next month chevrons (default the muted-foreground token).'),
      color: colorSchema.describe('Base text colour — the regular day numbers, the month title, and the chevron hover colour (default the foreground token). The selected day keeps `accentText`.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the panel AND the day cells (e.g. "0.5rem", "12px"; default the frayme radius token).'),
      monthNames: z
        .array(z.string())
        .nullable()
        .describe('i18n: the 12 full month names in calendar order (Jan→Dec), used in the header title. Escaped text; ignored unless exactly 12 entries (default English).'),
      weekdayLabels: z
        .array(z.string())
        .nullable()
        .describe('i18n: the 7 weekday header labels in the SAME order as `weekStartsOn` (Monday-first by default, Sunday-first when weekStartsOn="sunday"). Escaped text; ignored unless exactly 7 entries (default English).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Day-cell size + grid font-size token (default `md`); use `sm` for a compact side-panel calendar, `lg` for touch or a prominent standalone month.'),
    }),
    events: ['change', 'select'],
    eventsDoc: {
      change: 'A day cell was clicked (selectable only); fires alongside select on the same click; params carry { value } (the picked date, ISO YYYY-MM-DD). Only fires when emitOnChange !== false; select (and the bindable value state) still fire regardless.',
      select: 'A day cell was clicked (selectable only); fires alongside change on the same click; params carry { value } (the picked date, ISO YYYY-MM-DD).',
    },
    description:
      'Standalone month calendar: a header (month name + prev/next chevrons), weekday labels, and a day grid. Days with events show up to three tone-colored dots (a 4th muted dot signals >3) and an event-count aria-label; the `today` date gets an inset accent ring; when selectable, days are buttons that set value and emit select + change. Use { $bindState } on value.',
    example: {
      month: '2026-06',
      events: [{ date: '2026-06-25', label: 'Launch', tone: 'success' }],
    },
  },
};
