/**
 * Frayme marketing-page — 5 schemas for marketing/landing page sections.
 *
 * Page marketing sections (display + light interaction) that ride the SAME
 * established foundation as the shipped components: bounded ENUM atoms from
 * `_shared.ts` (the bounded menu a spec draws from) + the two validated VALUE channels
 * (`colorSchema` for color, the dimension channel where needed). Every enum/value
 * prop is `.nullable()` + `.describe()` (one sentence naming WHEN to reach for it
 *); defaults live in the renderer's CVA
 * `defaultVariants`, so a props-less spec still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE).
 *
 * Components: Testimonial · FAQ · Footer · PricingTable · PlanCard.
 *
 * NOTE: PricingTable / PlanCard are DISPLAY-ONLY plan comparisons — they NEVER
 * carry card-number / payment / checkout fields. A plan CTA is a link or a
 * `commit` event the host routes (Frayme never proxies payments).
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Font, Weight, Tracking, Leading, Shadow } from './_shared.js';

// URL-scheme guard (defense-in-depth alongside the renderer's runtime
// sanitization): reject specs carrying javascript:/data:/vbscript:/file: in a
// navigable href. Mirrors the helper in data-display-extended.ts (kept local —
// no dep added). Control chars are stripped so `java\tscript:` can't slip past.
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeHref = (s: string): boolean =>
  !/^\s*(javascript|data|vbscript|file):/i.test(stripWhitespace(s));
const safeHref = z.string().refine(isSafeHref, 'href uses an unsafe URL scheme');

export const marketingPageComponents = {
  // =========================================================================
  // Testimonial — a customer quote card
  // =========================================================================
  Testimonial: {
    props: z.object({
      quote: z.string().describe('The testimonial text (required, plain text — no markdown/HTML). One or two sentences reads best; the `large` variant is built for a short, punchy quote.'),
      authorName: z.string().nullable().describe('Name of the person being quoted (shown under the quote).'),
      authorTitle: z.string().nullable().describe('Role / company line under the author name (e.g. "CTO, Acme").'),
      avatarSrc: z
        .string()
        .nullable()
        .describe('Author avatar image URL (raster only — png/jpg/webp; svg/data-svg rejected). Falls back to initials when absent/unsafe.'),
      rating: z
        .number()
        .nullable()
        .describe('Optional 0–5 star rating shown as a star row above the quote. A plain count, not a visual dimension.'),
      variant: z
        .enum(['card', 'plain', 'large'])
        .nullable()
        .describe('Treatment: card (bordered surface, default) · plain (no border, inline) · large (oversized hero quote).'),
      accent: colorSchema.describe('Ink colour of the filled rating-star glyphs (default amber). Names a specific brand color.'),
      color: colorSchema.describe('Primary text colour — the quote body and the author name, which travel together (default the foreground token). Set a light value when placing the testimonial on a dark surface; the role/company line stays `mutedColor`.'),
      borderColor: colorSchema.describe('Border colour of the card variant (default the border token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the author role/company line under the name (default the muted-foreground token).'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact border thickness of the card variant (e.g. "2px"; default 1px). Only applies to the card variant.'),
      font: Font.describe('Typeface for the whole testimonial region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the quote body (overrides the variant default, e.g. the large variant\'s medium).'),
      tracking: Tracking.describe('Letter-spacing of the quote body (default normal).'),
      leading: Leading.describe('Line height of the quote body (overrides the variant default, e.g. relaxed/snug).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the quote body (e.g. "20px" / "1.25rem"). Default 1.0625rem (1.5rem on the large variant).'),
    }),
    description:
      'A customer quote card: an optional star rating, the quote body (plain text — no markdown/HTML), and the author name/title with an avatar. Reach for this when you need social proof — a single quote inline, or several tiled in a Grid for a wall of testimonials. The `variant` shifts the treatment (bordered `card`, borderless `plain`, oversized `large` hero quote) and a missing/unsafe `avatarSrc` falls back to the author initials rather than a broken image.',
    example: { quote: 'Frayme cut our build time in half.', authorName: 'Jordan Lee', authorTitle: 'Head of Product, Northwind', rating: 5 },
  },

  // =========================================================================
  // FAQ — an accordion of question/answer rows
  // =========================================================================
  FAQ: {
    props: z.object({
      items: z
        .array(z.object({ question: z.string(), answer: z.string() }))
        .nullable()
        .describe('The Q&A rows. Each row expands/collapses on click (plain text answers — no markdown/HTML).'),
      allowMultiple: z
        .boolean()
        .nullable()
        .describe('Allow several rows open at once (default false — opening one closes the others, classic accordion).'),
      variant: z
        .enum(['bordered', 'separated', 'plain'])
        .nullable()
        .describe('Treatment: bordered (single bordered card, default) · separated (each row its own card) · plain (dividers only).'),
      defaultOpenIndex: z
        .number()
        .nullable()
        .describe('Index of the row to start expanded (0-based). Omit to start with all rows collapsed.'),
      openIndices: z
        .array(z.number())
        .nullable()
        .describe('The currently-expanded row indices (0-based). Bind with { $bindState } and the renderer mirrors the FULL open-set here on every toggle so an external Button can read which questions are open; lives without any binding. Works for accordion (single) and allowMultiple (many). `defaultOpenIndex` remains the initial-seed config.'),
      chevronIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME (closed icon registry) for the expand/collapse affordance — it rotates 180° when open (default "chevron-down"). Unknown/absent → the default glyph; never raw SVG.'),
      accent: colorSchema.describe('Text colour of the expanded row\'s question header and its chevron glyph (default the foreground token). Names a specific brand colour.'),
      color: colorSchema.describe('Resting (closed) question-header text colour — the collapsed rows\' question text and their chevron (the chevron follows at ~70% strength; default the foreground token). Does NOT touch the expanded row, which uses `accent`.'),
      borderColor: colorSchema.describe('Colour of the row dividers / card borders between questions (default the border token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the expanded answer body (default the muted-foreground token).'),
      font: Font.describe('Typeface for the whole FAQ region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the question headers (light · normal · medium · semibold · bold; default medium).'),
      tracking: Tracking.describe('Letter-spacing of the question headers (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the question headers (tight · snug · normal · relaxed · loose; default normal).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the question headers (e.g. "20px" / "1.25rem"). Default 0.9375rem.'),
    }),
    events: ['change'],
    eventsDoc: {
      change: 'A question header was toggled open/closed; params carry {index, open, name} — the row index, its NEW open state, and its question text.',
    },
    description:
      'An accordion of question/answer rows. Each header is a button (aria-expanded) that toggles its answer region (emits `change`); set `allowMultiple` to keep several open. Interactive out of the box — works without any binding. Bind `openIndices` with `{ $bindState }` so the agent (or a sibling control) can read the live set of expanded row indices from spec.state.',
    example: {
      items: [
        { question: 'Can I cancel anytime?', answer: 'Yes — plans are month-to-month with no lock-in.' },
        { question: 'Do you offer a free tier?', answer: 'The Free plan includes 100 generations a month.' },
      ],
    },
  },

  // =========================================================================
  // Footer — a site footer
  // =========================================================================
  Footer: {
    props: z.object({
      brand: z.string().nullable().describe('Brand / product name shown in the footer lede column.'),
      tagline: z.string().nullable().describe('Short supporting line under the brand name in the lede column (e.g. a one-line pitch). Rendered in `mutedColor`; omit for a bare brand name.'),
      columns: z
        .array(
          z.object({
            heading: z.string(),
            links: z.array(z.object({ label: z.string(), href: safeHref })),
          }),
        )
        .nullable()
        .describe('Link columns (each a heading + a list of {label, href}). The column count is derived from the array length.'),
      socials: z
        .array(z.object({ icon: z.string(), href: safeHref }))
        .nullable()
        .describe('Social links: each an icon glyph NAME (from the closed icon registry (or a single emoji glyph, rendered as-is)) + an href. Unknown names render nothing.'),
      bottomText: z.string().nullable().describe('Fine-print line at the very bottom (e.g. a copyright notice).'),
      variant: z
        .enum(['simple', 'columns'])
        .nullable()
        .describe('Layout: columns (brand lede + link columns, default) · simple (single centered row — brand + socials + bottom text).'),
      accent: colorSchema.describe('Text colour of a footer link or social glyph while hovered — the resting colour is `mutedColor` (default the foreground token). Names a specific brand colour.'),
      bg: colorSchema.describe('Footer background fill (default transparent — inherits the page surface). Set a brand surface for a filled footer.'),
      color: colorSchema.describe('Primary text colour — the brand name (default the foreground token). Set a light value on a dark `bg`.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the tagline, column headings, link rows, social icon links, and fine-print bottom line (default the muted-foreground token).'),
      borderColor: colorSchema.describe('Colour of the fine-print divider line above the bottom text (columns variant; default the border token). Set alongside a dark `bg` so the rule sits on the brand surface.'),
      weight: Weight.describe('Font weight of the brand name in the footer lede (default semibold).'),
    }),
    description:
      'A site footer: a brand lede, several link columns ({heading, links}), social icon links, and a fine-print bottom line. Links are scheme-guarded <a>s. Use at the very bottom of a page.',
    example: {
      brand: 'Frayme',
      tagline: 'Ship MCP Apps to Claude and ChatGPT.',
      columns: [{ heading: 'Product', links: [{ label: 'Pricing', href: '/pricing' }, { label: 'Docs', href: '/docs' }] }],
      bottomText: '© 2026 Frayme. All rights reserved.',
    },
  },

  // =========================================================================
  // PricingTable — display-only plan comparison (NO payment)
  // =========================================================================
  PricingTable: {
    props: z.object({
      plans: z
        .array(
          z.object({
            name: z.string(),
            price: z.string(),
            period: z.string().nullable(),
            description: z.string().nullable(),
            features: z.array(z.string()),
            badge: z.string().nullable().describe('Small ribbon label on this plan (e.g. "Most popular", "Best value") — rendered top-right, tinted by the table `accent`. Omit for no ribbon.'),
            highlighted: z.boolean().nullable(),
            ctaLabel: z.string().nullable(),
            ctaHref: safeHref.nullable(),
          }),
        )
        .nullable()
        .describe('The plans to compare. Each: name, price, optional period/description, a feature list, an optional ribbon `badge`, an optional highlight flag, and an optional CTA label/href. NEVER any payment/card fields.'),
      period: z
        .enum(['monthly', 'yearly'])
        .nullable()
        .describe('Global billing-period enum shown above the grid as "Billed monthly/yearly" (display only — no toggle/checkout). Ignored when `periodLabel` is set.'),
      periodLabel: z
        .string()
        .nullable()
        .describe('Free-form billing-period caption shown above the grid (e.g. "Billed annually — save 20%", or a localised string), rendered verbatim. Overrides the `period` enum default; omit both for no caption.'),
      columns: z
        .number()
        .nullable()
        .describe('Number of plan columns (1–12 grid track count). Defaults to the plan count when omitted.'),
      accent: colorSchema.describe('Background fill of the featured plan\'s CTA button and of a plan\'s ribbon badge, plus the highlight ring and the feature check marks (default the primary token). Their label is always the card token, so choose a value dark enough to carry it.'),
      bg: colorSchema.describe('Background fill of EVERY plan card, applied uniformly (default the card token). Pair with `color` for legible copy on a saturated surface.'),
      color: colorSchema.describe('Primary text colour on each plan card — the plan name, price value, feature-list items, and the neutral (non-highlighted) CTA label (default the foreground token). Set a readable value when `bg` is a saturated surface.'),
      borderColor: colorSchema.describe('Border colour of every non-highlighted plan card and its neutral CTA button (default the border token; the highlighted plan keeps its accent ring).'),
      shadow: Shadow.describe('Drop-shadow elevation applied to every plan card (none/sm/md/lg/xl; default none) — raise the whole grid off the page.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the billed-period label, plan descriptions, and price-period suffixes (default the muted-foreground token).'),
      font: Font.describe('Typeface for the whole pricing-table region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of each plan price value (default semibold).'),
      tracking: Tracking.describe('Letter-spacing of each plan name (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of each plan name (tight · snug · normal · relaxed · loose; default the plan-name default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of each plan name (e.g. "20px" / "1.25rem"). Default 0.875rem.'),
      showCta: z.boolean().nullable().describe('Whether each plan renders a CTA button (default true). Set false for a STATIC, read-only price comparison — a plain fees/features grid with NO "Choose plan" buttons. Use this on read-only recipes, where a CTA would be a dead affordance.'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'A plan\'s CTA button was pressed (no `ctaHref` set on that plan); params carry {plan, index, price} — the plan name, its column index, and its price string.',
    },
    description:
      'A DISPLAY-ONLY plan-comparison grid: several plan columns with price, features, and an optional CTA. Each plan CTA is an <a> when a ctaHref is set, otherwise a button that emits `commit`. Never carries payment/checkout fields — the host routes the choice. Reach for PricingTable over several standalone PlanCards when comparing 2+ plans side by side in one grid; use PlanCard alone for a single plan or a non-uniform layout.',
    example: {
      plans: [
        { name: 'Free', price: '£0', period: '/mo', features: ['100 generations', 'Community support'], ctaLabel: 'Get started' },
        { name: 'Pro', price: '£99', period: '/mo', features: ['10,000 generations', 'Priority support'], highlighted: true, ctaLabel: 'Choose Pro' },
      ],
    },
  },

  // =========================================================================
  // PlanCard — a single plan/price card (display + a commit action)
  // =========================================================================
  PlanCard: {
    props: z.object({
      name: z.string().describe('The plan name (required, e.g. "Pro", "Free"). Short — one or two words, shown truncated at the top of the card.'),
      price: z.string().describe('The price value (required), pre-formatted text including the currency symbol (e.g. "£99", "$0", "Custom"). Not a number — Frayme never computes currency.'),
      period: z.string().nullable().describe('Billing period suffix after the price (e.g. "/mo", "/year").'),
      description: z.string().nullable().describe('Short supporting line under the plan name (e.g. "For growing teams"). Rendered in `mutedColor`; omit for a name-and-price-only card.'),
      features: z
        .array(z.string())
        .nullable()
        .describe('Bullet list of what the plan includes (each rendered with a check mark).'),
      badge: z.string().nullable().describe('Small ribbon label (e.g. "Most popular", "Best value").'),
      highlighted: z.boolean().nullable().describe('Emphasize this card (accent ring + filled CTA) — use for the recommended plan.'),
      ctaLabel: z.string().nullable().describe('The CTA button/link text (default "Choose plan"). Set a plan-specific verb like "Start free" or "Choose Pro"; it is echoed in the `commit` payload as the button label.'),
      ctaHref: safeHref.nullable().describe('Make the CTA a navigable link. Omit to render a button that emits `commit`.'),
      accent: colorSchema.describe('Background fill of the highlighted plan\'s CTA button and of the ribbon badge, plus the highlight ring and the feature check marks (default the primary token). Pair it with `accentText` for the label on that fill.'),
      accentText: colorSchema.describe('Text colour on the accent-filled CTA button + ribbon badge (default the on-primary token). Set when a saturated `accent` needs a legible label.'),
      bg: colorSchema.describe('Exact background fill of the card surface (a brand surface). Pair it with `color` so the on-card copy stays legible.'),
      borderColor: colorSchema.describe('Card border colour — the card edge and the neutral (non-highlighted) CTA button border (default the border token; ignored when `highlighted` swaps the card border for an accent ring).'),
      color: colorSchema.describe('Text colour of the on-card copy — plan name, price and feature lines — when a custom `bg` surface is set, and of the neutral CTA label always (defaults to a readable light on-fill token). Set a dark value for a light card.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the plan description and price-period suffix on the default (no custom `bg`) card (default the muted-foreground token).'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact card border thickness (e.g. "2px"; default 1px). Ignored when `highlighted` swaps the border for an accent ring.'),
      shadow: Shadow.describe('Drop-shadow elevation of the card surface (none/sm/md/lg/xl; default none) — raise a featured plan off the page.'),
      font: Font.describe('Typeface for the whole plan-card region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the price value (default semibold).'),
      tracking: Tracking.describe('Letter-spacing of the plan name (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the plan name (tight · snug · normal · relaxed · loose; default the plan-name default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the plan name (e.g. "20px" / "1.25rem"). Default 0.875rem.'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'The CTA button was pressed (no `ctaHref` set); params carry {name, price, label} — the plan name, its pre-formatted price string, and the CTA label (falling back to the plan name), so the host always has the chosen plan identity and price.',
    },
    description:
      'A single plan/price card: name, price + period, a feature list with check marks, an optional ribbon badge, and a CTA. The CTA is an <a> when a ctaHref is set, otherwise a button that emits `commit`. Display-only — never any card-number/payment fields.',
    example: {
      name: 'Pro',
      price: '£99',
      period: '/mo',
      description: 'For growing teams.',
      features: ['10,000 generations', 'Priority support', 'Stripe Connect'],
      badge: 'Most popular',
      highlighted: true,
      ctaLabel: 'Choose Pro',
    },
  },
};
