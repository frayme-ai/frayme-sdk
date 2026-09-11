/**
 * Stat rich-tile guard: a dense tile holds label + caption + value + delta in
 * one compact row. Adds
 * `caption`, `icon` and `layout:"split"`. The STACK default must stay unchanged.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer spec={{ root: 'el', elements: { el: { type: 'Stat', props } }, state: {} } as unknown as Spec} mode="progressive" />,
  ).container;

describe('Stat rich tile', () => {
  it('a plain Stat is byte-identical to one with the new props set to null', () => {
    const bare = draw({ label: 'Revenue', value: '£24,500', delta: '+12.5%', deltaType: 'increase' }).innerHTML;
    const nulled = draw({ label: 'Revenue', value: '£24,500', delta: '+12.5%', deltaType: 'increase', caption: null, icon: null, layout: null }).innerHTML;
    expect(nulled).toBe(bare);
  });

  it('caption renders as a second muted line in the default stack', () => {
    const c = draw({ label: 'Total ad spend', caption: 'Last 12 months', value: '$1.24M' });
    expect(c.textContent).toContain('Total ad spend');
    expect(c.textContent).toContain('Last 12 months');
    expect(c.textContent).toContain('$1.24M');
  });

  it('split layout holds all four facts and an icon', () => {
    const c = draw({ label: 'Total ad spend', caption: 'Last 12 months', value: '$1.24M', delta: '+18.3%', deltaType: 'increase', icon: 'dollar-sign', layout: 'split' });
    for (const t of ['Total ad spend', 'Last 12 months', '$1.24M', '+18.3%']) expect(c.textContent).toContain(t);
    // the split root is a horizontal flex row, not the vertical stack
    const root = c.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(root.className).toContain('flex');
    expect(root.className).toContain('items-center');
    // an icon chip is present
    expect(c.querySelector('svg')).toBeTruthy();
  });

  it('the icon chip is muted chrome, never coloured', () => {
    const c = draw({ label: 'Rate', value: '7.1x', icon: 'percent', layout: 'split' });
    const chip = [...c.querySelectorAll('span')].find((s) => s.className.includes('rounded-frayme') && s.className.includes('bg-[color:var(--fr-surface-sunken,var(--color-muted))]'));
    expect(chip, 'icon sits in a muted rounded chip').toBeTruthy();
    expect(chip!.className).not.toMatch(/text-(success|danger|primary|info|warning)\b/);
  });
});
