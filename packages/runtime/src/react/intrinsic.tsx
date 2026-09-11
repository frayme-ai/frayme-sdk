'use client';
/**
 * React delivery for intrinsic event payloads (see ../core/intrinsic.ts).
 *
 * FraymeRenderer provides a per-instance IntrinsicSlots; registry renderers call
 * `useIntrinsicEmit(emit, element)` and fire `emitWith(event, payload)` instead
 * of a bare `emit(event)`. With no provider (a renderer mounted outside
 * FraymeRenderer, e.g. bare JSONUIProvider in tests) the payload is silently
 * dropped and behavior is byte-identical to a bare emit.
 */
import { createContext, useCallback, useContext } from 'react';
import { isDev } from './dev.js';
import type { IntrinsicAffordance, IntrinsicSlots } from '../core/intrinsic.js';
import { JSON_RENDER_BUILTIN_ACTIONS } from '../core/intrinsic.js';
import { verbDispatches } from '../core/dynamic-gate.js';
import type { ComponentRenderProps } from './upstream.js';
import { useStateValue, useRepeatScope } from './upstream.js';
import { useRequiredGuard } from './required-guard.js';
import { useDynamicGateTypes } from './dynamic-gate.js';

/** A path no spec writes — makes an unconditional hook call inert. */
const INERT_PATH = '/_ui/__frayme_inert__';

const IntrinsicContext = createContext<IntrinsicSlots | null>(null);

export const IntrinsicProvider = IntrinsicContext.Provider;

/** Per-fire options a renderer may attach to an `emitWith`. */
export interface EmitWithOptions {
  /** The gesture class of this fire, when the renderer can name one — so far the
   *  row / bulk action press (registry/_rowaction.ts). The carrier gate treats it
   *  as a carrier on any host. See core/intrinsic.ts IntrinsicAffordance. */
  affordance?: IntrinsicAffordance;
}

/** `emit` with an optional intrinsic payload carried across the json-render boundary. */
export type EmitWith = (event: string, payload?: Record<string, unknown>, opts?: EmitWithOptions) => void;

/**
 * COMMIT LATCH — a control that fired a DECLARED action does not fire it twice.
 *
 * This lives in the runtime rather than being authored per spec. The alternative
 * was a hand-written `disabled: {$state:"/_ui/<id>/commit"}` binding in every spec,
 * each of which the model could typo into a binding that silently never fires — a
 * latch that looks authored and does nothing is worse than no latch, because nobody
 * re-checks it.
 *
 * HOW IT KNOWS THE ACTION IS DECLARED. It does not guess. `JSON_RENDER_BUILTIN_ACTIONS`
 * is a closed six-name set, so "not in it" IS the definition of a declared action —
 * the same test `stash()` already applies to decide whether to enqueue a slot. A
 * builtin (`setState`, `push`, `validateForm`…) never latches, which is what keeps
 * "Add row" alive.
 *
 * WHY IT READS THE MIRROR RATHER THAN TRACKING ITS OWN CLICK. `/_ui/<fid>/commit` is
 * written by `take()`, the handlers Proxy's FIRST statement — reached only once
 * json-render has cleared the binding's `confirm` gate. So declining a confirm leaves
 * the control live. A local `useState` set on press would latch on cancel, locking the
 * user out of an action they just declined, with no way back: a disabled control can
 * never emit again to clear itself. That exact bug is why the mirror moved to
 * execution time in the first place.
 *
 * LATCH, NO RE-ENABLE — one of the interactivity rules. In chat the
 * screen persists and the button stays dead; on canvas a recompose replaces the screen,
 * so re-enabling is moot.
 *
 * OPT OUT with `latch: false` on the element, for a genuinely repeatable action.
 */
export function useCommitLatch(
  element: ComponentRenderProps['element'],
  event?: string,
): boolean {
  const on = (element as { on?: Record<string, unknown> }).on;
  const props = (element as { props?: Record<string, unknown> }).props ?? {};
  const fidRaw = props.__fid;
  const fid = typeof fidRaw === 'string' ? fidRaw : null;
  /* EVERY VERB, not just `commit`. ANY declared action latches its control.
     Declared actions fire on six verbs — commit, select, change, press, move,
     dismiss — so a hook that only ever looked at `on.commit` was blind to most
     of them. A Switch wired `change → recutOccupancyBasis` stayed live after firing
     and could be flipped again, sending the action twice.
     Pass `event` to watch one verb; omit it to watch all of them, which is what a
     control with a single disabled state actually needs. */
  const verbs = event ? [event] : Object.keys(on ?? {});
  /* NEVER LATCH A CONTROL THE CARRIER GATE WOULD DENY (core/dynamic-gate.ts).
     The latch exists because "once it goes back to the agent the agent owns what
     happens next" — but under the gate a Select's or Switch's declared action does
     NOT go back to the agent: it writes /_ui/<fid>/<verb> and stops. For such a
     control "the action fired" now means "state was recorded", and a recorded
     state is exactly the thing the user should be able to change again before the
     Button carries it. Latching it would freeze every Select/Switch binding after
     one touch. So the latch arms only where the Proxy would dispatch. Read
     through context so a widened `dynamicActionTypes` widens the latch too; the
     hook is unconditional (Rules of Hooks) and defaults to the carrier list
     outside a FraymeRenderer.
     PER VERB, NOT PER ELEMENT. The first cut asked the element-wide
     question — "is the type a carrier, or does ANY binding say live?" — while the
     Proxy decides per action. A Switch declaring `change → recut` (not live) and
     `commit → apply` (live: true) therefore armed on the element, the denied flick
     wrote /_ui/<fid>/change, and the latch read that slot as "fired": a control
     disabled by a dispatch that never left the renderer. A verb now counts only if
     a fire on THAT verb would dispatch (`verbDispatches` — the same predicate the
     Proxy, the param freeze and the automatic confirm use), so a denied verb's
     mirror is never a latch record. */
  const carrierTypes = useDynamicGateTypes();
  const declaredVerbs: string[] = [];
  for (const v of verbs) {
    const binding = on?.[v];
    let declaredHere = false;
    for (const b of Array.isArray(binding) ? binding : binding ? [binding] : []) {
      const action = (b as { action?: unknown } | null)?.action;
      if (typeof action === 'string' && !JSON_RENDER_BUILTIN_ACTIONS.has(action)) { declaredHere = true; break; }
    }
    if (declaredHere && verbDispatches(element, v, carrierTypes)) declaredVerbs.push(v);
  }
  const declared = declaredVerbs.length > 0;
  const optedOut = props.latch === false;
  const armed = declared && !optedOut && !!fid;
  // READ WITH useStateValue, NOT useBoundProp. json-render's useBoundProp is a
  // WRITE helper: it returns its first argument verbatim and only builds a setter,
  // because by the time a renderer runs, `{$state:…}` props are ALREADY resolved.
  // Passing `undefined` as that argument therefore returned `undefined` forever —
  // `armed && fired != null` could never be true, so this latch never fired once,
  // in any spec, while reading as implemented. useStateValue subscribes to the
  // store and resolves the path, which is what was meant.
  //
  // Hook is ALWAYS called (Rules of Hooks); the inert path never exists in state.
  /* Read the element's WHOLE mirror, not one verb's slot. A control can declare on
     more than one verb (KanbanCard: move AND change), and watching only the first
     would miss the other — with a fixed hook count we cannot read them separately.
     `/_ui/<fid>` is one subscription that covers every verb the element declares. */
  const mirror = useStateValue<Record<string, unknown>>(armed ? `/_ui/${fid}` : INERT_PATH);
  /* INSIDE A `repeat`, THE LATCH IS PER ROW. json-render renders one element
     definition once per row, so all rows share this `__fid` and therefore this
     mirror. Reading the shared slot latched EVERY row: confirming
     "Acknowledge" on one alert greyed the Acknowledge button on all four.
     `take()` writes a row-scoped slot alongside the shared one (core/intrinsic.ts);
     a row reads only its own. Outside a repeat the scope is null and this is the
     same read it always was. */
  const row = useRepeatScope()?.index;
  const rowMirror =
    row != null
      ? ((mirror?.__rows as Record<string, Record<string, unknown>> | undefined)?.[String(row)])
      : undefined;
  const scoped = row != null ? rowMirror : mirror;
  return armed && declaredVerbs.some((v) => scoped?.[v] != null);
}

export function useIntrinsicEmit(
  emit: (event: string) => void,
  element: ComponentRenderProps['element'],
): EmitWith {
  const slots = useContext(IntrinsicContext);
  /* THE REQUIRED-PARAM PRESS GUARD (required-guard.tsx). This is the one seam every
     registry renderer fires through, which is why the check lives here and not in
     40 call sites. It runs BEFORE `stash` and before `emit`, i.e. before
     json-render's confirm gate — a press that cannot be honoured must open no
     modal, rather than ask "are you sure?" about an empty signature and then
     refuse. Null outside a provider: behaviour is byte-identical to before. */
  const requiredGuard = useRequiredGuard();
  /* The repeat index of the instance that is firing, so `take` can write a
     row-scoped commit mirror for the latch (see useCommitLatch). */
  const repeatIndex = useRepeatScope()?.index;
  const on = (element as { on?: Record<string, unknown> }).on;
  // The element's own spec id, stamped into props by FraymeRenderer.normalizeSpecProps
  // (json-render does not pass the id down). It keys the automatic state mirror.
  const fidRaw = (element as { props?: { __fid?: unknown } }).props?.__fid;
  const fid = typeof fidRaw === 'string' ? fidRaw : null;
  return useCallback(
    (event: string, payload?: Record<string, unknown>, opts?: EmitWithOptions) => {
      // RULE 2, the press half: a declared REQUIRED param that resolves empty
      // stops the press dead — no stash, no emit, no confirm modal — and the
      // control bound to it is marked, focused and named instead.
      if (requiredGuard?.(on, event, payload)) return;
      if (slots) {
        // Mirror the interaction into spec.state/_ui/<id>/<event> so it is readable
        // from state even when the author bound no prop ("state, not just params").
        //
        // WHERE it is written depends on whether an action will run. `stash` reports
        // that: it enqueues one slot per NON-BUILTIN bound action, so a true return
        // means a handler is coming.
        //   action coming  -> `take` mirrors, at EXECUTION time. That is the only
        //     point past json-render's `confirm` gate, so a cancelled confirm leaves
        //     no trace. Writing here instead latched a confirm-guarded button OFF on
        //     cancel, permanently — it could never emit again to clear its own entry.
        //   nothing coming -> mirror NOW. An unbound Select the user changed still
        //     happened and an agent should still be able to read it; there is no gate
        //     to wait for, and nothing would ever call `take`.
        //
        // STASHED EVEN WITHOUT A PAYLOAD. This used to run only when the
        // payload had keys, so a payload-less `emitWith('commit')` reached the
        // handlers Proxy with NO intrinsic entry — and therefore no `fid`. That was
        // harmless while the fid only keyed the mirror; under the carrier gate
        // (core/dynamic-gate.ts) the fid is how the Proxy learns WHICH element fired,
        // and an unidentified fire is denied. The emit site always knows its
        // element, so it always says so: an identity-only entry (`payload: {}`)
        // carries fid + verb + row. It changes nothing observable elsewhere — `take`
        // writes no mirror for an empty payload (so the latch does not arm on one,
        // exactly as before), and merging `{}` under authored params is the identity.
        // (A stale entry from a cancelled confirm is no longer a concern either way:
        // `discard` below sweeps it the moment the cancel settles.)
        const hasPayload = !!payload && Object.keys(payload).length > 0;
        const willRun = slots.stash(on, event, payload ?? {}, fid, repeatIndex, opts?.affordance);
        if (fid && !willRun && hasPayload && payload) slots.mirror(fid, event, payload);
      }
      // DECLINING A CONFIRM IS NOT AN ERROR.
      //
      // json-render types `emit` as `(event: string) => void`, but the implementation
      // is `async` and therefore returns a promise. Cancelling a binding-level
      // confirm rejects it with `Error: Action cancelled`, and nothing awaited it —
      // so every time a user pressed Cancel, the host page logged an unhandled
      // rejection. In a Sentry-instrumented consumer that is a reported error for
      // the most ordinary interaction there is: changing your mind.
      //
      // Swallow ONLY the cancellation. A genuine handler failure still surfaces —
      // it just arrives attributed instead of as a bare unhandled rejection, which
      // is strictly more useful than what it replaces.
      //
      // SWEEP ON SETTLE, BOTH WAYS. json-render's emit promise
      // settles only after every handler this fire was going to reach has run —
      // the confirmed one, each binding of an array, an `onSuccess` / `onError`
      // chain — and each of those `take`s its entry as its first statement. So at
      // settle, anything still keyed under this element's fire is stale: the entry
      // of a CANCELLED confirm (handler never ran), or the chain branch that did
      // not fire. Left in place, such an entry vouched for the next unidentified
      // dispatch of the same name (core/intrinsic.ts, "NO STALE ENTRIES").
      const settled = emit(event) as unknown;
      if (settled && typeof (settled as Promise<unknown>).then === 'function') {
        const sweep = (): void => { slots?.discard(fid, event, repeatIndex); };
        void (settled as Promise<unknown>).then(sweep, (err: unknown) => {
          sweep();
          if (err instanceof Error && err.message === 'Action cancelled') return;
          if (isDev) console.error(`[frayme] action "${event}" failed:`, err);
        });
      }
    },
    [slots, on, emit, fid, repeatIndex, requiredGuard],
  );
}
