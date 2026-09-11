# Changelog

Release notes for the Frayme SDK packages — versioned independently, following semver.

## Current versions

| Package | Version |
| --- | --- |
| `@frayme/api` | 0.3.2 |
| `@frayme/runtime` | 0.3.2 |
| `@frayme/catalog` | 0.3.0 |

## 0.3.2 — `@frayme/api`, `@frayme/runtime`

Republish with corrected internal dependency ranges. No functional changes — upgrade freely.

## 0.3.0 — Initial public release

The first public release of the Frayme SDK, MIT licensed, ESM, Node ≥ 20.19.

### `@frayme/api`

- Typed client for the Frayme compose API: `compose.stream()` (handlers, async iteration, snapshot accumulation, `finalSpec()`), `compose.create()`, `me()`, `health()`.
- Automatic retries with per-call idempotency keys — a retried success replays instead of re-billing — and typed `FraymeError` subclasses for the full error taxonomy.
- Framework-agnostic agent tool at `@frayme/api/tools`: one Zod v4 / Standard Schema definition that works in Vercel AI SDK 6, Mastra, LangChain.js, and OpenAI Agents.

### `@frayme/runtime`

- `<FraymeRenderer/>` (`@frayme/runtime/react`) — renders validated Frayme specs with the built-in component registry; local-first interactions, spec-declared named actions surfacing via `onDynamicAction`.
- Transport adapters: Vercel AI SDK (`/ai-sdk` — `<FraymeMessageRenderer/>`, `composeStreamToDataParts()`) and AG-UI (`/ag-ui` — `useFraymeAgUiSpec()`, `<FraymeAgUiRenderer/>`).
- Themeable via `--frayme-*` CSS variables (`@frayme/runtime/styles.css`); unknown component types render an inert fallback.

### `@frayme/catalog`

- The full Frayme component vocabulary as Zod schemas — `CATALOG_COMPONENT_COUNT` reports the current size (189). Zero React dependencies.
- Public spec validation via `fraymeCatalog.validate()` — catalog prop-checking plus json-render referential integrity.
- Tiered LLM prompt generation via `fraymeCatalog.prompt()`, versioned by `CATALOG_VERSION`.

## Versioning stance

- Packages version independently — a runtime release doesn't bump the client.
- Pre-1.0, minor versions may include breaking changes; each is called out here.
- The API itself is path-versioned separately from the SDK — see the [API versioning stance](../api/README.md#versioning-stance).

For the commit-level history, see each package's `CHANGELOG.md` in the [GitHub repository](https://github.com/frayme-ai/frayme-sdk).
