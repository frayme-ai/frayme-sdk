# Rate limits

Two independent ceilings govern every key: a per-key burst limit and a monthly generation quota — each with its own 429 code.

## The two ceilings

| Ceiling | Scope | Measured over | On breach |
| --- | --- | --- | --- |
| **Burst limit** | Per API key | A sliding one-minute window of requests | `429 RATE_LIMITED` + `Retry-After` header |
| **Monthly quota** | Per workspace | Billing cycle, validated generations | `429 QUOTA_EXCEEDED`, no `Retry-After` |

They fail differently on purpose: a burst breach is a *pause*, a quota breach is a *stop*. Branch on `error.code` — see [the two 429s](errors.md#the-two-429s).

## The burst limit

Every authenticated request counts against its key's burst limit — including malformed requests, failed composes, [idempotent replays](idempotency.md), and `/v1/me` itself. The limit is enforced before anything else touches the pipeline, so a retry loop gone wrong is throttled instead of amplified.

The limit is a requests-per-minute figure set by your plan, and the API is the source of truth for it: read your key's live value from `plan.rateLimitPerMin` on [`GET /v1/me`](me-and-health.md). A plan change is reflected on the very next request.

```bash
curl https://api.frayme.ai/v1/me -H "Authorization: Bearer $FRAYME_API_KEY"
# → "plan": { "rateLimitPerMin": …, "generationsRemaining": …, … }
```

The window is per **key**, not per workspace — one key per service or environment gives each its own window, which is one more reason to [mint one key per environment](../getting-started/authentication.md#key-safety).

On breach the response is `429` with `error.code: "RATE_LIMITED"` and a `Retry-After` header carrying the seconds to wait. `Retry-After` is the only rate-limit header the API sends — there is no per-response remaining-count to pace yourself against, so honor `Retry-After` when it arrives rather than watching headers. The window slides, so retrying earlier just extends the wait:

```ts
import { RateLimitError } from '@frayme/api';

try {
  await frayme.compose.create({ prompt });
} catch (err) {
  if (err instanceof RateLimitError) {
    await sleep((err.retryAfter ?? 5) * 1000); // parsed from Retry-After
    // retry — safe: the SDK's idempotency key means no double-billing
  } else {
    throw err;
  }
}
```

The SDK's automatic retries already do this: a 429 is retried up to `maxRetries` times, honoring `Retry-After`, under the same idempotency key — so a retried success replays instead of re-billing.

## Monthly generation quotas

Each plan includes a fixed number of generations per month. Caps are **hard** — there is no overage billing, and no surprise invoice: when the quota is spent, compose returns `429 QUOTA_EXCEEDED` until the cycle resets or you upgrade.

| Plan | Price / mo | Generations / mo |
| --- | --- | --- |
| Free | $0 | 500 |
| Hobby | $9 | 3,000 |
| Starter | $29 | 12,000 |
| Pro | $99 | 60,000 |
| Scale | $299 | 200,000 |

All plans share the same features — the lever between tiers is volume. Full plan details are on the [pricing page](../resources/pricing.md).

### What consumes quota

Exactly one thing: a **validated success** — a compose that ends in `compose.completed` (or a `200` envelope). Everything else is free:

- Failed composes (`error` events, `COMPOSITION_FAILED`, `MODEL_UNAVAILABLE`) — never billed
- [Idempotent replays](idempotency.md) — the original generation was billed once; replays are free
- `/v1/me` and `/v1/health` calls — never billed (but `/v1/me` does count against the burst limit)

So `generationsRemaining` only ever moves when you actually received a validated spec.

## Monitoring your quota

Poll [`GET /v1/me`](me-and-health.md) and alert before you hit the wall:

```ts
const me = await frayme.me();
if (me.plan.generationsRemaining < me.plan.monthlyGenerations * 0.1) {
  alertOps(`Frayme quota low: ${me.plan.generationsRemaining} left`);
}
```

Poll on a schedule (once a minute is plenty), not per request — `/v1/me` shares the key's burst limit.

{% hint style="info" %}
`QUOTA_EXCEEDED` is **not retryable** within the cycle. A backoff loop that treats it like `RATE_LIMITED` will hammer the API pointlessly for the rest of the month — branch on the code.
{% endhint %}

## Related

- [Errors](errors.md) — the full taxonomy, including both 429s
- [Idempotency](idempotency.md) — why retries can never double-bill
- [Pricing](../resources/pricing.md) — the plans behind the quotas
