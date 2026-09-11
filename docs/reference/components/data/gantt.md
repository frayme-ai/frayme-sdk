# Gantt

A read-only Gantt / timeline chart: each task is a horizontal bar positioned on a shared 0..rangeMax axis (left = start, width = end-start). Use for project schedules, phase plans, or any set of intervals on one axis. Not interactive.

## Example

```json
{
  "root": "gantt",
  "elements": {
    "gantt": {
      "type": "Gantt",
      "props": {
        "tasks": [
          {
            "label": "Design",
            "start": 0,
            "end": 3
          },
          {
            "label": "Build",
            "start": 2,
            "end": 7
          },
          {
            "label": "Launch",
            "start": 7,
            "end": 9
          }
        ],
        "rangeMax": 9
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `tasks` | `({ label: string, start: number, end: number, color: string })[]` | The rows of the chart, each a { label, start, end, color? } positioned on a shared 0..rangeMax axis. |
| `rangeMax` | `number` | The far end of the axis (default = the largest task `end`). Bars are positioned as start/rangeMax .. end/rangeMax. |
| `palette` | `"brand" \| "cool" \| "warm" \| "neutral"` | Color ramp for bars without their own `color`: brand (primary, default) · cool · warm · neutral. |
| `showGrid` | `boolean` | Show faint vertical gridlines across the timeline (default true). |
| `axisLabels` | `string[]` | Time-axis scale captions (content) drawn as an evenly-spaced row under the timeline — e.g. ["Jan","Feb","Mar","Apr"] or ["0","3","6","9"]. Author-supplied (not auto-generated from `rangeMax`); coloured by `axisColor`. Omit for no axis row. |
| `size` | `"sm" \| "md" \| "lg"` | Bar height + row spacing + font size (default md). |
| `gridColor` | `string` | Exact colour of the faint vertical timeline gridlines (default the border token). |
| `axisColor` | `string` | Text colour of Gantt’s labels — the task names in the left column and the time-axis captions under the timeline when `axisLabels` is set (default the inherited foreground; the axis-caption row falls back to muted-foreground). |
| `trackColor` | `string` | Exact colour of the unfilled timeline track behind each task bar (default the muted token). The same unfilled-track channel BarList/ProgressCircle/Gauge/RadialBar expose. |
| `emptyText` | `string` | Override the empty-state message shown when there is no data (default "No data"). |
| `ariaLabel` | `string` | Override the screen-reader label for the timeline (default the computed "Timeline of N tasks" summary). |
