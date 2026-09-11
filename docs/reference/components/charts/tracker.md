# Tracker

A row of equal-width status blocks (Tremor-style tracker). Each block is colored by its `tone` token (success/warning/critical/…) or an exact `color`, with a native hover `tooltip`. Ideal for uptime/health strips.

## Example

```json
{
  "root": "tracker",
  "elements": {
    "tracker": {
      "type": "Tracker",
      "props": {
        "data": [
          {
            "tone": "success",
            "tooltip": "Operational"
          },
          {
            "tone": "success",
            "tooltip": "Operational"
          },
          {
            "tone": "warning",
            "tooltip": "Degraded"
          },
          {
            "tone": "success",
            "tooltip": "Operational"
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
| `data` | `({ tone: "neutral" \| "success" \| "warning" \| "critical" \| "info", color: string, tooltip: string, label: string })[]` | The blocks, left→right; each is { tone?, color?, tooltip?, label? }. Great for an uptime / health strip. |
| `size` | `"sm" \| "md" \| "lg"` | Block height: sm (24px) · md (36px, default) · lg (48px). Block width is always equal-flex across the strip. |
| `rounded` | `boolean` | Round each block’s corners at 3px (default true); false renders sharp square blocks. |
| `showLabels` | `boolean` | Render each block’s `label` beneath it (default false). |
| `gap` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Spacing between blocks: none (0) · sm (2px, default) · md (4px) · lg (6px) · xl (8px). |
| `mutedColor` | `string` | Secondary/muted text colour — the per-block labels beneath the blocks and the empty-state caption (default the muted-foreground token). |
| `emptyText` | `string` | Override the empty-state message shown when there are no blocks (default "No data"). |
| `ariaLabel` | `string` | Override the screen-reader summary of the tracker (default "Status tracker, N segments"). |
