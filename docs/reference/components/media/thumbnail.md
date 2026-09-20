# Thumbnail

A small fixed-size preview image (object-cover) for lists and cards. An invalid/absent `src` falls back to a muted block with `fallbackInitials` centered. Reach for it as an avatar or list-row thumbnail where you want a guaranteed square that never breaks layout, pick the box with the `size` enum or an exact `sizeValue`, and set `radius` to `full` for a circular avatar.

## Example

```json
{
  "root": "thumbnail",
  "elements": {
    "thumbnail": {
      "type": "Thumbnail",
      "props": {
        "src": "https://example.com/avatar.png",
        "alt": "Ada Lovelace",
        "size": "md",
        "fallbackInitials": "AL"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `string` | Image URL (raster image src; svg+xml/blob rejected → initials fallback). |
| `alt` | `string` | Alternative text describing the thumbnail image for screen readers and on load failure (a11y; default empty). Set it to the person or object shown (e.g. a name for an avatar); leave empty for a decorative tile. |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Fixed square size: xs (24px) · sm (32px) · md (48px, default) · lg (64px) · xl (96px). |
| `sizeValue` | `string \| number` | Exact square size, both width and height (e.g. "40px" / "2.5rem"; 16-256px). Overrides the `size` enum, which is the default. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding: none · sm · md (default) · lg · full (circle). |
| `radiusValue` | `string \| number` | Exact corner radius of the thumbnail (e.g. "10px" / "0.5rem"; 0-64px). Overrides the `radius` enum, which is the default. |
| `bordered` | `boolean` | Draw a subtle border around the thumbnail using `borderColor`/`borderStyle` (default false, no border). Reach for it to separate a light image from a light card, or to ring an avatar. |
| `borderColor` | `string` | Border colour when `bordered` is set (default the border token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style when `bordered` is set: solid (default) · dashed · dotted. |
| `fallbackInitials` | `string` | Initials shown in a muted block when `src` is missing/invalid (e.g. "AC"). |
| `opacity` | `"25" \| "50" \| "75" \| "90" \| "full"` | Dim the thumbnail: full (default) · 90 · 75 · 50 · 25. |
