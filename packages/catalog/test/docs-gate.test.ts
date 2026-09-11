/**
 * The "full blown docs" gate (enforceable, not aspirational).
 *
 * Every component in the catalog must document itself completely enough that
 * downstream consumers never need to read renderer internals: a selection-grade
 * description, a house-contract describe on every top-level prop, and a
 * component-specific eventsDoc line for every declared event. This test IS the
 * definition of done for documentation — any future component or prop that
 * ships undocumented fails CI here.
 */
import { describe, expect, it } from 'vitest';
import { fraymeCatalog, CANONICAL_EVENTS } from '../src/index.js';

type CompDef = {
  props?: { shape?: Record<string, unknown> | (() => Record<string, unknown>) };
  events?: readonly string[];
  eventsDoc?: Record<string, string>;
  description?: string;
  example?: unknown;
};

const components = fraymeCatalog.data.components as Record<string, CompDef>;

function propDoc(schema: unknown): string {
  const s = schema as { description?: string; _def?: { description?: string; innerType?: { description?: string } } };
  return s?.description ?? s?._def?.description ?? s?._def?.innerType?.description ?? '';
}

function shapeOf(c: CompDef): Record<string, unknown> {
  const raw = c.props?.shape ?? {};
  return typeof raw === 'function' ? raw() : raw;
}

describe('docs gate — tip-top bar, all components', () => {
  it('every component has a selection-grade description (≥120 chars, ≥3 sentences)', () => {
    const thin: string[] = [];
    for (const [name, c] of Object.entries(components)) {
      const d = c.description ?? '';
      const sentences = (d.match(/[.!?](\s|$)/g) ?? []).length;
      if (d.length < 120 || sentences < 3) thin.push(`${name} (${d.length}ch/${sentences}s)`);
    }
    expect(thin, `thin descriptions:\n${thin.join('\n')}`).toEqual([]);
  });

  it('every top-level prop has a house-contract describe (≥50 chars)', () => {
    const bad: string[] = [];
    for (const [name, c] of Object.entries(components)) {
      for (const [p, s] of Object.entries(shapeOf(c))) {
        const doc = propDoc(s);
        if (doc.length < 50) bad.push(`${name}.${p} (${doc.length}ch)`);
      }
    }
    expect(bad, `undocumented/short props:\n${bad.join('\n')}`).toEqual([]);
  });

  it('every declared event has a component-specific eventsDoc line (≥20 chars)', () => {
    const bad: string[] = [];
    for (const [name, c] of Object.entries(components)) {
      for (const v of c.events ?? []) {
        const doc = c.eventsDoc?.[v] ?? '';
        if (doc.length < 20) bad.push(`${name}.${v} (${doc.length}ch)`);
      }
    }
    expect(bad, `events without docs:\n${bad.join('\n')}`).toEqual([]);
  });

  it('eventsDoc never documents an undeclared event, and verbs are canonical', () => {
    const bad: string[] = [];
    for (const [name, c] of Object.entries(components)) {
      const declared = new Set(c.events ?? []);
      for (const v of Object.keys(c.eventsDoc ?? {})) {
        if (!declared.has(v)) bad.push(`${name}.eventsDoc.${v} — not in events[]`);
        if (!(CANONICAL_EVENTS as readonly string[]).includes(v)) bad.push(`${name}.eventsDoc.${v} — not canonical`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('every component ships an example', () => {
    const missing = Object.entries(components)
      .filter(([, c]) => c.example == null)
      .map(([n]) => n);
    expect(missing, `examples missing:\n${missing.join('\n')}`).toEqual([]);
  });
});
