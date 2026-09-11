/**
 * INHERITED-FOREGROUND guard — data-display-extended.tsx · charts-extra.tsx ·
 * editable-spreadsheet-grid.tsx (the grid/charts group).
 *
 * Same defect and same rule as the other inherited-foreground-*.test.tsx files: a spec authors
 * `Card { bg:"#12161f", color:"#e2e6f0" }`, the ink inherits down, and then a
 * component RESETS it to the global token — text the same colour as the surface
 * it sits on. What this file adds is the OTHER half of the rule, because two of
 * its three files turned out to be on that side of it: an element that paints its
 * OWN surface must keep the token its fill is partnered with, and "fix" it by
 * inheriting and you get the identical bug pointing the other way.
 *
 * Every number below was measured twice: once here (the frayme.css var chains,
 * resolved as CSS resolves them) and once in a real Chrome cascade over the
 * components' own markup with the accessibility audit's own contrast math. They agree.
 *
 *   MOVED (chain now ends in the inherited ink)          in-card   at root
 *     Stat value, stack layout + StatGroup    1.02:1  →  14.49:1   17.72:1 (same)
 *     PageHeader title, off-band              1.02:1  →  14.49:1   17.72:1 (same)
 *     Tag variant:outline tone:neutral        1.02:1  →  14.49:1   17.72:1 (same)
 *
 *   LEFT ALONE (paints its own fill — inheriting would BREAK it)
 *     spreadsheet cell   17.72:1 as shipped · 1.25:1 if it inherited (own bg-card)
 *     Tag soft neutral   16.12:1 as shipped · 1.14:1 if it inherited (own bg-muted)
 *     Tag solid neutral  17.72:1 as shipped (text-card on bg-foreground)
 *     Heatmap cell value 13.91:1 as shipped · 1.02:1 if it inherited (own scale mix)
 *     PageHeader banded  7.90:1 as shipped (accentText on its own band)
 *     Tag outline tone:critical / an authored Stat `accent` — a SEMANTIC or
 *     model-named colour names a meaning, not a surface, and stays pinned.
 *
 * The spreadsheet cell is the case first reported as the plainest form of the
 * defect (a bare `text-foreground`). It is not one: the grid's root paints an
 * opaque `bg-card` panel, and a Card's authored `bg` sets --fr-card-bg, never
 * --color-card — so the cell text is on a WHITE panel inside the dark card, at
 * 17.72:1 (16.27:1 in dark mode). It is guarded here in the negative, because
 * applying the doctrine to it is a plausible next edit and would take it to
 * 1.25:1.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* ── the token table, read from the stylesheet that ships ──────────────────── */
/* (same idiom as inherited-foreground-actions-nav-marketing — a hard-coded hex would stop measuring the
   moment frayme.css re-tunes a token, which it has done.) */

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
 *  `inherited` is what the element would inherit — which is what CSS computes
 *  `currentColor` to on the `color` property (CSS Color 4 treats it as
 *  `color: inherit` there), so there is no cycle.
 *
 *  `onUnset` is the other half of that rule and it is load-bearing here, not a
 *  convenience: `var(--x)` with --x unset and no fallback is invalid at
 *  computed-value time, which on an INHERITED property (color) means `inherit`
 *  and on a non-inherited one (background) means the initial value. Stat's split
 *  layout has always relied on the first half — its root is not statWrap, so
 *  --fr-stat-accent is unset there and the figure inherits. */
function resolveColor(
  expr: string,
  inherited: RGB,
  vars: Record<string, string>,
  onUnset: 'inherit' | 'invalid' = 'invalid',
): RGB {
  const e = expr.replace(/_/g, ' ').trim(); // Tailwind encodes spaces as underscores
  if (/^(currentcolor|inherit)$/i.test(e)) return inherited;
  if (e.startsWith('#')) return hexToRgb(e);
  if (e.startsWith('var(')) {
    const args = splitTop(e.slice(4, -1));
    const value = vars[args[0]];
    if (value != null) return resolveColor(value, inherited, vars, onUnset);
    if (args.length > 1) return resolveColor(args.slice(1).join(','), inherited, vars, onUnset);
    if (onUnset === 'inherit') return inherited;
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

/* ── reading the ink and the SURFACE an element actually paints ────────────── */

const TEXT_TOKEN: Record<string, string> = {
  foreground: 'var(--color-foreground)',
  card: 'var(--color-card)',
  'card-foreground': 'var(--color-card-foreground)',
  'muted-foreground': 'var(--color-muted-foreground)',
  danger: 'var(--color-danger)',
  inherit: 'inherit',
  current: 'currentColor',
};

/** Opaque background utilities used by the components under test. A translucent
 *  or unresolvable fill is NOT treated as a surface — the walk continues, the
 *  same refusal-to-guess the audit makes. */
const BG_TOKEN: Record<string, string> = {
  card: 'var(--color-card)',
  muted: 'var(--color-muted)',
  foreground: 'var(--color-foreground)',
};

/** The RESTING colour expression this element sets, or null when it only
 *  inherits. Modifier-scoped classes (`hover:` / `focus-*`) are skipped — they
 *  are not the resting state the audit measures. */
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

/** The RESTING opaque background expression, or null.
 *
 *  The arbitrary form WINS over the token utility when an element carries both,
 *  which Card does (`bg-card` from the recipe plus `[background:var(--fr-card-bg,
 *  …)]` added when `bg` is authored — two different tw-merge groups, so neither
 *  dedupes the other and the arbitrary property is what paints). Reading the
 *  token first is how this file's resolver first "measured" an authored dark card as
 *  white. */
function bgExprOf(el: Element): string | null {
  let token: string | null = null;
  for (const c of el.className.split(/\s+/).filter(Boolean)) {
    if (c.includes(':') && !c.startsWith('[') && !c.startsWith('bg-[')) continue; // hover:/focus-visible:
    let m = /^\[background:(.+)\]$/.exec(c) ?? /^bg-\[color:(.+)\]$/.exec(c);
    if (m) return m[1];
    m = /^bg-([a-z-]+)$/.exec(c);
    if (m && BG_TOKEN[m[1]] != null) token = BG_TOKEN[m[1]];
  }
  return token;
}

/** Custom properties the element declares — via the Tailwind arbitrary-property
 *  class form (`[--fr-stat-accent:currentColor]`) and INLINE (styleVars). Both
 *  inherit, so the walk accumulates them down the chain; inline is applied LAST
 *  because that is the cascade — a model-named `accent` must beat the recipe's
 *  default, and reading them the other way round is how this file's resolver first
 *  "measured" an authored accent as being ignored. */
function varsOn(el: Element): Record<string, string> {
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

/** root → el, inclusive. */
function chainTo(container: HTMLElement, el: Element): Element[] {
  const out: Element[] = [];
  for (let p: Element | null = el; p != null && p !== container; p = p.parentElement) out.unshift(p);
  return out;
}

/** The page's own ink — `.frayme-root { color: var(--frayme-fg) }`. */
const ROOT_INK: RGB = resolveColor('var(--frayme-fg)', [0, 0, 0], VARS);
/** …which is the same value `--color-foreground` resolves to. That equality is
 *  what makes substituting currentColor byte-identical at the top level, so it is
 *  asserted rather than assumed (see the `frayme.css` case at the bottom). */
const TOKEN_FG: RGB = resolveColor('var(--color-foreground)', [0, 0, 0], VARS);

/** Fold the chain the way the cascade does: ink and custom properties inherit,
 *  each element's own colour class resolving against what it inherits. */
function inkAt(container: HTMLElement, el: Element): RGB {
  let ink = ROOT_INK;
  let vars = { ...VARS };
  for (const node of chainTo(container, el)) {
    vars = { ...vars, ...varsOn(node) };
    const expr = colorExprOf(node);
    if (expr != null) ink = resolveColor(expr, ink, vars, 'inherit');
  }
  return ink;
}

/** The first opaque surface at or above `el` — what its text is actually read
 *  against. Nothing is guessed: an unresolvable fill just isn't a surface. */
function surfaceAt(container: HTMLElement, el: Element): { rgb: RGB; from: Element } {
  const chain = chainTo(container, el);
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const node = chain[i];
    const expr = bgExprOf(node);
    if (expr == null) continue;
    let vars = { ...VARS };
    for (const a of chain.slice(0, i + 1)) vars = { ...vars, ...varsOn(a) };
    try {
      return { rgb: resolveColor(expr, inkAt(container, node), vars), from: node };
    } catch {
      continue; // color-mix()/gradient — not resolvable here, keep walking
    }
  }
  return { rgb: hexToRgb('#ffffff'), from: container }; // the page's own surface
}

/* ── the two renders every case is measured on ─────────────────────────────── */

const CARD_BG = '#12161f';
const CARD_FG = '#e2e6f0';
const AUTHORED: RGB = hexToRgb(CARD_FG);
const SURFACE: RGB = hexToRgb(CARD_BG);

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

function cardInk(container: HTMLElement): RGB {
  const card = container.querySelector('section.fr-frame')!;
  expect(card, 'the authored Card').not.toBeNull();
  return inkAt(container, card);
}

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
    expect(cardInk(container)).toEqual(AUTHORED);
    const el = c.pick(container);
    const ink = inkAt(container, el);
    expect(ink, 'reset to the global token instead of inheriting').not.toEqual(TOKEN_FG);
    expect(ink).toEqual(AUTHORED);
    // …measured against the surface it is REALLY on — which for these is the card.
    const surface = surfaceAt(container, el);
    expect(surface.rgb).toEqual(SURFACE);
    expect(contrast(ink, surface.rgb)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKEN_FG, surface.rgb)).toBeLessThan(1.1); // what it used to be
  });

  it(`${c.name}: unchanged on the page's own surface (byte-identical default)`, () => {
    const { container } = draw(c.type, c.props);
    expect(inkAt(container, c.pick(container))).toEqual(TOKEN_FG);
  });
}

/** Cases whose element paints its OWN opaque fill → it must NOT inherit.
 *
 *  `lightFill` also asserts the counterfactual — on a LIGHT slab the card's light
 *  ink is a measurable contrast failure, the same bug reversed. On a dark slab
 *  (Tag solid paints bg-foreground) inheriting is not a contrast failure, it is
 *  the semantic one: the chip would print the card's ink instead of the token its
 *  own fill is partnered with, and would break the moment the card is light. */
function itKeepsItsTokenOnItsOwnFill(c: Case, expectedInk: RGB, lightFill = true): void {
  it(`${c.name}: keeps its own ink — it painted the surface under it`, () => {
    const { container } = drawInCard(c.type, c.props);
    const el = c.pick(container);
    const ink = inkAt(container, el);
    expect(ink).toEqual(expectedInk);
    expect(ink, 'inherited the card ink onto a surface it painted itself').not.toEqual(AUTHORED);
    const surface = surfaceAt(container, el);
    expect(surface.rgb, 'measured against the card instead of its own fill').not.toEqual(SURFACE);
    expect(contrast(ink, surface.rgb)).toBeGreaterThanOrEqual(4.5);
    if (lightFill) expect(contrast(AUTHORED, surface.rgb)).toBeLessThan(1.3);
  });
}

const byText = (t: string) => (c: HTMLElement): Element =>
  [...c.querySelectorAll('span,h1,h2,h3,p,a,button')].find((e) => e.textContent === t)!;

/* ══════════════════════════════════════════════════════════════════════════ */

describe('data-display-extended.tsx — Stat', () => {
  const KPI = { label: 'Monthly recurring revenue', value: '£48,210' };

  // The figure is the one datum a tile exists for. statWrap's --fr-stat-accent
  // default was the global token; the tile paints nothing, so it is now the
  // inherited ink.
  itInherits({ name: 'stack value', type: 'Stat', props: KPI, pick: byText('£48,210') });

  // The SPLIT layout never had the bug (its root is not statWrap, so the var was
  // simply unset and `color: var(--fr-stat-accent)` fell back to inherit). It is
  // pinned here because it is the proof the two layouts now agree.
  itInherits({
    name: 'split value',
    type: 'Stat',
    props: { ...KPI, layout: 'split' },
    pick: byText('£48,210'),
  });

  it('a model-named accent still wins over the inherited ink', () => {
    const { container } = drawInCard('Stat', { ...KPI, accent: '#c026d3' });
    expect(inkAt(container, byText('£48,210')(container))).toEqual(hexToRgb('#c026d3'));
  });

  it('the sparkline follows the figure — its chain still ends at --fr-stat-accent', () => {
    const { container } = drawInCard('Stat', { ...KPI, sparkline: [3, 5, 4, 8] });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('class')).toContain('text-[var(--fr-stat-spark,var(--fr-stat-accent))]');
    // a mono trend line is the figure's ink, so it moved with it (it was equally
    // invisible on the dark card); an authored sparklineColor still overrides.
    expect(svg.querySelector('polyline')!.getAttribute('stroke')).toBe('currentColor');
  });
});

describe('data-display-extended.tsx — PageHeader', () => {
  const HDR = { title: 'Billing overview', eyebrow: 'Settings' };

  itInherits({ name: 'title off a band', type: 'PageHeader', props: HDR, pick: (c) => c.querySelector('h1')! });

  it('a BANDED header keeps its band text — it paints the fill under it', () => {
    // `bg` makes styleVars set --fr-pageheader-accent to accentText (default
    // #ffffff), so the CVA default never applies. Inheriting the card's ink onto
    // an author-coloured band is the same bug reversed.
    const { container } = drawInCard('PageHeader', { ...HDR, bg: '#4338ca' });
    const title = container.querySelector('h1')!;
    expect(inkAt(container, title)).toEqual(hexToRgb('#ffffff'));
    const surface = surfaceAt(container, title);
    expect(surface.rgb).toEqual(hexToRgb('#4338ca'));
    expect(contrast(inkAt(container, title), surface.rgb)).toBeGreaterThanOrEqual(4.5);
  });

  it('an authored accentText still wins', () => {
    const { container } = drawInCard('PageHeader', { ...HDR, bg: '#fde68a', accentText: '#111827' });
    expect(inkAt(container, container.querySelector('h1')!)).toEqual(hexToRgb('#111827'));
  });
});

describe('data-display-extended.tsx — Tag', () => {
  const label = (c: HTMLElement): Element => c.querySelector('span > span.break-words')!;

  // `outline` is the ONE variant that paints nothing (bg-transparent).
  itInherits({
    name: 'outline neutral',
    type: 'Tag',
    props: { label: 'Draft', variant: 'outline' },
    pick: label,
  });

  // soft (bg-muted) and solid (bg-foreground) paint their own slab.
  /* Tag soft/neutral has LEFT this helper, deliberately.

     The helper's contract is "it painted the surface under it, so it keeps its own
     token", and its last assertion is contrast(AUTHORED, surface) < 1.3 — i.e. the
     fill is a LIGHT one, unrelated to the card behind it. That was true while the
     fill was --color-muted. It is exactly the property the surface channel removes:
     soft/neutral now paints color-mix(<paired ink> 8%, <the card's bg>), which on a
     dark card is DARK, and its ink is the ink derived from that same surface.

     So the measured invariant cannot apply and is replaced by the structural one —
     fill and ink both on the channel, global tokens still last. The other members of
     this describe block genuinely do paint light fills of their own and keep the
     helper. */
  it('soft neutral: fill and ink both ride the surface channel', () => {
    const { container } = drawInCard('Tag', { label: 'Draft' });
    // `label` picks the inner text span, which INHERITS; the fill and its paired ink
    // are declared together on the chip that wraps it, which is what must be asserted.
    const chip = label(container).closest('span[class*="bg-"]') ?? label(container).parentElement!;
    const cls = chip.getAttribute('class') ?? '';
    expect(cls).toContain('bg-[color:var(--fr-surface-sunken,var(--color-muted))]');
    expect(cls).toContain('text-[color:var(--fr-surface-fg,var(--color-foreground))]');
    // both chains still end in their global token, so an unstyled page is unchanged
    expect(cls).not.toMatch(/(^|\s)bg-muted(\s|$)/);
    expect(cls).not.toMatch(/(^|\s)text-foreground(\s|$)/);
  });
  itKeepsItsTokenOnItsOwnFill(
    { name: 'solid neutral', type: 'Tag', props: { label: 'Draft', variant: 'solid' }, pick: label },
    resolveColor('var(--color-card)', [0, 0, 0], VARS),
    false, // its slab is bg-foreground — dark; see the helper's note
  );

  it('a SEMANTIC tone stays pinned — it names a meaning, not a surface', () => {
    const { container } = drawInCard('Tag', { label: 'Failed', variant: 'outline', tone: 'critical' });
    expect(inkAt(container, label(container))).toEqual(resolveColor('var(--color-danger)', [0, 0, 0], VARS));
  });

  it('a model-named color still wins on the outline chip', () => {
    const { container } = drawInCard('Tag', { label: 'Draft', variant: 'outline', color: '#f59e0b' });
    expect(inkAt(container, label(container))).toEqual(hexToRgb('#f59e0b'));
  });
});

describe('editable-spreadsheet-grid.tsx — the cell that must NOT join the rename', () => {
  // This was first reported as the plainest inherited-foreground defect. It
  // is not one, and this is the measurement: the grid root paints an opaque
  // `bg-card` panel, and a Card's authored `bg` sets --fr-card-bg, never
  // --color-card — so the cell text is on WHITE inside the dark card.
  it('cell text is read against the grid\'s own panel, not the card', () => {
    const { container } = drawInCard('EditableSpreadsheetGrid', {});
    const cell = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Design retainer')!;
    const surface = surfaceAt(container, cell);
    expect(surface.from.className).toContain('bg-card');
    expect(surface.rgb).toEqual(resolveColor('var(--color-card)', [0, 0, 0], VARS));
    expect(surface.rgb).not.toEqual(SURFACE);
    const ink = inkAt(container, cell);
    expect(ink).toEqual(TOKEN_FG);
    expect(contrast(ink, surface.rgb)).toBeGreaterThanOrEqual(4.5); // 17.72:1
    // …and the counterfactual that makes this a guard rather than a note: the
    // card's light ink on the grid's white panel is 1.25:1.
    expect(contrast(AUTHORED, surface.rgb)).toBeLessThan(1.3);
  });

  it('the sticky header keeps its opaque bg-card too', () => {
    const { container } = drawInCard('EditableSpreadsheetGrid', {});
    const th = container.querySelector('th')!;
    expect(th.className).toContain('bg-card');
    expect(contrast(inkAt(container, th), surfaceAt(container, th).rgb)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('charts-extra.tsx — the label inherits, the series ink does not', () => {
  it('BarList: the row LABEL inherits, the bar FILL keeps its palette colour', () => {
    const { container } = drawInCard('BarList', { data: [{ label: '/pricing', value: 870 }] });
    const label = container.querySelector('span.break-words')!;
    expect(inkAt(container, label)).toEqual(AUTHORED);
    expect(contrast(inkAt(container, label), SURFACE)).toBeGreaterThanOrEqual(4.5);
    // The mark is data, not text: its chain is value > accent > palette > primary
    // and must never end in currentColor, or every bar becomes the label's colour.
    const fill = container.querySelector('[style*="--fr-bar-w-fill"]')!;
    expect(fill.getAttribute('style')).toContain('var(--color-primary)');
    expect(fill.getAttribute('style')).not.toContain('currentColor');
  });

  it('Gantt: the task NAME inherits, the task bar keeps its own fill', () => {
    const { container } = drawInCard('Gantt', { tasks: [{ label: 'Discovery', start: 0, end: 3 }] });
    const name = container.querySelector('span.break-words')!;
    expect(inkAt(container, name)).toEqual(AUTHORED);
    const bar = container.querySelector('[style*="--fr-gantt-w-fill"]')!;
    expect(bar.getAttribute('style')).not.toContain('currentColor');
  });

  it('Heatmap: the in-cell value KEEPS --color-foreground — the cell paints itself', () => {
    // The cell fill is a color-mix of the scale colour into --color-muted, and a
    // Card's authored `bg` re-points --fr-card-bg, never --color-muted — so a
    // low-alpha cell is a near-white square inside a dark card. Measured in
    // Chrome: the token reads 13.91:1 on that square, the card's light ink 1.02:1.
    const { container } = drawInCard('Heatmap', { cells: [[11, 66, 99]], showValues: true });
    const cell = [...container.querySelectorAll('span')].find((s) => s.textContent === '11')!;
    expect(cell.className).toContain('text-[color:var(--fr-heat-value,var(--color-foreground))]');
    expect(cell.className).toContain('background:color-mix(');
    expect(inkAt(container, cell)).toEqual(TOKEN_FG);
  });
});

describe('frayme.css — the equality the whole rename rests on', () => {
  it('.frayme-root { color } and --color-foreground are the same --frayme-fg', () => {
    expect(ROOT_INK).toEqual(TOKEN_FG);
  });
});
