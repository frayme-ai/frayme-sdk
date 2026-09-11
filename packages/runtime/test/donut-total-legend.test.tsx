/**
 * DonutChart / centre total + legend meta.
 *
 * Measured on real generated specs:
 *   • one spec (`totalLabel: "Total $B"`, four slices) printed the raw IEEE sum
 *     "130.14999999999998" in the hole.
 *   • its slice labels ALREADY carry their share — "Data Center (88.3%)" — and
 *     `showValues` then appended a second, rounded, disagreeing percentage:
 *     "115.2 (89%)".
 *   • the legend meta printed the bare number, dropping the valuePrefix /
 *     valueSuffix the centre total honours.
 *   • another supplies `totalValue: 130.11` (the reported figure) and the
 *     runtime summed the slices instead.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'DonutChart', props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

// The exact series from that spec: 115.2 + 11.35 + 1.9 + 1.7 = 130.14999999999998
const NVDA = [
  { label: 'Data Center (88.3%)', value: 115.2 },
  { label: 'Gaming (8.7%)', value: 11.35 },
  { label: 'Professional Visualization (1.5%)', value: 1.9 },
  { label: 'Automotive (1.3%)', value: 1.7 },
];

describe('DonutChart centre total', () => {
  it('never prints IEEE float noise', () => {
    const c = draw({ data: NVDA, showTotal: true, totalLabel: 'Total $B' });
    expect(c.textContent).not.toContain('130.14999999999998');
    expect(c.textContent).toContain('130.15');
  });

  it('uses totalValue when the spec supplies the reported figure', () => {
    const c = draw({ data: NVDA, showTotal: true, totalValue: 130.11, totalLabel: 'FY2025 total' });
    expect(c.textContent).toContain('130.11');
  });

  it('applies valuePrefix / valueSuffix to the centre total', () => {
    const c = draw({ data: NVDA, showTotal: true, valuePrefix: '$', valueSuffix: 'B' });
    expect(c.textContent).toContain('$130.15B');
  });

  it('groups thousands in the centre total', () => {
    const c = draw({ data: [{ label: 'A', value: 900000 }, { label: 'B', value: 240500 }], showTotal: true });
    expect(c.textContent).toContain('1,140,500');
  });
});

describe('DonutChart legend meta', () => {
  it('does not append a second percentage to a label that already carries one', () => {
    const c = draw({ data: NVDA, showValues: true });
    expect(c.textContent).not.toContain('(89%)');
    expect(c.textContent).toContain('Data Center (88.3%)');
  });

  it('still shows the computed share when the label does not carry one', () => {
    const c = draw({ data: [{ label: 'Data Center', value: 115.2 }, { label: 'Gaming', value: 11.35 }], showValues: true });
    expect(c.textContent).toMatch(/91%/);
  });

  it('carries valuePrefix / valueSuffix into the legend values', () => {
    const c = draw({ data: NVDA, showValues: true, valuePrefix: '$', valueSuffix: 'B' });
    expect(c.textContent).toContain('$115.2B');
  });
});
