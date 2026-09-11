'use client';
/**
 * REQUIRED-PARAM PRESS GUARD — lifecycle rule 2, the half that was never built.
 *
 * A button is NEVER rendered disabled before a press; the
 * missing field is highlighted ON the press. `useFocusFirstRequired`
 * (param-freeze.tsx) already does the first half — put focus in the first
 * empty required field on mount. Nothing did the second half: press it anyway
 * and the action went.
 *
 * OBSERVED IN TESTING: required-empty presses went through unblocked and
 * dispatched actions whose declared-required params could not resolve. Among
 * them a LEGALLY BINDING signature that fired with `signature: ""`, a ticket
 * purchase that fired with `seats: [] total: 0`, and an `applyPermissions` that
 * fired with the permissions matrix simply absent from the params object.
 * `requiredItems` appeared in exactly one runtime file before this one —
 * param-freeze's POST-press focus hook — so the word "required" reached the
 * runtime and then did nothing to any press.
 *
 * WHERE IT SITS. `useIntrinsicEmit` is the ONE seam every registry renderer fires
 * through, so the guard is one check in one place rather than 40 call sites that
 * each have to remember. It runs BEFORE `stash` and before `emit`, which means
 * before json-render's `confirm` gate: a blocked press opens no modal at all,
 * which is the point. Asking "are you sure?" about an empty signature and THEN
 * refusing is worse than refusing first.
 *
 * WHAT COUNTS AS DECLARED-REQUIRED. Both shapes the platform actually serializes:
 *   · `actions.<name>.requiredItems: ["seats"]`            (the common case)
 *   · `actions.<name>.params` as a JSON-Schema wrapper with `required: [...]`
 *   · `actions.<name>.params.<p>.required === true`         (per-param flag)
 * The wrapper discriminator is the same one buildParamOwners and the catalog
 * validator use — `type:"object"` AND an object `properties`, both — because a
 * param may legitimately be NAMED `properties`.
 *
 * WHAT COUNTS AS EMPTY. undefined · null · "" (trimmed) · [] · NaN · **false**.
 * `false` is deliberate and it is the one place this diverges from
 * field-validation's `isEmptyValue`, which treats `false` as an ANSWER (an
 * unticked optional checkbox is a legitimate value). For a param the host
 * DECLARED REQUIRED, `false` is an unticked consent box, and the case that
 * motivated this is a legally binding acceptance. `0` is NOT empty — a required
 * quantity or amount of zero is an answer, and blocking it would be the mirror of
 * the bug being fixed.
 *
 * WHAT IT DOES NOT BLOCK, structurally:
 *   · builtins (setState/push/validateForm…) — they never reach the agent.
 *   · `live: true` bindings — they fire on every keystroke/drag; a gate there is
 *     incoherent, exactly as it is for the universal confirm.
 *   · a param whose binding is an EXPRESSION this module cannot evaluate
 *     ($item / $template / $cond / $expr). It resolves at dispatch inside
 *     json-render with a row scope we do not have here, so refusing it would
 *     block every per-row action there is. Unknown is treated as satisfied:
 *     the guard only ever fires on a value it has actually READ and found empty,
 *     or on a required param NOTHING supplies.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { JSON_RENDER_BUILTIN_ACTIONS } from '../core/intrinsic.js';

/** Minimal structural view of the state store (keeps this module store-agnostic). */
export interface GuardStoreLike {
  get: (path: string) => unknown;
}

/** A value that cannot satisfy a declared-REQUIRED param. See the header note. */
export function isMissingRequired(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (v === false) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'number') return Number.isNaN(v);
  return false;
}

/** The `properties` map of a JSON-Schema-wrapped params block, or the block itself. */
function paramsBody(params: unknown): Record<string, unknown> | null {
  if (!params || typeof params !== 'object') return null;
  const w = params as { type?: unknown; properties?: unknown };
  if (w.type === 'object' && w.properties && typeof w.properties === 'object')
    return w.properties as Record<string, unknown>;
  return params as Record<string, unknown>;
}

/** Names the HOST declared required for `action`, from every shape it can arrive in. */
export function declaredRequiredParams(spec: unknown, action: string): string[] {
  const decl = (spec as { actions?: Record<string, unknown> } | null)?.actions?.[action];
  if (!decl || typeof decl !== 'object') return [];
  const out = new Set<string>();
  const d = decl as { requiredItems?: unknown; params?: unknown };
  if (Array.isArray(d.requiredItems))
    for (const n of d.requiredItems) if (typeof n === 'string' && n) out.add(n);
  const w = d.params as { type?: unknown; properties?: unknown; required?: unknown } | undefined;
  if (w && typeof w === 'object' && Array.isArray(w.required))
    for (const n of w.required) if (typeof n === 'string' && n) out.add(n);
  const body = paramsBody(d.params);
  if (body)
    for (const [k, v] of Object.entries(body))
      if (v && typeof v === 'object' && (v as { required?: unknown }).required === true) out.add(k);
  return [...out];
}

/** The state path a binding param reads, or null when it is not a plain state read. */
function statePathOf(expr: unknown): string | null {
  if (!expr || typeof expr !== 'object') return null;
  const e = expr as Record<string, unknown>;
  for (const k of ['$state', '$bindState']) {
    const p = e[k];
    if (typeof p === 'string' && p.trim()) return `/${p.trim().replace(/^\//, '')}`;
  }
  return null;
}

/** True when the binding value is an expression this module deliberately cannot read. */
function isOpaqueExpression(expr: unknown): boolean {
  if (!expr || typeof expr !== 'object' || Array.isArray(expr)) return false;
  return Object.keys(expr as object).some((k) => k.startsWith('$'));
}

export interface MissingParam {
  /** The declared param name (e.g. "signature"). */
  name: string;
  /** The state path it reads, when the binding names one — the key to the input. */
  path: string | null;
}

/**
 * The declared-required params of `binding` that resolve empty for this press.
 * Pure and exported for tests: asserting the resolution table directly is far
 * cheaper (and far more legible) than inferring it from a rendered tree.
 */
export function missingRequiredFor(
  spec: unknown,
  binding: unknown,
  payload: Record<string, unknown> | undefined,
  read: (path: string) => unknown,
): MissingParam[] {
  const b = binding as { action?: unknown; params?: Record<string, unknown>; live?: unknown } | null;
  const action = b?.action;
  if (typeof action !== 'string' || JSON_RENDER_BUILTIN_ACTIONS.has(action)) return [];
  if (b?.live === true) return [];
  const required = declaredRequiredParams(spec, action);
  if (required.length === 0) return [];
  const authored = (b?.params && typeof b.params === 'object' ? b.params : {}) as Record<string, unknown>;
  // The Form's commit payload carries its collected field values under `fields`;
  // a named field there satisfies a param of the same name, exactly as it will
  // once mergeIntrinsicParams runs at dispatch.
  const fields = (payload?.fields && typeof payload.fields === 'object'
    ? payload.fields
    : {}) as Record<string, unknown>;
  const out: MissingParam[] = [];
  for (const name of required) {
    const expr = Object.hasOwn(authored, name) ? authored[name] : undefined;
    const path = statePathOf(expr);
    let value: unknown;
    if (path != null) value = read(path);
    else if (expr !== undefined) {
      // An opaque expression ($item/$template/$cond) resolves at dispatch with a
      // scope this module does not hold — treat as satisfied rather than block
      // every per-row action there is.
      if (isOpaqueExpression(expr)) continue;
      value = expr;
    } else if (payload && Object.hasOwn(payload, name)) value = payload[name];
    else if (Object.hasOwn(fields, name)) value = fields[name];
    else value = undefined; // nothing on this screen supplies it
    if (isMissingRequired(value)) out.push({ name, path });
  }
  return out;
}

/* ── the reveal ───────────────────────────────────────────────────────────── */

/** forms.tsx `fieldId()`, duplicated for the same stated reason param-freeze does:
 *  it lives in the registry and takes runtime bindings this module has no access
 *  to. Every candidate is TRIED, so if the rule drifts the mark is silently
 *  skipped — it never lands on the wrong control. */
const slug = (t: string) =>
  `frayme-${t.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'field'}`;

function findControl(m: MissingParam): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const candidates = [m.path ? slug(m.path) : null, slug(m.name), m.name].filter(Boolean) as string[];
  for (const c of candidates) {
    const node = document.getElementById(c);
    if (node) return node as HTMLElement;
  }
  // A control may render its binding path only as a `name` (Form fields do).
  const byName = document.querySelector(
    `[name="${m.name.replace(/["\\]/g, '\\$&')}"]`,
  );
  return (byName as HTMLElement | null) ?? null;
}

/** Mark + focus the bound control, and arm a one-shot clear on the next edit. */
function reveal(missing: MissingParam[]): boolean {
  let focused = false;
  for (const m of missing) {
    const node = findControl(m);
    if (!node) continue;
    node.setAttribute('aria-invalid', 'true');
    node.setAttribute('data-fr-required-missing', '');
    // Clear the mark the moment the reader answers it. Without this the field
    // stays flagged after it is filled, and a stale error is a lie.
    const clear = () => {
      node.removeAttribute('aria-invalid');
      node.removeAttribute('data-fr-required-missing');
      node.removeEventListener('input', clear);
      node.removeEventListener('change', clear);
    };
    node.addEventListener('input', clear);
    node.addEventListener('change', clear);
    if (!focused && typeof node.focus === 'function') {
      node.focus();
      focused = true;
    }
  }
  return focused;
}

/* ── context ──────────────────────────────────────────────────────────────── */

/** Returns TRUE when the press must not proceed. */
export type RequiredGuard = (
  on: Record<string, unknown> | undefined,
  event: string,
  payload?: Record<string, unknown>,
) => boolean;

const RequiredGuardContext = createContext<RequiredGuard | null>(null);

/** No provider (a renderer mounted bare in a test) → every press proceeds, exactly
 *  as it did before this module existed. */
export function useRequiredGuard(): RequiredGuard | null {
  return useContext(RequiredGuardContext);
}

/**
 * Holds the guard and renders its notice. Must sit INSIDE the state provider so
 * `store` is the live one for this restartKey.
 *
 * THE NOTICE IS NOT DECORATION. When a required param has no control on the
 * screen at all — `applyPermissions` was one such case — there is
 * nothing to mark and nothing to focus, and a press that silently does nothing is
 * indistinguishable from a broken button. The line says which field is missing so
 * the reader (and the agent reading the screen) can tell the difference.
 */
export function RequiredGuardProvider({
  spec,
  store,
  children,
}: {
  spec: unknown;
  store: GuardStoreLike | null | undefined;
  children: ReactNode;
}): ReactNode {
  const [notice, setNotice] = useState<string[] | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const storeRef = useRef(store);
  storeRef.current = store;

  const guard = useCallback<RequiredGuard>((on, event, payload) => {
    const binding = on?.[event];
    if (!binding) return false;
    const read = (path: string): unknown => storeRef.current?.get(path);
    const missing: MissingParam[] = [];
    for (const b of Array.isArray(binding) ? binding : [binding])
      for (const m of missingRequiredFor(specRef.current, b, payload, read))
        if (!missing.some((x) => x.name === m.name)) missing.push(m);
    if (missing.length === 0) {
      setNotice(null);
      return false;
    }
    reveal(missing);
    setNotice(missing.map((m) => m.name));
    return true;
  }, []);

  return (
    <RequiredGuardContext.Provider value={guard}>
      {children}
      {notice && notice.length > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4"
          data-fr-required-notice=""
          role="alert"
        >
          <div className="pointer-events-auto max-w-[32rem] rounded-frayme px-3.5 py-2 text-sm [background:var(--fr-confirm-bg,var(--fr-surface,var(--color-card)))] [border:1px_solid_color-mix(in_srgb,var(--color-danger)_35%,transparent)] [color:var(--fr-confirm-title,var(--fr-surface-fg,var(--color-foreground)))] [box-shadow:0_8px_24px_-8px_rgb(0_0_0/0.25)]">
            <span className="[color:var(--color-danger)]">Required</span>
            {': '}
            {notice.join(', ')}
          </div>
        </div>
      )}
    </RequiredGuardContext.Provider>
  );
}
