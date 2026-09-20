# OpenAI Agents SDK

Register Frayme's compose and action tools on an OpenAI Agents SDK (JS) agent, as plain JSON Schema tools registered non-strict.

## The one tool definition

`@frayme/api/tools` exports both tool definitions as plain JSON Schema through `anthropicToolDefinitions()`, compose first, then action. Pass that schema to the Agents SDK's `tool()` as `parameters` with `strict: false`. The compose schema has open JSON maps (`data`, action `params`) that strict mode cannot express, and the Agents SDK rejects a Zod schema when `strict` is `false`, so the JSON Schema is the one to use. The SDK does not check non-strict input, so parse it inside `execute` with `composeInputSchema` before you call Frayme.

```bash
npm i @frayme/api @frayme/runtime @openai/agents
```

```ts
// src/tools/frayme.ts
import { tool } from '@openai/agents';
import Frayme from '@frayme/api';
import { anthropicToolDefinitions, composeInputSchema, createComposeTool } from '@frayme/api/tools';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });
const compose = createComposeTool(frayme);

// Plain JSON Schema, always in this order: [frayme_compose, frayme_action].
const [composeDef, actionDef] = anthropicToolDefinitions();

export const fraymeCompose = tool({
  name: composeDef.name, // 'frayme_compose'
  description: composeDef.description,
  // Open JSON maps (`data`, action `params`) rule out strict mode.
  parameters: composeDef.input_schema as any,
  strict: false,
  execute: async (raw) => {
    const result = await compose.execute(composeInputSchema.parse(raw));

    // Deliver the spec to your front-end out-of-band; return only the
    // correlation handle to the model.
    await deliverSpecToClient(result.spec, result.generation_id);
    return { generation_id: result.generation_id, model: result.model, rendered: true };
  },
});
```

The definition carries the full compose contract (`prompt`, `signals`, `data`, `actions`, the 8-verb interaction vocabulary, and five worked call examples) inside `description` and the schema, so you write no prompt text about how to call Frayme. The Agents SDK's `tool()` has no input-examples field, so the worked examples in `description` are what the model sees (the structured `inputExamples` on the bound tool are for the AI SDK / Mastra / Anthropic paths).

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
    // { action, event, params, state, element_id, label, description, generation_id } arrives when a declared action was pressed.
  }}
/>;
```

Local behaviors (sorting, filtering, tabs, typing over data you supplied) resolve in the browser. Only the actions declared in the compose call reach `onDynamicAction`.

## Closing the loop

Register the round-trip tool the same way, and add `fraymeAction` to the agent's `tools`, so a user interaction recomposes the UI in context:

```ts
// src/tools/frayme.ts (continued)
import { actionInputSchema, createActionTool } from '@frayme/api/tools';

const action = createActionTool(frayme);

export const fraymeAction = tool({
  name: actionDef.name, // 'frayme_action'
  description: actionDef.description,
  parameters: actionDef.input_schema as any,
  strict: false,
  execute: async (raw) => {
    const result = await action.execute(actionInputSchema.parse(raw));
    await deliverSpecToClient(result.spec, result.generation_id);
    return { generation_id: result.generation_id, rendered: true };
  },
});
```

Forward the `onDynamicAction` event to your agent verbatim: `{ action, event, params, state, element_id, label, description, generation_id }`. The agent calls `frayme_action` with those fields and receives a new validated spec. Only a press fires it: a Button, a Confirmation, a Form submit, a DataTable or a row/bulk action. Other gestures batch under `state._ui` behind the next press unless the action is declared `live: true`.

Besides the optional `prompt`, `actionInputSchema` takes `data`, `actions` and `signals` for the next screen, exactly as on `frayme_compose`: the facts it shows, the controls it needs and the steering. Since 0.6.0 the next screen is composed fresh from those fields and nothing of the event is sent, so a value the user entered appears on it only when the agent names it in `data`, and what was pressed goes in `prompt`. Declare the actions that lead forward; an action left out comes back unwired, and re-declaring the control just pressed with required params puts its form back.

{% hint style="info" %}
The framework-neutral pieces behind the Vercel AI SDK tools live in [`@frayme/api/agent`](../sdk/api-agent.md): intent lookup (`lookupIntentTool`), source queries (`querySourceTool`), compose as a series of outputs (`composeOutputs`, `fraymeModelView`, `createComposeGuard`) and press helpers (`readPress`, `actionContextOf`, `findPriorSpec`). Each tool there is a plain `{ name, description, inputSchema, execute }` object with a Zod `inputSchema`, so you can register it on your agent too.
{% endhint %}

## Next steps

- [@frayme/api reference](../sdk/api.md): client options, streaming, typed errors
- [@frayme/runtime reference](../sdk/runtime.md): full renderer props
- [Vercel AI SDK](ai-sdk.md): if your front-end runs `useChat`, the data-parts bridge streams specs live
