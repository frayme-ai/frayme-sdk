# @frayme/runtime

## 0.6.0

### A passed `primary` colors every main action

The button family fills from `var(--fr-btn-fill, var(--color-foreground))`, so the neutral high-contrast default stands exactly as before until a host passes `primary` through the `theme` prop. Passing it is the host saying "this is my color", so the main action takes it: `Button variant:"primary"`, a `Link` rendered as a button, a pressed `ButtonGroup` segment, `IconButton`, a hero CTA, a dialog's confirm, a Kanban card action, the chat send control and a choice-list submit. `secondary`, `danger`, `ghost` and `outline` are untouched, and the interactive states stay with `accent`.

The test is presence, not "differs from the shipped default". Comparing against the default would leave a brand whose color happens to equal it silently unstyled.

The label ink comes from `primaryForeground` when one is passed, and is otherwise picked by comparing WCAG contrast against the two inks the stylesheet ships, exported as `onFillInk`. It is compared rather than thresholded because a lightness cut-off picks wrong through the middle of the range: at `#615fff` a threshold takes the dark ink at 4.1:1 where the light one gives 4.6:1. A color the picker cannot read, such as a function notation, still sets the fill and leaves the ink to the stylesheet default.

The `slate` and `warm` presets follow the same rule with their own colors, since choosing a preset is also a host declaring a look.

**Set nothing and nothing changes.** Every default is byte-identical to 0.5.0.

### An accent fill can carry a label

`accent` was the only colour token without an ink partner, so any state that filled with it and carried a label could not follow it safely: a pale brand accent under the default light ink is unreadable. New `accentForeground` (`--frayme-accent-fg`) completes the pairing. Leave it out and the ink is picked by comparing contrast against the accent, exactly as `primaryForeground` is picked against `primary`.

The label on an accent fill now reads `var(--fr-<c>-accent-text, var(--fr-accent-ink, var(--color-card)))`, so it follows the colour that actually filled it. That lets the selected day, the current page, a selected option, a completed step, an unread marker and the annotator's active chips follow `accent`.

A component's OWN accent owns its ink. When a spec sets `accent`, its label ink is derived from that colour, which also fixes a case that was already unreadable: a pale spec accent with no `accentText`. If the colour cannot be read (a named colour, `oklch()`), the ink is pinned to `card` rather than falling through to an ink made for a different colour.

Seven focus rings mixed the accent at 40% and measured 2.53:1 in light mode against a 3:1 floor. They now use 50% (3.38:1), which twenty other rings already did.

**Set nothing and nothing changes.** Every default is byte-identical.

### A chatless press composes the next screen too

`FraymeScreen`'s and `useFraymeScreen`'s `continue(event, prompt?, extra?)` no longer sends `mode`, `prior_spec` or `action_context`. It sends a create: a prompt naming the control that was pressed, and the pressed action's params as `data`, over the props' own `data`.

It derives only what you did not give it. Pass your own `prompt` and it is used; name `data` in `extra` and the derived values are left out entirely, because your code knew better.

Two details worth knowing. The event's raw `state` is never sent: it is the whole screen's store, it is what made a press many kilobytes, and it reached no prompt anyway. And the control's own `label` and `description` are stripped out of the derived `data`, because they name the control rather than the data, and a `data` key the composer does not use is drawn on the screen as a stray detail.

`edit(prompt)` is unchanged and still sends the last complete screen as `prior_spec`, which is the one request that legitimately carries a screen. See `@frayme/api` 0.6.0 for the measurements behind this.

### Fixed: a checked box ignored the accent token

`Checkbox` and `Radio` set `accent-color` from `var(--fr-<c>-accent, var(--color-foreground))`, skipping the global `--fr-accent` knob that the same file documents as the chain and that `Switch` and `Slider` already honored. A host that set `accent` got a colored switch and slider and a near-black tick. Both now chain through `--fr-accent`, and tests pin the chain in both directions so it cannot regress unnoticed.

No visual change unless `accent` is set, because the knob's own default is the foreground.


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
