/**
 * @frayme/runtime — server-safe core.
 *
 * React renderer:        import { FraymeRenderer } from '@frayme/runtime/react'
 * Vercel AI SDK adapter: import { FraymeMessageRenderer } from '@frayme/runtime/ai-sdk'
 * AG-UI adapter:         import { FraymeAgUiRenderer } from '@frayme/runtime/ag-ui'
 * Styles:                import '@frayme/runtime/styles.css'
 */
export { validateFraymeSpec, type ValidateResult } from './core/validate.js';
export { resolveInitialState, mergeOnRehydrate } from './core/state-policy.js';
export type { DynamicActionEvent, OnDynamicAction } from './core/events.js';
export { dispatch } from './core/dispatch.js';
export type {
  ActionSpec,
  AgentSpec,
  ComposeLike,
  DefaultActionKind,
  DispatchDeps,
  FraymeActionContext,
  FraymeActionMap,
  HostSpec,
  HostTransport,
  LocalSpec,
  RecomposeSpec,
  SpecActionMap,
  SpecActionSpec,
} from './core/handlers.js';
export { themeToStyle, type ThemeTokens } from './core/theme.js';
export {
  threadText,
  humanizeName,
  humanizeKey,
  formatValue,
  isBlank,
  type ThreadTextOptions,
} from './core/thread-text.js';
// The state half of the text path (the agent reads
// name + params + STATE): a compact "Also recorded" block of the local gestures
// in `state._ui` and the bound values, appended under `threadText` by the AI
// SDK forwarder's default `sendMessage` text. The card still hides state.
export { threadState, type ThreadStateOptions } from './core/thread-state.js';
// The thread card's pure model: title = the control's
// label verbatim else the humanized action name, the host's description or none,
// a key/value table of the params. react/action-receipt.tsx is the DOM.
export {
  receiptModel,
  type ReceiptEvent,
  type ReceiptModel,
  type ReceiptModelOptions,
  type ReceiptRow,
} from './core/receipt.js';
export { composeStreamToDataParts } from './core/ai-bridge.js';
export {
  cutChildCycles,
  cutChildCyclesWithReport,
  type CutChildCyclesResult,
  type DroppedChildEdge,
} from './core/child-cycles.js';
export {
  createIntrinsicSlots,
  mergeIntrinsicParams,
  JSON_RENDER_BUILTIN_ACTIONS,
  type IntrinsicSlots,
  type IntrinsicEntry,
  type IntrinsicEventPayloads,
  type IntrinsicAffordance,
} from './core/intrinsic.js';
// The carrier gate — which controls may dispatch a declared action out of the
// renderer (default: the press-shaped set + Form + DataTable, and any row/bulk
// action button; `live: true` opts a binding out).
export {
  DEFAULT_DYNAMIC_ACTION_TYPES,
  decideDynamicDispatch,
  hasLiveBinding,
  hasAnyLiveBinding,
  declaresItemActions,
  bindingDispatches,
  verbDispatches,
  type DecideDynamicDispatchInput,
  type DynamicDispatchDecision,
  type DynamicDispatchReason,
} from './core/dynamic-gate.js';

// Re-export the json-render spec type so app code consumes it via the SDK
// instead of importing @json-render/core directly.
export type { Spec } from '@json-render/core';
