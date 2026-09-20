# How Frayme works

Frayme turns an agent's intent into live, interactive UI in three steps: your agent decides, Frayme composes a validated spec, and your app renders it.

## The loop

```
your agent decides  →  Frayme composes validated UI  →  your app renders
        ↑                                                      │
        └────────────── user actions flow back ────────────────┘
```

1. **Your agent decides.** Somewhere in your product, an agent (or plain server code) concludes the user needs an interface: a form, a dashboard, a confirmation. It describes that intent as a prompt, optionally with display data and a contract of named actions.
2. **Frayme composes validated UI.** Frayme runs its own model, purpose-built for composing interfaces. It streams back a [json-render](https://json-render.dev) spec as a series of operations. Every spec is validated against the 189-component catalog before it renders, and weak generations are automatically retried on a stronger model. You are only billed for validated successes.
3. **Your app renders.** `<FraymeRenderer />` renders the spec with real React components. Most interactions resolve locally in the browser; the named actions your spec declares flow back to your agent as typed events, and the loop continues.

## Minimal end-to-end example

```ts
// server: compose a UI from intent
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'A refund approval card for order #4821: amount, reason, approve/deny',
  actions: [
    { name: 'approveRefund', role: 'approve', required: true },
    { name: 'denyRefund', role: 'deny' },
  ],
});

const { spec } = await stream.finalSpec(); // resolves once the spec is validated
```

```tsx
// client: render it, receive actions
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer
  spec={spec}
  onDynamicAction={(e) => agent.handle(e)} // { action, params, state, ... }
/>;
```

That is the whole integration surface: one API call in, one renderer out, one action callback back.

If your agent runs on the [Vercel AI SDK](../frameworks/ai-sdk.md), `fraymeTools({ client, messages })` from `@frayme/api/ai-sdk` packages the compose and action calls as the ready-made `frayme_compose` and `frayme_action` tools, and adds `lookup_intent` and `query_source` when you pass `intents` or `sources`.

## Where Frayme sits

Frayme is built on three open standards. It adopts them; it never competes with them.

| Layer | Standard | What it answers | Frayme's role |
| --- | --- | --- | --- |
| UI specification | [json-render](https://json-render.dev) (Vercel) | *What* to render | Every Frayme spec **is** a json-render spec. No custom format, no DSL. |
| Agent transport | [AG-UI](https://github.com/ag-ui-protocol) (Linux Foundation) | *How* agents talk to UI | `@frayme/runtime/ag-ui` delivers specs as `frayme:spec` events and forwards presses back to your agent as `frayme:action` payloads. |
| Host integration | MCP Apps (SEP-1865, Anthropic + OpenAI) | UI *inside* Claude and ChatGPT | Frayme specs render inside MCP hosts without changes. |

Because the spec format is standard json-render, nothing locks you in: a Frayme-composed spec is a plain JSON document you can store, diff, edit by hand, or render with any json-render-compatible renderer.

What Frayme adds on top of the standards:

- **Composition**: a hosted model that turns natural-language intent (plus your data and action contract) into a correct spec, streamed live.
- **Validation**: every generation is gated against the catalog before it renders or bills. See [Validation](validation.md).
- **The action contract**: declare the actions your agent can handle and Frayme guarantees the UI wires them. See [Interactivity](interactivity.md).
- **The runtime**: a batteries-included React renderer with theming, streaming rendering, and adapters for the Vercel AI SDK and AG-UI.

## What Frayme is not

- **Not a code generator.** Frayme never emits HTML, React source, or arbitrary JavaScript. It emits only declarative JSON specs, validated against a closed component catalog. That is what makes the output safe to render.
- **Not a renderer fork.** `@frayme/runtime` wraps `@json-render/react`; it does not replace it.
- **Not an app builder.** Frayme is an API for agents that need an interface at runtime, not a design tool that exports projects.

## Next steps

- [The spec](the-spec.md): the anatomy of what Frayme generates
- [Streaming](streaming.md): the SSE contract and how the SDK handles it
- [Validation](validation.md): why every spec is safe before it renders
- [Interactivity](interactivity.md): the local-first event model
