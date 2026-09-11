/**
 * BYOC — the manifest kernel (SDK-first / inline-only design).
 *
 * A "manifest" is the serializable description of a consumer's custom component:
 * its name, docs, a CONSTRAINED prop schema, its declared events, and an example.
 * The consumer's component CODE lives in their app (the render plane, ungated).
 * The manifest is the only thing Frayme sees (the knowledge plane): it teaches
 * the model (prompt), constrains the spec (validator), and generates the props
 * types the component honours (compiler).
 *
 * `defineFraymeComponent(manifest)` lints + compiles it to real zod (the SAME
 * atoms the built-in components use, so `safeColor`/`safeDimension` gate automatically
 * and the prompt introspector reads it unchanged). `manifestToEntry` produces the
 * built-in-shaped catalog entry `extendCatalog` (in catalog.ts) unions in.
 *
 * Design invariants: props use a CLOSED kind vocabulary (no arbitrary JSON
 * Schema); events ⊂ the 8 canonical verbs; customs are LEAF components (no slots
 * / no children in v1). Everything is JSON-serializable so the same object rides
 * a compose request, its lint runs identically on client and server, and its
 * prompt slice is byte-measurable at registration time.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './components/_shared.js';
import { CANONICAL_EVENTS, type CanonicalEvent } from './components/events.js';
import type { DimUnit } from './validate/dimension.js';
// prompt-tiers.ts never imports manifest.ts → this is a one-way edge (no cycle).
import { renderManifestSliceChars, type ComponentDef } from './prompt-tiers.js';
// fraymeCatalog is imported ONLY for the collision lint (built-in names). It is
// accessed exclusively inside lintManifest's body (never at module init), so the
// catalog.ts ↔ manifest.ts cycle (catalog imports manifestToEntry) is safe: by
// the time any manifest is defined, both modules are fully initialized.
import { fraymeCatalog } from './catalog.js';

/* ── the prop-kind vocabulary (closed) ───────────────────────────────────── */

/** A scalar prop kind — the only kinds allowed inside `array.of` / `object.of`
 * (depth ≤ 2: an array/object may not nest another array/object). */
export type ScalarPropDef =
  | { kind: 'string'; doc: string; maxLen?: number }
  | { kind: 'text'; doc: string; maxLen?: number }
  | { kind: 'number'; doc: string; min?: number; max?: number; int?: boolean }
  | { kind: 'boolean'; doc: string }
  | { kind: 'enum'; doc: string; values: readonly string[] }
  | { kind: 'color'; doc: string }
  | { kind: 'dimension'; doc: string; units?: readonly DimUnit[]; min?: number; max?: number }
  | { kind: 'count'; doc: string; min?: number; max?: number }
  | { kind: 'icon'; doc: string };

/** A top-level prop kind — scalars plus the two container kinds. */
export type PropDef =
  | ScalarPropDef
  | { kind: 'array'; doc: string; of: Record<string, ScalarPropDef>; maxItems?: number }
  | { kind: 'object'; doc: string; of: Record<string, ScalarPropDef> };

/** The manifest as a consumer authors it (the wire shape). */
export interface ManifestInput {
  /** PascalCase, `^[A-Z][A-Za-z0-9]{2,39}$`, unique vs the built-in catalog components. */
  name: string;
  /** ≥80 chars, ≥2 sentences — the model's "when to use this" signal. */
  description: string;
  /** Optional short "prefer over X when…" hint (≤200 chars). */
  useWhen?: string;
  /** Constrained prop schema (≤30 props). */
  props: Record<string, PropDef>;
  /** Declared events — a subset of the 8 canonical verbs. */
  events: readonly CanonicalEvent[];
  /** Per-declared-event doc (≥20 chars each; no undeclared keys). */
  eventsDoc?: Record<string, string>;
  /** A valid example props object — REQUIRED, must pass the compiled schema. */
  example: unknown;
}

/* ── type-level: manifest → props type + typed emit (the DX guarantee) ────── */

/** The standard interaction payload keys (mirror of the runtime's
 * IntrinsicEventPayloads — kept here to avoid a catalog→runtime dependency). A
 * typed `emit` constrains payloads to these keys, so `{ seatId }` is a TS error. */
export interface StandardPayload {
  value?: unknown;
  label?: string;
  id?: string;
  index?: number;
  name?: string;
  selected?: unknown;
  checked?: boolean;
  fields?: Record<string, unknown>;
  query?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc' | 'none';
  page?: number;
  all?: boolean;
  auto?: boolean;
  control?: string;
  from?: unknown;
  to?: unknown;
  item?: unknown;
}

type ScalarType<D> = D extends { kind: 'enum'; values: readonly (infer V)[] }
  ? V | null
  : D extends { kind: 'number' | 'count' }
    ? number | null
    : D extends { kind: 'boolean' }
      ? boolean | null
      : string | null; // string | text | icon | color | dimension

type PropType<D> = D extends { kind: 'array'; of: infer S }
  ? Array<{ [K in keyof S]?: ScalarType<S[K]> }> | null
  : D extends { kind: 'object'; of: infer S }
    ? { [K in keyof S]?: ScalarType<S[K]> } | null
    : ScalarType<D>;

/** The typed props object for a manifest (every prop optional + nullable). */
export type ManifestProps<M extends ManifestInput> = {
  [K in keyof M['props']]?: PropType<M['props'][K]>;
};

/** The render contract a consumer's custom component implements:
 * `function SeatMapView({ props, emit }: FraymeParts<typeof SeatMapManifest>)`.
 * `emit`'s first arg is narrowed to the manifest's declared verbs; the payload to
 * the standard keys. Customs are leaf components — no `children`. */
export type FraymeParts<C> = C extends CompiledManifest<infer M>
  ? {
      props: ManifestProps<M>;
      emit: (event: M['events'][number], payload?: StandardPayload) => void;
    }
  : never;

/* ── compiled result ─────────────────────────────────────────────────────── */

export interface CompiledManifest<M extends ManifestInput = ManifestInput> {
  /** The original manifest (literal-typed via the `const` generic). */
  manifest: M;
  /** The compiled props schema — a real `z.object`, shape-indistinguishable from
   * a hand-written catalog entry (so `fraymeCatalog.validate` + the prompt
   * introspector both work unchanged). */
  zod: z.ZodType;
  /** Content hash of the canonical manifest — the version stamp for change
   * detection and telemetry. Not cryptographic; a stable identity token. */
  version: string;
  /** Measured length of the full-tier prompt slice (chars). */
  promptChars: number;
  /** Non-blocking authoring warnings (e.g. many declared events). */
  warnings: string[];
  /** Validate a props object against the compiled schema (offline dev + the
   * server-side per-manifest props walk). Strip-mode: extra keys ignored,
   * declared keys type-checked. */
  validateProps(props: unknown): { valid: boolean; errors: string[] };
  /** Client-side IACVT: return a cleaned props object — unknown keys
   * stripped, and any declared key whose value fails its field schema dropped to
   * `null` (never a crash, never a whole-element drop). The load-bearing defense
   * for props that reach the renderer without a server gate (drift/skipValidation). */
  cleanProps(props: unknown): Record<string, unknown>;
}

/** Thrown by `defineFraymeComponent` when a manifest fails a lint rule. */
export class ManifestLintError extends Error {
  readonly errors: string[];
  constructor(name: string, errors: string[]) {
    super(`Invalid Frayme manifest "${name}":\n  - ${errors.join('\n  - ')}`);
    this.name = 'ManifestLintError';
    this.errors = errors;
  }
}

/* ── size / vocabulary limits ────────────────────────────────────────────── */

const NAME_RE = /^[A-Z][A-Za-z0-9]{2,39}$/;
const RESERVED_RE = /^(Frayme|Json)/;
// Prop keys + nested-shape field keys must be plain identifiers — they are
// interpolated RAW into the model-facing prompt (`- <key>: …`), so a newline or
// `#` in a key could smuggle a fake `### heading`. Keys are validation-significant
// (the model must emit them), so they are REJECTED, never sanitized.
const KEY_RE = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
// Enum values are also interpolated raw (`a|b|c`) and are validation-significant.
// Allow the catalog's token vocabulary (letters/digits/`-`/`_`/`/`/`.`) but never
// control chars, `#`, or backticks (heading/fence injection vectors).
const ENUM_VALUE_RE = /^[A-Za-z0-9/._-]+$/;
const MAX_PROPS = 30;
const MAX_MANIFEST_BYTES = 6 * 1024;
const MAX_SLICE_CHARS = 1600;
const SCALAR_KINDS = new Set(['string', 'text', 'number', 'boolean', 'enum', 'color', 'dimension', 'count', 'icon']);
const CANONICAL = new Set<string>(CANONICAL_EVENTS);
const COLOR_WORDS = /colou?r|hex|oklch|rgb|hsl/i;
const COUNT_WORDS = /\bnumber of\b|\bhow many\b/i;

/* ── serialization safety (injection hardening) ──────────────────────────── */

/** Neutralize a string before it is serialized into the model prompt: collapse
 * newlines (so a doc can't fake a `### heading` boundary in the slice), defuse
 * code fences, and strip ASCII control chars. Applied to EVERY string that
 * reaches the prompt (description, prop docs, eventsDoc, example string values)
 * inside `manifestToEntry` — so `renderComponent` (shared with the built-ins)
 * stays unchanged and byte-identical for built-ins. */
export function sanitizeForPrompt(s: string): string {
  return s
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    // Strip Unicode format/bidi chars that `\s` does NOT catch: zero-width
    // (U+200B–200D, U+2060, U+FEFF), bidi marks/overrides (U+200E–200F,
    // U+202A–202E) and isolates (U+2066–2069). They cannot forge a structural
    // markdown boundary (the whitespace-collapse below blocks that) but let
    // manifest text hide or reorder characters in the model's view.
    .replace(/[​-‏‪-‮⁠⁦-⁩﻿]/g, '')
    .replace(/```/g, "''' ")
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeDeep(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeForPrompt(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v);
    return out;
  }
  return value;
}

/* ── canonical JSON + content hash (pure, browser-safe) ──────────────────── */

function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

/** UTF-8 byte length of a string, without TextEncoder/Buffer (browser-safe). */
function utf8ByteLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4; // surrogate pair → 4 bytes
      i++;
    } else n += 3;
  }
  return n;
}

/** FNV-1a 32-bit → 8-hex-char identity token. Deterministic, sync, universal. */
function contentHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* ── the prop compiler (manifest kind → house zod atom) ──────────────────── */

function compileScalar(def: ScalarPropDef): z.ZodType {
  const doc = sanitizeForPrompt(def.doc);
  switch (def.kind) {
    case 'string':
      return z.string().max(def.maxLen ?? 500).nullable().describe(doc);
    case 'text':
      return z.string().max(def.maxLen ?? 5000).nullable().describe(doc);
    case 'number': {
      let n = z.number();
      if (def.int) n = n.int();
      if (def.min != null) n = n.min(def.min);
      if (def.max != null) n = n.max(def.max);
      return n.nullable().describe(doc);
    }
    case 'boolean':
      return z.boolean().nullable().describe(doc);
    case 'enum':
      return z
        .enum([...def.values] as [string, ...string[]])
        .nullable()
        .describe(doc);
    case 'color':
      // The house colorSchema (already .refine(safeColor).nullable()).
      return colorSchema.describe(doc);
    case 'dimension':
      return dimensionSchema({
        units: def.units ? [...def.units] : undefined,
        min: def.min,
        max: def.max,
      }).describe(doc);
    case 'count':
      return dimensionSchema({ kind: 'count', min: def.min, max: def.max }).describe(doc);
    case 'icon':
      // Bare string, exactly like the built-ins' icon props — the closed icon
      // registry lives in the RENDERER (hasIcon → null on unknown); the manifest
      // kind exists for prompt display + the wrapper's dev warning only.
      return z.string().nullable().describe(doc);
  }
}

// Every prop is OPTIONAL as well as nullable: a spec (and the example) may omit
// any prop, and the typed `ManifestProps<M>` marks every key optional. (The
// built-ins are only `.nullable()`, but their props are never actually parsed —
// upstream compiles them to z.record(unknown); ours ARE parsed, so missing keys
// must pass.) `unwrap()` in the prompt introspector handles the optional wrapper.
function compileShape(of: Record<string, ScalarPropDef>): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const [k, d] of Object.entries(of)) shape[k] = compileScalar(d).optional();
  return shape;
}

function compileProp(def: PropDef): z.ZodType {
  const doc = sanitizeForPrompt(def.doc);
  if (def.kind === 'array') {
    return z
      .array(z.object(compileShape(def.of)))
      .max(def.maxItems ?? 400)
      .nullable()
      .describe(doc);
  }
  if (def.kind === 'object') {
    return z.object(compileShape(def.of)).nullable().describe(doc);
  }
  return compileScalar(def);
}

function compileProps(props: Record<string, PropDef>): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [k, d] of Object.entries(props)) shape[k] = compileProp(d).optional();
  return z.object(shape);
}

/* ── lints ───────────────────────────────────────────────────────────────── */

function sentenceCount(s: string): number {
  return (s.match(/[.!?](\s|$)/g) ?? []).length;
}

function lintScalar(name: string, def: ScalarPropDef, errors: string[]): void {
  if (typeof def.doc !== 'string' || def.doc.trim().length < 40) {
    errors.push(`prop "${name}": doc must be ≥40 chars`);
  }
  if (def.kind === 'enum') {
    if (!Array.isArray(def.values) || def.values.length < 2 || def.values.length > 12) {
      errors.push(`prop "${name}": enum must have 2–12 values`);
    } else if (def.values.some((v) => typeof v !== 'string' || v.length === 0 || v.length > 30)) {
      errors.push(`prop "${name}": enum values must be non-empty strings ≤30 chars`);
    } else if (def.values.some((v) => !ENUM_VALUE_RE.test(v))) {
      errors.push(`prop "${name}": enum values may only contain letters/digits/-_./ (no control chars, "#", or backticks)`);
    }
  }
  if (def.kind === 'color' && !COLOR_WORDS.test(def.doc ?? '')) {
    errors.push(`prop "${name}": a color prop's doc must contain a colour word (e.g. "colour"/"hex") so the model sees it as a colour`);
  }
  if (def.kind === 'count' && !COUNT_WORDS.test(def.doc ?? '')) {
    errors.push(`prop "${name}": a count prop's doc must contain "number of" or "how many" so it renders as a count (not a dimension)`);
  }
}

function lintManifest(m: ManifestInput): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. name
  if (typeof m.name !== 'string' || !NAME_RE.test(m.name)) {
    errors.push('name must match ^[A-Z][A-Za-z0-9]{2,39}$ (PascalCase, 3–40 chars)');
  } else if (RESERVED_RE.test(m.name)) {
    errors.push(`name "${m.name}" uses a reserved prefix (Frayme*/Json*)`);
  } else if (fraymeCatalog.componentNames.includes(m.name)) {
    errors.push(`name "${m.name}" collides with a built-in catalog component`);
  }

  // 2. description
  if (typeof m.description !== 'string' || m.description.trim().length < 80) {
    errors.push('description must be ≥80 chars');
  } else if (sentenceCount(m.description) < 2) {
    errors.push('description must be ≥2 sentences');
  }
  if (m.useWhen != null && (typeof m.useWhen !== 'string' || m.useWhen.length > 200)) {
    errors.push('useWhen must be a string ≤200 chars');
  }

  // 3. props
  const propEntries = m.props && typeof m.props === 'object' ? Object.entries(m.props) : [];
  if (propEntries.length === 0) errors.push('props must declare at least one prop');
  if (propEntries.length > MAX_PROPS) errors.push(`props must be ≤${MAX_PROPS}`);
  for (const [pname, def] of propEntries) {
    if (!KEY_RE.test(pname)) {
      errors.push(`prop key "${pname}" must be a plain identifier (^[A-Za-z][A-Za-z0-9]{0,39}$) — it is interpolated raw into the prompt`);
      continue;
    }
    if (!def || typeof def !== 'object' || typeof (def as PropDef).kind !== 'string') {
      errors.push(`prop "${pname}": missing/invalid kind`);
      continue;
    }
    const kind = (def as PropDef).kind;
    if (kind === 'array' || kind === 'object') {
      const container = def as Extract<PropDef, { kind: 'array' | 'object' }>;
      if (typeof container.doc !== 'string' || container.doc.trim().length < 40) {
        errors.push(`prop "${pname}": doc must be ≥40 chars`);
      }
      const of = container.of;
      if (!of || typeof of !== 'object' || Object.keys(of).length === 0) {
        errors.push(`prop "${pname}": ${kind} needs a non-empty "of" shape`);
      } else {
        for (const [fk, fd] of Object.entries(of)) {
          if (!KEY_RE.test(fk)) {
            errors.push(`prop "${pname}.${fk}": field key must be a plain identifier (^[A-Za-z][A-Za-z0-9]{0,39}$)`);
          } else if (!fd || !SCALAR_KINDS.has((fd as ScalarPropDef).kind)) {
            errors.push(`prop "${pname}.${fk}": ${kind} fields must be scalar kinds (no nested array/object)`);
          } else {
            lintScalar(`${pname}.${fk}`, fd, errors);
          }
        }
      }
      if (container.kind === 'array' && container.maxItems != null && (container.maxItems < 1 || container.maxItems > 400)) {
        errors.push(`prop "${pname}": array maxItems must be 1–400`);
      }
    } else if (SCALAR_KINDS.has(kind)) {
      lintScalar(pname, def as ScalarPropDef, errors);
    } else {
      errors.push(`prop "${pname}": unknown kind "${kind}"`);
    }
  }

  // 4. events
  if (!Array.isArray(m.events)) {
    errors.push('events must be an array');
  } else {
    for (const e of m.events) {
      if (!CANONICAL.has(e)) errors.push(`event "${e}" is not a canonical verb (${CANONICAL_EVENTS.join('/')})`);
    }
    if (m.events.length > 3) {
      warnings.push(`declares ${m.events.length} events — ensure each is actually emitted (an unimplemented verb invites dead wiring)`);
    }
  }

  // 5. eventsDoc
  const declared = new Set(Array.isArray(m.events) ? m.events : []);
  if (m.eventsDoc != null) {
    if (typeof m.eventsDoc !== 'object') {
      errors.push('eventsDoc must be an object');
    } else {
      for (const [verb, doc] of Object.entries(m.eventsDoc)) {
        if (!declared.has(verb as CanonicalEvent)) errors.push(`eventsDoc documents "${verb}" which is not declared in events`);
        else if (typeof doc !== 'string' || doc.trim().length < 20) errors.push(`eventsDoc["${verb}"] must be ≥20 chars`);
      }
    }
  }

  // 6. example (required + must pass the compiled schema)
  if (m.example === undefined) {
    errors.push('example is required');
  } else if (errors.length === 0) {
    // Only compile+check the example once the shape is otherwise clean (a broken
    // prop def would throw during compile).
    try {
      const parsed = compileProps(m.props).safeParse(m.example);
      if (!parsed.success) {
        errors.push(`example does not pass the compiled schema: ${parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`);
      }
    } catch (e) {
      errors.push(`example could not be validated: ${(e as Error).message}`);
    }
  }

  // 7. serialized size (UTF-8 byte length, computed without TextEncoder/Buffer so
  //    the check is universal — @frayme/catalog runs in the browser too).
  const bytes = utf8ByteLength(JSON.stringify(m));
  if (bytes > MAX_MANIFEST_BYTES) errors.push(`serialized manifest is ${bytes} bytes (max ${MAX_MANIFEST_BYTES})`);

  return { errors, warnings };
}

/* ── manifest → built-in-shaped catalog entry ────────────────────────────── */

/** The built-in-shaped catalog entry `extendCatalog` unions in. Props is a real
 * `z.object` (introspector reads `.shape`); NO `slots` (customs are leaf);
 * all prompt-facing strings are sanitized. The `props` cast bridges the nominal
 * ZodType→ComponentDef gap (a ZodObject IS a valid props node at runtime — the
 * same treatment the built-in entries get where `data.components` is cast). */
export function manifestToEntry(compiled: CompiledManifest): ComponentDef {
  const m = compiled.manifest;
  const eventsDoc = m.eventsDoc
    ? Object.fromEntries(Object.entries(m.eventsDoc).map(([k, v]) => [k, sanitizeForPrompt(v)]))
    : undefined;
  return {
    props: compiled.zod as unknown as ComponentDef['props'],
    events: m.events,
    eventsDoc,
    description: sanitizeForPrompt(m.description),
    example: sanitizeDeep(m.example),
  };
}

/* ── the public entry point ──────────────────────────────────────────────── */

/**
 * Lint + compile a manifest. Throws `ManifestLintError` on any rule violation.
 * The `const` type parameter preserves literal enum values + event verbs so
 * `FraymeParts<typeof result>` yields a fully-typed props + emit (TS ≥5.0).
 */
export function defineFraymeComponent<const M extends ManifestInput>(m: M): CompiledManifest<M> {
  const { errors, warnings } = lintManifest(m);
  if (errors.length > 0) throw new ManifestLintError(m?.name ?? '<unnamed>', errors);

  const zod = compileProps(m.props);
  const shape = zod.shape; // per-field schemas, for cleanProps IACVT
  const version = contentHash(canonicalJSON(m));
  const compiled: CompiledManifest<M> = {
    manifest: m,
    zod,
    version,
    promptChars: 0,
    warnings,
    validateProps(props: unknown) {
      const r = zod.safeParse(props);
      return r.success
        ? { valid: true, errors: [] }
        : { valid: false, errors: r.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`) };
    },
    cleanProps(props: unknown) {
      const out: Record<string, unknown> = {};
      if (!props || typeof props !== 'object') return out;
      for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
        // Own-property check FIRST: a spec prop key that names an Object.prototype
        // member (`constructor`, `toString`, `__proto__`, …) would otherwise
        // resolve the inherited member via `shape[k]` — truthy, not a ZodType — and
        // crash on `.safeParse`. Own-key guard makes those undeclared keys strip
        // cleanly (never crashes, never drops the element — the IACVT contract).
        if (!Object.hasOwn(shape, k)) continue; // unknown prop → stripped
        const field = shape[k];
        out[k] = field.safeParse(v).success ? v : null; // invalid → null (IACVT)
      }
      return out;
    },
  };

  // Measure the full-tier prompt slice; enforce the per-manifest cap. Done AFTER
  // building `compiled` because the slice renderer consumes the entry.
  const chars = renderManifestSliceChars(m.name, manifestToEntry(compiled));
  (compiled as { promptChars: number }).promptChars = chars;
  if (chars > MAX_SLICE_CHARS) {
    throw new ManifestLintError(m.name, [`prompt slice is ${chars} chars (max ${MAX_SLICE_CHARS}); shorten the description/prop docs or drop props`]);
  }

  return compiled;
}

/* ── the wire schema (coarse shape gate for the compose request) ─────────── */

const scalarKindEnum = z.enum(['string', 'text', 'number', 'boolean', 'enum', 'color', 'dimension', 'count', 'icon']);
const propKindEnum = z.enum(['string', 'text', 'number', 'boolean', 'enum', 'color', 'dimension', 'count', 'icon', 'array', 'object']);

const scalarDefSchema = z
  .object({ kind: scalarKindEnum, doc: z.string() })
  .loose();

/** Coarse wire-shape validator for an inbound manifest (`custom_components: []`).
 * The DEEP checks live in `defineFraymeComponent` (the server re-runs it); this
 * just rejects structurally-malformed objects at the route boundary. */
export const manifestSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    useWhen: z.string().optional(),
    props: z.record(z.string(), z.object({ kind: propKindEnum, doc: z.string() }).loose()),
    events: z.array(z.string()),
    eventsDoc: z.record(z.string(), z.string()).optional(),
    example: z.unknown(),
  })
  .loose();

export type ManifestWire = z.infer<typeof manifestSchema>;

// Referenced so the scalar wire schema is retained by tooling that tree-shakes
// (the deep per-field kinds are validated in lint, not here — kept for docs).
void scalarDefSchema;
