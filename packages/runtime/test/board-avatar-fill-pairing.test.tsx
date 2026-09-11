/**
 * board-nav — the assignee avatar's INK must be paired with the fill it actually
 * paints, plus the two sites in this group that were measured and DELIBERATELY
 * left alone.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * The avatar chip has two possible fills:
 *
 *   --fr-kanbancard-avatar set   → a 15% wash of the card's mutedColor, i.e. a
 *                                  tint sitting ON the card surface
 *   unset                        → the flat --color-muted token (#f4f4f5)
 *
 * Only KanbanCard sets that var, and only when THAT card was given a
 * `mutedColor`. KanbanBoard's `columns` data path never sets it (it threads
 * --fr-kanbancard-bg/-bd/-fg and nothing else), and neither does BoardColumn.
 * So on a data-path board the chip is ALWAYS the near-white muted token — while
 * its ink read --fr-kanbancard-fg, the ink chosen to sit on the CARD fill.
 *
 * Measured on a real authoring (a dark console sample: KanbanBoard cardBg:#181d24
 * cardColor:#e8e4dc mutedColor:#93a0ad) the initials came out #e8e4dc on
 * #f4f4f5 — 1.15:1, invisible. The catalog tells authors to pair cardBg with
 * cardColor ("Pair with `cardBg` so a dark card fill keeps readable titles"), so
 * doing the documented thing is exactly what triggered it.
 *
 * The fix is the rule this whole group runs on, pointed the other way: an element
 * that paints its OWN fill takes the ink that partners THAT fill. The chip on the
 * muted token takes --color-foreground; the chip that is a wash over the card
 * takes the card's ink, which KanbanCard republishes as --fr-kanbancard-avatar-fg
 * in the SAME branch that derives the tint. Unset → --color-foreground, which is
 * precisely what the old chain resolved to whenever cardColor was absent, so the
 * default render is byte-identical.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* ── the palette, read from the stylesheet that ships (same idiom as
      board-nav-a11y.test.tsx — a hard-coded hex stops measuring the moment
      frayme.css re-tunes a token, which it has done) ─────────────────────────── */

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

/* ── the slice of CSS colour syntax these files use ─────────────────────────── */

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
 *  A p%, B)` computes, and what an alpha fill composites to over what is beneath. */
const mix = (a: RGB, b: RGB, pa: number): RGB =>
  a.map((v, i) => Math.round(v * pa + b[i] * (1 - pa))) as RGB;

/** `var(--a,fallback)` · `color-mix(in srgb, A p%, B)` · `currentColor` · `#rgb`.
 *  `inherited` is what the element would inherit, which is exactly what CSS
 *  computes `currentColor` to on the `color` property. */
function resolveColor(expr: string, inherited: RGB, vars: Record<string, string>): RGB {
  const e = expr.replace(/_/g, ' ').trim();
  if (/^(currentcolor|inherit)$/i.test(e)) return inherited;
  // `transparent` only ever appears as the second colour of a wash — a fill
  // expressed as `color-mix(in srgb, A p%, transparent)`, i.e. A at p% alpha over
  // whatever is beneath. `inherited` is that surface when this is called from
  // surfaceUnder, so the mix below composites it correctly.
  if (/^transparent$/i.test(e)) return inherited;
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

/* ── WCAG 2.1 relative luminance + contrast ─────────────────────────────────── */

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

/* ── reading the ink and the surface the component actually rendered ────────── */

const TEXT_TOKEN: Record<string, string> = {
  foreground: 'var(--color-foreground)',
  'muted-foreground': 'var(--color-muted-foreground)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
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
/** Custom properties INHERIT, so the vars in force on a node are every ancestor's
 *  inline block applied outermost-first, over the stylesheet's root block. */
const varsFor = (el: Element): Record<string, string> => {
  const stack: Element[] = [];
  for (let n: Element | null = el; n != null; n = n.parentElement) stack.push(n);
  let out: Record<string, string> = { ...VARS };
  for (let i = stack.length - 1; i >= 0; i -= 1) out = { ...out, ...inlineVars(stack[i]) };
  return out;
};

const classesOf = (el: Element): string[] => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** The RESTING colour expression this element sets, or null when it only inherits.
 *  Modifier-scoped classes (`hover:`/`focus-*`) are not the resting state. */
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
  if (found.length > 0) return found[0];
  const inline = (el as HTMLElement).style.color;
  return inline || null;
}

/** The resting FILL this element paints, as [expr, alpha], or null when it paints
 *  nothing and the surface beneath shows through. */
function bgExprOf(el: Element): [string, number] | null {
  const cls = classesOf(el);
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

const PAGE_BG: RGB = resolveColor('var(--frayme-bg)', [255, 255, 255], VARS);
const ROOT_INK: RGB = resolveColor('var(--frayme-fg)', [0, 0, 0], VARS);
const TOKEN_FG: RGB = resolveColor('var(--color-foreground)', [0, 0, 0], VARS);
const TOKEN_MUTED: RGB = resolveColor('var(--color-muted)', [0, 0, 0], VARS);

/** The colour a reader actually sees BEHIND `el` — the nearest painting ancestor,
 *  compositing any alpha fills on the way. This is the measurement the whole file
 *  turns on: an element over its own opaque fill must keep that fill's partner. */
function surfaceUnder(el: Element): RGB {
  const chain: Array<[string, number, Element]> = [];
  for (let n: Element | null = el; n != null; n = n.parentElement) {
    // Collect EVERY painting ancestor and composite outermost-inward, rather than
    // stopping at the first "opaque" one. Opacity is not decidable from the
    // expression text: the avatar's fill reads `var(--fr-kanbancard-avatar, …)`
    // and the wash — `color-mix(…, transparent)` — lives in the var's VALUE, so a
    // stop-at-opaque walk composited that tint over the PAGE instead of over the
    // card fill under it and measured the chip 1.12:1 when it is really 10.5:1.
    // Compositing all of them is unconditionally correct: an opaque fill ignores
    // `inherited` and simply overwrites what accumulated beneath it.
    const bg = bgExprOf(n);
    if (bg != null) chain.push([bg[0], bg[1], n]);
  }
  let out = PAGE_BG;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const [expr, alpha, node] = chain[i];
    const c = resolveColor(expr, out, varsFor(node));
    out = alpha >= 1 ? c : mix(c, out, alpha);
  }
  return out;
}

/** The ink in force on `el` — every ancestor's declaration applied in cascade
 *  order, so `currentColor` resolves to what it would really inherit. */
function inkOf(el: Element): RGB {
  const stack: Element[] = [];
  for (let n: Element | null = el; n != null; n = n.parentElement) stack.push(n);
  let ink = ROOT_INK;
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const e = colorExprOf(stack[i]);
    if (e != null) ink = resolveColor(e, ink, varsFor(stack[i]));
  }
  return ink;
}

const AA = 4.5;
const draw = (spec: unknown) => render(<FraymeRenderer spec={spec as Spec} mode="progressive" />);
const one = (type: string, props: Record<string, unknown>): unknown => ({
  root: 'el',
  elements: { el: { type, props } },
  state: {},
});
const avatarIn = (c: HTMLElement): Element => {
  const hit = [...c.querySelectorAll('span')].find((s) => (s.getAttribute('class') ?? '').includes('rounded-full') && (s.getAttribute('class') ?? '').includes('h-6 w-6'));
  expect(hit, 'the assignee avatar chip').not.toBeUndefined();
  return hit!;
};

/* The authoring the catalog asks for — a dark card fill WITH its paired on-fill
   ink — which is what made the chip fail. `mutedColor` is included because the
   real generated spec supplies it and it still does not reach the chip on
   the data path. */
const DARK_CARDS = { cardBg: '#181d24', cardColor: '#e8e4dc', mutedColor: '#93a0ad' };
const CARDS = [{ title: 'Ship it', assignee: 'Ada Lovelace' }];

describe('board-nav — the avatar chip is inked for the fill it actually paints', () => {
  it('KanbanBoard data path: the chip is the muted TOKEN, so it takes that token’s partner', () => {
    const { container } = draw(one('KanbanBoard', { columns: [{ title: 'Todo', cards: CARDS }], ...DARK_CARDS }));
    const avatar = avatarIn(container);
    // The chip must no longer be the flat muted token: that is the surface the
    // card's own ink was never chosen for. Pre-fix it was, at 1.15:1.
    expect(surfaceUnder(avatar), 'the chip still paints the bare muted token').not.toEqual(TOKEN_MUTED);
    // The INK stays on the documented card chain — the board suite pins it, and the
    // catalog sells `cardColor` as painting the initials.
    expect(inkOf(avatar), 'the card colour must still reach the initials').toEqual(hexToRgb(DARK_CARDS.cardColor));
    expect(contrast(inkOf(avatar), surfaceUnder(avatar))).toBeGreaterThanOrEqual(AA);
  });

  it('BoardColumn slot path: same chip, same token fill, same partner', () => {
    const { container } = draw({
      root: 'col',
      elements: {
        col: { type: 'BoardColumn', props: { title: 'Todo', cardBg: '#181d24', cardColor: '#e8e4dc' }, children: ['c'] },
        c: { type: 'KanbanCard', props: { title: 'Ship it', assignee: 'Ada Lovelace' } },
      },
      state: {},
    });
    const avatar = avatarIn(container);
    expect(surfaceUnder(avatar)).not.toEqual(TOKEN_MUTED);
    expect(inkOf(avatar)).toEqual(hexToRgb('#e8e4dc'));
    expect(contrast(inkOf(avatar), surfaceUnder(avatar))).toBeGreaterThanOrEqual(AA);
  });

  /* ── the OVER-APPLY guard ─────────────────────────────────────────────────
     Hard-wiring the chip to --color-foreground would fix the two cases above and
     destroy this one: when the card DOES name a mutedColor the chip stops being
     the muted token and becomes a 15% wash of that hue over the CARD fill, i.e. a
     dark chip — where the foreground token is 1.33:1. So the ink has to follow the
     fill in BOTH directions, which is why KanbanCard republishes the card ink in
     the same branch that derives the tint rather than the class picking a side. */
  it('KanbanCard with mutedColor: the chip is a wash over the CARD, so it takes the card ink', () => {
    const { container } = draw(
      one('KanbanCard', { title: 'Ship it', assignee: 'Ada Lovelace', bg: '#181d24', color: '#e8e4dc', mutedColor: '#93a0ad' }),
    );
    const avatar = avatarIn(container);
    const fill = surfaceUnder(avatar);
    expect(fill, 'a tint over the card, not the muted token').not.toEqual(TOKEN_MUTED);
    expect(inkOf(avatar), 'the card’s own on-fill ink').toEqual(hexToRgb('#e8e4dc'));
    expect(contrast(inkOf(avatar), fill)).toBeGreaterThanOrEqual(AA);
    // The counterfactual: had the fix been applied to the INK instead (blanket
    // --color-foreground on the chip), this wash would have carried the token.
    expect(contrast(TOKEN_FG, fill), 'a token-inked chip would vanish on this wash').toBeLessThan(2);
  });

  it('default board: byte-identical — the chip still resolves to the foreground token', () => {
    const { container } = draw(one('KanbanBoard', { columns: [{ title: 'Todo', cards: CARDS }] }));
    const avatar = avatarIn(container);
    expect(inkOf(avatar)).toEqual(TOKEN_FG);
    expect(surfaceUnder(avatar)).toEqual(TOKEN_MUTED);
    expect(contrast(inkOf(avatar), surfaceUnder(avatar))).toBeGreaterThanOrEqual(AA);
  });

  it('mutedColor still wins over the card colour — it is the more specific channel', () => {
    const { container } = draw(
      one('KanbanCard', { title: 'S', assignee: 'PG', bg: '#181d24', color: '#e8e4dc', mutedColor: '#123456' }),
    );
    const wrapper = container.querySelector('[style*="--fr-kanbancard-avatar"]')!;
    expect(wrapper.getAttribute('style')).toContain('color-mix(in srgb, #123456 15%, transparent)');
  });

  it('neither channel named → nothing emitted, the chip stays exactly --color-muted', () => {
    const { container } = draw(one('KanbanCard', { title: 'S', assignee: 'PG' }));
    expect(container.querySelector('[style*="--fr-kanbancard-avatar"]')).toBeNull();
    expect(surfaceUnder(avatarIn(container))).toEqual(TOKEN_MUTED);
  });
});

/* ══ MEASURED AND LEFT — the three sites this group was pointed at that are not
      defects, or are not defects of the ink ══════════════════════════════════ */

describe('log-console — the level gutter KEEPS text-foreground', () => {
  /* Reported as the inherited-foreground defect "in its simplest form". It is not
     one: LogConsole PAINTS the surface under the gutter. The scroller carries an
     inline `backgroundColor: var(--fr-log-bg, var(--color-card))`, and an authored
     Card sets --fr-card-bg, never --color-card, so that surface is still #ffffff
     inside a dark card. Measured inside Card { bg:#12161f color:#e2e6f0 }: the
     token reads 17.72:1 and `currentColor` would read 1.25:1 — the rename would
     CREATE the defect it was meant to remove. Rendering every sampled spec that
     uses LogConsole produces no finding on this class at all. */
  it('the gutter is measured on the surface LogConsole paints, not on the card behind it', () => {
    const spec = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { bg: '#12161f', color: '#e2e6f0' }, children: ['log'] },
        log: { type: 'LogConsole', props: { lines: [{ text: 'listening', level: 'info', timestamp: '12:00' }], wrap: true } },
      },
      state: {},
    };
    const { container } = draw(spec);
    const gutter = [...container.querySelectorAll('span')].find((s) => s.textContent === 'info' && s.classList.contains('w-10'))!;
    expect(gutter, 'the level gutter').not.toBeUndefined();
    const surface = surfaceUnder(gutter);
    expect(surface, 'the console paints its own card-token surface').toEqual(resolveColor('var(--color-card)', [0, 0, 0], VARS));
    expect(contrast(inkOf(gutter), surface)).toBeGreaterThanOrEqual(AA);
    // The rename, priced: the authored card ink on the console's own white.
    expect(contrast(hexToRgb('#e2e6f0'), surface), 'currentColor here would be invisible').toBeLessThan(1.5);
    expect(srcOf('log-console.tsx')).toContain("info: 'text-foreground'");
  });
});

describe('board-nav — the card title KEEPS its --fr-kanbancard-fg chain', () => {
  /* Reported at <1.3. Not reproducible: the card paints its own opaque fill
     (`[background:var(--fr-kanbancard-bg,var(--color-card))]`), so inside a dark
     authored Card the title is the foreground token on #ffffff — 17.72:1 — and
     across every sampled spec that uses a board the class never appears below 4.5.
     Both reported <1.3 numbers are the signature of a detector that treats an
     arbitrary `[background:…]` property (and LogConsole's inline backgroundColor)
     as "paints nothing" and credits the dark ancestor as the surface. */
  it('the title sits on the card fill, not on the container behind it', () => {
    const spec = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { bg: '#12161f', color: '#e2e6f0' }, children: ['b'] },
        b: { type: 'KanbanBoard', props: { columns: [{ title: 'Todo', cards: [{ title: 'Ship it' }] }] } },
      },
      state: {},
    };
    const { container } = draw(spec);
    const title = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Ship it')!;
    expect(surfaceUnder(title)).toEqual(resolveColor('var(--color-card)', [0, 0, 0], VARS));
    expect(contrast(inkOf(title), surfaceUnder(title))).toBeGreaterThanOrEqual(AA);
  });
});

describe('board-nav — the column TRACK is the open finding, and it is not an ink bug', () => {
  /* The two findings that DO reproduce on real generated specs both come from one surface.
     `bg-muted/40` is 40% of a near-white token over whatever is beneath, so on a
     board inside a dark authored console (Stack bg:#12151a) the track
     composites to rgb(108,110,114) — a mid grey that is hostile to light AND dark
     ink. On it the column title wears the author's `accent` (#c8862f, a perfectly
     good 6.01:1 on their own console) at 1.68:1 x13, and the count badge wears
     their `mutedColor` at 2.43:1 x11.
     No ink change clears the floor there: the accent mixed 25% toward the
     foreground the way Tabs/Sources do lands at ~1.0, and moving the badge's hue
     from the ink to the fill the way the label chips did lands at 3.76. Only the
     TRACK can fix it, and every candidate (a currentColor wash at ~3%) changes the
     default board for every spec that uses one, so it is a design decision and not a local fix.
     The count badge's channel is additionally pinned by a deliberate decision in
     board-nav-a11y.test.tsx ("still routes through the muted CHANNEL"), so this
     test records the measurement rather than moving the ink. */
  it('the track really is a 40% wash — which is why the ink on it cannot be fixed here', () => {
    const spec = {
      root: 'shell',
      elements: {
        shell: { type: 'Stack', props: { bg: '#12151a', color: '#e8e4dc' }, children: ['b'] },
        b: { type: 'KanbanBoard', props: { columns: [{ title: 'Pouring now', count: 2, cards: [] }], accent: '#c8862f', mutedColor: '#93a0ad' } },
      },
      state: {},
    };
    const { container } = draw(spec);
    const colTitle = container.querySelector('[data-fr-col-title]')!;
    const track = surfaceUnder(colTitle);
    // the mid grey, reproduced
    expect(contrast(track, hexToRgb('#12151a')), 'the wash lifts the dark console').toBeGreaterThan(3);
    expect(contrast(hexToRgb('#c8862f'), track)).toBeLessThan(2);
    // …and the same accent is fine on the surface the author actually chose.
    expect(contrast(hexToRgb('#c8862f'), hexToRgb('#12151a'))).toBeGreaterThanOrEqual(AA);
  });
});

