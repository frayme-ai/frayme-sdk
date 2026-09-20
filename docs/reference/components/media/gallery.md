# Gallery

A responsive image grid with an optional built-in lightbox. Set `columns` for the grid width and `ratio` for tile shape. When `lightbox` is on, clicking a tile opens an internal full-screen overlay (arrows change image, Esc/close hides) and emits `change`, no binding required.

## Example

```json
{
  "root": "gallery",
  "elements": {
    "gallery": {
      "type": "Gallery",
      "props": {
        "items": [
          {
            "src": "https://example.com/a.jpg",
            "alt": "Mountain"
          },
          {
            "src": "https://example.com/b.jpg",
            "alt": "Lake"
          },
          {
            "src": "https://example.com/c.jpg",
            "alt": "Forest"
          }
        ],
        "columns": 3
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ src: string, alt: string, caption: string })[]` | The images in the grid. Each has a src + alt + optional caption. |
| `columns` | `number` | Number of grid columns 1-6 (count channel; default 3). |
| `gap` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Spacing between tiles: none (0) · sm (0.375rem) · md (0.75rem, default) · lg (1.25rem) · xl (2rem). Same menu as MediaGrid. |
| `ratio` | `"square" \| "video" \| "portrait" \| "wide" \| "auto"` | Tile aspect ratio: square (1:1, default) · video (16:9) · portrait (3:4) · wide (21:9) · auto (natural height). Same menu as MediaGrid. |
| `lightbox` | `boolean` | When true, clicking a tile opens a full-screen overlay at that image with prev/next + close (works without a binding). Default true. |
| `overlayColor` | `string` | Backdrop scrim color behind the lightbox image (default a fixed dark scrim, always dark in both themes). Only applies when `lightbox` is on. |
| `closeLabel` | `string` | Accessible label for the lightbox close (×) button (default "Close"). Set for localisation; feeds aria-label, escaped text. |
| `prevLabel` | `string` | Accessible label for the lightbox previous-image arrow (default "Previous"). Only shown with multiple images; escaped text. |
| `nextLabel` | `string` | Accessible label for the lightbox next-image arrow (default "Next"). Only shown with multiple images; escaped text. |
| `opacity` | `"25" \| "50" \| "75" \| "90" \| "full"` | Dim the whole gallery to de-emphasise it: full (default) · 90 · 75 · 50 · 25. |
| `radiusValue` | `string \| number` | Corner rounding applied UNIFORMLY to every tile (e.g. "12px" / "0.75rem"; default the frayme radius). Cascades to all tiles via CSS inheritance. |
| `borderColor` | `string` | Border colour applied UNIFORMLY to every tile (default the border token). Cascades to all tiles via CSS inheritance. |

## Events

### change

A tile was clicked, opening the internal lightbox at that image (fires even when `lightbox` is off); params carry {index, src}, the clicked tile's position and image URL.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
