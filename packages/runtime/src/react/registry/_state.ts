'use client';
import { useCallback, useState } from 'react';
import { useBoundProp } from '../upstream.js';
import { usePathFrozen } from '../param-freeze.js';

/**
 * Two-way value hook with an INTERNAL-STATE FALLBACK.
 *
 * `useBoundProp(value, path)` (upstream) only writes when `path` is set — its
 * setter is a no-op otherwise, and reactivity comes from the spec re-resolving
 * the `$bindState` prop on store change. That means a control whose `value`/
 * selection the author did NOT bind is frozen: clicks go nowhere.
 *
 * `useLocalOrBound` keeps the bound behaviour EXACTLY when a binding is present
 * (store-backed, reactive, cross-component) and falls back to local React state
 * when it is absent — so every control is interactive out of the box and a spec
 * that binds it still gets full two-way sync. Both hooks are always called (Rules
 * of Hooks); the branch only chooses which pair to return, and `bindingPath` is
 * stable across renders for a given element.
 */
export function useLocalOrBound<T>(
  propValue: T | undefined,
  bindingPath: unknown,
): [T | undefined, (value: T) => void, boolean] {
  const bound = useBoundProp<T>(propValue, bindingPath as never);
  const [local, setLocal] = useState<T | undefined>(propValue);
  /* PARAM FREEZE — the interactivity contract's lifecycle rules: "all the params related
     to that action will become disabled … If the params were mentioned by the host —
     they will become readonly … never enabled again once the action has been sent."
     Enforced HERE because this is the one seam every bound control passes through:
     38 call sites read `p.disabled` individually, and editing all of them would mean
     38 chances to miss one. A control whose path feeds an action that has already
     committed keeps its value and rejects writes — which is precisely readonly.
     The VISUAL half (rendering it greyed) still lives per-control; see
     param-freeze.tsx. Behaviour first: a control that looks live but is inert is a
     smaller lie than one that silently edits a value already sent to the agent. */
  const frozen = usePathFrozen(bindingPath);
  const setBound = bound[1];
  const guarded = useCallback(
    (v: T) => { if (!frozen) setBound(v); },
    [frozen, setBound],
  );
  /* THIRD ELEMENT: `frozen`, for the VISUAL half of rules 3/4. Appending to the
     tuple rather than changing the shape is deliberate — every existing call site
     destructures `[value, setValue]` and ignores a third element, so all 40 registry
     files keep working untouched and only the controls that render a disabled state
     need to read it. */
  if (bindingPath) return frozen ? [bound[0], guarded, true] : [bound[0], bound[1], false];
  return [local, setLocal, false];
}
