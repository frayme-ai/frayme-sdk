import type { FraymeSpec, FraymeCatalogUnion } from '@frayme/catalog';
import { validateSpec } from '@frayme/catalog/validate';
import type { Spec } from '@json-render/core';

export type ValidateResult =
  | { ok: true; spec: FraymeSpec }
  | { ok: false; issues: string[] };

/**
 * The client-side validation gate (defense in depth — the API already
 * validated before billing).
 *
 * Render policy:
 * - `strict` (default for at-rest specs): render only specs that fully pass
 *   `fraymeCatalog.validate()`.
 * - `progressive` (used while streaming): render partial snapshots without the
 *   full-spec gate — safe because the component REGISTRY is a whitelist
 *   (unknown types hit the inert Fallback, props are plain data, and no
 *   component renders raw HTML), then the full gate runs at
 *   `compose.completed` before the final commit.
 */
export function validateFraymeSpec(spec: Spec | FraymeSpec, catalog?: FraymeCatalogUnion): ValidateResult {
  // Single source of truth: the catalog's validateSpec (component TYPE enum +
  // json-render referential integrity). With a BYOC union (`catalog`), custom
  // types are accepted; without it, a spec with custom types fail-closes here.
  const result = validateSpec(spec, catalog ? { catalog } : undefined);
  if (result.valid && result.spec) {
    return { ok: true, spec: result.spec };
  }
  return {
    ok: false,
    issues:
      result.errors.length > 0
        ? result.errors
        : ['Spec failed catalog validation'],
  };
}
