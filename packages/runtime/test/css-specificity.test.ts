import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * TWO RULES, EQUAL SPECIFICITY, SAME PROPERTY — the trap that bit three times in one
 * day: `.fr-band` vs `.fr-raised`, then the DescriptionList alignment, then
 * `.fr-band` vs the DataTable actions header. Each time two class selectors of equal
 * specificity set `background` on an element carrying BOTH classes, so source order
 * silently decided the winner — and each time the later-authored rule was the one
 * that lost, which is the opposite of what the author expected.
 *
 * It is invisible in review: both rules are correct in isolation, the CSS is valid,
 * and nothing warns. It only shows up as a wrong colour on screen, which is why it
 * shipped three times.
 *
 * HOW THIS GATE WORKS. Parse frayme.css for rules that set a paint property; compute
 * each selector's specificity; then read the registry's className strings to learn
 * which `fr-` classes actually CO-OCCUR on one element. A collision is only real when
 * both conditions hold — equal specificity AND co-occurrence. Checking specificity
 * alone would flag every same-level rule in the file; checking co-occurrence alone
 * would flag pairs where one rule properly out-ranks the other.
 *
 * THE FIX, when it fires, is to raise the intended winner's specificity (the actions
 * header became `th.fr-dt-actions--head`, 0-1-1 beating 0-1-0) — never to reorder the
 * file, because source order is not a contract anyone can see.
 */
/* cwd-relative, NOT import.meta.url: under this vitest/jsdom setup import.meta.url
   is not a file: URL, so readFileSync throws "The URL must be of scheme file" — the
   same quirk that makes node:path unimportable in confirm-single-modal.test.tsx.
   Vitest runs from the package root. */
const CSS = readFileSync('src/styles/frayme.css', 'utf8');
const REGISTRY_DIR = 'src/react/registry/';

const PAINT = /^(background|background-color|color)$/;

/** (id, class, type) — enough for class-vs-element comparisons. */
function specificity(sel: string): [number, number, number] {
  const s = sel.trim();
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:not\(|:hover|:focus|:has\(/g) ?? []).length;
  const types = (s.match(/(^|[\s>+~])[a-z][\w-]*/g) ?? []).length;
  return [ids, classes, types];
}
const eq = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Every `fr-`/`frayme-` class a selector requires. */
const classesOf = (sel: string) =>
  (sel.match(/\.((?:fr|frayme)-[\w-]+)/g) ?? []).map((c) => c.slice(1));

function paintRules() {
  const out: { sel: string; prop: string; spec: [number, number, number]; classes: string[] }[] = [];
  // Deliberately simple: top-level `selector { … }` blocks. Good enough — the trap
  // lives in plain class rules, not inside media queries.
  for (const m of CSS.matchAll(/(^|\n)([^@{}\n][^{}]*)\{([^{}]*)\}/g)) {
    const sel = m[2].trim();
    const body = m[3];
    if (!sel || sel.startsWith('@')) continue;
    for (const decl of body.split(';')) {
      const prop = decl.split(':')[0]?.trim();
      if (!prop || !PAINT.test(prop)) continue;
      for (const one of sel.split(',')) {
        const cs = classesOf(one);
        if (cs.length) out.push({ sel: one.trim(), prop, spec: specificity(one), classes: cs });
      }
    }
  }
  return out;
}

/** Class combinations the registry actually renders on ONE element. */
async function coOccurring(): Promise<Set<string>> {
  const { readdirSync } = await import('node:fs');
  const pairs = new Set<string>();
  const dir = REGISTRY_DIR;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx') || x.endsWith('.ts'))) {
    const src = readFileSync(dir + f, 'utf8');
    for (const lit of src.matchAll(/['"`]([^'"`]*\b(?:fr|frayme)-[\w-]+[^'"`]*)['"`]/g)) {
      const cs = [...new Set((lit[1].match(/\b(?:fr|frayme)-[\w-]+/g) ?? []))];
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++) pairs.add([cs[i], cs[j]].sort().join('|'));
    }
  }
  return pairs;
}

describe('CSS specificity collisions', () => {
  it('no two equal-specificity rules paint the same property on co-occurring classes', async () => {
    const rules = paintRules();
    const together = await coOccurring();
    const collisions: string[] = [];
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const a = rules[i], b = rules[j];
        if (a.prop !== b.prop || !eq(a.spec, b.spec)) continue;
        if (a.sel === b.sel) continue;
        for (const ca of a.classes) for (const cb of b.classes) {
          if (ca === cb) continue;
          if (!together.has([ca, cb].sort().join('|'))) continue;
          collisions.push(
            `${a.prop}: "${a.sel}" vs "${b.sel}" — both [${a.spec}] and .${ca}/.${cb} render together; ` +
            `source order decides. Raise the intended winner's specificity.`,
          );
        }
      }
    }
    expect(collisions).toEqual([]);
  });
});
