# HoverCard

A trigger (text label or wrapped children) that reveals a rich preview card, title + description + optional avatar image, on hover or keyboard focus. Choose this over Toggletip when the reveal has structured content (a person/entity preview) rather than a single line of help text; unlike Toggletip it opens passively on hover/focus, not click. Set `trigger` for a plain text anchor, or drop children into the slot to make an arbitrary element the hover target; the `description` clamps to 3 lines so keep the preview copy tight.

## Example

```json
{
  "root": "hover-card",
  "elements": {
    "hover-card": {
      "type": "HoverCard",
      "props": {
        "trigger": "@frayme",
        "title": "Frayme",
        "description": "Ship MCP Apps without code."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `trigger` | `string` | Trigger label text. When omitted, the first child is used as the trigger. |
| `title` | `string` | Bold heading line inside the revealed card (e.g. a name or title). Truncates to one line if too long. |
| `description` | `string` | Muted body text inside the revealed card, under `title` (e.g. a short bio). Clamped to 3 lines. |
| `imageSrc` | `string` | Optional avatar/preview image URL shown in the card (http/https or raster data URI only). |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | Which side of the trigger the bubble/card opens on (default top for Toggletip, bottom for HoverCard). |
| `accent` | `string` | Accent color for the trigger underline (default currentColor, i.e. it matches the trigger text until set) + card border (default the border token). |
| `color` | `string` | Primary text colour for the card title (default the foreground token). |
| `mutedColor` | `string` | Secondary/muted text colour, the card description line (default the muted-foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow depth of the floating preview card, set to lift or flatten it (default lg). |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for the revealed card (fast/normal/slow). Default: no animation, appears instantly. |
