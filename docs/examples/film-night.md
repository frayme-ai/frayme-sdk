# Film night

Mood tabs, embedded trailers, and a live cinema seat map with a running total — ending in a booking confirmation.

## The ask

> What should we watch tonight?

The agent lines up four contenders, embeds two official trailers, and — because the IMAX Dune screening has seats left — includes a live seat map for the 7:30.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| Mood picker | `Tabs` | Switching moods reshapes the pick list, locally |
| The picks | `Card` + `Rating` + `Badge` | Four films with scores and runtimes |
| Trailers | `YouTube` ×2 | Real official trailers, embedded |
| Seat map | `FloorPlan` | Selectable seats with sold/available states and a running total |
| Now showing | `Marquee` + `Carousel` | Showtimes strip |

## The interesting mechanic: a seat map is just a component

The cinema map is one `FloorPlan` operation — regions with position, price, and status, selection bound to state so the running total updates as you pick:

```json
{"op":"add","path":"/elements/seatmap","value":{"type":"FloorPlan","props":{
  "currency":"$","aspect":2.4,
  "selectedIds":{"$bindState":"/seats"},
  "stage":{"label":"SCREEN","edge":"top","shape":"curve"},
  "regions":[
    {"id":"c1","label":"C1","kind":"rect","x":0.05,"y":0.34,"w":0.095,"h":0.18,"price":16.5,"status":"available"},
    {"id":"c2","label":"C2","kind":"rect","x":0.168,"y":0.34,"w":0.095,"h":0.18,"price":16.5,"status":"sold"}
  ]}}}
```

*(excerpt — regions trimmed)*

Tapping seats writes into `/seats`; the total reads the same path. All local. Only *Book tickets* — a declared agent action — leaves the page.

## The follow-up: a confirmation code

Press *Book tickets* and the agent holds D4 and D5, charges the card on file, and answers with a new screen carrying the confirmation. Booking flows in Frayme are two compositions: the chooser, then the receipt.

## Compose it yourself

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'What should we watch tonight?',
  data: {
    films: [/* tonight's picks — rendered verbatim */],
    screening: { seats: [/* seat grid with prices and availability */] },
  },
  actions: [
    {
      name: 'bookTickets',
      description: 'Book the selected seats for the chosen screening',
      params: {
        type: 'object',
        properties: { seats: { type: 'array', items: { type: 'string' } } },
      },
      kind: 'agent',
    },
  ],
});
```

The `seats` param key binds to live UI state — when the button fires, the agent receives the seat ids the user actually selected.

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Tonight's picks**. Flip the moods, play a trailer, pick two seats, and book them.
