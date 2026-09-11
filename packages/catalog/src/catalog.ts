/**
 * Frayme catalog — the vocabulary of components a Frayme spec may use,
 * assembled from the per-family schema modules in ./components/.
 *
 * `fraymeCatalog.validate(spec)` gates every generated spec before it renders,
 * and the model-facing system prompt is derived from these same definitions.
 */

import { defineSchema, defineCatalog } from '@json-render/core';
import type { CanonicalEvent } from './components/events.js';
// BYOC: manifestToEntry is used only inside extendCatalog (a function body), so the
// catalog.ts ↔ manifest.ts value cycle is init-safe (neither accesses the other at
// module eval). type-only import of ComponentDef adds no runtime edge.
import { manifestToEntry, type CompiledManifest } from './manifest.js';
import type { ComponentDef } from './prompt-tiers.js';
import { shadcnBaseComponents } from './components/shadcn-base.js';
import { layoutPrimitiveComponents } from './components/layout-primitives.js';
import { navigationComponents } from './components/navigation.js';
import { formsExtendedComponents } from './components/forms-extended.js';
import { dataDisplayExtendedComponents } from './components/data-display-extended.js';
import { miscExtendedComponents } from './components/misc-extended.js';
import { chartComponents } from './components/charts.js';
import { chartsExtraComponents } from './components/charts-extra.js';
import { aiChatComponents } from './components/ai-chat.js';
import { aiFlowComponents } from './components/ai-flow.js';
import { aiContentComponents } from './components/ai-content.js';
import { inputsChoiceComponents } from './components/inputs-choice.js';
import { inputsNumericComponents } from './components/inputs-numeric.js';
import { inputsDateComponents } from './components/inputs-date.js';
import { dataTableComponents } from './components/data-table.js';
import { inputsOverlayComponents } from './components/inputs-overlay.js';
import { marketingHeroComponents } from './components/marketing-hero.js';
import { marketingPageComponents } from './components/marketing-page.js';
import { feedbackExtendedComponents } from './components/feedback-extended.js';
import { socialMediaComponents } from './components/social-media.js';
import { structureFlowComponents } from './components/structure-flow.js';
import { layoutPaneComponents } from './components/layout-pane.js';
import { boardNavComponents } from './components/board-nav.js';
import { filterComposeComponents } from './components/filter-compose.js';
import { chartsProportionComponents } from './components/charts-proportion.js';
import { chartsRadialComponents } from './components/charts-radial.js';
import { mediaExtendedComponents } from './components/media-extended.js';
import { inputsSpecializedComponents } from './components/inputs-specialized.js';
import { utilOverlayComponents } from './components/util-overlay.js';
import { dataLongtailComponents } from './components/data-longtail.js';
import { timeClockComponents } from './components/time-clock.js';
import { signaturePadComponents } from './components/signature-pad.js';
import { schedulerComponents } from './components/scheduler.js';
import { printLayoutComponents } from './components/print-layout.js';
import { blockDocumentEditorComponents } from './components/block-document-editor.js';
import { notificationCenterComponents } from './components/notification-center.js';
import { logConsoleComponents } from './components/log-console.js';
import { editableSpreadsheetGridComponents } from './components/editable-spreadsheet-grid.js';
import { permissionMatrixComponents } from './components/permission-matrix.js';
import { programGuideGridComponents } from './components/program-guide-grid.js';
import { mediaScrubberComponents } from './components/media-scrubber.js';
import { nodeGraphComponents } from './components/node-graph.js';
import { tournamentBracketComponents } from './components/tournament-bracket.js';
import { bodyMapComponents } from './components/body-map.js';
import { mapViewComponents } from './components/map-view.js';
import { floorPlanComponents } from './components/floor-plan.js';
import { mediaAnnotatorComponents } from './components/media-annotator.js';
import { mapEmbedComponents } from './components/map-embed.js';
import { fileEmbedComponents } from './components/file-embed.js';
import { iconComponents } from './components/icon.js';

/**
 * Schema: defines the SHAPE of a Frayme spec and what the catalog provides.
 *
 * spec.root      — entry element ID (string)
 * spec.state     — optional runtime state object
 * spec.elements  — map of element-id → { type, props, children? }
 *
 * catalog.components.<name>.props  — Zod schema for each component's props
 */
const fraymeSchema = defineSchema((s) => ({
  spec: s.object({
    root: s.string(),
    // state and children are OPTIONAL — many real specs (esp. static UIs from
    // json-render's docs) skip /state entirely, and leaf elements have no
    // children. SchemaBuilder.optional() returns { optional: true } which we
    // merge onto the type.
    state: { ...s.any(), optional: true },
    elements: s.record(
      s.object({
        type: s.ref('catalog.components'),
        props: s.propsOf('catalog.components'),
        children: { ...s.array(s.string()), optional: true },
      }),
    ),
    // Spec-authored action handlers (the spec.actions block) — declarative
    // config keyed by action name. Declared at the spec level (a sibling of
    // /elements) so it SURVIVES the validateSpec gate; without this, strip-mode
    // Zod would drop it and the runtime would never see a spec-authored handler.
    actions: { ...s.any(), optional: true },
  }),
  catalog: s.object({
    components: s.map({
      props: s.zod(),
    }),
    actions: s.map({
      params: s.zod(),
    }),
  }),
}));

/**
 * The Frayme catalog instance.
 *
 * Usage:
 *   fraymeCatalog.validate(spec)                — validation gate
 *   fraymeCatalog.prompt({mode:'standalone'})   — LLM system prompt
 *   fraymeCatalog.componentNames                — for diagnostics
 */
export const fraymeCatalog = defineCatalog(fraymeSchema, {
  components: {
    ...shadcnBaseComponents,
    ...layoutPrimitiveComponents,
    ...navigationComponents,
    ...formsExtendedComponents,
    ...dataDisplayExtendedComponents,
    ...miscExtendedComponents,
    ...chartComponents,
    ...chartsExtraComponents,
    ...aiChatComponents,
    ...aiFlowComponents,
    ...aiContentComponents,
    ...inputsChoiceComponents,
    ...inputsNumericComponents,
    ...inputsDateComponents,
    ...dataTableComponents,
    ...inputsOverlayComponents,
    ...marketingHeroComponents,
    ...marketingPageComponents,
    ...feedbackExtendedComponents,
    ...socialMediaComponents,
    ...structureFlowComponents,
    ...layoutPaneComponents,
    ...boardNavComponents,
    ...filterComposeComponents,
    ...chartsProportionComponents,
    ...chartsRadialComponents,
    ...mediaExtendedComponents,
    ...inputsSpecializedComponents,
    ...utilOverlayComponents,
    ...dataLongtailComponents,
    ...timeClockComponents,
    ...signaturePadComponents,
    ...schedulerComponents,
    ...printLayoutComponents,
    ...blockDocumentEditorComponents,
    ...notificationCenterComponents,
    ...logConsoleComponents,
    ...editableSpreadsheetGridComponents,
    ...permissionMatrixComponents,
    ...programGuideGridComponents,
    ...mediaScrubberComponents,
    ...nodeGraphComponents,
    ...tournamentBracketComponents,
    ...bodyMapComponents,
    ...mapViewComponents,
    ...floorPlanComponents,
    ...mediaAnnotatorComponents,
    ...mapEmbedComponents,
    ...fileEmbedComponents,
    ...iconComponents,
  },
  actions: {},
});

// Upstream @json-render/core's prompt template teaches the legacy `press`
// on-key in its worked examples. Rewrite the on-KEY to the Frayme canonical
// `commit` verb so the model-facing prompt is consistent with the catalog's
// canonical events[] (the builtin setState/pushState ACTIONS are left
// untouched — only the event key changes). `press` never appears as a prop key
// (Toggle uses `pressed`), so the `"press": {` / `on.press` patterns are
// exclusively on-keys.
const basePrompt = fraymeCatalog.prompt.bind(fraymeCatalog);
fraymeCatalog.prompt = (options) =>
  basePrompt(options)
    .replace(/"press":(\s*\{)/g, '"commit":$1')
    .replace(/\bon\.press\b/g, 'on.commit');

/**
 * The canonical events[] a component TYPE emits/listens for.
 * The server's action binder uses this to pick the NATURAL event
 * when self-closing a declared action (Button/Link/Form → commit,
 * Select/Switch/Slider → change, DropdownMenu → select, …). Returns [] for an
 * unknown or display-only type. The stored events[] are already canonical.
 */
export function componentEvents(type: string): CanonicalEvent[] {
  const def = (
    fraymeCatalog as unknown as {
      data: { components: Record<string, { events?: string[] } | undefined> };
    }
  ).data.components[type];
  return (def?.events ?? []) as CanonicalEvent[];
}

/** Type of a Frayme spec, inferred from the schema + catalog. */
export type FraymeSpec = typeof fraymeCatalog._specType;

/* ── BYOC: the built-ins ∪ custom-manifests catalog union ────────────────── */

/**
 * A per-request catalog union: the built-in components plus a set of custom
 * manifests. `catalog.validate(spec)` applies the same validation gate as the
 * built-in catalog, just with more legal type names; `componentEvents` is
 * union-aware, so a custom type's declared events are visible to event wiring.
 * `validate` satisfies `ValidateOptions.catalog`, so this object plugs straight
 * into `validateSpec` and the runtime's `<FraymeRenderer catalog=…>`.
 */
export interface FraymeCatalogUnion {
  catalog: typeof fraymeCatalog;
  componentNames: string[];
  entries: Record<string, ComponentDef>;
  componentEvents(type: string): CanonicalEvent[];
  validate(spec: unknown): ReturnType<typeof fraymeCatalog.validate>;
}

/**
 * Build a union catalog from compiled manifests. `defineCatalog` is a pure
 * factory (verified against @json-render/core@0.19), so this applies the
 * standard validation gate over `built-ins ∪ manifests`. Throws on a duplicate
 * manifest name. The built-in singleton is untouched (zero cost when no
 * manifests are passed).
 */
export function extendCatalog(compiled: readonly CompiledManifest[]): FraymeCatalogUnion {
  const seen = new Set<string>();
  const entries: Record<string, ComponentDef> = {};
  const eventsByName = new Map<string, readonly CanonicalEvent[]>();
  for (const c of compiled) {
    const name = c.manifest.name;
    if (seen.has(name)) throw new Error(`duplicate manifest name in union: "${name}"`);
    seen.add(name);
    entries[name] = manifestToEntry(c);
    eventsByName.set(name, c.manifest.events);
  }

  const builtinDefs = (fraymeCatalog as unknown as { data: { components: Record<string, unknown> } }).data
    .components;
  // Mint the union via `fraymeSchema.createCatalog` (what `defineCatalog` calls
  // under the hood — verified against @json-render/core@0.19). The values are the
  // original built-in entries (Zod props) plus the manifest entries; we sidestep
  // the generic prop-type inference with a narrow cast on the schema method (the
  // merged map is a valid catalog input at runtime). The result is the same
  // Catalog kind as the singleton with more component names.
  const merged = { ...builtinDefs, ...entries };
  const catalog = (
    fraymeSchema as unknown as {
      createCatalog(c: { components: Record<string, unknown>; actions: Record<string, unknown> }): typeof fraymeCatalog;
    }
  ).createCatalog({ components: merged, actions: {} });

  return {
    catalog,
    componentNames: catalog.componentNames,
    entries,
    componentEvents(type: string): CanonicalEvent[] {
      const custom = eventsByName.get(type);
      return custom ? [...custom] : componentEvents(type);
    },
    validate: (spec: unknown) => catalog.validate(spec),
  };
}
