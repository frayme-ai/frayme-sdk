'use client';
import type { Spec } from '@json-render/core';
import type { FraymeSpec, FraymeCatalogUnion } from '@frayme/catalog';
import { resolveEventKey } from '@frayme/catalog';
import type { ActionDecl } from '@frayme/catalog/validate';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type { OnDynamicAction } from '../core/events.js';
import { resolveActionDescription, resolveControlLabel } from '../core/action-enrich.js';
import { cutChildCycles } from '../core/child-cycles.js';
import { dispatch } from '../core/dispatch.js';
import type {
  ActionSpec,
  ComposeLike,
  DefaultActionKind,
  DispatchDeps,
  FraymeActionContext,
  FraymeActionMap,
  HostTransport,
  SpecActionMap,
} from '../core/handlers.js';
import { createIntrinsicSlots, mergeIntrinsicParams, JSON_RENDER_BUILTIN_ACTIONS } from '../core/intrinsic.js';
import { DEFAULT_DYNAMIC_ACTION_TYPES, bindingDispatches, decideDynamicDispatch } from '../core/dynamic-gate.js';
import { derefItemParams } from '../core/item-params.js';
import { mergeOnRehydrate, resolveInitialState } from '../core/state-policy.js';
import { themeToStyle, type ThemeTokens } from '../core/theme.js';
import { validateFraymeSpec } from '../core/validate.js';
import { useFrayme } from './FraymeProvider.js';
import { isDev } from './dev.js';
import { DynamicGateContext } from './dynamic-gate.js';
import { ElementTypesContext, ElementChildrenContext } from './element-types.js';
import { IntrinsicProvider } from './intrinsic.js';
import { ParamFreezeProvider, useParamOwners, useFocusFirstRequired } from './param-freeze.js';
import { RequiredGuardProvider } from './required-guard.js';
import { fraymeComputedFunctions } from './functions.js';
import { Fallback, createRegistry } from './registry/index.js';
import { JSONUIProvider, Renderer, createStateStore, useActions, type ComponentRegistry } from './upstream.js';
import { FraymeConfirmModal, type FraymeConfirmConfig } from './confirm-modal.js';
import { surfaceInk, surfaceSunken, surfaceField, surfaceMuted } from './registry/_style.js';

/**
 * Renders json-render's pending action-confirmation as a Frayme-styled modal. Any
 * spec action binding may carry `confirm: { title, message, confirmLabel?,
 * cancelLabel?, variant? }`; json-render's ActionProvider pauses execution and
 * exposes it here — a declarative, per-action confirm gate for ANY component, no
 * per-component code. Must live INSIDE JSONUIProvider (reads the action context).
 */
function ConfirmHost(): ReactNode {
  const { pendingConfirmation, confirm, cancel } = useActions();
  const cfg = (pendingConfirmation?.action as { confirm?: FraymeConfirmConfig } | undefined)?.confirm;
  if (!cfg) return null;
  return <FraymeConfirmModal config={cfg} onConfirm={confirm} onCancel={cancel} />;
}

export interface FraymeRendererProps {
  /** The spec to render (full or streaming snapshot). */
  spec: Spec | FraymeSpec | null;
  /**
   * `strict` (default): render only specs passing the catalog gate.
   * `progressive`: render partial/streaming snapshots — the registry whitelist
   * + inert Fallback is the safety boundary; run strict on the final commit.
   */
  mode?: 'strict' | 'progressive';
  /**
   * Skip the strict-mode catalog re-validation. Use for specs you already
   * trust — e.g. one straight from the Frayme API, which the server already
   * validated (the `validated` guarantee can't survive the wire, so the
   * renderer re-checks by default; set this when that re-check is redundant).
   * The registry whitelist + inert Fallback still guard unknown components, so
   * rendering stays safe — it just won't fail-closed on an off-catalog prop.
   * No effect in `progressive` mode (which never validates).
   */
  skipValidation?: boolean;
  /** Per-instance component overrides (merged over the default registry). */
  components?: ComponentRegistry;
  /**
   * BYOC: a catalog union (built-ins ∪ custom manifests) from
   * `createCustomComponents(...).catalog`. Strict-mode validation uses it so a
   * spec containing custom component types is accepted. Without it, custom types
   * fail the strict gate (pass `components` too, or the spec renders via the inert
   * Fallback). No effect in `progressive` mode.
   */
  catalog?: FraymeCatalogUnion;
  /** Receives spec-bound named actions — the ~10% that need your agent. */
  onDynamicAction?: OnDynamicAction;
  /**
   * WHICH CONTROLS REACH YOUR AGENT. The element types allowed to dispatch a
   * declared action OUT of the renderer (`agent` / `host` / `recompose`). Default
   * `DEFAULT_DYNAMIC_ACTION_TYPES` — the press-shaped set (Button, IconButton,
   * Fab, Confirmation), a Form's submit, and a DataTable; a row /
   * bulk action button is a carrier on any component that draws one. Every other
   * component's declared action stays local: it writes the `/_ui/<id>/<verb>`
   * state mirror and nothing else, so the next Button press carries what the user
   * did in `event.state`. A binding marked `live: true` is the per-action opt-out
   * and bypasses this list. REPLACES the default — spread
   * `DEFAULT_DYNAMIC_ACTION_TYPES` in to extend it. Compared by CONTENT, so an
   * inline literal does not re-render the tree. See core/dynamic-gate.ts.
   */
  dynamicActionTypes?: readonly string[];
  /**
   * THE HOST'S ACTION DECLARATIONS — the same `ActionDecl[]` it sent to compose.
   * Read for one thing: each declaration's `description`, which lands on the
   * dispatched event as `DynamicActionEvent.description` so the thread card
   * (`FraymeActionReceipt`) can say what the action does.
   * Precedence: this prop → the `actions` map entry's `description` (when
   * a map is passed) → the server-stamped `spec.actions[name].description` →
   * omitted. Never used for routing — the `actions` prop and `spec.actions`
   * still decide that — and never validated, so a declaration that is missing
   * or bare simply contributes nothing.
   */
  actionContract?: readonly ActionDecl[];
  theme?: ThemeTokens;
  /**
   * Bump to discard ALL client state (remounts the state tree).
   * `useFraymeCompose` bumps this automatically on `compose.restarted`.
   */
  restartKey?: number;
  /** Override the initial state (defaults to the spec's embedded `state`). */
  initialState?: Record<string, unknown>;
  /** Mark the UI as still streaming/loading. */
  loading?: boolean;
  /**
   * Consumer-side action handling. Usually you pass NOTHING here: the Modal
   * authors the handlers INTO the spec (`spec.actions`) and the consumer just
   * renders it as a black box. Pass this ONLY to take full control. Either:
   *  - `string[]` — a security allow-list (legacy): only these names forward to
   *    your handler; off-contract actions render inert.
   *  - `FraymeActionMap` — a per-action handler map (`{ name: { kind } }`), each
   *    resolving to a `local` / `recompose` / `agent` / `host` kind (or a bare
   *    fn = local, or `false` = deny). The keys are also the allow-list.
   * AUTHORITATIVE: passing either form makes the consumer the sole router —
   * `spec.actions` is then IGNORED, and unmapped names fail-closed (unless
   * `defaultActionKind` opts them into a sink). So the (less-trusted) spec can
   * never smuggle in a handler for a name you didn't list. Omit it and the spec
   * drives; every kind it can use is still gated by a dep you inject (`recompose`
   * needs `compose`+`onRecompose`, `host` needs `hostTransport`, `agent` forwards
   * to your `onDynamicAction`), so a spec can do nothing you didn't enable.
   */
  actions?: string[] | FraymeActionMap;
  /** Blanket kind for unmapped actions (`agent` forwards; `host` postMessages). Default: fail-closed (inert). */
  defaultActionKind?: DefaultActionKind;
  /** Compose client (e.g. `frayme.compose`). Enables the `recompose` kind. */
  compose?: ComposeLike;
  /** Where a `recompose` result lands — the spec owner's setter (e.g. `setSpec`). */
  onRecompose?: (nextSpec: unknown, opts: { state: 'merge' | 'restart' }) => void;
  /** Host bridge for the `host` kind (injected by @frayme-ai/{embed,mcp}). */
  hostTransport?: HostTransport;
  /**
   * Whether spec-bound actions are live. Defaults to `true` when a handler is
   * present (`onDynamicAction` or a provider handler), `false` otherwise. Set
   * `interactive={false}` for a display-only UI: controls still render, but
   * clicks are inert regardless of any handler (Variant 1 — non-interactive chat).
   */
  interactive?: boolean;
  className?: string;
}

/**
 * Mid-stream, an element can exist before its `props` patch has arrived —
 * upstream's prop resolver requires `props` to be an object, so we fill the
 * gap. (The strict gate still validates the ORIGINAL spec: final specs always
 * carry props; only streaming snapshots are transiently props-less.)
 */
/** Controls whose `commit` fires on ENTER rather than a press. The rule guards actions
 *  the user PRESSES; typing is not pressing. Their submit buttons are guarded normally. */
const TYPED_COMMIT = new Set(['Input', 'SearchInput', 'Textarea', 'PromptInput']);

/**
 * `carrierTypes` is the carrier list in force (see the `dynamicActionTypes` prop):
 * the automatic confirm below is injected only where the carrier gate would let the
 * dispatch out, so the reader is never asked to confirm a gesture that goes nowhere.
 */
function normalizeSpecProps(spec: Spec | FraymeSpec | null, carrierTypes: readonly string[]): Spec | null {
  /* The spec's own action declarations, read for their `description` when building
     an automatic confirm. Read-only: routing still ignores spec.actions whenever the
     consumer passes an action map (see the FraymeRenderer prop docs) — this reads
     COPY, never a handler, so it cannot smuggle in behaviour the consumer did not
     allow. Empty object when absent so every lookup is a miss, never a throw. */
  const specActions =
    spec && typeof spec === 'object' && (spec as { actions?: unknown }).actions
      && typeof (spec as { actions?: unknown }).actions === 'object'
      ? ((spec as { actions: Record<string, unknown> }).actions)
      : ({} as Record<string, unknown>);
  const s = spec as {
    root?: unknown;
    elements?: Record<string, { props?: unknown; on?: Record<string, unknown> } | undefined>;
  } | null;
  if (!s) return null;
  // A snapshot can be {root: 'x'} with NO elements yet (the /root patch lands
  // first) — upstream does spec.elements[spec.root] unguarded.
  if (!s.elements) return { ...(spec as object), root: s.root ?? null, elements: {} } as Spec;
  let changed = false;
  const elements: Record<string, unknown> = {};
  for (const [id, el] of Object.entries(s.elements)) {
    if (!el || typeof el !== 'object') {
      elements[id] = el;
      continue;
    }
    let next = el as Record<string, unknown>;
    // Fill missing props (streaming snapshots can be transiently props-less;
    // upstream's prop resolver requires `props` to be an object).
    if (next.props == null) {
      next = { ...next, props: {} };
    }
    // Canonicalize the `on` event keys to the 8-verb vocabulary. The renderers
    // emit canonical verbs; this lets a spec authored with a canonical
    // key (on.commit) OR a legacy key (on.press → commit) resolve the same emit.
    // Idempotent: canonical keys map to themselves; unknown keys pass through.
    const on = el.on;
    if (on && typeof on === 'object') {
      const canon: Record<string, unknown> = {};
      let onChanged = false;
      /* `resolveEventKey` is the catalog's COMPONENT-AWARE resolver — the same one
         validateActionWiring uses, so a spelling that validates is a spelling that
         binds. It layers a component-scoped alias over the global collapse:
           · DatePicker on.commit -> select  (the verb that renderer really emits)
           · DataTable on.add/on.update      (no global verb; passes through to the
             renderer, which fires exactly that name when it is declared)
         Everything else behaves as before: legacy on.press -> commit, and a key
         that is already its own resolved verb is left alone. */
      const type = (el as { type?: unknown }).type;
      const resolve = (key: string): string =>
        resolveEventKey(typeof type === 'string' ? type : '', key);
      // Prefer a key that is ALREADY its resolved verb over an alias that collapses
      // to the same verb (matches the validator's commitBinding precedence), so a
      // pathological element carrying both on.commit and on.press resolves to
      // on.commit on BOTH the validator and the runtime — never a silent diverge.
      for (const [key, binding] of Object.entries(on)) {
        if (resolve(key) === key) canon[key] = binding;
      }
      for (const [key, binding] of Object.entries(on)) {
        const verb = resolve(key);
        if (verb !== key) onChanged = true;
        if (!(verb in canon)) canon[verb] = binding;
      }
      if (onChanged) next = next === el ? { ...el, on: canon } : { ...next, on: canon };
    }
    /* UNIVERSAL CONFIRM ON DECLARED ACTIONS.
     *
     * "Anything flowing back to the agent opens a confirm." Every declared (non-builtin)
     * action is by definition a round trip to the host agent, so every one is guarded
     * unless the author says otherwise. This replaces a judgement the model was being
     * asked to make and getting wrong: specs fire something consequential — sending,
     * charging, cancelling, publishing — with no guard at all, because a request
     * rarely flags it and "guard only when the request flags it" is what a model
     * infers from that.
     *
     * DONE HERE, NOT IN THE SPEC. The alternative was authoring the guard into every
     * spec and hoping the model learned the reason rather than the verb. In the
     * runtime it is one rule the model cannot forget or misapply.
     *
     * THREE THINGS IT DOES NOT TOUCH:
     *  · BUILTINS (setState/push/validateForm…) — they never reach the agent, and
     *    json-render returns before the confirm check anyway, so a confirm on one is
     *    dead wiring that validates clean and renders no gate.
     *  · `live` bindings — live fires on EVERY change with no submit step (306 actions).
     *    A confirm there would fire on every keystroke and drag. Mutually exclusive.
     *  · An authored `confirm` — the author's wins, in both directions. `confirm: false`
     *    is the opt-out for a genuinely benign round trip.
     *
     * The text is derived from the control's own label, exactly as DataTable's row and
     * bulk actions already do, so an unauthored guard still reads as a real question. */
    {
      const on2 = (next.on ?? undefined) as Record<string, unknown> | undefined;
      if (on2) {
        let guarded: Record<string, unknown> | null = null;
        for (const [verb, binding] of Object.entries(on2)) {
          /* COMMIT ONLY. The first cut guarded every verb and the suite caught it:
             DataTable `sort`, Tree `select`, SplitPane `move`, Carousel `page` all
             round-trip to the agent, and none of them is an act to be sure about.
             `commit` is the terminal "do it" signal — the others are navigation, and
             a confirm on a drag or a sort is the fatigue that makes the real guard
             stop registering. (Aliases like `press` are already canonicalised to
             `commit` above, so this single check covers them.) */
          /* EVERY VERB. Whatever is declared as an action should put up the confirm —
             the verb could be any. So the gate is the ACTION, not the gesture that
             fired it; declared actions fire on every verb, not just `commit`.
             The case for narrowing this — `change` fires on every Switch flick and
             `move` fires on every Kanban drag, and a confirm on those is the fatigue that
             makes people click through the one that matters — was considered and
             rejected; recorded here so the trade-off is visible rather than rediscovered.
             The exemptions that remain are structural, not judgement:
               · BUILTINS never reach the agent, and json-render returns before the confirm
                 check anyway — a confirm on one is dead wiring that validates clean.
               · `live` fires on every keystroke; a confirm there is incoherent by definition.
               · An authored `confirm` always wins, in both directions (`false` opts out).
             · TEXT ENTRY. "…and we press that" is the qualifier: Input, SearchInput,
               Textarea and PromptInput fire `commit` when the user hits ENTER, which is
               typing, not pressing a control. A chat box that asks "are you sure?" on
               every message is not what the rule means. Their submit BUTTON is a press
               and is guarded normally. */
          const list = Array.isArray(binding) ? binding : [binding];
          // One structural view of the element for BOTH guards below. json-render's
          // narrowed element type carries no `type`, so each reader casts once here
          // rather than reaching through an untyped property at the use site.
          const elT = el as { type?: unknown; props?: { rowActions?: unknown; bulkActions?: unknown } };
          let touched = false;
          const out = list.map((b) => {
            const bb = b as { action?: unknown; confirm?: unknown; live?: unknown } | null;
            if (!bb || typeof bb !== 'object' || typeof bb.action !== 'string') return b;
            if (JSON_RENDER_BUILTIN_ACTIONS.has(bb.action)) return b;   // never reaches the agent
            /* LIVE OUTRANKS AN AUTHORED CONFIRM — and it is checked FIRST for that
               reason. These two checks used to read `confirm` first and then `live`,
               and BOTH branches returned the binding untouched, so an authored confirm
               that landed on a `live` action simply stayed there: the host declared
               "fire on every change", the model wrote a `confirm` next to it, and the
               reader got a modal on every keystroke of a live filter.
               `live` is not a preference, it is a statement about WHEN the action
               fires; a per-change dialog is incoherent with it by definition, so the
               confirm is STRIPPED rather than merely left uninjected. Reordering alone
               would have changed nothing — the strip is the fix, the order is what
               makes it readable.
               PRECEDENCE, UNCHANGED FOR EVERYTHING ELSE:
               HOST confirm > model confirm > runtime default. The host level is applied
               SERVER-SIDE — bind-actions writes the host's declared confirm over the
               model's before the spec is ever rendered — so by the time a binding
               reaches this line an authored `confirm` is already the winner of levels 1
               and 2, and the next line honours it in both directions (`false` opts out
               of the universal guard). The one case this line overrides is a confirm
               sitting on a binding that ALSO says `live: true`, which the runtime
               cannot fire coherently whoever wrote it. A host that declares `confirm`
               AND `live: true` on the same action has declared a contradiction; it
               resolves as live, and the honest place to reject that pairing is the
               server that assembles it, not here. */
            if (bb.live === true) {
              if (bb.confirm === undefined) return b;
              touched = true;
              const stripped = { ...(bb as Record<string, unknown>) };
              delete stripped.confirm;
              return stripped;
            }
            if (bb.confirm !== undefined) return b;                     // author decided, either way
            if (TYPED_COMMIT.has(String(elT.type ?? ''))) return b;       // Enter is not a press
            /* SELF-GUARDING COMPONENTS. A DataTable/DataGrid row or bulk action is
               ALREADY guarded at source: data-table.tsx:757 opens a confirm for every
               row action unless the author opts out with `confirm:false`, and only
               then calls runRowAction — which dispatches through THIS on.commit
               (data-table.tsx:710). Injecting here made the reader answer the same
               question twice in sequence: DataTable's guard, accept, then ours.
               Found on an org-tree sample whose posts table
               declares rowActions AND an on.commit binding to the same action — the
               shape generated specs actually use.
               DataTable's confirm is the one to keep: deriveConfirm() carries the row
               action's label, its `danger` variant (destructive rows render red) and
               its icon, where an injected one is generic.
               Scoped to elements that DECLARE the affordance, so a DataTable whose
               commit comes from somewhere else is still guarded normally. */
            /* KanbanBoard/KanbanCard are on this list because they draw the
               same `rowActions` contract through the shared registry/_rowaction.ts,
               which means they open their own confirm before emitting `commit` —
               so without them here a per-card "Reassign driver" asked twice. */
            const SELF_GUARDING = new Set(['DataTable', 'DataGrid', 'KanbanBoard', 'KanbanCard']);
            const selfGuards = SELF_GUARDING.has(String(elT.type ?? ''))
              && (Array.isArray(elT.props?.rowActions) || Array.isArray(elT.props?.bulkActions)
                  || Array.isArray((el as { rowActions?: unknown }).rowActions));
            if (selfGuards && verb === 'commit') return b;
            /* NOT A CARRIER → NO AUTOMATIC CONFIRM. The universal rule's
               premise is "anything flowing back to the agent" — and under the carrier
               gate (core/dynamic-gate.ts) a declared action on a non-carrier does NOT
               flow back: it writes /_ui/<id>/<verb> and stops. Injecting the guard
               there produced an incoherence — a Select's `change →
               setRegion` opened "Region?" and Confirm led to nothing, on every
               Select/Switch binding — and it was the very fatigue the gate's
               WHY names. Same predicate as the Proxy, the latch and the param freeze
               (`bindingDispatches`): the element's type is a carrier, the verb is a
               row / bulk action commit, or the binding says live (already returned
               above). An AUTHORED confirm on a non-carrier is untouched — the author
               decided — exactly as an authored one wins everywhere else here. */
            if (!bindingDispatches(el, verb, bb, carrierTypes)) return b;
            touched = true;
            const label = (next.props as { label?: unknown } | undefined)?.label;
            /* `message` MUST be present, even empty. json-render's resolveAction runs
               interpolateString over confirm.message unconditionally, so a config
               without it throws `Cannot read properties of undefined (reading
               'replace')` — the action never dispatches and the guard never appears.
               An earlier version of this emitted {title} alone and `true`; BOTH crash.
               Caught only because a test was written to prove the guard FIRES: the 30
               fixtures that opt out kept the suite green over a feature that threw on
               every use. */
            const t = typeof label === 'string' && label.trim() ? `${label.trim()}?` : 'Confirm';
            /* MESSAGE FROM THE ACTION'S OWN `description`, when the host gave one.
               The empty message below is a floor, not a design: it exists so the
               guard cannot crash, and it renders a bare question with nothing under
               it. The host declares what the action DOES — that text is already in
               the prompt's Actions block — and until now the runtime threw it away,
               so a screen that knew "Runs the save playbook for an at-risk account"
               still asked "Launch the save playbook?" and left the body blank.
               An AUTHORED confirm still wins outright (checked above); this only
               fills the automatic one. `description` is optional from the host, so
               the empty-string floor stays for every action without one. */
            const decl = (specActions as Record<string, { description?: unknown } | undefined>)[bb.action];
            const d = typeof decl?.description === 'string' ? decl.description.trim() : '';
            return { ...bb, confirm: { title: t, message: d } };
          });
          if (touched) (guarded ??= { ...on2 })[verb] = Array.isArray(binding) ? out : out[0];
        }
        if (guarded) next = next === el ? { ...el, on: guarded } : { ...next, on: guarded };
      }
    }

    // Stamp the element's OWN id into props so the runtime can key the automatic
    // state mirror (spec.state._ui[id]) by it — json-render passes no id to renderers.
    // Components ignore the extra prop (none spread raw props to the DOM).
    {
      const curProps = (next.props ?? {}) as Record<string, unknown>;
      if (curProps.__fid !== id) {
        next = next === el
          ? { ...el, props: { ...curProps, __fid: id } }
          : { ...next, props: { ...curProps, __fid: id } };
      }
    }
    if (next !== el) changed = true;
    elements[id] = next;
  }
  return (changed ? { ...(spec as object), elements } : spec) as Spec;
}

function InvalidSpec({ issues }: { issues: string[] }): ReactNode {
  return (
    <div className="frayme-invalid" role="alert">
      <strong>Frayme: spec failed catalog validation</strong>
      <ul>
        {issues.slice(0, 5).map((issue, i) => (
          <li key={i}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

/** Synthesize an ActionSpec for an unmapped action from the blanket default kind. */
function defaultSpecFor(kind: DefaultActionKind | undefined): ActionSpec | undefined {
  if (kind === 'agent') return { kind: 'agent' };
  if (kind === 'host') return { kind: 'host' };
  return undefined; // fail-closed → inert
}

export function FraymeRenderer({
  spec: rawSpec,
  mode = 'strict',
  skipValidation = false,
  components,
  catalog,
  onDynamicAction,
  dynamicActionTypes,
  actionContract,
  theme,
  restartKey = 0,
  initialState,
  loading,
  actions,
  defaultActionKind,
  compose,
  onRecompose,
  hostTransport,
  interactive,
  className,
}: FraymeRendererProps): ReactNode {
  const ctx = useFrayme();
  const handler = onDynamicAction ?? ctx.onDynamicAction;

  /* CYCLE GUARD — the ONE seam every surface passes through (direct use,
   * useFraymeCompose, the AI SDK and AG-UI adapters all mount this component),
   * so the streaming/partial path is covered as well as the settled one. An
   * element listing itself, or an ancestor, in `children` sends json-render's
   * ElementRenderer into an unbounded work loop (seen in production: "bracket" and
   * "view-toggle" each listed themselves; the tab pinned at 100% CPU). Every
   * consumer below reads the CUT spec; only the strict gate sees the raw one, so
   * whatever the catalog gate rules on a cycle stands (its cycle check,
   * validate/resolution.ts, is an opt-in stage the runtime does not switch on,
   * so at present the gate PASSES a cyclic spec — strict mode used to hang too) and
   * every path — strict, progressive, loading, skipValidation — renders the
   * repaired tree instead of hanging.
   * Keyed on spec identity — the same contract renderSpec relies on — because
   * the compose stream mutates its snapshot in place, so no cache may outlive
   * the identity of the object it was computed from (see core/child-cycles.ts). */
  const spec = useMemo(() => cutChildCycles(rawSpec), [rawSpec]);

  const actionMap = actions != null && !Array.isArray(actions) ? actions : null;
  const allowList = Array.isArray(actions) ? actions : null;
  // Handlers the Modal authored INTO the spec (`/actions`). The consumer no
  // longer hardcodes per-action behavior — the spec that built the UI declares
  // what each action does. Declarative kinds only (recompose/agent/host/deny);
  // a `local` fn can't be serialized, so those ship with the catalog instead.
  const specActions = (spec as { actions?: SpecActionMap } | null)?.actions ?? null;
  const hasSpecActions = specActions != null && Object.keys(specActions).length > 0;
  const hasActionConfig =
    (actionMap != null && Object.keys(actionMap).length > 0) ||
    (allowList != null && allowList.length > 0) ||
    hasSpecActions;
  // Interactive when explicitly set, or a handler OR any action config exists — a
  // recompose-only spec/map (no onDynamicAction) must NOT render inert.
  const isInteractive = interactive ?? (handler != null || hasActionConfig);

  const registry = useMemo(
    () => createRegistry({ ...ctx.components, ...components }),
    [ctx.components, components],
  );

  // The dynamic-action seam compiles into json-render's native `handlers` map.
  // A Proxy keeps it catch-all (the catalog has no static action table) with a
  // STABLE identity (created once) — ActionProvider captures `handlers` at mount
  // with no sync effect, so a rebuilt object would freeze; the Proxy reads LIVE
  // refs instead, so later-added handlers/deps register correctly.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const mapRef = useRef<FraymeActionMap | null>(actionMap);
  mapRef.current = actionMap;
  const specActionsRef = useRef<SpecActionMap | null>(specActions);
  specActionsRef.current = specActions;
  const allowRef = useRef<Set<string> | null>(null);
  allowRef.current = allowList ? new Set(allowList) : null;
  const defaultKindRef = useRef(defaultActionKind);
  defaultKindRef.current = defaultActionKind;
  const interactiveRef = useRef(isInteractive);
  interactiveRef.current = isInteractive;
  // The carrier list the gate reads — a LIVE ref like allowRef/defaultKindRef,
  // because the Proxy below is created once and must see a later prop change.
  // STABILISED BY CONTENT: the list is a memo key for renderSpec and the param
  // owners and a context value for every latch, so an inline array literal
  // (`dynamicActionTypes={['Button', 'Form']}`) would otherwise recompute the
  // normalised spec and re-render every consumer on each host render.
  const dynamicTypesRaw = dynamicActionTypes ?? DEFAULT_DYNAMIC_ACTION_TYPES;
  const dynamicTypesKey = dynamicTypesRaw.join(' ');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dynamicTypes = useMemo(() => dynamicTypesRaw, [dynamicTypesKey]);
  const dynamicTypesRef = useRef<readonly string[]>(dynamicTypes);
  dynamicTypesRef.current = dynamicTypes;
  // The host's declarations, read at dispatch for the event's `description` — a
  // LIVE ref like the others, because the Proxy is created once. No content
  // stabilisation needed: nothing memoises on it and nothing re-renders from it.
  const contractRef = useRef<readonly ActionDecl[] | undefined>(actionContract);
  contractRef.current = actionContract;
  const specRef = useRef<Spec | FraymeSpec | null>(spec);
  specRef.current = spec;
  const storeRef = useRef<ReturnType<typeof createStateStore> | null>(null);
  const depsRef = useRef<DispatchDeps>({});
  depsRef.current = { compose, onRecompose, hostTransport };
  const inflightRef = useRef<Map<string, AbortController>>(new Map());
  // Pending intrinsic payloads (emitWith → Proxy), created once like the Proxy.
  const slotsRef = useRef<ReturnType<typeof createIntrinsicSlots> | null>(null);
  // Pass a LIVE store accessor so the automatic state mirror always writes the
  // current store (it is recreated per restartKey; the slots are created once).
  if (!slotsRef.current) slotsRef.current = createIntrinsicSlots(() => storeRef.current);
  const slots = slotsRef.current;

  const handlers = useMemo(() => {
    const resolveSpec = (name: string): ActionSpec | undefined => {
      // A consumer `actions` MAP is AUTHORITATIVE: passing one means "I'm taking
      // control of routing", so spec.actions is IGNORED and unmapped names
      // fail-closed. This keeps the map's allow-list guarantee intact — the
      // (less-trusted) spec can't smuggle in a handler for a name the consumer
      // didn't list. Behaves byte-identically to the pre-spec.actions renderer.
      if (mapRef.current) {
        // Own-property only — a name like 'toString' must NOT resolve a
        // prototype member into a callable handler (allow-list bypass).
        const s = Object.hasOwn(mapRef.current, name) ? mapRef.current[name] : undefined;
        return s !== undefined ? s : defaultSpecFor(defaultKindRef.current);
      }
      // A legacy allow-list (string[]) is likewise authoritative: on-contract →
      // forward, off-contract → deny. spec.actions is ignored.
      if (allowRef.current) {
        return allowRef.current.has(name) ? { kind: 'agent' } : false;
      }
      // No consumer config → the spec is the source (the black box). ADDITIVE:
      // a declared handler runs; an undeclared action falls through to the
      // explicit default, else forwards (keeps blanket-forward chats working).
      const fromSpec =
        specActionsRef.current && Object.hasOwn(specActionsRef.current, name)
          ? specActionsRef.current[name]
          : undefined;
      if (fromSpec !== undefined) return fromSpec;
      return defaultSpecFor(defaultKindRef.current) ?? { kind: 'agent' };
    };
    const target: Record<string, (params: Record<string, unknown>) => unknown> = {};
    return new Proxy(target, {
      get: (_t, name) => {
        if (typeof name !== 'string') return undefined;
        // Inert paths still CONSUME their pending intrinsic entry, so a denied
        // fire can't leak a stale payload into the next dispatch of this name.
        if (!interactiveRef.current)
          return () => {
            slotsRef.current?.take(name);
            return undefined;
          }; // display-only
        const actionSpec = resolveSpec(name);
        if (actionSpec === undefined)
          return () => {
            slotsRef.current?.take(name);
            return undefined;
          }; // fail-closed
        return (params: Record<string, unknown>) => {
          // FIRST: pop the intrinsic payload stashed by emitWith (if any) —
          // before the abort guard, so it can never leak across dispatches.
          // `take` ALSO writes the /_ui/<fid>/<verb> mirror, which is why it must
          // stay ahead of the carrier gate below: a denied fire still records
          // what the user did, and that record is the whole point of denying it.
          const intrinsic = slotsRef.current?.take(name);
          /* THE CARRIER GATE — core/dynamic-gate.ts.
             Only a press-shaped control, a Form's submit, a DataTable, or a row /
             bulk action button may send a declared action OUT of the renderer;
             everything else stays local (mirror only) unless its binding says
             `live: true`. Declared bindings routinely sit on non-carrier hosts
             (a KanbanCard, a Select, a Switch, a FeatureCard), so this
             changes real behaviour and is deliberately SILENT: a deny returns
             undefined — no throw, no console.error, no new validation path — and
             it does not touch the in-flight guard, so an inert flick cannot abort
             a carrier's dispatch of the same name.
             SCOPE: only kinds that LEAVE the renderer — agent, host, recompose,
             and an unresolved spec that dispatch() defaults to agent. A `local`
             kind, a bare function handler and `false` are the consumer's own
             code (or already inert) and are never gated; the mirror is written
             for them too. */
          const leavesRenderer =
            actionSpec !== false && typeof actionSpec !== 'function' && actionSpec.kind !== 'local';
          if (leavesRenderer) {
            const decision = decideDynamicDispatch({
              spec: specRef.current,
              fid: intrinsic?.fid,
              action: name,
              allowedTypes: dynamicTypesRef.current,
              affordance: intrinsic?.affordance,
            });
            if (!decision.allowed) {
              if (isDev) {
                console.debug(
                  `[frayme] action "${name}" from ${intrinsic?.fid ? `<${intrinsic.fid}>` : 'an unidentified element'} stayed local (${decision.reason}) — only ${dynamicTypesRef.current.join('/')}, a row/bulk action button, or a live:true binding dispatch out of the renderer; the state mirror was written.`,
                );
              }
              return undefined;
            }
          }
          // Re-entrancy guard: a newer dispatch for this name aborts the prior.
          inflightRef.current.get(name)?.abort();
          const controller = new AbortController();
          inflightRef.current.set(name, controller);
          const actionCtx: FraymeActionContext = {
            action: name,
            event: intrinsic?.event,
            // The firing element, for DynamicActionEvent.element_id (same slot as `event`).
            elementId: typeof intrinsic?.fid === 'string' ? intrinsic.fid : undefined,
            /* THE RECEIPT FIELDS (the thread card,
               core/action-enrich.ts). `label` is the pressed control's own label,
               verbatim, when the fire names one: the intrinsic payload's `label`
               (Button / IconButton / Fab / Confirmation / Link), else the matching
               rowActions / bulkActions entry on the host that drew a row / bulk
               action press; a Form's `{ fields }` names none. `description` is the
               host's declaration for this action — `actionContract` first, then the
               server-stamped `spec.actions[name].description` (read as COPY, exactly
               as normalizeSpecProps reads it for the confirm message — never a
               handler, so an `actions` map's authority over routing is untouched).
               Either resolves to undefined silently; neither can throw or invalidate. */
            label: resolveControlLabel(specRef.current, intrinsic),
            // The consumer's `actions` map sits between the contract and the spec:
            // when a host routes through a map, its own entry's `description` is
            // closer to the host than the server-stamped copy.
            description: resolveActionDescription(contractRef.current, mapRef.current, specRef.current, name),
            setState: (path, value) => storeRef.current?.set(path, value),
            getState: () =>
              (storeRef.current?.getSnapshot() ?? {}) as Record<string, unknown>,
            getSpec: () => specRef.current,
            emitDynamic: (event) => handlerRef.current?.(event),
            signal: controller.signal,
          };
          // An identity-only entry (payload {}) exists to name the element, not to
          // shape params: keep the pre-gate pass-through for it, so an authored key
          // that resolved to `undefined` still reaches the host by presence exactly
          // as it did before a payload-less fire stashed anything.
          const merged = intrinsic && Object.keys(intrinsic.payload).length > 0
            ? mergeIntrinsicParams(intrinsic.payload, params)
            : (params ?? {});
          // $item params arrive from upstream as scoped state PATHS (pointer
          // semantics); the Frayme contract promises VALUES — deref before the
          // host sees them (core/item-params.ts).
          const resolved = derefItemParams(specRef.current, name, merged, (path) =>
            storeRef.current?.get(path),
          );
          return dispatch(actionSpec, resolved, actionCtx, depsRef.current);
        };
      },
      has: () => true,
    });
  }, []);

  // Strict validation runs on settled specs only. During streaming (`loading`)
  // skip it — the registry whitelist + inert Fallback are the live safety net,
  // and re-validating every snapshot is O(n²) over the op stream. The final
  // (loading=false) commit still faces the strict gate.
  const gate = useMemo(
    () =>
      // The RAW spec, on purpose: strict mode keeps failing closed on a cycle.
      rawSpec && mode === 'strict' && !skipValidation && !loading
        ? validateFraymeSpec(rawSpec, catalog)
        : null,
    [rawSpec, mode, skipValidation, loading, catalog],
  );

  const baseStyle = useMemo(() => themeToStyle(theme ?? ctx.theme), [theme, ctx.theme]);

  /**
   * DRESS THE CONFIRM IN THE SPEC'S OWN COLOURS.
   *
   * A spec paints its page by giving its ROOT element a `bg`/`color`; that element
   * publishes --fr-surface on its own div and everything inside follows. The confirm
   * modal does not: ConfirmHost is a SIBLING of Renderer, outside that div, so on a
   * page authored #0e1116 it came up white — --color-card is still the light theme
   * token. A custom-colour spec gets its confirm in the same
   * colours, and stacking a confirm over an authored Dialog is fine.
   *
   * IT SETS THE --fr-confirm-* CHANNELS, NOT --fr-surface. Republishing the surface
   * at the renderer root would make the root a third publisher of a channel that is
   * supposed to come from the element that painted it, and surface-channel-reset
   * counts publishers for exactly that reason. This is the narrow thing the rule
   * asks for and nothing more.
   *
   * A colour that will not parse lifts nothing: surfaceInk(x) returns null for
   * precisely the expressions safeColor cannot read (it does not throw), and a raw
   * `slate-200` published as a colour breaks every consumer downstream.
   */
  const style = useMemo(() => {
    const els = (spec as { elements?: Record<string, { props?: Record<string, unknown> } | undefined> } | null)?.elements;
    const rootId = (spec as { root?: unknown } | null)?.root;
    const p = typeof rootId === 'string' ? els?.[rootId]?.props : undefined;
    const bgRaw = typeof p?.bg === 'string' ? p.bg : null;
    const fgRaw = typeof p?.color === 'string' ? p.color : null;
    const bg = bgRaw && surfaceInk(bgRaw) != null ? bgRaw : null;
    const fg = fgRaw && surfaceInk(fgRaw) != null ? fgRaw : null;
    if (!bg && !fg) return baseStyle;
    const ink = fg ?? (bg ? surfaceInk(bg) : null);
    const muted = bg ? surfaceMuted(bg, fg ?? undefined) : null;
    return {
      ...baseStyle,
      ...(bg ? {
        '--fr-confirm-bg': bg,
        '--fr-confirm-border': surfaceField(bg),
        '--fr-confirm-cancel-border': surfaceField(bg),
        '--fr-confirm-cancel-hover': surfaceSunken(bg),
        '--fr-confirm-accent-fg': bg,
      } : {}),
      ...(ink ? {
        '--fr-confirm-title': ink,
        '--fr-confirm-cancel-fg': ink,
        '--fr-confirm-accent': ink,
      } : {}),
      ...(muted ? { '--fr-confirm-message': muted } : {}),
    } as typeof baseStyle;
  }, [baseStyle, spec]);
  const initial = useMemo(
    () => initialState ?? resolveInitialState(spec),
    // Re-resolve only when the state tree remounts, not on every snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restartKey, initialState],
  );

  // Controlled store: the renderer OWNS the state container so the patch
  // path (prior_spec evolve, restartKey unchanged) can merge the agent's new
  // /state fields into the LIVE store without discarding the user's in-progress
  // edits. A fresh store identity per restartKey = the agent-authoritative
  // discard (compose.restarted); a stable store across patches = client edits
  // survive. (Uncontrolled `initialState` only seeds on mount, so agent-added
  // fields on a patch were silently dropped — mergeOnRehydrate was dead code.)
  const store = useMemo(
    () => createStateStore(initial),
    // Reset the store exactly when the state tree resets (the `initial` trigger).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restartKey],
  );
  storeRef.current = store; // the action context reads the LIVE store

  // On an in-place PATCH (a settled NEW spec at an UNCHANGED restartKey) merge
  // the agent's new state into the live store: the agent owns which keys exist,
  // the client owns the value of any key it still carries. Gated on `!loading`
  // so it runs once per settled spec — never per streaming snapshot (O(n²)).
  const seenRef = useRef<{ spec: unknown; restartKey: number } | null>(null);
  useEffect(() => {
    const prev = seenRef.current;
    seenRef.current = { spec, restartKey };
    if (!spec || loading) return;
    if (!prev || prev.spec === spec) return; // initial settle / unchanged spec
    if (prev.restartKey !== restartKey) return; // restart — new store already seeded
    const merged = mergeOnRehydrate(resolveInitialState(spec), store.getSnapshot());
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(merged)) updates[`/${key}`] = value;
    store.update(updates);
  }, [spec, restartKey, loading, store]);

  // Memoized: normalizeSpecProps now ALWAYS rewrites props (it stamps __fid), so
  // recomputing per render would break referential stability + re-render the tree.
  // Keyed on the spec identity — recomputes only when a new spec/snapshot arrives —
  // and on the (content-stable) carrier list, which decides where the automatic
  // confirm is injected.
  const renderSpec = useMemo(() => normalizeSpecProps(spec, dynamicTypes), [spec, dynamicTypes]);
  // Which controls feed which declared actions — see param-freeze.tsx. Same
  // carrier list: a binding the gate keeps local owns no params.
  const paramOwners = useParamOwners(renderSpec, dynamicTypes);
  // Rule 2: on mount, put focus in the first empty REQUIRED param.
  useFocusFirstRequired(renderSpec, paramOwners);

  // Responsive keystone: id → type lookup for the current spec, so layout
  // components can classify children structurally (Stack column-layout
  // detection → fr-hcols collapse). Same spec-identity key as renderSpec.
  const [elementTypes, elementChildren] = useMemo(() => {
    const types: Record<string, string> = {};
    const metaOf: Record<string, { kids: readonly string[]; horizontal: boolean }> = {};
    const els = (spec as { elements?: Record<string, { type?: unknown; children?: unknown; props?: { direction?: unknown } | null }> } | null)?.elements;
    if (els && typeof els === 'object') {
      for (const [id, el] of Object.entries(els)) {
        if (el && typeof el.type === 'string') types[id] = el.type;
        if (el) {
          metaOf[id] = {
            kids: Array.isArray(el.children) ? el.children.filter((c): c is string => typeof c === 'string') : [],
            horizontal: el.props?.direction === 'horizontal',
          };
        }
      }
    }
    return [types, metaOf] as const;
  }, [spec]);

  if (!spec) return null;
  if (gate && !gate.ok) return <InvalidSpec issues={gate.issues} />;

  // Width law: page width is CONSTANT (full host width) for every spec — the
  // old per-spec measure clamp is gone; width restraint lives in the
  // components (see frayme.css "Width law").
  //
  // Page padding FLOOR. A spec that sets no `padding` on its root element
  // renders flush against the host edge, headline at 0px.
  // Whether a screen has breathing room should not depend on the author
  // remembering. The floor is applied ONLY when the root element sets none, so
  // authored padding is untouched and nothing doubles up.
  const rootPadded = (() => {
    const els = (spec as { elements?: Record<string, { props?: Record<string, unknown> } | undefined> } | null)?.elements;
    const rootId = (spec as { root?: unknown } | null)?.root;
    const p = typeof rootId === 'string' ? els?.[rootId]?.props : undefined;
    return p != null && (p.padding != null || p.paddingValue != null);
  })();
  return (
    <div
      className={`frayme-root${rootPadded ? '' : ' fr-page-pad'}${className ? ` ${className}` : ''}`}
      style={style}
      data-interactive={isInteractive ? 'true' : 'false'}
    >
      <ElementTypesContext.Provider value={elementTypes}>
        <ElementChildrenContext.Provider value={elementChildren}>
          {/* `functions` = the `$computed` vocabulary (functions.ts). Registered
              HERE and nowhere else: FraymeRenderer is the single wrapper every
              entry point funnels through (index, ag-ui, ai-sdk, BYOC), so one
              wiring covers every render path, client and SSR alike. Before this,
              NOTHING was registered — core warned and returned `undefined`, and
              Gauge/ProgressCircle rendered that undefined as a confident "0". */}
          <JSONUIProvider
            key={restartKey}
            registry={registry}
            store={store}
            handlers={handlers}
            functions={fraymeComputedFunctions}
          >
            <IntrinsicProvider value={slots}>
              {/* The carrier list the latch consults (dynamic-gate.tsx) — the same
                  value the Proxy reads through dynamicTypesRef, so a control the
                  Proxy would deny is a control the latch leaves live. */}
              <DynamicGateContext.Provider value={dynamicTypes}>
                {/* Param freeze (lifecycle 3/4/5): INSIDE JSONUIProvider, because the
                    hook reads the `_ui` mirror through useBoundProp and that needs the
                    store. Memoized on the spec, so it recomputes on recompose and not
                    on every state write. */}
                <ParamFreezeProvider value={paramOwners}>
                  {/* Rule 2's press half: a declared REQUIRED param that resolves
                      empty blocks the press before the confirm gate opens
                      (required-guard.tsx). It reads the SETTLED spec's action
                      declarations and the live store, so it sits inside the state
                      provider, above the tree that fires through it. */}
                  <RequiredGuardProvider spec={renderSpec} store={store}>
                    <Renderer spec={renderSpec} registry={registry} loading={loading} fallback={Fallback} />
                    <ConfirmHost />
                  </RequiredGuardProvider>
                </ParamFreezeProvider>
              </DynamicGateContext.Provider>
            </IntrinsicProvider>
          </JSONUIProvider>
        </ElementChildrenContext.Provider>
      </ElementTypesContext.Provider>
    </div>
  );
}
