/**
 * The tone foregrounds follow the theme.
 *
 * `.frayme-root` re-points each Tailwind `--color-*` token at its themeable
 * `--frayme-*` var. `--color-danger-foreground` was linked; success, warning
 * and info foregrounds were not, so `text-success-foreground` (and friends)
 * kept the @theme white in dark mode, on fills that turn bright green, amber
 * and blue there, and ignored a host's `successForeground` token everywhere.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// cwd-relative, as css-specificity.test.ts reads it (vitest runs from the package root).
const css = readFileSync('src/styles/frayme.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The light `.frayme-root { … }` block: the one that re-points the @theme tokens. */
function lightRoot(): string {
  const start = css.search(/^\.frayme-root\s*\{/m);
  expect(start, 'the .frayme-root block is missing').toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open, css.indexOf('}', open));
}

describe('tone foreground links in .frayme-root', () => {
  it.each(['danger', 'success', 'warning', 'info'])('--color-%s-foreground follows --frayme-%s-fg', (tone) => {
    expect(lightRoot()).toMatch(new RegExp(`--color-${tone}-foreground:\\s*var\\(--frayme-${tone}-fg\\);`));
  });

  it('each link points at a token the stylesheet declares, in the light root and both dark blocks', () => {
    for (const tone of ['success', 'warning', 'info']) {
      const declarations = css.match(new RegExp(`--frayme-${tone}-fg\\s*:\\s*#[0-9a-f]{6}`, 'gi')) ?? [];
      // light root, prefers-color-scheme dark, the preset pin, forced dark, forced light
      expect(declarations.length, `--frayme-${tone}-fg`).toBeGreaterThanOrEqual(5);
    }
  });
});
