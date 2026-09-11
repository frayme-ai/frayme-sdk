/**
 * Frayme BlockDocumentEditor — a structured document editor over a CLOSED block set
 * (heading · paragraph · bulleted · numbered · quote · code · divider · spacer ·
 * table · fields · image), with add / change-type / inline-edit / duplicate / delete /
 * reorder via BUTTONS + keyboard (Alt+Arrow). Explicitly NO contentEditable, NO
 * innerHTML — every text block is a plain <textarea>/<input>; tables/fields are grids
 * of inputs; images are a URL or an uploaded data-URI.
 *
 * POSTURE: OWNS-THE-SET editable via the shared useOrderedList engine. It has two
 * modes: EDIT (full editing UI) and VIEW (clean rendered document + Edit + Print). The
 * SAVE button hands the WHOLE document back to the agent (title + blocks + markdown) —
 * so a "draft → human edits → agent acts on the result" loop actually works. `change`
 * streams the live draft (debounced); `commit` fires on Save.
 *
 * SECURITY: all text is ESCAPED React children / textarea values — zero
 * dangerouslySetInnerHTML; images pass safeImageSrc (raster data:/http(s) only; svg +
 * blob rejected) and an uploaded file is read to a size-capped data-URI; block type
 * validated against the enum (unknown→paragraph); blocks capped at maxBlocks, text at
 * 20000 chars, table at 50×12, fields at 50.
 *
 * Component: BlockDocumentEditor.
 */

import { z } from 'zod';
import { colorSchema, Density } from './_shared.js';

const BLOCK_TYPES = ['heading', 'paragraph', 'bulleted', 'numbered', 'quote', 'code', 'divider', 'spacer', 'table', 'fields', 'image'] as const;

const blockSchema = z.object({
  id: z.string().nullable().describe('Stable id, echoed in the block-level `select` payload so the host can match it back. Auto-assigned if omitted.'),
  type: z.enum(BLOCK_TYPES).describe('Block type: heading · paragraph · bulleted · numbered · quote · code · divider · spacer · table · fields (key-value) · image. Unknown values fall back to paragraph.'),
  text: z.string().nullable().describe('Text for heading/paragraph/quote/code, or one item per line for bulleted/numbered lists. Escaped/plain — never markup.'),
  level: z.number().nullable().describe('Heading level 1..3 (default 2); ignored for every non-heading block type.'),
  lang: z.string().nullable().describe('Optional language label shown on a code block (e.g. "ts", "bash"); ignored for other block types.'),
  columns: z.array(z.string()).nullable().describe('For a table block: the column header labels (capped at 12 columns).'),
  rows: z.array(z.array(z.string())).nullable().describe('For a table block: row data, each row an array of cell strings aligned to columns (capped at 50 rows).'),
  fields: z.array(z.object({ label: z.string(), value: z.string().nullable() })).nullable().describe('For a fields block: label/value pairs rendered as a definition grid (capped at 50 fields).'),
  src: z.string().nullable().describe('For an image block: a raster data: URI (≤256KB) or an http(s)/relative URL. svg and blob: are rejected for safety.'),
  alt: z.string().nullable().describe('Alt text for an image block (accessibility). Escaped text.'),
  caption: z.string().nullable().describe('Optional caption shown under an image block. Escaped text.'),
});

export const blockDocumentEditorComponents = {
  BlockDocumentEditor: {
    props: z.object({
      title: z.string().nullable().describe('Document title shown at the top and included in the Save/change payloads (bindable with { $bindState }). Escaped text.'),
      blocks: z.array(blockSchema).nullable().describe('The document blocks. Omit for a representative demo document. The component holds these in state and mutates them as the user edits. Capped at maxBlocks.'),
      mode: z.enum(['edit', 'view']).nullable().describe('Initial mode: edit (full editing UI) or view (rendered document + Edit/Print buttons). Defaults to edit when editable, else view.'),
      editable: z.boolean().nullable().describe('Allow editing (default true): add, change type, edit inline, duplicate, delete, and reorder (▲▼ or Alt+Arrow). Set false for a permanently read-only rendered document.'),
      showToolbar: z.boolean().nullable().describe('Show the add-block toolbar in edit mode (default true; ignored when not editable).'),
      showSave: z.boolean().nullable().describe('Show the Save button that emits the whole document and switches to view mode (default true; ignored when not editable).'),
      showPrint: z.boolean().nullable().describe('Show the Print button (in view mode, or the toolbar) that prints ONLY the document, not the surrounding page (default true).'),
      allowImageUpload: z.boolean().nullable().describe('Let the user upload an image file into an image block; it is read to a size-capped data-URI client-side (default true).'),
      allowedBlocks: z.array(z.enum(BLOCK_TYPES)).nullable().describe('Restrict which block types can be added from the toolbar (default all eleven).'),
      saveLabel: z.string().nullable().describe('Label for the Save button (default "Save"). Escaped text — set for localization.'),
      printLabel: z.string().nullable().describe('Label for the Print button (default "Print"). Escaped text — set for localization.'),
      placeholder: z.string().nullable().describe('Message shown when the document is empty (default "Empty document — add a block to start"). Escaped text.'),
      maxBlocks: z.number().nullable().describe('Maximum number of blocks (default 128, hard-capped at 256). The add buttons disable at the cap.'),
      accent: colorSchema.describe('Accent color of the active-block ring, primary buttons and heading rules (default the primary token).'),
      mutedColor: colorSchema.describe('Secondary color — the toolbar chrome, block handles, counts and hints (default the muted-foreground token).'),
      gridColor: colorSchema.describe('Border color of the editor frame, table grid and block dividers (default the border token).'),
      font: z.enum(['sans', 'serif', 'mono', 'rounded', 'display']).nullable().describe('Document typeface from the closed menu (default inherits the theme; serif suits formal documents).'),
      density: Density.describe('Vertical spacing between blocks: compact · normal (default) · comfortable.'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      value: z.record(z.string(), z.unknown()).nullable().describe('Bindable mirror of the WHOLE edited document { title, blocks, markdown, blockCount }; kept live in spec.state (bind with { $bindState }) so an external Button can read the full body without waiting for Save.'),
    }),
    description:
      'A block document editor over a rich fixed set of block types (heading, paragraph, bulleted/numbered lists, quote, code, divider, spacer, table, key-value fields, image). Author drafts a document; the user edits inline — including editable tables, key-value fields, and uploaded images — then presses Save, which hands the WHOLE document (title, structured blocks, and a markdown rendering) back to the agent and switches to a clean view mode with Edit and Print buttons. Edits also stream a debounced `change`. No contentEditable, all text escaped, images validated; SSR-safe. Bind `value`, `title` with `{ $bindState }` so the agent (or a sibling control) can read the whole live document ({ title, blocks, markdown, blockCount }) and the document title from spec.state without waiting for Save.',
    example: {
      title: 'Q3 Project Brief',
      mode: 'edit',
      blocks: [
        { id: 'h1', type: 'heading', text: 'Executive summary', level: 2 },
        { id: 'p1', type: 'paragraph', text: 'Revenue grew 24% quarter-over-quarter, driven by the Platform tier.' },
        { id: 'f1', type: 'fields', fields: [{ label: 'Owner', value: 'Priya' }, { label: 'Status', value: 'On track' }] },
        { id: 'l1', type: 'bulleted', text: 'Ship the scheduler\nHarden the component library\nWrite the docs' },
        { id: 't1', type: 'table', columns: ['Product', 'Revenue', 'Growth'], rows: [['Platform', '£742k', '+31%'], ['API', '£389k', '+18%']] },
        { id: 'c1', type: 'code', text: 'npm run build && npm run test', lang: 'bash' },
      ],
    },
    events: ['commit', 'change', 'select'],
    eventsDoc: {
      commit: 'Save was pressed; params carry the WHOLE document { title, blocks, markdown, blockCount } so the agent receives the full edited content and can act on it.',
      change: 'The document was edited (debounced ~0.5s); params carry the live { title, blocks, markdown } so an agent can watch the draft as it changes. Only fires when emitOnChange !== false; the document is mirrored into the bindable `value` state regardless.',
      select: 'A block was focused or clicked; params carry { id, index, type } for opening or referencing that block.',
    },
  },
};
