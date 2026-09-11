/**
 * Marketing + media + feedback family regression guard.
 *
 * Follows value-channels.test.tsx: render via FraymeRenderer mode=progressive;
 * channel triple-assert (var present · consumer class present · competitor
 * deduped); behavioral items assert rendered content; additive items assert the
 * UNSET render is byte-identical to the prop being absent.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ══════════════════════════════════════════════════════════════════════════
 * FeatureCard — icon chip fill (iconBg)
 * ════════════════════════════════════════════════════════════════════════ */
describe('FeatureCard iconBg', () => {
  it('SET: --fr-fcard-iconbg var on the card; chip reads the fill var-chain; bg-muted deduped', () => {
    const { container } = draw('FeatureCard', { icon: 'sparkles', title: 'Fast', iconBg: '#123456' });
    const card = container.querySelector('[style*="--fr-fcard-iconbg"]');
    expect(card, 'FeatureCard carrying --fr-fcard-iconbg').not.toBeNull();
    expect(styleOf(card!)).toContain('--fr-fcard-iconbg');
    // the chip span consumes the fill var-chain (sole background source)
    const chip = card!.querySelector('span[aria-hidden]')!;
    expect(has(chip, '[background:var(--fr-fcard-iconbg,var(--fr-surface-sunken,var(--color-muted)))]')).toBe(true);
    // the prior baked token must be gone (it would win source-order otherwise)
    expect(has(chip, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });

  it('FeatureGrid cascade: iconBg var on the grid root → inherited by every generated chip', () => {
    const { container } = draw('FeatureGrid', {
      iconBg: '#00aa00',
      features: [
        { icon: 'sparkles', title: 'A', description: 'a' },
        { icon: 'lock', title: 'B', description: 'b' },
      ],
    });
    const grid = container.querySelector('[style*="--fr-fcard-iconbg"]')!;
    expect(grid, 'grid root carrying --fr-fcard-iconbg').not.toBeNull();
    const chips = [...container.querySelectorAll('span[aria-hidden]')].filter((s) =>
      has(s, '[background:var(--fr-fcard-iconbg,var(--fr-surface-sunken,var(--color-muted)))]'),
    );
    expect(chips.length).toBe(2);
  });

  it('UNSET: iconBg:null byte-identical to the prop being absent', () => {
    const withNull = draw('FeatureCard', { icon: 'sparkles', title: 'Fast', iconBg: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('FeatureCard', { icon: 'sparkles', title: 'Fast' });
    expect(html).toBe(without.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * CTA — card variant border (borderColor + borderWidthValue)
 * ════════════════════════════════════════════════════════════════════════ */
describe('CTA card border', () => {
  it('SET (card): --fr-cta-border var; border-color reader present; base var-chain deduped', () => {
    const { container } = draw('CTA', { title: 'Go', variant: 'card', borderColor: '#ff0000', borderWidthValue: '3px' });
    const band = container.querySelector('[style*="--fr-cta-border"]')!;
    expect(band, 'CTA band carrying --fr-cta-border').not.toBeNull();
    expect(styleOf(band!)).toContain('--fr-cta-border');
    expect(styleOf(band!)).toContain('--fr-cta-bw');
    // the conditional override reader is present (wins over the base default)
    expect(has(band!, '[border-color:var(--fr-cta-border,var(--color-border))]')).toBe(true);
    // the recipe width var-chain reads --fr-cta-bw
    expect(has(band!, '[border-width:var(--fr-cta-bw,1px)]')).toBe(true);
  });

  it('banner variant IGNORES the border channels (vars not emitted)', () => {
    const { container } = draw('CTA', { title: 'Go', variant: 'banner', borderColor: '#ff0000', borderWidthValue: '3px' });
    const band = container.querySelector('.w-full')!;
    // banner reads none of the card border vars → not on its style
    expect(styleOf(band)).not.toContain('--fr-cta-border');
    expect(styleOf(band)).not.toContain('--fr-cta-bw');
  });

  it('UNSET (card): borderColor:null byte-identical to the prop being absent', () => {
    const withNull = draw('CTA', { title: 'Go', variant: 'card', borderColor: null, borderWidthValue: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('CTA', { title: 'Go', variant: 'card' });
    expect(html).toBe(without.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Hero — background-media scrim (overlayColor + overlayOpacity)
 * ════════════════════════════════════════════════════════════════════════ */
describe('Hero background scrim', () => {
  const bgHero = {
    title: 'Landing',
    mediaSrc: 'https://cdn.example.com/hero.jpg',
    mediaPosition: 'background',
  };

  // The scrim is a bottom-up GRADIENT of the tint, not a flat
  // wash — a single-opacity inset-0 fill flattened the photograph into murk and
  // still left bright areas high in the frame fighting the copy.
  const scrimOf = (section: Element): Element | undefined =>
    [...section.querySelectorAll('div[aria-hidden]')].find((d) =>
      [...d.classList].some((c) => c.startsWith('bg-[linear-gradient(to_top,')),
    );

  it('SET: --fr-hero-overlay var on the section; the scrim gradient reads the tint at the chosen step', () => {
    const { container } = draw('Hero', { ...bgHero, overlayColor: '#000000', overlayOpacity: 'heavy' });
    const section = container.querySelector('section')!;
    expect(styleOf(section)).toContain('--fr-hero-overlay');
    const scrim = scrimOf(section);
    expect(scrim, 'heavy scrim gradient present').not.toBeUndefined();
    const cls = [...scrim!.classList].join(' ');
    // heavy: densest at the bottom, still readable at the top
    expect(cls).toContain('var(--fr-hero-overlay,var(--color-background))_92%,transparent)_0%');
    expect(cls).toContain('var(--fr-hero-overlay,var(--color-background))_42%,transparent)_100%');
  });

  it('default opacity (medium): a gradient whose midpoint sits near the old flat 60% wash', () => {
    const { container } = draw('Hero', bgHero);
    const section = container.querySelector('section')!;
    const scrim = scrimOf(section);
    expect(scrim, 'medium scrim gradient present by default').not.toBeUndefined();
    const cls = [...scrim!.classList].join(' ');
    expect(cls).toContain('var(--fr-hero-overlay,var(--color-background))_78%,transparent)_0%');
    expect(cls).toContain('var(--fr-hero-overlay,var(--color-background))_48%,transparent)_45%');
  });

  it('overlayOpacity:none still paints nothing (the image runs clean)', () => {
    const { container } = draw('Hero', { ...bgHero, overlayOpacity: 'none' });
    const section = container.querySelector('section')!;
    expect(scrimOf(section)).toBeUndefined();
    const flat = [...section.querySelectorAll('div[aria-hidden]')].find((d) =>
      has(d, 'bg-[color:color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_0%,transparent)]'),
    );
    expect(flat, 'none step keeps the 0% flat fill').not.toBeUndefined();
  });

  it('UNSET: overlayColor:null byte-identical to the prop being absent (bg hero)', () => {
    const withNull = draw('Hero', { ...bgHero, overlayColor: null, overlayOpacity: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Hero', bgHero);
    expect(html).toBe(without.container.innerHTML);
  });

  it('UNSET (plain hero, no bg media): overlay props do not affect the common render', () => {
    const withNull = draw('Hero', { title: 'Landing', overlayColor: null, overlayOpacity: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Hero', { title: 'Landing' });
    expect(html).toBe(without.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Testimonial — primary text color channel (color)
 * ════════════════════════════════════════════════════════════════════════ */
describe('Testimonial color', () => {
  it('SET: --fr-testimonial-fg var; quote + author read the fg group form; text-foreground deduped', () => {
    const { container } = draw('Testimonial', {
      quote: 'Great product.',
      authorName: 'Ada',
      authorTitle: 'CTO',
      color: '#ff00aa',
    });
    const fig = container.querySelector('[style*="--fr-testimonial-fg"]')!;
    expect(fig, 'testimonial carrying --fr-testimonial-fg').not.toBeNull();
    const quote = container.querySelector('blockquote')!;
    expect(has(quote, 'text-[color:var(--fr-testimonial-fg,var(--color-foreground))]')).toBe(true);
    expect(has(quote, 'text-foreground')).toBe(false);
    // author name shares the role
    const authorName = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Ada')!;
    expect(has(authorName, 'text-[color:var(--fr-testimonial-fg,var(--color-foreground))]')).toBe(true);
    expect(has(authorName, 'text-foreground')).toBe(false);
  });

  it('UNSET: color:null byte-identical to the prop being absent', () => {
    const base = { quote: 'Great product.', authorName: 'Ada', authorTitle: 'CTO' };
    const withNull = draw('Testimonial', { ...base, color: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Testimonial', base);
    expect(html).toBe(without.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * PricingTable — per-plan badge   ·   billed-period label
 * ════════════════════════════════════════════════════════════════════════ */
describe('PricingTable per-plan badge', () => {
  const plansWithBadge = {
    plans: [
      { name: 'Free', price: '£0', features: ['x'] },
      { name: 'Pro', price: '£99', features: ['y'], badge: 'Most popular', highlighted: true },
    ],
  };

  it('SET: the ribbon renders its text; its card gets relative positioning', () => {
    const { container } = draw('PricingTable', plansWithBadge);
    const ribbon = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Most popular');
    expect(ribbon, 'ribbon badge text present').not.toBeUndefined();
    // the ribbon reads the accent fill — quiet-defaults: the reader is unchanged,
    // the unset fallback moved from the brand token to the neutral high-contrast foreground.
    expect(has(ribbon!, '[background:var(--fr-pricing-accent,var(--color-foreground))]')).toBe(true);
    // its owning card carries `relative` for the absolute ribbon
    const card = ribbon!.closest('.rounded-frayme')!;
    expect(has(card, 'relative')).toBe(true);
  });

  it('UNSET: a plan without a badge renders no ribbon and no relative card', () => {
    const { container } = draw('PricingTable', {
      plans: [{ name: 'Free', price: '£0', features: ['x'] }],
    });
    expect([...container.querySelectorAll('span')].some((s) => s.textContent === 'Most popular')).toBe(false);
    // the (single) plan card must NOT carry relative
    const card = container.querySelector('.rounded-frayme.border')!;
    expect(has(card, 'relative')).toBe(false);
  });
});

describe('PricingTable billed-period label', () => {
  it('periodLabel renders verbatim (overrides the enum "Billed" prefix)', () => {
    const { container } = draw('PricingTable', {
      plans: [{ name: 'Free', price: '£0', features: ['x'] }],
      period: 'monthly',
      periodLabel: 'Billed annually — save 20%',
    });
    expect(container.textContent).toContain('Billed annually — save 20%');
    // the enum default caption must NOT also appear
    expect(container.textContent).not.toContain('Billed monthly');
  });

  it('period enum (no periodLabel) keeps the prior "Billed {period}" default', () => {
    const { container } = draw('PricingTable', {
      plans: [{ name: 'Free', price: '£0', features: ['x'] }],
      period: 'yearly',
    });
    expect(container.textContent).toContain('Billed yearly');
  });

  it('neither set → no caption', () => {
    const { container } = draw('PricingTable', {
      plans: [{ name: 'Free', price: '£0', features: ['x'] }],
    });
    expect(container.textContent).not.toContain('Billed');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Marquee — item text color/size + vertical height
 * ════════════════════════════════════════════════════════════════════════ */
describe('Marquee color/size/height', () => {
  it('SET color+size: --fr-marquee-fg var; items read the fg group form; size class applies; text-foreground deduped', () => {
    const { container } = draw('Marquee', { items: ['A', 'B'], color: '#ff0000', size: 'lg' });
    const root = container.querySelector('.fr-marquee')!;
    expect(styleOf(root)).toContain('--fr-marquee-fg');
    const item = [...container.querySelectorAll('span')].find((s) => s.textContent === 'A')!;
    expect(has(item, 'text-[color:var(--fr-marquee-fg,var(--color-foreground))]')).toBe(true);
    expect(has(item, 'text-foreground')).toBe(false);
    expect(has(item, 'text-base')).toBe(true); // lg
  });

  it('SET height on a VERTICAL marquee: --fr-marquee-h var; height reader present; h-48 deduped', () => {
    const { container } = draw('Marquee', { items: ['A'], direction: 'up', height: '20rem' });
    const root = container.querySelector('.fr-marquee')!;
    expect(styleOf(root)).toContain('--fr-marquee-h');
    expect(has(root, '[height:var(--fr-marquee-h,12rem)]')).toBe(true);
    expect(has(root, 'h-48')).toBe(false);
  });

  it('height is IGNORED on a horizontal marquee (var not emitted)', () => {
    const { container } = draw('Marquee', { items: ['A'], direction: 'left', height: '20rem' });
    const root = container.querySelector('.fr-marquee')!;
    expect(styleOf(root)).not.toContain('--fr-marquee-h');
  });

  it('UNSET: byte-identical to prop-absent (horizontal + vertical)', () => {
    for (const dir of ['left', 'up']) {
      const withNull = draw('Marquee', { items: ['A', 'B'], direction: dir, color: null, size: null, height: null });
      const html = withNull.container.innerHTML;
      withNull.unmount();
      const without = draw('Marquee', { items: ['A', 'B'], direction: dir });
      expect(html, `dir=${dir}`).toBe(without.container.innerHTML);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Figure — object-fit when ratio is set
 * ════════════════════════════════════════════════════════════════════════ */
describe('Figure fit', () => {
  const ratioFig = { src: 'https://cdn.example.com/chart.png', alt: 'Chart', ratio: '16/9' };

  it('fit:contain → image object-contain + the frame gets a muted mat; object-cover absent', () => {
    const { container } = draw('Figure', { ...ratioFig, fit: 'contain' });
    const img = container.querySelector('img')!;
    expect(has(img, 'object-contain')).toBe(true);
    expect(has(img, 'object-cover')).toBe(false);
    // the frame div (image's parent) gets bg-muted
    const frame = img.parentElement!;
    expect(has(frame, 'bg-muted')).toBe(true);
  });

  it('fit:cover (default) keeps object-cover, no mat', () => {
    const { container } = draw('Figure', ratioFig);
    const img = container.querySelector('img')!;
    expect(has(img, 'object-cover')).toBe(true);
    expect(has(img, 'object-contain')).toBe(false);
    expect(has(img.parentElement!, 'bg-muted')).toBe(false);
  });

  it('UNSET: fit:null byte-identical to the prop being absent', () => {
    const withNull = draw('Figure', { ...ratioFig, fit: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Figure', ratioFig);
    expect(html).toBe(without.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * YouTube — duration badge
 * ════════════════════════════════════════════════════════════════════════ */
describe('YouTube duration badge', () => {
  const yt = { videoId: 'dQw4w9WgXcQ', title: 'Demo' };

  it('duration set → the corner pill renders the escaped text', () => {
    const { container } = draw('YouTube', { ...yt, duration: '12:34' });
    const badge = [...container.querySelectorAll('span')].find((s) => s.textContent === '12:34');
    expect(badge, 'duration badge present').not.toBeUndefined();
    expect(has(badge!, 'bg-black/70')).toBe(true);
  });

  it('UNSET: duration:null byte-identical to the prop being absent', () => {
    const withNull = draw('YouTube', { ...yt, duration: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('YouTube', yt);
    expect(html).toBe(without.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Banner & Callout — color applies WITHOUT a bg swap
 * ════════════════════════════════════════════════════════════════════════ */
describe('Banner color without bg', () => {
  it('color set (no bg): --fr-banner-fg var; the foreground-fallback reader is present; text-foreground deduped', () => {
    const { container } = draw('Banner', { message: 'Note', tone: 'neutral', color: '#ff00aa' });
    const banner = container.querySelector('[role="status"]')!;
    expect(styleOf(banner)).toContain('--fr-banner-fg');
    expect(has(banner, 'text-[color:var(--fr-banner-fg,var(--color-foreground))]')).toBe(true);
    // the tone's baked text-foreground is deduped away
    expect(has(banner, 'text-foreground')).toBe(false);
    // and the on-fill (primary-foreground) variant must NOT be used without bg
    expect(has(banner, 'text-[color:var(--fr-banner-fg,var(--color-primary-foreground))]')).toBe(false);
  });

  it('color + bg still uses the on-fill (primary-foreground) fallback', () => {
    const { container } = draw('Banner', { message: 'Note', bg: '#222222', color: '#ffffff' });
    const banner = container.querySelector('[role="status"]')!;
    expect(has(banner, 'text-[color:var(--fr-banner-fg,var(--color-primary-foreground))]')).toBe(true);
    // the no-bg foreground-fallback variant must NOT be present
    expect(has(banner, 'text-[color:var(--fr-banner-fg,var(--color-foreground))]')).toBe(false);
  });

  it('UNSET: color:null byte-identical to the prop being absent', () => {
    const withNull = draw('Banner', { message: 'Note', tone: 'neutral', color: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Banner', { message: 'Note', tone: 'neutral' });
    expect(html).toBe(without.container.innerHTML);
  });
});

describe('Callout color without bg', () => {
  it('color set (no bg, non-solid): --fr-callout-fg var; the foreground-fallback reader is present', () => {
    const { container } = draw('Callout', { message: 'Tip', variant: 'subtle', color: '#ff00aa' });
    const callout = container.querySelector('[role="note"]')!;
    expect(styleOf(callout)).toContain('--fr-callout-fg');
    expect(has(callout, '[color:var(--fr-callout-fg,var(--color-foreground))]')).toBe(true);
  });

  it('solid variant does NOT add the no-bg foreground reader (its own white reader handles color)', () => {
    const { container } = draw('Callout', { message: 'Tip', variant: 'solid', color: '#ffffff' });
    const callout = container.querySelector('[role="note"]')!;
    expect(has(callout, '[color:var(--fr-callout-fg,var(--color-foreground))]')).toBe(false);
  });

  it('UNSET: color:null byte-identical to the prop being absent', () => {
    const withNull = draw('Callout', { message: 'Tip', variant: 'subtle', color: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Callout', { message: 'Tip', variant: 'subtle' });
    expect(html).toBe(without.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * InlineMessage — color channel (text + icon together)
 * ════════════════════════════════════════════════════════════════════════ */
describe('InlineMessage color', () => {
  it('SET: --fr-inlinemsg-fg var; the tone-keyed reader is present; the tone text-* class deduped', () => {
    const { container } = draw('InlineMessage', { message: 'Saved', tone: 'success', color: '#ff00aa' });
    const msg = container.querySelector('[role="status"]')!;
    expect(styleOf(msg)).toContain('--fr-inlinemsg-fg');
    // tone:success reader uses the success token as in-var fallback
    expect(has(msg, 'text-[color:var(--fr-inlinemsg-fg,var(--color-success))]')).toBe(true);
    // the baked tone class (text-success) is deduped away
    expect(has(msg, 'text-success')).toBe(false);
  });

  it('the reader fallback tracks the tone (neutral → muted-foreground)', () => {
    const { container } = draw('InlineMessage', { message: 'Hint', tone: 'neutral', color: '#123456' });
    const msg = container.querySelector('[role="status"]')!;
    expect(has(msg, 'text-[color:var(--fr-inlinemsg-fg,var(--color-muted-foreground))]')).toBe(true);
    expect(has(msg, 'text-muted-foreground')).toBe(false);
  });

  it('UNSET: color:null byte-identical to the prop being absent', () => {
    const withNull = draw('InlineMessage', { message: 'Saved', tone: 'success', color: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('InlineMessage', { message: 'Saved', tone: 'success' });
    expect(html).toBe(without.container.innerHTML);
  });
});
