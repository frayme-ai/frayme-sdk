/**
 * Regression tests for validator edge cases.
 * Each test pins a fixed defect so it cannot silently regress.
 */
import { describe, expect, it } from 'vitest';
import { defineFraymeComponent } from '../src/index.js';
import { validateSpec, validateResolution } from '../src/validate/index.js';
import { validateActionWiring } from '../src/validate/actions.js';

/* ── validateSpec must NOT strip the element envelope ─────────────────────── */
describe('validateSpec preserves element on/visible/watch/repeat + top-level theme', () => {
  const spec = {
    root: 'card',
    state: { count: 0, show: true },
    theme: { primary: '#2563eb' },
    elements: {
      card: { type: 'Card', props: {}, children: ['btn', 'note'] },
      btn: {
        type: 'Button',
        props: { label: '+1' },
        on: { commit: { action: 'setState', params: { statePath: '/count', value: 1 } } },
      },
      note: {
        type: 'Text',
        props: { text: 'hi' },
        visible: { $state: '/show' },
      },
    },
  };

  it('returns the model-authored on/visible bindings (not the strip-mode data)', () => {
    const r = validateSpec(spec);
    expect(r.valid).toBe(true);
    const btn = (r.spec as any).elements.btn;
    expect(btn.on).toBeDefined();
    expect(btn.on.commit.action).toBe('setState');
    expect((r.spec as any).elements.note.visible).toBeDefined();
  });

  it('preserves the top-level theme key', () => {
    const r = validateSpec(spec);
    expect((r.spec as any).theme).toEqual({ primary: '#2563eb' });
  });

  it('the returned spec is wiring-visible: validateActionWiring sees a phantom binding', () => {
    // A model-authored binding to an action with no handler must be catchable on
    // the RETURNED spec (the server-side wiring gate consumes validateSpec(...).spec). Pre-fix the
    // stripped spec had no `on`, so the gate was vacuous.
    const phantom = {
      root: 'b',
      elements: { b: { type: 'Button', props: { label: 'x' }, on: { commit: { action: 'submitOrder' } } } },
    };
    const returned = validateSpec(phantom).spec;
    const onOriginal = validateActionWiring(phantom as any);
    const onReturned = validateActionWiring(returned as any);
    expect(onReturned.valid).toBe(false); // phantom is visible
    expect(onReturned.valid).toBe(onOriginal.valid); // returned == original
  });
});

/* ── H3: cleanProps must not crash on Object.prototype-named keys ─────────── */
describe('H3 — cleanProps strips prototype-named keys without crashing', () => {
  const manifest = defineFraymeComponent({
    name: 'WeatherCard',
    description:
      'A compact weather summary card showing the current temperature and a short label. It is used when a prompt asks for a small at-a-glance weather widget.',
    props: {
      label: { kind: 'string', doc: 'The short place label shown at the top of the card face.' },
    },
    events: ['select'],
    example: { label: 'London' },
  });

  it('does not throw on constructor/toString/__proto__ keys and strips them', () => {
    const parsed = JSON.parse('{"label":"London","constructor":1,"toString":"x","__proto__":{"polluted":true}}');
    let cleaned: Record<string, unknown> = {};
    expect(() => {
      cleaned = manifest.cleanProps(parsed);
    }).not.toThrow();
    expect(cleaned.label).toBe('London');
    // `in` would see the inherited members — check OWN keys only.
    expect(Object.hasOwn(cleaned, 'constructor')).toBe(false);
    expect(Object.hasOwn(cleaned, 'toString')).toBe(false);
    expect(Object.hasOwn(cleaned, '__proto__')).toBe(false);
    expect(({} as any).polluted).toBeUndefined(); // no prototype pollution
  });
});

/* ── M8/M9: resolution gate false-positives ──────────────────────────────── */
describe('M8/M9 — resolution gate accepts schema-legal enums + user data', () => {
  it('M8: Conversation.maxHeight enum token (md) is not flagged as an unsafe dimension', () => {
    const spec = {
      root: 'c',
      elements: { c: { type: 'Conversation', props: { maxHeight: 'md' } } },
    };
    expect(validateSpec(spec, { resolution: true }).valid).toBe(true);
  });

  it('M9: a DataTable row column literally named "color" is content, not a CSS value', () => {
    const spec = {
      root: 't',
      elements: {
        t: {
          type: 'DataTable',
          props: {
            columns: [{ key: 'color', label: 'Colour' }],
            rows: [{ color: 'Navy Blue' }, { color: 'Forest Green' }],
          },
        },
      },
    };
    expect(validateSpec(spec, { resolution: true }).valid).toBe(true);
  });

  it('M9: a real styled nested channel (DataTable columns[].width) is still gated', () => {
    const spec = {
      root: 't',
      elements: {
        t: {
          type: 'DataTable',
          props: {
            columns: [{ key: 'a', label: 'A', width: 'calc(100% - 1px)' }],
            rows: [{ a: '1' }],
          },
        },
      },
    };
    expect(validateSpec(spec, { resolution: true }).valid).toBe(false);
  });
});

/* ── M10: the depth/cycle walk is polynomial on a shared-children DAG ─────── */
describe('M10 — resolution resource walk does not blow up on a legal DAG', () => {
  it('validates a wide layered DAG (8 layers × 8 wide, fully connected) quickly', () => {
    const elements: Record<string, unknown> = {};
    const LAYERS = 8;
    const WIDE = 8;
    const idOf = (l: number, i: number) => `n_${l}_${i}`;
    for (let l = 0; l < LAYERS; l++) {
      for (let i = 0; i < WIDE; i++) {
        const children =
          l < LAYERS - 1 ? Array.from({ length: WIDE }, (_, j) => idOf(l + 1, j)) : [];
        elements[idOf(l, i)] = { type: 'Card', props: {}, children };
      }
    }
    const root = 'root';
    elements[root] = { type: 'Card', props: {}, children: Array.from({ length: WIDE }, (_, j) => idOf(0, j)) };
    const spec = { root, elements };

    const start = Date.now();
    const r = validateResolution(spec);
    const ms = Date.now() - start;
    expect(r.valid).toBe(true); // legal DAG, no cycle
    expect(ms).toBeLessThan(500); // pre-fix this hit multiple seconds
  });

  it('still detects a genuine cycle', () => {
    const spec = {
      root: 'a',
      elements: {
        a: { type: 'Card', props: {}, children: ['b'] },
        b: { type: 'Card', props: {}, children: ['a'] },
      },
    };
    const r = validateResolution(spec);
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('resource_limit');
  });
});
