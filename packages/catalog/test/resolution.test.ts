import { describe, expect, it } from 'vitest';
import { validateSpec, validateResolution } from '../src/validate/index.js';

/**
 * The render-resolution gate (validate/resolution.ts) catches the binding /
 * visibility / element-envelope / action-kind grammar the catalog validator is
 * blind to (the element envelope is passthrough; `spec.actions` is `s.any()`).
 *
 * Core property each fixture asserts: the OLD path (`validateSpec` with no opts)
 * returns valid — proving the gate is needed — and the NEW path
 * (`{ resolution: true }`) returns invalid with the right category.
 */

/** Bad fixtures: each is catalog-valid but uses invented/malformed grammar. */
const BAD: Array<{ name: string; category: string; spec: unknown }> = [
  {
    name: 'invented `if` element field (real field is `visible`)',
    category: 'unknown_element_key',
    spec: {
      root: 'c',
      elements: { c: { type: 'Alert', props: { type: 'warning', title: 'X' }, if: { $state: '/x' } } },
    },
  },
  {
    name: '$template with bare {/path} instead of ${/path}',
    category: 'invalid_binding',
    spec: { root: 't', elements: { t: { type: 'Text', props: { text: { $template: 'Count: {/count}' } } } } },
  },
  {
    name: '$cond missing $then/$else (not a ternary)',
    category: 'invalid_binding',
    spec: {
      root: 'b',
      elements: { b: { type: 'Button', props: { label: { $cond: { $state: '/a', eq: 'y' } } } } },
    },
  },
  {
    name: '$cond operator-array form ({"!==":[...]}) does not exist',
    category: 'invalid_binding',
    spec: {
      root: 'b',
      elements: {
        b: {
          type: 'Button',
          props: { label: { $cond: { '!==': [{ $state: '/a' }, 'y'] }, $then: 'A', $else: 'B' } },
        },
      },
    },
  },
  {
    name: 'spec.actions[].kind typo (recompoze)',
    category: 'invalid_action_kind',
    spec: {
      root: 'b',
      state: {},
      actions: { go: { kind: 'recompoze', prompt: 'x' } },
      elements: { b: { type: 'Button', props: { label: 'Go' }, on: { press: { action: 'go' } } } },
    },
  },
  {
    name: 'watch handler missing a string action',
    category: 'invalid_directive',
    spec: {
      root: 's',
      elements: {
        s: { type: 'Select', props: { value: { $bindState: '/country' } }, watch: { '/country': { params: {} } } },
      },
    },
  },
  {
    name: 'on.press.action is not a string',
    category: 'invalid_directive',
    spec: {
      root: 'b',
      elements: { b: { type: 'Button', props: { label: 'Go' }, on: { press: { action: { $state: '/x' } } } } },
    },
  },
  {
    name: 'built-in setState without params.statePath',
    category: 'invalid_directive',
    spec: {
      root: 'b',
      state: { count: 0 },
      elements: { b: { type: 'Button', props: { label: '+' }, on: { press: { action: 'setState', params: { value: 1 } } } } },
    },
  },
];

/** Valid fixtures: real json-render grammar — must pass the gate. */
const GOOD: Array<{ name: string; spec: unknown }> = [
  {
    name: 'visible + $template + $bindState + built-in setState',
    spec: {
      root: 's',
      state: { count: 0, show: true },
      elements: {
        s: { type: 'Stack', props: { gap: 'sm' }, children: ['t', 'i', 'b'] },
        t: { type: 'Text', props: { text: { $template: 'Count: ${/count}' } } },
        i: { type: 'Input', props: { label: 'N', name: 'n', value: { $bindState: '/count' } } },
        b: {
          type: 'Button',
          props: { label: '+' },
          visible: { $state: '/show', eq: true },
          on: { press: { action: 'setState', params: { statePath: '/count', value: 1 } } },
        },
      },
    },
  },
  {
    name: '$cond ternary + spec.actions recompose + watch + repeat',
    spec: {
      root: 'card',
      state: { country: 'US', items: [] },
      actions: { submit: { kind: 'recompose', prompt: 'go', mode: 'edit' }, cancel: false },
      elements: {
        card: { type: 'Card', props: { title: 'Form' }, children: ['sel', 'list'] },
        sel: {
          type: 'Select',
          props: { label: 'Country', name: 'country', options: [{ label: 'US', value: 'US' }], value: { $bindState: '/country' } },
          watch: { '/country': [{ action: 'setState', params: { statePath: '/items', value: [] } }] },
        },
        list: {
          type: 'Stack',
          props: { gap: { $cond: { $state: '/country', eq: 'US' }, $then: 'sm', $else: 'lg' } },
          repeat: { statePath: '/items', key: 'id' },
          children: [],
        },
      },
    },
  },
];

describe('validateResolution (render-resolution gate)', () => {
  it.each(BAD)('rejects: $name', ({ category, spec }) => {
    // Old path is blind — proves the gate is necessary. `props: false` IS the old
    // path: the prop gate also reports wrong types / unknown names /
    // missing required, and some of these fixtures carry one incidentally.
    expect(validateSpec(spec, { props: false }).valid).toBe(true);
    // New path catches it with the right category.
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid).toBe(false);
    expect(gated.failureCategory).toBe(category);
    expect(gated.errors.length).toBeGreaterThan(0);
  });

  it.each(GOOD)('accepts real grammar: $name', ({ spec }) => {
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid, gated.errors.join(' | ')).toBe(true);
  });

  it('validateResolution is callable standalone', () => {
    const r = validateResolution({ root: 'b', elements: { b: { type: 'Button', props: { label: 'X' }, oops: 1 } } });
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('unknown_element_key');
  });

  it('is off by default (backward compatible)', () => {
    const bad = { root: 'c', elements: { c: { type: 'Alert', props: { title: 'Heads up' }, if: {} } } };
    expect(validateSpec(bad).valid).toBe(true); // no opts → the resolution gate stays off
  });
});

describe('value-channel gate (unsafe color / dimension / count)', () => {
  /** A single Text element carrying the given props (kept flat so brace-laden
   *  injection strings don't sit next to structural braces). */
  const textSpec = (props: Record<string, unknown>) => ({
    root: 't',
    elements: { t: { type: 'Text', props: { text: 'hi', ...props } } },
  });

  /** Each is catalog-valid (unknown value props are stripped) but carries an unsafe VALUE. */
  const UNSAFE: Array<{ name: string; spec: unknown }> = [
    { name: 'unsafe color value (injection)', spec: textSpec({ color: 'red; background:url(//evil)' }) },
    { name: 'unsafe color value (var() — tokens are an enum concern)', spec: textSpec({ accent: 'var(--evil)' }) },
    { name: 'unsafe dimension value (break-out)', spec: textSpec({ width: '10px;}x{' }) },
    { name: 'unsafe dimension value (calc)', spec: textSpec({ minHeight: 'calc(100% - 1px)' }) },
    { name: 'unsafe count value (carries a unit / injection)', spec: textSpec({ lines: '3;{}' }) },
  ];

  it.each(UNSAFE)('rejects: $name', ({ spec }) => {
    // Old path is blind (unknown value props are stripped, shape is fine).
    // `props: false` is that old path — the widened prop gate now names the
    // undeclared keys these value-channel fixtures deliberately hang on a Text.
    expect(validateSpec(spec, { props: false }).valid).toBe(true);
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid).toBe(false);
    expect(gated.failureCategory).toBe('unsafe_value');
    expect(gated.errors.length).toBeGreaterThan(0);
  });

  it('accepts safe color + dimension + count values', () => {
    const spec = {
      root: 's',
      elements: {
        s: { type: 'Stack', props: {}, children: ['t', 'sk'] },
        t: { type: 'Text', props: { text: 'hi', color: '#6366f1', clamp: 3 } },
        sk: { type: 'Skeleton', props: { width: '100%', height: '1rem' } },
      },
    };
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid, gated.errors.join(' | ')).toBe(true);
  });

  it('skips array/object values (Table rows/columns are content, not a count)', () => {
    const spec = {
      root: 'tbl',
      elements: { tbl: { type: 'Table', props: { columns: ['A', 'B'], rows: [['1', '2']] } } },
    };
    expect(validateSpec(spec, { resolution: true }).valid).toBe(true);
  });
});

describe('resource-abuse caps', () => {
  it('rejects a cycle in the children graph (would render infinitely)', () => {
    const spec = {
      root: 'a',
      elements: {
        a: { type: 'Stack', props: {}, children: ['b'] },
        b: { type: 'Stack', props: {}, children: ['a'] },
      },
    };
    const r = validateResolution(spec);
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('resource_limit');
  });

  it('rejects nesting deeper than the cap', () => {
    const elements: Record<string, unknown> = {};
    for (let i = 0; i <= 45; i++) {
      elements[`n${i}`] = { type: 'Stack', props: {}, children: i < 45 ? [`n${i + 1}`] : [] };
    }
    const r = validateResolution({ root: 'n0', elements });
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('resource_limit');
  });

  it('rejects too many children on one element', () => {
    const children: string[] = [];
    const elements: Record<string, unknown> = {};
    for (let i = 0; i < 260; i++) {
      children.push(`c${i}`);
      elements[`c${i}`] = { type: 'Text', props: { text: 'x' } };
    }
    elements.root = { type: 'Stack', props: {}, children };
    const r = validateResolution({ root: 'root', elements });
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('resource_limit');
  });

  it('rejects a megabyte prop string', () => {
    const r = validateResolution({ root: 't', elements: { t: { type: 'Text', props: { text: 'x'.repeat(60_000) } } } });
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('resource_limit');
  });

  it('passes a normal nested spec', () => {
    const r = validateResolution({
      root: 'a',
      elements: { a: { type: 'Stack', props: {}, children: ['b'] }, b: { type: 'Text', props: { text: 'hi' } } },
    });
    expect(r.valid).toBe(true);
  });
});
