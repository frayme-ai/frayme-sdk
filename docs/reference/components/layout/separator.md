# Separator

Thin rule that visually divides adjacent content — horizontal by default, vertical for inline splits (`orientation`). Use it between list sections or form groups instead of adding a border to a wrapper; an optional centered `label` renders on the line (e.g. "OR" between auth methods). Purely decorative: no children, no events.

## Example

```json
{
  "root": "separator",
  "elements": {
    "separator": {
      "type": "Separator",
      "props": {
        "orientation": "horizontal",
        "thickness": null,
        "spacing": null,
        "style": null,
        "color": null,
        "labelColor": null,
        "length": null,
        "label": "OR"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical"` | Line direction: horizontal (a full-width rule, default) · vertical (a short upright rule for inline splits; default height 1.5rem — set `length` to change). |
| `thickness` | `"hairline" \| "thin" \| "thick"` | Line weight: hairline (1px, default) · thin (2px) · thick (4px). |
| `spacing` | `"none" \| "sm" \| "md" \| "lg"` | Margin around the line. Increase for a roomier section break. |
| `style` | `"solid" \| "dashed" \| "dotted"` | Line pattern: solid (default) · dashed · dotted. A dashed/dotted rule reads as a softer, more informal break. |
| `color` | `string` | Line color. Names a specific divider color when the border token is not what you want. |
| `labelColor` | `string` | Text colour of the centered `label` on a labelled divider, in either orientation (default the muted-foreground token) — independent of the line `color`. |
| `length` | `string \| number` | Explicit length (width when horizontal, height when vertical), e.g. "60%" for a short centered divider — works with and without a `label` (a labelled divider centers at that width). |
| `label` | `string` | Optional centered label rendered on the line, in either orientation: horizontal draws it between two horizontal rules, vertical stacks it between two vertical rules (e.g. "OR" between two side-by-side panels). |
