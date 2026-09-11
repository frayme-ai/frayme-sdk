/**
 * Frayme feedback-extended — 6 schemas: page-level notices + outcome screens.
 *
 * Same truly-dynamic contract as the shipped catalog: bounded ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema`
 * for color; no dimension channels are needed here). Every enum/value prop is
 * `.nullable()` + `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA
 * `defaultVariants`, so a props-less spec still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE).
 *
 * Components: Banner · Callout · InlineMessage · LoadingOverlay · NotFound · Result.
 *
 * The two dismissible notices (Banner, Callout) own internal `dismissed` state
 * in the renderer (a self-state hide that returns null + emits `dismiss`), so a
 * × works out of the box without a binding. LoadingOverlay's `active` flag rides
 * `useLocalOrBound`, so it stays reactive when bound and defaults shown when not.
 * (`active`, not `visible` — `visible` is a reserved json-render element field.)
 */

import { z } from 'zod';
import { BorderStyle, colorSchema, dimensionSchema, Font, Weight, Tracking, Leading } from './_shared.js';

// URL-scheme guard (defense-in-depth alongside the renderer's runtime
// sanitization): reject specs carrying javascript:/data:/vbscript:/file: in a
// navigable href. Mirrors the helper in data-display-extended.ts (kept local —
// no dep added). Control chars are stripped so `java\tscript:` can't slip past.
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeHref = (s: string): boolean =>
  !/^\s*(javascript|data|vbscript|file):/i.test(stripWhitespace(s));

const safeHref = z
  .string()
  .refine(isSafeHref, 'href uses an unsafe URL scheme')
  .nullable();

export const feedbackExtendedComponents = {
  // =========================================================================
  // Banner — full-width page-level notice
  // =========================================================================
  Banner: {
    props: z.object({
      message: z.string().describe('The notice body (required). One sentence — the banner is a single-line strip, so keep it short enough to read at a glance.'),
      title: z.string().nullable().describe('Optional bold lead line above the `message` (e.g. "Maintenance scheduled"). Rendered at the `weight` semibold default; omit for a message-only strip.'),
      tone: z
        .enum(['neutral', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic color of the banner via token (default neutral). Use `critical` for outages, `success` for confirmations, `info` for a blue informational tint.'),
      icon: z
        .string()
        .nullable()
        .describe('Leading status glyph: "auto" (derive from tone), "none" (hide), or a NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "info", "alert-triangle"). Never raw SVG; unknown names render nothing.'),
      actionLabel: z.string().nullable().describe('Label for an optional trailing call-to-action. Omit for a plain notice.'),
      actionHref: safeHref.describe('Make the action a navigable link; omit to make it a button that emits `commit`. Only used when `actionLabel` is set.'),
      actionExternal: z.boolean().nullable().describe('When `actionHref` is set: open in a new tab (target=_blank + rel=noopener noreferrer).'),
      dismissible: z
        .boolean()
        .nullable()
        .describe('Show a trailing × that hides the banner and emits `dismiss`. Reach for this on dismissable announcements.'),
      dismissed: z
        .boolean()
        .nullable()
        .describe('Whether the banner has been closed; the component writes true here on dismiss so the closed state is readable from spec.state without replaying the dismiss event. Bind with { $bindState } to read/persist it, or seed true to start hidden.'),
      dismissLabel: z
        .string()
        .nullable()
        .describe('Accessible label for the dismiss × button (default "Dismiss"). Set for localisation. Only used when `dismissible` is on.'),
      dismissIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME (closed icon registry) for the dismiss affordance (default "x"). Unknown/absent names fall back to the default ×. Never raw SVG.'),
      align: z
        .enum(['start', 'center'])
        .nullable()
        .describe('Content alignment across the full width: start (left, default) · center (centered announcement bar).'),
      bg: colorSchema.describe('Exact background fill (brand banner). Wins over tone. Flips the whole surface on-fill: the copy reads `color` and the icon + action follow it unless an explicit `accent` is set — pair with `color` (+ optionally `accent`) to brand the surface.'),
      borderColor: colorSchema.describe('Border colour (default the tone/border token). Pair with a custom `bg` to brand the whole surface.'),
      accent: colorSchema.describe('Text colour of the leading status icon and of the trailing action label — the action\'s outline follows it via currentColor (default the tone token; on a custom `bg` both follow the on-fill text unless this is set).'),
      color: colorSchema.describe('Text colour of the banner title + message copy. On a custom `bg` the ink is derived from that fill\'s luminance unless set; on the plain tone surface (no `bg`) it recolours the copy over the inherited foreground. Set independently of `bg` — a text-only recolour is supported.'),
      font: Font.describe('Typeface for the whole banner region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the title + message text (default semibold title, normal message). Set to override the baked weight.'),
      tracking: Tracking.describe('Letter-spacing of the title + message text (default normal). Use `tight` to condense or `wide` for an airier announcement bar.'),
      leading: Leading.describe('Line-height of the title + message text (default snug). Bump to `normal`/`relaxed` when the message wraps to multiple lines.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the banner title (e.g. "20px" / "1.25rem"). Default 0.9375rem.'),
    }),
    events: ['commit', 'dismiss'],
    eventsDoc: {
      commit: 'The trailing action button was pressed (no `actionHref` set); params carry {label} — the action label.',
      dismiss: 'The × was pressed (self-hides — `dismissible` must be on); params carry {label} — the banner title, if set.',
    },
    description:
      'A full-width, page-level notice bar: leading status icon + optional title + message, with an optional trailing action and a dismiss ×. `tone` colors it by intent; set `dismissible` for a × that hides it and emits `dismiss`. The action renders an <a> when `actionHref` is set, else a button that emits `commit`. Place at the top of a page/section — reach for Callout instead for an in-content note, or Toast for a transient auto-dismissing corner notification. Bind `dismissed` with `{ $bindState }` so the agent (or a sibling control) can read whether the banner has been closed from spec.state.',
    example: { message: 'Scheduled maintenance this Sunday 02:00–04:00 UTC.', tone: 'warning', dismissible: true },
  },

  // =========================================================================
  // Callout — emphasised in-content boxed note
  // =========================================================================
  Callout: {
    props: z.object({
      message: z.string().nullable().describe('The note body (or pass rich content via children/the default slot).'),
      title: z.string().nullable().describe('Optional bold heading above the body (e.g. "Heads up"). Short — a few words, not a sentence.'),
      tone: z
        .enum(['neutral', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic color via token (default info). Use `warning`/`critical` for cautions, `info` for tips.'),
      icon: z
        .string()
        .nullable()
        .describe('Leading status glyph: "auto" (derive from tone), "none" (hide), or a NAME from the closed icon registry (or a single emoji glyph, rendered as-is). Never raw SVG; unknown names render nothing.'),
      variant: z
        .enum(['subtle', 'solid', 'outline', 'left-accent'])
        .nullable()
        .describe('Surface treatment: subtle (tinted, default) · solid (high-contrast filled) · outline (border only) · left-accent (tinted with a thick left bar).'),
      dismissible: z
        .boolean()
        .nullable()
        .describe('Show a × that hides the callout and emits `dismiss`.'),
      dismissed: z
        .boolean()
        .nullable()
        .describe('Bindable dismissed state — the × writes true here into spec.state (bind with { $bindState }) so a host/agent can read or drive whether the callout was closed; also sets the initial hidden state (true = start hidden). Only meaningful with `dismissible` on.'),
      dismissLabel: z
        .string()
        .nullable()
        .describe('Accessible label for the dismiss × button (default "Dismiss"). Set for localisation. Only used when `dismissible` is on.'),
      dismissIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME (closed icon registry) for the dismiss affordance (default "x"). Unknown/absent names fall back to the default ×. Never raw SVG.'),
      bg: colorSchema.describe('Exact background fill of the callout surface (default the tone/variant-derived tint). Wins over `tone` and `variant`; set it to brand the note, and pair with `color` for legible copy.'),
      borderColor: colorSchema.describe('Border colour (default the tone/variant-derived border). Pair with a custom `bg` to brand the whole surface.'),
      accent: colorSchema.describe('Text colour of the leading icon glyph, and the colour of the thick left bar on `variant:\'left-accent\'`; on `variant:\'solid\'` the same value is instead the background fill of the whole note, and on subtle/left-accent it also tints the surface at 8% (default the tone token).'),
      color: colorSchema.describe('Text colour of the callout title + body copy. On a non-solid variant it recolours the copy over the tone surface (foreground-token default) — settable independently of `bg`; on the `solid` variant it is the on-fill text (default white). Set a dark value when a solid warning/light accent fill needs contrast.'),
      borderStyle: BorderStyle.describe('Border line style of the callout frame: solid (default) · dashed · dotted. Reach for dashed/dotted to make a softer, draft-y note.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact border thickness of the callout frame in px (e.g. "2px"; default 1px). Does not affect the left-accent bar.'),
      font: Font.describe('Typeface for the whole callout region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the title + body text (default semibold title, normal body). Set to override the baked weight.'),
      tracking: Tracking.describe('Letter-spacing of the title + body text (default normal). Use `tight` to condense or `wide` to loosen the note.'),
      leading: Leading.describe('Line-height of the title + body text (default snug title, relaxed body). Set to tighten or open up the copy.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the callout title (e.g. "20px" / "1.25rem"). Default 0.9375rem.'),
    }),
    slots: ['default'],
    events: ['dismiss'],
    eventsDoc: {
      dismiss: 'The × was pressed (self-hides — `dismissible` must be on); params carry {label} — the callout title, if set.',
    },
    description:
      'An emphasised in-content note (boxed): leading icon + optional title + body (the `message` prop OR children). `tone` colors it by intent and `variant` picks the surface treatment. Set `dismissible` for a × that hides it and emits `dismiss`. Use inline within a page to flag a tip/warning — NOT as a page-level Banner. Bind `dismissed` with `{ $bindState }` so the agent (or a sibling control) can read whether the callout has been closed from spec.state.',
    example: { title: 'Heads up', message: 'API keys are shown only once — copy it now.', tone: 'warning', variant: 'left-accent' },
  },

  // =========================================================================
  // InlineMessage — compact inline status line
  // =========================================================================
  InlineMessage: {
    props: z.object({
      message: z.string().describe('The status text (required). Keep to a short phrase or one clause — this is a single-line field/row-level hint, not a paragraph.'),
      tone: z
        .enum(['neutral', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic color of the text + icon via token (default neutral). Use `critical` for a field error, `success` for a valid hint.'),
      icon: z
        .string()
        .nullable()
        .describe('Leading glyph: "auto" (derive from tone), "none" (hide), or a NAME from the closed icon registry (or a single emoji glyph, rendered as-is). Never raw SVG; unknown names render nothing.'),
      size: z.enum(['sm', 'md']).nullable().describe('Text + icon scale (default md). Use `sm` for a tight field-level hint.'),
      color: colorSchema.describe('Text colour of the message and its leading icon, recoloured together as one role (default the `tone` token). Set to override the semantic tone colour — e.g. a brand hint that should not read as success/error.'),
      font: Font.describe('Typeface for the whole inline message; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the message text (light · normal · medium · semibold · bold; default normal).'),
      tracking: Tracking.describe('Letter-spacing of the message text (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the message text (tight · snug · normal · relaxed · loose; default snug).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the message text (e.g. "13px" / "0.875rem"). Default 0.875rem (0.8125rem when size=sm); wins over `size`.'),
    }),
    description:
      'A compact, single-line inline status message (field/row level): a small leading icon + tinted text. Display-only. Reach for this under a form field, in a table cell, or beside a control — NOT for a page-level Banner.',
    example: { message: 'Username is available', tone: 'success' },
  },

  // =========================================================================
  // LoadingOverlay — dimming scrim + spinner over a region
  // =========================================================================
  LoadingOverlay: {
    props: z.object({
      active: z
        .boolean()
        .nullable()
        .describe('Whether the loading scrim + spinner are shown over the region (default true). Bind this to a loading flag, or toggle it locally. (Named `active`, not `visible` — `visible` is a reserved json-render element field.)'),
      label: z.string().nullable().describe('Optional status text shown under the spinner (e.g. "Saving…").'),
      blur: z.boolean().nullable().describe('Blur the covered region behind the scrim while loading.'),
      spinnerSize: z.enum(['sm', 'md', 'lg']).nullable().describe('Spinner diameter + border thickness: sm (20px, 2px border) · md (32px, 2px border, default) · lg (48px, 3px border).'),
      overlayColor: colorSchema.describe('Background colour of the dimming scrim painted over the covered region while `active` — it is the ground the spinner and `label` sit on (default a 60% translucent background-token wash).'),
      color: colorSchema.describe('Text colour of the status label under the spinner, and the colour of the spinner\'s leading arc — one role, recoloured together (spinner arc defaults to the primary token, label to the foreground token).'),
    }),
    slots: ['default'],
    description:
      'A loading scrim that dims a region (its children) and centers a spinner + optional label while `active`. The region always renders; when `active` the scrim sits on top (role=status, aria-busy). Wrap a card/panel/table whose content is loading. `active` is reactive out of the box (toggles locally when unbound, syncs when bound).',
    example: { active: true, label: 'Loading…' },
  },

  // =========================================================================
  // NotFound — 404 / empty-route panel
  // =========================================================================
  NotFound: {
    props: z.object({
      title: z.string().describe('The headline (required, e.g. "Page not found"). Short — the leading message on an otherwise empty screen.'),
      code: z.string().nullable().describe('Large status code shown above the title (e.g. "404", "403").'),
      description: z.string().nullable().describe('Supporting copy explaining what is missing / what to do next.'),
      icon: z
        .string()
        .nullable()
        .describe('Illustrative glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "search", "alert-circle"). Never raw SVG; unknown names render nothing.'),
      actionLabel: z.string().nullable().describe('Label for an optional call-to-action (e.g. "Go home"). Omit for no action.'),
      actionHref: safeHref.describe('Make the action a navigable link; omit to make it a button that emits `commit`. Only used when `actionLabel` is set.'),
      actionExternal: z.boolean().nullable().describe('When `actionHref` is set, open the link in a new tab (adds target=_blank + rel=noopener noreferrer). Default false — same-tab navigation. Only used with `actionHref`.'),
      align: z
        .enum(['center', 'start'])
        .nullable()
        .describe('Content alignment: center (default — classic centered 404) · start (left-aligned).'),
      bg: colorSchema.describe('Panel background fill (default transparent/the page surface). Set to brand the not-found panel.'),
      color: colorSchema.describe('Primary text colour — the title (default the foreground token). Pair with a custom `bg` so the title stays legible.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the large status code, the description copy, and the illustrative icon glyph (default the muted-foreground token).'),
      accent: colorSchema.describe('Background fill of the call-to-action button — its label always prints in the card token, so pick a value dark enough to carry that ink (default the foreground token). Completes the panel brand group with `bg` + `color`.'),
      font: Font.describe('Typeface for the whole not-found panel; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the title (default semibold). Reach for `bold` for a heavier headline or `medium` for a lighter one.'),
      tracking: Tracking.describe('Letter-spacing of the title (default normal). Use `tight`/`tighter` to condense the headline or `wide` for an airier look.'),
      leading: Leading.describe('Line-height of the title (default normal). Bump to `relaxed` when the title wraps to multiple lines.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the title (e.g. "28px" / "1.75rem"). Default 1.375rem.'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'The call-to-action button was pressed (no `actionHref` set); params carry {label} — the action label.',
    },
    description:
      'A 404 / not-found route panel: an optional large status code, a title + description, an illustrative icon, and an optional call-to-action. The action renders an <a> when `actionHref` is set, else a button that emits `commit`. Use as a full-route placeholder when a page/resource is missing — reach for Result instead when reporting the outcome of a completed action (payment, submission) rather than a missing route.',
    example: { code: '404', title: 'Page not found', description: 'The page you are looking for does not exist.', actionLabel: 'Go home', actionHref: '/' },
  },

  // =========================================================================
  // Result — full-region success / fail / status outcome screen
  // =========================================================================
  Result: {
    props: z.object({
      title: z.string().describe('The outcome headline (required, e.g. "Payment successful"). Short — states the result plainly, paired with the status icon/color.'),
      status: z
        .enum(['success', 'error', 'warning', 'info', 'pending'])
        .nullable()
        .describe('Outcome that drives a big tone-colored status icon (default info): success (check) · error (alert) · warning · info · pending (spinner). Pick by the result of the operation.'),
      description: z.string().nullable().describe('Supporting copy under the title explaining the outcome / next steps.'),
      icon: z
        .string()
        .nullable()
        .describe('Override the auto status glyph with a NAME from the closed icon registry (or a single emoji glyph, rendered as-is). Omit to derive it from `status`. Never raw SVG; unknown names render nothing.'),
      actions: z
        .array(
          z.object({
            label: z.string(),
            href: safeHref.describe('Navigable target; omit to make this action a button that emits `commit`.'),
            external: z.boolean().nullable().describe('Open the href in a new tab.'),
            variant: z
              .enum(['primary', 'secondary'])
              .nullable()
              .describe('Visual emphasis of this action (default primary for the first, secondary otherwise).'),
          }),
        )
        .nullable()
        .describe('Optional list of outcome actions (e.g. "View order", "Go back"). Each renders an <a> when `href` is set, else a button that emits `commit`.'),
      activeAction: z
        .string()
        .nullable()
        .describe('Write target for WHICH action the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting `commit`, so the host can attribute the action. Emit-only when unbound.'),
      align: z
        .enum(['center', 'start'])
        .nullable()
        .describe('Content alignment: center (default — classic outcome screen) · start (left-aligned).'),
      bg: colorSchema.describe('Panel background fill (default transparent/the page surface). Set to brand the outcome screen.'),
      color: colorSchema.describe('Primary text colour — the title + secondary action text (default the foreground token). Pair with a custom `bg` so the copy stays legible.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the description copy under the title (default the muted-foreground token).'),
      accent: colorSchema.describe('Background fill of the primary action button(s) — the label always prints in the card token, so pick a value dark enough to carry that ink (default the foreground token). Completes the panel brand group with `bg` + `color`.'),
      font: Font.describe('Typeface for the whole outcome screen; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the title (default semibold). Reach for `bold` for a heavier outcome headline or `medium` for a lighter one.'),
      tracking: Tracking.describe('Letter-spacing of the title (default normal). Use `tight`/`tighter` to condense the headline or `wide` for an airier look.'),
      leading: Leading.describe('Line-height of the title (default tight). Bump to `snug`/`normal` when the title wraps to multiple lines.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the title (e.g. "32px" / "2rem"). Default 1.5rem.'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'An action button without an `href` was pressed; params carry {label, index} — the pressed button\'s label and its position in `actions`. `activeAction` (when bound) is written first so the host can attribute which button fired.',
    },
    description:
      'A full-region outcome screen: a big tone-colored status icon driven by `status` (success/error/warning/info/pending), a title + description, and an optional row of actions. The status is conveyed by icon + color + text (never color alone). Use after a completed operation (payment, submission, deploy) to show the result — reach for NotFound instead for a missing route/resource, not the outcome of a completed action. Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which action label (or index) the user triggered from spec.state.',
    example: { status: 'success', title: 'Payment successful', description: 'Your order is confirmed.', actions: [{ label: 'View order' }] },
  },
};
