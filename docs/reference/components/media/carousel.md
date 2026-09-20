# Carousel

Horizontal scroll-snap strip of simple cards (`items` as [{title, description, image?, icon?}]) with optional prev/next arrows (`showControls`) and pagination dots (`showDots`). Each card can carry a media image or icon banner. Choose it to let users browse many peer teasers in limited vertical space; it takes NO children, for arbitrary components in a row use Stack direction:horizontal, and for a wrapping layout use Grid. Bind `activeIndex` with { $bindState } so the agent (or a sibling control) can read the 0-based index of the card currently in view from spec.state.

## Example

```json
{
  "root": "carousel",
  "elements": {
    "carousel": {
      "type": "Carousel",
      "props": {
        "items": [
          {
            "title": "Fast setup",
            "description": "Live in minutes."
          },
          {
            "title": "Flexible pricing",
            "description": "Pay as you grow."
          },
          {
            "title": "24/7 support",
            "description": "We are always here to help."
          }
        ],
        "gap": null,
        "align": null,
        "radius": null,
        "radiusValue": null,
        "showControls": true,
        "showDots": null,
        "activeIndex": null,
        "cardBg": null,
        "borderColor": null,
        "mutedColor": null,
        "itemWidth": null,
        "weight": null,
        "fontSize": null,
        "prevLabel": null,
        "nextLabel": null,
        "prevIcon": null,
        "nextIcon": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ title: string, description: string, image: string, icon: string })[]` | The cards as [{title, description, image?, icon?}], title/description are optional strings; each card may carry a media `image` (URL) or `icon` (registry name) banner, e.g. [{"title":"Fast setup","description":"Live in minutes.","icon":"zap"}]. No child components. |
| `gap` | `"sm" \| "md" \| "lg" \| "xl"` | Spacing between cards: sm (0.5rem) · md (1rem, default) · lg (1.5rem) · xl (2.5rem). |
| `align` | `"start" \| "center"` | Scroll-snap alignment of cards: start (default) or center. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner radius of each card: none · sm · md (default, the theme radius) · lg · full. For an exact value use `radiusValue`. |
| `radiusValue` | `string \| number` | Exact per-card corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `showControls` | `boolean` | Show prev/next arrow buttons in addition to drag/scroll. |
| `showDots` | `boolean` | Show a row of pagination dots below the strip, one per card, tracking the scrolled-to card (default false). Click a dot to scroll to that card. |
| `activeIndex` | `number` | The card currently scrolled into view (0-based). Bind with { $bindState } so an external Button/agent can read which card the user is looking at; mirrored back here into spec.state on every scroll. |
| `cardBg` | `string` | Per-card background color (e.g. a dark card on a light page); the prev/next arrow chips follow it too. |
| `borderColor` | `string` | Per-card border color; the prev/next arrow chips follow it too. |
| `mutedColor` | `string` | Secondary/muted text colour, the per-card description line under each title (default the muted-foreground token). |
| `itemWidth` | `string \| number` | Width of each card (e.g. "18rem"). Default ~14rem; widen for richer cards. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of each card title (light · normal · medium · semibold · bold; default semibold). |
| `fontSize` | `string \| number` | Exact font size of each card title (e.g. "18px" / "1.125rem"). Default 1.0625rem. |
| `prevLabel` | `string` | Accessible label (aria-label) for the previous-arrow button. Default "Previous". Localise for non-English UIs. |
| `nextLabel` | `string` | Accessible label (aria-label) for the next-arrow button. Default "Next". Localise for non-English UIs. |
| `prevIcon` | `string` | Previous-arrow glyph, an icon NAME from the closed registry (e.g. "chevron-left", "arrow-left"). Unknown/omitted → the default ‹ character. Never raw SVG. |
| `titleLevel` | `"h1" \| "h2" \| "h3" \| "h4"` | Heading level for EVERY card title in this carousel (default h2, the strip emits no title of its own, so a card title is the first heading under whatever precedes it). Set it when the carousel nests inside a titled Card, so the screen's headings nest legally, a document that jumps h1 to h4 has no outline for anyone navigating by heading. |
| `nextIcon` | `string` | Next-arrow glyph, an icon NAME from the closed registry (e.g. "chevron-right", "arrow-right"). Unknown/omitted → the default › character. Never raw SVG. |

## Events

### page

The user scrolled to a different card or clicked a pagination dot; params carry {activeIndex}, the resolved 0-based index of the card now in view.

| Key | Type | Description |
| --- | --- | --- |
| `page` | `number` | The target page (1-based, clamped to range). |

See [Events](../../events.md) for the full payload contract.
