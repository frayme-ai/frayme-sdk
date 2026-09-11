/**
 * layout.tsx — Accordion / Tabs: ARIA references that RESOLVE, and a rail child
 * that cannot shrink.
 *
 * Three defects, all measured before the fix.
 *
 * 1. DANGLING aria-controls. An accessibility audit over generated specs found many elements pointing
 *    `aria-controls` at an id that is not in the document; every one was a CLOSED
 *    disclosure whose panel mounts only while open, and the accordion trigger's
 *    shape (`flex min-h-6 w-full cursor-pointer items-center …`) was the largest
 *    group of them — an Accordion sits in most generated pages and every one of its
 *    items is closed at rest. Same defect as Toggletip
 *    (toggletip-disclosure.test.tsx), ai-flow and the inputs-longtail pickers:
 *    aria-controls is only RECOMMENDED for a disclosure, so dropping it while
 *    nothing is mounted costs nothing, while a reader who follows a dead IDREF
 *    lands nowhere. `aria-expanded` is kept in BOTH states.
 *
 * 2. IDS THAT ARE NOT PER-INSTANCE. Both pairings minted ids from the SPEC ID
 *    alone. json-render's `repeat` re-renders ONE element per row from a single
 *    `__fid`, so two rows of a repeated Accordion/Tabs emitted IDENTICAL ids and
 *    row two's header/tab pointed a screen reader at row one's panel — the shape
 *    _aria.ts names for exactly these two components. Both now mint through
 *    `useAriaId` (registry/_aria.ts), which is per component INSTANCE.
 *
 * 3. A SCROLLER CHILD THAT COULD SHRINK. `fitted` was read twice and the two
 *    reads could disagree: cva looks a variant up by String(value), so
 *    `fitted:"false"` matched the `false` key (no flex-1) while the render-site
 *    ternary saw a truthy string and took the fitted branch (no shrink-0). The
 *    tab was then plain `flex: 0 1 auto` inside `fr-tabscroll`, an overflow-x
 *    scroller — the largest layout defect class in generated specs, where a shrinkable rail
 *    child collapses to 16-40px and shatters its label instead of scrolling.
 *    This is the Stack `direction:"column"` bug again: an off-type value reaching
 *    cva as-is, silently producing the opposite of the documented default.
 *
 * The assertions are about RESOLUTION (exactly one element carries the id), not
 * about the attribute merely being present — presence is what defect 1 had.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';

import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (type: string, props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type, props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  );

/** The same component twice via `repeat`, which reuses ONE spec id for both rows
 *  — the case a spec-id-derived id cannot separate. */
const drawRepeat = (type: string, props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={
        {
          root: 'list',
          state: { rows: [{ id: 'a' }, { id: 'b' }] },
          elements: {
            list: { type: 'Stack', props: {}, repeat: { statePath: '/rows', key: 'id' }, children: ['sut'] },
            sut: { type, props },
          },
        } as unknown as Spec
      }
      mode="progressive"
    />,
  );

/** Every id token of every `aria-controls`/`aria-labelledby` must name exactly
 *  one live element. Returns the offenders so a failure names them. */
function danglingRefs(container: HTMLElement): string[] {
  const bad: string[] = [];
  for (const attr of ['aria-controls', 'aria-labelledby']) {
    for (const el of container.querySelectorAll(`[${attr}]`)) {
      for (const id of (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) {
        const hits = container.querySelectorAll(`[id="${id}"]`).length;
        if (hits !== 1) bad.push(`${attr}=${id} -> ${hits} elements`);
      }
    }
  }
  return bad;
}

const idsIn = (container: HTMLElement): string[] => [...container.querySelectorAll('[id]')].map((e) => e.id);

const ITEMS = [
  { title: 'What is included', content: 'Everything in the plan.' },
  { title: 'How do refunds work', content: 'Within 30 days.' },
];

describe('Accordion — a closed header names no region', () => {
  it('closed at rest: aria-expanded stays, aria-controls does not', () => {
    const { container } = draw('Accordion', { items: ITEMS });
    const headers = [...container.querySelectorAll('button[aria-expanded]')];
    expect(headers.length, 'one header per item').toBe(2);

    for (const h of headers) {
      expect(h.getAttribute('aria-expanded'), 'still a disclosure when closed').toBe('false');
      // Pre-fix every one of these carried an id that no element in the document
      // had — the region is only rendered while open.
      expect(h.getAttribute('aria-controls'), 'closed item mounts no region').toBeNull();
    }
    expect(container.querySelectorAll('[role="region"]').length).toBe(0);
    expect(danglingRefs(container)).toEqual([]);
  });

  it('opening mounts the region and the reference resolves to it — closing takes it back', () => {
    const { container } = draw('Accordion', { items: ITEMS });
    const header = container.querySelector('button[aria-expanded]')!;

    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    const id = header.getAttribute('aria-controls')!;
    expect(id).toBeTruthy();
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.getAttribute('role')).toBe('region');
    expect(danglingRefs(container)).toEqual([]);

    fireEvent.click(header);
    expect(header.getAttribute('aria-controls')).toBeNull();
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });

  it('an item opened by defaultOpenIndex is named from the first paint', () => {
    const { container } = draw('Accordion', { items: ITEMS, defaultOpenIndex: 1 });
    const headers = [...container.querySelectorAll('button[aria-expanded]')];
    expect(headers[0].getAttribute('aria-controls')).toBeNull();
    const id = headers[1].getAttribute('aria-controls')!;
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(danglingRefs(container)).toEqual([]);
  });
});

describe('Accordion / Tabs — ids are per INSTANCE, not per spec id', () => {
  it('Accordion: two repeat rows get distinct, resolving header↔region pairs', () => {
    const { container } = drawRepeat('Accordion', { items: ITEMS, defaultOpenIndex: 0 });
    const controls = [...container.querySelectorAll('[aria-controls]')].map(
      (e) => e.getAttribute('aria-controls') ?? '',
    );
    // Guard the guard — a component that stopped rendering triggers would pass
    // vacuously (the Tree test in aria-repeat-ids.test.tsx once did).
    expect(controls.length, 'one open item per repeat row').toBe(2);
    expect(new Set(controls).size, `both rows share aria-controls: ${controls[0]}`).toBe(2);
    expect(danglingRefs(container)).toEqual([]);

    const ids = idsIn(container);
    expect(new Set(ids).size, `duplicate ids across repeat rows: ${ids.join(', ')}`).toBe(ids.length);
  });

  it('Tabs: two repeat rows do not share tab or panel ids', () => {
    const tabs = [
      { label: 'Overview', value: 'o' },
      { label: 'Details', value: 'd' },
    ];
    const { container } = drawRepeat('Tabs', { tabs });
    const panels = [...container.querySelectorAll('[role="tabpanel"]')];
    expect(panels.length, 'one panel per repeat row').toBe(2);
    // The panel is mounted in every state, so this reference never dangled — but
    // pre-fix both rows resolved to the FIRST row's panel.
    const controls = [...container.querySelectorAll('[role="tab"]')].map(
      (e) => e.getAttribute('aria-controls') ?? '',
    );
    expect(controls.length).toBe(4);
    expect(new Set(controls).size, 'both rows point at one panel id').toBe(2);
    expect(danglingRefs(container)).toEqual([]);

    const ids = idsIn(container);
    expect(new Set(ids).size, `duplicate ids across repeat rows: ${ids.join(', ')}`).toBe(ids.length);
  });
});

describe('Tabs — a tab in the scrolling rail never has a shrinkable box', () => {
  const tabs = [
    { label: 'All · 6', value: 'all' },
    { label: 'Wk 1 · start', value: 'w1' },
    { label: 'Take-home · 6', value: 'th' },
  ];

  // Every value an untrusted spec can deliver, and what it must resolve to.
  // 'true' keeps rendering fitted (what it did before); everything else fails to
  // the documented default, which is a non-fitted tab.
  for (const [value, isFitted] of [
    [undefined, false],
    [null, false],
    [false, false],
    ['false', false],
    [0, false],
    [1, false],
    ['yes', false],
    [true, true],
    ['true', true],
  ] as Array<[unknown, boolean]>) {
    it(`fitted:${JSON.stringify(value)} → ${isFitted ? 'flex-1 (shares the rail)' : 'shrink-0 (keeps its width)'}`, () => {
      const { container } = draw('Tabs', value === undefined ? { tabs } : { tabs, fitted: value });
      const rail = container.querySelector('[role="tablist"]')!;
      expect(rail.className, 'the rail is the scroller these tabs sit in').toContain('overflow-x-auto');

      for (const tab of container.querySelectorAll('[role="tab"]')) {
        if (isFitted) {
          expect(tab.className).toContain('flex-1');
          expect(tab.className).toContain('break-words');
          // deliberate: a flex-1 tab can never reach the rail's scroller, so an
          // ellipsis on it would only delete words (clip-fixes.test.tsx).
          expect(tab.className).not.toContain('shrink-0');
        } else {
          // The load-bearing half. Pre-fix, fitted:"false"/1/"yes" produced
          // NEITHER flex-1 NOR shrink-0 — the flex default 0 1 auto — so the tab
          // shrank inside its own scroller and the label shattered.
          expect(tab.className).toContain('shrink-0');
          expect(tab.className).toContain('whitespace-nowrap');
          expect(tab.className).not.toContain('flex-1');
        }
      }
    });
  }
});
