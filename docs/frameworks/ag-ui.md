# AG-UI

Deliver Frayme UI over the AG-UI protocol: specs travel to the browser as `frayme:spec` custom events, and user actions return through the `frayme:action` frontend tool.

## The conventions

AG-UI is the transport between *your* agent and *your* front-end (LangGraph, CrewAI, Mastra, Pydantic AI, Agno — anything on the AG-UI integrations matrix). Frayme is a tool the agent calls; the adapter defines two conventions on top of the protocol:

| Direction | Convention | Shape |
| --- | --- | --- |
| Agent → browser | `CUSTOM` event named `frayme:spec` | `{ type: 'CUSTOM', name: 'frayme:spec', value: SpecDataPart }` |
| Browser → agent | frontend tool named `frayme:action` | `{ action, event, params, state, generation_id, element_id, label?, description? }` |

A `SpecDataPart` is either `{ type: 'patch', patch }` (progressive), `{ type: 'flat', spec }` (replace the whole snapshot), or `{ type: 'nested', spec }`. The spec stays out-of-band — it is never a model-visible tool result.

Both event names are exported as constants: `FRAYME_SPEC_EVENT` and `FRAYME_ACTION_TOOL`.

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

`emitAgUiEvent` is whatever your AG-UI integration uses to push events down the run — the adapter only fixes the event's shape.

## Client side: `useFraymeAgUiSpec` + `FraymeAgUiRenderer`

```tsx
'use client';
import { useEffect } from 'react';
import {
  useFraymeAgUiSpec,
  FraymeAgUiRenderer,
  createAgUiActionForwarder,
} from '@frayme/runtime/ag-ui';
import '@frayme/runtime/styles.css';

export function AgentCanvas({ agent }) {
  const { spec, onAgUiEvent, restartKey, reset } = useFraymeAgUiSpec();

  // Feed EVERY AG-UI event in; non-Frayme events are ignored.
  useEffect(
    () => agent.subscribe({ onEvent: ({ event }) => onAgUiEvent(event) }),
    [agent, onAgUiEvent],
  );

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
| `restartKey` | Bumps whenever a `flat`/`nested` part replaces the snapshot — pass it straight to the renderer so client state remounts (restart semantics). |
| `reset()` | Clear the snapshot and bump `restartKey`. |

`FraymeAgUiRenderer` is a thin alias of `FraymeRenderer` that defaults to `mode="progressive"` — every [renderer prop](../sdk/runtime.md) works.

## Actions back: the `frayme:action` frontend tool

Dynamic actions carry the full enriched event — `{ action, event, params, state, generation_id, element_id, label, description }` — not a lossy text message. `label` is the pressed control's label, verbatim, when the fire names one; `description` is the host's declaration of the action (`actionContract` prop, else the entry in a consumer `actions` map, else the server-stamped `spec.actions[name].description`). Both are optional; `fraymeActionToolDefinition` declares them in its JSON-Schema `parameters`, and `<FraymeActionReceipt event={e} />` renders them as the thread card. Two ways to wire the return path:

**1. Forwarded props** (shown above) — `createAgUiActionForwarder` emits `{ name: 'frayme:action', value: event }` through whatever channel you give it.

**2. A frontend tool** — for clients with frontend-tool support (e.g. CopilotKit's `useFrontendTool`), register the exported definition and route calls to your agent loop:

```ts
import { fraymeActionToolDefinition } from '@frayme/runtime/ag-ui';

useFrontendTool({
  ...fraymeActionToolDefinition, // name: 'frayme:action', JSON-Schema parameters
  handler: (event) => forwardToAgent(event),
});
```

On the agent side, pass the event verbatim to the `frayme_action` tool (`createActionTool` from `@frayme/api/tools`): Frayme recomposes the next step in context, preserving the state the user already entered, and your agent emits the new spec as `frayme:spec` events again — the loop continues.

{% hint style="info" %}
The adapter treats AG-UI events as plain structural JSON — it never imports `@ag-ui/core` schemas, so no schema-library version constraints leak into your app.
{% endhint %}

## Next steps

- [@frayme/runtime reference](../sdk/runtime.md) — renderer props, theming
- [@frayme/api reference](../sdk/api.md) — the compose stream the agent side consumes
- [Vercel AI SDK](ai-sdk.md) — the same loop over AI SDK data parts instead of AG-UI
