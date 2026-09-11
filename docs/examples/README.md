# Examples

Ten real interfaces composed by Frayme from one-sentence asks — every one live and clickable at [frayme.ai/examples](https://frayme.ai/examples).

Each example started as a plain-language prompt to an agent. The agent called Frayme; Frayme streamed back json-render operations; the open-source renderer (`@frayme/runtime`) turned them into the interface you can click around in. Nothing in the gallery is a video or a screenshot — the buttons are wired, the state is live, and several demos hand an action back to the agent for a second full turn.

Every page below links the packet's actual prompt, the operations behind the star components, and a compose call that produces the same class of screen.

{% hint style="info" %}
All ten demos live on one gallery page: [frayme.ai/examples](https://frayme.ai/examples). Use the switcher at the top of the console to jump between them.
{% endhint %}

## The gallery

| Example | The ask | What it shows | Star components |
| --- | --- | --- | --- |
| [Sales pipeline](salesforce-pipeline.md) | "Pull up last quarter's opportunities from Salesforce." | A CRM cockpit with live search, a stage funnel, and a close-the-deal agent round-trip | `DataTable`, `FunnelChart`, `StatGroup`, `BarList` |
| [Sprint board](jira-sprint.md) | "Show me the current sprint board." | A working kanban whose card moves sync back to the agent, plus burndown analytics | `KanbanBoard`, `LineChart`, `Heatmap`, `ToggleGroup` |
| [Week schedule](week-schedule.md) | "Show me next week's schedule so I can edit it." | A drag-and-resize week grid mirrored into live state, with a one-click reschedule action | `Scheduler`, `Calendar`, `Callout` |
| [Market brief](market-brief.md) | "Morning brief on my portfolio." | A dark-themed finance desk with a custom (BYOC) ticker tape over real candles | `SparkTicker` (BYOC), `Candlestick`, `Tabs`, `Marquee` |
| [Tokyo trip](tokyo-trip.md) | "Plan a long weekend in Tokyo." | A full travel itinerary — hero image, tabbed day timelines, pannable map, lightbox gallery | `Hero`, `Timeline`, `MapEmbed`, `Gallery`, `DateRangePicker` |
| [Camera shopping](camera-shopping.md) | "Find me a mirrorless camera under $800." | One price slider live-filtering a ratings list and a sortable table, then a real checkout turn | `RangeSlider`, `Carousel`, `DataTable`, `Rating` |
| [Film night](film-night.md) | "What should we watch tonight?" | Mood tabs, embedded trailers, and a cinema seat map with a running total | `FloorPlan`, `YouTube`, `Tabs`, `Carousel` |
| [AI news brief](ai-news-brief.md) | "Brief me on today's AI news." | A morning briefing with a breaking-news ticker and a scrubbable, chaptered audio waveform | `MediaScrubber`, `Marquee`, `FeedItem`, `Sources` |
| [Support triage](support-triage.md) | "Triage my support inbox." | A support cockpit — working inbox, threaded conversation, rich-text composer, drafted replies | `NotificationCenter`, `CommentThread`, `RichComposer` |
| [Event seats](event-seats.md) | "Get us four good seats for Saturday's show." | A venue seat map across three price bands with a live total and a checkout follow-up | `FloorPlan`, `PricingTable`, `MapEmbed`, `Gallery` |

## What to look for

Three mechanics repeat across the gallery — they are the core of how Frayme interfaces behave in production:

- **Local interactivity by default.** Roughly 90% of what you can do in these demos — search filters, tab switches, seat selection, slider drags — resolves inside the renderer through state bindings (`{"$bindState": "/path"}`). No network round-trip, no agent involvement.
- **Declared actions round-trip to the agent.** The buttons that matter — *Mark closed-won*, *Summarize standup*, *Checkout selected seats* — are declared actions with `"kind": "agent"`. Pressing one hands the event (plus the live UI state) back to the host agent, which responds with a whole new screen.
- **Everything is a validated json-render spec.** Each demo is a stream of operations like `{"op":"add","path":"/elements/board","value":{...}}` — the same wire format `POST /v1/compose` streams, validated against the 189-component catalog before it renders.

## Compose your own

Every example page ends with a compose call in this shape:

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'Pull up last quarter\'s opportunities from Salesforce.',
  signals: { data_shape: ['chart', 'table'], density: 'compact' },
});

const spec = await stream.finalSpec();
```

See the getting-started section for rendering the stream in React with `@frayme/runtime`.
