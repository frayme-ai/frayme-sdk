/**
 * INHERITED-FOREGROUND guard — actions.tsx · navigation.tsx · marketing-page.tsx.
 *
 * The defect: a spec authors `Card { bg:"#12161f", color:"#e2e6f0" }`, the colour
 * inherits correctly down two levels, and then a control RESETS it to the global
 * token. Measured on a generated feature-flag console:
 *
 *   SECTION (Card)  color rgb(226,230,240)  bg rgb(18,22,31)   <- authored
 *   DIV   (Stack)   color rgb(226,230,240)                     <- inherits
 *   BUTTON          color rgb(24,24,27)                        <- RESETS  1.02:1
 *   SPAN            color rgb(24,24,27)                        <- inherits the reset
 *
 * Many contrast findings in generated specs are this shape — text
 * the same colour as its own background, ratios 1.00-1.02 — and the spec did
 * nothing wrong.
 *
 * The fix is `currentColor` as the LAST RESORT of a foreground chain. It is safe
 * because frayme.css points BOTH `.frayme-root { color }` and `--color-foreground`
 * at `--frayme-fg`: at the top level the two resolve to the same value
 * (byte-identical), and inside an authored container the inherited one is the only
 * correct answer. On the `color` property `currentColor` computes to the INHERITED
 * value (CSS Color 4 treats it as `color: inherit` there), so there is no cycle.
 *
 * WHY THIS FILE MEASURES RATHER THAN GREPS. A class-string assertion cannot tell
 * `text-[color:currentColor]` from `text-foreground` in the only way that matters
 * — what the reader actually sees — and it cannot catch the second half of the
 * rule either. So each case resolves the element's surviving colour class through
 * the REAL var chain in frayme.css, feeding `currentColor` the colour the element
 * would inherit, and asserts the resulting ink twice:
 *
 *   · inside the authored card  → the authored ink (and ≥ 4.5:1 on its bg);
 *   · at the top level          → still exactly --color-foreground (byte-identical).
 *
 * It is NOT a blanket rename. Every case is paired with a sibling that must NOT
 * move: an element painting its OWN opaque fill (`primary` on bg-foreground,
 * Pagination `solid` on bg-card, a Testimonial `card`, a Footer with a `bg`)
 * keeps the token its fill is partnered with. Inheriting the container's ink onto
 * a surface the element painted itself is the same bug pointing the other way.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* ── the token table, read from the stylesheet that ships ──────────────────── */
/* (same idiom as scheduler-meta-contrast.test.tsx — a hard-coded hex here would
   stop measuring the moment frayme.css re-tunes a token, which it has done.) */

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

/** Every `--x: value;` declaration in a block. */
const declsIn = (blk: string): Record<string, string> =>
  Object.fromEntries([...blk.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

// `.frayme-root` carries BOTH halves of the chain: the --color-* tokens re-pointed
// at --frayme-*, and the --frayme-* light values.
const VARS = declsIn(cssBlock(/^\.frayme-root\s*\{/m));

/* ── a resolver for the slice of CSS colour syntax these classes use ───────── */

type RGB = [number, number, number];

/** Split on top-level commas (var() nests, so depth matters). */
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

/** `var(--a,fallback)` · `currentColor` · `inherit` · `#rrggbb`.
 *
 *  `inherited` is what the element would inherit — which is exactly what CSS
 *  computes `currentColor` to when it lands on the `color` property. That single
 *  line is the whole subject of this file: before the fix these chains bottomed
 *  out at `var(--color-foreground)` and never consulted it. */
function resolveColor(expr: string, inherited: RGB, vars: Record<string, string>): RGB {
  // Tailwind arbitrary values encode spaces as underscores.
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

/* ── reading the ink an element actually paints ────────────────────────────── */

/** The token utilities that set `color` and appear in these three files. */
const TEXT_TOKEN: Record<string, string> = {
  foreground: 'var(--color-foreground)',
  card: 'var(--color-card)',
  'card-foreground': 'var(--color-card-foreground)',
  'muted-foreground': 'var(--color-muted-foreground)',
  'primary-foreground': 'var(--color-primary-foreground)',
  inherit: 'inherit',
  current: 'currentColor',
};

/** The RESTING colour expression this element sets, or null when it only
 *  inherits. Modifier-scoped classes (`hover:` / `aria-pressed:` / `focus-*`)
 *  are deliberately skipped — they are not the resting state the audit measures.
 *  cn()/tailwind-merge has already collapsed the group, so at most one survives
 *  per form; more than one would mean a tw-merge trap and is failed loudly. */
function colorExprOf(el: Element): string | null {
  const found: string[] = [];
  for (const c of el.className.split(/\s+/).filter(Boolean)) {
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

/** Custom properties the element sets INLINE (styleVars output). */
function inlineVars(el: Element): Record<string, string> {
  const st = (el as HTMLElement).style;
  const out: Record<string, string> = {};
  for (let i = 0; i < st.length; i += 1) {
    const n = st[i];
    if (n.startsWith('--')) out[n] = st.getPropertyValue(n).trim();
  }
  return out;
}

/** The ink `el` paints, given what it inherits. */
function inkOf(el: Element, inherited: RGB): RGB {
  const expr = colorExprOf(el);
  if (expr == null) return inherited;
  return resolveColor(expr, inherited, { ...VARS, ...inlineVars(el) });
}

/* ── the two surfaces every case is measured on ────────────────────────────── */

const CARD_BG = '#12161f';
const CARD_FG = '#e2e6f0';
const AUTHORED: RGB = hexToRgb(CARD_FG);
const SURFACE: RGB = hexToRgb(CARD_BG);
/** The page's own ink — `.frayme-root { color: var(--frayme-fg) }`. */
const ROOT_INK: RGB = resolveColor('var(--frayme-fg)', [0, 0, 0], VARS);
/** …which is the same value `--color-foreground` resolves to. That equality is
 *  what makes substituting currentColor byte-identical at the top level, so it is
 *  asserted rather than assumed. */
const TOKEN_FG: RGB = resolveColor('var(--color-foreground)', [0, 0, 0], VARS);

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

/** The component alone, on the page's own surface. */
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

/** The component inside the authored dark card from the trace. */
function drawInCard(type: string, props: Record<string, unknown>) {
  const spec = {
    root: 'card',
    elements: {
      card: { type: 'Card', props: { bg: CARD_BG, color: CARD_FG }, children: ['el'] },
      el: { type, props },
    },
    state: {},
  } as unknown as Spec;
  return render(<FraymeRenderer spec={spec} mode="progressive" />);
}

/** The card's own ink — the value everything inside it must inherit. */
function cardInk(container: HTMLElement): RGB {
  const card = container.querySelector('section.fr-frame')!;
  expect(card, 'the authored Card').not.toBeNull();
  return inkOf(card, ROOT_INK);
}

/** `pick` finds the node under test in each render. */
type Case = {
  name: string;
  type: string;
  props: Record<string, unknown>;
  pick: (c: HTMLElement) => Element;
};

/** Cases whose element paints NO fill of its own → it must inherit. */
function itInherits(c: Case): void {
  it(`${c.name}: inherits the authored ink inside a dark card`, () => {
    const { container } = drawInCard(c.type, c.props);
    const inherited = cardInk(container);
    expect(inherited).toEqual(AUTHORED);
    const ink = inkOf(c.pick(container), inherited);
    expect(ink, 'reset to the global token instead of inheriting').not.toEqual(TOKEN_FG);
    expect(ink).toEqual(AUTHORED);
    // …and the outcome the audit actually scores. The pre-fix ink measured 1.02.
    expect(contrast(ink, SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKEN_FG, SURFACE)).toBeLessThan(1.1);
  });

  it(`${c.name}: unchanged on the page's own surface (byte-identical default)`, () => {
    const { container } = draw(c.type, c.props);
    expect(inkOf(c.pick(container), ROOT_INK)).toEqual(TOKEN_FG);
  });
}

/** Cases whose element paints its OWN opaque fill → it must NOT inherit. */
function itKeepsTheToken(c: Case, expected: RGB = TOKEN_FG): void {
  it(`${c.name}: keeps its own token — it painted the surface under it`, () => {
    const { container } = drawInCard(c.type, c.props);
    expect(inkOf(c.pick(container), cardInk(container))).toEqual(expected);
  });
}

const button = (c: HTMLElement): Element => c.querySelector('button')!;
const byText = (t: string) => (c: HTMLElement): Element =>
  [...c.querySelectorAll('button,a,span')].find((e) => e.textContent === t)!;

/* ══════════════════════════════════════════════════════════════════════════ */

describe('actions.tsx — Button', () => {
  itInherits({ name: 'ghost', type: 'Button', props: { label: 'Cancel', variant: 'ghost' }, pick: button });
  itInherits({ name: 'outline', type: 'Button', props: { label: 'Cancel', variant: 'outline' }, pick: button });

  // primary paints bg-foreground and prints text-card on it; secondary/tone
  // paint bg-muted. currentColor there would make the slab equal the ink.
  itKeepsTheToken(
    { name: 'primary', type: 'Button', props: { label: 'Save' }, pick: button },
    resolveColor('var(--color-card)', [0, 0, 0], VARS),
  );
  itKeepsTheToken({ name: 'secondary', type: 'Button', props: { label: 'Save', variant: 'secondary' }, pick: button });

  it('ghost hover no longer paints a token slab under an inherited label', () => {
    const { container } = draw('Button', { label: 'Cancel', variant: 'ghost' });
    // hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] is a LIGHT fill; with the label now inheriting a light
    // authored ink it would have been light-on-light. The wash follows the label.
    expect(button(container).className).toContain(
      'hover:[background:color-mix(in_srgb,currentColor_8%,transparent)]',
    );
    expect(button(container).classList.contains('hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });
});

describe('actions.tsx — Link · Pagination · ButtonGroup', () => {
  itInherits({
    name: 'Link tone:neutral',
    type: 'Link',
    props: { label: 'Docs', href: '/docs', tone: 'neutral' },
    pick: (c) => c.querySelector('a')!,
  });

  // A SEMANTIC tone names a meaning, not a surface: it must stay pinned.
  itKeepsTheToken(
    { name: 'Link tone:critical', type: 'Link', props: { label: 'Delete', href: '/x', tone: 'critical' }, pick: (c) => c.querySelector('a')! },
    resolveColor('var(--color-danger)', [0, 0, 0], VARS),
  );

  // outline is Pagination's DEFAULT variant — every props-less pager was affected.
  itInherits({
    name: 'Pagination (default outline)',
    type: 'Pagination',
    props: { totalPages: 5, page: 1 },
    pick: byText('3'),
  });
  itInherits({
    name: 'Pagination ghost',
    type: 'Pagination',
    props: { totalPages: 5, page: 1, variant: 'ghost' },
    pick: byText('3'),
  });
  itKeepsTheToken({
    name: 'Pagination solid',
    type: 'Pagination',
    props: { totalPages: 5, page: 1, variant: 'solid' },
    pick: byText('3'),
  });

  itInherits({
    name: 'ButtonGroup outline (resting segment)',
    type: 'ButtonGroup',
    props: { buttons: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }], variant: 'outline', selected: 'a' },
    pick: byText('B'),
  });
  itKeepsTheToken({
    name: 'ButtonGroup solid (resting segment)',
    type: 'ButtonGroup',
    props: { buttons: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }], selected: 'a' },
    pick: byText('B'),
  });
});

describe('navigation.tsx — Breadcrumb', () => {
  const CRUMBS = { items: [{ label: 'Home', href: '/' }, { label: 'Settings', href: null }] };

  itInherits({
    name: 'current crumb',
    type: 'Breadcrumb',
    props: CRUMBS,
    pick: (c) => c.querySelector('[aria-current="page"]')!,
  });

  it('the muted trail is unchanged — the grey only moved off the <ol> onto it', () => {
    const { container } = draw('Breadcrumb', CRUMBS);
    const muted = resolveColor('var(--color-muted-foreground)', [0, 0, 0], VARS);
    // <ol> no longer paints; every trail node states the muted chain itself.
    expect(colorExprOf(container.querySelector('ol')!)).toBeNull();
    expect(inkOf(container.querySelector('a')!, ROOT_INK)).toEqual(muted);
    // …including the hrefless, non-current crumb that used to inherit it.
    const { container: c2 } = draw('Breadcrumb', {
      items: [{ label: 'Home', href: null }, { label: 'Here', href: null }],
    });
    const plain = [...c2.querySelectorAll('span')].find((s) => s.textContent === 'Home')!;
    expect(inkOf(plain, ROOT_INK)).toEqual(muted);
  });
});

describe('marketing-page.tsx — Testimonial · FAQ · Footer', () => {
  const QUOTE = { quote: 'It shipped in a week.', authorName: 'Ada' };
  const quote = (c: HTMLElement): Element => c.querySelector('blockquote')!;

  // plain/large draw no surface; `card` paints bg-card and keeps the token.
  itInherits({ name: 'Testimonial plain quote', type: 'Testimonial', props: { ...QUOTE, variant: 'plain' }, pick: quote });
  itInherits({
    name: 'Testimonial plain author',
    type: 'Testimonial',
    props: { ...QUOTE, variant: 'plain' },
    pick: byText('Ada'),
  });
  itKeepsTheToken({ name: 'Testimonial card quote', type: 'Testimonial', props: QUOTE, pick: quote });

  itInherits({
    name: 'FAQ question header',
    type: 'FAQ',
    props: { items: [{ question: 'How do I cancel?', answer: 'From billing.' }] },
    pick: button,
  });

  itInherits({
    name: 'Footer brand (no bg — the footer paints nothing)',
    type: 'Footer',
    props: { brand: 'Frayme', bottomText: '© 2026' },
    pick: byText('Frayme'),
  });
  itKeepsTheToken({
    name: 'Footer brand with a bg',
    type: 'Footer',
    props: { brand: 'Frayme', bg: '#0b1020' },
    pick: byText('Frayme'),
  });

  it('FAQ/Footer accent defaults resolve to the token at the top level', () => {
    // Both are `--fr-*-accent` DEFAULTS read only as `color` (the open FAQ row, the
    // footer link hover). Substituting currentColor keeps the quiet default — no
    // accent unless one is named — because at the top level it lands on the same
    // value the old `var(--color-foreground)` did.
    expect(ROOT_INK).toEqual(TOKEN_FG);
    const { container } = draw('FAQ', { items: [{ question: 'Q', answer: 'A' }] });
    expect(container.querySelector('.\\[--fr-faq-accent\\:currentColor\\]')).not.toBeNull();
    const { container: f } = draw('Footer', { brand: 'Frayme' });
    expect(f.querySelector('.\\[--fr-footer-accent\\:currentColor\\]')).not.toBeNull();
  });
});
