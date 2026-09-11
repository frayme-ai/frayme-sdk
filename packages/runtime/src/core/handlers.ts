/**
 * Declarative action handlers (the SDK-as-a-black-box layer).
 *
 * The consumer maps each spec-bound action name to a KIND instead of writing a
 * `switch` in `onDynamicAction`. The kinds compile into json-render's native
 * `handlers` map (see ./dispatch + FraymeRenderer) — Frayme adds the vocabulary,
 * json-render runs the pipeline (resolveAction → confirm → handler → onSuccess).
 *
 * PUBLIC core: this module imports ONLY `./events` (+ structural types). NO
 * @json-render/react, NO postMessage, NO MCP/SEP-1865 — those stay in the
 * private @frayme-ai/{embed,mcp} surfaces, which inject `hostTransport`.
 */
import type { Spec } from '@json-render/core';
import type { DynamicActionEvent, OnDynamicAction } from './events.js';

/**
 * Context each handler closes over. `params` arrive ALREADY `$state`-resolved by
 * json-render's resolveAction, so handlers see plain values.
 */
export interface FraymeActionContext {
  /** The action name that fired. */
  action: string;
  /**
   * The canonical verb that fired this dispatch, when known from the renderer's
   * intrinsic slot (emitWith). Programmatic/host dispatches leave it unset and
   * the spec-scan heuristic (eventForAction) remains the fallback.
   */
  event?: string;
  /**
   * The spec id of the element that fired, from the same intrinsic slot as
   * `event`. Lands on the host as `DynamicActionEvent.element_id`. Unset for
   * programmatic dispatches (there is no element).
   */
  elementId?: string;
  /**
   * The pressed control's label, verbatim, when the fire named one (see
   * `DynamicActionEvent.label`). Resolved by the renderer's Proxy from the
   * intrinsic payload or the host's row / bulk action list; unset when unknown.
   */
  label?: string;
  /**
   * The action's description — the host's `actionContract` declaration first,
   * then `spec.actions[name].description` (see `DynamicActionEvent.description`).
   * Unset when neither source gave a non-blank string.
   */
  description?: string;
  /** Write a state value by JSON Pointer (adapts the controlled store). */
  setState: (path: string, value: unknown) => void;
  /** The live state snapshot. */
  getState: () => Record<string, unknown>;
  /** The current full spec — `recompose` prior_spec + host payloads read this. */
  getSpec: () => unknown;
  /** The fallback sink (=== onDynamicAction). `agent` kind delegates here. */
  emitDynamic: OnDynamicAction;
  /** Aborts when the same action fires again (re-entrancy guard). */
  signal: AbortSignal;
}

/** Deterministic client-side handler (e.g. open an external URL, copy to clipboard). */
export interface LocalSpec {
  kind: 'local';
  run: (params: Record<string, unknown>, ctx: FraymeActionContext) => unknown | Promise<unknown>;
}

/**
 * WHY EVERY SPEC-AUTHORABLE KIND CARRIES `description`. The
 * platform binder stamps the host's declared `description` onto
 * `spec.actions[name]` alongside the kind — the same declaration it sent to
 * compose — and `validateSpec` accepts the extra key there.
 * The renderer's automatic confirm modal already reads it for its message
 * (FraymeRenderer.normalizeSpecProps); with the receipt card the dispatched
 * event (`DynamicActionEvent.description`) and the thread card
 * (react/action-receipt.tsx) read it too, so the type says what the wire has
 * carried all along. Optional, data only — never a handler, never validated.
 * The same field on a CONSUMER `actions` map entry (`FraymeActionMap`) is read
 * as well — between `actionContract` and the spec copy (core/action-enrich.ts
 * `resolveActionDescription`) — so a host that routes through a
 * map and writes `description` there is not handed the stamped text instead.
 */

/** Re-compose the canvas in place (calls compose with prior_spec; morphs via onRecompose with a state merge). */
export interface RecomposeSpec {
  kind: 'recompose';
  prompt: string | ((ctx: FraymeActionContext) => string);
  mode?: 'edit' | 'continue_journey';
  /** What the action does, in the host's words (server-stamped from its `ActionDecl`). */
  description?: string;
}

/** Route the action to the consumer's agent (the chat loop / fallback sink). */
export interface AgentSpec {
  kind: 'agent';
  format?: (event: DynamicActionEvent) => DynamicActionEvent;
  /** What the action does, in the host's words (server-stamped from its `ActionDecl`). */
  description?: string;
}

/** postMessage out to the host (MCP App iframe). Transport is INJECTED, not in the spec. */
export interface HostSpec {
  kind: 'host';
  channel?: string;
  /** What the action does, in the host's words (server-stamped from its `ActionDecl`). */
  description?: string;
}

export type ActionSpec =
  | LocalSpec
  | RecomposeSpec
  | AgentSpec
  | HostSpec
  // sugar: a bare function is treated as { kind: 'local', run }.
  | ((params: Record<string, unknown>, ctx: FraymeActionContext) => unknown | Promise<unknown>)
  // explicit deny: render the control inert.
  | false;

/** Per-action handler map. Keys are spec action names; also acts as the allow-list. */
export type FraymeActionMap = Record<string, ActionSpec>;

/**
 * The subset of kinds that can be authored INTO a spec's `/actions` block by the
 * Modal — pure DATA only. `local` is excluded: it carries a `run` function that
 * can't be serialized into a spec, so imperative handlers ship with the catalog
 * (withDefaultHandlers), never the spec. `false` is allowed (a declarative deny).
 */
export type SpecActionSpec = RecomposeSpec | AgentSpec | HostSpec | false;

/**
 * A spec-embedded handler map — the `actions` block the Modal emits alongside the
 * UI it built (`{"op":"add","path":"/actions/<name>","value":{kind,…}}`). The
 * consumer no longer hardcodes per-action behavior; the spec that built the UI
 * declares what each action does. The runtime reads this and folds it into the
 * native handlers map (consumer `actions` prop overrides it per-name).
 */
export type SpecActionMap = Record<string, SpecActionSpec>;

/**
 * The two blanket-able defaults for unmapped actions. `local`/`recompose` need
 * per-action config, so they are never a blanket default.
 *  - `agent` — forward to onDynamicAction (Interactive Chat default).
 *  - `host`  — postMessage to the host (Chatless / MCP default).
 */
export type DefaultActionKind = 'agent' | 'host';

/**
 * Minimal compose client — a structural subset of `@frayme/api`'s
 * `frayme.compose` so the consumer can pass it directly: `compose={frayme.compose}`.
 * `stream?: false` pins the non-streaming overload; `prior_spec?: Spec` matches
 * the wire type.
 */
export interface ComposeLike {
  create(req: {
    prompt: string;
    prior_spec?: Spec;
    mode?: 'edit' | 'continue_journey';
    data?: Record<string, unknown>;
    stream?: false;
  }): Promise<{ spec: unknown }>;
}

/** Carries the action's payload to the host iframe bridge. */
export interface HostTransport {
  send: (channel: string | undefined, payload: DynamicActionEvent) => void | Promise<void>;
}

/**
 * Transport-agnostic deps the RENDERER injects (never the spec). Keeping these
 * out of the spec is what keeps the public core free of compose/MCP coupling.
 */
export interface DispatchDeps {
  /** Enables `recompose`. Omit for local/agent/host-only UIs. */
  compose?: ComposeLike;
  /** Where a recompose result lands — the spec OWNER's setter, NOT the renderer. */
  onRecompose?: (nextSpec: unknown, opts: { state: 'merge' | 'restart' }) => void;
  /** Enables `host` (injected by @frayme-ai/{embed,mcp}); undefined → host throws. */
  hostTransport?: HostTransport;
}
