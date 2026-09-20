# DataTable

A full-fledged data table: sortable, selectable, client-paginated, with optional per-column drag-resize (`resizable`) and a frozen first column (`pinnedFirst`). Turn it into a CRUD grid with `editable` (per-row Edit → inline form over `editable` columns), `deletable` (per-row Delete), and `addable` (footer Add-row); selecting rows reveals a bulk-action bar (built-in bulk-delete + custom `bulkActions`). Bind sortBy/sortDir/page/selectedRows/rows with { $bindState } for two-way control, selectedRows holds the live selection, rows the live dataset after edits. Emits `sort`/`select`/`page` and `commit`/`dismiss` for CRUD; cells render as escaped text.

## Example

```json
{
  "root": "data-table",
  "elements": {
    "data-table": {
      "type": "DataTable",
      "props": {
        "columns": [
          {
            "key": "name",
            "label": "Name"
          },
          {
            "key": "role",
            "label": "Role",
            "type": "select",
            "options": [
              "Admin",
              "Member",
              "Viewer"
            ],
            "editable": true
          },
          {
            "key": "seats",
            "label": "Seats",
            "align": "end",
            "sortable": true,
            "type": "number",
            "editable": true
          }
        ],
        "rows": [
          {
            "name": "Acme",
            "role": "Admin",
            "seats": 12
          },
          {
            "name": "Globex",
            "role": "Member",
            "seats": 4
          }
        ],
        "selectable": true,
        "editable": true,
        "deletable": true,
        "addable": true,
        "bulkActions": [
          {
            "id": "archive",
            "label": "Archive",
            "tone": "neutral"
          }
        ],
        "pageSize": 10
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `columns` | `({ key: string, label: string, align: "start" \| "center" \| "end", sortable: boolean, editable: boolean, type: "text" \| "number" \| "select", options: string[], width: string \| number, format: "number" \| "currency" \| "percent" \| "date", prefix: string, suffix: string })[]` | Column definitions in display order, each maps a row key to a header label, alignment, sortability, a display `format`, and (for editable tables) an editor type. |
| `rows` | `(Record&lt;string, string \| number \| boolean>)[]` | Row records, each an object keyed by the columns’ `key` with string\|number cell values. A reserved boolean `locked: true` field marks THAT row end-user-immutable (no selection, no edit/delete), the per-row form of `lockExisting`; it is never rendered as a cell unless a column keys it. |
| `selectable` | `boolean` | Add a leading checkbox column with a header "select all" + per-row checkboxes. |
| `selectedRows` | `(Record&lt;string, string \| number \| boolean>)[]` | The currently-selected row records, the RESOLVED row objects, not indices. Interactive out of the box; bind with { $bindState } so an external Button (or the agent) can read exactly which rows are selected from spec.state, it is rewritten on every checkbox toggle and select-all. Also seeds the initial selection (matched by row content). |
| `rowActions` | `({ id: string, label: string, icon: string, variant: "ghost" \| "outline" \| "primary" \| "secondary" \| "danger", confirm: object \| boolean \| string, disabled: boolean })[]` | The per-row action buttons, as a LIST of action specs (the action-oriented model, supersedes the editable/deletable/actionIcons/editLabel/deleteLabel shorthands when set). Each { id, label?, icon?, variant?, confirm? }: id "edit" opens the inline row editor and id "delete" removes the row (built-ins); ANY OTHER id emits `commit` { action:id, index, row, rows } (a general custom row action). `icon` is a registry name OR an image URL (empty `label` + `icon` = an icon-only button). `variant` is the button COLOR (ghost/outline/primary/secondary/danger). `disabled` greys THIS action out, bind it to state so an action that has already fired cannot fire twice. `confirm` gates THIS action with the shared modal, { title?, message?, confirmLabel?, cancelLabel?, variant? }, so confirmation lives ON THE ACTION, e.g. the delete action carries its own confirm. |
| `bulkActions` | `({ id: string, label: string, tone: "neutral" \| "primary" \| "danger", confirm: object \| boolean \| string, disabled: boolean })[]` | Buttons shown in the bulk-action bar when rows are selected (needs `selectable`). Each { id, label, tone?, confirm?, disabled? }; clicking emits `commit` { action:id, selectedRows }, gated by its own `confirm` (same shape as rowActions). A built-in bulk-delete appears when a "delete" row action (or `deletable`) is present. |
| `editable` | `boolean` | Shorthand: add the built-in "edit" row action (opens the inline form editor over the columns marked `editable`). Superseded by `rowActions`. |
| `deletable` | `boolean` | Shorthand: add the built-in "delete" row action (removes the row → `dismiss` { action:"delete", index, row, rows }). Superseded by `rowActions` (put the confirm on the delete action instead). |
| `lockExisting` | `boolean` | The ADD-ONLY permission shape: every row supplied via props is end-user-immutable (no selection, no edit/delete row actions) while `addable` stays live, the ledger/roster pattern ("staff can add entries; posted rows are fixed"). Rows the user adds are never locked. UI-level enforcement only, the host still validates every intent. |
| `addable` | `boolean` | Show an "Add row" button (footer) that opens a blank editor row with its own Save/Cancel; saving appends it LOCALLY and emits `commit` { action:"add", row, rows }. The editor opens inputs for `editable` columns, or for EVERY column when none is flagged. This is THE app-like add-a-row shape: the row appears instantly, the agent receives it via commit (or via `add`, if you bind that verb instead). The Save/Cancel (and any row Edit/Delete) live in a trailing actions column that stays PINNED to the right edge, so they never scroll off-screen on a wide table. |
| `actionIcons` | `boolean` | Shorthand: render the auto-generated edit/delete row actions as ICON buttons (pencil/trash). Superseded by `rowActions` (set each action's `icon`). Default false. |
| `confirmDelete` | `boolean` | Shorthand: require a confirm modal before the auto-generated delete (row + bulk) removes data. Superseded by `rowActions`, put a `confirm` on the delete action. Default false. |
| `confirmDeleteText` | `string` | Shorthand: message for the delete-confirm modal when `confirmDelete` is on. Superseded by the delete action's `confirm.message`. |
| `editLabel` | `string` | Shorthand: text for the auto-generated Edit action (default "Edit"). Superseded by the edit `rowActions` entry's `label`. |
| `deleteLabel` | `string` | Shorthand: text for the auto-generated Delete action (default "Delete"). Superseded by the delete `rowActions` entry's `label`. |
| `addLabel` | `string` | Text for the footer Add-row button (default "Add row"). Escaped text. |
| `saveLabel` | `string` | Text for the row-editor Save button (default "Save"). Escaped text. |
| `cancelLabel` | `string` | Text for the row-editor Cancel button (default "Cancel"). Escaped text. |
| `resizable` | `boolean` | Allow per-column drag-resize via a header grip (drag the right edge of a header). Default off. |
| `pinnedFirst` | `boolean` | Freeze the first data column (sticky-left) while the body scrolls horizontally. |
| `sortBy` | `string` | Active sort column key. Use { $bindState } for two-way binding. |
| `sortDir` | `"asc" \| "desc" \| "none"` | Active sort direction. Use { $bindState } for two-way binding (asc→desc→none cycle). |
| `page` | `number` | Current 1-based page. Use { $bindState } for two-way binding. |
| `pageSize` | `number` | Rows per page (default 10). Controls the client-side slice + footer page count. |
| `filterText` | `string` | Live LOCAL row filter: case-insensitive substring match across every string/number cell, no agent round-trip. Bind it with { $state } to the SAME state path a FilterBar `searchValue` (or an Input) writes, and typing narrows the visible rows instantly. Empty/omitted → all rows. |
| `filterValues` | `Record&lt;string, any>` | Per-column LOCAL exact-match filters: column key → wanted value, e.g. {"sector":{"$state":"/sector"},"year":{"$state":"/yearFilter"}} with each entry bound to the state path a picklist (Select/SegmentedControl) writes via { $bindState }, choosing an option narrows the rows instantly, no agent round-trip. AND across keys; a cleared/empty entry filters nothing; applied before filterText. This is the screener/registry idiom: picklists + search over the same table, all local. |
| `filterRange` | `{ key: string, min: any, max: any }` | Bounded LOCAL row filter on one key: keeps rows where min <= row[key] <= max, live, no agent round-trip. Numbers compare numerically; ISO YYYY-MM-DD dates compare chronologically as strings. THE date-range idiom: give rows an ISO date field, bind min/max to the same state paths a DateRangePicker binds via startValue/endValue { $bindState }, picking dates narrows the table instantly. Composes with filterValues and filterText. |
| `striped` | `boolean` | Alternate row background tint for scan-ability on dense tables. |
| `bordered` | `boolean` | Draw full cell/row dividers plus an outer table frame (default false = header underline + soft row dividers only); set true for a dense gridlined table. |
| `hoverable` | `boolean` | Highlight the row under the cursor (default true). |
| `density` | `"compact" \| "normal" \| "comfortable"` | Row padding: compact (dense log/grid) · normal (default) · comfortable (roomy). |
| `size` | `"sm" \| "md" \| "lg"` | Cell font size, which drives row height with density (default md; sm=13px, md=14px, lg=16px). |
| `accent` | `string` | Dominant/active colour, and it paints on both sides of the ink/ground line: as a BACKGROUND it fills the selected-row tint (a 12% wash), the open add-row draft row, and the solid fill of any `primary` row or bulk action button plus the row-editor Save button (those labels are always the card token); as a TEXT COLOUR it paints the active sort header, label and glyph, and the selection checkboxes. Default the primary token. |
| `headerColor` | `string` | Header row background color (default muted token). |
| `borderColor` | `string` | Color of ALL the grid lines, the header underline and row dividers in every mode (dividers keep their soft 60% tint when not `bordered`), plus the outer frame + full cell dividers with `bordered`, the footer pager button borders, and the selection-checkbox outlines (default the border token). Works with or without `bordered`. |
| `borderWidthValue` | `string \| number` | Exact thickness of the OUTER table frame border, paired with `bordered` (e.g. "2px"; default 1px). Header underline + cell dividers stay hairline. |
| `mutedColor` | `string` | Secondary/muted text colour, the column-header labels, the empty "No rows" state, and the footer page count (default the muted-foreground token). |
| `maxHeight` | `string \| number` | Cap the body height + scroll it under a sticky header (e.g. "24rem"). Omit for a natural full-height table. |
| `emptyText` | `string` | Override the empty-state message shown when there are no rows (default "No rows to display."). Escaped text. |
| `prevLabel` | `string` | Previous-page button visible text + aria-label (defaults: text "Prev", aria-label "Previous page"). Escaped text, set for i18n. |
| `nextLabel` | `string` | Next-page button visible text + aria-label (defaults: text "Next", aria-label "Next page"). Escaped text, set for i18n. |
| `caption` | `string` | Table caption, names the table for assistive tech and prints below it. Use when the table is not already introduced by an adjacent heading; a screen reader otherwise meets an unnamed grid. |
| `ariaLabel` | `string` | Accessible name for the table when the name should NOT be visible (an adjacent heading already says it). Ignored when `caption` is set. |
| `pageLabel` | `string` | Footer page-count template (default "Page {current} of {total}"). The "{current}" and "{total}" placeholders are substituted; escaped text. |
| `prevIcon` | `string` | Glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) for the previous-page affordance (default "chevron-left"). Unknown/absent names keep the default chevron. Never raw SVG. |
| `nextIcon` | `string` | Glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) for the next-page affordance (default "chevron-right"). Unknown/absent names keep the default chevron. Never raw SVG. |

## Events

### page

A pager prev/next button was clicked (only rendered when there is more than one page); params carry { page } (the new 1-based page, clamped to range).

| Key | Type | Description |
| --- | --- | --- |
| `page` | `number` | The target page (1-based, clamped to range). |

### select

A row checkbox or the header "select all" was toggled (selectable only). A single toggle carries { id, index, checked, row, selected, selectedRows }: row is the resolved record toggled, selectedRows the FULL resolved selection (row objects, original order) so the agent needs no local rows array; "select all" carries { selected, selectedRows, all } where all=true when the page was turned on. selected stays the original-index id list; index is the toggled row’s original position. The same resolved selection is ALSO written to the bindable `selectedRows` prop (spec.state) on every toggle.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### sort

A sortable column header was clicked (asc→desc→none cycle); params carry { sortBy, sortDir } (sortBy is "" when the cycle returns to none).

| Key | Type | Description |
| --- | --- | --- |
| `sortBy` | `string` | The column key to sort by. |
| `sortDir` | `'asc' \| 'desc' \| 'none'` | The requested direction after this interaction. |

### commit

A row edit was saved (editable), a new row added (addable), or a custom bulk action fired. Params carry { action, rows } plus: edit → { index, row }; add → { row }; a bulk action → { selectedRows } with action set to the bulkActions[].id. `rows` is always the full current dataset after the change. To wire the two CRUD cases separately, bind `add` (a new row was added) and/or `update` (a row edit was saved) instead, each carries the same payload as the `commit` it replaces, and whichever you declare fires INSTEAD of `commit` for that one interaction, never as well.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### dismiss

A row was deleted (deletable) or the built-in bulk-delete fired. Params carry { action:"delete"|"bulkDelete", rows } plus delete → { index, row }; bulkDelete → { removed } (the deleted records). `rows` is the remaining dataset.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

### add

Component-specific verb, accepted on `DataTable` in addition to the canonical set, so it never appears in `events[]`. Bind `on.add` to receive this interaction on its own; when it is not bound, the same interaction is reported through `commit`.

A new row was saved from the footer Add-row editor (`addable`). Params carry { action:"add", row, rows }, the same payload `commit` reports for this interaction.

### update

Component-specific verb, accepted on `DataTable` in addition to the canonical set, so it never appears in `events[]`. Bind `on.update` to receive this interaction on its own; when it is not bound, the same interaction is reported through `commit`.

An inline row edit was saved (`editable`). Params carry { action:"edit", index, row, rows }, the same payload `commit` reports for this interaction.

See [Events](../../events.md) for the full payload contract.
