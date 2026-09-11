import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * ONE CONFIRM ON SCREEN, NOT TWO.
 *
 * json-render renders its own ConfirmDialog for `pendingConfirmation` — an inline-styled
 * fixed div, z-index 50, backgroundColor "rgba(0, 0, 0, 0.5)" — and Frayme's ConfirmHost
 * renders FraymeConfirmModal for the same state at z-60. Both mount, so every binding
 * confirm painted TWO stacked modals. frayme.css hides theirs while ours is present.
 *
 * That CSS matches a LITERAL in json-render's dist. This test exists because the day
 * that literal changes, the rule stops working and the double modal comes back with no
 * error anywhere — the exact silent-rot failure mode this guard exists to close.
 * If this fails: re-read the upstream ConfirmDialog, update the selector in frayme.css,
 * and update the literal here in the same commit.
 *
 * IT MUST NOT FAIL OPEN. The first version caught an unresolvable upstream with
 * `catch { return }` — so a checkout where the dist moved passed silently, which is
 * precisely the rot this file guards against. Locating the dist is now part of the
 * assertion, and `node:path`/`node:module` are gone (untyped in this package, and
 * `new URL` does the same job).
 */
/** Absolute path for a path relative to THIS file. (the @types/node pinned here types
 *  neither `readFileSync` nor `fileURLToPath` for a URL object, hence `.href`.) */
const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url).href);

/** Walk up from this file for a workspace/root node_modules copy of the dist. */
function upstreamDist(): string {
  const tried: string[] = [];
  for (const up of ['../', '../../', '../../../', '../../../../']) {
    const p = url(`${up}node_modules/@json-render/react/dist/index.js`);
    tried.push(p);
    try { return readFileSync(p, 'utf8'); } catch { /* keep walking */ }
  }
  throw new Error(`@json-render/react dist not found. Looked in:\n  ${tried.join('\n  ')}`);
}

describe('confirm: exactly one modal', () => {
  it('json-render still renders the backdrop literal our CSS targets', () => {
    const dist = upstreamDist();
    expect(dist).toContain('rgba(0, 0, 0, 0.5)');
    expect(dist).toContain('ConfirmDialog');
    // and it is still the z-50 inline-styled one
    expect(/zIndex:\s*50/.test(dist)).toBe(true);
  });

  it('frayme.css suppresses it, and only while ours is mounted', () => {
    const css = readFileSync(url('../src/styles/frayme.css'), 'utf8');
    expect(css).toContain('rgba(0, 0, 0, 0.5)');
    // The :has() guard is the safety: without it, a failure to mount ours would hide
    // the only confirm on screen while the gate still waited for an answer.
    expect(css).toContain(':has([data-fr-confirm])');
    expect(css).toMatch(/display:\s*none\s*!important/);
  });
});
