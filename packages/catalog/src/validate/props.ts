/**
 * Stage 3b — BUILT-IN component prop gate.
 *
 * THE HOLE THIS CLOSES
 *
 * `fraymeCatalog.validate(spec)` gates the component TYPE enum and the spec
 * structure, but for a 2+-component catalog upstream compiles `props` to
 * `z.record(unknown)` — so no built-in prop value is ever checked. The only
 * prop-shape check in this package was `validateManifestProps`, which resolves
 * components out of the compiled MANIFEST map (BYOC customs); the 188 built-ins
 * are never in that map, so `continue` fires and their props go unchecked.
 * Measured against the published build: `Stack { direction: "column" }`,
 * `{ direction: "sideways" }` and `{ direction: 42 }` all validated clean.
 *
 * That is not cosmetic. cva resolves an unknown variant key to NO class and
 * skips its own `defaultVariants` (a value *was* supplied), so
 * `direction:"column"` fell through to the bare `flex` base — a ROW. One
 * out-of-enum synonym rendered a whole page (PageHeader, seven Cards, a
 * separator, 16 children) as a single unwrapped row. And because the server
 * escalates to the fallback only when validation FAILS, a prop the
 * validator cannot see means the fallback never fires and the broken spec ships
 * as a success.
 *
 * WHY IT IS SCOPED TO ENUM VIOLATIONS
 *
 * Running the raw Zod prop schemas over known-good specs flags almost all of
 * them — an instrument bug, not broken specs. Two exclusions are what make the
 * instrument real:
 *
 *   BINDINGS      `{"$state":…}` / `{"$item":…}` / `{"$cond":…}` /
 *                 `{"$bindState":…}` are legal DYNAMIC values anywhere. The prop
 *                 schemas type the RESOLVED value and cannot model them, so
 *                 every binding reads as a type error. Binding GRAMMAR is
 *                 checked in resolution.ts; the resolved value cannot be known
 *                 at author time.
 *   OMITTED KEYS  the schemas are `.nullable()` but not `.optional()`, so a
 *                 whole-object parse raises an issue for every UNSET prop.
 *                 Absent is not wrong — only a path that resolves to a value
 *                 actually PRESENT and non-null can be a finding.
 *
 * With both applied known-good specs report zero enum violations, and the check
 * fires on exactly the class the authoring gate fires on.
 *
 * WHAT THE SCOPE COVERS
 *
 * Enum-only was the SHIPPABLE first cut, not the finished gate. Live output
 * showed what the remaining blind spots cost: a Scheduler carrying `columns:5`
 * plus four invented props validated clean and collapsed to one column; a
 * PermissionMatrix whose `values` were booleans validated clean and drew 30
 * empty cells; charts with no drawable data validated clean and drew "No data"
 * boxes. Because the server escalates ONLY on a validation failure, every one
 * of them shipped as a success — no retry, no fallback rescue, a blank panel
 * for the user.
 *
 * So the gate now surfaces four prop-shape classes, each still under the two
 * exclusions above:
 *
 *   ENUM        an out-of-options literal                   (the original scope)
 *   TYPE        a PRESENT literal of the wrong type         `wrap: "yes"`
 *   UNKNOWN     a prop name the schema does not declare     `Scheduler.dayLabels`
 *   MISSING     an absent prop the schema REQUIRES          `Stat.value`
 *
 * MISSING is narrow by construction: the catalog's convention is `.nullable()`,
 * so an unset prop is legal almost everywhere — exactly 128 of 2,625 catalog props
 * (4.9%) reject BOTH null and undefined, and only those are
 * required. That test — "the field itself refuses null and undefined" — is asked of
 * the schema at the issue's own path, so it works nested (`columns.0.key`) as well
 * as at the top level.
 *
 * UNKNOWN is top-level-only. The Zod objects are strip-mode, so an unknown key
 * raises NO `unrecognized_keys` issue (that is `z.strictObject`); the check
 * compares the props object's keys against the schema's own shape instead. Nested
 * unknown keys (inside array items) are left alone — the same "measure before you
 * widen" rule that kept TYPE out of the first cut.
 *
 * SCOPE. Only BUILT-IN component names are looked up here. A BYOC manifest can
 * never shadow a built-in (`defineFraymeComponent` rejects a name that collides
 * with `fraymeCatalog.componentNames`), so a type resolved in the built-in map
 * is unambiguously a built-in, and customs keep flowing to
 * `validateManifestProps` untouched.
 */

import { fraymeCatalog } from './jsonRender.js';
import { isDynamicValue } from './dynamic.js';
import { chartDataProps, specStructureIssues } from './structure.js';
import type { ValidationResult } from './types.js';

/** Minimal structural view of a catalog entry's compiled Zod props schema. */
interface PropSchema {
  safeParse(value: unknown): {
    success: boolean;
    error?: {
      issues?: ReadonlyArray<{
        code?: string;
        path?: ReadonlyArray<PropertyKey>;
        message?: string;
      }>;
    };
  };
  /** zod-4 object shape (a map, or a lazy thunk returning one). */
  shape?: Record<string, unknown> | (() => Record<string, unknown>);
  _def?: { type?: string; innerType?: unknown; element?: unknown; options?: readonly unknown[] };
}

/**
 * The built-in component definitions (name → { props: ZodType }). `data` is the
 * same internal handle `componentEvents` and `extendCatalog` already read.
 */
function builtinDefs(): Record<string, { props?: PropSchema } | undefined> {
  return (
    fraymeCatalog as unknown as {
      data: { components: Record<string, { props?: PropSchema } | undefined> };
    }
  ).data.components;
}

/**
 * A json-render DYNAMIC value — `{$state}` / `{$item}` / `{$cond}` /
 * `{$bindState}` / `{$template}` and friends. A non-array object with any
 * `$`-prefixed key. The prop schema types the RESOLVED value, so a binding can
 * never satisfy it and must never be read as a violation.
 */
/** The LITERAL outcomes of a {$cond,$then,$else} ternary — the values the prop will
 *  actually take. Nested ternaries recurse; a branch that is itself a binding is
 *  unknowable and contributes nothing. */
function condBranches(value: unknown): unknown[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const v = value as Record<string, unknown>;
  if (!("$cond" in v)) return [];
  const out: unknown[] = [];
  for (const key of ["$then", "$else"]) {
    const b = v[key];
    if (b === undefined) continue;
    if (isDynamicValue(b)) { out.push(...condBranches(b)); continue; }
    out.push(b);
  }
  return out;
}

/** A shallow clone of `props` with `path` set to `value`, for re-probing the schema. */
function setAt(props: Record<string, unknown>, path: readonly PropertyKey[], value: unknown): Record<string, unknown> {
  if (!path.length) return props;
  const root: Record<string, unknown> = Array.isArray(props) ? ([...(props as unknown[])] as unknown as Record<string, unknown>) : { ...props };
  let node: Record<string, unknown> = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i] as string;
    const cur = node[k];
    if (cur == null || typeof cur !== "object") return props; // shape moved — do not guess
    node[k] = Array.isArray(cur) ? [...(cur as unknown[])] : { ...(cur as Record<string, unknown>) };
    node = node[k] as Record<string, unknown>;
  }
  node[path[path.length - 1] as string] = value;
  return root;
}

/**
 * A json-render DYNAMIC value — `{$state}` / `{$item}` / `{$cond}` /
 * `{$bindState}` / `{$template}` and friends. Defined in `./dynamic.js` because
 * the structural gate needs it too and this module imports THAT one; re-exported
 * here because validate/index.ts advertises it from this module.
 */
export { isDynamicValue };

/** Resolve a Zod issue path against the props object it came from. */
function at(root: unknown, path: readonly PropertyKey[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur == null) return cur;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur;
}

/**
 * Zod v3 emitted `invalid_enum_value`; v4 emits `invalid_value` (for both an
 * out-of-enum string AND a non-string given to an enum, e.g. `direction: 42`).
 * Accept both so the gate survives a zod major.
 */
function isEnumIssue(code: unknown): boolean {
  return code === 'invalid_value' || code === 'invalid_enum_value';
}

/**
 * The issue codes this gate reports for a PRESENT literal.
 *
 * `invalid_type` is the wrong-type class (`wrap:"yes"`, `values:[[true,false]]`).
 * The rest are deliberately NOT here yet — `too_big`/`too_small`/`invalid_format`
 * are bounds/format rules whose real-world impact has not been measured, and
 * `invalid_union` fires on the dimension unions whose value safety already has an
 * owner (the value-channel gate in resolution.ts). Widening means measuring the
 * widening first; that is the rule that kept `invalid_type` out of the first cut,
 * and it applies to the next code just the same.
 */
function isSurfacedIssue(code: unknown): boolean {
  return isEnumIssue(code) || code === 'invalid_type';
}

/* ── schema walking (for UNKNOWN and MISSING) ────────────────────────────── */

/** Unwrap nullable/optional/default/… wrappers to the base zod node. */
function unwrapNode(u: unknown): PropSchema {
  let f = (u ?? {}) as PropSchema;
  for (let i = 0; i < 8 && f._def; i++) {
    const t = f._def.type;
    if (
      t === 'nullable' || t === 'optional' || t === 'default' ||
      t === 'prefault' || t === 'nonoptional' || t === 'readonly' || t === 'catch'
    ) {
      f = (f._def.innerType ?? {}) as PropSchema;
    } else break;
  }
  return f;
}

/** The declared keys of an object schema — `{}` for anything else. */
function shapeKeys(schema: unknown): string[] {
  const raw = unwrapNode(schema).shape;
  if (!raw) return [];
  const shape = typeof raw === 'function' ? raw() : raw;
  return shape && typeof shape === 'object' ? Object.keys(shape) : [];
}

/**
 * Resolve the schema node a Zod issue path points at: object shape by key, array
 * by element, union by the first member that declares the key. Returns undefined
 * when the path cannot be followed — in which case nothing is claimed about it.
 */
function schemaAt(schema: unknown, path: readonly PropertyKey[]): PropSchema | undefined {
  let node: PropSchema | undefined = unwrapNode(schema);
  for (const key of path) {
    if (!node) return undefined;
    if (typeof key === 'number') {
      const elem: unknown = node._def?.element;
      node = elem ? unwrapNode(elem) : undefined;
      continue;
    }
    const raw = node.shape;
    const shape = typeof raw === 'function' ? raw() : raw;
    if (shape && Object.prototype.hasOwnProperty.call(shape, key as string)) {
      node = unwrapNode((shape as Record<string, unknown>)[key as string]);
      continue;
    }
    const options = node._def?.options;
    if (Array.isArray(options)) {
      let found: PropSchema | undefined;
      for (const opt of options) {
        const o = unwrapNode(opt);
        const raw2 = o.shape;
        const sh2 = typeof raw2 === 'function' ? raw2() : raw2;
        if (sh2 && Object.prototype.hasOwnProperty.call(sh2, key as string)) {
          found = unwrapNode((sh2 as Record<string, unknown>)[key as string]);
          break;
        }
      }
      node = found;
      continue;
    }
    return undefined;
  }
  return node;
}

/**
 * Is this field REQUIRED? The catalog's convention is `.nullable()` (not
 * `.optional()`), so "absent is legal" is the norm and every unset prop raises an
 * issue on a whole-object parse. A field is genuinely required only when it
 * refuses BOTH `null` and `undefined` — 128 of 2,625 catalog props (4.9%).
 * Asked of the ORIGINAL (still-wrapped) node, because the
 * wrapper is exactly what makes a field optional.
 */
function isRequiredField(schema: unknown): boolean {
  const node = (schema ?? {}) as PropSchema;
  if (typeof node.safeParse !== 'function') return false;
  return !node.safeParse(null).success && !node.safeParse(undefined).success;
}

/** The still-wrapped node at a path (for the required test). */
function wrappedSchemaAt(schema: unknown, path: readonly PropertyKey[]): unknown {
  if (path.length === 0) return schema;
  const parent = schemaAt(schema, path.slice(0, -1));
  if (!parent) return undefined;
  const key = path[path.length - 1];
  if (typeof key === 'number') return parent._def?.element;
  const raw = parent.shape;
  const shape = typeof raw === 'function' ? raw() : raw;
  if (shape && Object.prototype.hasOwnProperty.call(shape, key as string)) {
    return (shape as Record<string, unknown>)[key as string];
  }
  const options = parent._def?.options;
  if (Array.isArray(options)) {
    for (const opt of options) {
      const o = unwrapNode(opt);
      const raw2 = o.shape;
      const sh2 = typeof raw2 === 'function' ? raw2() : raw2;
      if (sh2 && Object.prototype.hasOwnProperty.call(sh2, key as string)) {
        return (sh2 as Record<string, unknown>)[key as string];
      }
    }
  }
  return undefined;
}

/**
 * Does a Zod issue path pass THROUGH a binding object on its way to its leaf?
 *
 * `{ selections: { $bindState: "/sel" } }` on an array-typed prop reports
 * `selections.$bindState: expected array, received string` — the schema is
 * describing the RESOLVED value, and the path has walked inside a dynamic value.
 * Every wrong-type finding the widened gate first produced on real specs was
 * this shape, and none was a defect.
 * The binding at `selections` is still checked at its own level.
 */
function pathCrossesBinding(props: unknown, path: readonly PropertyKey[]): boolean {
  for (let i = 0; i < path.length; i++) {
    if (isDynamicValue(at(props, path.slice(0, i)))) return true;
  }
  return false;
}

/**
 * Collect PROP-SHAPE violations across a spec's elements — enum, type, unknown
 * name, missing-required. One message per violation, shaped
 * `elements.<id>.props.<path>: …`, phrased for the model that has to fix it.
 *
 * Exported for callers that want the shape findings alone (the structural checks
 * in structure.ts are folded in by `builtinPropIssues`).
 */
export function builtinPropShapeIssues(spec: unknown): string[] {
  const elements =
    spec && typeof spec === 'object'
      ? ((spec as { elements?: Record<string, { type?: string; props?: unknown } | undefined> })
          .elements ?? {})
      : {};
  const defs = builtinDefs();
  const errors: string[] = [];

  for (const [id, el] of Object.entries(elements)) {
    const schema = el?.type ? defs[el.type]?.props : undefined;
    const props = el?.props;
    // Unknown type → the TYPE enum in validateSpec owns it. BYOC custom →
    // validateManifestProps owns it. No props object → nothing to check.
    if (!schema || props == null || typeof props !== 'object') continue;

    // ── UNKNOWN prop names ────────────────────────────────────────────────
    // The Zod objects are strip-mode, so an unknown key raises NO issue at all
    // (`unrecognized_keys` is `z.strictObject`). Compare against the schema's own
    // shape instead. An invented prop is never harmless: it is the model saying
    // "make this scheduler five columns wide" to something that has no such prop,
    // and the renderer silently does nothing.
    const declared = shapeKeys(schema);
    if (declared.length > 0) {
      const known = new Set(declared);
      // The legal names are the useful half of this message (it is fed back to the
      // model on a retry), but DataTable declares 44 — cap the list so one finding
      // cannot dominate the error payload.
      const legal = declared.length > 24 ? `${declared.slice(0, 24).join(', ')}, …` : declared.join(', ');
      for (const key of Object.keys(props as Record<string, unknown>)) {
        if (known.has(key)) continue;
        errors.push(
          `elements.${id}.props.${key}: ${el?.type} has no prop "${key}" — it is dropped before render. Declared props: ${legal}.`,
        );
      }
    }

    const parsed = schema.safeParse(props);
    if (parsed.success) continue;

    for (const issue of parsed.error?.issues ?? []) {
      if (!isSurfacedIssue(issue.code)) continue;
      const path = issue.path ?? [];

      // A path that descends INTO a binding object (`selections.$bindState`)
      // is the binding's own innards, not a prop value: the schema types the
      // RESOLVED value, so `{$bindState:"/sel"}` on an array prop always yields
      // `expected array, received string` at the `.$bindState` sub-path. The
      // binding itself is handled at its own level below; anything under it is
      // the resolution gate's business (binding GRAMMAR), never this one.
      if (pathCrossesBinding(props, path)) continue;

      const value = at(props, path);

      if (value === undefined || value === null) {
        // ── MISSING required ────────────────────────────────────────────────
        // Absent is legal almost everywhere (the schemas are `.nullable()`), so a
        // whole-object parse raises an issue for every unset prop. Only a field
        // that refuses BOTH null and undefined is genuinely required — ask the
        // schema at this exact path, so it holds nested as well as at the top.
        const field = wrappedSchemaAt(schema, path);
        if (field === undefined || !isRequiredField(field)) continue; // omitted, not wrong
        // A chart's data prop has an owner: structure.ts's drawable-data check,
        // which knows the family's ALTERNATIVES (BarChart renders from `series`
        // OR `data`, and the schema marks only `data` non-nullable). Real specs
        // do this, all rendering correctly from `series`.
        if (path.length === 1 && chartDataProps(el?.type ?? '').includes(String(path[0]))) continue;
        const where = path.join('.');
        errors.push(
          `elements.${id}.props.${where}: ${el?.type}.${where} is required and is ${value === null ? 'null' : 'missing'} — ${issue.message ?? 'required'}.`,
        );
        continue;
      }

      if (isDynamicValue(value)) {
        // A BINDING IS NOT AUTOMATICALLY UNCHECKABLE.
        //
        // Skipping every dynamic value made this gate trivially dodgeable:
        // wrapping any bad value in a binding walked straight past it, and
        // `variant: {$bindState:"/v"}` validated clean.
        //
        // A bare {$state}/{$item} genuinely cannot be checked; its value arrives at
        // runtime. But a {$cond} ternary carries its outcomes as LITERALS, and
        // those are exactly the value the prop will take. Check them.
        for (const branch of condBranches(value)) {
          const probe = setAt(props as Record<string, unknown>, path, branch);
          const again = schema.safeParse(probe);
          if (again.success) continue;
          const hit = (again.error?.issues ?? []).some(
            (i) => isSurfacedIssue(i.code) && (i.path ?? []).join('.') === path.join('.'),
          );
          if (!hit) continue;
          const where = path.join('.');
          errors.push(
            `elements.${id}.props.${where}: ${JSON.stringify(branch)} is not a valid ${el?.type}.${where} — a $cond branch resolves to this literal`,
          );
        }
        continue;
      }

      const where = path.join('.');
      errors.push(
        `elements.${id}.props.${where}: ${JSON.stringify(value)} is not a valid ${el?.type}.${where} — ${issue.message ?? 'invalid option'}`,
      );
    }
  }

  return errors;
}

/**
 * Every finding this stage owns: the prop-shape violations above PLUS the
 * structural checks in structure.ts (leaf-with-children, undrawable chart data,
 * dangling state paths).
 *
 * They ride the same entry point because `validateSpec` calls THIS function, and
 * the three structural classes fail for the same reason the prop classes do — the
 * spec validates, the server never retries, and the user gets a blank. (A cleaner
 * home is a stage of its own in ops.ts with its own `FailureCategory`.)
 */
export function builtinPropIssues(spec: unknown): string[] {
  return [...builtinPropShapeIssues(spec), ...specStructureIssues(spec)];
}

/**
 * Validate the PROPS of every BUILT-IN-typed element against its catalog schema
 * (enum, type, unknown-name, missing-required — see the header) plus the
 * structural checks in structure.ts. Custom/unknown types are
 * skipped: `validateManifestProps` and the catalog TYPE enum own those.
 *
 * Runs inside `validateSpec` by default; exported so callers can run it against
 * a spec they already hold.
 */
export function validateBuiltinProps(spec: unknown): ValidationResult {
  const errors = builtinPropIssues(spec);
  return { valid: errors.length === 0, errors, warnings: [] };
}

/** The strict gate's own helpers, shared with the lenient walk (validate/lenient.ts)
 *  so the two can never disagree about a schema. Not part of the public surface. */
export const _propGateInternals = {
  builtinDefs,
  condBranches,
  setAt,
  at,
  isSurfacedIssue,
  isEnumIssue,
  unwrapNode,
  shapeKeys,
  wrappedSchemaAt,
  isRequiredField,
  pathCrossesBinding,
};
