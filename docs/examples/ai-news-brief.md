# AI news brief

A whole morning briefing from one sentence — breaking-news ticker, a scrubbable chaptered audio waveform, and three tab-filtered story feeds.

## The ask

> Brief me on today's AI news.

The agent gathers six lead stories across research, products, and policy and composes the brief — with the 4-minute audio version sitting at the top.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| Breaking ticker | `Marquee` | Auto-scrolling headlines, pauses on hover |
| Audio brief | `MediaScrubber` | A waveform you can scrub, with four chapters |
| Story feeds | `Tabs` + `FeedItem` | Research / Products / Policy, tab-filtered |
| Sources | `Sources` | The 6 of 14 consulted sources, as a grid |
| Video | `YouTube` | An embedded segment |
| Save brief | `Button` | A fully local optimistic flip — no round-trip |

## The interesting mechanic: everything here is local

This is the gallery's pure local-interactivity showcase — there is no agent action in the whole screen. The scrubber binds its playhead into state and carries its chapters in the spec:

```json
{"op":"add","path":"/elements/scrubber","value":{"type":"MediaScrubber","props":{
  "duration":252,"currentTime":38,"variant":"waveform",
  "value":{"$bindState":"/playhead"},
  "waveform":[0.18,0.42,0.66,0.51,0.83,0.37,0.72],
  "chapters":[
    {"id":"c0","time":0,"label":"Top stories"},
    {"id":"c1","time":52,"label":"Research"},
    {"id":"c2","time":128,"label":"Products"},
    {"id":"c3","time":198,"label":"Policy"}
  ],
  "showTime":true,"accent":"#dc2626"}}}
```

*(excerpt — waveform trimmed)*

The tab filter is the same pattern: `Tabs` binds `value` to `/activeTab`, and each feed section declares `visible` against that state path — switching tabs swaps feeds without touching the network.

The *Save brief* button shows conditional bindings doing optimistic UI on their own:

```json
{"op":"add","path":"/elements/hdr-save","value":{"type":"Button","props":{
  "label":{"$cond":{"$state":"/saved","eq":true},"$then":"Saved ✓","$else":"Save brief"},
  "variant":"secondary",
  "disabled":{"$state":"/saved","eq":true}},
  "on":{"commit":[{"action":"setState","params":{"statePath":"/saved","value":true}}]}}}
```

One press writes `/saved`, the label and disabled state react through `$cond` — all inside the renderer.

## Compose it yourself

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: "Brief me on today's AI news.",
  signals: { data_shape: ['feed'], density: 'rich', patterns: ['tabs'] },
  data: { stories: [/* headline, outlet, url, summary — rendered verbatim */] },
});
```

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **AI briefing**. Scrub the waveform between chapters, flip the story tabs, and save the brief.
