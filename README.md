# Frayme: UI for Agents

Turn your agent's intent into real, interactive, validated UI, rendered live on the stack you already use.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](packages/api/LICENSE)
[![@frayme/api](https://img.shields.io/npm/v/%40frayme%2Fapi?label=%40frayme%2Fapi)](https://www.npmjs.com/package/@frayme/api)
[![@frayme/catalog](https://img.shields.io/npm/v/%40frayme%2Fcatalog?label=%40frayme%2Fcatalog)](https://www.npmjs.com/package/@frayme/catalog)
[![@frayme/runtime](https://img.shields.io/npm/v/%40frayme%2Fruntime?label=%40frayme%2Fruntime)](https://www.npmjs.com/package/@frayme/runtime)

POST a prompt to `/v1/compose` and get back a validated [json-render](https://json-render.dev) UI spec, streamed as typed SSE events. Render it with `<FraymeRenderer/>`; user interactions flow back to your agent as typed action events. Built on open standards (json-render for the spec, AG-UI for agent transport, MCP for host integration), so nothing here locks you in.

## Install

```bash
npm i @frayme/api @frayme/runtime
```

## 30-second quickstart

```ts
// server
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({ prompt: 'A pricing page with three tiers' });
stream.on('op', (op, snapshot) => render(snapshot)); // live spec snapshots
stream.on('restarted', () => clearRendered());       // attempt failed → discard & keep listening
const { spec, model } = await stream.finalSpec();    // validated final spec
```

```tsx
// client
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer spec={spec} onDynamicAction={(e) => sendToAgent(e)} />
```

Most interactions (typing, tabs, toggles, state-bound visibility) resolve locally in the browser; only spec-declared named actions reach `onDynamicAction`, where your agent takes over.

## Packages

| Package | Version | What it is |
|---------|---------|------------|
| [`@frayme/api`](packages/api) | 0.5.0 | Typed API client, agent tools (`/tools`, `/agent`, `/ai-sdk`) and a server proxy handler (`/server`). Fetch-based, streaming SSE, retries with idempotency. Node ≥ 20.19 / Bun / Deno / Workers / edge. |
| [`@frayme/catalog`](packages/catalog) | 0.4.0 | The 189-component vocabulary a Frayme spec may use. Zod schemas + spec validation via `fraymeCatalog.validate()`. Zero React deps. |
| [`@frayme/runtime`](packages/runtime) | 0.5.0 | React renderer (`<FraymeRenderer/>`, `<FraymeResult/>`, `<FraymeScreen/>`) + transport adapters for the Vercel AI SDK (`/ai-sdk`) and AG-UI (`/ag-ui`). Themeable via `--frayme-*` CSS variables, with light and dark token pairs. React 19. |

## Agent frameworks

Frayme is the tool your agent calls. Your framework keeps the model, the loop and the thread.

### Vercel AI SDK 6

`fraymeTools()` gives your agent `frayme_compose` and `frayme_action`. The screen streams to the UI in the tool outputs, and the model sees only `{ generation_id, status, operation_count }`:

```ts
// app/api/chat/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { fraymeTools } from '@frayme/api/ai-sdk';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const tools = { ...yourTools, ...fraymeTools({ messages }) };
  return streamText({
    model: anthropic('claude-sonnet-5'),
    tools,
    messages: await convertToModelMessages(messages, { tools }),
    stopWhen: stepCountIs(6),
  }).toUIMessageStreamResponse();
}
```

Three rules for the route:

- Create the tools per request.
- Pass the UI messages exactly as `useChat` posted them, metadata included.
- Keep `{ tools }` on `convertToModelMessages`. Without it, the full spec reaches the model.

On the client, `fraymePart()` picks out the Frayme parts of each message. `<FraymeResult/>` draws each one, and `pressMessage()` sends a press back as the user's next message. `interactive={!busy}` stops a press from starting a second request while the agent is still answering:

```tsx
// app/page.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { fraymePart, pressMessage } from '@frayme/runtime/ai-sdk';
import { FraymeResult } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

export default function Page() {
  const { messages, sendMessage, status } = useChat();
  const busy = status === 'submitted' || status === 'streaming';
  return (
    <main>
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) => {
            const frayme = fraymePart(part, message);
            if (frayme) {
              return (
                <FraymeResult
                  key={i}
                  {...frayme}
                  scheme="system"
                  interactive={!busy}
                  onPress={(e) => sendMessage(pressMessage(e))}
                />
              );
            }
            return part.type === 'text' ? <p key={i}>{part.text}</p> : null;
          })}
        </div>
      ))}
    </main>
  );
}
```

`fraymeTools({ intents, sources, messages })` also adds `lookup_intent` and `query_source`, so the agent can read your app's own example calls and records before it composes.

### Other frameworks

`@frayme/api/tools` has one Zod v4 (Standard Schema) definition per tool, and `@frayme/api/agent` has the framework-neutral core: intents, sources, streaming compose outputs and press helpers.

| Framework | Wiring |
|-----------|--------|
| Vercel AI SDK 6 (by hand) | `tool({ ...createComposeTool(frayme) })` |
| Mastra | `createTool({ id: compose.name, ...compose })`, with `const compose = createComposeTool(frayme)` |
| LangChain.js | `tool(execute, { schema: composeToolDefinition.inputSchema, ... })` |
| OpenAI Agents SDK (JS) | `tool({ name, description, parameters: input_schema, strict: false, execute })`, using the plain JSON Schema from `anthropicToolDefinitions()`. `tool()` rejects these Zod schemas. |

For AG-UI agents, `@frayme/runtime/ag-ui` delivers specs as `frayme:spec` custom events. `createAgUiActionForwarder` hands each press back as a `{ name: 'frayme:action', value: event }` payload, which you pass to the agent, for example in `forwardedProps`. For hand-built AI SDK data parts, `composeStreamToDataParts()` (server) and `<FraymeMessageRenderer/>` (client) still work.

## Chatless screens

A screen can also be composed straight from props, with no chat. Your server route holds the key:

```ts
// app/api/frayme/[...path]/route.ts
import { createFraymeHandler } from '@frayme/api/server';

export const POST = createFraymeHandler({ authorize: getUser });
```

```tsx
// app/orders/page.tsx
'use client';
import { FraymeProvider, FraymeScreen } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

export default function Orders({ orders }: { orders: Order[] }) {
  return (
    <FraymeProvider endpoint="/api/frayme" scheme="system">
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
        onAction={(event, screen) => screen.continue(event)}
      />
    </FraymeProvider>
  );
}
```

The browser client posts to `<endpoint>/v1/compose`, which is why the handler sits in a catch-all route under the endpoint. The handler ignores the path.

## Streaming contract

```
compose.started → op×N (live, provisional) → [compose.restarted ⇒ discard rendered state] → compose.completed | error
```

Every generation is validated against the catalog before `compose.completed`: ops are provisional until then. In-band errors surface as typed `FraymeError` subclasses; retries reuse one idempotency key per logical call, so a retried success replays instead of re-billing.

## Development

```bash
npm install          # postinstall builds @frayme/catalog
npm run build        # tsdown across workspaces
npm run test         # vitest across workspaces
```

npm workspaces + tsdown (ESM-only + DTS) + changesets for versioning and changelogs.

## Links

- Website: [frayme.ai](https://frayme.ai)
- Docs: [docs.frayme.ai](https://docs.frayme.ai)
- License: MIT (see per-package `LICENSE` files)

Get an API key at [frayme.ai](https://frayme.ai).
