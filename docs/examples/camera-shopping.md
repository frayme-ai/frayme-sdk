# Camera shopping

One price slider live-filters a ratings list and a sortable table; then *Add to cart* triggers a genuine second agent turn.

## The ask

> Find me a mirrorless camera under $800.

The agent researches the market and composes a comparison: five bodies make the cut, each with ratings, thumbnails, and specs.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| Price filter | `RangeSlider` | With histogram; both bounds bound to state |
| The picks | `Card` + `Rating` + `Thumbnail` | Ratings list, filtered live by the slider |
| Spec table | `DataTable` | Sortable, filtered by the same slider |
| Hands-on looks | `Carousel` + `WebPreview` | Review coverage per body |

## The interesting mechanic: one binding drives two views

The slider writes its bounds into `/priceMin` and `/priceMax`; the ratings list and the `DataTable` both read them. Drag the band and both views thin in real time, entirely inside the renderer, with zero round-trips:

```json
{"op":"add","path":"/elements/price-slider","value":{"type":"RangeSlider","props":{
  "min":400,"max":900,"step":25,
  "valueMin":{"$bindState":"/priceMin"},
  "valueMax":{"$bindState":"/priceMax"},
  "showHistogram":true,
  "histogram":[1,2,4,7,9,12,10,8,11,6,4,3,2,1],
  "showValues":true,"valuePrefix":"$","marks":true,"accent":"#f97316"}}}
```

This is the shape of most Frayme interactivity: shared state paths instead of wired-up event plumbing. The generator emits the bindings; the renderer keeps every reader in sync.

## The follow-up: a real checkout turn

*Add to cart* on the Sony a6400 is a declared agent action. The agent places the order and answers with a second composition: a success screen, an itemized receipt, and a delivery timeline. In the live demo you can watch the agent's acknowledgment before the new operations stream in.

## Compose it yourself

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'Find me a mirrorless camera under $800.',
  signals: { data_shape: ['table', 'list', 'filters'], density: 'compact' },
  data: { cameras: [/* the researched bodies: prices, ratings, specs, rendered verbatim */] },
  actions: [
    {
      name: 'addToCart',
      description: 'Add the chosen camera to the shopping cart',
      params: {
        type: 'object',
        properties: { sku: { type: 'string' } },
      },
      kind: 'agent',
      required: true,
    },
  ],
});
```

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Mirrorless under $800**. Drag the price band and watch both views filter, then add the a6400 to your cart.
