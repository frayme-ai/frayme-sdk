# Vercel AI SDK

Add live, interactive screens to an AI SDK 6 chat: spread `fraymeTools()` into your agent's tools, and draw each result in the thread with `FraymeResult`.

## How it fits

Your route keeps the model, the loop and the thread. Frayme adds the tools, and the pieces that draw their results:

- **Server:** `fraymeTools` (from `@frayme/api/ai-sdk`) returns `frayme_compose` and `frayme_action` as AI SDK tools. `frayme_compose` streams the screen as preliminary tool outputs, so the spec rides to the browser inside the tool part. The model reads only `{ generation_id, status, operation_count }`, never the spec.
- **Client:** `fraymePart` (from `@frayme/runtime/ai-sdk`) picks the Frayme parts out of each `useChat` message, and `FraymeResult` (from `@frayme/runtime/react`) draws them: the live screen while it streams, the validated screen when it completes, and a card for each press.
- **Presses:** `pressMessage` turns a press into the user's next message. The model forwards it to `frayme_action`, and the next screen streams back the same way.

```bash
npm i @frayme/api @frayme/runtime ai @ai-sdk/react @ai-sdk/anthropic
```

Set `FRAYME_API_KEY` in the server environment. The tools build their client with `new Frayme()`, which reads it (and `FRAYME_BASE_URL`, when set).

## Server: the chat route

```ts
// app/api/chat/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { fraymeTools } from '@frayme/api/ai-sdk';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const tools = { ...yourTools, ...fraymeTools({ messages }) };
  return streamText({
    model: anthropic('claude-sonnet-5'),
    tools,
    messages: await convertToModelMessages(messages, { tools }),
    stopWhen: stepCountIs(6),
  }).toUIMessageStreamResponse();
}
```

`yourTools` stands for the tools your agent already has. The chat model is yours too: `anthropic('claude-sonnet-5')` is only an example.

{% hint style="info" %}
**Three things every route must do:**

- **Create `fraymeTools` per request**, inside the handler. A set gets one compose per turn, so a set created once at module level spends that compose on the first request and refuses every later one.
- **Pass the UI messages exactly as the client posted them**, metadata included. Each press rides in `metadata.frayme`, so a strict `messageMetadataSchema` must allow a `frayme` key. Converted model messages do not work: they no longer hold the screens or the presses.
- **Always call `convertToModelMessages(messages, { tools })`.** Without `{ tools }`, the AI SDK skips the tools' `toModelOutput`, and every stored screen goes back to the model in full, spec included.
{% endhint %}

`fraymeTools` also takes these options:

- **`client`:** your own `Frayme` instance.
- **`scheme`:** `'light'` or `'dark'`, sent as `context.theme` on every compose.
- **`actionPolicy`:** default `'declared_only'`, so a screen gets no controls beyond the actions declared for it.
- **`snapshotEveryMs`:** default `250`. The AI SDK sends every live snapshot on to the browser, so this window is what limits how many whole-spec snapshots go over the wire.

See [`@frayme/api/ai-sdk`](../sdk/api-ai-sdk.md) for the full reference.

- **Without `messages`,** the tools still compose, but nothing can be read from the chat. `frayme_compose` offers no `edit_of` and refuses `mode: 'edit'`, and every screen is built fresh. `frayme_action` forwards the call as the model wrote it (only cut to the API's size ceilings), so the model must copy the whole event, params and state included.
- **Custom components** are never offered to the model: `fraymeTools` leaves `custom_components` out of the `frayme_compose` schema. If your screens need them, wire your own tool from `@frayme/api/tools` (`createComposeTool`, or the definitions in [Lower level](#lower-level)) and add the manifests in your own code.

## Client: the chat page

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

Your input form stays as it is: it calls `sendMessage({ text })`.

**Why `interactive={!busy}`:** a press sends a message, and a press made while the agent is still answering would start a second request alongside the first. The AI SDK does not queue them. While the agent is answering, the finished screen stays visible but a press does nothing, and it does not latch the control, so the same button works once the agent is done. After an error the screen is live again, so the user can press again.

`fraymePart(part, message)` returns one of three things:

- `{ output, final }` for a `frayme_compose` or `frayme_action` tool part that has an output. `final` is `false` while the output is preliminary.
- `{ press }` for the text part of a user message that `pressMessage` built.
- `null` for anything else, so your own rendering takes over. That includes two Frayme outputs the user should not see: a refusal (`refused: true`, written for the model), and an error the model already retried later in the same message.

Pass the whole message, as the snippet does: `fraymePart` reads its other parts to spot a retried error. Call it before your own text branch: a press message has a text part too, and `fraymePart` claims it so the raw text never shows in the thread.

`FraymeResult` draws what it is handed: the press card, an error notice, the live snapshot, or the final screen under the strict catalog gate. The live snapshot takes typed input, which carries over into the finished screen, but no presses: a press on it does nothing until the screen is final. [Rendering](../guides/rendering.md#fraymeresult-one-result-in-a-chat) lists each case. `scheme="system"` follows the OS; `'light'` and `'dark'` force a mode, and `theme` takes tokens or a `{ light, dark }` pair. To set these once for the whole thread, wrap it in `FraymeProvider` (see [Theming](../guides/theming.md)).

## How a press travels

1. The user presses a control on a screen: a Button, a Form submit, a DataTable row action (see [Which controls reach your agent](../guides/state-and-actions.md#which-controls-reach-your-agent)). If the screen is final and `interactive`, `FraymeResult` calls `onPress` with the full `DynamicActionEvent`.
2. `pressMessage(e)` builds the user's next message: text for the model, and the whole event under `metadata.frayme`. `sendMessage` posts it with the rest of the history.
3. The model reads the text. Its last line is `frayme_action` followed by a short JSON object: the action name, the verb, the element id, the label and the generation id. The model calls `frayme_action` with that object, and adds `prompt`, `data`, `actions` and `signals` for the next screen.
4. `fraymeTools({ messages })` checks the call against the press on the last user message and restores the params and state from its metadata. The page's copy of the event wins over the model's. When the pressed screen finished in this chat, the tool also attaches it as `prior_spec`, then sends a `continue_journey` compose.
5. The next screen streams back as `frayme_action` outputs, and `fraymePart` draws the press itself as a card above it.

The metadata never reaches the model: `convertToModelMessages` sends only the text. The params and state still arrive intact, because step 4 reads them from the metadata.

The press is read leniently, the same way the page draws its card. Only the action name must be valid, a string of 1 to 60 characters. Any other field that does not fit is dropped rather than rejected:

- an `event` over 40 characters;
- an `element_id` or `generation_id` over 120 characters;
- `params` or `state` that is not an object.

A press can also be far larger than the screen it came from: a table's row action carries every row. A request over the API's size ceilings would fail before any model call, the same way every time, so `frayme_action` cuts it to fit instead:

- If the press is over 16,000 characters of JSON, its `state` is left out first, then its `params`. The action name and the ids always stay.
- A pressed screen over 48,000 characters is left out, and the next screen is built from the press alone.

The call's outputs then carry `trimmed` (what was left out), and the model reads the same list with a plain-language `trimmed_note`, so it knows what the next screen was built without.

A press is answered once. If the turn carries on in a new request (after a tool approval, or a tool the client ran) and the reply so far already holds a Frayme result that is not an error, the press counts as answered.

The model's call can be refused before anything is composed:

| Code | When |
| --- | --- |
| `NO_PRESS` | The last user message is not an unanswered press. |
| `PRESS_MISMATCH` | The call names a different action than the press, or a different `generation_id` when both carry one. |
| `PRESS_INVALID` | The pressed control's action name is not 1 to 60 characters. The message tells the model to say the button could not be handled. |

A refusal comes back with `refused: true`. The model reads the reason, the page draws nothing for it, and the turn's compose is handed back so the model can correct its call.

### What the tools guarantee

Messages, metadata and presses all come from the browser, so they are your user's own data, not trusted input. The server validates every spec and every action it receives, whoever sent it. What `fraymeTools` guarantees is narrower: the model cannot write a press, a screen or a `prior_spec`. A press is read only from the latest user message. A screen is read only from the finished output of one of Frayme's own tool calls (`frayme_compose` or `frayme_action`) in an assistant message. A spec the model wrote in a tool input or in text, or one returned by another tool, is never used.

### What the model reads

For a `saveBoard` action fired by a "Save changes" button after one card move, `pressMessage` writes:

```text
Save board

Also recorded
- Board · move: Fix login bug, To do → In progress
- Region · change: EU
- Board: 3 items

frayme_action {"action":"saveBoard","event":"commit","element_id":"save","label":"Save changes","generation_id":"gen_4b8e1c"}
```

- **The press.** The humanized action name (not the control's label: a `saveBoard` action prints `Save board` whatever the button says), then one bullet per non-blank param (`threadText` from `@frayme/runtime`). The pressed control's own `label` entry is left out of the bullets, as the receipt card leaves it out of its table.
- **Also recorded.** After a blank line, what the user did locally before the press: the gestures the renderer batched into `state._ui` (a Kanban move, a Select change, a sort) and the bound values. The block is `threadState(event.state, { exclude: { elementId: event.element_id, verb: event.event } })`, so the pressed control's own entry is left out.
- **The press line.** `frayme_action` and the event without its params and state, for the model to forward.

The "Also recorded" block is the current mirror, not the unsent delta. `state._ui` keeps one entry per control for the session, so a gesture reappears under every later press until that control is touched again. Only a bare press (`{ label }`, or `{ label }` plus `index` / `href`) is recognised as already sent. A record array (a board, a table's rows) is counted (`3 items`) at any depth, never listed.

`pressMessage(e, { includeState: false })` leaves the "Also recorded" block out of the text. `frayme_action` still restores the full state from the metadata.

## Edits and follow-ups with `edit_of`

The model never holds a spec, so it cannot pass `prior_spec`. The `frayme_compose` schema drops that field and takes `edit_of` instead: the `generation_id` of an earlier result. The tool finds that screen's final spec in `messages` and attaches it for you.

```json
{
  "prompt": "Same orders table, one change: add a Carrier column after Status. Keep everything else as it is.",
  "edit_of": "gen_4b8e1c",
  "data": { "carriers": { "A-1": "DHL", "A-2": "UPS" } }
}
```

- **`edit_of` alone** (or with `mode: 'edit'` or `'create'`) changes that screen in place.
- **`edit_of` with `mode: 'continue_journey'`** builds the next step from that screen.

The screen is found only among the finished results of Frayme's own tool calls, so the model cannot hand the tool a spec of its own. An `edit_of` that names no such screen returns `UNKNOWN_SCREEN`, and so does `mode: 'edit'` without `edit_of`. Both are refusals the model can correct. The tool's description teaches the model to use `edit_of`, so your part is to send the full history. `edit_of` is offered only when you pass `messages`.

A screen can also be too large to send (over 48,000 characters of JSON). An edit of it is refused with `SCREEN_TOO_LARGE`, and the message tells the model to leave `edit_of` out and describe the whole new screen. Like the other refusals, it hands the turn back for that second call. A `continue_journey` goes on without it, and the model reads `trimmed: ['prior_spec']` with a note saying so.

If the API rejects the earlier screen, the two modes differ:

- **An edit fails** with the API's error. It never quietly becomes a new screen, so the model cannot report a change that did not happen.
- **A `continue_journey` goes on without the earlier screen,** once. This includes a press, whose pressed screen is sent the same way. The new screen's outputs carry `prior_spec_dropped: true`, and the model reads `prior_screen_dropped: true` with a note that the screen was built from the prompt alone.

See [Edits and journeys](../guides/edits-and-journeys.md) for what an edit preserves.

## One compose per turn

Each `fraymeTools()` call allows one compose, shared by `frayme_compose` and `frayme_action`. A second call in the same turn does not run. It returns the refusal `ONE_COMPOSE_PER_TURN`, whose message tells the model to reply in text and compose the next screen after the user responds. Without that rule, a model could replace a screen before the user has a chance to act on it. The same holds when a turn carries on in a new request (after a tool approval, or a tool the client ran): if the reply so far already holds a Frayme result that is not an error, that turn's compose is spent.

A failed compose hands the turn back only when calling again could succeed:

- **The turn is handed back** after a refusal the model can correct, a request error (`400`, `422`), a server error (`5xx`) or a network failure.
- **The turn stays spent** after a bad key, a plan limit, a rate limit, `CLIENT_ERROR` (for example, no API key) or an abort. Retrying those would only use up the model's steps.

The model reads which case it is in: the error view carries `retryable`, and when it is `false`, a `next` line tells the model to explain what happened to the user instead of calling again. `ONE_COMPOSE_PER_TURN` has no `next` line, because its message already says what to do. The full table is in [Error codes](../sdk/api-ai-sdk.md#error-codes).

## Intents and sources

```ts
import agent from './frayme.agent.json'; // { "intents": [...] }
import data from './frayme.data.json'; // { "orders": [...] }

const tools = { ...yourTools, ...fraymeTools({ intents: agent.intents, sources: data, messages }) };
```

- **`intents`** are your app's own worked `frayme_compose` calls: a layout prompt plus the signals and actions that app uses. With intents, the agent gets a `lookup_intent` tool. It reads the intent that fits, then writes its own compose call with the real data. Intents never reach `/v1/compose`. They are validated when the tools are built, so a malformed intent fails at setup, not inside a model turn.
- **`sources`** are your app's records, as `{ [name]: rows[] }`. With sources, the agent gets a `query_source` tool, and passes the rows it gets back into `data`.

Both are optional. See [Intents and sources](../guides/intents-and-sources.md).

## The receipt card

`fraymePart` turns a press message into `{ press }`, and `FraymeResult` draws it with `FraymeActionReceipt`:

- **Title:** the control's label, verbatim, else the humanized action name.
- **Description:** the `description` you declared on the action (the server stamps it into `spec.actions`), or no line when there is none.
- **Table:** the params, humanized and formatted, themed like the screen beside it.

State stays off the card. `showState` adds it as a collapsed **State** block:

```tsx
<FraymeResult
  key={i}
  {...frayme}
  showState
  interactive={!busy}
  onPress={(e) => sendMessage(pressMessage(e))}
/>;
```

The card is drawn from the stored message, so it comes back when the chat reloads, as long as you keep each message's `metadata`. To draw your own card, check for `press` and pass it to `FraymeActionReceipt`, which takes more options (`as`, `headingLevel`, `omitKeys`, `dataTheme`):

```tsx
// inside message.parts.map((part, i) => { ... })
const frayme = fraymePart(part, message);
if (frayme && 'press' in frayme) {
  return <FraymeActionReceipt key={i} event={frayme.press} as="li" headingLevel={4} />;
}
```

See [FraymeActionReceipt](../sdk/runtime.md#fraymeactionreceipt) for every prop.

{% hint style="info" %}
`useChat().addToolResult` is not a valid sink for a press: it resolves a tool call the agent started, and a user's press has no pending call. Send the press as a message.
{% endhint %}

## Lower level

`fraymeTools` covers most hosts. If you wire the pieces yourself (your own tool definitions, with the spec streamed as `data-spec` parts instead of tool outputs), these are the parts. This is also the path for [custom components](../guides/custom-components.md): add your manifests as `custom_components` to the request your own `execute` sends, and render with `<FraymeMessageRenderer message={message} components={registry} catalog={catalog} />`, where `registry` and `catalog` come from `createCustomComponents`.

- **Server:** `composeStreamToDataParts` (from `@frayme/runtime`, the server-safe root) turns a compose stream into `data-spec` parts. The tool definitions come from `@frayme/api/tools`. `createComposeTool(frayme)` and `createActionTool(frayme)` bind them to a client, non-streaming.
- **Client:** `FraymeMessageRenderer` (from `@frayme/runtime/ai-sdk`) renders the `data-spec` parts of a message, and `createDynamicActionForwarder` routes its presses.

```ts
// app/api/chat/route.ts
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import Frayme, { fitContinuation, type ComposeRequest } from '@frayme/api';
import { actionToolDefinition, composeToolDefinition } from '@frayme/api/tools';
import { composeStreamToDataParts } from '@frayme/runtime';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Stream one compose to the CLIENT as data parts, never as model-visible text.
      const streamScreen = async (request: Omit<ComposeRequest, 'stream'>) => {
        const composeStream = frayme.compose.stream(request);
        for await (const part of composeStreamToDataParts(composeStream)) {
          writer.write({ type: 'data-spec', data: part });
        }
        const { generationId, model } = await composeStream.finalSpec();
        // The model only needs the correlation handle.
        return { generation_id: generationId, model, rendered: true };
      };

      const result = streamText({
        model: 'your-provider/your-model', // any AI SDK model: your agent, your choice
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(5),
        tools: {
          frayme_compose: tool({
            description: composeToolDefinition.description,
            inputSchema: composeToolDefinition.inputSchema,
            execute: (input) => streamScreen(input),
          }),
          frayme_action: tool({
            description: actionToolDefinition.description,
            inputSchema: actionToolDefinition.inputSchema,
            // `label` and `description` are for your thread card; the wire does not take them.
            execute: ({ prompt, data, actions, signals, label, description, ...press }) =>
              streamScreen({
                prompt: prompt ?? `The user pressed "${press.action}". Continue the journey.`,
                mode: 'continue_journey',
                // A big press (a table's rows) is cut to the API's size ceiling: state first, then params.
                action_context: fitContinuation({ action_context: press }).action_context,
                data,
                actions,
                signals,
              }),
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
| `op` | `{ type: 'patch', patch }` | Progressive render. |
| `compose.restarted` | `{ type: 'flat', spec }` with an empty spec | Discards everything rendered so far. |
| `compose.completed` | `{ type: 'flat', spec }` | The validated final commit. |
| The stream fails | `{ type: 'flat', spec }` with an empty spec, then the error is rethrown | Clears the half-built screen. |

A `flat` part replaces the whole snapshot, so a failed attempt never leaves stale UI on screen.

```tsx
// app/page.tsx
'use client';
import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { FraymeMessageRenderer, createDynamicActionForwarder } from '@frayme/runtime/ai-sdk';
import '@frayme/runtime/styles.css';

export default function Chat() {
  const { messages, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const forwarder = createDynamicActionForwarder({ sendMessage });

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) => (part.type === 'text' ? <p key={i}>{part.text}</p> : null))}
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

`FraymeMessageRenderer` defaults to `mode="progressive"`: parts stream in live, and the server validated the spec before billing. All other [`FraymeRenderer` props](../sdk/runtime.md) pass through, including `theme`, `components`, `catalog` and `actionContract`.

The forwarder has two sinks for a press:

- **`sendMessage`** delivers the press as plain text: the [text the model reads](#what-the-model-reads), without the press line. It is lossy: `event`, `element_id`, `generation_id`, `label` and `description` do not survive. `includeState: false` drops the "Also recorded" block. `format(action, params, event)` replaces the whole text: it receives the params as dispatched plus the full event, so it can head its text with `event.label` and place `threadState(...)` where it wants.
- **`onAction`** receives the full event, losslessly. The older way to carry it is a text message the model copies into its `frayme_action` call:

  ```ts
  const forwarder = createDynamicActionForwarder({
    onAction: (event) => sendMessage({ text: `__frayme_action__:${JSON.stringify(event)}` }),
  });
  ```

  `fraymeTools` still reads a `__frayme_action__:` text on the last user message, so a page that sends it keeps working after its route moves to `fraymeTools`. Such a message draws no receipt card, because `fraymePart` reads the press from the metadata. With `fraymeTools` on the server, send `pressMessage(event)` instead.

To show receipts on this path, keep each event you forward and render it with `FraymeActionReceipt`:

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

`event.description` comes from your declaration: pass the same `ActionDecl[]` you sent to compose as `<FraymeMessageRenderer actionContract={actions} />`, or let the server-stamped `spec.actions[name].description` fill it.

## Next steps

- [`@frayme/api/ai-sdk`](../sdk/api-ai-sdk.md): every option, tool input, output and error code
- [`FraymeResult`](../guides/rendering.md#fraymeresult-one-result-in-a-chat): what each result draws, and its props
- [`@frayme/api/agent`](../sdk/api-agent.md): the framework-neutral core behind these tools
