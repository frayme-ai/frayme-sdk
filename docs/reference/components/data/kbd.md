# Kbd

Renders one or more keyboard keys as styled `<kbd>` chips joined by "+" (e.g. "Cmd + K") — for documenting shortcuts inline in text or a command palette. Pass `keys` as a single string or an ordered array; renders escaped text only, never markup. `font`/`bg`/`color`/`borderColor` style the region and chips.

## Example

```json
{
  "root": "kbd",
  "elements": {
    "kbd": {
      "type": "Kbd",
      "props": {
        "keys": [
          "Cmd",
          "K"
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `keys` | `string \| string[]` | A single key string or an ordered array of keys (e.g. ["Cmd","K"]); joined with a thin "+" separator. |
| `size` | `"sm" \| "md" \| "lg"` | Key chip height + text size: sm (h-5, 11px) · md (h-6, 12px, default) · lg (h-7, 14px). |
| `variant` | `"solid" \| "outline"` | Chip style: solid (filled muted background + 3D key-lip shadow, default) · outline (bordered, transparent background). |
| `color` | `string` | Primary text colour for the key glyphs on the chips (default the foreground token). |
| `mutedColor` | `string` | Secondary/muted text colour for the "+" separators between keys (default the muted-foreground token). |
| `borderColor` | `string` | Border colour for the key chips, including the solid variant’s 3D key-lip shadow (default the border token). |
| `bg` | `string` | Fill colour for the solid-variant key chips (default the muted token). Ignored on the outline variant (transparent chips). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole shortcut region incl. the chips (sans · serif · mono · rounded · display; default sans). `mono` is a natural fit for key glyphs. |
