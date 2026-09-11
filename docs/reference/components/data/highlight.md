# Highlight

Wraps every `query` match inside `text` in &lt;mark> spans — reach for it to highlight the search terms within a result snippet or any matched string. The `query` is space-split into multiple terms and matched case-insensitively by default (flip `caseSensitive`/`wholeWord` to tighten it). Renders escaped React text only, never innerHTML, and tint the marks via the `tone` preset or an exact `accent`/`accentText` color.

## Example

```json
{
  "root": "highlight",
  "elements": {
    "highlight": {
      "type": "Highlight",
      "props": {
        "text": "The quick brown fox",
        "query": "quick"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `text` | `string` | The full text to display, with `query` matches wrapped in `<mark>` (e.g. a search-result snippet). Empty renders nothing. |
| `query` | `string` | The substring(s) to mark; space-split into multiple terms. Empty → plain text, no marks. |
| `caseSensitive` | `boolean` | Match the query case-sensitively (default false — case-insensitive). |
| `wholeWord` | `boolean` | Only mark matches that are whole words (default false — substring matches). |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Preset mark background when no `accent` is set: neutral (muted) · success · warning (default, amber) · critical · info. Ignored once `accent` is set. |
| `accent` | `string` | Background color for the marked spans (default a translucent warning token). |
| `accentText` | `string` | Text colour ON the marked spans, paired with `accent` (default the foreground token) — set it to keep a saturated highlight legible. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole highlighted-text region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the displayed text (light · normal · medium · semibold · bold; default inherited from the surrounding text). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the displayed text (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the displayed text (tight · snug · normal · relaxed · loose; default inherited). |
| `fontSize` | `string \| number` | Exact font size of the displayed text (e.g. "20px" / "1.25rem"). Default inherited from the surrounding text. |
