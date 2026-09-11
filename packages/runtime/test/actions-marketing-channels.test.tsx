/**
 * Regression guard — PARTIAL-PROP / COHERENCE-GROUP fixes across
 * actions.tsx · marketing-page.tsx · navigation.tsx · data-display-extended.tsx.
 *
 * For each fixed channel the test asserts the TRIPLE (value-channels pattern):
 *   (a) the channel var is present in the target element's inline style attr,
 *   (b) the CONSUMING class is present in its className,
 *   (c) the competing token class it must dedupe is ABSENT when the prop is set.
 *
 * Plus per-component UNSET-DEFAULT tests: a spec with the channel prop
 * explicitly unset (null) renders BYTE-IDENTICAL innerHTML to a spec that never
 * mentions the prop at all.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── HIGH · ToggleGroup attached end caps (ButtonGroup parity) ────────────── */

const TG_ITEMS = [
  { label: 'One', value: 'one' },
  { label: 'Two', value: 'two' },
  { label: 'Three', value: 'three' },
];
const CAP_START_H =
  '[border-radius:var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_0_0_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))]';
const CAP_END_H =
  '[border-radius:0_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_0]';
const TOGGLE_SHORTHAND_READER =
  '[border-radius:var(--fr-toggle-radius,var(--fr-toggle-radius-default,var(--radius-frayme)))]';

describe('ToggleGroup attached — outer end-cap rounding (radius/radiusValue no longer suppressed)', () => {
  it('radiusValue lands in --fr-tgroup-radius on the group; first/last get the cap override; middle stays square', () => {
    const { container } = draw('ToggleGroup', { items: TG_ITEMS, attached: true, radiusValue: '10px' });
    const group = container.querySelector('[role="group"]')!;
    // (a) exact channel + the per-enum default var ride on the group wrapper
    expect(styleOf(group)).toContain('--fr-tgroup-radius');
    expect(styleOf(group)).toContain('--fr-tgroup-radius-default');
    const [first, mid, last] = [...group.querySelectorAll('button')];
    // (b) the end caps consume the group chain via the 4-value shorthand override
    expect(has(first, CAP_START_H), 'first cap class').toBe(true);
    expect(has(last, CAP_END_H), 'last cap class').toBe(true);
    // (c) the competing base shorthand reader is deduped on the caps (same
    // arbitrary property) but KEPT on the middle segment (square via enum none)
    expect(has(first, TOGGLE_SHORTHAND_READER)).toBe(false);
    expect(has(last, TOGGLE_SHORTHAND_READER)).toBe(false);
    expect(has(mid, TOGGLE_SHORTHAND_READER)).toBe(true);
    expect(has(mid, CAP_START_H)).toBe(false);
    expect(has(mid, CAP_END_H)).toBe(false);
  });

  it('radius enum feeds the end-cap default var (attached, no radiusValue)', () => {
    const { container } = draw('ToggleGroup', { items: TG_ITEMS, attached: true, radius: 'lg' });
    const group = container.querySelector('[role="group"]')!;
    expect(styleOf(group)).toContain('--fr-tgroup-radius-default: 1rem');
    const buttons = [...group.querySelectorAll('button')];
    expect(has(buttons[0], CAP_START_H)).toBe(true);
    expect(has(buttons[2], CAP_END_H)).toBe(true);
  });

  it('vertical attached uses the top/bottom cap variants', () => {
    const { container } = draw('ToggleGroup', { items: TG_ITEMS, attached: true, orientation: 'vertical' });
    const buttons = [...container.querySelectorAll('[role="group"] button')];
    expect(
      has(
        buttons[0],
        '[border-radius:var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_0_0]',
      ),
    ).toBe(true);
    expect(
      has(
        buttons[2],
        '[border-radius:0_0_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))]',
      ),
    ).toBe(true);
  });

  it('NON-attached keeps the per-item chain: radiusValue lands in --fr-toggle-radius (no cap classes)', () => {
    const { container } = draw('ToggleGroup', { items: TG_ITEMS, radiusValue: '10px' });
    const group = container.querySelector('[role="group"]')!;
    expect(styleOf(group)).toContain('--fr-toggle-radius');
    expect(styleOf(group)).not.toContain('--fr-tgroup-radius-default');
    for (const btn of group.querySelectorAll('button')) {
      expect(has(btn, TOGGLE_SHORTHAND_READER)).toBe(true);
      expect(has(btn, CAP_START_H)).toBe(false);
      expect(has(btn, CAP_END_H)).toBe(false);
    }
  });
});

/* ── HIGH · PricingTable — bg+color coherence covers ALL on-card text ─────── */

const PRICING_PLANS = [
  { name: 'Free', price: '£0', features: ['100 generations', 'Community support'] },
  { name: 'Pro', price: '£99', features: ['10,000 generations'], highlighted: true },
];
const PRICING_FG_READER = '[color:var(--fr-pricing-card-fg,var(--color-foreground))]';
const PRICING_CTA_FG = 'text-[color:var(--fr-pricing-card-fg,var(--color-foreground))]';
const PRICING_CTA_BORDER = 'border-[color:var(--fr-pricing-card-border,var(--color-border))]';
const PRICING_CTA_HOVER =
  'hover:[background:color-mix(in_srgb,var(--fr-pricing-card-fg,var(--color-foreground))_10%,transparent)]';

describe('PricingTable — card root color + neutral CTA read the surface pair', () => {
  it('color SET: the card ROOT carries the fg reader so feature items inherit it', () => {
    const { container } = draw('PricingTable', { plans: PRICING_PLANS, bg: '#112233', color: '#ffffff' });
    const wrapper = container.querySelector('[style*="--fr-pricing-card-fg"]')!;
    expect(wrapper, 'wrapper carrying --fr-pricing-card-fg').not.toBeNull();
    const grid = wrapper.firstElementChild!;
    const freeCard = grid.children[0]!;
    expect(has(freeCard, PRICING_FG_READER), 'card root fg reader').toBe(true);
  });

  it('neutral CTA triple: fg + border var readers present, token classes absent, hover swaps off bg-muted on a brand bg', () => {
    const { container } = draw('PricingTable', {
      plans: PRICING_PLANS,
      bg: '#112233',
      color: '#ffffff',
      borderColor: '#334455',
    });
    const grid = container.querySelector('[style*="--fr-pricing-card-fg"]')!.firstElementChild!;
    const cta = grid.children[0]!.querySelector('button')!;
    expect(has(cta, PRICING_CTA_FG)).toBe(true);
    expect(has(cta, PRICING_CTA_BORDER)).toBe(true);
    expect(has(cta, 'text-foreground')).toBe(false);
    expect(has(cta, 'border-border')).toBe(false);
    expect(has(cta, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
    expect(has(cta, PRICING_CTA_HOVER)).toBe(true);
  });

  it('bg UNSET: the neutral CTA keeps the exact hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] (mutually-exclusive hover)', () => {
    const { container } = draw('PricingTable', { plans: PRICING_PLANS });
    const cards = container.querySelectorAll('button');
    const cta = cards[0]!;
    expect(has(cta, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(cta, PRICING_CTA_HOVER)).toBe(false);
    // the fg/border readers are ALWAYS-ON folds with token fallbacks
    expect(has(cta, PRICING_CTA_FG)).toBe(true);
    expect(has(cta, PRICING_CTA_BORDER)).toBe(true);
  });
});

/* ── HIGH · PlanCard — the shared PlanCta neutral button reads the card vars ─ */

const PLANCARD_CTA_FG_ONSURF = 'text-[color:var(--fr-plancard-fg,var(--color-primary-foreground))]';
const PLANCARD_CTA_FG_TOKEN = 'text-[color:var(--fr-plancard-fg,var(--color-foreground))]';
const PLANCARD_CTA_BORDER = 'border-[color:var(--fr-plancard-border,var(--color-border))]';
const PLANCARD_CTA_HOVER =
  'hover:[background:color-mix(in_srgb,var(--fr-plancard-fg,var(--color-primary-foreground))_10%,transparent)]';

describe('PlanCard — neutral CTA follows bg/color/borderColor (onSurf parity with the root)', () => {
  it('bg+color+borderColor SET: CTA reads the plancard fg/border chains; no token classes; no muted hover flash', () => {
    const { container } = draw('PlanCard', {
      name: 'Pro',
      price: '£99',
      bg: '#112233',
      color: '#ffffff',
      borderColor: '#abcdef',
    });
    const root = container.querySelector('[style*="--fr-plancard-fg"]')!;
    expect(root).not.toBeNull();
    const cta = root.querySelector('button')!;
    expect(has(cta, PLANCARD_CTA_FG_ONSURF), 'onSurf fg reader (primary-foreground fallback mirrors the root)').toBe(true);
    expect(has(cta, PLANCARD_CTA_BORDER)).toBe(true);
    expect(has(cta, 'text-foreground')).toBe(false);
    expect(has(cta, 'border-border')).toBe(false);
    expect(has(cta, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
    expect(has(cta, PLANCARD_CTA_HOVER)).toBe(true);
  });

  it('bg UNSET: CTA keeps the foreground-fallback reader + the exact hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', () => {
    const { container } = draw('PlanCard', { name: 'Pro', price: '£99' });
    const cta = container.querySelector('button')!;
    expect(has(cta, PLANCARD_CTA_FG_TOKEN)).toBe(true);
    expect(has(cta, PLANCARD_CTA_FG_ONSURF)).toBe(false);
    expect(has(cta, PLANCARD_CTA_BORDER)).toBe(true);
    expect(has(cta, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(cta, PLANCARD_CTA_HOVER)).toBe(false);
  });
});

/* ── HIGH · Navbar — brand label gets the on-surface `color` channel ──────── */

describe('Navbar — brand label reads the new on-surface color channel', () => {
  it('color lands in --fr-navbar-fg; the brand span consumes it; text-foreground absent', () => {
    const { container } = draw('Navbar', { brand: 'Frayme', bg: '#0a0a23', color: '#fafafa' });
    const nav = container.querySelector('nav')!;
    expect(styleOf(nav)).toContain('--fr-navbar-fg');
    const brand = nav.querySelector('span')!;
    expect(has(brand, 'text-[color:var(--fr-navbar-fg,var(--color-foreground))]')).toBe(true);
    expect(has(brand, 'text-foreground')).toBe(false);
  });
});

/* ── HIGH · ListItem — leadingIcon + external arrow join the muted role ───── */

const LISTITEM_MUTED_READER = '[color:var(--fr-listitem-muted,var(--color-muted-foreground))]';
const LISTITEM_ACCENT_READER = '[color:var(--fr-listitem-accent,var(--fr-accent))]';

describe('ListItem — inline icons read the mutedColor channel (DatePicker-chevron model)', () => {
  it('leadingIcon: muted var on the row, the reader class on the icon span, text-muted-foreground absent', () => {
    const { container } = draw('ListItem', { title: 'Row', leadingIcon: 'settings', mutedColor: '#88aaff' });
    const row = container.querySelector('button')!;
    expect(styleOf(row)).toContain('--fr-listitem-muted');
    const icon = row.firstElementChild!;
    expect(has(icon, LISTITEM_MUTED_READER)).toBe(true);
    expect(has(icon, 'text-muted-foreground')).toBe(false);
  });

  it('ACTIVE row: the leading icon joins the accent group with the title (muted reader deduped away)', () => {
    const { container } = draw('ListItem', { title: 'Row', leadingIcon: 'settings', active: true, accent: '#0000ff' });
    const row = container.querySelector('button')!;
    const icon = row.firstElementChild!;
    expect(has(icon, LISTITEM_ACCENT_READER)).toBe(true);
    // same arbitrary color property → tw-merge keeps only the accent reader
    expect(has(icon, LISTITEM_MUTED_READER)).toBe(false);
  });

  it('external-link arrow reads the muted chain too', () => {
    const { container } = draw('ListItem', { title: 'Row', href: '/x', external: true, mutedColor: '#88aaff' });
    const a = container.querySelector('a')!;
    const arrow = a.lastElementChild!;
    expect(has(arrow, LISTITEM_MUTED_READER)).toBe(true);
    expect(has(arrow, 'text-muted-foreground')).toBe(false);
  });
});

/* ── MED · DropdownMenu — panel bg/border channels, accentText pairing, trigger radius ── */

const DD_PROPS = {
  label: 'Menu',
  items: [
    { label: 'Alpha', value: 'a' },
    { label: 'Beta', value: 'b' },
  ],
  value: 'a',
};

describe('DropdownMenu — panel channels + accentText on the selected item + trigger radius', () => {
  it('menuBg/borderColor: vars on the wrapper, group-form readers on the open panel, border-border deduped', () => {
    const { container } = draw('DropdownMenu', { ...DD_PROPS, menuBg: '#123123', borderColor: '#456456' });
    const wrapper = container.querySelector('[data-open]')!;
    expect(styleOf(wrapper)).toContain('--fr-menu-bg');
    expect(styleOf(wrapper)).toContain('--fr-menu-border');
    fireEvent.click(container.querySelector('button[aria-haspopup="menu"]')!);
    const panel = container.querySelector('[role="menu"]')!;
    expect(panel).not.toBeNull();
    expect(has(panel, '[background:var(--fr-menu-bg,var(--color-card))]')).toBe(true);
    expect(has(panel, 'border-[color:var(--fr-menu-border,var(--color-border))]')).toBe(true);
    expect(has(panel, 'border-border')).toBe(false);
  });

  it('accentText pairs with accent on the SELECTED item (var moved to the wrapper; selected accent reader deduped)', () => {
    const { container } = draw('DropdownMenu', { ...DD_PROPS, accent: '#00ff00', accentText: '#ffffff' });
    const wrapper = container.querySelector('[data-open]')!;
    expect(styleOf(wrapper)).toContain('--fr-menu-accent-text');
    fireEvent.click(container.querySelector('button[aria-haspopup="menu"]')!);
    const selected = container.querySelector('[data-selected="true"]')!;
    expect(has(selected, 'text-[color:var(--fr-menu-accent-text,var(--fr-menu-accent,var(--fr-accent)))]')).toBe(true);
    // the ddItem selected accent reader is the competing text-color class — deduped
    expect(has(selected, 'text-[color:var(--fr-menu-accent,var(--fr-accent))]')).toBe(false);
  });

  it('radiusValue rounds the TRIGGER too (feeds --fr-btn-radius on the trigger button)', () => {
    const { container } = draw('DropdownMenu', { ...DD_PROPS, radiusValue: '10px' });
    const trigger = container.querySelector('button[aria-haspopup="menu"]')!;
    expect(styleOf(trigger)).toContain('--fr-btn-radius');
  });
});

/* ── MED · Button — accent recolors the border edge (IconButton parity) ───── */

const BTN_ACCENT_BORDER = 'border-[color:var(--fr-btn-accent,var(--color-border))]';
const BTN_BORDER_OVERRIDE = 'border-[color:var(--fr-btn-border,var(--color-border))]';

describe('Button — accent covers the border edge; explicit borderColor still wins', () => {
  it('variant:secondary + accent: the accent border group form is present, border-border deduped', () => {
    const { container } = draw('Button', { label: 'Go', variant: 'secondary', accent: '#ff0000' });
    const btn = container.querySelector('button')!;
    expect(has(btn, '[background:var(--fr-btn-accent)]')).toBe(true);
    expect(has(btn, BTN_ACCENT_BORDER)).toBe(true);
    expect(has(btn, 'border-border')).toBe(false);
  });

  it('accent + borderColor: the explicit borderColor override dedupe-wins the group', () => {
    const { container } = draw('Button', { label: 'Go', variant: 'secondary', accent: '#ff0000', borderColor: '#00ff00' });
    const btn = container.querySelector('button')!;
    expect(has(btn, BTN_BORDER_OVERRIDE)).toBe(true);
    expect(has(btn, BTN_ACCENT_BORDER)).toBe(false);
  });

  it('surface:soft — the accent border stays OFF (soft keeps its transparent edge)', () => {
    const { container } = draw('Button', { label: 'Go', surface: 'soft', accent: '#ff0000' });
    const btn = container.querySelector('button')!;
    expect(has(btn, BTN_ACCENT_BORDER)).toBe(false);
  });
});

/* ── MED · Link — variant:button accepts accent/accentText ────────────────── */

describe('Link — the button surface takes the actionShared accent vocabulary', () => {
  it('variant:button + accent/accentText: fill + on-fill readers present, text-primary-foreground deduped', () => {
    const { container } = draw('Link', { label: 'Go', href: '/x', variant: 'button', accent: '#123456', accentText: '#ffffff' });
    const a = container.querySelector('a')!;
    expect(styleOf(a)).toContain('--fr-link-accent');
    expect(styleOf(a)).toContain('--fr-link-accent-text');
    expect(has(a, '[background:var(--fr-link-accent,var(--color-primary))]')).toBe(true);
    expect(has(a, 'text-[color:var(--fr-link-accent-text,var(--color-primary-foreground))]')).toBe(true);
    expect(has(a, 'text-primary-foreground')).toBe(false);
  });

  it('text variants: accent is inert (no var, no reader)', () => {
    const { container } = draw('Link', { label: 'Go', href: '/x', variant: 'inline', accent: '#123456' });
    const a = container.querySelector('a')!;
    expect(styleOf(a)).not.toContain('--fr-link-accent');
    expect(has(a, '[background:var(--fr-link-accent,var(--color-primary))]')).toBe(false);
  });
});

/* ── MED · FAQ — the closed chevron follows `color` at reduced strength ───── */

const FAQ_CHEVRON_READER = 'text-[color:color-mix(in_srgb,var(--fr-faq-rest,var(--color-foreground))_70%,transparent)]';

describe('FAQ — closed-state chevron joins the recolored header', () => {
  it('color SET: the closed chevron reads the rest var at 70%, token muted deduped', () => {
    const { container } = draw('FAQ', { items: [{ question: 'Q1', answer: 'A1' }], color: '#ff8800' });
    const chevron = container.querySelector('button[aria-expanded="false"] span[aria-hidden="true"]')!;
    expect(chevron).not.toBeNull();
    expect(has(chevron, FAQ_CHEVRON_READER)).toBe(true);
    expect(has(chevron, 'text-muted-foreground')).toBe(false);
  });

  it('color UNSET: the chevron keeps the exact token class', () => {
    const { container } = draw('FAQ', { items: [{ question: 'Q1', answer: 'A1' }] });
    const chevron = container.querySelector('button[aria-expanded="false"] span[aria-hidden="true"]')!;
    expect(has(chevron, 'text-muted-foreground')).toBe(true);
    expect(has(chevron, FAQ_CHEVRON_READER)).toBe(false);
  });
});

/* ── MED · Footer — social glyphs on the muted chain + the divider channel ── */

describe('Footer — social icon links + fine-print divider', () => {
  const FOOTER_PROPS = {
    brand: 'Frayme',
    socials: [{ icon: 'star', href: 'https://example.com' }],
    bottomText: '© 2026',
  };

  it('social links read --fr-footer-muted (token fallback); text-muted-foreground gone', () => {
    const { container } = draw('Footer', { ...FOOTER_PROPS, mutedColor: '#99aabb' });
    const social = container.querySelector('a[aria-label="star"]')!;
    expect(social).not.toBeNull();
    expect(has(social, '[color:var(--fr-footer-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(social, 'text-muted-foreground')).toBe(false);
  });

  it('borderColor: var on the footer, the divider group form on the bottom line, border-border deduped', () => {
    const { container } = draw('Footer', { ...FOOTER_PROPS, borderColor: '#334455' });
    const footer = container.querySelector('footer')!;
    expect(styleOf(footer)).toContain('--fr-footer-border');
    const divider = container.querySelector('.border-t')!;
    expect(divider).not.toBeNull();
    expect(has(divider, 'border-[color:var(--fr-footer-border,var(--color-border))]')).toBe(true);
    expect(has(divider, 'border-border')).toBe(false);
  });
});

/* ── MED · Breadcrumb — separators join the muted trail; accent off the link rest ── */

const CRUMB_SEP_READER = '[color:color-mix(in_srgb,var(--fr-crumb-muted,var(--color-muted-foreground))_70%,transparent)]';

describe('Breadcrumb — separator glyphs + link rest chain', () => {
  const CRUMB_PROPS = {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Here', href: null },
    ],
  };

  it('separators read the muted var at 70% (token opacity class gone)', () => {
    const { container } = draw('Breadcrumb', { ...CRUMB_PROPS, mutedColor: '#ddeeff' });
    const sep = container.querySelector('li[aria-hidden="true"]')!;
    expect(sep).not.toBeNull();
    expect(has(sep, CRUMB_SEP_READER)).toBe(true);
    expect(has(sep, 'text-muted-foreground/70')).toBe(false);
  });

  it('link REST state reads mutedColor only — accent no longer owns it', () => {
    const { container } = draw('Breadcrumb', { ...CRUMB_PROPS, accent: '#ff0000', mutedColor: '#ddeeff' });
    const link = container.querySelector('a')!;
    expect(has(link, '[color:var(--fr-crumb-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(link, '[color:var(--fr-crumb-accent,var(--fr-crumb-muted,var(--color-muted-foreground)))]')).toBe(false);
    // hover keeps the accent chain (accent = current item + hover, per the describes)
    expect(has(link, 'hover:[color:var(--fr-crumb-accent,var(--color-foreground))]')).toBe(true);
  });
});

/* ── MED · SidebarItem — the badge pill fill follows mutedColor ───────────── */

const PILL_TINT = '[background:color-mix(in_srgb,var(--fr-item-muted,var(--color-muted-foreground))_15%,transparent)]';

describe('SidebarItem — badge pill mutually-exclusive fill', () => {
  it('mutedColor SET: the pill is painted by the 15% mix, bg-muted gone', () => {
    const { container } = draw('SidebarItem', { label: 'Inbox', badge: '3', mutedColor: '#88ccff' });
    const pill = [...container.querySelectorAll('span')].find((s) => s.textContent === '3')!;
    expect(pill).not.toBeUndefined();
    expect(has(pill, PILL_TINT)).toBe(true);
    expect(has(pill, 'bg-muted')).toBe(false);
  });

  it('mutedColor UNSET: the pill keeps the exact bg-muted token', () => {
    const { container } = draw('SidebarItem', { label: 'Inbox', badge: '3' });
    const pill = [...container.querySelectorAll('span')].find((s) => s.textContent === '3')!;
    expect(has(pill, 'bg-muted')).toBe(true);
    expect(has(pill, PILL_TINT)).toBe(false);
  });
});

/* ── MED · EmptyState — the focal icon disk follows mutedColor ────────────── */

const DISK_TEXT = 'text-[color:var(--fr-emptystate-muted,var(--color-muted-foreground))]';
const DISK_FILL = '[background:color-mix(in_srgb,var(--fr-emptystate-muted,var(--color-muted-foreground))_12%,transparent)]';

describe('EmptyState — icon disk brand-tint (opt-in via mutedColor)', () => {
  it('mutedColor SET: glyph reads the muted var (token text deduped) + a 12% disk fill', () => {
    const { container } = draw('EmptyState', { title: 'No results', icon: 'search', mutedColor: '#77aaff' });
    const disk = container.querySelector('span[aria-hidden="true"]')!;
    expect(disk).not.toBeNull();
    expect(has(disk, DISK_TEXT)).toBe(true);
    expect(has(disk, DISK_FILL)).toBe(true);
    expect(has(disk, 'text-muted-foreground')).toBe(false);
  });

  it('mutedColor UNSET: the disk keeps the exact token pair', () => {
    const { container } = draw('EmptyState', { title: 'No results', icon: 'search' });
    const disk = container.querySelector('span[aria-hidden="true"]')!;
    expect(has(disk, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(disk, 'text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(disk, DISK_TEXT)).toBe(false);
    expect(has(disk, DISK_FILL)).toBe(false);
  });
});

/* ── UNSET-DEFAULT byte-identical rule (one per touched component) ────────── */

type UnsetCase = { type: string; props: Record<string, unknown>; channel: string };

const UNSET_CASES: UnsetCase[] = [
  { type: 'ToggleGroup', props: { items: TG_ITEMS, attached: true }, channel: 'radiusValue' },
  { type: 'Button', props: { label: 'Go', variant: 'secondary' }, channel: 'accent' },
  { type: 'Link', props: { label: 'Go', href: '/x', variant: 'button' }, channel: 'accent' },
  { type: 'DropdownMenu', props: DD_PROPS, channel: 'menuBg' },
  { type: 'DropdownMenu', props: DD_PROPS, channel: 'accentText' },
  { type: 'PricingTable', props: { plans: PRICING_PLANS }, channel: 'color' },
  { type: 'PlanCard', props: { name: 'Pro', price: '£99' }, channel: 'color' },
  { type: 'FAQ', props: { items: [{ question: 'Q1', answer: 'A1' }] }, channel: 'color' },
  {
    type: 'Footer',
    props: { brand: 'Frayme', socials: [{ icon: 'star', href: 'https://example.com' }], bottomText: '© 2026' },
    channel: 'borderColor',
  },
  { type: 'Navbar', props: { brand: 'Frayme' }, channel: 'color' },
  {
    type: 'Breadcrumb',
    props: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Here', href: null },
      ],
    },
    channel: 'mutedColor',
  },
  { type: 'SidebarItem', props: { label: 'Inbox', badge: '3' }, channel: 'mutedColor' },
  { type: 'ListItem', props: { title: 'Row', leadingIcon: 'settings' }, channel: 'mutedColor' },
  { type: 'EmptyState', props: { title: 'No results', icon: 'search' }, channel: 'mutedColor' },
];

/** Canonicalise React's per-MOUNT `useId` token. Trigger↔panel ids (aria-controls)
 *  carry it so two `repeat` rows cannot share one id; two separate renders then
 *  differ in that token alone, which is orthogonal to the null-vs-absent question
 *  here. Measured: without this, the assertion fails even when both sides are
 *  given IDENTICAL props — it would stop testing prop handling entirely. */
const canonIds = (html: string): string => html.replace(/_r_[0-9a-z]+_/g, '_rID_');

describe('unset default is byte-identical to prop-not-mentioned', () => {
  for (const c of UNSET_CASES) {
    it(`${c.type}: ${c.channel}:null renders byte-identical to the prop being absent`, () => {
      const withNull = draw(c.type, { ...c.props, [c.channel]: null });
      const nullHtml = withNull.container.innerHTML;
      withNull.unmount();
      const without = draw(c.type, { ...c.props });
      expect(canonIds(nullHtml)).toBe(canonIds(without.container.innerHTML));
    });
  }
});
