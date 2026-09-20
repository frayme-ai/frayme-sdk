# Changelog

Release notes for the Frayme SDK packages, each versioned independently, following semver.

## Current versions

| Package | Version |
| --- | --- |
| `@frayme/api` | 0.6.0 |
| `@frayme/runtime` | 0.6.0 |
| `@frayme/catalog` | 0.4.1 |

## 0.6.0 (`@frayme/api`, `@frayme/runtime`) and 0.4.1 (`@frayme/catalog`)

A press composes the next screen fresh instead of editing the last one, and a passed `primary` colors every main action. Set nothing and nothing changes: every runtime default is byte-identical to 0.5.0.

### `@frayme/api`

- **A press is a create, not an edit.** `frayme_action` and `createActionTool` no longer attach `mode: 'continue_journey'`, `prior_spec` or `action_context`. A press is sent as a plain create: the prompt names what was pressed, `data` carries the values the next screen must show, and `actions` declares the controls that lead forward. Measured on one filled 16-field form with a 12-value press: the old shape produced a usable next screen in 0 of 2 runs, the new one in 2 of 2 with all 12 values shown, and on a large table the press body went from over 5 KB to under 200 bytes.
  - `prior_spec` reached the composer as an instruction to edit the existing screen in place, which answered a press by handing the same screen back. `action_context` reached no prompt at all.
  - `prior_spec` is unchanged for `mode: 'edit'`, the one request that legitimately carries a screen. `frayme_compose` with `edit_of` still attaches the earlier screen.
  - Two rules the tool descriptions and examples now teach: press meta goes in the prompt, never in `data` (a `data` key the composer does not use is drawn on the screen), and declare forward actions only, never the control just pressed (re-declaring it with required params puts the form the next screen was meant to replace back).
- `VERSION` is `0.6.0`.

### `@frayme/runtime`

- **A passed `primary` colors every main action.** The button family fills from `var(--fr-btn-fill, var(--color-foreground))`, so the neutral high-contrast default stands until a host passes `primary` through the `theme` prop. Then `Button variant:"primary"`, a `Link` rendered as a button, a pressed `ButtonGroup` segment, `IconButton`, a hero CTA, a dialog's confirm, a Kanban card action, the chat send control and a choice-list submit take it. `secondary`, `danger`, `ghost` and `outline` are untouched, and the interactive states stay with `accent`.
  - The label ink comes from `primaryForeground` when one is passed, and is otherwise picked by comparing WCAG contrast against the two inks the stylesheet ships, exported as `onFillInk`. The `slate` and `warm` presets follow the same rule with their own colors.
  - The confirm modal's main button wears the same fill as the button that opened it, and a press on a danger control gets a danger guard.
- **An accent fill can carry a label.** New `accentForeground` token (`--frayme-accent-fg`) pairs with `accent`; left out, the ink is picked by contrast against the accent. A component's own `accent` owns its ink, which also fixes a pale spec accent with no `accentText`. Seven focus rings that mixed the accent at 40% now use 50% (3.38:1), as twenty others already did.
- **A chatless press composes the next screen too.** `FraymeScreen`'s and `useFraymeScreen`'s `continue(event, prompt?, extra?)` no longer sends `mode`, `prior_spec` or `action_context`. It sends a create: a prompt naming the pressed control, and the pressed action's params as `data`, over the props' own `data`. Pass your own `prompt`, or `data` in `extra`, and it is used as given. The event's raw `state` is never sent. `edit(prompt)` is unchanged and still sends the last complete screen as `prior_spec`.
- A control inside a `FormField` that repeats the field's caption keeps it as its accessible name only, so the label is not printed twice.
- Fixed: `Checkbox` and `Radio` set `accent-color` without reading the global `--fr-accent` knob that `Switch` and `Slider` already honored, so a host that set `accent` got a near-black tick.
- `@frayme/runtime` now depends on `@frayme/api` `^0.6.0`.

### `@frayme/catalog` 0.4.1

- Prop descriptions corrected where they named a default the renderer does not have: `accent` and `accentText` on the action family and on `Link`, `accent` on the field family, and `Button.variant` `primary`, now described as a solid neutral high-contrast fill. No schema, enum or validation behaviour changes.

### Upgrade notes

- If you already pass `prompt`, `data` and `actions` on a press, nothing changes. If you forwarded only the event and relied on the server continuing from the screen, name the values in `data`, or the next screen will not show them.

## 0.5.0 (`@frayme/api`, `@frayme/runtime`)

Frayme now plugs into the host agent's own chat, and it can also run with no chat at all. `@frayme/catalog` hasn't changed and stays at 0.4.0.

### `@frayme/api`

- **`@frayme/api/ai-sdk`**: `fraymeTools({ messages })` gives a Vercel AI SDK 6 agent `frayme_compose` and `frayme_action`, plus `lookup_intent` and `query_source` when you pass `intents` or `sources`. See [@frayme/api/ai-sdk](../sdk/api-ai-sdk.md).
  - **Streaming:** the screen streams to the UI as preliminary tool outputs, at most one snapshot every 250 ms by default. The model sees only `{ generation_id, status, operation_count }`.
  - **One compose per turn:** only a retryable failure hands the turn back, such as a 400 or 422, a server or network failure, or a refusal the model can correct. A bad key, a plan limit, a rate limit, `CLIENT_ERROR` or an abort keep it. A turn that continues in a new request, after a tool approval or a client-side tool, keeps the compose it already spent.
  - **Refusals:** a call turned down before composing comes back to the model with `refused: true`, and the UI draws nothing for it. The refusal codes are `NO_PRESS`, `PRESS_MISMATCH`, `PRESS_INVALID`, `UNKNOWN_SCREEN`, `SCREEN_TOO_LARGE` and `ONE_COMPOSE_PER_TURN`. `CLIENT_ERROR` marks a setup error, such as a missing key.
  - **Earlier screens:** the model names one with `edit_of`, and it is read only from the finished outputs of Frayme's own tool calls. A spec the model wrote is never used. An edit the server rejects ends in an error instead of a silent new screen.
  - **Presses:** a press is read from the user's last message, and the page's event wins over the model's copy. Only the action name must be valid.
  - **Without `messages`:** there is no `edit_of`, each screen is described in full, and `frayme_action` forwards the call as written.
  - **Setup rules:** `custom_components` is never offered to the model. Create the tools per request, pass the UI messages exactly as posted, and always call `convertToModelMessages(messages, { tools })`. Without `{ tools }`, the full spec reaches the model.
  - **Trust:** messages and presses come from the client, so they are the user's own data, and the server validates every spec and action. The tools guarantee that the model can't write a press, a screen or a `prior_spec`.
- **`@frayme/api/agent`**: the framework-neutral core behind those tools (intents, sources, compose as a sequence of outputs, press helpers), for wiring other frameworks. It includes `composeErrorRetryable(error)`, which decides whether a failed compose may be retried this turn. `fraymeModelView` tells the model whether an error is `retryable`, and when the prior screen was dropped. See [@frayme/api/agent](../sdk/api-agent.md).
- **`@frayme/api/server`**: `createFraymeHandler({ authorize })` is a ready-made compose proxy for your own route, so a browser client never holds a key.
  - It checks authorization, content type, body size and allowed fields, and sets `action_policy` on the server.
  - It streams in the API's own format.
  - See [@frayme/api/server](../sdk/api-server.md).
- `ai` (`^6.0.0`) is an optional peer, needed only for `@frayme/api/ai-sdk`.
- `frayme_action` takes `data`, `actions` and `signals` for the next screen, and `createActionTool` sends them as top-level request fields.
- **Size limits:** the API refuses a request whose serialized `data` or `prior_spec` is over 48,000 characters, or whose `action_context` is over 16,000. A table's row action carries every row, so one press can go over.
  - New root exports: `COMPOSE_DATA_MAX_CHARS`, `PRIOR_SPEC_MAX_CHARS`, `ACTION_CONTEXT_MAX_CHARS`, `jsonSize(value)`, and `fitContinuation({ action_context, prior_spec })`. The last one drops a press's `state`, then its `params`, and leaves out an oversized screen, reporting what it left out in `trimmed`. The types `FitContinuationInput`, `FitContinuationResult` and `FraymeTrimmed` are exported too.
  - `createActionTool` and `frayme_action` fit the request before sending. Outputs carry `trimmed`, and the model is told what was left out.
  - An `edit_of` edit of a screen that is too large is refused with `SCREEN_TOO_LARGE`. With `continue_journey`, the screen is left out.
  - See [request size limits](../sdk/api.md#request-size-limits).
- The `frayme_compose` `actions` schema keeps `requiredItems`. It used to drop the field without an error.
- New `ComposeStream.snapshot()`: a deep copy of the spec so far, safe to keep.
- In-band stream errors with the codes `SERVICE_UNAVAILABLE`, `INVALID_MANIFEST`, `CUSTOM_SLICE_TOO_LARGE` and `FEATURE_LIMIT` now become the matching error class instead of `InternalServerError`.
- `compose.stream()` handles a `prior_spec` it can't copy by aborting the request it started and throwing, with no unhandled rejection left behind. A request body that isn't an object fails as a typed error on the stream.
- `VERSION` now matches the package version.

### `@frayme/runtime`

- **`<FraymeResult/>`** renders one Frayme tool result in your chat, whether it's a live snapshot, the validated screen, an error or interruption notice, or the receipt card for a press.
  - It pairs with **`fraymePart(part, message)`** and **`pressMessage(event)`** from `@frayme/runtime/ai-sdk`.
  - It draws nothing for a refused output. The live snapshot takes typed input but no presses.
  - `interactive={!busy}` keeps the finished screen from sending a press while the agent is still answering.
  - `fraymePart` hides refused outputs, and hides errors the model already retried in the same message.
- `FraymeRenderer` with `interactive={false}` records nothing for a click, so no control is latched when the screen turns interactive. `IntrinsicSlots` gains a required `drop(action)` method.
- **`<FraymeScreen/>`** and **`useFraymeScreen()`** compose a screen straight from props, with no chat. The handle has `edit`, `continue`, `retry` and `abort`, and `continue` fits the press and the screen to the size limits. See [Chatless screens](../guides/chatless-screens.md).
- `FraymeProvider` takes `endpoint`, the route that holds your key, and builds the keyless client for you.
- Light and dark: a `scheme` prop (`light`, `dark`, `system`), `{ light, dark }` token pairs on every `theme` prop, `useColorScheme`, `resolveTheme` and `isThemePair`. See [Theming](../guides/theming.md).
- `ThemeTokens` gains `accent`, and the success, warning and info foreground tokens now take effect.
- `SPEC_DATA_PART_TYPE` is also exported from the server-safe root.
- `composeStreamToDataParts` clears the screen with an empty flat part when a compose fails.
- `useFraymeCompose` returns `generationId` and hands out a new spec object on every op.
- `<FraymeMessageRenderer/>` no longer patches the message parts stored in the chat.

### Upgrade notes

- `theme` props and `FraymeContextValue.theme` are now typed `ThemeInput` (a token set or a pair). If your code reads `useFrayme().theme` as `ThemeTokens`, narrow it with `isThemePair` or `resolveTheme`.
- `themeToStyle` returns no properties for a pair. Resolve the pair first with `resolveTheme(theme, mode)`.
- Presses sent as `__frayme_action__:` text still work with `fraymeTools`. `pressMessage` is the new way to send them.
- If you implement `IntrinsicSlots` yourself, add `drop(action)`.

## 0.4.0 (all three packages)

### `@frayme/api`

- `ComposeRequest` gained `signals`, and `ComposeAction` gained `role`, `live`, `confirm` and `requiredItems`.
- Tool definitions:
  - The `actions` contract documents which controls call back, and the carrier button.
  - `role` is back on the actions schema.
  - `frayme_compose` has two new worked examples, and `frayme_action` has its first.
  - `createComposeTool` and `createActionTool` attach `inputExamples`.
  - `frayme_action` accepts `element_id`, `label` and `description`.
- New `anthropicToolDefinitions()`, for raw Anthropic SDK users.

### `@frayme/runtime`

- Dynamic-action gate: only press-shaped controls dispatch out of the renderer. Those are `Button`, `IconButton`, `Fab`, `Confirmation`, a `Form` submit, `DataTable`, and row or bulk action buttons.
  - Every other declared action stays local and is mirrored at `state._ui.<elementId>.<verb>`.
  - `live: true` on a binding opts out of the gate, and the `dynamicActionTypes` prop widens the list.
  - A denied dispatch is silent: no error, no confirm, no disabled control.
- `DynamicActionEvent` gained `element_id`, `label` and `description`, and `FraymeRenderer` has a new `actionContract` prop.
- New `<FraymeActionReceipt/>` and `receiptModel()`: the card a host shows in the thread when a control fires.
- New `threadState()`. The default text from `createDynamicActionForwarder` is now `threadText` plus the `threadState` block. `includeState: false` goes back to the name and params only.
- `SpecActionSpec` carries `description`.

### `@frayme/catalog`

- `CATALOG_VERSION` is now `frayme-0.19.0`.
- Action declarations may carry a `description`. The runtime reads `spec.actions[name].description` for confirm dialogs, action events and receipts.
- `validateSpec` no longer reports reads of the runtime-written `/_ui/...` state mirror as dead pointers.
- Vocabulary:
  - `DropdownMenu` emits `commit`.
  - `KanbanBoard` and `KanbanCard` gained `rowActions` and `commit`.
  - `DataTable` columns gained `format`, `prefix` and `suffix`, and its row and bulk actions gained `confirm` and `disabled`.
  - `headerColor` is now `headerTextColor` on `Table`, `EditableSpreadsheetGrid` and `PermissionMatrix`.
  - `DatePicker` and `DateRangePicker` gained `mode` (default `popover`).
- **Breaking:** the JSONL-ops entry point on `@frayme/catalog/validate` is now `validateOps`, which returns `OpsValidationResult`. The previous names of these two exports are gone, with no alias. Behaviour and options are unchanged. `^0.3.0` ranges don't pick up this release.

## 0.3.2 (`@frayme/api`, `@frayme/runtime`)

Republish with corrected internal dependency ranges. No functional changes, so upgrade freely.

## 0.3.0: Initial public release

The first public release of the Frayme SDK, MIT licensed, ESM, Node ≥ 20.19.

### `@frayme/api`

- Typed client for the Frayme compose API: `compose.stream()` (handlers, async iteration, snapshot accumulation, `finalSpec()`), `compose.create()`, `me()`, `health()`.
- Automatic retries with per-call idempotency keys (a retried success replays instead of re-billing) and typed `FraymeError` subclasses for the full error taxonomy.
- Framework-agnostic agent tool at `@frayme/api/tools`: one Zod v4 / Standard Schema definition that works in Vercel AI SDK 6, Mastra, LangChain.js, and OpenAI Agents.

### `@frayme/runtime`

- `<FraymeRenderer/>` (`@frayme/runtime/react`) renders validated Frayme specs with the built-in component registry; local-first interactions, spec-declared named actions surfacing via `onDynamicAction`.
- Transport adapters: Vercel AI SDK (`/ai-sdk`, with `<FraymeMessageRenderer/>` and `composeStreamToDataParts()`) and AG-UI (`/ag-ui`, with `useFraymeAgUiSpec()` and `<FraymeAgUiRenderer/>`).
- Themeable via `--frayme-*` CSS variables (`@frayme/runtime/styles.css`); unknown component types render an inert fallback.

### `@frayme/catalog`

- The full Frayme component vocabulary as Zod schemas. `CATALOG_COMPONENT_COUNT` reports the current size (189). Zero React dependencies.
- Public spec validation via `fraymeCatalog.validate()`: catalog prop-checking plus json-render referential integrity.
- Tiered LLM prompt generation via `fraymeCatalog.prompt()`, versioned by `CATALOG_VERSION`.

## Versioning stance

- Packages version independently: a runtime release doesn't bump the client.
- Pre-1.0, minor versions may include breaking changes; each is called out here.
- The API itself is path-versioned separately from the SDK. See the [API versioning stance](../api/README.md#versioning-stance).

For the commit-level history, see each package's `CHANGELOG.md` in the [GitHub repository](https://github.com/frayme-ai/frayme-sdk).
