/**
 * DARK-MODE BUTTON SURFACES — actions.tsx.
 *
 * The defect: a <button> that declares no background does not paint nothing. It
 * paints the UA's `buttonface`, and that keyword resolves from `color-scheme`,
 * not from frayme.css. `.frayme-root` sets `color-scheme: dark` in dark mode, so
 * the UA hands back a mid grey that belongs to no palette here.
 *
 * Measured in headless Chromium (chrome-headless-shell 1228) over the COMPILED
 * utilities, `.frayme-dark` on the root, every variant x tone x surface of Button
 * rendered through FraymeRenderer — walking each label up to the surface actually
 * painted under it:
 *
 *   variant:danger            #f87171 on #6b6b6b   1.93:1   <- UA buttonface
 *   variant:danger tone:crit  #f87171 on #6b6b6b   1.93:1   <- UA buttonface
 *   tone:critical             #f87171 on #fafafa   2.65:1   <- primary's slab
 *
 * and in LIGHT mode the same three read 4.20 / 4.20 / 3.67 on #efefef and
 * #18181b. `danger` was the loud one: its comment promises "no resting fill, a
 * HAIRLINE red border", and it was a grey slab in both modes — the SAME button
 * measured 6.70:1 while HOVERED, because `hover:[background:…]` is the first rule
 * in the recipe that declares a background at all and so evicts the UA fill. A
 * control more legible hovered than at rest is the signature of a surface nobody
 * declared.
 *
 * WHY THIS FILE MODELS THE UA. jsdom computes no cascade, so this resolves each
 * button's SURVIVING classes (tailwind-merge has already run) through the real
 * var chains in frayme.css, per mode, and composites them exactly as a browser
 * does — including the case the fix is about: when nothing declares a background,
 * the surface is `buttonface`, whose two measured values are pinned in UA_BUTTON_FACE
 * below. Asserting only "some bg-* class is present" would have missed
 * `tone:critical`, which had a background (primary's) and still failed.
 *
 * The floors are WCAG: 4.5:1, or 3:1 at >=24px / >=18.66px bold. No Button label
 * reaches either large-text threshold (md bakes 0.875rem), so 4.5 applies
 * throughout — asserted rather than assumed, in `every label is small text`.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* ── the token tables, read from the stylesheet that ships ─────────────────── */
/* (same idiom as inherited-foreground-actions-nav-marketing.test.tsx / theme-tokens.test.ts — a
   hard-coded hex here would stop measuring the moment frayme.css re-tunes a
   token, which it has done.) */

const HERE = dirname(fileURLToPath(import.meta.url));
/* Comments are stripped first: theme-tokens.test.ts documents why — every
   declaration regex is `[^;]+`, and a comment citing "4.5:1" has no semicolon to
   stop at, so the match runs straight through it and swallows the real value. */
const css = readFileSync(join(HERE, '../src/styles/frayme.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

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
  Object.fromEntries(
    [...blk.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );

/** `.frayme-root` carries BOTH halves of the chain: --color-* re-pointed at
 *  --frayme-*, and the --frayme-* LIGHT values. */
const LIGHT = declsIn(cssBlock(/^\.frayme-root\s*\{/m));
/** The forced-dark block restates only the --frayme-* values; the --color-*
 *  indirection above still applies, which is the whole point of the two-layer
 *  token design. Matched on the CLASS selector this file's fixtures use. */
const DARK = { ...LIGHT, ...declsIn(cssBlock(/\.frayme-root\.frayme-dark[^{]*\{/)) };

/**
 * `buttonface` under each `color-scheme`, as Chromium actually paints it —
 * measured, not looked up: a <button> with every author background removed,
 * inside `.frayme-root` (which sets `color-scheme: dark` in the dark block).
 * These are the two values the fix exists to keep off the screen; they are
 * deliberately NOT frayme tokens, because that is exactly the complaint.
 */
const UA_BUTTON_FACE = { light: '#efefef', dark: '#6b6b6b' } as const;

/* ── colour resolution ─────────────────────────────────────────────────────── */

type RGBA = { r: number; g: number; b: number; a: number };

const hexToRgba = (h: string): RGBA => {
  const s = h.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  return { r, g, b, a: 1 };
};
const fmt = (c: RGBA): string =>
  '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Split on top-level commas (var()/color-mix() nest, so depth matters). */
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

/**
 * `#rrggbb` · `var(--x, fb)` · `transparent` · `currentColor`/`inherit` ·
 * `color-mix(in srgb, C P%, transparent)`.
 *
 * The color-mix arm is premultiplied, which is what CSS Color 5 specifies and
 * what Chromium does: mixing C at P% with `transparent` (rgba(0,0,0,0)) leaves
 * C's channels intact and takes alpha to P/100 — NOT a P% blend toward black.
 * Verified against the browser: the 12% success tone over #131316 composites to
 * #15281f in both this resolver and Chromium.
 */
function resolveColor(expr: string, vars: Record<string, string>, inherited: RGBA): RGBA {
  const e = expr.replace(/_/g, ' ').trim(); // tailwind arbitrary values encode spaces as _
  if (/^transparent$/i.test(e)) return { r: 0, g: 0, b: 0, a: 0 };
  if (/^(currentcolor|inherit)$/i.test(e)) return inherited;
  if (e.startsWith('#')) return hexToRgba(e);
  if (e.startsWith('var(')) {
    const args = splitTop(e.slice(4, -1));
    const v = vars[args[0]];
    if (v != null) return resolveColor(v, vars, inherited);
    if (args.length > 1) return resolveColor(args.slice(1).join(','), vars, inherited);
    throw new Error(`unset var with no fallback: ${args[0]}`);
  }
  if (e.startsWith('color-mix(')) {
    const args = splitTop(e.slice(10, -1));
    expect(args[0].replace(/\s+/g, ' ')).toBe('in srgb');
    const [c1, p1] = /^(.*?)\s+([\d.]+)%$/.exec(args[1])?.slice(1) ?? [args[1], '50'];
    const base = resolveColor(c1, vars, inherited);
    const other = resolveColor(args[2].replace(/\s+[\d.]+%$/, ''), vars, inherited);
    expect(other.a, `only mixes toward transparent are modelled: ${e}`).toBe(0);
    return { ...base, a: base.a * (Number(p1) / 100) };
  }
  throw new Error(`unhandled colour expression: ${e}`);
}

/** src over dst. */
const over = (src: RGBA, dst: RGBA): RGBA => ({
  r: src.r * src.a + dst.r * (1 - src.a),
  g: src.g * src.a + dst.g * (1 - src.a),
  b: src.b * src.a + dst.b * (1 - src.a),
  a: 1,
});

/* ── WCAG 2.1 relative luminance + contrast ────────────────────────────────── */

const luminance = ({ r, g, b }: RGBA): number => {
  const f = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: RGBA, b: RGBA): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* ── reading what a rendered button paints ─────────────────────────────────── */

const BG_TOKEN: Record<string, string> = {
  transparent: 'transparent',
  foreground: 'var(--color-foreground)',
  card: 'var(--color-card)',
  muted: 'var(--color-muted)',
};
const TEXT_TOKEN: Record<string, string> = {
  foreground: 'var(--color-foreground)',
  card: 'var(--color-card)',
  'card-foreground': 'var(--color-card-foreground)',
  'muted-foreground': 'var(--color-muted-foreground)',
  'primary-foreground': 'var(--color-primary-foreground)',
  inherit: 'inherit',
  current: 'currentColor',
};

/** Modifier-scoped classes are not the RESTING state this file scores. */
const isResting = (c: string): boolean => !/^(hover|focus|active|disabled|aria-|group-)/.test(c);

/**
 * What this element paints: a background COLOUR (or none declared) and, on top
 * of it, any background IMAGE.
 *
 * tailwind-merge collapses `bg-*` against `bg-*`, but an arbitrary
 * `[background:…]` is a different group, so both can survive — a tone tint rides
 * alongside `variant:primary`'s `bg-foreground`. They do not stack: `background`
 * is a SHORTHAND, so it RESETS background-color rather than compositing over it,
 * and being emitted later it wins. Getting this wrong is not academic — modelling
 * it as a stack put the 12% success tint on top of dark mode's #fafafa and
 * reported a LIGHT #e0f4e7 surface, where Chromium paints #15281f. The browser
 * settled it: `tone:success` in dark computes to color(srgb … / 0.12) over the
 * page, luminance 0.018.
 *
 * `background-image` IS a separate property and does layer on top.
 */
function backgroundPaint(el: Element): { colour: string | null; image: string | null } {
  const classes = el.className.split(/\s+/).filter(Boolean).filter(isResting);
  let token: string | null = null;
  let shorthand: string | null = null;
  let image: string | null = null;
  let tokenCount = 0;
  for (const c of classes) {
    let m = /^\[background:(.+)\]$/.exec(c) ?? /^bg-\[color:(.+)\]$/.exec(c);
    if (m) {
      shorthand = m[1];
      continue;
    }
    m = /^\[background-image:linear-gradient\((.+)\)\]$/.exec(c);
    if (m) {
      // the first colour stop — these recipes are flat two-stop fills
      image = splitTop(m[1]).slice(1)[0];
      continue;
    }
    m = /^bg-([a-z-]+)$/.exec(c);
    if (m && BG_TOKEN[m[1]] != null) {
      token = BG_TOKEN[m[1]];
      tokenCount += 1;
    }
  }
  expect(tokenCount, `tailwind-merge should leave one bg-* on "${el.className}"`).toBeLessThan(2);
  return { colour: shorthand ?? token, image };
}

/** The resting colour expression this element sets, or null when it inherits. */
function colorExpr(el: Element): string | null {
  const found: string[] = [];
  for (const c of el.className.split(/\s+/).filter(Boolean).filter(isResting)) {
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

type Mode = 'light' | 'dark';
type Painted = { surface: RGBA; ink: RGBA; ratio: number; declared: boolean };

/** What a reader sees: the button's surface over the page, and its label on it. */
function paint(btn: Element, mode: Mode): Painted {
  const vars = mode === 'dark' ? DARK : LIGHT;
  const page = resolveColor('var(--frayme-bg)', vars, { r: 0, g: 0, b: 0, a: 1 });
  const inherited = resolveColor('var(--frayme-fg)', vars, { r: 0, g: 0, b: 0, a: 1 });

  const { colour, image } = backgroundPaint(btn);
  // NOTHING declared → the UA paints `buttonface`. This is the branch the fix is
  // about, and it is the reason this file models the UA at all.
  let surface =
    colour == null ? hexToRgba(UA_BUTTON_FACE[mode]) : over(resolveColor(colour, vars, inherited), page);
  if (image != null) surface = over(resolveColor(image, vars, inherited), surface);

  const expr = colorExpr(btn);
  const ink = expr == null ? inherited : resolveColor(expr, vars, inherited);
  return { surface, ink, ratio: contrast(over(ink, surface), surface), declared: colour != null };
}

/* ── the matrix ────────────────────────────────────────────────────────────── */

const VARIANTS = ['primary', 'secondary', 'danger', 'ghost', 'outline'] as const;
const TONES = ['neutral', 'success', 'warning', 'critical', 'info'] as const;
const SURFACES = ['solid', 'gradient', 'soft'] as const;

const cases: { name: string; props: Record<string, unknown> }[] = [];
for (const v of VARIANTS) {
  cases.push({ name: `variant:${v}`, props: { label: 'Delete', variant: v } });
  for (const t of TONES)
    cases.push({ name: `variant:${v} tone:${t}`, props: { label: 'Delete', variant: v, tone: t } });
  for (const s of SURFACES)
    cases.push({ name: `variant:${v} surface:${s}`, props: { label: 'Delete', variant: v, surface: s } });
}
for (const t of TONES) cases.push({ name: `tone:${t}`, props: { label: 'Delete', tone: t } });
cases.push({ name: 'props-less', props: { label: 'Save' } });

function draw(props: Record<string, unknown>): Element {
  const spec = {
    root: 'el',
    elements: { el: { type: 'Button', props } },
    state: {},
  } as unknown as Spec;
  const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
  return container.querySelector('button')!;
}

/**
 * KNOWN LIGHT-MODE DEBT — the semantic tone TINTS and `surface:soft`, which mix
 * their own colour at 12%/14% over white and land just under the floor. Measured,
 * not assumed, with the same resolver, and NOT this file's to fix: they fail
 * identically before and after this change (the tint classes are untouched), they
 * fail in LIGHT mode where nothing here applies, and the token values they mix
 * are frayme.css's. frayme.css's own comment claims "its own tints at 4.57-4.79"
 * — measured here at 4.25-4.37, so that note is optimistic by ~0.3 and the tokens
 * want re-deriving against the tint, not against plain white.
 *
 * This is a RATCHET: each entry may not get worse, and the SET may not grow.
 */
const LIGHT_TINT_DEBT: Record<string, number> = {
  'tone:success': 4.27,
  'tone:warning': 4.26,
  'tone:info': 4.37,
  'surface:soft': 4.25,
};
/** Which debt entry, if any, a case falls under. */
function debtKey(name: string): string | null {
  for (const k of Object.keys(LIGHT_TINT_DEBT)) if (name.endsWith(k)) return k;
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════ */

describe('Button surfaces — dark mode', () => {
  it('no variant/tone/surface falls through to the UA buttonface', () => {
    const undeclared = cases.filter((c) => !paint(draw(c.props), 'dark').declared).map((c) => c.name);
    // Pre-fix this was ['variant:danger', 'variant:danger tone:critical'], each
    // painting #6b6b6b at 1.93:1 — a surface no rule in this repo asked for.
    expect(undeclared, 'a <button> with no declared background paints `buttonface`').toEqual([]);
  });

  it.each(cases)('$name clears 4.5:1 on the surface it paints', ({ name, props }) => {
    const p = paint(draw(props), 'dark');
    expect(
      p.ratio,
      `${name}: ${fmt(p.ink)} on ${fmt(p.surface)} (surface luminance ${luminance(p.surface).toFixed(4)})`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('every label is small text, so 4.5 is the right floor', () => {
    // The 3:1 relaxation needs >=24px, or >=18.66px bold. `size` tops out at lg
    // (1.125rem = 18px) and the base weight is font-medium (500), so no Button
    // label reaches either — asserted so a future size bump cannot silently
    // relax the floor this file applies.
    for (const size of ['sm', 'md', 'lg'] as const) {
      const btn = draw({ label: 'Delete', size });
      const fs = /\[font-size:var\(--fr-btn-fs,([\d.]+)rem\)\]/.exec(btn.className)?.[1];
      expect(Number(fs) * 16, `size:${size} font-size`).toBeLessThan(18.66);
    }
  });

  it('the danger button paints no fill of its own, as its recipe promises', () => {
    // The specific regression: `danger` says "no resting fill" and must SAY so,
    // not merely omit it. Omission is what handed it #6b6b6b.
    const p = paint(draw({ label: 'Delete', variant: 'danger' }), 'dark');
    expect(p.declared).toBe(true);
    expect(fmt(p.surface)).toBe(fmt(resolveColor('var(--frayme-bg)', DARK, p.ink)));
    expect(p.ratio).toBeGreaterThan(6.5); // measured 6.70 in Chromium
  });

  it('the critical TONE wins the surface, not just the label', () => {
    // `Button {tone:"critical"}` is variant `primary` by default, so before the
    // fix the red label sat on primary's bg-foreground slab: 2.65:1.
    const p = paint(draw({ label: 'Delete', tone: 'critical' }), 'dark');
    expect(fmt(p.surface)).not.toBe(fmt(resolveColor('var(--color-foreground)', DARK, p.ink)));
    expect(p.ratio).toBeGreaterThan(6.5);
  });
});

describe('Button surfaces — light mode is not collateral', () => {
  it.each(cases)('$name still clears 4.5:1 in light', ({ name, props }) => {
    const p = paint(draw(props), 'light');
    const key = debtKey(name);
    if (key != null) {
      // ratchet: pre-existing tint debt may not deepen, and see the note above.
      expect(p.ratio, `${name} (known light-tint debt)`).toBeGreaterThanOrEqual(
        LIGHT_TINT_DEBT[key] - 0.01,
      );
      return;
    }
    expect(p.ratio, `${name}: ${fmt(p.ink)} on ${fmt(p.surface)}`).toBeGreaterThanOrEqual(4.5);
  });

  it('the known light debt set does not grow', () => {
    const failing = cases
      .filter((c) => paint(draw(c.props), 'light').ratio < 4.5)
      .map((c) => debtKey(c.name))
      .filter((k): k is string => k != null);
    // every light failure must already be a known-debt entry (the .each above
    // fails otherwise); this pins the CONVERSE — the set may not acquire a member.
    expect(new Set(failing)).toEqual(new Set(Object.keys(LIGHT_TINT_DEBT)));
  });

  it('the variants that paint their own fill are untouched by this change', () => {
    // Nothing in the fix may repaint a button that was already declaring a
    // surface — `bg-transparent` in the base is dedupe-fodder for every one of
    // these, and that is asserted, not hoped.
    const expected: [Record<string, unknown>, string][] = [
      [{ label: 'S' }, 'var(--color-foreground)'],
      [{ label: 'S', variant: 'secondary' }, 'var(--color-muted)'],
      [{ label: 'S', tone: 'neutral' }, 'var(--color-muted)'],
      [{ label: 'S', variant: 'ghost' }, 'var(--frayme-bg)'],
      [{ label: 'S', variant: 'outline' }, 'var(--frayme-bg)'],
    ];
    for (const mode of ['light', 'dark'] as const) {
      const vars = mode === 'dark' ? DARK : LIGHT;
      for (const [props, expr] of expected) {
        const p = paint(draw(props), mode);
        expect(fmt(p.surface), `${JSON.stringify(props)} in ${mode}`).toBe(
          fmt(resolveColor(expr, vars, p.ink)),
        );
      }
    }
  });
});
