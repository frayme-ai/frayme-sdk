/**
 * Frayme navigation family — Breadcrumb · Sidebar · SidebarItem · Navbar.
 *
 * Built on the same truly-dynamic foundation as the base catalog: ENUM
 * props are the bounded menu a spec draws from (compiled to static CVA classes
 * in the renderer), and the handful of VALUE props (color the model names
 * directly) flow through `colorSchema` → an inline `--fr-<comp>-<role>` CSS var
 * read by a static `var(--fr-…, var(--color-…))` utility (data, never a class).
 *
 * Every enum/value prop is `.nullable()` + `.describe()` (one sentence naming
 * WHEN to reach for it). Defaults live
 * in the renderer's CVA `defaultVariants`, so a props-less spec still renders
 * polished. Navigable hrefs are scheme-guarded at point-of-use in the renderer
 * (safeUrl); here we add the same defence-in-depth scheme refine the base
 * schemas use, so a spec carrying `javascript:`/`data:` in an href fails the
 * catalog gate too.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Font, Weight, Tracking, Leading } from './_shared.js';

// URL-scheme guard (defense-in-depth alongside the renderer's runtime safeUrl):
// reject specs carrying javascript:/data:/vbscript:/file: in navigable hrefs.
// Control chars are stripped so `java\tscript:` can't slip past. Mirrors the
// helper in shadcn-base.ts (kept local — no cross-file dep).
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeHref = (s: string): boolean =>
  !/^\s*(javascript|data|vbscript|file):/i.test(stripWhitespace(s));

export const navigationComponents = {
  // =========================================================================
  // Navigation Components
  // =========================================================================

  Breadcrumb: {
    props: z.object({
      items: z
        .array(
          z.object({
            label: z.string(),
            href: z.string().refine(isSafeHref, 'href uses an unsafe URL scheme').nullable(),
          }),
        )
        .describe('Ordered trail from root to the current page. The LAST item is the current page (rendered as plain text with aria-current, no link); give the earlier items an href to make them clickable.'),
      separator: z
        .enum(['slash', 'chevron', 'dot', 'arrow'])
        .nullable()
        .describe('Glyph between items: chevron "›" (default) · slash "/" · dot "•" · arrow "→".'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Font size of the trail (default md). Use sm for a dense sub-header.'),
      maxItems: z
        .number()
        .nullable()
        .describe('Collapse a long trail: when the number of items exceeds this cap (minimum 3), keep the first item, replace the middle with a single non-clickable "…" entry, and keep the trailing items so the current page always shows (shadcn BreadcrumbEllipsis convention). Omit (default) or a value ≥ the item count to show every item. A plain count, not a dimension.'),
      accent: colorSchema.describe('Color of the current/last item (and link hover). Names a specific brand color; default is the foreground token.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the non-current trail items, link rest state, and the separator glyphs (at 70% strength; default the muted-foreground token).'),
      font: Font.describe('Typeface for the whole breadcrumb trail; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the crumb labels (light · normal · medium · semibold · bold; default normal, with the current page medium).'),
      tracking: Tracking.describe('Letter-spacing of the crumb labels (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the crumb labels (tight · snug · normal · relaxed · loose; default the size default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the crumb labels (e.g. "20px" / "1.25rem"). Overrides the `size` enum, which is the default (md ≈ 0.9375rem).'),
    }),
    description:
      'Hierarchical breadcrumb path trail. items go root → current; the last item is the current page (no link). Earlier items with an href become safe anchor links. Set `maxItems` to collapse a deep trail (first · … · last few).',
    example: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'Profile', href: null },
      ],
    },
  },

  Sidebar: {
    props: z.object({
      title: z.string().nullable().describe('Optional header label shown at the top of the rail (e.g. the app/section name). Omit for a bare rail.'),
      variant: z
        .enum(['default', 'floating', 'ghost'])
        .nullable()
        .describe('Rail chrome: default (solid panel with right border) · floating (rounded, shadowed, inset card) · ghost (transparent, no border).'),
      collapsed: z.boolean().nullable().describe('Collapse to a narrow icon-only rail (hides the title + item labels). Pair with SidebarItem `icon`s.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Rail width: sm (~12rem) · md (~16rem, default) · lg (~20rem). When `collapsed`, width is fixed narrow regardless.'),
      width: dimensionSchema({ units: ['px', 'rem'], min: 120, max: 640 }).describe('Exact rail width (e.g. 280px / 18rem). Overrides the `size` enum, which is the default. Ignored when `collapsed` (the narrow icon rail is fixed).'),
      sticky: z.boolean().nullable().describe('Pin the rail to the viewport top while the page scrolls (position: sticky).'),
      bg: colorSchema.describe('Rail background fill. Names a specific surface color (e.g. a dark nav rail); default is the card token.'),
      borderColor: colorSchema.describe('Right-edge / floating-card border color (default border token).'),
      accent: colorSchema.describe('Accent color for the title + propagated to the active SidebarItem highlight; default the primary token.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the uppercase title kicker when no accent is set (default the muted-foreground token).'),
    }),
    slots: ['default'],
    description:
      'Vertical app navigation rail. Renders an <aside> with an optional title header and SidebarItem children. `collapsed` gives an icon-only rail.',
    example: { title: 'Workspace', variant: 'default' },
  },

  SidebarItem: {
    props: z.object({
      label: z.string().describe('The item text (e.g. "Dashboard", "Settings"). Stays in the DOM as the accessible name when the parent Sidebar is `collapsed`, just visually hidden — and is ALSO surfaced as a native hover tooltip (the anchor/button `title`) on the collapsed icon rail so a sighted user can identify the icon. Keep to 1-3 words.'),
      href: z.string().refine(isSafeHref, 'href uses an unsafe URL scheme').nullable().describe('Destination. With an href the item renders as a safe anchor; omit it to render a <button> (bind on.commit for handler-driven nav).'),
      badge: z.string().nullable().describe('Trailing count/status pill (e.g. "3", "New"). Omit for none.'),
      icon: z.string().nullable().describe('Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "home", "settings", "user"). Never raw SVG; unknown names render nothing. Required look when the parent Sidebar is `collapsed`.'),
      active: z.boolean().nullable().describe('Mark this item as the current page (adds aria-current + the accent highlight). Exactly one item per rail is usually active.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Row height + font size (default md). Match the parent Sidebar `size`.'),
      external: z.boolean().nullable().describe('Open the href in a new tab (adds target=_blank + rel=noopener noreferrer + an external-link glyph). Only meaningful with an href.'),
      accent: colorSchema.describe('Highlight color for the active state (background tint + text). Names a specific brand color; default the primary token (and inherits the parent Sidebar accent).'),
      trackColor: colorSchema.describe('Resting (non-active) row background fill — the unselected item track (default transparent; only the active item gets the accent tint). Set a subtle surface to lift every resting row.'),
      color: colorSchema.describe('Resting (non-active) row text colour — the label of an unselected item (default the foreground token). Does NOT touch the active item, which uses `accent`.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the trailing badge pill (its label AND, when set, a soft 15% tinted pill fill in place of the muted token) and the external-link glyph (default the muted-foreground token / muted pill).'),
      font: Font.describe('Typeface for the whole item row; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the item `label` (light · normal · medium · semibold · bold; default medium).'),
      tracking: Tracking.describe('Letter-spacing of the item `label` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the item `label` (tight · snug · normal · relaxed · loose; default the size default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the item `label` (e.g. "18px" / "1.125rem"). Overrides the `size` enum font size, which is the default.'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'The item (anchor or button) was clicked; params carry {label}. With an href the browser also navigates natively — bind on.commit for handler-driven nav or analytics alongside/instead of the link.',
    },
    description:
      'A single Sidebar entry. Renders a safe anchor when `href` is set, otherwise a button (bind on.commit). `active` gives the current-page highlight; `icon` shows a leading glyph.',
    example: { label: 'Dashboard', href: '/dashboard', icon: 'home', active: true },
  },

  Navbar: {
    props: z.object({
      brand: z.string().nullable().describe('Left-aligned brand/app label (e.g. the product name). Omit to start the bar with the children.'),
      brandIcon: z
        .string()
        .nullable()
        .describe('Optional leading logo glyph beside the `brand` label, by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "home", "sparkles"). Never raw SVG; unknown/absent names render no glyph. Only shown when `brand` is set.'),
      variant: z
        .enum(['default', 'bordered', 'floating'])
        .nullable()
        .describe('Bar chrome: default (solid, bottom border) · bordered (full border) · floating (rounded, shadowed, inset card).'),
      sticky: z.boolean().nullable().describe('Pin the bar to the viewport top while the page scrolls (sticky top-0).'),
      justify: z
        .enum(['start', 'center', 'end', 'between'])
        .nullable()
        .describe('How the nav children distribute after the brand: start · center · end · between (default — brand left, items pushed right).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Bar height + horizontal padding together: sm · md (default) · lg. Use `sm` for a compact utility bar or `lg` for a roomy marketing header; the exact `height` channel overrides the height while padding still follows this.'),
      height: dimensionSchema({ units: ['px', 'rem'], min: 32, max: 160 }).describe('Exact bar height (e.g. 72px / 4.5rem). Overrides the height of the `size` enum (the default); the horizontal padding still follows `size`.'),
      bg: colorSchema.describe('Bar background fill. Names a specific color (e.g. a dark top bar); default the card token.'),
      borderColor: colorSchema.describe('Border color (bottom edge for default/bordered, full edge for floating; default border token).'),
      color: colorSchema.describe('On-surface text colour — the brand label (default the foreground token). Set a light value on a dark `bg` so the brand stays legible.'),
      font: Font.describe('Typeface of the `brand` wordmark (sans · serif · mono · rounded · display). Omit to inherit the theme font — the most brand-styled surface in the family.'),
      weight: Weight.describe('Font weight of the `brand` wordmark (light · normal · medium · semibold · bold; default semibold).'),
    }),
    slots: ['default'],
    description:
      'Horizontal top navigation bar. Renders a <nav> with an optional left brand label (with an optional leading `brandIcon` glyph and `font`/`weight` styling) and children (links/buttons) on the right. `sticky` pins it to the top.',
    example: { brand: 'Frayme', sticky: true, justify: 'between' },
  },
};
