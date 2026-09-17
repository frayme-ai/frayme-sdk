# @frayme/api/server

The compose proxy for your own server route: `createFraymeHandler` turns a keyless browser request into an authorized Frayme compose and streams the answer back.

```ts
import { createFraymeHandler, type FraymeHandlerOptions } from '@frayme/api/server';
```

Part of `@frayme/api` (version 0.5.0). It imports no web framework and runs wherever `Request`, `Response` and `ReadableStream` exist. For a walkthrough, see [Server handler](../guides/server-handler.md).

## `createFraymeHandler`

```ts
declare function createFraymeHandler(options: FraymeHandlerOptions): (request: Request) => Promise<Response>;
```

Returns a fetch-style handler. It throws a `TypeError` when it is built with an unusable configuration:

- `authorize` is not a function;
- `maxBodyBytes` is not a positive, finite number;
- `actionPolicy` is neither `'declared_only'` nor `'open'`.

```ts
// app/api/frayme/[...path]/route.ts
import { createFraymeHandler } from '@frayme/api/server';

export const POST = createFraymeHandler({ authorize: getUser });
```

## `FraymeHandlerOptions`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `authorize` | `(request: Request) => unknown \| Promise<unknown>` | required | Decides whether this request may compose. Truthy lets it through; falsy, or a throw, answers 401. Runs before the body is read, so read headers or cookies, not the body. |
| `client` | `Frayme` | `new Frayme()` | The client that calls the API with your key. The default reads `FRAYME_API_KEY` and `FRAYME_BASE_URL` and is built on the first request, not at import. |
| `actionPolicy` | `'open' \| 'declared_only'` | `'declared_only'` | Set as `action_policy` on every request. The browser cannot choose it. |
| `maxBodyBytes` | `number` | `131072` (128 KiB) | The largest request body accepted, in bytes. |
| `allowCustomComponents` | `boolean` | `false` | Accept `custom_components` from the browser. |

## Request handling

Each request goes through these checks in order. The API is called only when all of them pass.

| Step | Check | On failure |
| --- | --- | --- |
| 1 | The method is `POST`. | 405 `BAD_REQUEST`, with `Allow: POST` |
| 2 | `authorize(request)` returns something truthy. | 401 `AUTHENTICATION_REQUIRED`, message `Not authorized.` |
| 3 | `Content-Type` is `application/json` (parameters and letter case ignored). | 415 `BAD_REQUEST` |
| 4 | `Idempotency-Key`, if present, is 1 to 255 printable ASCII characters. | 400 `BAD_REQUEST` |
| 5 | The body fits `maxBodyBytes`, by `Content-Length` and by bytes read. | 413 `BAD_REQUEST` |
| 6 | The body is valid JSON and a JSON object. | 400 `BAD_REQUEST` |
| 7 | Every field is allowed (below). | 400 `BAD_REQUEST`, message `Unknown field "<name>".` |

The request path and query string are ignored.

## What is forwarded

- **Fields:** `prompt`, `signals`, `mode`, `context`, `max_operations`, `data`, `actions`, `prior_spec` and `action_context`, as sent. `custom_components` only with `allowCustomComponents: true`. Any other field, including `action_policy` and `metadata`, is refused at step 7.
- **`action_policy`:** always the handler's `actionPolicy`.
- **`stream`:** read, never forwarded. Only an explicit `false` gives a buffered answer; anything else streams.
- **`Idempotency-Key`:** forwarded as the API request's key, so a browser retry can replay instead of composing again.
- **Abort:** the incoming request's `signal` is passed on, and cancelling the response body aborts the upstream compose.
- **Retries:** none upstream. The browser client retries the route itself.
- **Size:** nothing is cut to fit. The body is forwarded as sent, and the API answers 400 when a field is over its ceiling (`data` or `prior_spec` over 48,000 characters of JSON, `action_context` over 16,000). See [`fitContinuation`](api-agent.md#fitting-a-follow-up-to-the-size-ceilings).

## Responses

### Success

| Request | Status | `Content-Type` | Body |
| --- | --- | --- | --- |
| streaming (default) | 200 | `text/event-stream; charset=utf-8` | The API's event stream: `event: <type>` and `data: <json>` frames, plus a `: ping` comment every 15 seconds. |
| `stream: false` | 200 | `application/json` | `{ "success": true, "data": <ComposeResult> }`, the API's own envelope. |

A streaming answer is sent only after the first upstream event arrives, so an error before that point still has a real status. Event names that are not plain tokens (letters, digits, `_`, `.`, `-`, up to 64 characters) are dropped rather than written.

### Errors

Every error body is `{ "success": false, "error": { "message": "...", "code": "..." } }` with `Content-Type: application/json`.

| Status | Code | When |
| --- | --- | --- |
| 400, 405, 413, 415 | `BAD_REQUEST` | A request check failed (see above). |
| 401 | `AUTHENTICATION_REQUIRED` | `authorize` returned something falsy or threw. |
| 499 | `BAD_REQUEST` | The incoming request was aborted before the first event, or before the buffered result. |
| 500 | `INTERNAL_SERVER_ERROR` | No client could be built (the key is missing), or the API refused the server's key. Message: `The compose proxy is not configured.` |
| 503 | `SERVICE_UNAVAILABLE` | The API could not be reached. |
| the API's | the API's | Any other API error before the first event, with the API's message. |

After the stream has started, a failure is written as an in-band frame, `event: error` with data `{ "type": "error", "error": { "code": "...", "message": "..." } }`, and the stream closes. A lost upstream connection becomes `SERVICE_UNAVAILABLE`, a stream that ends without completing becomes `INTERNAL_SERVER_ERROR`.

Messages reach the browser only when they came from the API. Failures raised inside your server get fixed messages.

### Headers

- `cache-control: no-store` and `x-accel-buffering: no` on every response.
- `retry-after` and `x-request-id` when the API sent them with an error.
- `allow: POST` on a 405.

## Server-key failures

An API 401, or a 403 with any code but `FEATURE_LIMIT`, means the server's own key is missing, revoked or lacks the scope. The handler answers 500 `INTERNAL_SERVER_ERROR` (`The compose proxy is not configured.`) instead, so the browser never reads it as a signed-out user, and logs the API's code and message with `console.error`, prefixed `[frayme] compose proxy`. A missing key is logged the same way. `FEATURE_LIMIT` concerns the request itself and passes through as a 403. The key is never written into any response.

## Next steps

- [Server handler](../guides/server-handler.md): the guide, with a non-Next.js example
- [Chatless screens](../guides/chatless-screens.md): `<FraymeScreen>` on top of the handler
- [`@frayme/api`](api.md): the client the handler calls with
