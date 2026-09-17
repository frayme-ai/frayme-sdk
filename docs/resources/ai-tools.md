# Use these docs from your agent

These docs are built to be read by AI coding assistants, with plain-text indexes, per-page markdown, and an MCP endpoint.

## llms.txt

A machine-readable index of every page, following the [llms.txt convention](https://llmstxt.org):

```text
https://docs.frayme.ai/llms.txt        # index: titles, URLs and one-line summaries
https://docs.frayme.ai/llms-full.txt   # every docs page concatenated into one file
```

Point a coding assistant at `llms.txt` when it should discover pages itself; paste `llms-full.txt` into context when you want everything at once.

## Every page as markdown

Append `.md` to any docs URL to get the raw markdown (no HTML, no chrome):

```text
https://docs.frayme.ai/api/compose.md
https://docs.frayme.ai/api/errors.md
```

This is the cheapest way to give an agent exactly the pages a task needs.

## The docs MCP server

An MCP endpoint serves searchable docs directly to MCP-capable coding agents:

```text
https://docs.frayme.ai/~gitbook/mcp
```

Add it as an HTTP MCP server in your agent's config (most coding assistants take a name, say `frayme-docs`, plus that URL) and it can search and read these docs as a tool, no copy-pasting.

## A rules file for your assistant

Drop a snippet like this in your project's rules file (`AGENTS.md` or your tool's equivalent) so the assistant reaches for the docs instead of guessing:

```markdown
# Frayme

When working with Frayme (@frayme/api and its /tools, /ai-sdk, /agent and
/server entry points, @frayme/runtime, @frayme/catalog, or the api.frayme.ai
REST API):

- Docs index: https://docs.frayme.ai/llms.txt
  Fetch the relevant page as markdown by appending .md to its URL.
- The compose request body is snake_case and STRICT: unknown fields are
  rejected with 400. /v1/me responds in camelCase.
- Ops streamed over SSE are provisional until compose.completed; on
  compose.restarted, discard all rendered state.
- Branch errors on error.code, not HTTP status: two different conditions
  share status 429 (RATE_LIMITED is retryable, QUOTA_EXCEEDED is not).
- Never put an API key in browser code. Use keyless proxy mode:
  new Frayme({ apiKey: null, baseURL: '/api/your-proxy' }), served by
  createFraymeHandler({ authorize }) from @frayme/api/server.
```

## Giving your agent the compose tool itself

Reading the docs is half the story: your agent can also *call* Frayme as a tool. `@frayme/api` ships these entry points for it:

| Entry point | What it gives you |
| --- | --- |
| `@frayme/api/ai-sdk` | `fraymeTools()`: `frayme_compose` and `frayme_action` as ready-made Vercel AI SDK tools, plus `lookup_intent` and `query_source` when you pass intents or sources. See [`@frayme/api/ai-sdk`](../sdk/api-ai-sdk.md). |
| `@frayme/api/tools` | The framework-neutral tool definitions: Zod v4 schemas (`composeInputSchema`, `actionInputSchema`), `createComposeTool` / `createActionTool`, and `anthropicToolDefinitions()` in plain JSON Schema. |
| `@frayme/api/agent` | The pieces other frameworks build on: intent lookup, source queries, compose as a series of outputs, and press helpers. See [`@frayme/api/agent`](../sdk/api-agent.md). |
| `@frayme/api/server` | `createFraymeHandler()`: a server route that proxies browser compose requests with your key. See [`@frayme/api/server`](../sdk/api-server.md). |

On the Vercel AI SDK, spread the tools into your own:

```ts
// app/api/chat/route.ts
import { fraymeTools } from '@frayme/api/ai-sdk';

const tools = { ...yourTools, ...fraymeTools({ messages }) };
```

Mastra and LangChain.js take the Zod v4 schemas from `@frayme/api/tools` as they are. The OpenAI Agents SDK needs a non-strict tool, which it only allows with JSON Schema, so register the `anthropicToolDefinitions()` schemas with `strict: false` and parse the input with `composeInputSchema` / `actionInputSchema` inside `execute`. See the framework guides for [Vercel AI SDK](../frameworks/ai-sdk.md), [Mastra](../frameworks/mastra.md), [LangChain.js](../frameworks/langchain.md) and [OpenAI Agents](../frameworks/openai-agents.md).

## Related

- [API reference](../api/README.md): the contract your agent will be coding against
- [OpenAPI spec](https://api.frayme.ai/v1/openapi.json): machine-readable, for codegen
- [Troubleshooting](troubleshooting.md): the failures assistants most often introduce
