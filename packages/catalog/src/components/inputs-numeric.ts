/**
 * Frayme inputs-numeric — 4 discrete numeric / value-entry inputs built on the
 * established "truly-dynamic" foundation (matches forms-extended.ts byte-for-byte
 * in style).
 *
 * The value-ENTRY controls that sit alongside the base form fields (Input/Select/
 * Slider in forms.tsx): a stepper number field, a dual-thumb range filter, a
 * star/heart rating, and a segmented one-time-code entry.
 *
 * Channel legend (mirrors _shared.ts): E enum · C content · SC safeColor (VALUE)
 * · D dimension (VALUE). Every enum/value prop is `.nullable()` + `.describe()`
 * (one sentence naming WHEN to reach for it);
 * defaults live in the renderer's CVA `defaultVariants`, NOT here, so a
 * props-less spec still renders polished. Closed enums only — never z.string()
 * for a visual/behavioral selector.
 *
 * NOTE on numbers: min/max/step/value/valueMin/valueMax/length are PLAIN numeric
 * bounds (not value channels) — they stay `z.number()`. `length` is the OTP
 * segment count; it passes the resolution gate as a unitless length.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Weight, Tracking } from './_shared.js';

export const inputsNumericComponents = {
  // =========================================================================
  // NumberInput — a numeric field flanked by −/+ step buttons that clamp to
  // [min,max]. Optional prefix/suffix (currency, units). Two-way bound on value.
  // =========================================================================
  NumberInput: {
    props: z.object({
      value: z.number().nullable().describe('Current numeric value. Use { $bindState } for two-way binding.'),
      min: z.number().nullable().describe('Lower bound; the − button + typed values clamp to this (omit for no minimum).'),
      max: z.number().nullable().describe('Upper bound; the + button + typed values clamp to this (omit for no maximum).'),
      step: z.number().nullable().describe('Increment applied by the −/+ buttons (default 1; e.g. 0.5 for half-steps).'),
      placeholder: z.string().nullable().describe('Empty-state hint text shown when there is no value.'),
      prefix: z.string().nullable().describe('Leading unit shown inside the field (e.g. "£", "$").'),
      suffix: z.string().nullable().describe('Trailing unit shown inside the field (e.g. "kg", "%").'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height/font-size/padding token (default `md`); use `sm` in dense filter rows, `lg` for touch or roomy forms.'),
      disabled: z.boolean().nullable().describe('Grey out (60% opacity, not-allowed cursor) and block typing plus both −/+ step buttons (default false). Set for read-only or gated quantities.'),
      accent: colorSchema.describe('Focus-ring colour when the field is active (default the primary token; bindable safeColor). Set to match a branded form or a custom `bg`.'),
      borderColor: colorSchema.describe('Resting border colour of the field box (default the border token; bindable safeColor). Set to emphasise the field or pair with a custom `bg`.'),
      bg: colorSchema.describe('Field background colour (default the card token; bindable safeColor). Set on tinted surfaces; pair a dark `bg` with `color` for a readable value.'),
      color: colorSchema.describe('Entered-value text colour of the number readout (default inherits the ambient foreground). Set it when a dark custom `bg` needs a readable light value.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the inline prefix/suffix unit annotations, the −/+ step-button glyphs, and the empty-state placeholder (default the muted-foreground token).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'A step button was clicked or the field was typed into (clamped to [min,max]); params carry { value } (null when the field is cleared). Only fires when emitOnChange !== false.' },
    description:
      'Numeric field with −/+ step buttons that clamp to [min,max]. Reach for it over a bare Input when the value is a quantity (qty, age, price) the user nudges. Use { $bindState } on value for two-way binding; the buttons disable at the bounds.',
    example: { value: 1, min: 0, max: 10, prefix: '£' },
  },

  // =========================================================================
  // RangeSlider — a dual-thumb min/max range (price/age filters) with an
  // optional histogram behind the track. Two-way bound on valueMin & valueMax.
  // =========================================================================
  RangeSlider: {
    props: z.object({
      min: z.number().nullable().describe('Scale minimum — the left end of the track (default 0); `valueMin` clamps to this floor. Set for a domain other than 0.'),
      max: z.number().nullable().describe('Scale maximum — the right end of the track (default 100); `valueMax` clamps to this ceiling. Set for a price/age domain wider than 100.'),
      step: z.number().nullable().describe('Thumb increment applied when dragging either handle (default 1; e.g. 5 for whole-band price steps).'),
      valueMin: z.number().nullable().describe('Current lower selection. Use { $bindState } for two-way binding.'),
      valueMax: z.number().nullable().describe('Current upper selection. Use { $bindState } for two-way binding.'),
      showHistogram: z.boolean().nullable().describe('Render the `histogram` bars behind the track (a distribution preview).'),
      histogram: z.array(z.number()).nullable().describe('Bar heights drawn behind the track (normalized to the tallest); pair with showHistogram.'),
      marks: z.boolean().nullable().describe('Show the `min` & `max` tick labels under the two ends of the track (default false). Turn on to anchor the scale; distinct from `showValues`, which reads out the selected band.'),
      showValues: z.boolean().nullable().describe('Render the currently-SELECTED band as a "lo – hi" readout above the track (default false). Distinct from `marks` (which only labels the scale min & max).'),
      valuePrefix: z.string().nullable().describe('Text prefixed to each value in the `showValues` readout (e.g. "£", "$"; default none).'),
      valueSuffix: z.string().nullable().describe('Text suffixed to each value in the `showValues` readout (e.g. "%", "km"; default none).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Track thickness and thumb diameter (default md; sm=4px track/12px thumb, md=6px/16px, lg=8px/20px).'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 900 }).describe('Exact slider width (e.g. 320px / 24rem). Overrides the default 100% fill.'),
      disabled: z.boolean().nullable().describe('Grey out the whole control (60% opacity, not-allowed cursor) and block dragging both thumbs (default false).'),
      accent: colorSchema.describe('The selected-range fill + thumb color (default primary token).'),
      trackColor: colorSchema.describe('The inactive-surface colour outside the selected range — the unfilled track (default border token) and the out-of-range histogram bars when `showHistogram` (default muted token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the min & max tick `marks` labels (default the muted-foreground token).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'Either thumb was dragged to a new position; params carry { valueMin, valueMax } (the full current band, not just the moved thumb). Only fires when emitOnChange !== false.' },
    description:
      'Dual-thumb range filter for a price/age band, with an optional histogram behind the track. Bind valueMin & valueMax with { $bindState }; the thumbs clamp so valueMin never crosses valueMax. accent fills the selected range.',
    example: { min: 0, max: 1000, valueMin: 200, valueMax: 800, marks: true },
  },

  // =========================================================================
  // Rating — a star/heart rating, usable as an input (clickable) or display
  // (readOnly). Optional half-steps. Two-way bound on value.
  // =========================================================================
  Rating: {
    props: z.object({
      value: z.number().nullable().describe('Current rating, 0..max. Use { $bindState } for two-way binding.'),
      max: z.number().nullable().describe('Number of icons rendered (default 5; clamped 1..20 by the renderer).'),
      icon: z.enum(['star', 'heart']).nullable().describe('Glyph repeated across the row: `star` (default) for reviews/scores, or `heart` for likes/favourites. Purely visual — does not change the value semantics.'),
      allowHalf: z.boolean().nullable().describe('Render half-filled icons for fractional values (display side; clicks still set whole steps).'),
      readOnly: z.boolean().nullable().describe('Display-only — no hover/click (renders as an image with an accessible "Rated N of M" label).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Icon size in px (default md; sm=16px, md=22px, lg=28px).'),
      color: colorSchema.describe('Text colour of the filled star/heart glyphs at rest (default a warning/amber token). Set it against the surface the rating sits on; `mutedColor` colours the unfilled glyphs.'),
      accent: colorSchema.describe('Keyboard focus-ring color, AND the hover-preview fill color when interactive: hovering icon N previews icons 1..N filled in this colour (reverting on mouse-leave). Defaults to `color`, else the primary token.'),
      mutedColor: colorSchema.describe('Text colour of the unfilled star/heart glyphs — the empty base layer under each icon (default the muted-foreground token). Set it up on tinted or dark cards where the default glyph disappears.'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'An icon was clicked to set the rating (not readOnly); params carry { value } (the whole-number rating set). Only fires when emitOnChange !== false.' },
    description:
      'Star/heart rating that doubles as an input or a display. Clicking sets value + emits change unless readOnly; when interactive, hovering an icon previews the fill up to it. allowHalf renders fractional fills (display side). Use { $bindState } on value for two-way binding; color names the filled-icon color, mutedColor the empty icons.',
    example: { value: 4, max: 5, icon: 'star' },
  },

  // =========================================================================
  // OTPInput — segmented one-time-code entry (N single-char boxes). Two-way
  // bound on value; emits 'commit' when the code fills.
  // =========================================================================
  OTPInput: {
    props: z.object({
      length: z.number().nullable().describe('Number of segments / code length (default 6; clamped 2..12).'),
      value: z.string().nullable().describe('Current code string. Use { $bindState } for two-way binding.'),
      mask: z.boolean().nullable().describe('Show filled segments as dots (•) instead of the typed characters (for secret codes).'),
      pattern: z.enum(['numeric', 'alphanumeric']).nullable().describe('Allowed characters: numeric (digits only, default) or alphanumeric.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Segment box size in px (default md; sm=36×32, md=44×40, lg=56×48).'),
      label: z.string().nullable().describe('Field label shown above the segments (default none — a bare code row). Keep short (1-3 words), e.g. "Verification code".'),
      weight: Weight.describe('Font weight of the field label (default medium); set to dial the emphasis up or down. No effect without `label`.'),
      tracking: Tracking.describe('Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption. No effect without `label`.'),
      groupSize: z.number().nullable().describe('Insert a separator after every N boxes for grouped presentation (e.g. 3 for a 6-digit 3+3 code; default off = one continuous row). Inert when ≤0 or ≥ length.'),
      separator: z.string().nullable().describe('The character drawn between groups when `groupSize` is set (default "-"). Purely decorative.'),
      disabled: z.boolean().nullable().describe('Grey out every segment (60% opacity, not-allowed cursor) and block typing into any box (default false).'),
      accent: colorSchema.describe('Focused/next-segment ring + border color (default primary token).'),
      borderColor: colorSchema.describe('Resting segment border color (default border token).'),
      bg: colorSchema.describe('Background colour of each segment box (default the card token; bindable safeColor). Set on tinted surfaces; pair a dark `bg` with `color` to keep the typed characters legible.'),
      color: colorSchema.describe('Entered-character text colour inside each segment, and the group separator glyph (default the foreground token). Set it when a dark custom `bg` needs a readable light character.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of each segment box (e.g. "12px" / "1rem"; default the frayme radius token, overriding the size-derived default).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
    }),
    events: ['change', 'commit'],
    eventsDoc: {
      change: 'A segment was typed into or backspaced; params carry { value } (the full code string so far). Only fires when emitOnChange !== false.',
      commit: 'The code just became fully filled (fires once on the fill transition, not on later edits of a full code); params carry { value } (the complete code).',
    },
    description:
      'Segmented one-time-code entry: a row of single-character boxes. Typing routes characters into the code (respecting pattern + length); emits change on each edit and commit when the code fills. Use { $bindState } on value for two-way binding.',
    example: { length: 6, pattern: 'numeric' },
  },
};
