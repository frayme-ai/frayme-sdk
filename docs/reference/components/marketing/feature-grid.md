# FeatureGrid

A responsive grid of features. Pass a `features` array to render a FeatureCard per entry, OR drop FeatureCard children into the slot. `columns` (1-4) sets the grid; it collapses to one column on narrow screens.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "feature-grid",
  "elements": {
    "feature-grid": {
      "type": "FeatureGrid",
      "props": {
        "columns": 3,
        "features": [
          {
            "icon": "sparkles",
            "title": "Generative UI",
            "description": "Apps from natural language."
          },
          {
            "icon": "lock",
            "title": "Secure by default",
            "description": "No credentials ever proxied."
          },
          {
            "icon": "send",
            "title": "Ship anywhere",
            "description": "Claude, ChatGPT, web embed."
          }
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `columns` | `string \| number` | Number of columns in the responsive grid (1-4, default 3). Collapses to 1 on narrow viewports. |
| `gap` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Spacing between feature cells in the grid: none · sm · md (default) · lg · xl. Reach for `lg`/`xl` to give a sparse 2-3 feature grid room to breathe, `sm` to pack a dense feature wall. |
| `align` | `"start" \| "center"` | Text alignment inside each generated FeatureCard: start (left, default) · center. |
| `variant` | `"plain" \| "bordered" \| "elevated"` | Surface treatment applied UNIFORMLY to every generated FeatureCard: plain (no chrome, default) · bordered (border) · elevated (border + shadow). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface applied UNIFORMLY to every generated FeatureCard in the data-driven grid (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the feature titles in the data-driven grid (default semibold). Applies to every generated FeatureCard title. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of every generated FeatureCard title in the data-driven grid (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of every generated FeatureCard title in the data-driven grid (tight · snug · normal · relaxed · loose; default normal). |
| `fontSize` | `string \| number` | Exact font size of every generated FeatureCard title (e.g. "18px" / "1.125rem"; default 1rem). Cascades via CSS inheritance to each card. |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style applied UNIFORMLY to every generated FeatureCard when `variant` is bordered/elevated: solid (default) · dashed · dotted. |
| `borderWidthValue` | `string \| number` | Exact border thickness applied UNIFORMLY to every generated FeatureCard when `variant` is bordered/elevated (e.g. "2px"; default 1px). Cascades via CSS inheritance to each card. |
| `features` | `({ icon: string, title: string, description: string })[]` | Data-driven features (icon + title + description). When set, the grid renders a FeatureCard per entry. Omit to render child FeatureCards (slot) instead. |
| `accent` | `string` | Text colour of the icon glyph in every generated FeatureCard chip (default the primary token); `iconBg` paints the chip behind it. Cascades via CSS inheritance to each card. |
| `iconBg` | `string` | Fill colour of the icon chip behind each generated FeatureCard glyph (default the muted token). Set a tinted brand fill (e.g. a soft accent wash) for the tinted-chip marketing look. Cascades via CSS inheritance to each card. |
| `borderColor` | `string` | Border colour applied UNIFORMLY to every generated FeatureCard when `variant` is bordered/elevated (default the border token). Cascades via CSS inheritance to each card. |
| `color` | `string` | Primary text colour — the feature titles in the data-driven grid (default the foreground token). |
| `mutedColor` | `string` | Secondary/muted text colour — the feature descriptions in the data-driven grid (default the muted-foreground token). |
| `titleLevel` | `"h1" \| "h2" \| "h3" \| "h4"` | Heading level of EVERY generated FeatureCard title (default h3 — a feature card is content under a section heading). Set it to h2 when the grid sits directly under the PageHeader with no section heading between, so the screen's headings nest legally — a document that jumps h1 to h3 has no outline for anyone navigating by heading. |
