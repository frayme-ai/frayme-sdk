# Stack

Flexbox container that lays out its children in a column or row (`direction`, default vertical) with token gaps. The workhorse layout primitive — reach for Stack when things just need stacking or inlining with spacing, Grid when items must align in equal-width columns, Card when the group needs a bordered surface. Purely structural: no border, and no padding/background unless `padding`/`bg` are set.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "stack",
  "elements": {
    "stack": {
      "type": "Stack",
      "props": {
        "direction": "vertical",
        "gap": "md"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `direction` | `"horizontal" \| "vertical"` | Main axis: vertical (a column, default) · horizontal (a row; wraps onto new lines by default — see `wrap`). |
| `gap` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Token spacing between children: none (0) · sm (0.5rem) · md (1rem, default) · lg (1.5rem) · xl (2.5rem). For an exact value use `gapValue`. |
| `align` | `"start" \| "center" \| "end" \| "stretch"` | Cross-axis alignment of children (align-items): start · center · end · stretch (default: the browser stretch behavior when unset). |
| `justify` | `"start" \| "center" \| "end" \| "between" \| "around"` | Main-axis distribution (justify-content): start (default when unset) · center · end · between · around. |
| `wrap` | `boolean` | Whether children wrap onto new lines (horizontal stacks). Set false to force a single non-wrapping row. |
| `padding` | `"none" \| "sm" \| "md" \| "lg"` | Inner padding around the stack. Use when the stack itself is a padded band/section rather than nesting inside a Card. |
| `paddingValue` | `string \| number` | Exact inner padding (e.g. "28px" / "2rem"). Overrides the `padding` enum, which is the default (and which is unset by default). |
| `bg` | `string` | Background fill color of the stack band (e.g. a dark hero strip). Omit for transparent. |
| `color` | `string` | On-surface text colour — all text inside the stack band (children inherit via CSS) (default the foreground token). Pair with a dark/tinted `bg` so content stays legible. |
| `gapValue` | `string \| number` | Exact gap override (e.g. "28px") when the `gap` enum steps are too coarse. Prefer the `gap` enum for the common cases. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole stack region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
