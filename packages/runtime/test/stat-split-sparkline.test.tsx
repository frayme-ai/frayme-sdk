/**
 * Stat / split layout completeness.
 *
 * Stat prop-bags commonly carry `sparkline` and `layout:"split"` — and the
 * split return path never rendered the series at all, so a DAU tile and every
 * ticker tile drew nothing. The same tiles also carry `valuePrefix` /
 * `valueSuffix` / `valueCaption`, all silently dropped: "$65B" printed alone
 * while "Q4", "(est.)" and "Q3 FY26 reported $57.0B" vanished.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'Stat', props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

const spark = (c: HTMLElement) => c.querySelector('polyline');

describe('Stat sparkline', () => {
  it('the detector fires on the STACK layout (which always worked)', () => {
    const c = draw({ label: 'DAU', value: '12,480', sparkline: [1, 2, 3] });
    expect(spark(c)).not.toBeNull();
  });

  it('draws the sparkline in the SPLIT layout', () => {
    // the exact DAU tile
    const c = draw({
      label: 'DAU',
      value: '12,480',
      caption: 'Daily active users',
      sparkline: [12250, 12460, 12470, 12480, 12490, 12350, 12480],
      layout: 'split',
      size: 'md',
    });
    expect(spark(c)).not.toBeNull();
    expect(spark(c)?.getAttribute('points')).toMatch(/^0\.0,/);
  });

  it('draws the sparkline at size sm in split', () => {
    const c = draw({ label: 'NVIDIA', value: '$65B', layout: 'split', size: 'sm', sparkline: [44.1, 46.7, 57, 65] });
    expect(spark(c)).not.toBeNull();
  });

  it('no series, no svg', () => {
    const c = draw({ label: 'DAU', value: '12,480', layout: 'split' });
    expect(spark(c)).toBeNull();
  });
});

describe('Stat value annotations', () => {
  const NVDA = {
    label: 'NVIDIA',
    caption: 'NVDA',
    layout: 'split',
    size: 'sm',
    value: '$65B',
    valuePrefix: 'Q4',
    valueSuffix: ' (est.)',
    valueCaption: 'Q3 FY26 reported $57.0B',
  };

  it('renders valuePrefix, valueSuffix and valueCaption', () => {
    const c = draw(NVDA);
    expect(c.textContent).toContain('Q4');
    expect(c.textContent).toContain('(est.)');
    expect(c.textContent).toContain('Q3 FY26 reported $57.0B');
  });

  it('renders them in the stack layout too', () => {
    const c = draw({ ...NVDA, layout: 'stack' });
    expect(c.textContent).toContain('Q4');
    expect(c.textContent).toContain('Q3 FY26 reported $57.0B');
  });

  it('a plain tile is unchanged', () => {
    const c = draw({ label: 'DAU', value: '12,480' });
    expect(c.textContent).toBe('DAU\u200b12,480');
  });
});
