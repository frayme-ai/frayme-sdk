/**
 * INHERITED-FOREGROUND guard — marketing-hero · ai-flow · data-longtail ·
 * notification-center · log-console.
 *
 * Same defect class as the other inherited-foreground-*.test.tsx files. A spec authors
 * `Card { bg:"#12161f", color:"#e2e6f0" }`, the colour inherits correctly down two
 * levels, and then a control RESETS it to the global token. Measured on
 * a generated feature-flag console:
 *
 *   SECTION (Card)  color rgb(226,230,240)  bg rgb(18,22,31)   <- authored
 *   DIV             color rgb(226,230,240)                     <- inherits
 *   BUTTON          color rgb(24,24,27)                        <- RESETS  1.02:1
 *
 * `currentColor` / `text-inherit` as the LAST RESORT of a foreground chain is safe
 * because frayme.css points BOTH `.frayme-root { color }` and `--color-foreground`
 * at `--frayme-fg`: at the top level the two resolve to the same value, so a
 * props-less render is byte-identical, and inside an authored container the
 * inherited one is the only correct answer. On the `color` property currentColor
 * computes to the INHERITED value — no cycle.
 *
 * WHY THIS FILE MEASURES THE SURFACE, NOT JUST THE INK.
 * Four of the five source files covered here turned out to paint their own background, and the
 * two rules ("inherit when you don't own your surface" / "keep the token when you
 * do") only separate once the surface is actually computed. Two of them are
 * TRANSLUCENT, where the answer flips on the alpha:
 *
 *   bg-muted/50 (Reasoning)  surface rgb(131,133,138)  token 4.80  inherited 2.96
 *   bg-muted/30 (JsonView)   surface rgb( 86, 89, 95)  token 2.52  inherited 5.62
 *
 * So each case below resolves BOTH the element's ink chain and its effective
 * surface through the real var chains in frayme.css — compositing every `/NN`
 * wash it walks past — and then asserts the pair. A class-string assertion could
 * not have told those two apart, and would have called both of them the same bug.
 *
 * It is NOT a blanket rename. The leave-list is the load-bearing half of this
 * file: Hero and CTA bands, the NotificationCenter shell and the LogConsole
 * scroller all paint an OPAQUE token surface, and an authored Card sets
 * --fr-card-bg / --fr-card-fg — never --color-card/--color-muted — so those slabs
 * are still #ffffff / #f4f4f5 inside a dark card. Inheriting the card's light ink
 * onto them is the same bug pointing the other way (1.25:1 / 1.14:1), and every
 * one of them is pinned here.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* ── the token table, read from the stylesheet that ships ──────────────────── */
/* (same idiom as inherited-foreground-actions-nav-marketing: a hard-coded hex here would stop measuring
   the moment frayme.css re-tunes a token, which it has done.) */

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
 *  computes `currentColor` to when it lands on the `color` property. */
function resolveColor(expr: string, inherited: RGB, vars: Record<string, string>): RGB {
  const e = expr.replace(/_/g, ' ').trim(); // Tailwind encodes spaces as underscores
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
/** `fg` painted at `alpha` over `bg` — how a `/NN` wash actually reaches the eye. */
const over = (fg: RGB, bg: RGB, alpha: number): RGB =>
  fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as RGB;

/* ── reading classes off an element ────────────────────────────────────────── */

/** Resting classes only. A modifier (`hover:`, `focus-visible:`, `md:`) shows as a
 *  `:` BEFORE the first `[` — inside the brackets a `:` is part of the value. */
function restingClasses(el: Element): string[] {
  return [...el.classList].filter((c) => {
    const bracket = c.indexOf('[');
    const colon = c.indexOf(':');
    return colon < 0 || (bracket >= 0 && colon > bracket);
  });
}

/** Custom properties the element sets — inline (styleVars) or as a class-form
 *  `[--x:value]` (how the CVA recipes set --fr-cta-surface and friends). */
function ownVars(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  const st = (el as HTMLElement).style;
  for (let i = 0; i < st.length; i += 1) {
    const n = st[i];
    if (n.startsWith('--')) out[n] = st.getPropertyValue(n).trim();
  }
  for (const c of restingClasses(el)) {
    const m = /^\[(--[a-z0-9-]+):(.+)\]$/.exec(c);
    if (m) out[m[1]] = m[2].replace(/_/g, ' ');
  }
  return out;
}

/** Custom properties in scope at `el` (they inherit; nearest declaration wins). */
function varScope(el: Element, stop: Element): Record<string, string> {
  const chain: Element[] = [];
  for (let e: Element | null = el; e != null && e !== stop.parentElement; e = e.parentElement) chain.push(e);
  const out = { ...VARS };
  for (const e of chain.reverse()) Object.assign(out, ownVars(e));
  return out;
}

const TEXT_TOKEN: Record<string, string> = {
  foreground: 'var(--color-foreground)',
  card: 'var(--color-card)',
  'card-foreground': 'var(--color-card-foreground)',
  'muted-foreground': 'var(--color-muted-foreground)',
  'primary-foreground': 'var(--color-primary-foreground)',
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  inherit: 'inherit',
  current: 'currentColor',
};
const BG_TOKEN: Record<string, string> = {
  card: 'var(--color-card)',
  muted: 'var(--color-muted)',
  foreground: 'var(--color-foreground)',
  transparent: 'transparent',
  current: 'currentColor',
};

/** The resting `color` expression this element declares, or null when it only
 *  inherits. cn()/tailwind-merge has already collapsed the group, so more than
 *  one survivor would be a tw-merge trap and is failed loudly. */
function colorExprOf(el: Element): string | null {
  const found: string[] = [];
  for (const c of restingClasses(el)) {
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

/** The resting fill this element paints: `{ expr, alpha }`, or null when it
 *  paints nothing (and so shows whatever is behind it).
 *
 *  PRECEDENCE, taken from the browser trace rather than guessed: an authored Card
 *  ships BOTH `bg-card` and `[background:var(--fr-card-bg,…)]` (they are different
 *  tw-merge groups, so neither drops the other), and the SECTION in the trace
 *  measured `bg rgb(18,22,31)` — the authored value. So an arbitrary
 *  background property beats a `bg-<token>` utility on the same element, and an
 *  inline style beats both. */
function fillOf(el: Element): { expr: string; alpha: number } | null {
  const inline = (el as HTMLElement).style.backgroundColor;
  if (inline) return { expr: inline, alpha: 1 };
  let token: { expr: string; alpha: number } | null = null;
  for (const c of restingClasses(el)) {
    // `bg-x/50` and `bg-[color:…]/[0.04]` — the opacity rides on the end.
    const slash = /\/(\[?[\d.]+\]?)$/.exec(c);
    const raw = slash ? c.slice(0, -slash[0].length) : c;
    const alpha = slash ? Number(slash[1].replace(/[[\]]/g, '')) / (slash[1].includes('[') ? 1 : 100) : 1;
    let m = /^bg-\[color:(.+)\]$/.exec(raw) ?? /^\[background(?:-color)?:(.+)\]$/.exec(raw);
    if (m) return /gradient/.test(m[1]) ? { expr: 'MEDIA', alpha: 1 } : { expr: m[1], alpha };
    m = /^bg-([a-z-]+)$/.exec(raw);
    if (m && BG_TOKEN[m[1]] != null && BG_TOKEN[m[1]] !== 'transparent' && token == null) {
      token = { expr: BG_TOKEN[m[1]], alpha };
    }
  }
  return token;
}

/* ── the two walks: what ink arrives here, and what is behind it ───────────── */

/** The page's own ink — `.frayme-root { color: var(--frayme-fg) }`. */
const ROOT_INK: RGB = resolveColor('var(--frayme-fg)', [0, 0, 0], VARS);
/** …which is the same value `--color-foreground` resolves to. That equality is
 *  what makes substituting currentColor byte-identical at the top level, so it is
 *  asserted (below) rather than assumed. */
const TOKEN_FG: RGB = resolveColor('var(--color-foreground)', [0, 0, 0], VARS);
/** The page's own surface — `.frayme-root { background: var(--frayme-bg) }`. */
const PAGE_BG: RGB = resolveColor('var(--frayme-bg)', [0, 0, 0], VARS);

const frameOf = (c: HTMLElement): Element => c.querySelector('.frayme-root')!;

/** The ink `el` paints, resolving every chain it inherits through. */
function inkAt(el: Element, root: Element): RGB {
  const inherited = el === root || el.parentElement == null ? ROOT_INK : inkAt(el.parentElement, root);
  const expr = colorExprOf(el);
  return expr == null ? inherited : resolveColor(expr, inherited, varScope(el, root));
}

/** The surface behind `el` — the first opaque fill at or above it, with every
 *  translucent wash on the way composited over what is behind IT. */
function surfaceAt(el: Element, root: Element): RGB {
  const behind = el === root || el.parentElement == null ? PAGE_BG : surfaceAt(el.parentElement, root);
  const fill = fillOf(el);
  if (fill == null) return behind;
  expect(fill.expr, `${el.tagName} paints MEDIA — not a case this file can measure`).not.toBe('MEDIA');
  const painted = resolveColor(fill.expr, inkAt(el, root), varScope(el, root));
  return fill.alpha >= 1 ? painted : over(painted, behind, fill.alpha);
}

/* ── the two renders every case is measured on ─────────────────────────────── */

const CARD_BG = '#12161f';
const CARD_FG = '#e2e6f0';
const AUTHORED: RGB = hexToRgb(CARD_FG);

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

type Pick = (c: HTMLElement) => Element;
type Case = { name: string; type: string; props: Record<string, unknown>; pick: Pick };

/** Cases whose element does NOT own the surface under it → it must inherit. */
function itInherits(c: Case, floor = 4.5): void {
  it(`${c.name}: inherits the authored ink inside a dark card`, () => {
    const { container } = drawInCard(c.type, c.props);
    const root = frameOf(container);
    const card = container.querySelector('section.fr-frame')!;
    expect(card, 'the authored Card').not.toBeNull();
    expect(inkAt(card, root)).toEqual(AUTHORED);

    const el = c.pick(container);
    const ink = inkAt(el, root);
    const surface = surfaceAt(el, root);
    expect(ink, 'reset to the global token instead of inheriting').not.toEqual(TOKEN_FG);
    expect(ink).toEqual(AUTHORED);
    // …and the outcome the audit actually scores. The pre-fix ink measured 1.02
    // wherever the element sits directly on the card.
    expect(contrast(ink, surface)).toBeGreaterThanOrEqual(floor);
    expect(contrast(TOKEN_FG, surface)).toBeLessThan(contrast(ink, surface));
  });

  it(`${c.name}: unchanged on the page's own surface (byte-identical default)`, () => {
    const { container } = draw(c.type, c.props);
    expect(inkAt(c.pick(container), frameOf(container))).toEqual(TOKEN_FG);
  });
}

/** Cases whose element DOES own the surface under it → it must NOT inherit. */
function itKeepsTheToken(c: Case, expected: RGB = TOKEN_FG): void {
  it(`${c.name}: keeps its own token — it painted the surface under it`, () => {
    const { container } = drawInCard(c.type, c.props);
    const root = frameOf(container);
    const el = c.pick(container);
    const ink = inkAt(el, root);
    const surface = surfaceAt(el, root);
    expect(ink).toEqual(expected);
    // The reason it keeps it: the surface it sits on is the component's own, and
    // it stayed light inside the dark card — inheriting would be the bug inverted.
    expect(contrast(ink, surface)).toBeGreaterThan(contrast(AUTHORED, surface));
    expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.5);
  });
}

const byText = (t: string) => (c: HTMLElement): Element =>
  [...c.querySelectorAll('button,a,span,p,h1,h2,h3,time,pre')].reverse().find((e) => e.textContent?.trim() === t)!;
const sel = (s: string) => (c: HTMLElement): Element => {
  const el = c.querySelector(s);
  expect(el, `selector ${s} matched nothing`).not.toBeNull();
  return el!;
};

/* ══════════════════════════════════════════════════════════════════════════ */

describe('the safety argument itself', () => {
  it('currentColor === --color-foreground at the top level', () => {
    // The whole substitution rests on this equality; frayme.css points both
    // `.frayme-root { color }` and --color-foreground at --frayme-fg.
    expect(ROOT_INK).toEqual(TOKEN_FG);
  });

  it('the resolver composites a wash rather than treating it as opaque', () => {
    // The two decisions that flipped on this: 50% keeps the token, 30% does
    // not. If this ever reads "equal", every wash case below stopped measuring.
    const card = hexToRgb(CARD_BG);
    const muted = resolveColor('var(--color-muted)', [0, 0, 0], VARS);
    expect(contrast(TOKEN_FG, over(muted, card, 0.5))).toBeGreaterThan(4.5);
    expect(contrast(TOKEN_FG, over(muted, card, 0.3))).toBeLessThan(3);
  });
});

/* ── marketing-hero.tsx ────────────────────────────────────────────────────── */

describe('marketing-hero — FeatureCard', () => {
  const CARD = { title: 'Fast', description: 'Ships in a week', icon: 'zap' };
  const title = sel('h3');

  // plain/bordered paint NO fill (the recipe base is already `text-inherit`) —
  // the card takes its surface AND its ink from whatever contains it.
  itInherits({ name: 'plain title', type: 'FeatureCard', props: CARD, pick: title });
  itInherits({ name: 'bordered title', type: 'FeatureCard', props: { ...CARD, variant: 'bordered' }, pick: title });
  // …including the FeatureGrid data path, which is how generated specs render them.
  itInherits({
    name: 'FeatureGrid card title',
    type: 'FeatureGrid',
    props: { features: [{ title: 'Fast', description: 'Ships in a week' }] },
    pick: title,
  });

  // elevated paints bg-card → the ink belongs to that slab, not to the container.
  itKeepsTheToken({ name: 'elevated title', type: 'FeatureCard', props: { ...CARD, variant: 'elevated' }, pick: title });

  it('a model `color` still wins over both branches', () => {
    for (const variant of ['plain', 'elevated']) {
      const { container } = drawInCard('FeatureCard', { ...CARD, variant, color: '#ff8800' });
      expect(inkAt(sel('h3')(container), frameOf(container))).toEqual(hexToRgb('#ff8800'));
    }
  });
});

describe('marketing-hero — the bands KEEP their token (they paint their own surface)', () => {
  // LEFT DELIBERATELY. `hasSurface === false` is exactly the branch where the Hero
  // band adds `bg-card` (the two conditions are complements), and every CTA
  // variant fills --fr-cta-surface (--color-muted) or bg-card. An authored Card
  // sets --fr-card-bg, never --color-card/--color-muted, so those slabs stay light.
  itKeepsTheToken({ name: 'Hero title', type: 'Hero', props: { title: 'Ship faster' }, pick: sel('h1') });
  itKeepsTheToken({
    name: 'Hero ghost CTA label',
    type: 'Hero',
    props: { title: 'Ship faster', actions: [{ label: 'Go' }, { label: 'Docs', variant: 'ghost' }] },
    pick: byText('Docs'),
  });
  itKeepsTheToken({
    name: 'Hero outline CTA label',
    type: 'Hero',
    props: { title: 'Ship faster', actions: [{ label: 'Go' }, { label: 'Docs', variant: 'outline' }] },
    pick: byText('Docs'),
  });
  itKeepsTheToken({ name: 'CTA banner heading', type: 'CTA', props: { title: 'Start free' }, pick: sel('h2') });
  itKeepsTheToken({ name: 'CTA card heading', type: 'CTA', props: { title: 'Start free', variant: 'card' }, pick: sel('h2') });

  it('the Hero band really does paint an opaque bg-card in the no-surface branch', () => {
    // The whole leave-decision above rests on this; if the band ever stops
    // painting, these five cases are wrong and this fails first.
    const { container } = drawInCard('Hero', { title: 'Ship faster' });
    const band = container.querySelector('section.rounded-2xl')!;
    expect(fillOf(band)).toEqual({ expr: 'var(--color-card)', alpha: 1 });
    expect(surfaceAt(sel('h1')(container), frameOf(container))).toEqual(
      resolveColor('var(--color-card)', [0, 0, 0], VARS),
    );
  });

  it('background-media copy belongs to the SCRIM, not to the page', () => {
    // A hero over an arbitrary photo paints its own gradient scrim and carries
    // light copy on it. currentColor there would hand the copy the page's ink and
    // put dark text on a dark photograph — this branch must stay pinned to the
    // on-fill token.
    const { container } = draw('Hero', {
      title: 'Ship faster',
      mediaSrc: 'https://example.com/a.jpg',
      mediaPosition: 'background',
    });
    const h1 = sel('h1')(container);
    expect(h1.className).toContain('[color:var(--fr-hero-fg,var(--color-primary-foreground))]');
    expect(h1.className).not.toContain('currentColor');
  });
});

/* ── ai-flow.tsx ───────────────────────────────────────────────────────────── */

describe('ai-flow — Task (a row that paints nothing)', () => {
  const TASK = { title: 'Reading registry.tsx', detail: '4 files' };
  const label = sel('span.break-words.font-medium');
  const glyph = sel('span.inline-flex.shrink-0.items-center.justify-center');

  itInherits({ name: 'pending title', type: 'Task', props: TASK, pick: label });
  itInherits({ name: 'done title', type: 'Task', props: { ...TASK, state: 'done' }, pick: label });
  itInherits({ name: 'active title', type: 'Task', props: { ...TASK, state: 'active' }, pick: label });
  itInherits({ name: 'active glyph', type: 'Task', props: { ...TASK, state: 'active' }, pick: glyph });

  it('the semantic states are untouched — a tone names a meaning, not a surface', () => {
    const { container } = drawInCard('Task', { ...TASK, state: 'error' });
    expect(inkAt(label(container), frameOf(container))).toEqual(resolveColor('var(--color-danger)', [0, 0, 0], VARS));
    const { container: d } = drawInCard('Task', { ...TASK, state: 'done' });
    expect(inkAt(glyph(d), frameOf(d))).toEqual(resolveColor('var(--color-success)', [0, 0, 0], VARS));
  });

  it('a model `accent` still wins in every state', () => {
    const { container } = drawInCard('Task', { ...TASK, state: 'pending', accent: '#ff8800' });
    expect(inkAt(label(container), frameOf(container))).toEqual(hexToRgb('#ff8800'));
  });
});

describe('ai-flow — the panels KEEP their token (they paint their own surface)', () => {
  // LEFT DELIBERATELY, and the Reasoning wash is the closest call in the file:
  // bg-muted/50 composites to rgb(131,133,138), where the token reads 4.80 and the
  // inherited ink 2.96. The 30% wash in JsonView goes the other way — hence the
  // per-surface measurement rather than a rule about washes.
  itKeepsTheToken({
    name: 'Reasoning body (bg-muted/50)',
    type: 'Reasoning',
    props: { content: 'thinking…', defaultOpen: true },
    pick: sel('pre'),
  });
  itKeepsTheToken({
    name: 'ToolCall body (bg-card)',
    type: 'ToolCall',
    props: { name: 'mcp__db__query', input: 'select 1', defaultOpen: true },
    pick: sel('pre'),
  });
  itKeepsTheToken({
    name: 'ToolCall name (bg-card)',
    type: 'ToolCall',
    props: { name: 'mcp__db__query' },
    pick: byText('mcp__db__query'),
  });
  itKeepsTheToken({
    name: 'Confirmation message (bg-card)',
    type: 'Confirmation',
    props: { message: 'Delete 3 files?' },
    pick: sel('p'),
  });
  itKeepsTheToken({
    name: 'Suggestion chip (bg-card)',
    type: 'Suggestion',
    props: { label: 'Explain this' },
    pick: sel('button'),
  });
});

/* ── data-longtail.tsx ─────────────────────────────────────────────────────── */

describe('data-longtail — RelativeTime (a bare inline span)', () => {
  const RT = { target: '2026-01-01T00:00:00Z' };
  // The <time> paints nothing itself; it inherits the tone span, which is the
  // element under test. Measuring the leaf is what the reader actually sees.
  itInherits({ name: 'neutral tone', type: 'RelativeTime', props: RT, pick: sel('time') });

  it('the semantic tones are untouched', () => {
    const { container } = drawInCard('RelativeTime', { ...RT, tone: 'critical' });
    expect(inkAt(sel('time')(container), frameOf(container))).toEqual(
      resolveColor('var(--color-danger)', [0, 0, 0], VARS),
    );
  });
});

describe('data-longtail — JsonView (a 30% wash owns nothing)', () => {
  const JSON_PROPS = { data: { a: 1 } };

  it('the panel does not reset the ink, and its surface is 70% of what is behind', () => {
    const { container } = drawInCard('JsonView', JSON_PROPS);
    const root = frameOf(container);
    const panel = sel('div.font-mono')(container);
    expect(colorExprOf(panel)).toBe('inherit');
    expect(inkAt(panel, root)).toEqual(AUTHORED);
    // The measurement that decided it: on this surface the token is the one value
    // that cannot be right — 2.52 against 5.62 for the inherited ink.
    const surface = surfaceAt(panel, root);
    expect(contrast(TOKEN_FG, surface)).toBeLessThan(3);
    expect(contrast(AUTHORED, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('unchanged at the top level (byte-identical default)', () => {
    const { container } = draw('JsonView', JSON_PROPS);
    expect(inkAt(sel('div.font-mono')(container), frameOf(container))).toEqual(TOKEN_FG);
  });

  it('the row hover follows the resting ink instead of re-pinning the token', () => {
    const { container } = draw('JsonView', { data: { a: { b: 1 } } });
    const row = container.querySelector('span.cursor-pointer')!;
    expect(row.classList.contains('hover:text-inherit')).toBe(true);
    expect(row.classList.contains('hover:text-foreground')).toBe(false);
  });

  /* Was "KEEPS its token hover — it paints its own bg-card chip". The premise was that
     painting its own chip made the chip's colour independent of the page. It did not:
     bg-card is FLAT, so on a dark card the chip rendered #1c1c20 on #1c1c20 and simply
     disappeared. The chip is a RAISED surface — it sits ON its ground — so it now reads
     --fr-surface-raised (16%, twice the sunken/field lift) and its ink travels with it.
     Byte-identical in light: 16% white into #ffffff is still #ffffff. The hover stays a
     token hover, which is what this file actually guards. */
  it('the copy button rides the raised channel — chip and ink together', () => {
    const { container } = draw('JsonView', { ...JSON_PROPS, copyable: true });
    const btn = container.querySelector('button')!;
    expect(btn.classList.contains('bg-[color:var(--fr-surface-raised,var(--color-card))]')).toBe(true);
    expect(btn.classList.contains('bg-card')).toBe(false);
    // The chip carries NO resting ink class and should not: a raised surface INHERITS
    // the ink its ground published, which is what makes it legible on a dark card
    // without pinning anything. The hover token stays — it moves with the 1c pass.
    expect(btn.classList.contains('text-foreground')).toBe(false);
    expect(btn.classList.contains('hover:text-foreground')).toBe(true);
  });
});

describe('data-longtail — Menubar and Fab KEEP their tokens', () => {
  // LEFT DELIBERATELY: the bar and the dropdown panel are both bg-card, the open
  // trigger paints bg-muted, and the Fab chip paints bg-card.
  itKeepsTheToken({
    name: 'Menubar trigger (bar is bg-card)',
    type: 'Menubar',
    props: { menus: [{ label: 'File', items: [{ label: 'New' }] }] },
    pick: byText('File'),
  });
  // The FAB's `--color-foreground` read is a BACKGROUND chain paired with an
  // on-fill `--color-card` ink — not ink resting on someone else's surface.
  itKeepsTheToken(
    { name: 'Fab main button (its own foreground fill)', type: 'Fab', props: { label: 'Actions' }, pick: sel('button') },
    resolveColor('var(--color-card)', [0, 0, 0], VARS),
  );
});

/* ── notification-center.tsx — NO CHANGE, and this is why ──────────────────── */

describe('notification-center — the whole inbox paints bg-card', () => {
  const NTF = { items: [{ title: 'Deploy done', body: 'v2 live', unread: true }] };

  itKeepsTheToken({ name: 'header title', type: 'NotificationCenter', props: NTF, pick: sel('h3') });
  itKeepsTheToken({ name: 'row title', type: 'NotificationCenter', props: NTF, pick: sel('p.line-clamp-2') });
  itKeepsTheToken({
    name: 'row action button',
    type: 'NotificationCenter',
    props: { items: [{ title: 'Deploy done', actions: [{ label: 'View' }] }] },
    pick: byText('View'),
  });

  it('the shell really is opaque — the leave-decision rests on it', () => {
    const { container } = drawInCard('NotificationCenter', NTF);
    const shell = container.querySelector('div.rounded-lg')!;
    expect(fillOf(shell)).toEqual({ expr: 'var(--color-card)', alpha: 1 });
    expect(surfaceAt(sel('h3')(container), frameOf(container))).toEqual(
      resolveColor('var(--color-card)', [0, 0, 0], VARS),
    );
  });
});

/* ── log-console.tsx — NO CHANGE, and this is why ──────────────────────────── */

describe('log-console — the scroller paints the surface under the log body', () => {
  const LOGS = { lines: [{ text: 'boot ok', level: 'info' }, { text: 'plain line' }], showToolbar: true };

  it('the log surface is the console\'s own, not the container\'s', () => {
    // This is the site that most LOOKS like it should inherit — monospace content
    // in a frame — and the measurement says otherwise: the scroller carries an
    // inline `background-color: var(--fr-log-bg, var(--color-card))`, so inside a
    // dark card the rows are still on #ffffff. text-foreground reads 17.72 there;
    // inheriting the card's #e2e6f0 would read 1.25 — white on white.
    const { container } = drawInCard('LogConsole', LOGS);
    const root = frameOf(container);
    const scroller = container.querySelector('[role="log"]')!;
    expect(fillOf(scroller)).toEqual({ expr: 'var(--fr-log-bg, var(--color-card))', alpha: 1 });
    const line = byText('plain line')(container);
    expect(inkAt(line, root)).toEqual(TOKEN_FG);
    expect(contrast(TOKEN_FG, surfaceAt(line, root))).toBeGreaterThan(contrast(AUTHORED, surfaceAt(line, root)));
    expect(contrast(TOKEN_FG, surfaceAt(line, root))).toBeGreaterThanOrEqual(4.5);
  });

  itKeepsTheToken({ name: 'info row text', type: 'LogConsole', props: LOGS, pick: byText('boot ok') });
  // The severity chip paints its own bg-muted — the same string serves both
  // readers, and both own their surface, so one decision covers them.
  itKeepsTheToken({ name: 'info severity chip', type: 'LogConsole', props: LOGS, pick: byText('info') });
  itKeepsTheToken({
    name: 'search field (bg-card)',
    type: 'LogConsole',
    props: LOGS,
    pick: sel('input[type="search"]'),
  });
});
