# Use these docs from your agent

These docs are built to be read by AI coding assistants — plain-text indexes, per-page markdown, and an MCP endpoint.

## llms.txt

A machine-readable index of every page, following the [llms.txt convention](https://llmstxt.org):

```
https://docs.frayme.ai/llms.txt        # index — titles + URLs + one-line summaries
https://docs.frayme.ai/llms-full.txt   # every docs page concatenated into one file
```

Point a coding assistant at `llms.txt` when it should discover pages itself; paste `llms-full.txt` into context when you want everything at once.

## Every page as markdown

Append `.md` to any docs URL to get the raw markdown — no HTML, no chrome:

```
https://docs.frayme.ai/api/compose.md
https://docs.frayme.ai/api/errors.md
```

This is the cheapest way to give an agent exactly the pages a task needs.

## The docs MCP server

An MCP endpoint serves searchable docs directly to MCP-capable coding agents:

```
https://docs.frayme.ai/~gitbook/mcp
```

Add it as an HTTP MCP server in your agent's config — most coding assistants take a name (say `frayme-docs`) plus that URL — and it can search and read these docs as a tool, no copy-pasting.

## A rules file for your assistant

Drop a snippet like this in your project's rules file — `AGENTS.md` or your tool's equivalent — so the assistant reaches for the docs instead of guessing:

```markdown
# Frayme

When working with Frayme (@frayme/api, @frayme/runtime, @frayme/catalog, or
the api.frayme.ai REST API):

- Docs index: https://docs.frayme.ai/llms.txt — fetch the relevant page as
  markdown by appending .md to its URL.
- The compose request body is snake_case and STRICT — unknown fields are
  rejected with 400. /v1/me responds in camelCase.
- Ops streamed over SSE are provisional until compose.completed; on
  compose.restarted, discard all rendered state.
- Branch errors on error.code, not HTTP status — two different conditions
  share status 429 (RATE_LIMITED is retryable, QUOTA_EXCEEDED is not).
- Never put an API key in browser code — use keyless proxy mode:
  new Frayme({ apiKey: null, baseURL: '/api/your-proxy' }).
```

## Giving your agent the compose tool itself

Reading the docs is half the story — your agent can also *call* Frayme as a tool. `@frayme/api/tools` exports one tool definition that plugs into Vercel AI SDK, Mastra, LangChain.js, and OpenAI Agents unchanged:

```ts
import { createComposeTool } from '@frayme/api/tools';

const tools = { compose_ui: createComposeTool(frayme) };
```

See the [framework guides](../frameworks/ai-sdk.md) for wiring per framework.

## Related

- [API reference](../api/README.md) — the contract your agent will be coding against
- [OpenAPI spec](https://api.frayme.ai/v1/openapi.json) — machine-readable, for codegen
- [Troubleshooting](troubleshooting.md) — the failures assistants most often introduce
