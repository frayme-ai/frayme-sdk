/**
 * @frayme/catalog/validate — public validation surface.
 *
 * The single source of truth for compiling json-render JSONL ops into a spec
 * and validating it against the Frayme catalog. Consumed by the platform
 * request path and by authoring tooling — neither imports
 * @json-render/core directly; they go through here.
 */

export {
  compileOps,
  validateSpec,
  validateOps,
  validateManifestProps,
  type FailureCategory,
  type OpsValidationResult,
  type CompileFailure,
  type ValidateOptions,
} from './ops.js';

export { validateResolution, type ResolutionResult } from './resolution.js';

// Built-in prop gate — runs inside validateSpec by default; exported so callers
// can run it standalone against a spec they already hold, and so an authoring-side
// gate can share ONE implementation with the serving path.
export { validateBuiltinProps, builtinPropIssues, isDynamicValue } from './props.js';

export { safeColor } from './color.js';

export { safeDimension, type DimOpts, type DimUnit } from './dimension.js';
export { safeTrackList } from './track-list.js';

export {
  safeNumberIn,
  safeUnit,
  safeLatLng,
  safePoint,
  safePointList,
  safeTimeMinutes,
} from './coordinate.js';

export type { ValidationResult } from './types.js';

export {
  validateActionContract,
  validateActionWiring,
  actionParamKeys,
  type ActionDecl,
  type ActionKind,
  type ActionContractResult,
} from './actions.js';

// Event-vocabulary primitives — the same map/canonicalizer validateActionWiring
// uses, exported so the platform's binder can REPAIR an illegal verb (remap to
// the component's single legal event) instead of only rejecting it.
export { componentEvents } from '../catalog.js';
export {
  canonicalize,
  resolveEventKey,
  acceptedEventKeys,
  COMPONENT_EVENT_ALIASES,
  COMPONENT_EXTRA_EVENTS,
  type CanonicalEvent,
} from '../components/events.js';

// json-render primitives consumers need — re-exported so app code imports them
// from here, never from @json-render/core directly.
export {
  createSpecStreamCompiler,
  diffToPatches,
  formatSpecIssues,
  type Spec,
  type SpecStreamLine,
  type SpecValidationResult,
  fraymeCatalog,
  type FraymeSpec,
} from './jsonRender.js';

export { buildPropsGrammar, componentPropEnums, type EnumNode } from './props-grammar.js';
// Lenient mode: the serve-side normaliser and the alias table it reads.
export { lenientNormalize, type LenientResult } from './lenient.js';
export { ENUM_ALIASES, resolveAlias } from '../components/_shared.js';
