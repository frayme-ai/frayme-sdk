/**
 * Stage 3b — the BUILT-IN component prop gate (validate/props.ts).
 *
 * THE HOLE. `validateManifestProps` resolves components out of the compiled
 * MANIFEST map (BYOC customs), so the 188 built-ins were never prop-checked at
 * all. Measured against the published build before this gate landed, ALL FOUR of
 * these passed:
 *
 *   Stack { direction: "vertical" }   PASS   (correct)
 *   Stack { direction: "column"   }   PASS   (out of enum — must FAIL)
 *   Stack { direction: "sideways" }   PASS   (nonsense      — must FAIL)
 *   Stack { direction: 42         }   PASS   (wrong type    — must FAIL)
 *
 * Why it is not cosmetic: cva maps an unknown variant key to NO class AND skips
 * its own `defaultVariants` (a value *was* supplied), so `direction:"column"`
 * fell through to the bare `flex` base — a ROW. And because the server
 * escalates to the fallback only when validation FAILS, a prop the
 * validator cannot see means the fallback never fires and the broken spec ships
 * as a success.
 *
 * THE TWO EXCLUSIONS ARE THE INSTRUMENT. Running the raw Zod prop schemas over
 * known-good specs without them flags every one; excluding omitted keys leaves
 * a residue, and also excluding bindings leaves 0. The binding and omitted-key
 * cases below are the regression pins for that — they are the difference
 * between a gate and a blanket false alarm.
 */
import { describe, expect, it } from 'vitest';
import { defineFraymeComponent, extendCatalog, type ManifestInput } from '../src/index.js';
import {
  validateSpec,
  validateManifestProps,
  validateBuiltinProps,
  builtinPropIssues,
} from '../src/validate/index.js';

/** A minimal two-element spec: a root Stack wrapping one Text.
 *  `/state` carries the paths the binding fixtures below read — an unseeded read
 *  that nothing writes is a finding of its own (validate/structure.ts),
 *  and this file is about PROP shapes, not state seeding. */
const stackWith = (props: Record<string, unknown>) => ({
  root: 's',
  state: { layout: 'horizontal', wide: true },
  elements: {
    s: { type: 'Stack', props, children: ['t'] },
    t: { type: 'Text', props: { text: 'hello' } },
  },
});

describe('built-in prop gate — the four measured cases', () => {
  it('PASSES a valid enum literal', () => {
    const r = validateSpec(stackWith({ direction: 'vertical' }));
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('FAILS an out-of-enum literal (the "column" catastrophe)', () => {
    const r = validateSpec(stackWith({ direction: 'column' }));
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('invalid_prop_value');
    expect(r.errors[0]).toContain('elements.s.props.direction');
    expect(r.errors[0]).toContain('"column"');
    // the message must name the legal options — it is fed back to the model
    expect(r.errors[0]).toContain('horizontal');
  });

  it('FAILS a nonsense literal', () => {
    const r = validateSpec(stackWith({ direction: 'sideways' }));
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('invalid_prop_value');
  });

  it('FAILS a wrong-typed literal in an enum prop', () => {
    const r = validateSpec(stackWith({ direction: 42 }));
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('invalid_prop_value');
  });
});

describe('exclusion 1 — BINDINGS are legal dynamic values', () => {
  // The prop schemas type the RESOLVED value and cannot model a binding, so
  // every binding reads as a type error. Without this exclusion the gate fires
  // on nearly every real spec. Binding GRAMMAR is checked in resolution.ts.
  const bindings: Array<[string, unknown]> = [
    ['$state', { $state: '/layout' }],
    ['$item', { $item: 'direction' }],
    ['$cond', { $cond: { path: '/wide' }, then: 'horizontal', else: 'vertical' }],
    ['$bindState', { $bindState: '/layout' }],
  ];

  for (const [label, value] of bindings) {
    it(`PASSES a ${label} binding in the same prop that fails as a literal`, () => {
      // control: the literal form of this prop IS gated
      expect(validateSpec(stackWith({ direction: 'column' })).valid).toBe(false);
      const r = validateSpec(stackWith({ direction: value }));
      expect(r.valid).toBe(true);
      expect(r.errors).toEqual([]);
    });
  }

  it('treats only $-prefixed object keys as dynamic (a plain object still fails)', () => {
    // guards the exclusion against being a blanket "objects are fine" hole
    expect(builtinPropIssues(stackWith({ direction: { state: '/layout' } }))).toHaveLength(1);
  });
});

describe('exclusion 2 — an OMITTED nullable prop is not a violation', () => {
  // The schemas are `.nullable()` but NOT `.optional()`, so a whole-object parse
  // raises an issue for every UNSET prop. Absent is not wrong.
  it('PASSES a props object with no enum props set at all', () => {
    const r = validateSpec(stackWith({}));
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('PASSES an explicit null (the schemas are nullable)', () => {
    expect(validateSpec(stackWith({ direction: null })).valid).toBe(true);
  });

  it('is not the reason a props-less element is rejected (that is the catalog schema)', () => {
    // `props` is required by the spec schema, so a missing props key already
    // failed BEFORE this gate existed. Pin which stage owns it so the new
    // failureCategory is never blamed for a pre-existing rule.
    const spec = { root: 's', elements: { s: { type: 'Stack', children: ['t'] }, t: { type: 'Text', props: { text: 'x' } } } };
    expect(builtinPropIssues(spec)).toEqual([]);
    expect(validateSpec(spec, { props: false }).failureCategory).toBe('catalog_validation_failed');
    expect(validateSpec(spec).failureCategory).toBe('catalog_validation_failed');
  });

  it('reports ONLY the prop that is actually present and wrong', () => {
    // Stack declares 11 props; a whole-object parse raises an issue for each
    // unset one. Exactly one is present-and-wrong here.
    const issues = builtinPropIssues(stackWith({ direction: 'column' }));
    expect(issues).toHaveLength(1);
  });
});

describe('scope — type + unknown-name are in scope, not only enum misses', () => {
  /**
   * These two assertions were the inverse before: "a real defect class, but
   * no measured exclusion list, so this gate leaves them alone." Live output
   * supplied the measurement — most baseline-valid specs carried one of these,
   * and every one shipped as `validationPassed=true`. Replayed before landing:
   * a sizeable minority of older specs newly fail — authoring bugs to fix at
   * source — against well under 1% of specs authored under the full gate stack.
   */
  it('FLAGS a wrong-typed non-enum prop', () => {
    // `wrap` is a boolean; the string renders as neither true nor false.
    expect(builtinPropIssues(stackWith({ wrap: 'yes' }))).toHaveLength(1);
  });

  it('FLAGS an unknown prop name (strip-mode drops it silently)', () => {
    const issues = builtinPropIssues(stackWith({ notARealProp: 'whatever' }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('has no prop "notARealProp"');
  });

  it('catches a violation nested inside an array prop', () => {
    const spec = {
      root: 'd',
      elements: {
        d: {
          type: 'DataTable',
          props: {
            columns: [
              { key: 'name', label: 'Name', align: 'start' },
              { key: 'qty', label: 'Qty', align: 'sideways' },
            ],
            rows: [{ name: 'a', qty: 1 }],
          },
        },
      },
    };
    const issues = builtinPropIssues(spec);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('columns.1.align');
  });

  it('reports every offending element, not just the first', () => {
    const spec = {
      root: 'a',
      elements: {
        a: { type: 'Stack', props: { gap: 'xs' }, children: ['b'] },
        b: { type: 'Stack', props: { direction: 'column' }, children: ['t'] },
        t: { type: 'Text', props: { text: 'x' } },
      },
    };
    expect(builtinPropIssues(spec)).toHaveLength(2);
  });
});

describe('opt-out + standalone surface', () => {
  it('{ props: false } reproduces the historical pre-gate behaviour', () => {
    expect(validateSpec(stackWith({ direction: 'column' }), { props: false }).valid).toBe(true);
  });

  it('validateBuiltinProps runs standalone against a spec', () => {
    expect(validateBuiltinProps(stackWith({ direction: 'vertical' })).valid).toBe(true);
    const bad = validateBuiltinProps(stackWith({ direction: 'column' }));
    expect(bad.valid).toBe(false);
    expect(bad.errors).toHaveLength(1);
  });

  it('is inert on a spec with no elements map', () => {
    expect(builtinPropIssues(null)).toEqual([]);
    expect(builtinPropIssues({})).toEqual([]);
  });
});

describe('KNOWN CONSEQUENCE — the two values the runtime normalises are still rejected', () => {
  /**
   * These are not bugs in the gate; they are the measured cost of it, pinned
   * here so the trade-off is visible in the suite instead of only in a report.
   *
   * Adjudicated by reading packages/runtime/src/react/registry: of the
   * distinct out-of-enum shapes observed across generated specs, exactly TWO
   * are values the runtime deliberately normalises, i.e. specs that render
   * CORRECTLY and that this gate now sends to the fallback:
   *
   *   Heading.level: 3            data-display.tsx Heading()
   *                               `String(p.level ?? 'h2').replace(/^h/,'')` →
   *                               1|2|3|4 coerce to h1..h4.
   *   DataTable.columns[].align   data-table.tsx normAlign() maps left→start,
   *     = "left" | "right"        right→end, with a comment saying the alias
   *                               exists BECAUSE validation is lenient.
   *
   * They are a minority of findings, and specs failing ONLY on these are rare;
   * on the current known-good set: zero.
   *
   * Reconciling them is a vocabulary decision (widen the catalog enums to match
   * the runtime, or drop the runtime aliases now that the front door is strict).
   * Whichever way it goes, these two assertions must be revisited.
   */
  it('rejects Heading.level: 3 — which the renderer coerces to h3', () => {
    const spec = { root: 'h', elements: { h: { type: 'Heading', props: { text: 'Coverage', level: 3 } } } };
    expect(validateSpec(spec).valid).toBe(false);
    expect(validateSpec(spec).failureCategory).toBe('invalid_prop_value');
    // the canon form is accepted
    expect(validateSpec({ root: 'h', elements: { h: { type: 'Heading', props: { text: 'Coverage', level: 'h3' } } } }).valid).toBe(true);
  });

  it('rejects DataTable align "right" — which normAlign renders as end', () => {
    const mk = (align: string) => ({
      root: 'd',
      elements: { d: { type: 'DataTable', props: { columns: [{ key: 'qty', label: 'Qty', align }], rows: [{ qty: 1 }] } } },
    });
    expect(validateSpec(mk('right')).valid).toBe(false);
    expect(validateSpec(mk('end')).valid).toBe(true);
  });
});

/* ── BYOC: the custom path must be untouched ─────────────────────────────── */

const GAUGE: ManifestInput = {
  name: 'RiskGauge',
  description:
    'Semicircular gauge that plots a single score against a banded scale, with the band label called out beneath the needle. Use it for a risk, health, or confidence readout where the band matters more than the exact number.',
  props: {
    score: { kind: 'count', min: 0, max: 100, doc: 'The number of points the needle rests at, from 0 to 100, which also selects the band shown underneath.' },
    band: { kind: 'enum', values: ['low', 'medium', 'high'], doc: 'Which risk band to highlight on the arc; drives the band colour and the caption text.' },
  },
  events: ['select'],
  eventsDoc: { select: 'Fires when the user clicks a band on the arc; value is the band name.' },
  example: { score: 62, band: 'medium' },
};

describe('BYOC — custom components validate exactly as before', () => {
  const compiled = [defineFraymeComponent(GAUGE)];
  const union = extendCatalog(compiled);
  const specWith = (props: Record<string, unknown>) => ({
    root: 'g',
    elements: { g: { type: 'RiskGauge', props } },
  });

  it('the built-in gate IGNORES custom types (it only knows built-in names)', () => {
    // an out-of-enum CUSTOM prop is not this gate's business…
    expect(builtinPropIssues(specWith({ score: 62, band: 'severe' }))).toEqual([]);
  });

  it('…and validateManifestProps still catches it, as it always did', () => {
    const r = validateManifestProps(specWith({ score: 62, band: 'severe' }), compiled);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('band');
  });

  it('a valid custom spec passes both gates through the union catalog', () => {
    const spec = specWith({ score: 62, band: 'medium' });
    expect(validateSpec(spec, { catalog: union }).valid).toBe(true);
    expect(validateManifestProps(spec, compiled).valid).toBe(true);
  });

  it('a union spec still gets its BUILT-IN elements gated', () => {
    // the mixed case: customs pass through, built-ins are checked
    const spec = {
      root: 's',
      elements: {
        s: { type: 'Stack', props: { direction: 'column' }, children: ['g'] },
        g: { type: 'RiskGauge', props: { score: 62, band: 'medium' } },
      },
    };
    const r = validateSpec(spec, { catalog: union });
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('invalid_prop_value');
    expect(r.errors[0]).toContain('elements.s.props.direction');
  });
});
