# Task

A single status row in an agent task list / plan: a state icon (circle/spinner/check/x, colored by `state`) + title + optional detail. Stack several inside a Card or Stack to show a multi-step plan progressing. Reach for this when you want a lightweight checklist of the steps an agent is working through, as opposed to a ToolCall card that details one concrete function invocation. Advance each row through `state` (pending→active→done, or error) as work lands so the reader watches the plan complete in place; the `active` row shows an animated spinner tinted by the state tone (or `accent`).

## Example

```json
{
  "root": "task",
  "elements": {
    "task": {
      "type": "Task",
      "props": {
        "title": "Querying the sales table",
        "state": "active"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | The step / task label (e.g. "Fetch the dataset"). Shown next to a status icon. |
| `detail` | `string` | Secondary muted line under the title (e.g. progress note or sub-step). |
| `state` | `"pending" \| "active" \| "done" \| "error"` | Step status, shown as the leading icon + color: pending (empty circle, muted) · active (spinner, accent) · done (check, success) · error (x, danger). Default pending. |
| `accent` | `string` | Override color for the status icon + title. A supplied accent replaces the state tone in EVERY state (including done-green and error-red), not just active; when unset, the active state uses the primary token. |
| `mutedColor` | `string` | Secondary/muted text colour, the detail line under the title (default the muted-foreground token). |
