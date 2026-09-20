# Timeline

A vertical or horizontal sequence of events, each a dot on a connector line with a title, optional time/description, and icon. A dot uses its item `tone` color or the timeline `accent`; an `active` item is highlighted. Display-only, works with no binding.

## Example

```json
{
  "root": "timeline",
  "elements": {
    "timeline": {
      "type": "Timeline",
      "props": {
        "items": [
          {
            "title": "Order placed",
            "time": "09:24",
            "tone": "success"
          },
          {
            "title": "Packed",
            "time": "11:02",
            "description": "Left the warehouse."
          },
          {
            "title": "Out for delivery",
            "time": "14:18",
            "active": true,
            "tone": "info"
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
| `items` | `({ title: string, time: string, description: string, icon: string, tone: "neutral" \| "success" \| "warning" \| "critical" \| "info", color: string, active: boolean })[]` | The ordered events. Each: a title, an optional time/description, an optional icon NAME (closed registry, rendered inside the dot ONLY at size lg; at sm/md the dot is too small and the icon is ignored), a tone (or exact `color`) for its dot, and an `active` highlight flag. |
| `orientation` | `"vertical" \| "horizontal"` | Lay the events top-to-bottom (vertical, default) or left-to-right (horizontal). `align:alternate` applies only when vertical. |
| `align` | `"left" \| "alternate"` | Vertical layout: left (all events on one side of the line, default) · alternate (events zig-zag either side). Ignored when horizontal. |
| `size` | `"sm" \| "md" \| "lg"` | Overall scale of the timeline, dot diameter, title text size, and the connector offsets that track them (default md). Item icons render inside the dot ONLY at lg. |
| `accent` | `string` | Color of the dots when an item has no `tone`/`color` (default a neutral muted tone, matching TimelineItem's own tone-less default, until set). Names a specific brand color. |
| `connectorColor` | `string` | Color of the connector line/rail between the event dots (default the border token). |
| `mutedColor` | `string` | Secondary/muted text colour, the per-item time and description lines (default the muted-foreground token). |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the event titles (default medium; an `active` item is bolder unless this is set). Set to override the baked title weight. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the event titles (default normal). Set to tighten or loosen the title tracking. |
