# MessageContent

A composable message-body block (escaped text, newlines preserved) for when a Message needs richer content than its own `content` string. Drop one or more inside a Message to build a multi-part answer. Reach for this when a single answer mixes formats, a prose paragraph, then a mono tool result, then more prose, each as its own block with its own `variant`/`mono`/`prose` treatment, rather than cramming everything into the Message `content` string. Set `variant:"markdown"` for a SAFE inline subset (bold, italic, inline code) tokenized into escaped React elements, never raw HTML or links.

## Example

```json
{
  "root": "message-content",
  "elements": {
    "message-content": {
      "type": "MessageContent",
      "props": {
        "content": "Here are the three options I found.",
        "prose": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `content` | `string` | The body text to render (escaped React text, whitespace preserved). |
| `variant` | `"text" \| "markdown"` | Rendering mode: text (plain, default) · markdown (a SAFE inline subset, bold, italic, inline code, tokenized into escaped React elements; never raw HTML or links). |
| `mono` | `boolean` | Render in a monospace font (e.g. for a tool result or a snippet). |
| `prose` | `boolean` | Apply relaxed reading width + paragraph spacing for a longer-form answer. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole content block; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the body text: light · normal (default) · medium · semibold · bold. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the body text: tighter · tight · normal (default) · wide · wider. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line height of the body text: tight · snug · normal · relaxed (default) · loose; wins over the prose preset when set. |
| `fontSize` | `string \| number` | Exact font size of the body text (e.g. "16px" / "1rem"). Default 0.875rem (0.85em when `mono`). |
| `color` | `string` | Primary text colour of the body block (default the foreground token). |
