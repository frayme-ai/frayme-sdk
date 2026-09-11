# Label

Form/inline label. Renders a &lt;label> (with `htmlFor` when set to wire it to a control) plus an optional required `*` marker. Reach for this standalone Label when a control sits apart from a FormField group and still needs a caption — set `htmlFor` to the control's id so clicking the label focuses it. Style it with `size`/`weight`/`tracking` or an exact `fontSize`/`color` to match the surrounding form density.

## Example

```json
{
  "root": "label",
  "elements": {
    "label": {
      "type": "Label",
      "props": {
        "text": "Full name",
        "htmlFor": "name",
        "required": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `text` | `string` | The label text. Keep to 1-4 words, e.g. "Full name" — not a sentence. |
| `htmlFor` | `string` | The id of the control this label captions (renders htmlFor). Omit for a plain inline label. |
| `required` | `boolean` | Show a required `*` marker after the label text (default false). Set true when the captioned control must be filled in, mirroring the control's own required state. |
| `size` | `"sm" \| "md" \| "lg"` | Font size (default md; sm=13px, md=14px, lg=16px). |
| `fontSize` | `string \| number` | Exact label font size (e.g. "13px" / "0.9rem"). Overrides the `size` enum, which is the default. |
| `color` | `string` | Exact label text color (default the foreground token). Names a specific color when the theme default is not what you want. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole label region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the label text (default medium); set to dial the emphasis up or down. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the label text (default normal); reach for `wide`/`wider` on an uppercase caption. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the label text (default snug-ish from the size); reach for `relaxed` on a multi-line label. |
