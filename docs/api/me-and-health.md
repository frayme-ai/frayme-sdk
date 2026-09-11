# GET /v1/me and /v1/health

Two utility endpoints: `/v1/me` verifies a key and reports your plan state; `/v1/health` is an unauthenticated liveness probe.

## GET /v1/me

The "whoami" endpoint — the fastest way to confirm a key works and see what's left of your quota.

```bash
curl https://api.frayme.ai/v1/me \
  -H "Authorization: Bearer $FRAYME_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "workspace": { "id": "8b1f…", "name": "Acme Inc", "slug": "acme-inc" },
    "plan": {
      "tierKey": "pro",
      "monthlyGenerations": 60000,
      "rateLimitPerMin": …,
      "generationsRemaining": 41258,
      "inlineComponentsLimit": 5
    }
  }
}
```

{% hint style="info" %}
**This endpoint responds in `camelCase`** — unlike `/v1/compose`, which speaks `snake_case`. It's the one casing exception in the API.
{% endhint %}

### Response fields

| Field | Type | Meaning |
| --- | --- | --- |
| `workspace.id` / `name` / `slug` | string | The workspace the key belongs to. |
| `plan.tierKey` | string \| null | Your plan's identifier (`null` if no plan is attached). |
| `plan.monthlyGenerations` | number | Generations included per month on your plan. |
| `plan.rateLimitPerMin` | number | Your per-key burst limit, in requests per minute. This field is the source of truth for the number — it is set by your plan and not published elsewhere. See [rate limits](rate-limits.md). |
| `plan.generationsRemaining` | number | Generations left in the current cycle. **Poll this** to alert before you hit the cap. |
| `plan.inlineComponentsLimit` | number | Max inline `custom_components` per compose request on your plan (0 = BYOC not included). |

### With the SDK

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });
const me = await frayme.me();

if (me.plan.generationsRemaining < 500) {
  alertOps(`Frayme quota low: ${me.plan.generationsRemaining} left`);
}
```

### Notes

- Requires a valid key: a bad key returns `401 AUTHENTICATION_REQUIRED` — which makes `/v1/me` the right smoke test for deployments.
- Counts against the same per-key burst limit as compose, so poll it on a schedule (say, once a minute), not per request.

## GET /v1/health

Unauthenticated liveness probe. Static by design — it confirms the API is up without exercising the composition path.

```bash
curl https://api.frayme.ai/v1/health
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "frayme-inference-api",
    "catalog_version": "frayme-0.18.0"
  }
}
```

| Field | Meaning |
| --- | --- |
| `status` | Always `"ok"` when the API is serving. |
| `service` | Service identifier. |
| `catalog_version` | The component-catalog version the API validates against. Compare with `CATALOG_VERSION` from `@frayme/catalog` to spot client/server drift. |

Use it for uptime checks and load-balancer probes. A healthy `/v1/health` plus a `200` from `/v1/me` means your integration is ready to compose.

## Related

- [Rate limits](rate-limits.md) — what `rateLimitPerMin` and `generationsRemaining` govern
- [Production checklist](../resources/production-checklist.md) — monitoring recommendations
