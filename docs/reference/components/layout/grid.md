# Grid

CSS grid that arranges children into 1-6 equal-width columns (`columns`, default 2) with equal-height cells by default. Choose it over Stack when items must line up in columns and rows (card grids, feature grids, stat rows); set `minColWidth` to switch from a fixed column count to responsive auto-fit wrapping. Reach for it when a set of peer items should tile evenly — each child occupies one cell and the tracks size themselves, so you never hand-set widths.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "grid",
  "elements": {
    "grid": {
      "type": "Grid",
      "props": {
        "columns": 3,
        "gap": "md"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `columns` | `string \| number` | Number of columns (1-6). The primary lever for a fixed-column grid. |
| `gap` | `"sm" \| "md" \| "lg" \| "xl"` | Token spacing between cells (both axes): sm (0.5rem) · md (1rem, default) · lg (1.5rem) · xl (2.5rem). For an exact value use `gapValue`. |
| `align` | `"start" \| "center" \| "end" \| "stretch"` | Block alignment of items within their grid tracks (`align-items`). `stretch` (default) makes equal-height cells. |
| `padding` | `"none" \| "sm" \| "md" \| "lg"` | Inner padding around the grid. Use when the grid itself is a padded band/section rather than nesting inside a Card. Unset by default (a props-less grid has no padding). |
| `paddingValue` | `string \| number` | Exact inner padding (e.g. "28px" / "2rem"). Overrides the `padding` enum, which is the default (and which is unset by default). |
| `bg` | `string` | Background fill color behind the grid. Omit for transparent. |
| `color` | `string` | On-surface text colour — all text inside the grid cells (children inherit via CSS) (default the foreground token). Pair with a dark/tinted `bg` so content stays legible. |
| `gapValue` | `string \| number` | Exact gap override (e.g. "20px") when the `gap` enum is too coarse. |
| `minColWidth` | `string \| number` | Responsive auto-fit: when set (e.g. "220px"), columns wrap to fill the width with at least this minimum — overrides the fixed `columns`. |
| `template` | `string` | Explicit column widths as a CSS track list ("minmax(0,2fr) minmax(0,6rem) minmax(0,1fr)"), for a matrix whose columns differ in natural width — a wide name beside a narrow amount beside a wide sparkline. Overrides `columns`. Give the HEADER row and every data row the SAME template so their fields line up as real columns; a header sized by its own content points at nothing, and the header must have exactly as many cells as each data row. Prefer minmax(0,…) for every track: a bare "1fr" cannot shrink below its content, so one long cell pushes the row past the container. Stacks to one column on narrow. Allowed tracks: 0, a number with fr/px/rem/em/%/ch, auto, min-content, max-content, minmax(a,b) or repeat(n,track); up to 12. |
| `rows` | `string \| number` | Explicit row count (1-12). Usually leave unset to let rows flow automatically. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole grid region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
