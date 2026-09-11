import { resolveAlias } from '../components/_shared.js';
import { _propGateInternals as G, isDynamicValue } from './props.js';

/**
 * LENIENT MODE — the serve-side policy on the SAME schemas the
 * strict gate reads. The runtime already drops an unknown prop, renders a default
 * for an out-of-enum word and prints a number as a label; strict validation
 * rejects all three. This walk closes that gap mechanically, from the schema,
 * before the strict pipeline runs, and reports every change so callers can act
 * on it. It never touches a value that is not presentation: nothing
 * here writes a fact.
 *
 *   • unknown prop            → dropped
 *   • enum miss (incl. inside a nested $cond chain's leaves) → alias, else dropped
 *   • number where a string is required → String(n); numeric string → Number(s)
 *   • "true"/"false" where a boolean is required → boolean
 *   • required prop set to null → dropped (the component's default)
 *   • an input inside a labelled FormField → inherits the label
 *
 * Strict mode is untouched: it stays the authoring gate.
 */
export interface LenientResult {
  /** A deep copy with the normalisations applied. */
  spec: unknown;
  /** One line per change, `elements.<id>.props.<path>: <what>`. */
  normalizations: string[];
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Keys json-render reads on the ELEMENT, not inside `props`. */
const ENVELOPE_KEYS = new Set(['on', 'events', 'visible', 'watch', 'repeat', 'children']);

function enumOptions(field: unknown): string[] | null {
  const f = G.unwrapNode(field) as { options?: unknown; _def?: { entries?: Rec; type?: string } };
  if (Array.isArray(f.options)) return f.options.map(String);
  if (f._def?.type === 'enum' && f._def.entries) return Object.values(f._def.entries).map(String);
  return null;
}

function expectedType(field: unknown): string | undefined {
  const f = G.unwrapNode(field) as { _def?: { type?: string } };
  return f._def?.type;
}

function deleteAt(root: unknown, path: readonly PropertyKey[]): boolean {
  const parent = G.at(root, path.slice(0, -1));
  const last = path[path.length - 1];
  if (Array.isArray(parent) && typeof last === 'number') { parent.splice(last, 1); return true; }
  if (isRec(parent) && String(last) in parent) { delete parent[String(last)]; return true; }
  return false;
}

function assignAt(root: unknown, path: readonly PropertyKey[], value: unknown): boolean {
  const parent = G.at(root, path.slice(0, -1));
  if (parent == null || typeof parent !== 'object') return false;
  (parent as Rec)[String(path[path.length - 1])] = value;
  return true;
}

/** Alias / null every literal string leaf of a nested $cond chain the enum rejects. */
function fixCondLeaves(node: unknown, allowed: readonly string[], where: string, notes: string[]): number {
  if (!isRec(node) || !('$cond' in node)) return 0;
  let n = 0;
  for (const branch of ['$then', '$else'] as const) {
    const v = node[branch];
    if (typeof v === 'string') {
      const r = resolveAlias(v, allowed);
      if (r !== v) {
        node[branch] = r;
        notes.push(`${where}.${branch}: ${JSON.stringify(v)} → ${r === null ? 'null (default)' : JSON.stringify(r)} — not one of ${allowed.join('|')}`);
        n++;
      }
    } else if (isRec(v)) n += fixCondLeaves(v, allowed, `${where}.${branch}`, notes);
  }
  return n;
}

export function lenientNormalize(input: unknown): LenientResult {
  const notes: string[] = [];
  if (!input || typeof input !== 'object') return { spec: input, normalizations: notes };
  // JSON clone: a spec is JSON by contract, and the package's TS lib predates structuredClone.
  const spec = JSON.parse(JSON.stringify(input)) as { elements?: Record<string, Rec | undefined> };
  const elements = spec.elements ?? {};
  const defs = G.builtinDefs();

  for (const [id, el] of Object.entries(elements)) {
    const type = el?.type;
    const schema = typeof type === 'string' ? defs[type]?.props : undefined;
    const props = el?.props;
    if (!schema || !isRec(props)) continue;
    const at = (p: readonly PropertyKey[]) => `elements.${id}.props.${p.join('.')}`;

    // 1. unknown props. An ELEMENT-ENVELOPE key written inside props (`on`,
    //    `visible`, `repeat`, …) is lifted to the element, never dropped — dropping
    //    `on` silently loses an action binding (a Switch's `on` was dropped this way).
    const declared = G.shapeKeys(schema);
    if (declared.length > 0) {
      const known = new Set(declared);
      for (const key of Object.keys(props)) {
        if (known.has(key)) continue;
        if (ENVELOPE_KEYS.has(key)) {
          if ((el as Rec)[key] === undefined) {
            (el as Rec)[key] = props[key];
            notes.push(`${at([key])}: lifted "${key}" out of props to the element`);
          } else {
            notes.push(`${at([key])}: dropped — the element already carries "${key}"`);
          }
          delete props[key];
          continue;
        }
        delete props[key];
        notes.push(`${at([key])}: dropped — ${type} has no prop "${key}"`);
      }
    }

    // 2. a labelled FormField's child inherits the label it lacks
    if (!('label' in props) && declared.includes('label')) {
      const ff = Object.values(elements).find(
        (e) => e?.type === 'FormField' && Array.isArray(e.children) && (e.children as unknown[]).includes(id),
      );
      const label = ff && isRec(ff.props) ? ff.props.label : undefined;
      const field = G.wrappedSchemaAt(schema, ['label']);
      if (typeof label === 'string' && label && field && G.isRequiredField(field)) {
        props.label = label;
        notes.push(`${at(['label'])}: copied "${label}" from the enclosing FormField`);
      }
    }

    // 2b. a bound control missing its required `name` takes it from its own
    //     {$bindState:"/path"} — the pointer already names the field it writes
    if (!('name' in props) && declared.includes('name')) {
      const bind = isRec(props.value) ? props.value.$bindState : undefined;
      const field = G.wrappedSchemaAt(schema, ['name']);
      if (typeof bind === 'string' && /^\/[A-Za-z0-9_-]+$/.test(bind) && field && G.isRequiredField(field)) {
        props.name = bind.slice(1);
        notes.push(`${at(['name'])}: backfilled "${bind.slice(1)}" from its $bindState path`);
      }
    }

    // 3. value issues, up to three rounds (a fix can expose the next)
    for (let round = 0; round < 3; round++) {
      const parsed = (schema as { safeParse: (v: unknown) => { success: boolean; error?: { issues?: { code?: string; path?: PropertyKey[]; expected?: string }[] } } }).safeParse(props);
      if (parsed.success) break;
      let changed = 0;
      for (const issue of parsed.error?.issues ?? []) {
        if (!G.isSurfacedIssue(issue.code)) continue;
        const path = issue.path ?? [];
        if (path.length === 0 || G.pathCrossesBinding(props, path)) continue;
        const value = G.at(props, path);
        const field = G.wrappedSchemaAt(schema, path);
        if (field === undefined) continue;

        if (value === null) {
          // Only an OBJECT key may be dropped. A null INSIDE an array is left
          // for strict to judge: splicing it shifts every later value one slot
          // (a Table cell under the wrong header, a chart point against the
          // wrong x-label) — a wrong fact manufactured from a missing one.
          const parent = G.at(props, path.slice(0, -1));
          if (Array.isArray(parent)) continue;
          if (G.isRequiredField(field) && deleteAt(props, path)) { notes.push(`${at(path)}: dropped null (required)`); changed++; }
          continue;
        }
        if (value === undefined) continue; // missing → strict decides

        if (isDynamicValue(value)) {
          const allowed = enumOptions(field);
          if (allowed && fixCondLeaves(value, allowed, at(path), notes) > 0) changed++;
          continue;
        }

        const allowed = enumOptions(field);
        if (allowed && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
          const r = resolveAlias(String(value), allowed);
          if (r === null) { if (deleteAt(props, path)) { notes.push(`${at(path)}: dropped ${JSON.stringify(value)} — not one of ${allowed.join('|')}`); changed++; } }
          else if (assignAt(props, path, r)) { notes.push(`${at(path)}: ${JSON.stringify(value)} → ${JSON.stringify(r)} (alias)`); changed++; }
          continue;
        }
        if (allowed && isRec(value) && typeof value.value === 'string' && allowed.includes(value.value)) {
          assignAt(props, path, value.value); notes.push(`${at(path)}: unwrapped {value:${JSON.stringify(value.value)}} to the bare enum member`); changed++; continue;
        }

        const want = expectedType(field);
        if (want === 'string' && typeof value === 'number') { assignAt(props, path, String(value)); notes.push(`${at(path)}: ${value} → "${value}" (number coerced to string)`); changed++; continue; }
        // Only a plain decimal literal becomes a number: Number() would also
        // parse "0x1f", "1e3" and padded strings into figures the request
        // never wrote.
        if (want === 'number' && typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) { assignAt(props, path, Number(value.trim())); notes.push(`${at(path)}: "${value}" → ${Number(value.trim())} (string coerced to number)`); changed++; continue; }
        if (want === 'boolean' && (value === 'true' || value === 'false')) { assignAt(props, path, value === 'true'); notes.push(`${at(path)}: "${value}" → ${value} (string coerced to boolean)`); changed++; continue; }
        // A boolean where TEXT is required is never coerced: "true" as visible
        // copy is a word the request did not contain. Strict decides.
      }
      if (changed === 0) break;
    }
  }
  return { spec, normalizations: notes };
}
