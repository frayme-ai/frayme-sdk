'use client';
/**
 * @frayme/runtime/react — render Frayme specs as live, interactive React UI.
 *
 *   import { FraymeRenderer } from '@frayme/runtime/react';
 *   import '@frayme/runtime/styles.css';
 *
 *   <FraymeRenderer spec={spec} onDynamicAction={(e) => sendToAgent(e)} />
 */
export { FraymeRenderer, type FraymeRendererProps } from './FraymeRenderer.js';
// The thread card for a fired action: the control's
// label, the host's description, a params table — themed like the renderer.
export { FraymeActionReceipt, type FraymeActionReceiptProps } from './action-receipt.js';
export { FraymeProvider, useFrayme, type FraymeContextValue } from './FraymeProvider.js';
export {
  useFraymeCompose,
  type UseFraymeComposeReturn,
  type ComposeStatus,
} from './useFraymeCompose.js';
export { defaultRegistry, createRegistry, Fallback } from './registry/index.js';
export { useIntrinsicEmit, IntrinsicProvider, type EmitWith, type EmitWithOptions } from './intrinsic.js';
// The carrier gate: the default list (spread it into `dynamicActionTypes` to
// widen), the pure decision helper, the static per-binding/per-verb predicate a
// custom renderer's own latch can share, and the context it reads the list from.
export {
  DEFAULT_DYNAMIC_ACTION_TYPES,
  decideDynamicDispatch,
  hasLiveBinding,
  bindingDispatches,
  verbDispatches,
  type DynamicDispatchDecision,
  type DynamicDispatchReason,
} from '../core/dynamic-gate.js';
export { DynamicGateContext, useDynamicGateTypes } from './dynamic-gate.js';
export type { ComponentRegistry, ComponentRenderProps, ComponentRenderer } from './upstream.js';
export type { DynamicActionEvent, OnDynamicAction } from '../core/events.js';
export type { ThemeTokens } from '../core/theme.js';

/* ── BYOC (custom components) ─────────────────────────────────────────────── */
export {
  createCustomComponents,
  type CustomComponentEntry,
  type CustomComponents,
} from './custom.js';
// Author kit — the house helpers a custom renderer needs to look/behave like a
// built-in (state binding, value channels, class merge, icons, URL safety).
export { useLocalOrBound } from './registry/_state.js';
export { styleVars } from './registry/_style.js';
export { cn } from './cn.js';
export { Icon, hasIcon, ICON_NAMES } from './registry/icons.js';
export { safeUrl, safeImageSrc } from './registry/url-safety.js';
export { safeColor, safeDimension } from '@frayme/catalog/validate';
