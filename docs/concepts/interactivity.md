# Interactivity

Frayme UIs are local-first: roughly 90% of interactions resolve entirely inside the renderer, and only the actions your spec explicitly declares ever round-trip to your agent.

## The local-first model

A composed spec carries its own client state (`state`) and its own wiring. When the user types into a bound input, toggles a switch, switches tabs, filters a table, expands a section, or pages through local data, the renderer updates state and re-renders: no network, no agent, no latency.

```
user interaction
      │
      ├─ state write / filter / disclosure ──→ handled locally (~90%)
      │
      └─ bound to a DECLARED action ─────────→ DynamicActionEvent → your agent
```

Three built-in actions (`setState`, `pushState`, `removeState`) power the local layer; they mutate client state and never leave the browser. Everything else that fires must name an action, and a spec can only wire actions to things you enabled, so a rendered UI can never call out to anything you didn't declare.

## The 8 canonical event verbs

Every interaction in a spec is expressed through a closed vocabulary of 8 verbs. The verb says what *kind* of interaction happened; the params say *which* item it happened to.

| Verb | Meaning | Key payload |
| --- | --- | --- |
| `commit` | The primary affordance was activated: a CTA press, Enter in an input, a form submit. | `value?`, `fields?` (form submits), `label?` |
| `select` | An item was picked from a set: a row, a date, an option, a node. | `value?`, `id?`, `index?`, `selected?` (multi-select) |
| `change` | A value or disclosure state changed: typing, toggling, sliding, expanding. | `value?`, `name?` |
| `dismiss` | Something was closed, removed, or cleared: a toast, a chip, a clear-all. | `value?`, `all?` (clear-all), `auto?` (runtime-initiated) |
| `search` | Query text was entered to filter a surface. | `query` |
| `sort` | A sort was requested on a sortable column. | `sortBy`, `sortDir` |
| `page` | Pagination navigated. | `page` (1-based) |
| `move` | Something was repositioned: a kanban card, a reorder, a divider resize. | `fromColumn?`/`toColumn?`, `fromIndex?`/`toIndex?` |

A small, synonym-free set is deliberate: one verb per intent means specs wire events consistently across all 189 components, and your agent can `switch` over a closed contract. The full machine-readable semantics ship as `EVENT_CONTRACT` in `@frayme/catalog`:

```ts
import { CANONICAL_EVENTS, EVENT_CONTRACT } from '@frayme/catalog';

CANONICAL_EVENTS; // ['commit', 'select', 'change', 'dismiss', 'search', 'sort', 'page', 'move']
EVENT_CONTRACT.commit.payload; // documented intrinsic payload keys
```

## When to declare an action

Declare an action when your agent needs to know something happened, or needs to do something about it: a submit with side effects, an approval, a request for server data. Leave everything else undeclared and it stays local.

```ts
const stream = frayme.compose.stream({
  prompt: 'A refund approval card for order #4821: amount, reason, approve/deny',
  actions: [
    {
      name: 'approveRefund',
      role: 'approve',
      required: true, // a control bound to this action is guaranteed present
      params: {
        type: 'object',
        properties: { reason: { type: 'string' } },
      },
      description: 'The operator approved the refund',
    },
    { name: 'denyRefund', role: 'deny' },
  ],
});
```

The action contract is enforced at [validation](validation.md) time: a `required` action that is not wired to a control fails the spec, so "the model forgot the button" is not a failure mode you handle.

## Receiving actions

On the client, declared actions surface through one callback:

```tsx
<FraymeRenderer
  spec={spec}
  onDynamicAction={async (event) => {
    // event.action:        the bound name, e.g. "approveRefund"
    // event.params:        resolved params (live $state values baked in)
    // event.event:         the canonical verb that fired, e.g. "commit"
    // event.state:         full state snapshot at fire time
    // event.generation_id: correlates back to the compose that built this UI
    // event.element_id:    the control that fired (the Button, or the Form / DataTable)
    // event.label:         the pressed control's label, verbatim, when the fire names one
    // event.description:   your own words for the action, from actionContract or spec.actions
    await agent.handle(event);
  }}
/>
```

Because `params` can carry `$state` references and `state` is a live snapshot, the user's actual input arrives with the event, with no form-scraping glue code.

**Which controls reach you.** A press dispatches a declared action out of the renderer: a Button (IconButton, Fab, a Confirmation's verdict), a Form's submit, any declared action on a DataTable, and a row/bulk action button on any component that draws one. A declared action on any other control stays local; the gesture is written to state under `/_ui/<elementId>/<verb>` and the next press carries it in `event.state`. Mark a binding `live: true` to fire on every change instead, or widen the list per renderer with `dynamicActionTypes`. See [State and actions](../guides/state-and-actions.md#which-controls-reach-your-agent).

To let the *agent* respond in context, send the event back as `action_context` with `mode: 'continue_journey'`:

```ts
const next = frayme.compose.stream({
  prompt: 'Show the outcome',
  mode: 'continue_journey',
  action_context: {
    action: event.action,
    event: event.event,
    params: event.params,
    state: event.state,
    generation_id: event.generation_id,
  },
});
```

## Action kinds

Each declared action can specify how the server closes the loop when it fires, via `kind`:

| Kind | Behavior |
| --- | --- |
| `agent` (default) | The event routes back to your code: `onDynamicAction` on the client, or `action_context` on the next compose. You decide what happens. |
| `recompose` | Frayme regenerates the UI itself using a fixed `prompt` you supply on the action. The result is a self-contained "next screen" with no agent round-trip. |
| `false` | The action is denied: the control renders but is inert. Useful for previews and read-only surfaces. |

```ts
actions: [
  { name: 'viewDetails', kind: 'recompose', prompt: 'Show the full order detail view' },
  { name: 'approveRefund', kind: 'agent', role: 'approve', required: true },
  { name: 'deleteOrder', kind: false }, // visible, inert
]
```

## Next steps

- [Validation](validation.md): how the action contract and event vocabulary are enforced
- [The spec](the-spec.md): how `on` wiring and `$state` references are expressed
- [Streaming](streaming.md): how the UI that fires these events arrives
