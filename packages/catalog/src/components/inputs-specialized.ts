/**
 * Frayme inputs-specialized — 5 specialized value-entry controls on the
 * established "truly-dynamic" foundation (matches inputs-numeric.ts byte-for-byte
 * in style).
 *
 * The niche entry controls that round out the form family: a swatch ColorPicker,
 * a native TimePicker, a −/+ QuantityStepper, a dial-code PhoneInput, and a
 * one-click CopyButton.
 *
 * Channel legend (mirrors _shared.ts): E enum · C content · N number ·
 * SC safeColor (VALUE) · D dimension (VALUE). Every enum/value prop is
 * `.nullable()` + `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA
 * `defaultVariants`, NOT here, so a props-less spec still renders polished.
 * Closed enums only — never z.string() for a visual/behavioral selector.
 *
 * VALUE channels: a model-named color goes through `colorSchema` (validated at
 * the gate + re-validated via `safeColor` at render). The per-swatch `color`
 * inside `swatches[]` is the gate-covered COLOR_KEY `color`, NESTED in the
 * array's z.object so the catalog Zod gate validates each one. `value` on the
 * color/time/phone fields is plain content (a string), not a value channel.
 * min/max/step/minuteStep stay `z.number()` — plain numeric bounds, not channels.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Weight, Tracking } from './_shared.js';

export const inputsSpecializedComponents = {
  // =========================================================================
  // ColorPicker — pick a color from a swatch grid, with an optional hex field.
  // Two-way bound on `value`. Per-swatch `color` is the nested COLOR_KEY.
  // =========================================================================
  ColorPicker: {
    props: z.object({
      value: z
        .string()
        .nullable()
        .describe('Currently selected color string (e.g. "#3b82f6"). Use { $bindState } for two-way binding.'),
      swatches: z
        .array(
          z.object({
            color: colorSchema.describe('The swatch fill — a safe CSS color (hex/rgb/hsl/oklch/named).'),
            label: z.string().nullable().describe('Accessible name for this swatch (defaults to the color value).'),
          }),
        )
        .nullable()
        .describe('Preset swatches to choose from; each is { color, label? }. Omit for a sensible default palette.'),
      showInput: z.boolean().nullable().describe('Show a hex text field under the grid for free entry (default true).'),
      columns: dimensionSchema({ kind: 'count', min: 1, max: 12 }).describe(
        'Swatch-grid column count (default 6). Reach for fewer on narrow surfaces.',
      ),
      accent: colorSchema.describe('Selection-ring + focus color around the active swatch, and the hex field’s focus border + ring (default primary token).'),
      bg: colorSchema.describe('Background fill of the preview chip (empty state) and the hex field (default the card token).'),
      borderColor: colorSchema.describe('Border colour of the preview chip and the hex field (default the border token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the preview chip and the hex field (e.g. "12px" / "1rem"; default the frayme radius token).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Scale of the swatch tiles and preview chip: `sm` · `md` (default) · `lg`. Reach for `sm` in a dense toolbar/inline palette, `lg` for a prominent brand-colour picker.'),
      label: z.string().nullable().describe('Field label shown above the picker. Keep short (1-3 words), e.g. "Brand color".'),
      weight: Weight.describe('Font weight of the field label (default medium); set to dial the emphasis up or down.'),
      tracking: Tracking.describe('Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption.'),
      disabled: z.boolean().nullable().describe('Grey out the whole control (60% opacity, not-allowed cursor) and block picking a swatch or typing the hex field (default false).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      mutedColor: colorSchema.describe(
        'Secondary/muted text colour — the selected-value hex readout beside the preview chip (default the muted-foreground token).',
      ),
    }),
    events: ['change'],
    eventsDoc: { change: 'A swatch was clicked or the hex field was edited; params carry { value } (the new color string). Only fires when `emitOnChange` !== false — otherwise the value lives in bindable state for an external Button to read.' },
    description:
      'Swatch-grid color picker with an optional hex field and a live preview chip. Two-way bound on `value`; per-swatch `color` overrides the default palette slot. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the currently selected color string from spec.state.',
    example: {
      label: 'Brand color',
      value: '#2563eb',
      swatches: [{ color: '#2563eb' }, { color: '#10b981' }, { color: '#f59e0b' }, { color: '#ef4444' }],
    },
  },

  // =========================================================================
  // TimePicker — a styled native time-of-day input. Two-way bound on `value`.
  // =========================================================================
  TimePicker: {
    props: z.object({
      value: z.string().nullable().describe('Selected time as "HH:MM" (24h). Use { $bindState } for two-way binding. The clock face (12h AM/PM vs 24h) follows the user’s locale — it is not spec-controllable.'),
      minuteStep: z.number().nullable().describe('Minute granularity of the picker (default 1; e.g. 15 for quarter-hours).'),
      accent: colorSchema.describe('Focus-ring color (default the primary token) and clock-icon tint (default the muted-foreground token).'),
      bg: colorSchema.describe('Field background fill (default the card token; bindable). Set a tinted value to lift the field off a matching card, or leave default to blend into the surface.'),
      borderColor: colorSchema.describe('Field border colour (default the border token; bindable). Set a brand/accent value to draw attention or an error red to flag an invalid time.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the field (e.g. "12px" / "1rem"; default the frayme radius token, overriding the size-derived default).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height, font size and padding: `sm` · `md` (default) · `lg`. Reach for `sm` in a dense form row, `lg` for a prominent standalone time field.'),
      label: z.string().nullable().describe('Field label shown above the input. Keep short (1-3 words), e.g. "Start time".'),
      weight: Weight.describe('Font weight of the field label (default medium); set to dial the emphasis up or down.'),
      tracking: Tracking.describe('Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption.'),
      disabled: z.boolean().nullable().describe('Grey out the field (60% opacity, not-allowed cursor) and block editing the native time input (default false).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'The native time input was edited; params carry { value } (the new "HH:MM" 24h string). Only fires when `emitOnChange` !== false — otherwise the value lives in bindable state for an external Button to read.' },
    description:
      'Time-of-day field built on a native time input (SSR-safe, accessible) with a leading clock icon. `minuteStep` sets granularity; two-way bound on `value`. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the selected "HH:MM" 24h time from spec.state.',
    example: { label: 'Start time', value: '09:30', minuteStep: 15 },
  },

  // =========================================================================
  // QuantityStepper — a −/+ numeric stepper that clamps to [min,max].
  // Two-way bound on `value`.
  // =========================================================================
  QuantityStepper: {
    props: z.object({
      value: z.number().nullable().describe('Current quantity. Use { $bindState } for two-way binding (defaults to `min`).'),
      min: z.number().nullable().describe('Lower bound; the − button disables here (default 0).'),
      max: z.number().nullable().describe('Upper bound; the + button disables here (default 99).'),
      step: z.number().nullable().describe('Amount added or subtracted per −/+ press, clamped to [`min`,`max`] (default 1). Raise it for coarse counts (e.g. 5, 10, 100); use a decimal for fractional units.'),
      accent: colorSchema.describe('Active/hover color of the −/+ buttons (default primary token).'),
      bg: colorSchema.describe('Stepper background fill behind the buttons and readout (default the card token; bindable). Set a tinted value to lift it off a matching card surface.'),
      borderColor: colorSchema.describe('Stepper border + readout-divider colour (default the border token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the stepper (e.g. "12px" / "1rem"; default the frayme radius token, overriding the size-derived default).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height + button + readout scale (default md).'),
      label: z.string().nullable().describe('Field label shown above the stepper. Keep short (1-3 words), e.g. "Quantity".'),
      weight: Weight.describe('Font weight of the field label (default medium); set to dial the emphasis up or down.'),
      tracking: Tracking.describe('Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption.'),
      disabled: z.boolean().nullable().describe('Grey out the whole control (60% opacity, not-allowed cursor) and block the readout and both −/+ buttons (default false).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'A step button was clicked or the readout was typed into (clamped to [min,max]); params carry { value }. Only fires when `emitOnChange` !== false — otherwise the value lives in bindable state for an external Button to read.' },
    description:
      'Compact −/+ quantity stepper with an editable numeric readout, clamped to [min,max]. Two-way bound on `value`. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the current quantity number from spec.state.',
    example: { label: 'Quantity', value: 1, min: 1, max: 10 },
  },

  // =========================================================================
  // PhoneInput — a phone field with a country dial-code prefix select.
  // Two-way bound on `value` (the national number). Render-only formatting.
  // =========================================================================
  PhoneInput: {
    props: z.object({
      value: z.string().nullable().describe('The national number digits. Use { $bindState } for two-way binding.'),
      countries: z
        .array(
          z.object({
            code: z.string().describe('ISO country code, e.g. "GB".'),
            dial: z.string().describe('Dial-code prefix, e.g. "+44".'),
            flag: z.string().nullable().describe('Optional flag emoji shown in the select.'),
          }),
        )
        .nullable()
        .describe('Country dial-code options; each is { code, dial, flag? }. Omit for a sensible built-in list.'),
      country: z.string().nullable().describe('Selected country code (e.g. "GB"); defaults to the first option. Use { $bindState } for two-way binding so an external Submit can read the full phone value (number + dial-code).'),
      placeholder: z.string().nullable().describe('Empty-input hint text for the number field (e.g. "7700 900000").'),
      accent: colorSchema.describe('Focus-ring color of the field (default primary token).'),
      bg: colorSchema.describe('Field background fill behind both the dial-code select and the number input (default the card token; bindable). Set a tinted value to lift the field off a matching card surface.'),
      borderColor: colorSchema.describe('Field + dial-code-divider border colour (default the border token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the number field’s placeholder text (default the muted-foreground token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the field (e.g. "12px" / "1rem"; default the frayme radius token, overriding the size-derived default).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height, font size and padding: `sm` · `md` (default) · `lg`. Reach for `sm` in a dense form row, `lg` for a prominent standalone phone field.'),
      label: z.string().nullable().describe('Field label shown above the input. Keep short (1-3 words), e.g. "Phone".'),
      weight: Weight.describe('Font weight of the field label (default medium); set to dial the emphasis up or down.'),
      tracking: Tracking.describe('Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption.'),
      disabled: z.boolean().nullable().describe('Grey out the field (60% opacity, not-allowed cursor) and block the dial-code select and the number field (default false).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'The number field was typed into (digits only, stripped of non-numeric chars) or the dial-code select changed; params carry { value } and, from the select, also { country }. Only fires when `emitOnChange` !== false — otherwise the number + country live in bindable state for an external Button to read.' },
    description:
      'Phone-number field with a country dial-code prefix select and a tel input (renders the raw national-number digits — no reformatting or validation service, so the caret stays stable on mid-string edits). Two-way bound on `value`. Bind `value`, `country` with `{ $bindState }` so the agent (or a sibling control) can read the national-number digits and the selected country code from spec.state.',
    example: { label: 'Phone', country: 'GB', placeholder: '7700 900000' },
  },

  // =========================================================================
  // CopyButton — one-click copy-to-clipboard with a transient "Copied!" state.
  // Self-contained; needs no host.
  // =========================================================================
  CopyButton: {
    props: z.object({
      value: z.string().nullable().describe('The exact text written to the clipboard on click (e.g. a command, URL, code snippet or API key). Copied verbatim with no trimming; if empty/absent nothing is copied.'),
      label: z.string().nullable().describe('Resting button label before a click (default "Copy"). Keep to 1-2 words, verb-first.'),
      copiedLabel: z.string().nullable().describe('Label shown for ~1.5s after a successful copy (default "Copied!").'),
      variant: z
        .enum(['default', 'primary', 'secondary', 'ghost', 'outline'])
        .nullable()
        .describe('Visual style: default · primary (filled) · secondary · ghost (text-only) · outline.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height + padding + font size (default md).'),
      icon: z
        .enum(['copy', 'clipboard', 'link', 'none'])
        .nullable()
        .describe('Leading icon: copy (default) · clipboard · link · none.'),
    }),
    description:
      'One-click copy-to-clipboard button that flips to a transient "Copied!" state with a check icon. Self-contained — no host wiring needed. Reach for it beside a command, code snippet, URL or API key to give the user a frictionless copy; the label reverts to `label` after ~1.5s and it emits no events, so it never round-trips to the agent.',
    example: { value: 'npm i @frayme/runtime', label: 'Copy command' },
  },
} as const;
