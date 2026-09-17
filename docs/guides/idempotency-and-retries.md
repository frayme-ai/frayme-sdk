# Idempotency and retries

Retry any compose safely: the `Idempotency-Key` header makes a retried request replay the original result for free instead of generating (and billing) twice.

## Why this matters

`POST /v1/compose` is a billable mutation. When a request dies mid-flight (dropped connection, timeout, 5xx), you can't tell from the outside whether the server finished the generation. Retrying blind risks paying twice for the same UI; not retrying risks abandoning a result you already paid for. An idempotency key removes the ambiguity: the retry either re-runs a request that never completed, or replays the stored result at no cost.

## The header

Send any string up to 255 characters as `Idempotency-Key`. The server binds the key to a hash of the raw request body and remembers the outcome for 24 hours:

```bash
curl https://api.frayme.ai/v1/compose \
  -H "Authorization: Bearer $FRAYME_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-ui-7f3d2c" \
  -d '{"prompt": "Order summary with a cancel option", "stream": false}'
```

Within those 24 hours, the same key can come back three ways:

| Situation | Response |
| --- | --- |
| Same key, same body, original completed | **Free replay** of the stored result: original `generation_id`, `replayed: true`, no billing |
| Same key, original still in flight | `409 IDEMPOTENCY_KEY_IN_USE`: wait and retry (the SDK's automatic backoff usually resolves this into a replay) |
| Same key, **different** body | `422 VALIDATION_ERROR`: a key names one logical request; use a fresh key for new content |

A failed or disconnected attempt releases the key, so a retry under the same key re-runs the generation rather than replaying a failure.

## Replay semantics

- The **original** `generation_id` comes back, with `replayed: true` (on the result body for `stream: false`, on `compose.completed` for a stream).
- A streaming replay is an instant burst: `compose.started`, every stored op, then `compose.completed`. Same shape as a live stream, delivered at once, so your rendering path needs no special case.
- `interactions` and `components_used` are omitted on replays.
- Replays are never billed and never touch your monthly quota. (They do count against the per-minute burst limit.)

```ts
const result = await frayme.compose.create(
  { prompt: 'Invoice list with a paid/unpaid filter', stream: false },
  { idempotencyKey: `invoice-ui-${jobId}` },
);
result.replayed; // true when served from the stored result
```

Derive your own key from whatever identifies the logical operation (a job id, a message id) when the same request might be issued from more than one place.

## What the SDK does for you

You rarely manage any of this by hand; `@frayme/api` keys and retries automatically:

- **Auto-generated keys.** Each logical `compose.create()` / `compose.stream()` call generates one idempotency key up front and reuses it verbatim across every retry attempt. Retries therefore cannot double-bill: worst case, they replay. Keys are auto-generated whenever retries are enabled; pass `idempotencyKey` in the call options to control the key yourself.
- **Automatic retries** on connection errors and retryable statuses (408, 409, 429, and 5xx), up to `maxRetries` (default 2).
- **Backoff with jitter.** The delay is `min(500ms · 2^attempt, 5s)` with equal jitter. When the server sends a `Retry-After` header, the SDK honors it (up to 60 seconds) whenever it exceeds the computed backoff.
- **Retries stop at first success.** The moment a 2xx response exists, streaming or not, the request is never re-sent. A stream that dies midway throws `APIConnectionError` instead of silently re-running (see below).

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ maxRetries: 3 });                  // per-client
await frayme.compose.create({ prompt }, { maxRetries: 0 });    // per-call override
```

`maxRetries: 0` disables both automatic retries and key auto-generation. Send `idempotencyKey` explicitly if you still want replay protection.

## Retrying a broken stream

Mid-stream failures are not auto-retried: the SDK can't know how much of the UI you already committed. Retry at your level, reusing the key:

```ts
import Frayme, { APIConnectionError } from '@frayme/api';

async function composeWithRecovery(body: Parameters<typeof frayme.compose.stream>[0]) {
  const key = `compose-${crypto.randomUUID()}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const stream = frayme.compose.stream(body, { idempotencyKey: key });
      return await stream.finalSpec();
    } catch (err) {
      if (!(err instanceof APIConnectionError) || attempt >= 1) throw err;
      // If the server completed the generation before the connection died,
      // this replays it free; otherwise it generates fresh under the same key.
    }
  }
}
```

## The guarantee

A generation is billed **only on validated success, exactly once per idempotency key**. Failed generations, in-band stream errors, and idempotent replays are always free. There is no request pattern, retry loop, or crash timing that double-bills one logical compose.

## Next steps

- [Error handling](error-handling.md): which errors are worth retrying at all
- [Errors reference](../api/errors.md): the full code taxonomy, including the 409/422 pair
