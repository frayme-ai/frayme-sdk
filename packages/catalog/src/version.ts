/**
 * Bumped whenever the catalog's component schemas, prop shapes, or
 * descriptions change, so consumers can pin which catalog vocabulary
 * they are compatible with.
 *
 * frayme-0.19.0: component schemas and descriptions changed (event verbs, row actions,
 * prop renames), so the vocabulary version moves with them.
 */
export const CATALOG_VERSION = 'frayme-0.19.0';

/**
 * Pinned upstream @json-render/core version this catalog targets.
 *
 * The protocol primitives (defineCatalog, validateSpec, createSpecStreamCompiler)
 * come from @json-render/core. We pin to make catalog/runtime versioning
 * predictable.
 */
export const JSON_RENDER_PIN = '0.19.x';
