# State and actions

How interactions on a Frayme-rendered UI resolve: most locally in the browser, the rest dispatched to handlers you control.

## The 90/10 split

Roughly 90% of interactions resolve entirely inside the renderer at zero latency and zero cost: typing into a bound input writes state via `$bindState`, tabs switch, filters filter, visibility toggles. None of that reaches your code.

The remaining ~10% are **spec-bound named actions**, where an element's `on` block binds a canonical event verb to an action name:

```json
{
  "type": "Button",
  "props": { "label": "Approve" },
  "on": { "commit": { "action": "approveRefund", "params": { "amount": { "$state": "/amount" } } } }
}
```

When that fires, the renderer resolves the action through a dispatch pipeline and hands it to one of four **kinds** of handler.

## `onDynamicAction`: the agent sink

The simplest wiring, where every forwarded action lands in one callback:

```tsx
import { FraymeRenderer, type DynamicActionEvent } from '@frayme/runtime/react';

<FraymeRenderer
  spec={spec}
  onDynamicAction={(event: DynamicActionEvent) => {
    // event.action        → "approveRefund"
    // event.params        → { amount: 420 } ($state refs already resolved to live values)
    // event.event         → "commit" (the canonical verb that fired)
    // event.state         → full live state snapshot at fire time
    // event.element_id    → "approve" (the element that fired)
    // event.generation_id → correlates back to the compose that built this UI
    sendToAgent(event);
  }}
/>;
```

`DynamicActionEvent` carries everything a host needs without re-deriving it: the resolved params, the fired verb, the complete state snapshot, the firing element, and the generation id, plus `label` (the pressed control's label, verbatim, when the fire names one) and `description` (the host's declaration of the action, from `actionContract` or the server-stamped `spec.actions`).

### What the thread shows

A press should leave a trace in the conversation. Render the same event as a card with `FraymeActionReceipt` (from `@frayme/runtime/react`): the control's label as the title, the action's description under it, and a readable table of the params, themed like the UI beside it. State is not shown on the card; it is in the payload the agent reads. See [FraymeActionReceipt](../sdk/runtime.md#fraymeactionreceipt).

### In a chat: `pressMessage` and `fraymePart`

When the screen sits in a Vercel AI SDK chat, a press becomes the user's next message. `pressMessage(event, { includeState? })` (from `@frayme/runtime/ai-sdk`) builds that message, and `FraymeResult` hands it the event:

```tsx
import { useChat } from '@ai-sdk/react';
import { fraymePart, pressMessage } from '@frayme/runtime/ai-sdk';
import { FraymeResult } from '@frayme/runtime/react';

const { sendMessage, status } = useChat();
const busy = status === 'submitted' || status === 'streaming';

// for each part of each useChat message:
const frayme = fraymePart(part, message);
if (frayme) {
  return (
    <FraymeResult
      key={i}
      {...frayme}
      interactive={!busy}
      onPress={(e) => sendMessage(pressMessage(e))}
    />
  );
}
```

`interactive={!busy}` holds presses while the agent is still answering, because a second message sent then would start a second request alongside the first. A press only reaches `onPress` from a finished screen: the live snapshot takes typed input but no presses.

It returns `{ text, metadata: { frayme: event } }`:

- **`text`** is what the model reads: the humanized action name and its params (`threadText`), an "Also recorded" block with the local gestures and bound values from `event.state` (`threadState`), and a last line, `frayme_action {...}`, that holds the action name, `event`, `element_id`, `label` and `generation_id` for the model to forward. `includeState: false` leaves the "Also recorded" block out.
- **`metadata.frayme`** is the whole event, and the model never sees it. When the model calls `frayme_action`, `fraymeTools` (from `@frayme/api/ai-sdk`) restores the params and state from it, so the model cannot write a press of its own. The event is still your user's data: the server validates every action it receives. `fraymePart(part, message)` turns the message into `{ press }`, so `FraymeResult` draws the receipt card instead of the text.

For an Approve button bound to `approveRefund`, with nothing done locally before the press, the text is:

```text
Approve refund
- Order ID: 4821

frayme_action {"action":"approveRefund","event":"commit","element_id":"approve","label":"Approve","generation_id":"gen_4b8e1c"}
```

See [How a press travels](../frameworks/ai-sdk.md#how-a-press-travels) for the whole round trip, and [`FraymeResult`](rendering.md#fraymeresult-one-result-in-a-chat) for what it draws.

## Which controls reach your agent

A **press** dispatches a declared action out of the renderer: a Button (and IconButton, Fab, a Confirmation's verdict), a Form's submit, any declared action on a DataTable, and a row/bulk action button on any component that draws one (DataTable, KanbanBoard, KanbanCard). A declared action on any other component stays **local**: the renderer writes the interaction to state under `/_ui/<elementId>/<verb>` and nothing leaves the page until a press, whose `event.state` carries every one of those records. So a Select bound to `setRegion` and a Switch bound to `includeDrafts` do not cost a round trip each; the "Run report" button sends both, once.

```json
{ "type": "Select", "props": { "name": "region", "options": ["emea", "apac"] },
  "on": { "change": { "action": "setRegion" } } }
```

```ts
// after the user picks "apac" and presses the Button:
event.state._ui.region.change; // → { value: "apac", name: "region" }
```

Two ways to change that:

- **`live: true`** on the binding: the per-action opt-out. The action fires on every change with no submit step (a live filter, a slider the agent should follow).
- **`dynamicActionTypes`** on the renderer widens the carrier list: `dynamicActionTypes={[...DEFAULT_DYNAMIC_ACTION_TYPES, 'KanbanBoard']}`. The prop replaces the default, so spread it in. Custom (BYOC) types are not carriers until listed.

A binding's `onSuccess` / `onError` chain gets the same decision as its trigger. A `watch` handler that names a declared action stays local: nothing pressed it.

A gated dispatch is silent: nothing is thrown, the spec stays valid, no automatic confirm is raised, the control stays live and the fields feeding it do not freeze. `local` handlers and `false` denials are not gated; only the kinds that leave the renderer (`agent`, `host`, `recompose`) are.

## Params resolution

By the time your handler runs, params are plain values:

- `{ "$state": "/path" }` params are resolved against live client state.
- `{ "$item": "field" }` params (rows in a repeated list) are dereferenced to the **value** for the pressed row: you receive `"claimId": "RC-2214"`, never a state path.
- Literal params pass through untouched.

## Action kinds

Instead of a `switch` in `onDynamicAction`, you can map each action name to a declarative kind via the `actions` prop:

```tsx
import type { FraymeActionMap } from '@frayme/runtime';

const actions: FraymeActionMap = {
  // local: deterministic client-side handler (bare function is shorthand)
  copyLink: (params) => navigator.clipboard.writeText(String(params.url)),

  // recompose: regenerate the canvas in place, carrying the current spec
  showBreakdown: { kind: 'recompose', prompt: 'Expand into a per-line cost breakdown' },

  // agent: forward to onDynamicAction (the default kind)
  approveRefund: { kind: 'agent' },

  // deny: render the control inert
  deleteAccount: false,
};

<FraymeRenderer
  spec={spec}
  actions={actions}
  onDynamicAction={sendToAgent}
  compose={frayme.compose}          // enables the recompose kind
  onRecompose={(next) => setSpec(next)} // where the recomposed spec lands
/>;
```

| Kind | What it does | Requires |
| --- | --- | --- |
| `local` | Runs your function in the browser. | Nothing |
| `recompose` | Calls compose with the current spec as `prior_spec` and morphs the canvas via `onRecompose` (a state-preserving merge). | `compose` + `onRecompose` props |
| `agent` | Forwards the enriched event to `onDynamicAction`. | A handler |
| `host` | postMessages to a host bridge (MCP/embed surfaces inject it). | `hostTransport` |
| `false` | Explicit deny: the control renders inert. | Nothing |

Every kind degrades safely: `recompose` without a `compose` client, or `host` without a transport, forwards to `onDynamicAction` instead of throwing.

## Who routes: the spec or you

- **You pass nothing**: the spec drives. The server writes handlers into `spec.actions` for declared actions (see [Edits and journeys](edits-and-journeys.md)); undeclared actions forward to `onDynamicAction`. The spec still can't do anything you didn't enable. Each kind is gated on a dep you inject.
- **You pass `actions` (map or `string[]` allow-list)**: you are the sole router. `spec.actions` is ignored, and any name you didn't list fails closed (renders inert), unless you opt unmapped names into a blanket sink with `defaultActionKind: 'agent' | 'host'`.

```tsx
// Allow-list form: only these two names ever reach your handler
<FraymeRenderer spec={spec} actions={['approveRefund', 'exportCsv']} onDynamicAction={sendToAgent} />
```

## Handler context

`local` handlers (and `recompose` prompt functions) receive a context alongside params:

```tsx
const actions: FraymeActionMap = {
  applyDiscount: {
    kind: 'local',
    run: (params, ctx) => {
      ctx.setState('/total', Number(ctx.getState().total) * 0.9); // write state by JSON Pointer
      // ctx.getState(): live snapshot · ctx.getSpec(): current spec
      // ctx.signal: aborts if the same action fires again (re-entrancy guard)
    },
  },
};
```

Firing the same action again aborts the previous in-flight dispatch via `ctx.signal`: check it before applying async results.

## Per-action confirmation

Any spec action binding may carry a `confirm` block; the renderer pauses execution and shows a Frayme-styled modal before dispatching:

```json
{ "commit": { "action": "deleteRow", "confirm": { "title": "Delete row?", "message": "This cannot be undone." } } }
```

No per-component code: it works on every component.

## Next steps

- [Edits and journeys](edits-and-journeys.md): round-trip an action into the next compose
- [Data binding](data-binding.md): how `$state` and `$bindState` connect elements to state
