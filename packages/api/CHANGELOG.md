# @frayme/api

## 0.6.0

### A press composes the next screen, it does not edit the last one

`frayme_action` and `createActionTool` no longer attach `mode: 'continue_journey'`, `prior_spec` or `action_context`. A press is sent as a plain create: the prompt names what was pressed, `data` carries the values the next screen must show, and `actions` declares the controls that lead forward.

Why, measured on one filled 16-field form with a 12-value press:

| sent | usable next screen | the user's 12 values |
| --- | --- | --- |
| prior_spec + action_context + continue_journey | 0 of 2 runs | 0 of 2 |
| the same minus prior_spec | 0 of 2 runs | 0 of 2 |
| a create carrying the values | 2 of 2, single pass | 12 of 12 |

`prior_spec` reaches the composer inside an "the user is EDITING an existing UI, REUSE the same element ids" instruction, which answers a press by handing the same screen back. `action_context` reaches no prompt at all, so the params and state posted there told the composer nothing while still crossing the network. On a large table the press body went from over 5 KB to under 200 bytes.

**`prior_spec` is unchanged for `mode: 'edit'`**, which is the one request that legitimately carries a screen: the server has no copy of it, and reusing the same element ids is what keeps a user's half-typed input alive through an edit.

Two rules the tool descriptions and examples now teach, both learned the hard way:

- **Press meta goes in the prompt, never in `data`.** A `data` key the composer does not use is drawn on the screen, so "pressed action: X" arrived as a stray detail card.
- **Declare forward actions only.** Re-declaring the pressed control with required params makes the server add a button plus a blank input per param, putting back the form the next screen was meant to replace. Every request that did so returned a spec the catalog rejects.

**Upgrading:** if you pass `prompt`, `data` and `actions` on a press already, nothing changes for you. If you forwarded only the event and relied on the server continuing from the screen, name the values in `data`, or the next screen will not show them.


## 0.5.0

- New entry point `@frayme/api/ai-sdk`: `fraymeTools({ messages?, intents?, sources?, client?, actionPolicy?, scheme?, snapshotEveryMs? })` returns `frayme_compose` and `frayme_action` as Vercel AI SDK 6 tools, plus `lookup_intent` when you pass intents and `query_source` when you pass sources.
  - Streaming: `frayme_compose` streams the screen as preliminary tool outputs, at most one snapshot per `snapshotEveryMs` (default 250). The model sees only `{ generation_id, status, operation_count }`.
  - One compose per turn. A second call gets `ONE_COMPOSE_PER_TURN`.
  - Releasing the turn: it goes back only after a failure that `composeErrorRetryable` calls retryable, such as a 400 or 422, a server or network failure, or a refusal the model can correct. A bad key, a plan limit, a rate limit, `CLIENT_ERROR` or an abort keep the turn, so the model can't spend its steps retrying them.
  - Continued turns: a turn that continues in a new request (after a tool approval or a client-side tool) has spent its compose once a non-error Frayme output follows the latest user message. Both tools then answer `ONE_COMPOSE_PER_TURN`, and `pendingPress` returns `undefined`.
  - Refusals: a call turned down before composing is an error output with `refused: true`, written for the model. `NO_PRESS`, `PRESS_MISMATCH`, `PRESS_INVALID`, `UNKNOWN_SCREEN` and `SCREEN_TOO_LARGE` are retryable and free the turn. `ONE_COMPOSE_PER_TURN` is also a refusal, but it keeps the turn.
  - `CLIENT_ERROR`: a setup error, such as a missing API key. It isn't retryable.
  - Screens: with `messages`, the model names an earlier screen with `edit_of` instead of passing `prior_spec`. An id with no finished screen in the chat gets `UNKNOWN_SCREEN`. With `mode: 'create'` or no mode, `edit_of` edits; with `mode: 'continue_journey'`, it continues. If the server rejects the screen for an edit, the call ends in an error instead of quietly building a new screen.
  - Screen sources: screens, both for `edit_of` and for the pressed screen, are read only from the finished `complete` outputs of Frayme's own tool calls in assistant messages (`tool-frayme_compose`, `tool-frayme_action`, or a `dynamic-tool` with those names). A spec the model wrote in a tool input or in text, and any other tool's output, are never used.
  - Presses: with `messages`, `frayme_action` answers only an unanswered press on the last user message (otherwise `NO_PRESS`), for that press's action and generation (otherwise `PRESS_MISMATCH`). The page's event wins over the model's copy, and the model adds `prompt`, `data`, `actions` and `signals`. If the server rejects the pressed screen, the call continues once without it, with `prior_spec_dropped: true` on its outputs, and the model is told.
  - Size ceilings: the tools check the press and the earlier screen against the API's size limits before sending.
    - `frayme_action` fits the press and the pressed screen with `fitContinuation`, and every output of that call carries `trimmed`.
    - `frayme_compose` with `edit_of`, when the screen is over 48,000 characters: in `edit` mode the call is refused with `SCREEN_TOO_LARGE`; with `continue_journey`, the screen is left out and the outputs carry `trimmed: ['prior_spec']`.
  - Press validation is lenient, matching how the runtime draws presses. Only the action name must be 1 to 60 characters (otherwise `PRESS_INVALID`). An `event` over 40 characters, or an `element_id` or `generation_id` over 120, is dropped, and `params` and `state` are kept only when they're objects.
  - Without `messages`:
    - The compose schema has no `edit_of`, and its description tells the model to describe each screen in full.
    - `mode: 'edit'` is refused with `UNKNOWN_SCREEN`.
    - `frayme_action` keeps the SDK's own description and examples and forwards the call as written.
  - `custom_components` is never offered to the model. Hosts that need custom components use `createComposeTool` from `@frayme/api/tools`.
  - Trust model: messages, metadata and presses come from the client, so they're the user's own data, and the server validates every spec and action. The tools guarantee that the model can't write a press, a screen or a `prior_spec`.
  - Host requirements:
    - Create the tools per request. A set created once spends its one compose on the first request.
    - Pass the UI messages exactly as posted, metadata included. A strict `messageMetadataSchema` must allow `frayme`, and converted model messages don't work.
    - Always call `convertToModelMessages(messages, { tools })`. Without `{ tools }`, the AI SDK skips `toModelOutput` and the full spec reaches the model.
  - Also exports `fraymeComposeInputSchema`, `pendingPress`, `NO_PRESS`, `PRESS_MISMATCH`, `PRESS_INVALID`, `UNKNOWN_SCREEN`, `SCREEN_TOO_LARGE` and `CLIENT_ERROR`. `ONE_COMPOSE_PER_TURN` is exported from `@frayme/api/agent` only.
- New entry point `@frayme/api/agent`: the framework-neutral core behind those tools, for wiring other frameworks.
  - Tool shape: `FraymeToolSpec`.
  - Intents: `FraymeIntent`, `fraymeIntentSchema`, `intentExample`, `lookupIntentTool`.
  - Sources: `FraymeSources`, `querySource`, `querySourceTool`.
  - Compose as a sequence of outputs: `composeOutputs`, `fraymeModelView`, `composeErrorRetryable`, `createComposeGuard` (returns `{ claim(), release() }`), `ONE_COMPOSE_PER_TURN`, and `oneComposePerTurnOutput`, which returns an output with `refused: true` and `error.retryable: false`.
  - `composeOutputs` details: the snapshot window defaults to 100 ms. If the API rejects `prior_spec` before any op, it retries once as a fresh screen, unless you pass `retryWithoutPriorSpec: false`.
  - `FraymeComposeOutput` gains three fields:
    - `refused`: the call was turned down before composing. The flag is for the model only, and a UI draws nothing.
    - `prior_spec_dropped`: the server rejected the prior screen, so this is a fresh screen. It is set on every output of that attempt.
    - `trimmed`: what the caller left out to fit the size limits (`FraymeTrimmed[]`).
  - `FraymeComposeError` gains `retryable`, which overrides the status-based decision.
  - `composeErrorRetryable(error)` returns:
    - true for a 400, 422 or 5xx, and for an error with no status (a network failure, or a refusal the model can correct);
    - false for any other status, including 401, 402, 403, 404, 409 and 429 (rate limits and quota), and for `ABORTED` and `ONE_COMPOSE_PER_TURN`.
  - `fraymeModelView` error view: `{ status: 'error', message, code?, retryable, retry_after?, next? }`. `next` tells the model that calling again this turn won't help and to tell the user what happened. It is set whenever the error isn't retryable, except for `ONE_COMPOSE_PER_TURN`, whose message already says what to do.
  - `fraymeModelView` complete view: when the prior screen was dropped, it adds `prior_screen_dropped: true` and a `note`.
  - `fraymeModelView` and `trimmed`: when an output carries `trimmed`, both the complete view and the error view add `trimmed` and a plain-English `trimmed_note`.
  - Size fitting: re-exports `fitContinuation` and the `FraymeTrimmed` type.
  - Press helpers: `readPress`, `actionContextOf`, `findPriorSpec`.
- New entry point `@frayme/api/server`: `createFraymeHandler({ authorize, client?, actionPolicy?, maxBodyBytes?, allowCustomComponents? })` returns a `(request: Request) => Promise<Response>` compose proxy for your own route, so the browser client runs keyless.
  - Accepts only a `POST` that `authorize` allows, sent as `application/json`, with known request fields and a body of at most 128 KiB by default.
  - Sets `action_policy` on the server (default `declared_only`) and forwards `Idempotency-Key`.
  - Answers in the API's own SSE or JSON format. If the API rejects the server's key, the browser gets a 500, not a 401 or 403.
- `ai` (`^6.0.0`) is a new optional peer dependency, needed only for `@frayme/api/ai-sdk`. That entry point imports only types from it.
- `actionInputSchema` accepts `data`, `actions` and `signals` for the next screen, with the same schemas as on `frayme_compose`. `createActionTool` sends them as top-level request fields next to `action_context`, never inside it, and the `frayme_action` description now covers them.
- `createActionTool` fits `action_context` to its size limit (dropping `state`, then `params`) before sending, so the API no longer refuses an oversized press. The cut isn't reported, and the result shape is unchanged.
- New root exports for the API's size limits, which count `JSON.stringify(value).length`. The API refuses an oversized request with a 400 before any model call.
  - Constants: `COMPOSE_DATA_MAX_CHARS` (48,000), `PRIOR_SPEC_MAX_CHARS` (48,000), `ACTION_CONTEXT_MAX_CHARS` (16,000).
  - `jsonSize(value)` returns a value's serialized length, or `Infinity` when it can't be serialized.
  - `fitContinuation({ action_context?, prior_spec? })` returns `{ action_context?, prior_spec?, trimmed }`:
    - When `action_context` is over its limit, it drops `state` first, then `params` if it's still over. The action name and ids are never dropped.
    - It leaves out a `prior_spec` over its limit.
    - `trimmed` lists what was left out, in order (`'state'`, `'params'`, `'prior_spec'`).
    - The input is never mutated.
  - Types: `FitContinuationInput`, `FitContinuationResult`, `FraymeTrimmed`.
- The `frayme_compose` `actions` schema accepts `requiredItems`: the names of the mandatory params, at most 20, each at most 60 characters. The schema used to drop this field without an error.
- New `ComposeStream.snapshot()` returns a deep copy of the spec so far, which you can keep or pass to a renderer that compares by reference. `currentSpec()` still returns the live accumulator.
- The accumulator copies each op's value, so an op event a consumer still holds no longer changes when later ops arrive.
- `ERROR_CODE_TO_STATUS` now lists `SERVICE_UNAVAILABLE` (503), `INVALID_MANIFEST` (400), `CUSTOM_SLICE_TOO_LARGE` (400) and `FEATURE_LIMIT` (403). An in-band stream `error` with one of these codes now becomes `ModelUnavailableError`, `BadRequestError` or `AuthorizationError`. Before, it became `InternalServerError`.
- `compose.stream()` reads `prior_spec` before it sends the request.
  - A body that isn't an object now goes to the API and fails as a typed error on the stream, instead of throwing inside `stream()`.
  - If the stream can't be built, for example because `structuredClone` can't copy `prior_spec`, `stream()` aborts the request it already started and throws. The aborted request never surfaces as an unhandled rejection.
- `VERSION` now matches the package (`0.5.0`). Earlier releases exported a stale value (`0.1.3`).

## 0.4.0

- `ComposeRequest` gained `signals`; `ComposeAction` gained `role`, `live`, `confirm` and `requiredItems`.
- Tool definitions: the `actions` contract documents which controls call back and the carrier button; `role` is back on the actions schema; two new worked examples for `frayme_compose` and the first for `frayme_action`; `inputExamples` attached on `createComposeTool`/`createActionTool`; `anthropicToolDefinitions()` for raw Anthropic SDK users; `frayme_action` accepts `element_id`, `label` and `description`.

## 0.3.2

- Republish with corrected internal dependency ranges.

## 0.3.0: Initial public release

- Typed client for the Frayme compose API: `compose.stream()` (handlers + async iteration + snapshot accumulation + `finalSpec()`), `compose.create()`, `me()`, `health()`.
- Automatic retries with per-call idempotency keys (a retried success replays instead of re-billing) and typed `FraymeError` subclasses.
- Framework-agnostic agent tool at `@frayme/api/tools`: one Zod v4 / Standard Schema definition for Vercel AI SDK 6, Mastra, LangChain.js, and OpenAI Agents.
