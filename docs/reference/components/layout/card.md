# Card

Container card for content sections. Use for forms/content boxes, NOT for page headers. `surface` sets the visual treatment: solid (default) · gradient · glass · elevated. `gap` controls the spacing between body children.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "card",
  "elements": {
    "card": {
      "type": "Card",
      "props": {
        "title": "Overview",
        "description": "Your account summary"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Header title line at the top of the card. Keep to 2-5 words ("Account summary"); omit for a chromeless content box (default none — no header renders). |
| `description` | `string` | Muted one-line subtitle under the `title` (colored by `mutedColor`). Use for a short qualifier ("Your usage this month"); omit when the body speaks for itself. |
| `maxWidth` | `"sm" \| "md" \| "lg" \| "full"` | Maximum card width: sm (24rem) · md (32rem) · lg (48rem) · full (no cap, default). Pair with `centered` for a constrained centered panel. |
| `centered` | `boolean` | Center the card horizontally (margin auto; default false). Only visible when the card is narrower than its container — pair with `maxWidth` or `width`. |
| `surface` | `"solid" \| "gradient" \| "glass" \| "elevated"` | Surface treatment: solid (flat, default) · gradient (soft brand gradient — reads gradientFrom/gradientTo/accent) · glass (translucent + backdrop blur) · elevated (stronger shadow). |
| `padding` | `"none" \| "sm" \| "md" \| "lg"` | Inner padding. Reach for `none` on a card that wraps a full-bleed media/table; `lg` for a roomy hero panel. |
| `paddingValue` | `string \| number` | Exact inner padding (e.g. "32px" / "2rem"). Overrides the `padding` enum, which is the default. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner radius. `none` for a flush/edge-to-edge card, `lg` for a soft modern panel. |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `align` | `"start" \| "center" \| "end"` | Text alignment of the header + content. `center` for a centered hero/empty-state card. |
| `bordered` | `boolean` | Whether the card border renders at all (false = borderless surface). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style (solid · dashed · dotted; default solid). Applies when `bordered`. |
| `borderWidthValue` | `string \| number` | Exact border thickness (e.g. "2px"; default 1px). Applies when `bordered`. |
| `bg` | `string` | Background fill color. Names a specific surface color when the theme card token is not what you want; for a tinted preset use `surface:glass`/`gradient` instead. |
| `color` | `string` | On-surface text colour — the card body/children (inherited via CSS) and the `title` when `accent` is unset; the `description` keeps `mutedColor` (default the card-foreground token). Pair with a dark/tinted `bg`. |
| `borderColor` | `string` | Border color. Use to tint the outline (e.g. a soft brand-coloured edge) when `bordered` is on. |
| `accent` | `string` | Text colour of the card `title` heading (default: inherits the card's own `color`/ink); on `surface:gradient` the same value also tints the top-left stop of the background gradient. |
| `gradientFrom` | `string` | Background gradient start colour — the top-left stop of the card's `surface:gradient` fill (pairs with `gradientTo`; no effect on other surfaces). |
| `gradientTo` | `string` | Gradient end color (use with `surface:gradient` together with `gradientFrom`). |
| `mutedColor` | `string` | Secondary/muted text colour — descriptions, captions, timestamps, help text (default the muted-foreground token). |
| `width` | `string \| number` | Explicit width override (escape hatch beyond the `maxWidth` enum) — e.g. "640px". Prefer `maxWidth` for the common cases. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole card region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the card `title` (light · normal · medium · semibold · bold; default semibold). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the card `title` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the card `title` (tight · snug · normal · relaxed · loose; default the title default). |
| `fontSize` | `string \| number` | Exact font size of the card `title` (e.g. "20px" / "1.25rem"). Default 1.0625rem. |
| `titleLevel` | `"h1" \| "h2" \| "h3" \| "h4"` | Heading level for this card's title (default h2 — a Card is the first structural level under the PageHeader h1). Set it when the card nests deeper, so the screen's headings nest legally — a document that jumps h1 to h4 has no outline for anyone navigating by heading. |
| `gap` | `"none" \| "sm" \| "md" \| "lg"` | Vertical spacing between the card body children (the content column): none (0) · sm (0.5rem) · md (1rem, default) · lg (1.5rem). Set it to tighten/loosen intra-card rhythm instead of nesting a Stack. |
