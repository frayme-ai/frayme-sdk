/**
 * `$computed` in the render-resolution gate.
 *
 * `{ $computed: "<name>", args }` calls a HOST-REGISTERED function. An
 * unregistered name makes @json-render/core warn and return `undefined`, and a
 * component renders that undefined — a live SSR probe had `Gauge` printing a
 * confident "0" for a function nobody had registered.
 *
 * Measured before this gate existed, with a working control alongside (an
 * unknown `$token` was caught, so the walker itself was firing): the validator
 * PASSED a `$computed` whose name was a NUMBER, PASSED an unregistered function
 * name, PASSED with no args at all, and never walked `args` — so a malformed
 * `$cond` nested inside them validated clean too. All four are asserted here as
 * rejections, each with a legal counterpart that must still pass.
 */
import { describe, expect, it } from 'vitest';
import { validateResolution, COMPUTED_FUNCTIONS } from '../src/validate/resolution.js';

/** Wrap a prop value in the smallest spec the gate will walk. */
const spec = (value: unknown) => ({
  root: 'g',
  elements: { g: { type: 'Gauge', props: { value } } },
  state: { lineItems: [{ amount: 1 }], a: 1, b: 2 },
});

const run = (value: unknown, opts?: Parameters<typeof validateResolution>[1]) =>
  validateResolution(spec(value), opts);

/* ── the frozen vocabulary ────────────────────────────────────────────────── */

/**
 * PIN — the mirror of `@frayme/runtime`'s `COMPUTED_FUNCTION_NAMES`.
 *
 * The implementations live in the runtime, which already depends on this
 * package; the catalog cannot import the runtime back without cycling the two.
 * So the set here is a deliberate mirror, and this literal is the same one
 * `packages/runtime/test/computed-functions.test.tsx` pins — change either side
 * and the other goes red.
 */
const EXPECTED = ['sum', 'subtract', 'product', 'divide', 'mean', 'percentChange'];

it('the registered set is exactly the frozen six', () => {
  expect([...COMPUTED_FUNCTIONS].sort()).toEqual([...EXPECTED].sort());
});

/* ── the four holes ───────────────────────────────────────────────────────── */

describe('rejects what used to pass', () => {
  it('a function name that is a NUMBER', () => {
    const r = run({ $computed: 123, args: { a: 1, b: 2 } });
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('must be a non-empty string');
  });

  it('an empty function name', () => {
    expect(run({ $computed: '', args: { a: 1, b: 2 } }).valid).toBe(false);
  });

  it('an UNREGISTERED function name', () => {
    const r = run({ $computed: 'grandTotal', args: { a: 1, b: 2 } });
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('is not a registered function');
  });

  it('no args at all — it can only ever resolve to undefined', () => {
    const r = run({ $computed: 'sum' });
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('has no args');
  });

  it('args that are not an object', () => {
    expect(run({ $computed: 'sum', args: [1, 2] }).valid).toBe(false);
    expect(run({ $computed: 'sum', args: 5 }).valid).toBe(false);
  });

  it('a malformed $cond NESTED in args (args were never walked)', () => {
    const r = run({ $computed: 'sum', args: { a: { $cond: { $state: '/a', eq: 1 } }, b: 2 } });
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('$cond must be a ternary');
  });

  it('an unknown binding token nested in args', () => {
    const r = run({ $computed: 'sum', args: { a: { $nope: '/a' }, b: 2 } });
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('unknown binding token');
  });

  it('a stray sibling key on the $computed node', () => {
    const r = run({ $computed: 'sum', args: { a: 1, b: 2 }, over: '/lineItems' });
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('not part of a $computed node');
  });
});

/* ── arg shapes ───────────────────────────────────────────────────────────── */

describe('arg shapes', () => {
  it('accepts every shape the runtime implements', () => {
    const legal: unknown[] = [
      { $computed: 'sum', args: { over: { $state: '/lineItems' }, field: 'amount' } },
      { $computed: 'sum', args: { values: [1, 2, 3] } },
      { $computed: 'sum', args: { a: { $state: '/a' }, b: { $state: '/b' } } },
      { $computed: 'product', args: { a: 3, b: 24.5 } },
      { $computed: 'mean', args: { over: { $state: '/lineItems' }, field: 'amount' } },
      { $computed: 'subtract', args: { a: 100, b: 42 } },
      { $computed: 'divide', args: { a: 10, b: 4 } },
      { $computed: 'percentChange', args: { from: 200, to: 250 } },
      // nested: percent-of-total composes out of the six
      {
        $computed: 'product',
        args: { a: { $computed: 'divide', args: { a: { $state: '/a' }, b: { $state: '/b' } } }, b: 100 },
      },
    ];
    for (const v of legal) {
      const r = run(v);
      expect(r.errors, JSON.stringify(v)).toEqual([]);
      expect(r.valid).toBe(true);
    }
  });

  it('rejects args a function does not accept', () => {
    const r = run({ $computed: 'sum', args: { total: { $state: '/a' } } });
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('is not a shape "sum" accepts');
  });

  it('rejects a binary function given only one operand', () => {
    expect(run({ $computed: 'subtract', args: { a: 1 } }).valid).toBe(false);
  });

  it('rejects the a/b spelling of percentChange (operands are named on purpose)', () => {
    expect(run({ $computed: 'percentChange', args: { a: 200, b: 250 } }).valid).toBe(false);
  });

  it('rejects `field` without `over` — it would be ignored', () => {
    expect(run({ $computed: 'sum', args: { values: [1, 2], field: 'amount' } }).valid).toBe(false);
  });
});

/* ── the same gate inside `on` / `watch` params ───────────────────────────── */

describe('reaches action params too', () => {
  const withParams = (params: unknown) => ({
    root: 'b',
    elements: { b: { type: 'Button', props: { label: 'Go' }, on: { press: { action: 'quote', params } } } },
    state: {},
  });

  it('catches an unregistered function in on.press params', () => {
    const r = validateResolution(withParams({ total: { $computed: 'grandTotal', args: { a: 1, b: 2 } } }));
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('is not a registered function');
  });

  it('accepts a registered one in the same place', () => {
    const r = validateResolution(withParams({ total: { $computed: 'sum', args: { a: 1, b: 2 } } }));
    expect(r.errors).toEqual([]);
  });
});

/* ── BYOC: a host that registers extra functions ──────────────────────────── */

describe('host-registered extras', () => {
  it('are rejected by default', () => {
    expect(run({ $computed: 'taxFor', args: { a: 1 } }).valid).toBe(false);
  });

  it('are accepted when the host declares them, with no arg-shape guess', () => {
    const r = run({ $computed: 'taxFor', args: { region: 'UK', net: 100 } }, { computedFunctions: ['taxFor'] });
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('still walk their args', () => {
    const r = run(
      { $computed: 'taxFor', args: { net: { $nope: 1 } } },
      { computedFunctions: ['taxFor'] },
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('unknown binding token');
  });

  it('do not widen the built-ins for anything else', () => {
    expect(run({ $computed: 'grandTotal', args: { a: 1 } }, { computedFunctions: ['taxFor'] }).valid).toBe(false);
  });
});

/* ── the gate did not start rejecting everything ──────────────────────────── */

describe('untouched constructs still pass', () => {
  it.each([
    ['$state', { $state: '/a' }],
    ['$template', { $template: 'Total: ${/a}' }],
    ['$cond ternary', { $cond: { $state: '/a', eq: 1 }, $then: 'y', $else: 'n' }],
    ['a literal', 42],
  ])('%s', (_name, value) => {
    expect(run(value).errors).toEqual([]);
  });
});

/* ── the DEFAULT path (this is the one /v1/compose walks) ─────────────────── */

/**
 * The five holes above were closed inside `validateResolution` — which
 * `validateSpec` only runs behind `{resolution:true}`, and the serving path has
 * never set it. Measured both ways at the time: with `{resolution:true}` all
 * five malformed nodes were blocked; with the DEFAULT opts every one PASSED, so
 * a model emitting `{"$computed":"totalPrice"}` validated clean at compose and
 * the component rendered the resulting `undefined` as a confident figure.
 *
 * These assert the gate through `validateSpec` at its defaults — no options at
 * all, byte-identical to the serving call. Each one FAILED before the promotion.
 */
import { validateSpec } from '../src/validate/ops.js';

/** The same wrapper as `spec()` above, but walked by the full public validator. */
const dflt = (value: unknown, opts?: Parameters<typeof validateSpec>[1]) =>
  validateSpec(spec(value), opts);

describe('the $computed gate runs with NO options passed', () => {
  it.each([
    ['a function name that is a NUMBER', { $computed: 123, args: { a: 1, b: 2 } }, 'must be a non-empty string'],
    ['an UNREGISTERED function name', { $computed: 'totalPrice', args: { a: 1, b: 2 } }, 'is not a registered function'],
    ['no args at all', { $computed: 'sum' }, 'has no args'],
    ['args that are not an object', { $computed: 'sum', args: [1, 2] }, 'must be an object keyed by argument name'],
    ['an arg shape the function does not accept', { $computed: 'sum', args: { total: 1 } }, 'is not a shape "sum" accepts'],
    ['a malformed expression NESTED in args (args were never walked)', { $computed: 'sum', args: { a: { $computed: 'nope', args: { a: 1, b: 2 } }, b: 2 } }, 'is not a registered function'],
  ])('rejects %s', (_name, value, needle) => {
    const r = dflt(value);
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain(needle);
    expect(r.failureCategory).toBe('invalid_binding');
  });

  it('accepts every legal shape', () => {
    for (const v of [
      { $computed: 'divide', args: { a: { $state: '/a' }, b: { $state: '/b' } } },
      { $computed: 'sum', args: { over: { $state: '/lineItems' }, field: 'amount' } },
      { $computed: 'product', args: { a: { $computed: 'divide', args: { a: 1, b: 2 } }, b: 100 } },
    ]) {
      expect(dflt(v).errors, JSON.stringify(v)).toEqual([]);
    }
  });

  it('reaches a $computed hidden in a $cond branch', () => {
    const r = dflt({ $cond: { $state: '/a', eq: 1 }, $then: { $computed: 'grandTotal', args: { a: 1, b: 2 } }, $else: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toContain('is not a registered function');
  });

  it('reaches action params — on and watch alike', () => {
    const bad = { $computed: 'grandTotal', args: { a: 1, b: 2 } };
    const on = validateSpec({
      root: 'b', state: {},
      elements: { b: { type: 'Button', props: { label: 'Go' }, on: { press: { action: 'quote', params: { total: bad } } } } },
    });
    expect(on.valid).toBe(false);
    const watch = validateSpec({
      root: 'b', state: { a: 1 },
      elements: { b: { type: 'Button', props: { label: 'Go' }, watch: { '/a': { action: 'quote', params: { total: bad } } } } },
    });
    expect(watch.valid).toBe(false);
  });

  it('honours the host registry and the opt-out', () => {
    const v = { $computed: 'taxFor', args: { region: 'UK', net: 100 } };
    expect(dflt(v).valid).toBe(false);
    expect(dflt(v, { computedFunctions: ['taxFor'] }).valid).toBe(true);
    // the historical lenient behaviour, still reachable
    expect(dflt(v, { computed: false }).valid).toBe(true);
  });
});

/**
 * THE BLAST-RADIUS DECISION, pinned.
 *
 * Only the `$computed` checks were promoted, not the whole resolution gate.
 * Replaying specs that currently validate, the FULL gate newly rejects a
 * meaningful share of them, each of which would then fall through to the
 * fallback; the `$computed` subset newly rejects ZERO. The four constructs
 * below are real examples of what the full gate rejects. They stay ACCEPTED by
 * default (and rejected under
 * `{resolution:true}`) until each has been measured on its own — if a later
 * change starts failing these, it has widened the default gate silently.
 */
describe('the rest of the resolution grammar is STILL opt-in', () => {
  it.each([
    ['an $event param token', { root: 'b', state: {}, elements: { b: { type: 'Button', props: { label: 'Go' }, on: { press: { action: 'move', params: { cardId: { $event: 'value' } } } } } } }],
    ['an invented element field', { root: 'b', state: {}, elements: { b: { type: 'Button', props: { label: 'Go' }, readOnly: true } } }],
    ['a bogus confirm variant', { root: 'b', state: {}, elements: { b: { type: 'Button', props: { label: 'Go' }, on: { press: { action: 'wipe', confirm: { message: 'Sure?', variant: 'dangerous' } } } } } }],
    ['a malformed $cond', { root: 'g', state: { a: 1 }, elements: { g: { type: 'Gauge', props: { value: { $cond: { $state: '/a', eq: 1 } } } } } }],
  ])('%s passes by default and fails under {resolution:true}', (_name, s) => {
    expect(validateSpec(s).valid).toBe(true);
    expect(validateSpec(s, { resolution: true }).valid).toBe(false);
  });
});
