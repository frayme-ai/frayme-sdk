# InlineMessage

A compact, single-line inline status message (field/row level): a small leading icon + tinted text. Display-only. Reach for this under a form field, in a table cell, or beside a control — NOT for a page-level Banner.

## Example

```json
{
  "root": "inline-message",
  "elements": {
    "inline-message": {
      "type": "InlineMessage",
      "props": {
        "message": "Username is available",
        "tone": "success"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `message` | `string` | The status text (required). Keep to a short phrase or one clause — this is a single-line field/row-level hint, not a paragraph. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color of the text + icon via token (default neutral). Use `critical` for a field error, `success` for a valid hint. |
| `icon` | `string` | Leading glyph: "auto" (derive from tone), "none" (hide), or a NAME from the closed icon registry (or a single emoji glyph, rendered as-is). Never raw SVG; unknown names render nothing. |
| `size` | `"sm" \| "md"` | Text + icon scale (default md). Use `sm` for a tight field-level hint. |
| `color` | `string` | Text colour of the message and its leading icon, recoloured together as one role (default the `tone` token). Set to override the semantic tone colour — e.g. a brand hint that should not read as success/error. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole inline message; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the message text (light · normal · medium · semibold · bold; default normal). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the message text (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the message text (tight · snug · normal · relaxed · loose; default snug). |
| `fontSize` | `string \| number` | Exact font size of the message text (e.g. "13px" / "0.875rem"). Default 0.875rem (0.8125rem when size=sm); wins over `size`. |
