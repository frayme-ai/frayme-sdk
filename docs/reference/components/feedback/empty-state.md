# EmptyState

Zero-data placeholder panel: centered icon + title + description, with an optional call-to-action (children, e.g. a Button). Use when a list/table/search has no results yet.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "empty-state",
  "elements": {
    "empty-state": {
      "type": "EmptyState",
      "props": {
        "title": "No results",
        "description": "Try adjusting your filters.",
        "icon": "search"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | The zero-data headline (e.g. "No results"). Short and neutral — pair with `description` for the "what to do next" guidance. |
| `description` | `string` | Supporting copy explaining the empty state / what to do next. |
| `icon` | `string` | Centered illustrative icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "search", "mail", "calendar"). Never raw SVG; unknown names render nothing. |
| `size` | `"sm" \| "md" \| "lg"` | Icon + type scale and vertical padding (default md). |
| `align` | `"center" \| "start"` | Content alignment: center (default — classic centered empty state) · start (left-aligned). |
| `mutedColor` | `string` | Secondary/muted text colour — the supporting description line under the title AND (when set) the focal icon disk: its glyph plus a soft 12% tinted disk fill (default the muted-foreground token / muted disk). |
| `fontSize` | `string \| number` | Exact title font-size (e.g. 22px / 1.375rem). Overrides ONLY the title type scale of the `size` enum (the default); icon size + panel padding stay on `size`. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Title font weight (default semibold). Reach for `bold` for a heavier heading or `medium`/`normal` for a softer one. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole empty-state panel; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the `title` (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the `title` (tight · snug · normal · relaxed · loose; default normal — sm sets it explicitly, md/lg inherit the browser normal). |
| `titleLevel` | `"h1" \| "h2" \| "h3" \| "h4"` | Heading level for the `title` (default h3 — a state panel is content inside a Card, whose title is h2). Set it to h2 when the panel sits directly under the PageHeader with no Card around it, so the screen's headings nest legally — a document that jumps h1 to h3 has no outline for anyone navigating by heading. |
