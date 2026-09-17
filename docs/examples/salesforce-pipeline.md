# Sales pipeline

A CRM cockpit composed from one sentence: KPI row, stage funnel, at-risk analysis, and a searchable opportunity table with a close-the-deal agent action.

## The ask

> Pull up last quarter's opportunities from Salesforce.

The agent fetches the pipeline from the CRM, then calls Frayme to turn it into an interface: 47 open opportunities worth £4.86M, three flagged at risk, every deal searchable live and closeable from its row.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| KPI row | `StatGroup` + `Stat` | Pipeline value, win rate, deals at risk |
| Stage funnel | `FunnelChart` | Prospecting → Closed won, with stage percentages |
| At-risk panel | `Alert` + `BarList` behind a `Switch` | Flip "At-risk analysis" and the panel folds away: conditional visibility on a state binding |
| Opportunity table | `DataTable` + search `Input` | Filters as you type, row actions on each deal |

The funnel is a single operation on the stream:

```json
{"op":"add","path":"/elements/funnel","value":{"type":"FunnelChart","props":{
  "stages":[
    {"label":"Prospecting","value":128},
    {"label":"Qualified","value":74},
    {"label":"Proposal","value":41},
    {"label":"Negotiation","value":22},
    {"label":"Closed won","value":16}
  ],
  "showPercent":true,"palette":"cool","height":"300px"}}}
```

## The interesting mechanic: search is local, closing a deal is not

Typing in the search box filters the `DataTable` instantly. That interaction resolves inside the renderer via a state binding and never leaves the page. But *Mark closed-won* on the Acme renewal is a declared action:

```json
{"op":"add","path":"/actions","value":{"closeWon":{"kind":"agent"}}}
```

Pressing it (and confirming the modal) hands the event back to the agent, which returns a second full screen: a success banner, a revised funnel, and an updated KPI row. In the live demo you can watch the agent think through the update before the new operations stream in.

## Compose it yourself

Declare the action so Frayme guarantees the button is wired:

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: "Pull up last quarter's opportunities from Salesforce.",
  signals: { data_shape: ['chart', 'table', 'filters'], density: 'compact', patterns: ['row-actions'] },
  data: { opportunities: [/* your CRM rows, rendered verbatim */] },
  actions: [
    {
      name: 'closeWon',
      description: 'Mark the selected opportunity closed-won in the CRM',
      role: 'approve',
      required: true,
      kind: 'agent',
    },
  ],
});
```

When the user fires `closeWon`, your agent receives it, performs the CRM update, and calls compose again with `mode: 'continue_journey'` and the fired action in `action_context`. That second call is what produces the confirmation screen.

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Q2 pipeline in Salesforce**. Type in the search box, flip the at-risk switch, then close the Acme renewal.
