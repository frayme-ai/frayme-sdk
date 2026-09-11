/**
 * `$computed` — the golden function registry, and the fabrication hole it closes.
 *
 * Before this, Frayme registered ZERO `$computed` functions. @json-render/core
 * warns and returns `undefined` for an unknown one, and two components turned
 * that undefined into a confident number: a live SSR probe had `Gauge` printing
 * "0" with the accessible name "Gauge: 0 of 0–100", and `ProgressCircle`
 * printing "0%" — both from a function nobody had registered, both passing
 * `.validate()`. (`Stat` correctly rendered blank; `Progress` showed `NaN%` —
 * loud, therefore safe.)
 *
 * Every function is proved BOTH WAYS: a case where it must produce the number,
 * and a case where it must refuse and return `undefined`.
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import {
  fraymeComputedFunctions as fns,
  COMPUTED_FUNCTION_NAMES,
} from '../src/react/functions.js';

/* ── the frozen vocabulary ────────────────────────────────────────────────── */

/**
 * PIN. The catalog's resolution gate holds a mirror of this list (it must — the
 * dependency runs runtime → catalog, so the catalog cannot import the runtime
 * back). `packages/catalog/test/resolution-computed.test.ts` pins the mirror to
 * this same literal, so drift on either side turns the other red.
 *
 * ADD ONLY. Once specs rely on these names, renaming or removing one
 * silently breaks every spec that uses it.
 */
const EXPECTED = ['sum', 'subtract', 'product', 'divide', 'mean', 'percentChange'];

describe('the registered set', () => {
  it('is exactly the frozen six', () => {
    expect([...COMPUTED_FUNCTION_NAMES].sort()).toEqual([...EXPECTED].sort());
  });

  it('names are derived from the registry, so none can be claimed without an implementation', () => {
    for (const name of COMPUTED_FUNCTION_NAMES) {
      expect(typeof (fns as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

/* ── aggregation over a collection ────────────────────────────────────────── */

const items = [{ amount: 120 }, { amount: 80.5 }, { amount: 12 }];

describe('sum', () => {
  it('totals a column of a collection', () => {
    expect(fns.sum({ over: items, field: 'amount' })).toBe(212.5);
  });
  it('totals a dotted field path', () => {
    expect(fns.sum({ over: [{ price: { net: 10 } }, { price: { net: 5 } }], field: 'price.net' })).toBe(15);
  });
  it('totals a bare array of numbers', () => {
    expect(fns.sum({ over: [1, 2, 3] })).toBe(6);
  });
  it('totals an explicit values list', () => {
    expect(fns.sum({ values: [1.5, 2.5] })).toBe(4);
  });
  it('totals two scalars', () => {
    expect(fns.sum({ a: 40, b: 2 })).toBe(42);
  });
  it('kills float residue: 0.1 + 0.2 is 0.3, not 0.30000000000000004', () => {
    expect(fns.sum({ values: [0.1, 0.2] })).toBe(0.3);
  });

  /* NEGATIVE CONTROLS — it must refuse. */
  it('REFUSES an unseeded collection (undefined, not 0)', () => {
    expect(fns.sum({ over: undefined, field: 'amount' })).toBeUndefined();
  });
  it('REFUSES a wrong field name rather than totalling nothing as 0', () => {
    expect(fns.sum({ over: items, field: 'total' })).toBeUndefined();
  });
  it('REFUSES a partially numeric column — a total of the parseable subset LOOKS right', () => {
    expect(fns.sum({ over: [{ amount: 10 }, { amount: 'n/a' }], field: 'amount' })).toBeUndefined();
  });
  /*
   * REVERSED, DELIBERATELY. This assertion used to read "REFUSES
   * currency-formatted strings rather than guessing a locale". Measurement
   * overturned it: refusing a figure the request plainly states does not protect
   * the reader, it just empties the number out of the screen. Presentation is
   * now stripped; AMBIGUITY is still refused (see the suite below).
   */
  it('strips presentation off a currency-formatted column and totals it', () => {
    expect(fns.sum({ values: ['£1,200', '£300'] })).toBe(1500);
  });
  it('REFUSES booleans (Number(true) === 1 is not a quantity)', () => {
    expect(fns.sum({ a: true, b: 1 })).toBeUndefined();
  });
  it('REFUSES empty strings (Number("") === 0 is the exact zero-fabrication)', () => {
    expect(fns.sum({ a: '', b: 5 })).toBeUndefined();
  });
  it('REFUSES no args at all', () => {
    expect(fns.sum({})).toBeUndefined();
  });

  it('an EMPTY collection totals 0 — that is TRUE, and distinct from unseeded', () => {
    expect(fns.sum({ over: [], field: 'amount' })).toBe(0);
  });
});

describe('product', () => {
  it('multiplies two scalars (the CPQ case: qty x unitPrice)', () => {
    expect(fns.product({ a: 3, b: 24.5 })).toBe(73.5);
  });
  it('multiplies a column', () => {
    expect(fns.product({ over: [{ n: 2 }, { n: 5 }], field: 'n' })).toBe(10);
  });
  it('REFUSES a missing operand (undefined, not 0)', () => {
    expect(fns.product({ a: 3 })).toBeUndefined();
  });
  it('REFUSES an EMPTY collection — the multiplicative identity 1 is an artefact, not a fact', () => {
    expect(fns.product({ over: [], field: 'n' })).toBeUndefined();
  });
});

describe('mean', () => {
  it('averages a column', () => {
    expect(fns.mean({ over: [{ n: 2 }, { n: 4 }, { n: 9 }], field: 'n' })).toBe(5);
  });
  it('REFUSES an empty collection — the mean of nothing does not exist', () => {
    expect(fns.mean({ over: [] })).toBeUndefined();
  });
  it('REFUSES a non-array', () => {
    expect(fns.mean({ over: 5 })).toBeUndefined();
  });
});

/* ── ordered binary operands ──────────────────────────────────────────────── */

describe('subtract', () => {
  it('is a - b', () => {
    expect(fns.subtract({ a: 100, b: 42 })).toBe(58);
  });
  it('REFUSES a missing operand', () => {
    expect(fns.subtract({ a: 100 })).toBeUndefined();
  });
});

describe('divide', () => {
  it('is a / b', () => {
    expect(fns.divide({ a: 10, b: 4 })).toBe(2.5);
  });
  it('REFUSES division by zero (never Infinity)', () => {
    expect(fns.divide({ a: 10, b: 0 })).toBeUndefined();
  });
  it('REFUSES 0/0 (never NaN)', () => {
    expect(fns.divide({ a: 0, b: 0 })).toBeUndefined();
  });
  it('composes: percent-of-total is product(divide(part, whole), 100)', () => {
    const frac = fns.divide({ a: 23, b: 40 }) as number;
    expect(fns.product({ a: frac, b: 100 })).toBe(57.5);
  });
});

describe('percentChange', () => {
  it('is (to - from) / |from| * 100, as a number', () => {
    expect(fns.percentChange({ from: 200, to: 250 })).toBe(25);
  });
  it('reads a fall as negative', () => {
    expect(fns.percentChange({ from: 200, to: 150 })).toBe(-25);
  });
  it('a rise from a NEGATIVE baseline still reads as a rise', () => {
    expect(fns.percentChange({ from: -100, to: -50 })).toBe(50);
  });
  it('REFUSES a zero baseline (change from nothing is undefined, not infinite)', () => {
    expect(fns.percentChange({ from: 0, to: 50 })).toBeUndefined();
  });
  it('REFUSES the a/b spelling — the operands are named so a reversed pair cannot render silently', () => {
    expect(fns.percentChange({ a: 200, b: 250 })).toBeUndefined();
  });
});

/* ── PRESENTATION STRIPPING ───────────────────────────────────────────────────
 *
 * The operand coercion is shared by all six functions (`num`), so it is probed
 * through `sum({ values: [x] })` — the sum of one value IS the coerced value —
 * and then each of the other five is shown to inherit it, because a coercion
 * that only reached one function would be worth nothing.
 *
 * The motive: many operands arrive from the request as formatted strings, and
 * they only verify once presentation is stripped as well.
 *
 * Both directions, on every case: a formatted number must PRODUCE its value, and
 * a string that is not a parseable number must still REFUSE (undefined) — never
 * 0, which would fabricate a figure nobody can see is wrong.
 */

/** The shared coercion, isolated: sum of a single value is that value. */
const coerce = (v: unknown) => fns.sum({ values: [v] });

describe('operand coercion: presentation is stripped, ambiguity is refused', () => {
  const ACCEPTS: Array<[string, unknown, number]> = [
    ['a plain number is untouched', 214, 214],
    ['a negative number is untouched', -214, -214],
    ['a float is untouched', 1234.5, 1234.5],
    ['zero is untouched (and is not confused with a refusal)', 0, 0],
    ['a clean numeric string still parses', '12', 12],
    ['exponent notation still parses', '1e3', 1000],
    ['a signed string still parses', '-5', -5],
    ['currency symbol, leading', '$214', 214],
    ['currency symbol + thousands separators', '¥86,400,000', 86400000],
    ['thousands separator + decimal', '1,234.5', 1234.5],
    ['trailing percent (the NUMBER 42, not 0.42)', '42%', 42],
    ['accountancy parentheses are negative', '(1,200)', -1200],
    ['parenthesised currency', '($214)', -214],
    ['sign before the symbol', '-$1,200', -1200],
    ['sign after the symbol', '$-1,200', -1200],
    ['a typographic minus (U+2212)', '\u2212214', -214],
    ['an explicit plus', '+214', 214],
    ['a trailing symbol', '214€', 214],
    ['a trailing symbol with a space', '214 €', 214],
    ['a negative percent', '-42%', -42],
    ['surrounding whitespace', '  $1,234.50  ', 1234.5],
    ['NBSP grouping', '86\u00A0400\u00A0000', 86400000],
    ['narrow-NBSP grouping', '1\u202F234', 1234],
    ['thin-space grouping', '1\u2009234', 1234],
    ['plain-space grouping', '1 234', 1234],
    ['a bare decimal', '.5', 0.5],
  ];
  it.each(ACCEPTS)('accepts %s', (_name, input, expected) => {
    expect(coerce(input)).toBe(expected);
  });

  const REFUSES: Array<[string, unknown]> = [
    ['an empty string (Number("") === 0 is the fabrication)', ''],
    ['whitespace only', '   '],
    ['prose', 'not a number'],
    ['a partly numeric string', '12 apples'],
    ['a European decimal comma — AMBIGUOUS, never guessed', '1.200,50'],
    ['a two-digit group — AMBIGUOUS, never guessed', '12,34'],
    ['a comma decimal', '1,5'],
    ['two decimal points', '1.2.3'],
    ['a doubled sign', '--5'],
    ['a doubled currency symbol', '$$5'],
    ['a sign inside brackets (double negative)', '(-5)'],
    ['a currency symbol alone', '$'],
    ['a percent sign alone', '%'],
    ['empty brackets', '()'],
    ['a trailing sign', '214-'],
    ['a range', '10-20'],
    ['a currency CODE (deliberately not stripped)', 'USD 214'],
    ['a boolean', true],
    ['null', null],
    ['an array', []],
    ['an object', {}],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['the string "Infinity"', 'Infinity'],
  ];
  it.each(REFUSES)('refuses %s — undefined, never 0', (_name, input) => {
    expect(coerce(input)).toBeUndefined();
  });

  it('a refusal is undefined, NOT the number 0 (the assertion that would pass either way)', () => {
    expect(coerce('not a number')).not.toBe(0);
    expect(coerce('')).not.toBe(0);
  });

  it('one bad entry still poisons the whole column — no partial totals', () => {
    expect(fns.sum({ values: ['$10', 'n/a', '$5'] })).toBeUndefined();
  });

  it('the OUTPUT shape is unchanged: a number in, a number out — never a formatted string', () => {
    expect(typeof fns.sum({ values: ['$1,200', '$300'] })).toBe('number');
    expect(fns.sum({ values: ['$1,200', '$300'] })).toBe(1500);
  });
});

describe('every function inherits the coercion', () => {
  it('sum totals a formatted column', () => {
    expect(fns.sum({ over: [{ amt: '$1,200.50' }, { amt: '$300' }], field: 'amt' })).toBe(1500.5);
  });
  it('product multiplies formatted operands', () => {
    expect(fns.product({ a: '3', b: '$24.50' })).toBe(73.5);
  });
  it('mean averages a formatted column', () => {
    expect(fns.mean({ values: ['¥1,000', '¥2,000', '¥3,000'] })).toBe(2000);
  });
  it('subtract takes formatted operands', () => {
    expect(fns.subtract({ a: '$1,200', b: '(200)' })).toBe(1400);
  });
  it('divide takes formatted operands', () => {
    expect(fns.divide({ a: '1,000', b: '$4' })).toBe(250);
  });
  it('percentChange takes formatted operands', () => {
    expect(fns.percentChange({ from: '$200', to: '$250' })).toBe(25);
  });

  /* NEGATIVE CONTROL on each — the coercion must not have loosened refusal. */
  it.each([
    ['sum', () => fns.sum({ a: 'n/a', b: '$5' })],
    ['product', () => fns.product({ a: 'n/a', b: '$5' })],
    ['mean', () => fns.mean({ values: ['n/a', '$5'] })],
    ['subtract', () => fns.subtract({ a: 'n/a', b: '$5' })],
    ['divide', () => fns.divide({ a: 'n/a', b: '$5' })],
    ['percentChange', () => fns.percentChange({ from: 'n/a', to: '$5' })],
  ])('%s still REFUSES an unparseable operand', (_name, run) => {
    expect(run()).toBeUndefined();
  });

  it('divide still refuses a formatted ZERO divisor (never Infinity)', () => {
    expect(fns.divide({ a: '$10', b: '$0' })).toBeUndefined();
  });
  it('percentChange still refuses a formatted ZERO baseline', () => {
    expect(fns.percentChange({ from: '$0', to: '$50' })).toBeUndefined();
  });
});

/* ── end to end, through react-dom/server (the original probe's path) ─────── */

const ssr = (spec: unknown) =>
  renderToString(<FraymeRenderer spec={spec as Spec} mode="progressive" />);

const one = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}) =>
  ssr({ root: 'el', elements: { el: { type, props } }, state });

describe('registration reaches every render path', () => {
  it('resolves a collection total server-side', () => {
    const html = one(
      'Gauge',
      { value: { $computed: 'sum', args: { over: { $state: '/lineItems' }, field: 'amount' } }, max: 1000 },
      { lineItems: [{ amount: 120 }, { amount: 80.5 }] },
    );
    expect(html).toContain('200.5');
    expect(html).toContain('Gauge: 200.5 of 0');
  });

  it('resolves nested $computed args (core resolves args recursively)', () => {
    const html = one(
      'ProgressCircle',
      {
        value: {
          $computed: 'product',
          args: { a: { $computed: 'divide', args: { a: { $state: '/done' }, b: { $state: '/total' } } }, b: 100 },
        },
      },
      { done: 23, total: 40 },
    );
    // 23/40 = 0.575 -> 57.5. The ring's own readout rounds it (and `0.575 * 100`
    // is 57.49999999999999 in binary, so it rounds DOWN) — the point here is that
    // the nested divide resolved at all: the arc is drawn at 57.50 of 100.
    expect(html).toContain('stroke-dasharray="57.50 100"');
    expect(html).toContain('57%');
  });
});

/* ── the fabrication hole: unresolved must never render as a number ───────── */

describe('Gauge with an unresolved value', () => {
  const unresolved = { $computed: 'notARegisteredFunction', args: { a: 1 } };

  it('renders the empty state, not a fabricated 0', () => {
    const html = one('Gauge', { value: unresolved });
    expect(html).not.toContain('Gauge: 0 of 0');
    expect(html).toContain('Gauge: no value of 0');
    expect(html).toContain('–'); // en dash where the number goes
  });

  it('draws no value arc — only the track', () => {
    const empty = one('Gauge', { value: unresolved });
    const filled = one('Gauge', { value: 40 });
    expect(empty.match(/<path/g)?.length).toBeLessThan(filled.match(/<path/g)!.length);
  });

  it('does not light a threshold band it cannot have reached', () => {
    const html = one('Gauge', {
      value: unresolved,
      thresholds: [{ value: 0, color: '#ff0000', label: 'Critical' }],
    });
    expect(html).not.toContain('Critical');
  });

  it('an unseeded $state binding fails the same way', () => {
    expect(one('Gauge', { value: { $state: '/nothingHere' } })).toContain('Gauge: no value of 0');
  });

  /* NEGATIVE CONTROL — the fix must refuse to blank a real value, including 0. */
  it('a REAL value still renders (the fix does not blank good data)', () => {
    const html = one('Gauge', { value: 73, unit: 'MW' });
    expect(html).toContain('73');
    expect(html).toContain('MW');
    expect(html).toContain('Gauge: 73');
  });

  it('a literal 0 is a real reading and still renders as 0', () => {
    const html = one('Gauge', { value: 0 });
    expect(html).toContain('Gauge: 0 of 0');
    expect(html).not.toContain('no value');
  });
});

describe('ProgressCircle with an unresolved value', () => {
  const unresolved = { $computed: 'notARegisteredFunction', args: { a: 1 } };

  it('renders the empty state, not a fabricated 0%', () => {
    const html = one('ProgressCircle', { value: unresolved, label: 'Onboarding' });
    expect(html).not.toContain('0%');
    expect(html).toContain('–');
    expect(html).toContain('Onboarding — no value');
  });

  it('names the empty state for a screen reader', () => {
    expect(one('ProgressCircle', { value: unresolved })).toContain('aria-label="no value"');
  });

  /* NEGATIVE CONTROLS. */
  it('a REAL value still renders its percentage', () => {
    expect(one('ProgressCircle', { value: 62 })).toContain('62%');
  });

  it('a literal 0 is a real reading and still renders as 0%', () => {
    const html = one('ProgressCircle', { value: 0 });
    expect(html).toContain('0%');
    expect(html).not.toContain('no value');
  });
});

/**
 * Slider — the residual the registry itself created.
 *
 * `Slider` read `const current = value ?? min`, so an unresolved value rendered
 * the readout "0", the DOM `value="0"` a Form submits, and a screen reader
 * announcing "0". It could not fire before this registry existed (nothing
 * resolved a `$computed` at all); the moment a REGISTERED function could
 * legitimately return `undefined` — `divide({a:1,b:0})`, `sum` over an unseeded
 * collection, every refusal above — it became a live path.
 *
 * Generated specs carry many Slider elements; a handful bind a `$bindState`
 * path the spec never seeds (one of them `min: 5`, i.e. a confident "Session
 * timeout 5 minutes" nobody set), and none authors `value: null`.
 */
describe('Slider with an unresolved value', () => {
  const base = { label: 'Budget', name: 'budget', min: 0, max: 1000, valueSuffix: '£' };
  /* `renderToString` splits adjacent text nodes with an empty comment, so the
     readout arrives as `250<!-- -->£`. Strip them, or every assertion about the
     printed number silently cannot fire — `expect(html).not.toContain('0£')`
     would pass on a render that says exactly "0£". */
  const readout = (props: Record<string, unknown>, state?: Record<string, unknown>) =>
    one('Slider', props, state ?? {}).replaceAll('<!-- -->', '');

  it('the readout detector can fire (a real 0 DOES print "0£")', () => {
    expect(readout({ ...base, value: 0 })).toContain('0£');
  });
  const unresolvedCases: Array<[string, unknown]> = [
    ['a registered function that correctly returns undefined', { $computed: 'divide', args: { a: 1, b: 0 } }],
    ['sum over an unseeded collection', { $computed: 'sum', args: { over: { $state: '/nope' }, field: 'x' } }],
    ['a $bindState path nothing seeds', { $bindState: '/nothingHere' }],
  ];

  it.each(unresolvedCases)('renders a dash, not a number — %s', (_name, value) => {
    const html = readout({ ...base, value });
    expect(html).toContain('–');
    expect(html).not.toContain('0£');
  });

  it('says "no value" to a screen reader rather than reading the resting thumb', () => {
    const html = one('Slider', { ...base, value: { $computed: 'divide', args: { a: 1, b: 0 } } });
    expect(html).toContain('aria-valuetext="no value"');
    expect(html).toContain('data-fr-unresolved=""');
  });

  it('contributes NO field to a Form submit (FormData reads the DOM)', () => {
    // `Form` collects with `new FormData(node)`, so a named range input submits
    // its resting position. Absent beats a fabricated 0: the caller can see it.
    expect(one('Slider', { ...base, value: { $computed: 'divide', args: { a: 1, b: 0 } } })).not.toContain('name="budget"');
    expect(one('Slider', { ...base, value: 42 })).toContain('name="budget"');
  });

  it('does not print the MIN as if it were the value', () => {
    // A real generated spec: min 5, bound to `/sessionTimeout`, which the spec never seeds.
    const html = readout({ label: 'Session timeout', name: 't', min: 5, max: 120, valueSuffix: ' min', value: { $state: '/sessionTimeout' } });
    expect(html).not.toContain('5 min<');
    expect(html).toContain('–');
    // control: the same slider with a real value DOES print "5 min"
    expect(readout({ label: 'Session timeout', name: 't', min: 5, max: 120, valueSuffix: ' min', value: 5 })).toContain('5 min<');
  });

  it('paints no filled track — a fill is a claim about where the thumb is', () => {
    const unresolved = one('Slider', { ...base, trackColor: '#eeeeee', value: { $computed: 'divide', args: { a: 1, b: 0 } } });
    const resolved = one('Slider', { ...base, trackColor: '#eeeeee', value: 500 });
    expect(unresolved).toContain('--fr-slider-pct:0%');
    expect(resolved).toContain('--fr-slider-pct:50%');
  });

  it('reaches the hidden-label readout too (the second place the number is printed)', () => {
    const html = readout({ ...base, labelPlacement: 'hidden', value: { $computed: 'divide', args: { a: 1, b: 0 } } });
    expect(html).toContain('–');
    expect(html).not.toContain('0£');
    expect(readout({ ...base, labelPlacement: 'hidden', value: 0 })).toContain('0£'); // control
  });

  /* NEGATIVE CONTROLS — the fix must not blank good data. */
  it.each([
    ['a literal value', 42, '42£'],
    ['a literal 0 — a real reading, not an absence', 0, '0£'],
  ])('%s still renders', (_n, value, expected) => {
    const html = readout({ ...base, value });
    expect(html).toContain(expected as string);
    expect(html).toContain('name="budget"');
    expect(html).not.toContain('aria-valuetext="no value"');
  });

  it('a RESOLVED $computed still renders its number', () => {
    const html = readout({ ...base, value: { $computed: 'divide', args: { a: 120, b: 4 } } });
    expect(html).toContain('30£');
    expect(html).not.toContain('no value');
  });

  it('a seeded $bindState still renders its number', () => {
    const html = readout({ ...base, value: { $bindState: '/budget' } }, { budget: 250 });
    expect(html).toContain('250£');
  });
});
