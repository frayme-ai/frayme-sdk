# MediaGrid

A responsive grid of media tiles for galleries, logos, or link cards. Display-only (no lightbox). A tile with `href` renders as a safe link; a `label` shows as a caption overlay. Use `columns` for grid width and `ratio` for tile shape.

## Example

```json
{
  "root": "media-grid",
  "elements": {
    "media-grid": {
      "type": "MediaGrid",
      "props": {
        "items": [
          {
            "src": "https://example.com/1.jpg",
            "alt": "Cover",
            "label": "Featured"
          },
          {
            "src": "https://example.com/2.jpg",
            "alt": "Album",
            "href": "https://example.com/album"
          }
        ],
        "columns": 2
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ src: string, alt: string, label: string, href: string })[]` | The media tiles. A tile with `href` becomes a link; otherwise it is a static display tile. |
| `columns` | `number` | Number of grid columns 1–6 (count channel; default 3). |
| `gap` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Spacing between tiles: none (0) · sm (0.375rem) · md (0.75rem, default) · lg (1.25rem) · xl (2rem). Same menu as Gallery. |
| `ratio` | `"square" \| "video" \| "portrait" \| "wide" \| "auto"` | Tile aspect ratio: square (1:1, default) · video (16:9) · portrait (3:4) · wide (21:9) · auto (natural height). Same menu as Gallery. |
| `opacity` | `"25" \| "50" \| "75" \| "90" \| "full"` | Dim the whole media grid to de-emphasise it: full (default) · 90 · 75 · 50 · 25. |
| `radiusValue` | `string \| number` | Corner rounding applied UNIFORMLY to every tile (e.g. "12px" / "0.75rem"; default the frayme radius). Cascades to all tiles via CSS inheritance. |
| `borderColor` | `string` | Border colour applied UNIFORMLY to every tile (default the border token). Cascades to all tiles via CSS inheritance. |
