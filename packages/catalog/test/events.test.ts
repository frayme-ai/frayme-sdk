import { describe, expect, it } from 'vitest';

import {
  CANONICAL_EVENTS,
  CANONICAL_TO_LEGACY,
  EVENT_ALIASES,
  canonicalEvents,
  canonicalize,
  isCanonical,
  type CanonicalEvent,
} from '../src/components/events.js';

// The 24 distinct legacy event names observed across the catalog renderers +
// schemas (the collapse source). Every one MUST resolve to a canonical verb.
const OBSERVED_LEGACY = [
  'action', 'blur', 'change', 'choose', 'clear', 'close', 'complete', 'confirm',
  'deny', 'dismiss', 'focus', 'move', 'open', 'pageChange', 'press', 'remove',
  'resize', 'search', 'select', 'selectDate', 'selectRow', 'sort', 'submit', 'toggle',
];

describe('canonical event taxonomy (8a)', () => {
  it('declares exactly the 8 canonical verbs', () => {
    expect([...CANONICAL_EVENTS]).toEqual([
      'commit', 'select', 'change', 'dismiss', 'search', 'sort', 'page', 'move',
    ]);
    expect(new Set(CANONICAL_EVENTS).size).toBe(8);
  });

  it('maps every observed legacy name to a canonical verb', () => {
    for (const name of OBSERVED_LEGACY) {
      const verb = canonicalize(name);
      expect(verb, `legacy "${name}" should canonicalize`).toBeDefined();
      expect(CANONICAL_EVENTS).toContain(verb);
    }
  });

  it('every alias value is a canonical verb', () => {
    for (const verb of Object.values(EVENT_ALIASES)) {
      expect(CANONICAL_EVENTS).toContain(verb);
    }
  });

  it('canonical verbs round-trip (identity rows present)', () => {
    for (const verb of CANONICAL_EVENTS) {
      expect(canonicalize(verb)).toBe(verb);
      expect(isCanonical(verb)).toBe(true);
    }
  });

  it('resolves the load-bearing collapses correctly', () => {
    expect(canonicalize('press')).toBe('commit');
    expect(canonicalize('submit')).toBe('commit');
    expect(canonicalize('action')).toBe('commit');
    expect(canonicalize('choose')).toBe('commit');
    expect(canonicalize('selectRow')).toBe('select');
    expect(canonicalize('selectDate')).toBe('select');
    expect(canonicalize('toggle')).toBe('change');
    expect(canonicalize('open')).toBe('change');
    expect(canonicalize('close')).toBe('dismiss');
    expect(canonicalize('remove')).toBe('dismiss');
    expect(canonicalize('clear')).toBe('dismiss');
    expect(canonicalize('pageChange')).toBe('page');
    expect(canonicalize('resize')).toBe('move');
  });

  it('isCanonical rejects legacy names', () => {
    expect(isCanonical('press')).toBe(false);
    expect(isCanonical('selectRow')).toBe(false);
    expect(isCanonical('commit')).toBe(true);
  });

  it('canonicalize returns undefined for an unknown name', () => {
    expect(canonicalize('frobnicate')).toBeUndefined();
  });

  it('canonicalEvents de-dupes and preserves order', () => {
    expect(canonicalEvents(['sort', 'selectRow', 'pageChange'])).toEqual(['sort', 'select', 'page']);
    expect(canonicalEvents(['submit', 'press'])).toEqual(['commit']); // both -> commit, deduped
    expect(canonicalEvents(['change', 'search'])).toEqual(['change', 'search']);
    expect(canonicalEvents(['close', 'remove', 'clear'])).toEqual(['dismiss']); // all -> dismiss
    expect(canonicalEvents(['frobnicate'])).toEqual([]); // unknown dropped
  });

  it('CANONICAL_TO_LEGACY is the inverse of EVENT_ALIASES', () => {
    for (const [legacy, verb] of Object.entries(EVENT_ALIASES)) {
      expect(CANONICAL_TO_LEGACY[verb as CanonicalEvent]).toContain(legacy);
    }
    // every canonical verb has at least its identity alias
    for (const verb of CANONICAL_EVENTS) {
      expect(CANONICAL_TO_LEGACY[verb].length).toBeGreaterThan(0);
    }
  });
});
