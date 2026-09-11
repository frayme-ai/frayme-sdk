# Section

Page section band with vertical rhythm and an optional eyebrow/title header. Use to break a page into stacked, breathing sections. Children render below the header.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "section",
  "elements": {
    "section": {
      "type": "Section",
      "props": {
        "spacing": "lg",
        "title": "Features",
        "eyebrow": "WHY FRAYME"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `spacing` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Vertical padding (top+bottom) that sets the rhythm between page bands (default md). `xl` for a generous hero/landing band. |
| `paddingValue` | `string \| number` | Exact vertical band padding (top+bottom, e.g. "160px" / "10rem"). Overrides the `spacing` enum, which is the default. |
| `maxWidth` | `"narrow" \| "default" \| "wide" \| "full"` | Inner content max-width: narrow (~40rem) · default (~64rem) · wide (~80rem) · full (edge-to-edge). Controls how wide the band content reads. (An ENUM — distinct from the dimension `width` channel — so it is never gate-flagged.) |
| `align` | `"start" \| "center" \| "end"` | Text alignment of the eyebrow/title/content (default start). `center` for a centered section header. |
| `eyebrow` | `string` | Small uppercase kicker line shown above the title (e.g. "FEATURES"). Omit when there is no title. |
| `title` | `string` | Section heading rendered above the children. Omit for an untitled band. |
| `bg` | `string` | Full-bleed band background color (e.g. a tinted/dark strip). Omit for transparent. |
| `color` | `string` | On-band text colour — the section title AND all band content (cascades from the section root; default the foreground token). Set it alongside a saturated/dark `bg` so the heading and children stay legible; the eyebrow keeps `mutedColor`. |
| `mutedColor` | `string` | Secondary/muted text colour — the small uppercase eyebrow kicker (default the muted-foreground token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the band header and everything inside it (cascades): sans · serif · mono · rounded · display. Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the section title only: light · normal · medium · semibold (default) · bold. Reach for `bold` for a louder hero header. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the section title only: tighter · tight · normal · wide · wider. `tight` tightens a large display heading. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the section title only: tight (default) · snug · normal · relaxed · loose. Loosen for a multi-line title that needs air. |
| `fontSize` | `string \| number` | Exact font-size of the section title only (e.g. "2rem" / "32px"). Default 1.5rem. Size up for a louder hero header. |
