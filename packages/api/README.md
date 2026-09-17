# @frayme/api

The official TypeScript client for the [Frayme](https://frayme.ai) generative-UI API. Zero dependencies, fetch-based. Runs on Node ≥ 20.19, Bun, Deno, Cloudflare Workers, and Vercel Edge.

```bash
npm i @frayme/api
```

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({ prompt: 'A pricing page with three tiers' });
stream.on('op', (op, snapshot) => render(snapshot)); // live spec snapshots
stream.on('restarted', () => clearRendered());       // attempt failed → discard & keep listening
const { spec, model } = await stream.finalSpec();    // validated final spec
```

Render `spec` with [`@frayme/runtime`](https://www.npmjs.com/package/@frayme/runtime).

## What you get

- **Two streaming layers**: `compose.stream()` (handlers + async iteration + snapshot accumulation + `finalSpec()` + `.abort()`) or `compose.create({ stream: true })` for a raw typed-event iterable. Non-streaming: `compose.create({ stream: false })`.
- **`compose.restarted` handled for you**: Frayme validates every generation; when an attempt fails, the stream restarts with a stronger model in the same response. The SDK resets its snapshot and tells you to discard.
- **Retries that can't double-bill**: 2 automatic retries (connection errors, 408/409/429/5xx) with jittered backoff and `Retry-After` support; one auto-generated `Idempotency-Key` per logical call is reused across attempts, so a retried success replays instead of re-billing.
- **Typed errors**: `RateLimitError` (with `.retryAfter`), `QuotaExceededError`, `PaymentRequiredError`, `CompositionFailedError`, … all extending `FraymeError` with `.status`/`.code`/`.requestId`.
- **Browser-safe by design**: constructing with a key in a browser throws. Use keyless proxy mode instead: `new Frayme({ apiKey: null, baseURL: '/api/your-proxy' })`.

## Entry points

| Import | What |
|---|---|
| `@frayme/api` | The client, `ComposeStream`, typed errors, wire types |
| `@frayme/api/tools` | `composeToolDefinition`, `actionToolDefinition`, `createComposeTool`, `createActionTool`, `anthropicToolDefinitions` |
| `@frayme/api/ai-sdk` | `fraymeTools()`: the Frayme tools for a Vercel AI SDK 6 agent (needs the optional `ai` peer) |
| `@frayme/api/agent` | The framework-neutral agent core: intents, sources, streaming compose outputs, press helpers |
| `@frayme/api/server` | `createFraymeHandler()`: a compose proxy for your own route, so the browser never holds a key |

## Vercel AI SDK agent

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

What the tools do:

- `frayme_compose` streams the screen to the UI as preliminary tool outputs, and the model sees only `{ generation_id, status, operation_count }`.
- Only one compose runs per turn. A failure hands the turn back only when a retry could succeed.
- With `messages`, `frayme_action` answers the press on the user's last message.
- Pass `intents` and `sources` to add `lookup_intent` and `query_source`.

What your route must do:

- Create the tools per request.
- Pass the UI messages exactly as posted, metadata included.
- Keep `{ tools }` on `convertToModelMessages`. Without it, the full spec reaches the model.

Render the outputs with `<FraymeResult interactive={!busy}/>` from [`@frayme/runtime`](https://www.npmjs.com/package/@frayme/runtime).

## Server proxy

```ts
// app/api/frayme/[...path]/route.ts
import { createFraymeHandler } from '@frayme/api/server';

export const POST = createFraymeHandler({ authorize: getUser });
```

A keyless browser client (`new Frayme({ apiKey: null, baseURL: '/api/frayme' })`) posts to `/api/frayme/v1/compose`, and the handler answers in the API's own formats.

## Agent tool for other frameworks

```ts
import { anthropicToolDefinitions, composeToolDefinition, createComposeTool } from '@frayme/api/tools';

const compose = createComposeTool(frayme);

// Vercel AI SDK 6 (by hand): tool({ ...compose })
// Mastra:                    createTool({ id: compose.name, ...compose })
// LangChain.js:              tool(execute, { schema: composeToolDefinition.inputSchema, ... })
// OpenAI Agents SDK (JS):    tool({ name, description, parameters: input_schema, strict: false, execute })
//                            with the JSON Schema from anthropicToolDefinitions()
```

The schema is Zod v4 (Standard Schema), which the AI SDK, Mastra and LangChain.js accept natively. The OpenAI Agents SDK needs plain JSON Schema, which `anthropicToolDefinitions()` provides. The bound tools also carry `inputExamples`, the AI SDK / Mastra core field that `@ai-sdk/anthropic` sends as Anthropic's `input_examples`. `anthropicToolDefinitions()` returns both tools as `{ name, description, input_schema, input_examples }`, which raw `@anthropic-ai/sdk` users can pass straight through. Recipes: [docs.frayme.ai](https://docs.frayme.ai).

## API

`frayme.compose.stream(req, opts?)` · `frayme.compose.create(req, opts?)` · `frayme.me()` · `frayme.health()`

Full API reference: [docs.frayme.ai](https://docs.frayme.ai).

MIT © Frayme Ltd
