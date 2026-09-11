# Image

Image component: renders an img tag when `src` is set, otherwise a muted placeholder box showing the `alt` text (the same fallback when a load fails). Reach for it for general pictures — photos, screenshots, illustrations — sizing the box with `width`/`height`/`aspect` and cropping via `fit`/`position`; use Avatar for a person/account thumbnail instead. `alt` is required for accessibility, and unsafe URL schemes (javascript:/file:) are rejected while https/relative/data: are allowed.

## Example

```json
{
  "root": "image",
  "elements": {
    "image": {
      "type": "Image",
      "props": {
        "src": "https://images.example.com/team-standup.jpg",
        "alt": "Team standup in the office",
        "width": null,
        "height": null,
        "aspect": "16/9",
        "fit": "cover",
        "position": null,
        "radius": null,
        "radiusValue": null,
        "border": null,
        "borderWidthValue": null,
        "shadow": null,
        "loading": null,
        "borderColor": null,
        "mutedColor": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `string` | Image URL (https/relative/data: allowed; javascript:/file: schemes rejected). When omitted or the load fails, a muted placeholder box showing the `alt` text renders instead. |
| `alt` | `string` | Alternative text describing the image — REQUIRED for a11y; also shown inside the fallback placeholder. Describe the content ("Team standup in the office"), not the file. |
| `width` | `string \| number` | Box width (accepts units, e.g. "100%" or "320px"). Omit for intrinsic/auto. |
| `height` | `string \| number` | Box height (e.g. "240px"). Omit for intrinsic/auto. |
| `aspect` | `"auto" \| "1/1" \| "4/3" \| "3/2" \| "16/9" \| "21/9" \| "3/4"` | Aspect-ratio box (pairs with one of width/height). A common-ratio ENUM, not a free dimension. |
| `fit` | `"cover" \| "contain" \| "fill" \| "none"` | object-fit: how the image fills the box (default cover). |
| `position` | `"center" \| "top" \| "bottom" \| "left" \| "right"` | object-position focal point kept in view when `fit:cover` crops the image: center (default) · top · bottom · left · right. Set it so faces/subjects at an edge are not cropped out. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding: none · sm · md (default, the theme radius) · lg · full (9999px). For an exact value use `radiusValue`. |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "10px" / "0.5rem"). Overrides the `radius` enum, which is the default. |
| `border` | `boolean` | Draw a 1px border in the token border color (default false). `borderColor`/`borderWidthValue` imply it — set those to tint or thicken the edge. |
| `borderWidthValue` | `string \| number` | Exact border thickness (e.g. "2px"; implies a border). Overrides the 1px default. |
| `shadow` | `"none" \| "sm" \| "md" \| "lg"` | Drop shadow depth: none (default) · sm · md · lg. Applies to the image and its placeholder alike. |
| `loading` | `"lazy" \| "eager"` | Native `loading` attribute controlling fetch timing: lazy (default — defer until near the viewport) · eager (fetch immediately). Set `eager` for an above-the-fold hero so it is not held back. |
| `borderColor` | `string` | Border color (implies a border). Names a specific edge color. |
| `mutedColor` | `string` | Secondary/muted text colour — the placeholder caption shown when no image loads (default the muted-foreground token). |
