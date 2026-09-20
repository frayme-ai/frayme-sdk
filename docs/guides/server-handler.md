# Server handler

`createFraymeHandler` from `@frayme/api/server` is a ready-made compose proxy: the browser calls your route with no key, and the route checks the user, adds the key and streams the screen back.

## Why a proxy

- **A key in a browser is public.** `@frayme/api` refuses to construct with a key in a browser, so browser clients run keyless against a route of yours. See [Authentication](../getting-started/authentication.md#keyless-proxy-mode).
- **The route decides what the browser may ask for.** It forwards compose requests only, accepts a fixed set of fields, and sets the action policy itself.
- **It speaks the API's own formats.** The keyless client parses the proxied stream and errors exactly as it would parse the API's, so `useFraymeCompose`, `<FraymeScreen>` and `compose.create()` all work through it unchanged.

```bash
npm i @frayme/api
```

## Next.js

```ts
// app/api/frayme/[...path]/route.ts
import { createFraymeHandler } from '@frayme/api/server';

export const POST = createFraymeHandler({ authorize: getUser });
```

`getUser` stands for your own session check. Point the browser at the route's base path:

```tsx
<FraymeProvider endpoint="/api/frayme">{children}</FraymeProvider>;
```

**Why a catch-all route:** the keyless client sends every compose to `<baseURL>/v1/compose`, so with `endpoint="/api/frayme"` the request arrives at `/api/frayme/v1/compose`. A catch-all route under `/api/frayme` receives it, and the handler ignores the path.

**Where the key comes from:** by default the handler builds `new Frayme()`, which reads `FRAYME_API_KEY` (and `FRAYME_BASE_URL`, default `https://api.frayme.ai`) from the environment. It builds the client on the first request, not at import, so a build step can load the route without the key. If the key is missing at request time, the browser gets a 500 and your server log says why.

{% hint style="info" %}
A compose that ends in the automatic stronger-model retry can take a few minutes. If your host caps function duration, raise the cap for this route (in Next.js on Vercel, `export const maxDuration = 300;` in the route file).
{% endhint %}

## `authorize`

`authorize` is required: without a function, `createFraymeHandler` throws a `TypeError`.

- **It runs on every POST, before the body is read.** It receives the incoming `Request`. Read headers and cookies there, not the body.
- **Truthy means go on.** Any truthy value (a user object, `true`) lets the request through.
- **Falsy, or a throw, answers 401** `AUTHENTICATION_REQUIRED` with the message `Not authorized.`. The reason for a throw stays on your server, and the API is never called.

```ts
// app/api/frayme/[...path]/route.ts
import { createFraymeHandler } from '@frayme/api/server';

export const POST = createFraymeHandler({
  // Read headers and cookies only: the handler reads the body after this.
  authorize: async (request) => {
    const user = await getUser(request);
    return user !== null && !user.suspended;
  },
  actionPolicy: 'declared_only',
  maxBodyBytes: 256 * 1024,
});
```

The handler does not rate-limit. This route spends your quota, so limit each user in `authorize` or in front of the route.

## What the browser may send

The body must be a JSON object sent as `application/json` (parameters such as `charset` and any letter case are fine). Anything else answers 415, which also stops a cross-site HTML form from posting a JSON-shaped body with the user's cookies.

| Field | Forwarded |
| --- | --- |
| `prompt`, `signals`, `mode`, `context`, `max_operations`, `data`, `actions`, `prior_spec`, `action_context` | As sent. |
| `stream` | Never forwarded: it picks the response format (see below). |
| `custom_components` | Only with `allowCustomComponents: true`. |

Any other field answers 400 with `Unknown field "<name>".`, and so do `action_policy` and `metadata`, which are the server's business. The body is capped at `maxBodyBytes` (default 128 KiB), checked against `Content-Length` and again while reading, and a larger body answers 413.

The handler cuts nothing to fit. It forwards the allowed fields as sent, and the API answers 400 when one is over its ceiling: `data` or `prior_spec` over 48,000 characters of JSON, or `action_context` over 16,000. `FraymeScreen`'s `continue` sends neither a `prior_spec` nor an `action_context` (a press composes a fresh screen, with the pressed action's params in `data`), so on that path only `data` is yours to keep under its ceiling.

## The action policy is the server's

The handler sets `action_policy` on every request to its `actionPolicy` option, default `'declared_only'`. With `declared_only`, the server strips every action the request did not declare, so a screen never grows controls you did not ask for. That means the page must declare, in `actions`, every action its controls should fire. Set `actionPolicy: 'open'` only if you want the composer to add actions of its own.

## Streaming and `stream: false`

- **By default the answer streams**, as `text/event-stream` in the API's own event format, with a `: ping` comment every 15 seconds so idle proxies keep the connection open.
- **The handler waits for the first event before it answers.** Until then a failure is a real HTTP status, which the browser client turns into the right error class. After the 200, a failure arrives in the stream as an `error` event.
- **`stream: false` gets the API's JSON envelope**, `{ "success": true, "data": { ... } }`. `compose.create()` sends it. Only an explicit `false` buffers; a missing or non-boolean `stream` streams, as on the API.
- **Every answer carries** `cache-control: no-store` and `x-accel-buffering: no`.
- **When the browser goes away**, by aborting the request or cancelling the response body, the handler aborts the compose upstream.

```ts
// in the browser
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: null, baseURL: '/api/frayme' });

// Streams: the handler answers with the API's own event stream.
const stream = frayme.compose.stream(
  { prompt: 'A receipt for this order', data: { order } },
  { idempotencyKey: `receipt-${order.id}` },
);
const { spec } = await stream.finalSpec();

// Buffered: `stream: false` gets the API's JSON envelope.
const result = await frayme.compose.create({ prompt: 'A receipt for this order', data: { order }, stream: false });
```

## Retries and `Idempotency-Key`

- **The handler never retries upstream.** The browser client already retries the route, and retrying in both places would turn one call into several composes.
- **It forwards the browser's `Idempotency-Key` header** as the API request's key, so a browser retry replays upstream instead of composing, and billing, again. A key must be 1 to 255 printable ASCII characters, or the handler answers 400.
- **The keyless client sends a key by itself** for each logical call while retries are on (the default). Pass `{ idempotencyKey }` to choose your own, as above.

See [Idempotency](../api/idempotency.md) for what a replay returns.

## Status codes

The handler checks, in order: method, `authorize`, content type, `Idempotency-Key`, body size, JSON, fields. Only then does it call the API. Every error body is `{ "success": false, "error": { "message": "...", "code": "..." } }`.

| Status | Code | When |
| --- | --- | --- |
| 200 | | The stream, or the JSON envelope for `stream: false`. |
| 400 | `BAD_REQUEST` | A malformed `Idempotency-Key`, a body that cannot be read, is not JSON or is not an object, or an unknown field. |
| 401 | `AUTHENTICATION_REQUIRED` | `authorize` returned something falsy or threw. |
| 405 | `BAD_REQUEST` | Any method but POST, with `Allow: POST`. Checked before `authorize`. |
| 413 | `BAD_REQUEST` | The body is larger than `maxBodyBytes`. |
| 415 | `BAD_REQUEST` | The body was not sent as `application/json`. |
| 499 | `BAD_REQUEST` | The browser aborted before the first event (or before the buffered result). |
| 500 | `INTERNAL_SERVER_ERROR` | The handler has no key, or the API refused the server's key. |
| 503 | `SERVICE_UNAVAILABLE` | The API could not be reached. |
| The API's | The API's | Any other API error before the first event, such as 429 `RATE_LIMITED` (with `Retry-After`), 403 `FEATURE_LIMIT` or 502 `COMPOSITION_FAILED`. `x-request-id` is passed on. |

Messages are forwarded only when they came from the API. A failure raised inside your server gets a fixed message, so nothing about your server leaks to the browser.

## The server key never reaches the browser

The key travels only in the upstream `Authorization` header. It is never written into a response.

When the API answers 401, or 403 for any code but `FEATURE_LIMIT`, the problem is your server's key (missing, revoked or without the scope), not the user's session. A 401 would read as "signed out" in the browser, so the handler answers 500 `INTERNAL_SERVER_ERROR` with `The compose proxy is not configured.` instead (as an in-band `error` event once the stream has started), and logs the API's code and message with `console.error`, prefixed `[frayme] compose proxy`. `FEATURE_LIMIT` is about the request itself, so it passes through as a 403.

## Custom components

A browser cannot send `custom_components` unless you set `allowCustomComponents: true`. Turn it on when your page composes with manifests it renders through `createCustomComponents`. See [Custom components](custom-components.md).

## Other runtimes

The handler is a plain `(request: Request) => Promise<Response>`, so it mounts in any server whose handlers take a standard `Request`. For example, a default export with a `fetch` method:

```ts
// server.ts
import { createFraymeHandler } from '@frayme/api/server';

const frayme = createFraymeHandler({ authorize: getUser });

export default {
  fetch(request: Request): Promise<Response> | Response {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/frayme/')) return frayme(request);
    return new Response('Not found', { status: 404 });
  },
};
```

Where `process.env` does not exist, pass the key through your own client. Here `env` stands for your platform's secret binding:

```ts
import { Frayme } from '@frayme/api';
import { createFraymeHandler } from '@frayme/api/server';

const frayme = createFraymeHandler({
  authorize: getUser,
  client: new Frayme({ apiKey: env.FRAYME_API_KEY }),
});
```

## Next steps

- [Chatless screens](chatless-screens.md): `<FraymeScreen>` on top of this route
- [`@frayme/api/server`](../sdk/api-server.md): every option and response in one place
- [Authentication](../getting-started/authentication.md): keys, the browser guard and keyless proxy mode
