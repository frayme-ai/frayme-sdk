/**
 * Regression guard — the NAV + board + structure + data-display-extended
 * fixes (navigation.tsx, board-nav.tsx, structure-flow.tsx,
 * data-display-extended.tsx):
 *
 *   Stat sparklineColor  · PageHeader divider
 *   Breadcrumb maxItems  · Navbar brandIcon/font/weight
 *   SidebarItem collapsed title · BoardColumn columnBg + emptyText
 *   NavigationMenu active · Stepper per-step tone · Tree size
 *
 * Follows test/value-channels.test.tsx: channel triple (var + consumer class +
 * competitor deduped) for value channels, behavioral assertions for the rest,
 * and a per-item UNSET-DEFAULT check — a prop explicitly null renders
 * BYTE-IDENTICAL innerHTML to the prop never being mentioned (additive rule),
 * except SidebarItem (title attr set only when collapsed).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/** See test/aria-repeat-ids.test.tsx: aria pairing ids carry a per-INSTANCE
 *  useId token so a component inside a `repeat` cannot emit duplicate ids. Two
 *  separate mounts differ there by design; the null-vs-absent invariant does not. */
const normIds = (html: string): string => html.replace(/_r_[0-9a-z]+_/g, '_rID_');

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

// A parent element + one child element (child id 'child'); the parent's children
// slot references it. Used for Sidebar > SidebarItem (collapsed context).
const parentChild = (
  parentType: string,
  parentProps: Record<string, unknown>,
  childType: string,
  childProps: Record<string, unknown>,
): Spec =>
  ({
    root: 'el',
    elements: {
      el: { type: parentType, props: parentProps, children: ['child'] },
      child: { type: childType, props: childProps },
    },
    state: {},
  }) as unknown as Spec;

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── Stat — sparkline stroke colour channel ───────────────────────── */

describe('Stat — sparklineColor', () => {
  const base = { label: 'Revenue', value: '£24k', sparkline: [1, 4, 2, 8, 5] };

  it('sparklineColor SET → --fr-stat-spark var on the tile; the svg reads the spark→accent chain', () => {
    const { container } = draw('Stat', { ...base, sparklineColor: '#ff00aa' });
    const tile = container.querySelector('[style*="--fr-stat-spark"]');
    expect(tile, 'Stat tile carrying --fr-stat-spark').not.toBeNull();
    expect(styleOf(tile!)).toContain('--fr-stat-spark');
    const svg = container.querySelector('svg')!;
    // (b) the svg text-color reads the sparkline chain (spark → accent)
    expect(has(svg, 'text-[var(--fr-stat-spark,var(--fr-stat-accent))]')).toBe(true);
    // (c) the old accent-only reader is gone (the chain is the single source)
    expect(has(svg, 'text-[var(--fr-stat-accent)]')).toBe(false);
  });

  it('sparklineColor UNSET → byte-identical to the prop being absent', () => {
    const withNull = draw('Stat', { ...base, sparklineColor: null });
    const nullHtml = normIds(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Stat', { ...base });
    expect(nullHtml).toBe(normIds(without.container.innerHTML));
  });
});

/* ── PageHeader — bottom divider ──────────────────────────────────── */

describe('PageHeader — divider', () => {
  it('divider:true → the header carries border-b + border-border + pb-4', () => {
    const { container } = draw('PageHeader', { title: 'Team members', divider: true });
    const header = container.querySelector('header')!;
    expect(has(header, 'border-b')).toBe(true);
    expect(has(header, 'border-border')).toBe(true);
    expect(has(header, 'pb-4')).toBe(true);
  });

  it('divider unset → no border-b; divider:null byte-identical to absent', () => {
    const { container } = draw('PageHeader', { title: 'Team members' });
    expect(has(container.querySelector('header')!, 'border-b')).toBe(false);

    const withNull = draw('PageHeader', { title: 'Team members', divider: null });
    const nullHtml = normIds(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('PageHeader', { title: 'Team members' });
    expect(nullHtml).toBe(normIds(without.container.innerHTML));
  });
});

/* ── Breadcrumb — long-trail collapse ─────────────────────────────── */

describe('Breadcrumb — maxItems collapse', () => {
  const trail = [
    { label: 'Home', href: '/' },
    { label: 'A', href: '/a' },
    { label: 'B', href: '/b' },
    { label: 'C', href: '/c' },
    { label: 'Current', href: null },
  ];

  it('maxItems:3 → collapses the middle to a "…" entry, keeps first + last', () => {
    const { container } = draw('Breadcrumb', { items: trail, maxItems: 3 });
    const nav = container.querySelector('nav[aria-label="Breadcrumb"]')!;
    // the ellipsis sentinel is present
    const ellipsis = nav.querySelector('[aria-label="Show hidden pages"]');
    expect(ellipsis, 'collapse ellipsis entry').not.toBeNull();
    expect(ellipsis!.textContent).toContain('…');
    // the first and current labels still render; a middle one (A) is dropped
    expect(nav.textContent).toContain('Home');
    expect(nav.textContent).toContain('Current');
    expect(nav.textContent).not.toContain('A');
    expect(nav.textContent).not.toContain('B');
  });

  it('trail shorter than maxItems → no collapse; unset byte-identical to absent', () => {
    // maxItems above the item count → every item, no ellipsis
    const big = draw('Breadcrumb', { items: trail, maxItems: 10 });
    expect(big.container.querySelector('[aria-label="Show hidden pages"]')).toBeNull();
    big.unmount();

    const withNull = draw('Breadcrumb', { items: trail, maxItems: null });
    const nullHtml = normIds(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Breadcrumb', { items: trail });
    expect(nullHtml).toBe(normIds(without.container.innerHTML));
  });
});

/* ── Navbar — brand typography / icon ─────────────────────────────── */

describe('Navbar — brandIcon + font + weight', () => {
  it('brandIcon (registry name) renders a leading glyph beside the wordmark', () => {
    const { container } = draw('Navbar', { brand: 'Frayme', brandIcon: 'home' });
    // an <svg> from the Icon registry sits inside the brand span
    const brand = container.querySelector('nav > span')!;
    expect(brand.querySelector('svg'), 'brand leading glyph').not.toBeNull();
    expect(brand.textContent).toContain('Frayme');
  });

  it('unknown brandIcon → no glyph (single-span path); font/weight restyle the wordmark', () => {
    const noGlyph = draw('Navbar', { brand: 'Frayme', brandIcon: 'definitely-not-an-icon' });
    expect(noGlyph.container.querySelector('nav > span svg')).toBeNull();
    noGlyph.unmount();

    const { container } = draw('Navbar', { brand: 'Frayme', font: 'serif', weight: 'bold' });
    const brand = container.querySelector('nav > span')!;
    expect(has(brand, 'font-serif')).toBe(true);
    // weight added LAST dedupes font-semibold → font-bold present, font-semibold gone
    expect(has(brand, 'font-bold')).toBe(true);
    expect(has(brand, 'font-semibold')).toBe(false);
  });

  it('brandIcon/font/weight unset → byte-identical to absent', () => {
    const withNull = draw('Navbar', { brand: 'Frayme', brandIcon: null, font: null, weight: null });
    const nullHtml = normIds(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Navbar', { brand: 'Frayme' });
    expect(nullHtml).toBe(normIds(without.container.innerHTML));
  });
});

/* ── SidebarItem — collapsed icon-only row title ───────────────────── */

describe('SidebarItem — collapsed title attr', () => {
  it('parent Sidebar collapsed → the item anchor/button carries title=label', () => {
    const { container } = render(
      <FraymeRenderer
        spec={parentChild('Sidebar', { collapsed: true }, 'SidebarItem', { label: 'Dashboard', icon: 'home' })}
        mode="progressive"
      />,
    );
    // the SidebarItem renders a <button> (no href) inside the rail nav
    const control = container.querySelector('nav button, nav a')!;
    expect(control, 'sidebar item control').not.toBeNull();
    expect(control.getAttribute('title')).toBe('Dashboard');
  });

  it('parent Sidebar expanded → NO title attr (byte-identical default)', () => {
    const { container } = render(
      <FraymeRenderer
        spec={parentChild('Sidebar', { collapsed: false }, 'SidebarItem', { label: 'Dashboard', icon: 'home' })}
        mode="progressive"
      />,
    );
    const control = container.querySelector('nav button, nav a')!;
    expect(control.getAttribute('title')).toBeNull();
  });
});

/* ── BoardColumn — column surface + empty state ────────────────────── */

describe('BoardColumn — columnBg + emptyText', () => {
  it('columnBg SET → --fr-boardcolumn-bg var + reader class; bg-muted/40 deduped', () => {
    const { container } = draw('BoardColumn', { title: 'To do', columnBg: '#101827' });
    const section = container.querySelector('section')!;
    expect(styleOf(section)).toContain('--fr-boardcolumn-bg');
    // (b) the value reader is present
    expect(has(section, '[background:var(--fr-boardcolumn-bg,var(--color-muted))]')).toBe(true);
    // (c) the default track fill is mutually-exclusive → gone when columnBg is set
    expect(has(section, 'bg-muted/40')).toBe(false);
  });

  it('empty column + emptyText → renders the placeholder text', () => {
    const { container } = draw('BoardColumn', { title: 'To do', emptyText: 'Nothing here yet' });
    expect(container.textContent).toContain('Nothing here yet');
  });

  it('columnBg + emptyText unset → keeps bg-muted/40; null byte-identical to absent', () => {
    const { container } = draw('BoardColumn', { title: 'To do' });
    expect(has(container.querySelector('section')!, 'bg-muted/40')).toBe(true);

    const withNull = draw('BoardColumn', { title: 'To do', columnBg: null, emptyText: null });
    const nullHtml = normIds(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('BoardColumn', { title: 'To do' });
    expect(nullHtml).toBe(normIds(without.container.innerHTML));
  });
});

/* ── NavigationMenu — current-page state ──────────────────────────── */

describe('NavigationMenu — per-item active', () => {
  // inherited-foreground: the RESTING branch's colour moved from
  // `text-foreground` to `text-inherit`. What this test was written to pin — that
  // the two branches are MUTUALLY EXCLUSIVE, so exactly one colour paints and the
  // active accent is never shadowed — is unchanged; the resting entry still
  // carries a colour declaration (an <a> without one falls to UA link blue), it
  // just takes it from the container instead of repainting the global token over
  // a surface navWrap does not own. See inherited-foreground-feedback-board-filter.test.tsx.
  it('active leaf → accent text + aria-current=page; resting leaf declares inherit', () => {
    const { container } = draw('NavigationMenu', {
      items: [
        { label: 'Home', href: '/', active: true },
        { label: 'Docs', href: '/docs' },
      ],
    });
    const links = [...container.querySelectorAll('a')];
    const home = links.find((a) => a.textContent?.includes('Home'))!;
    expect(home.getAttribute('aria-current')).toBe('page');
    expect(has(home, '[color:var(--fr-navmenu-accent)]')).toBe(true);
    expect(has(home, 'text-inherit')).toBe(false);
    expect(has(home, 'text-foreground')).toBe(false);
    // the non-active leaf carries the resting colour and no aria-current
    const docs = links.find((a) => a.textContent?.includes('Docs'))!;
    expect(has(docs, 'text-inherit')).toBe(true);
    expect(has(docs, '[color:var(--fr-navmenu-accent)]')).toBe(false);
    expect(docs.getAttribute('aria-current')).toBeNull();
  });

  it('active unset → byte-identical to absent', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Docs', href: '/docs' },
    ];
    const withNull = draw('NavigationMenu', { items: items.map((it) => ({ ...it, active: null })) });
    const nullHtml = normIds(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('NavigationMenu', { items });
    expect(nullHtml).toBe(normIds(without.container.innerHTML));
  });
});

/* ── Stepper — per-step status tone ───────────────────────────────── */

describe('Stepper — per-step tone', () => {
  const steps = [{ label: 'Account' }, { label: 'Profile', tone: 'critical' }, { label: 'Done' }];

  it('critical step → the danger marker treatment overrides the state look', () => {
    const { container } = draw('Stepper', { steps, current: 2 });
    // marker spans are the aria-hidden rounded circles
    const markers = [...container.querySelectorAll('span[aria-hidden]')].filter((s) => has(s, 'rounded-full'));
    // the critical step (index 1) marker carries the danger treatment. That is
    // now the SUBTLE form (tint + red ring + red glyph), not the old solid `bg-danger`
    // slab — same intent, the marker still overrides the done/current/future chrome.
    const critical = markers.find((m) => has(m, '[background:color-mix(in_srgb,var(--color-danger)_12%,transparent)]'));
    expect(critical, 'critical toned marker').not.toBeNull();
    expect(has(critical!, '[color:var(--color-danger)]')).toBe(true);
    expect(has(critical!, 'border-[color:var(--color-danger)]')).toBe(true);
    // and it is NOT the saturated slab any more
    expect(has(critical!, 'bg-danger')).toBe(false);
    expect(has(critical!, 'text-danger-foreground')).toBe(false);
  });

  it('tone unset → byte-identical to absent', () => {
    const plain = [{ label: 'Account' }, { label: 'Profile' }, { label: 'Done' }];
    const withNull = draw('Stepper', { steps: plain.map((s) => ({ ...s, tone: null })), current: 1 });
    const nullHtml = normIds(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Stepper', { steps: plain, current: 1 });
    expect(nullHtml).toBe(normIds(without.container.innerHTML));
  });
});

/* ── Tree — density / typography ──────────────────────────────────── */

describe('Tree — size (row density)', () => {
  const nodes = [{ label: 'src', children: [{ label: 'index.ts' }] }];

  it('size:sm / lg → the row density classes; md keeps py-1 text-sm', () => {
    for (const [size, py, txt] of [
      ['sm', 'py-0.5', 'text-[0.8125rem]'],
      ['md', 'py-1', 'text-sm'],
      ['lg', 'py-1.5', 'text-base'],
    ] as const) {
      const { container, unmount } = draw('Tree', { nodes, size, defaultExpandedDepth: 1 });
      const row = container.querySelector('[role="treeitem"] > div')!;
      expect(row, `tree row at size ${size}`).not.toBeNull();
      expect(has(row, py), `${py} on the ${size} row`).toBe(true);
      expect(has(row, txt), `${txt} on the ${size} row`).toBe(true);
      unmount();
    }
  });

  it('size unset → byte-identical to absent (md default)', () => {
    const withNull = draw('Tree', { nodes, size: null, defaultExpandedDepth: 1 });
    const nullHtml = normIds(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Tree', { nodes, defaultExpandedDepth: 1 });
    expect(nullHtml).toBe(normIds(without.container.innerHTML));
  });
});
