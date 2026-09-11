import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * The value-channel gate keys (mutedColor/gridColor/
 * axisColor/scaleColor/labelColor/…, fontSize/paddingValue/strokeWidth) are
 * validated by the resolution gate on ANY element (the gate checks prop NAMES in
 * COLOR_KEYS/DIM_KEYS, independent of the per-component schema). A safe value
 * passes; an injection/calc/var value is rejected as `unsafe_value`.
 *
 * The fixtures hang those keys on a `Text`, which declares almost none of them —
 * that is deliberate, it is how a NAME-keyed gate is tested. The prop
 * gate also reports undeclared prop names, so the ACCEPT cases run with
 * `props: false`: the subject here is the value-channel gate, and the prop gate has
 * its own suite. The REJECT cases are untouched — the resolution gate runs first.
 */
const wrap = (props: Record<string, unknown>) => ({
  root: 'root',
  state: {},
  elements: { root: { type: 'Stack', props: { gap: 'md' }, children: ['t'] }, t: { type: 'Text', props: { text: 'hi', ...props } } },
});

describe('value-channel keys — colour channels gated', () => {
  it('accepts safe values on the new colour keys', () => {
    const spec = wrap({ mutedColor: '#7c3aed', gridColor: '#e2e8f0', axisColor: 'rgb(100,116,139)', labelColor: '#334155', connectorColor: '#cbd5e1' });
    expect(validateSpec(spec, { resolution: true, props: false }).valid, JSON.stringify(validateSpec(spec, { resolution: true, props: false }).errors)).toBe(true);
  });
  it('accepts safe values on the menuBg/cardColor/valueColor colour keys', () => {
    const spec = wrap({ menuBg: '#0f172a', cardColor: 'rgb(30,41,59)', valueColor: '#f8fafc' });
    expect(validateSpec(spec, { resolution: true, props: false }).valid, JSON.stringify(validateSpec(spec, { resolution: true, props: false }).errors)).toBe(true);
  });
  it('accepts safe values on the sparklineColor/iconBg/columnBg colour keys', () => {
    const spec = wrap({ sparklineColor: '#22c55e', iconBg: 'rgb(37,99,235)', columnBg: '#f1f5f9' });
    expect(validateSpec(spec, { resolution: true, props: false }).valid, JSON.stringify(validateSpec(spec, { resolution: true, props: false }).errors)).toBe(true);
  });
  // ('captionColor' dropped with its phantom COLOR_KEYS entry; 'menuBg'/'cardColor'/
  // 'valueColor' are later additions — gate-regression-tested here.)
  for (const key of ['mutedColor', 'gridColor', 'axisColor', 'scaleColor', 'labelColor', 'upColor', 'downColor', 'separatorColor', 'lineColor', 'connectorColor', 'menuBg', 'cardColor', 'valueColor', 'sparklineColor', 'iconBg', 'columnBg']) {
    it(`rejects an unsafe ${key}`, () => {
      const g = validateSpec(wrap({ [key]: 'red;}<x>' }), { resolution: true });
      expect(g.valid).toBe(false);
      expect(g.failureCategory).toBe('unsafe_value');
    });
  }
});

describe('value-channel keys — dimension channels gated', () => {
  it('accepts safe values on the new dim keys', () => {
    expect(validateSpec(wrap({ fontSize: '18px', paddingValue: '1.5rem', strokeWidth: '2px' }), { resolution: true, props: false }).valid).toBe(true);
  });
  it('accepts a safe value on the maxWidthValue dim key', () => {
    expect(validateSpec(wrap({ maxWidthValue: '20rem' }), { resolution: true, props: false }).valid).toBe(true);
  });
  for (const [key, bad] of [['fontSize', 'calc(1rem + 2px)'], ['paddingValue', 'var(--evil)'], ['strokeWidth', 'url(//x)']] as const) {
    it(`rejects an unsafe ${key}`, () => {
      const g = validateSpec(wrap({ [key]: bad }), { resolution: true });
      expect(g.valid).toBe(false);
      expect(g.failureCategory).toBe('unsafe_value');
    });
  }
});
