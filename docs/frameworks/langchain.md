# LangChain.js

Give a LangChain agent the ability to generate live, interactive UI by registering Frayme's compose tool — one definition, mapped onto LangChain's `schema` field.

## The one tool definition

`@frayme/api/tools` exports a framework-neutral definition whose schema is Zod v4 (Standard Schema). LangChain's `tool()` helper accepts it as `schema` directly.

```bash
npm i @frayme/api @frayme/runtime @langchain/core @langchain/langgraph
```

```ts
// src/tools/frayme.ts
import { tool } from '@langchain/core/tools';
import Frayme from '@frayme/api';
import { createComposeTool } from '@frayme/api/tools';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });
const compose = createComposeTool(frayme);

export const fraymeCompose = tool(
  async (input) => {
    const result = await compose.execute(input);

    // Deliver the spec to your front-end OUT-OF-BAND (websocket, SSE, DB row —
    // whatever your app uses). Never return it as model-visible text: the
    // model doesn't need it, and it would waste the context window.
    await deliverSpecToClient(result.spec, result.generation_id);

    // LangChain tool results are strings — return the correlation handle only.
    return JSON.stringify({
      generation_id: result.generation_id,
      model: result.model,
      rendered: true,
    });
  },
  {
    name: compose.name, // 'frayme_compose'
    description: compose.description,
    schema: compose.inputSchema,
  },
);
```

The definition carries the full compose contract — `prompt`, `signals`, `data`, `actions`, the 8-verb interaction vocabulary, and five worked call examples — in its `description` and schema. No prompt engineering on your side. LangChain's `tool()` has no input-examples field, so the worked examples in `description` are what the model sees (the structured `inputExamples` on the bound tool are for the AI SDK / Mastra / Anthropic paths).

## A minimal agent

```ts
// src/agent.ts
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { fraymeCompose } from './tools/frayme';

const agent = createReactAgent({
  llm, // any chat model LangChain supports — your choice
  tools: [fraymeCompose],
  prompt:
    'When an interface serves the user better than prose, call frayme_compose. ' +
    'Pass every fact the UI must show in `data`. Never print the spec as text.',
});

const result = await agent.invoke({
  messages: [
    {
      role: 'user',
      content: 'Show me this quarter\'s revenue by product line as a dashboard.',
    },
  ],
});
```

## Rendering the returned spec

On the client, render whatever spec your delivery channel hands you:

```tsx
'use client';
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer
  spec={spec}
  skipValidation // the API already validated before billing
  onDynamicAction={(e) => {
    // { action, event, params, state, element_id, label, description, generation_id } — send it to your agent.
  }}
/>;
```

Sorting, filtering, tabs, and typing over data you supplied resolve locally in the renderer. Only the actions you declared in the compose call round-trip to your agent.

## Closing the loop

Register `frayme_action` too, so user interactions recompose the UI in context:

```ts
import { createActionTool } from '@frayme/api/tools';

const action = createActionTool(frayme);

export const fraymeAction = tool(
  async (input) => {
    const result = await action.execute(input);
    await deliverSpecToClient(result.spec, result.generation_id);
    return JSON.stringify({ generation_id: result.generation_id, rendered: true });
  },
  {
    name: action.name, // 'frayme_action'
    description: action.description,
    schema: action.inputSchema,
  },
);
```

When `onDynamicAction` fires on the client, forward the event to your agent verbatim — `{ action, event, params, state, element_id, label, description, generation_id }`. The agent calls `frayme_action` with those fields and receives a new validated spec that preserves what the user already entered. Only a press fires it — a Button, a Confirmation, a Form submit, a DataTable or a row/bulk action; other gestures batch under `state._ui` behind the next press unless the action is declared `live: true`.

{% hint style="info" %}
For live streaming into a LangGraph front-end, the [AG-UI adapter](ag-ui.md) carries specs as `frayme:spec` custom events — LangGraph is on the AG-UI integrations matrix.
{% endhint %}

## Next steps

- [@frayme/api reference](../sdk/api.md) — streaming, retries, typed errors
- [@frayme/runtime reference](../sdk/runtime.md) — full renderer props
- [AG-UI](ag-ui.md) — streaming transport conventions
