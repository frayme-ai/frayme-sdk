# Badge

Compact status or count chip holding a 1-3 word `text` ("Active", "Beta", "12 new"). Reach for it to label an item's state or a small count inline — next to a title, in a table cell, on a nav item — not for sentences or actions. `tone` colours it by semantic intent (success/warning/critical/info) and is the preferred channel; `variant` (default/secondary/destructive/outline) sets visual weight, and an optional leading `dot` plus `pill`/`rounded`/`square` shape tune the look.

## Example

```json
{
  "root": "badge",
  "elements": {
    "badge": {
      "type": "Badge",
      "props": {
        "text": "Active",
        "variant": "default"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `text` | `string` | The badge label. Keep to 1-3 words ("Active", "Beta", "12 new") — Badge is a compact status/count chip, not a sentence. |
| `variant` | `"default" \| "secondary" \| "destructive" \| "outline"` | Visual hierarchy: default (solid primary) · secondary (muted fill) · destructive (danger fill) · outline (bordered, transparent). `tone` is the newer semantic-intent channel — prefer it for status meaning; `variant` stays for visual weight. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent (decoupled from variant): neutral · success · warning · critical · info |
| `size` | `"sm" \| "md" \| "lg"` | Padding + font size of the whole badge chip (default md). |
| `shape` | `"pill" \| "rounded" \| "square"` | Corner shape: pill (fully round, default) · rounded · square. |
| `dot` | `boolean` | Show a small leading status dot before the `text` (default false = no dot). Color follows `dotColor`, or derives from `tone`/`bg` when unset. |
| `uppercase` | `boolean` | Uppercase the label with slight tracking (status-chip look). |
| `bg` | `string` | Exact background fill (brand badge). Wins over tone/variant. |
| `color` | `string` | Exact label text colour, naming a specific brand colour; wins over the `tone`/`variant` token. Pair it with a custom `bg` so the label stays legible on the fill. |
| `borderColor` | `string` | Exact border colour, naming a specific edge colour (wins over `tone`/`variant`). Most useful with `variant:outline`, where the border is the visible chrome. |
| `dotColor` | `string` | Colour of the leading status dot shown when `dot` is on (default derives from `tone`/`bg`). Set it to make the dot a distinct signal colour from the chip fill. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the badge label; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the badge label (light · normal · medium · semibold · bold; default medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the badge label (tighter · tight · normal · wide · wider; default normal, or wide when `uppercase`). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the badge label (tight · snug · normal · relaxed · loose; default the size default). |
| `fontSize` | `string \| number` | Exact font size of the badge label (e.g. "13px" / "0.8125rem"). Overrides the `size` enum font size, which is the default (md ≈ 0.75rem). |
