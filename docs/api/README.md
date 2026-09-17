# API reference

The Frayme API is a small REST surface (three endpoints) that turns a natural-language prompt into a validated, interactive UI spec.

## Base URL

```
https://api.frayme.ai
```

All endpoints are versioned under `/v1`:

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| [`POST /v1/compose`](compose.md) | API key | Compose a validated UI spec from a prompt. The product. |
| [`GET /v1/me`](me-and-health.md) | API key | Verify a key; inspect workspace, plan, and remaining quota. |
| [`GET /v1/health`](me-and-health.md#get-v1health) | None | Liveness probe. |

{% hint style="info" %}
API keys are issued from your Frayme dashboard at [frayme.ai](https://frayme.ai).
{% endhint %}

## Authentication

Every authenticated request sends an API key as a bearer token:

```bash
curl https://api.frayme.ai/v1/me \
  -H "Authorization: Bearer $FRAYME_API_KEY"
```

Keys are minted in the dashboard and shown once; they look like `fr_live_…`. Keep keys server-side only: the `@frayme/api` client refuses to run with a key in a browser (see [production checklist](../resources/production-checklist.md)). A missing, malformed, revoked, or expired key returns `401 AUTHENTICATION_REQUIRED`.

## Response envelope

Every non-streaming response wraps its payload in a common envelope:

```json
{ "success": true, "data": { … } }
```

```json
{ "success": false, "error": { "message": "…", "code": "RATE_LIMITED" } }
```

Branch on `error.code`, not the HTTP status, because two distinct conditions share status 429. The full taxonomy is in [errors](errors.md).

One convention to know: `POST /v1/compose` speaks `snake_case` on the wire; `GET /v1/me` responds in `camelCase`. Each endpoint page shows its exact shapes.

## Streaming

`POST /v1/compose` streams by default as server-sent events: a `compose.started` frame, live `op` frames that incrementally build the spec, and a terminal `compose.completed` frame. Errors after the stream opens arrive as in-band `error` events. See [compose](compose.md#streaming-response-sse) for the event contract.

## The model

Frayme runs its own model, purpose-built for composing interfaces. Every spec is validated against the 189-component catalog before it renders or bills, and weak generations are automatically retried on a stronger model. The `model` field in responses is an opaque identifier: treat it as a label for logging, never as a contract.

## Billing

You are billed one generation per **validated success**: a compose that ends in `compose.completed` (or a 200 envelope). Failures of any kind are free, and [idempotent replays](idempotency.md) are free. See [rate limits](rate-limits.md) for quotas.

## Versioning stance

- The API is path-versioned. Breaking changes get a new version path; `/v1` stays stable.
- **Responses are additive.** New fields, event types, and error codes may appear at any time. Ignore response fields you don't recognize.
- **Requests are strict.** Unknown request fields are rejected with `400 BAD_REQUEST` (a typo never silently does nothing).
- `model` values are opaque and may change without notice.

## OpenAPI

The machine-readable contract ships with these docs as [`openapi.json`](openapi.json) and is served at [`https://api.frayme.ai/v1/openapi.json`](https://api.frayme.ai/v1/openapi.json). Use it for codegen in languages the [SDK](../sdk/api.md) doesn't cover.

## In this section

- [Compose](compose.md): the endpoint, field by field
- [Me and health](me-and-health.md): key verification and liveness
- [Errors](errors.md): the code-keyed taxonomy
- [Rate limits](rate-limits.md): burst limits and monthly quotas
- [Idempotency](idempotency.md): safe retries that never double-bill
