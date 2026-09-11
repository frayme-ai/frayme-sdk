/**
 * The Frayme-owned TIERED catalog prompt serializer.
 *
 * The upstream @json-render/core serializer behind `fraymeCatalog.prompt()`
 * excludes every per-prop `.describe()`, every `eventsDoc` line, and every
 * component `example`. This module CARRIES that documentation at
 * three detail tiers so consumers can trade tokens for teaching signal:
 *
 *   - `full`     — every prop describe, expanded array/object item shapes,
 *                  eventsDoc + intrinsic payload keys, null-stripped examples.
 *   - `standard` — describes + collapsed shape signatures, eventsDoc; no examples.
 *   - `compact`  — first sentence + `name:sigil` prop tokens + bare event verbs.
 *
 * DETERMINISTIC by construction: components render in alphabetical order, all
 * content is derived from the static catalog defs (no timestamps, no
 * randomness), so the same catalog always serializes byte-identically. The
 * first line embeds CATALOG_VERSION + the tier + the emitted component count
 * so a stored prompt is traceable to its vocabulary version.
 *
 * This is a SIBLING of the upstream wrapper, not a replacement —
 * `fraymeCatalog.prompt()` is untouched (downstream consumers depend on its
 * byte-exact output).
 */

import { CATALOG_VERSION } from './version.js';
import { fraymeCatalog } from './catalog.js';
import { CANONICAL_EVENTS, EVENT_CONTRACT } from './components/events.js';
import type { CanonicalEvent, EventContractEntry } from './components/events.js';

/* ── public surface ──────────────────────────────────────────────────────── */

export type CatalogPromptDetail = 'full' | 'standard' | 'compact';

export interface CatalogPromptOptions {
  /** Detail tier (default `standard`). */
  detail?: CatalogPromptDetail;
  /**
   * Optional component-name slice — only these components are emitted
   * (unknown names are silently skipped). The per-request slice mechanism.
   */
  components?: string[];
  /**
   * Override the component-definition map to serialize (BYOC: a union of
   * built-ins + custom manifest entries). Defaults to the built-in singleton —
   * the default path is byte-identical. The serializers are pure over this map.
   */
  defs?: Record<string, ComponentDef>;
}

/* ── catalog def + zod-internal shapes (zod 4.4.x, pinned) ───────────────── */

export interface ComponentDef {
  props?: { shape?: Record<string, unknown> | (() => Record<string, unknown>) };
  slots?: readonly string[];
  events?: readonly string[];
  eventsDoc?: Record<string, string>;
  description?: string;
  example?: unknown;
}

/**
 * The zod-4 internals we read. Wrapper nodes
 * (`nullable`/`optional`/`default`/`prefault`) carry `_def.innerType`;
 * `.description` is the public getter for `.describe()` text and may live on
 * the wrapper OR the innerType depending on call order — both occur.
 */
interface ZodNode {
  description?: string;
  options?: readonly string[];
  shape?: Record<string, unknown> | (() => Record<string, unknown>);
  _def?: {
    type?: string;
    description?: string;
    innerType?: unknown;
    element?: unknown;
    options?: readonly unknown[];
    valueType?: unknown;
    values?: readonly unknown[];
    items?: readonly unknown[];
  };
}

const asNode = (u: unknown): ZodNode => (u ?? {}) as ZodNode;

/* ── zod unwrapping + describe resolution ────────────────────────────────── */

/** Unwrap nullable/optional/default wrappers to the base type. */
function unwrap(u: unknown): { inner: ZodNode; optional: boolean } {
  let f = asNode(u);
  let optional = false;
  for (let i = 0; i < 8 && f._def; i++) {
    const t = f._def.type;
    if (t === 'nullable' || t === 'optional') {
      optional = true;
      f = asNode(f._def.innerType);
    } else if (t === 'default' || t === 'prefault' || t === 'nonoptional' || t === 'readonly' || t === 'catch') {
      f = asNode(f._def.innerType);
    } else {
      break;
    }
  }
  return { inner: f, optional };
}

/** First `.describe()` text found walking the wrapper chain inward. */
function descOf(u: unknown): string {
  let f = asNode(u);
  for (let i = 0; i < 8; i++) {
    const d = f.description ?? f._def?.description;
    if (typeof d === 'string' && d.length > 0) return d;
    const next = f._def?.innerType;
    if (!next) break;
    f = asNode(next);
  }
  return '';
}

function shapeEntries(node: ZodNode): [string, unknown][] {
  const raw = node.shape ?? {};
  const shape = typeof raw === 'function' ? raw() : raw;
  return Object.entries(shape);
}

function componentShape(def: ComponentDef): [string, unknown][] {
  return shapeEntries(asNode(def.props));
}

/* ── value-channel detection ─────────────────────────────────────────────── */

const COLOR_NAMES = /^(accent|accentText|bg|backgroundColor|fg|foreground|fill|stroke|gradientFrom|gradientTo)$/i;
const COLOR_SUFFIX = /colou?r$/i;

function isColorProp(name: string, desc: string): boolean {
  if (COLOR_SUFFIX.test(name) || COLOR_NAMES.test(name)) return true;
  return /\bcolou?r\b|\bhex\b|oklch|rgb\(|hsl\(/i.test(desc);
}

/**
 * Count-kind dimensionSchema props (Grid.columns, Text.clamp, …) share the
 * union{string,number} shape with real dimensions but take unitless counts.
 * The DimOpts factory arg is erased at runtime, so detect via the description.
 */
function isCountDesc(desc: string): boolean {
  return /\b(number of|how many)\b|\b(lines|columns|rows|count)\s*\(\d+\s*-\s*\d+\)/i.test(desc);
}

/** dimensionSchema = union[string, number]; other unions are behavioral. */
function unionIsDimension(inner: ZodNode): boolean {
  const opts = inner._def?.options;
  if (!Array.isArray(opts)) return false;
  const kinds = opts.map((o) => unwrap(o).inner._def?.type);
  return kinds.length === 2 && kinds.includes('string') && kinds.includes('number');
}

function unionMembers(inner: ZodNode): readonly unknown[] {
  return Array.isArray(inner._def?.options) ? inner._def.options : [];
}

/* ── TYPE rendering ──────────────────────────────────────────────────────── */

function enumLabel(inner: ZodNode): string {
  return (inner.options ?? []).join('|');
}

function literalLabel(inner: ZodNode): string {
  return (inner._def?.values ?? []).map((v) => JSON.stringify(v)).join('|');
}

/** One-word label for a nested/member type (never expands). */
function shallowLabel(name: string, u: unknown): string {
  const desc = descOf(u);
  const { inner } = unwrap(u);
  switch (inner._def?.type) {
    case 'enum':
      return enumLabel(inner);
    case 'boolean':
      return 'boolean';
    case 'number':
    case 'int':
    case 'bigint':
      return 'number';
    case 'string':
      return isColorProp(name, desc) ? 'color' : 'string';
    case 'literal':
      return literalLabel(inner);
    case 'union':
      if (unionIsDimension(inner)) return isCountDesc(desc) ? 'count' : 'dimension';
      return unionMembers(inner)
        .map((m) => shallowLabel('', m))
        .join('|');
    case 'array':
    case 'tuple':
      return 'array';
    case 'object':
    case 'record':
    case 'map':
      return 'object';
    default:
      return 'any';
  }
}

/**
 * Expand an object node ONE level.
 *  - withDocs (full tier): `key: type — describe; …`
 *  - !withDocs (standard tier): the collapsed signature `key, key2, opt?`
 */
function expandShape(objNode: ZodNode, withDocs: boolean): string {
  const parts: string[] = [];
  for (const [key, field] of shapeEntries(objNode)) {
    const { optional } = unwrap(field);
    const k = optional ? `${key}?` : key;
    if (!withDocs) {
      parts.push(k);
      continue;
    }
    const doc = descOf(field);
    parts.push(`${k}: ${shallowLabel(key, field)}${doc ? ` — ${doc}` : ''}`);
  }
  return parts.join(withDocs ? '; ' : ', ');
}

/** Full/standard TYPE for a top-level prop. */
function typeLabel(name: string, field: unknown, tier: 'full' | 'standard'): string {
  const desc = descOf(field);
  const { inner } = unwrap(field);
  switch (inner._def?.type) {
    case 'enum':
      return enumLabel(inner);
    case 'boolean':
      return 'boolean';
    case 'number':
    case 'int':
    case 'bigint':
      return 'number';
    case 'string':
      return isColorProp(name, desc) ? 'color' : 'string';
    case 'literal':
      return literalLabel(inner);
    case 'union':
      if (unionIsDimension(inner)) return isCountDesc(desc) ? 'count' : 'dimension';
      return unionMembers(inner)
        .map((m) => shallowLabel('', m))
        .join('|');
    case 'array': {
      const el = unwrap(inner._def.element).inner;
      if (el._def?.type === 'object') return `array of {${expandShape(el, tier === 'full')}}`;
      return `array of ${shallowLabel('', inner._def.element)}`;
    }
    case 'tuple':
      return 'array';
    case 'object':
      return `{${expandShape(inner, tier === 'full')}}`;
    case 'record':
      return `record of ${shallowLabel('', inner._def.valueType)}`;
    default:
      return 'any';
  }
}

/**
 * Compact-tier caps on an expanded item shape.
 *
 * `ITEM_KEY_CAP` bounds how many keys of one element are listed before the rest
 * elide to `…` — an element with 30 keys teaches shape, not a schema dump.
 * `ITEM_ENUM_CAP` collapses an oversized nested enum to the bare word `enum`:
 * `Fab.actions[].icon` is the 280-name icon registry, and that exact 2,512-char
 * string is ALREADY printed twice in the compact base (under `### Icon` and
 * `### Fab`) — a third copy inside a nested shape is pure cost.
 */
const ITEM_KEY_CAP = 8;
const ITEM_ENUM_CAP = 12;

/**
 * ONE level of an object's keys, as `key:sigil` (`?` marks optional), capped at
 * ITEM_KEY_CAP with a trailing `…`. Key names + type sigils only — never a
 * `.describe()`: the compact tier carries no prop docs and a test asserts it.
 * Mutually recursive with `sigil`, but `sigil(_, _, true)` never expands again,
 * so the depth is hard-bounded at one.
 */
function itemShape(objNode: ZodNode): string {
  const entries = shapeEntries(objNode);
  const parts: string[] = [];
  for (const [key, field] of entries.slice(0, ITEM_KEY_CAP)) {
    const { optional } = unwrap(field);
    parts.push(`${key}${optional ? '?' : ''}:${sigil(key, field, true)}`);
  }
  if (entries.length > ITEM_KEY_CAP) parts.push('…');
  return parts.join(',');
}

/**
 * Compact tier type sigil (`str`, `num`, `bool`, `dim`, `cnt`, `color`, `arr`,
 * `arr{…}`, `obj`, inline enums).
 *
 * An array-of-objects renders its ELEMENT shape (`arr{label:str,value:str}`)
 * instead of a bare `arr`. Observed cause of real production failures: the
 * compact line for ButtonGroup read `buttons:arr`, which says nothing about the
 * elements being objects — and a model holding exactly this context emitted
 * `["1Y","3Y","5Y"]` and failed validation. A recurring class of fallback
 * failures died on `expected object, received string` inside an array prop
 * (ButtonGroup.buttons, Combobox.options, Stepper.steps, PermissionMatrix.roles,
 * ColorPicker.swatches, SegmentedControl.options). The element shape was
 * reachable only through the full tier, and 74 of the 189 components —
 * ButtonGroup, PermissionMatrix and ColorPicker among them — appear in no
 * `DATA_SHAPE_COMPONENTS` list, so they can never be sliced in at full detail.
 * The compact line is all the fallback model ever sees for them.
 *
 * `nested` = rendering a key INSIDE an already-expanded shape: enums above
 * ITEM_ENUM_CAP collapse to `enum`, and arrays/objects never expand a second
 * level. This is the only recursion guard, so do not drop it.
 */
function sigil(name: string, field: unknown, nested = false): string {
  const desc = descOf(field);
  const { inner } = unwrap(field);
  switch (inner._def?.type) {
    case 'enum': {
      const opts = inner.options ?? [];
      return nested && opts.length > ITEM_ENUM_CAP ? 'enum' : opts.join('|');
    }
    case 'boolean':
      return 'bool';
    case 'number':
    case 'int':
    case 'bigint':
      return 'num';
    case 'string':
      return isColorProp(name, desc) ? 'color' : 'str';
    case 'literal':
      return literalLabel(inner);
    case 'union':
      if (unionIsDimension(inner)) return isCountDesc(desc) ? 'cnt' : 'dim';
      return unionMembers(inner)
        .map((m) => sigil('', m, nested))
        .join('|');
    case 'array': {
      if (nested) return 'arr';
      const el = unwrap(inner._def.element).inner;
      if (el._def?.type === 'object') {
        const s = itemShape(el);
        if (s) return `arr{${s}}`;
      }
      return 'arr';
    }
    case 'tuple':
      return 'arr';
    case 'object':
    case 'record':
    case 'map':
      return 'obj';
    default:
      return 'any';
  }
}

/* ── example + description helpers ───────────────────────────────────────── */

/** Deep-strip null-valued object keys (examples carry explicit nulls). */
function stripNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripNulls);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === null) continue;
      out[k] = stripNulls(val);
    }
    return out;
  }
  return v;
}

/** First sentence of a description (guards common abbreviations). */
function firstSentence(text: string): string {
  const t = text.trim();
  const re = /[.!?](?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const before = t.slice(0, m.index);
    if (/\b(?:e\.g|i\.e|etc|vs|cf)$/i.test(before)) continue;
    return t.slice(0, m.index + 1);
  }
  return t;
}

/* ── per-component rendering ─────────────────────────────────────────────── */

const contractFor = (verb: string): EventContractEntry | undefined =>
  (EVENT_CONTRACT as Record<string, EventContractEntry | undefined>)[verb];

function renderEvents(def: ComponentDef, tier: 'full' | 'standard'): string[] {
  const events = def.events ?? [];
  if (events.length === 0) return [];
  const lines = ['events:'];
  for (const verb of events) {
    const doc = def.eventsDoc?.[verb] ?? contractFor(verb)?.description ?? '';
    if (tier === 'full') {
      const contract = contractFor(verb);
      const params = contract ? contract.payload.map((p) => `${p.key}${p.optional ? '?' : ''}`).join(', ') : '';
      lines.push(`- on ${verb}: ${doc}${params ? ` (params: ${params})` : ''}`);
    } else {
      lines.push(`- on ${verb}: ${doc}`);
    }
  }
  return lines;
}

function renderComponent(name: string, def: ComponentDef, tier: CatalogPromptDetail): string {
  const description = def.description ?? '';
  const shape = componentShape(def);

  if (tier === 'compact') {
    const lines = [`### ${name} — ${firstSentence(description)}`];
    if (shape.length > 0) lines.push(shape.map(([p, field]) => `${p}:${sigil(p, field)}`).join(' '));
    const events = def.events ?? [];
    if (events.length > 0) lines.push(`events: ${events.join(' ')}`);
    return lines.join('\n');
  }

  const lines = [`### ${name}`, description, 'props:'];
  for (const [p, field] of shape) {
    const doc = descOf(field);
    lines.push(`- ${p}: ${typeLabel(p, field, tier)}${doc ? ` — ${doc}` : ''}`);
  }
  lines.push(...renderEvents(def, tier));
  if (tier === 'full' && def.example != null) {
    lines.push(`example: ${JSON.stringify(stripNulls(def.example))}`);
  }
  return lines.join('\n');
}

/* ── the global EVENTS section (all tiers) ───────────────────────────────── */

function renderEventContract(tier: CatalogPromptDetail): string {
  if (tier === 'compact') return `## Events: ${CANONICAL_EVENTS.join(', ')}`;
  const lines = ['## Event contract — the canonical interaction verbs'];
  for (const verb of CANONICAL_EVENTS) {
    const c = EVENT_CONTRACT[verb];
    lines.push(`- ${verb}: ${c.description}`);
    if (tier === 'full') {
      for (const p of c.payload) {
        lines.push(`  - ${p.key}${p.optional ? '?' : ''} (${p.type}): ${p.doc}`);
      }
    }
  }
  return lines.join('\n');
}

/* ── entry point ─────────────────────────────────────────────────────────── */

/**
 * One line teaching the compact sigil alphabet — notably `arr{…}`, which is
 * syntax the model has otherwise never been shown. Compact tier only: the
 * full and standard tiers spell every type out in words and need no legend.
 */
const COMPACT_SIGIL_LEGEND =
  'Prop sigils: str · num · bool · color · dim (CSS length) · cnt (unitless count) · ' +
  'a|b|c (the only permitted values) · arr (array of scalars) · ' +
  'arr{k:type,…} (array of OBJECTS — every element is an object with these keys; `?` = optional, `…` = further keys omitted) · ' +
  'obj (a single object) · enum (a closed set spelled out under its own component).';

/**
 * Serialize the Frayme catalog into a model-facing prompt at the requested
 * detail tier. Deterministic: the same catalog produces byte-identical output.
 */
export function buildCatalogPrompt(opts: CatalogPromptOptions = {}): string {
  const tier: CatalogPromptDetail = opts.detail ?? 'standard';
  const defs =
    opts.defs ??
    (fraymeCatalog as unknown as { data: { components: Record<string, ComponentDef> } }).data.components;
  const all = Object.keys(defs).sort();
  const filter = opts.components ? new Set(opts.components) : null;
  const names = filter ? all.filter((n) => filter.has(n)) : all;

  const header =
    `# Frayme component catalog ${CATALOG_VERSION} — tier: ${tier} — components: ${names.length}` +
    (tier === 'compact' ? `\n${COMPACT_SIGIL_LEGEND}` : '');
  const blocks = names.map((n) => renderComponent(n, defs[n], tier));
  return [header, ...blocks, renderEventContract(tier)].join('\n\n') + '\n';
}

/* ── BYOC (custom manifest) serialization ────────────────────────────────── */

/** Full-tier prompt-slice length (chars) for one manifest entry — the measure
 * `defineFraymeComponent` enforces the per-manifest cap against. Uses the SAME
 * `renderComponent` the built-ins use, so a manifest's slice reads exactly
 * like a catalog block. */
export function renderManifestSliceChars(name: string, entry: ComponentDef): number {
  return renderComponent(name, entry, 'full').length;
}

/**
 * The per-request custom-components block spliced into the compose context
 * (BYOC). The preamble is AUTHORED here (frozen under PROMPT_VERSION on the
 * inference side) so nothing gets invented at build time. Each entry renders at
 * full tier via the shared serializer. Names are sorted for determinism.
 */
export function buildManifestsBlock(entries: Record<string, ComponentDef>): string {
  const names = Object.keys(entries).sort();
  const preamble =
    '## ADDITIONAL WORKSPACE COMPONENTS\n' +
    'These components are available ONLY for this request, in addition to the catalog. ' +
    'Use one when it fits the request better than a catalog component. All catalog rules ' +
    'apply unchanged: same op format, same event verbs, same payload keys.';
  const blocks = names.map((n) => renderComponent(n, entries[n], 'full'));
  return [preamble, ...blocks].join('\n\n');
}
