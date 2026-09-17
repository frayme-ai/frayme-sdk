# Tokyo trip

A complete travel itinerary from one sentence: full-bleed hero, tabbed day timelines, a pannable map, a lightbox gallery, and a reserve flow.

## The ask

> Plan a long weekend in Tokyo.

The agent plans the trip and composes it as an interface: nudge the dates up top, flip through the days, hit *Reserve* when it looks right.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| Opening shot | `Hero` | Full-bleed Shibuya-at-night image |
| Dates | `DateRangePicker` | Live: changing dates relabels the reservation |
| The days | `Tabs` + `Timeline` ×3 | One timeline per day, hour by hour |
| The map | `MapEmbed` | A real, pannable OpenStreetMap embed |
| The photos | `Gallery` | Lightbox gallery of real media |
| Trip facts | `DescriptionList` + `Stat` | Flights, hotel, budget |

## The interesting mechanic: real media, real map, real structure

Nothing here is a placeholder. The day timelines carry the actual plan:

```json
{"op":"add","path":"/elements/day1-timeline","value":{"type":"Timeline","props":{
  "orientation":"vertical","size":"md",
  "items":[
    {"title":"Meiji Jingu forest walk","time":"08:30",
     "description":"Enter under the great torii by Harajuku Station: the cypress avenue is near-silent before 9.","tone":"success"},
    {"title":"Lunch: Uobei Dogenzaka","time":"13:00",
     "description":"Sushi fired to your seat on bullet-train rails; plates from ¥110.","tone":"info"},
    {"title":"Shibuya Sky at golden hour","time":"17:20",
     "description":"Timed entry booked: sunset at 17:52, Mt. Fuji silhouette on clear evenings.","tone":"neutral"}
  ]}}}
```

*(excerpt: items trimmed)*

The `DateRangePicker` binds into state, so the reservation label tracks the user's date edits locally, with no round-trip until they commit.

## The follow-up: Reserve flips the whole canvas

*Reserve this plan* is a declared agent action. The agent ticket-books the flights, confirms the hotel, and answers with a new composition: a booked-trip confirmation with the PNR and next steps. The demo shows both halves, the itinerary you shape and the confirmation the action earns.

## Compose it yourself

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'Plan a long weekend in Tokyo.',
  data: { trip: {/* flights, hotel, day plans, all rendered verbatim */} },
  actions: [
    {
      name: 'reservePlan',
      description: 'Book the flights and hotel for the planned dates',
      role: 'approve',
      kind: 'agent',
      required: true,
    },
  ],
});
```

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Tokyo, long weekend**. Nudge the dates, pan the map, open the gallery, then press *Reserve*.
