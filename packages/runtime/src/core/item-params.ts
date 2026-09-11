/**
 * $item action-param dereference.
 *
 * Upstream contract mismatch: json-render's `resolveActionParam` returns the
 * scoped state PATH for `{$item: "field"}` params (pointer semantics, matching
 * $bindItem) — but the Frayme action contract teaches `{$item:"claim"}` as "the
 * VALUE of that field for the pressed row", and hosts/agents consume values
 * ("claimId":"RC-2214", not "claimId":"/claims/0/claim").
 *
 * This resolves the mismatch at OUR seam (wrap-don't-fork): for the dispatched
 * action, any param key the spec authored as $item/$bindItem whose runtime value
 * arrived as a state path is dereferenced against the live store. Everything
 * else — explicit values, $state-resolved params, intrinsic payloads — passes
 * through untouched. PURE module: no React, no @json-render imports.
 */

type OnBinding = { action?: unknown; params?: Record<string, unknown> } | null | undefined;

/** Param keys the spec authors as `{$item}`/`{$bindItem}` for `action`, across
 *  every element binding (an action may be bound on several elements). */
function itemParamKeys(spec: unknown, action: string): Set<string> {
  const keys = new Set<string>();
  const elements =
    (spec as { elements?: Record<string, { on?: Record<string, unknown> } | undefined> } | null)
      ?.elements ?? {};
  for (const el of Object.values(elements)) {
    const on = el?.on;
    if (!on || typeof on !== 'object') continue;
    for (const binding of Object.values(on)) {
      for (const b of Array.isArray(binding) ? binding : [binding]) {
        const bb = b as OnBinding;
        if (bb?.action !== action || !bb.params || typeof bb.params !== 'object') continue;
        for (const [k, v] of Object.entries(bb.params)) {
          if (v && typeof v === 'object' && ('$item' in v || '$bindItem' in v)) keys.add(k);
        }
      }
    }
  }
  return keys;
}

/**
 * Dereference $item-authored params that arrived as state paths. Only touches
 * keys the spec itself declares as $item/$bindItem, only when the value is a
 * '/'-prefixed string, and only when the store actually resolves it — a legit
 * literal that merely looks like a path on a non-$item key is never rewritten.
 */
export function derefItemParams(
  spec: unknown,
  action: string,
  params: Record<string, unknown>,
  get: (path: string) => unknown,
): Record<string, unknown> {
  const keys = itemParamKeys(spec, action);
  if (keys.size === 0) return params;
  let out: Record<string, unknown> | null = null;
  for (const k of keys) {
    const v = params[k];
    if (typeof v !== 'string' || !v.startsWith('/')) continue;
    const resolved = get(v);
    if (resolved === undefined) continue;
    (out ??= { ...params })[k] = resolved;
  }
  return out ?? params;
}
