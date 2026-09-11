/**
 * The small-defect sweep — one test per defect, each written
 * against the unfixed code first.
 *
 * Measured on generated specs:
 *   • WebPreviews routinely carry no `image`, so every one of them drew
 *     the 1.91:1 grey fallback block — a ~400px slab above two lines of text.
 *   • the single-series BarChart path coloured by the DATUM index, so one
 *     series came out as a rainbow.
 *   • ToggleGroup `type:"multiple"` binds an ARRAY (a spec binds
 *     /preferences); the renderer called `.split(',')` on it and threw.
 *   • NumberInput has no `label` — specs set one and five sibling inputs
 *     (Stepper, TimeInput, ColorPicker, PhoneInput, PinInput) render theirs.
 *   • Heatmap's scroll box was `inline-block max-w-full`, which cannot bite
 *     inside a content-sized parent, and carried no scroll affordance at all
 *     (24-column heatmaps in real specs).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type, props } }, state } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

describe('WebPreview without an image', () => {
  it('draws no media block at all', () => {
    const c = draw('WebPreview', { url: 'https://example.com/a', title: 'Bill BILL-88213', description: 'A bill' });
    expect(c.querySelector('[class*="aspect-"]')).toBeNull();
  });

  it('still draws the ratio block when an image was promised (a 404 keeps its slot)', () => {
    const c = draw('WebPreview', { url: 'https://example.com/a', title: 'T', image: 'https://example.com/og.png' });
    expect(c.querySelector('[class*="aspect-"]')).not.toBeNull();
  });

  it('keeps the title and host', () => {
    const c = draw('WebPreview', { url: 'https://example.com/a', title: 'Bill BILL-88213' });
    expect(c.textContent).toContain('Bill BILL-88213');
    expect(c.textContent).toContain('example.com');
  });
});

describe('BarChart single series', () => {
  const bars = (c: HTMLElement) =>
    [...c.querySelectorAll<HTMLElement>('[style*="background"]')]
      .map((e) => /background:\s*([^;]+)/.exec(e.getAttribute('style') ?? '')?.[1]?.trim() ?? '')
      .filter((s) => s.length > 0);

  it('paints every bar of ONE series the same colour', () => {
    const c = draw('BarChart', {
      data: [
        { label: 'Mon', value: 420 },
        { label: 'Tue', value: 610 },
        { label: 'Wed', value: 940 },
      ],
    });
    expect(new Set(bars(c)).size).toBe(1);
  });

  it('a per-datum colour still wins', () => {
    const c = draw('BarChart', {
      data: [
        { label: 'Mon', value: 420, color: '#ff0000' },
        { label: 'Tue', value: 610 },
      ],
    });
    expect(bars(c).some((b) => b === '#ff0000' || b === 'rgb(255, 0, 0)')).toBe(true);
    expect(new Set(bars(c)).size).toBe(2);
  });
});

describe('ToggleGroup with an array value', () => {
  it('renders its segments instead of collapsing into the error boundary', () => {
    // `(value ?? '').split(',')` on an array threw; the boundary swallowed it and
    // the whole group rendered as nothing — no segments at all.
    const c = draw('ToggleGroup', {
      type: 'multiple',
      items: [
        { label: 'Mentions', value: 'email_mentions' },
        { label: 'Digest', value: 'email_digest' },
      ],
      value: ['email_mentions', 'email_digest'],
    });
    expect(c.querySelectorAll('button').length).toBe(2);
  });

  it('marks the array members pressed', () => {
    const c = draw('ToggleGroup', {
      type: 'multiple',
      items: [
        { label: 'Mentions', value: 'email_mentions' },
        { label: 'Digest', value: 'email_digest' },
      ],
      value: ['email_mentions'],
    });
    const pressed = [...c.querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed'));
    expect(pressed).toEqual(['true', 'false']);
  });
});

describe('NumberInput label', () => {
  it('renders the label above the field', () => {
    const c = draw('NumberInput', { label: 'Target price', prefix: '$', min: 0, step: 1 });
    expect(c.textContent).toContain('Target price');
  });

  it('names the input with it', () => {
    const c = draw('NumberInput', { label: 'Target price' });
    expect(c.querySelector('input')?.getAttribute('aria-label')).toBe('Target price');
  });

  it('a label-less NumberInput is unchanged', () => {
    const c = draw('NumberInput', { value: 3 });
    expect(c.querySelector('label')).toBeNull();
  });
});

describe('Heatmap at 24 columns', () => {
  const CELLS = [Array.from({ length: 24 }, (_, i) => i * 10), Array.from({ length: 24 }, (_, i) => 240 - i * 10)];

  it('the scroll box constrains itself and carries the shared affordance', () => {
    const c = draw('Heatmap', { cells: CELLS });
    const box = c.querySelector('[role="img"]');
    expect(box?.className).toContain('fr-tabscroll-card');
    expect(box?.className).not.toContain('inline-block');
  });
});
