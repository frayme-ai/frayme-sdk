# Text

Paragraph or inline body copy holding a single plain-text string. Reach for it for prose, captions, help lines, and code snippets, anything that is not a structural title (use Heading for those). `variant` (body · caption · muted · lead · code) is the main lever, bundling size+tone+style, and the individual size/weight/tone/clamp props override it; `truncate` clips to one line and `clamp` caps at N lines with an ellipsis.

## Example

```json
{
  "root": "text",
  "elements": {
    "text": {
      "type": "Text",
      "props": {
        "text": "Hello, world!"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `text` | `string` | The text content (plain string, no markdown/HTML). One Text per paragraph; compose several in a Stack for multi-paragraph copy. |
| `variant` | `"body" \| "caption" \| "muted" \| "lead" \| "code"` | Preset bundle (size+tone+style). The primary lever; the props below override it. |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Font size step, overriding whatever the `variant` preset sets: xs · sm · md · lg · xl. Drop to `sm`/`xs` for captions/fine print; use `fontSize` for an exact length. |
| `fontSize` | `string \| number` | Exact font size (e.g. "32px" / "2rem"). Overrides the `size` enum and `variant` preset, which are the default. |
| `weight` | `"normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the text: normal (default) · medium · semibold · bold. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing: tighter · tight · normal · wide · wider (default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height: tight · snug · normal · relaxed · loose (default follows the size step). |
| `align` | `"left" \| "center" \| "right" \| "justify"` | Horizontal text alignment: left (default) · center · right · justify. |
| `tone` | `"default" \| "muted" \| "success" \| "warning" \| "critical" \| "info"` | Semantic text color via token. Use for warning/success copy. |
| `italic` | `boolean` | Render the text in italics (default false). Style-only, combines with any variant/weight. |
| `truncate` | `boolean` | Clip to ONE line with a trailing ellipsis on overflow (default false). For multi-line clipping use `clamp`. |
| `mono` | `boolean` | Monospace font (separate from variant:code which also boxes it). |
| `color` | `string` | Exact text color, e.g. "#6d28d9" (wins over `tone` and the variant preset; default: inherits the surrounding foreground). |
| `bg` | `string` | Chip background fill for variant:code only (default the muted token). Pair a dark value with a light `color` for a brand code chip; ignored on other variants. |
| `clamp` | `string \| number` | Multi-line clamp to N lines (1-6) with an ellipsis (-webkit-line-clamp). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for this text (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
