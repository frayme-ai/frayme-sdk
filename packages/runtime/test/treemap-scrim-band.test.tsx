/**
 * TREEMAP SCRIM · and the two surfaces next to it that were reported as broken
 * and are not.
 *
 * ── what was reported ──────────────────────────────────────────────────────
 * A dark-mode audit walked every failing text leaf up to its first opaque
 * background painter and flagged four classes as "surfaces that do not flip in
 * dark mode":
 *
 *    30  media-annotator.tsx  the tool-button chip
 *     5  media-annotator.tsx  the pin head
 *    29  charts-radial.tsx    the Treemap cell
 *    26  ai-content.tsx       the Sources card
 *
 * ── what is actually true ──────────────────────────────────────────────────
 * Measured in a real browser (Playwright + the shipped stylesheet), toggling
 * `.frayme-dark` exactly the way the audit does:
 *
 *   · The tool chip and the Sources card DO flip. Both carry `transition-colors`,
 *     whose duration is 150ms, and the audit samples 80ms after the class swap —
 *     mid-animation. The Sources card read rgb(78,78,81) (luminance 0.0766) at
 *     80ms and rgb(28,28,32) (0.0118, = --frayme-card) once settled; the tool
 *     chips read rgb(79,79,82) (0.0786) then rgb(28,28,32). Those two numbers sit
 *     just above the audit's own "luminance > 0.06 = too light for dark" cut,
 *     which is why they were reported. Re-sampling with `transition: none`
 *     injected reproduces the settled result exactly (43 findings → 27, the same
 *     27 as a page BORN dark), so the difference is the animation, not the
 *     surface. The first describe below pins the flip so a real regression here
 *     — a literal, a var whose base does not flip — still fails loudly.
 *
 *   · The Treemap cell is a real defect, but not that one. The cell is a DATA
 *     surface: it is fixed by design in both modes, and its label is pinned white
 *     over a scrim, which is the sanctioned "text over a fixed scrim" pattern.
 *     The bug is that the scrim did not reach the text. It was ONE ramp from the
 *     overlay to transparent across the bottom 2/3 of the cell, and the text sits
 *     at the bottom of that box, so the alpha under the ink was never the 0.6 the
 *     overlay declares — it was 0.6 scaled by how far up the ramp the text landed
 *     (~0.28-0.45 measured). Pixel-sampled (screenshot with the ink blanked, worst
 *     pixel under each label box), the stock four-colour palette at 200px:
 *
 *              cell fill            before   after
 *       Engineering  #60a5fa          6.77   10.25
 *       Sales        #38bdf8          3.95    9.34
 *       Marketing    #2dd4bf          3.51    8.64
 *       Support      #fbbf24          3.16    8.01
 *       Cotton       #fef3c7          3.51    6.13
 *       Linen        #e0f2fe          2.24    6.29
 *
 *     — three of the four DEFAULT cells failed 4.5:1 with no author input, in
 *     light and dark alike. (A DOM walk cannot see any of this: the scrim is a
 *     SIBLING of the label, not an ancestor, so getComputedStyle-based probes
 *     score the ink against the raw cell fill and report 1.11-2.54 — wrong
 *     numbers, right conclusion.)
 *
 * ── what this file guards ──────────────────────────────────────────────────
 * jsdom cannot composite a gradient, so the guard does the arithmetic the
 * browser would: it reads the stop positions out of the class the component
 * actually renders, reads the text metrics out of the classes the same
 * component renders beside it, and asserts THE PAIRING — the full-strength band
 * has to be at least as tall as the text stack, or the ink is on the ramp again.
 * Then it composites the overlay over the worst fill a cell can carry and scores
 * both ink lines. A class-string assertion could not tell a 3.16 from an 8.01.
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

const LIGHT_VARS = declsIn(cssBlock(/^\.frayme-root\s*\{/m));
/** The FORCED-dark block — the selector the audit's probe switches on. */
const DARK_VARS = { ...LIGHT_VARS, ...declsIn(cssBlock(/^\.frayme-root\[data-theme='dark'\],/m)) };

/* ── a resolver for the slice of CSS colour syntax these classes use ───────── */

type RGBA = [number, number, number, number];

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

/** `#rgb`/`#rrggbb` · `rgb()/rgba()` · `transparent` · `var(--x,fallback)` ·
 *  `color-mix(in srgb, A P%, B)`. Alpha is carried, because the scrim IS alpha. */
function resolve(expr: string, vars: Record<string, string>): RGBA {
  const e = expr.replace(/_/g, ' ').trim();
  if (e === 'transparent') return [0, 0, 0, 0];
  if (e.startsWith('#')) {
    const h = e.slice(1);
    const wide = h.length >= 6;
    const px = (i: number): number =>
      wide ? parseInt(h.slice(i * 2, i * 2 + 2), 16) : parseInt(h[i] + h[i], 16);
    const a = (wide ? h.length === 8 : h.length === 4) ? px(3) / 255 : 1;
    return [px(0), px(1), px(2), a];
  }
  if (/^rgba?\(/.test(e)) {
    const n = e.slice(e.indexOf('(') + 1, -1).split(/[,\s/]+/).filter(Boolean).map(Number);
    return [n[0], n[1], n[2], n[3] ?? 1];
  }
  if (e.startsWith('var(')) {
    const args = splitTop(e.slice(4, -1));
    const v = vars[args[0]];
    if (v != null) return resolve(v, vars);
    if (args.length > 1) return resolve(args.slice(1).join(','), vars);
    throw new Error(`unset var with no fallback: ${args[0]}`);
  }
  if (e.startsWith('color-mix(')) {
    const args = splitTop(e.slice(10, -1));
    // sRGB arithmetic only — an oklab mix is a different colour and must not be
    // measured with this math.
    expect(args[0].trim(), 'this guard can only measure an sRGB color-mix').toBe('in srgb');
    const pct = Number(/(\d+(?:\.\d+)?)%/.exec(args[1])![1]) / 100;
    const a = resolve(args[1].replace(/\s*\d+(?:\.\d+)?%\s*$/, ''), vars);
    const b = resolve(args[2], vars);
    // PREMULTIPLIED, which is what CSS does and what the value line depends on:
    // `color-mix(in srgb, #fff 85%, transparent)` is rgba(255,255,255,0.85), NOT
    // a 15%-darkened white. Chrome serialises it `color(srgb 1 1 1 / 0.85)`.
    // Getting this wrong scored the value line at 3.42 instead of 5.29.
    const alpha = a[3] * pct + b[3] * (1 - pct);
    if (alpha === 0) return [0, 0, 0, 0];
    const ch = (i: number): number => (a[i] * a[3] * pct + b[i] * b[3] * (1 - pct)) / alpha;
    return [ch(0), ch(1), ch(2), alpha];
  }
  throw new Error(`unhandled colour expression: ${e}`);
}

/* ── WCAG 2.1 relative luminance + contrast ────────────────────────────────── */

const lum = ([r, g, b]: RGBA): number => {
  const f = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (fg: RGBA, bg: RGBA): number => {
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
};
/** Source-over: `top` (with its alpha) painted onto opaque `under`. */
const over = (top: RGBA, under: RGBA): RGBA =>
  [top[0] * top[3] + under[0] * (1 - top[3]), top[1] * top[3] + under[1] * (1 - top[3]), top[2] * top[3] + under[2] * (1 - top[3]), 1];

/* ── reading the component's own numbers back out of what it rendered ─────── */

const REM = 16;
/** Tailwind's own font-size/line-height PAIRS for the named steps in use. */
const TEXT_STEP: Record<string, [number, number]> = { 'text-sm': [14, 20], 'text-xs': [12, 16] };
/** The root line-height, read from the stylesheet rather than assumed — it is
 *  what an ARBITRARY `text-[Xrem]` inherits, since Tailwind pairs no leading
 *  with those. (`leading-tight` is written on both spans and does not survive
 *  tw-merge beside `line-clamp-2`, so it is not what the browser uses; measured
 *  in Chromium: 12px→16, 10px→15, 14px→20, 9px→13.5.) */
const ROOT_LEADING = Number(/line-height:\s*([\d.]+);/.exec(cssBlock(/^\.frayme-root\s*\{/m))![1]);
/** [font-size, line-height] in px for one of this component's text classes. */
const textBox = (cls: string): [number, number] => {
  const arb = /text-\[([\d.]+)rem\]/.exec(cls);
  if (arb) return [Number(arb[1]) * REM, Number(arb[1]) * REM * ROOT_LEADING];
  const named = Object.keys(TEXT_STEP).find((k) => cls.split(/\s+/).includes(k));
  if (named == null) throw new Error(`no font size in: ${cls}`);
  return TEXT_STEP[named];
};
const lengthPx = (v: string): number =>
  v.endsWith('rem') ? Number(v.slice(0, -3)) * REM : Number(v.replace('px', ''));
/** The cell's p-1.5 — the gap between the value line and the cell's bottom edge. */
const CELL_PAD = 6;

const DATA = [
  { label: 'Engineering', value: 48 },
  { label: 'Sales', value: 26 },
  { label: 'Marketing', value: 16 },
  { label: 'Support', value: 10 },
];

const cells = (c: HTMLElement): HTMLElement[] => [...c.querySelectorAll<HTMLElement>('[role="img"] > div')];
/** The token table PLUS whatever the chart root declares inline — an authored
 *  `overlayColor` arrives as a `--fr-treemap-overlay` style property, so a var
 *  chain resolved without it silently measures the default instead. */
const varsWithInline = (c: HTMLElement, base: Record<string, string>): Record<string, string> => {
  const root = c.querySelector<HTMLElement>('[role="img"]')!;
  // jsdom's CSSStyleDeclaration is not iterable, and it does not enumerate custom
  // properties either — the style ATTRIBUTE is the honest source.
  const inline = Object.fromEntries(
    [...(root.getAttribute('style') ?? '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)].map((m) => [m[1], m[2].trim()]),
  );
  return { ...base, ...inline };
};
const scrimOf = (cell: HTMLElement): HTMLElement =>
  [...cell.children].find((e) => /linear-gradient/.test(e.className.toString())) as HTMLElement;
const spansOf = (cell: HTMLElement): HTMLElement[] => [...cell.querySelectorAll<HTMLElement>(':scope > span')];
/** `[color:…]` off a span, `[background:linear-gradient(…)]` off the scrim. The
 *  leading boundary matters: a chip carries `bg-[color:…]` AND `text-[color:…]`,
 *  and an unanchored match reads the FILL as the ink (which scores a flat 1.00). */
const arbitrary = (el: HTMLElement, prop: string, owner = ''): string =>
  new RegExp(`(?:^|\\s)${owner}\\[${prop}:((?:[^\\[\\]]|\\[[^\\]]*\\])+)\\]`).exec(el.className.toString())![1];
/** The token form of the same channel, so a `text-card` still MEASURES (rather
 *  than crashing) if the ink is ever moved back onto a bare token class. */
const TEXT_TOKEN: Record<string, string> = {
  'text-card': 'var(--color-card)',
  'text-foreground': 'var(--color-foreground)',
  'text-primary-foreground': 'var(--color-primary-foreground)',
  'text-muted-foreground': 'var(--color-muted-foreground)',
};
/** The ink an element declares, as a colour expression. */
const inkExpr = (el: HTMLElement): string => {
  const cls = el.className.toString();
  const token = Object.keys(TEXT_TOKEN).find((k) => cls.split(/\s+/).includes(k));
  return token != null ? TEXT_TOKEN[token] : arbitrary(el, 'color', 'text-');
};

/**
 * The gradient the scrim renders, as { colour expression, stop px }[].
 * `--fr-tm-scrim` is declared on the chart root, so it is resolved from there —
 * the same lookup the browser does.
 */
function scrimStops(container: HTMLElement, cell: HTMLElement): Array<{ expr: string; at: number | null }> {
  const root = container.querySelector<HTMLElement>('[role="img"]')!;
  const decl = /\[--fr-tm-scrim:((?:[^[\]]|\[[^\]]*\])+)\]/.exec(root.className)![1].replace(/_/g, ' ');
  const grad = arbitrary(scrimOf(cell), 'background').replace(/_/g, ' ');
  const inner = grad.slice(grad.indexOf('(') + 1, grad.lastIndexOf(')'));
  return splitTop(inner)
    .slice(1) // drop the `to top` direction
    .map((s) => {
      const m = /^(.*?)(?:\s+([\d.]+(?:rem|px)|0))?$/.exec(s.trim())!;
      return { expr: m[1].replace('var(--fr-tm-scrim)', decl), at: m[2] == null ? null : lengthPx(m[2]) };
    });
}

/**
 * The scrim colour AS PAINTED at `y` px above the cell's bottom edge — the
 * question a DOM walk cannot ask, and the one the whole defect turns on. The
 * gradient's stops are read back off the element; a stop with no position takes
 * the box's own edges, which is what makes the legacy one-ramp form (0 → box
 * height) and the banded form (0 → band → fade, in absolute rem) measurable by
 * the same code. The box is the scrim element's height: `h-full` = the cell,
 * `h-2/3` = two thirds of it.
 */
function scrimAt(
  scrim: HTMLElement,
  stops: Array<{ expr: string; at: number | null }>,
  cellH: number,
  y: number,
  vars: Record<string, string>,
): RGBA {
  const cls = scrim.className.toString();
  const box = cls.includes('h-full') ? cellH : cls.includes('h-2/3') ? (2 / 3) * cellH : NaN;
  expect(Number.isNaN(box), `unknown scrim box height in: ${cls}`).toBe(false);
  const pts = stops.map((s, i) => ({ at: s.at ?? (i === 0 ? 0 : box), c: resolve(s.expr, vars) }));
  if (y <= pts[0].at) return pts[0].c;
  for (let i = 1; i < pts.length; i += 1) {
    if (y > pts[i].at) continue;
    const span = pts[i].at - pts[i - 1].at || 1;
    const t = (y - pts[i - 1].at) / span;
    // premultiplied again — the ramp runs to `transparent`, whose RGB is black
    const a = pts[i - 1].c[3] * (1 - t) + pts[i].c[3] * t;
    return [pts[i - 1].c[0], pts[i - 1].c[1], pts[i - 1].c[2], a];
  }
  return [0, 0, 0, 0]; // above the last stop: nothing is painted
}

/* ══ 1. the two surfaces the audit misread — they flip, and this pins it ═══ */

describe('the chip and the card DO flip (the audit sampled them mid-transition)', () => {
  const CASES = [
    {
      name: 'MediaAnnotator · an inactive tool chip',
      type: 'MediaAnnotator',
      props: { src: 'https://example.com/a.jpg', alt: 'x', annotations: [{ id: 'a', kind: 'pin', x: 0.3, y: 0.3, label: 'Crack' }] },
      pick: (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('button')].find((b) => b.className.includes('bg-card'))!,
      fill: 'var(--color-card)',
      ink: 'var(--color-foreground)',
    },
    {
      name: 'Sources · a source card',
      type: 'Sources',
      props: { sources: [{ title: 'json-render docs', url: 'https://json-render.dev', excerpt: 'The open UI spec.' }] },
      pick: (c: HTMLElement) => c.querySelector<HTMLElement>('a.bg-card')!,
      fill: 'var(--color-card)',
      ink: 'var(--color-muted-foreground)',
    },
  ];

  it.each(CASES)('$name paints bg-card, not a literal', ({ type, props, pick }) => {
    const { container } = draw(type, props);
    const el = pick(container);
    expect(el, 'the surface under test should exist').toBeTruthy();
    // The whole finding was "this surface is painting from a hardcoded value".
    // It is not: it is the token, so it moves with the mode.
    expect(el.className.split(/\s+/)).toContain('bg-card');
    expect(el.className).not.toMatch(/bg-\[#|bg-white|bg-\[color:#/);
  });

  it.each(CASES)('$name lands on the DARK card in dark mode, and clears 4.5:1', ({ fill, ink }) => {
    const light = resolve(fill, LIGHT_VARS);
    const dark = resolve(fill, DARK_VARS);
    expect(light.slice(0, 3)).toEqual([255, 255, 255]);
    expect(dark.slice(0, 3)).toEqual([28, 28, 32]); // #1c1c20 — it flipped
    expect(contrast(resolve(ink, LIGHT_VARS), light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(resolve(ink, DARK_VARS), dark)).toBeGreaterThanOrEqual(4.5);
  });
});

/* ══ 2. MediaAnnotator — ink pinned to the fill the AUTHOR pinned ═════════ */

describe('MediaAnnotator — a fixed fill carries fixed ink', () => {
  const pin = (color?: string) => ({ id: color ?? 'p', kind: 'pin', x: 0.3, y: 0.3, label: 'Crack', ...(color ? { color } : {}) });
  const drawAnno = (props: Record<string, unknown>) =>
    draw('MediaAnnotator', { src: 'https://example.com/a.jpg', alt: 'A panel', ...props });

  /** `--fr-ma-ink` etc. — the annotator declares its channels inline on its root. */
  const rootVars = (c: HTMLElement, base: Record<string, string>): Record<string, string> => {
    const style = c.querySelector<HTMLElement>('[style]')!.getAttribute('style') ?? '';
    return { ...base, ...Object.fromEntries([...style.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)].map((m) => [m[1], m[2].trim()])) };
  };
  const activeChip = (c: HTMLElement): HTMLElement =>
    [...c.querySelectorAll<HTMLElement>('button[role="radio"]')].find((b) => b.getAttribute('aria-checked') === 'true')!;
  const head = (c: HTMLElement): HTMLElement =>
    [...c.querySelectorAll<HTMLElement>('span')].find((s) => s.textContent === '●')!;
  const styleProp = (el: HTMLElement, prop: string): string =>
    new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(el.getAttribute('style') ?? '')![1].trim();

  // The colours generated specs author on this component, plus the two ends.
  it.each([
    { what: 'accent #0C8A5B (a commonly authored value)', accent: '#0C8A5B' },
    { what: 'accent #fbbf24 (light)', accent: '#fbbf24' },
    { what: 'accent #1e3a8a (dark)', accent: '#1e3a8a' },
    { what: 'accent rgb(12, 138, 91) (the same colour, rgb form)', accent: 'rgb(12, 138, 91)' },
  ])('$what: the active tool chip clears 4.5:1 in BOTH modes', ({ accent }) => {
    const { container } = drawAnno({ accent, annotations: [pin()] });
    const chip = activeChip(container);
    for (const base of [LIGHT_VARS, DARK_VARS]) {
      const vars = rootVars(container, base);
      const fill = resolve('var(--fr-ma-accent,var(--color-foreground))', vars);
      const ink = resolve(inkExpr(chip), vars);
      expect(contrast(ink, fill), `chip on ${accent}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    { what: 'a #2563eb pin', color: '#2563eb' },
    { what: 'a #d97706 pin', color: '#d97706' },
    { what: 'a #fde68a pin', color: '#fde68a' },
  ])('$what head clears 4.5:1 in BOTH modes', ({ color }) => {
    const { container } = drawAnno({ annotations: [pin(color)] });
    const dot = head(container);
    // React normalises an inline hex to rgb(), so compare COLOURS, not strings
    expect(resolve(styleProp(dot, 'background-color'), LIGHT_VARS)).toEqual(resolve(color, LIGHT_VARS));
    for (const base of [LIGHT_VARS, DARK_VARS]) {
      const vars = rootVars(container, base);
      expect(
        contrast(resolve(styleProp(dot, 'color'), vars), resolve(color, vars)),
        `pin head on ${color}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('a mark with no colour of its own takes the chart-level activeColor pairing', () => {
    const { container } = drawAnno({ activeColor: '#fde68a', annotations: [pin()] });
    const dot = head(container);
    for (const base of [LIGHT_VARS, DARK_VARS]) {
      const vars = rootVars(container, base);
      const fill = resolve('var(--fr-ma-active,var(--color-primary))', vars);
      expect(contrast(resolve(styleProp(dot, 'color'), vars), fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('sets NO ink of its own when the author fixed nothing — the token pair is right there', () => {
    const { container } = drawAnno({ annotations: [pin()] });
    const vars = rootVars(container, LIGHT_VARS);
    expect(vars['--fr-ma-ink'], 'an unset accent must not pin an ink').toBeUndefined();
    // …and the two channels still resolve to exactly what they painted before:
    // the chip to --color-card, the pin head to --color-primary-foreground.
    for (const base of [LIGHT_VARS, DARK_VARS]) {
      const v = rootVars(container, base);
      expect(resolve(inkExpr(activeChip(container)), v)).toEqual(resolve('var(--color-card)', v));
      expect(resolve(styleProp(head(container), 'color'), v)).toEqual(resolve('var(--color-primary-foreground)', v));
      // both halves flip together, so the pairing was never the broken one
      expect(contrast(resolve('var(--color-primary-foreground)', v), resolve('var(--color-primary)', v))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps its hands off a colour it cannot read, rather than guessing', () => {
    // safeColor admits named colours and oklch()/lab(); a wrong luminance would be
    // worse than no opinion, so those keep the token pair (and its old numbers).
    const { container } = drawAnno({ accent: 'rebeccapurple', annotations: [pin()] });
    expect(rootVars(container, LIGHT_VARS)['--fr-ma-ink']).toBeUndefined();
    expect(inkExpr(activeChip(container))).toBe('var(--fr-ma-ink,var(--color-card))');
    expect(resolve(inkExpr(activeChip(container)), rootVars(container, LIGHT_VARS))).toEqual(
      resolve('var(--color-card)', LIGHT_VARS),
    );
  });
});

/* ══ 3. the Treemap scrim — the real defect ═══════════════════════════════ */

describe('Treemap — the scrim reaches the text it is under', () => {
  it.each([
    ['sm', undefined],
    ['md', undefined],
    ['lg', undefined],
  ])('%s: the full-strength band is at least as tall as the text stack', (size) => {
    const { container } = draw('Treemap', { data: DATA, size, showValues: true });
    const cell = cells(container)[0];
    const [labelSpan, valueSpan] = spansOf(cell);
    // The text stack, from the classes the component itself renders: a
    // line-clamp-2 label (so TWO lines is the worst case) + the value line,
    // inside the cell's p-1.5. Change the type scale without moving the stop and
    // this is the assertion that fails.
    expect(labelSpan.className).toContain('line-clamp-2');
    const stack = 2 * textBox(labelSpan.className)[1] + textBox(valueSpan.className)[1] + CELL_PAD;

    const stops = scrimStops(container, cell);
    expect(stops.length, 'a plateau needs three stops: colour, colour, transparent').toBe(3);
    const band = stops[1].at!;
    expect(stops[0].at).toBe(0);
    expect(band, `the ${size} band must cover a ${stack}px text stack`).toBeGreaterThanOrEqual(stack);
    // and the ramp must actually end above it, or there is no fade at all
    expect(stops[2].at!).toBeGreaterThan(band);
    expect(stops[2].expr.trim()).toBe('transparent');
  });

  // Worst case first: a cell fill can be anything, including white, and the
  // promise on this component is that the label "reads on ANY cell fill".
  const FILLS: Array<[string, string]> = [
    ['#ffffff (the worst a fill can be)', '#ffffff'],
    ['#fef3c7 (a pale authored fill)', '#fef3c7'],
    ['#fbbf24 (stock palette, slot 4)', '#fbbf24'],
    ['#2dd4bf (stock palette, slot 3)', '#2dd4bf'],
    ['#111827 (a dark authored fill)', '#111827'],
  ];

  // The two cell heights the DEFAULT four-cell 200px chart actually produces
  // (measured in Chromium): one full-height cell and three half-height ones.
  it.each([
    { mode: 'light', vars: LIGHT_VARS, cellH: 200 },
    { mode: 'light', vars: LIGHT_VARS, cellH: 100 },
    { mode: 'dark', vars: DARK_VARS, cellH: 200 },
    { mode: 'dark', vars: DARK_VARS, cellH: 100 },
  ])('$mode: both ink lines clear 4.5:1 in a $cellH px cell, on every fill', ({ vars, cellH }) => {
    const { container } = draw('Treemap', { data: DATA, showValues: true });
    const cell = cells(container)[0];
    const [labelSpan, valueSpan] = spansOf(cell);
    const stops = scrimStops(container, cell);
    expect(resolve(stops[0].expr, vars)[3], 'the default overlay is a 0.6-alpha black').toBeCloseTo(0.6, 2);

    // The worst point under the ink is the TOP of the text stack, with the label
    // at its full line-clamp-2 height — that is where the old ramp had decayed.
    const top = 2 * textBox(labelSpan.className)[1] + textBox(valueSpan.className)[1] + CELL_PAD;
    const surfaceAt = (fill: string): RGBA =>
      over(scrimAt(scrimOf(cell), stops, cellH, top, vars), resolve(fill, vars));

    for (const [name, fill] of FILLS) {
      const surface = surfaceAt(fill);
      for (const span of [labelSpan, valueSpan]) {
        const ink = resolve(arbitrary(span, 'color'), vars);
        // the value line is an 85%-alpha ink — it too is composited, not assumed
        expect(
          contrast(over(ink, surface), surface),
          `"${span.textContent}" on ${name} in a ${cellH}px cell`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('is sensitive to the geometry: the ramp it replaced fails the same check', () => {
    // The shipped gradient was ONE ramp over a `h-2/3` box, so the alpha where
    // the ink lands was 0.6 scaled by how far up that box the text sits — which
    // makes it a function of CELL height, not of the overlay. Three of the four
    // cells in the default 4-cell 200px chart measure 100px tall (Chromium), and
    // there a one-line label's top sits `stack` px up a 66.7px ramp:
    const { container } = draw('Treemap', { data: DATA, showValues: true });
    const [labelSpan, valueSpan] = spansOf(cells(container)[0]);
    const oneLine = textBox(labelSpan.className)[1] + textBox(valueSpan.className)[1] + CELL_PAD; // 37px
    const rampAlpha = 0.6 * (1 - oneLine / ((2 / 3) * 100));
    const ink = resolve(arbitrary(labelSpan, 'color'), LIGHT_VARS);
    const ratios = ['#fbbf24', '#fef3c7'].map((fill) => {
      const surface = over([0, 0, 0, rampAlpha], resolve(fill, LIGHT_VARS));
      return contrast(over(ink, surface), surface);
    });
    // 3.09 / 2.60 here vs 3.16 / 3.51 pixel-sampled in Chromium (the screenshot
    // reads the worst pixel in the text box, this reads its top edge) — the
    // arithmetic and the screenshot agree on the finding: under the floor.
    expect(Math.max(...ratios)).toBeLessThan(4.5);
  });

  it('an authored labelColor with no overlayColor keeps the softer ramp (unchanged)', () => {
    // Strengthening a DARK scrim under a DARK ink buries it (measured 4.56 →
    // 2.66), and the component cannot know which way to push without the
    // overlayColor the catalog tells the author to pair. That path is left
    // exactly as it shipped; pairing both props takes the banded one.
    const { container } = draw('Treemap', { data: DATA, labelColor: '#111827' });
    const stops = scrimStops(container, cells(container)[0]);
    expect(stops.length).toBe(2);
    expect(scrimOf(cells(container)[0]).className).toContain('h-2/3');

    const paired = draw('Treemap', { data: DATA, labelColor: '#111827', overlayColor: 'rgba(255,255,255,0.6)' });
    const pairedStops = scrimStops(paired.container, cells(paired.container)[0]);
    expect(pairedStops.length).toBe(3);
    // and with both set, the author's own pairing now actually delivers — on the
    // darkest fill a cell can carry, which is where a light scrim is needed most
    const vars = varsWithInline(paired.container, LIGHT_VARS);
    const surface = over(resolve(pairedStops[0].expr, vars), resolve('#111827', vars));
    expect(contrast(resolve('#111827', vars), surface)).toBeGreaterThanOrEqual(4.5);
  });
});
