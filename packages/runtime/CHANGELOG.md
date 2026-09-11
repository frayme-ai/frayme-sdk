# @frayme/runtime

## 0.4.0

- Dynamic-action gate: only press-shaped controls (`Button`, `IconButton`, `Fab`, `Confirmation`, a `Form` submit, `DataTable`, and row/bulk action buttons) dispatch out of the renderer; every other declared action stays local and is mirrored at `state._ui.<elementId>.<verb>`. `live: true` on a binding opts out; the `dynamicActionTypes` prop widens the list. Denied dispatches are silent — no error, no confirm, no disabled control.
- `DynamicActionEvent` gained `element_id`, `label` and `description`; new `actionContract` prop on `FraymeRenderer`.
- New `<FraymeActionReceipt/>` and `receiptModel()` — the card a host shows in the thread when a control fires.
- New `threadState()`; `createDynamicActionForwarder` text default is now `threadText` + the `threadState` block (`includeState: false` restores name + params only).
- `SpecActionSpec` carries `description`.

## 0.3.2

- Republish with corrected internal dependency ranges.

## 0.3.0 — Initial public release

- `<FraymeRenderer/>` (`@frayme/runtime/react`) — renders validated Frayme specs with the built-in component registry; local-first interactions, spec-declared named actions surface via `onDynamicAction`.
- Transport adapters: Vercel AI SDK (`/ai-sdk` — `<FraymeMessageRenderer/>`, `composeStreamToDataParts()`) and AG-UI (`/ag-ui` — `useFraymeAgUiSpec()`, `<FraymeAgUiRenderer/>`).
- Themeable via `--frayme-*` CSS variables (`@frayme/runtime/styles.css`); unknown component types render an inert fallback.
