/**
 * Theme token completeness + contrast.
 *
 * A colour token defined for light and never re-derived for dark keeps its light
 * value on a dark surface. That is how `--frayme-primary` and `--frayme-danger`
 * came to read 2.91-4.06:1 and 3.12-4.35:1 on the very surfaces this stylesheet
 * defines, while `--frayme-success` — which WAS re-derived — passed at 6.61-9.22
 * and made the omission look deliberate.
 *
 * These tests read the stylesheet as text rather than a DOM: the failure is in
 * the authored declarations, and reading them directly is what makes the message
 * name the missing token instead of a computed colour.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The monorepo ships no @types/node — `__dirname` and a bare `resolve` were type
// errors even though vitest ran the file. `new URL(..., import.meta.url)` is not
// the fix either: under vitest `import.meta.url` is not always a file: URL. This
// is the same fileURLToPath(dirname(...)) shape event-conformance.test.tsx uses,
// covered by the ambient shim in test/node-builtins.d.ts.
const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * Comments are STRIPPED before anything reads a declaration, and that is not
 * tidiness — every regex below is `--frayme-…\s*:\s*([^;]+);`, and this file's
 * comments cite tokens by name with a colon after them ("its own
 * --frayme-primary-fg: white on it is 3.56:1"). A comment carries no semicolon,
 * so `[^;]+` ran straight through the comment terminator and swallowed the real
 * declaration behind it. Demonstrated live before this line existed: the warm
 * preset resolved --frayme-primary-fg to the TEXT of its own comment, and
 * --frayme-primary was ABSENT from the match set entirely — so the contrast
 * sweep silently measured the light root's #2563eb instead of warm's #c2410c,
 * and the completeness test counted a mention as a declaration.
 *
 * Stripping globally (not per-block) keeps every index into `css` consistent,
 * which blockFrom() depends on.
 */
const css = readFileSync(join(HERE, '../src/styles/frayme.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Tokens that are intentionally the same in both modes. Add with a reason. */
const MODE_INVARIANT = new Set(['--frayme-radius', '--frayme-font']);

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

const tokensIn = (s: string) => new Set([...s.matchAll(/(--frayme-[a-z-]+)\s*:/g)].map((m) => m[1]));

/**
 * Index-aware sibling of `block()`: the same brace walk, started at `from` and
 * reporting where it ended. `[data-theme='warm']` appears TWICE — once in the
 * shared preset-pin selector list and once as its own rule — so the second one
 * can only be addressed by position, not by pattern.
 */
function blockFrom(startPattern: RegExp, from: number): { body: string; end: number } {
  const rel = css.slice(from).search(startPattern);
  if (rel < 0) throw new Error(`block not found after ${from}: ${startPattern}`);
  const open = css.indexOf('{', from + rel);
  let depth = 0;
  for (let j = open; j < css.length; j += 1) {
    if (css[j] === '{') depth += 1;
    else if (css[j] === '}') {
      depth -= 1;
      if (depth === 0) return { body: css.slice(open, j), end: j };
    }
  }
  throw new Error('unbalanced braces');
}

const lightRoot = block(/^\.frayme-root\s*\{/m);
const darkExplicit = block(/\.frayme-root\[data-theme='dark'\]/);
const darkMedia = block(/@media \(prefers-color-scheme: dark\)/);
const forcedLight = block(/\.frayme-root\[data-theme='light'\]/);
// Source order is the contract: the shared pin (selector list) precedes both
// preset rules, and slate precedes warm.
const presetPin = blockFrom(/\.frayme-root\[data-theme='slate'\],/, 0);
const slatePreset = blockFrom(/\.frayme-root\[data-theme='slate'\]\s*\{/, presetPin.end);
const warmPreset = blockFrom(/\.frayme-root\[data-theme='warm'\]\s*\{/, slatePreset.end);

// a colour token is one whose light value is a hex — radius/font/spacing are not
const lightColours = [...tokensIn(lightRoot)].filter((t) => {
  const m = lightRoot.match(new RegExp(`${t}\\s*:\\s*([^;]+);`));
  return m != null && /^#[0-9a-f]{3,8}$/i.test(m[1].trim());
});

describe('theme tokens — every light colour is re-derived for dark', () => {
  it('the explicit dark block covers every light colour token', () => {
    const dark = tokensIn(darkExplicit);
    const missing = lightColours.filter((t) => !dark.has(t) && !MODE_INVARIANT.has(t));
    expect(missing, `not re-derived in [data-theme=dark]: ${missing.join(', ')}`).toEqual([]);
  });

  it('the prefers-color-scheme block covers the same set — system default reaches ONLY this one', () => {
    const media = tokensIn(darkMedia);
    const explicit = tokensIn(darkExplicit);
    const drift = [...explicit].filter((t) => !media.has(t));
    expect(drift, `present in [data-theme=dark] but missing from the media query: ${drift.join(', ')}`).toEqual([]);
  });
});

/** WCAG 2.1 relative luminance + contrast ratio. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const valueOf = (blk: string, token: string) => {
  const m = blk.match(new RegExp(`${token}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

/**
 * The instrument, checked before its readings are trusted.
 *
 * Every reader in this file is `--…\s*:\s*([^;]+);` and a CSS comment contains
 * no semicolon, so before the strip at the top of the file the regex ran from a
 * token NAMED inside a comment straight through the comment terminator and ate
 * the real declaration behind it. Measured: warm's --frayme-primary-fg resolved
 * to "white on it is 3.56:1, and as text it read 3.17-3.53 on warm's own
 * surfaces. Full-saturation orange " and warm's --frayme-primary vanished from
 * the parse entirely, so the contrast rows below would have measured the light
 * root's #2563eb and reported it as warm's #c2410c.
 *
 * Nothing failed while that was true — which is exactly why it needs its own
 * assertion rather than being left to show up somewhere downstream. A token
 * value here is a hex, a var(), a length, a font stack or a keyword: one line,
 * no colon. Prose fails on both counts.
 */
it('every parsed declaration is a CSS value, not comment prose', () => {
  const BLOCKS: Record<string, string> = {
    '@theme': block(/@theme\s*\{/),
    'light root': lightRoot,
    'dark (explicit)': darkExplicit,
    'dark (prefers-color-scheme)': darkMedia,
    'forced light': forcedLight,
    'preset pin': presetPin.body,
    'preset slate': slatePreset.body,
    'preset warm': warmPreset.body,
  };
  const prose: string[] = [];
  for (const [name, body] of Object.entries(BLOCKS)) {
    for (const [, token, value] of body.matchAll(/(--(?:frayme|color)-[a-z-]+)\s*:\s*([^;]+);/g)) {
      if (!/^[^\n:*]{1,120}$/.test(value.trim())) {
        prose.push(`${name} ${token} => ${JSON.stringify(value.trim().slice(0, 90))}`);
      }
    }
  }
  expect(prose, `a comment was read as a declaration:\n  ${prose.join('\n  ')}`).toEqual([]);
});

describe('theme tokens — state colours clear 4.5:1 on their own surfaces', () => {
  const DARK_SURFACES = ['--frayme-card', '--frayme-muted'] as const;
  const STATE = ['--frayme-primary', '--frayme-danger', '--frayme-success', '--frayme-warning', '--frayme-info'] as const;

  it.each(STATE)('%s is readable on every dark surface', (token) => {
    const fg = valueOf(darkExplicit, token) ?? valueOf(lightRoot, token);
    expect(fg, `${token} has no value`).toBeTruthy();
    for (const s of DARK_SURFACES) {
      const bg = valueOf(darkExplicit, s);
      if (!bg || !/^#/.test(bg) || !/^#/.test(fg!)) continue;
      expect(ratio(fg!, bg), `${token} ${fg} on ${s} ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // black page: the host commonly paints pure black behind the render
    if (/^#/.test(fg!)) expect(ratio(fg!, '#000000'), `${token} ${fg} on black`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(STATE)('%s is readable on white in light mode', (token) => {
    const fg = valueOf(lightRoot, token);
    if (!fg || !/^#/.test(fg)) return;
    expect(ratio(fg, '#ffffff'), `${token} ${fg} on white`).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * The three blocks above are not the only way into this palette. `[data-theme]`
 * has FOUR more values — light, slate, warm (and dark) — and every one of those
 * selectors is (0,2,0) while the prefers-color-scheme block is (0,1,0). So on a
 * dark-OS machine a preset's LIGHT surfaces win and any token it forgot keeps
 * its DARK value. That is not "low contrast", it is invisible text: measured on
 * what shipped, `--frayme-fg` stayed #fafafa over slate's #f8fafc page at
 * 1.00:1 and its #ffffff card at 1.04:1, and forced light kept the dark page
 * under #18181b text at 1.05:1.
 *
 * Same omission shape the two tests above already pin, one selector further
 * out — so it is pinned the same way.
 */
describe('theme tokens — every entry point is a COMPLETE palette', () => {
  const darkTokens = [...tokensIn(darkExplicit)].filter((t) => !MODE_INVARIANT.has(t));

  it('forced light restates the light root exactly — nothing missing, nothing stale', () => {
    // Not just "declares the same tokens": the values have to match too. What
    // shipped declared --frayme-success/#16a34a and --frayme-warning/#d97706,
    // the exact two values the light root had already replaced for reading
    // 3.30:1 and 3.19:1 on white — a fixed defect that forcing light undid.
    const drift = lightColours
      .map((t) => ({ t, root: valueOf(lightRoot, t), forced: valueOf(forcedLight, t) }))
      .filter(({ root, forced }) => forced !== root)
      .map(({ t, root, forced }) => `${t}: light root ${root} vs forced light ${forced ?? 'MISSING'}`);
    expect(drift, `forced light has forked from the light root:\n  ${drift.join('\n  ')}`).toEqual([]);
  });

  it.each([
    ['slate', () => slatePreset.body],
    ['warm', () => warmPreset.body],
  ])('the %s preset + the shared pin cover every token dark re-derives', (_name, body) => {
    const covered = new Set([...tokensIn(presetPin.body), ...tokensIn(body())]);
    const missing = darkTokens.filter((t) => !covered.has(t));
    expect(missing, `would keep its dark value under a dark OS: ${missing.join(', ')}`).toEqual([]);
  });
});

/**
 * Contrast, resolved the way the cascade resolves it: the light root is the
 * base and each entry point is layered over it. Reading a block in isolation
 * would miss exactly the bug above — a preset block's own text looks fine; what
 * it INHERITS is what fails.
 */
describe('theme tokens — text clears 4.5:1 on the surfaces of every palette', () => {
  const declarations = (blk: string) => [...blk.matchAll(/(--frayme-[a-z-]+)\s*:\s*([^;]+);/g)];
  const resolve = (...blocks: string[]) => {
    const out: Record<string, string> = {};
    for (const b of [lightRoot, ...blocks]) for (const [, token, value] of declarations(b)) out[token] = value.trim();
    return out;
  };

  const PALETTES: Record<string, Record<string, string>> = {
    'light (default)': resolve(),
    'light (forced)': resolve(forcedLight),
    'dark (forced)': resolve(darkExplicit),
    // The system-default viewer stamps no attribute, so this block is the only
    // one that reaches them — it gets its own row for the same reason.
    'dark (prefers-color-scheme)': resolve(darkMedia),
    'preset slate': resolve(presetPin.body, slatePreset.body),
    'preset warm': resolve(presetPin.body, warmPreset.body),
    // ── the rows that actually caught the invisible text ──────────────────────
    // A (0,2,0) block on a machine whose OS is dark: the media query applies
    // first and the explicit block only wins where it DECLARES something, so
    // every token it omits is a dark value under light surfaces. Modelling this
    // as "light root + block" would miss it entirely — the light root would
    // supply the very tokens the omission leaves to dark.
    'light (forced) under a dark OS': resolve(darkMedia, forcedLight),
    'preset slate under a dark OS': resolve(darkMedia, presetPin.body, slatePreset.body),
    'preset warm under a dark OS': resolve(darkMedia, presetPin.body, warmPreset.body),
  };

  // The surfaces this stylesheet paints text on. `--frayme-muted` is included
  // deliberately: it is the surface the shipped #71717a failed on (4.40:1) while
  // passing on card (4.83:1), which is how a token that reads fine in isolation
  // ends up failing across a large share of generated specs.
  const SURFACES = ['--frayme-bg', '--frayme-card', '--frayme-muted'] as const;
  const TEXT = ['--frayme-fg', '--frayme-card-fg', '--frayme-muted-fg'] as const;

  it.each(Object.keys(PALETTES))('%s', (name) => {
    const p = PALETTES[name];
    for (const t of TEXT) {
      const fg = p[t];
      expect(fg, `${name}: ${t} unresolved`).toMatch(/^#[0-9a-f]{6}$/i);
      for (const s of SURFACES) {
        const bg = p[s];
        if (!bg || !/^#[0-9a-f]{6}$/i.test(bg)) continue;
        // card-fg is the card's text; holding it to the page/muted surfaces too
        // is deliberate — a Card is routinely nested on both.
        expect(ratio(fg, bg), `${name}: ${t} ${fg} on ${s} ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  /**
   * The sweep above measures only the three GREY roles, so until now the preset
   * and pin VALUES were unguarded: only their NAMES were. Demonstrated by
   * poisoning the shared pin with --frayme-danger:#f87171 (2.77:1 on white),
   * --frayme-success:#16a34a (3.30) and --frayme-warning:#f59e0b (2.15) — the
   * whole suite stayed green, because the only test that reads a state colour
   * reads it from the light root or the explicit dark block, never from a
   * preset. These two rows close that: every palette's OWN state colours, and
   * every *-fg on the fill it is actually painted on.
   *
   * This could not have been true before the comment strip at the top of the
   * file: with comments in play, warm's --frayme-primary was invisible to the
   * parser and this sweep would have measured the light root's #2563eb while
   * reporting it as warm's.
   *
   * `--frayme-muted` is NOT a surface here, and that is a known gap carried with
   * numbers rather than an oversight: the shipped state colours read
   * 4.31-4.58 on the muted band (worst: warm's #dc2626 at 4.31, light's at
   * 4.39). Including it would fail on values this file has already re-derived
   * once, so it would have to be answered by moving the whole red/green/amber
   * ramp a step — a palette change, not a guard. The page and the card are where
   * a badge, a ✓/✕ glyph and an error string actually sit.
   */
  const STATE = ['--frayme-primary', '--frayme-danger', '--frayme-success', '--frayme-warning', '--frayme-info'] as const;
  const PAINTED_SURFACES = ['--frayme-bg', '--frayme-card'] as const;

  it.each(Object.keys(PALETTES))('%s — state colours are readable as text', (name) => {
    const p = PALETTES[name];
    for (const t of STATE) {
      const fg = p[t];
      expect(fg, `${name}: ${t} unresolved`).toMatch(/^#[0-9a-f]{6}$/i);
      for (const s of PAINTED_SURFACES) {
        const bg = p[s];
        if (!bg || !/^#[0-9a-f]{6}$/i.test(bg)) continue;
        expect(ratio(fg, bg), `${name}: ${t} ${fg} on ${s} ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(Object.keys(PALETTES))('%s — every *-fg is readable on its own fill', (name) => {
    const p = PALETTES[name];
    for (const t of STATE) {
      const fill = p[t];
      const fg = p[`${t}-fg`];
      expect(fg, `${name}: ${t}-fg unresolved`).toMatch(/^#[0-9a-f]{6}$/i);
      if (!/^#[0-9a-f]{6}$/i.test(fill)) continue;
      expect(ratio(fg, fill), `${name}: ${t}-fg ${fg} on ${t} ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * ── The muted band, which no state-colour row had ever covered ──────────────
   *
   * PAINTED_SURFACES above is bg + card, and the comment on it carried the gap
   * with numbers: the state colours read 4.31-4.58 on `--frayme-muted`, so
   * including it "would fail on values this file has already re-derived once".
   * Re-measured across all nine entry points, that summary hid a distinction the
   * numbers make plainly:
   *
   *   --frayme-success  4.56 default   4.58 slate   4.47 warm
   *   --frayme-warning  4.57 default   4.58 slate   4.48 warm
   *   --frayme-danger   4.39 default   4.41 slate   4.31 warm
   *
   * Success and warning failed in ONE palette. Two tokens do not fail in one
   * place and pass in two others — the place does. warm's band was the darkest
   * in the file (luminance 0.8863 against 0.9053 and 0.9085), and lightening it
   * into line with its siblings puts both at 4.59 without touching the ramp.
   * That fix is on the surface, in frayme.css, and this row is what fails
   * without it.
   *
   * `--frayme-danger` is the opposite shape — it misses on all three bands, so
   * the band is not what is wrong. It is the one state colour left at red-600
   * while success and warning were moved to 700, and closing it means red-700
   * #b91c1c at 6.47 on white against its siblings' 5.02: a visible brand shift,
   * on the light side, which is not what this pass measured. It is carried as a
   * NAMED floor at the current worst value rather than excluded, so the gap is a
   * number that can only shrink instead of a surface nobody looks at.
   *
   * Every dark palette clears 4.5 here with room (5.44 danger, 6.61 success,
   * 7.01 warning, 5.92 primary/info), so the floor below is a light-mode carve
   * only — a dark regression still fails this row.
   */
  const MUTED_BAND_FLOOR: Record<string, number> = { '--frayme-danger': 4.3 };

  it.each(Object.keys(PALETTES))('%s — state colours are readable on the muted band', (name) => {
    const p = PALETTES[name];
    const bg = p['--frayme-muted'];
    expect(bg, `${name}: --frayme-muted unresolved`).toMatch(/^#[0-9a-f]{6}$/i);
    for (const t of STATE) {
      const fg = p[t];
      expect(fg, `${name}: ${t} unresolved`).toMatch(/^#[0-9a-f]{6}$/i);
      const floor = MUTED_BAND_FLOOR[t] ?? 4.5;
      expect(ratio(fg, bg), `${name}: ${t} ${fg} on --frayme-muted ${bg}`).toBeGreaterThanOrEqual(floor);
    }
  });

  /**
   * The one pairing in frayme.css that inverts on purpose, and the one no test
   * read: `.frayme-tooltip:hover::after` paints `background: var(--frayme-fg)`
   * with `color: var(--frayme-card)` — the page's INK is the surface and the
   * page's CARD is the text. Both flip, so it survives dark, but nothing said
   * so: --frayme-fg is only ever measured as text and --frayme-card only ever as
   * a surface, and a chip that swaps their roles falls between the two sweeps.
   * Measured: 17.72 light, 16.27 dark, 17.57 warm.
   */
  it.each(Object.keys(PALETTES))('%s — the tooltip chip (card ink on fg fill) is readable', (name) => {
    const p = PALETTES[name];
    const [fg, bg] = [p['--frayme-card'], p['--frayme-fg']];
    expect(fg, `${name}: --frayme-card unresolved`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(bg, `${name}: --frayme-fg unresolved`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(ratio(fg, bg), `${name}: tooltip --frayme-card ${fg} on --frayme-fg ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * ── Coherence, which a ratio cannot express ────────────────────────────────
   *
   * A palette can clear every ratio above and still be WRONG, because contrast
   * is symmetric: dark ink on a dark ground and light ink on a light ground both
   * read 1.0x, but a palette half-flipped reads perfectly — #18181b text on a
   * #131316 page is 1.05:1 and every pairwise check that involves only one of
   * them passes. That half-flip is not hypothetical here twice over: it is what
   * the presets shipped (see the entry-point tests above), and it is what the
   * an a11y probe manufactured when it added `.frayme-dark` without removing
   * `.frayme-light` — 9,401 phantom failures from one hybrid.
   *
   * So each palette is asserted to be internally coherent: in a DARK entry point
   * every surface is dark and every neutral ink is light, and the reverse in a
   * light one. The thresholds are deliberately loose (0.1 / 0.2) — this is a
   * direction check, not a second contrast check, and the ratios above own the
   * margins.
   */
  const NEUTRAL_INK = ['--frayme-fg', '--frayme-card-fg', '--frayme-muted-fg'] as const;
  const NEUTRAL_SURFACE = ['--frayme-bg', '--frayme-card', '--frayme-muted'] as const;

  it.each(Object.keys(PALETTES))('%s — the palette is coherently one mode, never half-flipped', (name) => {
    const p = PALETTES[name];
    const dark = name.startsWith('dark');
    for (const s of NEUTRAL_SURFACE) {
      const l = luminance(p[s]);
      if (dark) expect(l, `${name}: surface ${s} ${p[s]} is not dark`).toBeLessThan(0.1);
      else expect(l, `${name}: surface ${s} ${p[s]} is not light`).toBeGreaterThan(0.5);
    }
    for (const t of NEUTRAL_INK) {
      const l = luminance(p[t]);
      if (dark) expect(l, `${name}: ink ${t} ${p[t]} is not light`).toBeGreaterThan(0.2);
      else expect(l, `${name}: ink ${t} ${p[t]} is not dark`).toBeLessThan(0.25);
    }
  });

  it('every @theme default matches the --frayme-* token .frayme-root re-points it at', () => {
    // Tailwind bakes @theme into the utilities used OUTSIDE .frayme-root, so a
    // token that drifts hands the host two colours with one name and two ratios.
    // The pairs are read from .frayme-root's OWN re-point declarations rather
    // than a hand-kept list: that is the definition of "these two are the same
    // colour", and it is why --color-background is absent (it is not re-pointed,
    // and its `transparent` is load-bearing for the .fr-tabscroll fade).
    //
    // Written as a general sweep after the single muted-grey check it replaces
    // missed its two neighbours for a whole release: @theme still shipped
    // --color-success #16a34a (3.30:1 on white) and --color-warning #d97706
    // (3.19:1) — the exact values the light root had already moved off.
    const theme = block(/@theme\s*\{/);
    const pairs = [...lightRoot.matchAll(/(--color-[a-z-]+)\s*:\s*var\((--frayme-[a-z-]+)\)\s*;/g)];
    expect(pairs.length, 'no @theme re-points found — the parse is wrong').toBeGreaterThan(8);
    const drift = pairs
      .map(([, colorToken, fraymeToken]) => ({
        colorToken,
        fraymeToken,
        baked: valueOf(theme, colorToken),
        root: valueOf(lightRoot, fraymeToken),
      }))
      .filter(({ root, baked }) => root != null && /^#/.test(root) && baked !== root)
      .map(({ colorToken, fraymeToken, baked, root }) => `@theme ${colorToken} ${baked ?? 'MISSING'} vs ${fraymeToken} ${root}`);
    expect(drift, `@theme has forked from the themeable tokens:\n  ${drift.join('\n  ')}`).toEqual([]);
  });
});

/**
 * ── Dark inversions: nothing this file PAINTS may stay light ─────────────────
 *
 * Everything above measures TOKEN VALUES. It cannot see a rule that hard-codes a
 * colour, and a hard-coded colour is the exact shape of a dark-mode inversion:
 * the page flips, one surface does not, and dark ink lands on a light ground.
 * Measured on an accessibility audit over generated specs, close to half of the dark-mode
 * contrast findings are one of THIS FILE's settled dark inks — #fafafa or
 * #a1a1aa — sitting on a surface at luminance 0.90-1.00. The ink is right; the
 * ground never flipped. None of those grounds is painted here, and this is what
 * says so mechanically rather than by reading.
 *
 * The rule enforced: every colour reachable from a paint declaration in
 * frayme.css resolves, through its var() chain, to a `--frayme-*` token that
 * BOTH dark blocks re-derive. Not "looks dark" — a literal is rejected whatever
 * its value, because a literal is by construction the same in both modes.
 *
 * A literal inside a var() FALLBACK is not reachable when the token it falls
 * back from is itself declared on `.frayme-root` (`var(--frayme-card, #fff)` on
 * the slider thumb is dead code, not a light surface), so the resolver takes the
 * declaration and never looks at the fallback — the same order the cascade uses.
 *
 * `box-shadow` is excluded and it is the only exclusion: its one use is
 * `rgb(0 0 0 / 0.25)`, a translucent black drop shadow, which is not a surface
 * and is correct in both modes.
 */
describe('dark inversions — every colour frayme.css paints follows the theme', () => {
  // Custom properties in scope inside `.frayme-root`: the @theme defaults, then
  // the root's own re-points layered over them (which is the cascade order).
  const customProps = (blk: string) => Object.fromEntries([...blk.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const DECLS: Record<string, string> = { ...customProps(block(/@theme\s*\{/)), ...customProps(lightRoot) };

  const PAINT_PROPS = ['background', 'background-color', 'color', 'border', 'border-color', 'border-top', 'border-left', 'outline'];
  // Anchored on `;`, `{` or the start of a line so that `--frayme-border:` and
  // `--color-muted-foreground:` (both of which END in a property name) can never
  // be read as the property itself. `color-scheme:` and `border-radius:` are
  // excluded for free by requiring the colon immediately after the name.
  const paintRe = new RegExp(String.raw`(?:^|[;{])\s*(${PAINT_PROPS.join('|')})\s*:\s*([^;}]+)`, 'gm');

  const KEYWORD = /^(transparent|none|currentcolor|inherit|initial|unset|revert|auto)$/i;
  const LITERAL =
    /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![-\w])color\(|\b(?:white|black|gray|grey|silver|whitesmoke|gainsboro|ivory|beige|linen|snow|red|green|blue|yellow|orange|purple|pink|brown|navy|teal|olive|maroon|lime|aqua|fuchsia)\b/i;

  /** Split `var(--name, fallback)` at the first top-level comma. */
  function splitVar(inner: string): { name: string; fallback: string | null } {
    let depth = 0;
    for (let i = 0; i < inner.length; i += 1) {
      if (inner[i] === '(') depth += 1;
      else if (inner[i] === ')') depth -= 1;
      else if (inner[i] === ',' && depth === 0) return { name: inner.slice(0, i).trim(), fallback: inner.slice(i + 1).trim() };
    }
    return { name: inner.trim(), fallback: null };
  }

  /**
   * Resolve a declaration value to the set of `--frayme-*` tokens it can paint,
   * plus anything that resolved to a hard literal or to nothing at all.
   */
  function resolve(value: string, seen = new Set<string>()): { tokens: Set<string>; literals: string[]; holes: string[] } {
    const tokens = new Set<string>();
    const literals: string[] = [];
    const holes: string[] = [];
    let rest = '';
    for (let i = 0; i < value.length; i += 1) {
      if (value.startsWith('var(', i)) {
        let depth = 0;
        let j = i + 3;
        for (; j < value.length; j += 1) {
          if (value[j] === '(') depth += 1;
          else if (value[j] === ')') { depth -= 1; if (depth === 0) break; }
        }
        const { name, fallback } = splitVar(value.slice(i + 4, j));
        const declared = DECLS[name];
        if (declared != null && !seen.has(name)) {
          // A --frayme-* token whose value is a literal colour IS the themeable
          // leaf — record it by name; anything else is another hop.
          if (/^--frayme-/.test(name) && /^#[0-9a-f]{3,8}$/i.test(declared)) tokens.add(name);
          else {
            const r = resolve(declared, new Set([...seen, name]));
            r.tokens.forEach((t) => tokens.add(t));
            literals.push(...r.literals);
            holes.push(...r.holes);
          }
        } else if (fallback != null) {
          const r = resolve(fallback, seen);
          r.tokens.forEach((t) => tokens.add(t));
          literals.push(...r.literals);
          holes.push(...r.holes);
        } else if (declared == null) holes.push(name);
        i = j;
        continue;
      }
      rest += value[i];
    }
    // Whatever is left after every var() has been taken out is written inline.
    for (const word of rest.split(/[\s,/]+/)) {
      const w = word.trim();
      if (!w || KEYWORD.test(w)) continue;
      if (LITERAL.test(w)) literals.push(w);
    }
    return { tokens, literals, holes };
  }

  const paints = [...css.matchAll(paintRe)].map(([, prop, value]) => ({ prop, value: value.trim() }));

  it('the paint scan actually finds the declarations it is meant to police', () => {
    // A broken regex reports zero problems, which is indistinguishable from a
    // clean file — the failure mode every instrument in this project has hit.
    // These four are the load-bearing ones: the root's own paint (the surface
    // every render sits on), the tooltip chip (the one deliberate inversion),
    // the fallback label (a real background) and the invalid box (real ink).
    expect(paints.length, 'the paint-declaration scan is wrong').toBeGreaterThan(15);
    const values = paints.map((p) => `${p.prop}:${p.value}`);
    expect(values).toContain('background:var(--frayme-bg)');
    // Was background:var(--frayme-muted) — the fallback-label chip, which was the
    // only occurrence and has moved to a surface-relative color-mix (it was painting
    // the LIGHT muted token onto whatever page it landed on). --frayme-fg is the
    // replacement canary: a second, differently-named token, which is what this
    // self-check needs — proof the scanner finds more than one thing.
    expect(values).toContain('background:var(--frayme-fg)');
    expect(values).toContain('color:var(--frayme-danger)');
    // The tooltip's two halves, named together: the contrast row for this chip
    // reads --frayme-card against --frayme-fg from the PALETTE, so without these
    // two lines the rule could be re-pointed at any pair of tokens and the row
    // would go on measuring the pair it no longer paints.
    expect(values).toContain('background:var(--frayme-fg)');
    expect(values).toContain('color:var(--frayme-card)');
  });

  it('no paint declaration reaches a hard-coded colour', () => {
    const bad = paints
      .map((p) => ({ ...p, r: resolve(p.value) }))
      .filter((p) => p.r.literals.length > 0)
      .map((p) => `${p.prop}: ${p.value}  → literal ${p.r.literals.join(', ')}`);
    expect(bad, `a painted colour cannot follow the theme:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('every token a paint declaration reaches is re-derived by BOTH dark blocks', () => {
    // Both, separately: a viewer on the OS default reaches only the media query
    // and a host that forces the class reaches only the explicit block, so a
    // token present in one and missing from the other is a light surface for
    // half the audience. That is the same asymmetry the entry-point tests pin
    // for the token set; this pins it for the tokens actually PAINTED.
    const explicit = tokensIn(darkExplicit);
    const media = tokensIn(darkMedia);
    const missing: string[] = [];
    for (const p of paints) {
      for (const t of resolve(p.value).tokens) {
        if (MODE_INVARIANT.has(t)) continue;
        if (!explicit.has(t)) missing.push(`${p.prop}: ${p.value} → ${t} missing from [data-theme=dark]`);
        if (!media.has(t)) missing.push(`${p.prop}: ${p.value} → ${t} missing from the media query`);
      }
    }
    expect([...new Set(missing)], `painted with a token that keeps its light value in dark:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it('no paint declaration names a custom property that is neither declared nor given a fallback', () => {
    // The value channels (--fr-slider-accent, --fr-slider-track, --fr-range-accent)
    // are set INLINE by the renderer and are absent from the stylesheet by
    // design — so each one must carry a fallback that resolves, or the rule
    // paints nothing on the default path.
    const holes = paints
      .map((p) => ({ ...p, h: resolve(p.value).holes }))
      .filter((p) => p.h.length > 0)
      .map((p) => `${p.prop}: ${p.value} → unresolvable ${p.h.join(', ')}`);
    expect(holes, `a painted colour resolves to nothing:\n  ${holes.join('\n  ')}`).toEqual([]);
  });
});

/**
 * ── Narrow-container collapse ────────────────────────────────────────────────
 *
 * This block is about layout, not colour, and it lives in the theme-token file
 * only because that file already owns the "read frayme.css as text" machinery
 * (and the comment strip above, which this block depends on — without it the
 * prose in the stylesheet's own comments would match the selectors it is
 * looking for).
 *
 * The stylesheet's responsive keystone says media queries read the VIEWPORT and
 * are therefore the wrong tool for a runtime whose width comes from a host
 * panel. The registry breaks that in two shapes, and both were measured at a
 * 320px render root inside a 1400px window — which is what the render audit
 * runs, and what an MCP sidebar is:
 *
 *   `md:flex-row`      a hero / CTA / footer row that flips to a row at a
 *                      viewport width it will never be asked about. Measured in
 *                      a 248px panel: two 104px columns, an <h1> 264px tall
 *                      inside one of them; in a 190px panel a brand block at
 *                      53px and a link strip escaping by 207px.
 *   a hard template    FeatureGrid's `repeat(var(--fr-fgrid-cols,3),minmax(0,1fr))`
 *                      resolved to 39.3px tracks in a 142px column and 61.3px in
 *                      a 232px one. Its own collapse is `max-[640px]:!grid-cols-1`
 *                      — again the viewport.
 *
 * frayme.css re-keys both onto the container with `[class*='…']` hooks, and a
 * textual hook can go dead silently when the class it names is edited in a file
 * this stylesheet does not own. So the coupling is CHECKED here rather than
 * trusted: the registry is scanned for the variants that need covering, and each
 * one must be reachable by a hook that actually appears inside a @container
 * block. A new component that adds `lg:flex-row` fails this until the CSS covers
 * it — which is the point.
 */
describe('narrow-container collapse — the container rules still reach the registry', () => {
  /** Every `@container (...) { ... }` body in the stylesheet, concatenated. */
  const narrowCss = (() => {
    const out: string[] = [];
    const re = /@container\s*\([^)]*\)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) != null) {
      const open = css.indexOf('{', m.index);
      let depth = 0;
      for (let j = open; j < css.length; j += 1) {
        if (css[j] === '{') depth += 1;
        else if (css[j] === '}') {
          depth -= 1;
          if (depth === 0) {
            out.push(css.slice(open, j));
            break;
          }
        }
      }
    }
    return out.join('\n');
  })();
  const flat = narrowCss.replace(/\s+/g, ' ');

  // Hooks inside a :not() are EXCLUSIONS, not coverage — counting `auto-fit` as
  // something the rules reach would invert its meaning.
  const hooks = [...narrowCss.replace(/:not\(\[class\*=[^)]*\)/g, '').matchAll(/\[class\*='([^']+)'\]/g)].map(
    (m) => m[1],
  );

  const REGISTRY = join(HERE, '../src/react/registry');
  const registrySrc = readdirSync(REGISTRY)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => readFileSync(join(REGISTRY, f), 'utf8'))
    .join('\n');
  // Only the two utilities that decide a narrow layout. A `md:px-10` is padding
  // on the wrong axis too, but it costs a reader nothing; a column count and a
  // flex direction delete words.
  const variants = [
    ...new Set(
      [...registrySrc.matchAll(/\b(?:2xl|xl|lg|md|sm):(?:flex-row(?:-reverse)?|grid-cols-[a-z0-9_[\]#.%+-]+)/g)].map(
        (m) => m[0],
      ),
    ),
  ].sort();

  it('the registry still carries the viewport-keyed variants these rules exist for', () => {
    // A zero here means the scan broke (or the registry moved to container
    // variants, in which case the CSS hooks are dead weight and should go).
    expect(variants.length, 'no viewport-keyed layout variants found — the scan is wrong').toBeGreaterThan(0);
  });

  it.each(variants)('%s is reachable from a @container rule', (variant) => {
    // `[class*='x']` matches any class containing x, so a hook covers a variant
    // when it is a SUBSTRING of it: 'md:flex-row' covers 'md:flex-row-reverse',
    // and 'xl:grid-cols-' covers both 'xl:grid-cols-3' and '2xl:grid-cols-4'.
    const covering = hooks.filter((h) => variant.includes(h));
    expect(covering, `no @container rule in frayme.css reaches .${variant}`).not.toEqual([]);
  });

  it('the fixed-template collapse keeps both of its exclusions', () => {
    // Widening either one is what turns this rule from a fix into a regression:
    // without :not(auto-fit) it would freeze the self-collapsing grids (Grid's
    // auto-fit branch, StatGroup, Sources) at the root's width instead of their
    // own; without the :has() text test it would collapse ColorPicker's 6-up
    // swatch grid and LogoCloud's 5-up row into vertical strips. Both were
    // carried through a real-browser check as controls and came out unchanged.
    expect(flat).toContain("[class*='grid-template-columns:repeat(']:not([class*='auto-fit'])");
    expect(flat).toMatch(/:has\( ?:is\(h1, h2, h3, h4, h5, h6, p\) ?\)/);
  });

  it('the direction flip still carries align-items: stretch', () => {
    // Measured, and the reason it is not just `flex-direction: column`: on the
    // new cross axis the authored `items-center` sizes each pane to fit-content,
    // so the hero's copy pane took its <h1>'s 315px min-content and escaped its
    // 248px parent by 34px while a media pane with no intrinsic width collapsed
    // to 0px. Dropping this line silently restores both.
    const rule = flat.match(/:is\(\[class\*='sm:flex-row'\][^{]*\{([^}]*)\}/);
    expect(rule, 'the md:flex-row container rule is gone').not.toBeNull();
    expect(rule?.[1]).toContain('flex-direction: column');
    expect(rule?.[1]).toContain('align-items: stretch');
  });
});
