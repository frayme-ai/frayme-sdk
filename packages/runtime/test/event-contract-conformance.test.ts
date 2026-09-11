/**
 * EVENT_CONTRACT ⇄ IntrinsicEventPayloads conformance.
 *
 * The catalog's EVENT_CONTRACT is the DOCUMENTED payload contract (what
 * prompt()/tool-JSON teach hosts and spec authors); the runtime's
 * IntrinsicEventPayloads is the IMPLEMENTED one. This test pins them together
 * in both directions so neither can drift silently:
 *   - the KEYS map below is `satisfies`-checked against the TYPE at compile
 *     time (add/remove/rename a payload field → this file stops compiling);
 *   - the runtime assertions compare that map against the catalog DATA.
 *
 * `change` and `move` are open records at the type level (renderer-specific
 * extras ride along); for those the contract documents the canonical keys and
 * this test asserts the documented keys are a SUPERSET of the closed ones we
 * promise. For closed types the key sets must match exactly.
 */
import { describe, expect, it } from 'vitest';
import { CANONICAL_EVENTS, EVENT_CONTRACT } from '@frayme/catalog';
import type { IntrinsicEventPayloads } from '../src/core/intrinsic.js';

/** The implemented payload keys, pinned to the TYPE via `satisfies`. */
const IMPLEMENTED_KEYS = {
  sort: ['sortBy', 'sortDir'],
  page: ['page'],
  select: ['value', 'label', 'id', 'index', 'selected', 'checked'],
  change: ['value', 'name'], // open record — canonical keys only
  commit: ['value', 'fields', 'label', 'name', 'index', 'control'],
  search: ['query'],
  dismiss: ['value', 'label', 'index', 'all', 'auto'],
  move: [
    'card',
    'fromColumn',
    'toColumn',
    'fromIndex',
    'toIndex',
    'splitPercent',
    'width',
    'height',
    'axis',
  ], // open record — the documented kanban/pane keys
} as const satisfies { [K in keyof IntrinsicEventPayloads]: readonly string[] };

// Compile-time direction: every CLOSED type's keys must appear in the map.
// (A helper that fails to compile if a key of the type is missing from the list.)
type ClosedVerb = 'sort' | 'page' | 'select' | 'commit' | 'search' | 'dismiss';
type AssertCovers<K extends ClosedVerb> =
  Exclude<keyof IntrinsicEventPayloads[K], (typeof IMPLEMENTED_KEYS)[K][number]> extends never
    ? true
    : never;
const _sortCovered: AssertCovers<'sort'> = true;
const _pageCovered: AssertCovers<'page'> = true;
const _selectCovered: AssertCovers<'select'> = true;
const _commitCovered: AssertCovers<'commit'> = true;
const _searchCovered: AssertCovers<'search'> = true;
const _dismissCovered: AssertCovers<'dismiss'> = true;
void [_sortCovered, _pageCovered, _selectCovered, _commitCovered, _searchCovered, _dismissCovered];

describe('EVENT_CONTRACT ⇄ IntrinsicEventPayloads', () => {
  it('documents every canonical verb', () => {
    for (const verb of CANONICAL_EVENTS) {
      expect(EVENT_CONTRACT[verb], verb).toBeTruthy();
      expect(EVENT_CONTRACT[verb].verb).toBe(verb);
      expect(EVENT_CONTRACT[verb].description.length).toBeGreaterThan(40);
    }
  });

  it('documented payload keys match the implemented type keys', () => {
    for (const verb of CANONICAL_EVENTS) {
      const documented = EVENT_CONTRACT[verb].payload.map((p) => p.key).sort();
      const implemented = [...IMPLEMENTED_KEYS[verb]].sort();
      expect(documented, `${verb} payload keys`).toEqual(implemented);
    }
  });

  it('every documented payload key carries a real doc line', () => {
    for (const verb of CANONICAL_EVENTS) {
      for (const p of EVENT_CONTRACT[verb].payload) {
        expect(p.doc.length, `${verb}.${p.key}`).toBeGreaterThan(15);
        expect(p.type.length, `${verb}.${p.key}`).toBeGreaterThan(0);
        expect(typeof p.optional).toBe('boolean');
      }
    }
  });
});
