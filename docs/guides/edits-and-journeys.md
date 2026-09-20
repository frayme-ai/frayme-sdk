# Edits and journeys

Beyond one-shot generation, compose has two more modes: `edit` patches an existing UI in place, and `continue_journey` builds the next step of a multi-step flow from what the user just did.

## `mode: 'edit'` patches instead of regenerating

Pass your current spec as `prior_spec` and describe the change. The server returns a **minimal patch** (ops that touch only what changed) instead of a full regeneration:

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

The SDK seeds the stream accumulator with `prior_spec`, so each op applies over your existing document. `stream.currentSpec()` is your UI morphing live, and `finalSpec()` resolves with the complete updated spec, validated as a whole.

### What edit preserves

- **Untouched elements are preserved exactly as you sent them.** The patch addresses changed paths only; nothing else is re-emitted or reformatted. Your element ids, props, and wiring outside the edit come back byte-for-byte.
- **The whole result is still validated.** The patched document faces the same gate as a fresh generation before `compose.completed`: you never receive a spec the edit broke.
- **Client state survives on the canvas.** When the patched spec lands at an unchanged `restartKey`, `<FraymeRenderer>` merges state field-by-field: the server owns *which keys exist* (new fields appear, removed fields drop), the client owns *the value* of any key it still carries. The user's in-progress edits win over redelivered values.

`prior_spec` is capped at 48,000 serialized characters. If a spec has grown past that, store it and edit a focused subsection, or recompose fresh.

{% hint style="info" %}
Store the compacted spec from `finalSpec()`, not the op stream. The stored document is what you pass back as `prior_spec`, and it stays valid input for future edits no matter how many rounds it has been through.
{% endhint %}

## `mode: 'continue_journey'` builds the next step of a flow

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
      state: event.state,        // full live state snapshot, preserved across the step
      generation_id: event.generation_id, // correlates to the UI acted on
    },
  });
}
```

The runtime's `DynamicActionEvent` and the request's `action_context` mirror each other by design, so the event you receive is the context you send. The next composition responds *in context*: values the user entered carry forward instead of being re-asked, and the new screen picks up where the flow left off.

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

Each declared action can also carry a `kind` telling the server how to self-close it into `spec.actions`: `agent` (default, round-trips to you), `recompose` with a fixed `prompt` (the UI advances itself), or `host`. With `action_policy: 'declared_only'`, the server strips any model-authored action your contract didn't declare, so a journey step can never grow controls you didn't ask for.

## Edit vs journey

| | `edit` | `continue_journey` |
| --- | --- | --- |
| Input | `prior_spec` (the document) | `action_context` (what the user did) |
| Output | Minimal patch over your spec | The next screen |
| Use for | "Change this UI" | "What happens after this click" |
| State | Merged field-by-field on the live canvas | Carried in `action_context.state` |

The two combine: a journey step can also pass `prior_spec` when the next screen is an evolution of the current one rather than a fresh surface.

## In a chat: `edit_of`

With [`fraymeTools`](../sdk/api-ai-sdk.md), the model never sees a spec, so it cannot pass `prior_spec`. It names the screen instead, with the `generation_id` it read from an earlier `frayme_compose` result:

```json
{ "prompt": "Add a status filter above the table", "edit_of": "gen_4b8e1c" }
```

- **The tool attaches the screen.** It looks only at the finished outputs of Frayme's own tool calls (`frayme_compose` and `frayme_action`) in the `messages` you passed to `fraymeTools({ messages })`, and sends the screen with that id as `prior_spec`. A spec the model wrote, or another tool returned, is never used.
- **`edit_of` edits.** The mode becomes `edit`, even when the model sent `mode: 'create'`. Only `mode: 'continue_journey'` changes that: the next step then builds on the screen instead.
- **An unknown id is refused** with code `UNKNOWN_SCREEN` when no finished screen with that id is in `messages`. The user sees nothing, and the model can correct the id and call again in the same turn. `mode: 'edit'` without `edit_of` gets the same code.
- **A rejected edit is an error.** When the server rejects the attached screen for an edit, the tool returns an error output instead of quietly building a new screen, so the model never reports an edit that did not happen.
- **A screen too large to send cannot be edited.** A screen over 48,000 characters of JSON (the `prior_spec` ceiling) is refused for an edit with code `SCREEN_TOO_LARGE`, and the model is told to leave `edit_of` out and describe the whole new screen, which it can do in the same turn. With `mode: 'continue_journey'`, such a screen is left out instead, the step is built without it, and the model is told (`trimmed`).
- **A press attaches no screen.** Since 0.6.0 `frayme_action` composes the next screen fresh: it sends the model's `prompt`, `data`, `actions` and `signals`, with no `mode`, no `prior_spec` and no `action_context`. The pressed screen as `prior_spec` read to the composer as "edit this" and handed the same screen back, and `action_context` reached no prompt. So the press is described in `prompt`, and a value the user entered appears on the next screen only when the model names it in `data`. Nothing is cut to fit on a press.
- **A `continue_journey` with `edit_of`** attaches that screen. If the server rejects it, the step continues once without it, and the model is told (`prior_screen_dropped`).
- **Without `messages` there is no `edit_of`.** The compose tool does not offer the field, `mode: 'edit'` is refused with `UNKNOWN_SCREEN`, and every screen is described and built in full.

## Without a chat: `FraymeScreen`

`<FraymeScreen>` and `useFraymeScreen` from `@frayme/runtime/react` send both modes for you, through the screen's handle:

- **`screen.edit(prompt)`** sends `mode: 'edit'` with the last complete screen as `prior_spec`.
- **`screen.continue(event, prompt?)`** sends a plain create: the prompt names the control that was pressed, and the pressed action's params ride in `data` over the props' own. Since 0.6.0 it sends no `mode`, no `prior_spec` and no `action_context`, and the event's `state` is never sent.

```tsx
// app/orders/orders-screen.tsx
'use client';
import { FraymeScreen } from '@frayme/runtime/react';

export function OrdersScreen({ orders }: { orders: Order[] }) {
  return (
    <FraymeScreen
      prompt="The open orders, newest first, with a Refund button per row"
      data={{ orders }}
      actions={[
        {
          name: 'refundOrder',
          role: 'Refund',
          params: { type: 'object', properties: { orderId: { type: 'string' } }, required: ['orderId'] },
        },
      ]}
      // A press moves the flow on: a fresh screen that names the press and carries its params.
      onAction={(event, screen) => screen.continue(event, 'The refund confirmation for this order')}
    />
  );
}
```

Only a finished screen is ever sent as `prior_spec`, and only by `edit`; each step resends the props' `data`, `actions`, `signals` and `context`.

`continue` sends nothing that needs cutting, so a big table press still moves the flow on. `edit` sends the screen as it is: a screen too large to edit gets the API's error in the screen's notice.

The screen needs a client, usually from `<FraymeProvider endpoint>` with a [server handler](server-handler.md) behind it. See [Chatless screens](chatless-screens.md) for the whole flow.

## Next steps

- [State and actions](state-and-actions.md): receiving the events that feed `action_context`
- [Data binding](data-binding.md): seeding each step with real facts
- [Idempotency and retries](idempotency-and-retries.md): making every step safely retryable
