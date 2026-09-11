/**
 * Intrinsic event payloads — the client-side half of the agent-grade action
 * contract.
 *
 * json-render's `emit(event)` carries NO payload: the params that reach the
 * handlers Proxy are ONLY the spec-authored `ActionBinding.params` expressions.
 * But the interaction data an agent needs (which column sorted, which card
 * moved, the typed prompt text) lives in the RENDERER at the emit call site.
 * This module carries it across the json-render boundary:
 *
 *   renderer:  emitWith('sort', { sortBy, sortDir })   // stash → emit('sort')
 *   Proxy:     const intrinsic = slots.take(action)     // pop-on-consume
 *              params = mergeIntrinsicParams(intrinsic.payload, authoredParams)
 *
 * Slots are keyed BY ACTION NAME, not a single pending slot: json-render's emit
 * loops `await execute(b)` over ActionBinding ARRAYS, so a second binding's
 * handler can run microtasks-to-arbitrarily later — any timing-based clear
 * (microtask/setTimeout) is provably wrong. Keying by action is deterministic
 * for single bindings, sync arrays, and async arrays alike.
 *
 * NO STALE ENTRIES. A user-cancelled `confirm` binding leaves
 * its handler unrun, so nothing ever `take`s the entry. That used to be
 * documented as a bounded leak — "consumed only by the same action, overwritten
 * by the next stash". Under the carrier gate (dynamic-gate.ts) it became a hole:
 * the next fire of that action name from an UNIDENTIFIED source (a bare `emit`,
 * an `onSuccess` chain) inherited the cancelled Button's fid, passed the gate as
 * that Button, was reported with its `element_id`, and wrote its mirror — so a
 * confirm the user declined vouched for a later dispatch and latched the Button.
 * `discard` closes it: the emit site calls it when json-render's emit promise
 * SETTLES (resolved or rejected), which is after every handler that was going to
 * run has run and taken its entry; whatever is still keyed under this element's
 * fire is by construction stale. Matched on fid + event + row so a different
 * element's pending entry for the same action name is never dropped.
 *
 * PURE module: no React, no @json-render imports (structural types only).
 */

/**
 * json-render actions handled inline inside its ActionProvider.execute() —
 * they never reach the Frayme handlers Proxy, so stashing for them would leak.
 * Verified against @json-render/react@0.19.x (see upstream.ts version pin).
 */
export const JSON_RENDER_BUILTIN_ACTIONS: ReadonlySet<string> = new Set([
  'setState',
  'pushState',
  'removeState',
  'push',
  'pop',
  'validateForm',
]);

/**
 * The gesture class of a fire, when the renderer can name one. Only the
 * per-item action contract (registry/_rowaction.ts — DataTable, KanbanBoard,
 * KanbanCard) declares itself: the carrier gate (dynamic-gate.ts) treats a row or
 * bulk action press as a carrier on every host that draws one. Asserted by
 * RUNTIME code at the emit site, never read from the spec — a spec cannot claim it.
 */
export type IntrinsicAffordance = 'row-action' | 'bulk-action';

/** A payload captured at the emit call site, pending its handler dispatch. */
export interface IntrinsicEntry {
  /** The canonical verb the renderer fired (commit|select|change|dismiss|search|sort|page|move). */
  event: string;
  /** The interaction data, per the per-verb contract (see IntrinsicEventPayloads). */
  payload: Record<string, unknown>;
  ts: number;
  /** Element id, carried so `take` can mirror at EXECUTION time. See stash(). */
  fid?: string | null;
  /** json-render repeat index of the instance that fired, when it fired inside a
   *  `repeat`. Carried for the SAME reason `fid` is: the row-scoped mirror can only
   *  be written at execution time, past the confirm gate. See take(). */
  row?: number | null;
  /** The gesture class the renderer asserted for this fire, if any. See IntrinsicAffordance. */
  affordance?: IntrinsicAffordance | null;
}

/**
 * The standard per-verb intrinsic payload contract. Renderers pass these keys
 * to `emitWith`; hosts receive them in `DynamicActionEvent.params` (spec-authored
 * params override per-key). The catalog prompt documents the same contract —
 * keep this table in sync with the registry call sites.
 *
 *  - sort    → { sortBy, sortDir }
 *  - page    → { page }
 *  - select  → { value?, label?, id?, index?, selected?, checked? }   (multi: full set)
 *  - change  → { value?, name?, … }  + component identity (toggled/card/column/index)
 *  - commit  → { value?, fields?, label?, name?, index? }             (Form: named field values)
 *  - search  → { query }
 *  - dismiss → { value?, label?, index?, all? }
 *  - move    → kanban { card, fromColumn, toColumn, fromIndex, toIndex } ·
 *              splitpane { splitPercent } · resizable { width, height, axis }
 */
export interface IntrinsicEventPayloads {
  sort: { sortBy: string; sortDir: 'asc' | 'desc' | 'none' };
  page: { page: number };
  select: {
    value?: unknown;
    label?: string | null;
    id?: string;
    index?: number;
    selected?: unknown[];
    checked?: boolean;
  };
  change: Record<string, unknown> & { value?: unknown; name?: string };
  commit: {
    value?: unknown;
    fields?: Record<string, unknown>;
    label?: string | null;
    name?: string;
    index?: number;
    // a secondary affordance within a composite control fired the primary
    // verb (e.g. PromptInput's attach button → commit with control:'attach').
    control?: string;
  };
  search: { query: string };
  // `auto` marks a dismiss the RUNTIME initiated (e.g. Toast auto-dismiss on
  // timeout) rather than a user gesture.
  dismiss: { value?: unknown; label?: string | null; index?: number; all?: boolean; auto?: boolean };
  move: Record<string, unknown>;
}

/** The `on` block shape we introspect at stash time (canonicalized by the renderer). */
type OnBlock = Record<string, unknown> | undefined;

/**
 * Minimal structural view of the state store the auto-mirror writes to. Declared
 * here (not imported) so this module stays a PURE, React/@json-render-free unit.
 */
export interface IntrinsicStoreLike {
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
}

export interface IntrinsicSlots {
  /**
   * Called by `emitWith` immediately BEFORE `emit(event)`: enqueues the payload
   * once per non-builtin binding action on `element.on[event]` (array-aware).
   * Unbound event → emit() will no-op → nothing stashed (no leak). An EMPTY
   * payload is still stashed when `fid` is known: the entry then carries element
   * identity alone (the carrier gate reads it) and `take` writes no mirror for it.
   * A binding's `onSuccess` / `onError` chain gets an identity-only entry too —
   * see the implementation for why.
   */
  stash(
    on: OnBlock,
    event: string,
    payload: Record<string, unknown>,
    fid?: string | null,
    row?: number | null,
    affordance?: IntrinsicAffordance | null,
  ): boolean;
  /** Called by the handlers Proxy as its FIRST statement. Pop-on-consume. */
  take(action: string): IntrinsicEntry | undefined;
  /**
   * Drop every entry still pending for THIS element's fire (matched on fid +
   * event + row). Called by `emitWith` once json-render's emit promise settles —
   * see the module header ("NO STALE ENTRIES"). No fid → nothing to match → no-op.
   */
  discard(fid: string | null | undefined, event: string, row?: number | null): void;
  /**
   * AUTOMATIC STATE MIRROR (the "state, not just action params" contract). On EVERY
   * intrinsic emit, write the interaction payload into spec.state under a reserved
   * `/_ui/<elementId>/<event>` key — so an agent (or a sibling Button) can read what
   * the user just did from state WITHOUT the author having bound a `{$bindState}`
   * prop. Nested by event so selection/sort/page snapshots coexist (latest-per-verb).
   * No-op when there is no store (renderer mounted outside a state provider).
   */
  mirror(fid: string, event: string, payload: Record<string, unknown>): void;
}

/**
 * Per-FraymeRenderer-instance pending payloads (keyed by action name) + the state
 * mirror. `getStore` returns the LIVE store (it changes across restartKey), so the
 * slots — created once — always read the current one.
 */
export function createIntrinsicSlots(
  getStore?: () => IntrinsicStoreLike | null | undefined,
): IntrinsicSlots {
  const slots = new Map<string, IntrinsicEntry>();
  return {
    stash(on, event, payload, fid, row, affordance) {
      const binding = on?.[event];
      if (!binding) return false;
      const ts = Date.now();
      const list = Array.isArray(binding) ? binding : [binding];
      // The actions THIS call enqueued with a real payload — a chain entry below
      // must not overwrite one of them (a name can be both a primary and a chain
      // target in the same array; the payload-carrying entry is the one to keep).
      const primaries = new Set<string>();
      for (const b of list) {
        const action = (b as { action?: unknown } | null)?.action;
        if (typeof action !== 'string' || JSON_RENDER_BUILTIN_ACTIONS.has(action)) continue;
        slots.set(action, { event, payload, ts, fid, row, affordance }); // last-write-wins per action
        primaries.add(action);
      }
      /* CHAINS INHERIT THEIR TRIGGER'S IDENTITY. json-render runs a
         binding's `onSuccess: { action }` / `onError: { action }` by re-entering
         `execute({ action: name })` from INSIDE executeAction — a fresh binding with
         no params and, crucially, no emit site: nothing calls `emitWith` for it, so
         nothing stashed a fid and the carrier gate (dynamic-gate.ts) denied every
         chained action as `unknown-element`, with no opt-out — a Button's
         `commit: { action: 'save', onSuccess: { action: 'notify' } }` delivered
         `save` and swallowed `notify`. The catalog validator passes these chains
         through (resolution.ts checkOn), so they are a supported shape.
         An identity-only entry (`payload: {}`) under each chained name carries the
         trigger's fid / verb / row / affordance, so the chain gets the SAME decision
         its trigger got: carried from a Button, denied from a Select. `{}` keeps
         the chained handler's params byte-identical to before (json-render's
         sub-binding has none) and writes no mirror (`take` skips an empty payload).
         Whichever branch does NOT run — `onError` after a success, `onSuccess`
         after a failure — is left pending and swept by `discard` at settle. */
      for (const b of list) {
        const bb = b as { action?: unknown; onSuccess?: unknown; onError?: unknown } | null;
        if (typeof bb?.action !== 'string' || JSON_RENDER_BUILTIN_ACTIONS.has(bb.action)) continue;
        for (const chained of [bb.onSuccess, bb.onError]) {
          const next = (chained as { action?: unknown } | null | undefined)?.action;
          if (typeof next !== 'string' || JSON_RENDER_BUILTIN_ACTIONS.has(next) || primaries.has(next)) continue;
          slots.set(next, { event, payload: {}, ts, fid, row, affordance });
        }
      }
      return primaries.size > 0;
    },
    discard(fid, event, row) {
      if (!fid) return;
      for (const [action, entry] of slots) {
        if (entry.fid === fid && entry.event === event && (entry.row ?? null) === (row ?? null)) slots.delete(action);
      }
    },
    take(action) {
      const entry = slots.get(action);
      slots.delete(action);
      // MIRROR AT EXECUTION, NOT AT EMIT. `take` is the handlers Proxy's first
      // statement, so it runs only once json-render has cleared the binding's
      // `confirm` gate and reached the handler. Mirroring in `emitWith` instead
      // wrote the payload BEFORE the modal opened: pressing Delete and then
      // CANCELLING still left /_ui/<id>/commit populated, so a button bound
      // `disabled: {$state:"/_ui/<id>/commit"}` latched off — locking the user out
      // of an action they had just declined, with no way back, because a disabled
      // button can never emit again to clear its own entry.
      //
      // NO MIRROR FOR AN EMPTY PAYLOAD. The emit side now stashes an identity-only
      // entry (`payload: {}`) for a payload-less fire so the carrier gate can see
      // WHICH element fired (react/intrinsic.tsx); such a fire never wrote a mirror
      // before and still does not — writing `{}` would arm the commit latch on a
      // control that recorded nothing.
      if (entry?.fid && Object.keys(entry.payload).length > 0) {
        const store = getStore?.();
        if (store) {
          try { store.set(`/_ui/${entry.fid}/${entry.event}`, entry.payload); } catch { /* best-effort */ }
          /* ROW-SCOPED MIRROR — the latch's per-instance half.
             json-render's `repeat` renders ONE element definition once per row, so
             every row shares a single `__fid` and therefore a single
             `/_ui/<fid>/<verb>` slot. In practice, confirming "Acknowledge" on
             alert ALT-231 disabled the Acknowledge button on all four alerts,
             because useCommitLatch could only ask "has this ELEMENT fired", never
             "has this ROW fired".
             Written ALONGSIDE the shared slot, never instead of it: a spec may bind
             `disabled: {$state:"/_ui/<id>/commit"}` by hand and an agent reads the
             shared path to learn what the user last did, so both must keep working.
             `__rows` is a sibling key under the element's own mirror, and the guard
             below keeps it out of the way of a verb literally named `__rows`.
             CAVEAT, STATED: the key is the repeat INDEX, so removing a row shifts
             the latches of the rows after it, and two rows of an OUTER repeat share
             the inner indices of a nested one. json-render's RepeatScopeValue carries
             only {item, index, basePath} — the parent's `repeat.key` is not in scope
             — and guessing an identity field would be less predictable than the
             index, not more. Both shapes are strictly better than the shared slot
             this replaces, which collapsed every row onto one latch unconditionally. */
          if (entry.row != null && Number.isInteger(entry.row) && entry.event !== '__rows') {
            try {
              store.set(`/_ui/${entry.fid}/__rows/${entry.row}/${entry.event}`, entry.payload);
            } catch { /* best-effort */ }
          }
        }
      }
      return entry;
    },
    mirror(fid, event, payload) {
      const store = getStore?.();
      // JSON-Pointer segments: a fid/event containing '/' or '~' would corrupt the
      // path — skip (element ids + the 8 canonical verbs never contain them).
      if (!store || !fid || !event || /[/~]/.test(fid) || /[/~]/.test(event)) return;
      try {
        store.set(`/_ui/${fid}/${event}`, payload);
      } catch {
        /* best-effort — a store that rejects the path must not break the emit */
      }
    },
  };
}

/**
 * Merge an intrinsic payload under the spec-authored params: intrinsic fills
 * the floor, authored keys win — EXCEPT an authored key that resolved to
 * `undefined` (e.g. `{ $state: '/missing' }`) must not clobber an intrinsic
 * value. Empty/absent intrinsic → authored params pass through untouched.
 */
export function mergeIntrinsicParams(
  intrinsic: Record<string, unknown>,
  authored: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...intrinsic };
  for (const [k, v] of Object.entries(authored ?? {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
