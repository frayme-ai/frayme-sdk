# Edits and journeys

Beyond one-shot generation, compose has two more modes: `edit` patches an existing UI in place, and `continue_journey` builds the next step of a multi-step flow from what the user just did.

## `mode: 'edit'` — patch, don't regenerate

Pass your current spec as `prior_spec` and describe the change. The server returns a **minimal patch** — ops that touch only what changed — instead of a full regeneration:

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme();

const stream = frayme.compose.stream({
  prompt: 'Add a status filter above the table',
  mode: 'edit',
  prior_spec: currentSpec, // the spec you stored from the last compose
});

const { spec: nextSpec } = await stream.finalSpec();
```

The SDK seeds the stream accumulator with `prior_spec`, so each op applies over your existing document — `stream.currentSpec()` is your UI morphing live, and `finalSpec()` resolves with the complete updated spec, validated as a whole.

### What edit preserves

- **Untouched elements are preserved exactly as you sent them.** The patch addresses changed paths only; nothing else is re-emitted or reformatted. Your element ids, props, and wiring outside the edit come back byte-for-byte.
- **The whole result is still validated.** The patched document faces the same gate as a fresh generation before `compose.completed` — you never receive a spec the edit broke.
- **Client state survives on the canvas.** When the patched spec lands at an unchanged `restartKey`, `<FraymeRenderer>` merges state field-by-field: the server owns *which keys exist* (new fields appear, removed fields drop), the client owns *the value* of any key it still carries — the user's in-progress edits win over redelivered values.

`prior_spec` is capped at 48,000 serialized characters. If a spec has grown past that, store it and edit a focused subsection, or recompose fresh.

{% hint style="info" %}
Store the compacted spec from `finalSpec()`, not the op stream. The stored document is what you pass back as `prior_spec` — and it stays valid input for future edits no matter how many rounds it has been through.
{% endhint %}

## `mode: 'continue_journey'` — the next step of a flow

A journey is a sequence of composed screens where each step depends on what the user did on the last one. When an action fires on the rendered UI, forward it into the next compose as `action_context`:

```ts
import type { DynamicActionEvent } from '@frayme/runtime/react';

async function onDynamicAction(event: DynamicActionEvent) {
  if (event.action !== 'continueToShipping') return;

  const stream = frayme.compose.stream({
    prompt: 'Shipping details step of the checkout',
    mode: 'continue_journey',
    signals: { data_shape: ['form'], patterns: ['multi-step'] },
    action_context: {
      action: event.action,
      event: event.event,        // the canonical verb that fired
      params: event.params,      // resolved values at fire time
      state: event.state,        // full live state snapshot — preserved across the step
      generation_id: event.generation_id, // correlates to the UI acted on
    },
  });
}
```

The runtime's `DynamicActionEvent` and the request's `action_context` mirror each other by design — the event you receive is the context you send. The next composition responds *in context*: values the user entered carry forward instead of being re-asked, and the new screen picks up where the flow left off.

## Declared actions make journeys reliable

Declare the actions each step must expose; Frayme guarantees a wired control for every `required` one:

```ts
const stream = frayme.compose.stream({
  prompt: 'Payment step: card form with order summary',
  mode: 'continue_journey',
  action_context: previousStep,
  actions: [
    { name: 'confirmPayment', role: 'approve', required: true,
      params: { type: 'object', properties: { cardToken: { type: 'string' } } } },
    { name: 'backToShipping', role: 'back' },
  ],
});
```

Each declared action can also carry a `kind` telling the server how to self-close it into `spec.actions` — `agent` (default, round-trips to you), `recompose` with a fixed `prompt` (the UI advances itself), or `host`. With `action_policy: 'declared_only'`, the server strips any model-authored action your contract didn't declare, so a journey step can never grow controls you didn't ask for.

## Edit vs journey

| | `edit` | `continue_journey` |
| --- | --- | --- |
| Input | `prior_spec` (the document) | `action_context` (what the user did) |
| Output | Minimal patch over your spec | The next screen |
| Use for | "Change this UI" | "What happens after this click" |
| State | Merged field-by-field on the live canvas | Carried in `action_context.state` |

The two combine: a journey step can also pass `prior_spec` when the next screen is an evolution of the current one rather than a fresh surface.

## Next steps

- [State and actions](state-and-actions.md) — receiving the events that feed `action_context`
- [Data binding](data-binding.md) — seeding each step with real facts
- [Idempotency and retries](idempotency-and-retries.md) — making every step safely retryable
