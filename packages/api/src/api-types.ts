import type { Spec } from '@json-render/core';

/**
 * How the server should RESPOND when a declared action fires — the kind layer the
 * server synthesizes into `spec.actions`. `recompose` re-generates with a fixed
 * `prompt`; `agent` (default) routes the event back to the host agent; `host`
 * postMessages to a `channel`; `false` denies (inert).
 */
export type ComposeActionKind = 'recompose' | 'agent' | 'host' | false;

/**
 * A declared action — Frayme guarantees a button bound to it (server-side
 * action contract). Param keys bind to live UI state; the agent receives the
 * resolved values when the button is pressed.
 *
 * Structurally a superset of `ActionDecl` in `@frayme/catalog/validate` (the
 * server-side validator's type) — kept as a separate name so the lean client
 * SDK needn't depend on the catalog package. Keep the two in lockstep (the
 * platform exercises the assignability ComposeAction → ActionDecl).
 */
export interface ComposeAction {
  /** Bound action name, e.g. "approveRefund". */
  name: string;
  /**
   * The action's params. FOUR FIDELITY TIERS ARE ACCEPTED, because a host should not
   * have to write JSON Schema to declare "this action takes an amount":
   *
   *   1  JSON-Schema wrapper  { type:"object", properties:{ amount:{ description } } }
   *   2  flat map            { amount: { description, enum? } }        <- documented shape
   *   3  names only          { amount: {} }  or  ["amount","note"]
   *   4  omitted             params undefined — the action takes none
   *
   * Tier 2 is what the tool JSON's own examples show, and what most hosts send.
   * Measured: the wrapper costs 354 bytes where tier 3 costs 90 for the same
   * information the model actually uses.
   *
   * NO PER-PARAM `type`. A JSON type selects no control (`string` says nothing
   * about the widget) and routinely contradicts the name it sits beside (a date
   * param typed `string`). `enum` is the one real control signal and is not a type.
   * Send a `description` instead; it is what the runtime shows in the confirm.
   *
   * An array is normalised to tier 3 on receipt. Reading tiers is centralised in
   * `normalizeActionParams` so every consumer agrees on what a declaration contains.
   */
  params?: Record<string, unknown> | string[];
  /** Names of the params that are MANDATORY. Action level, NOT `params.required` —
   *  the JSON-Schema wrapper buried it a level below the keys it describes, and tiers
   *  2-4 have nowhere to put it at all. */
  requiredItems?: string[];
  /** Short human word or label naming the control that fires this action, e.g.
   *  "approve" or "Save board" (≤ ACTION_ROLE_MAX_CHARS). Wherever Frayme has to
   *  place or inject the control itself — including the carrier button injected
   *  when the action is wired only to a non-press component — this label beats
   *  the fallback: name-derived where Frayme places a control, but "Done" on a
   *  carrier injected for a gesture host (the move / pick already happened; the
   *  binder humanises `name` there only when every host verb is `commit`, or
   *  when two carriers on one screen would both read "Done"). Mirrors the
   *  `frayme_compose` tool schema. */
  role?: string;
  /** If true, a button bound to this action is guaranteed present (injected if missing).
   *  About the ACTION, not its params — see `requiredItems`. */
  required?: boolean;
  /** THE CARRIER RULE's per-action opt-out (runtime core/dynamic-gate.ts).
   *  Default false: only a press fires the action; every other gesture
   *  stays local under `state._ui.<elementId>.<verb>` and rides in the next
   *  press's `state`. true = ambient wiring — fires on every move/change with no
   *  button press. */
  live?: boolean;
  /** Gate the control behind a confirmation dialog: `true` for a plain confirm,
   *  or a detail object (≤ 800 chars serialized) — `{tone, body, title,
   *  confirmLabel, denyLabel}` are what the prompt serializer reads; unknown keys
   *  are ignored, not rejected. */
  confirm?: boolean | Record<string, unknown>;
  /** What this action means / what the user did — for the caller's own handling. */
  description?: string;
  /** How the server self-closes this action into `spec.actions` (default `agent`). */
  kind?: ComposeActionKind;
  /** `recompose` only — the fixed prompt the server recomposes with when fired. */
  prompt?: string;
  /** `host` only — the postMessage channel name (host transport). */
  channel?: string;
}

/**
 * What the user just did on a Frayme-rendered UI — sent back to `/v1/compose`
 * (with `mode:'continue_journey'`) so the next compose responds IN CONTEXT of the
 * fired action. Mirrors the runtime's `DynamicActionEvent`.
 */
export interface ComposeActionContext {
  /** The bound action name the user fired. */
  action: string;
  /** The canonical event verb that fired (commit/select/change/…). */
  event?: string;
  /** Resolved params (the live UI-state values) at fire time. */
  params?: Record<string, unknown>;
  /** Full live state snapshot — what the user entered; preserved across the recompose. */
  state?: Record<string, unknown>;
  /** The element id that fired, if known. */
  element_id?: string;
  /** The generation_id of the UI the user acted on (correlation). */
  generation_id?: string;
}

/**
 * Steering signals for a compose — the vocabulary the model reads directly, so
 * these values genuinely move the output. Send only the ones you are confident
 * about: a partial object (or none at all) is a first-class call, and a wrong
 * signal steers worse than a missing one. Mirrors the `frayme_compose` tool
 * schema. Theme is NOT a signal — it is `context.theme`.
 */
export interface ComposeSignals {
  /** What the content IS — one or more of: avatar, board, bracket, calendar,
   *  cards, chart, citations, code, diff, document, feed, filters, form, image,
   *  link-preview, list, map, plans, reasoning, table, thread, timeline, tree,
   *  video. */
  data_shape?: string[];
  /** How much per screen: `compact` terse scanning · `standard` · `rich`
   *  generous detail and supporting copy. Often the one value that separates a
   *  scanning grid from a card list. */
  density?: 'compact' | 'standard' | 'rich';
  /** Interaction furniture you want available: accordion, bulk-actions,
   *  collapsible, confirm-dialog, dialog, drawer, dropdown-menu, hover-card,
   *  multi-step, popover, row-actions, segmented-control, tabs, tooltip. */
  patterns?: string[];
  /** `neutral` — product-default styling · `branded` — lean into the colour and
   *  voice the prompt describes. */
  tone?: 'neutral' | 'branded';
}

/** Request body for POST /v1/compose. Field names match the wire exactly (snake_case). */
export interface ComposeRequest {
  /** 1–4000 chars. */
  prompt: string;
  /** Default true on the wire; the SDK sets it explicitly per call path. */
  stream?: boolean;
  context?: {
    /** THE theme dial — `light` or `dark` (≤ 40 chars). Omit to let the host
     *  decide. There is deliberately no `signals.theme`. */
    theme?: string;
    /** ≤ 60 chars. */
    framework_hint?: string;
  };
  /** 1–200 (server default 200). */
  max_operations?: number;
  /** The primary steering dial — see {@link ComposeSignals}. Omit the values you
   *  are unsure of. */
  signals?: ComposeSignals;
  /** create (default) | edit (pair with prior_spec) | continue_journey. */
  mode?: 'create' | 'edit' | 'continue_journey';
  /** Display facts the UI must render VERBATIM (names/prices/items); no ids/flags. */
  data?: Record<string, unknown>;
  /** Declared action contract — Frayme guarantees each required button is wired. */
  actions?: ComposeAction[];
  /** How model-authored actions beyond the declared contract are handled.
   * `open` (default) — allowed; the runtime forwards unmapped actions to the
   * host agent. `declared_only` — the server STRIPS every non-builtin action
   * the contract didn't declare (bindings, spec.actions entries, and buttons
   * whose only job was a stripped action), so the UI can never grow controls
   * the host didn't ask for. */
  action_policy?: 'open' | 'declared_only';
  /** The client's current spec; the server returns a minimal patch.
   * Accepts a plain object too so a `frayme_compose` tool input (where prior_spec
   * is an opaque JSON object) can be passed straight to `compose.create`; the
   * server validates it as a spec regardless. */
  prior_spec?: Spec | Record<string, unknown>;
  /** Round-trip — what the user just did (pair with `mode:'continue_journey'`). */
  action_context?: ComposeActionContext;
  /** BYOC — inline custom-component manifests for this request. Each entry is the
   * manifest object you author for `defineFraymeComponent` (its `.manifest` field,
   * or the same plain object). Validated server-side; render them in your app via
   * `createCustomComponents` from `@frayme/runtime`. */
  custom_components?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

/** One wired interaction in the returned UI — the "what can this UI do" summary
 * a host agent reads to know which actions it will receive. */
export interface ComposeInteraction {
  /** The element id carrying the binding. */
  element: string;
  /** Canonical verb for the on-key. */
  event: string;
  /** The bound action name. */
  action: string;
  /** The spec.actions handler kind, or null when unmapped/denied. */
  kind: string | null;
  /** The binding's params, or null when absent. */
  params: Record<string, unknown> | null;
}

/** Non-streaming result (the `data` payload of the success envelope). */
export interface ComposeResult {
  generation_id: string;
  spec: Spec;
  model: string;
  operation_count: number;
  validated: true;
  usage: Usage;
  replayed?: boolean;
  /** The wired interactions of the returned UI (absent on replay). */
  interactions?: ComposeInteraction[];
  /** Sorted unique component types used in the spec (absent on replay). */
  components_used?: string[];
}

/** GET /v1/me payload — note: this endpoint speaks camelCase on the wire. */
export interface Me {
  workspace: { id: string; name: string; slug: string };
  plan: {
    tierKey: string | null;
    monthlyGenerations: number;
    rateLimitPerMin: number;
    generationsRemaining: number;
    /** Maximum inline custom components (BYOC) allowed per compose request on
     *  this plan; 0 means BYOC is not available on the plan. */
    inlineComponentsLimit: number;
  };
}

/** GET /v1/health payload. */
export interface Health {
  status: 'ok';
  service: string;
  catalog_version: string;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

/**
 * Read any params fidelity tier into one shape: `{ name: schema }`.
 *
 * Exists so tier-reading lives in ONE place. It was previously open-coded per
 * consumer, and they did not agree: the catalog validator read both the wrapper and
 * the flat map, while the prompt serializer read ONLY `params.properties` — so a
 * host sending the documented flat form had its params silently rendered as NONE.
 *
 * THE WRAPPER TEST IS `type:"object"` AND an object `properties` — both, never
 * either. A param may legitimately be NAMED `properties` (a property-listing app has
 * one), and testing `'properties' in params` alone reads that flat declaration as a
 * wrapper and returns a single param called `description`.
 */
export function normalizeActionParams(
  params: ComposeAction['params'],
): Record<string, Record<string, unknown>> {
  if (!params) return {};                                        // tier 4
  if (Array.isArray(params)) {                                   // tier 3, array form
    return Object.fromEntries(params.filter((k) => typeof k === 'string').map((k) => [k, {}]));
  }
  if (typeof params !== 'object') return {};
  const w = params as { type?: unknown; properties?: unknown };
  if (w.type === 'object' && w.properties && typeof w.properties === 'object') {
    return { ...(w.properties as Record<string, Record<string, unknown>>) };   // tier 1
  }
  const out: Record<string, Record<string, unknown>> = {};       // tiers 2 and 3
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  }
  return out;
}

/** Required param names, from either the action level (preferred) or a tier-1
 *  wrapper's `params.required`. Both are read while hosts migrate. */
export function normalizeRequiredItems(a: Pick<ComposeAction, 'params' | 'requiredItems'>): string[] {
  if (Array.isArray(a.requiredItems)) return a.requiredItems.filter((s) => typeof s === 'string');
  const p = a.params;
  if (p && !Array.isArray(p) && typeof p === 'object') {
    const r = (p as { required?: unknown }).required;
    if (Array.isArray(r)) return r.filter((s): s is string => typeof s === 'string');
  }
  return [];
}
