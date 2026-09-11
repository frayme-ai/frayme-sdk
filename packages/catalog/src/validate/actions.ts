/**
 * Action-contract gate — the single source of truth for proving that a spec
 * wires its declared actions correctly. Shared by the serving path and
 * authoring pipelines so both apply identical rules.
 */
import { acceptedEventKeys, canonicalize, resolveEventKey } from '../components/events.js';

import { BUILTIN_ACTIONS } from './resolution.js';
import { componentEvents, fraymeCatalog, type FraymeSpec } from './jsonRender.js';

/**
 * How the server self-closes a declared action into `spec.actions` — the kind
 * layer. `recompose` (+`prompt`) | `agent` (default) | `host` (+`channel`) |
 * `false` (deny). Mirrors `ComposeActionKind` in `@frayme/api` — keep in lockstep.
 */
export type ActionKind = 'recompose' | 'agent' | 'host' | false;

/** A declared action from the compose request (`actions: [...]`). */
export interface ActionDecl {
  /** The bound action name (e.g. "approveRefund"). */
  name: string;
  /** JSON Schema (object) for the action's params; param keys bind to state. */
  params?: Record<string, unknown>;
  /** Short human label for the control that fires this action (e.g. "approve", "Save board") — beats the fallback label wherever Frayme places or injects the control, incl. the injected carrier button, which with no role reads "Done". */
  role?: string;
  /** If true, a button bound to this action MUST be present.
   *  About the ACTION, not its params — see `requiredItems`. */
  required?: boolean;
  /** Names of the params that are MANDATORY. Lifted to action level from
   *  the JSON-Schema `params.required`, which sat one level below the keys it
   *  describes and only existed in the wrapper form — hosts sending the flat map
   *  (the tool JSON's own documented shape) had nowhere to put it, so required-ness
   *  reached the model on none of those declarations.
   *  Deliberately NOT `required`: that is the boolean above, a different claim, and
   *  collapsing the two is what produced the `stray-required-array` defect where an
   *  ARRAY was written into the boolean field. */
  requiredItems?: string[];
  /** What the action does. Reaches the model in the prompt's Actions block, and is
   *  what the runtime needs to write a contextual confirm message instead of an
   *  empty one. */
  description?: string;
  /** How the server self-closes this action into `spec.actions` (default `agent`). */
  kind?: ActionKind;
  /** `recompose` only — the fixed prompt the server recomposes with. */
  prompt?: string;
  /** `host` only — the postMessage channel name. */
  channel?: string;
}

export interface ActionContractResult {
  valid: boolean;
  errors: string[];
  /** Non-fatal findings. Present ONLY when non-empty, so `{valid,errors}` stays
   *  the exact shape every existing caller and test compares against. */
  warnings?: string[];
}

/** Severity for a finding: silent, reported-but-passing, or fatal. */
export type GateSeverity = 'off' | 'warn' | 'error';

export interface ActionContractOptions {
  /**
   * A DECLARED action that no element dispatches, where the declaration did NOT
   * set `required`.
   *
   * WHY THIS EXISTS AND WHY IT DEFAULTS TO `warn`.
   * The gate used to check `decl.required && !bound`, so an action the host
   * declared but did not flag `required` could be missing from the screen
   * entirely and nothing complained — the large majority of declarations were
   * invisible to it. Declaring an action means the host wants a control for it;
   * `required` should mean "the user must be able to complete it", not "bother
   * checking".
   *
   * It is a WARNING, not an error, on three grounds:
   *  · An unbound declared action is a PRESENTATION defect — a screen missing an
   *    affordance, which the user can see. The governing rule repairs or
   *    substitutes those; only a TRUTH defect is worth a fresh generation. A
   *    wiring/contract error escalates the compose to the fallback, which is the
   *    wrong trade for a missing button.
   *  · There is already a deterministic repair one layer up. The platform binder
   *    injects a control for an unbound action — but only `else if
   *    (decl.required)`, the SAME blind spot. Widening the binder fixes the
   *    defect; hard-failing here only bills a second generation for it.
   *  · Blast radius on RAW model output, where this gate actually runs, is not
   *    small: a meaningful share of currently-valid first-turn attempts would
   *    flip, costing some composes an extra fallback attempt and a few composes
   *    every attempt they had. Authored specs, by contrast, almost never do
   *    this — so this is a serving-time gap.
   * Pass `'error'` to enforce it once the binder repairs non-required actions.
   */
  declaredCoverage?: GateSeverity;
}

type OnBinding = { action?: unknown; params?: Record<string, unknown> };
type OnEl = { type?: string; on?: Record<string, OnBinding | OnBinding[]> };

/** Builtin state mutations are never part of an action contract. */
const CONTRACT_BUILTINS = new Set(['setState', 'pushState', 'removeState']);

/**
 * Components whose events INJECT the acted-on object into the payload
 * (DataTable row/bulk actions emit {action,index,row,rows}; Kanban moves emit
 * {id,card,dir}; the spreadsheet grid likewise). mergeIntrinsicParams makes
 * authored keys WIN over intrinsic ones, so a spec-authored literal on one of
 * these shared call sites can only overwrite the true object with a constant —
 * the honest binding is BARE, and a declared param is satisfied by the
 * intrinsic payload rather than by spec params or the state diet.
 */
const INTRINSIC_PAYLOAD_TYPES = new Set(['DataTable', 'KanbanBoard', 'KanbanCard', 'EditableSpreadsheetGrid']);

/**
 * Narrow an on-value (which may be an ActionBinding[]) to its first
 * CONTRACT-RELEVANT handler. Builtins are skipped so in-flight feedback wiring
 * (`commit: [{action:"setState",…/submitting…}, {action:"postComment",…}]`)
 * resolves to the named action; a builtin-only value has no contract surface.
 */
function firstBinding(v: OnBinding | OnBinding[] | undefined): OnBinding | undefined {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr.find(
    (b) => typeof b?.action === 'string' && !CONTRACT_BUILTINS.has(b.action),
  );
}

/**
 * The button-action binding on an element, canonicalize-aware: an action wired
 * under the canonical `commit` key OR any legacy alias of it (press/submit/…)
 * resolves the same. Preserves the contract's button-press semantics while
 * accepting the canonical event vocabulary. Handles the array form
 * (`on:{commit:[{action}]}`) — json-render allows `ActionBinding | ActionBinding[]`.
 */
function commitBinding(el: OnEl | null | undefined): OnBinding | undefined {
  /* NULLISH ELEMENTS REACH HERE FROM UNTRUSTED OUTPUT. The caller iterates
     Object.values(elements) on a spec that a model produced, and a model can emit
     `"elements": { "foo": null }`. Reading `.on` off that threw
     `Cannot read properties of undefined`, which killed a batch run partway — and
     matters far more in production: /v1/compose validates model output, so a crash here
     500s the request instead of failing validation and falling back. The whole
     point of validation is to survive bad input and report it. */
  if (el == null || typeof el !== 'object') return undefined;
  const on = el.on;
  if (!on) return undefined;
  if (on.commit) return firstBinding(on.commit);
  for (const [k, v] of Object.entries(on)) {
    if (canonicalize(k) === 'commit') return firstBinding(v);
  }
  return undefined;
}

/**
 * EVERY contract-relevant binding on an element, across ALL events — the
 * BOUNDNESS notion, as distinct from `commitBinding`'s button notion above.
 *
 * WHY THIS EXISTS. `commitBinding` answers "is there a
 * BUTTON PRESS wired to this action". The required-action rule used that answer
 * for a different question — "can this screen DO the thing" — and the two come
 * apart on every host component that dispatches from its own native event:
 * KanbanBoard `on.move`, Select `on.change`, DataTable `on.select`, Scheduler
 * `on.dismiss`, TournamentBracket `on.select`. Those are not buttons and never
 * will be, so a host declaring such an action `required: true` produced a spec
 * that could not be validated by ANY output:
 *
 *   · 50 of the 100 event-bearing catalog components advertise NO `commit` at
 *     all (Select, Checkbox, Switch, Tabs, Dialog, DatePicker, Tree,
 *     TournamentBracket …). For those the old rule was not merely strict, it was
 *     UNSATISFIABLE — and satisfiable in neither direction, because the escape
 *     the model reaches for on retry (bind `on.commit` instead) is then rejected
 *     by validateActionWiring's event-vocabulary check: `commit` is not in the
 *     component's `events[]`. In a live case most attempts were rejected on
 *     `required action "moveCard" is not bound to any button` — fallback
 *     attempts included — while `moveCard` was bound on `on.move`, correctly, in
 *     every rendered board. (An earlier catalog gave KanbanCard `[change,move]`, so
 *     the retry was schema-rejected too; KanbanCard has since gained a `commit`,
 *     which narrows that ONE component's trap to a wrong rejection rather than
 *     an unsatisfiable one. The 50 above are unchanged.)
 *   · The idiom has always been the norm: most contract-carrying specs bind an
 *     action on a non-commit event (change, select, move, dismiss, page). It
 *     only escaped notice because `required: true` is rare in authored specs,
 *     while the serving hosts set it routinely.
 *
 * SCOPE IS DELIBERATELY NARROW — this feeds the required check ONLY. The
 * undeclared-action check and the param checks below stay on `commitBinding`,
 * because widening THEM flips previously-valid specs to invalid, and the
 * sampled failures are false positives rather than latent defects: a Switch
 * `on.change` binding is asked for a param the declaration never marked in
 * `requiredItems` (`watchListing`.`rent`), and a DropdownMenu `on.select`
 * binding is asked to spell out `value`/`label` as literals when those ARE the
 * intrinsic payload of a select — the exact anti-pattern INTRINSIC_PAYLOAD_TYPES
 * exists to prevent. Boundness widens; nothing else does.
 *
 * Matches the notion the platform binder has always used (its
 * `boundActionNames`), which is why the binder correctly
 * declined to inject a stub button next to these bindings while the gate went on
 * rejecting them — the two disagreed, and the gate was the wrong one.
 */
function boundActionNamesOf(el: OnEl | null | undefined): Set<string> {
  const names = new Set<string>();
  if (el == null || typeof el !== 'object') return names;
  const on = el.on;
  if (!on || typeof on !== 'object') return names;
  for (const v of Object.values(on)) {
    for (const b of Array.isArray(v) ? v : [v]) {
      const a = (b as { action?: unknown } | null)?.action;
      if (typeof a === 'string' && !CONTRACT_BUILTINS.has(a)) names.add(a);
    }
  }
  return names;
}

/** Param keys declared on an action's `params`. Hosts send TWO shapes: the
 * JSON-Schema wrapper ({ type: "object", properties: {...} }) and the flat
 * key -> schema map ({ startDate: { type: "string" } }) — the tool JSON's own
 * examples use the flat form. Both must yield keys: reading only `properties`
 * would give the flat shape ZERO keys and silently no-op the param contract
 * (injecting bare param-less buttons) for that host shape. */
export function actionParamKeys(decl: ActionDecl): string[] {
  const s = decl.params;
  if (!s || typeof s !== 'object') return [];
  /* A JSON-Schema wrapper is `type:"object"` AND an object `properties` —
   BOTH, never either. Testing `'properties' in s` alone is ambiguous, because a
   param may legitimately be NAMED `properties`: real specs do (a property
   listing app, where "properties" means houses), and one may be named `type`.
   Flattening such a declaration produces `{date:{…}, properties:{…}}`, and an
   `'properties' in s` reader then treats the whole map as a wrapper and returns
   ONE param called `description`. That is not hypothetical — it produced false
   failures on the first run of the shape migration, with the error "missing
   declared param \"description\"".
   A param named `type` cannot fool this either: its value is an object, not the
   string "object". */
  const w = s as { type?: unknown; properties?: unknown };
  if (w.type === 'object' && w.properties && typeof w.properties === 'object') {
    return Object.keys(w.properties as Record<string, unknown>);
  }
  // Flat map: keys whose values are objects, on a node that is not itself a
  // JSON-Schema scalar/object declaration (no top-level `type` keyword).
  if (!('type' in s)) {
    return Object.entries(s as Record<string, unknown>)
      .filter(([, v]) => v && typeof v === 'object')
      .map(([k]) => k);
  }
  return [];
}

function isStateRef(v: unknown): v is { $state: string } {
  return !!v && typeof v === 'object' && '$state' in v;
}

/**
 * State paths the spec EXPOSES for the params-diet auto-resolve contract
 * ("params resolve from live state automatically: bind the input the user
 * edits to the param's path"): top-level initial-state
 * keys plus every `$bindState`/`$state` path bound anywhere in the elements.
 * Paths are normalized without the leading slash; only the top-level segment
 * matters for the canonical param↔path match.
 */
function exposedStatePaths(spec: FraymeSpec): Set<string> {
  const out = new Set<string>();
  const state = (spec as { state?: Record<string, unknown> }).state;
  if (state && typeof state === 'object') for (const k of Object.keys(state)) out.add(k);
  const elements = (spec as { elements?: Record<string, unknown> }).elements ?? {};
  for (const m of JSON.stringify(elements).matchAll(/"\$(?:bindState|state)"\s*:\s*"\/?([^"/]+)/g)) {
    out.add(m[1]);
  }
  return out;
}

/**
 * Every addressable state pointer at FULL depth — the initial state walked
 * recursively plus every path a control writes. exposedStatePaths above keeps
 * only the FIRST segment, which is right for the diet's canonical param↔path
 * match but blind to nesting: a wizard grouping page-1 fields under
 * `/booking/date` reads there as merely `booking`. Resolvability needs the
 * whole pointer, so it gets its own walk.
 */
function addressableStatePaths(spec: FraymeSpec): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown, prefix: string): void => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return;
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      const path = `${prefix}/${k}`;
      out.add(path);
      walk(child, path);
    }
  };
  walk((spec as { state?: unknown }).state, '');
  // Only WRITERS count as addressable — an input's $bindState, a $state read on a
  // prop, a setState statePath. NOT the action param bindings themselves: a param
  // pointing at a dead path would otherwise vouch for its own address (the button's
  // own {$state:"/amount"} would make "/amount" look addressable). So walk the
  // elements MINUS every on.* handler, where the param bindings live.
  const els = ((spec as { elements?: Record<string, unknown> }).elements ?? {}) as Record<string, unknown>;
  const writerScope = JSON.stringify(els, (k, v) => (k === 'on' ? undefined : v));
  for (const m of writerScope.matchAll(/"\$(?:bindState|state)"\s*:\s*"([^"]+)"/g)) {
    out.add(m[1].startsWith('/') ? m[1] : `/${m[1]}`);
  }
  for (const m of writerScope.matchAll(/"statePath"\s*:\s*"([^"]+)"/g)) {
    out.add(m[1].startsWith('/') ? m[1] : `/${m[1]}`);
  }
  return out;
}

/**
 * Verify a spec conforms to its declared action contract:
 *  - no element binds an UNDECLARED action
 *  - every REQUIRED action is dispatched by some element, from ANY event
 *    (a button press, or a host component's own native event)
 *  - every declared param is present and (when a state ref) resolvable —
 *    OR omitted under the v2 params diet, in which case the param's canonical
 *    state path must be exposed by the spec (auto-resolvable at emit time)
 */
export function validateActionContract(
  spec: FraymeSpec,
  contract: ActionDecl[] | undefined,
  options: ActionContractOptions = {},
): ActionContractResult {
  const coverage: GateSeverity = options.declaredCoverage ?? 'warn';
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!contract || contract.length === 0) return { valid: true, errors };

  const names = new Set(contract.map((a) => a.name));
  const elements =
    (spec as { elements?: Record<string, OnEl> }).elements ?? {};

  // An action may be bound to MORE THAN ONE element — validate params against
  // every binding (a Map keeping only the last would make the param check
  // order-dependent and silently skip the others).
  const bound = new Map<string, OnEl[]>();
  const undeclaredSeen = new Set<string>();
  // Every action dispatched ANYWHERE in the spec, on any event — see
  // boundActionNamesOf. Feeds the required check only; `bound` above stays the
  // commit-scoped map the undeclared and param checks read.
  const boundAnywhere = new Set<string>();
  for (const el of Object.values(elements)) {
    for (const n of boundActionNamesOf(el)) boundAnywhere.add(n);
    const action = commitBinding(el)?.action;
    if (typeof action === 'string') {
      const list = bound.get(action);
      if (list) list.push(el);
      else bound.set(action, [el]);
      if (!names.has(action) && !undeclaredSeen.has(action)) {
        undeclaredSeen.add(action);
        errors.push(`undeclared action bound to a button: "${action}"`);
      }
    }
  }

  // Lazily computed — only bare/partial bindings need the diet check.
  let exposed: Set<string> | undefined;
  let addressable: Set<string> | undefined;

  for (const decl of contract) {
    const els = bound.get(decl.name) ?? [];
    // BOUND = dispatched by any control, not only pressed on a button. An action
    // wired to its host's native event (Kanban move, Select change, table
    // select/dismiss) satisfies the contract; only an action wired NOWHERE fails.
    // When it is bound natively but not on a commit, `els` is empty and the param
    // loop below is a no-op — the same coverage those bindings have always had.
    if (!boundAnywhere.has(decl.name)) {
      if (decl.required) {
        errors.push(
          `required action "${decl.name}" is not bound to any control (no element dispatches it from any event)`,
        );
        continue;
      }
      // DECLARED-but-not-required and dispatched by nothing. Same boundness
      // notion as the required rule above (any event, native included), so the
      // native-event rule holds here too — this widens WHICH
      // declarations are checked, never how "bound" is decided.
      if (coverage !== 'off') {
        const msg = `declared action "${decl.name}" is not bound to any control (no element dispatches it from any event)`;
        if (coverage === 'error') errors.push(msg);
        else warnings.push(msg);
        continue;
      }
    }
    for (const el of els) {
      const actual = commitBinding(el)?.params ?? {};
      // Intrinsic-payload host: the component's own event names the object —
      // every declared param is satisfied by the intrinsic payload, and spec
      // params are OPTIONAL extras (validated below only when present).
      const intrinsicHost = INTRINSIC_PAYLOAD_TYPES.has((el as { type?: string }).type ?? '');
      for (const key of actionParamKeys(decl)) {
        const v = (actual as Record<string, unknown>)[key];
        if (v === undefined) {
          if (intrinsicHost) continue;
          // v2 params diet: an omitted param is legal when its canonical state
          // path is exposed — the emit layer resolves it from live state.
          exposed ??= exposedStatePaths(spec);
          if (exposed.has(key)) continue;
          errors.push(`action "${decl.name}" is missing declared param "${key}" (and the spec exposes no "/${key}" state path for diet auto-resolve)`);
        } else if (isStateRef(v)) {
          // A NON-EMPTY pointer is not the same as a WORKING one: getByPath
          // returns undefined for a dangling pointer, and the runtime then drops
          // the key with no warning, indistinguishable from a blank field — so
          // the pointer must also be addressable, not merely non-empty.
          if (typeof v.$state !== 'string' || !v.$state.length) {
            errors.push(`action "${decl.name}" param "${key}" has an unresolved $state`);
          } else {
            addressable ??= addressableStatePaths(spec);
            const p = v.$state.startsWith('/') ? v.$state : `/${v.$state}`;
            // A dead pointer is SILENT LOSS only when the value is actually being
            // collected — i.e. some control writes a path whose tail is this param
            // (the wizard case: input at /booking/date, param `date`, pointer the
            // dead /date). If nothing collects it, the pointer is dead because the
            // UI never gathered the value: that is an HONEST EMPTY (an injected
            // scaffold for a required action the model built no field for, or a
            // param the agent declared but did not surface), which renders as an
            // empty field rather than failing — do not reject the whole compose for it.
            if (!addressable.has(p)) {
              const tail = p.slice(p.lastIndexOf('/') + 1);
              const collectedElsewhere = [...addressable].some((a) => a !== p && a.slice(a.lastIndexOf('/') + 1) === tail);
              if (collectedElsewhere) {
                errors.push(
                  `action "${decl.name}" param "${key}" points at "${p}" but the value is collected at a different path — it would silently never reach the host. Bind the param to the path the control actually writes.`,
                );
              }
            }
          }
        }
      }
    }
  }

  return warnings.length
    ? { valid: errors.length === 0, errors, warnings }
    : { valid: errors.length === 0, errors };
}

/* ── REACHABILITY: a binding the component can never fire ────────────────────
 *
 * A control wired to an event its component never emits sits on the screen and
 * does nothing. To the user that is indistinguishable from the action having
 * been left out — but unlike an omission, nothing anywhere reports it: the
 * contract gate sees the action as BOUND, and the vocabulary check below is
 * skipped for exactly the components where this happens most.
 *
 * Two shapes, both observed in live output and both DEAD in the renderer:
 *
 * (a) TYPE has no events at all. `validateActionWiring`'s vocabulary check runs
 *     only `if (events.size > 0)`, so a component that advertises NO events
 *     accepts any `on` key silently. `Card`'s renderer takes `{element, children}`
 *     and never receives `emit` (runtime layout.tsx `Card`), so `Card.on.press`
 *     cannot fire. Seen overwhelmingly on Card, with Badge, Text and Avatar
 *     behind it.
 *     Scoped to BUILT-IN types on purpose — a BYOC manifest type is unknown to
 *     `fraymeCatalog` and would otherwise warn on every custom component, which
 *     is the false positive this check must never produce.
 *
 * (b) TYPE emits the verb but this INSTANCE cannot. DataTable advertises
 *     `commit`, yet the renderer only ever emits it from a row action
 *     (data-table.tsx runRowAction), a bulk action (runBulk), an edit save
 *     (saveEdit — and that emits `update` instead when `on.update` is bound) or
 *     an add save (saveAdd — `add` instead when `on.add` is bound). A read-only
 *     table with `on.commit` is inert. Seen in live output, never in authored
 *     specs — the live model does this on its own.
 *
 * DEFAULT SEVERITY IS `warn`, never `error`: a wiring error escalates the whole
 * compose to the fallback (the server turns `!wiring.valid` into `action_contract_violated`),
 * and an unfireable control is a PRESENTATION defect the user can see and the
 * platform can repair deterministically — it is not worth a fresh generation.
 */

/** Built-in component names, resolved lazily so this module never forces the
 *  catalog at import time. A type absent from this set is BYOC or unknown and is
 *  deliberately left alone. */
let BUILTIN_TYPES: Set<string> | undefined;
function isBuiltinType(type: string): boolean {
  BUILTIN_TYPES ??= new Set(fraymeCatalog.componentNames);
  return BUILTIN_TYPES.has(type);
}

type PropBag = Record<string, unknown>;
const idsOf = (v: unknown, drop: readonly string[]): string[] =>
  Array.isArray(v)
    ? v
        .filter((a): a is { id: string } => !!a && typeof a === 'object' && typeof (a as { id?: unknown }).id === 'string')
        .map((a) => a.id)
        .filter((id) => !drop.includes(id))
    : [];

/**
 * Per-component INSTANCE reachability. Keyed by type → (props, resolved verb,
 * the element's other bound verbs) → why this binding can never fire, or
 * undefined when it can. Every entry cites the runtime function that owns the
 * emit, because the runtime — not this file — is the source of truth for when a
 * component fires; a rule that drifts from it produces noise, which is why these
 * are warnings.
 */
const INSTANCE_REACHABILITY: Record<
  string,
  (props: PropBag, verb: string, boundVerbs: ReadonlySet<string>) => string | undefined
> = {
  DataTable: (p, verb, boundVerbs) => {
    // `rowActions` is authoritative when present; `edit`/`delete` are handled
    // INSIDE the table (beginEdit / doDeleteRow — the latter emits `dismiss`),
    // so only a custom row-action id reaches emitWith('commit').
    const rowActionIds = idsOf(p.rowActions, []);
    const customRowActions = rowActionIds.filter((id) => id !== 'edit' && id !== 'delete');
    const bulk = idsOf(p.bulkActions, ['__delete__']);
    // The edit affordance exists via `editable` OR an explicit rowActions `edit`.
    const canEdit = p.editable === true || rowActionIds.includes('edit');
    const canAdd = p.addable === true;
    if (verb === 'commit') {
      if (customRowActions.length > 0 || bulk.length > 0) return undefined;
      // saveEdit/saveAdd fall back to `commit` only when the specific verb is
      // NOT bound (data-table.tsx: `if (boundTo('update')) … else commit`).
      if (canEdit && !boundVerbs.has('update')) return undefined;
      if (canAdd && !boundVerbs.has('add')) return undefined;
      return 'this DataTable has no rowActions, no bulkActions and is neither editable nor addable, so it never emits commit — give it a row/bulk action, or move the binding to a control that fires';
    }
    if (verb === 'update' && !canEdit)
      return 'this DataTable is not editable, so it never emits update — set `editable`, or move the binding';
    if (verb === 'add' && !canAdd)
      return 'this DataTable is not addable, so it never emits add — set `addable`, or move the binding';
    return undefined;
  },
};

export interface ActionWiringOptions {
  /**
   * A named binding on an event the component can never emit — see the
   * reachability block above. Defaults to `warn`: it never escalates a compose,
   * it only makes the dead wiring visible to the binder and downstream tooling.
   */
  deadEvent?: GateSeverity;
}

/**
 * Spec-self-consistency of the action WIRING, independent of the declared
 * contract — runs PRE-BILLING (NOT in validateResolution, which is off
 * in prod). Three checks:
 *   1. referential integrity — every non-builtin `on.<event>.action` resolves to
 *      a `spec.actions[name]` handler (catches a billed spec whose control is
 *      wired to an action name with no handler → inert at click).
 *   2. event vocabulary — every `on` key canonicalizes to a verb the component's
 *      `events[]` advertises (the canonical vocabulary; legacy keys canonicalize, so
 *      `on.press` on a Button passes via `commit`). Components that declare no
 *      `events[]` (display-only) are skipped — check 3 covers them instead.
 *   3. reachability (WARNING by default) — the component, or this instance of
 *      it, never emits the bound event at all.
 */
export function validateActionWiring(
  spec: FraymeSpec,
  // BYOC: pass a union-aware `componentEvents` (from `extendCatalog`) so a custom
  // type's declared events are checked, not silently skipped. Defaults to the
  // built-in singleton lookup — byte-identical for the non-BYOC path.
  eventsFor: (type: string) => readonly string[] = componentEvents,
  options: ActionWiringOptions = {},
): ActionContractResult {
  const deadEvent: GateSeverity = options.deadEvent ?? 'warn';
  const errors: string[] = [];
  const warnings: string[] = [];
  const s = spec as {
    elements?: Record<
      string,
      { type?: string; props?: unknown; on?: Record<string, unknown> } | undefined
    >;
    actions?: unknown;
  };
  const elements = s.elements ?? {};
  const actions =
    s.actions && typeof s.actions === 'object' ? (s.actions as Record<string, unknown>) : {};

  for (const [id, el] of Object.entries(elements)) {
    const on = el?.on;
    if (!on || typeof on !== 'object') continue;
    const type = el?.type ?? '';
    const events = new Set<string>(eventsFor(type));
    // Every verb this element binds — the DataTable rule needs to know whether
    // `update`/`add` are wired before it can say whether `commit` still fires.
    const boundVerbs = new Set<string>(Object.keys(on).map((k) => resolveEventKey(type, k)));
    const instanceRule = INSTANCE_REACHABILITY[type];
    for (const [key, binding] of Object.entries(on)) {
      // (2) event vocabulary — component-scoped spellings included, so an alias
      // (DatePicker `commit` → the `select` it really emits) and an extra verb
      // (DataTable `add`/`update`) both validate exactly where the renderer
      // honours them. `resolveEventKey`/`acceptedEventKeys` are the SAME
      // helpers the runtime normalizer uses, so the two cannot diverge.
      if (events.size > 0) {
        const verb = resolveEventKey(type, key);
        const accepted = events.has(verb) || acceptedEventKeys(type, []).includes(key);
        if (!accepted) {
          errors.push(
            `elements.${id}.on.${key}: "${key}" is not an event of ${
              el?.type ?? '?'
            } (expects: ${acceptedEventKeys(type, [...events]).join(', ')})`,
          );
        }
      }
      // (3) reachability. Only NAMED bindings count: a builtin `setState` on a
      // dead event is inert too, but it moves no host-visible action and the
      // specs are full of harmless ones. Errors from (2) already describe the
      // same binding, so a key that failed the vocabulary check is not
      // double-reported here.
      if (deadEvent !== 'off') {
        const named = (Array.isArray(binding) ? binding : [binding]).some((b) => {
          const a = (b as { action?: unknown } | null)?.action;
          return typeof a === 'string' && !CONTRACT_BUILTINS.has(a);
        });
        if (named) {
          const verb = resolveEventKey(type, key);
          let why: string | undefined;
          if (events.size === 0) {
            if (isBuiltinType(type))
              why = `${type} emits no events at all — its renderer never calls emit, so this binding can never fire`;
          } else if (events.has(verb) || acceptedEventKeys(type, []).includes(key)) {
            // ABSENT props is a real answer — a DataTable with no props has no
            // row actions and is not editable, so its `commit` really is dead.
            // A MALFORMED props (string/array) is not: the prop gate fails that
            // spec anyway, and reading it as an empty bag would invent a
            // reachability warning about output nobody will ship.
            const props = el?.props ?? {};
            if (typeof props === 'object' && !Array.isArray(props))
              why = instanceRule?.(props as PropBag, verb, boundVerbs);
          }
          if (why) {
            const msg = `elements.${id}.on.${key}: unreachable — ${why}`;
            if (deadEvent === 'error') errors.push(msg);
            else warnings.push(msg);
          }
        }
      }
      // (1) referential integrity — per handler. `on[key]` is an ActionBinding
      // OR ActionBinding[] (json-render allows both); normalize so the array form
      // can't slip a phantom action past the gate. `hasOwnProperty` (not `in`) so
      // a name like "toString"/"constructor" can't bypass via the prototype chain.
      for (const b of Array.isArray(binding) ? binding : [binding]) {
        const action = (b as { action?: unknown } | null)?.action;
        if (
          typeof action === 'string' &&
          !BUILTIN_ACTIONS.has(action) &&
          !Object.prototype.hasOwnProperty.call(actions, action)
        ) {
          errors.push(
            `elements.${id}.on.${key}: action "${action}" has no spec.actions["${action}"] handler`,
          );
        }
      }
    }
  }

  return warnings.length
    ? { valid: errors.length === 0, errors, warnings }
    : { valid: errors.length === 0, errors };
}
