/**
 * Frayme util-overlay — 5 inline overlay / text utilities on the locked dynamic
 * foundation.
 *
 * Same locked contract as the rest of the catalog: bounded ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for a
 * color, `dimensionSchema` for a length). Every enum/value prop is `.nullable()`
 * + `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants`, so a
 * props-less spec still renders polished.
 *
 * These are mostly INLINE (no portal) — flat-spec + SSR friendly. Disclosure
 * state is local; click-triggered popovers add outside-click + Escape close.
 * Highlight / Kbd render ESCAPED React text only — NEVER innerHTML.
 *
 * SECURITY: no className/style/html/raw prop; no spec text ever reaches
 * innerHTML. A model-named color flows through `colorSchema` → the renderer's
 * `--fr-<comp>-<role>` var (re-validated at point-of-use). The reserved
 * json-render field `visible` is NEVER a prop name — the scrim toggle is
 * `active`.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 *
 * Components: Toggletip · Backdrop · HoverCard · Kbd · Highlight.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Font, Leading, Motion, Shadow, Tone, Tracking, Weight } from './_shared.js';

/* The shared "which side does the bubble/card open" ENUM — a bounded menu, never
 * a value. */
const sideSchema = z
  .enum(['top', 'bottom', 'left', 'right'])
  .nullable()
  .describe('Which side of the trigger the bubble/card opens on (default top for Toggletip, bottom for HoverCard).');

export const utilOverlayComponents = {
  // =========================================================================
  // Toggletip — click-to-reveal info bubble (accessible alt to a tooltip)
  // =========================================================================
  Toggletip: {
    props: z.object({
      label: z
        .string()
        .nullable()
        .describe('Text label on the trigger button. When omitted, the `icon` glyph is shown instead.'),
      icon: z
        .string()
        .nullable()
        .describe('Registry icon name for the trigger when there is no `label` (default an info circle).'),
      content: z.string().nullable().describe('The text shown inside the revealed bubble — the help/explanation the trigger discloses. Keep it to a sentence or two of escaped plain text; it only appears while the tip is toggled open.'),
      ariaLabel: z
        .string()
        .nullable()
        .describe('Accessible name (aria-label) for the icon-only trigger when there is no `label` (default "More information"). Escaped text — set for localization.'),
      side: sideSchema,
      accent: colorSchema.describe('Accent color for the trigger glyph (default the foreground token) + bubble border (default the border token).'),
      color: colorSchema.describe('Primary text colour for the bubble body (default the foreground token).'),
      shadow: Shadow.describe('Drop-shadow depth of the floating bubble — set to lift or flatten it (default lg).'),
      motion: Motion.describe('Enter-transition speed for the revealed bubble (fast/normal/slow). Default: no animation — appears instantly.'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Trigger button + bubble scale: sm (h-6) · md (h-7, default) · lg (h-8). Also sets the bubble\'s max-width.'),
    }),
    description:
      'A click-to-reveal info bubble anchored to a small trigger button — the accessible, keyboard-dismissable alternative to a hover-only tooltip (works on touch, supports Escape/outside-click to close). Prefer HoverCard when the reveal should be a richer title+description+image preview, or a native browser `title` tooltip when no interaction/accessibility guarantee is needed. Shows the `icon` glyph when `label` is unset; content only appears while toggled open.',
    example: { label: 'Pricing', content: 'Charges renew monthly. Cancel anytime.' },
  },

  // =========================================================================
  // Backdrop — a dimming scrim over a region (generic modal/drawer underlay)
  // =========================================================================
  Backdrop: {
    props: z.object({
      active: z
        .boolean()
        .nullable()
        .describe('When true, the scrim covers the children (the generic dimmer; use instead of the reserved `visible`).'),
      blur: z
        .enum(['none', 'sm', 'md', 'lg'])
        .nullable()
        .describe('Backdrop blur strength behind the scrim (default sm).'),
      overlayColor: colorSchema.describe('Scrim tint color (default neutral black). Composes with `opacity` — the tint is mixed to that translucency, so it never paints fully opaque on its own.'),
      opacity: z
        .enum(['light', 'medium', 'heavy'])
        .nullable()
        .describe('How opaque the scrim is: light (25%) · medium (45%, default) · heavy (65%). Also applies to a custom `overlayColor` (the tint is mixed at this level).'),
      label: z.string().nullable().describe('Optional centered caption shown over the scrim while active.'),
      zone: z
        .enum(['fill', 'inset', 'rounded'])
        .nullable()
        .describe('Scrim coverage: fill the wrapper (default) · inset (padded) · rounded (matches a rounded card).'),
    }),
    description:
      'A dimming scrim layered over its children, toggled by `active` — the generic underlay for a modal/drawer/loading state (no spinner of its own; pair `label` with a caption like "Saving…"). Prefer this over baking a translucent overlay into a specific component, since it composes with any children and centralizes the scrim/blur/zone behavior. Purely visual — it does not trap focus or block interaction itself.',
    example: { active: true, label: 'Saving…' },
  },

  // =========================================================================
  // HoverCard — reveal a rich card on hover / focus
  // =========================================================================
  HoverCard: {
    props: z.object({
      trigger: z
        .string()
        .nullable()
        .describe('Trigger label text. When omitted, the first child is used as the trigger.'),
      title: z.string().nullable().describe(
        'Bold heading line inside the revealed card (e.g. a name or title). Truncates to one line if too long.',
      ),
      description: z.string().nullable().describe(
        'Muted body text inside the revealed card, under `title` (e.g. a short bio). Clamped to 3 lines.',
      ),
      imageSrc: z
        .string()
        .nullable()
        .describe('Optional avatar/preview image URL shown in the card (http/https or raster data URI only).'),
      side: sideSchema,
      accent: colorSchema.describe('Accent color for the trigger underline (default currentColor, i.e. it matches the trigger text until set) + card border (default the border token).'),
      color: colorSchema.describe('Primary text colour for the card title (default the foreground token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the card description line (default the muted-foreground token).'),
      shadow: Shadow.describe('Drop-shadow depth of the floating preview card — set to lift or flatten it (default lg).'),
      motion: Motion.describe('Enter-transition speed for the revealed card (fast/normal/slow). Default: no animation — appears instantly.'),
    }),
    description:
      'A trigger (text label or wrapped children) that reveals a rich preview card — title + description + optional avatar image — on hover or keyboard focus. Choose this over Toggletip when the reveal has structured content (a person/entity preview) rather than a single line of help text; unlike Toggletip it opens passively on hover/focus, not click. Set `trigger` for a plain text anchor, or drop children into the slot to make an arbitrary element the hover target; the `description` clamps to 3 lines so keep the preview copy tight.',
    example: { trigger: '@frayme', title: 'Frayme', description: 'Ship MCP Apps without code.' },
  },

  // =========================================================================
  // Kbd — a keyboard-key glyph
  // =========================================================================
  Kbd: {
    props: z.object({
      keys: z
        .union([z.string(), z.array(z.string())])
        .nullable()
        .describe('A single key string or an ordered array of keys (e.g. ["Cmd","K"]); joined with a thin "+" separator.'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Key chip height + text size: sm (h-5, 11px) · md (h-6, 12px, default) · lg (h-7, 14px).'),
      variant: z
        .enum(['solid', 'outline'])
        .nullable()
        .describe('Chip style: solid (filled muted background + 3D key-lip shadow, default) · outline (bordered, transparent background).'),
      color: colorSchema.describe('Primary text colour for the key glyphs on the chips (default the foreground token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour for the "+" separators between keys (default the muted-foreground token).'),
      borderColor: colorSchema.describe('Border colour for the key chips, including the solid variant’s 3D key-lip shadow (default the border token).'),
      bg: colorSchema.describe('Fill colour for the solid-variant key chips (default the muted token). Ignored on the outline variant (transparent chips).'),
      font: Font.describe('Typeface for the whole shortcut region incl. the chips (sans · serif · mono · rounded · display; default sans). `mono` is a natural fit for key glyphs.'),
    }),
    description:
      'Renders one or more keyboard keys as styled `<kbd>` chips joined by "+" (e.g. "Cmd + K") — for documenting shortcuts inline in text or a command palette. Pass `keys` as a single string or an ordered array; renders escaped text only, never markup. `font`/`bg`/`color`/`borderColor` style the region and chips.',
    example: { keys: ['Cmd', 'K'] },
  },

  // =========================================================================
  // Highlight — mark matched substrings within text (search results)
  // =========================================================================
  Highlight: {
    props: z.object({
      text: z.string().nullable().describe(
        'The full text to display, with `query` matches wrapped in `<mark>` (e.g. a search-result snippet). Empty renders nothing.',
      ),
      query: z
        .string()
        .nullable()
        .describe('The substring(s) to mark; space-split into multiple terms. Empty → plain text, no marks.'),
      caseSensitive: z
        .boolean()
        .nullable()
        .describe('Match the query case-sensitively (default false — case-insensitive).'),
      wholeWord: z
        .boolean()
        .nullable()
        .describe('Only mark matches that are whole words (default false — substring matches).'),
      tone: Tone.describe(
        'Preset mark background when no `accent` is set: neutral (muted) · success · warning (default, amber) · critical · info. Ignored once `accent` is set.',
      ),
      accent: colorSchema.describe('Background color for the marked spans (default a translucent warning token).'),
      accentText: colorSchema.describe('Text colour ON the marked spans, paired with `accent` (default the foreground token) — set it to keep a saturated highlight legible.'),
      font: Font.describe('Typeface for the whole highlighted-text region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the displayed text (light · normal · medium · semibold · bold; default inherited from the surrounding text).'),
      tracking: Tracking.describe('Letter-spacing of the displayed text (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the displayed text (tight · snug · normal · relaxed · loose; default inherited).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the displayed text (e.g. "20px" / "1.25rem"). Default inherited from the surrounding text.'),
    }),
    description: 'Wraps every `query` match inside `text` in <mark> spans — reach for it to highlight the search terms within a result snippet or any matched string. The `query` is space-split into multiple terms and matched case-insensitively by default (flip `caseSensitive`/`wholeWord` to tighten it). Renders escaped React text only, never innerHTML, and tint the marks via the `tone` preset or an exact `accent`/`accentText` color.',
    example: { text: 'The quick brown fox', query: 'quick' },
  },
} as const;
