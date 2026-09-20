# Pricing

Flat monthly plans with hard generation caps. No credits, no metering maze, no overage charges.

## Plans

| | Free | Starter | Pro | Scale |
| --- | --- | --- | --- | --- |
| **Price / mo** | $0 | $29 | $99 | $499 |
| **Generations / mo** | 100 | 10,000 | 50,000 | 500,000 |
| **Streaming** | ✓ | ✓ | ✓ | ✓ |
| **Full 189-component catalog** | ✓ | ✓ | ✓ | ✓ |
| **Support** | Community | Email | Priority | Priority |

Prices in USD. Every plan gets **every feature**: streaming, the full catalog, edit mode, journeys, custom components, the SDK, idempotent retries. The only lever between tiers is volume.

Need more than Scale? Enterprise plans come with unlimited generations, a dedicated team and an SLA: email [sales@frayme.ai](mailto:sales@frayme.ai).

{% hint style="info" %}
Sign up and manage your plan from your Frayme dashboard at [frayme.ai](https://frayme.ai).
{% endhint %}

## What counts as a generation

One call to [`POST /v1/compose`](../api/compose.md) that ends in a **validated success**, a spec that passed catalog validation and reached `compose.completed` (or a `200` envelope). That's the whole billing model:

- **Failures are free.** A compose that errors (validation failure, model unavailability, anything) bills nothing.
- **Replays are free.** Retrying with an [idempotency key](../api/idempotency.md) replays the stored result without a second charge.
- **Utility calls are free.** `/v1/me` and `/v1/health` never bill.

You are never charged for output you didn't receive.

## Hard caps, by design

When a plan's monthly generations are spent, compose returns [`429 QUOTA_EXCEEDED`](../api/errors.md#the-two-429s) until the cycle resets or you upgrade. There is no overage billing and no usage-based surprise at month end: the price on the table is the price on the invoice.

If you're regularly close to the cap, upgrading mid-cycle moves you to the larger allowance; monitor headroom with [`GET /v1/me`](../api/me-and-health.md):

```ts
const me = await frayme.me();
console.log(`${me.plan.generationsRemaining} generations left this cycle`);
```

## Related

- [Rate limits](../api/rate-limits.md): how the caps and burst limits are enforced
- [Idempotency](../api/idempotency.md): why retries can't double-bill
- [Production checklist](production-checklist.md): quota monitoring before launch
