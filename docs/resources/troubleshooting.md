# Troubleshooting

The ten failures integrators actually hit, each with its cause and fix.

## 401 with a key you're sure is right

**Symptom:** `AUTHENTICATION_REQUIRED` even though the key is in the dashboard.

Almost always the header, not the key. Check in order: the header is exactly `Authorization: Bearer fr_…` (the `Bearer ` prefix is required); the env var doesn't carry a trailing newline or quote from your secrets manager; you're not sending a truncated key (they're shown once at mint, so re-mint if unsure); the key wasn't revoked or expired. Confirm with the smallest possible call:

```bash
curl -i https://api.frayme.ai/v1/me -H "Authorization: Bearer $FRAYME_API_KEY"
```

## 400 on a field you didn't know you sent

**Symptom:** `BAD_REQUEST` naming a field, often one that looks right.

The compose schema is **strict**: unknown fields are rejected rather than ignored, so typos fail loudly instead of silently doing nothing. The classic: `priorSpec` instead of `prior_spec`, or `maxOperations` instead of `max_operations`. The request body is `snake_case` throughout, and only the fields on the [compose page](../api/compose.md#request-fields) exist. An archetype or template field is not one of them; steer with `signals`. The error message names the offending path; fix that field and only that field.

## A generated list renders zero rows

**Symptom:** the spec looks complete, validation passed, but a table or list is empty.

The repeat's `statePath` points at state that was never seeded. A repeat resolves to *the array at its path, or `[]` if absent*, so an unseeded path silently renders nothing. Send the rows in the request's `data` field (facts in `data` are seeded into state), or inject them at render time with `initialState`. Full explanation: [data binding](../guides/data-binding.md#repeated-lists-and-why-unseeded-repeats-render-zero-rows).

## The UI renders, but unstyled

**Symptom:** components appear as bare HTML, with no spacing and no theme.

You haven't imported the runtime stylesheet. Add it once at your app root:

```ts
import '@frayme/runtime/styles.css';
```

Theming from there is CSS variables (`--frayme-*`). See [theming](../guides/theming.md).

## Duplicate or stale UI after a restart

**Symptom:** mid-stream the UI doubles up, or fragments of an earlier attempt linger.

You received `compose.restarted` and kept rendering. Ops are provisional; a restart means *discard everything rendered so far*. The next ops build a fresh spec. `@frayme/api`'s stream resets its snapshot for you, and `<FraymeRenderer restartKey={…}>` remounts on change; hand-rolled SSE clients must clear their own accumulated state on this event. See [compose](../api/compose.md#streaming-response-sse).

## 429s that retrying makes worse

**Symptom:** a backoff loop keeps getting 429 for hours.

You're treating `QUOTA_EXCEEDED` as `RATE_LIMITED`. They share status 429 and mean opposite things: `RATE_LIMITED` is a per-minute burst breach, so wait `Retry-After` seconds and retry; `QUOTA_EXCEEDED` is the monthly cap, and **no retry helps** until the cycle resets or you upgrade. Branch on `error.code`, or use the SDK's distinct `RateLimitError` / `QuotaExceededError` classes. See [the two 429s](../api/errors.md#the-two-429s).

## "Refusing to run with an API key in a browser-like environment"

**Symptom:** `@frayme/api` throws this at construction time in your frontend.

Working as intended: a key in the browser is visible to every visitor. Move the key to your server and point the client at your own proxy route:

```ts
const frayme = new Frayme({ apiKey: null, baseURL: '/api/frayme-proxy' });
```

For local experiments on your own machine only, `dangerouslyAllowBrowser: true` bypasses the guard. Never ship it: anything a user can open belongs on keyless proxy mode.

## Custom component rejected with `INVALID_MANIFEST`

**Symptom:** a BYOC compose fails 400 before composing anything.

The server runs the *identical* lint your client does, so reproduce locally by passing the manifest through `defineFraymeComponent(…)` from `@frayme/catalog` and read its errors. Two other gates to check: duplicate `name` across manifests in one request, and `CUSTOM_SLICE_TOO_LARGE` when compiled manifests exceed the 12,000-character per-request budget (the error message includes a per-manifest breakdown, so trim or send fewer). See [custom components](../guides/custom-components.md).

## 422 on a retry you expected to replay

**Symptom:** `VALIDATION_ERROR: This Idempotency-Key was used with a different request body`.

The key binds to the **raw bytes** of the body, and your retry serialized differently: reordered keys, changed whitespace, a regenerated timestamp inside the payload. Serialize once and retry the same bytes, or derive the body deterministically. A new request needs a new key. See [idempotency](../api/idempotency.md#what-the-key-binds-to).

## Events arrive all at once, or not at all

**Symptom:** the stream is silent for the whole compose, then every event lands in one burst.

Something between Frayme and your client, typically a reverse proxy or compression middleware, is buffering the SSE response. Fixes: nginx `proxy_buffering off;` (or send `X-Accel-Buffering: no` from your proxy route), disable gzip/brotli on the stream path, and when testing with curl use `-N` to disable its own buffering. The API sends a `: ping` comment every 15 seconds. If you don't see pings, the buffer is upstream of you.

## Still stuck?

- [GitHub Discussions](https://github.com/frayme-ai/frayme-sdk/discussions): questions and answers
- [GitHub issues](https://github.com/frayme-ai/frayme-sdk/issues): bugs, with your `generation_id` if the failure was a compose
- [Errors](../api/errors.md): the full code-keyed taxonomy
