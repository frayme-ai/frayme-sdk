# Authentication

Every Frayme API request authenticates with a bearer API key. Here's how keys work and how to keep them out of the browser.

{% hint style="info" %}
Keys are created and managed in your Frayme dashboard at [frayme.ai](https://frayme.ai).
{% endhint %}

## API keys

Keys look like `fr_live_…`. There is one key type, used everywhere from local development to production. Every validated generation counts against your plan, whichever key made the call.

The full key is shown once at creation. Frayme stores only a hash. If you lose a key, mint a new one.

## Sending the key

Pass it as a standard bearer token:

```bash
curl https://api.frayme.ai/v1/me \
  -H "Authorization: Bearer fr_live_..."
```

`GET /v1/me` is the "whoami" endpoint, the fastest way to verify a key works:

```json
{
  "success": true,
  "data": {
    "workspace": { "id": "…", "name": "Acme Inc", "slug": "acme-inc" },
    "plan": {
      "tierKey": "starter",
      "monthlyGenerations": 12000,
      "rateLimitPerMin": …,
      "generationsRemaining": 11730
    }
  }
}
```

`rateLimitPerMin` is your plan's per-key burst limit in requests per minute. The API is the source of truth for it: read it from the response, not from these docs. See [rate limits](../api/rate-limits.md).

With the SDK, the client reads `FRAYME_API_KEY` from the environment by default:

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme(); // uses process.env.FRAYME_API_KEY
// or explicitly:
const frayme2 = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const me = await frayme.me();
console.log(me.plan.generationsRemaining);
```

## The browser guard

Constructing a `Frayme` client with an API key in a browser **throws**. A key shipped to the browser is public: anyone can read it from your bundle or network tab and spend your quota.

```ts
// ❌ In a browser this throws at construction time:
new Frayme({ apiKey: 'fr_live_...' });
```

There is an escape hatch, `dangerouslyAllowBrowser: true`, intended only for local experiments on your own machine. Don't ship it. The supported pattern for browser apps is keyless proxy mode.

## Keyless proxy mode

Pass `apiKey: null` and point `baseURL` at a route on **your** server that holds the key:

```ts
// browser: no key anywhere in the client bundle
const frayme = new Frayme({ apiKey: null, baseURL: '/api/frayme' });
```

The client then sends every request to `${baseURL}/v1/...`, and a route of yours forwards it upstream with the real key attached. `createFraymeHandler` from `@frayme/api/server` is that route, ready-made:

```ts
// app/api/frayme/[...path]/route.ts (Next.js App Router)
import { createFraymeHandler } from '@frayme/api/server';

// `getUser` is your own session check: this route spends your quota.
export const POST = createFraymeHandler({ authorize: getUser });
```

Streaming, restarts, typed errors and retries work in proxy mode exactly as they do against the API, because the handler answers in the API's own stream and error formats.

What the handler does for you:

- **Authenticates your users.** `authorize` runs before the body is read or the API is called, and a falsy result answers 401. An open proxy is an open wallet.
- **Proxies compose only.** Any method but POST answers 405, so browsers cannot read `/v1/me` through it, and only compose request fields are accepted.
- **Keeps the policy on the server.** It sets `action_policy` itself and caps the request body.
- **Keeps the key private.** If the API rejects your server's key, the browser sees a 500, not a 401 or 403, and your server log says why.

Rate limiting stays yours: limit each user so one visitor can't drain your monthly generations.

To write your own proxy instead, pass the SSE stream through untouched and never let the browser choose `action_policy`. See [Server handler](../guides/server-handler.md) for the options, status codes and a non-Next.js example.

## Key safety

- **Keep keys in environment variables** (`.env.local`, your host's secret store), and never in source control, client bundles, or logs.
- **One key per environment.** Separate keys for local, CI, staging, and production make rotation painless and leaks traceable.
- **Rotate immediately on suspicion.** Mint a replacement in the dashboard, deploy it, then revoke the old key.

## Auth errors

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `AUTHENTICATION_REQUIRED` | Missing, malformed, or revoked key |
| 403 | `FORBIDDEN` | The key is valid but not allowed to do this |

Branch on the `code` field, not the status. The SDK raises these as typed errors (`AuthenticationError`, etc.) with `.status`, `.code`, and `.requestId`. Include `requestId` when contacting support.
