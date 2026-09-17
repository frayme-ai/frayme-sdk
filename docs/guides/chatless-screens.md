# Chatless screens

A chatless screen is a composed UI with no chat around it: your component's props are the compose request, and a server route of yours holds the API key.

## How it fits

- **In the browser**, `<FraymeProvider endpoint="/api/frayme">` builds a keyless client (`new Frayme({ apiKey: null, baseURL: endpoint })`), so no key ships in your bundle.
- **On your server**, a route running [`createFraymeHandler`](server-handler.md) checks the user, adds the key and forwards the request to `https://api.frayme.ai`.
- **No agent is involved.** The screen composes straight from its props, and your code decides what a press does. When an agent should decide, use chat mode instead: see [Vercel AI SDK](../frameworks/ai-sdk.md).

```bash
npm i @frayme/api @frayme/runtime
```

## 1. The server route

The keyless client posts to `<endpoint>/v1/compose`, so in Next.js the handler lives in a catch-all route under the endpoint. The handler ignores the path.

```ts
// app/api/frayme/[...path]/route.ts
import { createFraymeHandler } from '@frayme/api/server';

export const POST = createFraymeHandler({ authorize: getUser });
```

`getUser` stands for your own session check: return something truthy for a signed-in user. The route reads `FRAYME_API_KEY` from the environment. [Server handler](server-handler.md) covers every option and status code.

## 2. The screen

```tsx
// app/orders/orders-screen.tsx
'use client';
import { FraymeProvider, FraymeScreen } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

export function OrdersScreen({ orders }: { orders: Order[] }) {
  return (
    <FraymeProvider endpoint="/api/frayme" scheme="system">
      <FraymeScreen
        prompt="The open orders, newest first, with a Refund button per row"
        data={{ orders }}
        actions={[
          {
            name: 'refundOrder',
            role: 'Refund',
            params: { type: 'object', properties: { orderId: { type: 'string' } }, required: ['orderId'] },
          },
        ]}
        onAction={(event, screen) => screen.continue(event)}
      />
    </FraymeProvider>
  );
}
```

Render it from a page with the facts it shows:

```tsx
// app/orders/page.tsx
import { OrdersScreen } from './orders-screen';

export default async function OrdersPage() {
  const orders = await getOpenOrders();
  return <OrdersScreen orders={orders} />;
}
```

| Prop | What it does |
| --- | --- |
| `prompt` | What the screen should be. Required. |
| `data` | Facts the screen shows verbatim. |
| `actions` | The actions the screen's controls fire. The server handler keeps only declared actions, so declare every one the screen needs. |
| `signals` | Steering, as on [compose](../api/compose.md#steering-with-signals). |
| `context` | `theme` (`'light'` or `'dark'`) and `framework_hint`, as on compose. |
| `client` | A client of your own. Defaults to the provider's, including the one built from `endpoint`. |
| `onAction` | `(event, screen) => void \| Promise<void>`: a press on the screen, with the handle that moves it on. |
| `fallback` | Shown until the first part of the screen arrives. Default: nothing. |
| `theme`, `scheme`, `className` | Per-screen theming and a class. `theme` and `scheme` fall back to the provider's. |

## The props are the request

- **It composes on mount**, and again whenever `prompt`, `data`, `actions`, `signals` or `context` change by value. The comparison is deep, with object keys sorted, so an inline object literal does not recompose on every render, but a changed value does.
- **A prop change is a fresh create.** The renderer remounts, so no state from the previous screen leaks into the new one, and a compose still in flight is aborted. Unmounting aborts it too.
- **`status` is `streaming` from the moment the props change**, before the request is sent.

## Moving the screen on

The second argument of `onAction` is the screen's handle:

| Method | What it sends |
| --- | --- |
| `edit(prompt, extra?)` | `mode: 'edit'` with the last complete screen as `prior_spec`: the same screen, changed. With no finished screen there is nothing to edit, so it sends a fresh create. |
| `continue(event, prompt?, extra?)` | `mode: 'continue_journey'`, the press as `action_context` and the last complete screen as `prior_spec`: the next step. Without `prompt` (or `extra.prompt`), it asks the composer to continue after the named action. |
| `retry()` | The last request again, unchanged. It does nothing unless `status` is `error`. |
| `abort()` | Stops the compose in flight, if any. |

`edit` and `continue` resend the props' `data`, `actions`, `signals` and `context`, and `extra` overrides any of them. The method sets `mode`, `prior_spec` and `action_context` itself and ignores those keys (and `stream`) in `extra`. An action left out of the request comes back unwired. `extra` goes through your server handler, so it can carry only the [fields the handler allows](server-handler.md#what-the-browser-may-send).

A press usually does real work first. Your code runs it, then asks for the next screen with the fresh facts:

```tsx
<FraymeScreen
  prompt="The open orders, newest first, with a Refund button per row"
  data={{ orders }}
  actions={[
    {
      name: 'refundOrder',
      role: 'Refund',
      params: { type: 'object', properties: { orderId: { type: 'string' } }, required: ['orderId'] },
    },
  ]}
  onAction={async (event, screen) => {
    if (event.action !== 'refundOrder') return;
    // Your own server call does the work; Frayme only draws the next screen.
    const result = await refundOrder(String(event.params.orderId));
    await screen.continue(event, 'Confirm the refund, then list the orders still open', {
      data: { refund: result.refund, orders: result.orders },
    });
  }}
  fallback={<p>Loading your orders…</p>}
/>;
```

`refundOrder` stands for your own server call. Because `data` changes through `extra`, not through the props, the screen continues instead of recomposing from scratch.

`edit` and `continue` keep the renderer mounted, so what the user entered merges into the next screen the same way the renderer merges an edit patch.

### Only a complete screen is ever a `prior_spec`

A snapshot taken mid-stream, or one left behind by `abort()`, can point at elements that never arrived, and the server rejects it. So a follow-up always starts from the last screen that finished. A fresh create (a prop change) clears that screen.

### While a follow-up runs, and when it fails

- **The earlier screen stays up** until the follow-up's first operation arrives, so the page never flashes blank between two screens.
- **If the follow-up fails**, that earlier screen stays up under an error notice showing the error's message.
- **The notice offers "Try again"** when sending the same request again could help: a lost connection, a timeout, a rate limit or a server-side failure. A rejected request (a bad body, no access) or an exhausted quota (`QUOTA_EXCEEDED`) fails the same way every time, so for those the notice shows no button.
- **The control the user pressed stays latched**, because the renderer never re-arms a fired control. "Try again", or your own call to `screen.retry()`, is the way on.
- **When the server restarts an attempt** (`compose.restarted`), the screen clears and builds again, as it does everywhere else.

## A custom layout: `useFraymeScreen`

`<FraymeScreen>` is `useFraymeScreen` plus a renderer and the notice. Use the hook when you want your own chrome around the screen, your own error UI, or renderer props `<FraymeScreen>` does not take (such as `catalog` for [custom components](custom-components.md)).

```tsx
// app/orders/orders-panel.tsx
'use client';
import { FraymeRenderer, useFraymeScreen } from '@frayme/runtime/react';

export function OrdersPanel({ orders }: { orders: Order[] }) {
  const screen = useFraymeScreen({
    prompt: 'The open orders, newest first, with a Refund button per row',
    data: { orders },
    actions: [
      {
        name: 'refundOrder',
        role: 'Refund',
        params: { type: 'object', properties: { orderId: { type: 'string' } }, required: ['orderId'] },
      },
    ],
  });
  const busy = screen.status === 'streaming' || screen.status === 'restarting';

  return (
    <section>
      <header>
        <h2>Open orders</h2>
        <button disabled={busy || !screen.spec} onClick={() => screen.edit('Group the orders by status')}>
          Group by status
        </button>
        {busy && <button onClick={screen.abort}>Stop</button>}
      </header>

      {screen.status === 'error' && (
        <p role="alert">
          {screen.error?.message ?? 'The screen could not be composed.'}{' '}
          <button onClick={() => screen.retry()}>Try again</button>
        </p>
      )}

      <FraymeRenderer
        key={screen.screenKey}
        spec={screen.spec}
        mode={screen.status === 'complete' || screen.status === 'error' ? 'strict' : 'progressive'}
        loading={busy}
        restartKey={screen.restartKey}
        onDynamicAction={(event) => screen.continue(event)}
      />
    </section>
  );
}
```

The hook takes `prompt`, `data`, `actions`, `signals`, `context` and `client`, with the same meaning as the props above. It returns the handle plus the state to render:

| Field | Type | Meaning |
| --- | --- | --- |
| `spec` | `Spec \| null` | What to show: the live snapshot while streaming, the validated spec once complete, and the earlier screen while a follow-up has not produced its first operation (or after it failed). |
| `status` | `'idle' \| 'streaming' \| 'restarting' \| 'complete' \| 'error'` | `streaming` from the moment the props change. |
| `generationId` | `string \| undefined` | The generation `spec` belongs to. |
| `error` | `FraymeError \| undefined` | The failure, when `status` is `error`. |
| `model` | `string \| undefined` | The model label of the current attempt. Treat it as opaque. |
| `restartKey` | `number` | Pass to `<FraymeRenderer restartKey>`: it changes when the server restarts an attempt. |
| `screenKey` | `number` | Pass as the renderer's React `key`: it changes on every prop-driven fresh create. |
| `edit`, `continue`, `retry`, `abort` | functions | The handle described above. |

Render in `strict` mode when the screen is complete or failed (then `spec` is a finished screen or nothing) and in `progressive` mode otherwise. With no client from the options or a provider, the hook throws during render, so an error boundary shows the setup error.

## Theming

Set `scheme` and `theme` on the provider and every screen beneath it follows:

```tsx
// app/orders/layout.tsx
'use client';
import type { ReactNode } from 'react';
import { FraymeProvider } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <FraymeProvider
      endpoint="/api/frayme"
      scheme="system"
      theme={{
        light: { primary: '#4f46e5', accent: '#4f46e5' },
        dark: { primary: '#a5b4fc', primaryForeground: '#1e1b4b', accent: '#a5b4fc' },
      }}
    >
      {children}
    </FraymeProvider>
  );
}
```

- **`scheme`** is `'light'` or `'dark'` to force a mode, or `'system'` to follow the OS setting as it changes.
- **`theme`** is one token set for both modes, or a `{ light, dark }` pair; the resolved mode picks its half. A pair with no `scheme` anywhere follows the OS.
- **`theme` and `scheme` on `<FraymeScreen>`** override the provider's for that screen.
- **`context={{ theme: 'dark' }}`** is different: it tells the composer which mode the screen is drawn in. Leave it out when the mode follows the OS.

The token names are in [Theming](theming.md).

## Next steps

- [Server handler](server-handler.md): the route every chatless screen needs
- [Edits and journeys](edits-and-journeys.md): what `edit` and `continue_journey` do on the server
- [`@frayme/runtime`](../sdk/runtime.md): the renderer's full props
