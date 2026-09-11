# Rendering

`<FraymeRenderer>` turns a Frayme spec into live, interactive React UI — this page covers every prop that controls how it renders.

## Setup

Import the component and the stylesheet once:

```tsx
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer spec={spec} />;
```

`styles.css` ships the default look for all 189 catalog components as plain CSS scoped under `.frayme-root`. Without it, components render unstyled. Every color, radius, and font is a `--frayme-*` CSS variable you can override — see [Theming](theming.md).

## `mode`: strict vs progressive

```tsx
// Settled specs (the default): validate, then render
<FraymeRenderer spec={finalSpec} mode="strict" />

// Streaming snapshots: render each partial spec as it arrives
<FraymeRenderer spec={snapshot} mode="progressive" loading={status === 'streaming'} />
```

- **`strict`** (default) — the spec is re-validated against the component catalog before anything renders. A failing spec renders a `role="alert"` panel listing the first five issues instead of the UI. Use this for anything you loaded from storage or received from code you don't control.
- **`progressive`** — renders partial, mid-stream snapshots without validating them. Safety comes from the registry itself: only known component types render, and anything unknown falls back to an inert placeholder. Use this while ops are streaming, then commit the final spec through strict mode.

In strict mode, validation is also skipped while `loading` is true — re-validating every streaming snapshot would be O(n²) over the op stream. The final commit (when `loading` flips false) always faces the strict gate.

## `skipValidation`

```tsx
<FraymeRenderer spec={result.spec} skipValidation />
```

Skips the strict-mode catalog re-validation. Use it for specs you already trust — typically one straight off the Frayme API, which the server has already validated (that guarantee can't survive the wire, so the renderer re-checks by default). The registry whitelist and inert fallback still guard unknown components; you just won't fail closed on an off-catalog prop. No effect in `progressive` mode, which never validates.

## `components`: registry overrides

```tsx
import type { ComponentRegistry } from '@frayme/runtime/react';

const overrides: ComponentRegistry = {
  Button: MyBrandButton, // replaces the built-in Button for this instance
};

<FraymeRenderer spec={spec} components={overrides} />;
```

Per-instance component overrides, merged over the default registry (and over any `components` set on `<FraymeProvider>`). Overriding a built-in swaps its renderer while keeping the spec contract; adding new component types is the BYOC flow — see [Custom components](custom-components.md), which also gives you the `catalog` prop so strict mode accepts them.

## `restartKey`: discarding client state

```tsx
const { spec, restartKey, status } = useFraymeCompose();

<FraymeRenderer
  spec={spec}
  mode="progressive"
  loading={status === 'streaming'}
  restartKey={restartKey}
/>;
```

Bumping `restartKey` remounts the state tree and discards **all** client state — every typed value, every toggled filter. That is exactly what a `compose.restarted` stream event requires (the previous attempt's ops are void), so `useFraymeCompose` bumps it for you on restart. If you drive the stream yourself, wire your `restarted` handler to increment it.

Between bumps, the state store is stable: a new spec arriving at an unchanged `restartKey` is treated as an in-place patch, and the user's in-progress edits survive (see [Edits and journeys](edits-and-journeys.md)).

## `initialState`

```tsx
<FraymeRenderer spec={spec} initialState={{ email: user.email, plan: 'pro' }} />
```

Overrides the spec's embedded `state` as the seed for the client store. The default is `spec.state` — the values the model seeded. `initialState` is read when the state tree mounts and again on each `restartKey` bump, not on every render, so pass a stable object.

Prefer the [`data` field](data-binding.md) at compose time for facts the UI should display; use `initialState` when the same stored spec is rendered for many users and only the state differs.

## Other props

| Prop | Purpose |
| --- | --- |
| `theme` | Per-instance `ThemeTokens` — see [Theming](theming.md). |
| `loading` | Marks the UI as still streaming; strict validation waits for the settled spec. |
| `interactive` | `false` renders a display-only UI: controls render but clicks are inert. Defaults to `true` whenever an action handler or action config is present. |
| `onDynamicAction`, `actions`, `defaultActionKind`, `compose`, `onRecompose` | Action wiring — see [State and actions](state-and-actions.md). |
| `catalog` | BYOC catalog union so strict mode accepts custom component types — see [Custom components](custom-components.md). |
| `className` | Extra class on the `.frayme-root` wrapper. |

## A complete streaming setup

```tsx
'use client';
import { FraymeProvider, FraymeRenderer, useFraymeCompose } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

function Canvas() {
  const { compose, spec, status, restartKey } = useFraymeCompose();

  return (
    <>
      <button onClick={() => compose({ prompt: 'Team usage dashboard', signals: { data_shape: ['chart', 'table'] } })}>
        Generate
      </button>
      <FraymeRenderer
        spec={spec}
        mode="progressive"
        loading={status === 'streaming' || status === 'restarting'}
        restartKey={restartKey}
      />
    </>
  );
}
```

{% hint style="info" %}
`useFraymeCompose` needs a client. In the browser, use keyless proxy mode — `new Frayme({ apiKey: null, baseURL: '/api/frayme-proxy' })` — and pass it via `<FraymeProvider client={frayme}>`. Never ship a live secret key to the browser.
{% endhint %}

## Next steps

- [State and actions](state-and-actions.md) — what happens when the user clicks
- [Theming](theming.md) — make it match your product
- [Custom components](custom-components.md) — render your own components inside a spec
