/**
 * Frayme data-table — the sortable / selectable / paginated table + its
 * standalone column head, built on the established "truly-dynamic" foundation
 * (matches forms-extended.ts / data-display-extended.ts byte-for-byte in style).
 *
 * Two components:
 *  - DataTable — a full semantic <table>: sortable column heads, an optional
 *    leading checkbox column, client-side pagination, and the value channels for
 *    the selected-row tint (accent), the header background (headerColor), and a
 *    scroll cap with a sticky header (maxHeight).
 *  - ColumnHeader — a standalone sortable/resizable header cell that composes
 *    into a hand-built table head.
 *
 * Channel legend (mirrors _shared.ts): E enum · C content · SC safeColor (VALUE)
 * · D dimension (VALUE). Every enum/value prop is `.nullable()` + `.describe()`
 * (one sentence naming WHEN to reach for it);
 * defaults live in the renderer's CVA `defaultVariants`, NOT here, so a
 * props-less spec still renders polished. Closed enums only — never z.string()
 * for a visual/behavioral selector. `page`/`pageSize` are PLAIN numeric bounds
 * (not value channels), so they stay `z.number()`.
 */

import { z } from 'zod';
import { actionConfirm, colorSchema, dimensionSchema } from './_shared.js';

// The per-action confirm shape moved to _shared.ts — Kanban cards now declare
// the same `rowActions` contract, and one shape cannot drift from itself.

export const dataTableComponents = {
  // =========================================================================
  // DataTable — a sortable, selectable, client-paginated data table.
  // =========================================================================
  DataTable: {
    props: z.object({
      // Required content: the column definitions (per-column `width` here is a
      // nested STRING, NOT a top-level dimension channel — it is not gate-validated).
      columns: z
        .array(
          z.object({
            key: z.string().describe('The row-object key this column reads.'),
            label: z.string().describe('The column header text.'),
            align: z
              .enum(['start', 'center', 'end'])
              .nullable()
              .describe('Cell + header text alignment (default start; use end for numeric columns).'),
            sortable: z.boolean().nullable().describe('Make this column header a sort toggle (asc→desc→none).'),
            editable: z.boolean().nullable().describe('Allow this cell to be edited in the row editor (needs the table-level `editable`). Non-editable columns show read-only in the editor.'),
            type: z.enum(['text', 'number', 'select']).nullable().describe('Editor input type for this column when editing a row: text (default), number, or select (uses `options`).'),
            options: z.array(z.string()).nullable().describe('Choices for a `type:"select"` editable column (a dropdown in the row editor).'),
            width: dimensionSchema({ units: ['px', 'rem'], max: 800 }).describe('Optional fixed column width (e.g. "8rem"); the user can drag-resize from here when `resizable`.'),
            format: z
              .enum(['number', 'currency', 'percent', 'date'])
              .nullable()
              .describe('How this column DISPLAYS its values — number (1,234,567) · currency (£210,000; set `prefix` for another symbol) · percent (12.5%) · date (an ISO "2026-08-07" prints as "7 Aug 2026"). Rows keep the RAW value, so the column still sorts numerically/chronologically and edits as a number. Reach for it on every money, count and date column: a bare 210000 under an "Amount (£)" header is the unformatted odd one out on an otherwise polished screen.'),
            prefix: z.string().nullable().describe('Text placed before each formatted value (e.g. "$", "€", "~"). With format:"currency" it replaces the default £.'),
            suffix: z.string().nullable().describe('Text placed after each formatted value (e.g. " kg", " days").'),
          }),
        )
        .describe('Column definitions in display order — each maps a row key to a header label, alignment, sortability, a display `format`, and (for editable tables) an editor type.'),
      // Required content: the row records, keyed by column.key (string|number cells).
      rows: z
        .array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])))
        .describe('Row records, each an object keyed by the columns’ `key` with string|number cell values. A reserved boolean `locked: true` field marks THAT row end-user-immutable (no selection, no edit/delete) — the per-row form of `lockExisting`; it is never rendered as a cell unless a column keys it.'),
      selectable: z.boolean().nullable().describe('Add a leading checkbox column with a header "select all" + per-row checkboxes.'),
      selectedRows: z
        .array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])))
        .nullable()
        .describe('The currently-selected row records — the RESOLVED row objects, not indices. Interactive out of the box; bind with { $bindState } so an external Button (or the agent) can read exactly which rows are selected from spec.state — it is rewritten on every checkbox toggle and select-all. Also seeds the initial selection (matched by row content).'),
      // ── CRUD — per-action config (the action-oriented model) ─────────────────
      rowActions: z
        .array(
          z.object({
            id: z.string(),
            label: z.string().nullable(),
            icon: z.string().nullable(),
            variant: z.enum(['ghost', 'outline', 'primary', 'secondary', 'danger']).nullable(),
            confirm: actionConfirm.nullable(),
            disabled: z.boolean().nullable(),
          }),
        )
        .nullable()
        .describe('The per-row action buttons, as a LIST of action specs (the action-oriented model — supersedes the editable/deletable/actionIcons/editLabel/deleteLabel shorthands when set). Each { id, label?, icon?, variant?, confirm? }: id "edit" opens the inline row editor and id "delete" removes the row (built-ins); ANY OTHER id emits `commit` { action:id, index, row, rows } (a general custom row action). `icon` is a registry name OR an image URL (empty `label` + `icon` = an icon-only button). `variant` is the button COLOR (ghost/outline/primary/secondary/danger). `disabled` greys THIS action out — bind it to state so an action that has already fired cannot fire twice. `confirm` gates THIS action with the shared modal — { title?, message?, confirmLabel?, cancelLabel?, variant? } — so confirmation lives ON THE ACTION, e.g. the delete action carries its own confirm.'),
      bulkActions: z
        .array(z.object({ id: z.string(), label: z.string(), tone: z.enum(['neutral', 'primary', 'danger']).nullable(), confirm: actionConfirm.nullable(), disabled: z.boolean().nullable() }))
        .nullable()
        .describe('Buttons shown in the bulk-action bar when rows are selected (needs `selectable`). Each { id, label, tone?, confirm?, disabled? }; clicking emits `commit` { action:id, selectedRows }, gated by its own `confirm` (same shape as rowActions). A built-in bulk-delete appears when a "delete" row action (or `deletable`) is present.'),
      // Shorthands (SUPERSEDED by `rowActions` — a convenience for the simple case;
      // when rowActions is set these are ignored). editable/deletable auto-generate
      // the edit/delete row actions; confirmDelete moves onto that delete action.
      editable: z.boolean().nullable().describe('Shorthand: add the built-in "edit" row action (opens the inline form editor over the columns marked `editable`). Superseded by `rowActions`.'),
      deletable: z.boolean().nullable().describe('Shorthand: add the built-in "delete" row action (removes the row → `dismiss` { action:"delete", index, row, rows }). Superseded by `rowActions` (put the confirm on the delete action instead).'),
      lockExisting: z
        .boolean()
        .nullable()
        .describe('The ADD-ONLY permission shape: every row supplied via props is end-user-immutable (no selection, no edit/delete row actions) while `addable` stays live — the ledger/roster pattern ("staff can add entries; posted rows are fixed"). Rows the user adds are never locked. UI-level enforcement only — the host still validates every intent.'),
      addable: z.boolean().nullable().describe('Show an "Add row" button (footer) that opens a blank editor row with its own Save/Cancel; saving appends it LOCALLY and emits `commit` { action:"add", row, rows }. The editor opens inputs for `editable` columns — or for EVERY column when none is flagged. This is THE app-like add-a-row shape: the row appears instantly, the agent receives it via commit (or via `add`, if you bind that verb instead). The Save/Cancel (and any row Edit/Delete) live in a trailing actions column that stays PINNED to the right edge, so they never scroll off-screen on a wide table.'),
      actionIcons: z.boolean().nullable().describe('Shorthand: render the auto-generated edit/delete row actions as ICON buttons (pencil/trash). Superseded by `rowActions` (set each action\'s `icon`). Default false.'),
      confirmDelete: z.boolean().nullable().describe('Shorthand: require a confirm modal before the auto-generated delete (row + bulk) removes data. Superseded by `rowActions` — put a `confirm` on the delete action. Default false.'),
      confirmDeleteText: z.string().nullable().describe('Shorthand: message for the delete-confirm modal when `confirmDelete` is on. Superseded by the delete action\'s `confirm.message`.'),
      editLabel: z.string().nullable().describe('Shorthand: text for the auto-generated Edit action (default "Edit"). Superseded by the edit `rowActions` entry\'s `label`.'),
      deleteLabel: z.string().nullable().describe('Shorthand: text for the auto-generated Delete action (default "Delete"). Superseded by the delete `rowActions` entry\'s `label`.'),
      addLabel: z.string().nullable().describe('Text for the footer Add-row button (default "Add row"). Escaped text.'),
      saveLabel: z.string().nullable().describe('Text for the row-editor Save button (default "Save"). Escaped text.'),
      cancelLabel: z.string().nullable().describe('Text for the row-editor Cancel button (default "Cancel"). Escaped text.'),
      // ── folded from DataGrid ────────────────────────────────────────────────
      resizable: z.boolean().nullable().describe('Allow per-column drag-resize via a header grip (drag the right edge of a header). Default off.'),
      pinnedFirst: z.boolean().nullable().describe('Freeze the first data column (sticky-left) while the body scrolls horizontally.'),
      sortBy: z.string().nullable().describe('Active sort column key. Use { $bindState } for two-way binding.'),
      sortDir: z
        .enum(['asc', 'desc', 'none'])
        .nullable()
        .describe('Active sort direction. Use { $bindState } for two-way binding (asc→desc→none cycle).'),
      page: z.number().nullable().describe('Current 1-based page. Use { $bindState } for two-way binding.'),
      pageSize: z.number().nullable().describe('Rows per page (default 10). Controls the client-side slice + footer page count.'),
      filterText: z
        .string()
        .nullable()
        .describe('Live LOCAL row filter: case-insensitive substring match across every string/number cell — no agent round-trip. Bind it with { $state } to the SAME state path a FilterBar `searchValue` (or an Input) writes, and typing narrows the visible rows instantly. Empty/omitted → all rows.'),
      filterValues: z
        .record(z.string(), z.unknown())
        .nullable()
        .describe('Per-column LOCAL exact-match filters: column key → wanted value, e.g. {"sector":{"$state":"/sector"},"year":{"$state":"/yearFilter"}} with each entry bound to the state path a picklist (Select/SegmentedControl) writes via { $bindState } — choosing an option narrows the rows instantly, no agent round-trip. AND across keys; a cleared/empty entry filters nothing; applied before filterText. This is the screener/registry idiom: picklists + search over the same table, all local.'),
      filterRange: z
        .object({
          key: z.string().describe('The row field to bound on — may be a non-displayed field (e.g. an ISO "date" alongside a pretty "Date" column).'),
          min: z.unknown().nullable().describe('Lower bound (inclusive). Bind with { $state } to the path a DateRangePicker startValue or a NumberInput writes; empty = open-ended.'),
          max: z.unknown().nullable().describe('Upper bound (inclusive). Bind like min; empty = open-ended.'),
        })
        .nullable()
        .describe('Bounded LOCAL row filter on one key: keeps rows where min <= row[key] <= max, live, no agent round-trip. Numbers compare numerically; ISO YYYY-MM-DD dates compare chronologically as strings. THE date-range idiom: give rows an ISO date field, bind min/max to the same state paths a DateRangePicker binds via startValue/endValue { $bindState } — picking dates narrows the table instantly. Composes with filterValues and filterText.'),
      striped: z.boolean().nullable().describe('Alternate row background tint for scan-ability on dense tables.'),
      bordered: z.boolean().nullable().describe('Draw full cell/row dividers plus an outer table frame (default false = header underline + soft row dividers only); set true for a dense gridlined table.'),
      hoverable: z.boolean().nullable().describe('Highlight the row under the cursor (default true).'),
      density: z
        .enum(['compact', 'normal', 'comfortable'])
        .nullable()
        .describe('Row padding: compact (dense log/grid) · normal (default) · comfortable (roomy).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Cell font size, which drives row height with density (default md; sm=13px, md=14px, lg=16px).'),
      accent: colorSchema.describe('Dominant/active colour, and it paints on both sides of the ink/ground line: as a BACKGROUND it fills the selected-row tint (a 12% wash), the open add-row draft row, and the solid fill of any `primary` row or bulk action button plus the row-editor Save button (those labels are always the card token); as a TEXT COLOUR it paints the active sort header — label and glyph — and the selection checkboxes. Default the primary token.'),
      headerColor: colorSchema.describe('Header row background color (default muted token).'),
      borderColor: colorSchema.describe('Color of ALL the grid lines — the header underline and row dividers in every mode (dividers keep their soft 60% tint when not `bordered`), plus the outer frame + full cell dividers with `bordered`, the footer pager button borders, and the selection-checkbox outlines (default the border token). Works with or without `bordered`.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact thickness of the OUTER table frame border, paired with `bordered` (e.g. "2px"; default 1px). Header underline + cell dividers stay hairline.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the column-header labels, the empty "No rows" state, and the footer page count (default the muted-foreground token).'),
      maxHeight: dimensionSchema({ units: ['px', 'rem'], max: 1200 }).describe('Cap the body height + scroll it under a sticky header (e.g. "24rem"). Omit for a natural full-height table.'),
      // CONTENT / i18n — frozen English strings, each defaulting to the current literal.
      emptyText: z.string().nullable().describe('Override the empty-state message shown when there are no rows (default "No rows to display."). Escaped text.'),
      prevLabel: z.string().nullable().describe('Previous-page button visible text + aria-label (defaults: text "Prev", aria-label "Previous page"). Escaped text — set for i18n.'),
      nextLabel: z.string().nullable().describe('Next-page button visible text + aria-label (defaults: text "Next", aria-label "Next page"). Escaped text — set for i18n.'),
      caption: z
        .string()
        .nullable()
        .describe('Table caption — names the table for assistive tech and prints below it. Use when the table is not already introduced by an adjacent heading; a screen reader otherwise meets an unnamed grid.'),
      ariaLabel: z
        .string()
        .nullable()
        .describe('Accessible name for the table when the name should NOT be visible (an adjacent heading already says it). Ignored when `caption` is set.'),
      pageLabel: z.string().nullable().describe('Footer page-count template (default "Page {current} of {total}"). The "{current}" and "{total}" placeholders are substituted; escaped text.'),
      prevIcon: z.string().nullable().describe('Glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) for the previous-page affordance (default "chevron-left"). Unknown/absent names keep the default chevron. Never raw SVG.'),
      nextIcon: z.string().nullable().describe('Glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) for the next-page affordance (default "chevron-right"). Unknown/absent names keep the default chevron. Never raw SVG.'),
    }),
    events: ['page', 'select', 'sort', 'commit', 'dismiss'],
    eventsDoc: {
      page: 'A pager prev/next button was clicked (only rendered when there is more than one page); params carry { page } (the new 1-based page, clamped to range).',
      select: 'A row checkbox or the header "select all" was toggled (selectable only). A single toggle carries { id, index, checked, row, selected, selectedRows }: row is the resolved record toggled, selectedRows the FULL resolved selection (row objects, original order) so the agent needs no local rows array; "select all" carries { selected, selectedRows, all } where all=true when the page was turned on. selected stays the original-index id list; index is the toggled row’s original position. The same resolved selection is ALSO written to the bindable `selectedRows` prop (spec.state) on every toggle.',
      sort: 'A sortable column header was clicked (asc→desc→none cycle); params carry { sortBy, sortDir } (sortBy is "" when the cycle returns to none).',
      commit: 'A row edit was saved (editable), a new row added (addable), or a custom bulk action fired. Params carry { action, rows } plus: edit → { index, row }; add → { row }; a bulk action → { selectedRows } with action set to the bulkActions[].id. `rows` is always the full current dataset after the change. To wire the two CRUD cases separately, bind `add` (a new row was added) and/or `update` (a row edit was saved) instead — each carries the same payload as the `commit` it replaces, and whichever you declare fires INSTEAD of `commit` for that one interaction, never as well.',
      dismiss: 'A row was deleted (deletable) or the built-in bulk-delete fired. Params carry { action:"delete"|"bulkDelete", rows } plus delete → { index, row }; bulkDelete → { removed } (the deleted records). `rows` is the remaining dataset.',
    },
    description:
      'A full-fledged data table: sortable, selectable, client-paginated, with optional per-column drag-resize (`resizable`) and a frozen first column (`pinnedFirst`). Turn it into a CRUD grid with `editable` (per-row Edit → inline form over `editable` columns), `deletable` (per-row Delete), and `addable` (footer Add-row); selecting rows reveals a bulk-action bar (built-in bulk-delete + custom `bulkActions`). Bind sortBy/sortDir/page/selectedRows/rows with { $bindState } for two-way control — selectedRows holds the live selection, rows the live dataset after edits. Emits `sort`/`select`/`page` and `commit`/`dismiss` for CRUD; cells render as escaped text.',
    example: {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role', type: 'select', options: ['Admin', 'Member', 'Viewer'], editable: true },
        { key: 'seats', label: 'Seats', align: 'end', sortable: true, type: 'number', editable: true },
      ],
      rows: [
        { name: 'Acme', role: 'Admin', seats: 12 },
        { name: 'Globex', role: 'Member', seats: 4 },
      ],
      selectable: true,
      editable: true,
      deletable: true,
      addable: true,
      bulkActions: [{ id: 'archive', label: 'Archive', tone: 'neutral' }],
      pageSize: 10,
    },
  },

  // =========================================================================
  // ColumnHeader — a standalone sortable/resizable column header cell that
  // composes into a hand-built table head.
  // =========================================================================
  ColumnHeader: {
    props: z.object({
      label: z.string().describe('The column header text shown in the cell and used as the sort identity emitted in `sort` events. Keep to 1-3 words, e.g. "Revenue".'),
      align: z
        .enum(['start', 'center', 'end'])
        .nullable()
        .describe('Header content alignment (default start; use end for numeric columns).'),
      sortable: z.boolean().nullable().describe('Render a sort toggle button (asc→desc→none) with an aria-sort glyph.'),
      sortDir: z
        .enum(['asc', 'desc', 'none'])
        .nullable()
        .describe('Current sort state shown by the glyph: asc (chevron-up) · desc (chevron-down) · none (neutral up/down). Seeds and holds the live sort direction — bind with { $bindState } for two-way state an external Button can read.'),
      resizable: z.boolean().nullable().describe('Show a thin resize grip on the right edge (a render-only affordance — no real drag).'),
      width: dimensionSchema({ units: ['px', 'rem'], max: 800 }).describe('Fixed column width (e.g. "12rem"). Omit for natural width.'),
      accent: colorSchema.describe('Active-sort colour — sets the TEXT COLOUR of the whole sort button (label + glyph) while a sort is active, and paints the resize grip when `resizable` (unset → the resting header label colour + a border-token grip).'),
      headerColor: colorSchema.describe('Header cell background color (default muted token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the resting header label text (default the muted-foreground token).'),
      borderColor: colorSchema.describe('Bottom-underline border color of the header cell, paired with `borderWidthValue` (mirrors DataTable’s header underline), and the resting resize-grip colour when `accent` is unset. The underline only draws when borderColor or borderWidthValue is set; default is no underline. Set to draw a tinted divider under a hand-built head.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact thickness of the header cell’s bottom underline, paired with `borderColor` (e.g. "2px"; default 1px when borderColor is set). The underline only draws when borderColor or borderWidthValue is set.'),
    }),
    events: ['sort'],
    eventsDoc: { sort: 'The header was clicked to cycle its sort state (asc→desc→none), tracked locally; params carry { sortBy, sortDir } (sortBy is the `label` prop).' },
    description:
      'Standalone sortable/resizable column header cell for composing custom table heads. Bind on.sort for the toggle; the resize grip is a visual-only affordance. Bind `sortDir` with { $bindState } so the agent (or a sibling control) can read the live sort direction (asc/desc/none) from spec.state.',
    example: { label: 'Revenue', align: 'end', sortable: true, sortDir: 'desc' },
  },
};
