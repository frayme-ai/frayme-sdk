import { describe, expect, it } from 'vitest';
import {
  Variant,
  Density,
  Justify,
  Elevation,
  Gap,
  Size,
  Tone,
  IconName,
} from '../src/components/_shared.js';
import { validateOps } from '../src/validate/index.js';

/**
 * The shared enum atoms are the single canonical vocabulary the ~120 new
 * catalog-expansion components reuse. These lock the accepted values + the
 * key OD-1 invariant: `Variant` is VISUAL hierarchy only — `danger`/`destructive`
 * are NOT in it (semantic intent lives in `Tone`, where `critical` is the danger
 * sense). Every atom is `.nullable()` so a props-less spec is valid.
 */
describe('shared enum atoms (catalog-expansion vocabulary)', () => {
  it('accepts the canonical values + null', () => {
    for (const v of ['default', 'primary', 'secondary', 'tertiary', 'ghost', 'outline', 'link', null]) {
      expect(Variant.safeParse(v).success, `Variant ${v}`).toBe(true);
    }
    expect(Density.safeParse('comfortable').success).toBe(true);
    expect(Justify.safeParse('between').success).toBe(true);
    expect(Justify.safeParse('evenly').success).toBe(true);
    expect(Elevation.safeParse('xl').success).toBe(true);
    expect(Gap.safeParse('none').success).toBe(true);
    for (const atom of [Variant, Density, Justify, Elevation, Gap]) {
      expect(atom.safeParse(null).success).toBe(true); // all nullable
    }
  });

  it('OD-1 invariant: Variant excludes danger/destructive (intent → Tone)', () => {
    expect(Variant.safeParse('danger').success).toBe(false);
    expect(Variant.safeParse('destructive').success).toBe(false);
    // the danger sense lives in Tone:
    expect(Tone.safeParse('critical').success).toBe(true);
  });

  it('rejects out-of-vocabulary junk', () => {
    expect(Density.safeParse('cozy').success).toBe(false);
    expect(Justify.safeParse('stretch').success).toBe(false); // stretch is an Align value, not Justify
    expect(Size.safeParse('xxl').success).toBe(false);
  });
});

/**
 * IconName is the closed glyph menu the Icon primitive / Menubar / Fab pick from.
 * It must now expose the FULL runtime registry (280 glyphs), so previously
 * drawn-but-unvalidatable names (shopping-cart, github, layout-grid, …) are usable,
 * while junk still fails. Byte-parity with the registry itself is asserted in the
 * runtime suite (test/icons.test.tsx); here we lock the vocabulary + spec round-trip.
 */
describe('IconName closed glyph menu', () => {
  it('exposes the full registry glyph set (280 names, no duplicates)', () => {
    expect(IconName.options.length).toBe(280);
    expect(new Set(IconName.options).size).toBe(280);
  });

  it('accepts core, long-tail, and brand glyphs alike', () => {
    for (const n of ['check', 'plus', 'star', 'shopping-cart', 'layout-grid', 'github', 'youtube']) {
      expect(IconName.safeParse(n).success, `IconName ${n}`).toBe(true);
    }
  });

  it('rejects unknown glyph names + null (name is required on the Icon primitive)', () => {
    expect(IconName.safeParse('totally-made-up-glyph').success).toBe(false);
    expect(IconName.safeParse('').success).toBe(false);
    expect(IconName.safeParse(null).success).toBe(false);
  });

  it('a spec naming a formerly-unusable glyph round-trips through validateOps', () => {
    const ops =
      '{"op":"add","path":"/root","value":"i"}\n' +
      '{"op":"add","path":"/elements/i","value":{"type":"Icon","props":{"name":"shopping-cart","size":"lg"}}}';
    const r = validateOps(ops, { resolution: true });
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('a spec naming a core glyph (star) that previously validated still round-trips', () => {
    const ops =
      '{"op":"add","path":"/root","value":"i"}\n' +
      '{"op":"add","path":"/elements/i","value":{"type":"Icon","props":{"name":"star"}}}';
    const r = validateOps(ops, { resolution: true });
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('junk glyph names are caught by the IconName enum (the prop-value gate)', () => {
    // Icon-name membership is enforced by the `IconName` Zod enum itself (used by
    // the prompt/docs surface + BYOC):
    expect(IconName.safeParse('not-a-real-icon').success).toBe(false);

    // …and, since the built-in prop gate landed (validate/props.ts), by
    // validateOps/validateSpec too. This assertion used to read
    // `expect(validateOps(ops).valid).toBe(true)`, with a note explaining that
    // built-in props compile to `z.record(unknown)` upstream for a 2+-component
    // catalog, so a bogus prop VALUE was NOT rejected there and the junk-name
    // guard could only live on the enum. That hole is closed: the gate walks each
    // built-in element's props against its catalog schema. A junk glyph is a
    // silent defect at render (the registry draws nothing), which is exactly the
    // class the gate exists to stop shipping as a success.
    const ops =
      '{"op":"add","path":"/root","value":"i"}\n' +
      '{"op":"add","path":"/elements/i","value":{"type":"Icon","props":{"name":"not-a-real-icon"}}}';
    const r = validateOps(ops);
    expect(r.valid).toBe(false);
    expect(r.failureCategory).toBe('invalid_prop_value');
    // the pre-gate behaviour is still reachable for callers that want it
    expect(validateOps(ops, { props: false }).valid).toBe(true);
  });
});
