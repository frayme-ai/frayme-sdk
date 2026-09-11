/**
 * Regression guard — PARTIAL-PROP + COHERENCE-GROUP fixes across
 * ai-content / social-media / ai-chat / inputs-overlay / charts / forms-extended /
 * data-display-extended / inputs-choice / data-table / data-longtail.
 *
 * Follows test/value-channels.test.tsx: for each fixed channel assert the TRIPLE
 *   (a) the channel var is present in the target's inline style attr,
 *   (b) the CONSUMING class is present in its className,
 *   (c) the competing token class is ABSENT when the prop is set,
 * plus per-component UNSET-DEFAULT tests: prop explicitly null renders
 * BYTE-IDENTICAL innerHTML to the prop never being mentioned.
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

/* ── Sources (ai-content) ─────────────────────────────────────────────────── */

describe('Sources — muted external-link glyph + card surface channels', () => {
  const base = {
    sources: [{ title: 'json-render docs', url: 'https://json-render.dev', excerpt: 'Spec standard.' }],
  };

  it('mutedColor: the hover-reveal icon reads --fr-sources-muted (token deduped)', () => {
    const { container } = draw('Sources', { ...base, mutedColor: '#ff0000' });
    const section = container.querySelector('section')!;
    expect(styleOf(section)).toContain('--fr-sources-muted');
    const icon = container.querySelector('.group-hover\\:opacity-100')!;
    expect(icon).not.toBeNull();
    expect(has(icon, '[color:var(--fr-sources-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(icon, 'text-muted-foreground')).toBe(false);
  });

  it('bg/borderColor/shadow: card reads the surface vars, border-border deduped, shadow enum lands', () => {
    const { container } = draw('Sources', { ...base, bg: '#111111', borderColor: '#ff0000', shadow: 'md' });
    const section = container.querySelector('section')!;
    expect(styleOf(section)).toContain('--fr-sources-bg');
    expect(styleOf(section)).toContain('--fr-sources-border');
    const card = container.querySelector('a')!;
    expect(has(card, '[background:var(--fr-sources-bg,var(--color-card))]')).toBe(true);
    expect(has(card, 'border-[color:var(--fr-sources-border,var(--color-border))]')).toBe(true);
    expect(has(card, 'border-border')).toBe(false);
    expect(has(card, 'shadow-md')).toBe(true);
  });
});

/* ── WebPreview (ai-content) ──────────────────────────────────────────────── */

describe('WebPreview — image-fallback placeholder joins mutedColor', () => {
  it('placeholder glyph wrapper reads --fr-webpreview-muted (token deduped)', () => {
    // A PROMISED but unusable image (ftp is rejected by safeImageSrc) → SafeImage
    // renders the fallback span immediately. It used to be enough to pass NO
    // image at all, but a WebPreview with no `image` no longer draws a media
    // block: nothing was promised, and the 1.91:1 slab was every one of the
    // sampled WebPreviews. The fallback still owns the promised-and-
    // broken case, which is what this muted-channel assertion is about.
    const { container } = draw('WebPreview', { url: 'https://json-render.dev', image: 'ftp://example.com/og.png', mutedColor: '#ff0000' });
    const card = container.querySelector('a')!;
    expect(styleOf(card)).toContain('--fr-webpreview-muted');
    const placeholder = container.querySelector('.aspect-\\[1\\.91\\/1\\]')!;
    expect(placeholder).not.toBeNull();
    expect(has(placeholder, '[color:var(--fr-webpreview-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(placeholder, 'text-muted-foreground')).toBe(false);
  });
});

/* ── Artifact (ai-content) ────────────────────────────────────────────────── */

describe('Artifact — body color channel + header-divider/copy-chip coherence', () => {
  const base = { title: 'report.md', content: 'hello' };

  it('color: --fr-artifact-fg var + body fg-chain reader; text-foreground absent', () => {
    const { container } = draw('Artifact', { ...base, color: '#00ff00' });
    const figure = container.querySelector('figure')!;
    expect(styleOf(figure)).toContain('--fr-artifact-fg');
    const body = container.querySelector('.overflow-auto')!;
    expect(has(body, 'text-[color:var(--fr-artifact-fg,var(--color-foreground))]')).toBe(true);
    expect(has(body, 'text-foreground')).toBe(false);
  });

  it('borderColor: figcaption divider + copy chip follow --fr-artifact-border (token deduped on the chip)', () => {
    const { container } = draw('Artifact', { ...base, borderColor: '#ff0000' });
    const figcaption = container.querySelector('figcaption')!;
    expect(has(figcaption, 'border-b-[color:var(--fr-artifact-border,var(--color-border))]')).toBe(true);
    const btn = container.querySelector('button')!;
    expect(has(btn, 'border-[color:var(--fr-artifact-border,var(--color-border))]')).toBe(true);
    expect(has(btn, 'border-border')).toBe(false);
  });

  it('bg: the copy chip repaints from --fr-artifact-bg', () => {
    const { container } = draw('Artifact', { ...base, bg: '#111111' });
    const btn = container.querySelector('button')!;
    expect(has(btn, '[background:var(--fr-artifact-bg,var(--color-card))]')).toBe(true);
  });
});

/* ── DiffView (ai-content) ────────────────────────────────────────────────── */

describe('DiffView — standard surface channels (family parity with Artifact)', () => {
  const base = { before: 'a\nb', after: 'a\nc', filename: 'config.ts', showLineNumbers: true };

  it('bg/borderColor/borderWidthValue/mutedColor/shadow all land (vars + readers + dedupes)', () => {
    const { container } = draw('DiffView', {
      ...base,
      bg: '#111111',
      borderColor: '#ff0000',
      borderWidthValue: '2px',
      mutedColor: '#00ff00',
      shadow: 'lg',
    });
    const figure = container.querySelector('figure')!;
    const style = styleOf(figure);
    expect(style).toContain('--fr-diff-bg');
    expect(style).toContain('--fr-diff-border');
    expect(style).toContain('--fr-diff-bw');
    expect(style).toContain('--fr-diff-muted');
    expect(has(figure, '[background:var(--fr-diff-bg,var(--color-card))]')).toBe(true);
    expect(has(figure, 'border-[color:var(--fr-diff-border,var(--color-border))]')).toBe(true);
    expect(has(figure, 'border-border')).toBe(false);
    expect(has(figure, '[border-width:var(--fr-diff-bw,1px)]')).toBe(true);
    expect(has(figure, 'shadow-lg')).toBe(true);
    // header divider follows the border channel
    const figcaption = container.querySelector('figcaption')!;
    expect(has(figcaption, 'border-b-[color:var(--fr-diff-border,var(--color-border))]')).toBe(true);
    // muted chain: header glyph + line numbers + unchanged gutter sign
    const glyph = figcaption.querySelector('span[aria-hidden]')!;
    expect(has(glyph, '[color:var(--fr-diff-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(glyph, 'text-muted-foreground')).toBe(false);
    const lineNo = container.querySelector('.w-8')!;
    // The gutter's 60% alpha was dropped in the accessibility audit: muted-foreground
    // at 60% over the card composites to #aaaaaf = 2.31:1 (3.29:1 dark), and a line
    // number is information a reader cites, not decoration, so it needs 4.5:1. The
    // muted token is only 4.83:1 to begin with, so NO alpha above transparent could
    // pass. What this test exists to protect — that the mutedColor VALUE CHANNEL
    // reaches the gutter rather than a hardcoded text-muted-foreground/60 — is
    // unchanged: the var chain is still the only colour declaration here.
    // The sign column below keeps its 50% mix (its low-contrast case paints U+0020).
    expect(has(lineNo, '[color:var(--fr-diff-muted,var(--color-muted-foreground))]')).toBe(true);
    const sign = container.querySelector('.w-4')!;
    expect(has(sign, '[color:color-mix(in_srgb,var(--fr-diff-muted,var(--color-muted-foreground))_50%,transparent)]')).toBe(true);
    expect(container.querySelector('.text-muted-foreground\\/50, .text-muted-foreground\\/60')).toBeNull();
  });
});

/* ── Gallery (social-media) ───────────────────────────────────────────────── */

describe('Gallery — the internal lightbox takes the standalone Lightbox channel-set', () => {
  it('overlayColor + close/prev/next labels flow into the opened overlay', () => {
    const { container } = draw('Gallery', {
      items: [
        { src: 'https://example.com/a.jpg', alt: 'Mountain' },
        { src: 'https://example.com/b.jpg', alt: 'Lake' },
      ],
      overlayColor: '#123456',
      closeLabel: 'Schließen',
      prevLabel: 'Zurück',
      nextLabel: 'Weiter',
    });
    fireEvent.click(container.querySelector('button[aria-label="Open Mountain"]')!);
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(styleOf(dialog)).toContain('--fr-lightbox-scrim');
    expect(container.querySelector('button[aria-label="Schließen"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Zurück"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Weiter"]')).not.toBeNull();
  });
});

/* ── FeedItem + Comment ActionRow (social-media) ──────────────────────────── */

describe('FeedItem/Comment — the shared action bar joins the mutedColor channel', () => {
  const actions = [{ icon: 'heart', label: 'Like', count: 24 }];

  it('FeedItem: action buttons read --fr-feed-muted (token deduped)', () => {
    const { container } = draw('FeedItem', {
      authorName: 'Ada',
      body: 'Shipped.',
      actions,
      mutedColor: '#ff0000',
    });
    const btn = container.querySelector('button')!;
    expect(has(btn, '[color:var(--fr-feed-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(btn, 'text-muted-foreground')).toBe(false);
  });

  it('Comment: action buttons read --fr-comment-muted (token deduped)', () => {
    const { container } = draw('Comment', {
      authorName: 'Grace',
      body: 'Nice.',
      actions,
      mutedColor: '#ff0000',
    });
    const btn = container.querySelector('button')!;
    expect(has(btn, '[color:var(--fr-comment-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(btn, 'text-muted-foreground')).toBe(false);
  });
});

/* ── CommentThread (social-media) ─────────────────────────────────────────── */

describe('CommentThread — typography parity + rail borderColor + toggle muted', () => {
  // BRANCHING (2+ replies on one node) is what earns the nested treatment: the
  // indent rail and the per-node collapse toggle exist only here.
  const comments = [
    {
      authorName: 'Ada',
      timestamp: '1h',
      body: 'Loving it.',
      replies: [
        { authorName: 'Alan', timestamp: '50m', body: 'Agreed.' },
        { authorName: 'Grace', timestamp: '45m', body: 'Same here.' },
      ],
    },
  ];
  // A node with exactly ONE reply is a turn in a linear back-and-forth: the
  // continuation renders as a SIBLING, so there is nothing to indent or collapse.
  const linear = [
    {
      authorName: 'Ada',
      timestamp: '1h',
      body: 'Loving it.',
      replies: [
        {
          authorName: 'Alan',
          timestamp: '50m',
          body: 'Agreed.',
          replies: [{ authorName: 'Ada', timestamp: '40m', body: 'Shipping it.' }],
        },
      ],
    },
  ];

  it('font/weight/tracking/fontSize land like the standalone Comment channels', () => {
    const { container } = draw('CommentThread', {
      comments,
      font: 'serif',
      weight: 'bold',
      tracking: 'wide',
      fontSize: '18px',
    });
    const root = container.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(has(root, 'font-serif')).toBe(true);
    expect(styleOf(root)).toContain('--fr-comment-fs');
    // the author name is the only SPAN on the --fr-comment-fs chain (the body is a
    // <p>); it used to be findable as `.truncate`, which it no longer clips with.
    const author = container.querySelector('span[class*="fr-comment-fs"]')!;
    expect(has(author, 'font-bold')).toBe(true);
    expect(has(author, 'font-semibold')).toBe(false);
    expect(has(author, 'tracking-wide')).toBe(true);
  });

  it('borderColor: the nested-reply rail reads --fr-comment-rail (token deduped)', () => {
    const { container } = draw('CommentThread', { comments, borderColor: '#ff0000' });
    const root = container.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(styleOf(root)).toContain('--fr-comment-rail');
    const rail = container.querySelector('.border-l')!;
    expect(rail).not.toBeNull();
    expect(has(rail, 'border-l-[color:var(--fr-comment-rail,var(--color-border))]')).toBe(true);
    expect(has(rail, 'border-border')).toBe(false);
  });

  it('mutedColor: the collapse toggle reads --fr-comment-muted (token deduped)', () => {
    const { container } = draw('CommentThread', { comments, mutedColor: '#ff0000' });
    const toggle = container.querySelector('button[aria-expanded]')!;
    expect(toggle).not.toBeNull();
    expect(has(toggle, '[color:var(--fr-comment-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(toggle, 'text-muted-foreground')).toBe(false);
  });

  it('a one-reply chain renders NO collapse toggle and NO indent rail', () => {
    const { container } = draw('CommentThread', { comments: linear, borderColor: '#ff0000' });
    // Every turn is present — the chain is flattened to siblings, not dropped.
    expect(container.querySelectorAll('span[class*="fr-comment-fs"]')).toHaveLength(3);
    expect(container.querySelector('button[aria-expanded]')).toBeNull();
    expect(container.querySelector('.border-l')).toBeNull();
  });

  it('the rail starts at the node that really branches, not above it', () => {
    // Ada→Alan is linear; Alan carries the fork, so exactly one rail opens.
    const { container } = draw('CommentThread', {
      comments: [
        {
          authorName: 'Ada',
          body: 'Loving it.',
          replies: [
            {
              authorName: 'Alan',
              body: 'Agreed.',
              replies: [
                { authorName: 'Grace', body: 'Same here.' },
                { authorName: 'Alonzo', body: 'Shipping it.' },
              ],
            },
          ],
        },
      ],
    });
    expect(container.querySelectorAll('.border-l')).toHaveLength(1);
    expect(container.querySelectorAll('button[aria-expanded]')).toHaveLength(1);
  });
});

/* ── Message (ai-chat) ────────────────────────────────────────────────────── */

describe('Message — deterministic avatar coverage + on-fill accentText for non-user roles', () => {
  it('assistant avatar owns bg-muted; the tw-merge-luck base var read is gone', () => {
    const { container } = draw('Message', { content: 'hi', role: 'assistant', author: 'F' });
    const avatar = container.querySelector('[data-role="assistant"] > span')!;
    expect(has(avatar, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(avatar, '[background:var(--fr-msg-accent,var(--color-muted))]')).toBe(false);
  });

  it('user avatar still reads accent (var + reader class)', () => {
    // An avatar renders only when there's an avatar OR resolvable initials —
    // give the user an author so the (accent-tinted) bubble is present to assert on.
    const { container } = draw('Message', { content: 'hi', role: 'user', author: 'U', accent: '#ff0000' });
    const row = container.querySelector('[data-role="user"]')!;
    expect(styleOf(row)).toContain('--fr-msg-accent');
    const avatar = row.querySelector('span')!;
    // quiet-defaults: the accent reader is unchanged; only the unset fallback
    // moved from the brand token to the neutral high-contrast foreground.
    expect(has(avatar, '[background:var(--fr-msg-accent,var(--color-foreground))]')).toBe(true);
  });

  it('assistant bubble: accentText reader (card-foreground fallback) dedupes the role token', () => {
    const { container } = draw('Message', { content: 'hi', role: 'assistant', accentText: '#00ff00' });
    const row = container.querySelector('[data-role="assistant"]')!;
    expect(styleOf(row)).toContain('--fr-msg-accent-text');
    const bubble = row.querySelector(':scope > div > div')!;
    expect(has(bubble, 'text-[color:var(--fr-msg-accent-text,var(--color-card-foreground))]')).toBe(true);
    expect(has(bubble, 'text-card-foreground')).toBe(false);
  });

  it('system bubble: accentText reader (muted-foreground fallback) dedupes the role token', () => {
    const { container } = draw('Message', { content: 'hi', role: 'system', accentText: '#00ff00' });
    const bubble = container.querySelector('[data-role="system"] > div > div')!;
    expect(has(bubble, 'text-[color:var(--fr-msg-accent-text,var(--color-muted-foreground))]')).toBe(true);
    expect(has(bubble, 'text-muted-foreground')).toBe(false);
  });
});

/* ── PromptInput (ai-chat) ────────────────────────────────────────────────── */

describe('PromptInput — the attach button joins the mutedColor channel', () => {
  it('attach button reads --fr-prompt-muted (token deduped)', () => {
    const { container } = draw('PromptInput', { attach: true, mutedColor: '#ff0000' });
    const btn = container.querySelector('button[aria-label="Attach file"]')!;
    expect(has(btn, '[color:var(--fr-prompt-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(btn, 'text-muted-foreground')).toBe(false);
  });
});

/* ── CommandPalette (inputs-overlay) ──────────────────────────────────────── */

describe('CommandPalette — search chrome + item icons + kbd chip join the channels', () => {
  const groups = [
    { heading: 'Nav', items: [{ label: 'Home', icon: 'search', shortcut: '⌘H', value: 'home' }] },
  ];

  it('mutedColor: search icon + placeholder + item icon read --fr-cmd-muted (tokens deduped)', () => {
    const { container } = draw('CommandPalette', { groups, mutedColor: '#ff0000' });
    const input = container.querySelector('input')!;
    expect(has(input, 'placeholder:[color:var(--fr-cmd-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(input, 'placeholder:text-muted-foreground')).toBe(false);
    const spans = [...container.querySelectorAll('span[aria-hidden]')];
    const readers = spans.filter((s) => has(s, '[color:var(--fr-cmd-muted,var(--color-muted-foreground))]'));
    expect(readers.length).toBeGreaterThanOrEqual(2); // search glyph + the item icon
    expect(spans.some((s) => has(s, 'text-muted-foreground'))).toBe(false);
  });

  it('borderColor: header divider + kbd chip read --fr-cmd-border (tokens deduped)', () => {
    const { container } = draw('CommandPalette', { groups, borderColor: '#ff0000' });
    const divider = container.querySelector('.border-b')!;
    expect(has(divider, 'border-b-[color:var(--fr-cmd-border,var(--color-border))]')).toBe(true);
    expect(has(divider, 'border-border')).toBe(false);
    const kbd = container.querySelector('kbd')!;
    expect(has(kbd, 'border-[color:var(--fr-cmd-border,var(--color-border))]')).toBe(true);
    expect(has(kbd, 'border-border')).toBe(false);
  });
});

/* ── FileUpload (inputs-overlay) ──────────────────────────────────────────── */

describe('FileUpload — zone icon / file-row icon / spinner join the mutedColor channel', () => {
  it('all three read --fr-upload-muted; the zone icon keeps its accent hover', () => {
    const { container } = draw('FileUpload', {
      hint: 'PNG or PDF',
      files: [{ name: 'a.png', size: '2MB', status: 'uploading' }],
      mutedColor: '#ff0000',
    });
    const reader = '[color:var(--fr-upload-muted,var(--color-muted-foreground))]';
    const zoneIcon = container.querySelector('label span[aria-hidden]')!;
    expect(has(zoneIcon, reader)).toBe(true);
    expect(has(zoneIcon, 'group-hover:[color:var(--fr-upload-accent,var(--fr-accent))]')).toBe(true);
    expect(has(zoneIcon, 'text-muted-foreground')).toBe(false);
    const rowIcon = container.querySelector('li span[aria-hidden]')!;
    expect(has(rowIcon, reader)).toBe(true);
    const spinnerWrap = container.querySelector('li span[title="Uploading"]')!;
    expect(has(spinnerWrap, reader)).toBe(true);
    expect(container.querySelector('.text-muted-foreground')).toBeNull();
  });
});

/* ── LineChart + Sparkline (charts) ───────────────────────────────────────── */

describe('LineChart — dotColor channel (the dot hole-punch)', () => {
  it('dotColor lands in --fr-linechart-dot; circles read the var chain', () => {
    const { container } = draw('LineChart', {
      series: [{ name: 'A', points: [1, 2, 3] }],
      dotColor: '#ff0000',
    });
    const wrapper = container.querySelector('[style*="--fr-linechart-dot"]');
    expect(wrapper).not.toBeNull();
    const dot = container.querySelector('circle')!;
    expect(dot.getAttribute('fill')).toBe('var(--fr-linechart-dot,var(--color-card))');
  });
});

describe('Sparkline — the empty placeholder tints from tone/color', () => {
  it('tone set: color-mix tint branch + --fr-spark-tint var; the neutral token dropped', () => {
    const { container } = draw('Sparkline', { points: [], tone: 'success' });
    const ph = container.querySelector('[role="img"]')!;
    expect(has(ph, '[background:color-mix(in_srgb,var(--fr-spark-tint,var(--color-muted))_15%,transparent)]')).toBe(true);
    expect(has(ph, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50')).toBe(false);
    expect(styleOf(ph)).toContain('--fr-spark-tint');
  });

  it('color set: same tint branch, var carries the validated value', () => {
    const { container } = draw('Sparkline', { points: [], color: '#123456' });
    const ph = container.querySelector('[role="img"]')!;
    expect(has(ph, '[background:color-mix(in_srgb,var(--fr-spark-tint,var(--color-muted))_15%,transparent)]')).toBe(true);
    expect(styleOf(ph)).toContain('#123456');
  });

  it('neither set: the exact prior neutral token branch', () => {
    const { container } = draw('Sparkline', { points: [] });
    const ph = container.querySelector('[role="img"]')!;
    expect(has(ph, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50')).toBe(true);
    expect(styleOf(ph)).toBe('');
  });
});

/* ── FieldError + SearchInput (forms-extended) ────────────────────────────── */

describe('FieldError — the alert glyph scales with the size enum', () => {
  it('md → 16px icon; default (sm) stays 14px', () => {
    const md = draw('FieldError', { message: 'Bad email.', size: 'md' });
    expect(md.container.querySelector('svg')!.getAttribute('width')).toBe('16');
    md.unmount();
    const dflt = draw('FieldError', { message: 'Bad email.' });
    expect(dflt.container.querySelector('svg')!.getAttribute('width')).toBe('14');
  });
});

describe('SearchInput — clear-button hover derives from the vars when bg/mutedColor set', () => {
  it('bg set: color-mix hover branch, token hover dropped', () => {
    const { container } = draw('SearchInput', { value: 'abc', bg: '#111111' });
    const btn = container.querySelector('button[aria-label="Clear search"]')!;
    expect(has(btn, 'hover:[background:color-mix(in_srgb,var(--fr-search-muted,var(--color-muted-foreground))_15%,transparent)]')).toBe(true);
    expect(has(btn, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
    expect(has(btn, 'hover:text-foreground')).toBe(false);
  });

  it('neither set: the exact prior token hover branch', () => {
    const { container } = draw('SearchInput', { value: 'abc' });
    const btn = container.querySelector('button[aria-label="Clear search"]')!;
    expect(has(btn, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    // fill and ink move together — see the 1c pass
    expect(has(btn, 'hover:text-[color:var(--fr-surface-fg,var(--color-foreground))]')).toBe(true);
  });
});

/* ── ListItem (data-display-extended) ─────────────────────────────────────── */

describe('ListItem — the trailing badge chip tints from mutedColor', () => {
  const base = { title: 'Inbox', badge: '3' };

  it('mutedColor set: color-mix chip fill, bg-muted dropped', () => {
    const { container } = draw('ListItem', { ...base, mutedColor: '#ff0000' });
    const badge = container.querySelector('.rounded-full')!;
    expect(has(badge, '[background:color-mix(in_srgb,var(--fr-listitem-muted,var(--color-muted-foreground))_14%,transparent)]')).toBe(true);
    expect(has(badge, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });

  it('mutedColor unset: the exact prior neutral chip', () => {
    const { container } = draw('ListItem', base);
    const badge = container.querySelector('.rounded-full')!;
    expect(has(badge, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
  });
});

/* ── MultiSelect (inputs-choice) ──────────────────────────────────────────── */

describe('MultiSelect — the in-menu filter input clones the control chrome', () => {
  const base = {
    options: [
      { label: 'One', value: 'one' },
      { label: 'Two', value: 'two' },
    ],
    searchable: true,
  };
  const openMenu = (container: HTMLElement) =>
    fireEvent.click(container.querySelector('button[aria-label="Open options"]')!);

  it('borderColor: the filter border reads --fr-ms-border (token deduped)', () => {
    const { container } = draw('MultiSelect', { ...base, borderColor: '#ff0000' });
    openMenu(container);
    const filter = container.querySelector('input[aria-label="Filter options"]')!;
    expect(has(filter, 'border-[color:var(--fr-ms-border,var(--color-border))]')).toBe(true);
    expect(has(filter, 'border-border')).toBe(false);
  });

  it('mutedColor: the filter placeholder reader is present ONLY when set', () => {
    const withMuted = draw('MultiSelect', { ...base, mutedColor: '#ff0000' });
    openMenu(withMuted.container);
    const tinted = withMuted.container.querySelector('input[aria-label="Filter options"]')!;
    expect(has(tinted, 'placeholder:[color:var(--fr-ms-muted,var(--color-muted-foreground))]')).toBe(true);
    withMuted.unmount();
    const plain = draw('MultiSelect', base);
    openMenu(plain.container);
    const bare = plain.container.querySelector('input[aria-label="Filter options"]')!;
    expect(has(bare, 'placeholder:[color:var(--fr-ms-muted,var(--color-muted-foreground))]')).toBe(false);
  });
});

/* ── DataTable selection checkboxes ───────────────────────────────────────── */

describe('DataTable — checkbox outlines join the borderColor channel', () => {
  const tableProps = {
    columns: [{ key: 'name', label: 'Name' }],
    rows: [{ name: 'Acme' }],
    selectable: true,
  };

  it('DataTable: checkboxes read --fr-dt-border (token deduped)', () => {
    const { container } = draw('DataTable', { ...tableProps, borderColor: '#ff0000' });
    const box = container.querySelector('input[type="checkbox"]')!;
    expect(has(box, 'border-[color:var(--fr-dt-border,var(--color-border))]')).toBe(true);
    expect(has(box, 'border-border')).toBe(false);
  });
});

/* ── UNSET-DEFAULT byte-identical rule ────────────────────────────────────── */

type UnsetCase = { type: string; props: Record<string, unknown>; channels: string[] };

const UNSET_CASES: UnsetCase[] = [
  {
    type: 'Sources',
    props: { sources: [{ title: 'Docs', url: 'https://json-render.dev', excerpt: 'x' }] },
    channels: ['mutedColor', 'bg', 'borderColor', 'shadow'],
  },
  { type: 'WebPreview', props: { url: 'https://json-render.dev', title: 'Docs' }, channels: ['mutedColor'] },
  { type: 'Artifact', props: { title: 'r.md', content: 'hello' }, channels: ['color', 'bg', 'borderColor'] },
  {
    type: 'DiffView',
    props: { before: 'a\nb', after: 'a\nc', showLineNumbers: true },
    channels: ['bg', 'borderColor', 'borderWidthValue', 'mutedColor', 'shadow'],
  },
  {
    type: 'Gallery',
    props: { items: [{ src: 'https://example.com/a.jpg', alt: 'A' }] },
    channels: ['overlayColor', 'closeLabel', 'prevLabel', 'nextLabel'],
  },
  {
    type: 'FeedItem',
    props: { authorName: 'Ada', body: 'x', actions: [{ icon: 'heart', label: 'Like' }] },
    channels: ['mutedColor'],
  },
  {
    type: 'Comment',
    props: { authorName: 'Ada', body: 'x', actions: [{ icon: 'heart', label: 'Like' }] },
    channels: ['mutedColor'],
  },
  {
    type: 'CommentThread',
    props: {
      // 2+ replies so the rail + collapse toggle are in the compared markup.
      comments: [
        {
          authorName: 'Ada',
          body: 'x',
          replies: [
            { authorName: 'Alan', body: 'y' },
            { authorName: 'Grace', body: 'z' },
          ],
        },
      ],
    },
    channels: ['mutedColor', 'borderColor', 'font', 'weight', 'tracking', 'fontSize'],
  },
  { type: 'Message', props: { content: 'hi', role: 'assistant', author: 'F' }, channels: ['accent', 'accentText', 'bg'] },
  { type: 'Message', props: { content: 'hi', role: 'system' }, channels: ['accentText'] },
  { type: 'PromptInput', props: { attach: true }, channels: ['mutedColor'] },
  {
    type: 'CommandPalette',
    props: { groups: [{ heading: 'Nav', items: [{ label: 'Home', icon: 'search', shortcut: '⌘H', value: 'home' }] }] },
    channels: ['mutedColor', 'borderColor'],
  },
  {
    type: 'FileUpload',
    props: { hint: 'PNG', files: [{ name: 'a.png', size: '2MB', status: 'uploading' }] },
    channels: ['mutedColor'],
  },
  { type: 'LineChart', props: { series: [{ name: 'A', points: [1, 2, 3] }] }, channels: ['dotColor'] },
  { type: 'Sparkline', props: { points: [] }, channels: ['tone', 'color'] },
  { type: 'FieldError', props: { message: 'Bad.' }, channels: ['size'] },
  { type: 'SearchInput', props: { value: 'abc' }, channels: ['bg', 'mutedColor'] },
  { type: 'ListItem', props: { title: 'Inbox', badge: '3' }, channels: ['mutedColor'] },
  {
    type: 'MultiSelect',
    props: { options: [{ label: 'One', value: 'one' }], searchable: true },
    channels: ['borderColor', 'mutedColor'],
  },
  {
    type: 'DataTable',
    props: { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Acme' }], selectable: true },
    channels: ['borderColor'],
  },
];

/** Canonicalise React's per-MOUNT `useId` token — the same normalizer, for the
 *  same reason, as `canonIds` in ai-components.test.tsx and feedback-media-channels.test.tsx.
 *  CommandPalette's list id was the fixed literal `fr-cmd-list` and its row ids
 *  were the item value alone, so two palettes on one page (and two `repeat` rows)
 *  emitted the SAME id and the second combobox's aria-controls resolved to the
 *  first palette's list; the ids now come from `useAriaId`, which folds in
 *  `useId()`. Two separate renders then differ in that token alone — which has
 *  nothing to do with the null-vs-absent question these cases exist to test, and
 *  without this the assertion fails even when both sides are given IDENTICAL
 *  props. */
const canonIds = (html: string): string => html.replace(/_r_[0-9a-z]+_/g, '_rID_');

describe('w2b group-2 — unset default is byte-identical to prop-not-mentioned', () => {
  for (const c of UNSET_CASES) {
    const nulls = Object.fromEntries(c.channels.map((k) => [k, null]));
    it(`${c.type}: {${c.channels.join(', ')}} null renders byte-identical to absent`, () => {
      const withNull = draw(c.type, { ...c.props, ...nulls });
      const nullHtml = withNull.container.innerHTML;
      withNull.unmount();
      const without = draw(c.type, { ...c.props });
      expect(canonIds(nullHtml)).toBe(canonIds(without.container.innerHTML));
    });
  }
});
