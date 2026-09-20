# Treemap

A single-level treemap of proportional rectangles (slice-and-dice). Each datum is { label, value, color? }; rectangle area ≈ value÷total. `palette` colors rectangles without a per-rect `color`.

## Example

```json
{
  "root": "treemap",
  "elements": {
    "treemap": {
      "type": "Treemap",
      "props": {
        "data": [
          {
            "label": "Engineering",
            "value": 48
          },
          {
            "label": "Sales",
            "value": 26
          },
          {
            "label": "Marketing",
            "value": 16
          },
          {
            "label": "Support",
            "value": 10
          }
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `data` | `({ label: string, value: number, color: string })[]` | The rectangles; each is { label, value, color? }. Area ≈ value ÷ sum of values (slice-and-dice layout). |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-datum `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80-800. |
| `showValues` | `boolean` | Print each rectangle’s value under its label (default true). |
| `size` | `"sm" \| "md" \| "lg"` | Font scale of the in-cell label/value text: sm (10px/9px) · md (12px/10px, default) · lg (14px/12px). Rectangle sizes are value-driven and unaffected. |
| `labelColor` | `string` | Text colour of the in-cell label and value (default white). Paired with `overlayColor`, the scrim it is printed on, a dark label needs a light `overlayColor` or it will not read. |
| `overlayColor` | `string` | Exact colour of the dark scrim drawn under each cell’s label so the text stays legible over pale fills (default a translucent black). |
| `mutedColor` | `string` | Secondary/muted text colour, the empty-state caption (default the muted-foreground token). The in-cell label colour is set via `labelColor` and the scrim via `overlayColor`. |
| `emptyText` | `string` | Override the empty-state message shown when there is no valid data (default "No data"). |
| `ariaLabel` | `string` | Override the screen-reader summary of the chart (default an auto per-cell summary). |
