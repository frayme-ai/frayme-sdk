'use client';
/**
 * PARAM FREEZE — lifecycle rules 3, 4 and 5.
 *
 *   3. When a button is pressed with its conditions satisfied, every param related
 *      to that action becomes disabled, and so does the action.
 *   4. Params the host supplied become read-only.
 *   5. Actions and params are never enabled again once the action has been sent.
 *
 * `useCommitLatch` already does the ACTION half: the button that fired a declared
 * action latches off. This is the PARAM half — the inputs that fed it freeze too.
 * Without it a screen reads as half-committed: the button is dead, but the amount
 * that was sent is still editable, so the value on screen can drift away from the
 * value the agent received, with nothing to signal it.
 *
 * WHY A SPEC-WIDE MAP AND NOT A LOCAL FLAG. The control that holds a param has no
 * idea which action consumes it — the relationship lives on the BUTTON's binding,
 * somewhere else entirely in the tree. So the ownership is computed once from the
 * spec (path -> the buttons whose actions read it) and read back by path.
 *
 * WHERE A PARAM'S STATE PATH COMES FROM, in priority order:
 *   1. the binding's explicit map — {"params": {"amount": {"$state": "/amount"}}}
 *   2. the params diet's canonical path — param `amount` resolves from `/amount`
 * Both are needed: the diet means most specs never write (1), and reading only (1)
 * would freeze almost nothing.
 *
 * NOT DERIVED FROM THE DECLARATION ALONE. An action's declared params say what the
 * host wants; the BINDING says what this screen actually sends. A declared param
 * that no control on this screen binds has nothing to freeze, and freezing by
 * declared NAME would catch unrelated controls that happen to bind /amount for a
 * different purpose.
 *
 * ONLY BINDINGS THAT DISPATCH OWN ANYTHING. Rules 3/4/5 speak of
 * an action that "has been sent". Under the carrier gate (core/dynamic-gate.ts) a
 * Select's `change → setRegion` is never sent — it writes /_ui/<id>/change and
 * stops — yet the first cut registered EVERY declared binding as an owner, so that
 * denied change froze the very Select that made it: greyed chrome, writes
 * rejected, and the bound value stuck one step behind the mirror (state said
 * `apac` while `_ui.region.change` said `emea`). The commit latch had been taught
 * the gate's predicate; this map had not. It reads the same predicate now
 * (`bindingDispatches`), so a control feeding a host-declared param stays writable
 * until a binding that actually leaves the renderer fires.
 */
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { JSON_RENDER_BUILTIN_ACTIONS } from '../core/intrinsic.js';
import { DEFAULT_DYNAMIC_ACTION_TYPES, bindingDispatches } from '../core/dynamic-gate.js';
import { useStateValue } from './upstream.js';

/** A path no spec writes — makes an unconditional hook call inert. */
const INERT_PATH = '/_ui/__frayme_inert__';
import type { ComponentRenderProps } from './upstream.js';

/** state path -> the `_ui` mirror paths that mean "an action reading it has fired". */
export type ParamOwners = Map<string, string[]>;

const ParamFreezeContext = createContext<ParamOwners | null>(null);
export const ParamFreezeProvider = ParamFreezeContext.Provider;

const asPath = (p: unknown): string | null =>
  typeof p === 'string' && p.trim() ? `/${p.trim().replace(/^\//, '')}` : null;

/** Every `$bindState` path an element writes, from its own props. */
export function ownBoundPaths(el: unknown): string[] {
  const out: string[] = [];
  const props = (el as { props?: Record<string, unknown> } | null)?.props;
  if (!props || typeof props !== 'object') return out;
  for (const v of Object.values(props)) {
    const p = (v as { $bindState?: unknown } | null)?.$bindState;
    if (typeof p === 'string' && p.startsWith('/')) out.push(p);
  }
  return out;
}

/**
 * Build the ownership map from a spec. Pure; memoize on the spec and the carrier
 * list. Exported for tests — the map is the whole behaviour, and asserting it
 * directly is far cheaper than rendering a tree and inferring what froze.
 * `allowedTypes` is the carrier list in force (the renderer's `dynamicActionTypes`,
 * default the gate's own list) — a binding the gate would deny owns nothing.
 */
export function buildParamOwners(
  spec: unknown,
  allowedTypes: readonly string[] = DEFAULT_DYNAMIC_ACTION_TYPES,
): ParamOwners {
  const owners: ParamOwners = new Map();
  const s = spec as { elements?: Record<string, unknown>; actions?: Record<string, unknown> } | null;
  const els = s?.elements;
  if (!els || typeof els !== 'object') return owners;

  const declaredParams = (name: string): string[] => {
    const a = (s?.actions as Record<string, { params?: unknown }> | undefined)?.[name];
    const p = a?.params;
    if (!p || typeof p !== 'object') return [];
    const w = p as { type?: unknown; properties?: unknown };
    // Same wrapper discriminator as the catalog validator and the serializer: a
    // JSON-Schema wrapper is `type:"object"` AND an object `properties`, both — a
    // param may legitimately be NAMED `properties`.
    const src = w.type === 'object' && w.properties && typeof w.properties === 'object'
      ? (w.properties as Record<string, unknown>)
      : (p as Record<string, unknown>);
    return Object.keys(src);
  };

  for (const [id, el] of Object.entries(els)) {
    const on = (el as { on?: Record<string, unknown> } | null)?.on;
    if (!on || typeof on !== 'object') continue;
    for (const [verb, binding] of Object.entries(on)) {
      for (const b of (Array.isArray(binding) ? binding : [binding])) {
        const bb = b as { action?: unknown; params?: Record<string, unknown> } | null;
        const name = bb?.action;
        if (typeof name !== 'string' || JSON_RENDER_BUILTIN_ACTIONS.has(name)) continue;
        // A binding the carrier gate keeps local is never "sent" — nothing to freeze.
        if (!bindingDispatches(el, verb, bb, allowedTypes)) continue;
        const mirror = `/_ui/${id}/${verb}`;
        const seen = new Set<string>();
        // (1) explicit binding params
        if (bb?.params && typeof bb.params === 'object') {
          for (const [k, v] of Object.entries(bb.params)) {
            const p = asPath((v as { $state?: unknown } | null)?.$state) ?? asPath(k);
            if (p) seen.add(p);
          }
        }
        // (2) the diet's canonical path, for every param the host declared
        for (const k of declaredParams(name)) { const p = asPath(k); if (p) seen.add(p); }
        for (const p of seen) {
          const list = owners.get(p);
          if (list) { if (!list.includes(mirror)) list.push(mirror); }
          else owners.set(p, [mirror]);
        }
      }
    }
  }
  return owners;
}

export function useParamOwners(
  spec: unknown,
  allowedTypes: readonly string[] = DEFAULT_DYNAMIC_ACTION_TYPES,
): ParamOwners {
  return useMemo(() => buildParamOwners(spec, allowedTypes), [spec, allowedTypes]);
}

/**
 * True once an action fed by this control has committed.
 *
 * Hooks run unconditionally (Rules of Hooks) with a null path when there is nothing
 * to watch, exactly as useCommitLatch does. Capped at four watched paths: a control
 * feeding five different actions is not a shape specs take, and an
 * unbounded hook count would break the rules on the first spec that did.
 */
const MAX_WATCHED = 4;

export function useParamFrozen(element: ComponentRenderProps['element']): boolean {
  const owners = useContext(ParamFreezeContext);
  const paths = owners ? ownBoundPaths(element) : [];
  const mirrors: string[] = [];
  if (owners) {
    for (const p of paths) for (const m of owners.get(p) ?? []) if (!mirrors.includes(m)) mirrors.push(m);
  }
  const props = (element as { props?: Record<string, unknown> })?.props ?? {};
  // Same opt-out as the latch, for a control the author wants left live.
  const optedOut = props.latch === false;
  const w = optedOut ? [] : mirrors.slice(0, MAX_WATCHED);
  // useStateValue, not useBoundProp — see useCommitLatch. useBoundProp returns its
  // first argument unchanged, so reading with `undefined` yielded `undefined` and
  // the freeze never engaged. Same defect, same seam, found together.
  const a = useStateValue<unknown>(w[0] ?? INERT_PATH);
  const b = useStateValue<unknown>(w[1] ?? INERT_PATH);
  const c = useStateValue<unknown>(w[2] ?? INERT_PATH);
  const d = useStateValue<unknown>(w[3] ?? INERT_PATH);
  return a != null || b != null || c != null || d != null;
}

/**
 * The by-PATH form, for `useLocalOrBound` — the seam every bound control passes
 * through. Same contract as useParamFrozen, keyed on the binding path rather than
 * on an element, because at that seam the control's identity is not in scope.
 *
 * Hook count is fixed and unconditional: a null path makes each read inert, exactly
 * as useCommitLatch does. Watching at most four owners is a deliberate cap — a
 * single path feeding five distinct declared actions is not a shape specs
 * take, and an unbounded count would violate the Rules of Hooks the first time
 * one did.
 */
export function usePathFrozen(bindingPath: unknown): boolean {
  const owners = useContext(ParamFreezeContext);
  const p = typeof bindingPath === 'string' && bindingPath.startsWith('/') ? bindingPath : null;
  const mirrors = (p && owners ? owners.get(p) : undefined) ?? [];
  const w = mirrors.slice(0, MAX_WATCHED);
  // useStateValue, not useBoundProp — see useCommitLatch. useBoundProp returns its
  // first argument unchanged, so reading with `undefined` yielded `undefined` and
  // the freeze never engaged. Same defect, same seam, found together.
  const a = useStateValue<unknown>(w[0] ?? INERT_PATH);
  const b = useStateValue<unknown>(w[1] ?? INERT_PATH);
  const c = useStateValue<unknown>(w[2] ?? INERT_PATH);
  const d = useStateValue<unknown>(w[3] ?? INERT_PATH);
  return a != null || b != null || c != null || d != null;
}

/**
 * RULE 2 — "If a dynamic action with required items, then the action is enabled and
 * you are highlighted with required item focussed."
 *
 * On mount, find the first REQUIRED param of a declared action that has no value
 * yet, and focus the control bound to it. That tells the reader where to start on a
 * screen whose primary button needs three fields they cannot see from the button.
 *
 * WHY BY DOM id AND NOT A ref. Controls already render `id={__fid}` — their own spec
 * element id (forms.tsx:381) — so the element the reader must fill is addressable
 * without threading a ref through 40 registry files, each of which forwards refs
 * differently or not at all.
 *
 * ONCE, ON MOUNT, NEVER AGAIN. `done` latches. Re-focusing whenever state changes
 * would yank focus out of whatever the reader is typing the moment a required
 * field elsewhere empties — an autofocus that fights the user is worse than none.
 *
 * SILENT WHEN THERE IS NOTHING TO DO: no required items, all filled, or the bound
 * control is not focusable. Never scrolls; `preventScroll` keeps the page still,
 * because a screen that jumps on load reads as broken even when the focus is right.
 */
export function useFocusFirstRequired(spec: unknown, owners: ParamOwners): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || typeof document === 'undefined') return;
    const s = spec as { elements?: Record<string, unknown>; actions?: Record<string, unknown>; state?: unknown } | null;
    const actions = s?.actions;
    if (!actions || typeof actions !== 'object' || !s?.elements) return;

    const read = (path: string): unknown => {
      let cur: unknown = s.state;
      for (const seg of path.split('/').filter(Boolean)) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[seg];
      }
      return cur;
    };
    const empty = (v: unknown) => v === undefined || v === null || v === '' ||
      (Array.isArray(v) && v.length === 0);

    for (const decl of Object.values(actions)) {
      const items = (decl as { requiredItems?: unknown })?.requiredItems;
      if (!Array.isArray(items)) continue;
      for (const name of items) {
        if (typeof name !== 'string') continue;
        const path = `/${name.replace(/^\//, '')}`;
        if (!empty(read(path))) continue;
        if (!owners.has(path)) continue;          // nothing on this screen feeds it
        /* The control that BINDS this path is the one to focus. Its DOM id is NOT
           the spec element id: forms.tsx `fieldId()` builds `frayme-<slug>` from the
           first non-empty of (binding path, checked path, name, label) — so a control
           bound to `/amount` renders as id="frayme-amount".
           COUPLING, STATED: the slug rule is duplicated here. It is duplicated rather
           than imported because fieldId lives in the registry and takes runtime
           bindings this hook does not have. Every candidate is TRIED, so if the rule
           drifts the focus is silently skipped — never focuses the wrong control. */
        const slug = (t: string) => `frayme-${t.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'field'}`;
        for (const [id, el] of Object.entries(s.elements)) {
          if (!ownBoundPaths(el).includes(path)) continue;
          const nm = (el as { props?: { name?: unknown } })?.props?.name;
          const candidates = [
            slug(path),                                       // the usual case
            typeof nm === 'string' && nm ? slug(nm) : null,    // when `name` wins
            id,                                               // components keyed by element id
          ].filter(Boolean) as string[];
          for (const c of candidates) {
            const node = document.getElementById(c);
            if (node && typeof (node as HTMLElement).focus === 'function') {
              (node as HTMLElement).focus({ preventScroll: true });
              done.current = true;
              break;
            }
          }
          break;
        }
        if (done.current) return;
      }
    }
  }, [spec, owners]);
}
