# @frayme/runtime

Renders Frayme specs as live, interactive React UI: one renderer component, a streaming compose hook, and adapters for AI SDK and AG-UI transports.

```bash
npm i @frayme/runtime
```

ESM, MIT, Node ≥ 20.19, React ≥ 19. Version 0.6.0. The `ai` / `@ai-sdk/react` peers are optional, needed only for the `/ai-sdk` entrypoint.

## Entrypoints

| Entrypoint | Environment | Key exports |
| --- | --- | --- |
| `@frayme/runtime` | Server-safe (route handlers, Node) | `composeStreamToDataParts`, `SPEC_DATA_PART_TYPE`, `validateFraymeSpec`, `themeToStyle`, `resolveTheme`, `isThemePair`, `resolveInitialState`, `dispatch`, `receiptModel`, `threadText`, `threadState`, types (`Spec`, `DynamicActionEvent`, `ReceiptEvent`, `ThemeTokens`, `ThemeInput`, `ThemePair`, `ThemeScheme`, and more) |
| `@frayme/runtime/react` | Client | `FraymeRenderer`, `FraymeResult`, `FraymeScreen`, `useFraymeScreen`, `FraymeActionReceipt`, `FraymeProvider`, `useFrayme`, `useFraymeCompose`, `useColorScheme`, `createCustomComponents` + the BYOC author kit, `defaultRegistry`, `createRegistry` |
| `@frayme/runtime/ai-sdk` | Client | `fraymePart`, `pressMessage`, `FraymeMessageRenderer`, `createDynamicActionForwarder`, `SPEC_DATA_PART_TYPE`. See [Vercel AI SDK](../frameworks/ai-sdk.md). |
| `@frayme/runtime/ag-ui` | Client | `useFraymeAgUiSpec`, `FraymeAgUiRenderer`, `createAgUiActionForwarder`, `fraymeActionToolDefinition`, `FRAYME_SPEC_EVENT`, `FRAYME_ACTION_TOOL`. See [AG-UI](../frameworks/ag-ui.md). |
| `@frayme/runtime/styles.css` |  | Default styles + the `--frayme-*` theme variables. Import once, anywhere. |

Never import a client entrypoint from a route handler: the server-safe bridge (`composeStreamToDataParts`) lives on the root for exactly this reason.

## FraymeRenderer

```tsx
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer spec={spec} onDynamicAction={(e) => sendToAgent(e)} />;
```

### Props

| Prop | Type | Description |
| --- | --- | --- |
| `spec` | `Spec \| null` | The spec to render: full or streaming snapshot. |
| `mode` | `'strict' \| 'progressive'` | `strict` (default) renders only specs passing the catalog gate. `progressive` renders partial streaming snapshots; the component whitelist + inert fallback is the safety boundary. |
| `skipValidation` | `boolean` | Skip the strict-mode catalog re-validation for specs you already trust (e.g. one straight from the API, which was validated server-side before billing). No effect in `progressive` mode. |
| `components` | `ComponentRegistry` | Per-instance component overrides, merged over the default registry. |
| `catalog` | `FraymeCatalogUnion` | BYOC: the built-ins ∪ custom-manifests union from `createCustomComponents(...).catalog`, so strict mode accepts custom types. |
| `onDynamicAction` | `(e: DynamicActionEvent) => unknown` | Receives spec-bound named actions: the ~10% of interactions that need your agent. |
| `dynamicActionTypes` | `readonly string[]` | Which element types may dispatch an action out of the renderer. Default `DEFAULT_DYNAMIC_ACTION_TYPES` = `['Button', 'IconButton', 'Fab', 'Confirmation', 'Form', 'DataTable']`; a row/bulk action button is a carrier on any host regardless. Every other component's declared action stays local (state mirror only). Replaces the default: spread `DEFAULT_DYNAMIC_ACTION_TYPES` in to widen it; compared by content, so an inline literal is fine. See [Which controls reach your agent](#which-controls-reach-your-agent). |
| `actionContract` | `readonly ActionDecl[]` | The host's action declarations: the same `ActionDecl[]` you sent to compose. Read for each declaration's `description`, which lands on the event as `description` (precedence: this prop → the server-stamped `spec.actions[name].description` → omitted). Never used for routing. |
| `theme` | `ThemeInput` | Per-instance tokens: one `ThemeTokens` set for both modes, or a `{ light, dark }` pair that the resolved mode picks from. Falls back to the provider's. See [Theming](#theming). |
| `scheme` | `ThemeScheme` | `'light'` or `'dark'` forces a mode and adds `frayme-light` / `frayme-dark` to the root. `'system'` follows the OS. Falls back to the provider's. If neither sets it, a plain token set leaves the choice to the stylesheet, and a pair follows the OS. |
| `restartKey` | `number` | Bump to discard all client state (remounts the state tree). `useFraymeCompose` bumps it automatically on restart. |
| `initialState` | `Record<string, unknown>` | Override the initial state (defaults to the spec's embedded `state`). |
| `loading` | `boolean` | Mark the UI as still streaming/loading. |
| `actions` | `string[] \| FraymeActionMap` | Take full control of action routing. `string[]` is an allow-list; a map assigns each name a `local` / `recompose` / `agent` / `host` kind (or `false` to deny). Passing either makes you the sole router: `spec.actions` is ignored and unmapped names fail closed. Usually omit it and let the spec drive. |
| `defaultActionKind` | `DefaultActionKind` | Blanket kind for unmapped actions. Default: fail-closed (inert). |
| `compose` | `ComposeLike` | A compose client (e.g. `frayme.compose`). Enables the `recompose` action kind. |
| `onRecompose` | `(nextSpec, { state }) => void` | Where a `recompose` result lands: the spec owner's setter. |
| `hostTransport` | `HostTransport` | Host bridge for the `host` action kind (postMessage surfaces). |
| `interactive` | `boolean` | Defaults to `true` when a handler is present. Set `false` for a display-only UI: controls render, clicks are inert, and a click records nothing (no `/_ui` state mirror is written), so no control is latched when the renderer later turns interactive. |
| `className` | `string` | Extra class on the root wrapper. |

### DynamicActionEvent

What `onDynamicAction` receives when a declared action fires:

```ts
interface DynamicActionEvent {
  action: string;                      // the bound action name, e.g. "approveRefund"
  params: Record<string, unknown>;     // resolved params (often form state)
  event?: string;                      // canonical verb: commit/select/change/dismiss/search/sort/page/move
  state?: Record<string, unknown>;     // live state snapshot at fire time
  element_id?: string;                 // the element that fired (the Button, or the DataTable)
  generation_id?: string;              // correlates back to the compose that built this UI
  label?: string;                      // the pressed control's label, VERBATIM, when the fire names one
  description?: string;                // what the action does: actionContract, else the `actions` map entry, else spec.actions[name].description
}
```

`label` is known for a Button / IconButton / Fab / Confirmation press (its own label), a row or bulk action press (the matching `rowActions[]` / `bulkActions[]` entry's label), and a DataTable's built-in row or bulk delete (the text the button drew: `deleteLabel`, "Delete selected"); a Form's submit carries none, and an unlabelled row action is not named by its id. A `live: true` pick (a Select, a menu, a BodyMap region) carries the label of the item chosen. There, the pick is the event. It is never re-cased. `description` is the host's own words, in order of closeness: the `actionContract` prop, then the entry in a consumer `actions` map (when one routes the action), then the server-stamped `spec.actions[name].description`. Both fields are absent, not empty, when unknown.

Static interactions (typing, tabs, filters, sorting data you supplied) resolve entirely in the browser and never reach this seam. Only spec-declared actions do. See [Interactivity](../concepts/interactivity.md).

### FraymeActionReceipt

The card a host shows in the chat thread when a control fires a declared action: the control's label as the title (verbatim; falls back to the humanized action name), the action's description (omitted when none), and a table of the params (`humanizeKey` / `formatValue`: blanks dropped, nested objects and long arrays summarised). Themed exactly like a rendered spec beside it: it is its own `.frayme-root`, takes the same `theme` tokens (or the provider's) and honours `data-theme`.

```tsx
import { FraymeActionReceipt } from '@frayme/runtime/react';

<FraymeActionReceipt event={event} />;
```

| Prop | Type | Description |
| --- | --- | --- |
| `event` | `DynamicActionEvent \| ReceiptEvent` | The event `onDynamicAction` received, or just its receipt slice `{ action, params, label?, description?, state? }`. |
| `showState` | `boolean` | Add a collapsed **State** `<details>` with `event.state`. Default `false`: state stays off the card. |
| `theme` | `ThemeInput` | Per-instance tokens or a `{ light, dark }` pair. Falls back to `FraymeProvider`'s. |
| `scheme` | `ThemeScheme` | Same as on `FraymeRenderer`. A resolved mode adds `frayme-light` / `frayme-dark` to the root. |
| `dataTheme` | `string` | Lands as `data-theme` on the root (`'dark'`, `'light'`, a preset). |
| `omitKeys` | `readonly string[]` | Param keys to leave off the table. |
| `headingLevel` | `2 \| 3 \| 4 \| 5 \| 6` | The title's heading element. Default `3`: set it to fit your thread's outline. |
| `className` / `as` | `string` / `'section' \| 'div' \| 'article' \| 'aside' \| 'li'` | Extra root class; root element (default `section`). |

Accessibility: the root is a `role="group"` named by its own heading (`aria-labelledby`) for `section` and `div`, never a `region` landmark, so a thread of many cards adds no landmarks; `article` / `aside` / `li` keep their native roles. The **State** block is a focusable, named scroller. Nothing on the event can make the card throw: a `state` that `JSON.stringify` rejects (a BigInt, a cycle) still renders.

The pure model behind it, `receiptModel(event, { omitKeys?, includeState? })` → `{ title, description?, rows, state? }`, is exported from the server-safe root for hosts that render their own card.

For a text-only surface the same root exports the plain-text pair: `threadText(action, params, { bullet?, maxParams? })` (the humanized action name, then one `- Key: value` bullet per non-blank param) and `threadState(state, { bullet?, maxLines?, exclude?, heading? })`, which writes an "Also recorded" heading, one `- Element · verb: payload` bullet per local gesture recorded in `state._ui` (the verb's head first, a move's card and columns or a change's field and value, then every other key the payload carries, so a DataTable row-select still names its row; the firing control's own entry excluded via `exclude: { elementId, verb }`; a bare press and the row-scoped `__rows` mirror skipped), then one `- Key: value` bullet per bound value (an array of records is counted at any depth: `Board: 3 items`, `Rows: 3 items`); capped at 12 lines by default, `''` when there is nothing to say (a cap of 0 included). Both write structure, not English: keys and element ids are humanized, values, labels and card titles are printed exactly as supplied. The AI SDK forwarder's default `sendMessage` text is `threadText` + a blank line + `threadState`.

One exclusion: a `recompose` action handled by a wired compose client (`compose` + `onRecompose`) morphs the canvas in place and dispatches no `DynamicActionEvent`, so there is no event to card: the press is visible as the new UI instead.

### Which controls reach your agent

A **press** dispatches a declared action out of the renderer. The carriers are: a Button and its press-shaped siblings IconButton, Fab and Confirmation (a verdict); a **Form**'s declared `commit`, which only ever fires from a submit gesture (its `submit: true` or bindings-less Button, or Enter in a field; `element_id` is the Form's); any declared action on a **DataTable**; and a **row/bulk action button** on any component that draws one (DataTable, KanbanBoard, KanbanCard), whose press is carried by the gesture, not the host's type, so it goes even when the list is narrowed. A declared action on anything else (a Select, a Switch, a Slider, a Kanban move, a ButtonGroup pick, a PromptInput send) stays local: the interaction is written to state under `/_ui/<elementId>/<verb>`, and the next press carries it inside `event.state`. The state mirror is the batching channel; the press is the submit step.

- `live: true` on a binding is the per-action opt-out: it fires on every change, with no submit step. (A PromptInput chat surface opts in this way, or via `dynamicActionTypes`.)
- `dynamicActionTypes` widens the list per renderer: `dynamicActionTypes={[...DEFAULT_DYNAMIC_ACTION_TYPES, 'KanbanBoard']}` (exported from `@frayme/runtime/react`). The prop replaces the default, so spread it in.
- Custom (BYOC) component types are not carriers until you list them.
- A binding's `onSuccess` / `onError` chain inherits its trigger's decision (carried from a Button, local from a Select). A `watch` handler naming a declared action stays local, because no gesture fired it. Use a builtin there, or let the next press read the changed state.
- A gated dispatch is silent and inert: nothing is thrown, the spec stays valid, no automatic confirm is raised for it (an authored `confirm` still shows), the control stays live (the commit latch never arms on it) and the fields feeding it do not freeze. `local` handlers and `false` are never gated.

## FraymeResult

`FraymeResult` renders one Frayme tool result inside your own chat, where the tools come from `fraymeTools()` in [`@frayme/api/ai-sdk`](api-ai-sdk.md). Your framework streams the `frayme_compose` / `frayme_action` tool outputs and the user's presses. `FraymeResult` draws whichever one it's given, and it owns no transport.

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

| Prop | Type | Description |
| --- | --- | --- |
| `output` | `FraymeResultOutput` | The tool output: `{ status, generation_id?, op_count?, restart_count?, spec, error?, refused? }`, where `status` is `'streaming'`, `'restarted'`, `'complete'` or `'error'`. |
| `final` | `boolean` | Whether `output` is the last output this tool call produces (the AI SDK's `preliminary !== true`). Defaults to true once the status is terminal. |
| `press` | `DynamicActionEvent` | A press the user made. When set, the receipt card is drawn instead of `output`. |
| `onPress` | `OnDynamicAction` | Receives presses on the finished screen, for example `(e) => sendMessage(pressMessage(e))`. |
| `interactive` | `boolean` | Whether the finished screen takes presses now. Default `true`. Pass `false` while `useChat` reports `submitted` or `streaming`. A press while the agent is still answering would start a second request alongside the first, and the AI SDK doesn't queue them. While inert, the controls stay visible, and a press does nothing and doesn't latch the control. |
| `showState` | `boolean` | Show the press's `state` on its card. Default `false`. |
| `theme` / `scheme` | `ThemeInput` / `ThemeScheme` | Same as on `FraymeRenderer`. |
| `className` | `string` | Extra class on the root. |

What it draws, in order:

1. **A press:** the `FraymeActionReceipt` card.
2. **A refused output** (`refused: true`): nothing. The tool turned the call down before composing, and the reason is written for the model.
3. **An error:** a one-line notice with the error's message. A failed compose's partial spec is never shown.
4. **A final, complete output:** the validated screen, under the strict catalog gate, taking presses when `interactive` is true.
5. **A final output that never completed** (the chat was reloaded mid-stream, or the call was cut off): a "This screen did not finish." notice above whatever arrived, drawn display-only, because the agent never saw that screen finish.
6. **Anything else:** the live snapshot, in progressive mode. It takes typed input but no presses. A press does nothing until the screen is final.

The streaming render and the final one share a state store, so input the user typed early survives into the finished screen. `FraymeResult` never mutates `output`.

### fraymePart and pressMessage

Both come from `@frayme/runtime/ai-sdk`.

- **`fraymePart(part, message?)`** reads one `useChat` message part and returns one of three things:
  - `{ output, final }` for a `frayme_compose` or `frayme_action` tool part in state `output-available`. This covers a static `tool-<name>` part and a `dynamic-tool` part.
  - `{ press }` for a text part of a user message whose `metadata.frayme` holds a press.
  - `null` for anything else.

  It also returns `null` in two cases the user shouldn't see:
  - A refused output.
  - An error output followed, later in the same message, by another Frayme call that is still running or that finished without a refusal. The model retried, and the old error would sit above the screen that replaced it.

  Pass the whole message, as the example does, for the second case to work: the `message` parameter takes `{ role, metadata, parts }`. It reads parts structurally, so it needs no `ai` import and never throws.
- **`pressMessage(event, { includeState? })`** turns a press into the user's next message, `{ text, metadata: { frayme: event } }`, which you pass to `sendMessage`.
  - The text is what `createDynamicActionForwarder` writes by default: `threadText`, then the `threadState` block unless `includeState` is `false`. It ends with a line `frayme_action {"action":...,"event":...,"element_id":...,"label":...,"generation_id":...}` that the agent forwards to the tool.
  - The full event travels in `metadata.frayme`. `fraymeTools` restores params and state from it, and `fraymePart` turns the message into a receipt card, so the text is never shown.

## useFraymeCompose

Frontend-direct streaming compose with restart handling built in:

```tsx
'use client';
import Frayme from '@frayme/api';
import { FraymeRenderer, useFraymeCompose } from '@frayme/runtime/react';

const frayme = new Frayme({ apiKey: null, baseURL: '/api/frayme-proxy' }); // keyless proxy mode

export function Composer() {
  const { compose, spec, status, restartKey, error } = useFraymeCompose(frayme);

  return (
    <>
      <button onClick={() => compose({ prompt: 'A weekly schedule board' })}>Generate</button>
      <FraymeRenderer spec={spec} mode="progressive" restartKey={restartKey} loading={status === 'streaming'} />
      {status === 'error' && <p>{error?.message}</p>}
    </>
  );
}
```

### Returns

| Field | Type | Description |
| --- | --- | --- |
| `compose(request, options?)` | `Promise<FinalSpec \| undefined>` | Start (or replace) a streaming composition. Resolves with the validated final spec; `undefined` on abort or when a newer call superseded it. |
| `spec` | `Spec \| null` | Live snapshot. Render with `mode="progressive"`. Cleared on restart, committed on completion. |
| `status` | `'idle' \| 'streaming' \| 'restarting' \| 'complete' \| 'error'` | Stream lifecycle. |
| `restartKey` | `number` | Bumps on every restart. Pass straight to `<FraymeRenderer restartKey>`. |
| `model` | `string \| undefined` | Opaque identifier of the model serving the current attempt (changes on restarts). |
| `generationId` | `string \| undefined` | The generation the current compose belongs to. It is set by the stream's first event, confirmed on completion, kept across restarts and cleared when a new compose starts. Optional in the type. |
| `error` | `FraymeError \| undefined` | Set when `status === 'error'`, including when the stream can't start at all. |
| `abort()` | `() => void` | Abort the in-flight stream. |

The hook takes an optional client argument; without one it reads `client` from the nearest `FraymeProvider`. Every op hands out a new `spec` object, so the renderer updates on each one and a snapshot you keep never changes.

## FraymeScreen

`FraymeScreen` composes a screen with no chat around it. Its props are the request, sent through a keyless client, usually the one `FraymeProvider` builds from `endpoint`:

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

The screen composes on mount, and again whenever `prompt`, `data`, `actions`, `signals` or `context` change by value. The comparison is a stable deep compare, so an inline object literal doesn't trigger a recompose on every render. A prop-driven compose starts fresh, with a new renderer and no state carried over.

| Prop | Type | Description |
| --- | --- | --- |
| `prompt` | `string` | What the screen should be. |
| `data` | `Record<string, unknown>` | Facts the screen must show verbatim. |
| `actions` | `ComposeAction[]` | The actions the screen's controls fire. |
| `signals` / `context` | `ComposeRequest['signals']` / `ComposeRequest['context']` | As on the compose request. |
| `client` | `Frayme` | Defaults to the provider's client, including one built from its `endpoint`. |
| `onAction` | `(event, screen) => void \| Promise<void>` | A press on the screen, with the handle to move it on. |
| `fallback` | `ReactNode` | Shown until the first part of the screen arrives. Default: nothing. |
| `theme` / `scheme` / `className` | | Same as on `FraymeRenderer`. |

The handle (`onAction`'s second argument):

| Member | Description |
| --- | --- |
| `spec` | What the screen shows: the live snapshot while streaming, and the validated spec once complete. During an edit or continue, it keeps showing the screen the follow-up started from until the first op arrives, and after a failure. |
| `status` | `'idle' \| 'streaming' \| 'restarting' \| 'complete' \| 'error'`. It reads `streaming` from the moment the props change. |
| `generationId` | The generation `spec` belongs to. |
| `edit(prompt, extra?)` | Change the last complete screen in place (`mode: 'edit'`). With no complete screen, sends a fresh create instead. |
| `continue(event, prompt?, extra?)` | Compose the next step after a press: a plain create whose prompt names the control that was pressed, with the pressed action's params as `data` over the props' own. The pressed screen is not sent, and neither is the event's `state`. Without `prompt` (or `extra.prompt`), it writes one naming the control. |
| `retry()` | Send the last request again, unchanged. Does nothing unless `status` is `'error'`. |
| `abort()` | Stop the compose in flight. |

`edit` and `continue` resend the props' `data`, `actions`, `signals` and `context`, and `extra` overrides any of them. Only a complete screen is ever sent as `prior_spec`, and only by `edit`.

`continue` derives only what you did not give it: pass a `prompt` and yours is used, and name `data` in `extra` and the derived values are left out entirely. The control's own `label` and `description` are stripped from the derived `data`, because a `data` key the composer does not use is drawn on the screen as a stray detail. Since 0.6.0 nothing is cut to fit on a continue: the request carries no `prior_spec` and no `action_context`. `edit` sends the screen as it is: a screen too large to edit gets the API's error notice. A failed compose shows an error notice above the last good screen, with a "Try again" button when retrying could help. That's a dropped connection, a timeout, a rate limit or a server error, but not a bad request or an exhausted quota.

`useFraymeScreen(options)` is the same logic as a hook. It returns the handle plus `restartKey`, `screenKey` (use it as the renderer's React `key`), `model` and `error`, and you render the spec yourself. If no client is available, both throw during render. See [Chatless screens](../guides/chatless-screens.md).

## FraymeProvider

Optional app-level defaults for every renderer beneath it:

```tsx
import { FraymeProvider } from '@frayme/runtime/react';

<FraymeProvider client={frayme} theme={{ primary: '#2563eb' }} onDynamicAction={handleAction}>
  <App />
</FraymeProvider>;
```

| Value | Description |
| --- | --- |
| `client` | A keyless proxy-mode client for frontend-direct compose. |
| `endpoint` | Your own server route that holds the API key, such as `/api/frayme`. With no `client`, the provider builds a keyless client for it (`new Frayme({ apiKey: null, baseURL: endpoint })`). An explicit `client` always wins. |
| `theme` | A `ThemeInput`: one token set, or a `{ light, dark }` pair. |
| `scheme` | A `ThemeScheme`: `'light'` or `'dark'` forces a mode, and `'system'` follows the OS. |
| `onDynamicAction` | The default action handler. |
| `components` | Component overrides for every renderer beneath it. |

With `endpoint`, a page needs no client wiring of its own:

```tsx
'use client';
import type { ReactNode } from 'react';
import { FraymeProvider } from '@frayme/runtime/react';

export function App({ children }: { children: ReactNode }) {
  return (
    <FraymeProvider endpoint="/api/frayme" scheme="system">
      {children}
    </FraymeProvider>
  );
}
```

The route behind `endpoint` is `createFraymeHandler` from [`@frayme/api/server`](api-server.md). Per-instance props on `FraymeRenderer` win over provider values, and `theme` and `scheme` are resolved separately. `useFrayme()` reads the context directly.

## Theming

Ship `@frayme/runtime/styles.css` for the defaults, then override tokens per instance via the `theme` prop or globally in your own stylesheet. Every token is a `--frayme-*` CSS variable on the `.frayme-root` wrapper:

```css
.frayme-root {
  --frayme-primary: #7c3aed;
  --frayme-radius: 0.75rem;
}
```

`ThemeTokens` keys: `primary`, `primaryForeground`, `background`, `foreground`, `card`, `cardForeground`, `border`, `muted`, `mutedForeground`, `danger`, `dangerForeground`, `success`, `successForeground`, `warning`, `warningForeground`, `info`, `infoForeground`, `accent`, `accentForeground`, `radius`, `fontFamily`. `accent` (`--frayme-accent`) colors every interactive state at once: a switch that is on, a selected row or option, a checked box, the focus ring. If you leave it unset, the neutral default stays. `accentForeground` (`--frayme-accent-fg`) is the ink on an accent fill; leave it out and it is picked by contrast, as `primaryForeground` is. Since 0.6.0 a passed `primary` also fills every main action, and `onFillInk(fill)` from the root is the contrast picker behind both inks.

The theme types:

| Type | Shape |
| --- | --- |
| `ThemeTokens` | One token set, applied in both modes. |
| `ThemePair` | `{ light?: ThemeTokens; dark?: ThemeTokens }`. The resolved mode picks the half. A missing half leaves the stylesheet's own values for that mode. |
| `ThemeInput` | `ThemeTokens \| ThemePair`, what every `theme` prop accepts. |
| `ThemeScheme` | `'light' \| 'dark' \| 'system'`, what every `scheme` prop accepts. |

The helpers:

| Helper | Entry point | Description |
| --- | --- | --- |
| `useColorScheme(scheme?)` | `/react` | Returns the mode a scheme resolves to: `'light'`, `'dark'` or `undefined`. `'system'` reads the OS and re-renders when the OS setting changes. It's SSR-safe: the value is `undefined` on the server and during hydration. |
| `resolveTheme(theme, mode)` | root | Returns the token set to apply in `mode`: a pair's matching half, or a plain token set as is. |
| `isThemePair(value)` | root | `true` for an object keyed by `light` and/or `dark` that carries no token names. |
| `themeToStyle(tokens)` | root | Converts a token set to the equivalent inline `--frayme-*` style map. It accepts any `ThemeInput`, but a pair has no mode here and produces no properties, so call `themeToStyle(resolveTheme(theme, mode))`. |

Full guide: [Theming](../guides/theming.md).

## Custom components (BYOC)

`createCustomComponents` wraps your own React components so they render inside a spec with the same guarantees as built-ins (gated props, a typed `emit` on the canonical verbs, optional `clientOnly` SSR skeletons):

```tsx
import { createCustomComponents } from '@frayme/runtime/react';

const custom = createCustomComponents([{ manifest: SeatMapManifest, component: SeatMapView }]);

<FraymeRenderer spec={spec} components={custom.registry} catalog={custom.catalog} />;
```

The author kit is exported alongside it: `useLocalOrBound`, `styleVars`, `cn`, `Icon` / `hasIcon` / `ICON_NAMES`, `safeUrl` / `safeImageSrc`, `safeColor` / `safeDimension`. Manifests are authored with [`defineFraymeComponent`](catalog.md#byoc-authoring) from `@frayme/catalog`. Full guide: [Custom components](../guides/custom-components.md).
