/**
 * ai-flow + filter-compose — disclosure headers: the reference must resolve, and
 * the trigger must be big enough to hit.
 *
 * TWO defects, both measured before the fix.
 *
 * 1. DANGLING `aria-controls`. Reasoning, ToolCall, FilterPanel's section header
 *    and FacetList's show-more all emitted `aria-controls` unconditionally while
 *    mounting their panel only when open. Collapsed — which is the state a
 *    disclosure spends most of its life in — the reference named an id that is
 *    not in the document. This is the Toggletip defect (toggletip-disclosure.
 *    test.tsx) repeated four times: ARIA only RECOMMENDS `aria-controls` for a
 *    disclosure, so omitting it costs nothing, but a reader who follows a
 *    dangling IDREF lands nowhere — strictly worse than never promising. The
 *    ToolCall case is the exact Toggletip shape: `input`/`output` are both
 *    nullable, so `{ name, defaultOpen: true }` is a VALID spec whose header
 *    announced itself EXPANDED with nothing to expand.
 *
 * 2. TARGET SIZE (WCAG 2.5.8, 24px). Measured in headless Chromium against the
 *    compiled utility values (`--spacing: .25rem`, `--text-sm--line-height:
 *    calc(1.25/.875)`), not assumed:
 *      - FacetList show-more and FilterBar clear-all: `py-1` + an arbitrary
 *        `text-[0.8125rem]` (which carries NO line-height) inside a parent with
 *        no `text-*` class leaves the height to the font's `normal` line box —
 *        24px in the default ui-sans-serif/system-ui stack, 23px in Arial,
 *        Helvetica and Georgia. They passed by accident of the default font and
 *        failed under any workspace theme naming its own family. Fixed with a
 *        `min-h-6` FLOOR (never a fixed height — a larger font must still grow
 *        the control).
 *      - FilterBar's chip remove-X: 16×16 in every font, and NOT covered by
 *        WCAG's inline exemption (a flex item is blockified, so its size is not
 *        constrained by a line box). Fixed by growing the TARGET with a
 *        transparent 24px `::before` — the Switch treatment in forms.tsx —
 *        because 24px of ink would have grown every pill 27px → 32px.
 *
 * NOTE the headers this audit was pointed at — Reasoning's and ToolCall's
 * `flex w-full cursor-pointer items-center gap-2 … px-3 py-2` — measured 31-36px
 * tall at full width and are NOT undersized. The audit groups findings by the
 * first 44 characters of the class list, which is exactly that prefix and is
 * shared with other components; the attribution, not the header, was wrong. No
 * min-h was added there: it would have been a no-op that changes no measurement.
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

/** Every id token of every `aria-controls` in the tree must name exactly one
 *  live element. Returns the offenders so a failure names them. */
function danglingRefs(container: HTMLElement): string[] {
  const bad: string[] = [];
  for (const el of container.querySelectorAll('[aria-controls]')) {
    for (const id of (el.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean)) {
      const hits = container.querySelectorAll(`[id="${id}"]`).length;
      if (hits !== 1) bad.push(`${id} -> ${hits} elements`);
    }
  }
  return bad;
}

describe('disclosure headers — aria-controls never dangles', () => {
  it('Reasoning: absent while collapsed, resolving while open', () => {
    const { container } = draw('Reasoning', { content: 'Query the sales table, sum by month.' });
    const btn = container.querySelector('button')!;

    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls'), 'collapsed body is not mounted').toBeNull();

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const id = btn.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.textContent).toContain('sales table');

    // and back — the reference must not survive the collapse
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-controls')).toBeNull();
  });

  it('ToolCall with a body: absent while collapsed, resolving while open', () => {
    const { container } = draw('ToolCall', { name: 'search_web', input: '{ "q": "frayme" }' });
    const btn = container.querySelector('button')!;

    expect(btn.getAttribute('aria-controls')).toBeNull();
    fireEvent.click(btn);
    const id = btn.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(danglingRefs(container)).toEqual([]);
  });

  it('ToolCall with NO body carries no disclosure semantics at all, even defaultOpen', () => {
    // The Toggletip shape: a valid spec (input/output are nullable) that used to
    // announce aria-expanded="true" pointing at an element that never mounts.
    const { container } = draw('ToolCall', { name: 'search_web', defaultOpen: true });
    const btn = container.querySelector('button')!;
    expect(btn.hasAttribute('disabled'), 'nothing to reveal → the header is inert').toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBeNull();
    expect(btn.getAttribute('aria-controls')).toBeNull();
  });

  it('FilterPanel section: absent while collapsed, resolving while expanded', () => {
    const { container } = draw('FilterPanel', {
      sections: [
        { heading: 'Status', facets: [{ label: 'Open', value: 'open' }] },
        { heading: 'Priority', facets: [{ label: 'High', value: 'high' }], collapsed: true },
      ],
    });
    const headers = [...container.querySelectorAll('button[aria-expanded]')];
    expect(headers.length, 'one header per section').toBe(2);

    const [open, closed] = headers;
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(open.getAttribute('aria-controls')).toBeTruthy();
    expect(closed.getAttribute('aria-expanded')).toBe('false');
    expect(closed.getAttribute('aria-controls'), 'collapsed section mounts no region').toBeNull();
    expect(danglingRefs(container)).toEqual([]);

    fireEvent.click(closed);
    expect(closed.getAttribute('aria-controls')).toBeTruthy();
    expect(danglingRefs(container)).toEqual([]);
  });

  it('FacetList show-more: the hidden rows are named only once they exist', () => {
    const facets = ['a', 'b', 'c', 'd', 'e'].map((v) => ({ label: v.toUpperCase(), value: v }));
    const { container } = draw('FacetList', { facets, max: 2 });
    const toggle = container.querySelector('button[aria-expanded]')!;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // Pre-fix this listed frayme-facetlist-…-opt-2/3/4 while only opt-0/1 were
    // rendered — three dead references on a control in its resting state.
    expect(toggle.getAttribute('aria-controls')).toBeNull();
    expect(danglingRefs(container)).toEqual([]);

    fireEvent.click(toggle);
    const ids = (toggle.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean);
    expect(ids.length, 'one id per revealed row').toBe(facets.length - 2);
    expect(danglingRefs(container)).toEqual([]);
  });
});

describe('filter-compose ids are instance-unique (useAriaId, not the spec id alone)', () => {
  // filter-compose minted its own ids from `__fid`. json-render's `repeat`
  // re-renders one element per row reusing a single `__fid`, so two rows shared
  // every id and row two's header pointed at row one's panel — the defect
  // aria-repeat-ids.test.tsx already pins for the pairings migrated earlier.
  const CASES: Array<[string, Record<string, unknown>]> = [
    ['FacetList', { facets: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }, { label: 'C', value: 'c' }], max: 1 }],
    ['FilterPanel', { sections: [{ heading: 'Status', facets: [{ label: 'Open', value: 'open' }] }] }],
  ];

  for (const [type, props] of CASES) {
    it(`${type}: two repeat rows get distinct, resolving aria-controls`, () => {
      const spec = {
        root: 'list',
        state: { rows: [{ id: 'a' }, { id: 'b' }] },
        elements: {
          list: { type: 'Stack', props: {}, repeat: { statePath: '/rows', key: 'id' }, children: ['sut'] },
          sut: { type, props },
        },
      } as unknown as Spec;
      const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);

      // FacetList's trigger only names rows once expanded, so expand both first —
      // otherwise this passes vacuously on zero aria-controls.
      for (const t of [...container.querySelectorAll('button[aria-expanded="false"]')]) fireEvent.click(t);

      const controls = [...container.querySelectorAll('[aria-controls]')].map(
        (e) => e.getAttribute('aria-controls') ?? '',
      );
      expect(controls.length, 'expected one trigger per repeat row').toBe(2);
      expect(new Set(controls).size, `both rows share aria-controls: ${controls[0]}`).toBe(2);

      const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
      expect(new Set(ids).size, `duplicate ids across repeat rows: ${ids.join(', ')}`).toBe(ids.length);
      expect(danglingRefs(container)).toEqual([]);
    });
  }
});

describe('filter-compose target sizes clear the 24px floor', () => {
  // jsdom does no layout, so these assert the mechanism whose PIXEL effect was
  // measured in headless Chromium (numbers in this file's header comment).
  it('FacetList show-more carries the min-h-6 floor', () => {
    const { container } = draw('FacetList', {
      facets: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
      max: 1,
    });
    const toggle = container.querySelector('button[aria-expanded]')!;
    expect(toggle.className).toContain('min-h-6');
    // a FLOOR, not a fixed height: h-6 would clip a larger theme font
    expect(toggle.className).not.toMatch(/(^|\s)h-6(\s|$)/);
  });

  it('FilterBar clear-all carries the min-h-6 floor', () => {
    const { container } = draw('FilterBar', {
      filters: [{ label: 'Status: Open', value: 'status:open' }],
      showClear: true,
      clearLabel: 'Clear all',
    });
    const clear = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Clear all',
    )!;
    expect(clear).toBeTruthy();
    expect(clear.className).toContain('min-h-6');
    expect(clear.className).not.toMatch(/(^|\s)h-6(\s|$)/);
  });

  it('FilterBar chip remove keeps 16px of ink but a 24px target', () => {
    const { container } = draw('FilterBar', {
      filters: [{ label: 'Created after 12 Aug', value: 'after:2026-08-12', removable: true }],
    });
    const x = [...container.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('Remove'),
    )!;
    expect(x).toBeTruthy();
    // the pseudo needs a positioned box to hang off, or it centres on the page
    expect(x.className).toContain('relative');
    expect(x.className).toContain("before:content-['']");
    expect(x.className).toContain('before:absolute');
    expect(x.className).toContain('before:h-6');
    expect(x.className).toContain('before:w-6');
    // the drawn control must NOT have grown — that was the whole reason for the
    // pseudo rather than min-h-6/min-w-6 here
    expect(x.className).toContain('h-4');
    expect(x.className).toContain('w-4');
  });
});
