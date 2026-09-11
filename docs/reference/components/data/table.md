# Table

Static data table: `columns` are the header labels and `rows` a 2D array of cell strings, e.g. [["Alice","admin"],["Bob","user"]]. Reach for it to present read-only tabular data — a stats grid, a comparison, a small records list — where each row's cell count matches the column count. Cells are plain strings with no per-cell rendering; for sortable columns, row selection, pagination, or editable cells use DataTable instead. `striped`/`hover`/`density` tune scannability, `columnAlign` right-aligns numeric columns, and `stickyHeader` pins the header on scroll.

## Example

```json
{
  "root": "table",
  "elements": {
    "table": {
      "type": "Table",
      "props": {
        "columns": [
          "Name",
          "Role"
        ],
        "rows": [
          [
            "Alice",
            "Admin"
          ],
          [
            "Bob",
            "User"
          ]
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `columns` | `string[]` | Header labels, one string per column, e.g. ["Name","Role","Status"]. The count should match each row’s cell count. |
| `rows` | `string[][]` | Cell data as a 2D array of strings — one inner array per row, cells in column order, e.g. [["Alice","Admin"],["Bob","User"]]. Strings only; for sorting/selection/pagination reach for DataTable instead. |
| `caption` | `string` | Accessible table caption rendered as a muted line below the table (colored by `mutedColor`). Use it to state what the data shows ("Q3 signups by region"). |
| `size` | `"sm" \| "md" \| "lg"` | Cell padding + font size (table density). `sm` for compact data tables. |
| `density` | `"comfortable" \| "compact"` | Row height: comfortable (default) · compact (tighter vertical padding). Orthogonal to `size`. |
| `striped` | `boolean` | Zebra-stripe alternate rows with a faint fill for easier row scanning (default false = plain rows). Turn it on for wide/dense tables where the eye can lose its row. |
| `bordered` | `"none" \| "rows" \| "grid"` | Cell border treatment: none · rows (horizontal dividers, default) · grid (full cell grid). |
| `hover` | `boolean` | Tint the row under the pointer on hover (default true). Set false for a static/print-style table or when rows are not row-clickable, so hover implies no affordance. |
| `align` | `"left" \| "center" \| "right"` | Text alignment for ALL header and body cells: left (default) · center · right. Applies table-wide; use `columnAlign` to override individual columns. |
| `columnAlign` | `("left" \| "center" \| "right")[]` | Per-column text alignment, parallel to `columns` (e.g. ["left","right","right"] to right-align two numeric columns). Missing/short entries fall back to the table-wide `align`. Use it to right-align numeric columns without shifting the whole table. |
| `stickyHeader` | `boolean` | Pin the header row when the table scrolls (position: sticky). |
| `headerTextColor` | `string` | Header text color (default the muted-foreground token). |
| `accent` | `string` | Border/divider color for cells (default border token). |
| `mutedColor` | `string` | Secondary/muted text colour — the caption below the table (default the muted-foreground token). |
