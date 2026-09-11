import { describe, expect, it } from 'vitest';
import {
  applySpecStreamPatch,
  createSpecStreamCompiler,
  type Spec,
  type SpecStreamLine,
} from '@json-render/core';

/**
 * Proves that accumulating ops via repeated `applySpecStreamPatch`
 * (parse-once — the op object applied directly) is byte-identical to
 * `createSpecStreamCompiler.push(JSON.stringify(op) + '\n')` (stringify→reparse)
 * at EVERY snapshot and the final spec — the equivalence ComposeStream relies on.
 */

type Op = { op: string; path: string; value?: unknown; from?: string };

const OPS: Op[] = [
  { op: 'add', path: '/state', value: { count: 0, label: 'hi' } },
  { op: 'add', path: '/root', value: 'card' },
  {
    op: 'add',
    path: '/elements/card',
    value: { type: 'Card', children: ['title', 'btn'] },
  },
  {
    op: 'add',
    path: '/elements/title',
    value: { type: 'Text', props: { value: 'Hello' } },
  },
  {
    op: 'add',
    path: '/elements/btn',
    value: { type: 'Button', props: { label: 'Click' } },
  },
  { op: 'replace', path: '/elements/btn/props/label', value: 'Tap' },
  { op: 'add', path: '/state/count', value: 5 },
  { op: 'remove', path: '/elements/title' },
  { op: 'replace', path: '/elements/card/children', value: ['btn'] },
];

const seedSpec = (): Partial<Spec> => ({ elements: {} }) as Partial<Spec>;

function viaCompiler(seed: Partial<Spec>, ops: Op[]) {
  // Clone the seed per run — both strategies may mutate their base in place.
  const c = createSpecStreamCompiler<Spec>(structuredClone(seed));
  const snaps: unknown[] = [];
  for (const op of ops) {
    c.push(`${JSON.stringify(op)}\n`);
    snaps.push(structuredClone(c.getResult()));
  }
  return { final: structuredClone(c.getResult()), snaps };
}

function viaApply(seed: Partial<Spec>, ops: Op[]) {
  let acc = structuredClone(seed) as unknown as Record<string, unknown>;
  const snaps: unknown[] = [];
  for (const op of ops) {
    acc = applySpecStreamPatch(acc, op as unknown as SpecStreamLine);
    snaps.push(structuredClone(acc));
  }
  return { final: structuredClone(acc), snaps };
}

describe('op accumulation: applySpecStreamPatch ≡ compiler.push(JSON.stringify)', () => {
  it('matches at every snapshot + final (no seed)', () => {
    const a = viaCompiler(seedSpec(), OPS);
    const b = viaApply(seedSpec(), OPS);
    expect(b.snaps).toEqual(a.snaps);
    expect(b.final).toEqual(a.final);
  });

  it('matches when seeded with a prior spec (evolve mode)', () => {
    const prior: Partial<Spec> = {
      root: 'card',
      state: { count: 99 },
      elements: {
        card: { type: 'Card', children: ['old'] },
        old: { type: 'Text', props: { value: 'old' } },
      },
    } as unknown as Partial<Spec>;
    const evolve: Op[] = [
      {
        op: 'add',
        path: '/elements/fresh',
        value: { type: 'Button', props: { label: 'New' } },
      },
      { op: 'replace', path: '/elements/card/children', value: ['fresh'] },
      { op: 'remove', path: '/elements/old' },
    ];
    const a = viaCompiler(prior, evolve);
    const b = viaApply(prior, evolve);
    expect(b.snaps).toEqual(a.snaps);
    expect(b.final).toEqual(a.final);
  });
});
