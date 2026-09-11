/**
 * Frayme FileEmbed — a document viewer for PDFs and Office files (Media cluster).
 *
 * Renders a document inline: a PDF in the browser's native viewer (sandboxed
 * iframe), an Office file (docx/xlsx/pptx) via the Microsoft Office Online viewer
 * (a fixed, trusted host — the file URL rides as an encoded query param), or an
 * image directly. Where a surface blocks frames (strict MCP Apps CSP) or the file
 * kind is unknown, it degrades to a labeled card with an "Open / Download" link.
 *
 * POSTURE: DISPLAY-only. Frayme never stores a key. The PDF iframe is
 * sandbox-hardened (no scripts / no top-navigation) so a `src` that turns out to
 * be an HTML page can't run scripts or redirect the host; the Office viewer host
 * is a hardcoded constant, never a spec-supplied hostname.
 *
 * SECURITY: src passes safeUrl (http/https only); the Office viewer URL is
 * built from a constant host + encodeURIComponent(src); the PDF iframe is
 * sandbox="" (maximally restrictive); the open-link carries rel="noopener
 * noreferrer"; images pass safeImageSrc; all text escaped.
 *
 * NOTE: the Office viewer requires the file to be at a PUBLIC URL Microsoft can
 * fetch (documented) — private/auth-gated docs won't render there.
 *
 * Component: FileEmbed.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

export const fileEmbedComponents = {
  FileEmbed: {
    props: z.object({
      src: z.string().nullable().describe('The document URL (http/https). For an Office file it must be a PUBLIC URL the Microsoft viewer can fetch; a PDF renders in the browser natively.'),
      kind: z.enum(['auto', 'pdf', 'office', 'image']).nullable().describe('How to render: auto (infer from the file extension, default), pdf (native viewer), office (docx/xlsx/pptx via the Office Online viewer), or image.'),
      title: z.string().nullable().describe('Accessible title for the viewer region and the header line (e.g. "Q3 report.pdf"; default "Document"). Escaped text.'),
      filename: z.string().nullable().describe('Display file name shown in the header and the fallback card (defaults to the last path segment of src). Escaped text.'),
      showToolbar: z.boolean().nullable().describe('Show the header bar with the title/filename and the Open link (default true).'),
      allowDownload: z.boolean().nullable().describe('Show the "Open / Download" link that opens the file in a new tab (default true).'),
      aspect: z.enum(['auto', '1/1', '4/3', '3/2', '16/9', '21/9', '3/4']).nullable().describe('Fixed aspect-ratio of the viewer to prevent layout jump (default 3/4, a portrait document shape); "auto" is treated as 3/4.'),
      height: dimensionSchema({ units: ['px', 'rem'], min: 160, max: 1200 }).describe('Optional exact viewer height (e.g. "640px") overriding the aspect box; validated and clamped 160..1200.'),
      accent: colorSchema.describe('Accent color of the header file glyph, the fallback card icon, and the Open link (default the primary token).'),
      borderColor: colorSchema.describe('Resting border color of the viewer frame + header (default the border token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the viewer frame (e.g. "12px"); overrides the default rounding, bounded to px/rem 0..64.'),
    }),
    description:
      'A document viewer: renders a PDF in the browser\'s inert native viewer, an Office file (docx/xlsx/pptx) via the Microsoft Office Online viewer (a fixed, sandboxed host), or an image inline — inferring the kind from the file extension. Where a surface blocks frames or the kind is unknown, it degrades to a labeled card with an "Open / Download" link. Display-only, provider-neutral, no key stored; the file URL is https-gated via safeUrl. Office files must be at a public URL the viewer can fetch.',
    example: {
      src: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
      kind: 'pdf',
      title: 'Sample report',
      filename: 'tracemonkey.pdf',
    },
  },
};
