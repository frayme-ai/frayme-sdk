/**
 * Frayme data-display-extended — 6 schemas extending the truly-dynamic catalog.
 *
 * New surface components that ride the SAME established foundation as the shipped components: bounded ENUM atoms from `_shared.ts` (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for color, the
 * dimension channel where needed). Every enum/value prop is `.nullable()` +
 * `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants`, so a
 * props-less spec still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 *
 * Components: Tag · ListItem · PageHeader · Stat · EmptyState · ErrorState.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Font, Weight, Tracking, Leading } from './_shared.js';

// URL-scheme guard (defense-in-depth alongside the renderer's runtime
// sanitization): reject specs carrying javascript:/data:/vbscript:/file: in a
// navigable href. Mirrors the helper in shadcn-base.ts (kept local — no dep
// added). Control chars are stripped so `java\tscript:` can't slip past.
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeHref = (s: string): boolean =>
  !/^\s*(javascript|data|vbscript|file):/i.test(stripWhitespace(s));

export const dataDisplayExtendedComponents = {
  // =========================================================================
  // Tag — removable / filter chip
  // =========================================================================
  Tag: {
    props: z.object({
      label: z.string().describe('The chip text (e.g. "In progress", "Beta"). Keep to 1-3 words — long labels truncate at 12rem.'),
      icon: z
        .string()
        .nullable()
        .describe('Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "star", "filter"). Never raw SVG; unknown names render nothing.'),
      variant: z
        .enum(['solid', 'soft', 'outline'])
        .nullable()
        .describe('Fill treatment: solid (filled) · soft (tinted, default) · outline (border only). Reach for `outline` on filter chips, `solid` for a strong label.'),
      tone: z
        .enum(['neutral', 'success', 'warning', 'critical', 'info'])
        .nullable()
        .describe('Semantic color of the chip via token (default neutral). Use `success`/`critical` for status tags.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Chip padding + label font size: sm · md (default) · lg.'),
      shape: z
        .enum(['pill', 'rounded', 'square'])
        .nullable()
        .describe('Corner shape: pill (fully round, default) · rounded · square.'),
      removable: z
        .boolean()
        .nullable()
        .describe('Show a trailing × that emits `dismiss` — use for dismissable filter chips / selected tokens.'),
      removeLabel: z
        .string()
        .nullable()
        .describe('Accessible label for the remove (×) button (default "Remove {label}"). Escaped text — set for i18n/localized affordances.'),
      removeIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) for the remove affordance (default "x"). Unknown/absent names fall back to the x glyph. Never raw SVG.'),
      bg: colorSchema.describe('Exact background fill (brand chip). Wins over tone/variant.'),
      color: colorSchema.describe('Exact label/icon text color. Wins over tone/variant.'),
      borderColor: colorSchema.describe('Exact border color of the chip (default derives from `tone`/`variant`). Most useful with `variant:outline`, where the border is the chip; name a brand color to tint it.'),
      font: Font.describe('Typeface for the whole tag chip; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the tag `label` (light · normal · medium · semibold · bold; default medium).'),
      tracking: Tracking.describe('Letter-spacing of the tag `label` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the tag `label` (tight · snug · normal · relaxed · loose; default a compact single-line leading).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the tag `label` (e.g. "13px" / "0.8125rem"). Overrides ONLY the label type scale of the `size` enum (the default); chip padding stays on `size`.'),
    }),
    events: ['dismiss'],
    eventsDoc: {
      dismiss: 'The trailing × (remove) button was clicked; params carry {label} with the chip\'s text. Only fires when `removable` is set.',
    },
    description:
      'Compact chip/tag for labels, filters, and selected tokens. `tone` colors it by intent; set `removable` for a dismissable × that emits `dismiss`. Reach for this for short status/category labels or the selected-token chips of a filter bar — not for a full interactive control (use a Button) or a menu row (use ListItem). Pick `variant` (`solid`/`soft`/`outline`) and `tone` together to set the fill treatment and semantic color; when `removable`, clicking the trailing × emits `dismiss` with the chip `label` so a host can drop the filter.',
    example: { label: 'In progress', tone: 'info', removable: true },
  },

  // =========================================================================
  // ListItem — a single list row
  // =========================================================================
  ListItem: {
    props: z.object({
      title: z.string().describe('The row\'s primary label (e.g. "Account settings"). Keep to a short noun phrase — it truncates on one line.'),
      value: z
        .string()
        .nullable()
        .describe('Stable identifier for this row (e.g. a route key, record id, or slug like "settings-billing"). Echoed unchanged in the `commit` payload so a handler can route/track by id even when two rows share the same `title`. Omit only when the visible title is already unique.'),
      description: z.string().nullable().describe('Secondary muted line under the `title` (e.g. "Profile, security, billing"). Truncates on one line; omit for a title-only row.'),
      leadingIcon: z
        .string()
        .nullable()
        .describe('Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "user", "mail"). Never raw SVG; unknown names render nothing.'),
      trailingText: z.string().nullable().describe('Right-aligned meta text (e.g. a timestamp or count).'),
      badge: z.string().nullable().describe('Short trailing badge chip after the title (e.g. "New" or an unread count "3"; default none). Keep it 1-3 chars/one word; its tint derives from `mutedColor`. Set to flag row status or a count.'),
      href: z
        .string()
        .refine(isSafeHref, 'href uses an unsafe URL scheme')
        .nullable()
        .describe('Make the row a navigable link. Omit to render an interactive button row that emits `commit`.'),
      external: z.boolean().nullable().describe('When `href` is set: open in a new tab (adds target=_blank + rel=noopener noreferrer + an external-link glyph).'),
      active: z.boolean().nullable().describe('Mark the row selected/current (highlights it + sets aria-current).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Row horizontal padding + font size: sm · md (default) · lg. Vertical row height is controlled separately by `density`.'),
      density: z
        .enum(['compact', 'normal', 'comfortable'])
        .nullable()
        .describe('Vertical row height: compact (tight lists) · normal (default) · comfortable (roomy).'),
      accent: colorSchema.describe('Text colour of the row `title` on a selected/active row, and the ink of its leading icon; the same colour also paints the 3px active bar down the row\'s left edge (default the primary token). Applies only when `active`.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the description line, trailing meta text, the leading icon (non-active rows), and the external-link arrow (default the muted-foreground token). When set, the trailing badge chip’s fill derives from it as a 14% tint (default the muted token).'),
      font: Font.describe('Typeface for the whole list row; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the row `title` (light · normal · medium · semibold · bold; default medium).'),
      tracking: Tracking.describe('Letter-spacing of the row `title` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the row `title` (tight · snug · normal · relaxed · loose; default normal).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the row `title` (e.g. "15px" / "0.9375rem"). Overrides ONLY the title; secondary text and row padding stay on the `size` enum (the default).'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'The row (anchor or button) was clicked; params carry {value, label, href} — the stable `value` id (null if unset), the row `title` as `label`, and the resolved `href` (null on a button row) so a handler can route/track without re-deriving the target from the title. With an href the browser also navigates natively — bind on.commit for handler-driven nav or analytics alongside/instead of the link.',
    },
    description:
      'A single list/menu row: leading icon + title/description stack + trailing text/badge. Renders an <a> when `href` is set, otherwise a button that emits `commit`. Group several inside a Stack or Card.',
    example: { title: 'Account settings', description: 'Profile, security, billing', leadingIcon: 'settings' },
  },

  // =========================================================================
  // PageHeader — title + meta + actions row
  // =========================================================================
  PageHeader: {
    props: z.object({
      eyebrow: z.string().nullable().describe('Small uppercase kicker above the title (e.g. a section/category label).'),
      title: z.string().describe('The header\'s main heading (e.g. "Team members"). Short noun phrase — this is the page/section name, not a sentence.'),
      description: z.string().nullable().describe('Supporting subtitle under the `title` (e.g. "Manage who has access"). One short sentence; omit for a title-only header.'),
      align: z
        .enum(['start', 'center'])
        .nullable()
        .describe('Text alignment of the header block: start (left, default — actions sit on the right) · center (centered hero header).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Title scale + spacing (default md). Use `lg` for a top-of-page hero.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 12, max: 72 }).describe('Exact title font-size (e.g. 28px / 2.25rem). Overrides ONLY the title type scale of the `size` enum (the default); header spacing stays on `size`.'),
      divider: z
        .boolean()
        .nullable()
        .describe('Draw a bottom border rule (with bottom padding) separating the header from the content below — the conventional dashboard/section header divider (shadcn/Ant PageHeader). Off by default.'),
      accent: colorSchema.describe('Text colour of the header `title` heading (default the inherited foreground). Names a specific brand colour for the heading; on a filled band (`bg`) the band\'s `accentText` takes this channel over instead.'),
      bg: colorSchema.describe('Brand band background fill. When set, the header renders as a filled, padded, rounded BAND — a deliberate brand moment (use ONLY when the request supplies brand colors; omit to stay quiet/neutral, the default). Pair with `accentText` for the on-band text color.'),
      accentText: colorSchema.describe('Text color ON a filled band — the title, eyebrow, and description (only meaningful together with `bg`). Default: white, for contrast on a dark brand band.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the eyebrow kicker and the description subtitle (default the muted-foreground token).'),
      weight: Weight.describe('Title font weight (default semibold). Reach for `bold` for a heavier hero heading or `medium` for a lighter one.'),
      tracking: Tracking.describe('Title letter-spacing (default normal). Use `tight`/`tighter` to condense a large hero title or `wide` for an airy heading.'),
      leading: Leading.describe('Title line-height (default tight). Bump to `snug`/`normal` when the title wraps to multiple lines.'),
      font: Font.describe('Typeface for the whole header region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
    }),
    slots: ['default'],
    description:
      'Page/section header: eyebrow + title + description on the left, with action controls (children) on the right. Use at the top of a page or panel — NOT as a content Card. Reach for this to introduce a page or a major section and to anchor its primary actions (e.g. a "New" or "Invite" Button passed as children) on the same row as the heading. Set `align:"center"` to turn it into a centered hero header (children then stack below); set `divider` for the conventional dashboard rule that separates the header from the content beneath it.',
    example: { eyebrow: 'Workspace', title: 'Team members', description: 'Manage who has access' },
  },

  // =========================================================================
  // Stat — KPI tile
  // =========================================================================
  Stat: {
    props: z.object({
      label: z.string().describe('The small muted caption above the value (e.g. "Monthly revenue"). Names the metric — keep to 1-4 words, it truncates on one line.'),
      value: z.string().describe('The big KPI figure (e.g. "£24,500", "1,204"). A string so you control formatting (currency symbol, commas, %) exactly — truncates on one line.'),
      caption: z.string().nullable().describe('A SECOND muted line under the label giving the metric context — a period, scope or definition ("Last 12 months", "Return on ad spend", "Ad Spend ↔ Sales"). Use it to say what the number MEANS or covers, not to repeat the label. Reach for `layout:"split"` when you use it so the tile stays compact.'),
      icon: z.string().nullable().describe('Optional category icon shown in a small muted rounded square before the label — a registry NAME or a single emoji glyph, rendered as-is — a QUIET identifier for the metric TYPE (a "%" for a rate, "$"/"pound-sterling" for money, "activity" for a correlation, "trending-up" for revenue). Use it as a category cue on a rich tile, NOT decoration on every KPI; a bare number rarely needs one. Never coloured — it inherits the muted tile chrome.'),
      layout: z.enum(['stack', 'split']).nullable().describe('Tile arrangement: stack (default) — label, value and delta stacked vertically, best for a compact figures strip. split — label+caption on the LEFT and value+delta right-aligned on the RIGHT, the dense dashboard-card look that fits four facts (label, caption, value, delta) in one row. Pick split when the tile carries a caption or an icon.'),
      delta: z.string().nullable().describe('Change indicator text (e.g. "+12.5%" or "-3"). Colored + arrowed by `deltaType`.'),
      sparkline: z
        .array(z.number())
        .nullable()
        .describe('Optional series of numbers rendered as a tiny inline trend line under the value. The renderer draws OUR own SVG polyline from the numbers.'),
      strokeWidth: dimensionSchema({ units: ['px'], min: 0.5, max: 6 }).describe('Exact sparkline line thickness in px (e.g. 2; default 1.5).'),
      deltaType: z
        .enum(['increase', 'decrease', 'neutral'])
        .nullable()
        .describe('Direction of the delta: increase (success, up arrow) · decrease (danger, down arrow) · neutral (muted). Pick by whether the change is good/bad/flat.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Preset value type scale + tile spacing: sm · md (default) · lg. Bump to `lg` for a hero KPI; override just the number via `fontSize` while spacing stays on `size`.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 14, max: 96 }).describe('Exact KPI value font-size (e.g. 40px / 2.5rem). Overrides ONLY the value type scale of the `size` enum (the default); tile spacing stays on `size`.'),
      align: z.enum(['start', 'center']).nullable().describe('Text alignment of the tile: start (left, default) · center.'),
      accent: colorSchema.describe('Text colour of the big KPI `value` figure (default the inherited foreground). Names a specific brand colour for the number; the inline `sparkline` stroke follows it too unless `sparklineColor` overrides.'),
      sparklineColor: colorSchema.describe('Stroke colour of the inline `sparkline` trend line ONLY (default follows `accent`, then the foreground token). Set to give a neutral KPI figure a brand-colored trend line — decouples the trend colour from the value colour.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the `label` above the value, the `caption` line under it, a neutral (flat) delta, and the glyph in the category `icon` chip (default the muted-foreground token). Up/down deltas stay success/danger toned, and the icon chip keeps its own muted background.'),
      weight: Weight.describe('KPI value font weight (default semibold). Reach for `bold` for a heavier figure or `medium` for a lighter one.'),
      tracking: Tracking.describe('KPI value letter-spacing (default normal). Use `tight`/`tighter` to condense a long number.'),
      leading: Leading.describe('KPI value line-height (default tight). Rarely needed — bump only if the value wraps.'),
      font: Font.describe('Typeface for the whole stat tile; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
    }),
    description:
      'A KPI/metric tile: muted label, large value, an optional colored delta with an up/down arrow, and an optional inline sparkline. Group several in a StatGroup for a stats row. Reach for this to headline a single number on a dashboard — a metric read-out, not an interactive control or a chart with axes. `value` is a string so you own the formatting (currency symbol, commas, %), and the optional `delta` is tinted and arrowed by `deltaType` (increase→success/up, decrease→danger/down, neutral→muted); pass a `sparkline` number series to draw a tiny trend line under the value. For a richer dashboard card that holds four facts at once — label, a context `caption`, value and delta — set `layout:"split"` (label+caption left, value+delta right) and optionally a muted category `icon`.',
    example: { label: 'Total ad spend', caption: 'Last 12 months', value: '$1.24M', delta: '+18.3%', deltaType: 'increase', icon: 'dollar-sign', layout: 'split' },
  },

  // =========================================================================
  // EmptyState — zero-data panel
  // =========================================================================
  EmptyState: {
    props: z.object({
      title: z.string().describe('The zero-data headline (e.g. "No results"). Short and neutral — pair with `description` for the "what to do next" guidance.'),
      description: z.string().nullable().describe('Supporting copy explaining the empty state / what to do next.'),
      icon: z
        .string()
        .nullable()
        .describe('Centered illustrative icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "search", "mail", "calendar"). Never raw SVG; unknown names render nothing.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Icon + type scale and vertical padding (default md).'),
      align: z
        .enum(['center', 'start'])
        .nullable()
        .describe('Content alignment: center (default — classic centered empty state) · start (left-aligned).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the supporting description line under the title AND (when set) the focal icon disk: its glyph plus a soft 12% tinted disk fill (default the muted-foreground token / muted disk).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact title font-size (e.g. 22px / 1.375rem). Overrides ONLY the title type scale of the `size` enum (the default); icon size + panel padding stay on `size`.'),
      weight: Weight.describe('Title font weight (default semibold). Reach for `bold` for a heavier heading or `medium`/`normal` for a softer one.'),
      font: Font.describe('Typeface for the whole empty-state panel; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      tracking: Tracking.describe('Letter-spacing of the `title` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the `title` (tight · snug · normal · relaxed · loose; default normal — sm sets it explicitly, md/lg inherit the browser normal).'),
      titleLevel: z
        .enum(['h1', 'h2', 'h3', 'h4'])
        .nullable()
        .describe("Heading level for the `title` (default h3 — a state panel is content inside a Card, whose title is h2). Set it to h2 when the panel sits directly under the PageHeader with no Card around it, so the screen's headings nest legally — a document that jumps h1 to h3 has no outline for anyone navigating by heading."),
    }),
    slots: ['default'],
    description:
      'Zero-data placeholder panel: centered icon + title + description, with an optional call-to-action (children, e.g. a Button). Use when a list/table/search has no results yet.',
    example: { title: 'No results', description: 'Try adjusting your filters.', icon: 'search' },
  },

  // =========================================================================
  // ErrorState — failure panel
  // =========================================================================
  ErrorState: {
    props: z.object({
      title: z.string().describe('The failure headline (e.g. "Something went wrong"). Short and neutral — pair with `detail` for the specific error/guidance.'),
      detail: z.string().nullable().describe('Secondary explanation of what went wrong (e.g. an error message or guidance).'),
      icon: z
        .string()
        .nullable()
        .describe('Danger-toned icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (default "alert-triangle"). Never raw SVG; unknown names render nothing.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Icon + type scale and vertical padding (default md).'),
      align: z
        .enum(['center', 'start'])
        .nullable()
        .describe('Content alignment: center (default) · start (left-aligned).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the detail explanation line under the title (default the muted-foreground token). The icon stays danger-toned.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact title font-size (e.g. 22px / 1.375rem). Overrides ONLY the title type scale of the `size` enum (the default); icon size + panel padding stay on `size`.'),
      weight: Weight.describe('Title font weight (default semibold). Reach for `bold` for a heavier heading or `medium`/`normal` for a softer one.'),
      font: Font.describe('Typeface for the whole error panel; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      tracking: Tracking.describe('Letter-spacing of the `title` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the `title` (tight · snug · normal · relaxed · loose; default normal — sm sets it explicitly, md/lg inherit the browser normal).'),
      titleLevel: z
        .enum(['h1', 'h2', 'h3', 'h4'])
        .nullable()
        .describe("Heading level for the `title` (default h3 — a state panel is content inside a Card, whose title is h2). Set it to h2 when the panel sits directly under the PageHeader with no Card around it, so the screen's headings nest legally — a document that jumps h1 to h3 has no outline for anyone navigating by heading."),
    }),
    slots: ['default'],
    description:
      'Failure panel (role="alert"): danger-toned icon + title + detail, with an optional retry action (children, e.g. a Button). Use when a load/action failed.',
    example: { title: 'Something went wrong', detail: 'We could not load your data. Please try again.' },
  },
};
