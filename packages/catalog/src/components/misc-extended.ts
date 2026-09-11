/**
 * Frayme misc-extended — 3 truly-dynamic components on the established foundation (IconButton · Toast · CodeBlock).
 *
 * Same contract as shadcn-base.ts / _shared.ts: every visual/behavioral selector
 * is a CLOSED enum (the bounded menu a spec draws from); every color VALUE prop
 * is `colorSchema` (a validated string → inline `--fr-<comp>-<role>` var). No
 * prop ever carries className/style/raw HTML; icons are NAMES resolved against the
 * closed icon registry, never raw SVG. Defaults live in the renderer's CVA
 * `defaultVariants`, so every prop here is `.nullable()` and a props-less spec
 * still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 */

import { z } from 'zod';
import { Tone, Font, Weight, Tracking, Leading, Shadow, Motion, colorSchema, dimensionSchema } from './_shared.js';

export const miscExtendedComponents = {
  // =========================================================================
  // IconButton — icon-only button (square; the label IS the accessible name)
  // =========================================================================
  IconButton: {
    props: z.object({
      // CONTENT — both required: the glyph name + the aria-label (icon-only
      // controls MUST carry an accessible name).
      icon: z
        .string()
        .describe('Icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "trash", "settings", "search"). Never raw SVG; unknown names render nothing.'),
      label: z
        .string()
        .describe('Accessible name (aria-label) for the icon-only button — REQUIRED for a11y (e.g. "Delete row").'),
      // ENUM — variant mirrors Button for parity (keeps the danger variant).
      variant: z
        .enum(['primary', 'secondary', 'ghost', 'outline', 'danger'])
        .nullable()
        .describe('Visual hierarchy (mirrors Button): primary (filled, default) · secondary · ghost (transparent until hover, for toolbars) · outline · danger.'),
      tone: Tone.describe('Semantic intent, decoupled from variant: neutral · success · warning · critical · info. Reach for it when the action MEANS something (critical = destructive).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Square control size + icon size together (default md).'),
      radius: z
        .enum(['none', 'sm', 'md', 'lg', 'full'])
        .nullable()
        .describe('Corner rounding (default md; `full` = circular icon button).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 })
        .describe('Exact corner radius (e.g. "10px" or "0.75rem"); overrides the `radius` enum when set.'),
      disabled: z.boolean().nullable().describe('Disable the button: 50% opacity + blocks clicks/keyboard activation (native `disabled` attribute; default false). Also forced true while `loading` is on.'),
      loading: z.boolean().nullable().describe('Swap the icon for a spinner and block interaction (keeps the square footprint).'),
      // VALUE (SC) — value > variant precedence on the fill.
      accent: colorSchema.describe('Custom fill color (overrides the variant fill). Reach for an exact brand color on the button background.'),
      accentText: colorSchema.describe('Text colour of the glyph printed on the `accent` fill — the icon ink paired with `accent` (default the primary-foreground token).'),
      borderColor: colorSchema.describe('Border colour for the `outline` variant (default the border token). Use to tint the outline edge to a brand colour.'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'The button was clicked (blocked while `loading` or `disabled`); params carry {label} — the button\'s aria-label.',
    },
    description:
      'Icon-only button (square). `icon` names a registry glyph; `label` is the required aria-label. `variant` sets hierarchy, `accent` overrides the fill. Reach for IconButton over Button when the affordance is a single glyph with no visible text (e.g. a toolbar close/settings action).',
    example: { icon: 'settings', label: 'Open settings', variant: 'ghost' },
  },

  // =========================================================================
  // Toast — transient corner notification (render-on-condition via openPath)
  // =========================================================================
  Toast: {
    props: z.object({
      // CONTENT
      title: z.string().describe('Toast headline (required, e.g. "Saved"). Short — a few words; the toast is a transient corner notification, not a place for detail.'),
      message: z.string().nullable().describe('Optional one-line supporting detail under the title (e.g. "Your changes are live."). Omit for a title-only toast.'),
      openPath: z
        .string()
        .describe('Boolean state-path that shows the toast (exactly like Dialog.openPath). When the path is falsy the toast renders nothing; setState toggles it.'),
      // ENUM
      tone: Tone.describe('Semantic intent: neutral (default) · success (saved/done) · warning · critical (error) · info. Drives the accent colour: the auto icon + the left accent bar (the bar shows for any non-neutral tone on subtle/outline; solid is already the tone fill).'),
      position: z
        .enum(['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'])
        .nullable()
        .describe('Fixed screen corner the toast docks to (a closed enum → a trusted position:fixed recipe). Default bottom-right.'),
      variant: z
        .enum(['solid', 'subtle', 'outline'])
        .nullable()
        .describe('Fill intensity: solid (high-contrast tone surface) · subtle (plain card surface with a tone-colored icon — the background is not tinted; default) · outline.'),
      duration: z
        .enum(['short', 'normal', 'long', 'sticky'])
        .nullable()
        .describe('Auto-dismiss delay (a closed timing enum, never a raw ms value): short (3s) · normal (5s) · long (8s) · sticky (default — no auto-dismiss, persists until the host flips openPath). When a timed value elapses the toast sets openPath false and emits dismiss with { auto: true }.'),
      dismissible: z.boolean().nullable().describe('Show an × that sets the openPath false (default true).'),
      dismissLabel: z
        .string()
        .nullable()
        .describe('Accessible label (aria-label) for the dismiss button (default "Dismiss"). Escaped text — set for localization.'),
      dismissIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME (closed icon registry) for the dismiss button (default "x"). Unknown/absent → the default glyph; never raw SVG.'),
      icon: z
        .enum(['auto', 'none'])
        .nullable()
        .describe('Leading status icon: auto (picks a glyph from `tone`, default) · none.'),
      // TYPOGRAPHY (closed enum) — overrides the baked title style when set.
      font: Font.describe('Typeface for the whole toast region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Title font weight (default semibold); a closed enum that overrides the baked weight when set.'),
      tracking: Tracking.describe('Letter-spacing of the toast title (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Title line-height (default snug); a closed enum that overrides the baked leading when set.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the toast title (e.g. "20px" / "1.25rem"). Default 0.9375rem.'),
      // ELEVATION (closed enum) — overrides the baked toast drop-shadow when set.
      shadow: Shadow.describe('Drop-shadow depth of the floating toast: none · sm · md · lg · xl; a closed enum that overrides the baked shadow when set.'),
      // MOTION (closed enum) — OPT-IN enter animation when the toast appears.
      motion: Motion.describe('Enter-transition speed for this toast as it appears (fast/normal/slow). Default: no animation — appears instantly.'),
      // VALUE (SC) — value > variant/tone precedence on the surface.
      bg: colorSchema.describe('Custom background fill (overrides the tone/variant surface). Reach for a brand-colored toast.'),
      borderColor: colorSchema.describe('Border colour (default the border token). Pair with a custom `bg` to give the toast a matching branded edge.'),
      accent: colorSchema.describe('Text colour of the leading status icon glyph, and the colour of the 3px left accent bar beside it (overrides the tone colour; setting it always shows the bar).'),
    }),
    events: ['dismiss'],
    eventsDoc: {
      dismiss: 'The toast was dismissed — the × was pressed (only when `dismissible` is on) OR the `duration` timer elapsed (auto-dismiss); both set `openPath` false. Params carry {label} (the toast title) and, on an auto-dismiss, { auto: true }.',
    },
    description:
      'Transient corner notification. Bind `openPath` to a boolean state-path; the toast renders only while truthy and dismisses by setting it false (manually via the ×, or automatically after `duration` when set — default sticky, no auto-dismiss). `tone` colors it + picks the auto icon. Reach for Toast over Banner when the notice is transient/dismissable and docked to a screen corner rather than pinned at the top of the page.',
    example: { title: 'Saved', message: 'Your changes are live.', openPath: 'toastOpen', tone: 'success' },
  },

  // =========================================================================
  // CodeBlock — read-only escaped code (NEVER innerHTML; escaped React text)
  // =========================================================================
  CodeBlock: {
    props: z.object({
      // CONTENT — `code` is rendered as ESCAPED React text, never markup.
      code: z.string().describe('The code to display (required). Rendered as escaped text — never interpreted as HTML.'),
      filename: z.string().nullable().describe('Optional filename shown in the header bar (e.g. "server.ts").'),
      // ENUM — language is a LABEL only (no syntax highlighting; see notes).
      language: z
        .enum([
          'plaintext', 'js', 'ts', 'tsx', 'jsx', 'json', 'bash', 'shell',
          'python', 'html', 'css', 'sql', 'yaml', 'markdown', 'go', 'rust',
        ])
        .nullable()
        .describe('Language LABEL shown in the header (no syntax highlighting yet — purely a tag; default plaintext).'),
      showLineNumbers: z.boolean().nullable().describe('Render a left gutter with 1-based line numbers alongside the code (default false). Turn on for multi-line snippets you want to reference by line; the gutter uses the softer `mutedColor` tint.'),
      wrap: z.boolean().nullable().describe('Soft-wrap long lines instead of horizontal scrolling (default false = scroll).'),
      maxHeight: dimensionSchema({ units: ['px', 'rem', 'vh'], min: 80, max: 1200 })
        .describe('Exact scroll cap on the code body (e.g. "320px" / "60vh"); the code scrolls vertically past it. Default unbounded (the block grows to fit).'),
      size: z.enum(['sm', 'md']).nullable().describe('Code font size + padding density together: sm · md (default). Use `sm` for a tight inline snippet or a dense docs block where vertical space is scarce.'),
      theme: z
        .enum(['auto', 'light', 'dark'])
        .nullable()
        .describe('Surface theme: `auto` (default) follows the page/workspace dark mode like every component · `dark` forces a dark code surface even on a light page (the classic docs code block) · `light` forces a light surface even in dark mode.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the header language label, the copy-button text, and the line-number gutter (the gutter keeps its softer 70% tint of this colour; default the muted-foreground token).'),
      showCopy: z
        .boolean()
        .nullable()
        .describe('Show a copy-to-clipboard button (default true). When a header (filename/language) is present the button sits in the header; when there is NO header a corner button floats over the code so a bare snippet still has copy. Set false to remove the copy affordance entirely.'),
      copyLabel: z
        .string()
        .nullable()
        .describe('Text + aria-label for the copy button in its idle state (default "Copy"). Escaped text — set to localise it.'),
      copiedLabel: z
        .string()
        .nullable()
        .describe('Text + aria-label for the copy button just after copying (default "Copied"). Escaped text — set to localise it.'),
    }),
    description:
      'Read-only code block. Renders `code` as escaped text (never HTML) in a mono <pre><code> with an optional header (filename + language) and a copy button (in the header, or floating in the corner for a headerless block; `showCopy`/`copyLabel`/`copiedLabel` control it). `theme` can force a fixed dark/light surface; no syntax highlighting yet.',
    example: { code: 'const x = 1;\nconsole.log(x);', language: 'ts', filename: 'demo.ts', showLineNumbers: true },
  },
};
