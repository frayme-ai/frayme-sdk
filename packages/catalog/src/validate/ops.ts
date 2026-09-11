/**
 * The load-bearing spec validator (public).
 *
 * Split into two stages so callers that already hold a compiled spec (e.g. the
 * platform's streaming op-stream checker) can validate WITHOUT recompiling:
 *
 *   compileOps(opsJsonl)   → parse lines + replay through the stream compiler → spec
 *   validateSpec(spec)     → fraymeCatalog.validate (component TYPE enum + spec
 *                            structure; upstream .validate does NOT check per-prop
 *                            shapes for a 2+-component catalog — props are z.record
 *                            of unknown. BUILT-IN prop enums are gated by
 *                            validateBuiltinProps (validate/props.ts, on by
 *                            default); further value safety comes from the
 *                            value-channel gate in resolution.ts; BYOC props are
 *                            checked by validateManifestProps.)
 *   validateOps(opsJsonl)  = validateSpec(compileOps(opsJsonl))   [convenience]
 *
 * Returns categorized failure info (FailureCategory) so callers can track
 * which kinds of mistakes generated specs contain.
 */

import {
  createSpecStreamCompiler,
  formatSpecIssues,
  fraymeCatalog,
  validateSpecReferential,
  type FraymeSpec,
  type Spec,
} from './jsonRender.js';
import { lenientNormalize } from './lenient.js';
import { builtinPropIssues } from './props.js';
import { validateComputed, validateResolution } from './resolution.js';
import type { ValidationResult } from './types.js';
import type { CompiledManifest } from '../manifest.js';

export type FailureCategory =
  | 'empty_input'
  | 'malformed_jsonl'
  | 'compiler_error'
  | 'empty_spec'
  | 'catalog_validation_failed'
  // built-in prop gate (validate/props.ts) — a LITERAL prop value that is not one
  // of its schema's options (`Stack.direction:"column"`). Upstream `.validate`
  // compiles props to z.record(unknown) for a 2+-component catalog, so this is the
  // only place a built-in's prop values are checked:
  | 'invalid_prop_value'
  // render-resolution gate (validate/resolution.ts) — the element-envelope /
  // binding-grammar errors the catalog check is blind to:
  | 'unknown_element_key'
  | 'invalid_binding'
  | 'invalid_directive'
  | 'invalid_action_kind'
  | 'resource_limit'
  // value-channel gate (validate/resolution.ts) — a `color`/dimension/count prop
  // carrying a value that `safeColor`/`safeDimension` reject:
  | 'unsafe_value';

/** Options for the ops/spec validators. */
export interface ValidateOptions {
  /**
   * 'strict' (default) — the authoring gate, unchanged.
   * 'lenient' — the SERVE policy: the schema-driven normaliser in
   * validate/lenient.ts runs first (unknown props dropped, enum aliases incl.
   * inside $cond leaves, scalar coercions, required-null dropped, FormField
   * labels inherited), then the strict pipeline judges the NORMALISED spec.
   * Every change is returned in `normalizations` and echoed into `warnings`.
   */
  mode?: 'strict' | 'lenient';
  /**
   * Run the render-resolution gate (stage 4) after catalog + referential checks.
   * OFF by default (the serving path stays lenient); authoring pipelines pass
   * `true` so no spec with malformed binding/visibility/action-kind grammar is
   * accepted.
   */
  resolution?: boolean;
  /**
   * Run the BUILT-IN prop gate (validate/props.ts): a literal prop value that is
   * not one of its schema's options. ON by default — unlike the resolution gate,
   * this one has no leniency argument to make. An out-of-enum prop is not a
   * lenient rendering, it is a SILENT one: cva maps an unknown variant key to no
   * class and skips its own defaultVariants, so the element renders as the bare
   * base (`Stack.direction:"column"` → a flex ROW). Letting it through means the
   * server never escalates to the fallback, and the broken spec ships
   * as a success.
   *
   * Pass `false` only to reproduce the historical pre-gate behaviour.
   */
  props?: boolean;
  /**
   * Run the `$computed` gate: a function name nothing registers, a `$computed`
   * with no/wrong args, or a malformed expression nested in its args. ON by
   * default — this subset of the resolution gate is NOT lenient-able, because
   * an unresolvable `$computed` is not a rendering nuance: it is the FIGURE the
   * screen is about. json-render warns and hands the component `undefined`, and
   * a component that fills that in prints a number nobody can check.
   *
   * It is the only part of the resolution gate that runs by default: the FULL
   * gate rejects constructs that still render, and every one of those would go
   * straight to the fallback, while this subset reports only defects that are
   * guaranteed to render as nothing. See `validateComputed`.
   *
   * Redundant (and skipped) when `resolution:true` already ran the full gate.
   * Pass `false` only to reproduce the historical pre-gate behaviour.
   */
  computed?: boolean;
  /**
   * EXTRA `$computed` function names this host registers on top of the frozen
   * built-in set (BYOC). Threaded into both the `$computed` gate and the full
   * resolution gate, so a host function is not mistaken for a hallucinated one.
   */
  computedFunctions?: Iterable<string>;
  /**
   * BYOC: validate against a catalog UNION (built-ins ∪ custom manifests) instead
   * of the built-in singleton. The `FraymeCatalogUnion` returned by
   * `extendCatalog` satisfies this. Defaults to the singleton (byte-identical).
   */
  catalog?: {
    validate(spec: unknown): {
      success: boolean;
      data?: unknown;
      error?: { issues?: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> };
    };
  };
}

export interface OpsValidationResult extends ValidationResult {
  spec?: FraymeSpec;
  failureCategory?: FailureCategory;
  /** Lenient mode only: what the normaliser changed, one line each. */
  normalizations?: string[];
  /** Lenient mode only: the normalised spec, valid or not (the strict result's
   *  `spec` is set only on success). */
  normalized?: unknown;
}

/** A categorized reason the ops could not be compiled into a spec. */
export interface CompileFailure {
  errors: string[];
  failureCategory: FailureCategory;
}

/**
 * Stage 1 + 2: parse the JSONL lines and replay them through the stream
 * compiler. Returns the raw compiled spec, or a categorized failure.
 *
 * Use this only when you have the raw ops string (the non-streaming path).
 * The streaming path already compiled incrementally — pass its result straight
 * to {@link validateSpec}.
 */
export function compileOps(
  opsJsonl: string,
): { spec: unknown } | { failure: CompileFailure } {
  // ── Step 1: each line parses as JSON ───────────────────────────────────
  const lines = opsJsonl.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { failure: { errors: ['empty input'], failureCategory: 'empty_input' } };
  }

  const parseErrors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      JSON.parse(lines[i]);
    } catch (e) {
      parseErrors.push(`line ${i + 1}: malformed JSON — ${(e as Error).message}`);
    }
  }
  if (parseErrors.length > 0) {
    return { failure: { errors: parseErrors, failureCategory: 'malformed_jsonl' } };
  }

  // ── Step 2: compile the ops stream into a spec ──────────────────────────
  try {
    const compiler = createSpecStreamCompiler();
    compiler.push(opsJsonl);
    return { spec: compiler.getResult() };
  } catch (e) {
    return {
      failure: { errors: [`compiler error: ${(e as Error).message}`], failureCategory: 'compiler_error' },
    };
  }
}

/**
 * Stage 3: catalog-validate an already-compiled spec (no recompile).
 *
 * Includes the empty-spec guard so `validateSpec(checker.getResult())` is
 * behaviourally identical to the historical monolithic validator when the
 * compiler produced nothing.
 */
export function validateSpec(spec: unknown, opts?: ValidateOptions): OpsValidationResult {
  if (opts?.mode === 'lenient') {
    const n = lenientNormalize(spec);
    const r = validateSpecStrict(n.spec, opts);
    r.normalizations = n.normalizations;
    r.normalized = n.spec;
    r.warnings.push(...n.normalizations.map((l) => `normalized: ${l}`));
    return r;
  }
  return validateSpecStrict(spec, opts);
}

function validateSpecStrict(spec: unknown, opts?: ValidateOptions): OpsValidationResult {
  const warnings: string[] = [];

  if (!spec || typeof spec !== 'object') {
    return {
      valid: false,
      errors: ['compiler produced no spec'],
      warnings,
      failureCategory: 'empty_spec',
    };
  }

  const result = (opts?.catalog ?? fraymeCatalog).validate(spec);
  if (!result.success) {
    const issues = result.error?.issues ?? [];
    const issueErrors = issues.length > 0
      ? issues.map((iss) => `${iss.path.join('.') || '<root>'}: ${iss.message}`)
      : ['catalog validation failed (no issue details)'];
    return {
      valid: false,
      errors: issueErrors,
      warnings,
      failureCategory: 'catalog_validation_failed',
    };
  }

  // Referential integrity (dangling root, missing children, empty spec). The
  // catalog checks the component TYPE enum but NOT spec structure (nor, for a
  // 2+-component catalog, per-prop shapes); json-render's own validator does the
  // structure. Fold its errors in so a structurally-broken spec isn't declared
  // valid (and billed) only to fail at render.
  const refErrors = validateSpecReferential(spec as Spec).issues.filter(
    (iss) => iss.severity === 'error',
  );
  if (refErrors.length > 0) {
    const isEmpty = refErrors.some(
      (iss) => iss.code === 'empty_spec' || iss.code === 'missing_root',
    );
    return {
      valid: false,
      errors: [formatSpecIssues(refErrors)],
      warnings,
      failureCategory: isEmpty ? 'empty_spec' : 'catalog_validation_failed',
    };
  }

  // Stage 4 (opt-in): render-resolution gate. The catalog + referential checks
  // above pass a spec with an invented element field (`if`), a malformed
  // `visible`/`$cond`/`$template`/`watch` shape, or a bad `spec.actions[].kind` —
  // the element envelope is passthrough. Only runs when requested (authoring
  // pipelines), so the serving path keeps its default lenient behaviour.
  if (opts?.resolution) {
    // Validate the ORIGINAL compiled spec, not `result.data`: the catalog
    // validator is strip-mode (unknown keys like `on`/`visible`/`watch`/`if` are
    // dropped from `result.data`), so the envelope/grammar must be checked on the
    // full spec the renderer will actually receive.
    const resolution = validateResolution(spec, { computedFunctions: opts.computedFunctions });
    if (!resolution.valid) {
      return {
        valid: false,
        errors: resolution.errors,
        warnings,
        failureCategory: resolution.failureCategory,
      };
    }
  } else if (opts?.computed !== false) {
    // Stage 4a (default ON): the `$computed` SUBSET of the gate above.
    //
    // The full gate is opt-in and NOTHING on the serving path opts in, so until
    // this ran by default a `{"$computed":"totalPrice"}` — a name no host
    // registers — validated clean at `/v1/compose`, and the component turned the
    // resulting `undefined` into a confident figure. Truth defects escalate;
    // this is the check that makes one escalate instead of ship.
    //
    // Same ORIGINAL-spec reasoning as above (`result.data` is strip-mode output).
    // Skipped when the full gate already ran — it is a strict superset.
    const computed = validateComputed(spec, { computedFunctions: opts?.computedFunctions });
    if (!computed.valid) {
      return {
        valid: false,
        errors: computed.errors,
        warnings,
        failureCategory: computed.failureCategory,
      };
    }
  }

  // Stage 3b (default ON): built-in prop gate. Upstream `.validate` compiles
  // `props` to z.record(unknown) for a 2+-component catalog, so every built-in's
  // prop VALUES were previously unchecked — only BYOC customs (validateManifestProps)
  // were. Runs on the ORIGINAL spec for the same reason the resolution gate does:
  // `result.data` is strip-mode output. Ordered after the resolution gate so a
  // pipeline running both reports the same first error as an authoring-side gate
  // that runs validateOps({resolution:true}) and then the prop-enum check.
  if (opts?.props !== false) {
    const propErrors = builtinPropIssues(spec);
    if (propErrors.length > 0) {
      return {
        valid: false,
        errors: propErrors,
        warnings,
        failureCategory: 'invalid_prop_value',
      };
    }
  }

  // Return the ORIGINAL compiled spec, NOT `result.data`. `result.data` is the
  // catalog validator's strip-mode output, which drops every element-envelope key
  // (`on`/`visible`/`watch`/`repeat`/`className`) and any undeclared top-level key
  // (`theme`) — see the comment at the resolution stage above. The input `spec`
  // has already passed the catalog TYPE enum + referential integrity (+ optional
  // resolution grammar) checks, so it is valid; returning it preserves the
  // model-authored interactivity that downstream consumers (the compose response,
  // validateActionWiring, bindActionContract, the interactions manifest) rely on.
  // (Precedent: /actions and /state are only preserved in `result.data` because
  // they were explicitly declared in the element/spec schema; the envelope keys
  // were not, and returning the input is the general fix.)
  return {
    valid: true,
    errors: [],
    warnings,
    spec: spec as FraymeSpec,
  };
}

/**
 * Validate a JSONL operation stream end-to-end (compile + catalog-validate).
 * With `{ resolution: true }` it additionally runs the render-resolution gate.
 * Default behaviour is identical to the historical monolithic validator.
 */
export function validateOps(opsJsonl: string, opts?: ValidateOptions): OpsValidationResult {
  const compiled = compileOps(opsJsonl);
  if ('failure' in compiled) {
    return {
      valid: false,
      errors: compiled.failure.errors,
      warnings: [],
      failureCategory: compiled.failure.failureCategory,
    };
  }
  return validateSpec(compiled.spec, opts);
}

/**
 * BYOC: validate the PROPS of every custom-typed element against its
 * manifest's compiled schema. Upstream `catalog.validate` only gates the type
 * enum + structure (props compile to `z.record(unknown)` for a 2+-component
 * catalog), so a wrong-typed prop on a custom component would otherwise pass and
 * bill. This is the ONLY server-side prop-shape guarantee for customs. Built-in
 * elements are ignored (unknown types too — their type enum is caught by
 * validateSpec against the union). Strip-mode per manifest: extra keys ignored,
 * declared keys type-checked.
 */
export function validateManifestProps(
  spec: unknown,
  compiled: readonly CompiledManifest[],
): OpsValidationResult {
  const byName = new Map(compiled.map((c) => [c.manifest.name, c]));
  const elements =
    spec && typeof spec === 'object'
      ? ((spec as { elements?: Record<string, { type?: string; props?: unknown } | undefined> }).elements ?? {})
      : {};
  const errors: string[] = [];
  for (const [id, el] of Object.entries(elements)) {
    const c = el?.type ? byName.get(el.type) : undefined;
    if (!c) continue;
    const r = c.validateProps(el?.props ?? {});
    if (!r.valid) for (const e of r.errors) errors.push(`elements.${id}: ${e}`);
  }
  return errors.length > 0
    ? { valid: false, errors, warnings: [], failureCategory: 'catalog_validation_failed' }
    : { valid: true, errors: [], warnings: [] };
}
