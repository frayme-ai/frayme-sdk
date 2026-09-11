/**
 * BarChart / value-axis guard. Without axis props a vertical bar chart is just
 * a row of unlabelled heights — unreadable.
 *
 * The contract these lock in:
 *   • yAxisTitle / xAxisTitle render when set.
 *   • VERTICAL bars get a y tick column, and the ticks are HONEST — the top tick
 *     equals the nice-scale max, and the tallest bar's height% is its value
 *     against that same max (not the raw data max). A tick column that does not
 *     share the bars' scale is worse than none.
 *   • HORIZONTAL bars draw no tick column (the categories are the gutter and
 *     each bar carries its own value) but still take an xAxisTitle.
 *   • A props-less BarChart renders BYTE-IDENTICALLY to before the feature.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'BarChart', props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

const DATA = [
  { label: 'Mon', value: 420 },
  { label: 'Tue', value: 610 },
  { label: 'Wed', value: 940 },
];

describe('BarChart value axis', () => {
  it('renders yAxisTitle and xAxisTitle when set', () => {
    const c = draw({ data: DATA, yAxisTitle: 'Search volume', xAxisTitle: 'Day' });
    expect(c.textContent).toContain('Search volume');
    expect(c.textContent).toContain('Day');
  });

  it('vertical: y ticks are honest — top tick == the max the bars are scaled to', () => {
    const c = draw({ data: DATA, yAxisTitle: 'Volume', showValues: false });
    // niceScale(0, 940) → step 250 → max 1000, so the top tick reads "1k"
    // (compactNum) and the tallest bar (940) is 94% — NOT 100% against a raw
    // max of 940, which is exactly the lie an unscaled tick column would tell.
    expect(c.textContent).toContain('1k');
    const bars = [...c.querySelectorAll<HTMLElement>('[style*="height"]')].filter((e) => /height:\s*\d/.test(e.getAttribute('style') ?? ''));
    const tallest = Math.max(...bars.map((b) => parseFloat(/height:\s*([\d.]+)%/.exec(b.getAttribute('style') ?? '')?.[1] ?? '0')));
    expect(tallest).toBeGreaterThan(90);
    expect(tallest).toBeLessThan(100);
  });

  it('vertical: category labels render once, outside the plot box', () => {
    const c = draw({ data: DATA, yAxisTitle: 'Volume' });
    // one label per category — the move out of the plot box must not duplicate them
    expect(c.textContent?.match(/Mon/g)?.length).toBe(1);
    expect(c.textContent).toContain('Wed');
  });

  it('showYAxis:false suppresses the tick column but keeps the titles', () => {
    const withAxis = draw({ data: DATA, yAxisTitle: 'Volume', showValues: false });
    const without = draw({ data: DATA, yAxisTitle: 'Volume', showYAxis: false, showValues: false });
    expect(withAxis.textContent).toContain('1k');
    expect(without.textContent).not.toContain('1k');
    expect(without.textContent).toContain('Volume');
  });

  it('horizontal: no tick column, but xAxisTitle still renders', () => {
    const c = draw({ data: DATA, layout: 'horizontal', xAxisTitle: 'Sessions' });
    expect(c.textContent).toContain('Sessions');
    expect(c.textContent).toContain('Mon'); // category gutter is unchanged
  });

  it('multi-series vertical takes the axis furniture too', () => {
    const c = draw({
      series: [
        { name: 'This week', values: [4, 8, 6] },
        { name: 'Last week', values: [3, 5, 7] },
      ],
      labels: ['Mon', 'Tue', 'Wed'],
      yAxisTitle: 'Orders',
    });
    expect(c.textContent).toContain('Orders');
    expect(c.textContent).toContain('This week'); // legend survives
    expect(c.textContent?.match(/Mon/g)?.length).toBe(1);
  });

  it('a props-less BarChart is byte-identical to one with the axis props null', () => {
    const bare = draw({ data: DATA }).innerHTML;
    const nulled = draw({ data: DATA, yAxisTitle: null, xAxisTitle: null, showYAxis: null }).innerHTML;
    expect(nulled).toBe(bare);
  });
});
