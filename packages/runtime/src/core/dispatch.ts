/**
 * The action-kind switch — PURE (no React, no @json-render/react import).
 *
 * Called by FraymeRenderer's catch-all Proxy for every spec-bound action that
 * passes the interactive + security gates. Resolves the kind and runs it.
 */
import { canonicalize } from '@frayme/catalog';
import type { Spec } from '@json-render/core';
import type { DynamicActionEvent } from './events.js';
import type {
  ActionSpec,
  DispatchDeps,
  FraymeActionContext,
  HostSpec,
  RecomposeSpec,
} from './handlers.js';

/** The canonical event verb a spec bound `action` to, if EXACTLY one (else undefined). */
function eventForAction(spec: unknown, action: string): string | undefined {
  const elements = (
    spec as { elements?: Record<string, { on?: Record<string, unknown> } | undefined> } | null
  )?.elements;
  if (!elements) return undefined;
  let found: string | undefined;
  for (const el of Object.values(elements)) {
    const on = el?.on;
    if (!on || typeof on !== 'object') continue;
    for (const [key, binding] of Object.entries(on)) {
      // `on[key]` may be an ActionBinding OR ActionBinding[] (json-render allows both).
      for (const b of Array.isArray(binding) ? binding : [binding]) {
        if ((b as { action?: unknown } | null)?.action !== action) continue;
        const verb = canonicalize(key) ?? key;
        if (found && found !== verb) return undefined; // bound to >1 verb → ambiguous
        found = verb;
      }
    }
  }
  return found;
}

/** The enriched event forwarded to the host: action + params + live context. */
function makeEvent(ctx: FraymeActionContext, params: Record<string, unknown>): DynamicActionEvent {
  const spec = ctx.getSpec();
  const generationId = (spec as { generation_id?: unknown } | null)?.generation_id;
  return {
    action: ctx.action,
    params,
    // The renderer's intrinsic slot carries the TRUE fired verb (always set for
    // renderer-driven fires, even when the action is bound to >1 verb); the
    // spec-scan heuristic remains the fallback for programmatic dispatches.
    event: ctx.event ?? eventForAction(spec, ctx.action),
    state: ctx.getState(),
    // The firing element, when the renderer knows it (same slot as `event`). No
    // spec-scan fallback here: an action bound on several elements has no single
    // answer, and guessing one would mislabel the host's routing.
    element_id: ctx.elementId,
    generation_id: typeof generationId === 'string' ? generationId : undefined,
    // The receipt fields (the thread card): the pressed
    // control's label, verbatim, and the host's description of the action. Both
    // resolved by the renderer's Proxy (core/action-enrich.ts) and copied here
    // unchanged; either may be undefined, in which case the key is simply absent
    // from the host's view of the event. Never derived here — no spec scan.
    label: ctx.label,
    description: ctx.description,
  };
}

export function dispatch(
  spec: ActionSpec | undefined,
  params: Record<string, unknown>,
  ctx: FraymeActionContext,
  deps: DispatchDeps,
): unknown | Promise<unknown> {
  if (spec === false) return undefined; // explicit deny → inert
  if (typeof spec === 'function') return spec(params, ctx); // sugar → local
  switch (spec?.kind) {
    case 'local':
      // A spec-declared { kind:'local' } can't carry a `run` (a function doesn't
      // survive serialization) — treat it as inert rather than throwing.
      return typeof spec.run === 'function' ? spec.run(params, ctx) : undefined;
    case 'recompose':
      return runRecompose(spec, params, ctx, deps);
    case 'host':
      return runHost(spec, params, ctx, deps);
    case 'agent':
    default: {
      // agent kind (or an unresolved spec defaulting to agent) → fallback sink.
      const ev = makeEvent(ctx, params);
      return ctx.emitDynamic(spec?.format?.(ev) ?? ev);
    }
  }
}

async function runRecompose(
  spec: RecomposeSpec,
  params: Record<string, unknown>,
  ctx: FraymeActionContext,
  deps: DispatchDeps,
): Promise<void> {
  // Graceful fallback: without a compose client + an owner to land the result,
  // a recompose can't drive the canvas — forward to the agent instead.
  if (!deps.compose || !deps.onRecompose) {
    ctx.emitDynamic(makeEvent(ctx, params));
    return;
  }
  const prompt = typeof spec.prompt === 'function' ? spec.prompt(ctx) : spec.prompt;
  const result = await deps.compose.create({
    prompt,
    prior_spec: ctx.getSpec() as Spec,
    mode: spec.mode ?? 'edit',
    data: params,
  });
  // Re-entrancy guard: a newer dispatch for the same action aborted this one.
  if (ctx.signal.aborted) return;
  // The result lands in the spec OWNER's setter (useFraymeCompose / message
  // renderer), NOT the renderer — `merge` keeps restartKey so in-progress user edits survive.
  deps.onRecompose(result.spec, { state: 'merge' });
}

function runHost(
  spec: HostSpec,
  params: Record<string, unknown>,
  ctx: FraymeActionContext,
  deps: DispatchDeps,
): unknown {
  // A spec can declare a host action, but the host bridge is consumer-injected.
  // Without it, FALL BACK to the agent sink (like recompose) rather than throwing —
  // a spec-authored action must never crash a consumer who didn't wire a host.
  if (!deps.hostTransport) {
    ctx.emitDynamic(makeEvent(ctx, params));
    return;
  }
  // Send the SAME enriched event every other sink gets — a wired host must not
  // receive less (verb/state/generation_id) than the unwired fallback path does.
  return deps.hostTransport.send(spec.channel ?? 'frayme:action', makeEvent(ctx, params));
}
