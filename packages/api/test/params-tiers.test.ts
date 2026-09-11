import { describe, expect, it } from 'vitest';
import { normalizeActionParams, normalizeRequiredItems } from '../src/api-types.js';

/**
 * FOUR PARAMS FIDELITY TIERS — a host should not have to write JSON Schema to say
 * "this action takes an amount". Each tier is asserted, plus the two shape traps that
 * have already cost real defects in this codebase.
 */
describe('params fidelity tiers', () => {
  it('tier 1 — JSON-Schema wrapper', () => {
    expect(Object.keys(normalizeActionParams({ type: 'object', properties: { amount: { description: 'x' } } })))
      .toEqual(['amount']);
  });

  it('tier 2 — flat map, the shape the tool JSON documents', () => {
    expect(Object.keys(normalizeActionParams({ amount: { description: 'x' }, note: {} })))
      .toEqual(['amount', 'note']);
  });

  it('tier 3 — names only, as an object or an array', () => {
    expect(Object.keys(normalizeActionParams({ amount: {}, note: {} }))).toEqual(['amount', 'note']);
    expect(Object.keys(normalizeActionParams(['amount', 'note']))).toEqual(['amount', 'note']);
  });

  it('tier 4 — omitted', () => {
    expect(normalizeActionParams(undefined)).toEqual({});
  });

  it('a param NAMED `properties` is not mistaken for a wrapper', () => {
    /* A property-listing app really has one. Testing `'properties' in params` alone
       reads that flat declaration as a wrapper and returns a single param called
       `description`, so the discriminator requires `type:"object"` as well. */
    expect(Object.keys(normalizeActionParams({ date: { description: 'when' }, properties: { description: 'houses' } })).sort())
      .toEqual(['date', 'properties']);
  });

  it('a param NAMED `type` is not mistaken for a wrapper either', () => {
    // Its value is an object, never the string "object" — which is what separates them.
    expect(Object.keys(normalizeActionParams({ type: { description: 'kind' }, size: {} })).sort())
      .toEqual(['size', 'type']);
  });

  it('required names: action level wins, tier-1 wrapper still read', () => {
    expect(normalizeRequiredItems({ requiredItems: ['a'], params: { type: 'object', properties: {}, required: ['b'] } }))
      .toEqual(['a']);
    expect(normalizeRequiredItems({ params: { type: 'object', properties: {}, required: ['b'] } }))
      .toEqual(['b']);
    expect(normalizeRequiredItems({ params: { amount: {} } })).toEqual([]);
  });
});
