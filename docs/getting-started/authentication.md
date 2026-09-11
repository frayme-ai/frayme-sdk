# Authentication

Every Frayme API request authenticates with a bearer API key — here's how keys work and how to keep them out of the browser.

{% hint style="info" %}
Keys are created and managed in your Frayme dashboard at [frayme.ai](https://frayme.ai).
{% endhint %}

## API keys

Keys look like `fr_live_…` — one key type, used everywhere from local development to production. Every validated generation counts against your plan, whichever key made the call.

The full key is shown once at creation. Frayme stores only a hash — if you lose a key, mint a new one.

## Sending the key

Pass it as a standard bearer token:

```bash
curl https://api.frayme.ai/v1/me \
  -H "Authorization: Bearer fr_live_..."
```

`GET /v1/me` is the "whoami" endpoint — the fastest way to verify a key works:

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

`rateLimitPerMin` is your plan's per-key burst limit in requests per minute. The API is the source of truth for it — read it from the response, not from these docs. See [rate limits](../api/rate-limits.md).

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

Constructing a `Frayme` client with an API key in a browser **throws**. A key shipped to the browser is public — anyone can read it from your bundle or network tab and spend your quota.

```ts
// ❌ In a browser this throws at construction time:
new Frayme({ apiKey: 'fr_live_...' });
```

There is an escape hatch, `dangerouslyAllowBrowser: true`, intended only for local experiments on your own machine. Don't ship it. The supported pattern for browser apps is keyless proxy mode.

## Keyless proxy mode

Pass `apiKey: null` and point `baseURL` at a route on **your** server that holds the key:

```ts
// browser — no key anywhere in the client bundle
const frayme = new Frayme({ apiKey: null, baseURL: '/api/frayme' });
```

The client then sends every request to `${baseURL}/v1/...`, and your route forwards it upstream with the real key attached:

```ts
// app/api/frayme/[...path]/route.ts (Next.js App Router)
const FRAYME_API = 'https://api.frayme.ai';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // TODO: check YOUR user's session here — this route spends your quota.

  const { path } = await params;
  const upstream = await fetch(`${FRAYME_API}/${path.join('/')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FRAYME_API_KEY}`,
    },
    body: await req.text(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    },
  });
}
```

Everything else — streaming, restarts, typed errors, retries — works identically in proxy mode, because the proxy passes the SSE stream through untouched.

Harden the proxy before production:

- **Authenticate your own users** before forwarding. An open proxy is an open wallet.
- **Restrict the path** to `/v1/compose` if you don't want browsers reading `/v1/me`.
- **Rate-limit per user** so one visitor can't drain your monthly generations.

## Key safety

- **Keep keys in environment variables** (`.env.local`, your host's secret store) — never in source control, client bundles, or logs.
- **One key per environment.** Separate keys for local, CI, staging, and production make rotation painless and leaks traceable.
- **Rotate immediately on suspicion.** Mint a replacement in the dashboard, deploy it, then revoke the old key.

## Auth errors

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `AUTHENTICATION_REQUIRED` | Missing, malformed, or revoked key |
| 403 | `FORBIDDEN` | The key is valid but not allowed to do this |

Branch on the `code` field, not the status. The SDK raises these as typed errors (`AuthenticationError`, etc.) with `.status`, `.code`, and `.requestId` — include `requestId` when contacting support.
