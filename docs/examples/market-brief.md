# Market brief

A dark-themed finance desk that mixes catalog components with a workspace's own custom component — a scrolling ticker tape over live candles.

## The ask

> Morning brief on my portfolio.

The agent assembles the pre-market picture for Friday, July 31: futures, P&L, NVDA's July run, movers, and a tabbed news desk — in the workspace's own dark "Obsidian Capital" theme.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| Ticker tape | `SparkTicker` — **BYOC** | The workspace's own custom component, auto-scrolling |
| NVDA chart | `Candlestick` | A month of real OHLC candles with axis and grid |
| Movers | `BarList` ×2 | Pre-market gainers and losers |
| News desk | `Tabs` + `WebPreview` | Tab-filtered stories from real outlets |
| Earnings | `DataTable` | The day's earnings table |
| Price alert | `Button` → agent action | One-tap $200 alert wired straight to the agent |

## The interesting mechanic: bring your own component

`SparkTicker` is not one of the 189 catalog components — it belongs to this workspace. It ships as a BYOC manifest (the same object you author for `defineFraymeComponent` in `@frayme/catalog`), and Frayme composes with it exactly as it does with catalog components:

```json
{"op":"add","path":"/elements/byoc-tape","value":{"type":"SparkTicker","props":{
  "items":[
    {"symbol":"NVDA","price":"$188.42","delta":"+1.4%","up":true},
    {"symbol":"MSFT","price":"$512.10","delta":"+0.6%","up":true},
    {"symbol":"BTC","price":"$118,340","delta":"-1.1%","up":false}
  ],
  "speed":"normal"}}}
```

*(excerpt — items trimmed)*

The candles beside it are plain catalog:

```json
{"op":"add","path":"/elements/candle","value":{"type":"Candlestick","props":{
  "height":"300px","showAxis":true,"showYAxis":true,"showGrid":true,
  "data":[
    {"label":"Jul 1","open":176.2,"high":179.1,"low":175.4,"close":178.6},
    {"open":178.8,"high":180.4,"low":177.2,"close":179.9}
  ]}}}
```

*(excerpt — a month of candles trimmed)*

The dark theme is the runtime's theming layer — workspace `--frayme-*` CSS variables — not per-element styling baked into the spec.

## Compose it yourself

Pass the manifest inline with the request; render it in your app via `createCustomComponents` from `@frayme/runtime`:

```ts
import Frayme from '@frayme/api';
import { sparkTickerManifest } from './spark-ticker'; // your defineFraymeComponent(...).manifest

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'Morning brief on my portfolio.',
  signals: { data_shape: ['chart', 'feed'], density: 'rich', patterns: ['tabs'], tone: 'branded' },
  context: { theme: 'dark' },
  data: { portfolio: {/* positions and quotes, rendered verbatim */} },
  custom_components: [sparkTickerManifest],
  actions: [
    { name: 'setPriceAlert', description: 'Set a price alert on a ticker', kind: 'agent' },
  ],
});
```

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Morning market brief**. Watch the tape scroll, flip the news tabs, and tap the $200 price alert.
