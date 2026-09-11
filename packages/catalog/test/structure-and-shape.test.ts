/**
 * The WIDENED prop gate + the three structural checks.
 *
 * WHAT WAS BROKEN. validate/props.ts surfaced ONLY enum issues and skipped every
 * other Zod issue, and nothing checked spec structure at all. In live output
 * most specs passed the catalog + referential gates, and the enum-only prop gate
 * found a violation in NONE of them — while many rendered a "No data" panel or
 * an empty state. Every one of those shipped as `validationPassed=true`, so the
 * server never retried and the fallback never fired.
 *
 * The widened gate finds a defect in most of those.
 *
 * EVERY CHECK BELOW HAS TWO TESTS: a real failing case from live output (the detector
 * must FIRE — a count you have not seen fire is not a measurement), and a real
 * passing case beside it (the detector must stay SILENT — a gate that is easier
 * to dodge than to satisfy is the gate's bug).
 */
import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';
import { builtinPropShapeIssues, builtinPropIssues } from '../src/validate/props.js';
import {
  acceptsChildren,
  chartDataIssues,
  leafChildrenIssues,
  statePathIssues,
  SLOTS_METADATA_GAP,
} from '../src/validate/structure.js';
import { fraymeCatalog } from '../src/catalog.js';

const el = (type: string, props: Record<string, unknown>, rest: Record<string, unknown> = {}) => ({
  type,
  props,
  ...rest,
});

/* ── (1) UNKNOWN prop names ──────────────────────────────────────────────── */

describe('unknown prop names — the Scheduler case', () => {
  // A live spec set Scheduler.hourSlot / nowHour / nowLabel / nowColor, none of
  // which exist. Zod objects are strip-mode, so NO issue is raised at all — the
  // keys are silently dropped and the grid collapsed to one column.
  it('FIRES on an invented prop', () => {
    const spec = { root: 'g', elements: { g: el('Scheduler', { columns: [{ id: 'd1', label: 'Mon' }], nowHour: 9 }) } };
    const issues = builtinPropShapeIssues(spec);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('Scheduler has no prop "nowHour"');
    // the message names the legal props — it is fed back to the model
    expect(issues[0]).toContain('columns');
  });

  it('stays SILENT on the declared props of the same component', () => {
    const spec = { root: 'g', elements: { g: el('Scheduler', { columns: [{ id: 'd1', label: 'Mon' }], startHour: 8, endHour: 18 }) } };
    expect(builtinPropShapeIssues(spec)).toEqual([]);
  });
});

/* ── (2) WRONG-TYPED present literals ────────────────────────────────────── */

describe('wrong-typed literals — the old deliberate blind spot', () => {
  it('FIRES on Scheduler.columns: 5 (a count where an array belongs)', () => {
    const spec = { root: 'g', elements: { g: el('Scheduler', { columns: 5 }) } };
    const issues = builtinPropShapeIssues(spec);
    expect(issues.some((m) => m.includes('elements.g.props.columns') && m.includes('expected array'))).toBe(true);
  });

  it('FIRES on a boolean prop given a string (`wrap: "yes"`)', () => {
    const spec = { root: 's', elements: { s: el('Stack', { wrap: 'yes' }, { children: ['t'] }), t: el('Text', { text: 'x' }) } };
    expect(builtinPropShapeIssues(spec)).toHaveLength(1);
  });

  it('stays SILENT when the same props carry the right types', () => {
    const spec = { root: 's', elements: { s: el('Stack', { wrap: true, direction: 'vertical' }, { children: ['t'] }), t: el('Text', { text: 'x' }) } };
    expect(builtinPropShapeIssues(spec)).toEqual([]);
  });

  it('does NOT walk INSIDE a binding object (the false positives measured on real specs)', () => {
    // `selections` is an array prop; `{$bindState:"/sel"}` reports
    // `selections.$bindState: expected array, received string` because the schema
    // types the RESOLVED value. That path is the binding's innards, not a value.
    const spec = {
      state: { sel: [] },
      root: 'f',
      elements: { f: el('FilterPanel', { sections: [], selections: { $bindState: '/sel' } }) },
    };
    expect(builtinPropShapeIssues(spec)).toEqual([]);
  });
});

/* ── (3) MISSING required props ──────────────────────────────────────────── */

describe('missing required props', () => {
  it('FIRES on a Stat with no value', () => {
    const spec = { root: 's', elements: { s: el('Stat', { label: 'NVIDIA' }) } };
    const issues = builtinPropShapeIssues(spec);
    expect(issues.some((m) => m.includes('Stat.value is required'))).toBe(true);
  });

  it('FIRES nested — a DataTable column with no label renders a blank header', () => {
    const spec = {
      root: 'd',
      elements: { d: el('DataTable', { columns: [{ key: 'qty' }], rows: [{ qty: 1 }] }) },
    };
    expect(builtinPropShapeIssues(spec).some((m) => m.includes('columns.0.label is required'))).toBe(true);
  });

  it('stays SILENT on an UNSET nullable prop (the catalog convention is .nullable())', () => {
    // Stack declares 11 props and sets one — absent is not wrong, or this gate
    // would fire on every spec ever written.
    const spec = { root: 's', elements: { s: el('Stack', { direction: 'vertical' }, { children: ['t'] }), t: el('Text', { text: 'x' }) } };
    expect(builtinPropShapeIssues(spec)).toEqual([]);
  });

  it('stays SILENT on a chart rendering from its ALTERNATIVE data prop', () => {
    // `BarChart.data` is non-nullable in the schema even though `series` is the
    // grouped form; real specs render correctly from `series`.
    // Whether a chart has data is the drawable-data check's question.
    const spec = {
      root: 'b',
      elements: { b: el('BarChart', { series: [{ name: 'Q1', values: [3, 4] }], labels: ['a', 'b'] }) },
    };
    expect(builtinPropShapeIssues(spec)).toEqual([]);
  });
});

/* ── (4) LEAF WITH CHILDREN ──────────────────────────────────────────────── */

describe('leaf with children', () => {
  it('FIRES on a Stat carrying children', () => {
    const spec = {
      root: 's',
      elements: { s: el('Stat', { label: 'ARR', value: '£86k' }, { children: ['t'] }), t: el('Text', { text: 'x' }) },
    };
    const issues = leafChildrenIssues(spec);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('Stat renders no children');
  });

  it('stays SILENT on a Card, which declares a slot', () => {
    const spec = {
      root: 'c',
      elements: { c: el('Card', { title: 'Panel' }, { children: ['t'] }), t: el('Text', { text: 'x' }) },
    };
    expect(leafChildrenIssues(spec)).toEqual([]);
  });

  it('derives the leaf list from the catalog, never from a hand-written list', () => {
    const defs = (fraymeCatalog as unknown as { data: { components: Record<string, { slots?: readonly string[] }> } }).data.components;
    const slotted = Object.keys(defs).filter((n) => Array.isArray(defs[n].slots) && defs[n].slots!.length > 0);
    expect(slotted.length).toBeGreaterThan(20);
    for (const n of slotted) expect(acceptsChildren(n)).toBe(true);
    // and a component with no slot is a leaf unless it is one of the four
    // measured metadata gaps
    expect(acceptsChildren('Stat')).toBe(false);
  });

  it('the metadata-gap set contains ONLY components the catalog has not given a slot', () => {
    // The moment one of those four entries declares `slots`, its name here is
    // dead weight — this assertion is what makes that visible.
    const defs = (fraymeCatalog as unknown as { data: { components: Record<string, { slots?: readonly string[] } | undefined> } }).data.components;
    for (const n of SLOTS_METADATA_GAP) {
      expect(defs[n], `${n} is not a catalog component`).toBeDefined();
      expect(defs[n]?.slots ?? [], `${n} now declares slots — drop it from SLOTS_METADATA_GAP`).toHaveLength(0);
    }
  });

  it('ignores a BYOC/unknown type (not this check\'s business)', () => {
    const spec = { root: 'x', elements: { x: { type: 'RiskGauge', props: {}, children: ['t'] }, t: el('Text', { text: 'x' }) } };
    expect(leafChildrenIssues(spec)).toEqual([]);
  });
});

/* ── (5) DRAWABLE CHART DATA ─────────────────────────────────────────────── */

describe('drawable chart data', () => {
  it('FIRES on the common model shape: series carrying `data` instead of `points`', () => {
    // normalizeSeries (runtime charts.tsx) reads `points` and filters out every
    // series with none — this renders a dashed "No data" box.
    const spec = {
      root: 'l',
      elements: { l: el('LineChart', { series: [{ name: 'MRR', data: [{ x: 1, y: 2 }, { x: 2, y: 4 }] }] }) },
    };
    const issues = chartDataIssues(spec);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('No data');
  });

  it('FIRES on a chart with no data prop at all (radar + funnel)', () => {
    const spec = { root: 'r', elements: { r: el('RadarChart', { axes: ['a', 'b', 'c'], palette: 'brand' }) } };
    expect(chartDataIssues(spec).some((m) => m.includes('has no data'))).toBe(true);
  });

  it('stays SILENT on a LineChart with two real points', () => {
    const spec = { root: 'l', elements: { l: el('LineChart', { series: [{ name: 'MRR', points: [12, 18] }] }) } };
    expect(chartDataIssues(spec)).toEqual([]);
  });

  it('honours the PER-FAMILY minimum: a one-point ScatterChart series is legitimate', () => {
    // One series per entity, one {x,y} each, is the idiomatic scatter — a blanket
    // "2+ points" rule would reject a chart the renderer draws correctly.
    const scatter = {
      root: 's',
      elements: { s: el('ScatterChart', { series: [{ name: 'Acme', points: [{ x: 4, y: 9 }] }, { name: 'Globex', points: [{ x: 7, y: 3 }] }] }) },
    };
    expect(chartDataIssues(scatter)).toEqual([]);
    // …while the same single point in a LineChart draws no line
    const line = { root: 'l', elements: { l: el('LineChart', { series: [{ name: 'MRR', points: [12] }] }) } };
    expect(chartDataIssues(line)).toHaveLength(1);
  });

  it('stays SILENT when the data is BOUND (it arrives at runtime)', () => {
    const spec = {
      state: { trend: [] },
      root: 'l',
      elements: { l: el('LineChart', { series: { $state: '/trend' } }) },
    };
    expect(chartDataIssues(spec)).toEqual([]);
  });
});

/* ── (6) STATE PATHS THAT RESOLVE ────────────────────────────────────────── */

describe('dangling state paths', () => {
  it('FIRES on a $state read of a path nothing seeds and nothing writes', () => {
    const spec = {
      state: { rows: [] },
      root: 'h',
      elements: { h: el('Heading', { text: { $state: '/titel' }, level: 'h2' }) },
    };
    const issues = statePathIssues(spec);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('/titel');
  });

  it('FIRES on a repeat over an unseeded list (it renders zero rows)', () => {
    const spec = {
      state: { other: 1 },
      root: 's',
      elements: {
        s: el('Stack', {}, { children: ['row'] }),
        row: el('Text', { text: { $item: 'name' } }, { repeat: { statePath: '/people' } }),
      },
    };
    expect(statePathIssues(spec).some((m) => m.includes('/people'))).toBe(true);
  });

  it('stays SILENT when a WRITER creates the path — the Dialog/openPath pattern', () => {
    // This is the check's whole difficulty: `openPath` is routinely unseeded and
    // opened by a Button's setState, which CREATES the path. Flagging it would
    // fail a pattern real specs are full of and the renderer handles correctly.
    const spec = {
      state: { rows: [] },
      root: 's',
      elements: {
        s: el('Stack', {}, { children: ['b', 'd'] }),
        b: el('Button', { label: 'Open' }, { on: { commit: { action: 'setState', params: { statePath: '/confirmOpen', value: true } } } }),
        d: el('Dialog', { title: 'Confirm', openPath: '/confirmOpen' }, { children: ['t'] }),
        t: el('Text', { text: 'Sure?' }),
      },
    };
    expect(statePathIssues(spec)).toEqual([]);
  });

  it('stays SILENT on a seeded read, and on a per-iteration ${…} scope', () => {
    const seeded = { state: { title: 'Q3' }, root: 'h', elements: { h: el('Heading', { text: { $state: '/title' } }) } };
    expect(statePathIssues(seeded)).toEqual([]);
    const scoped = {
      state: { rows: [{ id: 'a', items: [] }] },
      root: 's',
      elements: {
        s: el('Stack', {}, { children: ['r'] }),
        r: el('Text', { text: 'x' }, { repeat: { statePath: '/rows/${id}/items' } }),
      },
    };
    expect(statePathIssues(scoped)).toEqual([]);
  });
});

/* ── (6b) THE /_ui STATE MIRROR IS RUNTIME-WRITTEN ──────────────────────── */

describe('dangling state paths — the /_ui runtime-written mirror is exempt', () => {
  // packages/runtime/src/core/intrinsic.ts take()/mirror() write
  // /_ui/<elementId>/<verb> at execution time; no spec seeds it. The hand-authored
  // latch `disabled: {$state:"/_ui/<id>/commit"}` (useCommitLatch's documented
  // shape) must therefore validate clean — nothing else about the rule changes.
  it('stays SILENT on a $state read of /_ui/<id>/commit in a PROP (the latch shape)', () => {
    const spec = {
      state: { rows: [] },
      root: 's',
      elements: {
        s: el('Stack', {}, { children: ['submitBtn'] }),
        submitBtn: el(
          'Button',
          { label: 'Submit', disabled: { $state: '/_ui/submitBtn/commit' } },
          { on: { commit: { action: 'submitOrder' } } },
        ),
      },
      actions: { submitOrder: { description: 'Submit the order' } },
    };
    expect(statePathIssues(spec)).toEqual([]);
    const r = validateSpec(spec);
    expect(r.errors.filter((m) => m.includes('/_ui/'))).toEqual([]);
  });

  it('stays SILENT on a $state read of the mirror in on.*.params (the carrier pointer)', () => {
    const spec = {
      state: {},
      root: 's',
      elements: {
        s: el('Stack', {}, { children: ['board', 'saveBtn'] }),
        board: el('KanbanBoard', { columns: [{ title: 'Todo', cards: [{ id: 'c1', title: 'One' }] }] }),
        saveBtn: el(
          'Button',
          { label: 'Save' },
          { on: { commit: { action: 'savePlan', params: { lastMove: { $state: '/_ui/board/move' } } } } },
        ),
      },
      actions: { savePlan: { description: 'Save the plan' } },
    };
    expect(statePathIssues(spec)).toEqual([]);
    expect(validateSpec(spec).errors.filter((m) => m.includes('/_ui/'))).toEqual([]);
  });

  it('stays SILENT on the row-scoped mirror, the bare /_ui root, and a $bindState under /_ui/', () => {
    const spec = {
      state: {},
      root: 's',
      elements: {
        s: el('Stack', {}, { children: ['a', 'b', 'c'] }),
        a: el('Button', { label: 'Ack', disabled: { $state: '/_ui/a/__rows/0/commit' } }),
        b: el('Text', { text: { $state: '/_ui' } }),
        c: el('Switch', { label: 'Live', checked: { $bindState: '/_ui/c/change/checked' } }),
      },
    };
    expect(statePathIssues(spec)).toEqual([]);
  });

  it('still FIRES on a dead pointer NOT under /_ui/ — exactly as before', () => {
    const spec = {
      state: { rows: [] },
      root: 's',
      elements: {
        s: el('Stack', {}, { children: ['submitBtn', 'h'] }),
        submitBtn: el('Button', { label: 'Submit', disabled: { $state: '/_ui/submitBtn/commit' } }),
        h: el('Heading', { text: { $state: '/titel' }, level: 'h2' }),
      },
    };
    const issues = statePathIssues(spec);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toBe(
      'elements.h.props.text: "/titel" is not seeded in /state and nothing in the spec writes it — it resolves to undefined, so this renders empty. Seed it in /state (or wire an action that sets it).',
    );
  });

  it('is the /_ui SEGMENT only — "/_uiX/…" and "/x/_ui/…" are NOT exempt', () => {
    const spec = {
      state: {},
      root: 's',
      elements: {
        s: el('Stack', {}, { children: ['a', 'b'] }),
        a: el('Button', { label: 'A', disabled: { $state: '/_uiX/a/commit' } }),
        b: el('Button', { label: 'B', disabled: { $state: '/x/_ui/b/commit' } }),
      },
    };
    const issues = statePathIssues(spec);
    expect(issues).toHaveLength(2);
    expect(issues.some((m) => m.includes('"/_uiX/a/commit"'))).toBe(true);
    expect(issues.some((m) => m.includes('"/x/_ui/b/commit"'))).toBe(true);
  });
});

/* ── (7) the gate as the server sees it ──────────────────────────────────── */

describe('validateSpec — the structural findings reach the server', () => {
  it('a chart with no drawable data now FAILS validation (it used to ship as a success)', () => {
    const spec = { root: 'l', elements: { l: el('LineChart', { series: [{ name: 'MRR', data: [1, 2, 3] }] }) } };
    const r = validateSpec(spec);
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('invalid_prop_value');
  });

  it('{ props: false } still reproduces the historical pre-gate behaviour', () => {
    const spec = { root: 'l', elements: { l: el('LineChart', { series: [{ name: 'MRR', data: [1, 2, 3] }] }) } };
    expect(validateSpec(spec, { props: false }).valid).toBe(true);
  });

  it('builtinPropIssues is the union of the shape and structural findings', () => {
    const spec = {
      root: 's',
      elements: { s: el('Stat', { label: 'ARR' }, { children: ['t'] }), t: el('Text', { text: 'x' }) },
    };
    const all = builtinPropIssues(spec);
    expect(all.some((m) => m.includes('Stat.value is required'))).toBe(true);
    expect(all.some((m) => m.includes('renders no children'))).toBe(true);
  });
});
