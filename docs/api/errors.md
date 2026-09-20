# Errors

Every error is a stable machine-readable `code` plus a human-readable `message`. Branch on the code, never on the HTTP status alone.

## The envelope

Non-streaming errors return the standard envelope with the appropriate HTTP status:

```json
{
  "success": false,
  "error": {
    "message": "Monthly generation quota exhausted: upgrade your plan or wait for the next cycle",
    "code": "QUOTA_EXCEEDED"
  }
}
```

Errors that occur **after an SSE stream has opened** can't change the status code (the 200 is already sent), so they arrive as a terminal in-band `error` event with the same `code` vocabulary:

```
event: error
data: {"type":"error","error":{"code":"COMPOSITION_FAILED","message":"…"}}
```

Either way, a failed compose is **never billed**.

## The taxonomy

| Status | Code | Meaning | What to do |
| --- | --- | --- | --- |
| 400 | `BAD_REQUEST` | Malformed JSON, an unknown field (the schema is strict), a field over its size cap, or an invalid `prior_spec`. | Fix the request. The message names the offending field. |
| 400 | `INVALID_MANIFEST` | A `custom_components` manifest failed lint, or two manifests share a name. | Run the manifest through `defineFraymeComponent` locally; the server applies the identical lint. |
| 400 | `CUSTOM_SLICE_TOO_LARGE` | Compiled `custom_components` exceed the 12,000-char per-request budget. | Trim manifests or send fewer. The message includes a per-manifest breakdown. |
| 401 | `AUTHENTICATION_REQUIRED` | Missing, malformed, invalid, revoked, or expired API key. | Send `Authorization: Bearer fr_…` with an active key. |
| 402 | `PAYMENT_REQUIRED` | Subscription payment is past due. | Update the payment method in the dashboard; generations resume on recovery. |
| 403 | `FORBIDDEN` | The key lacks a required scope. | Mint a key with the `compose` scope. |
| 403 | `FEATURE_LIMIT` | Reserved for plan limits. Not raised today: inline custom components are capped at 20 per request on every plan, and more than 20 is a 400 `BAD_REQUEST`. | Nothing to handle yet; `plan.inlineComponentsLimit` via [`/v1/me`](me-and-health.md) reports the cap. |
| 404 | `NOT_FOUND` | No such resource/route. | Check the path. |
| 409 | `IDEMPOTENCY_KEY_IN_USE` | A request with this `Idempotency-Key` is still in flight. | Wait for the original to finish, then retry. You'll get a free replay. |
| 422 | `VALIDATION_ERROR` | This `Idempotency-Key` was already used with a **different** request body. | Use a fresh key for a new request; see [idempotency](idempotency.md). |
| 429 | `RATE_LIMITED` | Per-key burst limit exceeded. Carries a `Retry-After` header (seconds). | Back off for `Retry-After`, then retry. Retrying a compose with its idempotency key can never double-bill. |
| 429 | `QUOTA_EXCEEDED` | Monthly generation quota exhausted. No `Retry-After`. | **Not retryable this cycle**: upgrade the plan or wait for reset. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server failure. | Retry with backoff; report persistent cases with the request id. |
| 502 | `COMPOSITION_FAILED` | The output failed validation even after retrying on the stronger model. Unbilled. | Retry; if it persists, simplify the prompt or reduce the ask per request. |
| 503 | `MODEL_UNAVAILABLE` | The model backend is temporarily unavailable. Unbilled. | Retry with backoff. |
| 503 | `SERVICE_UNAVAILABLE` | A transient backend failure (e.g. during authentication). | Retry with backoff. This is never a key problem. |

## The two 429s

Status 429 covers two *very* different situations. `RATE_LIMITED` means *slow down*; you crossed your per-minute burst limit, and the `Retry-After` header says exactly how long to wait. `QUOTA_EXCEEDED` means *stop*; your monthly generation cap is spent, and no amount of retrying will help until the cycle resets or you upgrade. A retry loop that treats them the same will hammer the API pointlessly for the rest of the month. Branch on `code`:

```ts
import { RateLimitError, QuotaExceededError } from '@frayme/api';

try {
  await frayme.compose.create({ prompt });
} catch (err) {
  if (err instanceof RateLimitError) {
    await sleep((err.retryAfter ?? 5) * 1000); // Retry-After, parsed for you
    // retry
  } else if (err instanceof QuotaExceededError) {
    notifyUpgradePath(); // do NOT retry
  } else {
    throw err;
  }
}
```

## Typed errors in the SDK

`@frayme/api` maps every wire error (HTTP responses *and* in-band stream `error` events) to a typed `FraymeError` subclass carrying `status`, `code`, and `requestId`:

`BadRequestError` · `AuthenticationError` · `PaymentRequiredError` · `AuthorizationError` · `NotFoundError` · `IdempotencyKeyInUseError` · `ValidationError` · `RateLimitError` (with `retryAfter`) · `QuotaExceededError` · `CompositionFailedError` · `ModelUnavailableError` · `InternalServerError`, plus `APIConnectionError` (network) and `APIUserAbortError` (you aborted).

The full code → status mapping is exported as `ERROR_CODE_TO_STATUS` from `@frayme/api` if you need to assert parity in your own tests.

## Related

- [Rate limits](rate-limits.md): how the burst limit and quota are measured
- [Idempotency](idempotency.md): the 409/422 pair in depth
- [Troubleshooting](../resources/troubleshooting.md): the errors people actually hit, with fixes
