# Production checklist

Everything to verify before your Frayme integration takes real traffic — each item links to the page that explains it.

## Keys and auth

- [ ] **API keys live server-side only.** Never ship an API key to a browser or mobile bundle. `@frayme/api` refuses to construct with a key in a browser-like environment for exactly this reason.
- [ ] **Browser and mobile apps use keyless proxy mode.** The client calls your backend, your backend calls Frayme: `new Frayme({ apiKey: null, baseURL: '/api/your-proxy' })`. See [authentication](../getting-started/authentication.md).
- [ ] **One key per environment.** Separate keys for local, CI, staging, and production, each from its own environment variable — a leak in one environment then never forces a rotation in another. Verify the key you deployed with a startup call to [`/v1/me`](../api/me-and-health.md).
- [ ] **Keys are rotatable.** Load the key from config, not code, so revoking and re-minting in the dashboard is a redeploy, not a code change.

## Streaming

- [ ] **`compose.restarted` discards rendered state.** Ops are provisional until `compose.completed`; on a restart the next ops build a *fresh* spec. `@frayme/api`'s stream and `<FraymeRenderer restartKey={…}>` handle this — hand-rolled SSE clients must implement the discard. See [compose](../api/compose.md#streaming-response-sse).
- [ ] **Nothing between Frayme and your client buffers SSE.** Disable proxy buffering (nginx: `proxy_buffering off`) and skip compression on the stream path, or events arrive in one late burst. See [troubleshooting](troubleshooting.md#events-arrive-all-at-once-or-not-at-all).
- [ ] **In-band `error` events are handled.** After the stream opens, failures arrive as `error` events, not HTTP statuses — the SDK converts them to typed errors for you.

## Errors and retries

- [ ] **Retry logic branches on `error.code`, never on status alone.** Two different conditions share status 429: `RATE_LIMITED` (back off for `Retry-After`, then retry) and `QUOTA_EXCEEDED` (do **not** retry this cycle). See [the two 429s](../api/errors.md#the-two-429s).
- [ ] **Transient codes get backoff, permanent ones don't.** Retry `MODEL_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, `COMPOSITION_FAILED`, and 500s with exponential backoff; treat 400/401/403/422 as bugs to fix, not retry.
- [ ] **Anything you might retry carries an idempotency key.** The SDK auto-keys its own retries; add explicit keys where *your* code can re-issue a request (queues, crashed workers, double-clicks). See [idempotency](../api/idempotency.md).

## Timeouts

- [ ] **Buffered calls get a generous timeout.** Most composes finish in seconds, but the worst case — a retry on the stronger model — can take a few minutes. Prefer streaming for interactive surfaces; it shows progress immediately and the `: ping` keepalives hold the connection open.
- [ ] **Aborts are wired.** Pass an `AbortSignal` so navigation away cancels in-flight composes — a compose aborted before completion is never billed.

## Quota and monitoring

- [ ] **`generationsRemaining` is monitored.** Poll [`GET /v1/me`](../api/me-and-health.md) on a schedule and alert well before the cap — at `QUOTA_EXCEEDED` your users see failures until reset or upgrade. See [rate limits](../api/rate-limits.md#monitoring-your-quota).
- [ ] **`generation_id` is logged.** Every compose response carries one; include it in support requests and your own correlation. Log `model` too, but treat it as an opaque label — never branch on it.
- [ ] **`/v1/health` backs your uptime checks.** It's unauthenticated and static — safe for load-balancer probes.

## Rendering

- [ ] **`@frayme/runtime/styles.css` is imported once** at your app root — without it the UI renders unstyled.
- [ ] **Stored specs render through strict mode.** `<FraymeRenderer mode="strict">` (the default) re-validates specs loaded from your own storage; use `progressive` only for mid-stream snapshots. See [rendering](../guides/rendering.md).
- [ ] **Repeats are seeded.** Lists bound to state render zero rows when the data was never passed — send display facts in `data`, or inject with `initialState`. See [data binding](../guides/data-binding.md).

## Related

- [Troubleshooting](troubleshooting.md) — the failures these checks prevent
- [Errors](../api/errors.md) — the full taxonomy
- [Idempotency](../api/idempotency.md) — safe-retry semantics in depth
