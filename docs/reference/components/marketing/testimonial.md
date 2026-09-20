# Testimonial

A customer quote card: an optional star rating, the quote body (plain text, no markdown/HTML), and the author name/title with an avatar. Reach for this when you need social proof, a single quote inline, or several tiled in a Grid for a wall of testimonials. The `variant` shifts the treatment (bordered `card`, borderless `plain`, oversized `large` hero quote) and a missing/unsafe `avatarSrc` falls back to the author initials rather than a broken image.

## Example

```json
{
  "root": "testimonial",
  "elements": {
    "testimonial": {
      "type": "Testimonial",
      "props": {
        "quote": "Frayme cut our build time in half.",
        "authorName": "Jordan Lee",
        "authorTitle": "Head of Product, Northwind",
        "rating": 5
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `quote` | `string` | The testimonial text (required, plain text, no markdown/HTML). One or two sentences reads best; the `large` variant is built for a short, punchy quote. |
| `authorName` | `string` | Name of the person being quoted (shown under the quote). |
| `authorTitle` | `string` | Role / company line under the author name (e.g. "CTO, Acme"). |
| `avatarSrc` | `string` | Author avatar image URL (raster only, png/jpg/webp; svg/data-svg rejected). Falls back to initials when absent/unsafe. |
| `rating` | `number` | Optional 0-5 star rating shown as a star row above the quote. A plain count, not a visual dimension. |
| `variant` | `"card" \| "plain" \| "large"` | Treatment: card (bordered surface, default) · plain (no border, inline) · large (oversized hero quote). |
| `accent` | `string` | Ink colour of the filled rating-star glyphs (default amber). Names a specific brand color. |
| `color` | `string` | Primary text colour, the quote body and the author name, which travel together (default the foreground token). Set a light value when placing the testimonial on a dark surface; the role/company line stays `mutedColor`. |
| `borderColor` | `string` | Border colour of the card variant (default the border token). |
| `mutedColor` | `string` | Secondary/muted text colour, the author role/company line under the name (default the muted-foreground token). |
| `borderWidthValue` | `string \| number` | Exact border thickness of the card variant (e.g. "2px"; default 1px). Only applies to the card variant. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole testimonial region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the quote body (overrides the variant default, e.g. the large variant's medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the quote body (default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line height of the quote body (overrides the variant default, e.g. relaxed/snug). |
| `fontSize` | `string \| number` | Exact font size of the quote body (e.g. "20px" / "1.25rem"). Default 1.0625rem (1.5rem on the large variant). |
