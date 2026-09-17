# @frayme/runtime

## 0.5.0

- New `<FraymeResult/>` (`@frayme/runtime/react`) renders one Frayme tool result inside your own chat, and never mutates the output it receives. Depending on what it gets, it draws:
  - the receipt card for a press;
  - nothing for a refused output (`refused: true`, written for the model);
  - an error notice;
  - the validated screen, once the compose completes;
  - a "did not finish" notice above a display-only partial screen, when a stream stopped early;
  - otherwise, the live snapshot. It accepts typed input, which carries over into the finished screen, but it ignores presses until the screen is final.
- `FraymeResult` also:
  - takes `interactive` (default `true`) for the finished screen. Pass `status === 'ready'` from `useChat`: a press while the agent is still answering would start a second request alongside the first. While the screen is inert, a press does nothing and doesn't latch the control.
  - reads `refused?: boolean` on `FraymeResultOutput`.
- New `fraymePart(part, message)` and `pressMessage(event, { includeState? })` (`@frayme/runtime/ai-sdk`).
  - `fraymePart` tells you what a `useChat` message part holds for `<FraymeResult/>`: `{ output, final }` for a `frayme_compose` or `frayme_action` tool output, `{ press }` for a press on a user message, or `null`.
  - `fraymePart` returns `null` for a refused output. It also returns `null` for an error output when a later part of the same message holds another Frayme call that is still running, or that finished without being refused (the model retried). Pass the whole message for that check. Its `message` parameter now also accepts `parts`.
  - `pressMessage` turns a press into the user's next message. The text is the forwarder's default press text plus a final `frayme_action {...}` line (`action`, `event`, `element_id`, `label`, `generation_id`) that the agent forwards.
  - The full event travels in `metadata.frayme`, so the chat shows a receipt card, not the text.
- New `<FraymeScreen/>` and `useFraymeScreen()` (`@frayme/runtime/react`) compose a screen with no chat around it.
  - The props are the request, and the screen composes again whenever `prompt`, `data`, `actions`, `signals` or `context` change by value.
  - The handle has `edit(prompt)`, `continue(event, prompt?)`, `retry()` and `abort()`. Only a completed screen is ever sent as `prior_spec`.
  - `continue(event)` fits `action_context` and `prior_spec` to the API's size limits with `fitContinuation` from `@frayme/api`: it drops the press's `state`, then its `params`, and leaves out a screen that is too large. `edit` doesn't fit anything, so a screen too large to edit shows the API's error notice.
  - A failed compose shows an error notice, with a "Try again" button when retrying could help.
- `FraymeProvider` takes `endpoint`. With no `client`, it builds a keyless client for that route (`new Frayme({ apiKey: null, baseURL: endpoint })`).
- Light and dark theming.
  - `scheme` (`'light' | 'dark' | 'system'`) is accepted by `FraymeProvider`, `FraymeRenderer`, `FraymeActionReceipt`, `FraymeResult` and `FraymeScreen`. `light` and `dark` force a mode and add `frayme-light` or `frayme-dark` to the root. `system` follows the OS and updates when the OS setting changes.
  - Every `theme` prop takes a `ThemeInput`: one `ThemeTokens` set, as before, or a `ThemePair` (`{ light?, dark? }`). With a pair, the resolved mode picks the half to apply. A pair given with no `scheme` follows the OS.
  - New exports: `useColorScheme(scheme)` (`/react`, SSR-safe), plus `resolveTheme(theme, mode)` and `isThemePair(value)` (root). `ThemeInput`, `ThemePair` and `ThemeScheme` are exported from the root and from `/react`.
- Type-level change: `FraymeContextValue.theme`, `FraymeRendererProps.theme` and `FraymeActionReceiptProps.theme` are now `ThemeInput` instead of `ThemeTokens`.
  - Code that reads `useFrayme().theme` as `ThemeTokens` must narrow it first, with `isThemePair` or `resolveTheme`.
  - `themeToStyle` accepts any `ThemeInput`, but a pair produces no properties there, so resolve it first with `resolveTheme(theme, mode)`. `themeToStyle` now also ignores keys that aren't token names.
- `ThemeTokens` gains `accent` (`--frayme-accent`), which colors every interactive state at once: a switch that is on, a selected row or option, a checked box, the focus ring. Left unset, the neutral default stays.
- Stylesheet:
  - The success, warning and info foreground tokens now reach the `text-*-foreground` utilities in both modes. They used to stay white, including on the brighter dark-mode fills.
  - New styles for the result notice and its retry control.
- `SPEC_DATA_PART_TYPE` (`'data-spec'`) is now also exported from the server-safe root, so a route handler can name the part type without importing a client module.
- `composeStreamToDataParts` emits an empty flat part before it rethrows a stream failure, so a half-built screen is cleared instead of looking finished. Each empty part is also a new object now, so one message's elements can't leak into the next.
- `useFraymeCompose`:
  - Returns `generationId`, the generation the current compose belongs to (optional in the type). It is set by the stream's first event, kept across restarts and cleared when a new compose starts.
  - Hands out a new spec object for every op. The renderer now updates on every op (it could stop after the first), and a snapshot you keep never changes.
  - A stream that can't start now sets `status` to `'error'` instead of leaving the hook on `'streaming'`.
- `<FraymeMessageRenderer/>` builds from a copy of the message's `data-spec` parts. It no longer patches the parts stored in the chat, and it no longer applies a patch twice when it rebuilds.
- `FraymeRenderer` with `interactive={false}` records nothing for a click: no `/_ui` state mirror is written, so the control isn't latched when the renderer later turns interactive.
- Type-level addition: the exported `IntrinsicSlots` interface gains a required `drop(action)` method, which removes a pending entry without writing the state mirror. Code that implements the interface must add it.
- When no client is available, `useFraymeCompose` and `useFraymeScreen` throw an error whose message now names `endpoint` on `<FraymeProvider>` as well as `client`.
- Depends on `@frayme/api` `^0.5.0`.

## 0.4.0

- Dynamic-action gate: only press-shaped controls (`Button`, `IconButton`, `Fab`, `Confirmation`, a `Form` submit, `DataTable`, and row/bulk action buttons) dispatch out of the renderer; every other declared action stays local and is mirrored at `state._ui.<elementId>.<verb>`. `live: true` on a binding opts out; the `dynamicActionTypes` prop widens the list. Denied dispatches are silent: no error, no confirm, no disabled control.
- `DynamicActionEvent` gained `element_id`, `label` and `description`; new `actionContract` prop on `FraymeRenderer`.
- New `<FraymeActionReceipt/>` and `receiptModel()`: the card a host shows in the thread when a control fires.
- New `threadState()`; `createDynamicActionForwarder` text default is now `threadText` + the `threadState` block (`includeState: false` restores name + params only).
- `SpecActionSpec` carries `description`.

## 0.3.2

- Republish with corrected internal dependency ranges.

## 0.3.0: Initial public release

- `<FraymeRenderer/>` (`@frayme/runtime/react`) renders validated Frayme specs with the built-in component registry; local-first interactions, spec-declared named actions surface via `onDynamicAction`.
- Transport adapters: Vercel AI SDK (`/ai-sdk`: `<FraymeMessageRenderer/>`, `composeStreamToDataParts()`) and AG-UI (`/ag-ui`: `useFraymeAgUiSpec()`, `<FraymeAgUiRenderer/>`).
- Themeable via `--frayme-*` CSS variables (`@frayme/runtime/styles.css`); unknown component types render an inert fallback.
