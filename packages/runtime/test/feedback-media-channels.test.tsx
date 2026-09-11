/**
 * Regression guard — PARTIAL-PROP + COHERENCE-GROUP fixes across
 * feedback-extended, filter-compose, media-extended, data-longtail,
 * data-display and marketing-hero.
 *
 * For each fixed channel the tests assert the TRIPLE (the value-channels.test
 * pattern):
 *   (a) the channel var is present in the target element's inline style attr
 *       (or on the var-carrying wrapper),
 *   (b) the CONSUMING class is present in its className,
 *   (c) the competing token class it replaced is ABSENT.
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

/* ── Callout · solid-variant text reads the color channel ─────────────────── */

describe('Callout solid — color channel covers the on-fill text', () => {
  it('color SET on variant:solid → fg var on the root, both var readers present, text-white gone', () => {
    const { container } = draw('Callout', { message: 'Note', variant: 'solid', color: '#112233' });
    const el = container.querySelector('[role="note"]')!;
    expect(el).not.toBeNull();
    expect(styleOf(el)).toContain('--fr-callout-fg');
    expect(has(el, 'text-[color:var(--fr-callout-fg,white)]')).toBe(true);
    expect(has(el, '[&_*]:text-[color:var(--fr-callout-fg,white)]')).toBe(true);
    expect(has(el, 'text-white')).toBe(false);
    expect(has(el, '[&_*]:text-white')).toBe(false);
  });
});

/* ── Banner · brand group: bg flips copy + icon/action to on-fill ─────────── */

describe('Banner — custom bg makes copy + icon/action cohere', () => {
  it('bg SET (no accent) → root fg reader present, text-foreground deduped, accent defaults to currentColor', () => {
    const { container } = draw('Banner', { message: 'Maintenance', bg: '#123456' });
    const el = container.querySelector('[role="status"]')!;
    expect(styleOf(el)).toContain('--fr-banner-bg');
    expect(has(el, 'text-[color:var(--fr-banner-fg,var(--color-primary-foreground))]')).toBe(true);
    expect(has(el, 'text-foreground')).toBe(false);
    expect(has(el, '[--fr-banner-accent:currentColor]')).toBe(true);
  });

  it('bg + accent BOTH set → the explicit accent wins (currentColor override absent)', () => {
    const { container } = draw('Banner', { message: 'Maintenance', bg: '#123456', accent: '#ff0000' });
    const el = container.querySelector('[role="status"]')!;
    expect(has(el, '[--fr-banner-accent:var(--fr-banner-accent-val)]')).toBe(true);
    expect(has(el, '[--fr-banner-accent:currentColor]')).toBe(false);
  });
});

/* ── LoadingOverlay · spinner head reads the color channel ────────────────── */

describe('LoadingOverlay — color covers label + spinner head as one role', () => {
  it('color SET → --fr-overlay-fg on the scrim, spinner head reads it, old primary-only class gone', () => {
    const { container } = draw('LoadingOverlay', { label: 'Loading…', color: '#ff0000' });
    const scrim = container.querySelector('[role="status"]')!;
    expect(styleOf(scrim)).toContain('--fr-overlay-fg');
    const spinner = scrim.firstElementChild!;
    expect(has(spinner, '[border-top-color:var(--fr-overlay-fg,var(--color-primary))]')).toBe(true);
    expect(has(spinner, '[border-top-color:var(--color-primary)]')).toBe(false);
  });
});

/* ── NotFound · muted icon chip + accent CTA ──────────────────────────────── */

describe('NotFound — mutedColor covers the icon chip, accent drives the CTA fill', () => {
  const base = { title: 'Page not found', code: '404', icon: 'search', actionLabel: 'Go home' };

  it('mutedColor SET → chip glyph reads the muted var, token class gone', () => {
    const { container } = draw('NotFound', { ...base, mutedColor: '#333333' });
    const root = container.querySelector('[role="alert"]')!;
    expect(styleOf(root)).toContain('--fr-notfound-muted');
    const chip = container.querySelector('span.rounded-full')!;
    expect(chip).not.toBeNull();
    expect(has(chip, '[color:var(--fr-notfound-muted,var(--fr-surface-muted,var(--color-muted-foreground)))]')).toBe(true);
    expect(has(chip, 'text-muted-foreground')).toBe(false);
  });

  it('accent SET → CTA button fill reads the accent var, bg-primary gone', () => {
    const { container } = draw('NotFound', { ...base, accent: '#ff00ff' });
    const root = container.querySelector('[role="alert"]')!;
    expect(styleOf(root)).toContain('--fr-notfound-accent');
    const btn = container.querySelector('button')!;
    // quiet-defaults: the accent reader is unchanged; the unset fallback moved
    // from the brand token to the neutral high-contrast foreground.
    expect(has(btn, 'bg-[color:var(--fr-notfound-accent,var(--color-foreground))]')).toBe(true);
    expect(has(btn, 'bg-primary')).toBe(false);
  });
});

/* ── Result · accent CTA fill + secondary text follows the fg chain ───────── */

describe('Result — accent fills the primary action, secondary text follows color', () => {
  const base = { title: 'Done', actions: [{ label: 'View' }, { label: 'Back' }] };

  it('accent SET → primary button reads the accent var, bg-primary gone', () => {
    const { container } = draw('Result', { ...base, accent: '#00ff00' });
    const root = container.querySelector('[role="status"]')!;
    expect(styleOf(root)).toContain('--fr-result-accent');
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.length).toBe(2);
    // quiet-defaults: accent reader unchanged; unset fallback is now foreground.
    expect(has(buttons[0], 'bg-[color:var(--fr-result-accent,var(--color-foreground))]')).toBe(true);
    expect(has(buttons[0], 'bg-primary')).toBe(false);
  });

  it('secondary action reads the panel fg chain instead of the baked foreground token', () => {
    const { container } = draw('Result', { ...base, color: '#0000ff' });
    const buttons = [...container.querySelectorAll('button')];
    // inherited-foreground: the READER this test was written for is
    // unchanged (secondary still follows the panel's `color`); only the chain's
    // last resort moved from the foreground token to currentColor. The button is
    // bg-transparent, so it borrows the panel's surface — baking the token there
    // repainted it #18181b inside an authored Card at 1.02:1. See
    // inherited-foreground-feedback-board-filter.test.tsx.
    expect(has(buttons[1], 'text-[color:var(--fr-result-fg,currentColor)]')).toBe(true);
    expect(has(buttons[1], 'text-foreground')).toBe(false);
  });
});

/* ── FilterBar · search icon travels with the muted layer ─────────────────── */

describe('FilterBar — mutedColor covers the search magnifier icon (label wrapper)', () => {
  it('mutedColor SET → wrapper reads the muted var (group form), token gone', () => {
    const { container } = draw('FilterBar', { mutedColor: '#444444' });
    const wrap = container.querySelector('[style*="--fr-filterbar-muted"]');
    expect(wrap, 'FilterBar root carrying --fr-filterbar-muted').not.toBeNull();
    const label = container.querySelector('label')!;
    expect(has(label, 'text-[color:var(--fr-filterbar-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(label, 'text-muted-foreground')).toBe(false);
  });
});

/* ── FacetList / FilterPanel · accentText on the check glyph ──────────────── */

describe('FacetList — accentText recolors the checked glyph', () => {
  it('accentText SET → check span reads the accent-text var, hardcoded on-primary gone', () => {
    const { container } = draw('FacetList', {
      facets: [{ label: 'Open', value: 'open', checked: true }],
      accentText: '#111111',
    });
    const root = container.querySelector('[style*="--fr-facetlist-accent-text"]');
    expect(root, 'FacetList root carrying --fr-facetlist-accent-text').not.toBeNull();
    const glyph = container.querySelector('input[type="checkbox"]')!.nextElementSibling!;
    // quiet-defaults: accentText reader unchanged; its unset fallback is now
    // `card` (the on-fill text pairing the neutral high-contrast checked box).
    expect(has(glyph, '[color:var(--fr-facetlist-accent-text,var(--color-card))]')).toBe(true);
    expect(has(glyph, '[color:var(--color-primary-foreground)]')).toBe(false);
  });
});

describe('FilterPanel — accentText on the shared FacetRow + muted chevrons', () => {
  const props = {
    sections: [{ heading: 'Status', facets: [{ label: 'Open', value: 'open', checked: true }] }],
  };

  it('accentText SET → check span reads the panel accent-text var', () => {
    const { container } = draw('FilterPanel', { ...props, accentText: '#222222' });
    const glyph = container.querySelector('input[type="checkbox"]')!.nextElementSibling!;
    // quiet-defaults: accentText reader unchanged; its unset fallback is now `card`.
    expect(has(glyph, '[color:var(--fr-filterpanel-accent-text,var(--color-card))]')).toBe(true);
    expect(has(glyph, '[color:var(--color-primary-foreground)]')).toBe(false);
  });

  it('mutedColor SET → section-header chevron reads the muted var, token gone', () => {
    const { container } = draw('FilterPanel', { ...props, mutedColor: '#333333' });
    const chevron = container.querySelector('button[aria-expanded] span.transition-transform')!;
    expect(chevron).not.toBeNull();
    expect(has(chevron, '[color:var(--fr-filterpanel-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(chevron, 'text-muted-foreground')).toBe(false);
  });
});

/* ── RichComposer · toolbar buttons join the muted layer ──────────────────── */

describe('RichComposer — mutedColor covers the formatting-toolbar buttons', () => {
  it('mutedColor SET → every toolbar button reads the composer muted var, token gone', () => {
    const { container } = draw('RichComposer', { mutedColor: '#555555' });
    const buttons = [...container.querySelectorAll('[role="toolbar"] button')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(has(btn, 'text-[color:var(--fr-composer-muted,var(--color-muted-foreground))]')).toBe(true);
      expect(has(btn, 'text-muted-foreground')).toBe(false);
    }
  });
});

/* ── VideoPlayer · borderColor + borderStyle on the frame ─────────────────── */

describe('VideoPlayer — media-family border channels on the frame', () => {
  it('borderColor SET → var on the figure, frame reads it via group form, border-border gone', () => {
    const { container } = draw('VideoPlayer', { borderColor: '#123123', borderStyle: 'dashed' });
    const figure = container.querySelector('figure')!;
    expect(styleOf(figure)).toContain('--fr-video-border');
    const frame = figure.firstElementChild!;
    expect(has(frame, 'border-[color:var(--fr-video-border,var(--color-border))]')).toBe(true);
    expect(has(frame, 'border-border')).toBe(false);
    expect(has(frame, 'border-dashed')).toBe(true);
  });
});

/* ── Thumbnail · radius var-chain (family migration) ──────────────────────── */

describe('Thumbnail — radius enum via var-chain + exact radiusValue', () => {
  it('radius:full → default-var class present, read class present, rounded-full gone', () => {
    const { container } = draw('Thumbnail', { radius: 'full' });
    const el = container.querySelector('span.inline-flex')!;
    expect(has(el, '[--fr-thumb-radius-default:9999px]')).toBe(true);
    expect(has(el, '[border-radius:var(--fr-thumb-radius,var(--fr-thumb-radius-default,var(--radius-frayme)))]')).toBe(true);
    expect(has(el, 'rounded-full')).toBe(false);
    expect(has(el, 'rounded-frayme')).toBe(false);
  });

  it('radiusValue SET → --fr-thumb-radius rides the inline style (wins through the chain)', () => {
    const { container } = draw('Thumbnail', { radiusValue: '10px' });
    const el = container.querySelector('span.inline-flex')!;
    expect(styleOf(el)).toContain('--fr-thumb-radius');
    expect(has(el, '[--fr-thumb-radius-default:var(--radius-frayme)]')).toBe(true);
  });

  it('bordered + borderStyle:dotted → border-dotted present', () => {
    const { container } = draw('Thumbnail', { bordered: true, borderStyle: 'dotted' });
    const el = container.querySelector('span.inline-flex')!;
    expect(has(el, 'border-dotted')).toBe(true);
  });
});

/* ── AudioPlayer · width + opacity join the media-family group ────────────── */

describe('AudioPlayer — width var-chain is the sole width source; opacity enum', () => {
  it('width SET → var on the card, [width:var(…,100%)] present, w-full absent', () => {
    const { container } = draw('AudioPlayer', { width: '320px', opacity: '50' });
    const card = container.querySelector('[style*="--fr-audio-width"]')!;
    expect(card, 'AudioPlayer card carrying --fr-audio-width').not.toBeNull();
    expect(has(card, '[width:var(--fr-audio-width,100%)]')).toBe(true);
    expect(has(card, 'w-full')).toBe(false);
    expect(has(card, 'opacity-50')).toBe(true);
  });

  it('borderStyle:dashed → border-dashed present on the card', () => {
    const { container } = draw('AudioPlayer', { borderStyle: 'dashed' });
    const card = container.querySelector('div[class*="fr-audio-width"]')!;
    expect(card, 'AudioPlayer card (width var-chain reader)').not.toBeNull();
    expect(has(card, 'border-dashed')).toBe(true);
  });
});

/* ── Marquee · opacity enum ───────────────────────────────────────────────── */

describe('Marquee — opacity joins the media-family dim group', () => {
  it('opacity:75 dims the WHOLE component, pause control included', () => {
    const { container } = draw('Marquee', { items: ['Anthropic', 'Vercel'], opacity: '75' });
    // the channel rides the component root, which holds both the scrolling
    // viewport and the pause control — dimming one but not the other would
    // leave the control at full strength over a faded strip
    const root = container.querySelector('.frayme-root')!.firstElementChild!;
    expect(has(root, 'opacity-75')).toBe(true);
    expect(root.querySelector('.fr-marquee')).not.toBeNull();
    expect(root.querySelector('button')).not.toBeNull();
  });
});

/* ── YouTube · opacity/borderStyle + labeled invalid-id placeholder ───────── */

describe('YouTube — family channels + the invalid-id branch keeps its title', () => {
  it('valid id: opacity + borderStyle land on figure/frame', () => {
    const { container } = draw('YouTube', { videoId: 'dQw4w9WgXcQ', title: 'T', opacity: '50', borderStyle: 'dashed' });
    const figure = container.querySelector('figure')!;
    expect(has(figure, 'opacity-50')).toBe(true);
    const frame = container.querySelector('a')!;
    expect(has(frame, 'border-dashed')).toBe(true);
  });

  it('INVALID id: the title line still renders (labeled card) and reads --fr-yt-fg', () => {
    const { container } = draw('YouTube', { videoId: 'bad', title: 'My talk', color: '#ff00aa' });
    const caption = container.querySelector('figcaption')!;
    expect(caption).not.toBeNull();
    expect(caption.textContent).toBe('My talk');
    expect(has(caption, '[color:var(--fr-yt-fg,var(--color-foreground))]')).toBe(true);
    expect(styleOf(container.querySelector('figure')!)).toContain('--fr-yt-fg');
  });

  it('INVALID id with showTitle:false → still no figcaption', () => {
    const { container } = draw('YouTube', { videoId: 'bad', title: 'My talk', showTitle: false });
    expect(container.querySelector('figcaption')).toBeNull();
  });
});

/* ── JsonView · expand chevron joins the muted punctuation set ────────────── */

describe('JsonView — mutedColor covers the expand/collapse chevrons', () => {
  it('mutedColor SET → chevron span reads the jsonview muted var, token gone', () => {
    const { container } = draw('JsonView', { data: { a: { b: 1 } }, mutedColor: '#666666' });
    const chevron = container.querySelector('[role="treeitem"][aria-expanded] span[aria-hidden]')!;
    expect(chevron).not.toBeNull();
    expect(has(chevron, '[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(chevron, 'text-muted-foreground')).toBe(false);
  });
});

/* ── Menubar · "menu chrome" coherence group ──────────────────────────────── */

describe('Menubar — borderColor brands the whole menu chrome; icons join muted', () => {
  const props = {
    menus: [
      {
        label: 'File',
        items: [{ label: 'Open', icon: 'search', shortcut: '⌘O' }, { separator: true }, { label: 'Close' }],
      },
    ],
    borderColor: '#777777',
    mutedColor: '#888888',
  };

  it('open dropdown: panel border + separator + kbd edge + item icon all read the vars', () => {
    const { container } = draw('Menubar', props);
    fireEvent.click(container.querySelector('[role="menubar"] button')!);
    const panel = container.querySelector('[role="menu"]')!;
    expect(panel).not.toBeNull();
    expect(has(panel, '[border-color:var(--fr-menubar-border,var(--color-border))]')).toBe(true);
    expect(has(panel, 'border-border')).toBe(false);
    const sep = container.querySelector('[role="separator"]')!;
    expect(has(sep, '[background:var(--fr-menubar-border,var(--color-border))]')).toBe(true);
    expect(has(sep, 'bg-border')).toBe(false);
    const kbd = container.querySelector('kbd')!;
    expect(has(kbd, '[border-color:var(--fr-menubar-border,var(--color-border))]')).toBe(true);
    expect(has(kbd, 'border-border')).toBe(false);
    const icon = container.querySelector('[role="menu"] span[aria-hidden]')!;
    expect(has(icon, '[color:var(--fr-menubar-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(icon, 'text-muted-foreground')).toBe(false);
  });
});

/* ── Table · sticky band + zebra/hover route through theming vars ─────────── */

describe('Table — sticky header bg + row stripes/hover read theming vars', () => {
  const props = { columns: ['A'], rows: [['1'], ['2']], striped: true, stickyHeader: true };

  it('th sticky band reads --fr-tbl-head-bg (card fallback), bg-card gone', () => {
    const { container } = draw('Table', props);
    const th = container.querySelector('th')!;
    expect(has(th, '[background:var(--fr-tbl-head-bg,var(--color-card))]')).toBe(true);
    expect(has(th, 'bg-card')).toBe(false);
  });

  it('tr stripes + hover read --fr-tbl-row-accent (muted fallback), token classes gone', () => {
    const { container } = draw('Table', props);
    const tr = container.querySelector('tbody tr')!;
    expect(has(tr, 'odd:[background:color-mix(in_srgb,var(--fr-tbl-row-accent,var(--color-muted))_40%,transparent)]')).toBe(true);
    expect(has(tr, 'odd:bg-muted/40')).toBe(false);
    expect(has(tr, 'hover:[background:var(--fr-tbl-row-accent,var(--color-muted))]')).toBe(true);
    expect(has(tr, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });
});

/* ── Text · variant:code chip background channel ──────────────────────────── */

describe('Text — code-chip bg channel (scoped to variant:code)', () => {
  it('bg SET on variant:code → group-form reader present, bg-muted deduped, var on the chip', () => {
    const { container } = draw('Text', { text: 'npm i', variant: 'code', bg: '#112233' });
    const code = container.querySelector('code')!;
    expect(styleOf(code)).toContain('--fr-text-bg');
    expect(has(code, 'bg-[color:var(--fr-text-bg,var(--fr-surface-sunken,var(--color-muted)))]')).toBe(true);
    expect(has(code, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });

  it('bg UNSET on variant:code → the baked bg-muted stays, reader absent', () => {
    const { container } = draw('Text', { text: 'npm i', variant: 'code' });
    const code = container.querySelector('code')!;
    expect(has(code, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(code, 'bg-[color:var(--fr-text-bg,var(--fr-surface-sunken,var(--color-muted)))]')).toBe(false);
  });
});

/* ── LogoCloud · failed-logo fallback joins the muted role ────────────────── */

describe('LogoCloud — mutedColor covers the alt-text fallback of a failed logo', () => {
  it('mutedColor SET → fallback span reads --fr-logos-muted, token gone', () => {
    const { container } = draw('LogoCloud', { items: [{ alt: 'Acme' }], mutedColor: '#999999' });
    // the fallback is the INNER span (font-semibold, from the logoFallback cva);
    // its wrapper span shares the same textContent, so select by class.
    const fallback = container.querySelector('span.font-semibold')!;
    expect(fallback).not.toBeNull();
    expect(fallback.textContent).toBe('Acme');
    expect(has(fallback, '[color:var(--fr-logos-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(fallback, 'text-muted-foreground')).toBe(false);
  });
});

/* ── UNSET-DEFAULT byte-identical rule ────────────────────────────────────── */

type UnsetCase = { type: string; props: Record<string, unknown>; channel: string };

const UNSET_CASES: UnsetCase[] = [
  { type: 'Callout', props: { message: 'Note', variant: 'solid' }, channel: 'color' },
  { type: 'Banner', props: { message: 'Maintenance' }, channel: 'bg' },
  { type: 'Banner', props: { message: 'Maintenance' }, channel: 'accent' },
  { type: 'LoadingOverlay', props: { label: 'Loading…' }, channel: 'color' },
  {
    type: 'NotFound',
    props: { title: 'Page not found', code: '404', icon: 'search', actionLabel: 'Go home' },
    channel: 'mutedColor',
  },
  {
    type: 'NotFound',
    props: { title: 'Page not found', code: '404', icon: 'search', actionLabel: 'Go home' },
    channel: 'accent',
  },
  { type: 'Result', props: { title: 'Done', actions: [{ label: 'View' }, { label: 'Back' }] }, channel: 'accent' },
  { type: 'Result', props: { title: 'Done', actions: [{ label: 'View' }, { label: 'Back' }] }, channel: 'color' },
  { type: 'FilterBar', props: {}, channel: 'mutedColor' },
  {
    type: 'FacetList',
    props: { facets: [{ label: 'Open', value: 'open', checked: true }] },
    channel: 'accentText',
  },
  {
    type: 'FilterPanel',
    props: { sections: [{ heading: 'Status', facets: [{ label: 'Open', value: 'open', checked: true }] }] },
    channel: 'accentText',
  },
  {
    type: 'FilterPanel',
    props: { sections: [{ heading: 'Status', facets: [{ label: 'Open', value: 'open', checked: true }] }] },
    channel: 'mutedColor',
  },
  { type: 'RichComposer', props: {}, channel: 'mutedColor' },
  { type: 'VideoPlayer', props: {}, channel: 'borderColor' },
  { type: 'VideoPlayer', props: {}, channel: 'borderStyle' },
  { type: 'Thumbnail', props: {}, channel: 'radius' },
  { type: 'Thumbnail', props: {}, channel: 'radiusValue' },
  { type: 'Thumbnail', props: { bordered: true }, channel: 'borderStyle' },
  { type: 'AudioPlayer', props: {}, channel: 'width' },
  { type: 'AudioPlayer', props: {}, channel: 'opacity' },
  { type: 'AudioPlayer', props: {}, channel: 'borderStyle' },
  { type: 'Marquee', props: { items: ['Anthropic', 'Vercel'] }, channel: 'opacity' },
  { type: 'YouTube', props: { videoId: 'dQw4w9WgXcQ', title: 'T' }, channel: 'opacity' },
  { type: 'YouTube', props: { videoId: 'dQw4w9WgXcQ', title: 'T' }, channel: 'borderStyle' },
  { type: 'JsonView', props: { data: { a: { b: 1 } } }, channel: 'mutedColor' },
  {
    type: 'Menubar',
    props: { menus: [{ label: 'File', items: [{ label: 'Open' }] }] },
    channel: 'borderColor',
  },
  { type: 'Table', props: { columns: ['A'], rows: [['1'], ['2']] }, channel: 'striped' },
  { type: 'Table', props: { columns: ['A'], rows: [['1'], ['2']] }, channel: 'stickyHeader' },
  { type: 'Text', props: { text: 'npm i', variant: 'code' }, channel: 'bg' },
  { type: 'LogoCloud', props: { items: [{ alt: 'Acme' }] }, channel: 'mutedColor' },
];

/** Canonicalise React's per-MOUNT `useId` token — the same normalizer, for the
 *  same reason, as `canonIds` in ai-components.test.tsx. FilterPanel's section regions
 *  used to take a spec-id-only id, which two `repeat` rows SHARED (row two's
 *  header aimed a screen reader at row one's facets); they now come from
 *  `useAriaId`, which folds in `useId()` so the rows differ. Two separate
 *  renders then differ in that token alone — which has nothing to do with the
 *  null-vs-absent question these cases exist to test, and without this the
 *  assertion fails even when both sides are given IDENTICAL props. */
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
