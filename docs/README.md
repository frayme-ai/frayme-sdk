# Frayme

UI for Agents. Your agent calls one API, and Frayme streams back live, interactive UI: validated before it renders, built on open standards.

{% hint style="info" %}
The SDKs are on npm (`npm i @frayme/api @frayme/runtime`) and everything in these docs is ready to wire up. API keys are issued from your Frayme dashboard at [frayme.ai](https://frayme.ai). The dashboard also has a Sandbox where you configure an agent over your own files (up to five) and export it as a runnable Next.js app.
{% endhint %}

## The idea

Agents are good at deciding *what* to show and terrible at hand-writing frontend code. Frayme splits the problem:

1. **You send a prompt** (plus optional data and declared actions) to `POST /v1/compose`.
2. **Frayme composes a UI spec**: a stream of [json-render](https://json-render.dev) operations, not HTML or React code. Frayme runs its own model, purpose-built for composing interfaces; every spec is validated against the 189-component catalog before it is finalized, and weak generations are automatically retried on a stronger model inside the same response.
3. **You render the spec** with `@frayme/runtime`: live React with a strict component whitelist. No eval, no raw HTML.

Roughly 90% of interactions (typing, tabs, filters, toggles) resolve locally in the renderer at zero cost and zero latency. Only the actions the spec explicitly declares (a form submit, a "regenerate") round-trip to your agent.

## Twenty lines to a live UI

```ts
// server: @frayme/api
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({ prompt: 'A pricing page with three tiers' });
stream.on('op', (op, snapshot) => render(snapshot)); // live spec snapshots
stream.on('restarted', () => clearRendered());       // attempt failed → discard
const { spec } = await stream.finalSpec();           // validated final spec
```

```tsx
// client: @frayme/runtime
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer spec={spec} onDynamicAction={(e) => sendToAgent(e)} />;
```

The [quickstart](getting-started/quickstart.md) turns this into a running Next.js app in under five minutes.

## Explore the docs

| Section | What you'll find |
| --- | --- |
| [Quickstart](getting-started/quickstart.md) | Empty Next.js app → streaming, interactive UI in under five minutes |
| [Authentication](getting-started/authentication.md) | API keys, the browser guard, and keyless proxy mode |
| [Your first generation](getting-started/first-generation.md) | One compose call end to end: request, events, final spec |
| [Concepts](concepts/how-frayme-works.md) | Specs, the component catalog, actions, and the interactivity model |
| [SDK](sdk/api.md) | `@frayme/api`, `@frayme/runtime`, and `@frayme/catalog` in depth |
| [API reference](api/README.md) | Every endpoint, parameter, event, and error code |
| [Frameworks](frameworks/ai-sdk.md) | Vercel AI SDK, Mastra, LangChain.js, OpenAI Agents, AG-UI |
| [Guides](guides/custom-components.md) | Recipes: agent tools, custom components, theming, editing specs |
| [Examples](examples/README.md) | Runnable apps: live demos at [frayme.ai/examples](https://frayme.ai/examples) |
| [Resources](resources/pricing.md) | [Pricing](resources/pricing.md), [changelog](resources/changelog.md), support |

## The packages

All MIT-licensed, ESM, Node ≥ 20.19.

| Package | Version | What it does |
| --- | --- | --- |
| [`@frayme/api`](https://www.npmjs.com/package/@frayme/api) | 0.6.0 | Zero-dependency API client: streaming, typed errors, retries that can't double-bill, agent tools for every major framework (`fraymeTools()` for the Vercel AI SDK), and a ready-made server proxy (`createFraymeHandler()`) |
| [`@frayme/runtime`](https://www.npmjs.com/package/@frayme/runtime) | 0.6.0 | Renders specs as live React 19: full 189-component registry, `--frayme-*` CSS theming, AI SDK and AG-UI adapters |
| [`@frayme/catalog`](https://www.npmjs.com/package/@frayme/catalog) | 0.4.1 | The component vocabulary: schemas, `fraymeCatalog.validate()`, and bring-your-own-component manifests |

## Built on open standards

Frayme adopts three open standards rather than inventing formats:

- **[json-render](https://json-render.dev)** (Vercel): the UI spec format. A Frayme spec is a standard json-render spec; no proprietary DSL.
- **[AG-UI](https://github.com/ag-ui-protocol)** (Linux Foundation): agent-to-UI event transport, via `@frayme/runtime/ag-ui`.
- **MCP**: Frayme UIs served inside Claude and ChatGPT as MCP Apps.

Your specs are portable JSON. If you leave Frayme, they still render.

## Links

[frayme.ai](https://frayme.ai) · [GitHub](https://github.com/frayme-ai/frayme-sdk) ([Discussions](https://github.com/frayme-ai/frayme-sdk/discussions) open) · [X @frayme_ai](https://x.com/frayme_ai) · [LinkedIn](https://www.linkedin.com/company/frayme-ai) · [r/frayme](https://www.reddit.com/r/frayme)
