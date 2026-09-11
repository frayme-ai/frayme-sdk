# EditableSpreadsheetGrid

A bounded, editable data grid: header-labelled columns and rows where you edit one cell at a time (click or Tab/Enter, type, commit on blur/Enter), with optional row headers, zebra striping, a sticky header, add-row and Save. Not a formula spreadsheet. Owns the cell matrix in state and emits a fully-populated intent on every edit. Escaped text; SSR-safe; capped at 200×40. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the live cell matrix (mirrored on every committed edit and Save) from spec.state.

## Example

```json
{
  "root": "editable-spreadsheet-grid",
  "elements": {
    "editable-spreadsheet-grid": {
      "type": "EditableSpreadsheetGrid",
      "props": {
        "columns": [
          {
            "key": "item",
            "label": "Line item"
          },
          {
            "key": "qty",
            "label": "Qty",
            "type": "number",
            "align": "right"
          },
          {
            "key": "price",
            "label": "Unit £",
            "type": "number",
            "align": "right"
          },
          {
            "key": "status",
            "label": "Status",
            "type": "select",
            "options": [
              "Draft",
              "Approved",
              "Paid"
            ]
          }
        ],
        "rows": [
          {
            "item": "Design retainer",
            "qty": 1,
            "price": 4200,
            "status": "Approved"
          },
          {
            "item": "API credits",
            "qty": 12,
            "price": 99,
            "status": "Paid"
          },
          {
            "item": "Support hours",
            "qty": 8,
            "price": 120,
            "status": "Draft"
          }
        ],
        "stickyHeader": true,
        "allowAddRow": true,
        "showSave": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `columns` | `({ key: string, label: string, type: "text" \| "number" \| "select", readonly: boolean, align: "left" \| "center" \| "right", options: string[] })[]` | Column definitions { key, label?, type?(text\|number\|select), readonly?, align?, options?(for select) }. Omit for a demo grid. |
| `rows` | `((string \| number \| boolean \| null)[] \| Record&lt;string, string \| number \| boolean \| null>)[]` | Row data: an array of cell arrays (aligned to columns) OR objects keyed by column.key. Omit for a demo. Capped at 200 rows. |
| `value` | `((string \| number \| boolean \| null)[])[]` | Bindable live cell matrix (array of cell-arrays, aligned to columns). Bind this to spec.state so an external Button can read the currently edited grid; it is mirrored on every committed cell edit and Save. Omit unless you need the external-read path. |
| `editable` | `boolean` | Allow cell editing (default true). Set false for a read-only grid (clicking a cell still emits select). |
| `lockedRows` | `number[]` | 0-based indices of rows the end user cannot edit (every cell read-only) while the rest of the grid stays editable — template/formula/total rows in a budget or timesheet ("the totals row is calculated; leave it"). Columns have their own per-column `readonly`. UI-level enforcement only — the host still validates. |
| `showRowHeaders` | `boolean` | Show a leading row-header column labelling each row (default `false`); turn on for named rows or when `rowLabels` is supplied. |
| `rowLabels` | `string[]` | Text for the row-header column, one per row (default the row number `1..n`); requires `showRowHeaders` to be visible. |
| `zebra` | `boolean` | Tint alternate rows with a subtle stripe for readability (default true). |
| `stickyHeader` | `boolean` | Keep the header row visible while the body scrolls (default true). |
| `allowAddRow` | `boolean` | Show an "+ Add row" affordance that appends a blank row and emits `commit` (default `false`); enable for growable sheets. |
| `showSave` | `boolean` | Show a Save button that emits the accumulated changes (default false). |
| `saveLabel` | `string` | Text shown on the Save button when `showSave` is on (default "Save"); set to phrase the action, e.g. "Update budget". |
| `emptyLabel` | `string` | Message when there are no rows (default "No rows yet"). |
| `rowHeight` | `number` | Height of every body row in px (default `36`, clamped `24..80`); raise for denser touch targets or taller cell content. |
| `accent` | `string` | Accent color of the focused/editing cell ring (default the primary token). |
| `headerTextColor` | `string` | Header text color (default the muted-foreground token). |
| `gridColor` | `string` | Color of the cell grid lines (default the `border` token); set a token or hex to tune the grid weight against the sheet background. |

## Events

### change

A cell was edited and committed; params carry { name: columnKey, value, rowIndex, columnIndex, previous }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

Save was pressed OR a row was added. On save: { reason: "save", rowCount, changes: [{ rowIndex, columnIndex, columnKey, value }] for every dirty cell, rows: the full current cell matrix }. On add-row: { reason: "addRow", at: insert index, rowCount, columnKeys, row: a blank cell array }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### select

A cell was focused/clicked; params carry { value, label, id: columnKey, rowIndex, columnIndex }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
