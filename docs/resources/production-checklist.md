# Production checklist

Everything to verify before your Frayme integration takes real traffic. Each item links to the page that explains it.

## Keys and auth

- [ ] **API keys live server-side only.** Never ship an API key to a browser or mobile bundle. `@frayme/api` refuses to construct with a key in a browser-like environment for exactly this reason.
- [ ] **Browser and mobile apps use keyless proxy mode.** The client calls your backend, your backend calls Frayme: `new Frayme({ apiKey: null, baseURL: '/api/your-proxy' })`. See [authentication](../getting-started/authentication.md).
- [ ] **One key per environment.** Separate keys for local, CI, staging, and production, each from its own environment variable, so a leak in one environment never forces a rotation in another. Verify the key you deployed with a startup call to [`/v1/me`](../api/me-and-health.md).
- [ ] **Keys are rotatable.** Load the key from config, not code, so revoking and re-minting in the dashboard is a redeploy, not a code change.
- [ ] **The proxy checks your users.** `createFraymeHandler` requires `authorize`: make it a real session check (a falsy result or a throw answers 401), and rate-limit each user, because the route spends your quota. See [server handler](../guides/server-handler.md).
- [ ] **The action policy stays on the server.** `createFraymeHandler` sets `action_policy` itself, `declared_only` by default, so a screen gets no controls beyond the actions it declares. Declare every action your screens need, and change `actionPolicy` only on purpose.
- [ ] **The body cap fits your data.** The handler answers 413 to a body over `maxBodyBytes` (default 128 KiB). Raise it only if your `data` really needs more.

## Agent tools

- [ ] **`fraymeTools` is created per request.** Call `fraymeTools({ messages })` inside the route handler, never once at module level: the set allows one compose per turn, so a set created once spends that compose on the first request and refuses every later one. See [`@frayme/api/ai-sdk`](../sdk/api-ai-sdk.md).
- [ ] **The UI messages go in exactly as posted, metadata included.** Pass the `messages` the client sent, not converted model messages: the tools read each press from `metadata.frayme` on the latest user message and each earlier screen from Frayme's own tool outputs. If you validate messages with a strict metadata schema (`messageMetadataSchema` in `useChat`, or `metadataSchema` in `validateUIMessages`), it must allow `frayme`. Without `messages`, `frayme_action` forwards the call as the model wrote it and `edit_of` is not offered.
- [ ] **Model messages are converted with the tools.** Always call `convertToModelMessages(messages, { tools })`. Without `{ tools }`, the AI SDK skips each tool's `toModelOutput`, and the full spec reaches the model.
- [ ] **A finished screen takes presses only when the chat is ready.** Pass `interactive={!busy}` (from `useChat`) to `<FraymeResult>`. A press while the agent is still answering would start a second request alongside the first.
- [ ] **Requests fit the size ceilings.** The API answers 400 to `data` or `prior_spec` over 48,000 characters of JSON, or `action_context` over 16,000, and sending the same request again fails the same way. A press sends neither: `frayme_action`, `createActionTool` and `FraymeScreen`'s `continue` compose the next screen as a fresh create whose values ride in `data`. Only `frayme_compose` with `edit_of` attaches an earlier screen, and it refuses one too large to edit with `SCREEN_TOO_LARGE`. `data` is never cut: keep it under 48,000 characters, or page it.
- [ ] **Sources hold only what this user may see.** The model can read every row you pass in `sources`. See [intents and sources](../guides/intents-and-sources.md).

## Streaming

- [ ] **`compose.restarted` discards rendered state.** Ops are provisional until `compose.completed`; on a restart the next ops build a *fresh* spec. `@frayme/api`'s stream and `<FraymeRenderer restartKey={…}>` handle this. Hand-rolled SSE clients must implement the discard. See [compose](../api/compose.md#streaming-response-sse).
- [ ] **Nothing between Frayme and your client buffers SSE.** Disable proxy buffering (nginx: `proxy_buffering off`) and skip compression on the stream path, or events arrive in one late burst. See [troubleshooting](troubleshooting.md#events-arrive-all-at-once-or-not-at-all).
- [ ] **In-band `error` events are handled.** After the stream opens, failures arrive as `error` events, not HTTP statuses. The SDK converts them to typed errors for you.

## Errors and retries

- [ ] **Retry logic branches on `error.code`, never on status alone.** Two different conditions share status 429: `RATE_LIMITED` (back off for `Retry-After`, then retry) and `QUOTA_EXCEEDED` (do **not** retry this cycle). See [the two 429s](../api/errors.md#the-two-429s).
- [ ] **Transient codes get backoff, permanent ones don't.** Retry `MODEL_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, `COMPOSITION_FAILED`, and 500s with exponential backoff; treat 400/401/403/422 as bugs to fix, not retry.
- [ ] **Anything you might retry carries an idempotency key.** The SDK auto-keys its own retries; add explicit keys where *your* code can re-issue a request (queues, crashed workers, double-clicks). See [idempotency](../api/idempotency.md).

## Timeouts

- [ ] **Buffered calls get a generous timeout.** Most composes finish in seconds, but the worst case (a retry on the stronger model) can take a few minutes. Prefer streaming for interactive surfaces; it shows progress immediately and the `: ping` keepalives hold the connection open.
- [ ] **Aborts are wired.** Pass an `AbortSignal` so navigation away cancels in-flight composes. A compose aborted before completion is never billed.

## Quota and monitoring

- [ ] **`generationsRemaining` is monitored.** Poll [`GET /v1/me`](../api/me-and-health.md) on a schedule and alert well before the cap: at `QUOTA_EXCEEDED` your users see failures until reset or upgrade. See [rate limits](../api/rate-limits.md#monitoring-your-quota).
- [ ] **`generation_id` is logged.** Every compose response carries one; include it in support requests and your own correlation. Log `model` too, but treat it as an opaque label: never branch on it.
- [ ] **`/v1/health` backs your uptime checks.** It's unauthenticated and static: safe for load-balancer probes.

## Rendering

- [ ] **`@frayme/runtime/styles.css` is imported once** at your app root. Without it the UI renders unstyled.
- [ ] **Stored specs render through strict mode.** `<FraymeRenderer mode="strict">` (the default) re-validates specs loaded from your own storage; use `progressive` only for mid-stream snapshots. See [rendering](../guides/rendering.md).
- [ ] **Repeats are seeded.** Lists bound to state render zero rows when the data was never passed. Send display facts in `data`, or inject with `initialState`. See [data binding](../guides/data-binding.md).

## Related

- [Troubleshooting](troubleshooting.md): the failures these checks prevent
- [Errors](../api/errors.md): the full taxonomy
- [Idempotency](../api/idempotency.md): safe-retry semantics in depth
