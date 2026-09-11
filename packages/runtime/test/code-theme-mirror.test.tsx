/**
 * CodeBlock's forced `theme` palette is a MIRROR of frayme.css, not a fork.
 *
 * `CODE_THEME` in registry/misc-extended.tsx re-points six design tokens inline
 * so `theme:'light'|'dark'` survives an ambient theme going the other way. It
 * cannot use `var(--frayme-*)` to do it — those flip with the ambient theme,
 * which is the thing being defeated — so the six values are hand-copied hexes,
 * and a hand-copied hex goes stale the moment the palette moves.
 *
 * It had. The contrast pass moved `--frayme-muted-fg` #71717a → #52525b because
 * #71717a reads 4.40:1 on `--frayme-muted`; CODE_THEME kept #71717a, so a forced
 * LIGHT block re-introduced that exact ratio on its own bg-muted fill — and a
 * forced block is the one surface a workspace theme cannot correct. `--color-
 * border` dark had never matched (#2e2e33 vs the dark root's #3f3f46), which is
 * what let the muted-fg drift pass for a deliberate local value.
 *
 * So the guard is two-sided, and both sides are derived rather than pinned:
 *   (1) MIRROR — every value in the rendered style attribute equals the
 *       corresponding `--frayme-*` in frayme.css. Re-reading the stylesheet is
 *       the point: pinning #52525b here would just move the stale copy into the
 *       test. This is the same shape as theme-tokens.test.ts's "forced light
 *       restates the light root exactly — nothing missing, nothing stale".
 *   (2) CONTRAST — muted text clears 4.5:1 on all three surfaces the forced
 *       palette itself paints. A mirror of a bad palette is still bad, and this
 *       side is what names the a11y consequence when (1) fails.
 *
 * Read through the RENDERED style attribute, not the source table: what ships is
 * the attribute, and a test that greps the module would pass on a table that
 * never reaches the DOM.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

// Same fileURLToPath(dirname(...)) shape theme-tokens.test.ts uses — the monorepo
// ships no @types/node, so `__dirname` is a type error and `import.meta.url` is
// not always a file: URL under vitest. Covered by test/node-builtins.d.ts.
const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '../src/styles/frayme.css'), 'utf8');

/** Brace-walk a rule body out of the stylesheet (theme-tokens.test.ts's `block`). */
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

const lightRoot = block(/^\.frayme-root\s*\{/m);
const darkRoot = block(/\.frayme-root\[data-theme='dark'\]/);

const valueOf = (blk: string, token: string): string | null => {
  const m = blk.match(new RegExp(`${token}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

/**
 * The Tailwind `--color-*` token each CODE_THEME row overrides ← the themeable
 * `--frayme-*` var `.frayme-root` normally points it at. This mapping IS the
 * mirror contract; it is written out rather than derived so a renamed token
 * fails loudly here instead of silently dropping out of the comparison.
 */
const MIRROR: Record<string, string> = {
  '--color-card': '--frayme-card',
  '--color-card-foreground': '--frayme-card-fg',
  '--color-foreground': '--frayme-fg',
  '--color-border': '--frayme-border',
  '--color-muted': '--frayme-muted',
  '--color-muted-foreground': '--frayme-muted-fg',
};

/** Render a bare CodeBlock at a forced theme and read back its inline custom props. */
function forcedPalette(theme: 'light' | 'dark'): Record<string, string> {
  const spec = {
    root: 'el',
    elements: { el: { type: 'CodeBlock', props: { code: 'const x = 1;\nx;', language: 'ts', showLineNumbers: true, theme } } },
    state: {},
  } as unknown as Spec;
  const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
  const wrap = container.querySelector(`[data-code-theme="${theme}"]`);
  expect(wrap, `CodeBlock wrapper for theme:'${theme}'`).not.toBeNull();
  const out: Record<string, string> = {};
  for (const [, token, value] of (wrap!.getAttribute('style') ?? '').matchAll(/(--color-[a-z-]+)\s*:\s*([^;]+)/g)) {
    out[token] = value.trim();
  }
  return out;
}

describe('CodeBlock forced theme — the palette mirrors frayme.css', () => {
  it.each([
    ['light', () => lightRoot],
    ['dark', () => darkRoot],
  ] as const)("theme:'%s' restates the stylesheet's own values — nothing stale", (theme, root) => {
    const painted = forcedPalette(theme);
    // Every token the component forces must be one we know how to check, and it
    // must equal the stylesheet. An unmapped token is a hole in the guard, so it
    // is reported the same way a mismatch is.
    const drift = Object.entries(painted)
      .map(([token, value]) => {
        const source = MIRROR[token];
        if (source == null) return `${token}: forced ${value} but no --frayme-* counterpart is mapped`;
        const expected = valueOf(root(), source);
        return expected === value ? null : `${token}: forced ${value} vs ${source} ${expected ?? 'MISSING'}`;
      })
      .filter((d): d is string => d != null);
    expect(drift, `CodeBlock theme:'${theme}' has forked from frayme.css:\n  ${drift.join('\n  ')}`).toEqual([]);
  });

  it('forces every token it needs — a token left out keeps the AMBIENT value and defeats the point', () => {
    for (const theme of ['light', 'dark'] as const) {
      const painted = Object.keys(forcedPalette(theme));
      const missing = Object.keys(MIRROR).filter((t) => !painted.includes(t));
      expect(missing, `theme:'${theme}' would inherit these from the page: ${missing.join(', ')}`).toEqual([]);
    }
  });
});

/** WCAG 2.1 relative luminance + contrast ratio (theme-tokens.test.ts's pair). */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Composite `fg` at alpha `a` over opaque `bg` — the header strip is bg-card/60. */
const over = (fg: string, bg: string, a: number): string => {
  const [F, B] = [parseInt(fg.slice(1), 16), parseInt(bg.slice(1), 16)];
  return `#${[16, 8, 0].map((s) => Math.round((((F >> s) & 255) * a + ((B >> s) & 255) * (1 - a))).toString(16).padStart(2, '0')).join('')}`;
};

describe('CodeBlock forced theme — muted text clears 4.5:1 on the surfaces it paints', () => {
  it.each(['light', 'dark'] as const)("theme:'%s'", (theme) => {
    const p = forcedPalette(theme);
    // The three places `--color-muted-foreground` lands in this component, each
    // over the surface the SAME forced palette puts behind it. All three are
    // normal-size text (0.6875rem language chip, 0.75rem copy label), so 4.5 is
    // the floor — 3:1 large-text relief does not apply to any of them.
    const surfaces: Array<[string, string]> = [
      ['wrapper bg-muted (line-number gutter)', p['--color-muted']],
      ['header bg-card/60 (language chip)', over(p['--color-card'], p['--color-muted'], 0.6)],
      ['copy button bg-card', p['--color-card']],
    ];
    for (const [where, bg] of surfaces) {
      expect(
        ratio(p['--color-muted-foreground'], bg),
        `theme:'${theme}' muted-foreground ${p['--color-muted-foreground']} on ${where} ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
