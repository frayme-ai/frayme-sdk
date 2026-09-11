/**
 * Candlestick / x-axis dates.
 *
 * "No date labels" on any sampled chart. Measured on the generated specs, that
 * is TWO defects and neither is in the drawing code:
 *   • `showAxis` defaults to FALSE and not one generated spec set it, so the
 *     axis row was never mounted;
 *   • every dated spec writes `date:`,
 *     never the catalog's `label:` — the mapper read `label` only, so even with
 *     showAxis on there was nothing to draw.
 *
 * The fix is a DEFAULT, not new drawing: the axis appears when the series
 * actually carries labels, and a label-less series is unchanged (no empty row).
 *
 * NOT a runtime defect: the one spec with a blue axis and blue grid
 * set `axisColor: "#0066cc"` and `gridColor: "#0066cc"` itself. The runtime
 * painted what it was told; that one is authored in the spec.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'Candlestick', props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

const OHLC = (extra: (i: number) => Record<string, unknown>) =>
  [
    { open: 132, high: 134.5, low: 131, close: 133.8 },
    { open: 133.8, high: 136, low: 132.5, close: 135.4 },
    { open: 135.4, high: 137.2, low: 134, close: 136.9 },
  ].map((c, i) => ({ ...c, ...extra(i) }));

/** The x-axis row only — NOT the whole container: every candle's <title>
 *  tooltip already repeats its label, so asserting on container.textContent
 *  passes whether or not an axis was ever mounted (this test file's first
 *  draft did exactly that and reported a clean pass over the unfixed code). */
const axisText = (c: HTMLElement) => c.querySelector('[data-fr-candle-axis]')?.textContent ?? null;

describe('Candlestick x-axis', () => {
  it('the axis row is a real, separately addressable element', () => {
    // proves the detector below CAN fire
    const c = draw({ data: OHLC((i) => ({ label: `Dec ${i + 1}` })), showAxis: true });
    expect(axisText(c)).toContain('Dec 1');
  });

  it('labels the axis by DEFAULT when the candles carry labels', () => {
    const c = draw({ data: OHLC((i) => ({ label: `Dec ${i + 1}` })) });
    expect(axisText(c)).toContain('Dec 1');
    expect(axisText(c)).toContain('Dec 3');
  });

  it('reads the `date` key the specs actually write', () => {
    const c = draw({ data: OHLC((i) => ({ date: `Jun 2${i + 3}` })) });
    expect(axisText(c)).toContain('Jun 23');
    expect(axisText(c)).toContain('Jun 25');
  });

  it('mounts NO axis row for an unlabelled series', () => {
    const c = draw({ data: OHLC(() => ({})) });
    expect(axisText(c)).toBeNull();
  });

  it('showAxis:false still suppresses the axis row', () => {
    const c = draw({ data: OHLC((i) => ({ date: `Dec ${i + 1}` })), showAxis: false });
    expect(axisText(c)).toBeNull();
  });
});
