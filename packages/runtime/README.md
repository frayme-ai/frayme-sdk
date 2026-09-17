# @frayme/runtime

Render [Frayme](https://frayme.ai)-generated UI specs as live, interactive React, with transport adapters for the Vercel AI SDK and AG-UI. React 19.

```bash
npm i @frayme/runtime @frayme/api
```

```tsx
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer spec={spec} onDynamicAction={(e) => sendToAgent(e)} />
```

## Why a runtime

A Frayme spec is JSON, not pixels. The runtime turns it into working UI and (the important part) **decides what happens when users interact**: most interactions (typing, tabs, toggles, state-bound visibility) resolve **locally in the browser at zero cost and zero latency**; only spec-bound named actions (form submits, "regenerate") reach `onDynamicAction`, where your agent takes over.

- **Default registry for the full catalog**: 189 components (forms, tables, dialogs, charts, layout primitives…), themeable via `--frayme-*` CSS variables; override any component via the `components` prop.
- **Validation gate**: strict catalog validation for at-rest specs; progressive mode for streaming, where the registry whitelist + inert fallback is the safety boundary.
- **`compose.restarted` done right**: `useFraymeCompose` discards snapshots AND remounts client state when the API restarts an attempt; you just pass `restartKey` through.
- **Safe by construction**: specs are data, components are a whitelist, unknown types render an inert placeholder. No eval, no raw HTML.

## Which controls reach your agent

A **press** dispatches a declared action out of the renderer: a Button (also IconButton, Fab, and a Confirmation's verdict), a Form's submit, any declared action on a DataTable, and a **row/bulk action button** on any component that draws one (DataTable, KanbanBoard, KanbanCard). Every other component's declared action (a Select, a Switch, a Kanban move, a ButtonGroup pick, a PromptInput send) stays local: the interaction is written to state under `/_ui/<elementId>/<verb>` and the next press carries it inside `event.state`. Batch what the user did; send it once.

- **`live: true`** on a binding is the per-action opt-out; it fires on every change, with no submit step.
- **`dynamicActionTypes`** widens the carrier list per renderer: `dynamicActionTypes={[...DEFAULT_DYNAMIC_ACTION_TYPES, 'KanbanBoard']}`. The prop replaces the default, so spread it in.
- A binding's `onSuccess` / `onError` chain gets the same decision as its trigger. A `watch` handler that names a declared action stays local (nothing pressed it).
- A denied dispatch is silent and inert: no error, no invalid spec, no confirm modal, no disabled control, no frozen fields.
- `event.element_id` names the element that fired (the Form, not its submit Button; the table, not the row).
- A text-only host hears the batch too: `createDynamicActionForwarder`'s default `sendMessage` text appends a compact "Also recorded" summary of `event.state` (`threadState`, server-safe root) under the name + params; `includeState: false` turns it off.

## Entrypoints

| Import | What |
|---|---|
| `@frayme/runtime/react` | `<FraymeRenderer/>`, `<FraymeResult/>` (one Frayme tool result in your chat), `<FraymeScreen/>` / `useFraymeScreen` (a screen with no chat), `<FraymeProvider/>` (`endpoint`, `theme`, `scheme`), `useFraymeCompose`, `useColorScheme`, `defaultRegistry` |
| `@frayme/runtime/ai-sdk` | `fraymePart()` and `pressMessage()` (for the tools from `@frayme/api/ai-sdk`), `<FraymeMessageRenderer message={m}/>` (renders `data-spec` parts from `useChat` messages), `createDynamicActionForwarder` |
| `@frayme/runtime/ag-ui` | `useFraymeAgUiSpec()`, `<FraymeAgUiRenderer/>` (specs arrive as `frayme:spec` custom events), `createAgUiActionForwarder` (presses go back as `frayme:action` payloads) |
| `@frayme/runtime` | server-safe: `composeStreamToDataParts()` (route-handler bridge), `SPEC_DATA_PART_TYPE`, `validateFraymeSpec()`, theme tokens and `resolveTheme()` / `isThemePair()` |
| `@frayme/runtime/styles.css` | the default stylesheet |

## AI SDK chat with the Frayme tools

On the server, `fraymeTools({ messages })` from `@frayme/api/ai-sdk` gives your agent `frayme_compose` and `frayme_action`. On the client, draw each Frayme part with `<FraymeResult/>`:

```tsx
// app/page.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { fraymePart, pressMessage } from '@frayme/runtime/ai-sdk';
import { FraymeResult } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

export default function Page() {
  const { messages, sendMessage, status } = useChat();
  const busy = status === 'submitted' || status === 'streaming';
  return (
    <main>
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) => {
            const frayme = fraymePart(part, message);
            if (frayme) {
              return (
                <FraymeResult
                  key={i}
                  {...frayme}
                  scheme="system"
                  interactive={!busy}
                  onPress={(e) => sendMessage(pressMessage(e))}
                />
              );
            }
            return part.type === 'text' ? <p key={i}>{part.text}</p> : null;
          })}
        </div>
      ))}
    </main>
  );
}
```

What `FraymeResult` draws:

- While the compose streams, the live snapshot. It takes typed input but no presses.
- Once the compose completes, the validated screen.
- A notice when the compose fails or doesn't finish.
- The receipt card for a press.
- Nothing for a refused call.

`interactive={!busy}` keeps the finished screen from sending a press while the agent is still answering. `fraymePart` hides refusals, and errors the model already retried in the same message. `pressMessage` sends the press as the user's next message, with the full event in `metadata.frayme`. On the server, keep `{ tools }` on `convertToModelMessages(messages, { tools })`.

## A screen with no chat

```tsx
// app/orders/page.tsx
'use client';
import { FraymeProvider, FraymeScreen } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

export default function Orders({ orders }: { orders: Order[] }) {
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

`endpoint` is your own route holding the API key, typically `createFraymeHandler` from `@frayme/api/server` in `app/api/frayme/[...path]/route.ts`. The screen recomposes when its props change by value. The handle offers `edit`, `continue`, `retry` and `abort`.

## Light and dark

Every `theme` prop takes one token set or a `{ light, dark }` pair, and `scheme` (`'light'`, `'dark'` or `'system'`) picks the mode. For the resolved mode, `useColorScheme(scheme)` returns it, and `resolveTheme(theme, mode)` returns the matching token set. `accent` colors every interactive state at once.

## AI SDK data parts by hand

If you compose in your own tool instead, bridge the stream into `data-spec` parts:

```ts
// app/api/chat/route.ts (bridge the tool's stream into data parts)
import { composeStreamToDataParts } from '@frayme/runtime';
for await (const part of composeStreamToDataParts(stream)) {
  writer.write({ type: 'data-spec', data: part });
}
```

```tsx
// client: render any message that carries a spec
import { FraymeMessageRenderer } from '@frayme/runtime/ai-sdk';
<FraymeMessageRenderer message={message} onDynamicAction={forwarder} />
```

Runnable app: the [quickstart](https://docs.frayme.ai/getting-started/quickstart) builds one from an empty Next.js project. Live demos: [frayme.ai/examples](https://frayme.ai/examples).

MIT © Frayme Ltd
