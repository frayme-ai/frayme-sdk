# LogoCloud

A row/grid of partner or customer logos with an optional muted heading. `grayscale` mutes them until hover; `columns` (2-8) sets the layout. Each logo can link out (guarded). A failed/absent image degrades to its alt text.

## Example

```json
{
  "root": "logo-cloud",
  "elements": {
    "logo-cloud": {
      "type": "LogoCloud",
      "props": {
        "title": "Trusted by teams at",
        "items": [
          {
            "src": "https://cdn.example.com/acme.png",
            "alt": "Acme"
          },
          {
            "src": "https://cdn.example.com/globex.png",
            "alt": "Globex"
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
| `items` | `({ src: string, alt: string, href: string })[]` | The logos: each {src, alt, href?}. A failed/absent src degrades to the alt text; href wraps the logo in a guarded &lt;a>. |
| `title` | `string` | Optional muted heading above the logos (e.g. "Trusted by teams at"). |
| `columns` | `string \| number` | Logos per row (2-8, default 5). Collapses on narrow viewports. |
| `grayscale` | `boolean` | Render logos muted/desaturated until hover (the classic logo-wall treatment, default true). |
| `size` | `"sm" \| "md" \| "lg"` | Logo height enum: sm (1.5rem) · md (2rem, default) · lg (3rem). Width stays auto for aspect; overridden by the exact `height` value channel when set. |
| `height` | `string \| number` | Exact logo height (e.g. "40px" / "2.5rem"; width stays auto for aspect). Overrides the `size` enum, which is the default. |
| `mutedColor` | `string` | Secondary/muted text colour, the heading above the logos and the alt-text fallback of a failed/absent logo (default the muted-foreground token). |
