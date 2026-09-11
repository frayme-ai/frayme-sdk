# Heading

Section heading rendered as a real h1-h4 tag. `level` sets the semantic tag (a11y/SEO); `size` sets the visual scale independently, defaulting from level (h1→xl … h4→sm) — so an h2 can render display-large. `clamp` caps it to N lines. Use Heading for titles that structure the page; Text is for body/caption copy, and a Card `title` covers the heading that belongs to that card.

## Example

```json
{
  "root": "heading",
  "elements": {
    "heading": {
      "type": "Heading",
      "props": {
        "text": "Welcome",
        "level": "h1"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `text` | `string` | The heading copy. Keep it short and scannable (2-8 words); plain text only — no markdown or HTML. |
| `level` | `"h1" \| "h2" \| "h3" \| "h4"` | Semantic tag (a11y/SEO). Decoupled from visual `size`. |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl" \| "2xl"` | Visual size, DECOUPLED from `level` (e.g. an h2 rendered display-large). Omit to follow level. |
| `fontSize` | `string \| number` | Exact font size (e.g. "32px" / "2rem"). Overrides the `size` enum (which is the default, derived from `level` when unset). |
| `weight` | `"normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the heading: normal · medium · semibold (default) · bold. |
| `align` | `"left" \| "center" \| "right"` | Horizontal text alignment: left (default) · center · right. |
| `tone` | `"default" \| "muted" \| "success" \| "warning" \| "critical" \| "info"` | Semantic text color via token (covers the common case; use `color` for an exact value). |
| `truncate` | `boolean` | Clip the heading to ONE line with a trailing ellipsis when it overflows its width (default false). Use it in tight columns/cards; for a multi-line cap use `clamp` instead. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing (shared 5-step atom): tighter · tight · normal (default) · wide · wider. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height: tight (default) · snug · normal · relaxed · loose. |
| `clamp` | `string \| number` | Clamp the heading to this many lines (1-6) with a trailing ellipsis (e.g. 2 for a two-line hero title). Default: no clamp (the heading grows to fit). Use `truncate` for a single-line ellipsis instead. |
| `color` | `string` | Exact text color (wins over `tone`). Names a specific brand color for the heading. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for this heading (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
