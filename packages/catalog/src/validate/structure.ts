/**
 * Stage 3c — STRUCTURAL checks the prop schemas cannot express.
 *
 * THE HOLE THIS CLOSES
 *
 * The prop gate (validate/props.ts) checks a prop VALUE against its own schema.
 * Three defect classes ship a blank or half-dead screen while every prop in the
 * spec is individually legal:
 *
 *   LEAF WITH CHILDREN   `elements.x.children` under a component that renders no
 *                        children. json-render happily records the edge and the
 *                        renderer drops the subtree — the children simply never
 *                        appear. Nothing in the catalog schema models it
 *                        (`children` is `s.array(s.string())` on EVERY element).
 *   UNDRAWABLE CHART     every chart in the runtime normalises its data prop and
 *                        early-returns an `<EmptyChart>` ("No data") when the
 *                        normalised set is empty. `series:[{name,data:[…]}]`
 *                        (the wrong key) and `points:[{x,y}]` (objects where the
 *                        renderer wants numbers) both parse — `points` is
 *                        `.nullable()`, so an ABSENT key is not a schema error —
 *                        and render a dashed grey box.
 *   DANGLING STATE PATH  `{$state:"/x"}` / `openPath:"/x"` / `repeat.statePath`
 *                        pointing at a path nothing seeds and nothing writes.
 *                        `getByPath` returns undefined, the prop renders empty,
 *                        the repeat renders zero rows, the dialog can never open.
 *
 * Every one of these shipped with `validationPassed=true`, so the server never
 * retried and the fallback never fired.
 *
 * WHY EVERY CHECK IS GROUNDED IN THE RENDERER, NOT IN TASTE
 *
 * Each rule below reproduces a condition that already exists in
 * @frayme/runtime's registry, cited by file and function. A gate that rejects
 * something the renderer draws fine is a gate people learn to dodge; a gate that
 * passes something the renderer cannot draw is the bug this module exists to fix.
 * The chart minimums are therefore PER FAMILY (a ScatterChart legitimately
 * carries one point per series — one per entity — while a LineChart with one
 * point draws no line).
 *
 * Runs inside `builtinPropIssues` (validate/props.ts), so it is on wherever the
 * prop gate is on and off under `validateSpec(spec, { props: false })`.
 */

import { fraymeCatalog, getByPath } from './jsonRender.js';
import { isDynamicValue } from './dynamic.js';

/* ── shared shapes ───────────────────────────────────────────────────────── */

interface Element {
  type?: string;
  props?: unknown;
  children?: unknown;
  repeat?: unknown;
  on?: unknown;
  watch?: unknown;
}

function elementsOf(spec: unknown): Record<string, Element | undefined> {
  if (!spec || typeof spec !== 'object') return {};
  const els = (spec as { elements?: unknown }).elements;
  if (!els || typeof els !== 'object' || Array.isArray(els)) return {};
  return els as Record<string, Element | undefined>;
}

function propsOf(el: Element | undefined): Record<string, unknown> {
  const p = el?.props;
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

const isFinite_ = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

/* ── (a) LEAF WITH CHILDREN ──────────────────────────────────────────────── */

/**
 * The built-in catalog defs, including the `slots` metadata. A component that
 * declares a slot renders `children`; one that declares none does not. DERIVED,
 * never a hand-written list of leaf names — the catalog is the manifest.
 */
function builtinDefs(): Record<string, { slots?: readonly string[] } | undefined> {
  return (
    fraymeCatalog as unknown as {
      data: { components: Record<string, { slots?: readonly string[] } | undefined> };
    }
  ).data.components;
}

/**
 * CATALOG-METADATA GAP — not an exception to the rule, a bug in the data the
 * rule reads.
 *
 * Ground truth for "renders children" is the runtime component's signature:
 * `export function X({ element, children }: ComponentRenderProps)`. Across
 * packages/runtime/src/react/registry, 34 catalog components
 * destructure `children`; only 30 declare `slots`. These four render their
 * children and declare no slot:
 *
 *   Backdrop   registry/util-overlay.tsx:176   `<div className="relative">{children}…`
 *   HoverCard  registry/util-overlay.tsx:251   children are the trigger content
 *   Marquee    registry/media-extended.tsx:294 "Supply `items` … or children"
 *   Timeline   registry/structure-flow.tsx:147 children render beside `items`
 *
 * The FIX belongs in their catalog entries (`slots: ['default']`, the way the
 * other 30 declare it); until then the gap is carried here, named, so the check
 * cannot false-fire on four components that render perfectly well. DELETE this
 * set the moment those four entries declare their slot; the test pins that it
 * stays in sync with the catalog.
 */
export const SLOTS_METADATA_GAP: ReadonlySet<string> = new Set([
  'Backdrop',
  'HoverCard',
  'Marquee',
  'Timeline',
]);

/** Does this component render `children`? Derived from the catalog manifest. */
export function acceptsChildren(type: string): boolean {
  const def = builtinDefs()[type];
  if (!def) return true; // unknown / BYOC custom → not this check's business
  if (Array.isArray(def.slots) && def.slots.length > 0) return true;
  return SLOTS_METADATA_GAP.has(type);
}

/**
 * A component with no slot must not carry children: json-render records the
 * edge, the renderer never mounts them, and the subtree silently disappears.
 */
export function leafChildrenIssues(spec: unknown): string[] {
  const errors: string[] = [];
  for (const [id, el] of Object.entries(elementsOf(spec))) {
    const type = el?.type;
    if (typeof type !== 'string') continue;
    const kids = el?.children;
    if (!Array.isArray(kids) || kids.length === 0) continue;
    if (acceptsChildren(type)) continue;
    errors.push(
      `elements.${id}.children: ${type} renders no children (it declares no slot) — ${kids.length} child element(s) would never appear. Move them to a container (Stack/Card/Grid), or drop them.`,
    );
  }
  return errors;
}

/* ── (b) DRAWABLE CHART DATA ─────────────────────────────────────────────── */

/**
 * How each chart family decides it has nothing to draw. Every entry mirrors the
 * runtime's own normaliser + early `<EmptyChart>` return; the citation is the
 * function that owns it. `min` is the count of DRAWABLE units below which the
 * runtime (or the human looking at it) gets nothing:
 *
 *   'points'   series[].points — finite numbers      charts.tsx normalizeSeries
 *   'pairs'    series[].points — {x,y} objects       charts-proportion.tsx ScatterChart
 *   'values'   series[].values — finite numbers      charts.tsx normalizeGrouped
 *   'value'    data[].value    — finite number       charts.tsx BarChart/DonutChart, …
 *   'ohlc'     data[]          — finite o/h/l/c      charts-radial.tsx Candlestick
 *   'rows'     any non-empty entry                   Tracker / Gantt / Sankey
 *   'numbers'  a flat finite number list             charts.tsx Sparkline
 *   'grid'     rows of finite numbers                charts-extra.tsx Heatmap
 *
 * A LineChart/AreaChart/Sparkline needs TWO points — one point draws no line.
 * A ScatterChart needs ONE per series: one series per entity with a single
 * {x,y} is the idiomatic scatter, and requiring two would reject it.
 */
type Kind = 'points' | 'pairs' | 'values' | 'value' | 'ohlc' | 'rows' | 'numbers' | 'grid';
interface ChartRule {
  /** Data props, in priority order — the first one PRESENT is the one checked. */
  props: readonly string[];
  kind: Kind;
  min: number;
  /** Extra prop that must itself be non-empty (RadarChart axes, Sankey links). */
  also?: { prop: string; min: number };
}

const CHART_RULES: Record<string, ChartRule> = {
  // series-of-points (a line needs two points to be a line)
  LineChart: { props: ['series'], kind: 'points', min: 2 },
  AreaChart: { props: ['series'], kind: 'points', min: 2 },
  // one {x,y} per entity is a legitimate scatter — per-family minimum, not a blanket rule
  ScatterChart: { props: ['series'], kind: 'pairs', min: 1 },
  // grouped bars + radar carry series[].values
  RadarChart: { props: ['series'], kind: 'values', min: 1, also: { prop: 'axes', min: 3 } },
  BarChart: { props: ['series', 'data'], kind: 'values', min: 1 },
  // label/value lists
  DonutChart: { props: ['data'], kind: 'value', min: 1 },
  PieChart: { props: ['data'], kind: 'value', min: 1 },
  BarList: { props: ['data'], kind: 'value', min: 1 },
  Treemap: { props: ['data'], kind: 'value', min: 1 },
  RadialBar: { props: ['data'], kind: 'value', min: 1 },
  FunnelChart: { props: ['stages'], kind: 'value', min: 1 },
  Candlestick: { props: ['data'], kind: 'ohlc', min: 1 },
  // presence-only lists
  Tracker: { props: ['data'], kind: 'rows', min: 1 },
  Gantt: { props: ['tasks'], kind: 'rows', min: 1 },
  Sankey: { props: ['nodes'], kind: 'rows', min: 1, also: { prop: 'links', min: 1 } },
  // flat lists
  Sparkline: { props: ['points'], kind: 'numbers', min: 2 },
  Heatmap: { props: ['cells'], kind: 'grid', min: 1 },
};

/**
 * The data props a chart family may carry, in priority order. Exported so the
 * prop gate can stand down on them: several chart schemas mark ONE alternative
 * required (`BarChart.data` is non-nullable even though `series` is the grouped
 * form), so a schema-level "missing required" fires on real specs that render
 * perfectly well from `series`. Whether a chart has usable data is this
 * module's question, and `chartDataIssues` asks it properly.
 */
export function chartDataProps(type: string): readonly string[] {
  const rule = CHART_RULES[type];
  return rule ? [...rule.props, ...(rule.also ? [rule.also.prop] : [])] : [];
}

/** BarChart's `series` items use `values`; Line/Area/Scatter use `points`. */
function seriesUnits(series: unknown, key: 'points' | 'values', pairs: boolean): number {
  if (!Array.isArray(series)) return 0;
  let best = 0;
  for (const s of series) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
    const raw = (s as Record<string, unknown>)[key];
    if (!Array.isArray(raw)) continue;
    const n = pairs
      ? raw.filter((pt) => {
          if (Array.isArray(pt)) return isFinite_(pt[0]) && isFinite_(pt[1]);
          if (!pt || typeof pt !== 'object') return false;
          const o = pt as Record<string, unknown>;
          return isFinite_(o.x) && isFinite_(o.y);
        }).length
      : raw.filter(isFinite_).length;
    if (n > best) best = n;
  }
  return best;
}

/** Count the drawable units in `value` under `kind`. */
function drawableUnits(value: unknown, kind: Kind): number {
  switch (kind) {
    case 'points':
      return seriesUnits(value, 'points', false);
    case 'pairs':
      return seriesUnits(value, 'points', true);
    case 'values':
      // BarChart accepts either grouped `series[].values` or flat `data[].value`.
      return Math.max(seriesUnits(value, 'values', false), drawableUnits(value, 'value'));
    case 'value':
      return Array.isArray(value)
        ? value.filter((d) => d && typeof d === 'object' && isFinite_((d as Record<string, unknown>).value)).length
        : 0;
    case 'ohlc':
      return Array.isArray(value)
        ? value.filter((c) => {
            if (!c || typeof c !== 'object') return false;
            const o = c as Record<string, unknown>;
            return isFinite_(o.open) && isFinite_(o.high) && isFinite_(o.low) && isFinite_(o.close);
          }).length
        : 0;
    case 'rows':
      return Array.isArray(value) ? value.filter((r) => r != null).length : 0;
    case 'numbers':
      return Array.isArray(value) ? value.filter(isFinite_).length : 0;
    case 'grid':
      return Array.isArray(value)
        ? value.filter((row) => Array.isArray(row) && row.some(isFinite_)).length
        : 0;
  }
}

/** Human name of the unit, for the message fed back to the model. */
const UNIT_LABEL: Record<Kind, string> = {
  points: 'finite numbers in a series `points` array',
  pairs: 'points with finite `x` and `y`',
  values: 'finite `values` in a series (or `data` entries with a finite `value`)',
  value: 'entries with a finite `value`',
  ohlc: 'entries with finite `open`/`high`/`low`/`close`',
  rows: 'entries',
  numbers: 'finite numbers',
  grid: 'rows containing a finite number',
};

/**
 * A chart whose data prop carries nothing the renderer can draw. This is the
 * "No data" box: the element validates, bills, streams and renders a dashed
 * grey rectangle.
 *
 * Skipped when the data prop is a BINDING or the element is repeated — the value
 * arrives at runtime and cannot be counted at author time.
 */
export function chartDataIssues(spec: unknown): string[] {
  const errors: string[] = [];
  for (const [id, el] of Object.entries(elementsOf(spec))) {
    const rule = el?.type ? CHART_RULES[el.type] : undefined;
    if (!rule) continue;
    if (el?.repeat !== undefined) continue;
    const props = propsOf(el);

    // The first data prop that is PRESENT owns the check (BarChart: series | data).
    let key: string | undefined;
    for (const p of rule.props) {
      if (props[p] !== undefined && props[p] !== null) {
        key = p;
        break;
      }
    }
    if (key === undefined) {
      errors.push(
        `elements.${id}.props.${rule.props[0]}: ${el?.type} has no data — set \`${rule.props[0]}\` (${UNIT_LABEL[rule.kind]}) or the chart renders a "No data" box.`,
      );
      continue;
    }
    const value = props[key];
    if (isDynamicValue(value)) continue; // resolved at runtime
    if (Array.isArray(value) && value.some(isDynamicValue)) continue;
    // A series ENTRY whose DATA field (points / values / data) is itself a
    // binding ({$state}, {$cond}) is resolved at runtime too — the
    // chart-binding gap: the renderer drew it, the gate reported "0 finite
    // numbers". Only the data field counts: a bound `name` or `color` beside a
    // literal empty series must still fail.
    if (
      Array.isArray(value) &&
      value.some((s) => {
        if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
        const e = s as Record<string, unknown>;
        return isDynamicValue(e.points) || isDynamicValue(e.values) || isDynamicValue(e.data);
      })
    )
      continue;

    const units = drawableUnits(value, rule.kind);
    if (units < rule.min) {
      errors.push(
        `elements.${id}.props.${key}: ${el?.type} needs at least ${rule.min} ${UNIT_LABEL[rule.kind]} — found ${units}. As written the renderer draws a "No data" box.`,
      );
      continue;
    }
    if (rule.also) {
      const extra = props[rule.also.prop];
      if (isDynamicValue(extra)) continue;
      const n = Array.isArray(extra) ? extra.filter((x) => x != null).length : 0;
      if (n < rule.also.min) {
        errors.push(
          `elements.${id}.props.${rule.also.prop}: ${el?.type} needs at least ${rule.also.min} \`${rule.also.prop}\` entries — found ${n}. As written the renderer draws a "No data" box.`,
        );
      }
    }
  }
  return errors;
}

/* ── (c) STATE PATHS THAT RESOLVE ────────────────────────────────────────── */

/**
 * Every state path a spec READS: `{$state}` / `{$bindState}` bindings at any
 * depth in props, `openPath` (Dialog/Drawer visibility), and `repeat.statePath`.
 *
 * A path is a finding only when it is neither SEEDED in `/state` nor WRITTEN by
 * anything in the spec. The second half is what keeps this from false-firing on
 * the commonest legitimate pattern in real specs: a Dialog whose `openPath` is
 * unseeded and opened by a Button's `setState` — `setState` creates the path, so
 * the dialog works. Writers are collected from `on`/`watch` handler params and
 * from `spec.actions`; `repeat.statePath` is deliberately NOT a writer (it reads).
 */
function collectWriters(spec: unknown, out: Set<string>): void {
  const push = (v: unknown): void => {
    if (typeof v === 'string' && v.startsWith('/')) out.add(v);
  };
  // Any `statePath` inside an action-handler subtree writes.
  const walkHandlers = (node: unknown, depth = 0): void => {
    if (depth > 8 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) walkHandlers(n, depth + 1);
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'statePath') push(v);
      else walkHandlers(v, depth + 1);
    }
  };
  // A `$bindState` binding is two-way: it writes the path it names.
  const walkBind = (node: unknown, depth = 0): void => {
    if (depth > 10 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) walkBind(n, depth + 1);
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === '$bindState') push(v);
      else walkBind(v, depth + 1);
    }
  };

  for (const el of Object.values(elementsOf(spec))) {
    walkHandlers(el?.on);
    walkHandlers(el?.watch);
    walkBind(el?.props);
  }
  if (spec && typeof spec === 'object') walkHandlers((spec as { actions?: unknown }).actions);
}

/** Every read: [where, path]. */
function collectReads(spec: unknown): Array<[string, string]> {
  const reads: Array<[string, string]> = [];
  const walk = (where: string, node: unknown, depth = 0): void => {
    if (depth > 10 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n, i) => walk(`${where}.${i}`, n, depth + 1));
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const key of ['$state', '$bindState'] as const) {
      const v = obj[key];
      if (typeof v === 'string') reads.push([where, v]);
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === '$state' || k === '$bindState') continue;
      walk(`${where}.${k}`, v, depth + 1);
    }
  };

  for (const [id, el] of Object.entries(elementsOf(spec))) {
    walk(`elements.${id}.props`, el?.props);
    walk(`elements.${id}.on`, el?.on);
    walk(`elements.${id}.watch`, el?.watch);
    const openPath = propsOf(el).openPath;
    if (typeof openPath === 'string') reads.push([`elements.${id}.props.openPath`, openPath]);
    const repeat = el?.repeat;
    if (repeat && typeof repeat === 'object' && !Array.isArray(repeat)) {
      const sp = (repeat as { statePath?: unknown }).statePath;
      if (typeof sp === 'string') reads.push([`elements.${id}.repeat.statePath`, sp]);
    }
  }
  return reads;
}

/**
 * A read path is satisfied when `/state` resolves it (the renderer's OWN
 * `getByPath`), or when some writer names it, a prefix of it, or an extension of
 * it (`setState /user/name` makes `/user` an object; a seeded `/user` object
 * makes `/user/name` a settable key).
 */
function satisfiedBy(path: string, writers: ReadonlySet<string>): boolean {
  for (const w of writers) {
    if (w === path || w.startsWith(`${path}/`) || path.startsWith(`${w}/`)) return true;
  }
  return false;
}

/**
 * RUNTIME-WRITTEN: the `/_ui` state mirror.
 *
 * `@frayme/runtime` writes `/_ui/<elementId>/<verb>` (and the row-scoped
 * `/_ui/<elementId>/__rows/<row>/<verb>`) into spec.state at EXECUTION time —
 * packages/runtime/src/core/intrinsic.ts `take()` / `mirror()` — for every
 * intrinsic emit, whether or not the author bound anything. No spec ever seeds
 * these paths and no `on`/`watch`/`actions` handler names them, so the
 * seeded-or-written test above cannot see the writer: every read of the mirror
 * was reported as a dead pointer although the renderer resolves it. That is a
 * false positive on a DOCUMENTED channel — `useCommitLatch`
 * (packages/runtime/src/react/intrinsic.tsx) is the sanctioned reader, the
 * hand-authored latch `disabled: {$state:"/_ui/<id>/commit"}` is the shape the
 * runtime comments name, and the tool JSON (packages/api/src/tools/index.ts)
 * tells host agents that local gestures land at `state._ui.<elementId>.<verb>`.
 * In practice every carrier pointer and every hand-authored latch binding
 * tripped the finding.
 *
 * The exemption is the `/_ui` SEGMENT: `/_ui` itself or anything under `/_ui/`.
 * `/_uiX/…` and `/x/_ui/…` are NOT the mirror and stay subject to the rule.
 * This is a LOOSENING only — it can never add a finding.
 */
const UI_MIRROR_ROOT = '/_ui';
function isRuntimeWrittenPath(path: string): boolean {
  return path === UI_MIRROR_ROOT || path.startsWith(`${UI_MIRROR_ROOT}/`);
}

export function statePathIssues(spec: unknown): string[] {
  if (!spec || typeof spec !== 'object') return [];
  const state = (spec as { state?: unknown }).state;
  const writers = new Set<string>();
  collectWriters(spec, writers);
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const [where, path] of collectReads(spec)) {
    // Grammar (a non-"/" path, a malformed binding) belongs to resolution.ts.
    if (!path.startsWith('/')) continue;
    // `${…}` is a per-iteration repeat scope — only resolvable at render time.
    if (path.includes('${')) continue;
    // The `/_ui` state mirror is written by the runtime, never by the spec — see
    // isRuntimeWrittenPath above.
    if (isRuntimeWrittenPath(path)) continue;
    const resolved = getByPath((state ?? {}) as never, path);
    if (resolved !== undefined) continue;
    if (satisfiedBy(path, writers)) continue;
    const dedupe = `${where}|${path}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    errors.push(
      `${where}: "${path}" is not seeded in /state and nothing in the spec writes it — it resolves to undefined, so this renders empty. Seed it in /state (or wire an action that sets it).`,
    );
  }
  return errors;
}

/* ── the module's public gate ────────────────────────────────────────────── */

/** All three structural checks, in the order a reader would debug them. */
export function specStructureIssues(spec: unknown): string[] {
  return [...leafChildrenIssues(spec), ...chartDataIssues(spec), ...statePathIssues(spec)];
}
