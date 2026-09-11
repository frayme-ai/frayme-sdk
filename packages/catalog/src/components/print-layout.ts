/**
 * Frayme PrintLayout — a paginated, print-ready document composition (P?/Doc-output).
 *
 * A fixed-width on-screen "page" preview (A4/Letter/Legal) that lays author-supplied
 * report sections (heading · paragraph · fields · table · divider · page-break ·
 * spacer) into a clean printable flow, with an optional running header/footer band
 * and a Print button that calls window.print(). The report / invoice / statement
 * surface. PDF export is DEFERRED to the platform — this only produces print-ready
 * HTML + a print trigger.
 *
 * POSTURE: STATELESS pure-view — holds no working state; page grouping, layout and
 * validated colors all derive from props each render (SSR byte-identical). window
 * is touched ONLY inside the Print onClick handler.
 *
 * SECURITY: every section value renders as ESCAPED React text (no HTML, no
 * dangerouslySetInnerHTML); colors flow through colorSchema→safeColor; page size /
 * margin / font are CLOSED enums → static classes (no author CSS reaches @page);
 * sections capped at 500, tables at 200 rows × 20 cols (render-bomb guard).
 *
 * Component: PrintLayout.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

const sectionSchema = z.object({
  id: z.string().nullable().describe('Stable id for the section, echoed in the `select` payload so a host can open an editor for it. Auto-assigned if omitted.'),
  kind: z.enum(['heading', 'paragraph', 'fields', 'table', 'image', 'divider', 'pageBreak', 'spacer']).describe('Section type: heading (text+level 1..3) · paragraph (text) · fields (fields[{label,value}]) · table (columns[]+rows[][]) · image (src+caption) · divider (a rule) · pageBreak (forces a new printed page) · spacer (vertical gap).'),
  text: z.string().nullable().describe('The text for a heading or paragraph. Escaped.'),
  level: z.number().nullable().describe('Heading level 1..3 (default 2); ignored for other kinds.'),
  fields: z.array(z.object({ label: z.string(), value: z.string().nullable() })).nullable().describe('For kind:"fields" — label/value pairs rendered as a definition grid (e.g. invoice metadata).'),
  columns: z.array(z.string()).nullable().describe('For kind:"table" — column header labels.'),
  rows: z.array(z.array(z.string())).nullable().describe('For kind:"table" — row data; each row is an array of cell strings aligned to columns.'),
  src: z.string().nullable().describe('For kind:"image" — the image source: a raster data: URI (≤256KB, e.g. an uploaded file/logo/scan encoded as base64) or an http(s)/relative URL. svg and blob: are rejected for safety — pass a blob as a data: URI.'),
  alt: z.string().nullable().describe('Alt text for an image section (accessibility). Escaped.'),
  caption: z.string().nullable().describe('Optional caption shown under an image. Escaped text.'),
});

export const printLayoutComponents = {
  PrintLayout: {
    props: z.object({
      title: z.string().nullable().describe('Document title shown at the top of page 1 and (small) in the running header. Escaped text. Reach for it on every report/invoice.'),
      subtitle: z.string().nullable().describe('Secondary line under the title (e.g. a date range or client name). Escaped text.'),
      sections: z.array(sectionSchema).nullable().describe('The ordered document sections. Omit for a representative demo report. Capped at 500 sections; tables at 200 rows × 20 cols.'),
      pageSize: z.enum(['a4', 'letter', 'legal', 'auto']).nullable().describe('Page-preview width + print hint (default a4). "auto" = fluid width, single continuous flow.'),
      margin: z.enum(['none', 'narrow', 'normal', 'wide']).nullable().describe('Inner page padding around the printed content (default normal).'),
      showHeader: z.boolean().nullable().describe('Show a running header band (title + optional headerText) at the top of each page (default true).'),
      showFooter: z.boolean().nullable().describe('Show a running footer band (footerText + a page marker) (default true).'),
      showPageNumbers: z.boolean().nullable().describe('Render a "Page N of M" marker in the footer (default true). The preview counts page-break groups; true print pagination is the browser\'s job.'),
      showPrintButton: z.boolean().nullable().describe('Show the "Print" action above the page that calls window.print() (default true). Hidden in the printed output.'),
      printLabel: z.string().nullable().describe('Label of the print button (default "Print"). Escaped text.'),
      headerText: z.string().nullable().describe('Optional running-header caption (e.g. a company name; falls back to the title). Escaped text.'),
      footerText: z.string().nullable().describe('Optional running-footer caption (e.g. "Confidential"). Escaped text.'),
      accent: colorSchema.describe('Accent color of the title band, heading underlines and header/footer rules (default the primary token).'),
      buttonColor: colorSchema.describe('Fill color of the Print button (default follows the accent/primary token). Set independently of the document accent.'),
      mutedColor: colorSchema.describe('Secondary text color — subtitle, footer, table header, field labels (default the muted-foreground token).'),
      gridColor: colorSchema.describe('Table + divider + header/footer rule color (default the border token).'),
      font: z.enum(['sans', 'serif', 'mono', 'rounded', 'display']).nullable().describe('Document typeface from the closed menu (default inherits the theme; serif suits formal reports).'),
    }),
    description:
      'A print-ready paginated document: author-supplied sections (heading, paragraph, key-value fields, table, image, divider, page-break, spacer) laid into a fixed-width A4/Letter/Legal page preview with an optional running header/footer and a Print button. The Print button prints ONLY this layout (not the surrounding page). PDF export is a platform concern. Emits `commit` when Print is pressed. Stateless, SSR-safe, all text escaped; images pass safeImageSrc.',
    example: {
      title: 'Q3 Revenue Report',
      subtitle: 'Acme Corp · Jul – Sep 2026',
      sections: [
        { kind: 'heading', text: 'Executive summary', level: 2 },
        { kind: 'paragraph', text: 'Revenue grew 24% quarter-over-quarter, driven by the Platform tier and improved retention across all segments.' },
        { kind: 'fields', fields: [{ label: 'Total revenue', value: '£1,284,000' }, { label: 'Net new customers', value: '312' }, { label: 'Churn', value: '2.1%' }] },
        { kind: 'heading', text: 'By product line', level: 3 },
        { kind: 'table', columns: ['Product', 'Revenue', 'Growth'], rows: [['Platform', '£742k', '+31%'], ['API', '£389k', '+18%'], ['Marketplace', '£153k', '+9%']] },
        { kind: 'divider' },
        { kind: 'paragraph', text: 'Prepared by Finance. Confidential — do not distribute.' },
      ],
    },
    events: ['commit'],
    eventsDoc: {
      commit: 'The Print button was activated (prints only this layout); params carry { reason: "print", title, sections (count), pageCount }.',
    },
  },
};
