# Container

Max-width centered page wrapper. The outermost layout shell that constrains and centers a page/section column. Children render inside.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "container",
  "elements": {
    "container": {
      "type": "Container",
      "props": {
        "maxWidth": "lg",
        "padding": "md"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `maxWidth` | `"sm" \| "md" \| "lg" \| "xl" \| "full"` | Max content width: sm (~36rem) · md (~48rem) · lg (~64rem, default) · xl (~80rem) · full (no cap). Pick by how wide the reading column should be. |
| `padding` | `"none" \| "sm" \| "md" \| "lg"` | Horizontal gutter padding so content never touches the viewport edge (default md). `none` when a parent already pads. |
| `paddingValue` | `string \| number` | Exact horizontal gutter (left+right, e.g. "320px" / "2rem"). Overrides the `padding` enum, which is the default. |
| `centered` | `boolean` | Center the wrapper horizontally with auto margins (default true). Set false to left-align it. |
| `align` | `"start" \| "center" \| "end"` | Text alignment of the wrapped content (default start). `center` for a centered marketing column. |
| `bg` | `string` | Background fill color of the wrapper (e.g. a tinted reading column). Omit for transparent. |
| `color` | `string` | On-surface text colour for the wrapped column — cascades to all child text (default the foreground token). Pair with `bg` so a tinted/dark column keeps readable content. |
| `width` | `string \| number` | Explicit width override (escape hatch beyond the `maxWidth` enum), e.g. "960px". Prefer `maxWidth` for the common cases. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the wrapped column and everything inside it (cascades): sans · serif · mono · rounded · display. Omit to inherit the theme font. |
