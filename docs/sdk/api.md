# @frayme/api

The official TypeScript client for the Frayme API: streaming and non-streaming compose, typed errors, automatic retries with idempotency, and the framework-neutral tool definitions.

```bash
npm i @frayme/api
```

ESM, MIT, Node ≥ 20.19. Version 0.4.0. Runs in Node, edge runtimes, and (in keyless proxy mode) the browser.

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
| `timeout` | `600000` (10 min) | Whole-request timeout in ms — covers streaming reads too. |
| `firstEventTimeout` | `90000` | Max ms to wait for the first stream event before failing. |
| `dangerouslyAllowBrowser` | `false` | Allow a real key in a browser — for local experiments only, never in anything you ship. |
| `fetch` | global `fetch` | Override for testing or exotic runtimes. |
| `defaultHeaders` | `{}` | Extra headers sent with every request. |

### Keyless proxy mode

The client refuses to run with an API key in a browser-like environment (it would expose the key to every visitor). Instead, keep the key on your server and point the browser client at your own route:

```ts
// browser — no key ever ships to the client
const frayme = new Frayme({ apiKey: null, baseURL: '/api/frayme-proxy' });
```

Your proxy route forwards the request to `https://api.frayme.ai` with the real key attached. This is the client `useFraymeCompose` expects in [`@frayme/runtime`](runtime.md).

## compose.stream() vs compose.create()

| Method | Returns | Use when |
| --- | --- | --- |
| `compose.stream(body, options?)` | `ComposeStream` — events + accumulated spec snapshots | You want progressive rendering. The high-level surface; handles restarts for you. |
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

The request body is the wire shape of [`POST /v1/compose`](../api/compose.md) — snake_case fields (`signals`, `prior_spec`, `max_operations`, …), typed as `ComposeRequest`.

## Steering with signals

`signals` is the primary steering dial on a compose request. The vocabulary is closed and every value genuinely moves the output — send the ones you are confident about and omit the rest; a partial object, or none at all, is a first-class call, and a wrong signal steers worse than a missing one.

```ts
const stream = frayme.compose.stream({
  prompt: 'The open support tickets, sortable, with an escalate action per row',
  signals: {
    data_shape: ['table', 'filters'], // what the content IS
    density: 'compact',               // compact · standard · rich
    patterns: ['row-actions'],        // interaction furniture to make available
    tone: 'neutral',                  // neutral · branded
  },
  context: { theme: 'dark' },         // THE theme dial — light or dark; omit to let the host decide
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

- `data_shape` — one or more of `avatar`, `board`, `bracket`, `calendar`, `cards`, `chart`, `citations`, `code`, `diff`, `document`, `feed`, `filters`, `form`, `image`, `link-preview`, `list`, `map`, `plans`, `reasoning`, `table`, `thread`, `timeline`, `tree`, `video`. The shape of `data` follows it: table/list → `rows`, chart → `series`/`points`, plans → `plans`, form → field seed values.
- `density` — `compact` (terse scanning) · `standard` · `rich` (generous detail and supporting copy). Often the one signal that matters: it is what separates a scanning grid from a card list.
- `patterns` — any of `accordion`, `bulk-actions`, `collapsible`, `confirm-dialog`, `dialog`, `drawer`, `dropdown-menu`, `hover-card`, `multi-step`, `popover`, `row-actions`, `segmented-control`, `tabs`, `tooltip`.
- `tone` — `neutral` (product-default styling) · `branded` (lean into the colour and voice the prompt describes).

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
| `op` | `(op, snapshot)` — the raw operation plus the progressively accumulated `Spec` | A provisional json-render operation arrived. Render the snapshot. |
| `restarted` | `ComposeRestartedEvent` | The previous attempt failed validation — the internal snapshot has been reset. Discard everything rendered so far. |
| `completed` | `ComposeCompletedEvent` | The validated final commit; carries `generation_id`, `model`, `operation_count`, `usage`, and `replayed`. |
| `error` | `FraymeError` | The stream failed with a typed error. Never fired for consumer aborts. In-band `error` events are unbilled. |
| `abort` | `APIUserAbortError` | You aborted via `.abort()`, `.controller`, or a passed signal. |
| `end` | — | Always fired exactly once, after success, error, or abort. |

### Surface

| Member | Description |
| --- | --- |
| `finalSpec()` | Resolves on `compose.completed` with `{ spec, generationId, model, operationCount, usage, replayed }`; rejects on error or abort. |
| `currentSpec()` | The spec accumulated so far — provisional until `compose.completed`. |
| `abort()` | Abort the stream and the underlying network request. |
| `controller` | The `AbortController` behind `.abort()`, for composing with your own signals. |
| `for await (const event of stream)` | Iterate the typed events directly. Breaking out of the loop aborts the stream. |

In `edit` and `continue_journey` modes the accumulator is seeded with your `prior_spec`, so the server's minimal patch applies in place — snapshots are always complete specs.

## Per-request options

Every method accepts a second `options` argument:

| Option | Description |
| --- | --- |
| `signal` | An `AbortSignal` to cancel the request. |
| `idempotencyKey` | Supply your own `Idempotency-Key` (≤255 chars). Otherwise one is auto-generated whenever retries are enabled. |
| `maxRetries` | Override the client-level retry count for this call. |

Replaying a key within 24 hours returns the original result — same `generation_id`, `replayed: true` — and is free. See [idempotency on the compose page](../api/compose.md).

## me() and health()

```ts
const me = await frayme.me();
// { workspace: { id, name, slug },
//   plan: { tierKey, monthlyGenerations, rateLimitPerMin, generationsRemaining } }
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
| `RateLimitError` | 429 | `RATE_LIMITED` — has `.retryAfter` (seconds, from the `Retry-After` header) |
| `QuotaExceededError` | 429 | `QUOTA_EXCEEDED` — the monthly cap; waiting won't help, upgrading will |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` |
| `CompositionFailedError` | 502 | `COMPOSITION_FAILED` |
| `ModelUnavailableError` | 503 | `MODEL_UNAVAILABLE`, `SERVICE_UNAVAILABLE` — check `.code` |
| `APIConnectionError` | — | Network failure: could not reach the API, or the connection died mid-stream. |
| `APIUserAbortError` | — | You aborted the request. |

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

## @frayme/api/tools

The `@frayme/api/tools` entrypoint exports `composeToolDefinition`, `actionToolDefinition`, and the client-bound `createComposeTool(frayme)` / `createActionTool(frayme)` — one definition that registers in Vercel AI SDK 6, Mastra, LangChain.js, and the OpenAI Agents SDK. See the [framework guides](../frameworks/ai-sdk.md).

### Worked examples, on two channels

Each tool's `description` carries the full contract plus worked calls — five for `frayme_compose` (a working queue, an analytics page with no actions, a composite page, the carrier pattern with its `live: true` contrast, and an edit with `prior_spec`) and two round-trip events for `frayme_action`. The description is the universal carrier: it is the one field every framework forwards.

The same examples are also exported structured — `composeInputExamples` / `actionInputExamples` — and `createComposeTool` / `createActionTool` attach them as `inputExamples: [{ input }]`, the Vercel AI SDK / Mastra core tool field. `@ai-sdk/anthropic` sends it as the Anthropic Messages API's `input_examples` (GA, no beta header required; the SDK still tags the request with a legacy `advanced-tool-use` beta header, which is harmless); Mastra's `createTool` carries it through; other providers ignore it, or fold it into the description with the AI SDK's `addToolInputExamplesMiddleware`. LangChain.js, the OpenAI Agents SDK and MCP have no equivalent field, so for them the description is what the model sees.

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

Every example is asserted schema-valid in the package's own tests — the Anthropic API returns 400 on an `input_examples` entry that fails `input_schema`.

### Declaring actions

Each entry in `actions` is one callback your agent will handle. `name` is what comes back when the control fires. `params` is a JSON Schema object whose top-level `required` array is what genuinely blocks the submit until those fields are filled — list mandatory keys there, not only in prose. `required: true` guarantees a control bound to the action is present even when the generation omits it. `confirm` gates the control behind a dialog — `true` for a plain confirm, or `{ tone, body, confirmLabel, denyLabel }` for a scenario-true one. `role` is the short human label of the control (`"approve"`, `"Save board"`), used wherever Frayme places or injects it. `live: true` fires the action on every gesture with no press. `description` is your own words for what the action means; it rides back to you on the event.

### The round trip

Only a press round-trips: a Button, a Confirmation verdict, a Form submit, a DataTable, or a row/bulk action on a table or board. Every other gesture stays local under `state._ui.<elementId>.<verb>` (latest per verb, never cleared by a press) and rides in the next press's `state`; `live: true` on the declared action is the opt-out, and Frayme injects a carrier button (labelled from `role`, else "Done") when an action is wired only to a non-press component. The event your host receives — `{ action, event, params, state, element_id, label, description, generation_id }` — goes to `frayme_action` verbatim; the bound tool omits `label` and `description` from the request because the wire's `action_context` does not carry them yet.
