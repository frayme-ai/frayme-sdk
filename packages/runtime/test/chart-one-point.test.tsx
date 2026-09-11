/**
 * Line/Area charts with fewer than two points.
 *
 * A generated spec sent five AreaChart series of ONE point each. A line needs two
 * points, so the chart painted its gridlines and nothing else — and because the
 * series were non-empty, `noData` counted 0 and the run was scored clean. An
 * empty frame with no caption reads as a broken component; say so instead.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (type: string, props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type, props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

/* AREA ONLY. Measured while writing this: LineChart draws a DOT per point
   (showDots defaults on up to 24 points), so a one-point LineChart shows its
   value and reads as a chart — and an existing chart-hover test relies on
   exactly that. AreaChart draws no dots, so one point really is an empty frame. */
describe.each(['AreaChart'])('%s with one point per series', (type) => {
  it('says there is not enough to plot instead of painting a bare frame', () => {
    const c = draw(type, {
      series: [
        { name: 'Solar', points: [4.2] },
        { name: 'Wind', points: [6.1] },
      ],
    });
    expect(c.textContent).toContain('Not enough data to plot');
    expect(c.querySelector('svg path')).toBeNull();
  });

  it('honours emptyText over the default caption', () => {
    const c = draw(type, { series: [{ name: 'Solar', points: [4.2] }], emptyText: 'Awaiting the second reading' });
    expect(c.textContent).toContain('Awaiting the second reading');
  });

  it('two points still plot', () => {
    const c = draw(type, { series: [{ name: 'Solar', points: [4.2, 5.1] }] });
    expect(c.textContent).not.toContain('Not enough data to plot');
    expect(c.querySelector('svg path')).not.toBeNull();
  });
});

describe('LineChart with one point', () => {
  it('is left alone — the dot IS the reading', () => {
    const c = draw('LineChart', { series: [{ name: 'Solar', points: [4.2] }] });
    expect(c.textContent).not.toContain('Not enough data to plot');
    expect(c.querySelectorAll('svg circle').length).toBe(1);
  });
});
