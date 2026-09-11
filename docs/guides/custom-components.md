# Custom components

Bring your own components (BYOC): teach Frayme a component it doesn't have, let the model compose with it, and render it with your own React code — validated end-to-end like the built-in 189.

## How BYOC works

A custom component is split across two planes:

- **The manifest** — a serializable description (name, docs, constrained prop schema, events, example). This is all Frayme ever sees: it teaches the model when to use the component, constrains what specs may contain, and generates the prop types your code implements.
- **The component** — your React code, which never leaves your app.

The flow is: `defineFraymeComponent` compiles and lints the manifest → the manifest rides the compose request in `custom_components` → the returned spec may use your component → `createCustomComponents` wires your React code into the renderer.

## 1. Define the manifest

```ts
import { defineFraymeComponent } from '@frayme/catalog';

export const SeatMapManifest = defineFraymeComponent({
  name: 'SeatMap',
  description:
    'An interactive venue seat map showing seat availability by section and row. ' +
    'Use it whenever the user must pick one or more specific seats, rather than just a quantity of tickets.',
  useWhen: 'Prefer over a plain list when seat position matters (venues, flights, exams).',
  props: {
    sections: {
      kind: 'array',
      doc: 'The venue sections to draw, each with a display label and its seat count.',
      of: {
        label: { kind: 'string', doc: 'Section display name shown on the map, e.g. "Stalls" or "Balcony left".' },
        seats: { kind: 'count', doc: 'The number of selectable seats this section contains, drawn as a grid.' },
      },
      maxItems: 12,
    },
    accent: { kind: 'color', doc: 'Accent colour (hex) used to highlight selected seats on the map.' },
    maxSelectable: { kind: 'count', doc: 'How many seats the user may select at once before others lock.' },
  },
  events: ['select'],
  eventsDoc: { select: 'Fires when the user toggles a seat; payload id is the seat identifier.' },
  example: {
    sections: [{ label: 'Stalls', seats: 120 }],
    accent: '#7c3aed',
    maxSelectable: 4,
  },
});
```

`defineFraymeComponent` throws a `ManifestLintError` listing every violation if the manifest breaks the contract:

| Rule | Requirement |
| --- | --- |
| `name` | PascalCase, `^[A-Z][A-Za-z0-9]{2,39}$`; unique vs the built-in catalog; `Frayme*`/`Json*` prefixes reserved |
| `description` | ≥80 chars and ≥2 sentences — this is the model's "when to use this" signal |
| `props` | 1–30 props from a **closed kind vocabulary**: `string`, `text`, `number`, `boolean`, `enum`, `color`, `dimension`, `count`, `icon`, plus `array`/`object` of scalars (no deeper nesting). Every prop's `doc` ≥40 chars |
| `events` | A subset of the 8 canonical verbs: `commit` `select` `change` `dismiss` `search` `sort` `page` `move`. Each `eventsDoc` entry ≥20 chars |
| `example` | **Required**, and must pass the compiled prop schema |
| Size | Serialized manifest ≤6 KB; its model-facing slice ≤1,600 chars |

The compiled result also gives you `validateProps(props)` for offline checks and a content-hash `version` for change tracking.

## 2. Send it with the request

```ts
const stream = frayme.compose.stream({
  prompt: 'Ticket checkout for Saturday: seat picker plus an order summary',
  custom_components: [SeatMapManifest.manifest], // the plain manifest object
});
```

Up to 20 manifests per request (plan limits may be lower). The server re-runs the same lint your client ran — a bad manifest is a `400 INVALID_MANIFEST`, and manifests whose combined model-facing slices exceed the 12,000-char per-request budget are a `400 CUSTOM_SLICE_TOO_LARGE`. Specs that come back are validated against the union of the built-in catalog and your manifests, including your components' props.

## 3. Render it

Implement the component against the typed contract, then register it:

```tsx
import { createCustomComponents, FraymeRenderer } from '@frayme/runtime/react';
import type { FraymeParts } from '@frayme/catalog';
import { SeatMapManifest } from './seat-map-manifest';

function SeatMap({ props, emit }: FraymeParts<typeof SeatMapManifest>) {
  // props is fully typed from the manifest; every key optional and nullable
  return (
    <div>
      {props.sections?.map((s, i) => (
        <SectionGrid
          key={i}
          label={s.label ?? ''}
          seats={s.seats ?? 0}
          accent={props.accent ?? undefined}
          onSeat={(id) => emit('select', { id })} // emit is typed to the declared verbs
        />
      ))}
    </div>
  );
}

const { registry, catalog } = createCustomComponents([
  { manifest: SeatMapManifest, component: SeatMap },
]);

<FraymeRenderer spec={spec} components={registry} catalog={catalog} />;
```

Both props matter: `components` merges your renderer in, and `catalog` is the built-ins ∪ manifests union so **strict-mode validation accepts** specs containing your types. Without `catalog`, a spec using `SeatMap` fails the strict gate (or renders an inert placeholder if only validation is skipped).

What the wrapper guarantees around your code:

- **Props are gated client-side too**: unknown keys are stripped and invalid values are dropped to `null` — your component never crashes on a bad prop and the element is never dropped.
- **Custom components are leaf components** — they receive `{ props, emit }` only, never children.
- **`emit` is checked in dev**: emitting an undeclared verb, or a declared verb the spec didn't bind, logs a console warning so dead wiring surfaces early.
- Add `clientOnly: true` to an entry if the component touches `window`/`document` — it renders a neutral skeleton during SSR and mounts on the client.

{% hint style="info" %}
Write prop docs and the description for the model, not for humans reading source. They are the only thing steering when and how your component gets used — a vague doc produces vague usage.
{% endhint %}

## Next steps

- [Rendering](rendering.md) — the `components` and `catalog` props in context
- [State and actions](state-and-actions.md) — where your emitted events end up
