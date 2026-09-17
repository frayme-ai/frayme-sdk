# @frayme/catalog

The Frayme component vocabulary: Zod schemas and prose descriptions for every component a Frayme spec may use, plus the validation gate every generated spec passes before it renders. Zero React dependencies. MIT.

- **Components:** 189 built-ins. The exact number is exported as `CATALOG_COMPONENT_COUNT`. Cite that, not a hardcoded count, so docs never go stale on a catalog bump.
- **`CATALOG_VERSION`:** `'frayme-0.18.0'`, bumped when the vocabulary changes (see Version policy).
- **`JSON_RENDER_PIN`:** `'0.19.x'`, the pinned upstream `@json-render/core` line the schemas are built against.

## Validation

The root export is the catalog instance:

```ts
import { fraymeCatalog } from '@frayme/catalog';

const result = fraymeCatalog.validate(spec); // { success, data?, error? }
```

The `@frayme/catalog/validate` subpath is the full pipeline for JSONL operation streams:

```ts
import { validateOps, compileOps, validateSpec } from '@frayme/catalog/validate';

const result = validateOps(opsJsonl); // compile + catalog-validate in one call
```

- `compileOps(opsJsonl)`: parse the JSONL lines and replay them through the stream compiler; returns `{ spec }` or a categorized `{ failure }`.
- `validateSpec(spec, opts?)`: catalog-validate an already-compiled spec (use on the streaming path, where the spec was compiled incrementally).
- `validateOps(opsJsonl, opts?)`: end-to-end, `compileOps` then `validateSpec`.

Both validators return an `OpsValidationResult`:

```ts
{ valid: boolean; errors: string[]; warnings: string[]; spec?: FraymeSpec; failureCategory?: FailureCategory }
```

`FailureCategory` names the failing stage: `empty_input`, `malformed_jsonl`, `compiler_error`, `empty_spec`, `catalog_validation_failed`, plus the resolution-gate categories `unknown_element_key`, `invalid_binding`, `invalid_directive`, `invalid_action_kind`, `resource_limit`, and `unsafe_value`.

`ValidateOptions`:

- `resolution?: boolean`: opt into the render-resolution gate (element envelope, binding/visibility grammar, action kinds, value safety). Off by default so the streaming/serving path stays lenient; enable it in authoring and CI pipelines that want the strict gate.
- `catalog?`: validate against a catalog union (built-ins ∪ custom manifests) instead of the built-in singleton. The `FraymeCatalogUnion` returned by `extendCatalog` satisfies this.

## Bring your own components (BYOC)

`defineFraymeComponent(manifest)` lints and compiles a custom-component manifest, throwing `ManifestLintError` on any rule violation. The `ManifestInput` contract:

- `name`: PascalCase, `^[A-Z][A-Za-z0-9]{2,39}$`, unique vs the built-ins.
- `description`: ≥80 chars, ≥2 sentences; the "when to use this" signal for spec generation.
- `props`: constrained prop schema, ≤30 props (scalar kinds plus `array`/`object` containers).
- `events`: a subset of the 8 canonical verbs.
- `example`: required; a props object that must pass the compiled schema.

`extendCatalog(compiledManifests)` builds a per-request union catalog (built-ins ∪ manifests) with the same `.validate()` surface as the singleton; pass it to the validators via `ValidateOptions.catalog`. The built-in singleton is never mutated.

## The event contract

- `CANONICAL_EVENTS` (the 8-verb interaction taxonomy): `commit`, `select`, `change`, `dismiss`, `search`, `sort`, `page`, `move`.
- `EVENT_ALIASES`: legacy/native event names mapped to canonical verbs (`press` → `commit`, `toggle` → `change`, `resize` → `move`, …), with `canonicalize()` / `isCanonical()` helpers.
- `componentEvents(type)`: the canonical events a component type emits; `[]` for unknown or display-only types.
- `EVENT_CONTRACT` (machine-readable documentation for each verb): what it means and the intrinsic payload keys the runtime attaches when it fires.

## Version policy

`CATALOG_VERSION` bumps whenever the vocabulary changes in a way that affects what a valid spec looks like: a component added or removed, a prop schema change, or a substantive description change. Comment-only edits and internal refactors that leave the runtime catalog shape unchanged do not bump it.

When it bumps, re-pin for vocabulary compatibility: re-validate stored specs and integrations against the new version, and update anything that hardcodes component names, props, or counts (read `CATALOG_COMPONENT_COUNT` and `CANONICAL_EVENTS` instead of hardcoding).

## License

MIT
