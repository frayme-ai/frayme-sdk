# @frayme/api

The official TypeScript client for the [Frayme](https://frayme.ai) generative-UI API. Zero dependencies, fetch-based — runs on Node ≥ 20.19, Bun, Deno, Cloudflare Workers, and Vercel Edge.

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

- **Two streaming layers** — `compose.stream()` (handlers + async iteration + snapshot accumulation + `finalSpec()` + `.abort()`) or `compose.create({ stream: true })` for a raw typed-event iterable. Non-streaming: `compose.create({ stream: false })`.
- **`compose.restarted` handled for you** — Frayme validates every generation; when an attempt fails, the stream restarts with a stronger model in the same response. The SDK resets its snapshot and tells you to discard.
- **Retries that can't double-bill** — 2 automatic retries (connection errors, 408/409/429/5xx) with jittered backoff and `Retry-After` support; one auto-generated `Idempotency-Key` per logical call is reused across attempts, so a retried success replays instead of re-billing.
- **Typed errors** — `RateLimitError` (with `.retryAfter`), `QuotaExceededError`, `PaymentRequiredError`, `CompositionFailedError`, … all extending `FraymeError` with `.status`/`.code`/`.requestId`.
- **Browser-safe by design** — constructing with a key in a browser throws. Use keyless proxy mode instead: `new Frayme({ apiKey: null, baseURL: '/api/your-proxy' })`.

## Agent tool (all frameworks, one definition)

```ts
import { composeToolDefinition, createComposeTool } from '@frayme/api/tools';

// Vercel AI SDK 6:        tool({ ...createComposeTool(frayme) })
// Mastra:                 createTool({ ...createComposeTool(frayme) })
// OpenAI Agents SDK (JS): tool({ name, description, parameters: composeToolDefinition.inputSchema, execute })
// LangChain.js:           tool(execute, { schema: composeToolDefinition.inputSchema, ... })
```

The schema is Zod v4 (Standard Schema), so every major framework accepts it natively. The bound tools also carry `inputExamples` (the AI SDK / Mastra core field — `@ai-sdk/anthropic` sends it as Anthropic's `input_examples`), and `anthropicToolDefinitions()` returns both tools as `{ name, description, input_schema, input_examples }` for raw `@anthropic-ai/sdk` users. Recipes: [docs.frayme.ai](https://docs.frayme.ai).

## API

`frayme.compose.stream(req, opts?)` · `frayme.compose.create(req, opts?)` · `frayme.me()` · `frayme.health()`

Full API reference: [docs.frayme.ai](https://docs.frayme.ai).

MIT © Frayme Ltd
