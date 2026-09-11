/**
 * @frayme/catalog — public entry point.
 *
 * Exports:
 *   - fraymeCatalog          The catalog instance (validate, prompt, etc.)
 *   - buildCatalogPrompt     Frayme-owned TIERED prompt serializer (full/standard/compact)
 *   - FraymeSpec             Type of a Frayme spec
 *   - CATALOG_VERSION        Bumped when schemas change
 *   - JSON_RENDER_PIN        Upstream @json-render/core version pin
 *   - canonical events       The 8-verb interaction taxonomy + helpers
 */

export { CATALOG_VERSION, JSON_RENDER_PIN } from './version.js';
import { fraymeCatalog as _catalogForCount } from './catalog.js';
/**
 * Number of built-in components in the catalog — the drift-proof source for any
 * docs that cite a count (e.g. the `frayme_compose` tool JSON), so a hardcoded
 * number never goes stale on a catalog bump.
 */
export const CATALOG_COMPONENT_COUNT = Object.keys(_catalogForCount.data.components).length;
export {
  buildCatalogPrompt,
  buildManifestsBlock,
  renderManifestSliceChars,
  type CatalogPromptOptions,
  type CatalogPromptDetail,
  type ComponentDef,
} from './prompt-tiers.js';
export {
  fraymeCatalog,
  componentEvents,
  extendCatalog,
  type FraymeSpec,
  type FraymeCatalogUnion,
} from './catalog.js';
// BYOC — the manifest kernel (custom components).
export {
  defineFraymeComponent,
  manifestToEntry,
  manifestSchema,
  sanitizeForPrompt,
  ManifestLintError,
  type ManifestInput,
  type PropDef,
  type ScalarPropDef,
  type CompiledManifest,
  type ManifestProps,
  type FraymeParts,
  type StandardPayload,
  type ManifestWire,
} from './manifest.js';
export {
  CANONICAL_EVENTS,
  EVENT_ALIASES,
  CANONICAL_TO_LEGACY,
  COMPONENT_EVENT_ALIASES,
  COMPONENT_EXTRA_EVENTS,
  EVENT_CONTRACT,
  acceptedEventKeys,
  resolveEventKey,
  canonicalize,
  isCanonical,
  canonicalEvents,
  type CanonicalEvent,
  type LegacyEvent,
  type EventContractEntry,
  type EventPayloadKeyDoc,
} from './components/events.js';
// Shared closed-menu atom: the icon-name vocabulary. Public so consumers (and the
// runtime's enum===registry invariant test) can read the exact glyph set.
export { IconName, ENUM_ALIASES, resolveAlias } from './components/_shared.js';
