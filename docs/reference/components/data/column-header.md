# ColumnHeader

Standalone sortable/resizable column header cell for composing custom table heads. Bind on.sort for the toggle; the resize grip is a visual-only affordance. Bind `sortDir` with { $bindState } so the agent (or a sibling control) can read the live sort direction (asc/desc/none) from spec.state.

## Example

```json
{
  "root": "column-header",
  "elements": {
    "column-header": {
      "type": "ColumnHeader",
      "props": {
        "label": "Revenue",
        "align": "end",
        "sortable": true,
        "sortDir": "desc"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The column header text shown in the cell and used as the sort identity emitted in `sort` events. Keep to 1-3 words, e.g. "Revenue". |
| `align` | `"start" \| "center" \| "end"` | Header content alignment (default start; use end for numeric columns). |
| `sortable` | `boolean` | Render a sort toggle button (asc→desc→none) with an aria-sort glyph. |
| `sortDir` | `"asc" \| "desc" \| "none"` | Current sort state shown by the glyph: asc (chevron-up) · desc (chevron-down) · none (neutral up/down). Seeds and holds the live sort direction, bind with { $bindState } for two-way state an external Button can read. |
| `resizable` | `boolean` | Show a thin resize grip on the right edge (a render-only affordance, no real drag). |
| `width` | `string \| number` | Fixed column width (e.g. "12rem"). Omit for natural width. |
| `accent` | `string` | Active-sort colour, sets the TEXT COLOUR of the whole sort button (label + glyph) while a sort is active, and paints the resize grip when `resizable` (unset → the resting header label colour + a border-token grip). |
| `headerColor` | `string` | Header cell background color (default muted token). |
| `mutedColor` | `string` | Secondary/muted text colour, the resting header label text (default the muted-foreground token). |
| `borderColor` | `string` | Bottom-underline border color of the header cell, paired with `borderWidthValue` (mirrors DataTable’s header underline), and the resting resize-grip colour when `accent` is unset. The underline only draws when borderColor or borderWidthValue is set; default is no underline. Set to draw a tinted divider under a hand-built head. |
| `borderWidthValue` | `string \| number` | Exact thickness of the header cell’s bottom underline, paired with `borderColor` (e.g. "2px"; default 1px when borderColor is set). The underline only draws when borderColor or borderWidthValue is set. |

## Events

### sort

The header was clicked to cycle its sort state (asc→desc→none), tracked locally; params carry { sortBy, sortDir } (sortBy is the `label` prop).

| Key | Type | Description |
| --- | --- | --- |
| `sortBy` | `string` | The column key to sort by. |
| `sortDir` | `'asc' \| 'desc' \| 'none'` | The requested direction after this interaction. |

See [Events](../../events.md) for the full payload contract.
