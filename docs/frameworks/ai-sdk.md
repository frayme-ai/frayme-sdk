# Vercel AI SDK

Add live, interactive UI to an AI SDK 6 chat: the server bridges a Frayme compose stream into `data-spec` message parts, and the client renders them with one component.

## How it fits

The AI SDK integration has two halves:

- **Server** — your agent calls the `frayme_compose` tool. Instead of returning the spec as model-visible text, the tool streams it to the browser as `data-spec` parts via `composeStreamToDataParts` (from `@frayme/runtime` — the server-safe root entrypoint).
- **Client** — `<FraymeMessageRenderer />` (from `@frayme/runtime/ai-sdk`) reads the `data-spec` parts off any `useChat` message and renders the spec progressively as it streams.

The tool definition comes from `@frayme/api/tools`. Its schema is Zod v4 (Standard Schema), so AI SDK 6's `tool()` accepts `inputSchema` directly — no conversion.

```bash
npm i @frayme/api @frayme/runtime ai @ai-sdk/react
```

## Server: the chat route

```ts
// app/api/chat/route.ts
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
} from 'ai';
import Frayme from '@frayme/api';
import { composeToolDefinition } from '@frayme/api/tools';
import { composeStreamToDataParts } from '@frayme/runtime';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: 'your-provider/your-model', // any AI SDK model — your agent, your choice
        messages: convertToModelMessages(messages),
        stopWhen: stepCountIs(5),
        tools: {
          frayme_compose: tool({
            description: composeToolDefinition.description,
            inputSchema: composeToolDefinition.inputSchema,
            execute: async (input) => {
              // Stream the spec to the CLIENT as data parts — out-of-band,
              // never as model-visible text.
              const composeStream = frayme.compose.stream(input);
              for await (const part of composeStreamToDataParts(composeStream)) {
                writer.write({ type: 'data-spec', data: part });
              }
              const { generationId, model } = await composeStream.finalSpec();
              // The model only needs the correlation handle.
              return { generation_id: generationId, model, rendered: true };
            },
          }),
        },
      });
      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

`composeStreamToDataParts` maps the compose stream onto json-render's data-part protocol:

| Compose event | Data part | Client effect |
| --- | --- | --- |
| `op` | `{ type: 'patch', patch }` | progressive render |
| `compose.restarted` | `{ type: 'flat', spec: {} }` | discard everything rendered so far |
| `compose.completed` | `{ type: 'flat', spec }` | the validated final commit |

The restart-discard contract is handled for you: a `flat` part replaces the whole snapshot, so a failed attempt can never leave stale UI on screen.

## Client: render messages

```tsx
// app/page.tsx
'use client';
import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  FraymeMessageRenderer,
  createDynamicActionForwarder,
} from '@frayme/runtime/ai-sdk';
import '@frayme/runtime/styles.css';

export default function Chat() {
  const { messages, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const forwarder = createDynamicActionForwarder({ sendMessage });

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) =>
            part.type === 'text' ? <p key={i}>{part.text}</p> : null,
          )}
          {/* Renders the data-spec parts this message carries; null if none. */}
          <FraymeMessageRenderer message={message} onDynamicAction={forwarder} />
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} />
      </form>
    </div>
  );
}
```

`FraymeMessageRenderer` defaults to `mode="progressive"` — parts stream in live, and the server already validated the spec before billing. All other [`FraymeRenderer` props](../sdk/runtime.md) (`theme`, `components`, `catalog`, …) pass through.

## Routing actions back

When the user triggers a declared action (a form submit, an approve button), the renderer fires `onDynamicAction`. The forwarder gives you two sinks:

- **`sendMessage`** (shown above) — the action is delivered as the user's next chat message as plain thread text: the humanized **action name** (not the control's label — a `saveBoard` action prints `Save board` whatever the button says), then one bullet per non-blank param (`threadText` from `@frayme/runtime`); the pressed control's own `label` entry (a Button's payload carries one) is left out of the bullets, exactly as the receipt card leaves it out of its table. Then, after a blank line, what the user did **locally** before the press — the gestures the renderer batched into `state._ui` (a Kanban move, a Select change, a sort) and the bound values — as a compact "Also recorded" block: the forwarder calls `threadState(event.state, { exclude: { elementId: event.element_id, verb: event.event } })`, so the pressed control's own entry is left out. The agent reads all three channels — name, params, state — from one message; the receipt card still shows no state. For a `saveBoard` action fired by a "Save changes" button after one card move:

  ```text
  Save board

  Also recorded
  - Board · move: Fix login bug, To do → In progress
  - Region · change: EU
  - Board: 3 items
  ```

  The block is the current mirror, not the unsent delta: `state._ui` keeps one entry per control for the session, so a gesture reappears under every later press until that control is touched again; only a bare press (`{ label }`, or `{ label }` plus `index` / `href`) is recognised as already sent. A record array — a board, a table's rows — is counted (`3 items`) at any depth, never listed.

  `includeState: false` sends the name + params text alone — exactly `threadText(action, params)` minus the control's own label, e.g. `Approve refund` / `- Order ID: 4821`. (The earlier default, `approveRefund: {"orderId":"4821"}`, is gone; a host whose agent parses it can keep it with `format: (a, p) => Object.keys(p).length ? `${a}: ${JSON.stringify(p)}` : a`.) Pass `format(action, params, event)` to replace the whole text — it receives the params as dispatched plus the full event, so it can head its text with `event.label` and call `threadState(event.state, { exclude: { elementId: event.element_id, verb: event.event } })` where it wants the state to land. Simple, but lossy: only what you print survives (`event`, `element_id`, `generation_id`, `label`, `description` do not).

- **`onAction`** (preferred) — receives the full enriched event `{ action, event, params, state, generation_id, element_id, label, description }`, losslessly. Wire it to the `frayme_action` round-trip tool so the interaction recomposes the UI in context:

```ts
import { createActionTool } from '@frayme/api/tools';

const actionTool = createActionTool(frayme); // register alongside frayme_compose

// client:
const forwarder = createDynamicActionForwarder({
  onAction: (event) => sendMessage({ text: `__frayme_action__:${JSON.stringify(event)}` }),
});
```

{% hint style="info" %}
`useChat().addToolResult` is not a valid sink here: it resolves an *agent-initiated* tool call, and a user click has no pending call. Use `onAction` or `sendMessage`.
{% endhint %}

### Show the receipt in the thread

When a control fires a declared action, show the press as a card in the thread — the control's label (verbatim), the action's description, and a table of the params, themed like the rendered UI beside it. Keep the event you forwarded and render it with `FraymeActionReceipt`:

```tsx
import { useState } from 'react';
import { FraymeActionReceipt, type DynamicActionEvent } from '@frayme/runtime/react';
import { createDynamicActionForwarder } from '@frayme/runtime/ai-sdk';

const [receipts, setReceipts] = useState<{ id: number; event: DynamicActionEvent }[]>([]);
const forwarder = createDynamicActionForwarder({
  onAction: (event) => {
    setReceipts((r) => [...r, { id: r.length, event }]); // a stable key per press
    return sendMessage({ text: `__frayme_action__:${JSON.stringify(event)}` });
  },
});

// in the thread:
{receipts.map(({ id, event }) => <FraymeActionReceipt key={id} event={event} />)}
```

`event.description` comes from the host's declaration — pass the same `ActionDecl[]` you sent to compose as `<FraymeMessageRenderer actionContract={actions} />`, or let the server-stamped `spec.actions[name].description` fill it. The card omits the line when neither exists. State stays off the card (`showState` opts in, collapsed).

## Next steps

- [@frayme/api reference](../sdk/api.md) — client options, streaming surface, errors
- [@frayme/runtime reference](../sdk/runtime.md) — renderer props, theming
- [AG-UI](ag-ui.md) — the same loop over the AG-UI protocol instead of AI SDK data parts
