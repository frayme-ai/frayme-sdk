# Navbar

Horizontal top navigation bar. Renders a &lt;nav> with an optional left brand label (with an optional leading `brandIcon` glyph and `font`/`weight` styling) and children (links/buttons) on the right. `sticky` pins it to the top.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "navbar",
  "elements": {
    "navbar": {
      "type": "Navbar",
      "props": {
        "brand": "Frayme",
        "sticky": true,
        "justify": "between"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `brand` | `string` | Left-aligned brand/app label (e.g. the product name). Omit to start the bar with the children. |
| `brandIcon` | `string` | Optional leading logo glyph beside the `brand` label, by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "home", "sparkles"). Never raw SVG; unknown/absent names render no glyph. Only shown when `brand` is set. |
| `variant` | `"default" \| "bordered" \| "floating"` | Bar chrome: default (solid, bottom border) · bordered (full border) · floating (rounded, shadowed, inset card). |
| `sticky` | `boolean` | Pin the bar to the viewport top while the page scrolls (sticky top-0). |
| `justify` | `"start" \| "center" \| "end" \| "between"` | How the nav children distribute after the brand: start · center · end · between (default, brand left, items pushed right). |
| `size` | `"sm" \| "md" \| "lg"` | Bar height + horizontal padding together: sm · md (default) · lg. Use `sm` for a compact utility bar or `lg` for a roomy marketing header; the exact `height` channel overrides the height while padding still follows this. |
| `height` | `string \| number` | Exact bar height (e.g. 72px / 4.5rem). Overrides the height of the `size` enum (the default); the horizontal padding still follows `size`. |
| `bg` | `string` | Bar background fill. Names a specific color (e.g. a dark top bar); default the card token. |
| `borderColor` | `string` | Border color (bottom edge for default/bordered, full edge for floating; default border token). |
| `color` | `string` | On-surface text colour, the brand label (default the foreground token). Set a light value on a dark `bg` so the brand stays legible. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface of the `brand` wordmark (sans · serif · mono · rounded · display). Omit to inherit the theme font, the most brand-styled surface in the family. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the `brand` wordmark (light · normal · medium · semibold · bold; default semibold). |
