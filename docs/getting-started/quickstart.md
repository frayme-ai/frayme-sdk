# Quickstart

Go from an empty Next.js app to a streaming, interactive Frayme UI in under five minutes.

## What you'll build

A page with one button. Click it, and a signup form streams in live — composed by Frayme, rendered by `@frayme/runtime`, with a submit action wired back to your code.

**Prerequisites:** Node ≥ 20.19, a Next.js project (App Router, React 19), and a Frayme API key.

{% hint style="info" %}
Get an API key from your Frayme dashboard at [frayme.ai](https://frayme.ai) — the code below is exactly what runs against the live API.
{% endhint %}

## 1. Install

{% tabs %}
{% tab title="npm" %}
```bash
npm i @frayme/api @frayme/runtime
```
{% endtab %}
{% tab title="pnpm" %}
```bash
pnpm add @frayme/api @frayme/runtime
```
{% endtab %}
{% tab title="bun" %}
```bash
bun add @frayme/api @frayme/runtime
```
{% endtab %}
{% endtabs %}

## 2. Add your API key

```bash
# .env.local
FRAYME_API_KEY=fr_live_...
```

Never expose this in the browser — the next step keeps it server-side.

## 3. Create the server route

The browser never holds your key. Instead, a tiny route in your app forwards compose calls to Frayme:

```ts
// app/api/frayme/[...path]/route.ts
const FRAYME_API = 'https://api.frayme.ai';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const upstream = await fetch(`${FRAYME_API}/${path.join('/')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FRAYME_API_KEY}`,
    },
    body: await req.text(),
  });

  // Pass the response straight through — including the live SSE stream.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    },
  });
}
```

This is [keyless proxy mode](authentication.md#keyless-proxy-mode): the `@frayme/api` client in the browser points at `/api/frayme`, and only this route knows the key. Add your own auth check here before forwarding — this route spends your quota.

## 4. Compose and render

```tsx
// app/page.tsx
'use client';

import { useMemo } from 'react';
import Frayme from '@frayme/api';
import { FraymeRenderer, useFraymeCompose } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

export default function Page() {
  // Keyless proxy mode: no API key in the browser.
  const client = useMemo(
    () => new Frayme({ apiKey: null, baseURL: '/api/frayme' }),
    [],
  );
  const { compose, spec, status, restartKey } = useFraymeCompose(client);
  const busy = status === 'streaming' || status === 'restarting';

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <button
        disabled={busy}
        onClick={() =>
          compose({
            prompt:
              'A signup form: full name, work email, and team size, ' +
              'with a submit button bound to a create_account action',
            signals: { data_shape: ['form'], density: 'compact' },
          })
        }
      >
        {busy ? 'Composing…' : 'Compose a signup form'}
      </button>

      <FraymeRenderer
        spec={spec}
        mode="progressive" // render streaming snapshots as they arrive
        restartKey={restartKey} // resets client state if the API restarts an attempt
        loading={busy}
        onDynamicAction={(event) => {
          // The one round-trip: a spec-declared action reaching your code.
          console.log('action:', event.action, 'state:', event.state);
        }}
      />
    </main>
  );
}
```

Three things are doing the heavy lifting:

- **`useFraymeCompose`** streams the composition and keeps a live `spec` snapshot. If Frayme restarts a weak attempt on a stronger model, the hook clears the snapshot and bumps `restartKey` for you.
- **`<FraymeRenderer mode="progressive">`** renders partial specs as they stream — the UI builds up element by element.
- **`onDynamicAction`** receives only spec-declared actions. Typing in the fields never reaches your code — that state stays local in the renderer.

## 5. Run it

```bash
npm run dev
```

Open `http://localhost:3000` and click the button.

**You should see:** the form streams in progressively over a few seconds — a card appears first, then a heading, then the name, email, and team-size fields, then the submit button. Typing in the inputs is instant (no network traffic — that's local state). When you fill the form and press submit, your browser console logs `action: create_account` with a `state` object containing exactly what you typed.

## Where to go next

- [Your first generation](first-generation.md) — what actually went over the wire just now
- [Authentication](authentication.md) — key types, the browser guard, and proxy hardening
- Pass real `data` and declared `actions` to ground the UI in your domain — see the API reference for the full compose request
