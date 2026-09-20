# WebPreview

A link-preview card (NOT an iframe, no embedded page): optional thumbnail, title, description, and hostname; the whole card links out in a new tab. Use for a shared / referenced web page. Reach for this when the assistant cites or recommends ONE page and you want a rich unfurl (image + title + summary) rather than the plain [n] chip of an InlineCitation or the multi-row Sources list. The entire card is one click target that opens in a new tab; when `image` is missing or blocked, an `externalIcon` placeholder box stands in for the thumbnail.

## Example

```json
{
  "root": "web-preview",
  "elements": {
    "web-preview": {
      "type": "WebPreview",
      "props": {
        "url": "https://json-render.dev",
        "title": "json-render, the open UI specification",
        "description": "Render JSON specs to React. The standard behind Frayme."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `url` | `string` | The page the card links to (opens in a new tab). Its hostname is shown as a muted label. |
| `title` | `string` | Page title shown as the prominent card heading above the description and hostname (default none). Set it to the OG/page title; omit for a bare url + hostname card. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the title heading: light · normal · medium (default) · semibold · bold. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line height of the title heading: tight · snug (default) · normal · relaxed · loose. |
| `width` | `string \| number` | Exact max width of the preview card (e.g. 480px / 24rem). Overrides the built-in 28rem cap (max-w-md), which is the default; the card still shrinks below the cap. |
| `description` | `string` | Page summary / meta description shown under the title. |
| `image` | `string` | Open-graph / thumbnail image URL (raster only). A placeholder is shown when omitted or invalid. |
| `aspect` | `"auto" \| "1/1" \| "4/3" \| "3/2" \| "16/9" \| "21/9" \| "3/4"` | Aspect ratio of the thumbnail box (image + placeholder), e.g. 16/9 or 1/1; default the OG 1.91/1. |
| `externalIcon` | `string` | Glyph NAME (closed icon registry) for the external-link affordance, the placeholder mark + the hostname row (default "external-link"). Unknown/absent → the default glyph; never raw SVG. |
| `accent` | `string` | Title heading color (default the foreground token). The hostname row is colored by `mutedColor`, not this. |
| `bg` | `string` | Background fill of the preview card surface (default card token). |
| `borderColor` | `string` | Border colour of the preview card (default the border token). |
| `borderWidthValue` | `string \| number` | Exact preview-card border thickness in px (e.g. "2px"; default 1px). |
| `mutedColor` | `string` | Secondary/muted text colour, the description, the hostname label, and the image-placeholder glyph (default the muted-foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow elevation of the preview card, none · sm · md · lg · xl; default flat. Set to lift the card off the page as a floating surface. |
