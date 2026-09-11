/**
 * Frayme forms-extended — 5 form-scaffolding components built on the established
 * "truly-dynamic" foundation (matches shadcn-base.ts byte-for-byte in style).
 *
 * These are the field-CHROME pieces that sit AROUND the existing form controls
 * (Input/Textarea/Select/… in shadcn-base.ts): a <form> wrapper, a label+help+
 * error field group, a standalone label, an inline error line, and a search box.
 *
 * Channel legend (mirrors _shared.ts): E enum · C content · SC safeColor (VALUE)
 * · D dimension (VALUE). Every enum/value prop is `.nullable()` + `.describe()`
 * (one sentence naming WHEN to reach for it);
 * defaults live in the renderer's CVA `defaultVariants`, NOT here, so a
 * props-less spec still renders polished. Closed enums only — never z.string()
 * for a visual/behavioral selector.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Font, Weight, Tracking, Leading } from './_shared.js';

export const formsExtendedComponents = {
  // =========================================================================
  // Form — the <form> wrapper. Lays out fields + a submit button and owns the
  // submit signal (the renderer preventDefaults + emits 'submit').
  // =========================================================================
  Form: {
    props: z.object({
      layout: z
        .enum(['vertical', 'horizontal', 'inline'])
        .nullable()
        .describe('Field arrangement: vertical (stacked, default) · horizontal (label beside control rows) · inline (one compact row, e.g. an email + button signup).'),
      gap: z
        .enum(['none', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Spacing between fields. Reach for `sm` on a dense settings form, `lg` on a roomy onboarding step.'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 900 }).describe('Explicit form width (e.g. "28rem" for a centered auth card, "100%" to fill). Omit for natural width.'),
      disabled: z.boolean().nullable().describe('Disable EVERY field in the form at once via a native <fieldset disabled> (default false). Use to lock the whole form while a submit is in flight — pairs with the `commit` event for the pending state; no per-field wiring needed.'),
    }),
    slots: ['default'],
    events: ['commit'],
    eventsDoc: { commit: 'The form was submitted (native submit intercepted, no page reload); params carry { fields } (every named field\'s value, collected via FormData).' },
    description:
      'Form wrapper that lays out fields + a submit button. Bind on.commit for the handler; the renderer prevents the native page reload and emits the event. Set `disabled` to lock every field at once (e.g. while a submit is in flight).',
    example: { layout: 'vertical', gap: 'md' },
  },

  // =========================================================================
  // FormField — a labelled field group wrapping a single control. Renders the
  // label, the control (children), and a help/error line (error wins).
  // =========================================================================
  FormField: {
    props: z.object({
      label: z.string().describe('The field label text shown above/beside the control.'),
      helpText: z.string().nullable().describe('Muted hint under the control (e.g. "We never share your email").'),
      errorText: z.string().nullable().describe('Validation error under the control; overrides helpText styling (danger-toned) when set.'),
      required: z.boolean().nullable().describe('Mark this field REQUIRED: shows the `*` on the label AND makes the wrapped control genuinely mandatory — a named-action submit inside the Form is blocked with native browser validation until it is filled. The control\'s own `required` prop overrides. Never a decorative asterisk.'),
      labelPlacement: z
        .enum(['top', 'left', 'hidden'])
        .nullable()
        .describe('Label position: top (default) · left (label beside the control) · hidden (kept for screen readers via sr-only).'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Label + help/error font size, matching the wrapped control density (default md).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the help hint line under the control (default the muted-foreground token). Error text stays danger-toned.'),
      weight: Weight.describe('Font weight of the field-group label (default medium); set to dial the caption emphasis up or down.'),
      tracking: Tracking.describe('Letter-spacing of the field-group label (default normal); reach for `wide`/`wider` on an uppercase caption.'),
    }),
    slots: ['default'],
    description:
      'Field group: a label + the wrapped control (children) + a help/error line. Use to give any bare control a consistent label, helper text, and error slot. Error text wins over help text.',
    example: { label: 'Email', helpText: 'We never share your email.' },
  },

  // =========================================================================
  // FieldError — a standalone inline validation error line (fixed critical
  // tone, role="alert"). Use when the error sits apart from a FormField.
  // =========================================================================
  FieldError: {
    props: z.object({
      message: z.string().describe('The validation error text shown beside the alert icon. Keep it one short sentence, specific to what failed (e.g. "Please enter a valid email address.").'),
      size: z.enum(['sm', 'md']).nullable().describe('Font size of the error line (default sm — it sits under a control); the leading alert icon scales with it (14px sm · 16px md).'),
    }),
    description:
      'Inline validation error. Renders a small danger-toned line with a leading alert-circle icon and role="alert". Tone is fixed critical — there is no tone prop.',
    example: { message: 'Please enter a valid email address.' },
  },

  // =========================================================================
  // Label — a standalone form/inline label, optionally tied to a control via
  // htmlFor and showing a required marker.
  // =========================================================================
  Label: {
    props: z.object({
      text: z.string().describe('The label text. Keep to 1-4 words, e.g. "Full name" — not a sentence.'),
      htmlFor: z.string().nullable().describe('The id of the control this label captions (renders htmlFor). Omit for a plain inline label.'),
      required: z.boolean().nullable().describe('Show a required `*` marker after the label text (default false). Set true when the captioned control must be filled in, mirroring the control\'s own required state.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Font size (default md; sm=13px, md=14px, lg=16px).'),
      fontSize: dimensionSchema({ units: ['px', 'rem', 'em'], min: 10, max: 48 }).describe('Exact label font size (e.g. "13px" / "0.9rem"). Overrides the `size` enum, which is the default.'),
      color: colorSchema.describe('Exact label text color (default the foreground token). Names a specific color when the theme default is not what you want.'),
      font: Font.describe('Typeface for the whole label region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the label text (default medium); set to dial the emphasis up or down.'),
      tracking: Tracking.describe('Letter-spacing of the label text (default normal); reach for `wide`/`wider` on an uppercase caption.'),
      leading: Leading.describe('Line-height of the label text (default snug-ish from the size); reach for `relaxed` on a multi-line label.'),
    }),
    description:
      'Form/inline label. Renders a <label> (with `htmlFor` when set to wire it to a control) plus an optional required `*` marker. Reach for this standalone Label when a control sits apart from a FormField group and still needs a caption — set `htmlFor` to the control\'s id so clicking the label focuses it. Style it with `size`/`weight`/`tracking` or an exact `fontSize`/`color` to match the surrounding form density.',
    example: { text: 'Full name', htmlFor: 'name', required: true },
  },

  // =========================================================================
  // SearchInput — a search box with a leading search icon, an optional clear
  // (×) button, and a loading spinner. Two-way bound on `value`.
  // =========================================================================
  SearchInput: {
    props: z.object({
      placeholder: z.string().nullable().describe('Empty-state hint text shown when the box is empty (e.g. "Search products…"); make it name what the user is searching over.'),
      value: z.string().nullable().describe('Current query string. Use { $bindState } for two-way binding.'),
      name: z.string().nullable().describe('Form field name emitted in event params and used for native form submission; set it when the box lives inside a submitted <form> or you need to identify the field.'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 900 }).describe('Exact box width (e.g. "320px" / "100%"). Overrides the default full width.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height, font size, and padding together (default md). Reach for `sm` in a dense toolbar/header and `lg` for a prominent landing-page search bar.'),
      radius: z
        .enum(['none', 'sm', 'md', 'lg', 'full'])
        .nullable()
        .describe('Corner rounding (default md; `full` for a rounded search pill).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "10px" / "0.75rem"). Overrides the `radius` enum, which is the default.'),
      loading: z.boolean().nullable().describe('Show a trailing spinner while results are fetching (replaces the clear button).'),
      clearable: z.boolean().nullable().describe('Show a clear (×) button when there is a query (default true).'),
      disabled: z.boolean().nullable().describe('Grey out the box (60% opacity, not-allowed cursor) and block typing, the clear button, and Enter-to-commit (default false).'),
      borderColor: colorSchema.describe('Resting border color of the search box (default the border token). Name a brand color to match a themed toolbar; the focus ring uses `accent`, not this.'),
      bg: colorSchema.describe('Field background color of the search box (default the card token). Set it when the box sits on a tinted surface and the default card fill does not read against it.'),
      accent: colorSchema.describe('Focus-ring color (default the primary token) + leading-icon tint (default the muted-foreground token; the icon is tinted only when `accent` is set).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the placeholder hint and clear/loading affordances (default the muted-foreground token). When set (or with a custom `bg`), the clear button’s hover pill derives from it via color-mix instead of the neutral token.'),
      emitOnChange: z
        .boolean()
        .nullable()
        .describe(
          'Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.',
        ),
    }),
    events: ['change', 'commit'],
    eventsDoc: {
      change: 'The input was typed into (only when emitOnChange !== false) or the clear (×) button was clicked; params carry { value, name } (name is the `name` prop, or null).',
      commit: 'Enter was pressed in the field (ignored while an IME composition is in progress); params carry { value, name } — bind this to trigger the search.',
    },
    description:
      'Search box with a leading search icon, an optional clear (×) button, and a loading spinner. Use { $bindState } on value for two-way binding; bind on.commit to run the search on Enter. Reach for it over a plain Input whenever a field is specifically a query box — it adds the icon, the one-click clear affordance, and a `loading` spinner slot for showing that results are in flight.',
    example: { placeholder: 'Search…', clearable: true },
  },
};
