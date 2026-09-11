/**
 * Stage 4 — render-resolution gate.
 *
 * The catalog validator (`fraymeCatalog.validate`) checks only `type` + `props`
 * and the json-render referential check covers root/children — but the element
 * *envelope* is passthrough, so a malformed `visible` / `$cond` / `$template` /
 * `watch` / `repeat` / `on` shape, an invented element field (`if`), or a bad
 * `spec.actions[name].kind` all pass and only break at render — a dead construct
 * inside a spec that still reads as "valid".
 *
 * This gate closes that hole. It validates the binding/visibility grammar the
 * renderer actually implements — using `@json-render/core`'s own
 * `VisibilityConditionSchema` for `visible`/`$cond` conditions, plus structural
 * checks for the rest. Shape-checking (not full resolution) is deliberate: a
 * valid spec that references a state path not present at author-time resolves to
 * `undefined` without throwing, so resolution alone can't tell valid from
 * invalid — the *shape* is the discriminator.
 *
 * Opt-in: the serving path stays lenient (fallback generation + the runtime
 * Fallback already protect users); authoring pipelines enable it so no spec
 * carrying a dead construct is accepted.
 */

import { safeColor } from './color.js';
import { safeDimension } from './dimension.js';
import { getByPath, VisibilityConditionSchema } from './jsonRender.js';
import type { FailureCategory } from './ops.js';

/** Element-level fields json-render recognises (siblings of type/props/children). */
const ALLOWED_ELEMENT_KEYS = new Set([
  'type',
  'props',
  'children',
  'visible',
  'watch',
  'repeat',
  'on',
  'className',
]);

/** Valid `spec.actions[name].kind` values (the server-side handler kinds). */
const ACTION_KINDS = new Set(['recompose', 'agent', 'host', 'false']);

/** Built-in renderer actions that need no declaration / handler. */
export const BUILTIN_ACTIONS = new Set(['setState', 'pushState', 'removeState']);

/**
 * Resource-abuse / render-bomb caps. A model can over-generate — huge
 * element maps, deeply nested or CYCLIC children (infinite render), or megabyte
 * strings. These bound the spec before it reaches a renderer.
 */
const LIMITS = {
  elements: 600,
  childrenPerElement: 250,
  depth: 40,
  stringLength: 50_000,
} as const;

/** Longest string anywhere in a prop value tree (caps megabyte payloads). */
function longestString(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.reduce<number>((m, v) => Math.max(m, longestString(v)), 0);
  if (value && typeof value === 'object') {
    let m = 0;
    for (const v of Object.values(value)) m = Math.max(m, longestString(v));
    return m;
  }
  return 0;
}

/** Element count, per-element children, prop string length, and depth + cycle from root. */
function checkResourceLimits(
  s: { root?: unknown; elements?: Record<string, unknown> },
  errors: string[],
): void {
  const elements = s.elements ?? {};
  const ids = Object.keys(elements);
  if (ids.length > LIMITS.elements) {
    errors.push(`too many elements (${ids.length} > ${LIMITS.elements})`);
    return; // don't walk a pathological map
  }
  for (const [id, raw] of Object.entries(elements)) {
    if (!raw || typeof raw !== 'object') continue;
    const el = raw as { children?: unknown; props?: unknown };
    if (Array.isArray(el.children) && el.children.length > LIMITS.childrenPerElement) {
      errors.push(`elements.${id}: too many children (${el.children.length} > ${LIMITS.childrenPerElement})`);
    }
    const maxStr = longestString(el.props);
    if (maxStr > LIMITS.stringLength) {
      errors.push(`elements.${id}: prop string too long (${maxStr} > ${LIMITS.stringLength})`);
    }
  }
  // Depth + cycle: MEMOIZED longest-path DFS from root. `longest` caches each
  // node's longest downward path in edges — valid to reuse once a subtree is
  // known acyclic, so a legal shared-children DAG is walked O(V+E) instead of
  // exponentially. `inStack` is the current ancestor path, so a node
  // re-encountered while still on the stack is a cycle (would render infinitely).
  // Element count is capped above, so the recursion is bounded and can't
  // overflow the stack.
  const root = typeof s.root === 'string' ? s.root : undefined;
  if (!root) return;
  const longest = new Map<string, number>();
  const inStack = new Set<string>();
  let cyclic = false;
  const longestPath = (id: string): number => {
    if (cyclic) return 0;
    if (inStack.has(id)) {
      errors.push(`elements.${id}: cycle in the children graph (would render infinitely)`);
      cyclic = true;
      return 0;
    }
    const cached = longest.get(id);
    if (cached !== undefined) return cached; // acyclic DAG node — already measured
    inStack.add(id);
    const el = elements[id] as { children?: unknown } | undefined;
    const children = Array.isArray(el?.children) ? (el.children as unknown[]) : [];
    let deepest = 0;
    let hasChild = false;
    for (const c of children) {
      if (cyclic) break;
      if (typeof c === 'string' && elements[c]) {
        hasChild = true;
        deepest = Math.max(deepest, longestPath(c));
      }
    }
    inStack.delete(id);
    const edges = hasChild ? deepest + 1 : 0;
    longest.set(id, edges);
    return edges;
  };
  const maxDepth = longestPath(root);
  if (!cyclic && maxDepth > LIMITS.depth) {
    errors.push(`nesting too deep (> ${LIMITS.depth})`);
  }
}

export interface ResolutionResult {
  valid: boolean;
  errors: string[];
  failureCategory?: FailureCategory;
}

/** First Zod issue, compacted for an error message. */
function firstIssue(parsed: { success: false; error: { issues?: Array<{ message: string }> } }): string {
  return parsed.error.issues?.[0]?.message ?? 'invalid shape';
}

/**
 * The ONLY `$`-keys json-render resolves at render time (core `resolvePropValue`
 * + the `$cond` ternary's own siblings). Anything else in a binding object is a
 * dead token: it never resolves, so the prop renders empty while the spec still
 * "validates". Keep this in lockstep with @json-render/core.
 */
const BINDING_TOKENS = new Set([
  '$state',
  '$bindState',
  '$item',
  '$bindItem',
  '$index',
  '$cond',
  '$then',
  '$else',
  '$template',
  '$computed',
]);

/**
 * `$computed` — the registered-function vocabulary, and the arg shapes each one
 * accepts.
 *
 * WHY THIS LIVES IN THE CATALOG. `$computed` calls a HOST-REGISTERED function;
 * an unregistered name makes @json-render/core warn and return `undefined`, and
 * a component then renders that undefined — measured on a live SSR probe,
 * `Gauge` printed a confident "0" and `ProgressCircle` "0%" for a function
 * nobody had registered, and this validator passed the spec. A function name is
 * therefore part of the SPEC VOCABULARY exactly like a component name or an
 * event verb, and the catalog is where the vocabulary lives.
 *
 * DEPENDENCY DIRECTION. The implementations live in `@frayme/runtime`
 * (`react/functions.ts`), which already depends on `@frayme/catalog`; the
 * catalog must not import the runtime back or the two packages cycle. So this
 * is a deliberate MIRROR of the runtime registry, not an import. Both sides are
 * pinned to the same explicit literal by tests (catalog: resolution.test.ts,
 * runtime: computed-functions.test.tsx), so a change to either turns the other
 * red. A host that registers EXTRA functions passes their names via
 * `validateResolution(spec, { computedFunctions })`.
 *
 * THE SET IS FROZEN once the model trains on it — add only, never rename or
 * remove. See `@frayme/runtime`'s functions.ts for why these six.
 */
const COMPUTED_SIGNATURES: Record<
  string,
  ReadonlyArray<{ required: readonly string[]; optional?: readonly string[] }>
> = {
  // aggregate a column, an explicit list, or two scalars
  sum: [{ required: ['over'], optional: ['field'] }, { required: ['values'] }, { required: ['a', 'b'] }],
  product: [{ required: ['over'], optional: ['field'] }, { required: ['values'] }, { required: ['a', 'b'] }],
  mean: [{ required: ['over'], optional: ['field'] }, { required: ['values'] }, { required: ['a', 'b'] }],
  // ordered binary operands
  subtract: [{ required: ['a', 'b'] }],
  divide: [{ required: ['a', 'b'] }],
  // named operands: `a`/`b` would let a reversed pair render a wrong number with
  // full confidence, and a wrong number is the one defect a reader cannot catch.
  percentChange: [{ required: ['from', 'to'] }],
};

/** The registered `$computed` names — the frozen vocabulary. */
export const COMPUTED_FUNCTIONS: ReadonlySet<string> = new Set(Object.keys(COMPUTED_SIGNATURES));

/** Human-readable accepted shapes, for the error message. */
function signatureHelp(name: string): string {
  const sigs = COMPUTED_SIGNATURES[name];
  if (!sigs) return '';
  return sigs
    .map((sig) => `{ ${[...sig.required, ...(sig.optional ?? []).map((o) => `${o}?`)].join(', ')} }`)
    .join(' or ');
}

/**
 * How much of the binding grammar one walk enforces.
 *
 *  - `all`      — every construct. This is the opt-in resolution gate
 *                 (`validateResolution`, `validateSpec({resolution:true})`).
 *  - `computed` — ONLY `$computed` node defects. Every other token is still
 *                 WALKED THROUGH (so a `$computed` nested inside a `$cond`
 *                 branch or another function's args is still reached) but never
 *                 reported. This is the subset that runs by DEFAULT on the
 *                 serving path — see `validateComputed` for why the split
 *                 exists and what it costs.
 *
 * The two modes share one walker on purpose: a second copy of the traversal is
 * a second place for the default path to silently stop covering something.
 */
type WalkMode = 'all' | 'computed';

/**
 * Validate one `{ $computed, args }` node. Four holes this closes, each measured
 * as PASSING before it existed: a `$computed` whose name is a NUMBER, an
 * unregistered function name, a `$computed` with no `args` at all (it can only
 * ever resolve to undefined), and `args` never being walked — so a malformed
 * `$cond` nested inside them validated clean.
 */
function checkComputed(
  where: string,
  v: Record<string, unknown>,
  errors: string[],
  allowed: ReadonlySet<string>,
  mode: WalkMode = 'all',
): void {
  const name = v.$computed;
  if (typeof name !== 'string' || name === '') {
    errors.push(
      `${where}.$computed: function name must be a non-empty string — got ${JSON.stringify(name)}`,
    );
    return;
  }
  for (const k of Object.keys(v)) {
    if (k !== '$computed' && k !== 'args') {
      errors.push(`${where}.${k}: not part of a $computed node (only "$computed" and "args")`);
    }
  }
  if (!allowed.has(name)) {
    errors.push(
      `${where}.$computed: "${name}" is not a registered function — nothing resolves it, so the prop renders empty (registered: ${[...allowed].sort().join(', ')})`,
    );
    return;
  }

  const args = v.args;
  if (args === undefined) {
    errors.push(
      `${where}: $computed "${name}" has no args — every registered function needs operands, so this can only ever resolve to undefined. Expected ${signatureHelp(name) || 'args'}.`,
    );
    return;
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    errors.push(`${where}.args: must be an object keyed by argument name — got ${JSON.stringify(args)}`);
    return;
  }

  const keys = Object.keys(args as Record<string, unknown>);
  const sigs = COMPUTED_SIGNATURES[name];
  // A host-registered extra (passed via opts) has no signature here — the name
  // check is all we can honestly do, so stop rather than guess its arity.
  if (sigs) {
    const ok = sigs.some((sig) => {
      const allowedKeys = new Set<string>([...sig.required, ...(sig.optional ?? [])]);
      return sig.required.every((r) => keys.includes(r)) && keys.every((k) => allowedKeys.has(k));
    });
    if (!ok) {
      errors.push(
        `${where}.args: {${keys.join(', ')}} is not a shape "${name}" accepts — it would resolve to undefined. Expected ${signatureHelp(name)}.`,
      );
    }
  }

  // Args are EXPRESSIONS (`{ $state: "/qty" }`, or a nested `$computed`), so they
  // get the same grammar check as any other bound value. Nothing walked them before.
  // The mode rides along: in `computed` mode this recursion exists to reach a
  // NESTED `$computed` (percent-of-total is `product(divide(a,b),100)`), not to
  // report the rest of the grammar.
  for (const [k, arg] of Object.entries(args as Record<string, unknown>)) {
    walkBindings(`${where}.args.${k}`, arg, errors, allowed, mode);
  }
}

/** A "binding object" is a plain object carrying at least one `$`-prefixed key. */
function isBindingObject(v: unknown): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v as object).some((k) => k.startsWith('$'))
  );
}

/**
 * Walk a prop/param value tree and validate every binding object encountered.
 * Recurses through plain objects + arrays; treats a `$`-keyed object as a leaf
 * binding to validate (does not recurse into its `$state`/`$template` string).
 */
function walkBindings(
  where: string,
  value: unknown,
  errors: string[],
  allowed: ReadonlySet<string> = COMPUTED_FUNCTIONS,
  mode: WalkMode = 'all',
): void {
  if (Array.isArray(value)) {
    for (const item of value) walkBindings(where, item, errors, allowed, mode);
    return;
  }
  if (!value || typeof value !== 'object') return;

  if (isBindingObject(value)) {
    const v = value as Record<string, unknown>;

    // Unknown-token guard. json-render resolves ONLY the tokens in
    // BINDING_TOKENS (core's resolvePropValue). Any other `$`-key silently fails
    // to resolve at render time — the prop just renders empty — so the spec
    // "validates" while the UI is dead. Two real cases this catches:
    //   {"${item}":"headline"}  — the ${…} template form mistaken for a binding
    //   {"$event":"value"}      — never resolved by core OR @frayme/runtime, and
    //                             mergeIntrinsicParams lets it CLOBBER the
    //                             renderer's real intrinsic payload for that key.
    // Screened once, before the per-token branches below.
    const unknownTokens = Object.keys(v).filter(
      (k) => k.startsWith('$') && !BINDING_TOKENS.has(k),
    );
    if (unknownTokens.length > 0) {
      if (mode === 'all') {
        errors.push(
          `${where}: unknown binding token(s) ${unknownTokens.join(', ')} — nothing resolves these at render time (valid: ${[...BINDING_TOKENS].join(', ')})`,
        );
        return;
      }
      // `computed` mode: a dead token is a REAL defect but not a $computed one,
      // so it is not reported here — and we deliberately do NOT return, because
      // the same object may still carry a `$computed` to check ({$nope, $computed}).
    }

    // $cond — must be the ternary { $cond, $then, $else }; the condition itself
    // must satisfy core's VisibilityConditionSchema. (There is NO operator-array
    // form like { "!==": [...] }.)
    if ('$cond' in v) {
      if (mode === 'all') {
        if (!('$then' in v) || !('$else' in v)) {
          errors.push(`${where}: $cond must be a ternary with both $then and $else`);
        }
        const cond = VisibilityConditionSchema.safeParse(v.$cond);
        if (!cond.success) {
          errors.push(`${where}.$cond: malformed condition (${firstIssue(cond)})`);
        }
      }
      // $then/$else may themselves be bindings — validate them too. Walked in
      // BOTH modes: `{$cond, $then:{$computed}, $else:0}` is where a computed
      // total most often hides.
      walkBindings(`${where}.$then`, v.$then, errors, allowed, mode);
      walkBindings(`${where}.$else`, v.$else, errors, allowed, mode);
      return;
    }

    // $template — interpolation tokens are ${...}. A bare {/path} (no $) renders
    // literally — the classic mistake — so reject it.
    if ('$template' in v) {
      if (mode !== 'all') return; // a template carries no nested expression to reach
      if (typeof v.$template !== 'string') {
        errors.push(`${where}.$template: must be a string`);
      } else if (/(^|[^$])\{\//.test(v.$template)) {
        errors.push(
          `${where}.$template: bare "{/...}" found — interpolation must use "\${/path}" (dollar-brace)`,
        );
      }
      return;
    }

    // $computed — a registered function name + an arg shape it accepts. Until
    // this branch existed a $computed object fell straight through to the leaf
    // return below: any name, any args, all valid.
    if ('$computed' in v) {
      checkComputed(where, v, errors, allowed, mode);
      return;
    }

    // $state / $bindState / $bindItem — path must be a string.
    if (mode === 'all') {
      for (const key of ['$state', '$bindState', '$bindItem'] as const) {
        if (key in v && typeof v[key] !== 'string') {
          errors.push(`${where}.${key}: path must be a string`);
        }
      }
    }
    return; // binding objects are leaves
  }

  // plain object — recurse into its values
  for (const [k, child] of Object.entries(value as Record<string, unknown>)) {
    walkBindings(`${where}.${k}`, child, errors, allowed, mode);
  }
}

/**
 * Value-channel keys (the canonical `safeColor` / `safeDimension` prop names).
 * These props carry real CSS *values*, so the gate proves each is safe — an
 * unsafe value is a hard authoring failure even if a schema edit later forgets
 * a `.refine`. Enum-token props (`gap`, `padding`, `aspect`, `variant`,
 * `maxWidth`, …) and numeric form bounds (`min`, `max`, `step`) are
 * intentionally NOT here — they are not value channels. (`maxWidth` is a Card
 * ENUM `sm·md·lg·full`, NOT a dimension — keeping it here would mis-flag
 * `maxWidth:'md'` as an unsafe dimension. Only `minWidth`/`minHeight`/
 * `maxHeight` are real dimension props.)
 */
const COLOR_KEYS = new Set([
  'color', 'bg', 'borderColor', 'accent', 'accentText', 'gradientFrom', 'gradientTo',
  'overlayColor', 'trackColor', 'offColor', 'cardBg', 'triggerColor', 'headerColor',
  'dotColor', 'ringColor', 'activeColor', 'activeText',
  // secondary text · chart grid/axis/scale · resting-state/connector colour channels
  'mutedColor', 'gridColor', 'axisColor', 'labelColor', 'scaleColor',
  'upColor', 'downColor', 'separatorColor', 'lineColor', 'connectorColor',
  // DropdownMenu panel fill · Kanban board→column→card on-surface text cascade ·
  // Heatmap in-cell value text
  'menuBg', 'cardColor', 'valueColor',
  // Stat sparkline stroke · FeatureCard icon-chip fill · BoardColumn track
  'sparklineColor', 'iconBg', 'columnBg',
]);
const COUNT_KEYS = new Set(['columns', 'rows', 'siblingCount', 'clamp', 'lines']);
/**
 * Layout size-ENUM tokens. A few components reuse a DIM_KEY *name* as a t-shirt-size
 * enum rather than a CSS length — e.g. `Conversation.maxHeight` is `sm·md·lg·full`.
 * These legal enum values are not dimensions, so `safeDimension` correctly rejects
 * them, but flagging them would mis-fail a schema-legal spec. A real dimension value
 * is never a bare token from this set, so skipping them is safe.
 */
const SIZE_ENUM_TOKENS = new Set(['xs', 'sm', 'md', 'lg', 'xl', 'full', 'auto', 'none', 'fit']);
/**
 * Array prop keys that carry STYLED sub-items with their own value channels — chart
 * datapoints/series (`data`/`series`/`slices`/`segments`/`stages`/`nodes`/
 * `thresholds`/`points`/`bars`), colour swatches, and column DEFINITIONS
 * (`columns[].width`). ONLY these are recursed into by the value-channel gate
 * (allowlist = safe by default: a missing styled key just loses this gate's
 * coverage — render-time safe* still neutralizes it). Crucially `rows` is NOT here:
 * DataTable/DataGrid `rows` are arbitrary USER DATA records, so a column literally
 * named `color`/`width` carries content ("Navy Blue", "wide"), not a CSS value, and
 * must never run through safeColor/safeDimension. (Tables key styling on `columns`
 * and data on `rows` — that split is exactly what lets this allowlist work.)
 */
const NESTED_STYLE_KEYS = new Set([
  'data', 'series', 'slices', 'segments', 'stages', 'nodes',
  'thresholds', 'swatches', 'columns', 'points', 'bars',
]);
const DIM_KEYS = new Set([
  'width', 'height', 'gapValue', 'minColWidth', 'minWidth', 'minHeight',
  'maxHeight', 'itemWidth', 'menuWidth', 'length', 'sizeValue',
  // exact size channels (font size, padding, chart stroke width)
  'fontSize', 'paddingValue', 'strokeWidth',
  // exact corner radius + border thickness
  'radiusValue', 'borderWidthValue',
  // Tooltip bubble max width (Value-suffixed to avoid the layout `maxWidth`
  // ENUM on Card/Container/Section/Hero, which is not a length)
  'maxWidthValue',
]);

/**
 * Re-run the value validators on an element's known value-channel props. Value
 * channels are always scalar (string|number); arrays/objects (e.g. Table `rows`,
 * a binding) are content and skipped. A rejected value is reported under the
 * `'unsafe_value'` failure category.
 */
function checkValueChannels(id: string, props: Record<string, unknown>, errors: string[]): void {
  for (const [k, val] of Object.entries(props)) {
    if (val == null || isBindingObject(val)) continue;
    // Recurse ONLY into styled sub-item arrays (chart `series[].color`), never into
    // DATA arrays (DataTable `rows`/`data`/`columns`, list `items`) whose keys are
    // arbitrary user columns — a `color` column value there is content, not CSS, and
    // running it through safeColor mis-fails legal specs. Render-time safe* still
    // neutralizes any nested value. Nested number arrays + bindings are skipped.
    if (Array.isArray(val)) {
      if (NESTED_STYLE_KEYS.has(k)) {
        for (const item of val) {
          if (item && typeof item === 'object' && !Array.isArray(item) && !isBindingObject(item)) {
            checkValueChannels(id, item as Record<string, unknown>, errors);
          }
        }
      }
      continue;
    }
    if (typeof val !== 'string' && typeof val !== 'number') continue; // remaining objects = content
    if (COLOR_KEYS.has(k)) {
      if (safeColor(val) === null)
        errors.push(`elements.${id}.props.${k}: unsafe color value (rejected by safeColor)`);
    } else if (COUNT_KEYS.has(k)) {
      if (safeDimension(val, { kind: 'count', min: 1, max: 12 }) === null)
        errors.push(`elements.${id}.props.${k}: unsafe count value (rejected by safeDimension)`);
    } else if (DIM_KEYS.has(k)) {
      // Skip size-enum tokens (Conversation.maxHeight = sm·md·lg·full etc.) — they
      // are legal non-dimension values that safeDimension would otherwise reject.
      const isSizeEnum = typeof val === 'string' && SIZE_ENUM_TOKENS.has(val);
      if (!isSizeEnum && safeDimension(val) === null)
        errors.push(`elements.${id}.props.${k}: unsafe dimension value (rejected by safeDimension)`);
    }
  }
}

/** `watch` = { "/path": actionObj | actionObj[] }; each actionObj has a string `action`. */
function checkWatch(id: string, watch: unknown, errors: string[], allowed: ReadonlySet<string>): void {
  if (!watch || typeof watch !== 'object' || Array.isArray(watch)) {
    errors.push(`elements.${id}.watch: must be an object keyed by watched state path`);
    return;
  }
  for (const [path, handler] of Object.entries(watch as Record<string, unknown>)) {
    const actions = Array.isArray(handler) ? handler : [handler];
    for (const a of actions) {
      if (!a || typeof a !== 'object' || typeof (a as { action?: unknown }).action !== 'string') {
        errors.push(`elements.${id}.watch["${path}"]: each handler needs a string "action"`);
      } else {
        walkBindings(`elements.${id}.watch["${path}"].params`, (a as { params?: unknown }).params, errors, allowed);
      }
    }
  }
}

/** `repeat` = { statePath: string, key?: string }. */
function checkRepeat(id: string, repeat: unknown, errors: string[], state?: unknown): void {
  if (!repeat || typeof repeat !== 'object' || Array.isArray(repeat)) {
    errors.push(`elements.${id}.repeat: must be an object { statePath, key? }`);
    return;
  }
  const statePath = (repeat as { statePath?: unknown }).statePath;
  if (typeof statePath !== 'string') {
    errors.push(`elements.${id}.repeat.statePath: required string`);
    return;
  }

  // SEEDING. The renderer resolves a repeat as
  // `getByPath(state, repeat.statePath) ?? []`, so an UNSEEDED path silently
  // yields zero rows — the subtree vanishes and the spec still "validates".
  // Rule: the path must resolve to an ARRAY. An EMPTY array stays legal (a list
  // the host fills later), so items are never required — but an empty seed
  // still renders nothing, so the error message names the real fix instead of
  // suggesting `[]`.
  // Skipped when the path carries `${…}` interpolation (a nested repeat scope,
  // e.g. `/rows/${id}/items`) — that can only be resolved per-iteration.
  if (statePath.includes('${')) return;
  const resolved = getByPath((state ?? {}) as never, statePath);
  if (resolved === undefined || resolved === null) {
    errors.push(
      `elements.${id}.repeat.statePath: "${statePath}" is not seeded in /state — the repeat renders zero rows. Seed it with representative rows so the subtree actually renders. Seeding [] passes this check but STILL renders nothing — use it only when the host genuinely fills the list at runtime.`,
    );
  } else if (!Array.isArray(resolved)) {
    errors.push(
      `elements.${id}.repeat.statePath: "${statePath}" resolves to ${typeof resolved}, not an array`,
    );
  }
}

/** `on` = { <event>: { action: string, params?: object } }. */
function checkOn(id: string, on: unknown, errors: string[], allowed: ReadonlySet<string>): void {
  if (!on || typeof on !== 'object' || Array.isArray(on)) {
    errors.push(`elements.${id}.on: must be an object keyed by event (e.g. "commit")`);
    return;
  }
  for (const [event, handler] of Object.entries(on as Record<string, unknown>)) {
    // `on[event]` is an ActionBinding OR ActionBinding[] (json-render allows both) —
    // normalize like checkWatch so the array form isn't falsely rejected.
    const handlers = Array.isArray(handler) ? handler : [handler];
    for (const h of handlers) {
      if (!h || typeof h !== 'object') {
        errors.push(`elements.${id}.on.${event}: must be an object with an "action"`);
        continue;
      }
      const action = (h as { action?: unknown }).action;
      if (typeof action !== 'string') {
        errors.push(`elements.${id}.on.${event}.action: required string`);
        continue;
      }
      const params = (h as { params?: unknown }).params;
      // Built-in mutations must target a state path.
      if (
        BUILTIN_ACTIONS.has(action) &&
        (!params || typeof params !== 'object' || typeof (params as { statePath?: unknown }).statePath !== 'string')
      ) {
        errors.push(`elements.${id}.on.${event}: "${action}" requires params.statePath (string)`);
      }
      walkBindings(`elements.${id}.on.${event}.params`, params, errors, allowed);
      checkConfirm(`elements.${id}.on.${event}`, action, (h as { confirm?: unknown }).confirm, errors);
    }
  }
}

/** The confirm config @frayme/runtime honours (FraymeConfirmConfig). */
const CONFIRM_KEYS = new Set(['title', 'message', 'confirmLabel', 'cancelLabel', 'variant', 'confirmIcon']);
const CONFIRM_VARIANTS = new Set(['default', 'danger']);
/**
 * Builtin mutations json-render's execute() handles BEFORE it reaches the confirm
 * branch. A confirm on one of these is not merely ignored — it reads as a guard
 * that is not there.
 */
const CONFIRM_DEAD_ON = new Set(['setState', 'pushState', 'removeState', 'push', 'pop', 'validateForm']);

/**
 * A binding-level `confirm` is a REAL runtime feature and was, until now,
 * completely unvalidated: `on` is unmodelled by the element schema, so a missing
 * message, a bogus variant, a typo'd key and a wrong-typed value all validated
 * clean and rendered an empty or default modal. It is the guard on the most
 * consequential controls in a spec, and it was the least checked thing in the file.
 */
function checkConfirm(where: string, action: string, confirm: unknown, errors: string[]): void {
  if (confirm === undefined || confirm === null || confirm === false) return;

  // Dead on a builtin: execute() returns from the setState/push/pop branches before
  // it ever reads `confirm`, so the modal never opens and the mutation just happens.
  // A "Clear all" that LOOKS guarded is worse than one that visibly is not.
  if (CONFIRM_DEAD_ON.has(action)) {
    errors.push(
      `${where}.confirm: "${action}" is a built-in mutation and json-render runs it BEFORE the confirm gate — the guard never fires. Wire a named action, or drop the confirm rather than implying one.`,
    );
    return;
  }

  // `true` and a bare string are accepted shorthands (the runtime coerces both), so
  // only an object needs its shape checking.
  if (confirm === true || typeof confirm === 'string') return;
  if (typeof confirm !== 'object' || Array.isArray(confirm)) {
    errors.push(`${where}.confirm: must be an object, a message string, or true — got ${JSON.stringify(confirm)}`);
    return;
  }

  for (const [k, v] of Object.entries(confirm as Record<string, unknown>)) {
    if (!CONFIRM_KEYS.has(k)) {
      // The typo case, and the reason this gate exists: `confirmText` instead of
      // `confirmLabel` renders a default-labelled modal and says nothing about it.
      errors.push(`${where}.confirm.${k}: not a confirm field (expected ${[...CONFIRM_KEYS].join(', ')})`);
      continue;
    }
    if (k === 'variant') {
      if (typeof v !== 'string' || !CONFIRM_VARIANTS.has(v)) {
        errors.push(`${where}.confirm.variant: ${JSON.stringify(v)} is not one of ${[...CONFIRM_VARIANTS].join('|')}`);
      }
      continue;
    }
    if (v != null && typeof v !== 'string') {
      errors.push(`${where}.confirm.${k}: must be a string — got ${JSON.stringify(v)}`);
    }
  }

  // A guard with no words asks the reader to approve something unnamed. The runtime
  // falls back to the button label for a title, so a title is optional — a MESSAGE
  // is what carries the consequence, and that is the whole job.
  const msg = (confirm as { message?: unknown }).message;
  if (msg == null || (typeof msg === 'string' && !msg.trim())) {
    errors.push(`${where}.confirm.message: required — a confirm with no message renders an empty body, so the reader approves an unnamed consequence`);
  }
}

/**
 * The `$computed` SUBSET of the resolution gate — the part that runs by DEFAULT,
 * on every path including `/v1/compose`.
 *
 * WHY THIS EXISTS SEPARATELY. The five `$computed` holes are closed inside
 * `validateResolution`, and `validateSpec` only calls that behind
 * `opts.resolution`, which the serving path has never set. So a model emitting
 * `{"$computed":"totalPrice", …}` — a function name nobody registered —
 * validated clean at compose, and the component rendered the resulting
 * `undefined` as a confident number. A `$computed` is not a presentation
 * nicety: it is the FIGURE ON THE SCREEN. An unresolvable one is a truth
 * defect, so it must escalate rather than ship.
 *
 * WHY NOT JUST TURN THE WHOLE GATE ON. The FULL resolution gate, enabled by
 * default, newly rejects specs that currently validate and render (`$event`
 * params, `readOnly`/`pageSize`/`xLabels` element fields, a `dangerous` confirm
 * variant, confirms on built-in mutations). Every one of those would fall
 * through to the fallback — the exact rate this work exists to reduce. The
 * `$computed` subset newly rejects none of them, because it reports only
 * defects that are already guaranteed to render as nothing.
 *
 * So: the same walker, in `computed` mode. Every other construct is walked
 * THROUGH (a `$computed` hides inside `$cond` branches and inside another
 * function's args) but never reported. The rest of the grammar stays opt-in
 * behind `{resolution:true}` for authoring until it is measured safe.
 */
export function validateComputed(
  spec: unknown,
  opts?: {
    /** EXTRA host-registered function names, exactly as `validateResolution` takes them. */
    computedFunctions?: Iterable<string>;
  },
): ResolutionResult {
  const allowed: ReadonlySet<string> = opts?.computedFunctions
    ? new Set([...COMPUTED_FUNCTIONS, ...opts.computedFunctions])
    : COMPUTED_FUNCTIONS;
  const errors: string[] = [];
  if (!spec || typeof spec !== 'object') return { valid: true, errors };
  const s = spec as { elements?: Record<string, unknown> };

  // Every place the FULL gate walks a bound value: element props, and the
  // `params` of `on` / `watch` handlers (a total is as likely to be sent to an
  // action as it is to be rendered). Kept in lockstep with checkOn/checkWatch —
  // resolution.test.ts pins that a $computed in each place is reached.
  const handlerParams = (where: string, handler: unknown): void => {
    for (const a of Array.isArray(handler) ? handler : [handler]) {
      if (a && typeof a === 'object') {
        walkBindings(where, (a as { params?: unknown }).params, errors, allowed, 'computed');
      }
    }
  };

  for (const [id, raw] of Object.entries(s.elements ?? {})) {
    if (!raw || typeof raw !== 'object') continue;
    const el = raw as Record<string, unknown>;
    if (el.props && typeof el.props === 'object') {
      walkBindings(`elements.${id}.props`, el.props, errors, allowed, 'computed');
    }
    if (el.on && typeof el.on === 'object' && !Array.isArray(el.on)) {
      for (const [event, h] of Object.entries(el.on as Record<string, unknown>)) {
        handlerParams(`elements.${id}.on.${event}.params`, h);
      }
    }
    if (el.watch && typeof el.watch === 'object' && !Array.isArray(el.watch)) {
      for (const [path, h] of Object.entries(el.watch as Record<string, unknown>)) {
        handlerParams(`elements.${id}.watch["${path}"].params`, h);
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors, failureCategory: 'invalid_binding' };
  return { valid: true, errors };
}

/**
 * Validate the render-resolution grammar of an already-catalog-valid spec.
 * Returns `valid:true` with no errors when the spec uses only real json-render
 * constructs, or a categorized failure listing every offending location.
 */
export function validateResolution(
  spec: unknown,
  opts?: {
    /**
     * EXTRA `$computed` function names this host registers on top of the frozen
     * built-in set (BYOC). Names only — the arg-shape check is skipped for them,
     * because guessing an arity we do not own would fail legal specs.
     */
    computedFunctions?: Iterable<string>;
  },
): ResolutionResult {
  const allowed: ReadonlySet<string> = opts?.computedFunctions
    ? new Set([...COMPUTED_FUNCTIONS, ...opts.computedFunctions])
    : COMPUTED_FUNCTIONS;
  const errors: string[] = [];
  let category: FailureCategory | undefined;
  const note = (cat: FailureCategory) => {
    if (!category) category = cat;
  };

  if (!spec || typeof spec !== 'object') {
    return { valid: true, errors }; // empty/invalid specs are caught by earlier stages
  }
  const s = spec as { root?: unknown; elements?: Record<string, unknown>; actions?: Record<string, unknown>; state?: unknown };

  // Resource-abuse caps (DoS / render-bomb guard) — run first; a pathological
  // spec (huge / cyclic / megabyte strings) shouldn't be walked further.
  {
    const before = errors.length;
    checkResourceLimits(s, errors);
    if (errors.length > before) {
      note('resource_limit');
      return { valid: false, errors, failureCategory: 'resource_limit' };
    }
  }

  // spec.actions handler kinds
  if (s.actions && typeof s.actions === 'object') {
    for (const [name, handler] of Object.entries(s.actions)) {
      if (handler === false) continue; // bare deny
      if (handler && typeof handler === 'object') {
        const kind = (handler as { kind?: unknown }).kind;
        if (kind !== undefined && !ACTION_KINDS.has(String(kind))) {
          errors.push(`actions.${name}.kind: invalid "${String(kind)}" (expected recompose | agent | host | false)`);
          note('invalid_action_kind');
        }
      } else {
        errors.push(`actions.${name}: handler must be an object or false`);
        note('invalid_action_kind');
      }
    }
  }

  // elements
  const elements = s.elements ?? {};
  for (const [id, raw] of Object.entries(elements)) {
    if (!raw || typeof raw !== 'object') continue;
    const el = raw as Record<string, unknown>;

    for (const k of Object.keys(el)) {
      if (!ALLOWED_ELEMENT_KEYS.has(k)) {
        errors.push(
          `elements.${id}: unknown element field "${k}" — allowed: ${[...ALLOWED_ELEMENT_KEYS].join(', ')} (e.g. use "visible", not "if")`,
        );
        note('unknown_element_key');
      }
    }

    if (el.visible !== undefined) {
      const r = VisibilityConditionSchema.safeParse(el.visible);
      if (!r.success) {
        errors.push(`elements.${id}.visible: malformed condition (${firstIssue(r)})`);
        note('invalid_binding');
      }
    }
    if (el.watch !== undefined) {
      const before = errors.length;
      checkWatch(id, el.watch, errors, allowed);
      if (errors.length > before) note('invalid_directive');
    }
    if (el.repeat !== undefined) {
      const before = errors.length;
      checkRepeat(id, el.repeat, errors, s.state);
      if (errors.length > before) note('invalid_directive');
    }
    if (el.on !== undefined) {
      const before = errors.length;
      checkOn(id, el.on, errors, allowed);
      if (errors.length > before) note('invalid_directive');
    }
    if (el.props && typeof el.props === 'object') {
      const before = errors.length;
      walkBindings(`elements.${id}.props`, el.props, errors, allowed);
      if (errors.length > before) note('invalid_binding');
      const beforeValues = errors.length;
      checkValueChannels(id, el.props as Record<string, unknown>, errors);
      if (errors.length > beforeValues) note('unsafe_value');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, failureCategory: category ?? 'invalid_binding' };
  }
  return { valid: true, errors };
}
