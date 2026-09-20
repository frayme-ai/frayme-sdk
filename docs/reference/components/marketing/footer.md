# Footer

A site footer: a brand lede, several link columns ({heading, links}), social icon links, and a fine-print bottom line. Links are scheme-guarded &lt;a>s. Use at the very bottom of a page.

## Example

```json
{
  "root": "footer",
  "elements": {
    "footer": {
      "type": "Footer",
      "props": {
        "brand": "Frayme",
        "tagline": "Ship MCP Apps to Claude and ChatGPT.",
        "columns": [
          {
            "heading": "Product",
            "links": [
              {
                "label": "Pricing",
                "href": "/pricing"
              },
              {
                "label": "Docs",
                "href": "/docs"
              }
            ]
          }
        ],
        "bottomText": "© 2026 Frayme. All rights reserved."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `brand` | `string` | Brand / product name shown in the footer lede column. |
| `tagline` | `string` | Short supporting line under the brand name in the lede column (e.g. a one-line pitch). Rendered in `mutedColor`; omit for a bare brand name. |
| `columns` | `({ heading: string, links: object[] })[]` | Link columns (each a heading + a list of {label, href}). The column count is derived from the array length. |
| `socials` | `({ icon: string, href: string })[]` | Social links: each an icon glyph NAME (from the closed icon registry (or a single emoji glyph, rendered as-is)) + an href. Unknown names render nothing. |
| `bottomText` | `string` | Fine-print line at the very bottom (e.g. a copyright notice). |
| `variant` | `"simple" \| "columns"` | Layout: columns (brand lede + link columns, default) · simple (single centered row, brand + socials + bottom text). |
| `accent` | `string` | Text colour of a footer link or social glyph while hovered, the resting colour is `mutedColor` (default the foreground token). Names a specific brand colour. |
| `bg` | `string` | Footer background fill (default transparent, inherits the page surface). Set a brand surface for a filled footer. |
| `color` | `string` | Primary text colour, the brand name (default the foreground token). Set a light value on a dark `bg`. |
| `mutedColor` | `string` | Secondary/muted text colour, the tagline, column headings, link rows, social icon links, and fine-print bottom line (default the muted-foreground token). |
| `borderColor` | `string` | Colour of the fine-print divider line above the bottom text (columns variant; default the border token). Set alongside a dark `bg` so the rule sits on the brand surface. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the brand name in the footer lede (default semibold). |
