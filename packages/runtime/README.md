# @frayme/runtime

Render [Frayme](https://frayme.ai)-generated UI specs as live, interactive React — with transport adapters for the Vercel AI SDK and AG-UI. React 19.

```bash
npm i @frayme/runtime @frayme/api
```

```tsx
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer spec={spec} onDynamicAction={(e) => sendToAgent(e)} />
```

## Why a runtime

A Frayme spec is JSON, not pixels. The runtime turns it into working UI and — the important part — **decides what happens when users interact**: most interactions (typing, tabs, toggles, state-bound visibility) resolve **locally in the browser at zero cost and zero latency**; only spec-bound named actions (form submits, "regenerate") reach `onDynamicAction`, where your agent takes over.

- **Default registry for the full catalog** — 189 components (forms, tables, dialogs, charts, layout primitives…), themeable via `--frayme-*` CSS variables; override any component via the `components` prop.
- **Validation gate** — strict catalog validation for at-rest specs; progressive mode for streaming, where the registry whitelist + inert fallback is the safety boundary.
- **`compose.restarted` done right** — `useFraymeCompose` discards snapshots AND remounts client state when the API restarts an attempt; you just pass `restartKey` through.
- **Safe by construction** — specs are data, components are a whitelist, unknown types render an inert placeholder. No eval, no raw HTML.

## Which controls reach your agent

A **press** dispatches a declared action out of the renderer: a Button (also IconButton, Fab, and a Confirmation's verdict), a Form's submit, any declared action on a DataTable, and a **row/bulk action button** on any component that draws one (DataTable, KanbanBoard, KanbanCard). Every other component's declared action — a Select, a Switch, a Kanban move, a ButtonGroup pick, a PromptInput send — stays local: the interaction is written to state under `/_ui/<elementId>/<verb>` and the next press carries it inside `event.state`. Batch what the user did; send it once.

- **`live: true`** on a binding is the per-action opt-out — it fires on every change, with no submit step.
- **`dynamicActionTypes`** widens the carrier list per renderer: `dynamicActionTypes={[...DEFAULT_DYNAMIC_ACTION_TYPES, 'KanbanBoard']}`. The prop replaces the default, so spread it in.
- A binding's `onSuccess` / `onError` chain gets the same decision as its trigger. A `watch` handler that names a declared action stays local (nothing pressed it).
- A denied dispatch is silent and inert — no error, no invalid spec, no confirm modal, no disabled control, no frozen fields.
- `event.element_id` names the element that fired (the Form, not its submit Button; the table, not the row).
- A text-only host hears the batch too: `createDynamicActionForwarder`'s default `sendMessage` text appends a compact "Also recorded" summary of `event.state` (`threadState`, server-safe root) under the name + params; `includeState: false` turns it off.

## Entrypoints

| Import | What |
|---|---|
| `@frayme/runtime/react` | `<FraymeRenderer/>`, `<FraymeProvider/>`, `useFraymeCompose`, `defaultRegistry` |
| `@frayme/runtime/ai-sdk` | `<FraymeMessageRenderer message={m}/>` (renders `data-spec` parts from `useChat` messages), `createDynamicActionForwarder` |
| `@frayme/runtime/ag-ui` | `useFraymeAgUiSpec()`, `<FraymeAgUiRenderer/>`, `frayme:spec` / `frayme:action` conventions |
| `@frayme/runtime` | server-safe: `composeStreamToDataParts()` (route-handler bridge), `validateFraymeSpec()`, theme tokens |
| `@frayme/runtime/styles.css` | the default stylesheet |

## AI SDK chat in two steps

```ts
// app/api/chat/route.ts — bridge the tool's stream into data parts
import { composeStreamToDataParts } from '@frayme/runtime';
for await (const part of composeStreamToDataParts(stream)) {
  writer.write({ type: 'data-spec', data: part });
}
```

```tsx
// client — render any message that carries a spec
import { FraymeMessageRenderer } from '@frayme/runtime/ai-sdk';
<FraymeMessageRenderer message={message} onDynamicAction={forwarder} />
```

Runnable app: the [quickstart](https://docs.frayme.ai/getting-started/quickstart) builds one from an empty Next.js project. Live demos: [frayme.ai/examples](https://frayme.ai/examples).

MIT © Frayme Ltd
