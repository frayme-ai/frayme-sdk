/**
 * INHERITED-FOREGROUND guard — the canvas/overlay group:
 * signature-pad · media-annotator · floor-plan · media-scrubber · tournament-bracket.
 *
 * The defect class (same as the other inherited-foreground-*.test.tsx files): a spec authors
 * `Card { bg:"#12161f", color:"#e2e6f0" }`, the colour inherits down, and then a
 * control RESETS it to the global token. Measured on a generated feature-flag console:
 *
 *   SECTION (Card)  color rgb(226,230,240)  bg rgb(18,22,31)   <- authored
 *   DIV             color rgb(226,230,240)                     <- inherits
 *   BUTTON          color rgb(24,24,27)                        <- RESETS  1.02:1
 *
 * The fix is `currentColor` as the LAST RESORT of a foreground chain: frayme.css
 * points BOTH `.frayme-root { color }` and `--color-foreground` at `--frayme-fg`,
 * so at the top level the two resolve to the same value (byte-identical), while
 * inside an authored container the inherited one is the only correct answer. On
 * the `color` property `currentColor` computes to the INHERITED value — no cycle.
 *
 * ── WHY THIS GROUP IS ALMOST ENTIRELY LEAVE-CASES ────────────────────────────
 * These five components are canvases and overlays, and they PAINT THEIR OWN
 * OPAQUE SURFACES. Card's authored `bg` sets `--fr-card-bg`; it never re-points
 * `--color-card` or `--color-muted`, so a `bg-card` panel nested inside a dark
 * authored card is still WHITE, and the dark token is the only ink that works on
 * it. Probed on the rendered DOM, inside the authored card above:
 *
 *   signature-pad      pad div       bg-[var(--fr-sig-bg,var(--color-card))]  own fill
 *   media-annotator    tool buttons  bg-card                                  own fill
 *                      pin/box chips bg-card/90  (over the PHOTO)             own fill
 *                      Clear button  — no background —                        INHERITS ★
 *   floor-plan         plan canvas   bg-card (svg)                            own fill
 *                      summary bar   bg-card                                  own fill
 *   media-scrubber     play/seek     bg-[var(--fr-ms-accent,var(--color-foreground))]
 *   tournament-bracket root panel    bg-[color-mix(primary 4%, var(--color-card))]
 *
 * Exactly ONE element in the five files paints no surface and still declared
 * `text-foreground` — media-annotator's Clear button — and that is the only site
 * this file changed. Every other site is pinned below as a KEEP, with the
 * counterfactual measured: what the reader WOULD see if the blanket rename had
 * been applied to it. Those numbers (1.13–1.25:1) are the same failure the fix
 * exists to remove, pointing the other way.
 *
 * Two sites are left for a reason that is NOT "it paints its own fill", and they
 * are pinned as decisions rather than as measurements — see `text-muted-foreground
 * on an inherited surface` at the bottom of the file.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* ── the token table, read from the stylesheet that ships ──────────────────── */
/* (same idiom as inherited-foreground-actions-nav-marketing.test.tsx — a hard-coded hex here would stop
   measuring the moment frayme.css re-tunes a token, which it has done.) */

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '../src/styles/frayme.css'), 'utf8');
const srcOf = (f: string): string => readFileSync(join(HERE, '../src/react/registry/', f), 'utf8');

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

/* ── a resolver for the slice of CSS colour syntax these five files use ────── */

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

/** Non-premultiplied sRGB mix of two OPAQUE colours — what `color-mix(in srgb,
 *  A p%, B)` computes, and also what an alpha-`/90` fill composites to over the
 *  surface beneath it. */
const mix = (a: RGB, b: RGB, pa: number): RGB =>
  a.map((v, i) => Math.round(v * pa + b[i] * (1 - pa))) as RGB;

/** `var(--a,fallback)` · `color-mix(in srgb, A p%, B)` · `currentColor` · `#rgb`.
 *  `inherited` is what the element would inherit, which is exactly what CSS
 *  computes `currentColor` to on the `color` property. */
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
  if (e.startsWith('color-mix(')) {
    const args = splitTop(e.slice(10, -1));
    expect(args[0].trim(), 'only srgb mixes appear in these files').toBe('in srgb');
    const m = /^(.*)\s+([\d.]+)%$/.exec(args[1].trim());
    if (m == null) throw new Error(`unhandled color-mix arg: ${args[1]}`);
    return mix(
      resolveColor(m[1], inherited, vars),
      resolveColor(args[2], inherited, vars),
      parseFloat(m[2]) / 100,
    );
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

/* ── reading the ink and the SURFACE an element actually paints ────────────── */

const TEXT_TOKEN: Record<string, string> = {
  foreground: 'var(--color-foreground)',
  card: 'var(--color-card)',
  'card-foreground': 'var(--color-card-foreground)',
  'muted-foreground': 'var(--color-muted-foreground)',
  'primary-foreground': 'var(--color-primary-foreground)',
  inherit: 'inherit',
  current: 'currentColor',
};

const BG_TOKEN: Record<string, string> = {
  card: 'var(--color-card)',
  muted: 'var(--color-muted)',
  background: 'var(--frayme-bg)',
  foreground: 'var(--color-foreground)',
};

function inlineVars(el: Element): Record<string, string> {
  const st = (el as HTMLElement).style;
  const out: Record<string, string> = {};
  for (let i = 0; i < st.length; i += 1) {
    const n = st[i];
    if (n.startsWith('--')) out[n] = st.getPropertyValue(n).trim();
  }
  return out;
}

const varsFor = (el: Element): Record<string, string> => ({ ...VARS, ...inlineVars(el) });

/** `el.className` is an SVGAnimatedString on SVG nodes, and half these components paint
 *  inside an <svg>. Read the attribute instead. */
const classesOf = (el: Element): string[] => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** The RESTING colour expression this element sets, or null when it only
 *  inherits. Modifier-scoped classes (`hover:`/`focus-*`) are skipped: they are
 *  not the resting state the audit measures. */
function colorExprOf(el: Element): string | null {
  const found: string[] = [];
  for (const c of classesOf(el)) {
    let m = /^text-\[color:(.+)\]$/.exec(c) ?? /^\[color:(.+)\]$/.exec(c);
    if (m) {
      found.push(m[1]);
      continue;
    }
    m = /^text-([a-z-]+)$/.exec(c);
    if (m && TEXT_TOKEN[m[1]] != null) found.push(TEXT_TOKEN[m[1]]);
  }
  expect(found.length, `one resting colour source expected on "${classesOf(el).join(' ')}"`).toBeLessThan(2);
  return found[0] ?? null;
}

/** The resting FILL this element paints, as [expr, alpha], or null when it paints
 *  nothing and the surface beneath shows through. */
function bgExprOf(el: Element): [string, number] | null {
  const cls = classesOf(el);
  // Card sets BOTH `bg-card` (from the frame recipe) and `[background:var(
  // --fr-card-bg,…)]` (added only when the spec authored a `bg`). The arbitrary
  // property is precisely the override, so it wins here as it does in the sheet.
  const arb = cls.find((c) => /^\[background:/.test(c) || /^bg-\[/.test(c));
  if (arb != null) {
    const m = /^\[background:(.+)\]$/.exec(arb) ?? /^bg-\[(?:color:)?(.+)\]$/.exec(arb);
    if (m) return [m[1], 1];
  }
  for (const c of cls) {
    const m = /^bg-([a-z-]+)(?:\/(\d+))?$/.exec(c);
    if (m && BG_TOKEN[m[1]] != null) return [BG_TOKEN[m[1]], m[2] ? parseInt(m[2], 10) / 100 : 1];
    if (c === 'bg-transparent') return null;
  }
  const inline = (el as HTMLElement).style.backgroundColor;
  return inline ? [inline, 1] : null;
}

/** The colour a reader actually sees BEHIND `el`: the nearest painting ancestor,
 *  compositing any alpha fills on the way. This is the measurement that decides
 *  the whole file — an element over its own opaque fill must keep the token that
 *  fill is partnered with. */
function surfaceUnder(el: Element, pageBg: RGB): RGB {
  const chain: Array<[string, number, Element]> = [];
  for (let n: Element | null = el; n != null; n = n.parentElement) {
    const bg = bgExprOf(n);
    if (bg != null) {
      chain.push([bg[0], bg[1], n]);
      if (bg[1] >= 1) break;
    }
  }
  let out = pageBg;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const [expr, alpha, node] = chain[i];
    const c = resolveColor(expr, out, varsFor(node));
    out = alpha >= 1 ? c : mix(c, out, alpha);
  }
  return out;
}

function inkOf(el: Element, inherited: RGB): RGB {
  const expr = colorExprOf(el);
  if (expr == null) return inherited;
  return resolveColor(expr, inherited, varsFor(el));
}

/* ── the two surfaces every case is measured on ────────────────────────────── */

const CARD_BG = '#12161f';
const CARD_FG = '#e2e6f0';
const AUTHORED: RGB = hexToRgb(CARD_FG);
const PAGE_BG: RGB = resolveColor('var(--frayme-bg)', [255, 255, 255], VARS);
const ROOT_INK: RGB = resolveColor('var(--frayme-fg)', [0, 0, 0], VARS);
/** …which is the same value `--color-foreground` resolves to. That equality is
 *  what makes substituting currentColor byte-identical at the top level, so it is
 *  asserted rather than assumed. */
const TOKEN_FG: RGB = resolveColor('var(--color-foreground)', [0, 0, 0], VARS);

it('the safety argument itself: root ink === --color-foreground', () => {
  expect(ROOT_INK).toEqual(TOKEN_FG);
});

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

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

function cardInk(container: HTMLElement): RGB {
  const card = container.querySelector('section.fr-frame')!;
  expect(card, 'the authored Card').not.toBeNull();
  return inkOf(card, ROOT_INK);
}

type Case = {
  name: string;
  type: string;
  props: Record<string, unknown>;
  pick: (c: HTMLElement) => Element;
};

/** No fill of its own → it must INHERIT the authored ink. */
function itInherits(c: Case): void {
  it(`${c.name}: inherits the authored ink inside a dark card`, () => {
    const { container } = drawInCard(c.type, c.props);
    const inherited = cardInk(container);
    expect(inherited).toEqual(AUTHORED);
    const el = c.pick(container);
    // It may inherit BECAUSE nothing between it and the card paints a fill.
    expect(surfaceUnder(el, PAGE_BG), 'must sit on the authored surface').toEqual(hexToRgb(CARD_BG));
    const ink = inkOf(el, inherited);
    expect(ink, 'reset to the global token instead of inheriting').not.toEqual(TOKEN_FG);
    expect(ink).toEqual(AUTHORED);
    // …and the outcome the audit scores. The pre-fix ink measured 1.02:1.
    expect(contrast(ink, hexToRgb(CARD_BG))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKEN_FG, hexToRgb(CARD_BG))).toBeLessThan(1.1);
  });

  it(`${c.name}: unchanged on the page's own surface (byte-identical default)`, () => {
    const { container } = draw(c.type, c.props);
    expect(inkOf(c.pick(container), ROOT_INK)).toEqual(TOKEN_FG);
  });
}

/** Paints (or sits on) its OWN opaque fill → it must NOT inherit. Measures the
 *  ink against the real surface, and the counterfactual the blanket rename would
 *  have produced there. */
function itKeepsTheToken(c: Case & { expect?: RGB; floor?: number }): void {
  it(`${c.name}: keeps its token — an own fill sits under it`, () => {
    const { container } = drawInCard(c.type, c.props);
    const el = c.pick(container);
    const surface = surfaceUnder(el, PAGE_BG);
    const ink = inkOf(el, cardInk(container));
    if (c.expect) expect(ink).toEqual(c.expect);
    // The fill is NOT the authored one: Card's `bg` sets --fr-card-bg only.
    expect(surface, 'the element paints/sits on its own fill').not.toEqual(hexToRgb(CARD_BG));
    expect(contrast(ink, surface)).toBeGreaterThanOrEqual(c.floor ?? 4.5);
    // The counterfactual, measured in BOTH contexts the doctrine spans — because
    // which one breaks depends on which way the fill points. A light own fill
    // (bg-card) breaks inside the authored card: the card's light ink on white,
    // 1.25:1. A dark own slab (an accent defaulting to --color-foreground) breaks
    // at the TOP level instead: currentColor there IS --color-foreground, i.e. the
    // slab's own colour, 1.00:1. Either way the rename destroys the element, which
    // is what makes it a KEEP rather than an oversight.
    const worst = Math.min(contrast(AUTHORED, surface), contrast(ROOT_INK, surface));
    expect(worst, 'inheriting here would be a regression').toBeLessThan(3);
  });
}

/** The DEEPEST element whose whole text is `t` — a wrapper div and the span it
 *  holds share a textContent, and the wrapper is the one that inherits, so
 *  matching in document order would silently measure the wrong node. */
const byText = (t: string) => (c: HTMLElement): Element => {
  const hits = [...c.querySelectorAll('button,a,span,h2,div,td')].filter((e) => e.textContent === t);
  expect(hits.length, `no element reads exactly "${t}"`).toBeGreaterThan(0);
  return hits.reduce((deep, e) => (deep.contains(e) ? e : deep));
};
const byClass = (sel: string, cls: string) => (c: HTMLElement): Element => {
  const hit = [...c.querySelectorAll(sel)].find((e) => e.classList.contains(cls));
  expect(hit, `no ${sel} carries "${cls}"`).not.toBeUndefined();
  return hit!;
};

/* ══ media-annotator.tsx — the one change in this group ═════════════════════ */

const MA = {
  src: 'https://example.com/panel.jpg',
  editable: true,
  annotations: [
    { id: 'a', kind: 'pin', x: 0.3, y: 0.3, label: 'Crack' },
    { id: 'b', kind: 'box', x: 0.1, y: 0.1, w: 0.2, h: 0.2, label: 'Zone' },
  ],
};

describe('media-annotator — the border-only Clear button inherits', () => {
  itInherits({ name: 'Clear', type: 'MediaAnnotator', props: MA, pick: byText('Clear') });

  it('Clear declares text-current, not text-foreground', () => {
    const { container } = draw('MediaAnnotator', MA);
    const clear = byText('Clear')(container);
    expect(clear.classList.contains('text-current')).toBe(true);
    expect(clear.classList.contains('text-foreground')).toBe(false);
  });

  /* Everything else in this file paints a fill. The chips in particular are drawn
     over an arbitrary PHOTO: `bg-card/90` composited over the image frame, so the
     reader sees a near-card slab and a page colour could not stay legible there. */
  itKeepsTheToken({
    name: 'an inactive tool button (bg-card)',
    type: 'MediaAnnotator',
    props: MA,
    pick: byClass('button', 'bg-card'),
  });
  itKeepsTheToken({
    name: 'the pin label chip over the photo (bg-card/90)',
    type: 'MediaAnnotator',
    props: MA,
    pick: byClass('span', 'bg-card/90'),
  });
  itKeepsTheToken({
    name: 'the box hit-target chip over the photo (bg-card/90)',
    type: 'MediaAnnotator',
    props: MA,
    pick: byClass('button', 'bg-card/90'),
  });
  itKeepsTheToken({
    name: 'the ACTIVE tool button (its own accent slab)',
    type: 'MediaAnnotator',
    props: MA,
    pick: byClass('button', 'bg-[color:var(--fr-ma-accent,var(--fr-accent))]'),
    expect: resolveColor('var(--color-card)', [0, 0, 0], VARS),
  });

  it('the edit popover paints bg-card AND declares its own ink, so Cancel may inherit it', () => {
    // Left as text-foreground deliberately: the popover sets text-foreground on
    // itself, so `text-current` on the button computes to the SAME value. There
    // is no measurable difference, and churn in a leave-file is what a sibling
    // file's guard was written to catch.
    const src = srcOf('media-annotator.tsx');
    expect(src).toContain('bg-card p-3 text-foreground shadow-lg');
    expect(src).toContain('px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]');
  });
});

/* ══ tournament-bracket.tsx — a self-contained panel: 0 changes ════════════ */

const TB = {
  title: 'Cup',
  groups: [{ name: 'Group A', teams: [{ name: 'Ajax', points: 9 }] }],
  rounds: [{ matches: [{ id: 'm1', a: 'Ajax', b: 'PSV', scoreA: 2, scoreB: 1, winner: 'a' }] }],
};

describe('tournament-bracket — every label sits on a fill the component painted', () => {
  it('the root paints an OPAQUE own panel, so nothing below it may inherit', () => {
    const { container } = drawInCard('TournamentBracket', TB);
    const root = byClass('div', 'bg-[color-mix(in_srgb,var(--fr-tb-accent,var(--color-primary))_4%,var(--color-card))]')(container);
    expect(root, 'the bracket panel').not.toBeUndefined();
    // 4% of primary over --color-card: still a near-white slab inside a dark card.
    expect(contrast(surfaceUnder(root, PAGE_BG), hexToRgb(CARD_BG))).toBeGreaterThan(10);
  });

  itKeepsTheToken({ name: 'the h2 title', type: 'TournamentBracket', props: TB, pick: byText('Cup') });
  itKeepsTheToken({ name: 'a standings team name', type: 'TournamentBracket', props: TB, pick: byText('Ajax') });
  itKeepsTheToken({ name: 'the group header name', type: 'TournamentBracket', props: TB, pick: byText('Group A') });
  itKeepsTheToken({
    name: 'the resting view tab (bg-card)',
    type: 'TournamentBracket',
    props: TB,
    pick: byText('Knockout'),
  });
  itKeepsTheToken({
    name: 'the selected view tab (its own accent slab)',
    type: 'TournamentBracket',
    props: TB,
    pick: byText('Groups'),
    expect: resolveColor('var(--color-card)', [0, 0, 0], VARS),
  });
});

/* ══ floor-plan.tsx — a bg-card canvas and a bg-card summary bar: 0 changes ═ */

const FP = {
  regions: [
    { id: 'r1', kind: 'rect', label: 'A1', status: 'available', price: 20, x: 0.1, y: 0.1, w: 0.3, h: 0.3 },
    { id: 'r2', kind: 'rect', label: 'A2', status: 'sold', x: 0.5, y: 0.1, w: 0.3, h: 0.3 },
  ],
  selectedIds: ['r1'],
  stage: { label: 'STAGE', edge: 'top', shape: 'bar' },
};

describe('floor-plan — the summary bar paints bg-card but declares NO ink', () => {
  /* This is the sharpest leave-case in the file. The bar is `bg-card` and sets no
     colour of its own, so `text-current` on its children would climb PAST it to
     the authored card and print light ink on a white slab. The explicit tokens
     are load-bearing, not redundant. */
  itKeepsTheToken({ name: 'the selected-count', type: 'FloorPlan', props: FP, pick: byText('1') });
  itKeepsTheToken({ name: 'the Clear button', type: 'FloorPlan', props: FP, pick: byText('Clear') });
  itKeepsTheToken({
    name: 'the Confirm button (its own accent slab)',
    type: 'FloorPlan',
    props: FP,
    pick: byText('Confirm'),
    expect: resolveColor('var(--color-primary-foreground)', [0, 0, 0], VARS),
  });

  it('the summary bar itself declares no ink — which is WHY its children must not inherit', () => {
    const { container } = drawInCard('FloorPlan', FP);
    const bar = byText('Clear')(container).parentElement!.parentElement!;
    expect(bgExprOf(bar)).toEqual(['var(--color-card)', 1]);
    expect(colorExprOf(bar), 'no ink of its own').toBeNull();
  });

  it('the SVG plan is a bg-card canvas: the stage band and its label stay token-paired', () => {
    const { container } = drawInCard('FloorPlan', FP);
    const svg = container.querySelector('svg')!;
    const canvas = surfaceUnder(svg, PAGE_BG);
    expect(canvas).toEqual(resolveColor('var(--color-card)', [0, 0, 0], VARS));
    // The band is --color-foreground and prints --color-card on itself. Under the
    // rename the band would become the card's LIGHT ink on the light canvas.
    const band = [...container.querySelectorAll('rect')].find((r) => r.style.fill)!;
    const bandFill = resolveColor(band.style.fill, AUTHORED, VARS);
    expect(bandFill).toEqual(TOKEN_FG);
    expect(contrast(bandFill, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(AUTHORED, canvas), 'a currentColor band would vanish').toBeLessThan(1.5);
    const label = [...container.querySelectorAll('text')].find((t) => t.textContent === 'STAGE')!;
    expect(contrast(resolveColor(label.style.fill, AUTHORED, VARS), bandFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('a seat label is drawn INSIDE its own polygon fill, not on the page', () => {
    const { container } = drawInCard('FloorPlan', FP);
    const sold = [...container.querySelectorAll('text')].find((t) => t.textContent === 'A2')!;
    const ink = resolveColor(sold.style.fill, AUTHORED, VARS);
    expect(ink).toEqual(resolveColor('var(--color-muted-foreground)', [0, 0, 0], VARS));
    // Its surface is the muted polygon over the bg-card canvas, never the card.
    expect(contrast(ink, resolveColor('var(--color-card)', [0, 0, 0], VARS))).toBeGreaterThanOrEqual(4.5);
  });
});

/* ══ media-scrubber.tsx — two accent slabs: 0 changes ══════════════════════ */

const MS = { duration: 120, currentTime: 30, showSubmit: true, chapters: [{ id: 'c1', time: 30, label: 'Intro' }] };

describe('media-scrubber — both --color-foreground sites are SLAB FILLS, not ink', () => {
  itKeepsTheToken({
    name: 'the play button label',
    type: 'MediaScrubber',
    props: MS,
    pick: byClass('button', 'bg-[color:var(--fr-ms-accent,var(--color-foreground))]'),
    expect: resolveColor('var(--color-card)', [0, 0, 0], VARS),
  });
  itKeepsTheToken({
    name: 'the Seek button label',
    type: 'MediaScrubber',
    props: MS,
    pick: byText('Seek'),
    expect: resolveColor('var(--color-card)', [0, 0, 0], VARS),
  });

  it('the accent fills stay --color-foreground: a currentColor slab would erase its own label', () => {
    const { container } = drawInCard('MediaScrubber', MS);
    const slab = byText('Seek')(container);
    const fill = surfaceUnder(slab, PAGE_BG);
    expect(fill).toEqual(TOKEN_FG);
    const label = resolveColor('var(--color-card)', [0, 0, 0], VARS);
    expect(contrast(label, fill)).toBeGreaterThanOrEqual(4.5);
    // Renaming the FILL to currentColor: card-white text on the card's light ink.
    expect(contrast(label, AUTHORED)).toBeLessThan(1.5);
  });
});

/* ══ signature-pad.tsx — the pen is paired with the PAD, not the page ══════ */

describe('signature-pad — the pad paints its own surface, so the ink stays token-paired', () => {
  itKeepsTheToken({
    name: 'the Submit slab label',
    type: 'SignaturePad',
    props: {},
    pick: byText('Submit'),
    expect: resolveColor('var(--color-card)', [0, 0, 0], VARS),
  });

  it('the placeholder sits on the pad, not on the container', () => {
    const { container } = drawInCard('SignaturePad', { placeholder: 'Sign here' });
    const hint = byText('Sign here')(container);
    expect(surfaceUnder(hint, PAGE_BG)).toEqual(resolveColor('var(--color-card)', [0, 0, 0], VARS));
  });

  /* The strokes only exist after a pointer capture, which jsdom cannot produce
     (usePointerStrokes bails on a 0-width getBoundingClientRect), so the pen is
     pinned at the source. It is `--fr-sig-pen` over `--fr-sig-bg`: both default
     to global tokens that track each other per theme (#18181b on #ffffff light,
     #fafafa on #1c1c20 dark). currentColor would break that pairing — inside the
     authored card the pen would be #e2e6f0 on the white pad, 1.25:1. */
  it('the pen chain still ends at --color-foreground, paired with the pad fill', () => {
    const src = srcOf('signature-pad.tsx');
    expect(src).toContain('fill-[color:var(--fr-sig-pen,var(--color-foreground))]');
    expect(src).toContain('stroke-[color:var(--fr-sig-pen,var(--color-foreground))]');
    expect(src).toContain('bg-[color:var(--fr-sig-bg,var(--color-card))]');
    const pad = resolveColor('var(--color-card)', [0, 0, 0], VARS);
    expect(contrast(TOKEN_FG, pad)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(AUTHORED, pad), 'a currentColor pen on the white pad').toBeLessThan(1.5);
  });
});

/* ══ the two sites the muted axis has now reached ══════════════════════════ */

describe('text-muted-foreground on an inherited surface — taken by the channel', () => {
  /* This block used to pin these two as DELIBERATELY unfixed, and left an
     instruction: "if a later change takes the muted axis on purpose, it updates this
     test with its own measurement." The surface channel is that change, so this is
     that update.

     The earlier refusal was never about the failure being acceptable — it was
     measured at 2.34:1 and recorded as real. It was about the only fix available
     then: a LOCAL mix away from the token, which cleared the floor only by making
     one string a different grey from every other muted string in the system.

     --fr-surface-muted is not that. It is one channel, derived from whatever
     surface an element actually sits on (color-mix(<paired ink> 62%, <bg>)), and
     published by every container that paints. Every muted string moves together,
     which is exactly the systemic answer the refusal was holding out for. The
     token remains the final step, so a page that authors no surface is unchanged. */
  it('both now read the muted channel, with the token still the last step', () => {
    expect(srcOf('signature-pad.tsx')).toContain('text-sm font-medium text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]');
    expect(srcOf('media-scrubber.tsx')).toContain('font-mono text-xs tabular-nums text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]');
  });

  it('the channel clears the floor on the authored surface the token failed on', () => {
    const bg = hexToRgb(CARD_BG);
    // unstyled: nothing published, the chain resolves to the token — unchanged
    const token = resolveColor('var(--color-muted-foreground)', [0, 0, 0], VARS);
    expect(contrast(token, bg), 'the failure this replaces').toBeLessThan(4.5);
    // authored: color-mix(in srgb, <paired ink> 62%, <bg>) — computed here because
    // jsdom cannot resolve color-mix, so the measurement is arithmetic, not a read
    const ink = hexToRgb('#fafafa');            // surfaceInk(#12161f), L <= 0.179
    const mixed: RGB = [0, 1, 2].map((i) => Math.round(0.62 * ink[i] + 0.38 * bg[i])) as RGB;
    expect(contrast(mixed, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
