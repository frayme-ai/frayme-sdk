# Lightbox

A standalone full-screen media overlay (role=dialog). Prev/next arrows change the current image (internal state, seeded from `index`), close/Esc hides it (seeded from `open`) — all interactive without a binding. Bind `index`/`open` for external control. Emits `change` on navigation and `dismiss` on close.

## Example

```json
{
  "root": "lightbox",
  "elements": {
    "lightbox": {
      "type": "Lightbox",
      "props": {
        "items": [
          {
            "src": "https://example.com/a.jpg",
            "alt": "Slide 1",
            "caption": "The first slide"
          },
          {
            "src": "https://example.com/b.jpg",
            "alt": "Slide 2"
          }
        ],
        "open": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ src: string, alt: string, caption: string })[]` | The images in the overlay (src + alt + optional caption). Prev/next steps through them. |
| `index` | `number` | Which image to show first (0-based; default 0). Bind it to drive the current image externally. |
| `open` | `boolean` | Whether the overlay is shown (default false). Bind it to open/close from elsewhere; the internal close button still works. |
| `closeLabel` | `string` | Accessible label for the close (×) button (default "Close"). Set for localisation; feeds aria-label — escaped text. |
| `prevLabel` | `string` | Accessible label for the previous-image arrow (default "Previous"). Only shown with multiple images; escaped text. |
| `nextLabel` | `string` | Accessible label for the next-image arrow (default "Next"). Only shown with multiple images; escaped text. |
| `overlayColor` | `string` | Backdrop scrim color behind the image (default a fixed dark scrim, always dark in both themes). |

## Events

### change

A prev/next arrow (or an Arrow-key press) moved to another image; params carry {index, src} — the new image's position and URL.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### dismiss

The overlay was closed (× button or Esc); params carry {index} — the index it was showing when closed.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
