// Per-component PROP grammar, compiled from the catalog's own Zod schemas.
//
// LIVES IN THE SDK ON PURPOSE. Every consumer that emits this grammar must emit a
// BYTE-IDENTICAL one — a parity test enforces it, because guided decoding must measure
// exactly what production serves. Two copies of a 1,400-rule generator would drift
// within a week, and the schemas it reads already live here.
//
// WHY. buildOpGrammar constrains the component NAME (`compname`) but leaves `props` as a
// bare `object`, so the decoder can still emit any key with any value. Most semantic
// failures under it were a prop value outside its enum or a top-level field written
// inside `props`. Both are shapes the catalog already describes precisely — the grammar
// simply was not using them.
//
//     Card.radius = "12px"                     expected none|sm|md|lg|full
//     Text.size = "2xl"                        expected xs|sm|md|lg|xl
//     Avatar.ring = true                       expected none|default|success|…
//     FloorPlan.regions[].status = "booked"    expected available|sold|held|disabled
//
// Every one is a plausible guess against a closed set. Constrained decoding makes them
// unsamplable rather than merely unlikely — the same treatment invented component names
// already get.
//
// NESTING IS THE MAJORITY, so this compiles the whole prop tree rather than the top
// level: most enum failures were inside an array of objects (`regions[].status`,
// `nodes[].status`). A top-level-only pass would have missed them.
//
// UNKNOWN KEYS ARE REJECTED, deliberately. That is what fixes the structural failures
// ("watch" written inside `props` when it is a top-level element field), and it matches
// what the catalog validator already enforces — the grammar is simply saying the same
// thing earlier, where it costs nothing.
//
// LIMIT: a component whose props schema is not a plain object falls back to the generic
// `value`, so nothing is over-constrained by guesswork.

const RESERVED = new Set(['root', 'op', 'value', 'object', 'member', 'array', 'string', 'char', 'hex', 'number', 'ws']);

/** Unwrap the zod wrappers that carry no shape of their own. */
function core(node: any): any {
  let d = node?.def ?? node;
  let guard = 0;
  while (d && ['nullable', 'optional', 'default', 'catch', 'readonly', 'pipe'].includes(d.type) && guard++ < 8) {
    d = d.innerType?.def ?? d.innerType ?? d.in?.def ?? d.in;
  }
  return d;
}

const ident = (s: string) => s.replace(/[^A-Za-z0-9]/g, '_');
const lit = (s: string) => `"\\"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}\\""`;

/**
 * Compile one schema node to a rule body, appending any helper rules it needs.
 * Returns the rule NAME to reference.
 */
function compile(node: any, name: string, out: Map<string, string>, depth: number): string {
  const d = core(node);
  if (!d || depth > 5) return 'value';

  if (d.type === 'enum') {
    const vals = Object.values(d.entries ?? d.values ?? {}).filter((v) => typeof v === 'string');
    if (!vals.length) return 'value';
    /* A nullable enum must still admit null, or a legitimate "unset" becomes unsamplable. */
    out.set(name, vals.map(lit).join(' | ') + ' | "null"');
    return name;
  }

  if (d.type === 'object' && d.shape && Object.keys(d.shape).length) {
    const members = [];
    for (const [key, child] of Object.entries(d.shape)) {
      const childName = `${name}_${ident(key)}`;
      const ref = compile(child, childName, out, depth + 1);
      members.push(`${lit(key)} ws ":" ws ${ref}`);
    }
    const mName = `${name}_m`;
    out.set(mName, members.join(' | '));
    out.set(name, `"{" ws (${mName} (ws "," ws ${mName})*)? ws "}"`);
    return name;
  }

  if (d.type === 'array') {
    const el = d.element ?? d.def?.element;
    const itemName = `${name}_i`;
    const ref = compile(el, itemName, out, depth + 1);
    if (ref === 'value') return 'value';
    out.set(name, `"[" ws (${ref} (ws "," ws ${ref})*)? ws "]"`);
    return name;
  }

  return 'value';
}

/**
 * Build `{ alternatives, rules }` for the constrained element-creation op.
 * `alternatives` is one production per component; `rules` are the helpers.
 */
export function buildPropsGrammar(catalog: any): { alternatives: string[]; rules: Map<string, string> } {
  const comps = catalog?.data?.components ?? {};
  const out = new Map<string, string>();
  const alts: string[] = [];

  /* `Object.entries` without an explicit type argument infers the value as `{}` here —
     `comps` comes off an `any` catalog through a `?? {}` — so `entry.props` failed to
     type-check while every call site passed a real component entry. Annotate the value
     rather than widen `entry` at the use site, so a genuine shape error still surfaces. */
  for (const [cname, entry] of Object.entries<any>(comps)) {
    const id = ident(cname);
    if (RESERVED.has(id)) continue;
    const propsName = `p_${id}`;
    const ref = compile(entry?.props, propsName, out, 0);
    /* A component whose props are not a describable object keeps the generic object —
       constraining on a guess would be worse than not constraining at all. */
    const propsRule = ref === 'value' ? 'object' : ref;
    alts.push(`"{" ws "\\"type\\"" ws ":" ws ${lit(cname)} ws "," ws "\\"props\\"" ws ":" ws ${propsRule} (ws "," ws member)* ws "}"`);
  }

  return { alternatives: alts, rules: out };
}

/**
 * The same schema walk, returned as a LOOKUP instead of a grammar.
 *
 * Constrained decoding makes an out-of-enum value unsamplable, but it costs latency on
 * every request — a full prop grammar is hundreds of KB. A repair costs nothing and
 * fixes the same class after the fact, so both are worth having
 * and the choice between them is a latency decision rather than a capability one.
 *
 * Shape mirrors the props tree so a caller can walk spec and schema together:
 *   { Card: { radius: ["none","sm","md","lg","full"] },
 *     FloorPlan: { regions: { __items: { status: [...], kind: [...] } } } }
 */
export type EnumNode = { [key: string]: string[] | EnumNode };

export function componentPropEnums(catalog: any): Record<string, EnumNode> {
  const comps = catalog?.data?.components ?? {};
  const out: Record<string, EnumNode> = {};

  const walk = (node: any, depth: number): EnumNode | string[] | null => {
    const d = core(node);
    if (!d || depth > 5) return null;
    if (d.type === 'enum') {
      const vals = Object.values(d.entries ?? d.values ?? {}).filter((v): v is string => typeof v === 'string');
      return vals.length ? vals : null;
    }
    if (d.type === 'object' && d.shape) {
      const sub: EnumNode = {};
      for (const [k, child] of Object.entries(d.shape)) {
        const r = walk(child, depth + 1);
        if (r) sub[k] = r as string[] | EnumNode;
      }
      return Object.keys(sub).length ? sub : null;
    }
    if (d.type === 'array') {
      const r = walk(d.element ?? d.def?.element, depth + 1);
      return r ? ({ __items: r } as EnumNode) : null;
    }
    return null;
  };

  for (const [name, entry] of Object.entries(comps)) {
    const r = walk((entry as any)?.props, 0);
    if (r && !Array.isArray(r)) out[name] = r as EnumNode;
  }
  return out;
}
