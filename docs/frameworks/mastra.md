# Mastra

Register Frayme's compose tool on a Mastra agent so it can generate live, interactive UI whenever an interface serves the user better than prose.

## The one tool definition

`@frayme/api/tools` ships a single, framework-neutral tool definition. Its schema is Zod v4 (Standard Schema), which Mastra's `createTool` accepts as `inputSchema` directly — no conversion, no re-authoring.

```bash
npm i @frayme/api @frayme/runtime @mastra/core
```

```ts
// src/mastra/tools/frayme.ts
import { createTool } from '@mastra/core/tools';
import Frayme from '@frayme/api';
import { createComposeTool } from '@frayme/api/tools';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

// Binds the definition to your client: execute() performs a non-streaming
// compose and resolves with the validated result.
const compose = createComposeTool(frayme);

export const fraymeCompose = createTool({
  id: compose.name, // 'frayme_compose'
  description: compose.description,
  inputSchema: compose.inputSchema,
  outputSchema: compose.outputSchema,
  // Structured worked calls — Mastra carries `inputExamples` natively and hands
  // them to providers that support the field (Anthropic's `input_examples`).
  inputExamples: compose.inputExamples,
  execute: async ({ context }) => compose.execute(context),
});
```

The definition carries everything the model needs — the full compose contract (`prompt`, `signals`, `data`, `actions`, …), the 8-verb interaction vocabulary, and five worked call examples — inside its `description` and schema, and the same examples again as `inputExamples` for providers that read the structured field. You do not write any prompt text about how to call Frayme.

## A minimal agent

```ts
// src/mastra/agents/ui-agent.ts
import { Agent } from '@mastra/core/agent';
import { fraymeCompose } from '../tools/frayme';

export const uiAgent = new Agent({
  name: 'ui-agent',
  instructions:
    'When an interface serves the user better than prose — a form, dashboard, ' +
    'table, confirmation — call frayme_compose. Pass every fact the UI must ' +
    'show in `data`. Never print the returned spec as text.',
  model: 'your-provider/your-model', // any model Mastra supports — your choice
  tools: { fraymeCompose },
});
```

```ts
// anywhere on your server
const result = await uiAgent.generate('A signup form: name, work email, Create account button.');

// The compose result rides the tool-result channel:
const toolResult = result.toolResults.find((r) => r.toolName === 'fraymeCompose');
const { spec, generation_id } = toolResult.result;
```

## Rendering the returned spec

Ship `spec` to your front-end (as JSON — it is a plain json-render document) and render it:

```tsx
'use client';
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer
  spec={spec}
  skipValidation // the API already validated before billing
  onDynamicAction={(e) => {
    // { action, event, params, state, element_id, label, description, generation_id }
    // — a declared action was PRESSED. Feed it back to your agent to continue the journey.
  }}
/>;
```

Most interactions (typing, tabs, sorting supplied data) resolve locally in the renderer — only actions you declared in the compose call reach `onDynamicAction`.

## Closing the loop

Register the round-trip tool too, so a user interaction recomposes the UI in context:

```ts
import { createActionTool } from '@frayme/api/tools';

const action = createActionTool(frayme);

export const fraymeAction = createTool({
  id: action.name, // 'frayme_action'
  description: action.description,
  inputSchema: action.inputSchema,
  outputSchema: action.outputSchema,
  inputExamples: action.inputExamples,
  execute: async ({ context }) => action.execute(context),
});
```

Forward the `onDynamicAction` event to your agent verbatim (`{ action, event, params, state, element_id, label, description, generation_id }`); the agent calls `frayme_action` with it and gets back a new validated spec that preserves the state the user already entered. Only a press reaches you — a Button, a Confirmation, a Form submit, a DataTable or a row/bulk action; every other gesture batches under `state._ui` behind the next press unless the action is declared `live: true`.

{% hint style="info" %}
Streaming to the browser: Mastra is on the AG-UI integrations matrix. To stream specs live instead of delivering the final result, use the [AG-UI adapter](ag-ui.md) — the spec travels as `frayme:spec` custom events and actions return via the `frayme:action` frontend tool.
{% endhint %}

## Next steps

- [@frayme/api reference](../sdk/api.md) — `compose.stream()` if you want progressive rendering
- [@frayme/runtime reference](../sdk/runtime.md) — full renderer props
- [AG-UI](ag-ui.md) — streaming transport for Mastra front-ends
