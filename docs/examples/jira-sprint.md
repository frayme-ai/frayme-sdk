# Sprint board

A working kanban board whose card moves sync back to the agent, with burndown analytics and a one-click standup summary.

## The ask

> Show me the current sprint board.

The agent reads the sprint (34 of 55 points done, 3 days left, two blockers gating 10 points) and composes a board you can actually work.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| Sprint KPIs | `Stat` ×4 | Points done, days left, blockers, scope |
| The board | `KanbanBoard` | Drag cards between columns; board state is live |
| Burndown | `LineChart` | Toggles with an activity `Heatmap` via `ToggleGroup` |
| Blockers | `Callout` + `InlineMessage` | The two gating issues, called out |

## The interesting mechanic: `move` is a canonical event

`move` is one of the catalog's eight canonical event verbs (`commit`, `select`, `change`, `dismiss`, `search`, `sort`, `page`, `move`). The board binds its column state and wires it to a declared action:

```json
{"op":"add","path":"/elements/board","value":{"type":"KanbanBoard","props":{
  "board":{"$bindState":"/boardState"},
  "columns":[
    {"title":"Backlog","count":3,"accent":"#94a3b8","cards":[
      {"title":"Rate-limit headers for the public API",
       "labels":[{"text":"stretch","tone":"info"}],
       "assignee":"MK","meta":"PLAT-497 · 5 pts"}
    ]},
    {"title":"In progress","count":3,"accent":"#3b82f6","cards":["…"]}
  ]},
  "on":{"move":{"action":"moveIssue"}}}}
```

*(excerpt: cards trimmed)*

```json
{"op":"add","path":"/actions","value":{"summarizeStandup":{"kind":"agent"},"moveIssue":{"kind":"agent"}}}
```

Drag PLAT-482 from *In progress* to *In review* and two things happen: the renderer updates the bound board state locally, and the `moveIssue` action fires back to the agent so the tracker stays in sync. The Burndown/Activity toggle, by contrast, is purely local, with no round-trip.

## The follow-up: a whole second screen

*Summarize standup* is the demo's big swing. The agent reads the sprint's activity, then answers with an entirely new composition: its plan checking off live, a per-person digest timeline, and tomorrow's focus. One declared action, one press, one new interface.

## Compose it yourself

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'Show me the current sprint board.',
  signals: { data_shape: ['board', 'chart'], density: 'compact' },
  data: { sprint: {/* issues, points, blockers, rendered verbatim */} },
  actions: [
    { name: 'moveIssue', description: 'User moved a card between columns', kind: 'agent' },
    { name: 'summarizeStandup', description: 'Summarize activity since the last standup', kind: 'agent', required: true },
  ],
});
```

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Sprint 24 board**. Drag a card, flip the analytics toggle, then press *Summarize standup*.
