import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CANONICAL_EVENTS, COMPONENT_EXTRA_EVENTS, canonicalize, fraymeCatalog } from '@frayme/catalog';
import { describe, expect, it } from 'vitest';

import { defaultRegistry } from '../src/react/registry/index.js';

/**
 * Conformance: the renderers and the schema `events[]` must speak the
 * SAME canonical vocabulary. Static scan of the registry .tsx files — every
 * `emit('x')` / `on('x')` arg is a string literal (asserted), so the scan reads
 * the source of truth without rendering.
 *
 * File-granular (several components share a renderer file + shared helpers like
 * ActionRow emit on a component's behalf), so we reconcile the file's emitted
 * canonical verbs against the UNION of its components' advertised `events[]`.
 */
const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/react/registry');
const EXCLUDED = new Set(['focus', 'blur']); // browser lifecycle — emitted, never advertised
const COMPONENT_NAMES = new Set(Object.keys(defaultRegistry));
const CANON = new Set<string>(CANONICAL_EVENTS);

const defs = (fraymeCatalog as unknown as {
  data: { components: Record<string, { events?: string[] } | undefined> };
}).data.components;

const files = readdirSync(REGISTRY_DIR).filter((f) => f.endsWith('.tsx') && f !== 'Fallback.tsx');

const stripComments = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const exportNames = (t: string): string[] =>
  [...t.matchAll(/export function ([A-Za-z0-9_]+)/g)].map((m) => m[1]);
// standalone emit('x') / emitWith('x', {...}) / on('x') — the lookbehind skips
// `evt.emit()` handle calls; emitWith's first arg stays under the verb scan.
const eventLiterals = (t: string): string[] =>
  [...t.matchAll(/(?<![.\w])(?:emitWith|emit|on)\('([a-zA-Z]+)'\s*[,)]/g)].map((m) => m[1]);
const nonLiteralCalls = (t: string): string[] =>
  (t.match(/(?<![.\w])(?:emitWith|emit|on)\(\s*[^'\s)][^)]*\)/g) ?? []);

describe('event conformance — renderers ⇄ schema events[] (8 canonical verbs)', () => {
  it('every schema events[] entry is one of the 8 canonical verbs', () => {
    const offenders: string[] = [];
    for (const name of COMPONENT_NAMES) {
      for (const e of defs[name]?.events ?? []) {
        if (!CANON.has(e)) offenders.push(`${name}: "${e}"`);
      }
    }
    expect(offenders, `non-canonical events[] entries: ${offenders.join(' · ')}`).toEqual([]);
  });

  it('all emit()/on() calls use a string-literal argument (scan cannot be bypassed)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const bad = nonLiteralCalls(stripComments(readFileSync(join(REGISTRY_DIR, f), 'utf8')));
      if (bad.length) offenders.push(`${f}: ${bad.join(', ')}`);
    }
    expect(offenders, `non-literal emit/on calls: ${offenders.join(' · ')}`).toEqual([]);
  });

  for (const f of files) {
    const text = stripComments(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
    const comps = exportNames(text).filter((n) => COMPONENT_NAMES.has(n));
    const literals = eventLiterals(text);
    const emitted = new Set<string>();
    for (const lit of literals) if (!EXCLUDED.has(lit)) emitted.add(lit);
    const advertised = new Set<string>();
    for (const c of comps) for (const e of defs[c]?.events ?? []) advertised.add(e);
    /* COMPONENT-SCOPED EXTRAS (catalog COMPONENT_EXTRA_EVENTS): verbs a specific
       renderer genuinely fires that are deliberately NOT part of the global
       8-verb collapse, so they never enter events[]/the prompt/the tool JSON.
       Folded in from the same map the validator and normalizer use, so all three
       checks below still bind — an emitted verb that is neither canonical nor a
       declared extra still fails, and an extra nothing emits still fails. */
    const extras = new Set<string>();
    for (const c of comps) for (const e of COMPONENT_EXTRA_EVENTS[c] ?? []) extras.add(e);
    for (const e of extras) advertised.add(e);

    if (comps.length === 0 && emitted.size === 0) continue; // no catalog components, no emits

    it(`${f}: every emit/on literal is already a canonical verb (migration complete)`, () => {
      const legacy = [...new Set(literals.filter((l) => !EXCLUDED.has(l) && !CANON.has(l) && !extras.has(l)))];
      expect(legacy, `${f} still emits non-canonical literals: ${legacy.join(', ')}`).toEqual([]);
    });

    it(`${f}: every emitted verb is advertised by a component's events[]`, () => {
      const missing = [...emitted].filter((v) => !advertised.has(v));
      expect(missing, `${f} emits [${missing}] not declared in any component events[]`).toEqual([]);
    });

    it(`${f}: every advertised verb is actually emitted in the file (no dead events[])`, () => {
      const dead = [...advertised].filter((v) => !emitted.has(v));
      expect(dead, `${f} advertises [${dead}] but no renderer emits them`).toEqual([]);
    });
  }
});
