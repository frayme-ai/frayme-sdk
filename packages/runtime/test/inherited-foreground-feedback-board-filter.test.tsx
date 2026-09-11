/**
 * INHERITED-FOREGROUND guard — feedback-extended, board-nav, filter-compose.
 *
 * The defect: a spec authors `Card { bg:"#12161f", color:"#e2e6f0" }`, the colour
 * inherits correctly down two levels, and then a control RESETS it to the global
 * token. Measured on a generated feature-flag console:
 *
 *   SECTION (Card)  color rgb(226,230,240)  bg rgb(18,22,31)   <- authored
 *   DIV   (Stack)   color rgb(226,230,240)                     <- inherits
 *   BUTTON          color rgb(24,24,27)                        <- RESETS  1.02:1
 *
 * Many contrast findings in generated specs are this shape — text
 * the same colour as its own background — and the spec did nothing wrong.
 *
 * The fix is `currentColor` / `text-inherit` as the LAST RESORT of a foreground
 * chain, and it is safe because frayme.css points BOTH `.frayme-root { color }`
 * and `--color-foreground` at `--frayme-fg`: at the top level the two resolve to
 * the same value (byte-identical), and inside an authored container the inherited
 * one is the only correct answer. On the `color` property `currentColor` computes
 * to the INHERITED colour, so there is no cycle.
 *
 * It is NOT a blanket rename, which is what the second half of every case below
 * pins: an element that paints its OWN fill (an opaque `bg-muted`/`bg-card` slab,
 * a button's accent slab, a flyout surface) must keep the token its fill is
 * partnered with — inheriting the container's ink onto a surface the element
 * painted itself is the same bug pointing the other way.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── feedback-extended ────────────────────────────────────────────────────── */

describe('NotFound / Result — a transparent panel inherits its ink', () => {
  it('NotFound root: fg chain ends in currentColor, not the foreground token', () => {
    const { container } = draw('NotFound', { title: 'No results' });
    const root = container.querySelector('[role="alert"]')!;
    expect(has(root, 'text-[color:var(--fr-notfound-fg,currentColor)]')).toBe(true);
    expect(has(root, 'text-[color:var(--fr-notfound-fg,var(--color-foreground))]')).toBe(false);
    // The panel fill it borrows is transparent — that is WHY it may inherit.
    expect(has(root, '[background:var(--fr-notfound-bg,transparent)]')).toBe(true);
  });

  it('NotFound action KEEPS the token: that chain is a background, not ink', () => {
    const { container } = draw('NotFound', { title: 'No results', actionLabel: 'Home' });
    const btn = container.querySelector('button')!;
    expect(has(btn, 'bg-[color:var(--fr-notfound-accent,var(--color-foreground))]')).toBe(true);
    expect(has(btn, 'text-card')).toBe(true);
  });

  it('Result root: fg chain ends in currentColor, not the foreground token', () => {
    const { container } = draw('Result', { title: 'Done' });
    const root = container.querySelector('[role="status"]')!;
    expect(has(root, 'text-[color:var(--fr-result-fg,currentColor)]')).toBe(true);
    expect(has(root, 'text-[color:var(--fr-result-fg,var(--color-foreground))]')).toBe(false);
  });

  it('Result actions: transparent secondary inherits, slab-painting primary does not', () => {
    const { container } = draw('Result', { title: 'Done', actions: [{ label: 'View' }, { label: 'Back' }] });
    const [primary, secondary] = [...container.querySelectorAll('button')];
    expect(has(secondary, 'text-[color:var(--fr-result-fg,currentColor)]')).toBe(true);
    expect(has(secondary, 'bg-transparent')).toBe(true);
    // The primary paints its own fill and prints `text-card` on it: currentColor
    // there would make the slab equal the ink.
    expect(has(primary, 'bg-[color:var(--fr-result-accent,var(--color-foreground))]')).toBe(true);
    expect(has(primary, 'text-card')).toBe(true);
  });
});

describe('Banner — the 10% tinted tones inherit, the opaque neutral does not', () => {
  it('tone tints (90% of the surface underneath shows through) inherit', () => {
    for (const tone of ['success', 'warning', 'critical', 'info']) {
      const { container } = draw('Banner', { message: 'Deploying', tone });
      const el = container.querySelector('[role="status"]')!;
      expect(has(el, 'text-inherit'), `${tone} banner inherits its ink`).toBe(true);
      expect(has(el, 'text-foreground'), `${tone} banner drops the baked token`).toBe(false);
    }
  });

  /* This used to read "neutral KEEPS text-foreground — bg-muted is an opaque token
     fill". That premise held only while nothing re-pointed the token: an opaque fill
     was safe BECAUSE --color-muted stayed a light-theme value whatever surface it
     landed on, which is precisely the light-island defect. The neutral tone now
     paints the surface channel, so its ink follows the same surface rather than a
     global token. What is still guarded is unchanged and is the point of this file:
     the fill and its ink move TOGETHER, and neither is text-inherit — an opaque band
     must still carry ink paired with ITS OWN fill, not with whatever is behind it. */
  it('neutral rides the surface channel — the band and its ink move together', () => {
    const { container } = draw('Banner', { message: 'Heads up', tone: 'neutral' });
    const el = container.querySelector('[role="status"]')!;
    expect(has(el, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(el, 'text-[color:var(--fr-surface-fg,var(--color-foreground))]')).toBe(true);
    expect(has(el, 'text-inherit')).toBe(false);
    // the global token is still the LAST step, so an unstyled page is unchanged
    expect(has(el, 'text-foreground')).toBe(false);
  });
});

/* ── board-nav ────────────────────────────────────────────────────────────── */

describe('BoardColumn title — follows the track it actually stands on', () => {
  const facets = { title: 'In progress', count: 3 };

  it('columnBg UNSET (bg-muted/40 lets 60% of the container through) → inherits', () => {
    const { container } = draw('BoardColumn', facets);
    const t = container.querySelector('[data-fr-col-title]')!;
    expect(has(t, 'text-[color:var(--fr-boardcolumn-accent,var(--fr-kanbanboard-accent,currentColor))]')).toBe(true);
    expect(has(t, 'text-[color:var(--fr-boardcolumn-accent,var(--fr-kanbanboard-accent,var(--color-foreground)))]')).toBe(false);
  });

  it('columnBg SET (the shell owns an opaque fill) → keeps the token', () => {
    const { container } = draw('BoardColumn', { ...facets, columnBg: '#101010' });
    const t = container.querySelector('[data-fr-col-title]')!;
    expect(has(t, 'text-[color:var(--fr-boardcolumn-accent,var(--fr-kanbanboard-accent,var(--color-foreground)))]')).toBe(true);
    expect(has(t, 'text-[color:var(--fr-boardcolumn-accent,var(--fr-kanbanboard-accent,currentColor))]')).toBe(false);
  });

  it('the KanbanCard title still reads its own card chain (the card paints its fill)', () => {
    const { container } = draw('KanbanCard', { title: 'Ship it' });
    const t = container.querySelector('button')!;
    expect(has(t, 'text-[color:var(--fr-kanbancard-fg,var(--color-foreground))]')).toBe(true);
  });
});

describe('NavigationMenu — resting entries inherit, painted states do not', () => {
  const items = [{ label: 'Home', href: '/' }, { label: 'Docs', children: [{ label: 'Intro', href: '/i' }] }];

  it('resting leaf link: color:inherit (an <a> still needs a declaration — UA blue)', () => {
    const { container } = draw('NavigationMenu', { items });
    const link = container.querySelector('a')!;
    expect(has(link, 'text-inherit')).toBe(true);
    expect(has(link, 'text-foreground')).toBe(false);
  });

  it('resting parent trigger: color:inherit while it is bg-transparent', () => {
    const { container } = draw('NavigationMenu', { items });
    const trigger = container.querySelector('button[aria-haspopup="menu"]')!;
    expect(has(trigger, 'text-inherit')).toBe(true);
    expect(has(trigger, 'bg-transparent')).toBe(true);
  });

  it('the ACTIVE entry keeps the accent reader (mutually exclusive, not additive)', () => {
    const { container } = draw('NavigationMenu', { items: [{ label: 'Home', href: '/', active: true }] });
    const link = container.querySelector('a')!;
    expect(has(link, '[color:var(--fr-navmenu-accent)]')).toBe(true);
    expect(has(link, 'text-inherit')).toBe(false);
  });
});

/* ── filter-compose ───────────────────────────────────────────────────────── */

describe('FacetRow label — one row component, two surfaces, two answers', () => {
  const label = (container: Element): Element =>
    container.querySelector('label span.flex-1')!;

  it('inside FacetList (paints nothing) → inherits the container ink', () => {
    const { container } = draw('FacetList', { facets: [{ label: 'Open', value: 'open' }] });
    expect(has(label(container), 'text-inherit')).toBe(true);
    expect(has(label(container), 'text-foreground')).toBe(false);
  });

  it('inside FilterPanel (paints an opaque bg-card slab) → keeps the token', () => {
    const { container } = draw('FilterPanel', {
      sections: [{ heading: 'Status', facets: [{ label: 'Open', value: 'open' }] }],
    });
    expect(has(label(container), 'text-foreground')).toBe(true);
    expect(has(label(container), 'text-inherit')).toBe(false);
  });
});

describe('Hover states — only the ones that paint no fill inherit', () => {
  it('FilterBar clear-all: hover inherits (no hover fill under it)', () => {
    const { container } = draw('FilterBar', { filters: [{ label: 'Open', value: 'open' }], showClear: true });
    const clear = [...container.querySelectorAll('button')].find((b) => has(b, 'hover:text-inherit'));
    expect(clear, 'clear-all carrying hover:text-inherit').toBeTruthy();
    expect(has(clear!, 'hover:text-foreground')).toBe(false);
  });

  it('FacetList show-more: hover inherits (no hover fill under it either)', () => {
    const { container } = draw('FacetList', {
      facets: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }, { label: 'C', value: 'c' }],
      max: 1,
    });
    const more = container.querySelector('button[aria-expanded]')!;
    expect(has(more, 'hover:text-inherit')).toBe(true);
    expect(has(more, 'hover:text-foreground')).toBe(false);
  });

  it('RichComposer toolbar: hover KEEPS the token — it pairs with hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', () => {
    const { container } = draw('RichComposer', {});
    const tool = [...container.querySelectorAll('button')].find((b) => has(b, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]'));
    expect(tool, 'a toolbar button pairing hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]').toBeTruthy();
    // The toolbar's hover FILL moved onto the sunken channel, so its hover INK moved
    // with it — a hover that repaints the ground while pinning the text inverts the
    // pair mid-hover. Both chains still end in their global token.
    expect(has(tool!, 'hover:text-[color:var(--fr-surface-fg,var(--color-foreground))]')).toBe(true);
    expect(has(tool!, 'hover:text-foreground')).toBe(false);
  });
});
