/**
 * board-nav a11y guards — badge contrast + interactive target size.
 *
 * Board labels were the largest low-contrast shape in generated specs after plain body
 * text (the `max-w-full truncate rounded-full px-2 py-0.5 …` pill).
 * The cause was structural, not a bad hex: a tone token is picked to clear 4.5:1 on
 * the PLAIN surface, and then its own 15% wash is placed behind it, which darkens
 * that surface and costs ~0.9. Every tone failed in LIGHT mode (3.82-4.19) while
 * dark passed (4.90-6.01) — which is how it survived review.
 *
 * So this file does not pin class strings for the contrast half. It RESOLVES what
 * the component actually rendered — the fill expression and the ink expression —
 * against the real palette read out of frayme.css, composites, and measures. That
 * is the only form of the assertion that fails for the right reason: a future
 * palette edit or a re-tinted chip is caught, and a cosmetic class rename is not.
 *
 * Because it measures rather than pins, it also covers the chips this fix did NOT
 * change: `tone:neutral` failed at 4.40:1 too, but the cause was the
 * muted-foreground/muted TOKEN pair, which was corrected in the stylesheet. The
 * neutral case is kept here so that if the palette ever regresses, the board says so.
 *
 * The target-size half IS a class assertion: jsdom computes no layout, so the
 * rendered height of a `p-0` button around a 20px row is not observable here. The
 * measurement that motivated it is recorded in board-nav.tsx beside each fix.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

/* ── The palette, read from the stylesheet rather than restated ─────────────── */
// Same fileURLToPath(dirname(...)) shape theme-tokens.test.ts uses — the monorepo
// ships no @types/node, so `__dirname` is a type error even though vitest runs it.
const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '../src/styles/frayme.css'), 'utf8');

function block(startPattern: RegExp): string {
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
const decls = (blk: string): Map<string, string> =>
  new Map([...blk.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const theme = decls(block(/^@theme\s*\{/m));
const lightRoot = decls(block(/^\.frayme-root\s*\{/m));
const darkMedia = decls(block(/@media \(prefers-color-scheme: dark\)/));

type RGB = [number, number, number];
type Mode = 'light' | 'dark';

/** Resolve a custom property to a hex, following the ONE alias hop frayme.css
 *  uses (`--color-success: var(--frayme-success)`). Unaliased --color-* tokens
 *  fall through to their @theme default — which is exactly how they behave in the
 *  browser, and exactly why a dark-mode `text-success-foreground` would be white. */
function resolveVar(name: string, mode: Mode): string {
  const seen = new Set<string>();
  let cur = name;
  for (;;) {
    if (seen.has(cur)) throw new Error(`var cycle at ${cur}`);
    seen.add(cur);
    const raw =
      (mode === 'dark' ? darkMedia.get(cur) : undefined) ?? lightRoot.get(cur) ?? theme.get(cur);
    if (raw == null) throw new Error(`unresolved var ${cur} (${mode})`);
    if (raw.startsWith('#')) return raw;
    const alias = raw.match(/^var\((--[a-z-]+)\)$/);
    if (alias == null) throw new Error(`unexpected value for ${cur}: ${raw}`);
    cur = alias[1];
  }
}

const hex = (h: string): RGB => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
};

/** A colour plus the alpha it will be composited with. */
type Paint = { rgb: RGB; alpha: number };

/** Split on top-level commas — `var(a, var(b, c))` and `color-mix(…)` both nest. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') depth -= 1;
    else if (s[i] === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim());
}

/** Evaluate the colour expressions board-nav actually emits: a hex, jsdom's
 *  normalised `rgb(…)`, a var chain WITH fallbacks (the `--fr-*` component
 *  channels are unset by default, so the chain must fall through to the token the
 *  way the cascade does), and the two `color-mix(in srgb, …)` forms — a wash
 *  against `transparent`, and a two-colour ink blend. Class strings carry `_`
 *  where CSS has a space. */
function paint(expr: string, mode: Mode): Paint {
  const e = expr.replace(/_/g, ' ').trim();
  const mix = e.match(/^color-mix\(in srgb,(.+)\)$/);
  if (mix != null) {
    const [first, second] = splitArgs(mix[1]);
    const pct = first.match(/^(.*?)\s+(\d+)%$/);
    if (pct == null) throw new Error(`color-mix without a percentage: ${e}`);
    const a = paint(pct[1], mode);
    const p = Number(pct[2]) / 100;
    if (second === 'transparent') return { rgb: a.rgb, alpha: a.alpha * p };
    const b = paint(second, mode);
    return { rgb: a.rgb.map((v, i) => p * v + (1 - p) * b.rgb[i]) as RGB, alpha: 1 };
  }
  const v = e.match(/^var\((.+)\)$/);
  if (v != null) {
    const [name, ...rest] = splitArgs(v[1]);
    const known = darkMedia.has(name) || lightRoot.has(name) || theme.has(name);
    // An unset --fr-* channel is exactly the default render: take the fallback.
    if (!known) {
      if (rest.length === 0) throw new Error(`unresolved var with no fallback: ${name}`);
      return paint(rest.join(','), mode);
    }
    return { rgb: hex(resolveVar(name, mode)), alpha: 1 };
  }
  if (e.startsWith('#')) return { rgb: hex(e), alpha: 1 };
  // jsdom rewrites an inline hex to rgb(r, g, b) when it round-trips the style attr.
  const rgb = e.match(/^rgba?\(([^)]+)\)$/);
  if (rgb != null) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { rgb: [parts[0], parts[1], parts[2]] as RGB, alpha: parts[3] ?? 1 };
  }
  throw new Error(`cannot evaluate colour expression: ${e}`);
}

/** jsdom's normalisation of an inline hex, for asserting the value round-tripped. */
const asRgbCss = (h: string): string => {
  const [r, g, b] = hex(h);
  return `rgb(${r}, ${g}, ${b})`;
};

const over = (fg: Paint, bg: RGB): RGB => fg.rgb.map((v, i) => fg.alpha * v + (1 - fg.alpha) * bg[i]) as RGB;

/** WCAG 2.1 relative luminance + contrast ratio (same formula as theme-tokens). */
const luminance = (rgb: RGB): number => {
  const ch = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const ratio = (a: RGB, b: RGB): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* ── Reading the fill + ink back off a rendered node ────────────────────────── */

/** `bg-[expr]` / `bg-token` / `bg-token/NN`. The alpha suffix matters: without it
 *  a tinted fill would be measured as an opaque one and the check would pass or
 *  fail for the wrong reason. */
function fillOf(el: Element): string | null {
  const cls = el.className;
  const arb = cls.match(/(?:^|\s)bg-\[([^\]]+)\]/);
  if (arb != null) return arb[1];
  const tok = cls.match(/(?:^|\s)bg-([a-z-]+)(?:\/(\d+))?(?=\s|$)/);
  if (tok == null) return null;
  const c = `var(--color-${tok[1]})`;
  return tok[2] == null ? c : `color-mix(in srgb, ${c} ${tok[2]}%, transparent)`;
}

/** `text-[color:expr]` / `text-token`. `text-[0.6875rem]` is a font size and must
 *  not be read as a colour — hence the required `color:` hint, which is also why
 *  the source writes it that way (tailwind-merge needs it to keep the groups apart). */
function inkOf(el: Element): string | null {
  const cls = el.className;
  const arb = cls.match(/(?:^|\s)text-\[color:([^\]]+)\]/);
  if (arb != null) return arb[1];
  const tok = cls.match(/(?:^|\s)text-([a-z-]+)(?:\/(\d+))?(?=\s|$)/);
  return tok == null ? null : `var(--color-${tok[1]})`;
}

/** The composited contrast of a node's own ink on its own fill, over `surface`. */
function measure(el: Element, mode: Mode, surface: RGB): number {
  const style = el.getAttribute('style') ?? '';
  const inlineBg = style.match(/background-color:\s*([^;]+)/);
  const inlineFg = style.match(/(?:^|;)\s*color:\s*([^;]+)/);
  const fillExpr = inlineBg?.[1] ?? fillOf(el);
  const inkExpr = inlineFg?.[1] ?? inkOf(el);
  if (fillExpr == null) throw new Error(`no fill on ${el.className}`);
  if (inkExpr == null) throw new Error(`no ink on ${el.className}`);
  return ratio(over(paint(inkExpr, mode), surface), over(paint(fillExpr, mode), surface));
}

const CARD = (mode: Mode): RGB => hex(resolveVar('--color-card', mode));
const MODES: Mode[] = ['light', 'dark'];
// Normal text. The 3:1 large-text allowance needs >=18.66px bold or >=24px; every
// chip here is 0.6875rem.
const AA = 4.5;

/* ── Chip contrast ──────────────────────────────────────────────────────────── */

const TONES = ['neutral', 'success', 'warning', 'critical', 'info'] as const;

const chipsFor = (labels: Array<Record<string, unknown>>): Element[] => {
  const { container } = draw('KanbanCard', { title: 'Ship it', labels });
  return [...container.querySelectorAll('span.rounded-full.truncate')];
};

describe('board-nav — a label chip clears AA on its own fill', () => {
  it.each(TONES)('tone %s is readable in both themes', (tone) => {
    const [chip] = chipsFor([{ text: 'bug', tone }]);
    expect(chip, `no chip rendered for tone ${tone}`).toBeTruthy();
    for (const mode of MODES) {
      const r = measure(chip, mode, CARD(mode));
      expect(r, `${tone} chip in ${mode} mode`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('an unknown tone falls back to neutral and is still readable', () => {
    const [chip] = chipsFor([{ text: 'bug', tone: 'chartreuse' }]);
    for (const mode of MODES) {
      expect(measure(chip, mode, CARD(mode)), `fallback chip in ${mode}`).toBeGreaterThanOrEqual(AA);
    }
  });

  // The override is the unbounded case: a model may name ANY colour, and the old
  // recipe used that raw colour as ink on its own wash. #fbbf24 measured 1.54:1
  // and #84cc16 1.78:1 in light mode. Extremes are included because the guarantee
  // has to hold at the ends of the range, not just for plausible label colours.
  const OVERRIDES = ['#fbbf24', '#84cc16', '#0ea5e9', '#ec4899', '#16a34a', '#ffffff', '#000000'];
  it.each(OVERRIDES)('a model-supplied label colour %s stays readable', (color) => {
    const [chip] = chipsFor([{ text: 'bug', color }]);
    // The colour still has to REACH the chip — the fix moves it from the ink to
    // the fill, it does not drop the channel.
    expect(chip.getAttribute('style'), 'the override should paint inline').toContain(asRgbCss(color));
    for (const mode of MODES) {
      expect(measure(chip, mode, CARD(mode)), `override ${color} in ${mode}`).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('board-nav — the column count badge clears AA on its bg-muted fill', () => {
  it('is readable in both themes', () => {
    const { container } = draw('BoardColumn', { title: 'Doing', count: 7 });
    const badge = [...container.querySelectorAll('span')].find((s) => s.textContent === '7');
    expect(badge, 'count badge').toBeTruthy();
    for (const mode of MODES) {
      expect(measure(badge!, mode, CARD(mode)), `count badge in ${mode}`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('still routes through the muted CHANNEL so mutedColor keeps painting it', () => {
    const { container } = draw('BoardColumn', { title: 'Doing', count: 7, mutedColor: '#888888' });
    const badge = [...container.querySelectorAll('span')].find((s) => s.textContent === '7')!;
    expect(badge.className).toContain('--fr-boardcolumn-muted');
  });
});

/* ── Target size (WCAG 2.5.8, 24x24 minimum) ────────────────────────────────── */

describe('board-nav — interactive targets meet the 24px floor', () => {
  it('the collapse toggle carries a min-height, not the 20px its content gives it', () => {
    const { container } = draw('BoardColumn', { title: 'Doing', count: 7, collapsible: true });
    const toggle = container.querySelector('button[aria-expanded]')!;
    expect(toggle.classList.contains('min-h-6'), 'collapse toggle min-h-6').toBe(true);
    // A fixed height would stop a wrapped column name from taking a second line.
    expect(toggle.classList.contains('h-6'), 'collapse toggle must not be a fixed height').toBe(false);
  });

  it.each(['Move left', 'Move right'])('the %s arrow is a 24px FLOOR, not a fixed 24px box', (label) => {
    const { container } = draw('KanbanCard', { title: 'Ship it', moveable: true });
    const btn = container.querySelector(`button[aria-label="${label}"]`)!;
    expect(btn.classList.contains('min-h-6'), `${label} min-h-6`).toBe(true);
    expect(btn.classList.contains('min-w-6'), `${label} min-w-6`).toBe(true);
    expect(btn.classList.contains('h-6'), `${label} must not be a fixed height`).toBe(false);
    expect(btn.classList.contains('w-6'), `${label} must not be a fixed width`).toBe(false);
  });

  it('the card title button keeps its 24px floor', () => {
    const { container } = draw('KanbanCard', { title: 'Ship it' });
    const title = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Ship it')!;
    expect(title.classList.contains('min-h-6')).toBe(true);
  });
});
