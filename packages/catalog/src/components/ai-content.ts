/**
 * Frayme ai-content — 6 schemas for AI-native surfaces: citations, artifacts,
 * streaming placeholders, and diffs. The kind of UI a chat/agent response is made
 * of (a sources list, an inline [n] citation, a generated artifact panel, a link
 * preview, a streaming shimmer, a side-by-side diff).
 *
 * Same truly-dynamic foundation as the shipped catalog:
 *   - ENUM props → static CVA classes in the renderer (the bounded menu a spec draws from). NEVER `z.string()` for a visual/behavioral selector.
 *   - VALUE props (a color the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     `var(--fr-…, var(--color-…))` utilities. Only the var's VALUE is
 *     model-supplied; the class set stays closed (no JIT, no injection).
 *
 * Every enum/value prop is `.nullable()` + `.describe()` (one sentence naming
 * WHEN to reach for it); defaults live in the
 * renderer's CVA `defaultVariants`, so a props-less spec still renders polished.
 *
 * SECURITY: `url`/`image` carry CONTENT strings guarded by the local
 * isSafeHref/isSafeImageSrc refines (scheme allowlist) AND re-guarded at the
 * point of use in the renderer (safeUrl/safeImageSrc). Artifact/DiffView `content`
 * is rendered as ESCAPED React text — never markup. Icons are NAMES, never SVG.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 *
 * Components: Sources · InlineCitation · Artifact · WebPreview · Shimmer · DiffView.
 */

import { z } from 'zod';
import { Aspect, BorderStyle, Shadow, Weight, Leading, colorSchema, dimensionSchema } from './_shared.js';

// URL-scheme guards (defense-in-depth alongside the renderer's runtime
// sanitization): reject specs carrying javascript:/data:/vbscript:/file: in a
// navigable href, and javascript:/vbscript:/file: in an image source (data:
// raster images are legitimate). Mirrors the helpers in shadcn-base.ts (kept
// local — no dep added). Control chars are stripped so `java\tscript:` can't
// slip past the scheme check.
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeHref = (s: string): boolean =>
  !/^\s*(javascript|data|vbscript|file):/i.test(stripWhitespace(s));
const isSafeImageSrc = (s: string): boolean =>
  !/^\s*(javascript|vbscript|file):/i.test(stripWhitespace(s));

export const aiContentComponents = {
  // =========================================================================
  // Sources — a list/grid of cited source cards (RAG / web-search results)
  // =========================================================================
  Sources: {
    props: z.object({
      sources: z
        .array(
          z.object({
            title: z.string().describe('Source title / page name shown as the card link text.'),
            url: z
              .string()
              .refine(isSafeHref, 'url uses an unsafe URL scheme')
              .nullable()
              .describe('Link to the source (opens in a new tab). The hostname is shown as a muted label; omit for a non-linked source.'),
            excerpt: z.string().nullable().describe('Short quoted snippet / summary from the source.'),
          }),
        )
        .describe('The cited sources. Each renders a card: title link + hostname + optional excerpt.'),
      title: z.string().nullable().describe('Heading above the source cards (default "Sources").'),
      variant: z
        .enum(['list', 'grid'])
        .nullable()
        .describe('Layout: list (stacked rows, default) · grid (responsive card grid for many sources).'),
      minColWidth: dimensionSchema({ units: ['px', 'rem'], min: 96, max: 480 }).describe(
        'Exact min column width for the auto-fill grid (e.g. 200px / 11rem). Overrides the built-in 13rem minimum; only applies to variant:grid.',
      ),
      externalIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME (closed icon registry) for the per-source open-in-new-tab affordance (default "arrow-up-right"). Unknown/absent → the default glyph; never raw SVG.'),
      accent: colorSchema.describe('Per-source title-link color (default the foreground token). The heading is colored by `mutedColor`, not this.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the heading, each source hostname + excerpt, and the hover-revealed external-link glyph (default the muted-foreground token).'),
      bg: colorSchema.describe('Background fill of each source card surface (default the card token).'),
      borderColor: colorSchema.describe('Border colour of each source card (default the border token).'),
      shadow: Shadow.describe('Drop-shadow elevation of each source card — none · sm · md · lg · xl; default flat. Set to lift the cards off the page.'),
    }),
    description:
      'A citations panel: a titled list or grid of source cards (title link → hostname → excerpt) for RAG / web-search results. Each title links out in a new tab. Reach for this when an assistant answer is grounded in retrieved documents and you want to surface the whole reference set as a block — typically placed after a Message or MessageContent, not inline like an InlineCitation. Switch `variant` to `grid` (with `minColWidth`) once there are many sources so the cards tile responsively instead of stacking.',
    example: {
      title: 'Sources',
      sources: [
        { title: 'json-render docs', url: 'https://json-render.dev', excerpt: 'The open UI specification standard.' },
        { title: 'MCP Apps spec (SEP-1865)', url: 'https://modelcontextprotocol.io', excerpt: 'Interactive UI inside Claude and ChatGPT.' },
      ],
    },
  },

  // =========================================================================
  // InlineCitation — a superscript [n] chip-link inside running text
  // =========================================================================
  InlineCitation: {
    props: z.object({
      index: z.number().describe('The citation number shown as a superscript "[n]" marker.'),
      url: z
        .string()
        .refine(isSafeHref, 'url uses an unsafe URL scheme')
        .nullable()
        .describe('Link to the cited source (opens in a new tab). Omit to render a non-linked marker.'),
      excerpt: z.string().nullable().describe('Source snippet surfaced as the link tooltip (title attribute).'),
      accent: colorSchema.describe('Marker color for the superscript "[n]" chip and its link (default the info/link token). Name a brand color to match a custom citation palette.'),
    }),
    description:
      'A small superscript "[n]" citation chip that links to a source in a new tab, with the excerpt as its hover tooltip. Place inline next to a claim in generated text. Reach for this when a single sentence needs a numbered footnote-style reference, as opposed to the Sources panel that lists the full reference set. It sits mid-flow inside a Message / MessageContent body and, unlike Sources, renders just the number — hover reveals the `excerpt` as a native title tooltip.',
    example: { index: 1, url: 'https://json-render.dev', excerpt: 'The open UI specification standard.' },
  },

  // =========================================================================
  // Artifact — a generated-content panel (code / document / preview)
  // =========================================================================
  Artifact: {
    props: z.object({
      title: z.string().describe('Artifact name shown in the panel header, next to the `kind` glyph (e.g. a filename or document title). Required — it labels the panel.'),
      content: z.string().describe('The artifact body, rendered as ESCAPED text (mono when kind=code). Never interpreted as markup.'),
      kind: z
        .enum(['code', 'document', 'preview'])
        .nullable()
        .describe('What the artifact is: code (mono body + code glyph) · document (prose body + file glyph) · preview (rendered-output framing + eye glyph). Default document.'),
      maxHeight: dimensionSchema({ units: ['px', 'rem', 'vh'], min: 120, max: 1600 }).describe(
        'Exact max height of the scrollable artifact body (e.g. 600px / 40vh). Overrides the built-in 28rem cap, which is the default.',
      ),
      copyLabel: z.string().nullable().describe('Text on the copy button in its resting state (default "Copy"). Escaped text — set for localization.'),
      copiedLabel: z.string().nullable().describe('Text on the copy button for ~1.5s after a successful copy, and its accessible label (default "Copied"). Escaped text — set for localization.'),
      accent: colorSchema.describe('Header accent color: the kind glyph + title (default foreground token).'),
      color: colorSchema.describe('Body text colour of the artifact content (default the foreground token). Pair with a dark `bg` so the body stays legible on the repainted panel.'),
      bg: colorSchema.describe('Background fill of the artifact panel surface AND the copy-button chip (default card token).'),
      borderColor: colorSchema.describe('Border colour of the artifact panel, its header divider, and the copy-button chip (default the border token).'),
      borderStyle: BorderStyle.describe('Outer panel border style: solid (default) · dashed · dotted.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe(
        'Exact outer panel border thickness in px (e.g. "2px"; default 1px).',
      ),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the copy-button label (default the muted-foreground token).'),
      shadow: Shadow.describe('Drop-shadow elevation of the artifact panel — none · sm · md · lg · xl; default flat. Set to lift the artifact off the page as a raised surface.'),
    }),
    description:
      'A generated-artifact panel: a header (kind icon + title + copy button) over an escaped-text body. Use to present a code snippet, a written document, or a preview the assistant produced. Reach for this when a chunk of generated output deserves its own framed, copyable surface — set apart from the running Message prose rather than inlined into it. Pick `kind` to switch the header glyph and body treatment (mono for `code`), and the header copy button lifts the whole `content` to the clipboard, flipping `copyLabel`→`copiedLabel` for ~1.5s.',
    example: { title: 'fibonacci.ts', kind: 'code', content: 'export const fib = (n: number): number =>\n  n < 2 ? n : fib(n - 1) + fib(n - 2);' },
  },

  // =========================================================================
  // WebPreview — a link-preview card (no iframe)
  // =========================================================================
  WebPreview: {
    props: z.object({
      url: z
        .string()
        .refine(isSafeHref, 'url uses an unsafe URL scheme')
        .describe('The page the card links to (opens in a new tab). Its hostname is shown as a muted label.'),
      title: z.string().nullable().describe('Page title shown as the prominent card heading above the description and hostname (default none). Set it to the OG/page title; omit for a bare url + hostname card.'),
      weight: Weight.describe('Font weight of the title heading: light · normal · medium (default) · semibold · bold.'),
      leading: Leading.describe('Line height of the title heading: tight · snug (default) · normal · relaxed · loose.'),
      width: dimensionSchema({ units: ['px', 'rem', '%'], min: 120, max: 720 }).describe(
        'Exact max width of the preview card (e.g. 480px / 24rem). Overrides the built-in 28rem cap (max-w-md), which is the default; the card still shrinks below the cap.',
      ),
      description: z.string().nullable().describe('Page summary / meta description shown under the title.'),
      image: z
        .string()
        .refine(isSafeImageSrc, 'image uses an unsafe URL scheme')
        .nullable()
        .describe('Open-graph / thumbnail image URL (raster only). A placeholder is shown when omitted or invalid.'),
      aspect: Aspect.describe('Aspect ratio of the thumbnail box (image + placeholder), e.g. 16/9 or 1/1; default the OG 1.91/1.'),
      externalIcon: z
        .string()
        .nullable()
        .describe('Glyph NAME (closed icon registry) for the external-link affordance — the placeholder mark + the hostname row (default "external-link"). Unknown/absent → the default glyph; never raw SVG.'),
      accent: colorSchema.describe('Title heading color (default the foreground token). The hostname row is colored by `mutedColor`, not this.'),
      bg: colorSchema.describe('Background fill of the preview card surface (default card token).'),
      borderColor: colorSchema.describe('Border colour of the preview card (default the border token).'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe(
        'Exact preview-card border thickness in px (e.g. "2px"; default 1px).',
      ),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the description, the hostname label, and the image-placeholder glyph (default the muted-foreground token).'),
      shadow: Shadow.describe('Drop-shadow elevation of the preview card — none · sm · md · lg · xl; default flat. Set to lift the card off the page as a floating surface.'),
    }),
    description:
      'A link-preview card (NOT an iframe — no embedded page): optional thumbnail, title, description, and hostname; the whole card links out in a new tab. Use for a shared / referenced web page. Reach for this when the assistant cites or recommends ONE page and you want a rich unfurl (image + title + summary) rather than the plain [n] chip of an InlineCitation or the multi-row Sources list. The entire card is one click target that opens in a new tab; when `image` is missing or blocked, an `externalIcon` placeholder box stands in for the thumbnail.',
    example: {
      url: 'https://json-render.dev',
      title: 'json-render — the open UI specification',
      description: 'Render JSON specs to React. The standard behind Frayme.',
    },
  },

  // =========================================================================
  // Shimmer — a streaming text placeholder (animated)
  // =========================================================================
  Shimmer: {
    props: z.object({
      lines: dimensionSchema({ kind: 'count', min: 1, max: 6 }).describe('How many shimmer lines to render (1-6; the last is shorter). Use while streaming text is still arriving.'),
    }),
    description:
      'A streaming placeholder: N animated shimmer lines (the last shorter) shown while the assistant is still generating text. Purely decorative (aria-hidden). Default 3 lines.',
    example: { lines: 3 },
  },

  // =========================================================================
  // DiffView — a line-based before/after diff (escaped text)
  // =========================================================================
  DiffView: {
    props: z.object({
      before: z.string().describe('The original text (lines removed/unchanged are computed against `after`).'),
      after: z.string().describe('The new text (lines added/unchanged are computed against `before`).'),
      filename: z.string().nullable().describe('File name / label shown in the diff header (e.g. "config.ts"; default none). When set it replaces the `headerLabel` fallback ("Changes"); set it to name the file the edit applies to.'),
      headerLabel: z
        .string()
        .nullable()
        .describe('Fallback header text when no `filename` is set (default "Changes"). Escaped text — set for localization.'),
      mode: z
        .enum(['unified', 'split'])
        .nullable()
        .describe('Layout: unified (one column with +/- gutters, default) · split (before | after side-by-side).'),
      maxHeight: dimensionSchema({ units: ['px', 'rem', 'vh'], min: 120, max: 1600 }).describe(
        'Exact max height of the diff body (e.g. 600px / 40vh); the body becomes a vertical scroll container. Omit for an unbounded diff (the default — matches Artifact\'s units/bounds).',
      ),
      showLineNumbers: z.boolean().nullable().describe('Show a line-number gutter alongside each diff row (default off). Turn on for longer diffs where readers need to reference specific line positions.'),
      bg: colorSchema.describe('Background fill of the diff panel surface (default the card token).'),
      borderColor: colorSchema.describe('Border colour of the diff panel frame + its header divider (default the border token).'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe(
        'Exact outer panel border thickness in px (e.g. "2px"; default 1px).',
      ),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the header edit glyph, the line-number gutter, and the unchanged-row gutter marks (default the muted-foreground token).'),
      shadow: Shadow.describe('Drop-shadow elevation of the diff panel — none · sm · md · lg · xl; default flat. Set to lift the diff off the page as a raised surface.'),
    }),
    description:
      'A line-based diff of two text blocks: added lines tinted green (+), removed lines tinted red (-), unchanged neutral. Renders ESCAPED text only (never markup). Use to show an edit/proposed change.',
    example: {
      filename: 'config.ts',
      before: 'const timeout = 30;\nconst retries = 1;',
      after: 'const timeout = 60;\nconst retries = 3;',
    },
  },
};
