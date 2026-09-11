# @frayme/runtime

Renders Frayme specs as live, interactive React UI — one renderer component, a streaming compose hook, and adapters for AI SDK and AG-UI transports.

```bash
npm i @frayme/runtime
```

ESM, MIT, Node ≥ 20.19, React ≥ 19. Version 0.4.0. The `ai` / `@ai-sdk/react` peers are optional — needed only for the `/ai-sdk` entrypoint.

## Entrypoints

| Entrypoint | Environment | Key exports |
| --- | --- | --- |
| `@frayme/runtime` | Server-safe (route handlers, Node) | `composeStreamToDataParts`, `validateFraymeSpec`, `themeToStyle`, `resolveInitialState`, `dispatch`, `receiptModel`, `threadText`, `threadState`, types (`Spec`, `DynamicActionEvent`, `ReceiptEvent`, `ThemeTokens`, …) |
| `@frayme/runtime/react` | Client | `FraymeRenderer`, `FraymeActionReceipt`, `FraymeProvider`, `useFrayme`, `useFraymeCompose`, `createCustomComponents` + the BYOC author kit, `defaultRegistry`, `createRegistry` |
| `@frayme/runtime/ai-sdk` | Client | `FraymeMessageRenderer`, `createDynamicActionForwarder`, `SPEC_DATA_PART_TYPE` — see [Vercel AI SDK](../frameworks/ai-sdk.md) |
| `@frayme/runtime/ag-ui` | Client | `useFraymeAgUiSpec`, `FraymeAgUiRenderer`, `createAgUiActionForwarder`, `fraymeActionToolDefinition`, `FRAYME_SPEC_EVENT`, `FRAYME_ACTION_TOOL` — see [AG-UI](../frameworks/ag-ui.md) |
| `@frayme/runtime/styles.css` | — | Default styles + the `--frayme-*` theme variables. Import once, anywhere. |

Never import a client entrypoint from a route handler — the server-safe bridge (`composeStreamToDataParts`) lives on the root for exactly this reason.

## FraymeRenderer

```tsx
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer spec={spec} onDynamicAction={(e) => sendToAgent(e)} />;
```

### Props

| Prop | Type | Description |
| --- | --- | --- |
| `spec` | `Spec \| null` | The spec to render — full or streaming snapshot. |
| `mode` | `'strict' \| 'progressive'` | `strict` (default) renders only specs passing the catalog gate. `progressive` renders partial streaming snapshots; the component whitelist + inert fallback is the safety boundary. |
| `skipValidation` | `boolean` | Skip the strict-mode catalog re-validation for specs you already trust — e.g. one straight from the API, which was validated server-side before billing. No effect in `progressive` mode. |
| `components` | `ComponentRegistry` | Per-instance component overrides, merged over the default registry. |
| `catalog` | `FraymeCatalogUnion` | BYOC: the built-ins ∪ custom-manifests union from `createCustomComponents(...).catalog`, so strict mode accepts custom types. |
| `onDynamicAction` | `(e: DynamicActionEvent) => unknown` | Receives spec-bound named actions — the ~10% of interactions that need your agent. |
| `dynamicActionTypes` | `readonly string[]` | Which element types may dispatch an action out of the renderer. Default `DEFAULT_DYNAMIC_ACTION_TYPES` = `['Button', 'IconButton', 'Fab', 'Confirmation', 'Form', 'DataTable']`; a row/bulk action button is a carrier on any host regardless. Every other component's declared action stays local (state mirror only). Replaces the default — spread `DEFAULT_DYNAMIC_ACTION_TYPES` in to widen it; compared by content, so an inline literal is fine. See [Which controls reach your agent](#which-controls-reach-your-agent). |
| `actionContract` | `readonly ActionDecl[]` | The host's action declarations — the same `ActionDecl[]` you sent to compose. Read for each declaration's `description`, which lands on the event as `description` (precedence: this prop → the server-stamped `spec.actions[name].description` → omitted). Never used for routing. |
| `theme` | `ThemeTokens` | Per-instance theme tokens (see [Theming](#theming)). |
| `restartKey` | `number` | Bump to discard all client state (remounts the state tree). `useFraymeCompose` bumps it automatically on restart. |
| `initialState` | `Record<string, unknown>` | Override the initial state (defaults to the spec's embedded `state`). |
| `loading` | `boolean` | Mark the UI as still streaming/loading. |
| `actions` | `string[] \| FraymeActionMap` | Take full control of action routing. `string[]` is an allow-list; a map assigns each name a `local` / `recompose` / `agent` / `host` kind (or `false` to deny). Passing either makes you the sole router — `spec.actions` is ignored and unmapped names fail closed. Usually omit it and let the spec drive. |
| `defaultActionKind` | `DefaultActionKind` | Blanket kind for unmapped actions. Default: fail-closed (inert). |
| `compose` | `ComposeLike` | A compose client (e.g. `frayme.compose`). Enables the `recompose` action kind. |
| `onRecompose` | `(nextSpec, { state }) => void` | Where a `recompose` result lands — the spec owner's setter. |
| `hostTransport` | `HostTransport` | Host bridge for the `host` action kind (postMessage surfaces). |
| `interactive` | `boolean` | Defaults to `true` when a handler is present. Set `false` for a display-only UI — controls render but clicks are inert. |
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
  description?: string;                // what the action does — actionContract, else the `actions` map entry, else spec.actions[name].description
}
```

`label` is known for a Button / IconButton / Fab / Confirmation press (its own label), a row or bulk action press (the matching `rowActions[]` / `bulkActions[]` entry's label), and a DataTable's built-in row or bulk delete (the text the button drew — `deleteLabel`, "Delete selected"); a Form's submit carries none, and an unlabelled row action is not named by its id. A `live: true` pick (a Select, a menu, a BodyMap region) carries the label of the item chosen — there, the pick is the event. It is never re-cased. `description` is the host's own words, in order of closeness: the `actionContract` prop, then the entry in a consumer `actions` map (when one routes the action), then the server-stamped `spec.actions[name].description`. Both fields are absent, not empty, when unknown.

Static interactions — typing, tabs, filters, sorting data you supplied — resolve entirely in the browser and never reach this seam. Only spec-declared actions do. See [Interactivity](../concepts/interactivity.md).

### FraymeActionReceipt

The card a host shows in the chat thread when a control fires a declared action: the control's label as the title (verbatim; falls back to the humanized action name), the action's description (omitted when none), and a table of the params (`humanizeKey` / `formatValue` — blanks dropped, nested objects and long arrays summarised). Themed exactly like a rendered spec beside it: it is its own `.frayme-root`, takes the same `theme` tokens (or the provider's) and honours `data-theme`.

```tsx
import { FraymeActionReceipt } from '@frayme/runtime/react';

<FraymeActionReceipt event={event} />;
```

| Prop | Type | Description |
| --- | --- | --- |
| `event` | `DynamicActionEvent \| ReceiptEvent` | The event `onDynamicAction` received — or just its receipt slice `{ action, params, label?, description?, state? }`. |
| `showState` | `boolean` | Add a collapsed **State** `<details>` with `event.state`. Default `false` — state stays off the card. |
| `theme` | `ThemeTokens` | Per-instance tokens; falls back to `FraymeProvider`'s. |
| `dataTheme` | `string` | Lands as `data-theme` on the root (`'dark'`, `'light'`, a preset). |
| `omitKeys` | `readonly string[]` | Param keys to leave off the table. |
| `headingLevel` | `2 \| 3 \| 4 \| 5 \| 6` | The title's heading element. Default `3` — set it to fit your thread's outline. |
| `className` / `as` | `string` / `'section' \| 'div' \| 'article' \| 'aside' \| 'li'` | Extra root class; root element (default `section`). |

Accessibility: the root is a `role="group"` named by its own heading (`aria-labelledby`) for `section` and `div` — never a `region` landmark, so a thread of many cards adds no landmarks; `article` / `aside` / `li` keep their native roles. The **State** block is a focusable, named scroller. Nothing on the event can make the card throw: a `state` that `JSON.stringify` rejects (a BigInt, a cycle) still renders.

The pure model behind it, `receiptModel(event, { omitKeys?, includeState? })` → `{ title, description?, rows, state? }`, is exported from the server-safe root for hosts that render their own card.

For a text-only surface the same root exports the plain-text pair: `threadText(action, params, { bullet?, maxParams? })` — the humanized action name, then one `- Key: value` bullet per non-blank param — and `threadState(state, { bullet?, maxLines?, exclude?, heading? })` — an "Also recorded" heading, one `- Element · verb: payload` bullet per local gesture recorded in `state._ui` (the verb's head first — a move's card and columns, a change's field and value — then every other key the payload carries, so a DataTable row-select still names its row; the firing control's own entry excluded via `exclude: { elementId, verb }`; a bare press and the row-scoped `__rows` mirror skipped), then one `- Key: value` bullet per bound value (an array of records is counted at any depth: `Board: 3 items`, `Rows: 3 items`); capped at 12 lines by default, `''` when there is nothing to say (a cap of 0 included). Both write structure, not English: keys and element ids are humanized, values, labels and card titles are printed exactly as supplied. The AI SDK forwarder's default `sendMessage` text is `threadText` + a blank line + `threadState`.

One exclusion: a `recompose` action handled by a wired compose client (`compose` + `onRecompose`) morphs the canvas in place and dispatches no `DynamicActionEvent`, so there is no event to card — the press is visible as the new UI instead.

### Which controls reach your agent

A **press** dispatches a declared action out of the renderer. The carriers are: a Button — and its press-shaped siblings IconButton, Fab and Confirmation (a verdict); a **Form**'s declared `commit`, which only ever fires from a submit gesture (its `submit: true` or bindings-less Button, or Enter in a field — `element_id` is the Form's); any declared action on a **DataTable**; and a **row/bulk action button** on any component that draws one (DataTable, KanbanBoard, KanbanCard) — that press is carried by the gesture, not the host's type, so it goes even when the list is narrowed. A declared action on anything else — a Select, a Switch, a Slider, a Kanban move, a ButtonGroup pick, a PromptInput send — stays local: the interaction is written to state under `/_ui/<elementId>/<verb>`, and the next press carries it inside `event.state`. The state mirror is the batching channel; the press is the submit step.

- `live: true` on a binding is the per-action opt-out: it fires on every change, with no submit step. (A PromptInput chat surface opts in this way, or via `dynamicActionTypes`.)
- `dynamicActionTypes` widens the list per renderer — `dynamicActionTypes={[...DEFAULT_DYNAMIC_ACTION_TYPES, 'KanbanBoard']}` (exported from `@frayme/runtime/react`). The prop replaces the default, so spread it in.
- Custom (BYOC) component types are not carriers until you list them.
- A binding's `onSuccess` / `onError` chain inherits its trigger's decision (carried from a Button, local from a Select). A `watch` handler naming a declared action stays local — no gesture fired it; use a builtin there, or let the next press read the changed state.
- A gated dispatch is silent and inert: nothing is thrown, the spec stays valid, no automatic confirm is raised for it (an authored `confirm` still shows), the control stays live (the commit latch never arms on it) and the fields feeding it do not freeze. `local` handlers and `false` are never gated.

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
| `spec` | `Spec \| null` | Live snapshot — render with `mode="progressive"`. Cleared on restart, committed on completion. |
| `status` | `'idle' \| 'streaming' \| 'restarting' \| 'complete' \| 'error'` | Stream lifecycle. |
| `restartKey` | `number` | Bumps on every restart — pass straight to `<FraymeRenderer restartKey>`. |
| `model` | `string \| undefined` | Opaque identifier of the model serving the current attempt (changes on restarts). |
| `error` | `FraymeError \| undefined` | Set when `status === 'error'`. |
| `abort()` | `() => void` | Abort the in-flight stream. |

The hook takes an optional client argument; without one it reads `client` from the nearest `FraymeProvider`.

## FraymeProvider

Optional app-level defaults for every renderer beneath it:

```tsx
import { FraymeProvider } from '@frayme/runtime/react';

<FraymeProvider client={frayme} theme={{ primary: '#2563eb' }} onDynamicAction={handleAction}>
  <App />
</FraymeProvider>;
```

Context values: `client` (a keyless proxy-mode client for frontend-direct compose), `theme`, `onDynamicAction`, `components`. Per-instance props on `FraymeRenderer` win over provider values. `useFrayme()` reads the context directly.

## Theming

Ship `@frayme/runtime/styles.css` for the defaults, then override tokens per instance via the `theme` prop or globally in your own stylesheet — every token is a `--frayme-*` CSS variable on the `.frayme-root` wrapper:

```css
.frayme-root {
  --frayme-primary: #7c3aed;
  --frayme-radius: 0.75rem;
}
```

`ThemeTokens` keys: `primary`, `primaryForeground`, `background`, `foreground`, `card`, `cardForeground`, `border`, `muted`, `mutedForeground`, `danger`, `dangerForeground`, `success`, `successForeground`, `warning`, `warningForeground`, `info`, `infoForeground`, `radius`, `fontFamily`. The server-safe `themeToStyle(tokens)` converts a token object to the equivalent inline-style map. Full guide: [Theming](../guides/theming.md).

## Custom components (BYOC)

`createCustomComponents` wraps your own React components so they render inside a spec with the same guarantees as built-ins — gated props, a typed `emit` on the canonical verbs, optional `clientOnly` SSR skeletons:

```tsx
import { createCustomComponents } from '@frayme/runtime/react';

const custom = createCustomComponents([{ manifest: SeatMapManifest, component: SeatMapView }]);

<FraymeRenderer spec={spec} components={custom.registry} catalog={custom.catalog} />;
```

The author kit is exported alongside it: `useLocalOrBound`, `styleVars`, `cn`, `Icon` / `hasIcon` / `ICON_NAMES`, `safeUrl` / `safeImageSrc`, `safeColor` / `safeDimension`. Manifests are authored with [`defineFraymeComponent`](catalog.md#byoc-authoring) from `@frayme/catalog`. Full guide: [Custom components](../guides/custom-components.md).
