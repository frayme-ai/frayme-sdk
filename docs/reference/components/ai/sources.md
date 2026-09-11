# Sources

A citations panel: a titled list or grid of source cards (title link → hostname → excerpt) for RAG / web-search results. Each title links out in a new tab. Reach for this when an assistant answer is grounded in retrieved documents and you want to surface the whole reference set as a block — typically placed after a Message or MessageContent, not inline like an InlineCitation. Switch `variant` to `grid` (with `minColWidth`) once there are many sources so the cards tile responsively instead of stacking.

## Example

```json
{
  "root": "sources",
  "elements": {
    "sources": {
      "type": "Sources",
      "props": {
        "title": "Sources",
        "sources": [
          {
            "title": "json-render docs",
            "url": "https://json-render.dev",
            "excerpt": "The open UI specification standard."
          },
          {
            "title": "MCP Apps spec (SEP-1865)",
            "url": "https://modelcontextprotocol.io",
            "excerpt": "Interactive UI inside Claude and ChatGPT."
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
| `sources` | `({ title: string, url: string, excerpt: string })[]` | The cited sources. Each renders a card: title link + hostname + optional excerpt. |
| `title` | `string` | Heading above the source cards (default "Sources"). |
| `variant` | `"list" \| "grid"` | Layout: list (stacked rows, default) · grid (responsive card grid for many sources). |
| `minColWidth` | `string \| number` | Exact min column width for the auto-fill grid (e.g. 200px / 11rem). Overrides the built-in 13rem minimum; only applies to variant:grid. |
| `externalIcon` | `string` | Glyph NAME (closed icon registry) for the per-source open-in-new-tab affordance (default "arrow-up-right"). Unknown/absent → the default glyph; never raw SVG. |
| `accent` | `string` | Per-source title-link color (default the foreground token). The heading is colored by `mutedColor`, not this. |
| `mutedColor` | `string` | Secondary/muted text colour — the heading, each source hostname + excerpt, and the hover-revealed external-link glyph (default the muted-foreground token). |
| `bg` | `string` | Background fill of each source card surface (default the card token). |
| `borderColor` | `string` | Border colour of each source card (default the border token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow elevation of each source card — none · sm · md · lg · xl; default flat. Set to lift the cards off the page. |
