# @frayme/catalog

The component vocabulary a Frayme spec may use (189 components as Zod schemas), plus the public validation surface, the BYOC manifest kernel, and the canonical event contract.

```bash
npm i @frayme/catalog
```

ESM, MIT, Node ≥ 20.19. Version 0.4.1. The catalog is fully open: the same schemas that gate every generated spec server-side are on npm for you to validate against locally.

## The catalog instance

```ts
import { fraymeCatalog, CATALOG_COMPONENT_COUNT, CATALOG_VERSION } from '@frayme/catalog';

const result = fraymeCatalog.validate(spec); // { success, data?, error? }

CATALOG_COMPONENT_COUNT; // 189: derived from the catalog, never hardcoded
CATALOG_VERSION;         // 'frayme-0.19.0'
```

`fraymeCatalog.validate(spec)` is the same gate the API runs before a generation is finalized and billed. `componentEvents(type)` returns the canonical verbs a component type can emit.

## Validation surfaces (`@frayme/catalog/validate`)

The `/validate` entrypoint is the single source of truth for compiling json-render operation streams into specs and validating them:

```ts
import { validateOps, compileOps, validateSpec } from '@frayme/catalog/validate';

// End-to-end: JSONL ops string → compiled spec → catalog + referential checks
const r = validateOps(opsJsonl, { resolution: true });
if (!r.valid) console.error(r.failureCategory, r.errors);
```

| Function | Description |
| --- | --- |
| `compileOps(opsJsonl)` | Parse JSONL lines and replay them through the stream compiler → `{ spec }` or a categorized `{ failure }`. |
| `validateSpec(spec, opts?)` | Validate a compiled spec: catalog type check + referential integrity (dangling root, missing children), then the built-in prop gate (on by default): literal prop values against their enums, children under a leaf component, chart data the renderer cannot draw, and state paths that resolve. A `$state` read, an `openPath` or a `repeat.statePath` must be seeded in `/state` or written by something in the spec (a `$bindState`, a `setState` in a handler, or `spec.actions`), or it is reported as a dangling state path. Returns the original spec on success, preserving event wiring. |
| `validateOps(opsJsonl, opts?)` | Convenience: `validateSpec(compileOps(opsJsonl))`. |
| `validateManifestProps(spec, manifests)` | BYOC: validate the props of every custom-typed element against its manifest's compiled schema. |

`validateSpec` and `validateOps` return an `OpsValidationResult` (`{ valid, errors, warnings, spec?, failureCategory? }`), with `spec` set only on success. `compileOps` returns `{ spec }` or `{ failure }`.

`ValidateOptions`:

- `resolution: true` additionally runs the render-resolution gate (binding syntax, visibility directives, action kinds, value-channel safety). Off by default; authoring and CI pipelines turn it on.
- `props: false` turns the built-in prop gate off (it is on by default). `computed: false` turns the `$computed` gate off, and `computedFunctions` names extra `$computed` functions your host registers.
- `mode: 'lenient'` runs the serve-side normaliser first (unknown props dropped, enum aliases resolved, scalars coerced) and judges the normalised spec; every change comes back in `normalizations` and `warnings`.
- `catalog`: validate against a [union catalog](#byoc-authoring) instead of the built-in singleton.

Failed results carry a `FailureCategory` so you can track which kinds of mistakes occur:

```
empty_input · malformed_jsonl · compiler_error · empty_spec · catalog_validation_failed ·
invalid_prop_value · unknown_element_key · invalid_binding · invalid_directive ·
invalid_action_kind · resource_limit · unsafe_value
```

The entrypoint also exports the value-channel guards used across the SDK (`safeColor`, `safeDimension`, `safeLatLng`, …) and re-exports the json-render primitives (`createSpecStreamCompiler`, `diffToPatches`, `formatSpecIssues`, `Spec`) so your code never imports `@json-render/core` directly.

## BYOC authoring

A custom component is described by a manifest: the only thing Frayme sees. Your React code stays in your app; the manifest teaches the composer, constrains the validator, and generates the props types your component honours.

```ts
import { defineFraymeComponent } from '@frayme/catalog';

export const SeatMapManifest = defineFraymeComponent({
  name: 'SeatMap', // PascalCase, unique vs the built-in catalog
  description:
    'An interactive venue seat map showing availability per seat. Use when the user ' +
    'is choosing seats for an event, screening, or venue booking flow.',
  props: {
    venue: { kind: 'string', doc: 'Venue display name.' },
    rows: { kind: 'count', doc: 'Number of seat rows.', min: 1, max: 80 },
    accent: { kind: 'color', doc: 'Accent color for selected seats.' },
    seats: {
      kind: 'array',
      doc: 'Seat inventory.',
      of: {
        id: { kind: 'string', doc: 'Seat identifier, e.g. "B12".' },
        status: { kind: 'enum', doc: 'Availability.', values: ['free', 'held', 'sold'] },
      },
    },
  },
  events: ['select', 'commit'], // ⊂ the 8 canonical verbs
  example: { venue: 'Rialto Screen 2', rows: 12, seats: [{ id: 'B12', status: 'free' }] },
});
```

Prop kinds are a closed vocabulary (`string`, `text`, `number`, `boolean`, `enum`, `color`, `dimension`, `count`, `icon`, plus one level of `array` / `object` containers), compiled to the same Zod atoms the built-ins use, so `safeColor` / `safeDimension` gate automatically. Custom components are leaf components (no children). `defineFraymeComponent` lints the manifest (a `ManifestLintError` names the rule) and returns a `CompiledManifest`:

| Member | Description |
| --- | --- |
| `manifest` | The original manifest (literal-typed). Send it as `custom_components` on a compose request. |
| `zod` | The compiled props schema, shape-identical to a built-in catalog entry. |
| `version` | Content hash of the canonical manifest: a stable identity token for change detection. |
| `promptChars` | Measured size of the manifest's prompt slice: your budget signal. |
| `validateProps(props)` | Check a props object against the compiled schema. |
| `cleanProps(props)` | Strip-mode cleaner: unknown keys removed, invalid values dropped to `null`, never a crash. |

`extendCatalog(manifests)` builds a `FraymeCatalogUnion` (built-ins ∪ your manifests) whose `.validate()` plugs into `validateSpec({ catalog })` and `<FraymeRenderer catalog>`. On the rendering side, pair manifests with your components via [`createCustomComponents`](runtime.md#custom-components-byoc); the full walkthrough is the [custom components guide](../guides/custom-components.md).

## The event contract

Every interaction a spec can emit collapses into 8 canonical verbs, exported as `CANONICAL_EVENTS`:

| Verb | Meaning |
| --- | --- |
| `commit` | The primary affordance fired: a CTA press, Enter in an input, a form submit. |
| `select` | Pick an item from a set (row, date, option, menu item). |
| `change` | A value or disclosure state changed. |
| `dismiss` | Close, discard, remove, or clear. |
| `search` | Query-text input for filtering. |
| `sort` | Request a sort column/direction. |
| `page` | Pagination change. |
| `move` | Reposition: reorder, drag, resize. |

`EVENT_CONTRACT` is the machine-readable version: per verb, a description plus the documented payload keys the runtime intrinsically attaches (e.g. `commit` may carry `value`, `fields`, `label`, `index`). It is the same data the `frayme_compose` tool definition embeds, and the runtime's payload types are conformance-tested against it. The documented contract cannot drift from the implemented one.

Helpers: `canonicalize(name)` maps legacy event names to their verb (`press` → `commit`, `selectRow` → `select`); `isCanonical(name)` tests membership; `EVENT_ALIASES` is the full mapping.

`IconName` exports the closed icon vocabulary: 280 glyph names, matched exactly by the runtime's icon registry.

## Version policy

Two versions travel with the package, deliberately decoupled:

- **npm version** (`0.4.1`): the JavaScript API surface. Semver over exports and types.
- **`CATALOG_VERSION`** (`'frayme-0.19.0'`): the component vocabulary. Bumped whenever component schemas, prop shapes, or descriptions change, even when the code surface is untouched.

Pin against `CATALOG_VERSION` when you cache prompts, store specs long-term, or assert vocabulary compatibility; the live API reports its own as `catalog_version` on [`GET /v1/health`](../api/me-and-health.md). `JSON_RENDER_PIN` (`'0.19.x'`) records the upstream `@json-render/core` line this catalog targets. `CATALOG_COMPONENT_COUNT` is computed from the catalog at import time, so a count you display can never go stale.
