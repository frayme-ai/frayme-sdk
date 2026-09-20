# DescriptionList

A list of term → definition pairs rendered as a semantic &lt;dl>/&lt;dt>/&lt;dd>. Pick stacked, inline, or grid layout. Display-only, use for metadata, spec sheets, or a details panel.

## Example

```json
{
  "root": "description-list",
  "elements": {
    "description-list": {
      "type": "DescriptionList",
      "props": {
        "items": [
          {
            "term": "Status",
            "description": "Active"
          },
          {
            "term": "Plan",
            "description": "Pro"
          },
          {
            "term": "Region",
            "description": "eu-west-2"
          }
        ],
        "layout": "inline"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ term: string, description: string })[]` | The term/definition pairs, rendered as semantic &lt;dt>/&lt;dd>. Plain text, no markdown/HTML. |
| `layout` | `"stacked" \| "inline" \| "grid"` | Arrangement: stacked (term above value, default) · inline (term left, value right per row) · grid (multi-column term/value pairs). |
| `density` | `"compact" \| "normal" \| "comfortable"` | Vertical spacing between term/definition pairs: compact · normal (default) · comfortable. Reach for `compact` on a dense spec sheet and `comfortable` for a roomy details panel. |
| `columns` | `number` | Number of columns when layout is grid (1-3, default 2). Ignored for stacked/inline. A grid track count. |
| `bordered` | `boolean` | Draw divider lines between rows (default false). Turn on to visually separate many pairs; the line color follows `borderColor`. |
| `mutedColor` | `string` | Secondary/muted text colour, the term (&lt;dt>) labels (default the muted-foreground token). |
| `color` | `string` | Primary text colour, the definition (&lt;dd>) values (default the foreground token). |
| `borderColor` | `string` | Colour of the divider lines between rows when `bordered` (default the border token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole description-list region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the term (&lt;dt>) labels only, the definitions keep their own weight (light · normal · medium · semibold · bold; default medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the whole list text, terms and definitions (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the whole list text, terms and definitions (tight · snug · normal · relaxed · loose; default the list default). |
| `fontSize` | `string \| number` | Exact font size of the whole list text, terms AND definitions together (e.g. "16px" / "1rem"). Default 0.875rem definitions / 0.8125rem terms. |
