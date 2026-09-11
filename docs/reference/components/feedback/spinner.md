# Spinner

Animated loading indicator (`variant`: ring · dots · bars) for a busy state with no known completion percentage. Use over Progress when duration is unknown or the wait is brief; use over Skeleton when there is no content shape to preview yet (e.g. an inline button/page-level spinner rather than a layout placeholder).

## Example

```json
{
  "root": "spinner",
  "elements": {
    "spinner": {
      "type": "Spinner",
      "props": {
        "size": "md",
        "sizeValue": null,
        "label": "Loading…",
        "tone": null,
        "variant": "ring",
        "speed": null,
        "thickness": null,
        "labelPosition": null,
        "color": null,
        "trackColor": null,
        "mutedColor": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Glyph diameter in coarse steps: xs · sm · md (default) · lg · xl. For an exact pixel size (variant:ring only) use `sizeValue`. |
| `sizeValue` | `string \| number` | Exact glyph box diameter (width + height, e.g. "48px" / "3rem"). Overrides the `size` enum (which is the default) for variant:ring; dots/bars keep the enum. |
| `label` | `string` | Text shown beside/under the spinner glyph, positioned via `labelPosition` (e.g. "Loading…"). Omit for a bare glyph with only an aria-only fallback. |
| `tone` | `"default" \| "muted" \| "success" \| "warning" \| "critical" \| "info"` | Colour of the moving arc/glyph via a semantic token: default (primary) · muted · success · warning · critical · info. Use `muted` for a low-key inline wait; `color` sets an exact value instead. |
| `variant` | `"ring" \| "dots" \| "bars"` | Spinner glyph style: ring (a rotating arc, default) · dots (pulsing dots) · bars (scaling bars). Ring is the general default; dots/bars read as lighter, more playful waits. |
| `speed` | `"slow" \| "normal" \| "fast"` | Ring rotation speed (default normal). Applies to variant:ring (dots/bars use a fixed cadence). |
| `thickness` | `"thin" \| "regular" \| "thick"` | Ring stroke width (default regular). Applies to variant:ring. |
| `labelPosition` | `"right" \| "bottom" \| "none"` | Where the label sits: right (default) · bottom · none (aria-only). |
| `color` | `string` | Exact colour of the moving active arc/glyph, naming a specific brand colour; wins over the `tone` token. Reach for it when the spinner sits on a branded surface. |
| `trackColor` | `string` | Exact colour of the inactive (unfilled) ring behind the moving arc — variant:ring only (default the border token). Set it for contrast on a dark/tinted surface; dots/bars have no track. |
| `mutedColor` | `string` | Secondary/muted text colour — the label beside/under the spinner (default the muted-foreground token). |
