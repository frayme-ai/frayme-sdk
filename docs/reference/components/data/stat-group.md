# StatGroup

A responsive grid wrapper around several Stat tiles (children). Lays KPIs out in a row/grid with an optional divider between them. Put Stat components inside; use `columns` to fix the column count.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "stat-group",
  "elements": {
    "stat-group": {
      "type": "StatGroup",
      "props": {
        "columns": 3,
        "divided": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `columns` | `string \| number` | Number of tile columns (1-6, default responsive). The grid wraps the child Stat tiles. |
| `divided` | `boolean` | Draw thin dividers between the tiles (a segmented stat strip). Default false. Mutually exclusive with `bordered`, pick dividers OR cards, not both. |
| `bordered` | `boolean` | Wrap each tile in its own rounded card (a hairline border + padding), the individual-card dashboard look. Default false, tiles sit borderless in the grid. Best paired with rich `layout:"split"` Stat tiles; ignored when `divided` is on. |
| `align` | `"start" \| "center" \| "end"` | Alignment of each tile within its cell: start (default) · center (centered figures) · end (right-aligned figures, e.g. a numbers strip). |
| `gap` | `"sm" \| "md" \| "lg"` | Spacing between tiles (default md). Ignored visually when `divided` supplies the separators. |
| `borderColor` | `string` | Colour of the hairline rules StatGroup draws around its tiles, the dividers between tiles when `divided` is on, and each tile’s own card border when `bordered` is on (default the border token). Inert when neither is set. |
