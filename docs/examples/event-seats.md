# Event seats

A 28-seat venue map across three price bands with a live running total — and a checkout that hands the exact selection to the agent.

## The ask

> Get us four good seats for Saturday's show.

The agent picks four together in the centre stalls — B2 through B5 at £95 each, the acoustic sweet spot — pre-selects them on a live seat map, and leaves them ready to swap or check out.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| The seat map | `FloorPlan` | 28 seats, three price bands, live selection and total |
| The bands | `PricingTable` | Premium Stalls / Stalls / Circle, the agent's pick highlighted |
| The venue | `MapEmbed` | A real embedded venue map |
| View from seat | `Gallery` + `Image` | Photos from the recommended row |
| Access info | `Switch` + conditional block | Step-free details, shown on demand |
| Checkout | `Button` → agent action | The demo's round-trip |

## The interesting mechanic: selection is state, checkout forwards it

The `FloorPlan` binds its selection into state — tapping seats toggles them locally, with per-seat prices and `available` / `sold` / `held` statuses carried in the spec:

```json
{"op":"add","path":"/elements/seatmap","value":{"type":"FloorPlan","props":{
  "currency":"£","accent":"#86198f",
  "selectedIds":{"$bindState":"/selectedSeats"},
  "stage":{"label":"STAGE","edge":"top","shape":"curve"},
  "regions":[
    {"id":"a1","label":"A1","kind":"rect","x":0.05,"y":0.2,"w":0.115,"h":0.14,
     "price":150,"status":"available","color":"#ca8a04"},
    {"id":"b2","label":"B2","kind":"rect","x":0.185,"y":0.4,"w":0.115,"h":0.14,
     "price":95,"status":"available","color":"#64748b"}
  ]}}}
```

*(excerpt — 28 regions trimmed)*

The checkout button is where local state meets the agent: its action params embed a `$state` reference, so the agent receives exactly the seats selected at press time — not the seats the spec started with:

```json
{"op":"add","path":"/elements/checkout-btn","value":{"type":"Button","props":{
  "label":"Checkout selected seats","variant":"primary","icon":"credit-card"},
  "on":{"commit":[{"action":"checkoutSeats","params":{
    "venue":"Royal Albert Hall",
    "event":"Prom 24 — BBC Symphony Orchestra",
    "date":"Saturday 1 August 2026",
    "showtime":"7:30 PM",
    "seats":{"$state":"/selectedSeats"}}}]}}}
```

Swap B5 for a Circle seat first and that is what checkout sends. The step-free access block is the small version of the same idea — a `Switch` bound to `/showAccess`, a block with `"visible":{"$state":"/showAccess","eq":true}`.

## The follow-up: a confirmation code

*Checkout selected seats* is a declared agent action. The agent books the four seats and answers with a new composition — the confirmation code, the order summary, and what happens next.

## Compose it yourself

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: "Get us four good seats for Saturday's show.",
  data: { event: {/* venue, seat inventory, price bands — rendered verbatim */} },
  actions: [
    {
      name: 'checkoutSeats',
      description: 'Purchase the currently selected seats',
      role: 'approve',
      kind: 'agent',
      required: true,
    },
  ],
});
```

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Saturday night — seats**. Tap seats on and off, watch the total move, flip the access switch — then check out.
