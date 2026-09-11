/**
 * Single import surface for the json-render primitives the validator uses.
 *
 * Internal to @frayme/catalog — external callers import from
 * '@frayme/catalog/validate'. Keeping the surface here means if upstream
 * @json-render/core API names change, we only update this one file.
 *
 * NOTE: json-render's own `validateSpec` (referential integrity — root/children/
 * empty) is re-exported ALIASED as `validateSpecReferential` to avoid colliding
 * with this package's catalog-level `validateSpec` (ops.ts).
 */

export {
  createSpecStreamCompiler,
  diffToPatches,
  formatSpecIssues,
  // The renderer's OWN state-pointer resolver (@json-render/react resolves a
  // repeat with `getByPath(state, repeat.statePath) ?? []`). The repeat-seeding
  // check in resolution.ts uses it so "seeded" means byte-identically what the
  // renderer means — not a re-implemented path walk.
  getByPath,
  validateSpec as validateSpecReferential,
  // The render-resolution gate (validate/resolution.ts) validates `visible` and
  // `$cond` conditions against core's OWN Zod schema, so the grammar it enforces
  // is exactly what the renderer evaluates — not a hand-maintained copy.
  VisibilityConditionSchema,
  type Spec,
  type SpecIssue,
  type SpecStreamLine,
  type SpecValidationResult,
  type VisibilityCondition,
} from '@json-render/core';

export { fraymeCatalog, componentEvents, type FraymeSpec } from '../catalog.js';
export { CATALOG_VERSION, JSON_RENDER_PIN } from '../version.js';
