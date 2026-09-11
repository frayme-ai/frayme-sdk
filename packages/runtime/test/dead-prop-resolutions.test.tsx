/**
 * Regression guard for dead-prop resolutions:
 *  - Textarea `autosize` is now IMPLEMENTED (CSS field-sizing via the
 *    `field-sizing-content` utility) instead of a silently-dropped prop.
 *  - Slider now renders the formFieldBase help/error/required scaffold
 *    (RequiredMark in the label + HelpLine under the control) like its six
 *    siblings instead of silently dropping all three.
 *  - Killed props stay dead: BarChart/DonutChart/PieChart `size`,
 *    TimePicker `use24h`, labelPlacement `left` — the renderers must not
 *    regress into reading them (strip-mode specs may still carry them).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

describe('Textarea autosize (implemented)', () => {
  it('adds field-sizing-content when autosize:true', () => {
    const { container } = draw('Textarea', { label: 'Notes', name: 'n', autosize: true });
    expect(container.querySelector('textarea')!.classList.contains('field-sizing-content')).toBe(true);
  });

  it('unset/false stays byte-identical to never-mentioned (fixed rows)', () => {
    const a = draw('Textarea', { label: 'Notes', name: 'n' }).container.innerHTML;
    const b = draw('Textarea', { label: 'Notes', name: 'n', autosize: null }).container.innerHTML;
    expect(b).toBe(a);
    const c = draw('Textarea', { label: 'Notes', name: 'n', autosize: false }).container;
    expect(c.querySelector('textarea')!.classList.contains('field-sizing-content')).toBe(false);
  });
});

describe('Slider help/error/required scaffold (implemented)', () => {
  it('renders helpText under the control', () => {
    const { getByText } = draw('Slider', { label: 'Volume', helpText: 'Drag to adjust' });
    expect(getByText('Drag to adjust')).toBeTruthy();
  });

  it('errorText wins over helpText (danger line)', () => {
    const { queryByText, getByText } = draw('Slider', {
      label: 'Volume',
      helpText: 'Drag to adjust',
      errorText: 'Too loud',
    });
    expect(getByText('Too loud')).toBeTruthy();
    expect(queryByText('Drag to adjust')).toBeNull();
  });

  it('required renders the label marker', () => {
    const { container } = draw('Slider', { label: 'Volume', required: true });
    expect(container.querySelector('label')!.textContent).toContain('*');
  });

  it('unset stays byte-identical to never-mentioned', () => {
    const a = draw('Slider', { label: 'Volume' }).container.innerHTML;
    const b = draw('Slider', { label: 'Volume', helpText: null, errorText: null, required: null }).container.innerHTML;
    expect(b).toBe(a);
  });
});

describe('killed props stay inert (strip-tolerant)', () => {
  it('BarChart/DonutChart/PieChart ignore a stray size prop without crashing', () => {
    for (const [type, props] of [
      ['BarChart', { data: [{ label: 'A', value: 3 }], size: 'lg' }],
      ['DonutChart', { data: [{ label: 'A', value: 3 }], size: 'lg' }],
      ['PieChart', { data: [{ label: 'A', value: 3 }], size: 'lg' }],
    ] as const) {
      const withSize = draw(type, props as Record<string, unknown>).container.innerHTML;
      const { size: _s, ...rest } = props as Record<string, unknown>;
      const without = draw(type, rest).container.innerHTML;
      expect(withSize, type).toBe(without);
    }
  });

  it('TimePicker ignores use24h; labelPlacement left falls back to top', () => {
    const a = draw('TimePicker', { label: 'Start', use24h: false }).container.innerHTML;
    const b = draw('TimePicker', { label: 'Start' }).container.innerHTML;
    expect(a).toBe(b);
    const withLeft = draw('Input', { label: 'Name', name: 'x', labelPlacement: 'left' }).container;
    // 'left' no longer exists as a variant — the label must NOT be sr-only and
    // the render must not crash; it falls through to the top treatment.
    expect(withLeft.querySelector('label')!.classList.contains('sr-only')).toBe(false);
  });
});
