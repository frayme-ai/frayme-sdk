# @frayme/api

The official TypeScript client for the Frayme API: streaming and non-streaming compose, typed errors, automatic retries with idempotency, and the framework-neutral tool definitions.

```bash
npm i @frayme/api
```

ESM, MIT, Node ≥ 20.19. Version 0.6.0. Runs in Node, edge runtimes, and (in keyless proxy mode) the browser. Peers: `zod` and `@json-render/core`. `ai` is also a peer, but it's optional: only `@frayme/api/ai-sdk` needs it.

## Entry points

| Entry point | What it holds | Reference |
| --- | --- | --- |
| `@frayme/api` | The `Frayme` client, `ComposeStream`, the error classes, the wire types, the request limits, `fitContinuation`, `jsonSize` and `VERSION` | This page |
| `@frayme/api/tools` | `composeToolDefinition`, `actionToolDefinition`, `createComposeTool`, `createActionTool`, `anthropicToolDefinitions`, the input schemas and worked examples | The tools section below |
| `@frayme/api/agent` | The framework-neutral agent core: intents, sources, compose as a sequence of outputs, press helpers | [@frayme/api/agent](api-agent.md) |
| `@frayme/api/ai-sdk` | `fraymeTools()`: the Frayme tools for a Vercel AI SDK 6 agent | [@frayme/api/ai-sdk](api-ai-sdk.md) |
| `@frayme/api/server` | `createFraymeHandler()`: a compose proxy for your own server route | [@frayme/api/server](api-server.md) |

## Client

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | `FRAYME_API_KEY` env var | Your `fr_live_…` key. Pass `null` explicitly for keyless proxy mode. |
| `baseURL` | `FRAYME_BASE_URL` env var, then `https://api.frayme.ai` | API origin. Point it at your own proxy route in keyless mode. |
| `maxRetries` | `2` | Automatic retries for retryable failures. Retried requests carry an auto-generated `Idempotency-Key`, so a retry can never double-bill. |
| `timeout` | `600000` (10 min) | Whole-request timeout in ms. It covers streaming reads too. |
| `firstEventTimeout` | `90000` | Max ms to wait for the first stream event before failing. |
| `dangerouslyAllowBrowser` | `false` | Allow a real key in a browser: for local experiments only, never in anything you ship. |
| `fetch` | global `fetch` | Override for testing or exotic runtimes. |
| `defaultHeaders` | `{}` | Extra headers sent with every request. |

### Keyless proxy mode

The client refuses to run with an API key in a browser-like environment (it would expose the key to every visitor). Instead, keep the key on your server and point the browser client at your own route:

```ts
// browser: no key ever ships to the client
const frayme = new Frayme({ apiKey: null, baseURL: '/api/frayme-proxy' });
```

Your proxy route forwards the request to `https://api.frayme.ai` with the real key attached. This is the client `useFraymeCompose` expects in [`@frayme/runtime`](runtime.md).

`createFraymeHandler` from `@frayme/api/server` is a ready-made version of that route:

```ts
// app/api/frayme/[...path]/route.ts
import { createFraymeHandler } from '@frayme/api/server';

export const POST = createFraymeHandler({ authorize: getUser });
```

The keyless client posts to `<baseURL>/v1/compose`, so in Next.js the handler goes in a catch-all route under the base URL, and the handler ignores the path. The route above serves `baseURL: '/api/frayme'`. For the `/api/frayme-proxy` client above, the route would be `app/api/frayme-proxy/[...path]/route.ts`. For its checks and options, see [@frayme/api/server](api-server.md).

## compose.stream() vs compose.create()

| Method | Returns | Use when |
| --- | --- | --- |
| `compose.stream(body, options?)` | `ComposeStream`: events + accumulated spec snapshots | You want progressive rendering. The high-level surface; handles restarts for you. |
| `compose.create(body, options?)` | `ComposeResult` (with `stream: false`) or a plain `AsyncIterable` of raw events (with `stream: true`) | You only need the final validated spec (`stream: false` is what the tool definitions use), or you want the raw event stream with no accumulation. |

```ts
// Non-streaming: one awaited result
const result = await frayme.compose.create({
  prompt: 'A pricing page with three tiers',
  stream: false,
});
// result: { generation_id, spec, model, operation_count, validated: true,
//           usage, interactions, components_used, replayed? }
```

The request body is the wire shape of [`POST /v1/compose`](../api/compose.md): snake_case fields (`signals`, `prior_spec`, `max_operations`, …), typed as `ComposeRequest`.

## Steering with signals

`signals` is the primary steering dial on a compose request. The vocabulary is closed and every value genuinely moves the output. Send the ones you are confident about and omit the rest; a partial object, or none at all, is a first-class call, and a wrong signal steers worse than a missing one.

```ts
const stream = frayme.compose.stream({
  prompt: 'The open support tickets, sortable, with an escalate action per row',
  signals: {
    data_shape: ['table', 'filters'], // what the content IS
    density: 'compact',               // compact · standard · rich
    patterns: ['row-actions'],        // interaction furniture to make available
    tone: 'neutral',                  // neutral · branded
  },
  context: { theme: 'dark' },         // THE theme dial: light or dark; omit to let the host decide
  data: { rows: tickets },
  actions: [
    {
      name: 'escalateTicket',
      role: 'Escalate',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  ],
});
```

- `data_shape`: one or more of `avatar`, `board`, `bracket`, `calendar`, `cards`, `chart`, `citations`, `code`, `diff`, `document`, `feed`, `filters`, `form`, `image`, `link-preview`, `list`, `map`, `plans`, `reasoning`, `table`, `thread`, `timeline`, `tree`, `video`. The shape of `data` follows it: table/list → `rows`, chart → `series`/`points`, plans → `plans`, form → field seed values.
- `density`: `compact` (terse scanning) · `standard` · `rich` (generous detail and supporting copy). Often the one signal that matters: it is what separates a scanning grid from a card list.
- `patterns`: any of `accordion`, `bulk-actions`, `collapsible`, `confirm-dialog`, `dialog`, `drawer`, `dropdown-menu`, `hover-card`, `multi-step`, `popover`, `row-actions`, `segmented-control`, `tabs`, `tooltip`.
- `tone`: `neutral` (product-default styling) · `branded` (lean into the colour and voice the prompt describes).

There is no `signals.theme`: `context.theme` is the only theme dial, and it reaches the model on the same line as the signals. The full table, with an example, is on the [compose page](../api/compose.md#steering-with-signals).

## ComposeStream

`compose.stream()` returns one object that is an event emitter, an async iterable, and a spec accumulator:

```ts
const stream = frayme.compose.stream({ prompt: 'A pricing page with three tiers' });

stream.on('op', (op, snapshot) => render(snapshot)); // live spec snapshots
stream.on('restarted', () => clearRendered());       // attempt failed → discard
const { spec, generationId, usage } = await stream.finalSpec();
```

### Handlers (`.on(event, handler)`)

| Event | Handler receives | Meaning |
| --- | --- | --- |
| `started` | `ComposeStartedEvent` | The stream opened; carries `generation_id` and `model`. |
| `op` | `(op, snapshot)`: the raw operation plus the progressively accumulated `Spec` | A provisional json-render operation arrived. Render the snapshot. |
| `restarted` | `ComposeRestartedEvent` | The previous attempt failed validation. The internal snapshot has been reset. Discard everything rendered so far. |
| `completed` | `ComposeCompletedEvent` | The validated final commit; carries `generation_id`, `model`, `operation_count`, `usage`, and `replayed`. |
| `error` | `FraymeError` | The stream failed with a typed error. Never fired for consumer aborts. In-band `error` events are unbilled. |
| `abort` | `APIUserAbortError` | You aborted via `.abort()`, `.controller`, or a passed signal. |
| `end` | (none) | Always fired exactly once, after success, error, or abort. |

### Surface

| Member | Description |
| --- | --- |
| `finalSpec()` | Resolves on `compose.completed` with `{ spec, generationId, model, operationCount, usage, replayed }`; rejects on error or abort. |
| `currentSpec()` | The spec accumulated so far: provisional until `compose.completed`. |
| `snapshot()` | A deep copy of the spec accumulated so far. `currentSpec()` returns the live accumulator, which the next op patches in place. A snapshot is yours to keep, to hold across an `await`, or to pass to a renderer that compares by reference. |
| `abort()` | Abort the stream and the underlying network request. |
| `controller` | The `AbortController` behind `.abort()`, for composing with your own signals. |
| `for await (const event of stream)` | Iterate the typed events directly. Breaking out of the loop aborts the stream. |

In `edit` and `continue_journey` modes the accumulator is seeded with your `prior_spec`, so the server's minimal patch applies in place. Snapshots are always complete specs.

```ts
import Frayme, { type Spec } from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({ prompt: 'A pricing page with three tiers' });
const frames: Spec[] = [];
stream.on('op', () => frames.push(stream.snapshot())); // each entry is its own copy
const { spec } = await stream.finalSpec();
```

The accumulator also stores its own copy of each op's value, so an `op` event you hold on to doesn't change when later ops arrive. `compose.stream()` copies `prior_spec` with `structuredClone`. If the copy fails, `stream()` aborts the request it already started and throws the error.

## Per-request options

Every method accepts a second `options` argument:

| Option | Description |
| --- | --- |
| `signal` | An `AbortSignal` to cancel the request. |
| `idempotencyKey` | Supply your own `Idempotency-Key` (≤255 chars). Otherwise one is auto-generated whenever retries are enabled. |
| `maxRetries` | Override the client-level retry count for this call. |

Replaying a key within 24 hours returns the original result (same `generation_id`, `replayed: true`) and is free. See [idempotency on the compose page](../api/compose.md).

## Request size limits

The request limits are exported from the root, so your code can check the same numbers the API enforces. Three of them cap the serialized size of the free-form JSON fields, measured as `JSON.stringify(value).length`. A request over any of these gets a 400 before any model call:

| Constant | Field | Limit |
| --- | --- | --- |
| `COMPOSE_DATA_MAX_CHARS` | `data` | 48,000 |
| `PRIOR_SPEC_MAX_CHARS` | `prior_spec` | 48,000 |
| `ACTION_CONTEXT_MAX_CHARS` | `action_context` | 16,000 |

A press can go over its limit even when its screen is small: a table's row action carries every row. Sending the press again fails the same way, so `fitContinuation` cuts a follow-up to fit instead:

```ts
import Frayme, { fitContinuation, type ComposeActionContext, type Spec } from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

export function continueFrom(context: ComposeActionContext, screen: Spec) {
  const fit = fitContinuation({ action_context: context, prior_spec: screen });
  // fit.trimmed lists what was left out: 'state', 'params', 'prior_spec'
  return frayme.compose.create({
    prompt: 'Continue the journey from the pressed row',
    mode: 'continue_journey',
    action_context: fit.action_context,
    prior_spec: fit.prior_spec,
    stream: false,
  });
}
```

`fitContinuation({ action_context?, prior_spec? })` returns `{ action_context?, prior_spec?, trimmed }`. It never mutates its input.

- **`action_context` over its limit:** it drops `state` first, then `params` if the context is still too large. The action name and the ids are always kept.
- **`prior_spec` over its limit:** it leaves the screen out, and the next screen is built from the press alone.
- **`trimmed`:** what was left out, in order. The types are `FitContinuationInput`, `FitContinuationResult` and `FraymeTrimmed`.

`jsonSize(value)` returns the serialized length the limits count, or `Infinity` for a value that can't be serialized. `data` has no fitting helper: facts can't be cut without changing the screen, so keep `data` under its limit yourself.

Since 0.6.0 the SDK's own press helpers send neither `action_context` nor `prior_spec`: `createActionTool`, `frayme_action` from `fraymeTools` and `FraymeScreen.continue` in `@frayme/runtime` compose the next screen as a fresh create (see [The round trip](#the-round-trip)), so they have nothing to fit. `fitContinuation` is for a request you build yourself. One part of the SDK still cuts to fit: `frayme_compose` refuses an `edit_of` edit of a screen over the limit with `SCREEN_TOO_LARGE`, and leaves the screen out of a `continue_journey`, reporting the cut in `trimmed` on its outputs.

## me() and health()

```ts
const me = await frayme.me();
// { workspace: { id, name, slug },
//   plan: { tierKey, monthlyGenerations, rateLimitPerMin, generationsRemaining,
//           inlineComponentsLimit } }
//   ← camelCase, unlike compose

const health = await frayme.health(); // no auth: { status: 'ok', service, catalog_version }
```

## Error classes

Every failure is a subclass of `FraymeError`, carrying `message`, `status`, `code`, and `requestId` (from the `x-request-id` header). Branch with `instanceof`:

| Class | Status | Wire code(s) |
| --- | --- | --- |
| `BadRequestError` | 400 | `BAD_REQUEST`, `INVALID_MANIFEST`, `CUSTOM_SLICE_TOO_LARGE` |
| `AuthenticationError` | 401 | `AUTHENTICATION_REQUIRED` |
| `PaymentRequiredError` | 402 | `PAYMENT_REQUIRED` |
| `AuthorizationError` | 403 | `FORBIDDEN`, `FEATURE_LIMIT` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `IdempotencyKeyInUseError` | 409 | `IDEMPOTENCY_KEY_IN_USE` |
| `ValidationError` | 422 | `VALIDATION_ERROR` (idempotency body mismatch) |
| `RateLimitError` | 429 | `RATE_LIMITED`, which has `.retryAfter` (seconds, from the `Retry-After` header) |
| `QuotaExceededError` | 429 | `QUOTA_EXCEEDED`: the monthly cap; waiting won't help, upgrading will |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` |
| `CompositionFailedError` | 502 | `COMPOSITION_FAILED` |
| `ModelUnavailableError` | 503 | `MODEL_UNAVAILABLE`, `SERVICE_UNAVAILABLE`: check `.code` |
| `APIConnectionError` | (none) | Network failure: could not reach the API, or the connection died mid-stream. |
| `APIUserAbortError` | (none) | You aborted the request. |

```ts
import { RateLimitError, QuotaExceededError } from '@frayme/api';

try {
  await frayme.compose.create({ prompt, stream: false });
} catch (err) {
  if (err instanceof RateLimitError) await sleep((err.retryAfter ?? 1) * 1000);
  else if (err instanceof QuotaExceededError) notifyPlanCap();
  else throw err;
}
```

In-band stream `error` events map to the same classes via their `code`. The full code-to-status map is exported as `ERROR_CODE_TO_STATUS`; the wire taxonomy is documented on the [errors page](../api/errors.md).

Since 0.5.0, `ERROR_CODE_TO_STATUS` also lists `SERVICE_UNAVAILABLE`, `INVALID_MANIFEST`, `CUSTOM_SLICE_TOO_LARGE` and `FEATURE_LIMIT`. An in-band event with one of these codes now raises the class in the table above. Earlier versions raised `InternalServerError` for them.

### Tool output codes

The agent tools in `@frayme/api/ai-sdk` and `@frayme/api/agent` never throw inside a model turn. A failure comes back as an output with `status: 'error'` and an `error: { message, code, retryable? }` for the model to read. A call the tools turned down before composing also carries `refused: true`, and a UI draws nothing for it. These codes come from the tools themselves, not from the API:

| Code | Returned when | Refusal | Frees the turn |
| --- | --- | --- | --- |
| `ONE_COMPOSE_PER_TURN` | A second compose was attempted in the same turn, or a turn that continues in a new request already put a screen up. | Yes | No |
| `UNKNOWN_SCREEN` | `edit_of` names a generation that isn't a finished screen in this chat, or `mode: 'edit'` came without `edit_of` (or without `messages`). | Yes | Yes |
| `NO_PRESS` | `frayme_action` was called, but the last user message isn't an unanswered press. | Yes | Yes |
| `PRESS_MISMATCH` | `frayme_action` named a different action or generation from the press the user made. | Yes | Yes |
| `PRESS_INVALID` | The pressed control's action name isn't 1 to 60 characters, so the press can't be sent. | Yes | Yes |
| `SCREEN_TOO_LARGE` | `edit_of` with `mode: 'edit'` names a screen over the `prior_spec` size limit, so it can't be edited. The model is told to describe the whole new screen instead. | Yes | Yes |
| `CLIENT_ERROR` | `fraymeTools` couldn't start the compose, for example because `FRAYME_API_KEY` is missing and no `client` was passed. | No | No |
| `ABORTED` | The compose was aborted. | No | No |

An API error keeps its wire `code`, `status` and `retry_after` on the output. `composeErrorRetryable(error)` from `@frayme/api/agent` decides whether a failure frees the turn, and `fraymeTools` hands the turn back only when it returns true:

- **Frees the turn:** a 400 or 422, a 5xx, or an error with no status (a network failure, or a refusal the model can correct).
- **Keeps the turn:** any other status, including 401, 402, 403, 404, 409 and 429 (a bad key, a plan limit, a rate limit), plus `ABORTED` and `ONE_COMPOSE_PER_TURN`.
- **Override:** an `error.retryable` set on the output wins over both rules.

The model reads the same decision as `retryable` in its view of the error. When it's false, a `next` line tells the model to stop and explain what happened to the user. `ONE_COMPOSE_PER_TURN` is the exception: its message already says what to do, so it gets no `next` line.

When the tools cut a request to fit the [size limits](#request-size-limits), the output also carries `trimmed`, and the model's view adds `trimmed` and a plain-English `trimmed_note`, whether the compose completed or failed.

`ONE_COMPOSE_PER_TURN` is exported from `@frayme/api/agent`. `NO_PRESS`, `PRESS_MISMATCH`, `PRESS_INVALID`, `UNKNOWN_SCREEN`, `SCREEN_TOO_LARGE` and `CLIENT_ERROR` are exported from `@frayme/api/ai-sdk`. See [@frayme/api/ai-sdk](api-ai-sdk.md).

## @frayme/api/tools

The `@frayme/api/tools` entry point exports `composeToolDefinition`, `actionToolDefinition`, and the client-bound `createComposeTool(frayme)` / `createActionTool(frayme)`.

- **Vercel AI SDK 6, Mastra, LangChain.js:** register the Zod v4 input schemas directly. On the Vercel AI SDK, `fraymeTools()` from [`@frayme/api/ai-sdk`](api-ai-sdk.md) builds the tools for you, with streaming outputs, one compose per turn, and press handling.
- **OpenAI Agents SDK:** it needs plain JSON Schema, so register the `input_schema` from `anthropicToolDefinitions()` with `strict: false`.

See the [framework guides](../frameworks/ai-sdk.md).

### Worked examples, on two channels

Each tool's `description` carries the full contract plus worked calls: five for `frayme_compose` (a working queue, an analytics page with no actions, a composite page, the carrier pattern with its `live: true` contrast, and an edit with `prior_spec`) and two round-trip events for `frayme_action`. The description is the universal carrier: it is the one field every framework forwards.

The same examples are also exported structured (`composeInputExamples` / `actionInputExamples`), and `createComposeTool` / `createActionTool` attach them as `inputExamples: [{ input }]`, the Vercel AI SDK / Mastra core tool field. `@ai-sdk/anthropic` sends it as the Anthropic Messages API's `input_examples` (GA, no beta header required; the SDK still tags the request with a legacy `advanced-tool-use` beta header, which is harmless); Mastra's `createTool` carries it through; other providers ignore it, or fold it into the description with the AI SDK's `addToolInputExamplesMiddleware`. LangChain.js, the OpenAI Agents SDK and MCP have no equivalent field, so for them the description is what the model sees.

Raw `@anthropic-ai/sdk` users get the wire shape directly:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { anthropicToolDefinitions } from '@frayme/api/tools';

const client = new Anthropic();
const response = await client.messages.create({
  model: 'claude-opus-5',
  max_tokens: 16000,
  // [{ name, description, input_schema, input_examples }] for both tools
  tools: anthropicToolDefinitions(),
  messages: [{ role: 'user', content: 'Show me the open tickets as a table.' }],
});
```

Every example is asserted schema-valid in the package's own tests: the Anthropic API returns 400 on an `input_examples` entry that fails `input_schema`.

### Declaring actions

Each entry in `actions` is one callback your agent will handle. `name` is what comes back when the control fires. `params` is a JSON Schema object whose top-level `required` array is what genuinely blocks the submit until those fields are filled. List mandatory keys there, not only in prose. `required: true` guarantees a control bound to the action is present even when the generation omits it. `confirm` gates the control behind a dialog: `true` for a plain confirm, or `{ tone, body, confirmLabel, denyLabel }` for a scenario-true one. `role` is the short human label of the control (`"approve"`, `"Save board"`), used wherever Frayme places or injects it. `live: true` fires the action on every gesture with no press. `description` is your own words for what the action means; it rides back to you on the event.

`requiredItems` names the mandatory params at action level: at most 20 names, each at most 60 characters. It makes the same claim as a `required` array inside `params`, for when `params` is a flat map rather than a JSON Schema object. Listed params are marked on the form and block the submit until they're filled.

```ts
const result = await frayme.compose.create({
  prompt: 'A refund form for order A-1042',
  actions: [
    {
      name: 'issueRefund',
      role: 'Refund',
      params: { amount: { description: 'Amount to refund' }, note: { description: 'Reason for the customer' } },
      requiredItems: ['amount'],
    },
  ],
  stream: false,
});
```

### The round trip

Only a press round-trips: a Button, a Confirmation verdict, a Form submit, a DataTable, or a row/bulk action on a table or board. Every other gesture stays local under `state._ui.<elementId>.<verb>` (latest per verb, never cleared by a press) and rides in the next press's `state`; `live: true` on the declared action is the opt-out, and Frayme injects a carrier button (labelled from `role`, else "Done") when an action is wired only to a non-press component. The event your host receives (`{ action, event, params, state, element_id, label, description, generation_id }`) goes to `frayme_action` verbatim. Since 0.6.0 a press composes a fresh screen: the bound tool reads the event but sends none of it, so the request it makes is a plain create built from `prompt`, `data`, `actions` and `signals` (no `mode`, `action_context` or `prior_spec`). The `prompt` is the only place the press is described to the composer; without one the tool sends `The user pressed the "<action>" control. Show the next step.`

### The next screen's inputs

The next screen is composed fresh, so `actionInputSchema` also takes the three fields `frayme_compose` uses to build one:

- `data`: the facts the next screen shows, such as the values the user just entered, the saved record, the new total or the confirmation number. A value the user typed that is not named here does not appear on the next screen. What was pressed belongs in `prompt`, never here: a `data` key the composer does not use is drawn on the screen as a stray detail.
- `actions`: the controls that lead forward from here. An action you leave out comes back unwired. Do not re-declare the control just pressed with required params: a declared action that nothing binds makes the server add a button plus a blank input per param, putting back the form the next screen was meant to replace.
- `signals`: steering for the next screen.

They use the same schemas and limits as on `frayme_compose`. `createActionTool` sends them as top-level request fields, and nothing else:

```ts
import Frayme from '@frayme/api';
import { createActionTool } from '@frayme/api/tools';
import type { DynamicActionEvent } from '@frayme/runtime';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });
const action = createActionTool(frayme);

export async function onPress(event: DynamicActionEvent) {
  return action.execute({
    ...event,
    prompt: 'Confirm the refund and offer to email a receipt',
    data: { orderId: 'A-1042', refunded: '$120.00' },
    actions: [{ name: 'emailReceipt', role: 'Email receipt' }],
    signals: { density: 'compact' },
  });
}
```
