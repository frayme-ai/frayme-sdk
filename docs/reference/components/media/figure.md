# Figure

A semantic figure: an image with a muted caption (and optional credit). An invalid/absent `src` shows an aspect-locked placeholder. `ratio` locks the frame; `align` positions the block.

## Example

```json
{
  "root": "figure",
  "elements": {
    "figure": {
      "type": "Figure",
      "props": {
        "src": "https://example.com/chart.png",
        "alt": "Revenue chart",
        "caption": "Q4 revenue by product line"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `string` | Image URL (raster image src; svg+xml/blob rejected → placeholder). |
| `alt` | `string` | Alternative text describing the image for screen readers and when the image fails to load (a11y; default empty). Set it on every content image; leave empty only for purely decorative figures. |
| `caption` | `string` | Muted caption line under the image (e.g. "Q4 revenue by product line"). Combines with `credit` on one line ("caption — credit"); omit for no caption. |
| `credit` | `string` | Optional attribution line appended to the caption (e.g. "Photo: NASA"). |
| `align` | `"start" \| "center" \| "end"` | Horizontal alignment of the figure block (default center). |
| `ratio` | `"auto" \| "16/9" \| "4/3" \| "1/1" \| "21/9" \| "3/2"` | Aspect ratio of the image frame: auto (natural, default) · 16/9 · 4/3 · 1/1 · 21/9 (ultrawide/panoramic) · 3/2. |
| `fit` | `"cover" \| "contain"` | How the image fills a locked `ratio` frame: cover (crop to fill, default) · contain (letterbox the whole image on a muted mat — use for charts/diagrams/screenshots where cropping loses content). No effect when `ratio` is auto. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding of the media frame: none · sm · md (default) · lg · full. |
| `radiusValue` | `string \| number` | Exact corner radius of the media frame (e.g. "12px" / "0.75rem"; 0–64px). Overrides the `radius` enum, which is the default. |
| `bordered` | `boolean` | Draw a border around the image frame using `borderColor`/`borderStyle` (default false — no border). |
| `borderColor` | `string` | Border colour when `bordered` is set (default the border token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style when `bordered` is set: solid (default) · dashed · dotted. |
| `width` | `string \| number` | Width of the media block (e.g. "480px", "100%"; default fills the container). Applied as a fixed width, not a max-width — a value wider than the parent column will overflow rather than shrink. |
| `mutedColor` | `string` | Secondary/muted text colour — the caption and credit line under the image (default the muted-foreground token). |
| `opacity` | `"25" \| "50" \| "75" \| "90" \| "full"` | Dim/watermark the figure: full (default) · 90 · 75 · 50 · 25. |
