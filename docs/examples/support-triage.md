# Support triage

A working support cockpit — a live notification inbox, a threaded conversation with a rich-text composer, and an agent action that drafts the urgent replies.

## The ask

> Triage my support inbox.

The agent reads the queue — 47 open, 6 urgent, two SLA clocks already red — and composes the cockpit: the live inbox, thread #4821 open underneath, and one button to draft all three urgent replies.

## What comes back

| Piece | Component | Behavior |
| --- | --- | --- |
| The inbox | `NotificationCenter` | Category tabs, mark-as-read, unread-only filter — all live |
| The thread | `CommentThread` | The #4821 duplicate-charge conversation, nested replies |
| The reply box | `RichComposer` | Rich-text toolbar; *Send reply* queues the draft locally |
| SLA + volume | `Stat` ×4 + `Progress` | Queue KPIs and the SLA clocks |
| Draft replies | `Button` → agent action | The demo's round-trip |

## The interesting mechanic: three bindings make the inbox real

The `NotificationCenter` is not a mock — its tab, read set, and filter are all state bindings, so every interaction resolves locally:

```json
{"op":"add","path":"/elements/notif","value":{"type":"NotificationCenter","props":{
  "activeTab":{"$bindState":"/activeTab"},
  "readIds":{"$bindState":"/readIds"},
  "unreadOnly":{"$bindState":"/unreadOnly"},
  "categories":[
    {"key":"billing","label":"Billing"},
    {"key":"bugs","label":"Bugs"},
    {"key":"features","label":"Feature requests"}
  ],
  "items":[
    {"id":"t-4821","title":"Meridian Health — charged twice after annual renewal",
     "category":"billing","timestampLabel":"42m ago","unread":true,"tone":"critical",
     "actions":[{"label":"Open thread","value":"open"},{"label":"Start refund","value":"refund"}]}
  ]}}}
```

*(excerpt — items trimmed)*

Other elements watch the same paths with `visible` conditions: tab to *Billing* and a routing note appears; flip *unread only* and the queue thins; queue a reply and a confirmation shows against `/replyQueued`. Same state, no round-trips.

## The second mechanic: one press, two handlers

The *Draft replies to urgent* button chains a local state write and the declared agent action on a single `commit`:

```json
{"op":"add","path":"/elements/hdr-draft-btn","value":{"type":"Button","props":{
  "label":{"$cond":{"$state":"/drafting","eq":true},"$then":"Drafting replies…","$else":"Draft replies to urgent"},
  "variant":"primary","icon":"sparkles",
  "disabled":{"$state":"/drafting","eq":true}},
  "on":{"commit":[
    {"action":"setState","params":{"statePath":"/drafting","value":true}},
    {"action":"draftReplies","params":{"ticketIds":["t-4821","t-4823","t-4817"]}}
  ]}}}
```

The `setState` flips the button into its disabled "Drafting…" look instantly; `draftReplies` fires back to the agent with the ticket ids. That optimistic-then-round-trip pattern is how production Frayme buttons should feel.

## The follow-up: two full drafts

The agent reads the thread history and answers with a second screen: two complete reply drafts — refund reference, timeline, apology — each with its own approve-and-send button. One declared action produced a whole review workflow.

## Compose it yourself

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'Triage my support inbox.',
  signals: { data_shape: ['feed', 'thread'], density: 'standard' },
  data: { tickets: [/* subjects, threads, SLA timestamps — rendered verbatim */] },
  actions: [
    {
      name: 'draftReplies',
      description: 'Draft replies to the urgent tickets from thread history',
      kind: 'agent',
      required: true,
    },
  ],
});
```

## Try it

Open [frayme.ai/examples](https://frayme.ai/examples) and select **Support triage**. Tab to Billing, mark items read, flip unread-only, queue a reply in the composer — then press *Draft replies to urgent*.
