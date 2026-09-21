# Rendering

`<FraymeRenderer>` turns a Frayme spec into live, interactive React UI. This page covers every prop that controls how it renders.

## Setup

Import the component and the stylesheet once:

```tsx
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer spec={spec} />;
```

`styles.css` ships the default look for all 189 catalog components as plain CSS scoped under `.frayme-root`. Without it, components render unstyled. Every color, radius, and font is a `--frayme-*` CSS variable you can override (see [Theming](theming.md)).

## `mode`: strict vs progressive

```tsx
// Settled specs (the default): validate, then render
<FraymeRenderer spec={finalSpec} mode="strict" />;

// Streaming snapshots: render each partial spec as it arrives
<FraymeRenderer spec={snapshot} mode="progressive" loading={status === 'streaming'} />;
```

- **`strict`** (default): the spec is re-validated against the component catalog before anything renders. A failing spec renders a `role="alert"` panel listing the first five issues instead of the UI. Use this for anything you loaded from storage or received from code you don't control.
- **`progressive`**: renders partial, mid-stream snapshots without validating them. Safety comes from the registry itself: only known component types render, and anything unknown falls back to an inert placeholder. Use this while ops are streaming, then commit the final spec through strict mode.

In strict mode, validation is also skipped while `loading` is true: re-validating every streaming snapshot would be O(n²) over the op stream. The final commit (when `loading` flips false) always faces the strict gate.

## `skipValidation`

```tsx
<FraymeRenderer spec={result.spec} skipValidation />
```

Skips the strict-mode catalog re-validation. Use it for specs you already trust: typically one straight off the Frayme API, which the server has already validated (that guarantee can't survive the wire, so the renderer re-checks by default). The registry whitelist and inert fallback still guard unknown components; you just won't fail closed on an off-catalog prop. No effect in `progressive` mode, which never validates.

## `components`: registry overrides

```tsx
import type { ComponentRegistry } from '@frayme/runtime/react';

const overrides: ComponentRegistry = {
  Button: MyBrandButton, // replaces the built-in Button for this instance
};

<FraymeRenderer spec={spec} components={overrides} />;
```

Per-instance component overrides, merged over the default registry (and over any `components` set on `<FraymeProvider>`). Overriding a built-in swaps its renderer while keeping the spec contract; adding new component types is the BYOC flow. See [Custom components](custom-components.md), which also gives you the `catalog` prop so strict mode accepts them.

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

Bumping `restartKey` remounts the state tree and discards **all** client state: every typed value, every toggled filter. That is exactly what a `compose.restarted` stream event requires (the previous attempt's ops are void), so `useFraymeCompose` bumps it for you on restart. If you drive the stream yourself, wire your `restarted` handler to increment it.

Between bumps, the state store is stable: a new spec arriving at an unchanged `restartKey` is treated as an in-place patch, and the user's in-progress edits survive (see [Edits and journeys](edits-and-journeys.md)).

## `initialState`

```tsx
<FraymeRenderer spec={spec} initialState={{ email: user.email, plan: 'pro' }} />
```

Overrides the spec's embedded `state` as the seed for the client store. The default is `spec.state`: the values the model seeded. `initialState` is read when the state tree mounts and again on each `restartKey` bump, not on every render, so pass a stable object.

Prefer the [`data` field](data-binding.md) at compose time for facts the UI should display; use `initialState` when the same stored spec is rendered for many users and only the state differs.

## Other props

| Prop | Purpose |
| --- | --- |
| `theme` | Per-instance `ThemeTokens`. See [Theming](theming.md). |
| `loading` | Marks the UI as still streaming; strict validation waits for the settled spec. |
| `interactive` | `false` renders a display-only UI: controls render but clicks are inert. Defaults to `true` whenever an action handler or action config is present. |
| `onDynamicAction`, `actions`, `defaultActionKind`, `compose`, `onRecompose` | Action wiring. See [State and actions](state-and-actions.md). |
| `catalog` | BYOC catalog union so strict mode accepts custom component types. See [Custom components](custom-components.md). |
| `className` | Extra class on the `.frayme-root` wrapper. |

## Your own CSS can overrule the stylesheet

`@frayme/runtime/styles.css` puts its utilities inside `@layer utilities`, so you can restyle a screen without fighting specificity. That convenience has a sharp edge: **author styles outside any layer beat every layered style, whatever their specificity.** A one-line reset in your own stylesheet therefore reaches inside a rendered screen and wins.

The usual culprits are element resets, the kind most apps carry:

```css
/* Reaches into every rendered screen: buttons lose their fill, their border,
   and the label colour that sat on that fill. */
button { border: 0; background: none }
button, input, select, textarea { color: inherit }
a { color: inherit; text-decoration: none }
h1, h2, h3, h4 { margin: 0 }
```

Keep such rules off the renderer's subtree. Every screen, and the receipt card, sits under `.frayme-root`, so exclude its descendants. Wrapping the exclusion in `:where()` keeps the specificity you already had, so the rest of your CSS still wins exactly where it did:

```css
button:where(:not(.frayme-root *)) { border: 0; background: none }
:is(button, input, select, textarea):where(:not(.frayme-root *)) { color: inherit }
a:where(:not(.frayme-root *)) { color: inherit; text-decoration: none }
:is(h1, h2, h3, h4):where(:not(.frayme-root *)) { margin: 0 }
```

The same applies to broad element styling such as `table`, `th` and `td` rules: a screen with a `DataTable`, or a `FraymeActionReceipt` and its params table, will pick them up. To restyle a screen on purpose, use the `theme` tokens or target `.frayme-root` yourself; both survive a runtime upgrade in a way a reset does not.

{% hint style="info" %}
Symptom to recognise: the screen's inputs and layout look right, but buttons render as bare text. That is an unlayered `background`/`border` reset, not a broken spec.
{% endhint %}

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
`useFraymeCompose` needs a client. In the browser, use keyless proxy mode (`new Frayme({ apiKey: null, baseURL: '/api/frayme-proxy' })`) and pass it via `<FraymeProvider client={frayme}>`. Never ship a live secret key to the browser.
{% endhint %}

## `FraymeResult`: one result in a chat

When your agent framework streams Frayme tool outputs into its own chat, `<FraymeResult>` draws one of them. It owns no transport and no state beyond the renderer's own: you hand it a tool output or a press, and it picks what to draw.

```tsx
import { FraymeResult } from '@frayme/runtime/react';

<FraymeResult output={output} final={done} interactive={!agentBusy} onPress={(e) => sendToAgent(e)} />;
```

It draws the first case that applies:

| You pass | It draws |
| --- | --- |
| `press` | The thread card for a press the user already made, drawn by `FraymeActionReceipt`. `output` is ignored. |
| An `output` with `refused: true` | Nothing. The tool turned the call down before composing, and the reason is written for the model, not the user. |
| An `output` with `status: 'error'` | A notice with the error's message. Never the spec, which is partial at best on a failed compose. |
| A final `output` with `status: 'complete'` | The spec under the strict catalog gate (the default `mode`, with `skipValidation` off), so an off-catalog spec shows the invalid panel instead of rendering. Presses go to `onPress` while `interactive` is `true`. |
| A final `output` that is not `complete` | A stream saved part-way, for example by a chat reloaded while it ran, or a tool call that was cut off. It draws a notice ("This screen did not finish."), then whatever did arrive, display-only. The controls stay inert, because the agent never saw that screen finish. |
| Any other `output` | The live snapshot, progressive and `loading`. It never runs the strict gate, so the invalid panel never flashes over a half-built screen. It takes typed input, which carries over into the finished screen, but no presses: the agent has not seen the screen finish, so a press on it does nothing. |

`final` defaults to "the status is `complete`", so passing only `output` gives a live render while it streams and a strict render once it completes. Every render uses `output.restart_count` as its `restartKey`: the user's early input survives the switch from the live render to the final one, and a server restart clears it. `FraymeResult` never mutates `output`. It copies `generation_id` onto the rendered spec (when the spec has none) so a press can name the screen it came from.

| Prop | Type | Description |
| --- | --- | --- |
| `output` | `FraymeResultOutput` | The tool output: `{ status, spec, generation_id?, op_count?, restart_count?, error?, refused? }`, with `status` one of `'streaming'`, `'restarted'`, `'complete'`, `'error'`. |
| `final` | `boolean` | Whether `output` is the last one this tool call produces (in the AI SDK, `preliminary !== true`). |
| `press` | `DynamicActionEvent` | A press the user made. When set, the card is drawn instead of `output`. |
| `onPress` | `OnDynamicAction` | Receives presses on the finished screen. |
| `interactive` | `boolean` | Whether the finished screen takes presses now. Default `true`. With `useChat`, pass `false` while the status is `submitted` or `streaming`: a press while the agent is still answering would start a second request alongside the first. While it is `false`, the controls stay visible, a press does nothing, and the control is not latched, so it works once the screen turns interactive. |
| `showState` | `boolean` | Show the press's `state` on its card, in a collapsed block. Default `false`. |
| `theme` | `ThemeInput` | Tokens, or a `{ light, dark }` pair (see [Theming](theming.md)). Falls back to `FraymeProvider`'s. |
| `scheme` | `'light' \| 'dark' \| 'system'` | Forces a mode, or follows the OS. Falls back to `FraymeProvider`'s. |
| `className` | `string` | Extra class on each root it draws. |

For registry overrides or a default `onDynamicAction`, set them on `FraymeProvider`, as for `FraymeRenderer`.

With the Vercel AI SDK, `fraymePart(part, message)` from `@frayme/runtime/ai-sdk` builds these props from a message part: `{ output, final }` for a Frayme tool part, `{ press }` for a message sent by `pressMessage`, and `null` otherwise. `null` also covers a refused output and an error the model retried later in the same message, so pass the whole message. See [Vercel AI SDK](../frameworks/ai-sdk.md#client-the-chat-page).

## Next steps

- [State and actions](state-and-actions.md): what happens when the user clicks
- [Theming](theming.md): make it match your product
- [Custom components](custom-components.md): render your own components inside a spec
