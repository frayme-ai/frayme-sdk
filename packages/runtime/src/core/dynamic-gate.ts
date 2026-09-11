/**
 * The CARRIER gate — which controls may dispatch an action OUT of the renderer.
 *
 * Only a Button, or a DataTable's row /
 * bulk action button, may send a declared action to the agent / host / recompose.
 * Every other component's declared action stays LOCAL: it still writes the
 * `/_ui/<fid>/<verb>` state mirror (`take()` does that as the handlers Proxy's
 * first statement, BEFORE this gate is consulted), so the next Button press
 * carries what the user did inside `event.state`. The mirror is the batching
 * channel; the Button is the submit step.
 *
 * WHY. Declared bindings routinely land on hosts that are neither Button nor
 * DataTable — a KanbanCard, a Select, a KanbanBoard, a DropdownMenu, a Switch, a
 * FeatureCard, a Form. Each of those is a round trip on every flick, pick and
 * drag, and the universal confirm (FraymeRenderer.normalizeSpecProps) then asks
 * "are you sure?" about each one. The tool JSON already documents the opt-out —
 * `live: true` "fires the action on every move with no submit step; default
 * false = the gesture stays local and an explicit submit carries it" — and the
 * runtime simply never enforced the default. This module is that enforcement.
 *
 * WHAT "A BUTTON" MEANS HERE. The rule names a GESTURE — a
 * press, the deliberate "do it" — and the first cut encoded it as the one element
 * type spelled `Button`. The difference matters: an IconButton labelled
 * "Approve" is the same <button> with the same emit and latch plumbing
 * (misc-extended.tsx); a Fab is a Button drawn floating; a Confirmation exists
 * only to send a verdict; and a Form's declared commit fires
 * from the FORM element on its submit Button's press (forms-extended.tsx, the
 * `submit: true` path), so keying on the Button's type alone made the most
 * common submit path a silent no-op.
 * None of those is a flick, a pick or a drag. The default list below is the
 * press-shaped set, and the row / bulk action AFFORDANCE (registry/_rowaction.ts,
 * drawn by DataTable, KanbanBoard and KanbanCard alike) is a carrier in its own
 * right — see `decideDynamicDispatch`. What stays local by default: every value
 * control (Select, Switch, Slider, Radio, DropdownMenu, and ButtonGroup — it
 * looks like buttons but fires `change` and binds `selected`, i.e. a segmented
 * pick), every drag (Kanban move, SplitPane), every card press (FeatureCard,
 * KanbanCard open), and typed entry (Input, PromptInput — Enter is not a press;
 * opt in with `live: true` or `dynamicActionTypes`).
 *
 * SILENT AND SAFE. A denied dispatch is INERT: no throw, no validation issue, no
 * console.error — the interaction happened, its mirror is written, and nothing
 * leaves the renderer. Nothing here can make a spec invalid.
 *
 * FAIL-CLOSED. A dispatch with no element identity (a programmatic call, a
 * `watch` handler, or a registry renderer that still fires a bare `emit` and so
 * never stashes a `fid`) cannot be shown to come from a carrier, so it is denied.
 * The alternative — "unknown means allowed" — would make the gate trivially
 * bypassable by any emit that forgot to identify itself. A `watch` handler that
 * names a declared action therefore stays local: it has no gesture to carry it,
 * and the state change it watched is already in state for the next press.
 *
 * ONE PREDICATE, THREE SEAMS. The commit latch (react/intrinsic.tsx), the param
 * freeze (react/param-freeze.tsx) and the automatic confirm
 * (FraymeRenderer.normalizeSpecProps) each need to know, BEFORE any fire, whether
 * a declared binding would leave the renderer — a control the Proxy will deny must
 * not latch, must not freeze the fields feeding it, and must not ask "are you
 * sure?" about a gesture that goes nowhere. They all read `bindingDispatches` /
 * `verbDispatches` below, so the static answer and the Proxy's runtime decision
 * cannot drift apart.
 *
 * PURE module: no React, no @json-render imports (structural types only), like
 * ./intrinsic.ts.
 */
import type { IntrinsicAffordance } from './intrinsic.js';

/**
 * The element types allowed to dispatch out of the renderer by default — the
 * press-shaped set (see the module header for why it is wider than `Button`).
 * Widen per instance with `<FraymeRenderer dynamicActionTypes={[...]} />`; the
 * prop REPLACES this list (spread it in to extend it).
 *
 *  · Button · IconButton · Fab — one press, one declared `commit`; all three
 *    render a <button>, call useIntrinsicEmit and latch the same way.
 *  · Confirmation — its confirm / deny buttons ARE the component; a verdict that
 *    cannot leave the renderer is a dead card (covered by the lifecycle tests).
 *  · Form — its only verb is `commit`, and it fires solely from a submit gesture:
 *    the native submit of a `submit: true` Button, a bindings-less Button's press
 *    routed through FormCommitContext, or Enter in a text field (implicit
 *    submission). The Form is the element that DECLARES the action and whose
 *    mirror the latch and the param freeze read, so it — not the Button that
 *    triggered it — is what the Proxy sees.
 *  · DataTable — every declared verb (sort / page / select / commit / add /
 *    update). The row and bulk action buttons are also carried by affordance,
 *    which is what makes the same buttons on a KanbanBoard / KanbanCard go.
 */
export const DEFAULT_DYNAMIC_ACTION_TYPES: readonly string[] = [
  'Button',
  'IconButton',
  'Fab',
  'Confirmation',
  'Form',
  'DataTable',
];

/** Why a dispatch was allowed or denied — surfaced for tests and dev logging. */
export type DynamicDispatchReason =
  /** The firing element's type is in the allowed carrier list. */
  | 'carrier'
  /** The fire was a row / bulk action press (registry/_rowaction.ts) — the
   *  rule's "row / bulk action button", on whichever host drew it. */
  | 'item-action'
  /** The element binds this action with `live: true` — the declared opt-out. */
  | 'live'
  /** The element is known, is not a carrier, and did not opt out. */
  | 'denied:not-carrier'
  /** No fid, or the fid resolves to no typed element in the current spec. */
  | 'denied:unknown-element';

export interface DynamicDispatchDecision {
  allowed: boolean;
  reason: DynamicDispatchReason;
}

export interface DecideDynamicDispatchInput {
  /** The CURRENT spec (the renderer's `specRef.current`). Any shape; read structurally. */
  spec: unknown;
  /** The firing element's id, from the intrinsic entry (`intrinsic?.fid`). */
  fid: string | null | undefined;
  /** The action name being dispatched. */
  action: string;
  /** The carrier list in force (the `dynamicActionTypes` prop, or the default). */
  allowedTypes: readonly string[];
  /**
   * The gesture class the RENDERER asserted at the emit site (`intrinsic?.affordance`).
   * Only the per-item action contract names one; it is set by runtime code,
   * never read from the spec, so a spec cannot claim it.
   */
  affordance?: IntrinsicAffordance | null;
}

/** Structural view of one spec element — only what the gate reads. */
type ElementLike = { type?: unknown; on?: unknown; props?: unknown; rowActions?: unknown } | null | undefined;

/**
 * True when `element.on` binds `action` with `live: true` on ANY key.
 *
 * EVERY key, not the canonical eight: the renderer canonicalises `on` keys
 * (press → commit) only in its render copy, and the gate reads the raw current
 * spec, so a legacy alias must be found where the author wrote it. Each key may
 * hold an ActionBinding OR an ActionBinding[] (json-render allows both).
 */
export function hasLiveBinding(element: unknown, action: string): boolean {
  const on = (element as ElementLike)?.on;
  if (!on || typeof on !== 'object') return false;
  for (const binding of Object.values(on as Record<string, unknown>)) {
    for (const b of Array.isArray(binding) ? binding : [binding]) {
      const bb = b as { action?: unknown; live?: unknown } | null;
      if (bb && typeof bb === 'object' && bb.action === action && bb.live === true) return true;
    }
  }
  return false;
}

/**
 * True when `element.on` carries ANY non-builtin binding with `live: true` — the
 * element-wide view of the opt-out. `builtins` is injected rather than imported
 * so this module stays dependency-free.
 *
 * NO LONGER THE LATCH'S PREDICATE. The latch armed on this while
 * the Proxy decided per action, so a Switch declaring `change → recut` (not live)
 * and `commit → apply` (live) LATCHED after the denied flick: the flick's mirror
 * was written, the element-wide answer said "dispatches", and the control froze
 * on a fire that never left the renderer — the exact outcome this gate exists to prevent.
 * The latch now reads `verbDispatches`, per verb. Kept exported for hosts that
 * want the element-wide question.
 */
export function hasAnyLiveBinding(element: unknown, builtins: ReadonlySet<string>): boolean {
  const on = (element as ElementLike)?.on;
  if (!on || typeof on !== 'object') return false;
  for (const binding of Object.values(on as Record<string, unknown>)) {
    for (const b of Array.isArray(binding) ? binding : [binding]) {
      const bb = b as { action?: unknown; live?: unknown } | null;
      if (!bb || typeof bb !== 'object' || typeof bb.action !== 'string') continue;
      if (!builtins.has(bb.action) && bb.live === true) return true;
    }
  }
  return false;
}

/**
 * True when `element` draws the per-item action contract (registry/_rowaction.ts):
 * a `rowActions` or `bulkActions` list in `props`, or — a placement generated
 * specs also use — `rowActions` as a sibling of `props`. The same
 * two placements `readRowActions` honours, so the static answer matches what the
 * renderer will actually draw.
 */
export function declaresItemActions(element: unknown): boolean {
  const el = element as ElementLike;
  if (!el || typeof el !== 'object') return false;
  const props = el.props as { rowActions?: unknown; bulkActions?: unknown } | null | undefined;
  return Array.isArray(props?.rowActions) || Array.isArray(props?.bulkActions) || Array.isArray(el.rowActions);
}

/**
 * The STATIC half of the decision, per binding: would a fire of `binding` on
 * `verb` from `element` leave the renderer? Mirrors `decideDynamicDispatch`
 * without a fire in hand:
 *   · the element's type is a carrier, or
 *   · `verb` is `commit` and the element draws row / bulk actions — the press
 *     that fires that commit is the item-action affordance, carried on any host, or
 *   · the binding itself says `live: true`.
 * `verb` is read as written; callers pass the canonicalised render copy.
 */
export function bindingDispatches(
  element: unknown,
  verb: string,
  binding: unknown,
  allowedTypes: readonly string[],
): boolean {
  const type = (element as ElementLike)?.type;
  if (typeof type === 'string' && allowedTypes.includes(type)) return true;
  if (verb === 'commit' && declaresItemActions(element)) return true;
  const bb = binding as { live?: unknown } | null | undefined;
  return !!bb && typeof bb === 'object' && bb.live === true;
}

/**
 * The per-VERB form, for a seam that watches a verb rather than one binding (the
 * commit latch reads one mirror slot per verb): true when any binding under
 * `element.on[verb]` would dispatch. A verb with no bindings dispatches only by
 * type or affordance — the caller decides whether that verb is declared at all.
 */
export function verbDispatches(element: unknown, verb: string, allowedTypes: readonly string[]): boolean {
  const on = (element as ElementLike)?.on;
  const raw = on && typeof on === 'object' ? (on as Record<string, unknown>)[verb] : undefined;
  const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [undefined];
  return list.some((b) => bindingDispatches(element, verb, b, allowedTypes));
}

/**
 * The decision, in precedence order:
 *   1. no fid / no typed element at that id  → denied:unknown-element (fail-closed)
 *   2. element.type ∈ allowedTypes           → carrier
 *   3. the fire was a row / bulk action press → item-action
 *   4. element binds `action` with live:true → live
 *   5. otherwise                             → denied:not-carrier
 * Never throws: every read is structural and every miss is a deny.
 *
 * ON (3): the affordance outranks `allowedTypes` the way `live: true` does — both
 * are statements about the FIRE, not the host. A KanbanCard's "Reassign driver"
 * is the same `_rowaction.ts` button as a DataTable's, opens the same derived
 * confirm, and the rule names that button; keying it on the host's type made
 * the reader accept a modal for a dispatch that then went nowhere. Narrowing
 * `dynamicActionTypes` silences the host's OTHER verbs (a DataTable's sort, a
 * board's move), never its item-action presses; the author's opt-out is to not
 * bind `on.commit` for them.
 */
export function decideDynamicDispatch(input: DecideDynamicDispatchInput): DynamicDispatchDecision {
  const { spec, fid, action, allowedTypes, affordance } = input;
  if (typeof fid !== 'string' || !fid) return { allowed: false, reason: 'denied:unknown-element' };
  const elements = (spec as { elements?: unknown } | null | undefined)?.elements;
  if (!elements || typeof elements !== 'object') return { allowed: false, reason: 'denied:unknown-element' };
  // Own-property only: an id like 'constructor' must not resolve a prototype member.
  const element = Object.hasOwn(elements, fid)
    ? ((elements as Record<string, unknown>)[fid] as ElementLike)
    : undefined;
  const type = element && typeof element === 'object' ? element.type : undefined;
  if (typeof type !== 'string') return { allowed: false, reason: 'denied:unknown-element' };
  if (allowedTypes.includes(type)) return { allowed: true, reason: 'carrier' };
  if (affordance === 'row-action' || affordance === 'bulk-action') return { allowed: true, reason: 'item-action' };
  if (hasLiveBinding(element, action)) return { allowed: true, reason: 'live' };
  return { allowed: false, reason: 'denied:not-carrier' };
}
