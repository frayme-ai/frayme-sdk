import { describe, expect, it } from 'vitest';

import { lenientNormalize } from './lenient.js';
import { validateSpec } from './ops.js';

const page = (elements: Record<string, unknown>, state?: unknown) => ({
  root: 'page',
  ...(state !== undefined ? { state } : {}),
  elements: { page: { type: 'Stack', props: {}, children: Object.keys(elements) }, ...elements },
});

describe('validateSpec mode:lenient', () => {
  it('strict is untouched: the same spec still fails without the mode', () => {
    const spec = page({ b: { type: 'Badge', props: { text: 'x', tone: 'default' } } });
    expect(validateSpec(spec).valid).toBe(false);
    const r = validateSpec(spec, { mode: 'lenient' });
    expect(r.valid).toBe(true);
    expect(r.normalizations).toEqual(['elements.b.props.tone: "default" → "neutral" (alias)']);
    expect(r.warnings[0]).toMatch(/^normalized: /);
  });

  it('aliases inside a nested $cond chain (the Badge.tone case)', () => {
    const spec = page(
      { b: { type: 'Badge', props: { text: 'x', tone: { $cond: { $state: '/s', eq: 'a' }, $then: 'critical', $else: { $cond: { $state: '/s', eq: 'b' }, $then: 'success', $else: 'default' } } } } },
      { s: 'a' },
    );
    expect(validateSpec(spec).valid).toBe(false);
    const r = validateSpec(spec, { mode: 'lenient' });
    expect(r.valid).toBe(true);
    expect(r.normalizations?.join('\n')).toMatch(/\$else\.\$else: "default" → "neutral"/);
  });

  it('coerces numeric Heatmap x-labels and drops an undeclared prop (BarList.ariaLabel)', () => {
    const spec = page({
      h: { type: 'Heatmap', props: { cells: [[1, 2], [3, 4]], xLabels: [0, 1], yLabels: ['Mon', 'Tue'] } },
      l: { type: 'BarList', props: { data: [{ label: 'T14', value: 42 }], ariaLabel: 'worst' } },
    });
    expect(validateSpec(spec).valid).toBe(false);
    const r = validateSpec(spec, { mode: 'lenient' });
    expect(r.valid).toBe(true);
    const els = (r.normalized as { elements: Record<string, { props: Record<string, unknown> }> }).elements;
    expect(els.h.props.xLabels).toEqual(['0', '1']);
    expect('ariaLabel' in els.l.props).toBe(false);
    expect(r.normalizations?.length).toBe(3);
  });

  it('an input inside a labelled FormField inherits the label', () => {
    const spec = {
      root: 'page',
      state: { t: '' },
      elements: {
        page: { type: 'Stack', props: {}, children: ['ff'] },
        ff: { type: 'FormField', props: { label: 'Target price' }, children: ['in'] },
        in: { type: 'Input', props: { name: 't', value: { $bindState: '/t' } } },
      },
    };
    expect(validateSpec(spec).valid).toBe(false);
    const r = validateSpec(spec, { mode: 'lenient' });
    expect(r.valid).toBe(true);
    expect(r.normalizations?.[0]).toMatch(/copied "Target price"/);
  });

  it('a bound control missing its name takes it from $bindState', () => {
    const spec = page({ in: { type: 'Input', props: { label: 'Target', value: { $bindState: '/targetPriceUsd' } } } }, { targetPriceUsd: '' });
    expect(validateSpec(spec).valid).toBe(false);
    const r = validateSpec(spec, { mode: 'lenient' });
    expect(r.valid).toBe(true);
    expect(r.normalizations?.[0]).toMatch(/backfilled "targetPriceUsd"/);
  });

  it('a series entry whose points are a binding is resolved at runtime (both modes)', () => {
    const spec = page(
      { c: { type: 'LineChart', props: { series: [{ name: 'a', points: { $state: '/pts' } }] } } },
      { pts: [1, 2, 3] },
    );
    expect(validateSpec(spec).valid).toBe(true);
    expect(validateSpec(spec, { mode: 'lenient' }).valid).toBe(true);
  });

  it('never splices a null out of an array (a Table row keeps its column alignment)', () => {
    const spec = page({ t: { type: 'Table', props: { columns: ['Year', 'Close', 'YoY'], rows: [['2024', null, '+12%']] } } });
    const r = lenientNormalize(spec);
    const rows = (r.spec as { elements: Record<string, { props: { rows: unknown[][] } }> }).elements.t.props.rows;
    expect(rows[0]).toEqual(['2024', null, '+12%']);
    expect(r.normalizations.some((n) => /dropped null/.test(n))).toBe(false);
  });

  it('lifts an `on` block written inside props to the element instead of dropping it', () => {
    const spec = page({ sw: { type: 'Switch', props: { label: 'Auto-pay', name: 'autoPay', on: { change: { action: 'setState', params: { statePath: '/autoPay' } } } } } }, { autoPay: false });
    const r = validateSpec(spec, { mode: 'lenient' });
    const el = (r.normalized as { elements: Record<string, { on?: unknown; props: Record<string, unknown> }> }).elements.sw;
    expect(el.on).toBeDefined();
    expect('on' in el.props).toBe(false);
    expect(r.normalizations?.[0]).toMatch(/lifted "on"/);
  });

  it('a bound name or color beside a literal EMPTY series still fails (both modes)', () => {
    const spec = page({ c: { type: 'LineChart', props: { series: [{ name: { $state: '/label' }, points: [] }] } } }, { label: 'x' });
    expect(validateSpec(spec).valid).toBe(false);
    expect(validateSpec(spec, { mode: 'lenient' }).valid).toBe(false);
  });

  it('never writes a fact: an unknown word with no declared alias is dropped, not replaced', () => {
    const r = lenientNormalize(page({ b: { type: 'Badge', props: { text: 'x', tone: 'purple' } } }));
    const b = (r.spec as { elements: Record<string, { props: Record<string, unknown> }> }).elements.b.props;
    expect('tone' in b).toBe(false);
    expect(r.normalizations[0]).toMatch(/dropped "purple"/);
  });

  it('leaves the input untouched', () => {
    const spec = page({ b: { type: 'Badge', props: { text: 'x', tone: 'default' } } });
    lenientNormalize(spec);
    expect(((spec.elements as unknown as Record<string, { props: { tone: string } }>).b).props.tone).toBe('default');
  });
});
