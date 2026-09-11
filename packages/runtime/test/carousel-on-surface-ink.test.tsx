/**
 * ON-SURFACE INK guard — layout.tsx · Carousel.
 *
 * This is the INVERSE of the inherited-foreground defect, and it needs saying
 * plainly because the cure for that one is a no-op here: the carousel title
 * sets no colour at all, so there was never a `var(--color-foreground)` to swap
 * for `currentColor`. It inherits, and inheriting is precisely the problem.
 *
 * The carousel CARD paints a fill — `[background:var(--fr-car-bg,var(--color-card))]`
 * — and named no ink to go with it. So the title inherited whatever an authored
 * ANCESTOR had chosen for a completely different surface. Measured on
 * a generated streaming-watchlist page,
 * whose page Stack authors bg:#150b10 / color:#f2e7ec:
 *
 *   DIV (Stack)   color #f2e7ec  bg #150b10       <- authored, correct
 *   DIV (card)    bg #ffffff  (--color-card)      <- the card's OWN surface
 *   H2  (title)   color #f2e7ec on #ffffff        <- 1.21:1  INVISIBLE
 *   BUTTON (‹ ›)  color #f2e7ec on #ffffff        <- 1.21:1  INVISIBLE
 *
 * A fill has to arrive with the ink it is partnered with. `--color-card`'s
 * partner is `--color-card-foreground`, which is the SAME value the title
 * inherited on the page's own surface (both #18181b in light, #fafafa in dark),
 * so an unset carousel is byte-identical — asserted below rather than assumed.
 *
 * THE OVER-APPLICATION HALF. Pinning the token unconditionally would be the same
 * bug pointing the other way. The catalog gives Carousel no per-card text colour
 * (`cardBg` exists, a matching `cardColor` does not), so once an author paints
 * their own fill the INHERITED ink is the only source that can be right: pinning
 * there prints #18181b on a #12161f card — 1.02:1, a working card turned
 * invisible. Every case below is therefore paired with an authored-`cardBg`
 * sibling that must KEEP inheriting.
 *
 * Measuring, not grepping: each case resolves the surviving colour/background
 * classes through the real var chain in frayme.css and scores the ink the reader
 * actually sees. (Same idiom as inherited-foreground-actions-nav-marketing.test.tsx.)
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* ── the token table, read from the stylesheet that ships ──────────────────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '../src/styles/frayme.css'), 'utf8');

function cssBlock(startPattern: RegExp): string {
  const i = css.search(startPattern);
  if (i < 0) throw new Error(`block not found: ${startPattern}`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j += 1) {
    if (css[j] === '{') depth += 1;
    else if (css[j] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open, j);
    }
  }
  throw new Error('unbalanced braces');
}

const declsIn = (blk: string): Record<string, string> =>
  Object.fromEntries([...blk.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const VARS = declsIn(cssBlock(/^\.frayme-root\s*\{/m));
/** The system-dark block — the only one a viewer on the default setting gets. */
const DARK_VARS = { ...VARS, ...declsIn(cssBlock(/@media \(prefers-color-scheme: dark\)/)) };

/* ── a resolver for the slice of CSS colour syntax these classes use ───────── */

type RGB = [number, number, number];

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const hexToRgb = (h: string): RGB => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
};

/** `var(--a,fallback)` · `currentColor` · `inherit` · `#rrggbb`. */
function resolveColor(expr: string, inherited: RGB, vars: Record<string, string>): RGB {
  const e = expr.replace(/_/g, ' ').trim();
  if (/^(currentcolor|inherit)$/i.test(e)) return inherited;
  if (e.startsWith('#')) return hexToRgb(e);
  if (e.startsWith('var(')) {
    const args = splitTop(e.slice(4, -1));
    const value = vars[args[0]];
    if (value != null) return resolveColor(value, inherited, vars);
    if (args.length > 1) return resolveColor(args.slice(1).join(','), inherited, vars);
    throw new Error(`unset var with no fallback: ${args[0]}`);
  }
  throw new Error(`unhandled colour expression: ${e}`);
}

/* ── WCAG 2.1 relative luminance + contrast (the accessibility audit's own math) ────── */

const luminance = ([r, g, b]: RGB): number => {
  const f = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: RGB, b: RGB): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* ── reading what an element paints ────────────────────────────────────────── */

const TEXT_TOKEN: Record<string, string> = {
  foreground: 'var(--color-foreground)',
  'card-foreground': 'var(--color-card-foreground)',
  'muted-foreground': 'var(--color-muted-foreground)',
  inherit: 'inherit',
  current: 'currentColor',
};

/** The RESTING colour expression this element sets, or null when it only
 *  inherits. tailwind-merge has already collapsed the group, so more than one
 *  survivor would mean a tw-merge trap and is failed loudly. */
function colorExprOf(el: Element): string | null {
  const found: string[] = [];
  for (const c of el.className.split(/\s+/).filter(Boolean)) {
    if (/^(hover|focus|active|disabled|aria|group)[-:]/.test(c)) continue;
    let m = /^text-\[color:(.+)\]$/.exec(c) ?? /^\[color:(.+)\]$/.exec(c);
    if (m) {
      found.push(m[1]);
      continue;
    }
    m = /^text-([a-z-]+)$/.exec(c);
    if (m && TEXT_TOKEN[m[1]] != null) found.push(TEXT_TOKEN[m[1]]);
  }
  expect(found.length, `one resting colour source expected on "${el.className}"`).toBeLessThan(2);
  return found[0] ?? null;
}

/** The background expression this element paints, or null when it paints none. */
function bgExprOf(el: Element): string | null {
  for (const c of el.className.split(/\s+/).filter(Boolean)) {
    if (/^(hover|focus|active|disabled|aria|group)[-:]/.test(c)) continue;
    const m = /^\[background:(.+)\]$/.exec(c);
    if (m) return m[1];
  }
  return null;
}

function inlineVars(el: Element): Record<string, string> {
  const st = (el as HTMLElement).style;
  const out: Record<string, string> = {};
  for (let i = 0; i < st.length; i += 1) {
    const n = st[i];
    if (n.startsWith('--')) out[n] = st.getPropertyValue(n).trim();
  }
  return out;
}

/** Custom properties in scope on `el` — its own inline vars plus every ancestor's. */
function scopeVars(el: Element): Record<string, string> {
  const chain: Element[] = [];
  for (let n: Element | null = el; n != null; n = n.parentElement) chain.push(n);
  return chain.reverse().reduce((acc, n) => ({ ...acc, ...inlineVars(n) }), { ...VARS });
}

/** The ink `el` paints, walking up for what it inherits. */
function inkOf(el: Element): RGB {
  const chain: Element[] = [];
  for (let n: Element | null = el; n != null; n = n.parentElement) chain.push(n);
  let ink: RGB = ROOT_INK;
  for (const n of chain.reverse()) {
    const expr = colorExprOf(n);
    if (expr != null) ink = resolveColor(expr, ink, scopeVars(n));
  }
  return ink;
}

/** The fill `el` paints. */
const fillOf = (el: Element): RGB => {
  const expr = bgExprOf(el);
  expect(expr, `expected ${el.tagName} to paint a fill`).not.toBeNull();
  return resolveColor(expr!, ROOT_INK, scopeVars(el));
};

/* ── the surfaces every case is measured on ────────────────────────────────── */

/** The generated page's own Stack. */
const PAGE_BG = '#150b10';
const PAGE_FG = '#f2e7ec';
/** The authored Card from the inherited-foreground trace, reused as a second host. */
const CARD_BG = '#12161f';
const CARD_FG = '#e2e6f0';

const ROOT_INK: RGB = resolveColor('var(--frayme-fg)', [0, 0, 0], VARS);
const CARD_TOKEN_INK: RGB = resolveColor('var(--color-card-foreground)', [0, 0, 0], VARS);

const ITEMS = [
  { title: 'Northline', description: 'S2 finale · 34 min left of 58' },
  { title: 'The Orchard House', description: 'Last ep of S1 · 21 min left of 47' },
];

const carouselProps = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  items: ITEMS,
  showControls: true,
  ...extra,
});

/** The strip on the page's own surface. */
function drawBare(extra: Record<string, unknown> = {}) {
  const spec = {
    root: 'c',
    elements: { c: { type: 'Carousel', props: carouselProps(extra) } },
    state: {},
  } as unknown as Spec;
  return render(<FraymeRenderer spec={spec} mode="progressive" />);
}

/** The strip inside a host that authored a dark surface + a light ink on it. */
function drawInHost(host: 'Stack' | 'Card', extra: Record<string, unknown> = {}) {
  const props =
    host === 'Stack'
      ? { direction: 'vertical', bg: PAGE_BG, color: PAGE_FG }
      : { bg: CARD_BG, color: CARD_FG };
  const spec = {
    root: 'host',
    elements: {
      host: { type: host, props, children: ['c'] },
      c: { type: 'Carousel', props: carouselProps(extra) },
    },
    state: {},
  } as unknown as Spec;
  return render(<FraymeRenderer spec={spec} mode="progressive" />);
}

const cardEl = (c: HTMLElement): Element => c.querySelector('[data-carousel-track] > div')!;
const titleEl = (c: HTMLElement): Element => c.querySelector('[data-carousel-track] h2')!;
const arrowEl = (c: HTMLElement): Element => c.querySelector('button[aria-label="Previous"]')!;

/* ══════════════════════════════════════════════════════════════════════════ */

describe('the token pairing this fix leans on', () => {
  it('--color-card-foreground equals the page ink in BOTH modes (byte-identical unset)', () => {
    expect(CARD_TOKEN_INK).toEqual(ROOT_INK);
    // …and on the default "system" setting, which stamps no attribute at all.
    expect(resolveColor('var(--color-card-foreground)', [0, 0, 0], DARK_VARS)).toEqual(
      resolveColor('var(--frayme-fg)', [0, 0, 0], DARK_VARS),
    );
  });
});

describe('Carousel — the card and the title', () => {
  it('on the page own surface the title is UNCHANGED (byte-identical default)', () => {
    const { container } = drawBare();
    expect(inkOf(titleEl(container))).toEqual(ROOT_INK);
    expect(contrast(inkOf(titleEl(container)), fillOf(cardEl(container)))).toBeGreaterThanOrEqual(4.5);
  });

  for (const host of ['Stack', 'Card'] as const) {
    const hostInk = hexToRgb(host === 'Stack' ? PAGE_FG : CARD_FG);

    it(`inside an authored ${host} the title takes the ink its OWN fill is partnered with`, () => {
      const { container } = drawInHost(host);
      const fill = fillOf(cardEl(container));
      const ink = inkOf(titleEl(container));
      // the defect: it used to inherit the host's ink onto the card's own fill.
      expect(ink, "still inheriting the host's ink").not.toEqual(hostInk);
      expect(ink).toEqual(CARD_TOKEN_INK);
      expect(contrast(ink, fill)).toBeGreaterThanOrEqual(4.5);
      // …and the measurement that sent this here: 1.21 (Stack) / 1.25 (Card).
      expect(contrast(hostInk, fill)).toBeLessThan(1.3);
    });

    it(`inside an authored ${host} the arrow glyph does too`, () => {
      const { container } = drawInHost(host);
      const arrow = arrowEl(container);
      expect(inkOf(arrow)).toEqual(CARD_TOKEN_INK);
      expect(contrast(inkOf(arrow), fillOf(arrow))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('…and the same rule pointing the other way (over-application guard)', () => {
  // A blanket `text-card-foreground` on the card would pass every case above and
  // still be wrong: on a fill the AUTHOR painted, the inherited ink is the only
  // source that can be right, because the catalog exposes no `cardColor`.
  for (const host of ['Stack', 'Card'] as const) {
    const hostInk = hexToRgb(host === 'Stack' ? PAGE_FG : CARD_FG);

    it(`authored cardBg inside an authored ${host}: the title KEEPS inheriting`, () => {
      const { container } = drawInHost(host, { cardBg: '#1e1218' });
      const fill = fillOf(cardEl(container));
      expect(fill).toEqual(hexToRgb('#1e1218'));
      const ink = inkOf(titleEl(container));
      expect(ink, 'pinned the token onto a fill the author painted').not.toEqual(CARD_TOKEN_INK);
      expect(ink).toEqual(hostInk);
      expect(contrast(ink, fill)).toBeGreaterThanOrEqual(4.5);
      // what pinning would have cost: #18181b on #1e1218.
      expect(contrast(CARD_TOKEN_INK, fill)).toBeLessThan(1.3);
    });

    it(`authored cardBg inside an authored ${host}: the arrow glyph KEEPS inheriting`, () => {
      const { container } = drawInHost(host, { cardBg: '#1e1218' });
      const arrow = arrowEl(container);
      expect(inkOf(arrow)).toEqual(hostInk);
      expect(contrast(inkOf(arrow), fillOf(arrow))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('an INVALID cardBg falls back to the token fill, so the pairing falls back with it', () => {
    // styleVars drops the bad value, so --fr-car-bg never lands and the card
    // paints --color-card. Keying the pairing off the raw prop would have left
    // this card white with the host's light ink on it.
    const { container } = drawInHost('Stack', { cardBg: 'url(javascript:alert(1))' });
    const fill = fillOf(cardEl(container));
    expect(fill).toEqual(resolveColor('var(--color-card)', [0, 0, 0], VARS));
    expect(inkOf(titleEl(container))).toEqual(CARD_TOKEN_INK);
    expect(contrast(inkOf(titleEl(container)), fill)).toBeGreaterThanOrEqual(4.5);
  });
});
