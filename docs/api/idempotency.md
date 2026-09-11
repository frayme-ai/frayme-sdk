# Idempotency

Send an `Idempotency-Key` header with a compose and retries of that request can never double-bill — a completed generation is replayed for free.

## How to use it

Pass any unique string (up to 255 characters) as the `Idempotency-Key` header:

```bash
curl https://api.frayme.ai/v1/compose \
  -H "Authorization: Bearer $FRAYME_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: refund-4821-v1" \
  -d '{ "prompt": "A refund approval card for order #4821", "stream": false }'
```

Derive the key from the business event behind the request (`"refund-4821-v1"`, an order id, a message id) — not from a random value per attempt, or retries won't match.

{% hint style="info" %}
`@frayme/api` does this for you: every `compose.create()` / `compose.stream()` call gets an idempotency key automatically, so the SDK's built-in retries replay instead of re-billing. You only need to set a key yourself when *your own* code might re-issue the request — a job queue redelivery, a user double-click, a crashed worker restarting.
{% endhint %}

## What the key binds to

A key binds to the **SHA-256 of the raw request body bytes** — the exact bytes, not the parsed JSON. Two bodies that are semantically equal but serialized differently (key order, whitespace) are *different* requests, and reusing the key across them is rejected with `422 VALIDATION_ERROR`. Serialize once, retry the same bytes.

## The five outcomes

| Situation | Result |
| --- | --- |
| First request with this key | Proceeds normally. On validated success, the result is stored under the key. |
| Retry after a **success** | **Free replay** of the stored result — the original `generation_id`, `replayed: true`. Nothing is billed. |
| Retry while the original is **still running** | `409 IDEMPOTENCY_KEY_IN_USE`. Wait for the original to finish, then retry for a replay. |
| Same key, **different body** | `422 VALIDATION_ERROR`. Use a fresh key for a new request. |
| Retry after a **failure** | Proceeds as a fresh attempt. Failures release the key — the mirror image of "failures are never billed". |

Client disconnects release the key too: if you abort mid-compose, the key stays retryable. If the original request dies uncleanly (process crash, hard timeout), the in-flight lock is reclaimed after a few minutes rather than blocking retries.

## What a replay looks like

A replay honors your `stream` flag:

- **`stream: true`** — an instant burst-stream: `compose.started`, every stored `op` back-to-back, then `compose.completed` with `"replayed": true`. Your rendering path doesn't need a special case.
- **`stream: false`** — the stored envelope with `"replayed": true`.

Either way the payload carries the **original** `generation_id`, `spec`/ops, `model`, `operation_count`, and `usage`. Two fields are omitted on replays: `interactions` and `components_used` (present only on the original completion).

```json
{
  "success": true,
  "data": {
    "generation_id": "gen_5f0c…",
    "spec": { "…": "…" },
    "operation_count": 42,
    "validated": true,
    "replayed": true
  }
}
```

Branch on `replayed` if you log or meter generations yourself — a replay is not a new generation.

## Interaction with other gates

- Replays resolve **before** the quota gate — a stored result is always retrievable, even at `429 QUOTA_EXCEEDED`. You paid for it once; you can always fetch it.
- Replays still count against the per-key [burst limit](rate-limits.md) — hammering replays is still load.

## Retention

Stored results live for **24 hours**. After that the key expires and a request with it starts a fresh (billable) compose. Idempotency protects retry windows, not long-term storage — persist specs you want to keep.

## A safe retry loop

```ts
import Frayme, { RateLimitError } from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

// Same key + same input on every attempt = at most one billed generation.
async function composeOnce(orderId: string) {
  const input = { prompt: `A refund approval card for order ${orderId}` };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await frayme.compose.create(input, {
        idempotencyKey: `refund-${orderId}-v1`,
      });
    } catch (err) {
      if (err instanceof RateLimitError) {
        await sleep((err.retryAfter ?? 5) * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error('compose did not complete after 3 attempts');
}
```

## Related

- [Errors](errors.md) — the 409/422 pair in the full taxonomy
- [Rate limits](rate-limits.md) — what replays do and don't count against
- [Production checklist](../resources/production-checklist.md) — where idempotency fits in a deploy
