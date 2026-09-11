# Frayme — UI for Agents

Turn your agent's intent into real, interactive, validated UI — rendered live on the stack you already use.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](packages/api/LICENSE)
[![@frayme/api](https://img.shields.io/npm/v/%40frayme%2Fapi?label=%40frayme%2Fapi)](https://www.npmjs.com/package/@frayme/api)
[![@frayme/catalog](https://img.shields.io/npm/v/%40frayme%2Fcatalog?label=%40frayme%2Fcatalog)](https://www.npmjs.com/package/@frayme/catalog)
[![@frayme/runtime](https://img.shields.io/npm/v/%40frayme%2Fruntime?label=%40frayme%2Fruntime)](https://www.npmjs.com/package/@frayme/runtime)

POST a prompt to `/v1/compose` and get back a validated [json-render](https://json-render.dev) UI spec, streamed as typed SSE events. Render it with `<FraymeRenderer/>`; user interactions flow back to your agent as typed action events. Built on open standards — json-render for the spec, AG-UI for agent transport, MCP for host integration — so nothing here locks you in.

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
| [`@frayme/api`](packages/api) | 0.4.0 | Typed API client + agent tools. Fetch-based, streaming SSE, retries with idempotency. Node ≥ 20.19 / Bun / Deno / Workers / edge. |
| [`@frayme/catalog`](packages/catalog) | 0.4.0 | The 189-component vocabulary a Frayme spec may use — Zod schemas + spec validation via `fraymeCatalog.validate()`. Zero React deps. |
| [`@frayme/runtime`](packages/runtime) | 0.4.0 | React renderer (`<FraymeRenderer/>`) + transport adapters for the Vercel AI SDK (`/ai-sdk`) and AG-UI (`/ag-ui`). Themeable via `--frayme-*` CSS variables. React 19. |

## Agent frameworks

One tool definition serves every major framework — the schema is Zod v4 (Standard Schema):

```ts
import { composeToolDefinition, createComposeTool } from '@frayme/api/tools';
```

| Framework | Wiring |
|-----------|--------|
| Vercel AI SDK 6 | `tool({ ...createComposeTool(frayme) })` |
| Mastra | `createTool({ ...createComposeTool(frayme) })` |
| LangChain.js | `tool(execute, { schema: composeToolDefinition.inputSchema, ... })` |
| OpenAI Agents SDK (JS) | `tool({ name, description, parameters: composeToolDefinition.inputSchema, execute })` |

For AI SDK chat apps, `@frayme/runtime/ai-sdk` bridges the stream into `useChat` data parts (`composeStreamToDataParts()` server-side, `<FraymeMessageRenderer/>` client-side). For AG-UI agents, `@frayme/runtime/ag-ui` delivers specs as `frayme:spec` custom events and registers dynamic actions as the `frayme:action` frontend tool.

## Streaming contract

```
compose.started → op×N (live, provisional) → [compose.restarted ⇒ discard rendered state] → compose.completed | error
```

Every generation is validated against the catalog before `compose.completed` — ops are provisional until then. In-band errors surface as typed `FraymeError` subclasses; retries reuse one idempotency key per logical call, so a retried success replays instead of re-billing.

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
- License: MIT — see per-package `LICENSE` files

Get an API key at [frayme.ai](https://frayme.ai).
