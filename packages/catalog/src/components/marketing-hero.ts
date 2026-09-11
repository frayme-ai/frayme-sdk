/**
 * Frayme marketing-hero — 5 schemas for top-of-page marketing bands.
 *
 * Rides the SAME established foundation as the shipped
 * components: bounded ENUM atoms from `_shared.ts` (the bounded menu a spec draws from)
 * + the two validated VALUE channels (`colorSchema` for color, `dimensionSchema`
 * where a real CSS length is wanted). Every enum/value prop is `.nullable()` +
 * `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants`, so a
 * props-less spec still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 *
 * Components: Hero · CTA · FeatureGrid · FeatureCard · LogoCloud.
 *
 * Conventions:
 *  - Background COLORS (`bg`/`gradientFrom`/`gradientTo`/`accent`) are VALUE
 *    channels → `--fr-*` vars in the renderer (never classes). `maxWidth` is the
 *    Container-style ENUM (sm|md|lg|full), NOT a value channel.
 *  - Action buttons carry a navigable `href` (rendered as a guarded <a>) OR no
 *    href (rendered as a <button> that emits the band's `commit` event). `variant`
 *    is the bounded button menu; `icon` is a closed-registry glyph NAME.
 *  - Image sources are validated raster-only at the renderer (safeImageSrc); a
 *    failed/absent src degrades to a tinted placeholder, never a broken <img>.
 */

import { z } from 'zod';
import { Aspect, BorderStyle, colorSchema, dimensionSchema, Font, Leading, Tracking, Weight } from './_shared.js';

// URL-scheme guard (defense-in-depth alongside the renderer's runtime
// sanitization): reject specs carrying javascript:/data:/vbscript:/file: in a
// navigable href. Mirrors the helper in data-display-extended.ts (kept local —
// no dep added). Control chars are stripped so `java\tscript:` can't slip past.
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeHref = (s: string): boolean =>
  !/^\s*(javascript|data|vbscript|file):/i.test(stripWhitespace(s));

/** One CTA button inside a Hero/CTA band. */
const actionSchema = z.object({
  label: z.string(),
  href: z
    .string()
    .refine(isSafeHref, 'href uses an unsafe URL scheme')
    .nullable()
    .describe('Navigable destination → renders an <a>. Omit to render a <button> that emits the band `commit` event.'),
  external: z
    .boolean()
    .nullable()
    .describe('When `href` is set: open in a new tab (adds target=_blank + rel=noopener noreferrer + an external glyph).'),
  variant: z
    .enum(['primary', 'secondary', 'outline', 'ghost'])
    .nullable()
    .describe('Button emphasis: primary (filled, default for the first action) · secondary (muted) · outline · ghost.'),
  icon: z
    .string()
    .nullable()
    .describe('Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "arrow-right", "sparkles"). Never raw SVG; unknown names render nothing.'),
});

/** One feature in a FeatureGrid `features` array. */
const featureSchema = z.object({
  icon: z
    .string()
    .nullable()
    .describe('Feature icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "sparkles", "lock"). Never raw SVG; unknown names render nothing.'),
  title: z.string(),
  description: z.string().nullable().describe('Supporting copy under the feature title.'),
});

/** One logo in a LogoCloud `items` array. */
const logoSchema = z.object({
  src: z.string().nullable().describe('Logo image URL (raster only; svg/data-svg rejected). A failed/absent src degrades to the alt text.'),
  alt: z.string(),
  href: z
    .string()
    .refine(isSafeHref, 'href uses an unsafe URL scheme')
    .nullable()
    .describe('Optional link wrapping the logo (rendered as a guarded <a>).'),
});

export const marketingHeroComponents = {
  // =========================================================================
  // Hero — top-of-page marketing band
  // =========================================================================
  Hero: {
    props: z.object({
      eyebrow: z.string().nullable().describe('Small uppercase kicker above the headline (e.g. a category/announcement label).'),
      title: z.string().describe('The headline (required). Keep to one short punchy sentence or fragment — the largest text on the band, so avoid wrapping past 2 lines.'),
      subtitle: z.string().nullable().describe('Supporting paragraph under the headline that expands on the value proposition (default none). Keep it to one or two sentences — the headline carries the punch, this adds the detail.'),
      align: z
        .enum(['left', 'center'])
        .nullable()
        .describe('Text + content alignment of the band: left (default — pairs with end/start media) · center (centered hero).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Vertical padding + headline scale (default md). Use `lg` for a full landing hero.'),
      font: Font.describe('Typeface for the whole hero band; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the headline (default bold). Set to override the baked headline weight.'),
      tracking: Tracking.describe('Letter-spacing of the headline (default tight). Set to tighten or loosen the headline tracking.'),
      leading: Leading.describe('Line height of the headline (default tight). Set to open up or compress the headline leading.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the headline (e.g. "40px" / "2.5rem"). Default set by `size` (md → 2.5rem).'),
      mediaSrc: z
        .string()
        .nullable()
        .describe('Hero image URL (raster only; svg/data-svg rejected). Placement controlled by `mediaPosition`; a failed/absent src degrades to a tinted placeholder.'),
      mediaPosition: z
        .enum(['end', 'start', 'background', 'none'])
        .nullable()
        .describe('Where the image sits: end (right of the copy, default) · start (left) · background (full-bleed behind, copy overlaid) · none (no media).'),
      mediaAspect: Aspect.describe('Lock the end/start hero image to a fixed aspect ratio (default unset — height-clamped at max-h; no effect on the background placement).'),
      actions: z
        .array(actionSchema)
        .nullable()
        .describe('Row of CTA buttons. Each with `href` renders an <a>; each without renders a <button> that emits `commit`. First action defaults to primary.'),
      activeAction: z
        .string()
        .nullable()
        .describe('Write target for WHICH action the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting `commit`, so the host can attribute the action. Emit-only when unbound.'),
      maxWidth: z
        .enum(['sm', 'md', 'lg', 'full'])
        .nullable()
        .describe('Max content width of the band (Container scale): sm · md · lg (default) · full (edge-to-edge).'),
      bg: colorSchema.describe('Solid band background fill. Wins when set; otherwise the card/gradient default.'),
      gradientFrom: colorSchema.describe('Start colour of the band\'s background gradient (top-left). Pair with `gradientTo`; a solid `bg` wins over the gradient.'),
      gradientTo: colorSchema.describe('End colour of the band\'s background gradient (bottom-right). Pair with `gradientFrom`; a solid `bg` wins over the gradient.'),
      accent: colorSchema.describe('Background fill of the primary CTA button, and the colour of the eyebrow kicker above the headline (default the primary token). The headline reads `color`, not `accent`.'),
      accentText: colorSchema.describe('Text colour on the accent-filled primary CTA button (default the on-primary token). Set when a saturated `accent` needs a legible label.'),
      color: colorSchema.describe('Text colour of the headline and subtitle, and of the secondary/outline/ghost action-button labels (and the outline button\'s border) on a custom surface. Defaults to the theme foreground on a plain band and to a light on-fill token when `bg`, a gradient, or background media paints the band.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the subtitle paragraph on the default (non-surface) band (default the muted-foreground token).'),
      overlayColor: colorSchema.describe('Scrim tint over a `mediaPosition:"background"` image (default the page background token). Set a dark value so the light on-image copy stays legible over an arbitrary photo. No effect unless the media is placed as a background.'),
      overlayOpacity: z
        .enum(['none', 'light', 'medium', 'heavy'])
        .nullable()
        .describe('Strength of the background-media scrim: none (0%) · light (30%) · medium (60%, default) · heavy (80%). Pairs with `overlayColor` for contrast over the photo. No effect unless the media is placed as a background.'),
    }),
    slots: ['default'],
    events: ['commit'],
    eventsDoc: {
      commit: 'An action button without an `href` was pressed; params carry {label, index, href}: the pressed button\'s text, its 0-based position in the `actions` array (disambiguates duplicate/null labels), and its `href` (null for an emitting button). `activeAction` (when bound) is written first so the host can attribute which button fired.',
    },
    description:
      'A marketing hero band: eyebrow + headline + subtitle + a row of CTA buttons, with an optional image (end/start/background) or custom body (children). Background can be a solid `bg` or a `gradientFrom`/`gradientTo` gradient; a background image can carry a tinted `overlayColor`/`overlayOpacity` scrim for contrast. CTAs with `href` navigate; CTAs without one emit `commit`. Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which CTA label (or index) the user triggered from spec.state.',
    example: {
      eyebrow: 'New',
      title: 'Ship MCP apps without code',
      subtitle: 'Generate interactive AI apps from natural language and deploy them to Claude and ChatGPT.',
      actions: [
        { label: 'Get started', variant: 'primary', icon: 'arrow-right' },
        { label: 'View docs', href: '/docs', variant: 'outline' },
      ],
    },
  },

  // =========================================================================
  // CTA — focused call-to-action band
  // =========================================================================
  CTA: {
    props: z.object({
      title: z.string().describe('The CTA headline (required). Short and action-oriented — a nudge, not a full pitch (e.g. "Ready to start building?").'),
      description: z.string().nullable().describe('One supporting sentence under the title explaining the value/next step. Keep to a single line where possible — long copy belongs in a Hero, not a CTA.'),
      variant: z
        .enum(['banner', 'card', 'split'])
        .nullable()
        .describe('Layout: banner (full-width tinted strip, default) · card (bordered panel) · split (copy left, actions right).'),
      align: z
        .enum(['left', 'center'])
        .nullable()
        .describe('Text alignment of the copy block: left (default for split) · center (default for banner/card).'),
      font: Font.describe('Typeface for the whole CTA band; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the title (default semibold). Set to override the baked title weight.'),
      tracking: Tracking.describe('Letter-spacing of the title (default normal). Set to tighten or loosen the title tracking.'),
      leading: Leading.describe('Line height of the title (default tight). Set to open up or compress the title leading.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the title (e.g. "20px" / "1.25rem"). Default 1.5rem.'),
      tone: z
        .enum(['neutral', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic surface tint via token (default neutral). Use `info`/`success` for upgrade/onboarding nudges.'),
      actions: z
        .array(actionSchema)
        .nullable()
        .describe('1-2 CTA buttons. Each with `href` renders an <a>; each without renders a <button> that emits `commit`.'),
      activeAction: z
        .string()
        .nullable()
        .describe('Write target for WHICH action the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting `commit`, so the host can attribute the action. Emit-only when unbound.'),
      bg: colorSchema.describe('Solid background fill of the banner/split band — wins over `tone`. No effect on the `card` variant, which keeps its own bordered card surface.'),
      accent: colorSchema.describe('Background fill of the primary action button, and the colour of the CTA title (default the primary token). Pair it with `accentText` for the label on that fill.'),
      accentText: colorSchema.describe('Text colour on the accent-filled primary CTA button (default the on-primary token). Set when a saturated `accent` needs a legible label.'),
      color: colorSchema.describe('Title + description text colour, and the labels (and outline border) of the secondary/outline/ghost action buttons — only meaningful together with `bg`, which is what paints the surface they sit on (defaults to a readable light on-fill token). Set a dark value when the band is light.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the description line on the default (non-surface) band (default the muted-foreground token).'),
      borderColor: colorSchema.describe('Border colour of the `card` variant only (default the border token; ignored on banner/split which have no border). Set to brand the bordered CTA panel edge.'),
      borderStyle: BorderStyle.describe('Border line style of the `card` variant only: solid (default) · dashed · dotted. No effect on banner/split.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact border thickness of the `card` variant in px (e.g. "2px"; default 1px). No effect on banner/split.'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'An action button without an `href` was pressed; params carry {label, index, href}: the pressed button\'s text, its 0-based position in the `actions` array (disambiguates duplicate/null labels), and its `href` (null for an emitting button). `activeAction` (when bound) is written first so the host can attribute which button fired.',
    },
    description:
      'A focused call-to-action band (smaller than Hero): title + description + 1-2 action buttons. `variant` picks banner/card/split layout; `tone`/`accent` color it. CTAs with `href` navigate; CTAs without one emit `commit`. Reach for CTA over Hero for a single mid/end-of-page nudge — Hero owns the top-of-page band with a headline + media. Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which CTA label (or index) the user triggered from spec.state.',
    example: {
      title: 'Ready to start building?',
      description: 'Spin up your first MCP app in minutes.',
      actions: [{ label: 'Start free', variant: 'primary' }],
    },
  },

  // =========================================================================
  // FeatureGrid — responsive grid of features
  // =========================================================================
  FeatureGrid: {
    props: z.object({
      columns: dimensionSchema({ kind: 'count', min: 1, max: 4 }).describe('Number of columns in the responsive grid (1-4, default 3). Collapses to 1 on narrow viewports.'),
      gap: z
        .enum(['none', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Spacing between feature cells in the grid: none · sm · md (default) · lg · xl. Reach for `lg`/`xl` to give a sparse 2-3 feature grid room to breathe, `sm` to pack a dense feature wall.'),
      align: z
        .enum(['start', 'center'])
        .nullable()
        .describe('Text alignment inside each generated FeatureCard: start (left, default) · center.'),
      variant: z
        .enum(['plain', 'bordered', 'elevated'])
        .nullable()
        .describe('Surface treatment applied UNIFORMLY to every generated FeatureCard: plain (no chrome, default) · bordered (border) · elevated (border + shadow).'),
      font: Font.describe('Typeface applied UNIFORMLY to every generated FeatureCard in the data-driven grid (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the feature titles in the data-driven grid (default semibold). Applies to every generated FeatureCard title.'),
      tracking: Tracking.describe('Letter-spacing of every generated FeatureCard title in the data-driven grid (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of every generated FeatureCard title in the data-driven grid (tight · snug · normal · relaxed · loose; default normal).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of every generated FeatureCard title (e.g. "18px" / "1.125rem"; default 1rem). Cascades via CSS inheritance to each card.'),
      borderStyle: BorderStyle.describe('Border line style applied UNIFORMLY to every generated FeatureCard when `variant` is bordered/elevated: solid (default) · dashed · dotted.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact border thickness applied UNIFORMLY to every generated FeatureCard when `variant` is bordered/elevated (e.g. "2px"; default 1px). Cascades via CSS inheritance to each card.'),
      features: z
        .array(featureSchema)
        .nullable()
        .describe('Data-driven features (icon + title + description). When set, the grid renders a FeatureCard per entry. Omit to render child FeatureCards (slot) instead.'),
      accent: colorSchema.describe('Text colour of the icon glyph in every generated FeatureCard chip (default the primary token); `iconBg` paints the chip behind it. Cascades via CSS inheritance to each card.'),
      iconBg: colorSchema.describe('Fill colour of the icon chip behind each generated FeatureCard glyph (default the muted token). Set a tinted brand fill (e.g. a soft accent wash) for the tinted-chip marketing look. Cascades via CSS inheritance to each card.'),
      borderColor: colorSchema.describe('Border colour applied UNIFORMLY to every generated FeatureCard when `variant` is bordered/elevated (default the border token). Cascades via CSS inheritance to each card.'),
      color: colorSchema.describe('Primary text colour — the feature titles in the data-driven grid (default the foreground token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the feature descriptions in the data-driven grid (default the muted-foreground token).'),
      titleLevel: z
        .enum(['h1', 'h2', 'h3', 'h4'])
        .nullable()
        .describe("Heading level of EVERY generated FeatureCard title (default h3 — a feature card is content under a section heading). Set it to h2 when the grid sits directly under the PageHeader with no section heading between, so the screen's headings nest legally — a document that jumps h1 to h3 has no outline for anyone navigating by heading."),
    }),
    slots: ['default'],
    description:
      'A responsive grid of features. Pass a `features` array to render a FeatureCard per entry, OR drop FeatureCard children into the slot. `columns` (1-4) sets the grid; it collapses to one column on narrow screens.',
    example: {
      columns: 3,
      features: [
        { icon: 'sparkles', title: 'Generative UI', description: 'Apps from natural language.' },
        { icon: 'lock', title: 'Secure by default', description: 'No credentials ever proxied.' },
        { icon: 'send', title: 'Ship anywhere', description: 'Claude, ChatGPT, web embed.' },
      ],
    },
  },

  // =========================================================================
  // FeatureCard — one feature cell
  // =========================================================================
  FeatureCard: {
    props: z.object({
      icon: z
        .string()
        .nullable()
        .describe('Feature icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "sparkles", "lock"). Never raw SVG; unknown names render nothing.'),
      title: z.string().describe('The feature name (required). Short — 2-5 words, noun-phrase (e.g. "Generative UI"), truncates on overflow.'),
      description: z.string().nullable().describe('One or two sentences explaining the feature. Clamped to 3 lines — keep it tight.'),
      font: Font.describe('Typeface for the whole feature card; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the feature title (default semibold). Set to override the baked title weight.'),
      tracking: Tracking.describe('Letter-spacing of the feature title (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the feature title (tight · snug · normal · relaxed · loose; default normal).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the feature title (e.g. "18px" / "1.125rem"). Default 1rem.'),
      href: z
        .string()
        .refine(isSafeHref, 'href uses an unsafe URL scheme')
        .nullable()
        .describe('Make the WHOLE card a navigable link (rendered as a guarded <a>). Omit to render an interactive card that emits `commit`.'),
      external: z.boolean().nullable().describe('When `href` is set: open in a new tab (adds target=_blank + rel=noopener noreferrer).'),
      variant: z
        .enum(['plain', 'bordered', 'elevated'])
        .nullable()
        .describe('Surface treatment: plain (no chrome, default) · bordered (border) · elevated (border + shadow).'),
      align: z
        .enum(['start', 'center'])
        .nullable()
        .describe('Content alignment: start (left, default) · center.'),
      accent: colorSchema.describe('Text colour of the feature icon glyph inside its chip (default the primary token); `iconBg` paints the chip behind it.'),
      iconBg: colorSchema.describe('Fill colour of the icon chip behind the glyph (default the muted token). Set a tinted brand fill (e.g. a soft accent wash) for the tinted-chip marketing look.'),
      borderColor: colorSchema.describe('Border colour for the bordered/elevated variants (default the border token).'),
      borderStyle: BorderStyle.describe('Border line style for the bordered/elevated variants: solid (default) · dashed · dotted.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact border thickness for the bordered/elevated variants (e.g. "2px"; default 1px). No effect on the plain variant.'),
      color: colorSchema.describe('Primary text colour — the feature title (default the foreground token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the feature description under the title (default the muted-foreground token).'),
      titleLevel: z
        .enum(['h1', 'h2', 'h3', 'h4'])
        .nullable()
        .describe("Heading level of the feature `title` (default h3 — a feature card is content under a section heading). Set it to h2 when the card sits directly under the PageHeader with no section heading between, so the screen's headings nest legally — a document that jumps h1 to h3 has no outline for anyone navigating by heading."),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'The card was pressed while it has no `href` (a plain <button>, not a link); params carry {label} — the card title.',
    },
    description:
      'One feature cell: an icon + title + description. Set `href` to make the whole card a link, otherwise it is a button that emits `commit`. Use inside a FeatureGrid or any grid/stack.',
    example: { icon: 'sparkles', title: 'Generative UI', description: 'Interactive AI apps from a prompt.' },
  },

  // =========================================================================
  // LogoCloud — row/grid of partner logos
  // =========================================================================
  LogoCloud: {
    props: z.object({
      items: z
        .array(logoSchema)
        .nullable()
        .describe('The logos: each {src, alt, href?}. A failed/absent src degrades to the alt text; href wraps the logo in a guarded <a>.'),
      title: z.string().nullable().describe('Optional muted heading above the logos (e.g. "Trusted by teams at").'),
      columns: dimensionSchema({ kind: 'count', min: 2, max: 8 }).describe('Logos per row (2-8, default 5). Collapses on narrow viewports.'),
      grayscale: z
        .boolean()
        .nullable()
        .describe('Render logos muted/desaturated until hover (the classic logo-wall treatment, default true).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Logo height enum: sm (1.5rem) · md (2rem, default) · lg (3rem). Width stays auto for aspect; overridden by the exact `height` value channel when set.'),
      height: dimensionSchema({ units: ['px', 'rem'], min: 12, max: 96 }).describe('Exact logo height (e.g. "40px" / "2.5rem"; width stays auto for aspect). Overrides the `size` enum, which is the default.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the heading above the logos and the alt-text fallback of a failed/absent logo (default the muted-foreground token).'),
    }),
    description:
      'A row/grid of partner or customer logos with an optional muted heading. `grayscale` mutes them until hover; `columns` (2-8) sets the layout. Each logo can link out (guarded). A failed/absent image degrades to its alt text.',
    example: {
      title: 'Trusted by teams at',
      items: [
        { src: 'https://cdn.example.com/acme.png', alt: 'Acme' },
        { src: 'https://cdn.example.com/globex.png', alt: 'Globex' },
      ],
    },
  },
};
