/**
 * actions.tsx — the joined strips are scrollers that did not scroll, and the
 * DropdownMenu trigger pointed at a menu that was not in the document.
 *
 * 1. SCROLLER CHILDREN. ToggleGroup(attached) and every horizontal ButtonGroup
 *    render `fr-tabscroll-card flex-nowrap overflow-x-auto` — a rail whose items
 *    are meant to keep their width while the TRACK scrolls. Both item recipes
 *    carry `min-w-0` (bgItem's base, the toggle base), which is exactly the
 *    permission a flex line needs to take an item below its content. Measured in
 *    headless Chromium against the compiled utilities (dist/frayme.css), a
 *    three-segment ButtonGroup in a 166px flex host:
 *      segments 86·106·78px → 54·63·51px, each label span left WIDER than the
 *      button holding it (56/76/48 in 54/63/51), and scrollWidth === clientWidth
 *      === 166 — the rail could not be scrolled to the text it had just hidden.
 *    A ToggleGroup strip labelled Yesterday/This week/This quarter behaved the
 *    same way and broke every label onto a second line (30px tall → 45px).
 *    With `shrink-0` on the items: 86·106·78 held, track 268 over a 166px port.
 *
 *    The same measurement caught a second half of the defect. Both strips are
 *    `inline-flex`, so their width is shrink-to-fit, and a shrink-to-fit box
 *    floors at its CONTENT — in a 166px BLOCK host the ButtonGroup laid out
 *    268px wide, 102px of it painted outside the host, again with
 *    scrollWidth === clientWidth. `max-w-full` caps the port at the container so
 *    the overflow lands in the strip's own scroller instead of on the page.
 *
 *    The fix is deliberately NOT applied to the detached (wrapping) ToggleGroup
 *    or to a vertical group: shrink-0 on a wrapping row is what CAUSES the
 *    overflow it is meant to prevent, and a column does not scroll in x.
 *    Re-measured after the fix to prove the exemption holds — the detached group
 *    with the same three labels still lays out 166x97 in the 166px host (three
 *    wrapped rows, nothing escaping, nothing scrolling).
 *    It is also mutually exclusive with the fullWidth `flex-1` — `flex: 1 1 0%`
 *    and `flex-shrink: 0` disagree, tw-merge keeps both (separate property
 *    groups), and stylesheet order would pick the winner. fullWidth is an
 *    explicit one-row contract (the fitted-tab / fullWidth-SegmentedControl
 *    deal), so its labels wrap instead.
 *
 * 2. DANGLING aria-controls. The DropdownMenu trigger emitted `aria-controls`
 *    unconditionally while the menu mounts only when open, so a closed trigger
 *    named an id that is not in the document. This is the Toggletip defect
 *    (toggletip-disclosure.test.tsx) and the ai-flow one
 *    (ai-flow-filter-disclosure.test.tsx) a third time; an accessibility audit over generated specs found
 *    that every dangling reference sat on a CLOSED disclosure. ARIA only
 *    RECOMMENDS aria-controls beside aria-haspopup, so omitting it while closed
 *    costs nothing, whereas following a dangling IDREF lands a reader nowhere.
 *
 * NOT a defect, checked and left alone: data-table.tsx's `fr-tabscroll-card
 * w-full overflow-x-auto` port matches the same shape but already floors its
 * table at a readable width per column (`min-w-[max(100%,var(--fr-dt-minw,0px))]`,
 * data-table.tsx). Measured, a 4-column table in a 166px host: port 166 over a
 * 512px table, scrolling, in both block and flex parents. Its children were
 * never the ones giving way.
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

const strip = (container: HTMLElement): HTMLElement => container.querySelector<HTMLElement>('[role="group"]')!;
const segments = (container: HTMLElement): HTMLElement[] => [...strip(container).children] as HTMLElement[];

const BUTTONS = [
  { label: 'Overview', value: 'o' },
  { label: 'Transactions', value: 't' },
  { label: 'Settings', value: 's' },
];
const ITEMS = [
  { label: 'Yesterday', value: 'd' },
  { label: 'This week', value: 'w' },
  { label: 'This quarter', value: 'q' },
];

describe('ButtonGroup — the horizontal strip is a rail its segments cannot collapse', () => {
  it('the track is capped at its container so the overflow lands in the scroller', () => {
    const { container } = draw('ButtonGroup', { buttons: BUTTONS });
    const cls = strip(container).className;
    expect(cls).toContain('overflow-x-auto');
    // Without this the inline-flex strip sizes to its 268px content inside a
    // 166px host and paints outside it — measured, see the header.
    expect(cls).toContain('max-w-full');
  });

  it('every segment keeps its intrinsic width', () => {
    const { container } = draw('ButtonGroup', { buttons: BUTTONS });
    for (const seg of segments(container)) {
      expect(seg.className, `segment "${seg.textContent}" can be squeezed below its label`).toContain('shrink-0');
    }
  });

  it('a VERTICAL group takes none of it — it joins on the block axis and never scrolls in x', () => {
    const { container } = draw('ButtonGroup', { buttons: BUTTONS, orientation: 'vertical' });
    expect(strip(container).className).not.toContain('overflow-x-auto');
    expect(strip(container).className).not.toContain('max-w-full');
    for (const seg of segments(container)) expect(seg.className).not.toContain('shrink-0');
  });

  it('fullWidth stays flex-1 and NEVER co-locates shrink-0 with it', () => {
    const { container } = draw('ButtonGroup', { buttons: BUTTONS, fullWidth: true });
    for (const seg of segments(container)) {
      expect(seg.className).toContain('flex-1');
      // Co-located, the two would disagree about flex-shrink and tw-merge keeps
      // both — the winner would be whichever utility the stylesheet emits last.
      expect(seg.className, 'flex-1 and shrink-0 are mutually exclusive by construction').not.toContain('shrink-0');
    }
  });

  it('fullWidth WITH an align is not a flex-1 row, so the segments hold their width', () => {
    const { container } = draw('ButtonGroup', { buttons: BUTTONS, fullWidth: true, align: 'center' });
    for (const seg of segments(container)) {
      expect(seg.className).not.toContain('flex-1');
      expect(seg.className).toContain('shrink-0');
    }
  });
});

describe('ToggleGroup — attached scrolls, detached wraps, and only one of them may pin its items', () => {
  it('attached: capped track, items keep their width', () => {
    const { container } = draw('ToggleGroup', { items: ITEMS, attached: true });
    const cls = strip(container).className;
    expect(cls).toContain('overflow-x-auto');
    expect(cls).toContain('max-w-full');
    for (const seg of segments(container)) {
      expect(seg.className, `item "${seg.textContent}" can be squeezed below its label`).toContain('shrink-0');
    }
  });

  it('DETACHED: the row WRAPS, so pinning its items would cause the overflow it prevents', () => {
    const { container } = draw('ToggleGroup', { items: ITEMS });
    expect(strip(container).className).toContain('flex-wrap');
    expect(strip(container).className).not.toContain('overflow-x-auto');
    for (const seg of segments(container)) {
      expect(seg.className, 'a wrapping row must be able to give way').not.toContain('shrink-0');
    }
  });

  it('attached + vertical: a column has no inline-axis scroll to feed', () => {
    const { container } = draw('ToggleGroup', { items: ITEMS, attached: true, orientation: 'vertical' });
    expect(strip(container).className).not.toContain('overflow-x-auto');
    expect(strip(container).className).not.toContain('max-w-full');
    for (const seg of segments(container)) expect(seg.className).not.toContain('shrink-0');
  });

  it('attached + fullWidth: flex-1 owns the row, shrink-0 stays away from it', () => {
    const { container } = draw('ToggleGroup', { items: ITEMS, attached: true, fullWidth: true });
    for (const seg of segments(container)) {
      expect(seg.className).toContain('flex-1');
      expect(seg.className).not.toContain('shrink-0');
    }
  });
});

describe('DropdownMenu — aria-controls never outlives the menu', () => {
  const PROPS = { label: 'Pick', items: [{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b' }] };

  it('closed: haspopup + expanded=false, and NO reference to an unmounted panel', () => {
    const { container } = draw('DropdownMenu', PROPS);
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls'), 'the menu panel is not mounted while closed').toBeNull();
  });

  it('open: the reference resolves to exactly one live menu, and dies with it', () => {
    const { container } = draw('DropdownMenu', PROPS);
    const btn = container.querySelector('button')!;

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const id = btn.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    // Resolution, not mere presence — the whole point of the defect.
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.getAttribute('role')).toBe('menu');

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-controls'), 'the reference must not survive the close').toBeNull();
  });

  it('two repeat rows, both open: distinct ids, each resolving to its OWN menu', () => {
    // aria-repeat-ids.test.tsx covers the same pairing generically and opens the
    // rows via a conditional "click anything still collapsed" step. Pinned again
    // here, explicitly, because this component is now the reason that step has to
    // exist: it names its menu ONLY while open, so a generic reader that measures
    // straight after render would find nothing and pass vacuously. The property
    // being guarded is the original one — one spec id is reused for every repeat
    // row (measured as two rows both emitting `frayme-menu-sut`), so the id has
    // to come from useAriaId's per-INSTANCE token.
    const spec = {
      root: 'list',
      state: { rows: [{ id: 'a' }, { id: 'b' }] },
      elements: {
        list: { type: 'Stack', props: {}, repeat: { statePath: '/rows', key: 'id' }, children: ['sut'] },
        sut: { type: 'DropdownMenu', props: PROPS },
      },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);

    const triggers = [...container.querySelectorAll('button[aria-haspopup="menu"]')];
    expect(triggers.length, 'expected one trigger per repeat row').toBe(2);
    for (const t of triggers) fireEvent.click(t);

    const controls = triggers.map((t) => t.getAttribute('aria-controls') ?? '');
    expect(controls.every(Boolean), 'an open trigger must name its menu').toBe(true);
    expect(new Set(controls).size, `both rows share aria-controls: ${controls[0]}`).toBe(2);
    for (const c of controls) expect(container.querySelectorAll(`[id="${c}"]`).length, `${c} resolves to no element`).toBe(1);
  });
});
