# AG-UI

Deliver Frayme UI over the AG-UI protocol: specs travel to the browser as `frayme:spec` custom events, and user presses return to your agent as `frayme:action` payloads in forwarded props.

## The conventions

AG-UI is the transport between *your* agent and *your* front-end (LangGraph, CrewAI, Mastra, Pydantic AI, Agno, and anything else on the AG-UI integrations matrix). Frayme is a tool the agent calls; the adapter defines two conventions on top of the protocol:

| Direction | Convention | Shape |
| --- | --- | --- |
| Agent → browser | `CUSTOM` event named `frayme:spec` | `{ type: 'CUSTOM', name: 'frayme:spec', value: SpecDataPart }` |
| Browser → agent | payload named `frayme:action`, sent in `forwardedProps` | `{ name: 'frayme:action', value: { action, event, params, state, generation_id, element_id, label?, description? } }` |

A `SpecDataPart` is either `{ type: 'patch', patch }` (progressive), `{ type: 'flat', spec }` (replace the whole snapshot), or `{ type: 'nested', spec }`. The spec stays out-of-band: it is never a model-visible tool result.

Both names are exported from `@frayme/runtime/ag-ui` as constants: `FRAYME_SPEC_EVENT` (`'frayme:spec'`) and `FRAYME_ACTION_TOOL` (`'frayme:action'`, the name on the action payload).

```bash
npm i @frayme/api @frayme/runtime
```

## Agent side: emit `frayme:spec` events

Reuse the server-safe bridge to turn a compose stream into data parts, then wrap each in a `CUSTOM` event:

```ts
import Frayme from '@frayme/api';
import { composeStreamToDataParts } from '@frayme/runtime';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

// Inside your frayme_compose tool handler:
const stream = frayme.compose.stream(input);
for await (const part of composeStreamToDataParts(stream)) {
  emitAgUiEvent({ type: 'CUSTOM', name: 'frayme:spec', value: part });
}
const { generationId, model } = await stream.finalSpec();
return { generation_id: generationId, model, rendered: true }; // model-visible result
```

`emitAgUiEvent` is whatever your AG-UI integration uses to push events down the run. The adapter only fixes the event's shape.

## Client side: `useFraymeAgUiSpec` + `FraymeAgUiRenderer`

```tsx
'use client';
import { useEffect } from 'react';
import type { AbstractAgent } from '@ag-ui/client';
import {
  useFraymeAgUiSpec,
  FraymeAgUiRenderer,
  createAgUiActionForwarder,
} from '@frayme/runtime/ag-ui';
import '@frayme/runtime/styles.css';

export function AgentCanvas({ agent }: { agent: AbstractAgent }) {
  const { spec, onAgUiEvent, restartKey, reset } = useFraymeAgUiSpec();

  // Feed EVERY AG-UI event in; non-Frayme events are ignored.
  useEffect(() => {
    // Braces: onEvent must not return a value (a returned object is read as a state mutation).
    const sub = agent.subscribe({ onEvent: ({ event }) => { onAgUiEvent(event); } });
    return () => sub.unsubscribe();
  }, [agent, onAgUiEvent]);

  // Outbound: forward dynamic actions to the agent as a structured payload.
  const onDynamicAction = createAgUiActionForwarder({
    emit: (payload) => agent.runAgent({ forwardedProps: { frayme: payload } }),
  });

  return (
    <FraymeAgUiRenderer
      spec={spec}
      restartKey={restartKey}
      onDynamicAction={onDynamicAction}
    />
  );
}
```

What the hook returns:

| Field | Meaning |
| --- | --- |
| `spec` | The accumulated spec snapshot (`patch` parts fold in; `flat` replaces). |
| `onAgUiEvent(event)` | Feed every AG-UI event here; anything that isn't a `frayme:spec` custom event is ignored. |
| `restartKey` | Bumps whenever a `flat`/`nested` part replaces the snapshot. Pass it straight to the renderer so client state remounts (restart semantics). |
| `reset()` | Clear the snapshot and bump `restartKey`. |

`FraymeAgUiRenderer` is a thin alias of `FraymeRenderer` that defaults to `mode="progressive"`. Every [renderer prop](../sdk/runtime.md) works.

## Actions back: forwarded props

Dynamic actions carry the full enriched event (`{ action, event, params, state, generation_id, element_id, label, description }`), not a lossy text message. `label` is the pressed control's label, verbatim, when the fire names one; `description` is the host's declaration of the action (`actionContract` prop, else the entry in a consumer `actions` map, else the server-stamped `spec.actions[name].description`). Both are optional, and `<FraymeActionReceipt event={e} />` from `@frayme/runtime/react` renders them as the thread card.

`createAgUiActionForwarder({ emit })` (shown above) wraps each event as `{ name: 'frayme:action', value: event }` and passes it to `emit`. Send it to your agent as a new run with the payload in `forwardedProps`, as in `agent.runAgent({ forwardedProps: { frayme: payload } })`. A press is new user input, not the answer to a tool call the agent made, which is why it travels as forwarded props.

On the agent side, the event sits at `forwardedProps.frayme.value`. `readPress` from [`@frayme/api/agent`](../sdk/api-agent.md) checks it against the `frayme_action` input schema and returns `undefined` for anything else:

```ts
import type { RunAgentInput } from '@ag-ui/core';
import { readPress } from '@frayme/api/agent';

// In your agent's run handler: the press, or undefined when the run carries none.
function pressOf(input: RunAgentInput) {
  return readPress(input.forwardedProps?.frayme?.value);
}
```

Hand the press to your agent so it calls the `frayme_action` tool (`createActionTool` from `@frayme/api/tools`) with the event verbatim, plus `prompt`, `data`, `actions` and `signals` for the next screen. Frayme recomposes the next step in context, preserving the state the user already entered, and your agent emits the new spec as `frayme:spec` events again, so the loop continues.

{% hint style="info" %}
The adapter treats AG-UI events as plain structural JSON: it never imports `@ag-ui/core` schemas, so no schema-library version constraints leak into your app.
{% endhint %}

## Next steps

- [@frayme/runtime reference](../sdk/runtime.md): renderer props, theming
- [@frayme/api reference](../sdk/api.md): the compose stream the agent side consumes
- [Vercel AI SDK](ai-sdk.md): the same loop over AI SDK data parts instead of AG-UI
