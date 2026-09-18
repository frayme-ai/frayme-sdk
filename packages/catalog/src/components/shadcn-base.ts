/**
 * Frayme shadcn base — Zod schemas for the shadcn-style component set.
 *
 * Ported verbatim from @json-render/shadcn v0.19.0 so Frayme fully owns the
 * vocabulary. Prop shapes, descriptions, and examples are byte-equivalent to
 * the original, so specs authored against the upstream package validate
 * identically here.
 *
 * Why ported instead of depended-on: lets Frayme evolve the vocabulary
 * (e.g. Polaris-style variant×tone decoupling) without forking Vercel's
 * package.
 */

import { z } from 'zod';
import { actionShared, Aspect, BorderStyle, colorSchema, dimensionSchema, Font, formFieldBase, Leading, Motion, Shadow, Tracking, Weight } from './_shared.js';

// URL-scheme guards (defense-in-depth alongside the renderer's runtime
// sanitization): reject specs carrying javascript:/data:/vbscript:/file: in
// navigable hrefs, and javascript:/vbscript:/file: in image sources (data:
// images are legitimate). Control chars are stripped so `java\tscript:` can't
// slip past.
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeHref = (s: string): boolean =>
  !/^\s*(javascript|data|vbscript|file):/i.test(stripWhitespace(s));
const isSafeImageSrc = (s: string): boolean =>
  !/^\s*(javascript|vbscript|file):/i.test(stripWhitespace(s));

// ---------------------------------------------------------------------------
// Shared validation primitives (used by form inputs)
// ---------------------------------------------------------------------------

const validationCheckSchema = z
  .array(
    z.object({
      type: z.string(),
      message: z.string(),
      args: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .nullable()
  .describe('Client-side validation rules as [{type, message, args?}], e.g. [{"type":"required","message":"Required"},{"type":"minLength","message":"Too short","args":{"min":3}}]. `type` names the rule (required · minLength · maxLength · pattern · email · …), `message` is the shown error, `args` carries the rule\'s parameters. Evaluated per `validateOn` timing.');

const validateOnSchema = z.enum(['change', 'blur', 'submit']).nullable().describe('When `checks` run: change (live) · blur (default — on leaving the field) · submit (only when an enclosing Form commits).');

// Semantic intent, decoupled from the visual `variant` (Polaris-style
// variant×tone). Optional channel: `variant` = visual hierarchy, `tone` = what
// the action MEANS. Drives the component's accent color via `data-tone` in the
// renderer. `critical` maps to the danger token; `neutral` to muted.
const toneSchema = z
  .enum(['neutral', 'success', 'warning', 'critical', 'info'])
  .nullable()
  .describe('Semantic intent (decoupled from variant): neutral · success · warning · critical · info');

// ---------------------------------------------------------------------------
// The 36 shadcn-style component schemas
// ---------------------------------------------------------------------------

export const shadcnBaseComponents = {
  // =========================================================================
  // Layout Components
  // =========================================================================

  Card: {
    props: z.object({
      title: z.string().nullable().describe('Header title line at the top of the card. Keep to 2-5 words ("Account summary"); omit for a chromeless content box (default none — no header renders).'),
      description: z.string().nullable().describe('Muted one-line subtitle under the `title` (colored by `mutedColor`). Use for a short qualifier ("Your usage this month"); omit when the body speaks for itself.'),
      maxWidth: z.enum(['sm', 'md', 'lg', 'full']).nullable().describe('Maximum card width: sm (24rem) · md (32rem) · lg (48rem) · full (no cap, default). Pair with `centered` for a constrained centered panel.'),
      centered: z.boolean().nullable().describe('Center the card horizontally (margin auto; default false). Only visible when the card is narrower than its container — pair with `maxWidth` or `width`.'),
      surface: z.enum(['solid', 'gradient', 'glass', 'elevated']).nullable().describe('Surface treatment: solid (flat, default) · gradient (soft brand gradient — reads gradientFrom/gradientTo/accent) · glass (translucent + backdrop blur) · elevated (stronger shadow).'),
      padding: z
        .enum(['none', 'sm', 'md', 'lg'])
        .nullable()
        .describe('Inner padding. Reach for `none` on a card that wraps a full-bleed media/table; `lg` for a roomy hero panel.'),
      paddingValue: dimensionSchema({ units: ['px', 'rem'], max: 96 }).describe('Exact inner padding (e.g. "32px" / "2rem"). Overrides the `padding` enum, which is the default.'),
      radius: z
        .enum(['none', 'sm', 'md', 'lg', 'full'])
        .nullable()
        .describe('Corner radius. `none` for a flush/edge-to-edge card, `lg` for a soft modern panel.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      align: z
        .enum(['start', 'center', 'end'])
        .nullable()
        .describe('Text alignment of the header + content. `center` for a centered hero/empty-state card.'),
      bordered: z.boolean().nullable().describe('Whether the card border renders at all (false = borderless surface).'),
      borderStyle: BorderStyle.describe('Border line style (solid · dashed · dotted; default solid). Applies when `bordered`.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact border thickness (e.g. "2px"; default 1px). Applies when `bordered`.'),
      bg: colorSchema.describe('Background fill color. Names a specific surface color when the theme card token is not what you want; for a tinted preset use `surface:glass`/`gradient` instead.'),
      color: colorSchema.describe('On-surface text colour — the card body/children (inherited via CSS) and the `title` when `accent` is unset; the `description` keeps `mutedColor` (default the card-foreground token). Pair with a dark/tinted `bg`.'),
      borderColor: colorSchema.describe('Border color. Use to tint the outline (e.g. a soft brand-coloured edge) when `bordered` is on.'),
      accent: colorSchema.describe('Text colour of the card `title` heading (default: inherits the card\'s own `color`/ink); on `surface:gradient` the same value also tints the top-left stop of the background gradient.'),
      gradientFrom: colorSchema.describe('Background gradient start colour — the top-left stop of the card\'s `surface:gradient` fill (pairs with `gradientTo`; no effect on other surfaces).'),
      gradientTo: colorSchema.describe('Gradient end color (use with `surface:gradient` together with `gradientFrom`).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — descriptions, captions, timestamps, help text (default the muted-foreground token).'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 1200 }).describe('Explicit width override (escape hatch beyond the `maxWidth` enum) — e.g. "640px". Prefer `maxWidth` for the common cases.'),
      font: Font.describe('Typeface for the whole card region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the card `title` (light · normal · medium · semibold · bold; default semibold).'),
      tracking: Tracking.describe('Letter-spacing of the card `title` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the card `title` (tight · snug · normal · relaxed · loose; default the title default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the card `title` (e.g. "20px" / "1.25rem"). Default 1.0625rem.'),
      titleLevel: z
        .enum(['h1', 'h2', 'h3', 'h4'])
        .nullable()
        .describe("Heading level for this card's title (default h2 — a Card is the first structural level under the PageHeader h1). Set it when the card nests deeper, so the screen's headings nest legally — a document that jumps h1 to h4 has no outline for anyone navigating by heading."),
      gap: z
        .enum(['none', 'sm', 'md', 'lg'])
        .nullable()
        .describe('Vertical spacing between the card body children (the content column): none (0) · sm (0.5rem) · md (1rem, default) · lg (1.5rem). Set it to tighten/loosen intra-card rhythm instead of nesting a Stack.'),
    }),
    slots: ['default'],
    description:
      'Container card for content sections. Use for forms/content boxes, NOT for page headers. `surface` sets the visual treatment: solid (default) · gradient · glass · elevated. `gap` controls the spacing between body children.',
    example: { title: 'Overview', description: 'Your account summary' },
  },

  Stack: {
    props: z.object({
      direction: z.enum(['horizontal', 'vertical']).nullable().describe('Main axis: vertical (a column, default) · horizontal (a row; wraps onto new lines by default — see `wrap`).'),
      gap: z.enum(['none', 'sm', 'md', 'lg', 'xl']).nullable().describe('Token spacing between children: none (0) · sm (0.5rem) · md (1rem, default) · lg (1.5rem) · xl (2.5rem). For an exact value use `gapValue`.'),
      align: z.enum(['start', 'center', 'end', 'stretch']).nullable().describe('Cross-axis alignment of children (align-items): start · center · end · stretch (default: the browser stretch behavior when unset).'),
      justify: z.enum(['start', 'center', 'end', 'between', 'around']).nullable().describe('Main-axis distribution (justify-content): start (default when unset) · center · end · between · around.'),
      wrap: z.boolean().nullable().describe('Whether children wrap onto new lines (horizontal stacks). Set false to force a single non-wrapping row.'),
      padding: z
        .enum(['none', 'sm', 'md', 'lg'])
        .nullable()
        .describe('Inner padding around the stack. Use when the stack itself is a padded band/section rather than nesting inside a Card.'),
      paddingValue: dimensionSchema({ units: ['px', 'rem'], max: 96 }).describe('Exact inner padding (e.g. "28px" / "2rem"). Overrides the `padding` enum, which is the default (and which is unset by default).'),
      bg: colorSchema.describe('Background fill color of the stack band (e.g. a dark hero strip). Omit for transparent.'),
      color: colorSchema.describe('On-surface text colour — all text inside the stack band (children inherit via CSS) (default the foreground token). Pair with a dark/tinted `bg` so content stays legible.'),
      gapValue: dimensionSchema({ units: ['px', 'rem'], max: 160 }).describe('Exact gap override (e.g. "28px") when the `gap` enum steps are too coarse. Prefer the `gap` enum for the common cases.'),
      font: Font.describe('Typeface for the whole stack region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
    }),
    slots: ['default'],
    description:
      'Flexbox container that lays out its children in a column or row (`direction`, default vertical) with token gaps. The workhorse layout primitive — reach for Stack when things just need stacking or inlining with spacing, Grid when items must align in equal-width columns, Card when the group needs a bordered surface. Purely structural: no border, and no padding/background unless `padding`/`bg` are set.',
    example: { direction: 'vertical', gap: 'md' },
  },

  Grid: {
    props: z.object({
      columns: dimensionSchema({ kind: 'count', min: 1, max: 6 }).describe('Number of columns (1-6). The primary lever for a fixed-column grid.'),
      gap: z.enum(['sm', 'md', 'lg', 'xl']).nullable().describe('Token spacing between cells (both axes): sm (0.5rem) · md (1rem, default) · lg (1.5rem) · xl (2.5rem). For an exact value use `gapValue`.'),
      align: z
        .enum(['start', 'center', 'end', 'stretch'])
        .nullable()
        .describe('Block alignment of items within their grid tracks (`align-items`). `stretch` (default) makes equal-height cells.'),
      padding: z
        .enum(['none', 'sm', 'md', 'lg'])
        .nullable()
        .describe('Inner padding around the grid. Use when the grid itself is a padded band/section rather than nesting inside a Card. Unset by default (a props-less grid has no padding).'),
      paddingValue: dimensionSchema({ units: ['px', 'rem'], max: 96 }).describe('Exact inner padding (e.g. "28px" / "2rem"). Overrides the `padding` enum, which is the default (and which is unset by default).'),
      bg: colorSchema.describe('Background fill color behind the grid. Omit for transparent.'),
      color: colorSchema.describe('On-surface text colour — all text inside the grid cells (children inherit via CSS) (default the foreground token). Pair with a dark/tinted `bg` so content stays legible.'),
      gapValue: dimensionSchema({ units: ['px', 'rem'], max: 160 }).describe('Exact gap override (e.g. "20px") when the `gap` enum is too coarse.'),
      minColWidth: dimensionSchema({ units: ['px', 'rem'], min: 80, max: 600 }).describe('Responsive auto-fit: when set (e.g. "220px"), columns wrap to fill the width with at least this minimum — overrides the fixed `columns`.'),
      template: z
        .string()
        .nullable()
        .describe('Explicit column widths as a CSS track list ("minmax(0,2fr) minmax(0,6rem) minmax(0,1fr)"), for a matrix whose columns differ in natural width — a wide name beside a narrow amount beside a wide sparkline. Overrides `columns`. Give the HEADER row and every data row the SAME template so their fields line up as real columns; a header sized by its own content points at nothing, and the header must have exactly as many cells as each data row. Prefer minmax(0,…) for every track: a bare "1fr" cannot shrink below its content, so one long cell pushes the row past the container. Stacks to one column on narrow. Allowed tracks: 0, a number with fr/px/rem/em/%/ch, auto, min-content, max-content, minmax(a,b) or repeat(n,track); up to 12.'),
      rows: dimensionSchema({ kind: 'count', min: 1, max: 12 }).describe('Explicit row count (1-12). Usually leave unset to let rows flow automatically.'),
      font: Font.describe('Typeface for the whole grid region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
    }),
    slots: ['default'],
    description:
      'CSS grid that arranges children into 1-6 equal-width columns (`columns`, default 2) with equal-height cells by default. Choose it over Stack when items must line up in columns and rows (card grids, feature grids, stat rows); set `minColWidth` to switch from a fixed column count to responsive auto-fit wrapping. Reach for it when a set of peer items should tile evenly — each child occupies one cell and the tracks size themselves, so you never hand-set widths.',
    example: { columns: 3, gap: 'md' },
  },

  Separator: {
    props: z.object({
      orientation: z.enum(['horizontal', 'vertical']).nullable().describe('Line direction: horizontal (a full-width rule, default) · vertical (a short upright rule for inline splits; default height 1.5rem — set `length` to change).'),
      thickness: z
        .enum(['hairline', 'thin', 'thick'])
        .nullable()
        .describe('Line weight: hairline (1px, default) · thin (2px) · thick (4px).'),
      spacing: z
        .enum(['none', 'sm', 'md', 'lg'])
        .nullable()
        .describe('Margin around the line. Increase for a roomier section break.'),
      style: z
        .enum(['solid', 'dashed', 'dotted'])
        .nullable()
        .describe('Line pattern: solid (default) · dashed · dotted. A dashed/dotted rule reads as a softer, more informal break.'),
      color: colorSchema.describe('Line color. Names a specific divider color when the border token is not what you want.'),
      labelColor: colorSchema.describe('Text colour of the centered `label` on a labelled divider, in either orientation (default the muted-foreground token) — independent of the line `color`.'),
      length: dimensionSchema({ units: ['px', 'rem', '%'] }).describe('Explicit length (width when horizontal, height when vertical), e.g. "60%" for a short centered divider — works with and without a `label` (a labelled divider centers at that width).'),
      label: z.string().nullable().describe('Optional centered label rendered on the line, in either orientation: horizontal draws it between two horizontal rules, vertical stacks it between two vertical rules (e.g. "OR" between two side-by-side panels).'),
    }),
    description:
      'Thin rule that visually divides adjacent content — horizontal by default, vertical for inline splits (`orientation`). Use it between list sections or form groups instead of adding a border to a wrapper; an optional centered `label` renders on the line (e.g. "OR" between auth methods). Purely decorative: no children, no events.',
    example: {
      orientation: 'horizontal',
      thickness: null,
      spacing: null,
      style: null,
      color: null,
      labelColor: null,
      length: null,
      label: 'OR',
    },
  },

  Tabs: {
    props: z.object({
      tabs: z.array(
        z.object({
          label: z.string(),
          value: z.string(),
          icon: z.string().nullable().describe('Optional leading glyph — an icon NAME from the closed registry (e.g. "user", "settings"); unknown/omitted renders no icon.'),
          count: z.number().nullable().describe('Optional trailing count badge (e.g. an unread/item count) rendered as a muted pill after the label; omit for no badge.'),
        }),
      ).describe('The tab list as [{label, value, icon?, count?}] — label is the visible tab text, value the state value bound/emitted on selection, with an optional leading `icon` (registry name) and trailing `count` badge, e.g. [{"label":"Inbox","value":"inbox","icon":"mail","count":3},{"label":"Billing","value":"billing"}].'),
      defaultValue: z.string().nullable().describe('Initial active tab `value` for uncontrolled use (default: the first tab). Ignored once a bound `value` resolves.'),
      value: z.string().nullable().describe('Controlled active tab (a tab `value`). Use { $bindState } for two-way binding so other elements can read and drive the active tab.'),
      variant: z
        .enum(['underline', 'pill', 'enclosed'])
        .nullable()
        .describe('Tab visual style: underline (default) · pill (segmented chips) · enclosed (boxed tabs).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Tab density — padding + font size of each tab: sm · md (default) · lg.'),
      align: z
        .enum(['start', 'center', 'end', 'stretch'])
        .nullable()
        .describe('Tablist distribution. `stretch` makes full-width tabs that share the row.'),
      fitted: z.boolean().nullable().describe('Split available width equally between tabs (full-width fitted tabs).'),
      accent: colorSchema.describe('Text colour of the ACTIVE tab label on every variant (carried 65% toward the surrounding ink so a brand colour keeps contrast), and the colour of the 2px underline indicator rule beneath it on variant:underline. Default: the inherited surface ink.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the segmented pill track (variant:pill only), e.g. "12px" / "1rem". Default the theme radius; no effect on the underline/enclosed variants.'),
      mutedColor: colorSchema.describe('Text colour of the inactive (resting) tab labels and of their trailing count badges (default the muted-foreground token).'),
      trackColor: colorSchema.describe('Background of the segmented pill track behind the tabs on variant:pill; on variant:underline/enclosed the same value is instead the colour of the divider rule under the rail and of the selected enclosed tab\'s side/top edges (default the border/muted token).'),
      borderColor: colorSchema.describe('Resting (unselected) tab border colour for enclosed tabs (variant:enclosed) — the inactive tab edge before selection (default transparent; the selected tab keeps its own border).'),
    }),
    slots: ['default'],
    events: ['change'],
    eventsDoc: {
      change: 'A tab was clicked; params carry {value, label} of the newly active tab.',
    },
    description:
      'Tab navigation: a tablist built from `tabs` [{label, value}] above a single shared children panel. The children do NOT switch per tab by themselves — bind `value` with { $bindState } and drive child visibility from that state (or use `defaultValue` for uncontrolled). Choose Tabs to switch between peer views in place; Accordion/Collapsible stack expandable sections instead, and ToggleGroup/ButtonGroup pick a value rather than a view.',
    example: {
      tabs: [
        { label: 'Overview', value: 'overview' },
        { label: 'Billing', value: 'billing' },
        { label: 'Team', value: 'team' },
      ],
      defaultValue: 'overview',
      value: null,
      variant: null,
      size: null,
      align: null,
      fitted: null,
      accent: null,
      radiusValue: null,
      mutedColor: null,
      trackColor: null,
      borderColor: null,
    },
  },

  Accordion: {
    props: z.object({
      items: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
        }),
      ).describe('The sections as [{title, content}] — both plain strings (content is NOT a child slot), e.g. [{"title":"Shipping","content":"Ships in 2-3 business days."}]. For rich child components use Collapsible instead.'),
      type: z.enum(['single', 'multiple']).nullable().describe('Expansion mode: single (opening one section closes the others, default) · multiple (sections open and close independently).'),
      defaultOpenIndex: z
        .union([z.number(), z.array(z.number())])
        .nullable()
        .describe('Item index (or indices, with type:multiple) expanded by default. Omit to start fully collapsed.'),
      variant: z
        .enum(['bordered', 'separated', 'ghost'])
        .nullable()
        .describe('Container chrome: bordered (boxed, default) · separated (gapped cards) · ghost (borderless).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Section density — padding + font size of each trigger (the panel body padding follows), and the caret glyph size (14/16/18): sm · md (default) · lg.'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner radius of the boxed container (variant:bordered) AND of each item card (variant:separated); default md.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the container and of each separated item card (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      borderColor: colorSchema.describe('Border color of the outer box AND the dividers between sections (each card edge on variant:separated); default the border token.'),
      accent: colorSchema.describe('Text colour of the OPEN section\'s header title and its caret glyph (default: inherits the surrounding ink). Names a specific colour for the active section.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the expanded panel body copy (default the muted-foreground token).'),
      chevronIcon: z
        .string()
        .nullable()
        .describe('Expand/collapse caret glyph — an icon NAME from the closed registry (e.g. "chevron-down", "plus"). Unknown/omitted → the default ▾ caret. Never raw SVG.'),
      openIndexes: z
        .array(z.number())
        .nullable()
        .describe('Indexes of the currently-expanded sections, mirrored back here into (bindable) spec.state on every toggle. Bind with { $bindState } so a Button/agent can read which sections are open; with type:single it holds at most one index. Seeds from `defaultOpenIndex` when omitted.'),
    }),
    description:
      "Collapsible sections. Items as [{title, content}]. Type 'single' (default) or 'multiple'. Bind `openIndexes` with { $bindState } so the agent (or a sibling control) can read which section indexes are currently expanded from spec.state.",
    example: {
      items: [
        { title: 'Shipping', content: 'Ships in 2-3 business days.' },
        { title: 'Returns', content: 'Free returns within 30 days.' },
        { title: 'Warranty', content: 'Covered for 1 year from purchase.' },
      ],
      type: 'single',
      defaultOpenIndex: null,
      variant: null,
      size: null,
      radius: null,
      radiusValue: null,
      borderColor: null,
      accent: null,
      mutedColor: null,
      chevronIcon: null,
      openIndexes: null,
    },
    events: ['change'],
    eventsDoc: {
      change: 'A section was expanded or collapsed; params carry {openIndexes} — the full resolved array of currently-expanded item indexes (with type:single it holds at most one).',
    },
  },

  Collapsible: {
    props: z.object({
      title: z.string().describe('Trigger text — the always-visible section heading the user clicks to expand/collapse. Keep to 2-6 words ("Advanced options").'),
      defaultOpen: z.boolean().nullable().describe('Start expanded on first render (uncontrolled; default false = collapsed). Ignored once a bound `open` resolves.'),
      open: z.boolean().nullable().describe('Controlled open state. Use { $bindState } to drive it from state; omit for uncontrolled (use defaultOpen instead).'),
      variant: z
        .enum(['bordered', 'ghost'])
        .nullable()
        .describe('With (bordered, default) or without (ghost) a surrounding border box.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Trigger + body padding and trigger font size (the body gutter tracks the trigger), and the caret glyph size (14/16/18).'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner radius of the box: none · sm · md (default, the theme radius) · lg · full. Visible with variant:bordered; use `radiusValue` for an exact value.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the box (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      iconPosition: z
        .enum(['start', 'end'])
        .nullable()
        .describe('Caret position relative to the title: start (left) or end (right, default).'),
      borderColor: colorSchema.describe('Border color of the surrounding box (default the border token); only visible with variant:bordered. Set it to tint the outline — e.g. a soft brand edge on a highlighted panel.'),
      accent: colorSchema.describe('Text colour of the trigger title and its caret glyph, in every open/closed state (default: inherits the surrounding ink). The body content keeps its own colours.'),
      chevronIcon: z
        .string()
        .nullable()
        .describe('Expand/collapse caret glyph — an icon NAME from the closed registry (e.g. "chevron-down", "plus"). Unknown/omitted → the default ▾ caret. Never raw SVG.'),
    }),
    slots: ['default'],
    description:
      'Single expandable section: a full-width trigger showing `title` + a caret, with children revealed below when open. Choose it for one show/hide region holding real child components (advanced settings, filter panels); Accordion is the multi-section sibling but takes plain [{title, content}] strings only. Uncontrolled via `defaultOpen`, or bind `open` with { $bindState }.',
    example: {
      title: 'Advanced options',
      defaultOpen: false,
      open: null,
      variant: null,
      size: null,
      radius: null,
      radiusValue: null,
      iconPosition: null,
      borderColor: null,
      accent: null,
      chevronIcon: null,
    },
    events: ['change'],
    eventsDoc: {
      change: 'The section was expanded or collapsed via its trigger; params carry {open} — the resolved boolean open state after the toggle.',
    },
  },

  Dialog: {
    props: z.object({
      title: z.string().describe('Dialog heading shown in the panel header; also the accessible name (aria-label) of the dialog. Keep to 2-6 words ("Confirm deletion").'),
      description: z.string().nullable().describe('Muted supporting line under the title (colored by `mutedColor`). One sentence explaining what the dialog does or asks.'),
      openPath: z.string().describe('State path of the boolean that controls visibility, e.g. "confirmOpen" with state {"confirmOpen": false}. The dialog renders only while that value is true; the × button and backdrop click write false back to this path.'),
      size: z.enum(['sm', 'md', 'lg', 'full']).nullable().describe('Panel max width: sm · md (default) · lg · full. Reach for `sm` on a terse confirm, `lg`/`full` for a detail/form panel; use `width` for an exact override.'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Panel corner radius: none · sm · md (default, the theme radius) · lg · full. For an exact value use `radiusValue`.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact panel corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      padding: z.enum(['sm', 'md', 'lg']).nullable().describe('Panel inner padding: sm (0.75rem) · md (1.25rem, default) · lg (2rem).'),
      align: z.enum(['start', 'center']).nullable().describe('Vertical position of the panel: center (default) or start (top-aligned).'),
      dismissable: z.boolean().nullable().describe('Allow backdrop-click + × to close. Set false to force an explicit action (no casual dismiss).'),
      showClose: z.boolean().nullable().describe('Show the × close button in the header (default true). Set false together with `dismissable:false` to force an explicit action button.'),
      bg: colorSchema.describe('Panel background color — the dialog surface behind the header + body (default the card token). Pair with `color` for a dark/branded panel so text stays legible.'),
      color: colorSchema.describe(
        'On-surface text colour for the panel — the dialog `title` and all slot/body content that inherits the panel text — pair it with a custom dark `bg` so the surface stays legible (default the card-foreground token). The `description` line and × close glyph follow `mutedColor` instead; bg + color + borderColor + mutedColor brand the surface together.',
      ),
      borderColor: colorSchema.describe('Panel border colour (default the border token). Set it to tint the panel outline — e.g. a soft brand edge — pairing with `bg`/`color` to brand the whole surface.'),
      overlayColor: colorSchema.describe('Backdrop scrim color. Names a specific tint (e.g. a slate-tinted overlay) instead of the default black/45.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the dialog `description` line under the title AND the × close button glyph (default the muted-foreground token).'),
      shadow: Shadow.describe('Elevation of the floating panel (none · sm · md · lg · xl); overrides the default raised shadow.'),
      motion: Motion.describe('Enter-transition speed for this overlay (fast/normal/slow). Default: no animation — the panel appears instantly.'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 900 }).describe('Exact panel width override (escape hatch beyond `size`), e.g. "640px".'),
      font: Font.describe('Typeface for the whole dialog panel; cascades to the title + body via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the dialog `title` (light · normal · medium · semibold · bold; default semibold).'),
      tracking: Tracking.describe('Letter-spacing of the dialog `title` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the dialog `title` (tight · snug · normal · relaxed · loose; default the title default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the dialog `title` (e.g. "20px" / "1.25rem"). Default 1.0625rem.'),
      closeLabel: z
        .string()
        .nullable()
        .describe('Accessible label (aria-label) for the × close button. Default "Close". Localise it for non-English UIs.'),
      closeIcon: z
        .string()
        .nullable()
        .describe('Close-button glyph — an icon NAME from the closed registry (e.g. "x"). Unknown/omitted → the default × character. Never raw SVG.'),
    }),
    slots: ['default'],
    description:
      'Modal dialog: a centered panel over a backdrop scrim with a title/description header, × close, and children as the body. Visibility is state-driven — set `openPath` to a boolean state path and toggle it via setState (e.g. from a Button action); there is no open prop. Choose Dialog for focused confirm/detail moments; Drawer docks to an edge for longer side content, and Popover/Tooltip stay anchored to a trigger instead of taking over.',
    example: {
      title: 'Confirm deletion',
      description: 'This action cannot be undone.',
      openPath: 'confirmOpen',
      size: 'md',
      radius: null,
      radiusValue: null,
      padding: null,
      align: null,
      dismissable: null,
      showClose: null,
      bg: null,
      color: null,
      borderColor: null,
      overlayColor: null,
      mutedColor: null,
      shadow: null,
      motion: null,
      width: null,
      font: null,
      weight: null,
      tracking: null,
      leading: null,
      fontSize: null,
      closeLabel: null,
      closeIcon: null,
    },
    events: ['dismiss'],
    eventsDoc: {
      dismiss: 'The dialog was closed via the × button or a backdrop click; params carry {open:false} — the resolved closed state (also written back to `openPath`).',
    },
  },

  Drawer: {
    props: z.object({
      title: z.string().describe('Sheet heading shown in the header; also the accessible name (aria-label) of the drawer. Keep to 2-6 words ("Your cart").'),
      description: z.string().nullable().describe('Muted supporting line under the title (colored by `mutedColor`). One sentence of context for the sheet.'),
      openPath: z.string().describe('State path of the boolean that controls visibility, e.g. "cartOpen" with state {"cartOpen": false}. The drawer renders only while that value is true; the × button and backdrop click write false back to this path.'),
      side: z.enum(['bottom', 'right', 'left', 'top']).nullable().describe('Edge the sheet docks to: bottom (default) · right · left · top.'),
      size: z.enum(['sm', 'md', 'lg', 'full']).nullable().describe('Sheet extent (height for top/bottom, width for left/right).'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner rounding on the sheet\'s inner (leading) edge only — the docked edge stays flush: none · sm · md (default) · lg · full. Use `radiusValue` for an exact length.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact leading-edge corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      padding: z.enum(['sm', 'md', 'lg']).nullable().describe('Sheet inner padding: sm (0.75rem) · md (1.25rem, default) · lg (2rem).'),
      dismissable: z.boolean().nullable().describe('Allow backdrop-click + × to close. Set false to force an explicit action.'),
      showClose: z.boolean().nullable().describe('Show the × close button in the header (default true). Set false together with `dismissable:false` to force an explicit action.'),
      bg: colorSchema.describe('Sheet background color — the sliding panel surface (default the card token). Pair with `color` so header/body text stays legible.'),
      color: colorSchema.describe(
        'On-surface text colour for the sheet — the drawer `title` and all slot/body content that inherits the sheet text — pair it with a custom dark `bg` so the surface stays legible (default the card-foreground token). The `description` line and × close glyph follow `mutedColor` instead; bg + color + borderColor + mutedColor brand the surface together.',
      ),
      borderColor: colorSchema.describe('Sheet border colour along its docked edge (default the border token). Set it to tint the divider between the sheet and the page — pairs with `bg`/`color` to brand the surface.'),
      overlayColor: colorSchema.describe('Backdrop scrim colour behind the sheet (default black/45). Name a specific tint — e.g. a slate-tinted overlay — or a heavier value to darken the page more.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the drawer `description` line under the title AND the × close button glyph (default the muted-foreground token).'),
      shadow: Shadow.describe('Elevation of the sliding panel (none · sm · md · lg · xl); overrides the default raised shadow.'),
      motion: Motion.describe('Enter-transition speed for this overlay (fast/normal/slow). Default: no animation — the sheet appears instantly.'),
      sizeValue: dimensionSchema({ units: ['px', 'rem', '%'] }).describe('Exact extent override (escape hatch beyond `size`), e.g. "420px" wide / "60%" tall.'),
      font: Font.describe('Typeface for the whole drawer sheet; cascades to the title + body via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the drawer `title` (light · normal · medium · semibold · bold; default semibold).'),
      tracking: Tracking.describe('Letter-spacing of the drawer `title` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the drawer `title` (tight · snug · normal · relaxed · loose; default the title default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the drawer `title` (e.g. "20px" / "1.25rem"). Default 1.0625rem.'),
      closeLabel: z
        .string()
        .nullable()
        .describe('Accessible label (aria-label) for the × close button. Default "Close". Localise it for non-English UIs.'),
      closeIcon: z
        .string()
        .nullable()
        .describe('Close-button glyph — an icon NAME from the closed registry (e.g. "x"). Unknown/omitted → the default × character. Never raw SVG.'),
    }),
    slots: ['default'],
    description:
      'Edge-docked sheet (bottom by default; left/right/top via `side`). Set openPath to a boolean state path. Use setState to toggle.',
    example: {
      title: 'Your cart',
      description: '3 items',
      openPath: 'cartOpen',
      side: 'right',
      size: null,
      radius: null,
      radiusValue: null,
      padding: null,
      dismissable: null,
      showClose: null,
      bg: null,
      color: null,
      borderColor: null,
      overlayColor: null,
      mutedColor: null,
      shadow: null,
      motion: null,
      sizeValue: null,
      font: null,
      weight: null,
      tracking: null,
      leading: null,
      fontSize: null,
      closeLabel: null,
      closeIcon: null,
    },
    events: ['dismiss'],
    eventsDoc: {
      dismiss: 'The drawer was closed via the × button or a backdrop click; params carry {open:false} — the resolved closed state (also written back to `openPath`).',
    },
  },

  Carousel: {
    props: z.object({
      items: z.array(
        z.object({
          title: z.string().nullable(),
          description: z.string().nullable(),
          image: z.string().nullable().describe('Optional per-card media image URL (http/https or a raster data: URI; SVG/blob rejected). Rendered as a cover banner above the title; a dead/unsafe URL falls back to the `icon` (if any) or nothing.'),
          icon: z.string().nullable().describe('Optional per-card media glyph — an icon NAME from the closed registry, shown in a muted media panel above the title when there is no `image` (or the image fails). Unknown/omitted → no media panel.'),
        }),
      ).describe('The cards as [{title, description, image?, icon?}] — title/description are optional strings; each card may carry a media `image` (URL) or `icon` (registry name) banner, e.g. [{"title":"Fast setup","description":"Live in minutes.","icon":"zap"}]. No child components.'),
      gap: z.enum(['sm', 'md', 'lg', 'xl']).nullable().describe('Spacing between cards: sm (0.5rem) · md (1rem, default) · lg (1.5rem) · xl (2.5rem).'),
      align: z.enum(['start', 'center']).nullable().describe('Scroll-snap alignment of cards: start (default) or center.'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner radius of each card: none · sm · md (default, the theme radius) · lg · full. For an exact value use `radiusValue`.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact per-card corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      showControls: z.boolean().nullable().describe('Show prev/next arrow buttons in addition to drag/scroll.'),
      showDots: z.boolean().nullable().describe('Show a row of pagination dots below the strip, one per card, tracking the scrolled-to card (default false). Click a dot to scroll to that card.'),
      activeIndex: z.number().nullable().describe('The card currently scrolled into view (0-based). Bind with { $bindState } so an external Button/agent can read which card the user is looking at; mirrored back here into spec.state on every scroll.'),
      cardBg: colorSchema.describe('Per-card background color (e.g. a dark card on a light page); the prev/next arrow chips follow it too.'),
      borderColor: colorSchema.describe('Per-card border color; the prev/next arrow chips follow it too.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the per-card description line under each title (default the muted-foreground token).'),
      itemWidth: dimensionSchema({ units: ['px', 'rem'], min: 120, max: 480 }).describe('Width of each card (e.g. "18rem"). Default ~14rem; widen for richer cards.'),
      weight: Weight.describe('Font weight of each card title (light · normal · medium · semibold · bold; default semibold).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of each card title (e.g. "18px" / "1.125rem"). Default 1.0625rem.'),
      prevLabel: z
        .string()
        .nullable()
        .describe('Accessible label (aria-label) for the previous-arrow button. Default "Previous". Localise for non-English UIs.'),
      nextLabel: z
        .string()
        .nullable()
        .describe('Accessible label (aria-label) for the next-arrow button. Default "Next". Localise for non-English UIs.'),
      prevIcon: z
        .string()
        .nullable()
        .describe('Previous-arrow glyph — an icon NAME from the closed registry (e.g. "chevron-left", "arrow-left"). Unknown/omitted → the default ‹ character. Never raw SVG.'),
      titleLevel: z
        .enum(['h1', 'h2', 'h3', 'h4'])
        .nullable()
        .describe("Heading level for EVERY card title in this carousel (default h2 — the strip emits no title of its own, so a card title is the first heading under whatever precedes it). Set it when the carousel nests inside a titled Card, so the screen's headings nest legally — a document that jumps h1 to h4 has no outline for anyone navigating by heading."),
      nextIcon: z
        .string()
        .nullable()
        .describe('Next-arrow glyph — an icon NAME from the closed registry (e.g. "chevron-right", "arrow-right"). Unknown/omitted → the default › character. Never raw SVG.'),
    }),
    description:
      'Horizontal scroll-snap strip of simple cards (`items` as [{title, description, image?, icon?}]) with optional prev/next arrows (`showControls`) and pagination dots (`showDots`). Each card can carry a media image or icon banner. Choose it to let users browse many peer teasers in limited vertical space; it takes NO children — for arbitrary components in a row use Stack direction:horizontal, and for a wrapping layout use Grid. Bind `activeIndex` with { $bindState } so the agent (or a sibling control) can read the 0-based index of the card currently in view from spec.state.',
    example: {
      items: [
        { title: 'Fast setup', description: 'Live in minutes.' },
        { title: 'Flexible pricing', description: 'Pay as you grow.' },
        { title: '24/7 support', description: 'We are always here to help.' },
      ],
      gap: null,
      align: null,
      radius: null,
      radiusValue: null,
      showControls: true,
      showDots: null,
      activeIndex: null,
      cardBg: null,
      borderColor: null,
      mutedColor: null,
      itemWidth: null,
      weight: null,
      fontSize: null,
      prevLabel: null,
      nextLabel: null,
      prevIcon: null,
      nextIcon: null,
    },
    events: ['page'],
    eventsDoc: {
      page: 'The user scrolled to a different card or clicked a pagination dot; params carry {activeIndex} — the resolved 0-based index of the card now in view.',
    },
  },

  // =========================================================================
  // Data Display Components
  // =========================================================================

  Table: {
    props: z.object({
      columns: z.array(z.string()).describe('Header labels, one string per column, e.g. ["Name","Role","Status"]. The count should match each row’s cell count.'),
      rows: z.array(z.array(z.string())).describe('Cell data as a 2D array of strings — one inner array per row, cells in column order, e.g. [["Alice","Admin"],["Bob","User"]]. Strings only; for sorting/selection/pagination reach for DataTable instead.'),
      caption: z.string().nullable().describe('Accessible table caption rendered as a muted line below the table (colored by `mutedColor`). Use it to state what the data shows ("Q3 signups by region").'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Cell padding + font size (table density). `sm` for compact data tables.'),
      density: z
        .enum(['comfortable', 'compact'])
        .nullable()
        .describe('Row height: comfortable (default) · compact (tighter vertical padding). Orthogonal to `size`.'),
      striped: z.boolean().nullable().describe('Zebra-stripe alternate rows with a faint fill for easier row scanning (default false = plain rows). Turn it on for wide/dense tables where the eye can lose its row.'),
      bordered: z
        .enum(['none', 'rows', 'grid'])
        .nullable()
        .describe('Cell border treatment: none · rows (horizontal dividers, default) · grid (full cell grid).'),
      hover: z.boolean().nullable().describe('Tint the row under the pointer on hover (default true). Set false for a static/print-style table or when rows are not row-clickable, so hover implies no affordance.'),
      align: z
        .enum(['left', 'center', 'right'])
        .nullable()
        .describe('Text alignment for ALL header and body cells: left (default) · center · right. Applies table-wide; use `columnAlign` to override individual columns.'),
      columnAlign: z
        .array(z.enum(['left', 'center', 'right']))
        .nullable()
        .describe('Per-column text alignment, parallel to `columns` (e.g. ["left","right","right"] to right-align two numeric columns). Missing/short entries fall back to the table-wide `align`. Use it to right-align numeric columns without shifting the whole table.'),
      stickyHeader: z.boolean().nullable().describe('Pin the header row when the table scrolls (position: sticky).'),
      /* headerColor -> headerTextColor. One prop name meant two opposite things:
         the header TEXT colour here, on PermissionMatrix and on
         EditableSpreadsheetGrid; the header BACKGROUND on DataTable and
         ColumnHeader. Uses split across both senses, so there was no rule
         for the model to learn — asked for "a table with a dark blue header" it had
         to guess, and guessing the background sense when text was meant is how a
         header ends up dark-on-dark.
         NO ALIAS: an alias keeps both senses alive under the old name, which is the
         ambiguity the rename removes. */
      headerTextColor: colorSchema.describe('Header text color (default the muted-foreground token).'),
      accent: colorSchema.describe('Border/divider color for cells (default border token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the caption below the table (default the muted-foreground token).'),
    }),
    description:
      'Static data table: `columns` are the header labels and `rows` a 2D array of cell strings, e.g. [["Alice","admin"],["Bob","user"]]. Reach for it to present read-only tabular data — a stats grid, a comparison, a small records list — where each row\'s cell count matches the column count. Cells are plain strings with no per-cell rendering; for sortable columns, row selection, pagination, or editable cells use DataTable instead. `striped`/`hover`/`density` tune scannability, `columnAlign` right-aligns numeric columns, and `stickyHeader` pins the header on scroll.',
    example: {
      columns: ['Name', 'Role'],
      rows: [
        ['Alice', 'Admin'],
        ['Bob', 'User'],
      ],
    },
  },

  Heading: {
    props: z.object({
      text: z.string().describe('The heading copy. Keep it short and scannable (2-8 words); plain text only — no markdown or HTML.'),
      level: z.enum(['h1', 'h2', 'h3', 'h4']).nullable().describe('Semantic tag (a11y/SEO). Decoupled from visual `size`.'),
      size: z
        .enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl'])
        .nullable()
        .describe('Visual size, DECOUPLED from `level` (e.g. an h2 rendered display-large). Omit to follow level.'),
      fontSize: dimensionSchema({ units: ['px', 'rem', 'em'], min: 8, max: 96 }).describe('Exact font size (e.g. "32px" / "2rem"). Overrides the `size` enum (which is the default, derived from `level` when unset).'),
      weight: z
        .enum(['normal', 'medium', 'semibold', 'bold'])
        .nullable()
        .describe('Font weight of the heading: normal · medium · semibold (default) · bold.'),
      align: z.enum(['left', 'center', 'right']).nullable().describe('Horizontal text alignment: left (default) · center · right.'),
      tone: z
        .enum(['default', 'muted', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic text color via token (covers the common case; use `color` for an exact value).'),
      truncate: z.boolean().nullable().describe('Clip the heading to ONE line with a trailing ellipsis when it overflows its width (default false). Use it in tight columns/cards; for a multi-line cap use `clamp` instead.'),
      tracking: Tracking.describe('Letter-spacing (shared 5-step atom): tighter · tight · normal (default) · wide · wider.'),
      leading: Leading.describe('Line-height: tight (default) · snug · normal · relaxed · loose.'),
      clamp: dimensionSchema({ kind: 'count', min: 1, max: 6 }).describe('Clamp the heading to this many lines (1-6) with a trailing ellipsis (e.g. 2 for a two-line hero title). Default: no clamp (the heading grows to fit). Use `truncate` for a single-line ellipsis instead.'),
      color: colorSchema.describe('Exact text color (wins over `tone`). Names a specific brand color for the heading.'),
      font: Font.describe('Typeface for this heading (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
    }),
    description:
      'Section heading rendered as a real h1-h4 tag. `level` sets the semantic tag (a11y/SEO); `size` sets the visual scale independently, defaulting from level (h1→xl … h4→sm) — so an h2 can render display-large. `clamp` caps it to N lines. Use Heading for titles that structure the page; Text is for body/caption copy, and a Card `title` covers the heading that belongs to that card.',
    example: { text: 'Welcome', level: 'h1' },
  },

  Text: {
    props: z.object({
      text: z.string().describe('The text content (plain string — no markdown/HTML). One Text per paragraph; compose several in a Stack for multi-paragraph copy.'),
      variant: z
        .enum(['body', 'caption', 'muted', 'lead', 'code'])
        .nullable()
        .describe('Preset bundle (size+tone+style). The primary lever; the props below override it.'),
      size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).nullable().describe('Font size step, overriding whatever the `variant` preset sets: xs · sm · md · lg · xl. Drop to `sm`/`xs` for captions/fine print; use `fontSize` for an exact length.'),
      fontSize: dimensionSchema({ units: ['px', 'rem', 'em'], min: 8, max: 96 }).describe('Exact font size (e.g. "32px" / "2rem"). Overrides the `size` enum and `variant` preset, which are the default.'),
      weight: z
        .enum(['normal', 'medium', 'semibold', 'bold'])
        .nullable()
        .describe('Font weight of the text: normal (default) · medium · semibold · bold.'),
      tracking: Tracking.describe('Letter-spacing: tighter · tight · normal · wide · wider (default normal).'),
      leading: Leading.describe('Line-height: tight · snug · normal · relaxed · loose (default follows the size step).'),
      align: z.enum(['left', 'center', 'right', 'justify']).nullable().describe('Horizontal text alignment: left (default) · center · right · justify.'),
      tone: z
        .enum(['default', 'muted', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic text color via token. Use for warning/success copy.'),
      italic: z.boolean().nullable().describe('Render the text in italics (default false). Style-only — combines with any variant/weight.'),
      truncate: z.boolean().nullable().describe('Clip to ONE line with a trailing ellipsis on overflow (default false). For multi-line clipping use `clamp`.'),
      mono: z.boolean().nullable().describe('Monospace font (separate from variant:code which also boxes it).'),
      color: colorSchema.describe('Exact text color, e.g. "#6d28d9" (wins over `tone` and the variant preset; default: inherits the surrounding foreground).'),
      bg: colorSchema.describe('Chip background fill for variant:code only (default the muted token). Pair a dark value with a light `color` for a brand code chip; ignored on other variants.'),
      clamp: dimensionSchema({ kind: 'count', min: 1, max: 6 }).describe('Multi-line clamp to N lines (1-6) with an ellipsis (-webkit-line-clamp).'),
      font: Font.describe('Typeface for this text (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
    }),
    description:
      'Paragraph or inline body copy holding a single plain-text string. Reach for it for prose, captions, help lines, and code snippets — anything that is not a structural title (use Heading for those). `variant` (body · caption · muted · lead · code) is the main lever, bundling size+tone+style, and the individual size/weight/tone/clamp props override it; `truncate` clips to one line and `clamp` caps at N lines with an ellipsis.',
    example: { text: 'Hello, world!' },
  },

  Image: {
    props: z.object({
      src: z
        .string()
        .refine(isSafeImageSrc, 'src uses an unsafe URL scheme')
        .nullable()
        .describe('Image URL (https/relative/data: allowed; javascript:/file: schemes rejected). When omitted or the load fails, a muted placeholder box showing the `alt` text renders instead.'),
      alt: z.string().describe('Alternative text describing the image — REQUIRED for a11y; also shown inside the fallback placeholder. Describe the content ("Team standup in the office"), not the file.'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 2048 }).describe('Box width (accepts units, e.g. "100%" or "320px"). Omit for intrinsic/auto.'),
      height: dimensionSchema({ units: ['px', 'rem', '%'], max: 2048 }).describe('Box height (e.g. "240px"). Omit for intrinsic/auto.'),
      aspect: Aspect.describe('Aspect-ratio box (pairs with one of width/height). A common-ratio ENUM, not a free dimension.'),
      fit: z
        .enum(['cover', 'contain', 'fill', 'none'])
        .nullable()
        .describe('object-fit: how the image fills the box (default cover).'),
      position: z
        .enum(['center', 'top', 'bottom', 'left', 'right'])
        .nullable()
        .describe('object-position focal point kept in view when `fit:cover` crops the image: center (default) · top · bottom · left · right. Set it so faces/subjects at an edge are not cropped out.'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner rounding: none · sm · md (default, the theme radius) · lg · full (9999px). For an exact value use `radiusValue`.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "10px" / "0.5rem"). Overrides the `radius` enum, which is the default.'),
      border: z.boolean().nullable().describe('Draw a 1px border in the token border color (default false). `borderColor`/`borderWidthValue` imply it — set those to tint or thicken the edge.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact border thickness (e.g. "2px"; implies a border). Overrides the 1px default.'),
      shadow: z.enum(['none', 'sm', 'md', 'lg']).nullable().describe('Drop shadow depth: none (default) · sm · md · lg. Applies to the image and its placeholder alike.'),
      loading: z.enum(['lazy', 'eager']).nullable().describe('Native `loading` attribute controlling fetch timing: lazy (default — defer until near the viewport) · eager (fetch immediately). Set `eager` for an above-the-fold hero so it is not held back.'),
      borderColor: colorSchema.describe('Border color (implies a border). Names a specific edge color.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the placeholder caption shown when no image loads (default the muted-foreground token).'),
    }),
    description:
      'Image component: renders an img tag when `src` is set, otherwise a muted placeholder box showing the `alt` text (the same fallback when a load fails). Reach for it for general pictures — photos, screenshots, illustrations — sizing the box with `width`/`height`/`aspect` and cropping via `fit`/`position`; use Avatar for a person/account thumbnail instead. `alt` is required for accessibility, and unsafe URL schemes (javascript:/file:) are rejected while https/relative/data: are allowed.',
    example: {
      src: 'https://images.example.com/team-standup.jpg',
      alt: 'Team standup in the office',
      width: null,
      height: null,
      aspect: '16/9',
      fit: 'cover',
      position: null,
      radius: null,
      radiusValue: null,
      border: null,
      borderWidthValue: null,
      shadow: null,
      loading: null,
      borderColor: null,
      mutedColor: null,
    },
  },

  Avatar: {
    props: z.object({
      src: z
        .string()
        .refine(isSafeImageSrc, 'src uses an unsafe URL scheme')
        .nullable()
        .describe('Image URL for the avatar photo (javascript:/file: schemes rejected). When omitted or the load fails, initials derived from `name` render instead.'),
      name: z.string().describe('The person’s display name — REQUIRED. Drives the fallback initials (first letters of the first two words: "Jane Doe" → "JD"), the img alt text, and the hover tooltip.'),
      size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).nullable().describe('Box diameter and initials font size together: xs · sm · md (default) · lg · xl. Drop to `xs`/`sm` for inline/list rows, `lg`/`xl` for a profile header; use `sizeValue` for an exact diameter.'),
      sizeValue: dimensionSchema({ units: ['px', 'rem'], min: 16, max: 160 }).describe('Exact box diameter (width + height, e.g. "80px" / "5rem"). Overrides the `size` enum, which is the default (initials font size still follows the enum).'),
      shape: z
        .enum(['circle', 'rounded', 'square'])
        .nullable()
        .describe('Corner shape: circle (default) · rounded · square.'),
      ring: z
        .enum(['none', 'default', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Status ring around the avatar, token-colored (default none).'),
      border: z.boolean().nullable().describe('Render a token border (common for on-image avatars).'),
      bg: colorSchema.describe('Fallback background color behind the initials (default muted token).'),
      color: colorSchema.describe('Text colour of the fallback initials shown when there is no image (default the foreground token). Pair it with a branded `bg` for a coloured monogram chip.'),
      borderColor: colorSchema.describe('Border colour (implies a border; default the border token).'),
      ringColor: colorSchema.describe('Exact status-ring color (overrides the `ring` token color).'),
    }),
    description:
      'Circular user avatar: renders the image at `src`, falling back to initials derived from `name` when the image is absent or fails to load. Choose Avatar for people/account identity (comment authors, headers, member lists); use Image for general pictures. Supports a token-colored status `ring` and xs-xl sizes.',
    example: { name: 'Jane Doe', size: 'md' },
  },

  Badge: {
    props: z.object({
      text: z.string().describe('The badge label. Keep to 1-3 words ("Active", "Beta", "12 new") — Badge is a compact status/count chip, not a sentence.'),
      variant: z
        .enum(['default', 'secondary', 'destructive', 'outline'])
        .nullable()
        .describe('Visual hierarchy: default (solid primary) · secondary (muted fill) · destructive (danger fill) · outline (bordered, transparent). `tone` is the newer semantic-intent channel — prefer it for status meaning; `variant` stays for visual weight.'),
      tone: toneSchema,
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Padding + font size of the whole badge chip (default md).'),
      shape: z
        .enum(['pill', 'rounded', 'square'])
        .nullable()
        .describe('Corner shape: pill (fully round, default) · rounded · square.'),
      dot: z.boolean().nullable().describe('Show a small leading status dot before the `text` (default false = no dot). Color follows `dotColor`, or derives from `tone`/`bg` when unset.'),
      uppercase: z.boolean().nullable().describe('Uppercase the label with slight tracking (status-chip look).'),
      bg: colorSchema.describe('Exact background fill (brand badge). Wins over tone/variant.'),
      color: colorSchema.describe('Exact label text colour, naming a specific brand colour; wins over the `tone`/`variant` token. Pair it with a custom `bg` so the label stays legible on the fill.'),
      borderColor: colorSchema.describe('Exact border colour, naming a specific edge colour (wins over `tone`/`variant`). Most useful with `variant:outline`, where the border is the visible chrome.'),
      dotColor: colorSchema.describe('Colour of the leading status dot shown when `dot` is on (default derives from `tone`/`bg`). Set it to make the dot a distinct signal colour from the chip fill.'),
      font: Font.describe('Typeface for the badge label; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the badge label (light · normal · medium · semibold · bold; default medium).'),
      tracking: Tracking.describe('Letter-spacing of the badge label (tighter · tight · normal · wide · wider; default normal, or wide when `uppercase`).'),
      leading: Leading.describe('Line-height of the badge label (tight · snug · normal · relaxed · loose; default the size default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the badge label (e.g. "13px" / "0.8125rem"). Overrides the `size` enum font size, which is the default (md ≈ 0.75rem).'),
    }),
    description:
      'Compact status or count chip holding a 1-3 word `text` ("Active", "Beta", "12 new"). Reach for it to label an item\'s state or a small count inline — next to a title, in a table cell, on a nav item — not for sentences or actions. `tone` colours it by semantic intent (success/warning/critical/info) and is the preferred channel; `variant` (default/secondary/destructive/outline) sets visual weight, and an optional leading `dot` plus `pill`/`rounded`/`square` shape tune the look.',
    example: { text: 'Active', variant: 'default' },
  },

  Alert: {
    props: z.object({
      title: z.string().describe('Bold headline of the alert. Keep to a short phrase ("Changes saved", "Payment failed") — the `message` carries the detail.'),
      message: z.string().nullable().describe('Muted body line under the `title` giving the detail/next step (default none — title-only alert). One or two short sentences; longer explanations belong in a Card.'),
      type: z.enum(['info', 'success', 'warning', 'error']).nullable().describe('Legacy semantic channel driving the default icon + color (default info). Prefer `tone` (success/warning/critical/info) going forward — `critical` maps to the same visual as `error`.'),
      tone: toneSchema,
      variant: z
        .enum(['subtle', 'solid', 'outline'])
        .nullable()
        .describe('Fill intensity: subtle (tinted, default) · solid (high-contrast) · outline.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Padding + font size of the title/message (default md).'),
      align: z.enum(['left', 'center']).nullable().describe('Content alignment of the icon + title/message block (default left).'),
      icon: z
        .string()
        .nullable()
        .describe('Leading status icon rendered as a 16px SVG from the closed registry. Special values: "auto" (derive the status glyph from type/tone, default) · "none" (no icon) · one of the status keywords "info"/"success"/"warning"/"error" (its status glyph). Any OTHER value is treated as a registry icon NAME (e.g. "bell", "shield") and rendered directly; an unknown name falls back to the status glyph. Never raw SVG.'),
      dismissible: z.boolean().nullable().describe('Show a close (×) button that hides the alert on click (also emits `dismiss`).'),
      dismissed: z.boolean().nullable().describe('Whether the alert has been closed; written back here on dismiss. Bind with { $bindState } to read/persist the closed state so a Button/agent knows the alert was hidden.'),
      dismissLabel: z.string().nullable().describe('Accessible label for the dismiss (×) button (default "Dismiss"). Escaped text — set for i18n/localized affordances.'),
      dismissIcon: z.string().nullable().describe('Glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) for the dismiss affordance (default the literal "×"). Unknown/absent names keep the × char. Never raw SVG.'),
      accentBar: z.boolean().nullable().describe('Show a leading 3px vertical accent bar down the alert\'s left edge, coloured by `accent` (default false = no bar). Turn it on to give the banner a stronger status stripe.'),
      bg: colorSchema.describe('Exact background fill (brand/announcement banner). Wins over tone/type.'),
      borderColor: colorSchema.describe('Exact border colour of the alert box, naming a specific edge colour; wins over the `tone`/`type` token. Set it to tint the outline to match a custom `bg`.'),
      accent: colorSchema.describe('Ink colour of the leading status icon — the glyph is drawn ON the alert surface, so treat it like text colour, never as a fill — and of the optional `accentBar` stripe down the left edge. Default follows the semantic `tone`/`type` token (success/warning/critical/info); on the neutral `type:info` the icon inherits the alert text colour and the bar uses the foreground token; on `variant:solid` both follow the on-fill text. An explicit value wins everywhere.'),
      accentText: colorSchema.describe('On-fill text colour for the title/message — set with `variant:solid` (or a custom `bg`) so text stays legible over a saturated fill (default the on-primary token).'),
      font: Font.describe('Typeface for the whole alert region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the alert `title` (light · normal · medium · semibold · bold; default semibold).'),
      tracking: Tracking.describe('Letter-spacing of the alert `title` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the alert `title` (tight · snug · normal · relaxed · loose; default the title default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the alert `title` (e.g. "18px" / "1.125rem"). Default 0.9375rem.'),
    }),
    events: ['dismiss'],
    eventsDoc: { dismiss: 'The × close button was clicked; the alert hides itself locally and `label` carries the `title`.' },
    description:
      'Inline status banner with a leading SVG status icon (from the closed registry — info/check-circle/alert-triangle/alert-circle by status, or any registry name via `icon`), `title`, and optional `message`. Choose Alert over Banner for page/section-level feedback tied to a specific action (form errors, save confirmations) and over Callout for transient status rather than an evergreen tip. `type` (info/success/warning/error) is the legacy channel; `tone` is the unified one. When `dismissible`, the × hides it locally and emits `dismiss`. Bind `dismissed` with { $bindState } so the agent (or a sibling control) can read whether the alert has been closed from spec.state.',
    example: {
      title: 'Note',
      message: 'Your changes have been saved.',
      type: 'success',
    },
  },

  Progress: {
    props: z.object({
      value: z.number().describe('Current fill amount, in the same units as `max` (e.g. 65 of 100). Clamped to the 0–`max` range when rendering.'),
      max: z.number().nullable().describe('Upper bound `value` is measured against (default 100 — treat `value` as a percentage when unset).'),
      label: z.string().nullable().describe('Leading caption above the track (e.g. "Upload progress"). Omit for a bare bar with no caption row.'),
      tone: z
        .enum(['default', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Bar color via token (e.g. critical when over budget). Default is the primary token.'),
      size: z.enum(['xs', 'sm', 'md', 'lg']).nullable().describe('Track (and fill bar) thickness in coarse steps: xs · sm (default) · md · lg. For an exact height use `height`.'),
      height: dimensionSchema({ units: ['px', 'rem'], min: 2, max: 48 }).describe('Exact track thickness (e.g. "12px" / "0.75rem"). Overrides the `size` enum, which is the default; the bar follows the track height.'),
      shape: z.enum(['pill', 'square']).nullable().describe('Track and fill-bar corner shape: pill (fully rounded ends, default) · square (flat corners).'),
      showValue: z
        .enum(['none', 'percent', 'fraction'])
        .nullable()
        .describe('Trailing value readout: none (default) · percent ("65%") · fraction ("13/20").'),
      striped: z.boolean().nullable().describe('Draw a diagonal-stripe pattern over the filled bar (default false = solid fill). Tint via `overlayColor`.'),
      animated: z.boolean().nullable().describe('Animate the stripes (moving diagonal) or, with `indeterminate`, the shimmer sweep (default false = static).'),
      indeterminate: z.boolean().nullable().describe('Unknown-progress mode: shows a shimmering full-width bar and ignores `value`/`showValue` (default false = determinate, driven by `value`).'),
      color: colorSchema.describe('Exact fill-bar color, naming a specific brand color (wins over the `tone` token).'),
      trackColor: colorSchema.describe('Exact track (unfilled background) color (default the muted token).'),
      overlayColor: colorSchema.describe('Stripe scrim colour drawn over the bar fill when `striped` (default a translucent white). Tint it darker for a light bar fill.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the trailing value readout (percent/fraction) (default the muted-foreground token).'),
    }),
    description:
      'Horizontal progress bar showing `value` against `max` (default 0-100). Use for a determinate task (upload %, form completion, budget usage) — reach for Spinner instead when there is no known completion percentage, or `indeterminate:true` here for an unknown-duration task that still wants a bar shape. `showValue` adds a percent/fraction readout; `tone`/`color` set the fill.',
    example: { value: 65, max: 100, label: 'Upload progress' },
  },

  Skeleton: {
    props: z.object({
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 2048 }).describe('Box width, up to 2048px (validated; default 100% — fills its container). Use with `shape:circle` to size an avatar placeholder (pair with matching `height`).'),
      height: dimensionSchema({ units: ['px', 'rem', '%'], max: 2048 }).describe('Box height, up to 2048px (validated; default 1rem — a single text-line height).'),
      shape: z
        .enum(['line', 'rect', 'circle', 'pill'])
        .nullable()
        .describe('Placeholder shape: line (text bar) · rect (card, default) · circle (avatar) · pill (button).'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner rounding for line/rect shapes (default md).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius for line/rect shapes (e.g. "6px"). Overrides the `radius` enum, which is the default; circle/pill stay round.'),
      animation: z
        .enum(['pulse', 'shimmer', 'none'])
        .nullable()
        .describe('Loading animation: pulse (default) · shimmer · none.'),
      tone: z.enum(['default', 'subtle']).nullable().describe('Base gray intensity of the placeholder fill: default · subtle (lighter, for a placeholder inside an already-muted surface).'),
      lines: dimensionSchema({ kind: 'count', min: 1, max: 8 }).describe('Render N stacked line skeletons instead of one box (1-8, e.g. 3 for a paragraph placeholder); the last line is auto-shortened to 60% width (text-block look). Ignored when unset (single box).'),
    }),
    description:
      'Gray placeholder box that mimics the shape of content still loading — a line, card rect, circular avatar, or pill button. Use it wherever a Spinner would be too generic: it reserves the actual layout space so content does not jump in when it arrives. Purely decorative: no children, no events, `aria-hidden`.',
    example: {
      width: null,
      height: null,
      shape: 'line',
      radius: null,
      radiusValue: null,
      animation: null,
      tone: null,
      lines: 3,
    },
  },

  Spinner: {
    props: z.object({
      size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).nullable().describe('Glyph diameter in coarse steps: xs · sm · md (default) · lg · xl. For an exact pixel size (variant:ring only) use `sizeValue`.'),
      sizeValue: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 128 }).describe('Exact glyph box diameter (width + height, e.g. "48px" / "3rem"). Overrides the `size` enum (which is the default) for variant:ring; dots/bars keep the enum.'),
      label: z.string().nullable().describe('Text shown beside/under the spinner glyph, positioned via `labelPosition` (e.g. "Loading…"). Omit for a bare glyph with only an aria-only fallback.'),
      tone: z
        .enum(['default', 'muted', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Colour of the moving arc/glyph via a semantic token: default (primary) · muted · success · warning · critical · info. Use `muted` for a low-key inline wait; `color` sets an exact value instead.'),
      variant: z.enum(['ring', 'dots', 'bars']).nullable().describe('Spinner glyph style: ring (a rotating arc, default) · dots (pulsing dots) · bars (scaling bars). Ring is the general default; dots/bars read as lighter, more playful waits.'),
      speed: z
        .enum(['slow', 'normal', 'fast'])
        .nullable()
        .describe('Ring rotation speed (default normal). Applies to variant:ring (dots/bars use a fixed cadence).'),
      thickness: z
        .enum(['thin', 'regular', 'thick'])
        .nullable()
        .describe('Ring stroke width (default regular). Applies to variant:ring.'),
      labelPosition: z
        .enum(['right', 'bottom', 'none'])
        .nullable()
        .describe('Where the label sits: right (default) · bottom · none (aria-only).'),
      color: colorSchema.describe('Exact colour of the moving active arc/glyph, naming a specific brand colour; wins over the `tone` token. Reach for it when the spinner sits on a branded surface.'),
      trackColor: colorSchema.describe('Exact colour of the inactive (unfilled) ring behind the moving arc — variant:ring only (default the border token). Set it for contrast on a dark/tinted surface; dots/bars have no track.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the label beside/under the spinner (default the muted-foreground token).'),
    }),
    description:
      'Animated loading indicator (`variant`: ring · dots · bars) for a busy state with no known completion percentage. Use over Progress when duration is unknown or the wait is brief; use over Skeleton when there is no content shape to preview yet (e.g. an inline button/page-level spinner rather than a layout placeholder).',
    example: {
      size: 'md',
      sizeValue: null,
      label: 'Loading…',
      tone: null,
      variant: 'ring',
      speed: null,
      thickness: null,
      labelPosition: null,
      color: null,
      trackColor: null,
      mutedColor: null,
    },
  },

  Tooltip: {
    props: z.object({
      content: z.string().describe('The bubble text shown on hover/focus. Keep to a short phrase — a tooltip is a hint, not a Popover-length explanation.'),
      text: z.string().describe('The always-visible trigger label the tooltip attaches to (e.g. an underlined term or an icon caption).'),
      placement: z.enum(['top', 'bottom', 'left', 'right']).nullable().describe('Which side of the `text` trigger the bubble appears on (default top).'),
      size: z.enum(['sm', 'md']).nullable().describe('Density of the hover bubble — its padding and font size together: sm (tighter, for a terse hint) · md (default). Only two steps; a tooltip stays small by design.'),
      bg: colorSchema.describe('Bubble background color (default is the dark foreground token).'),
      color: colorSchema.describe('Bubble text color (default is the light card token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the hover bubble (e.g. "8px" / "0.5rem"). Default the theme radius / 2.'),
      maxWidthValue: dimensionSchema({ units: ['px', 'rem'], min: 80, max: 640 }).describe('Cap on the bubble width (e.g. "16rem"). Default: no cap — the bubble is a single nowrap line. Set it for a sentence-length `content` so the bubble wraps onto multiple lines instead of overflowing the viewport.'),
      shadow: Shadow.describe('Elevation of the hover bubble (none · sm · md · lg · xl). Default: none (flat). Reach for a value to lift the bubble off the surface.'),
      motion: Motion.describe('Enter-transition speed for the bubble (fast/normal/slow). Default: the current fade — no extra animation.'),
    }),
    description:
      'Small hover/focus bubble showing `content` next to its `text` trigger. Use for a brief clarifying hint on a label, icon, or truncated value — reach for Popover instead when the panel needs its own interactive content (buttons, a form) or should open on click rather than hover. Set `maxWidthValue` to let a longer hint wrap.',
    example: {
      content: 'Used to authenticate requests from your server.',
      text: 'API key',
      placement: 'top',
      size: null,
      bg: null,
      color: null,
      radiusValue: null,
      maxWidth: null,
      shadow: null,
      motion: null,
    },
  },

  Popover: {
    props: z.object({
      trigger: z.string().describe('The trigger button label (e.g. "More info", "Filters"). Click toggles the floating `content` panel open/closed.'),
      content: z.string().describe('Text rendered inside the floating panel once opened. For richer content than plain text, compose the panel from other components instead of this one Popover.'),
      open: z.boolean().nullable().describe('Controlled open state of the floating panel. Use { $bindState } so an external Button can read/drive whether the popover is open — mirrored back into spec.state on every open/close. Omit for uncontrolled (see defaultOpen).'),
      defaultOpen: z.boolean().nullable().describe('Start the panel open on first render (uncontrolled; default false = closed). Ignored once a bound `open` resolves.'),
      triggerVariant: z.enum(['default', 'outline', 'ghost']).nullable().describe('Trigger button style: default (filled) · outline · ghost.'),
      placement: z.enum(['bottom', 'top', 'left', 'right']).nullable().describe('Which side of the trigger the panel opens toward (default bottom).'),
      align: z.enum(['start', 'center', 'end']).nullable().describe('Panel alignment along the trigger edge (default start).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Panel min-width + padding: sm · md (default) · lg. For an exact width use `width`.'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner rounding of the floating panel — none · sm · md · lg · full (default md, the frayme radius token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact panel corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      bg: colorSchema.describe('Background colour of the floating panel surface (default the card token). Pair with a dark value for a branded popover so the `content` stays legible on the fill.'),
      borderColor: colorSchema.describe('Border colour of the floating panel (default the border token). Set it to tint the panel outline — e.g. to match a custom `bg` or a brand edge.'),
      accent: colorSchema.describe('Text colour of the trigger button label — and its border on the outline variant — when `triggerVariant` is outline or ghost (default the primary token).'),
      width: dimensionSchema({ units: ['px', 'rem'], min: 120, max: 480 }).describe('Exact panel width (e.g. "16rem"). Overrides the `size` enum min-width.'),
      shadow: Shadow.describe('Elevation of the floating popover panel (none · sm · md · lg · xl); overrides the default raised shadow.'),
      motion: Motion.describe('Enter-transition speed for this overlay (fast/normal/slow). Default: no animation — the panel appears instantly.'),
    }),
    description:
      'Click-triggered floating panel showing `content` next to a `trigger` button. Light-dismiss: clicking outside the panel or pressing Escape closes it (re-clicking the trigger also toggles). Use over Tooltip when the panel needs to stay open for reading/interaction rather than vanish on mouse-out, and over DropdownMenu when the panel is free-form text rather than a list of selectable items. Bind `open` with { $bindState } so the agent (or a sibling control) can read whether the panel is currently open from spec.state.',
    example: {
      trigger: 'Filters',
      content: 'Narrow results by status, owner, and date range.',
      open: null,
      defaultOpen: null,
      triggerVariant: null,
      placement: 'bottom',
      align: null,
      size: null,
      radius: null,
      radiusValue: null,
      bg: null,
      borderColor: null,
      accent: null,
      width: null,
      shadow: null,
      motion: null,
    },
    events: ['change'],
    eventsDoc: {
      change: 'The panel was opened or closed — via the trigger, an outside click, or Escape; params carry {open} — the resolved boolean open state after the toggle.',
    },
  },

  // =========================================================================
  // Form Input Components
  // =========================================================================

  Input: {
    props: z.object({
      label: z.string().describe('The field label shown above (or visually hidden via `labelPlacement:hidden`, still read by screen readers). Keep to 1-3 words ("Email", "Full name").'),
      name: z.string().describe('The form field name — the key this value is collected under in a Form\'s `commit` `fields` payload, and used to derive the input\'s DOM id.'),
      type: z
        .enum(['text', 'email', 'password', 'number', 'tel', 'url', 'search'])
        .nullable()
        .describe('Native input type (default text) — drives browser validation, the mobile keyboard, and masking (password dots, number spinners). Match it to the data: `email`/`tel`/`url` for contact fields, `number` for quantities, `search` for a filter box.'),
      placeholder: z.string().nullable().describe('Faint hint text shown inside the empty field (e.g. "you@example.com"). Not a substitute for `label` — it disappears on typing/for screen readers relying on it alone.'),
      value: z.string().nullable().describe('Current text value. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial value.'),
      checks: validationCheckSchema,
      validateOn: validateOnSchema,
      // component-specific
      inputMode: z
        .enum(['text', 'numeric', 'decimal', 'email', 'tel', 'url', 'search'])
        .nullable()
        .describe('Mobile keyboard hint (derived from `type` when omitted).'),
      autocomplete: z
        .enum(['on', 'off', 'name', 'email', 'username', 'current-password', 'new-password', 'tel', 'one-time-code'])
        .nullable()
        .describe('Browser autofill hint (the HTML `autocomplete` attribute; default on).'),
      autofocus: z.boolean().nullable().describe('Focus the field automatically on mount (default false). Use sparingly — at most one autofocused field per screen.'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner-radius token for the input box: none · sm · md (default) · lg · full. Drop to `sm` on dense forms, reach for `full` for a pill search field; use `radiusValue` for an exact length.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      align: z.enum(['left', 'center', 'right']).nullable().describe('Text alignment inside the box (default left; use right for currency/numeric fields).'),
      minLength: z.number().nullable().describe('Minimum character length, enforced natively via the `minlength` attribute (also enforce via `checks` for a custom error message).'),
      maxLength: z.number().nullable().describe('Maximum character length, enforced natively via the `maxlength` attribute (no default — unlimited).'),
      min: z.number().nullable().describe('Numeric lower bound, enforced natively via the `min` attribute (only meaningful when `type:number`).'),
      max: z.number().nullable().describe('Numeric upper bound, enforced natively via the `max` attribute (only meaningful when `type:number`).'),
      step: z.number().nullable().describe('Numeric step granularity for the native spinner/keyboard arrows, enforced via the `step` attribute (only meaningful when `type:number`; default 1).'),
      prefix: z.string().nullable().describe('Inline leading adornment string rendered INSIDE the bordered field, sharing its background (e.g. "£", "@"; default none).'),
      suffix: z.string().nullable().describe('Inline trailing adornment string rendered INSIDE the bordered field, sharing its background (e.g. ".com", "kg"; default none).'),
      icon: z.string().nullable().describe('Leading icon by registry name (same closed icon set as Button.icon, e.g. "mail" / "lock" / "user") rendered inside the field before the text, in the muted color; unknown names render nothing (default none).'),
      borderColor: colorSchema.describe('Resting border color of the field box (default border token).'),
      bg: colorSchema.describe('Field background color, shared by the box and any prefix/suffix/icon adornments (default card token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — help text, the leading icon + prefix/suffix adornments, and the ::placeholder text (default the muted-foreground token).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      ...formFieldBase,
    }),
    events: ['commit', 'change'],
    eventsDoc: {
      commit: 'The field finished editing — Enter was pressed OR focus left it (tab/click away); params carry {value, name} — the finished text and the field name.',
      change: 'The text changed on every keystroke/edit; params carry {value, name} — the live current value and the field name. Only fires when `emitOnChange` !== false; the bound `value` state stays live regardless.',
    },
    description:
      'Text input field, with optional inline prefix/suffix strings and a leading `icon` rendered inside the bordered box (adornments share the field background and dim with a disabled control). Use { $bindState } on value for two-way binding. Use checks for validation (e.g. required, email, minLength). validateOn controls timing (default: blur).',
    example: {
      label: 'Email',
      name: 'email',
      type: 'email',
      placeholder: 'you@example.com',
    },
  },

  Textarea: {
    props: z.object({
      label: z.string().describe('The field label shown above (or visually hidden via `labelPlacement:hidden`, still read by screen readers). Keep to 1-3 words ("Description", "Notes").'),
      name: z.string().describe('The form field name — the key this value is collected under in a Form\'s `commit` `fields` payload, and used to derive the field\'s DOM id.'),
      placeholder: z.string().nullable().describe('Faint hint text shown inside the empty box (e.g. "Add any additional context…"). Not a substitute for `label`.'),
      rows: z.number().nullable().describe('Visible line count that sets the box\'s starting height (default 4). Ignored for growth once `autosize` is on — use `maxHeight` to cap it instead.'),
      value: z.string().nullable().describe('Current text value. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial value.'),
      checks: validationCheckSchema,
      validateOn: validateOnSchema,
      // component-specific
      maxLength: z.number().nullable().describe('Maximum character length, enforced natively via the `maxlength` attribute (no default — unlimited). Pair with `showCount` to surface the limit as `n/max`.'),
      showCount: z.boolean().nullable().describe('Render a character counter next to the label (default false): `n/maxLength` when `maxLength` is set, otherwise a plain `n` count.'),
      resize: z
        .enum(['none', 'vertical', 'horizontal', 'both'])
        .nullable()
        .describe('Which drag handle the user gets to resize the box: none · vertical (default) · horizontal · both. Set `none` to lock the height in a fixed layout, or when `autosize` already grows the box.'),
      autosize: z.boolean().nullable().describe('Grow the box with its content (CSS field-sizing) instead of the fixed `rows` height; pair with `maxHeight` to cap the growth (default off = fixed rows).'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner rounding of the textarea box — none · sm · md · lg · full (default md); `radiusValue` overrides with an exact length.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      borderColor: colorSchema.describe('Resting border colour of the textarea box (default the border token). Set it to tint the field edge — pairs with `bg` to brand the control on a coloured surface.'),
      bg: colorSchema.describe('Background colour of the textarea box (default the card token). Pair with a legible text colour on a dark/tinted surface so authored text and the placeholder stay readable.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — help text, character counter, and the ::placeholder text (default the muted-foreground token).'),
      minHeight: dimensionSchema({ units: ['px', 'rem'], max: 900 }).describe('Minimum box height, floor for growth (e.g. "6rem"). Set it to reserve room for a few lines even when empty; most useful alongside `autosize` so the box never collapses below it.'),
      maxHeight: dimensionSchema({ units: ['px', 'rem'], max: 900 }).describe('Maximum box height that caps growth (e.g. "20rem"); past it the textarea scrolls internally. Pair with `autosize` to let the box grow to a point and then stop.'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      ...formFieldBase,
    }),
    events: ['commit', 'change'],
    eventsDoc: {
      commit: 'The user finished authoring — focus left the box, or Ctrl/Cmd+Enter was pressed (not IME-composition/key-repeat); params carry {value, name} — the full authored text and the field name.',
      change: 'The text changed on every keystroke/edit; params carry {value, name} — the live current value and the field name. Only fires when `emitOnChange` !== false; the bound `value` state stays live regardless.',
    },
    description:
      'Multi-line text input. Use { $bindState } on value for binding. Use checks for validation. validateOn controls timing (default: blur).',
    example: {
      label: 'Description',
      name: 'description',
      placeholder: 'Add any additional context…',
      rows: 4,
      value: null,
      checks: null,
      validateOn: null,
      maxLength: null,
      showCount: null,
      resize: null,
      autosize: null,
      radius: null,
      radiusValue: null,
      borderColor: null,
      bg: null,
      mutedColor: null,
      minHeight: null,
      maxHeight: null,
      emitOnChange: null,
      disabled: null,
      readonly: null,
      required: null,
      helpText: null,
      errorText: null,
      size: null,
      labelPlacement: null,
      labelColor: null,
      accent: null,
      width: null,
    },
  },

  Select: {
    props: z.object({
      label: z.string().describe('The field label shown above (or visually hidden via `labelPlacement:hidden`, still read by screen readers). Keep to 1-3 words ("Country", "Plan").'),
      name: z.string().describe('The form field name — the key this value is collected under in a Form\'s `commit` `fields` payload, and used to derive the field\'s DOM id.'),
      options: z
        .union([z.array(z.string()), z.array(z.object({ value: z.string(), label: z.string() }))])
        .describe('The selectable options, in display order. Either a plain string array (e.g. ["Small","Medium","Large"] — each string is both the label and the emitted value) OR an array of {value,label} pairs (e.g. [{value:"sm",label:"Small"}]) when the stored value must differ from the shown text. Do not mix the two forms in one array.'),
      placeholder: z.string().nullable().describe('Text shown as the first, unselected option (default "Select…"). Disabled unless `clearable` is on, so the user can\'t re-select the empty state.'),
      value: z.string().nullable().describe('Current selected option (must match one of `options`). Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial selection.'),
      checks: validationCheckSchema,
      validateOn: validateOnSchema,
      // component-specific; `accent` comes from formFieldBase
      // (`multiple` KILLED — the renderer binds a string value; a multi-select
      // string[] binding was never implemented, so the prop was a false promise)
      clearable: z.boolean().nullable().describe('Keep the placeholder option selectable so the user can return to an empty selection (default false = the placeholder option is disabled once a real value is chosen).'),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner-radius token for the select box: none · sm · md (default) · lg · full. Drop to `sm` on dense forms, `lg`/`full` for a softer look; use `radiusValue` for an exact length.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      borderColor: colorSchema.describe('Resting border colour of the select box (default the border token). Set it to tint the field edge — pairs with `bg` to brand the control on a coloured surface.'),
      bg: colorSchema.describe('Background colour of the select box (default the card token). Pair with a legible text colour on a dark/tinted surface so the value and placeholder stay readable.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — help text under the field, and the unselected placeholder option text (default the muted-foreground token).'),
      ...formFieldBase,
    }),
    events: ['change'],
    eventsDoc: { change: 'A different option was chosen from the native dropdown; params carry {value, name}.' },
    description:
      'Native dropdown select bound to a single string `value` from a fixed `options` list (plain strings, or {value,label} pairs when the stored value differs from the shown text). Choose Select over DropdownMenu when the options are a flat list feeding a form field (native mobile picker, no custom item content); choose DropdownMenu when items need icons or the trigger should read as an action rather than a form field. Use checks for validation; validateOn controls timing (default: change). Bind `value` with { $bindState } so the agent (or a sibling control) can read the currently-selected option from spec.state.',
    example: {
      label: 'Plan',
      name: 'plan',
      options: ['Starter', 'Pro', 'Scale'],
      placeholder: 'Select…',
      value: null,
      checks: null,
      validateOn: null,
      clearable: null,
      radius: null,
      radiusValue: null,
      borderColor: null,
      bg: null,
      mutedColor: null,
      disabled: null,
      readonly: null,
      required: null,
      helpText: null,
      errorText: null,
      size: null,
      labelPlacement: null,
      labelColor: null,
      accent: null,
      width: null,
    },
  },

  Checkbox: {
    props: z.object({
      label: z.string().describe('The text beside the checkbox. Keep to a short phrase ("I agree to the terms") — for a longer explanation use `description` underneath.'),
      name: z.string().describe('The form field name — the key this value is collected under in a Form\'s `commit` `fields` payload, and used to derive the field\'s DOM id.'),
      checked: z.boolean().nullable().describe('Whether the box is ticked. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial state (default false).'),
      checks: validationCheckSchema,
      validateOn: validateOnSchema,
      // component-specific; `accent` (the box fill) from base
      indeterminate: z.boolean().nullable().describe('Show the dash/tri-state visual (a "some but not all children selected" parent-of-group look) instead of a tick, regardless of `checked` (default false). Purely visual — set/read via the ordinary `checked` state.'),
      description: z.string().nullable().describe('Secondary muted line under the label for extra context (e.g. a terms summary). Omit when the `label` alone is self-explanatory.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the description line + help text (default the muted-foreground token).'),
      ...formFieldBase,
    }),
    events: ['change'],
    eventsDoc: { change: 'The box was ticked or unticked; params carry {checked, name}.' },
    description:
      'Single checkbox bound to a boolean `checked`. Use for an independent on/off choice (agree to terms, opt-in) or one item in a manually-composed multi-select group; use Switch instead for an immediate-effect setting toggle, and Radio for mutually-exclusive single-choice options. Use checks for validation; validateOn controls timing (default: change). Bind `checked` with { $bindState } so the agent (or a sibling control) can read the current ticked/unticked boolean from spec.state.',
    example: {
      label: 'I agree to the terms',
      name: 'terms',
      checked: false,
      checks: null,
      validateOn: null,
      indeterminate: null,
      description: null,
      mutedColor: null,
      disabled: null,
      readonly: null,
      required: null,
      helpText: null,
      errorText: null,
      size: null,
      labelPlacement: null,
      labelColor: null,
      accent: null,
      width: null,
    },
  },

  Radio: {
    props: z.object({
      label: z.string().describe('The group legend shown above the options (or visually hidden via `labelPlacement:hidden`). Keep to 1-3 words ("Shipping speed").'),
      name: z.string().describe('The shared form field name for the whole group — the key this value is collected under in a Form\'s `commit` `fields` payload, and the native `name` grouping the radio inputs.'),
      options: z
        .union([z.array(z.string()), z.array(z.object({ value: z.string(), label: z.string() }))])
        .describe('The selectable options, in display order. Either a plain string array (e.g. ["Standard","Express","Overnight"] — each string is both the shown label and the value emitted on `change`) OR an array of {value,label} pairs (e.g. [{value:"std",label:"Standard"}]) when the stored value must differ from the shown text — the same union Select accepts. Do not mix the two forms in one array.'),
      value: z.string().nullable().describe('Current selected option (must match one of `options`). Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial selection (default none selected).'),
      checks: validationCheckSchema,
      validateOn: validateOnSchema,
      // component-specific; `accent` (selected dot) from base.
      orientation: z
        .enum(['horizontal', 'vertical'])
        .nullable()
        .describe('Stack the options vertically (default) or in a row.'),
      // Coarse option-spacing ENUM (sm·md·lg), mirroring Stack's `gap` menu.
      gap: z.enum(['sm', 'md', 'lg']).nullable().describe('Coarse spacing between options (sm·md·lg; default sm). For an exact value use `gapValue`.'),
      // `gap` is an ENUM key on Stack/Grid/Carousel/Tabs and is NOT a value-channel
      // key in the gate (resolution.ts DIM_KEYS). Naming the dimension `gap` would
      // (a) collide with that enum meaning and (b) escape gate coverage. So the EXACT
      // option-spacing dimension is `gapValue` (already a gate DIM_KEY), and Radio
      // additionally keeps the small coarse `gap` ENUM above.
      gapValue: dimensionSchema({ units: ['px', 'rem'], max: 32 }).describe('Exact spacing between options (e.g. "1rem") when the `gap` enum is too coarse.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — help text under the group (default the muted-foreground token).'),
      ...formFieldBase,
    }),
    events: ['change'],
    eventsDoc: { change: 'A different option was picked; params carry {value, name}.' },
    description:
      'Mutually-exclusive single-choice group bound to a string `value` from a fixed `options` list. Use over Select when the option count is small enough (2-5) to show all choices at once without a dropdown; use over ToggleGroup when the choice is a form field value rather than a UI-state selector. Use checks for validation; validateOn controls timing (default: change). Bind `value` with { $bindState } so the agent (or a sibling control) can read the currently-selected option from spec.state.',
    example: {
      label: 'Shipping speed',
      name: 'shipping',
      options: ['Standard', 'Express', 'Overnight'],
      value: 'Standard',
      checks: null,
      validateOn: null,
      orientation: null,
      gap: null,
      gapValue: null,
      mutedColor: null,
      disabled: null,
      readonly: null,
      required: null,
      helpText: null,
      errorText: null,
      size: null,
      labelPlacement: null,
      labelColor: null,
      accent: null,
      width: null,
    },
  },

  Switch: {
    props: z.object({
      label: z.string().describe('The text beside the switch track. Keep to a short phrase ("Email notifications") — for extra context add `description` underneath.'),
      name: z.string().describe('The form field name — the key this value is collected under in a Form\'s `commit` `fields` payload, and used to derive the field\'s DOM id.'),
      checked: z.boolean().nullable().describe('Whether the switch is ON. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial state (default false = off).'),
      checks: validationCheckSchema,
      validateOn: validateOnSchema,
      // component-specific; `accent` = the ON-track color (base).
      offColor: colorSchema.describe('Track colour when the switch is OFF (default the border token); the ON track uses `accent`. Set it for a stronger off/on contrast or to match a branded surface.'),
      description: z.string().nullable().describe('Secondary muted line under the label for extra context (e.g. what the setting affects). Omit when the `label` alone is self-explanatory.'),
      onLabel: z.string().nullable().describe('Optional text beside the track when ON (e.g. "On").'),
      offLabel: z.string().nullable().describe('Optional text beside the track when OFF (e.g. "Off").'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the description line, on/off side label + help text (default the muted-foreground token).'),
      ...formFieldBase,
    }),
    events: ['change'],
    eventsDoc: { change: 'The switch was toggled on or off; params carry {checked, name}.' },
    description:
      'Boolean on/off toggle bound to `checked`, applying immediately (no separate save step implied). Use over Checkbox for a setting that takes effect right away (notifications, dark mode) rather than a form-submit choice; the visual reads as a physical switch, not a form checkbox. Use checks for validation; validateOn controls timing (default: change). Bind `checked` with { $bindState } so the agent (or a sibling control) can read the current on/off boolean from spec.state.',
    example: {
      label: 'Dark mode',
      name: 'darkMode',
      checked: true,
      checks: null,
      validateOn: null,
      offColor: null,
      description: null,
      onLabel: null,
      offLabel: null,
      mutedColor: null,
      disabled: null,
      readonly: null,
      required: null,
      helpText: null,
      errorText: null,
      size: null,
      labelPlacement: null,
      labelColor: null,
      accent: null,
      width: null,
    },
  },

  Slider: {
    props: z.object({
      label: z.string().nullable().describe('The field label shown above the track (or visually hidden via `labelPlacement:hidden`). Keep to 1-3 words ("Volume", "Budget"). Omit for a bare slider with no caption.'),
      name: z.string().nullable().describe('The form field name — the key this value is collected under in a Form\'s `commit` `fields` payload, and used to derive the field\'s DOM id.'),
      min: z.number().nullable().describe('Range minimum, in the same units as `value` (default 0).'),
      max: z.number().nullable().describe('Range maximum, in the same units as `value` (default 100).'),
      step: z.number().nullable().describe('Increment the thumb snaps to on drag/arrow-key (default 1). Use a fraction (e.g. 0.1) for finer control.'),
      value: z.number().nullable().describe('Current numeric position within [min, max]. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial position.'),
      // component-specific; `accent` (filled track + thumb) +
      // `width` come from formFieldBase.
      showValue: z.boolean().nullable().describe('Render the live numeric readout beside the label (default true). Suffix it via `valueSuffix`.'),
      trackColor: colorSchema.describe('Colour of the unfilled portion of the track behind the thumb (default the border token); the filled portion + thumb use `accent`. Set it for contrast on a dark/tinted surface.'),
      valueSuffix: z.string().nullable().describe('Unit string appended to the live numeric readout (e.g. "%", "°C", " GB"); default none. Set it so the value reads with its unit — pairs with `showValue`, which renders the readout.'),
      marks: z
        .union([z.array(z.number()), z.array(z.object({ value: z.number(), label: z.string() }))])
        .nullable()
        .describe('Tick labels under the track, each positioned at its true value along the min–max range (marks need not be evenly spaced): array of numbers, or {value,label} objects.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the value readout + mark labels (default the muted-foreground token).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      ...formFieldBase,
    }),
    events: ['change', 'commit'],
    eventsDoc: {
      change: 'The thumb moved to a new value (drag or arrow key); params carry {value, name}. Only fires when `emitOnChange` !== false; the bound `value` state stays live regardless.',
      commit: 'The drag/interaction settled on one final value (pointer released, or the value changed via keyboard); params carry {value, name} — the single settled value per interaction, always emitted even when `emitOnChange` is false.',
    },
    description:
      'Draggable single-thumb range control bound to a numeric `value` between `min` and `max`. Use for a continuous or evenly-stepped numeric setting (volume, price budget) — reach for Input `type:number` instead when precise keyboard entry matters more than a visual range, and for a discrete small option set (2-5 named choices) prefer Radio/ToggleGroup. Use `{ $bindState }` on `value` for two-way binding.',
    example: {
      label: 'Budget',
      name: 'budget',
      min: 0,
      max: 1000,
      step: null,
      value: 250,
      showValue: null,
      trackColor: null,
      valueSuffix: '£',
      marks: null,
      mutedColor: null,
      emitOnChange: null,
      disabled: null,
      readonly: null,
      required: null,
      helpText: null,
      errorText: null,
      size: null,
      labelPlacement: null,
      labelColor: null,
      accent: null,
      width: null,
    },
  },

  // =========================================================================
  // Action Components
  // =========================================================================

  Button: {
    props: z.object({
      label: z.string().describe('The button text. Keep to 1-4 words; verb-first for an action ("Save changes", "Delete account"). Set to "" for an ICON-ONLY button — provide `icon` + `ariaLabel` for the accessible name.'),
      // variant widened beyond upstream: + ghost (transparent until hover) + outline (border only).
      variant: z
        .enum(['primary', 'secondary', 'danger', 'ghost', 'outline'])
        .nullable()
        .describe('Visual hierarchy: primary (solid neutral high-contrast fill, the main CTA, default) · secondary (muted fill) · danger (destructive-action red) · ghost (transparent until hover) · outline (border only, transparent fill). At most one `primary` per view.'),
      tone: toneSchema,
      disabled: z.boolean().nullable().describe('Grey out the button and block clicks (adds the `disabled` attribute; default false).'),
      // component-specific; accent/accentText/radius/size/fullWidth/align from actionShared
      loading: z.boolean().nullable().describe('Show a spinner, disable interaction, dim the label (keeps width).'),
      submit: z.boolean().nullable().describe('Render as a form submit button (type=submit) so an enclosing Form commits natively on click/Enter.'),
      iconPosition: z.enum(['start', 'end']).nullable().describe('Side the `icon` sits relative to the label (default start).'),
      surface: z
        .enum(['solid', 'gradient', 'soft'])
        .nullable()
        .describe('Fill treatment: solid (default) · gradient (reads gradientFrom/gradientTo) · soft (tinted/translucent).'),
      gradientFrom: colorSchema.describe('Gradient start colour of the button background (use with `surface:gradient`; pairs with `gradientTo`).'),
      gradientTo: colorSchema.describe('Gradient end color (use with `surface:gradient` together with `gradientFrom`).'),
      borderColor: colorSchema.describe('Border color (esp. for `variant:outline`/`ghost`; default border token).'),
      minWidth: dimensionSchema({ units: ['px', 'rem', '%'], max: 640 }).describe('Minimum width (e.g. "180px") — keeps a row of buttons even.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default.'),
      icon: z.string().nullable().describe('The button icon — either a NAME from the built-in icon registry (a large lucide set, e.g. "trash-2", "download", "arrow-right", "settings") OR an image URL (https / raster data: URI) for ANY custom/brand icon (rendered as a URL-guarded <img>). Never raw SVG; an unknown name renders nothing. Pair with an empty `label` for an icon-only button. The glyph scales with `size` (sm 14px · md 16px · lg 18px).'),
      ariaLabel: z.string().nullable().describe('Accessible name for the button — REQUIRED for an icon-only button (empty `label` + an `icon`); also used as the tooltip. When a visible `label` is present, this overrides the computed accessible name if set.'),
      font: Font.describe('Typeface for the whole button; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the button `label` (light · normal · medium · semibold · bold; default medium).'),
      tracking: Tracking.describe('Letter-spacing of the button `label` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the button `label` (tight · snug · normal · relaxed · loose; default the size default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the button `label` (e.g. "15px" / "0.9375rem"). Overrides the `size` enum font size, which is the default.'),
      ...actionShared,
    }),
    events: ['commit'],
    eventsDoc: { commit: 'The button was clicked (and not `loading`); params carry {label}.' },
    description:
      'Clickable button. Bind on.commit for handler. `variant` sets visual hierarchy; optional `tone` sets semantic intent. `surface:gradient` reads gradientFrom/gradientTo; `accent` overrides the fill.',
    example: { label: 'Submit', variant: 'primary' },
  },

  Link: {
    props: z.object({
      label: z.string().describe('The link text. Keep to 1-5 words ("Learn more", "View pricing") — for a link that should look/act like a button use `variant:button`.'),
      href: z
        .string()
        .refine(isSafeHref, 'href uses an unsafe URL scheme')
        .describe('The navigation target URL. javascript:/data:/vbscript:/file: schemes are rejected. Bind `on.commit` instead of `href` for a JS-driven action rather than real navigation.'),
      // component-specific
      external: z.boolean().nullable().describe('Add target=_blank + rel=noopener noreferrer + an external-link glyph.'),
      variant: z
        .enum(['inline', 'subtle', 'button'])
        .nullable()
        .describe('inline (underlined accent link, default) · subtle (muted, underline on hover) · button (renders as a Button surface).'),
      tone: toneSchema,
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Font size of the link text: sm · md (default) · lg. Drop to `sm` for a footer/secondary link, `lg` for a prominent inline CTA; use `fontSize` for an exact length.'),
      weight: z.enum(['normal', 'medium', 'semibold']).nullable().describe('Font weight (bounded — NOT a number; default normal).'),
      underline: z.enum(['always', 'hover', 'none']).nullable().describe('Underline behavior: always (default) · hover (underline only on hover) · none. No effect on `variant:button`.'),
      color: colorSchema.describe('Custom link text color (default primary token; muted-foreground for `variant:subtle`). No effect on `variant:button`.'),
      accent: colorSchema.describe('Background of the button surface (`variant:button` only), repaints the whole button fill. Defaults to the neutral high-contrast fill, matching Button. No effect on inline/subtle text links, whose text uses `color`.'),
      accentText: colorSchema.describe('Text colour of the label on the accent-filled button surface (`variant:button` only). Defaults to the card token. Set when a saturated `accent` needs a legible label.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the button surface (variant:button only), e.g. "12px" / "1rem". Default the theme radius; no effect on inline/subtle text links.'),
      icon: z.string().nullable().describe('Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is). Never raw SVG; unknown names render nothing.'),
      externalIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME (from the closed icon registry (or a single emoji glyph, rendered as-is)) for the trailing external-link affordance shown when `external` is true. Default "arrow-up-right"; an unknown/absent name falls back to that default. Never raw SVG.'),
      font: Font.describe('Typeface for the link; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      tracking: Tracking.describe('Letter-spacing of the link `label` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the link `label` (tight · snug · normal · relaxed · loose; default the size default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the link `label` (e.g. "18px" / "1.125rem"). Overrides the `size` enum font size, which is the default (md = 1rem).'),
    }),
    events: ['commit'],
    eventsDoc: { commit: 'The link was clicked (fires when a handler is bound, instead of or alongside native `href` navigation); params carry {href, label, external} — the sanitized destination URL, the visible label, and whether it opens in a new tab.' },
    description:
      'Anchor link navigating to `href` (unsafe schemes rejected), or bind `on.commit` for a JS-driven click handler instead of real navigation. Reach for it for in-flow navigation — inline prose links, footer links, "Learn more" affordances — where a Button would read as too heavy; `external` opens a new tab with a trailing glyph and safe rel attributes. `variant` sets the look: inline (underlined accent, default) · subtle (muted) · button (renders as a full Button surface for a link that should act like a CTA).',
    example: {
      label: 'View pricing',
      href: 'https://frayme.ai/pricing',
      external: null,
      variant: 'inline',
      tone: null,
      size: null,
      weight: null,
      underline: null,
      color: null,
      accent: null,
      accentText: null,
      radiusValue: null,
      icon: null,
      externalIcon: null,
      font: null,
      tracking: null,
      leading: null,
      fontSize: null,
    },
  },

  DropdownMenu: {
    props: z.object({
      label: z.string().describe('Fallback trigger text shown when nothing is selected and no `placeholder` is set. Keep to 1-3 words ("Sort by", "Actions").'),
      items: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          }),
        )
        .describe('The menu options as [{label, value}] — label is the visible menu text, value the id emitted on `select` and matched against `value`, e.g. [{"label":"Newest first","value":"newest"},{"label":"Oldest first","value":"oldest"}].'),
      value: z.string().nullable().describe('Currently selected item (must match one item\'s `value`); its `label` shows in the trigger. Use `{ $bindState }` for two-way binding; otherwise sets the initial selection (default none — the trigger shows `placeholder`/`label`).'),
      // component-specific; `accent` (selection highlight) from actionShared
      placeholder: z.string().nullable().describe('Trigger text when nothing is selected (defaults to `label`).'),
      triggerVariant: z
        .enum(['primary', 'secondary', 'ghost', 'outline'])
        .nullable()
        .describe('Visual hierarchy of the trigger button: primary (solid) · secondary (muted fill, default) · ghost (transparent until hover) · outline (bordered). Match it to the trigger\'s weight on the page — `ghost`/`outline` for a quiet menu, `primary` for a prominent action.'),
      menuSurface: z
        .enum(['solid', 'elevated', 'glass'])
        .nullable()
        .describe('Popover treatment (mirrors Card surface): solid (default) · elevated · glass.'),
      triggerColor: colorSchema.describe('Background fill of the trigger button, naming a specific brand colour (default the token for the chosen `triggerVariant`). Pair with `accentText` for a legible label on that background.'),
      menuBg: colorSchema.describe('Menu panel background fill — the value channel over the `menuSurface` enum (default the card token; `glass` keeps its blur/shadow).'),
      borderColor: colorSchema.describe('Menu panel border colour (default the border token).'),
      menuWidth: dimensionSchema({ units: ['px', 'rem'], min: 80, max: 480 }).describe('Fixed popover width (e.g. "220px"); default auto (≥ trigger).'),
      maxHeight: dimensionSchema({ units: ['px', 'rem'], min: 80, max: 480 }).describe('Scroll the list past this height (e.g. "240px"); default unbounded.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the trigger button AND the menu panel (e.g. "12px" / "1rem") — the two stay matched. Overrides the `radius` enum, which is the default.'),
      caretIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME (from the closed icon registry (or a single emoji glyph, rendered as-is), e.g. "chevron-down") for the trigger caret. Default is the literal ▾ char; a known name swaps in that icon, an unknown/absent name keeps ▾. Never raw SVG.'),
      motion: Motion.describe('Enter-transition speed for the open menu (fast/normal/slow). Default: no animation — the menu appears instantly.'),
      ...actionShared,
      disabled: z.boolean().nullable().describe('Grey out + block input (adds `disabled`/`aria-disabled`). Also what the runtime sets once an action this control feeds has committed — see the param freeze.'),
      // OVERRIDE of the actionShared describe. That shared string asserts a
      // "button fill" this renderer does not paint. 19 components inherit it and
      // they genuinely disagree — background on some, ink on others — so it can
      // only be corrected per-component, never at the shared level.
      accent: colorSchema.describe('Text colour of the selected menu item (which also carries a trailing check glyph), and a faint 12% tint of the same colour as the item hover background (default the primary token). It does not fill the trigger — `triggerColor` does that.'),
      // OVERRIDE of the actionShared describe (real coverage): here accentText
      // colours the trigger label (pairing with `triggerColor` on the trigger
      // fill) AND the selected menu item (pairing with `accent`).
      accentText: colorSchema.describe('Text colour of the trigger label and the selected menu item — pairs with `triggerColor` on the trigger fill and with `accent` on the selected item (default the primary-foreground token on the trigger; the `accent` colour on the selected item).'),
    }),
    events: ['select', 'commit'],
    eventsDoc: {
      select: 'A menu item was clicked; params carry {value, label} and the menu closes.',
      commit:
        'The same click, as the terminal "do it" signal — bind this when the menu IS the action (an Actions menu that archives, sends, files), rather than a picker that sets a value. Params carry {value, label}. Only fires when bound, so a picker menu is unaffected. Required actions are counted on commit, so a menu-driven required action must bind THIS, not select.',
    },
    description:
      'Dropdown menu with trigger button and selectable items. Use { $bindState } on value for selected item binding. `accent` colors the selected-item highlight, which also carries a trailing check glyph. The open menu light-dismisses on an outside click or Escape (or re-clicking the trigger).',
    example: {
      label: 'Sort by',
      items: [
        { label: 'Newest first', value: 'newest' },
        { label: 'Oldest first', value: 'oldest' },
        { label: 'Most popular', value: 'popular' },
      ],
      value: null,
      placeholder: null,
      triggerVariant: null,
      menuSurface: null,
      triggerColor: null,
      menuBg: null,
      borderColor: null,
      menuWidth: null,
      maxHeight: null,
      radiusValue: null,
      caretIcon: null,
      motion: null,
      accent: null,
      accentText: null,
      radius: null,
      size: null,
      fullWidth: null,
      align: null,
    },
  },

  Toggle: {
    props: z.object({
      label: z.string().describe('The button text (or, when `iconOnly` is set, the accessible name only — the visible label is hidden and `icon` shows instead). Keep to 1-2 words ("Bold", "Mute").'),
      pressed: z.boolean().nullable().describe('Whether the toggle is currently pressed/active. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial state (default false).'),
      variant: z.enum(['default', 'outline']).nullable().describe('Resting (unpressed) look: default (filled card surface) · outline (bordered, transparent fill). The pressed state always fills with `activeColor`/`accent` regardless of `variant`.'),
      // component-specific; size/radius/fullWidth/align/accent/accentText from actionShared
      iconOnly: z.boolean().nullable().describe('Square icon button; `label` becomes the aria-label.'),
      tone: toneSchema,
      // `activeColor`/`activeText` are the DOCUMENTED Toggle/ToggleGroup exception to the
      // canonical `accent`/`accentText` names: the value is pressed-state-specific and reads
      // through the renderer's `aria-pressed:` variant.
      // `accent` (from actionShared) is accepted as a fallback for `activeColor`.
      activeColor: colorSchema.describe('Background fill (and matching border) when pressed — default a neutral muted-token fill, matching shadcn/Radix Toggle. Reads via the aria-pressed: recipe, and is the ground `activeText` is read against.'),
      activeText: colorSchema.describe('Text color when pressed (default the foreground token).'),
      // RESTING-state channels (the UNPRESSED look) — distinct from the pressed
      // activeColor/activeText above. trackColor = the unpressed base fill (default
      // card token); borderColor = the unpressed border (default border token).
      trackColor: colorSchema.describe('Resting (unpressed) background fill of the control (default the card token) — the ground the resting `color` label is read against. Distinct from `activeColor`, which colours the pressed state.'),
      borderColor: colorSchema.describe('Resting (unpressed) border color (default the border token). Distinct from `activeColor`, which colors the pressed state.'),
      color: colorSchema.describe('Resting (unpressed) label text color (default the foreground token). Distinct from `activeText`, which colors the pressed state — completes the resting fill/border/text trio (Pagination parity).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default; in an `attached`/segmented ToggleGroup it rounds only the outer end-cap corners (inner edges stay square).'),
      icon: z.string().nullable().describe('Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "bold", "bell"). Never raw SVG; unknown names render nothing.'),
      ...actionShared,
      disabled: z.boolean().nullable().describe('Grey out + block input (adds `disabled`/`aria-disabled`). Also what the runtime sets once an action this control feeds has committed — see the param freeze.'),
      // OVERRIDE of the actionShared describe. That shared string asserts a
      // "button fill" this renderer does not paint. 19 components inherit it and
      // they genuinely disagree — background on some, ink on others — so it can
      // only be corrected per-component, never at the shared level.
      accent: colorSchema.describe('Background fill of the pressed state when no `activeColor` is set (default the muted token); pairs with `accentText` for the pressed label.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'The button was clicked, flipping `pressed`; params carry {pressed}.' },
    description:
      'Toggle button. Use { $bindState } on pressed for state binding. `activeColor`/`activeText` color the pressed state; `trackColor`/`borderColor`/`color` color the resting (unpressed) state.',
    example: {
      label: 'Bold',
      pressed: false,
      variant: 'outline',
      iconOnly: null,
      tone: null,
      activeColor: null,
      activeText: null,
      trackColor: null,
      borderColor: null,
      color: null,
      radiusValue: null,
      icon: null,
      accent: null,
      accentText: null,
      radius: null,
      size: null,
      fullWidth: null,
      align: null,
    },
  },

  ToggleGroup: {
    props: z.object({
      items: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          }),
        )
        .describe('The segmented options as [{label, value}] — label is the visible chip text, value the id tracked in `value`, e.g. [{"label":"Bold","value":"bold"},{"label":"Italic","value":"italic"}].'),
      type: z.enum(['single', 'multiple']).nullable().describe('single (default — one item pressed at a time, like Radio) vs multiple (any number pressed, like a checkbox group). Determines how `value` is read/written.'),
      value: z.string().nullable().describe('Currently pressed item(s). For `type:single` a single item `value`; for `type:multiple` a comma-separated list of pressed values (e.g. "bold,italic"). Use `{ $bindState }` for two-way binding; otherwise sets the initial selection (default none pressed).'),
      // component-specific; size/radius/fullWidth/align/accent/accentText from actionShared
      orientation: z.enum(['horizontal', 'vertical']).nullable().describe('Axis the items lay out on: horizontal (a row, default) · vertical (a stacked column). Reach for vertical in a narrow sidebar or when the labels are long enough to crowd a row.'),
      attached: z.boolean().nullable().describe('Segmented (joined, no gap) vs spaced chips (default false = spaced).'),
      variant: z.enum(['default', 'outline']).nullable().describe('Resting look of each unselected item: default (filled card surface) · outline (bordered, transparent fill). Use `outline` for a lighter toolbar; the selected item always fills with `activeColor`/`accent`.'),
      tone: toneSchema,
      // `activeColor`/`activeText` = the documented Toggle/ToggleGroup exception (see Toggle).
      activeColor: colorSchema.describe('Background fill of the selected item (default a neutral muted-token fill, matching shadcn/Radix Toggle) — the ground `activeText` is read against. Reads via the aria-pressed: recipe.'),
      activeText: colorSchema.describe('Selected-item text color (default the foreground token).'),
      // RESTING-state channels (the UNSELECTED items) — distinct from the selected
      // activeColor/activeText above. trackColor = the unselected base fill (default
      // card token); borderColor = the unselected border (default border token).
      trackColor: colorSchema.describe('Resting (unselected) item background fill (default the card token) — the ground the resting `color` label is read against. Distinct from `activeColor`, which colours the selected item.'),
      borderColor: colorSchema.describe('Resting (unselected) item border color (default the border token). Distinct from `activeColor`, which colors the selected item.'),
      color: colorSchema.describe('Resting (unselected) item text color (default the foreground token). Distinct from `activeText`, which colors the selected item — completes the resting fill/border/text trio (Pagination parity).'),
      // `gap` is an ENUM key on Stack/Grid/Carousel/Tabs and is NOT a value-channel key
      // in the gate (resolution.ts DIM_KEYS). Naming the dimension `gap` would (a) collide
      // with that enum meaning and (b) escape gate coverage. So the EXACT item-spacing
      // dimension is `gapValue` (already a gate DIM_KEY) — same convention as Radio.
      // Applies only when `attached:false`.
      gapValue: dimensionSchema({ units: ['px', 'rem'], max: 32 }).describe('Exact spacing between items (e.g. "8px") when not `attached`. Default ~4px.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of each item (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default; when `attached` joins the items into a segmented control it rounds only the OUTER end-cap corners (first/last item, ButtonGroup parity — inner edges stay square).'),
      icons: z
        .array(z.string())
        .nullable()
        .describe('Optional per-item leading icon NAMES from the closed icon registry (or a single emoji glyph, rendered as-is), parallel to `items` (index-aligned) — e.g. ["bold","italic","underline"] for a formatting toolbar (default none). Never raw SVG; unknown/absent names render no glyph.'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      ...actionShared,
      disabled: z.boolean().nullable().describe('Grey out + block input (adds `disabled`/`aria-disabled`). Also what the runtime sets once an action this control feeds has committed — see the param freeze.'),
      // OVERRIDE of the actionShared describe. That shared string asserts a
      // "button fill" this renderer does not paint. 19 components inherit it and
      // they genuinely disagree — background on some, ink on others — so it can
      // only be corrected per-component, never at the shared level.
      accent: colorSchema.describe('Background fill of the selected item when no `activeColor` is set (default the muted token); pairs with `accentText` for the selected label.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'An item was clicked, updating `value` per `type`; params carry {value, toggled} where `toggled` is the clicked item\'s value. Only fires when `emitOnChange` !== false; the bound `value` state stays live regardless (an external Button can read the accumulated selection from state).' },
    description:
      "Group of toggle buttons. Type 'single' (default) or 'multiple'. Use { $bindState } on value. `attached` joins them into a segmented control (outer end caps rounded by radius/radiusValue, inner edges square). `activeColor`/`activeText` color the selected item; `trackColor`/`borderColor`/`color` color the resting (unselected) items. Optional per-item `icons` add a leading glyph (index-aligned to `items`). Keyboard focus shows a ring and resting items give hover feedback.",
    example: {
      items: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
      ],
      type: 'single',
      value: 'week',
      orientation: null,
      attached: true,
      variant: null,
      tone: null,
      activeColor: null,
      activeText: null,
      trackColor: null,
      borderColor: null,
      color: null,
      gapValue: null,
      radiusValue: null,
      icons: null,
      emitOnChange: null,
      accent: null,
      accentText: null,
      radius: null,
      size: null,
      fullWidth: null,
      align: null,
    },
  },

  ButtonGroup: {
    props: z.object({
      buttons: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          }),
        )
        .describe('The segments as [{label, value}] — label is the visible segment text, value the id emitted on `change` and matched against `selected`, e.g. [{"label":"Day","value":"day"},{"label":"Week","value":"week"}].'),
      selected: z.string().nullable().describe('Currently active segment (must match one button\'s `value`). Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial selection (default none active).'),
      // component-specific; size/radius/fullWidth/accent/accentText/align from actionShared
      orientation: z.enum(['horizontal', 'vertical']).nullable().describe('Lay the segments out as a row (default) or stacked in a column.'),
      variant: z.enum(['solid', 'outline']).nullable().describe('Filled selected segment (default solid) vs outlined.'),
      tone: toneSchema,
      borderColor: colorSchema.describe('Segment divider/border color (default border token).'),
      // RESTING-state channel (the UNSELECTED segments' base fill) — distinct from
      // `accent`, which colors the selected segment. Default the card token.
      trackColor: colorSchema.describe('Resting (unselected) segment background fill (default the card token; transparent for `variant:outline`) — the ground those segments\' labels are read against. Distinct from `accent`, which colours the selected segment.'),
      icons: z
        .array(z.string())
        .nullable()
        .describe('Optional per-segment leading icon NAMES from the closed icon registry (or a single emoji glyph, rendered as-is), parallel to `buttons`. Never raw SVG; unknown names render nothing.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the OUTER end-cap corners (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default; the joined inner edges stay square.'),
      ...actionShared,
      disabled: z.boolean().nullable().describe('Grey out + block input (adds `disabled`/`aria-disabled`). Also what the runtime sets once an action this control feeds has committed — see the param freeze.'),
      // OVERRIDE of the actionShared describe. That shared string asserts a
      // "button fill" this renderer does not paint. 19 components inherit it and
      // they genuinely disagree — background on some, ink on others — so it can
      // only be corrected per-component, never at the shared level.
      accent: colorSchema.describe('Selected-segment colour: with `variant:solid` (default) it is the background fill and border of the pressed segment; with `variant:outline` it is that segment\'s label text colour and border instead (default the primary token).'),
    }),
    events: ['change'],
    eventsDoc: { change: 'A segment was clicked, becoming the new `selected`; params carry {value, label, index}.' },
    description:
      'Segmented button group. Use { $bindState } on selected for selected value. `accent` colors the selected segment; `trackColor` colors the resting (unselected) segments.',
    example: {
      buttons: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
      ],
      selected: 'week',
      orientation: null,
      variant: null,
      tone: null,
      borderColor: null,
      trackColor: null,
      icons: null,
      radiusValue: null,
      accent: null,
      accentText: null,
      radius: null,
      size: null,
      fullWidth: null,
      align: null,
    },
  },

  Pagination: {
    props: z.object({
      totalPages: z.number().describe('Total number of pages (1-based). Bounds the rendered page-number window and clamps navigation — `page` can never exceed it.'),
      page: z.number().nullable().describe('Current page number (1-based). Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial page (default 1).'),
      // component-specific; size/accent/accentText/align from actionShared
      shape: z.enum(['square', 'rounded', 'circle']).nullable().describe('Silhouette of each page button — square (sharp corners) · rounded (default) · circle (fully round pills).'),
      variant: z.enum(['solid', 'outline', 'ghost']).nullable().describe('Resting look of the unselected page buttons: solid (filled) · outline (bordered, default) · ghost (transparent until hover). The active page always fills with `accent` regardless; use `ghost` for a lighter, borderless pager.'),
      showEdges: z.boolean().nullable().describe('Show the « » first/last jump buttons flanking the pager (default true). Turn them off for a compact pager, or when `totalPages` is small enough that prev/next already reach every page.'),
      showPrevNext: z.boolean().nullable().describe('Show the ‹ › previous/next arrow buttons flanking the page numbers (default true = shown).'),
      siblingCount: dimensionSchema({ kind: 'count', min: 1, max: 7 }).describe('How many page numbers flank the current page (1-7; default 3).'),
      // RESTING-state channels (the UNSELECTED page buttons) — distinct from
      // `accent`/`accentText`, which color the active/current page. color = resting
      // page text (default foreground token); borderColor = resting page border.
      color: colorSchema.describe('Resting (unselected) page-button text color (default the foreground token). Distinct from `accentText`, which colors the active page.'),
      borderColor: colorSchema.describe('Resting (unselected) page-button border color (default the border token). Distinct from `accent`, which colors the active page.'),
      mutedColor: colorSchema.describe('Text colour of the … overflow ellipsis separators between the page numbers (default the muted-foreground token).'),
      // CONTENT/LABEL overrides (i18n): the frozen English aria-labels on the
      // prev/next/first/last nav buttons. Each defaults to its current English; they
      // feed aria-label (escaped text), not visible copy.
      prevLabel: z.string().nullable().describe('aria-label for the ‹ previous-page button (default "Previous page"). Override to localise.'),
      nextLabel: z.string().nullable().describe('aria-label for the › next-page button (default "Next page"). Override to localise.'),
      firstLabel: z.string().nullable().describe('aria-label for the « first-page jump button (default "First page"). Override to localise.'),
      lastLabel: z.string().nullable().describe('aria-label for the » last-page jump button (default "Last page"). Override to localise.'),
      // CONTENT/glyph overrides (i18n): glyph NAMES (from the closed icon registry (or a single emoji glyph, rendered as-is),
      // e.g. "chevron-left"/"chevron-right") for the prev/next/first/last affordances.
      // Default = the current literal char (‹ › « »); an unknown/absent name keeps it.
      prevIcon: z.string().nullable().describe('Glyph NAME for the previous-page button (default the ‹ char). Unknown/absent keeps ‹. Never raw SVG.'),
      nextIcon: z.string().nullable().describe('Glyph NAME for the next-page button (default the › char). Unknown/absent keeps ›. Never raw SVG.'),
      firstIcon: z.string().nullable().describe('Glyph NAME for the first-page button (default the « char). Unknown/absent keeps «. Never raw SVG.'),
      lastIcon: z.string().nullable().describe('Glyph NAME for the last-page button (default the » char). Unknown/absent keeps ». Never raw SVG.'),
      ...actionShared,
      // OVERRIDE of the actionShared describe. That shared string asserts a
      // "button fill" this renderer does not paint. 19 components inherit it and
      // they genuinely disagree — background on some, ink on others — so it can
      // only be corrected per-component, never at the shared level.
      accent: colorSchema.describe('Background fill and border of the current/active page button, plus a faint 10% tint of the same colour as the hover background on the resting ones (default the foreground token). Pairs with `accentText` for the numeral on that fill.'),
      // Pagination-specific describe OVERRIDE of actionShared.align (same schema):
      // here it places the whole pager row, and the renderer default is start.
      align: actionShared.align.describe('Horizontal placement of the pager row (start · center · end; default start).'),
    }),
    events: ['page'],
    eventsDoc: { page: 'A page number, arrow, or edge-jump button was clicked; params carry {page}, the clamped 1-based target page.' },
    description:
      'Page navigation. Use { $bindState } on page for current page number. `siblingCount` sets how many numbers flank the current page. `accent`/`accentText` color the active page; `color`/`borderColor` color the resting (unselected) page buttons.',
    example: {
      totalPages: 12,
      page: 3,
      shape: null,
      variant: null,
      showEdges: null,
      showPrevNext: null,
      siblingCount: null,
      color: null,
      borderColor: null,
      mutedColor: null,
      prevLabel: null,
      nextLabel: null,
      firstLabel: null,
      lastLabel: null,
      prevIcon: null,
      nextIcon: null,
      firstIcon: null,
      lastIcon: null,
      accent: null,
      accentText: null,
      radius: null,
      size: null,
      fullWidth: null,
      align: null,
    },
  },
};
