/**
 * Frayme EditableSpreadsheetGrid — a bounded, header-labelled data grid you can EDIT
 * one cell at a time (Editable-grid). Click/Tab/Enter a cell → type → commit on
 * blur/Enter. For small structured datasets (budgets, config sheets). NOT a formula
 * spreadsheet — no formulas, no cross-cell references, no multi-cell selection.
 *
 * POSTURE: OWNS-THE-SET editable via the shared useGridEditState engine — seeds the
 * cell matrix from static props, mutates locally, emits a fully-populated intent.
 * Emits are in handlers (never inside a setState updater).
 *
 * SECURITY: cell values render as ESCAPED text (display) / <input value> (edit);
 * colors via colorSchema→safeColor; grid capped at 200 rows × 40 cols / 4000 cells.
 *
 * Component: EditableSpreadsheetGrid.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const editableSpreadsheetGridComponents = {
  EditableSpreadsheetGrid: {
    props: z.object({
      columns: z
        .array(
          z.object({
            key: z.string(),
            label: z.string().nullable(),
            type: z.enum(['text', 'number', 'select']).nullable(),
            readonly: z.boolean().nullable(),
            align: z.enum(['left', 'center', 'right']).nullable(),
            options: z.array(z.string()).nullable(),
          }),
        )
        .nullable()
        .describe('Column definitions { key, label?, type?(text|number|select), readonly?, align?, options?(for select) }. Omit for a demo grid.'),
      rows: z.array(z.union([z.array(cell), z.record(z.string(), cell)])).nullable().describe('Row data: an array of cell arrays (aligned to columns) OR objects keyed by column.key. Omit for a demo. Capped at 200 rows.'),
      value: z.array(z.array(cell)).nullable().describe('Bindable live cell matrix (array of cell-arrays, aligned to columns). Bind this to spec.state so an external Button can read the currently edited grid; it is mirrored on every committed cell edit and Save. Omit unless you need the external-read path.'),
      editable: z.boolean().nullable().describe('Allow cell editing (default true). Set false for a read-only grid (clicking a cell still emits select).'),
      lockedRows: z
        .array(z.number())
        .nullable()
        .describe('0-based indices of rows the end user cannot edit (every cell read-only) while the rest of the grid stays editable — template/formula/total rows in a budget or timesheet ("the totals row is calculated; leave it"). Columns have their own per-column `readonly`. UI-level enforcement only — the host still validates.'),
      showRowHeaders: z.boolean().nullable().describe('Show a leading row-header column labelling each row (default `false`); turn on for named rows or when `rowLabels` is supplied.'),
      rowLabels: z.array(z.string()).nullable().describe('Text for the row-header column, one per row (default the row number `1..n`); requires `showRowHeaders` to be visible.'),
      zebra: z.boolean().nullable().describe('Tint alternate rows with a subtle stripe for readability (default true).'),
      stickyHeader: z.boolean().nullable().describe('Keep the header row visible while the body scrolls (default true).'),
      allowAddRow: z.boolean().nullable().describe('Show an "+ Add row" affordance that appends a blank row and emits `commit` (default `false`); enable for growable sheets.'),
      showSave: z.boolean().nullable().describe('Show a Save button that emits the accumulated changes (default false).'),
      saveLabel: z.string().nullable().describe('Text shown on the Save button when `showSave` is on (default "Save"); set to phrase the action, e.g. "Update budget".'),
      emptyLabel: z.string().nullable().describe('Message when there are no rows (default "No rows yet").'),
      rowHeight: z.number().nullable().describe('Height of every body row in px (default `36`, clamped `24..80`); raise for denser touch targets or taller cell content.'),
      accent: colorSchema.describe('Accent color of the focused/editing cell ring (default the primary token).'),
      /* RENAMED. `headerColor` meant the header TEXT here and the header BACKGROUND on
         DataTable/ColumnHeader — one name, two opposite results. The majority sense
         (background) keeps the short name; this text sense moves to an explicit one.
         NO ALIAS: an alias would keep BOTH senses alive under the old name, which is
         the exact ambiguity this rename removes — the model would still see
         headerColor meaning two things. */
      headerTextColor: colorSchema.describe('Header text color (default the muted-foreground token).'),
      gridColor: colorSchema.describe('Color of the cell grid lines (default the `border` token); set a token or hex to tune the grid weight against the sheet background.'),
    }),
    description:
      'A bounded, editable data grid: header-labelled columns and rows where you edit one cell at a time (click or Tab/Enter, type, commit on blur/Enter), with optional row headers, zebra striping, a sticky header, add-row and Save. Not a formula spreadsheet. Owns the cell matrix in state and emits a fully-populated intent on every edit. Escaped text; SSR-safe; capped at 200×40. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the live cell matrix (mirrored on every committed edit and Save) from spec.state.',
    example: {
      columns: [
        { key: 'item', label: 'Line item' },
        { key: 'qty', label: 'Qty', type: 'number', align: 'right' },
        { key: 'price', label: 'Unit £', type: 'number', align: 'right' },
        { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Approved', 'Paid'] },
      ],
      rows: [
        { item: 'Design retainer', qty: 1, price: 4200, status: 'Approved' },
        { item: 'API credits', qty: 12, price: 99, status: 'Paid' },
        { item: 'Support hours', qty: 8, price: 120, status: 'Draft' },
      ],
      stickyHeader: true,
      allowAddRow: true,
      showSave: true,
    },
    events: ['change', 'commit', 'select'],
    eventsDoc: {
      change: 'A cell was edited and committed; params carry { name: columnKey, value, rowIndex, columnIndex, previous }.',
      commit: 'Save was pressed OR a row was added. On save: { reason: "save", rowCount, changes: [{ rowIndex, columnIndex, columnKey, value }] for every dirty cell, rows: the full current cell matrix }. On add-row: { reason: "addRow", at: insert index, rowCount, columnKeys, row: a blank cell array }.',
      select: 'A cell was focused/clicked; params carry { value, label, id: columnKey, rowIndex, columnIndex }.',
    },
  },
};
