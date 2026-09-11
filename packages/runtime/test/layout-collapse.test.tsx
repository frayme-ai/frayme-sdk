/**
 * Responsive keystone guards. The runtime renders
 * into host panels of unknown width; container queries in frayme.css collapse
 * marked layouts on narrow containers. jsdom does not evaluate @container, so
 * these tests pin the MARKER CLASSES (the classifier), not the computed layout:
 *  - fr-hcols      on a horizontal Stack with ≥2 block-container children
 *  - fr-grid-fixed on Grid's fixed-column branch only
 *  - fr-sg-fixed   on StatGroup's fixed-column branch only
 *  - w-fit         on the NumberInput stepper (no full-width stretch in FormField)
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (spec: Record<string, unknown>) =>
  render(<FraymeRenderer spec={spec as unknown as Spec} mode="progressive" />).container;

describe('responsive keystone markers', () => {
  it('horizontal Stack with two block containers (form beside a card) gets fr-hcols', () => {
    // The onboarding-form shape: main-row [Stack horizontal] > form-col [Stack] + readiness card [Card].
    const c = draw({
      root: 'row',
      elements: {
        row: { type: 'Stack', props: { direction: 'horizontal', gap: 'lg', align: 'start' }, children: ['col', 'card'] },
        col: { type: 'Stack', props: { direction: 'vertical' }, children: ['t1'] },
        card: { type: 'Card', props: {}, children: ['t2'] },
        t1: { type: 'Text', props: { text: 'left column' } },
        t2: { type: 'Text', props: { text: 'side card' } },
      },
      state: {},
    });
    const row = c.querySelector('.fr-hcols');
    expect(row).not.toBeNull();
    expect(row!.className).toContain('flex-row');
  });

  it('an inline row (icon + text + button) does NOT get fr-hcols', () => {
    const c = draw({
      root: 'row',
      elements: {
        row: { type: 'Stack', props: { direction: 'horizontal', gap: 'sm', align: 'center' }, children: ['i', 't', 'b'] },
        i: { type: 'Icon', props: { name: 'info' } },
        t: { type: 'Text', props: { text: 'inline note' } },
        b: { type: 'Button', props: { label: 'Go' } },
      },
      state: {},
    });
    expect(c.querySelector('.fr-hcols')).toBeNull();
  });

  it('a row of leaf-lockup Stacks (icon+text legend strip) does NOT get fr-hcols', () => {
    // three icon+text lockups in a row are a legend, not columns
    const c = draw({
      root: 'row',
      elements: {
        row: { type: 'Stack', props: { direction: 'horizontal', gap: 'sm' }, children: ['l1', 'l2', 'l3'] },
        l1: { type: 'Stack', props: { direction: 'horizontal', gap: 'sm' }, children: ['i1', 't1'] },
        l2: { type: 'Stack', props: { direction: 'horizontal', gap: 'sm' }, children: ['i2', 't2'] },
        l3: { type: 'Stack', props: { direction: 'horizontal', gap: 'sm' }, children: ['i3', 't3'] },
        i1: { type: 'Icon', props: { name: 'dot' } }, t1: { type: 'Text', props: { text: 'ok' } },
        i2: { type: 'Icon', props: { name: 'dot' } }, t2: { type: 'Text', props: { text: 'warn' } },
        i3: { type: 'Icon', props: { name: 'dot' } }, t3: { type: 'Text', props: { text: 'down' } },
      },
      state: {},
    });
    expect(c.querySelector('.fr-hcols')).toBeNull();

    // …but a Stack child CONTAINING a Card still counts as a column
    const real = draw({
      root: 'row',
      elements: {
        row: { type: 'Stack', props: { direction: 'horizontal' }, children: ['colA', 'colB'] },
        colA: { type: 'Stack', props: { direction: 'vertical' }, children: ['cardA'] },
        colB: { type: 'Stack', props: { direction: 'vertical' }, children: ['cardB'] },
        cardA: { type: 'Card', props: {}, children: [] },
        cardB: { type: 'Card', props: {}, children: [] },
      },
      state: {},
    });
    expect(real.querySelector('.fr-hcols')).not.toBeNull();
  });

  it('a single block container beside leaves does NOT get fr-hcols (needs ≥2)', () => {
    const c = draw({
      root: 'row',
      elements: {
        row: { type: 'Stack', props: { direction: 'horizontal' }, children: ['card', 't'] },
        card: { type: 'Card', props: {}, children: [] },
        t: { type: 'Text', props: { text: 'label' } },
      },
      state: {},
    });
    expect(c.querySelector('.fr-hcols')).toBeNull();
  });

  it('vertical Stack never gets fr-hcols even with container children', () => {
    const c = draw({
      root: 'colstack',
      elements: {
        colstack: { type: 'Stack', props: { direction: 'vertical' }, children: ['a', 'b'] },
        a: { type: 'Card', props: {}, children: [] },
        b: { type: 'Card', props: {}, children: [] },
      },
      state: {},
    });
    expect(c.querySelector('.fr-hcols')).toBeNull();
  });

  it('Grid fixed-column branch carries fr-grid-fixed; auto-fit branch does not', () => {
    const fixed = draw({
      root: 'g',
      elements: { g: { type: 'Grid', props: { columns: 3 }, children: [] } },
      state: {},
    });
    expect(fixed.querySelector('.fr-grid-fixed')).not.toBeNull();

    const autofit = draw({
      root: 'g',
      elements: { g: { type: 'Grid', props: { minColWidth: '200px' }, children: [] } },
      state: {},
    });
    expect(autofit.querySelector('.fr-grid-fixed')).toBeNull();
  });

  it('StatGroup always auto-fits: columns never pins a template; bordered widens the min', () => {
    // columns is advisory — no fixed-column template, even when set
    const withColumns = draw({
      root: 'sg',
      elements: { sg: { type: 'StatGroup', props: { columns: 4 }, children: [] } },
      state: {},
    });
    expect(withColumns.querySelector('.fr-sg-fixed')).toBeNull();
    // bare/divided floor: 10rem with a 22% share — 4-up survives on a real host
    // width and still wraps before tiles reach the value-crush point
    expect(withColumns.querySelector('[class*="10rem"]')).not.toBeNull();

    // bordered per-tile cards need room → the wider-min (45%) auto-fit template
    const bordered = draw({
      root: 'sg',
      elements: { sg: { type: 'StatGroup', props: { bordered: true }, children: [] } },
      state: {},
    });
    expect(bordered.querySelector('[class*="45%"]')).not.toBeNull();
    expect(bordered.querySelector('[class*="9rem"]')).toBeNull();
  });

  it('width law: NO spec ever gets the page-level measure clamp; flowing copy self-caps instead', () => {
    // form/reading screen — the shape the old heuristic used to clamp at 780px
    const form = draw({
      root: 'col',
      elements: {
        col: { type: 'Stack', props: { direction: 'vertical' }, children: ['i1', 't1'] },
        i1: { type: 'Input', props: { label: 'Site address' } },
        t1: { type: 'Text', props: { text: 'help' } },
      },
      state: {},
    });
    expect(form.querySelector('.frayme-root')!.className).not.toContain('fr-measure');

    // wide-data surface — same page width as the form screen (the rule:
    // spec widths never diverge on a component-type enum)
    const table = draw({
      root: 'col',
      elements: {
        col: { type: 'Stack', props: { direction: 'vertical' }, children: ['dt'] },
        dt: { type: 'DataTable', props: {}, children: [] },
      },
      state: {},
    });
    expect(table.querySelector('.frayme-root')!.className).not.toContain('fr-measure');

    // the restraint moved into the copy: body/lead/muted Text carries the
    // reading-measure marker; caption/code (short-form by contract) does not
    expect(form.querySelector('.fr-text-measure')).not.toBeNull();
    const caption = draw({
      root: 'col',
      elements: {
        col: { type: 'Stack', props: { direction: 'vertical' }, children: ['t1'] },
        t1: { type: 'Text', props: { text: 'tiny', variant: 'caption' } },
      },
      state: {},
    });
    expect(caption.querySelector('.fr-text-measure')).toBeNull();
  });

  it('NumberInput stepper is w-fit (compact — never stretched full-width by a form column)', () => {
    const c = draw({
      root: 'n',
      elements: { n: { type: 'NumberInput', props: { value: 3, suffix: 'spaces' } } },
      state: {},
    });
    const wrap = c.querySelector('.w-fit');
    expect(wrap).not.toBeNull();
    expect(wrap!.className).toContain('inline-flex');
  });
});
