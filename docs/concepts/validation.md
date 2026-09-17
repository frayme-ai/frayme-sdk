# Validation

Every spec Frayme generates is validated against the 189-component catalog before it renders and before it bills; an invalid generation is automatically retried on a stronger model, and you never receive or pay for a spec that failed the gate.

## The gate

Frayme runs its own model, purpose-built for composing interfaces. Model output is never trusted: before `compose.completed` can fire, the generated spec must pass a validation gate that checks, among other things:

- **Component types**: every `elements.*.type` must be one of the 189 catalog components. There is no escape hatch into arbitrary HTML, React, or script.
- **Spec structure**: `state`, `root`, `elements` must form a well-formed json-render document.
- **Referential integrity**: `root` and every id in every `children` array must resolve to a real element; no cycles, no dangling references.
- **Event vocabulary**: `on` wiring must use the 8 canonical event verbs (see [Interactivity](interactivity.md)).
- **The action contract**: every action you declared with `required: true` must be wired to a control; declared actions must be bound legally.
- **Value safety**: colors, dimensions, and coordinates are checked as values, not just types, so a generated prop cannot smuggle in something a renderer would choke on.
- **Resource caps**: element counts, children per element, nesting depth, and string sizes are bounded, so an over-generation can never become a render bomb.

## What happens on failure

Validation failures are handled server-side, invisibly to your integration:

1. The failing attempt is discarded. If you were streaming, you receive `compose.restarted` and should discard rendered state (the SDK does this for you; see [Streaming](streaming.md)).
2. The request is automatically retried on a stronger model, up to 2 times.
3. If no attempt validates, the request fails with `502 COMPOSITION_FAILED` (or an in-band `error` event on a stream).

Failed requests are not billed. Billing happens only on validated success: `compose.completed` is simultaneously the validation receipt and the billing event.

{% hint style="info" %}
This is why there is no "sometimes the AI returns broken JSON" handling anywhere in a Frayme integration. The failure mode is an explicit, typed error and never a malformed spec.
{% endhint %}

## Strict by design

The same stance applies to requests. `POST /v1/compose` rejects unknown fields with `400 BAD_REQUEST` instead of silently ignoring them: a typo like `ui_typ` fails loudly at the boundary rather than degrading output quality invisibly. Limits (prompt length, action count, data size) are enforced the same way.

## Validate on your side too

The exact validator the platform runs ships in `@frayme/catalog`, so you can apply the same gate to specs you store, edit by hand, or receive from anywhere else:

```ts
import { fraymeCatalog } from '@frayme/catalog';

const result = fraymeCatalog.validate(spec);
if (!result.success) {
  console.error(result.error?.issues);
}
```

For pipeline use, `@frayme/catalog/validate` exposes the staged API:

```ts
import { compileOps, validateSpec, validateOps } from '@frayme/catalog/validate';

// Replay a JSONL ops string into a spec.
const compiled = compileOps(opsJsonl);

// Validate a spec you already hold.
const check = validateSpec(spec);

// Or both in one call.
const result = validateOps(opsJsonl);

if (!result.valid) {
  // A machine-readable category, e.g. 'catalog_validation_failed',
  // 'malformed_jsonl', 'invalid_binding', 'resource_limit', ...
  console.error(result.failureCategory, result.errors);
}
```

Every failure carries a `FailureCategory`, a closed union of failure kinds, so tooling can branch on *why* a spec failed, not just that it did.

## Validation in the renderer

`<FraymeRenderer>` applies the gate client-side as well:

- **`mode="strict"`** (default): renders only specs that pass catalog validation. Pass `skipValidation` for specs the API already validated, to skip the redundant re-check.
- **`mode="progressive"`**: renders partial mid-stream snapshots, which by definition cannot pass full validation yet. Safety comes from the component registry itself: unknown types render as an inert fallback, and the final committed spec still faces the strict gate.

```tsx
<FraymeRenderer spec={liveSnapshot} mode="progressive" restartKey={restartKey} />
```

## Custom components

Bring-your-own-component manifests join the same gate, not a weaker one. `extendCatalog` builds a validating union of the built-in catalog and your components, and the server checks BYOC props against your manifest's schema:

```ts
import { defineFraymeComponent, extendCatalog } from '@frayme/catalog';

const InventoryBadge = defineFraymeComponent({ /* ... */ });
const catalog = extendCatalog([InventoryBadge]);

catalog.validate(spec); // built-ins ∪ your components
```

An invalid manifest is rejected at request time with `400 INVALID_MANIFEST`, before any composition runs.

## Next steps

- [Streaming](streaming.md): how validation shapes the event sequence
- [The spec](the-spec.md): the document being validated
- [Interactivity](interactivity.md): the event verbs and action contract the gate enforces
