/**
 * INHERITED-FOREGROUND guard — inputs-date · util-overlay · layout · layout-primitives.
 *
 * Same defect class as the other inherited-foreground-*.test.tsx files. A spec authors
 * `Card { bg:"#12161f", color:"#e2e6f0" }` CORRECTLY, the colour lands on the
 * <section> and inherits down, and then a control RESETS it to the global token.
 * Measured on a generated feature-flag console before the fix:
 *
 *   SECTION fr-frame bg-card  color rgb(226,230,240)  bg rgb(18,22,31)  <- authored
 *   DIV     fr-stack          color rgb(226,230,240)                    <- inherits
 *   BUTTON  inline-flex …     color rgb(24,24,27)                       <- RESETS 1.02:1
 *   SPAN    break-words       color rgb(24,24,27)                       <- inherits the reset
 *
 * The fix is `currentColor` as the LAST RESORT of a foreground chain. It is safe
 * because frayme.css points BOTH `.frayme-root { color }` and `--color-foreground`
 * at `--frayme-fg` — the premise is re-read from the stylesheet in the first
 * describe below rather than trusted. On the `color` property `currentColor`
 * computes to the INHERITED value (CSS Color 4 treats it as `color: inherit`
 * there), so it is not a cycle.
 *
 * WHY THIS FILE MEASURES RATHER THAN GREPS (the actions/nav resolver, extended twice).
 * A class-string assertion cannot tell `currentColor` from `text-foreground` in
 * the only way that matters — what the reader sees. So each case resolves the
 * surviving colour class through the REAL var chain in frayme.css and asserts the
 * ink twice: inside the authored card it must be the authored ink (and ≥4.5:1 on
 * that bg), at the top level it must still be exactly --color-foreground.
 * The two extensions this file needed:
 *   · the ink is folded down the WHOLE chain from the render root, because that is
 *     what the trace above measures, and because two of these fixes only work
 *     together (the DateRangePicker popover shell declares the ink its now-
 *     inheriting preset chips stand on);
 *   · `color-mix()` is resolved, because Tabs paints its selected label through
 *     one. sRGB interpolation is used for the mix, which is exact for the only
 *     numeric case asserted here — the neutral default, where both sides of the
 *     mix are the same colour, so the interpolation space cannot matter. The
 *     BRANDED blend (a real accent, oklab) is asserted structurally instead.
 *
 * It is NOT a blanket rename, and the second half of every describe is what pins
 * that. An element painting its OWN opaque fill keeps the token its fill is
 * partnered with — an authored Card's `bg` sets --fr-card-bg, never --color-card
 * or --color-muted, so those slabs are still LIGHT inside a dark card and
 * inheriting its near-white ink there would be the same bug pointing the other way.
 */
import { fireEvent, render } from '@testing-library/react';
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

const ROOT_BLOCK = cssBlock(/^\.frayme-root\s*\{/m);

/** Every `--x: value;` declaration in a block. */
const declsIn = (blk: string): Record<string, string> =>
  Object.fromEntries([...blk.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const VARS = declsIn(ROOT_BLOCK);

/* ── a resolver for the slice of CSS colour syntax these classes use ───────── */

type RGB = [number, number, number];

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

const hexToRgb = (h: string): RGB => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
};

/** `var(--a,fallback)` · `color-mix(in <space>,A p%,B)` · `currentColor` ·
 *  `inherit` · `#rrggbb`.
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
  if (/^color-mix\(/i.test(e)) {
    const [, first, second] = splitTop(e.slice(e.indexOf('(') + 1, -1));
    const pct = /\s([\d.]+)%$/.exec(first);
    const w = pct != null ? Number(pct[1]) / 100 : 0.5;
    const a = resolveColor(pct != null ? first.slice(0, pct.index) : first, inherited, vars);
    const b = resolveColor(second, inherited, vars);
    return a.map((v, i) => Math.round(v * w + b[i] * (1 - w))) as RGB;
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

/** The token utilities that set `color` and appear in these four files. */
const TEXT_TOKEN: Record<string, string> = {
  foreground: 'var(--color-foreground)',
  card: 'var(--color-card)',
  'card-foreground': 'var(--color-card-foreground)',
  'muted-foreground': 'var(--color-muted-foreground)',
  current: 'currentColor',
  inherit: 'inherit',
};

/** The RESTING colour expression this element sets, or null when it only
 *  inherits. Modifier-scoped classes (`hover:` / `focus-*` / `disabled:`) are
 *  skipped — they are not the resting state the audit measures. cn() has already
 *  collapsed the group, so at most one survives per form; more than one would
 *  mean a tw-merge trap and is failed loudly. */
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

/** Custom properties this element DECLARES — inline (styleVars output) and via
 *  the arbitrary-property class form `[--fr-x:value]`, which is how the recipes
 *  carry their quiet defaults (--fr-acc-accent, --fr-tabs-ink, …). */
function declaredVars(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of el.className.split(/\s+/).filter(Boolean)) {
    const m = /^\[(--[a-z0-9-]+):(.+)\]$/.exec(c);
    if (m) out[m[1]] = m[2].replace(/_/g, ' ');
  }
  const st = (el as HTMLElement).style;
  for (let i = 0; i < st.length; i += 1) {
    const n = st[i];
    if (n.startsWith('--')) out[n] = st.getPropertyValue(n).trim();
  }
  return out;
}

const CARD_BG = '#12161f';
const CARD_FG = '#e2e6f0';
const AUTHORED: RGB = hexToRgb(CARD_FG);
const SURFACE: RGB = hexToRgb(CARD_BG);
/** The page's own ink — `.frayme-root { color: var(--frayme-fg) }`. */
const ROOT_INK: RGB = resolveColor('var(--frayme-fg)', [0, 0, 0], VARS);
/** …the same value `--color-foreground` resolves to (asserted, not assumed). */
const TOKEN_FG: RGB = resolveColor('var(--color-foreground)', [0, 0, 0], VARS);

/** The ink `el` paints, folded from the render root DOWN the whole chain — every
 *  ancestor that declares a colour replaces what its children inherit, and every
 *  custom property in scope comes from the same walk (nearest declaration wins). */
function inkAt(container: HTMLElement, el: Element): RGB {
  const chain: Element[] = [];
  for (let n: Element | null = el; n != null && n !== container; n = n.parentElement) chain.unshift(n);
  let ink = ROOT_INK;
  let vars = { ...VARS };
  for (const node of chain) {
    vars = { ...vars, ...declaredVars(node) };
    const expr = colorExprOf(node);
    if (expr != null) ink = resolveColor(expr, ink, vars);
  }
  return ink;
}

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
type Case = { name: string; type: string; props: Record<string, unknown>; pick: Pick; open?: (c: HTMLElement) => void };

const target = (c: HTMLElement, k: Case): Element => {
  k.open?.(c);
  const el = k.pick(c);
  expect(el, `${k.name}: the probe matched nothing`).not.toBeNull();
  return el;
};

/** Cases whose element paints NO fill of its own → it must inherit. */
function itInherits(k: Case): void {
  it(`${k.name}: inherits the authored ink inside a dark card`, () => {
    const { container } = drawInCard(k.type, k.props);
    const ink = inkAt(container, target(container, k));
    expect(ink, 'reset to the global token instead of inheriting').not.toEqual(TOKEN_FG);
    expect(ink).toEqual(AUTHORED);
    // …and the outcome the audit actually scores. The pre-fix ink measured 1.02.
    expect(contrast(ink, SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKEN_FG, SURFACE)).toBeLessThan(1.1);
  });

  it(`${k.name}: unchanged on the page's own surface`, () => {
    const { container } = draw(k.type, k.props);
    expect(inkAt(container, target(container, k))).toEqual(TOKEN_FG);
  });
}

/** Cases whose element stands on an OPAQUE fill → it must NOT inherit. */
function itKeepsTheToken(k: Case, expected: RGB = TOKEN_FG): void {
  it(`${k.name}: keeps the token — it stands on a fill of its own`, () => {
    const { container } = drawInCard(k.type, k.props);
    expect(inkAt(container, target(container, k))).toEqual(expected);
  });
}

const byClassPart = (part: string): Pick => (c) =>
  [...c.querySelectorAll('*')].find((e) => e.className.includes(part))!;
const sel = (q: string): Pick => (c) => c.querySelector(q)!;

/* ══ the premise, re-read from the stylesheet ═══════════════════════════════ */

describe('the substitution is safe because these two are the same value', () => {
  it('frayme.css points BOTH the root color and --color-foreground at --frayme-fg', () => {
    expect(ROOT_BLOCK).toMatch(/(^|[\s;])color:\s*var\(--frayme-fg\)\s*;/);
    expect(VARS['--color-foreground']).toBe('var(--frayme-fg)');
    // Which is what makes every "unchanged at the top level" assertion below a
    // real proof rather than a restatement: currentColor there IS the token.
    expect(ROOT_INK).toEqual(TOKEN_FG);
  });
});

/* ══ layout-primitives.tsx ═════════════════════════════════════════════════ */

describe('layout-primitives — the band title and the on-surface colour channels', () => {
  itInherits({
    name: 'Section title (text-current, was text-foreground)',
    type: 'Section',
    props: { title: 'Rollout' },
    pick: sel('h2'),
  });

  // The container channels are CONDITIONAL — the class is emitted only when the
  // model named a `color`, so the fallback is the INVALID-value path (styleVars
  // drops an unparseable colour). `slate-200` is the shape of that mistake: a
  // design-token name, not a CSS colour. Before the fix it reset the whole
  // subtree to near-black on the dark card; now it falls back to what OMITTING
  // `color` already does.
  for (const [type, extra] of [
    ['Box', {}],
    ['Container', {}],
    ['Section', {}],
    ['Stack', {}],
    ['Grid', { columns: 2 }],
  ] as const) {
    itInherits({
      name: `${type} with an INVALID color`,
      type,
      props: { color: 'slate-200', ...extra },
      pick: byClassPart('-fg,currentColor'),
    });
  }

  it('a VALID color still wins on all five — the fallback is not in play', () => {
    for (const [type, extra] of [
      ['Box', {}],
      ['Container', {}],
      ['Section', {}],
      ['Stack', {}],
      ['Grid', { columns: 2 }],
    ] as const) {
      const { container, unmount } = drawInCard(type, { color: '#ff8800', ...extra });
      expect(inkAt(container, byClassPart('-fg,currentColor')(container)), type).toEqual([255, 136, 0]);
      unmount();
    }
  });
});

/* ══ layout.tsx ════════════════════════════════════════════════════════════ */

describe('layout — the quiet accent defaults are the surface ink, not the token', () => {
  itInherits({
    name: 'Accordion open header (--fr-acc-accent)',
    type: 'Accordion',
    props: { items: [{ title: 'Regions', content: 'eu-west-1' }], defaultOpenIndex: 0 },
    pick: sel('button'),
  });

  itInherits({
    name: 'Collapsible header (--fr-coll-accent, every state)',
    type: 'Collapsible',
    props: { title: 'Advanced' },
    pick: sel('button'),
  });

  it('a model-named accent still overrides both defaults', () => {
    for (const [type, props] of [
      ['Accordion', { items: [{ title: 'Regions', content: 'x' }], defaultOpenIndex: 0, accent: '#ff8800' }],
      ['Collapsible', { title: 'Advanced', accent: '#ff8800' }],
    ] as const) {
      const { container, unmount } = drawInCard(type, props);
      expect(inkAt(container, container.querySelector('button')!), type).toEqual([255, 136, 0]);
      unmount();
    }
  });
});

describe('layout — Tabs: the underline label inherits, the pill slab does not', () => {
  const TABS = [
    { label: 'Overview', value: 'a' },
    { label: 'Usage', value: 'b' },
  ];
  const selected = sel('button[aria-selected="true"]');

  itInherits({
    name: 'underline selected label (--fr-tabs-ink)',
    type: 'Tabs',
    props: { tabs: TABS },
    pick: selected,
  });

  it('the underline INDICATOR resolves through the tab\'s own ink, so rule and label agree', () => {
    const { container } = drawInCard('Tabs', { tabs: TABS });
    const tab = selected(container);
    // The rule is `border-b-[color:var(--fr-tabs-accent)]`, and --fr-tabs-accent
    // is currentColor: on a border-color property that is the element's OWN color
    // — which IS the ink measured above. A near-black 2px rule on a dark navy
    // card was the same invisibility the label had.
    expect([...tab.classList]).toContain('border-b-[color:var(--fr-tabs-accent)]');
    const wrap = container.querySelector('[class*="--fr-tabs-accent"]')!;
    expect(declaredVars(wrap)['--fr-tabs-accent']).toBe('currentColor');
  });

  itKeepsTheToken({
    name: 'pill selected label (its own bg-card slab)',
    type: 'Tabs',
    props: { tabs: TABS, variant: 'pill' },
    pick: selected,
  });

  itKeepsTheToken({
    name: 'enclosed selected label (its own bg-card slab)',
    type: 'Tabs',
    props: { tabs: TABS, variant: 'enclosed' },
    pick: selected,
  });

  it('an ACCENTED pill reads the ON-FILL blend, an accented underline the inheriting one', () => {
    const { container } = drawInCard('Tabs', { tabs: TABS, variant: 'pill', accent: '#ff8800' });
    expect([...selected(container).classList]).toContain('text-[color:var(--fr-tabs-ink-fill)]');
    // Structural, not numeric: this blend is oklab and the two sides differ, which
    // is the one case sRGB interpolation above would not reproduce. What matters
    // is WHICH colour the 35% comes from — the token that partners the bg-card
    // slab the label stands on, never the container's ink.
    const wrap = container.querySelector('[class*="--fr-tabs-ink-fill"]')!;
    const vars = declaredVars(wrap);
    expect(vars['--fr-tabs-ink-fill']).toContain('var(--color-foreground)');
    expect(vars['--fr-tabs-ink-fill']).not.toContain('currentColor');
    expect(vars['--fr-tabs-ink']).toContain('currentColor');
  });
});

/* ══ util-overlay.tsx ══════════════════════════════════════════════════════ */

describe('util-overlay — unpainted text inherits, the bubbles keep their own fill', () => {
  itInherits({
    name: 'HoverCard string trigger (a word in the running text)',
    type: 'HoverCard',
    props: { trigger: 'Ada', title: 'Ada Lovelace' },
    pick: sel('span.underline'),
  });

  itInherits({
    name: 'Kbd outline (bg-transparent)',
    type: 'Kbd',
    props: { keys: 'Esc', variant: 'outline' },
    pick: sel('kbd'),
  });

  itKeepsTheToken({
    name: 'Kbd solid (its own --color-muted key slab)',
    type: 'Kbd',
    props: { keys: 'Esc' },
    pick: sel('kbd'),
  });

  for (const tone of ['success', 'warning', 'critical', 'info'] as const) {
    itInherits({
      name: `Highlight tone=${tone} (a 25-40% wash: the surface shows through)`,
      type: 'Highlight',
      props: { text: 'error rate', query: 'error', tone },
      pick: sel('mark'),
    });
  }

  itKeepsTheToken({
    name: 'Highlight tone=neutral (bg-muted is an opaque token fill)',
    type: 'Highlight',
    props: { text: 'error rate', query: 'error', tone: 'neutral' },
    pick: sel('mark'),
  });

  itKeepsTheToken({
    name: 'Highlight with a validated accent (it paints its own fill)',
    type: 'Highlight',
    props: { text: 'error rate', query: 'error', accent: '#ffe066' },
    pick: sel('mark'),
  });

  // The two absolutely-positioned bubbles are NOT portalled — they really do sit
  // inside the authored container — and they still keep the token, because each
  // paints an opaque theme fill (bg-muted / bg-card) that an authored `bg` never
  // re-points. Verified per surface, which is the whole point of the leave-list.
  itKeepsTheToken({
    name: 'Toggletip trigger (bg-muted)',
    type: 'Toggletip',
    props: { content: 'Only owners can edit' },
    pick: sel('button'),
  });

  itKeepsTheToken({
    name: 'Toggletip bubble (bg-card)',
    type: 'Toggletip',
    props: { content: 'Only owners can edit' },
    open: (c) => fireEvent.click(c.querySelector('button')!),
    pick: sel('span[role="status"]'),
  });

  itKeepsTheToken({
    name: 'HoverCard title (the card paints bg-card)',
    type: 'HoverCard',
    props: { trigger: 'Ada', title: 'Ada Lovelace' },
    open: (c) => fireEvent.focus(c.querySelector('span.underline')!),
    pick: sel('[role="tooltip"] span.font-semibold'),
  });

  // Both probes above are the TEXT, not the box: neither bubble declares an ink
  // on its own root, and picking the root measured the container's ink instead —
  // which is correct for those roots (they hold no bare text) and is exactly the
  // asymmetry that made the DateRangePicker popover shell need a declaration:
  // there, the chips inside it DO now inherit.
  it('every text node inside the two bubbles declares its own colour', () => {
    const { container } = drawInCard('HoverCard', { trigger: 'Ada', title: 'Ada Lovelace', description: 'Analyst' });
    fireEvent.focus(container.querySelector('span.underline')!);
    for (const t of ['Ada Lovelace', 'Analyst']) {
      const node = [...container.querySelectorAll('[role="tooltip"] span')].find((e) => e.textContent === t)!;
      expect(colorExprOf(node), t).not.toBeNull();
    }
  });
});

/* ══ inputs-date.tsx ═══════════════════════════════════════════════════════ */

describe('inputs-date — one chip inherits; every --color-card surface keeps the token', () => {
  const PRESETS = [{ label: 'Last 7 days', start: '2026-08-01', end: '2026-08-07' }];
  const chip = sel('[role="group"] button');

  itInherits({
    name: 'DateRangePicker INLINE preset chip (bg falls back to transparent)',
    type: 'DateRangePicker',
    props: { mode: 'inline', presets: PRESETS },
    pick: chip,
  });

  // The other half of that fix: in POPOVER mode the same chip stands on the
  // dialog shell's --color-card fill, and the shell now declares the ink for it.
  // If only one of the two edits lands, this is the assertion that fails.
  itKeepsTheToken({
    name: 'DateRangePicker POPOVER preset chip (on the shell it declares)',
    type: 'DateRangePicker',
    props: { presets: PRESETS },
    open: (c) => fireEvent.click(c.querySelector('button[aria-haspopup="dialog"]')!),
    pick: sel('[role="dialog"] [role="group"] button'),
  });

  itKeepsTheToken({
    name: 'Calendar day cell (the Calendar root paints --color-card)',
    type: 'Calendar',
    props: { month: '2026-08' },
    pick: sel('[role="gridcell"]'),
  });

  itKeepsTheToken({
    name: 'DatePicker month title (the panel paints --color-card)',
    type: 'DatePicker',
    props: { mode: 'inline', value: '2026-08-14' },
    pick: sel('span[aria-live="polite"]'),
  });

  itKeepsTheToken({
    name: 'DatePicker field box (it paints --color-card itself)',
    type: 'DatePicker',
    props: { mode: 'inline', value: '2026-08-14' },
    pick: byClassPart('[background:var(--fr-cal-bg,var(--color-card))]'),
  });
});
