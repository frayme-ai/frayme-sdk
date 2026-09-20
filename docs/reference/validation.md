# Validation

Validate a stream of spec operations, or an already-compiled spec, against the Frayme catalog, exactly the way the API gates every generation before it renders.

```ts
import { validateOps, compileOps, validateSpec } from '@frayme/catalog/validate';

// End-to-end: parse JSONL operations, compile, validate.
const result = validateOps(opsJsonl);
if (!result.valid) {
  console.error(result.failureCategory, result.errors);
}
```

## The three functions

- **`compileOps(opsJsonl)`**, stage 1+2: parses each JSONL line and replays it through the stream compiler. Returns `{ spec }` or `{ failure: { errors, failureCategory } }`.
- **`validateSpec(spec, opts?)`**, stage 3: validates an already-compiled spec (component types, prop shapes, referential integrity, no dangling `root`, no missing `children`). Use this on the streaming path, where the spec is compiled incrementally.
- **`validateOps(opsJsonl, opts?)`**, convenience: `validateSpec(compileOps(opsJsonl))`.

## Options

Both validators accept the same options object:

- **`mode`**, `"strict"` (default) validates the spec as written. `"lenient"` first runs the schema-driven normaliser (unknown props dropped, enum aliases resolved, scalar coercions, `FormField` labels inherited) and then validates the normalised spec; every change is listed in `normalizations` and echoed into `warnings`.
- **`resolution`**, run the render-resolution gate (binding syntax, directive shapes, action kinds, value safety) after the catalog and referential checks. Off by default; recommended for authoring and CI pipelines.
- **`props`**: check every literal prop against its schema (enum, type, unknown and missing props) plus the structural rules (a leaf with children, an undrawable chart, a `$state` or `$bindState` read that is neither seeded in `/state` nor written by a control or an action), all reported as `invalid_prop_value`. On by default: an out-of-enum value renders silently as the bare base style, so it is treated as a failure rather than a nuance.
- **`computed`**, check every `$computed` expression (registered function name, argument shape). On by default; skipped when `resolution: true` already ran the full gate.
- **`computedFunctions`**, extra `$computed` function names your host registers, so they are not reported as unknown.
- **`catalog`**, validate against an extended catalog from `extendCatalog()` when you bring custom components. Defaults to the built-in catalog.

## OpsValidationResult

```ts
interface OpsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  spec?: FraymeSpec; // present when valid, the compiled spec, interactivity intact
  failureCategory?: FailureCategory; // present when invalid
  normalizations?: string[]; // lenient mode only, what the normaliser changed, one line each
  normalized?: unknown; // lenient mode only, the normalised spec, valid or not
}
```

## FailureCategory

Branch on the category, not the error strings:

| Category | Meaning |
| --- | --- |
| `empty_input` | The operations string contained no non-blank lines. |
| `malformed_jsonl` | One or more lines did not parse as JSON. |
| `compiler_error` | The stream compiler threw while replaying the operations. |
| `empty_spec` | Compilation produced no spec (or a spec with no root/elements). |
| `catalog_validation_failed` | A component type, prop shape, or spec structure check failed. |
| `invalid_prop_value` | A literal prop value fails its schema (an out-of-enum `direction`, a string where a number is due, a prop the component does not declare, a required prop missing), or the spec has a leaf with children, an undrawable chart, or a `$state` read that nothing seeds or writes. |
| `unknown_element_key` | An element carries a field the renderer does not recognise. |
| `invalid_binding` | A state binding or template expression is malformed. |
| `invalid_directive` | A `visible`/`watch`/conditional directive has the wrong shape. |
| `invalid_action_kind` | A spec-declared action has an unknown `kind`. |
| `resource_limit` | The spec exceeds a size or depth limit. |
| `unsafe_value` | A color/dimension prop carries a value the safety validators reject. |

## Validating a compiled spec directly

```ts
import { validateSpec } from '@frayme/catalog/validate';

const result = validateSpec({
  root: 'card',
  elements: {
    card: { type: 'Card', props: { title: 'Overview' } },
  },
}, { resolution: true });

result.valid; // true
```

Bring-your-own-component specs get their custom props checked by `validateManifestProps(spec, compiledManifests)`, built-in element types are ignored there; the catalog gate above covers them.
