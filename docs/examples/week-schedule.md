# Week schedule

A fully editable week calendar: drag, resize, and create blocks on the grid, with every edit mirrored into live state and a one-click reschedule action.

## The ask

> Show me next week's schedule so I can edit it.

The agent pulls the week of 3 August and composes an editable schedule: the Wednesday conflict flagged, Friday afternoon one click from clear.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| The week grid | `Scheduler` | Drag, resize, and slot-create events; fully editable |
| Month context | `Calendar` | A dotted month view beside the grid |
| Conflict flag | `Callout` | The Wednesday overlap, dismissible |
| Week stats | `StatGroup` + `Stat` | Meeting load, focus time, conflicts |

## The interesting mechanic: an editable grid bound to state

The `Scheduler` is not a picture of a calendar. `editable: true` plus a state binding makes every drag and resize write into `/events`, live:

```json
{"op":"add","path":"/elements/sched","value":{"type":"Scheduler","props":{
  "columns":[{"label":"Mon 3"},{"label":"Tue 4"},{"label":"Wed 5"},{"label":"Thu 6"},{"label":"Fri 7"}],
  "startHour":8,"endHour":18,"snapMinutes":15,
  "editable":true,"defaultDuration":30,"newEventTitle":"New event",
  "value":{"$bindState":"/events"},
  "events":[
    {"id":"e1","title":"Product roadmap review","subtitle":"Meet · Sasha, Priya +4",
     "start":"10:00","end":"11:00","column":0,"color":"#6366f1"},
    {"id":"e2","title":"Focus: Q3 planning doc","subtitle":"Deep work",
     "start":"13:00","end":"15:00","column":0,"color":"#10b981"}
  ]}}}
```

*(excerpt: events trimmed)*

Because the grid state lives at a bound path, the agent can read exactly what the user changed when an action fires: the edits travel with the round-trip.

## The follow-up: "Clear Friday afternoon"

One button is a declared agent action. Press it and the agent does real scheduling work (moving the vendor demo to Monday, shifting the retro to Thursday, declining the debrief), then answers with the rescheduled week plus a timeline of what moved.

## Compose it yourself

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: "Show me next week's schedule so I can edit it.",
  signals: { data_shape: ['calendar'], density: 'standard' },
  data: { events: [/* the user's calendar events, rendered verbatim */] },
  actions: [
    {
      name: 'clearFriday',
      description: 'Reschedule or decline everything on Friday afternoon',
      kind: 'agent',
      required: true,
    },
  ],
});
```

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Week schedule**. Drag a block, resize another, create a new one in an empty slot. Then press *Clear Friday afternoon*.
