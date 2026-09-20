# Scheduler

A professional day/week scheduler: a vertical hour axis with one column per day or resource, events as duration-sized blocks that split into side-by-side lanes when they overlap, and a live current-time line. It holds the full event set in state, click an empty slot to create (with an inline editor), click an event to view / edit / delete it in a popover, drag to reschedule, and drag its bottom edge to resize. Every change renders instantly AND emits a fully-populated intent (commit / change / move / dismiss / select) for the host to persist. Times are "HH:MM" or minutes-from-midnight, validated and positioned proportionally. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the live event set (mirrored on every create/edit/move/delete) from spec.state. PERMISSION FIDELITY: when the request scopes what the end user may change, mirror it exactly, `locked` per event or `lockExisting` for add-only grids; these are UX-level locks, the host still validates every intent.

## Example

```json
{
  "root": "scheduler",
  "elements": {
    "scheduler": {
      "type": "Scheduler",
      "props": {
        "columns": [
          {
            "label": "Mon"
          },
          {
            "label": "Tue"
          },
          {
            "label": "Wed"
          }
        ],
        "startHour": 8,
        "endHour": 18,
        "events": [
          {
            "id": "standup",
            "title": "Standup",
            "start": "09:00",
            "end": "09:30",
            "column": 0,
            "subtitle": "Team sync"
          },
          {
            "id": "design",
            "title": "Design review",
            "start": "10:00",
            "end": "11:30",
            "column": 0,
            "subtitle": "Room 2",
            "description": "Review the new scheduler mockups with the design team."
          },
          {
            "id": "oneone",
            "title": "1:1 with Sam",
            "start": "10:30",
            "end": "11:00",
            "column": 0
          },
          {
            "id": "lunch",
            "title": "Lunch",
            "start": "12:00",
            "end": "13:00",
            "column": 1,
            "color": "#16a34a"
          },
          {
            "id": "focus",
            "title": "Focus block",
            "start": "14:00",
            "end": "16:00",
            "column": 2,
            "subtitle": "Deep work"
          },
          {
            "id": "demo",
            "title": "Client demo",
            "start": "15:30",
            "end": "16:30",
            "column": 1,
            "subtitle": "Zoom",
            "color": "#f59e0b"
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
| `columns` | `({ label: string })[]` | The day/resource columns, left to right; each is { label }. Defaults to a single "Today" column. |
| `events` | `({ id: string, title: string, start: string \| number, end: string \| number, column: number, subtitle: string, description: string, color: string, locked: boolean })[]` | The events to place; each is { id?, title, start, end, column?, subtitle?, description?, color?, locked? }. Events with unparseable times are skipped. The component holds these in state and mutates them as the user schedules, except `locked` events, which stay exactly as supplied. |
| `value` | `({ id: string, title: string, start: string \| number, end: string \| number, column: number, subtitle: string, description: string, color: string })[]` | Bindable ($bindState) mirror of the LIVE schedule: the component writes the full resolved event set here on every create/edit/move/delete, so an external Button can read the current schedule from spec.state without replaying the event stream. Seed it or leave it for the component to populate. |
| `startHour` | `number` | First hour shown at the top of the time axis, 0..23 (default 8); lower it for early-morning schedules so events are not clipped off the grid. |
| `endHour` | `number` | Last hour shown on the axis, 1..24 (default 18); coerced above startHour. |
| `hourHeight` | `number` | Pixel height of one hour row (default 48; clamped 28..120). Sets the grid’s overall height. |
| `hour12` | `boolean` | Show 12-hour clock labels ("9:00 AM") vs 24-hour ("09:00") on the axis + popover (default true = 12-hour). |
| `nowLine` | `boolean` | Show a live "current time" line across the grid (client-only; default true). Hidden when the current time is outside the window. |
| `editable` | `boolean` | Allow scheduling (default true): click an empty slot to CREATE (opens an inline editor), click an event to VIEW/EDIT/DELETE it in a popover, drag to RESCHEDULE, drag the bottom edge to RESIZE. Set false for a read-only grid (clicking an event still opens a read-only popover and emits `select`). |
| `lockExisting` | `boolean` | The ADD-ONLY permission shape: lock every event supplied via props (as if each carried locked:true) while empty-slot creation stays live, the end user can schedule NEW entries but cannot move, edit, or delete the existing ones. Use when the request grants create-but-not-modify rights ("crew can book new slots; confirmed appointments are read-only"). UI-level enforcement only, the host still validates every intent. |
| `snapMinutes` | `number` | Snap increment in minutes for create/drag (default 15; e.g. 30 for half-hour slots). 0 disables snapping. |
| `defaultDuration` | `number` | Length in minutes of an event created by clicking an empty slot (default 60). |
| `newEventTitle` | `string` | Title given to a click-created event before it is edited (default "New event"). Escaped text. |
| `showSubmit` | `boolean` | Show an on-demand "Save schedule" button in the footer that emits ONE commit carrying the full resolved event set (default false). Use it when the host wants a single whole-schedule snapshot instead of persisting each per-event intent. |
| `submitLabel` | `string` | Label for the whole-schedule submit button when showSubmit is on (default "Save schedule"). Escaped text. |
| `accent` | `string` | Default event-block color + the now-line color (default the primary token). |
| `gridColor` | `string` | Hour gridline + column divider color (default the border token). |
| `mutedColor` | `string` | Axis labels + column headers color (default the muted-foreground token). |

## Events

### select

An event was opened (clicked without dragging); params carry the full event { id, title, subtitle, start, end, startTime, endTime, startLabel, endLabel, durationMinutes, column, columnLabel }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### commit

Either an empty slot was clicked to CREATE an event (params carry the full new event, same shape as `select`; the host adds it and recomposes) OR the opt-in "Save schedule" footer button was pressed (params carry { events, count }, the full resolved event set as a single whole-schedule snapshot).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### change

An event was EDITED in the popover (title / time / subtitle) and saved; params carry the full updated event. The host should update it and recompose.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### move

An event was dragged to RESCHEDULE or resized; params carry the full updated event (start/end changed, duration preserved on a move). The host should update it and recompose.

| Key | Type | Description |
| --- | --- | --- |
| `card` | `unknown` | Optional. The moved card/item (kanban). |
| `fromColumn` | `string` | Optional. Source column key (kanban). |
| `toColumn` | `string` | Optional. Target column key (kanban). |
| `fromIndex` | `number` | Optional. Source position (kanban/reorder). |
| `toIndex` | `number` | Optional. Target position (kanban/reorder). |
| `splitPercent` | `number` | Optional. Final divider position (SplitPane, 0-100, on pointer-up). |
| `width` | `number` | Optional. Final width in px (Resizable, on pointer-up). |
| `height` | `number` | Optional. Final height in px (Resizable, on pointer-up). |
| `axis` | `'x' \| 'y' \| 'both'` | Optional. Which axis the resize changed (Resizable). |

### dismiss

An event was DELETED from its popover; params carry the removed event { id, title, start, end, column }. The host should remove it and recompose.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
