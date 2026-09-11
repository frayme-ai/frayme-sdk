/**
 * Frayme layout primitives — Box, Container, Section.
 *
 * The low-level structural spine the model reaches for when Card/Stack/Grid are
 * too opinionated: a raw styled box, a centered page-width wrapper, and a
 * vertically-rhythmed page band. All three render children (slots:['default']).
 *
 * Built on the same "truly-dynamic" foundation as the shipped components:
 *  - ENUM atoms (the bounded menu) → compiled to static CVA classes at build time.
 *  - VALUE atoms (`colorSchema` / `dimensionSchema(opts)`) → validated string|number
 *    the renderer turns into an inline `--fr-<comp>-<role>` CSS var (data, never a
 *    class). A value channel NEVER becomes a class; an enum NEVER becomes a style.
 *
 * Every enum/value prop is `.nullable()` + `.describe()` (one sentence naming WHEN
 * to reach for it); defaults live in the
 * renderer's CVA `defaultVariants`, so a props-less spec still renders polished.
 */

import { z } from 'zod';
import { BorderStyle, colorSchema, dimensionSchema, Font, Leading, Tracking, Weight } from './_shared.js';

export const layoutPrimitiveComponents = {
  // =========================================================================
  // Box — primitive styled container (the unopinionated <div>)
  // =========================================================================
  Box: {
    props: z.object({
      padding: z
        .enum(['none', 'xs', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Inner padding scale. Reach for `none` when the Box only positions/borders content; `lg`/`xl` for a roomy standalone panel.'),
      paddingValue: dimensionSchema({ units: ['px', 'rem'], max: 96 }).describe('Exact inner padding (e.g. "320px" / "2rem"). Overrides the `padding` enum, which is the default.'),
      radius: z
        .enum(['none', 'sm', 'md', 'lg', 'full'])
        .nullable()
        .describe('Corner rounding. `none` for a flush edge-to-edge box; `full` for a pill/round chip surface.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "10px" / "0.75rem"). Overrides the `radius` enum, which is the default.'),
      bordered: z
        .boolean()
        .nullable()
        .describe('Draw a 1px border around the box. Pair with `borderColor` to tint it.'),
      borderStyle: BorderStyle.describe('Border line style when bordered: solid (default) · dashed · dotted.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact border thickness when bordered (e.g. "2px"). Default 1px.'),
      shadow: z
        .enum(['none', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Drop-shadow depth (default none). Use to lift the box off the page as a floating surface.'),
      align: z
        .enum(['start', 'center', 'end'])
        .nullable()
        .describe('Text alignment of the box content (default start). `center` for a centered callout/empty-state.'),
      bg: colorSchema.describe('Background fill color. Names a specific surface color when no theme token fits; omit for transparent.'),
      color: colorSchema.describe('On-surface text colour for everything inside the box — cascades to all child text (default the foreground token). Pair with `bg` so a dark fill keeps readable content.'),
      borderColor: colorSchema.describe('Border color (implies/with `bordered`). Use to tint the outline, e.g. a soft brand edge.'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 1600 }).describe('Explicit box width (e.g. "480px" or "100%"). Omit to fill/shrink to content.'),
      minHeight: dimensionSchema({ units: ['px', 'rem', 'vh'], max: 2000 }).describe('Minimum height (e.g. "60vh" for a full-bleed hero box, or "12rem"). Omit for intrinsic height.'),
      font: Font.describe('Typeface for this box and everything inside it (cascades): sans · serif · mono · rounded · display. Omit to inherit the theme font.'),
    }),
    slots: ['default'],
    description:
      'Primitive styled container for padding/border/background/shadow when Card is too much. Children stack VERTICALLY with a small built-in gap (never run together); for a horizontal row or a custom gap put a Stack inside the Box. Reach for it to visually group a few related elements — a callout strip, a framed hint, a soft-tinted summary — without the header chrome a Card implies.',
    example: { padding: 'md', bordered: true, radius: 'md' },
  },

  // =========================================================================
  // Container — max-width centered page wrapper
  // =========================================================================
  Container: {
    props: z.object({
      maxWidth: z
        .enum(['sm', 'md', 'lg', 'xl', 'full'])
        .nullable()
        .describe('Max content width: sm (~36rem) · md (~48rem) · lg (~64rem, default) · xl (~80rem) · full (no cap). Pick by how wide the reading column should be.'),
      padding: z
        .enum(['none', 'sm', 'md', 'lg'])
        .nullable()
        .describe('Horizontal gutter padding so content never touches the viewport edge (default md). `none` when a parent already pads.'),
      paddingValue: dimensionSchema({ units: ['px', 'rem'], max: 96 }).describe('Exact horizontal gutter (left+right, e.g. "320px" / "2rem"). Overrides the `padding` enum, which is the default.'),
      centered: z
        .boolean()
        .nullable()
        .describe('Center the wrapper horizontally with auto margins (default true). Set false to left-align it.'),
      align: z
        .enum(['start', 'center', 'end'])
        .nullable()
        .describe('Text alignment of the wrapped content (default start). `center` for a centered marketing column.'),
      bg: colorSchema.describe('Background fill color of the wrapper (e.g. a tinted reading column). Omit for transparent.'),
      color: colorSchema.describe('On-surface text colour for the wrapped column — cascades to all child text (default the foreground token). Pair with `bg` so a tinted/dark column keeps readable content.'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 1600 }).describe('Explicit width override (escape hatch beyond the `maxWidth` enum), e.g. "960px". Prefer `maxWidth` for the common cases.'),
      font: Font.describe('Typeface for the wrapped column and everything inside it (cascades): sans · serif · mono · rounded · display. Omit to inherit the theme font.'),
    }),
    slots: ['default'],
    description:
      'Max-width centered page wrapper. The outermost layout shell that constrains and centers a page/section column. Children render inside.',
    example: { maxWidth: 'lg', padding: 'md' },
  },

  // =========================================================================
  // Section — page section band (vertical rhythm + optional heading)
  // =========================================================================
  Section: {
    props: z.object({
      spacing: z
        .enum(['none', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Vertical padding (top+bottom) that sets the rhythm between page bands (default md). `xl` for a generous hero/landing band.'),
      paddingValue: dimensionSchema({ units: ['px', 'rem'], max: 240 }).describe('Exact vertical band padding (top+bottom, e.g. "160px" / "10rem"). Overrides the `spacing` enum, which is the default.'),
      maxWidth: z
        .enum(['narrow', 'default', 'wide', 'full'])
        .nullable()
        .describe('Inner content max-width: narrow (~40rem) · default (~64rem) · wide (~80rem) · full (edge-to-edge). Controls how wide the band content reads. (An ENUM — distinct from the dimension `width` channel — so it is never gate-flagged.)'),
      align: z
        .enum(['start', 'center', 'end'])
        .nullable()
        .describe('Text alignment of the eyebrow/title/content (default start). `center` for a centered section header.'),
      eyebrow: z
        .string()
        .nullable()
        .describe('Small uppercase kicker line shown above the title (e.g. "FEATURES"). Omit when there is no title.'),
      title: z
        .string()
        .nullable()
        .describe('Section heading rendered above the children. Omit for an untitled band.'),
      bg: colorSchema.describe('Full-bleed band background color (e.g. a tinted/dark strip). Omit for transparent.'),
      color: colorSchema.describe('On-band text colour — the section title AND all band content (cascades from the section root; default the foreground token). Set it alongside a saturated/dark `bg` so the heading and children stay legible; the eyebrow keeps `mutedColor`.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the small uppercase eyebrow kicker (default the muted-foreground token).'),
      font: Font.describe('Typeface for the band header and everything inside it (cascades): sans · serif · mono · rounded · display. Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the section title only: light · normal · medium · semibold (default) · bold. Reach for `bold` for a louder hero header.'),
      tracking: Tracking.describe('Letter-spacing of the section title only: tighter · tight · normal · wide · wider. `tight` tightens a large display heading.'),
      leading: Leading.describe('Line-height of the section title only: tight (default) · snug · normal · relaxed · loose. Loosen for a multi-line title that needs air.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font-size of the section title only (e.g. "2rem" / "32px"). Default 1.5rem. Size up for a louder hero header.'),
    }),
    slots: ['default'],
    description:
      'Page section band with vertical rhythm and an optional eyebrow/title header. Use to break a page into stacked, breathing sections. Children render below the header.',
    example: { spacing: 'lg', title: 'Features', eyebrow: 'WHY FRAYME' },
  },
};
