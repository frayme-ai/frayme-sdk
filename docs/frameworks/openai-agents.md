# OpenAI Agents SDK

Register Frayme's compose tool on an OpenAI Agents SDK (JS) agent — the one shared definition, mapped onto the `parameters` field.

## The one tool definition

`@frayme/api/tools` exports a framework-neutral definition whose schema is Zod v4 (Standard Schema). The Agents SDK's `tool()` accepts it as `parameters`.

```bash
npm i @frayme/api @frayme/runtime @openai/agents
```

```ts
// src/tools/frayme.ts
import { tool } from '@openai/agents';
import Frayme from '@frayme/api';
import { composeToolDefinition, createComposeTool } from '@frayme/api/tools';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });
const compose = createComposeTool(frayme);

export const fraymeCompose = tool({
  name: compose.name, // 'frayme_compose'
  description: compose.description,
  parameters: composeToolDefinition.inputSchema,
  // The compose schema uses open JSON maps (`data`, action `params`), which
  // strict structured outputs cannot express — register non-strict.
  strict: false,
  execute: async (input) => {
    const result = await compose.execute(input as Parameters<typeof compose.execute>[0]);

    // Deliver the spec to your front-end out-of-band; return only the
    // correlation handle to the model.
    await deliverSpecToClient(result.spec, result.generation_id);
    return { generation_id: result.generation_id, model: result.model, rendered: true };
  },
});
```

The definition carries the full compose contract — `prompt`, `signals`, `data`, `actions`, the 8-verb interaction vocabulary, and five worked call examples — inside `description` and the schema. Nothing to prompt-engineer on your side. The Agents SDK's `tool()` has no input-examples field, so the worked examples in `description` are what the model sees (the structured `inputExamples` on the bound tool are for the AI SDK / Mastra / Anthropic paths).

## A minimal agent

```ts
// src/agent.ts
import { Agent, run } from '@openai/agents';
import { fraymeCompose } from './tools/frayme';

const uiAgent = new Agent({
  name: 'UI agent',
  instructions:
    'When an interface serves the user better than prose, call frayme_compose. ' +
    'Pass every fact the UI must show in `data`. Never print the spec as text.',
  tools: [fraymeCompose],
});

const result = await run(
  uiAgent,
  'A refund approval card for order #4821: amount, reason, approve/deny.',
);
```

## Rendering the returned spec

On the client, render the spec your delivery channel hands you:

```tsx
'use client';
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer
  spec={spec}
  skipValidation // the API already validated before billing
  onDynamicAction={(e) => {
    // { action, event, params, state, element_id, label, description, generation_id } — a declared action was pressed.
  }}
/>;
```

Local behaviors — sorting, filtering, tabs, typing over data you supplied — resolve in the browser. Only the actions declared in the compose call reach `onDynamicAction`.

## Closing the loop

Register the round-trip tool so a user interaction recomposes the UI in context:

```ts
import { actionToolDefinition, createActionTool } from '@frayme/api/tools';

const action = createActionTool(frayme);

export const fraymeAction = tool({
  name: action.name, // 'frayme_action'
  description: action.description,
  parameters: actionToolDefinition.inputSchema,
  strict: false,
  execute: async (input) => {
    const result = await action.execute(input as Parameters<typeof action.execute>[0]);
    await deliverSpecToClient(result.spec, result.generation_id);
    return { generation_id: result.generation_id, rendered: true };
  },
});
```

Forward the `onDynamicAction` event to your agent verbatim — `{ action, event, params, state, element_id, label, description, generation_id }`. The agent calls `frayme_action` with those fields and receives a new validated spec preserving the state the user already entered. Only a press fires it — a Button, a Confirmation, a Form submit, a DataTable or a row/bulk action; other gestures batch under `state._ui` behind the next press unless the action is declared `live: true`.

## Next steps

- [@frayme/api reference](../sdk/api.md) — client options, streaming, typed errors
- [@frayme/runtime reference](../sdk/runtime.md) — full renderer props
- [Vercel AI SDK](ai-sdk.md) — if your front-end runs `useChat`, the data-parts bridge streams specs live
