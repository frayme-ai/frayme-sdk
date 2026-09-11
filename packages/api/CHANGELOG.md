# @frayme/api

## 0.4.0

- `ComposeRequest` gained `signals`; `ComposeAction` gained `role`, `live`, `confirm` and `requiredItems`.
- Tool definitions: the `actions` contract documents which controls call back and the carrier button; `role` is back on the actions schema; two new worked examples for `frayme_compose` and the first for `frayme_action`; `inputExamples` attached on `createComposeTool`/`createActionTool`; `anthropicToolDefinitions()` for raw Anthropic SDK users; `frayme_action` accepts `element_id`, `label` and `description`.

## 0.3.2

- Republish with corrected internal dependency ranges.

## 0.3.0 — Initial public release

- Typed client for the Frayme compose API: `compose.stream()` (handlers + async iteration + snapshot accumulation + `finalSpec()`), `compose.create()`, `me()`, `health()`.
- Automatic retries with per-call idempotency keys (a retried success replays instead of re-billing) and typed `FraymeError` subclasses.
- Framework-agnostic agent tool at `@frayme/api/tools` — one Zod v4 / Standard Schema definition for Vercel AI SDK 6, Mastra, LangChain.js, and OpenAI Agents.
