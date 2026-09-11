# Error handling

Every failure from `@frayme/api` surfaces as a typed `FraymeError` subclass with a stable machine-readable `code` — branch on the class or the code, never on message text or bare HTTP status.

## The error classes

All errors extend `FraymeError`, which carries `status`, `code`, `message`, and `requestId` (include `requestId` when reporting an issue):

| Class | Status | Codes |
| --- | --- | --- |
| `APIConnectionError` | — | Network failure, timeout, or a connection that died mid-stream |
| `APIUserAbortError` | — | You aborted (signal or `stream.abort()`) |
| `BadRequestError` | 400 | `BAD_REQUEST` · `INVALID_MANIFEST` · `CUSTOM_SLICE_TOO_LARGE` |
| `AuthenticationError` | 401 | `AUTHENTICATION_REQUIRED` |
| `PaymentRequiredError` | 402 | `PAYMENT_REQUIRED` |
| `AuthorizationError` | 403 | `FORBIDDEN` · `FEATURE_LIMIT` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `IdempotencyKeyInUseError` | 409 | `IDEMPOTENCY_KEY_IN_USE` |
| `ValidationError` | 422 | `VALIDATION_ERROR` |
| `RateLimitError` | 429 | `RATE_LIMITED` — carries `retryAfter` (seconds) |
| `QuotaExceededError` | 429 | `QUOTA_EXCEEDED` |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` |
| `CompositionFailedError` | 502 | `COMPOSITION_FAILED` |
| `ModelUnavailableError` | 503 | `MODEL_UNAVAILABLE` |

The full code → status map is exported as `ERROR_CODE_TO_STATUS` if you need to assert parity in your own tests. Failed composes — whatever the code — are never billed.

## Branch on the class

```ts
import Frayme, {
  AuthenticationError,
  BadRequestError,
  CompositionFailedError,
  FraymeError,
} from '@frayme/api';

const frayme = new Frayme();

try {
  const result = await frayme.compose.create({ prompt, stream: false });
} catch (err) {
  if (err instanceof BadRequestError) {
    // The message names the offending field — fix the request, don't retry.
  } else if (err instanceof AuthenticationError) {
    // Missing/revoked key — surface a config error.
  } else if (err instanceof CompositionFailedError) {
    // Unbilled. Retry, or simplify the prompt if it persists.
  } else if (err instanceof FraymeError) {
    report(err.code, err.requestId);
  } else {
    throw err;
  }
}
```

## The two 429s

Status 429 covers two very different situations — a retry loop that conflates them will hammer the API pointlessly for the rest of the month:

```ts
import { RateLimitError, QuotaExceededError } from '@frayme/api';

try {
  await frayme.compose.create({ prompt });
} catch (err) {
  if (err instanceof RateLimitError) {
    await sleep((err.retryAfter ?? 5) * 1000); // Retry-After, parsed for you
    // retry — with the same idempotency key this can never double-bill
  } else if (err instanceof QuotaExceededError) {
    notifyUpgradePath(); // monthly cap spent — do NOT retry this cycle
  } else {
    throw err;
  }
}
```

`RateLimitError` means *slow down* — you crossed the per-minute burst limit, and `retryAfter` (from the `Retry-After` header) says how long to wait. `QuotaExceededError` means *stop* — the monthly cap is spent; no retry helps until the cycle resets or the plan changes.

## Streams: thrown, not yielded

An SSE stream sends its 200 before anything can fail, so post-open failures arrive as an in-band `error` event on the wire. **The SDK never yields those as events** — it maps them to the same typed classes above and throws, so streaming and non-streaming error handling are one code path.

With low-level iteration, the loop itself throws:

```ts
try {
  for await (const event of await frayme.compose.create({ prompt, stream: true })) {
    handle(event);
  }
} catch (err) {
  if (err instanceof FraymeError) recover(err); // in-band errors land here too
}
```

With the high-level `compose.stream()`, one failure surfaces in three places — all the same error object; handle it wherever fits your shape:

```ts
const stream = frayme.compose.stream({ prompt });

stream.on('error', (err) => showToast(err.message)); // 1. the handler
stream.on('end', () => setBusy(false));              //    always fires exactly once

try {
  const { spec } = await stream.finalSpec();         // 2. the promise rejects
} catch (err) { /* … */ }

// 3. for-await over the stream throws the same error
```

Consumer-initiated aborts are kept separate: `stream.abort()` (or an aborted signal) fires the `abort` handler with an `APIUserAbortError`, `finalSpec()` rejects with it, and `for await` iteration ends *cleanly* — no throw for a stop you asked for.

## `compose.restarted` is not an error

A `compose.restarted` event means the previous attempt's output failed validation and a stronger model is redoing the work — it is the recovery mechanism succeeding, not a failure. Discard rendered state (the SDK resets its internal spec accumulator for you; bump `restartKey` on the renderer) and keep consuming. Never wire `restarted` to an error path — the stream still ends in `compose.completed` or a real thrown error.

## Connection errors and timeouts

`APIConnectionError` covers everything network-shaped: unreachable host, the whole-request `timeout` (default 600 s, covering streaming reads), the `firstEventTimeout` (default 90 s to the first stream event), and a connection that drops mid-stream. Connection errors while *establishing* the request are retried automatically; a mid-stream drop is thrown to you — see [Idempotency and retries](idempotency-and-retries.md) for the safe retry pattern.

## What retries itself

Before you write any retry code: the SDK already retries connection errors and 408/409/429/5xx responses up to `maxRetries` (default 2) with backoff, honoring `Retry-After`, under one idempotency key per logical call. Your `catch` block is for what remains — non-retryable requests (4xx), exhausted retries, and mid-stream failures.

## Next steps

- [Errors reference](../api/errors.md) — every code with its cause and fix
- [Idempotency and retries](idempotency-and-retries.md) — the never-double-billed guarantee
