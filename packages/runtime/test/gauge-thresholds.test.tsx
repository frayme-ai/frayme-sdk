/**
 * Gauge / thresholds + readout.
 *
 * Every sampled Gauge rendered a wrong dial. The four defects
 * this locks down:
 *   • thresholds were NEVER drawn — a `thresholds` array only recoloured the
 *     value arc, so the reader could not see where the bands sit.
 *   • a SEMANTIC threshold colour ("warning") passed `safeColor` (it matches the
 *     bare-named-colour rule) but is not a real CSS colour, so `stroke="warning"`
 *     was dropped by the UA and the value arc vanished — the "empty grey arc".
 *   • a value BELOW every threshold fell back to `bands[0]`, painting 132.4 in
 *     the 150-warning colour and contradicting the caption beside it.
 *   • value and unit were glued ("874MW") with no digit grouping.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'Gauge', props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

/** The stroked arcs, in document order: track/zones first, value arc last. */
const strokes = (c: HTMLElement) =>
  [...c.querySelectorAll('path')].map((p) => p.getAttribute('stroke') ?? '');

describe('Gauge thresholds', () => {
  it('draws a tick for every threshold', () => {
    const c = draw({
      value: 132.4,
      min: 0,
      max: 200,
      thresholds: [
        { value: 150, color: '#f59e0b', label: 'Warning' },
        { value: 180, color: '#ef4444', label: 'Critical' },
      ],
    });
    expect(c.querySelectorAll('[data-fr-gauge-tick]').length).toBe(2);
  });

  it('maps a SEMANTIC threshold colour to a token instead of an invalid stroke', () => {
    const c = draw({
      value: 90,
      max: 100,
      thresholds: [{ value: 80, color: 'warning', label: 'High' }],
    });
    // the value arc must never be stroked with the literal word
    expect(strokes(c)).not.toContain('warning');
    expect(strokes(c).some((s) => s.includes('--color-warning'))).toBe(true);
  });

  it('a value below every threshold keeps the base tone, not bands[0]', () => {
    const c = draw({
      value: 132.4,
      max: 200,
      tone: 'success',
      thresholds: [{ value: 150, color: '#f59e0b', label: 'Warning' }],
    });
    const valueArc = strokes(c).at(-1) ?? '';
    expect(valueArc).not.toBe('#f59e0b');
    expect(valueArc).toContain('--color-success');
  });

  it('picks the band the value is actually in', () => {
    const c = draw({
      value: 185,
      max: 200,
      thresholds: [
        { value: 150, color: '#f59e0b', label: 'Warning' },
        { value: 180, color: '#ef4444', label: 'Critical' },
      ],
    });
    expect(strokes(c).at(-1)).toBe('#ef4444');
  });

  it('separates value from unit and groups thousands', () => {
    const c = draw({ value: 2140, unit: 'parcels/hour', max: 3000 });
    expect(c.textContent).not.toContain('2140parcels/hour');
    expect(c.textContent).toContain('2,140');
    expect(c.textContent).toMatch(/2,140\sparcels\/hour/);
  });

  it('keeps % tight against the number (no space)', () => {
    const c = draw({ value: 72, unit: '%' });
    expect(c.textContent).toContain('72%');
  });
});
