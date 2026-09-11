/**
 * EmptyState / ErrorState action clusters must WRAP.
 *
 * jsdom does not lay out, so — like layout-collapse.test.tsx — this pins the
 * CLASSES that produce the layout, not the geometry. The geometry that motivated
 * them was measured in Chromium against source-built markup + source-built CSS:
 * a state panel in a 200px lane at a 320px viewport, three actions, rendered its
 * cluster 49px OUTSIDE the panel (a non-wrapping row's min-content is the sum of
 * its buttons, so the row sized past the surface instead of breaking), and the
 * last label was squeezed to 55x40 — two lines inside a button, 1.3x off the
 * render-audit shattered-text threshold (width < 3x font-size while taller than 3
 * lines). Two actions still escaped by 6px. With flex-wrap: 0 escaping, 0 tight,
 * and the labels back on one line.
 *
 * PageHeader's cluster in the same file already wrapped for this exact reason;
 * these two panels were the copies left behind, which is why the rule is pinned
 * for all three here — a future edit that "tidies" one of them back to a bare
 * `flex` row reintroduces the overflow silently.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (spec: Record<string, unknown>) =>
  render(<FraymeRenderer spec={spec as unknown as Spec} mode="progressive" />).container;

/** The action cluster is the element that holds the rendered <button> children. */
const cluster = (c: HTMLElement): HTMLElement => {
  const btn = c.querySelector('button');
  expect(btn, 'expected the panel to render its action buttons').not.toBeNull();
  return btn!.parentElement as HTMLElement;
};

const panel = (type: 'EmptyState' | 'ErrorState', props: Record<string, unknown>) => ({
  root: 'p',
  elements: {
    p: { type, props, children: ['b1', 'b2', 'b3'] },
    b1: { type: 'Button', props: { label: 'Import a statement' } },
    b2: { type: 'Button', props: { label: 'Create reconciliation' } },
    b3: { type: 'Button', props: { label: 'Contact support', variant: 'primary' } },
  },
  state: {},
});

describe('state-panel action clusters wrap instead of overflowing', () => {
  for (const type of ['EmptyState', 'ErrorState'] as const) {
    it(`${type} actions wrap and stay inside the panel`, () => {
      const row = cluster(draw(panel(type, { title: 'No reconciliation items' })));
      // the fix
      expect(row.className).toContain('flex-wrap');
      // …and the cap that keeps the wrapped row inside the panel it sits in
      expect(row.className).toContain('max-w-full');
      // the REJECTED alternative: min-w-0 here would let the buttons compress
      // instead of the row breaking — that trades this overflow for the shattered
      // label the wrap exists to prevent.
      expect(row.className).not.toContain('min-w-0');
      // …and never the other rejected one: clipping deletes the verb the panel
      // exists to offer.
      expect(row.className).not.toContain('truncate');
    });

    it(`${type} wrapped lines follow the panel's own align`, () => {
      // default (center) — a wrapped second line would otherwise sit left under a
      // centred panel
      expect(cluster(draw(panel(type, { title: 'No items' }))).className).toContain('justify-center');
      // start-aligned panel keeps its cluster left
      expect(cluster(draw(panel(type, { title: 'No items', align: 'start' }))).className).toContain('justify-start');
    });
  }

  it('PageHeader keeps the same wrapping cluster (the copy these two were missing)', () => {
    const c = draw({
      root: 'h',
      elements: {
        h: { type: 'PageHeader', props: { title: 'Reconciliation for September' }, children: ['b1', 'b2'] },
        b1: { type: 'Button', props: { label: 'Download statement' } },
        b2: { type: 'Button', props: { label: 'Reconcile now' } },
      },
      state: {},
    });
    expect(cluster(c).className).toContain('flex-wrap');
  });
});
