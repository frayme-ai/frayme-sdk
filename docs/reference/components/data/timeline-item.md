# TimelineItem

A single timeline entry — a dot (with optional icon), a connector line, and a title/time/description — for composing a custom timeline row by row. Set `last` on the final entry to drop the trailing connector. The default slot renders extra content under the body.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "timeline-item",
  "elements": {
    "timeline-item": {
      "type": "TimelineItem",
      "props": {
        "title": "Deployed to production",
        "time": "2m ago",
        "tone": "success"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | The entry headline — one short line (truncates), shown beside the optional `time`. Bolder when `active` is set. |
| `time` | `string` | Optional timestamp / meta line shown beside or under the title. |
| `description` | `string` | Optional supporting body text under the title (plain text — no markdown/HTML). |
| `icon` | `string` | Optional icon glyph NAME (from the closed icon registry (or a single emoji glyph, rendered as-is)) shown inside the dot. Unknown names render the plain dot. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color of the dot (neutral default · success · warning · critical · info). |
| `active` | `boolean` | Emphasize this entry (ring + bolder title) — use for the current step. |
| `last` | `boolean` | Hide the trailing connector line below the dot — set on the final entry of a hand-composed timeline. |
| `dotColor` | `string` | Exact dot color, overriding `tone` (a precise brand color). Drives `--fr-timelineitem-dot`; the `active` emphasis ring follows it too. |
| `connectorColor` | `string` | Color of the trailing connector line below the dot (default the border token) — parity with Timeline `connectorColor` for hand-composed timelines. |
| `mutedColor` | `string` | Secondary/muted text colour — the time line and the description body (default the muted-foreground token). |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the entry title (default medium; an `active` entry is bolder unless this is set). Set to override the baked title weight. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the entry title (default normal). Set to tighten or loosen the title tracking. |
