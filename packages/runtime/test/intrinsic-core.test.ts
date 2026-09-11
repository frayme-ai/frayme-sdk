import { describe, expect, it } from 'vitest';
import {
  JSON_RENDER_BUILTIN_ACTIONS,
  createIntrinsicSlots,
  mergeIntrinsicParams,
} from '../src/core/intrinsic.js';

describe('createIntrinsicSlots', () => {
  it('stashes one entry per non-builtin binding action and pops on take', () => {
    const slots = createIntrinsicSlots();
    slots.stash({ sort: { action: 'sort_rows' } }, 'sort', { sortBy: 'price', sortDir: 'asc' });
    const entry = slots.take('sort_rows');
    expect(entry?.event).toBe('sort');
    expect(entry?.payload).toEqual({ sortBy: 'price', sortDir: 'asc' });
    expect(slots.take('sort_rows')).toBeUndefined(); // pop-on-consume
  });

  it('handles the ActionBinding-ARRAY form — every bound action gets the payload', () => {
    const slots = createIntrinsicSlots();
    slots.stash({ commit: [{ action: 'a1' }, { action: 'a2' }] }, 'commit', { value: 'x' });
    expect(slots.take('a1')?.payload).toEqual({ value: 'x' });
    expect(slots.take('a2')?.payload).toEqual({ value: 'x' }); // NOT cleared by a1's take
  });

  it('skips json-render builtins and malformed bindings', () => {
    const slots = createIntrinsicSlots();
    slots.stash(
      { change: [{ action: 'setState' }, { action: 'real' }, null, { noAction: true }] },
      'change',
      { value: 1 },
    );
    expect(slots.take('setState')).toBeUndefined();
    expect(slots.take('real')?.payload).toEqual({ value: 1 });
    expect(JSON_RENDER_BUILTIN_ACTIONS.has('validateForm')).toBe(true);
  });

  it('does not stash for an unbound event (emit no-ops → no leak)', () => {
    const slots = createIntrinsicSlots();
    slots.stash({ commit: { action: 'a' } }, 'dismiss', { value: 1 });
    expect(slots.take('a')).toBeUndefined();
    slots.stash(undefined, 'commit', { value: 1 });
    expect(slots.take('a')).toBeUndefined();
  });

  it('last-write-wins per action name', () => {
    const slots = createIntrinsicSlots();
    slots.stash({ change: { action: 'a' } }, 'change', { value: 1 });
    slots.stash({ change: { action: 'a' } }, 'change', { value: 2 });
    expect(slots.take('a')?.payload).toEqual({ value: 2 });
  });

  /* IDENTITY-ONLY ENTRIES. A payload-less emitWith now stashes `{}` with
     the fid so the carrier gate (core/dynamic-gate.ts) can tell WHICH element
     fired. Two things must hold: the entry carries the identity, and `take` writes
     NO mirror for it — an empty mirror would arm the commit latch on a control that
     recorded nothing. */
  it('an empty payload still stashes fid + verb, and take() writes no mirror for it', () => {
    const writes: Array<[string, unknown]> = [];
    const store = { get: () => undefined, set: (p: string, v: unknown) => { writes.push([p, v]); } };
    const slots = createIntrinsicSlots(() => store);
    expect(slots.stash({ commit: { action: 'go' } }, 'commit', {}, 'btn', 3)).toBe(true);
    const entry = slots.take('go');
    expect(entry).toMatchObject({ event: 'commit', payload: {}, fid: 'btn', row: 3 });
    expect(writes).toEqual([]);
    // and a non-empty payload from the same shape DOES mirror (the unchanged path)
    slots.stash({ commit: { action: 'go' } }, 'commit', { label: 'Go' }, 'btn', null);
    slots.take('go');
    expect(writes).toEqual([['/_ui/btn/commit', { label: 'Go' }]]);
  });

  it('an identity-only stash OVERWRITES a stale entry left by a cancelled confirm (no leak)', () => {
    const slots = createIntrinsicSlots();
    slots.stash({ commit: { action: 'go' } }, 'commit', { stale: 'yes' }, 'a');
    // the confirm was cancelled: nothing took the entry. The next fire of the same
    // action from another element replaces it rather than inheriting it.
    slots.stash({ commit: { action: 'go' } }, 'commit', {}, 'b');
    expect(slots.take('go')).toMatchObject({ payload: {}, fid: 'b' });
  });

  /* THE AFFORDANCE RIDES ALONG. The per-item action contract names its gesture at
     the emit site; the carrier gate reads it off the entry. Absent by default. */
  it('carries the affordance the emit site asserted, and nothing when it asserted none', () => {
    const slots = createIntrinsicSlots();
    slots.stash({ commit: { action: 'go' } }, 'commit', { action: 'approve' }, 'tbl', null, 'row-action');
    expect(slots.take('go')).toMatchObject({ fid: 'tbl', affordance: 'row-action' });
    slots.stash({ commit: { action: 'go' } }, 'commit', { label: 'Go' }, 'btn');
    expect(slots.take('go')?.affordance).toBeUndefined();
  });

  /* CHAINS INHERIT IDENTITY. json-render runs `onSuccess` /
     `onError` by re-entering execute() with a bare `{ action }` — no emit site, so
     nothing would stash for them and the gate denied every chain as unidentified.
     The trigger's stash now enqueues an identity-only entry under each chained
     name: same fid / verb / row, empty payload (no mirror, params unchanged). */
  it('stashes an identity-only entry for a binding\'s onSuccess and onError actions', () => {
    const writes: Array<[string, unknown]> = [];
    const store = { get: () => undefined, set: (p: string, v: unknown) => { writes.push([p, v]); } };
    const slots = createIntrinsicSlots(() => store);
    expect(slots.stash(
      { commit: { action: 'save', onSuccess: { action: 'notify' }, onError: { action: 'rollback' } } },
      'commit', { label: 'Save' }, 'btn', 2, 'row-action',
    )).toBe(true);
    expect(slots.take('save')).toMatchObject({ event: 'commit', payload: { label: 'Save' }, fid: 'btn', row: 2 });
    expect(slots.take('notify')).toMatchObject({ event: 'commit', payload: {}, fid: 'btn', row: 2, affordance: 'row-action' });
    expect(slots.take('rollback')).toMatchObject({ event: 'commit', payload: {}, fid: 'btn', row: 2 });
    // only the trigger wrote a mirror — the identity-only chain entries did not
    expect(writes.map(([p]) => p)).toEqual(['/_ui/btn/commit', '/_ui/btn/__rows/2/commit']);
  });

  it('a chain target that is ALSO a primary in the same array keeps its payload; builtins and self-chains are skipped', () => {
    const slots = createIntrinsicSlots();
    slots.stash(
      { commit: [{ action: 'a', onSuccess: { action: 'b' } }, { action: 'b' }, { action: 'c', onSuccess: { action: 'setState' } }, { action: 'd', onError: { action: 'd' } }] },
      'commit', { v: 1 }, 'x',
    );
    expect(slots.take('b')?.payload).toEqual({ v: 1 });     // the primary's payload survives
    expect(slots.take('setState')).toBeUndefined();          // a builtin chain never reaches the Proxy
    expect(slots.take('d')?.payload).toEqual({ v: 1 });     // a self-chain does not clobber itself
    expect(slots.stash({ commit: { action: 'setState', onSuccess: { action: 'x' } } }, 'commit', {}, 'y')).toBe(false);
    expect(slots.take('x'), 'a builtin trigger has no chain (json-render returns before executeAction)').toBeUndefined();
  });

  /* DISCARD SWEEPS THIS ELEMENT'S FIRE, AND ONLY THIS ELEMENT'S. Called at settle
     by the emit site; a cancelled confirm's entry and an un-run chain branch go,
     another element's pending entry for the same name stays. */
  it('discard(fid, event, row) drops the matching entries and leaves the rest', () => {
    const slots = createIntrinsicSlots();
    slots.stash({ commit: { action: 'go', onError: { action: 'undo' } } }, 'commit', { a: 1 }, 'btnA', null);
    slots.stash({ commit: { action: 'other' } }, 'commit', { b: 2 }, 'btnB', null);
    slots.stash({ change: { action: 'pick' } }, 'change', { c: 3 }, 'btnA', null);   // same element, other verb
    slots.stash({ commit: { action: 'rowGo' } }, 'commit', { d: 4 }, 'btnA', 1);     // same element, a repeat row
    slots.discard('btnA', 'commit', null);
    expect(slots.take('go')).toBeUndefined();
    expect(slots.take('undo')).toBeUndefined();
    expect(slots.take('other')?.fid).toBe('btnB');
    expect(slots.take('pick')?.fid).toBe('btnA');
    expect(slots.take('rowGo')?.row).toBe(1);
    // no identity → nothing can match → nothing is dropped
    slots.stash({ commit: { action: 'anon' } }, 'commit', { e: 5 });
    slots.discard(null, 'commit', null);
    slots.discard(undefined, 'commit');
    expect(slots.take('anon')?.payload).toEqual({ e: 5 });
  });
});

describe('mergeIntrinsicParams', () => {
  it('intrinsic fills the floor; authored wins per-key', () => {
    expect(mergeIntrinsicParams({ sortBy: 'i', sortDir: 'asc' }, { sortBy: 'authored' })).toEqual({
      sortBy: 'authored',
      sortDir: 'asc',
    });
  });

  it('authored undefined does NOT clobber intrinsic (unresolved $state)', () => {
    expect(mergeIntrinsicParams({ value: 'kept' }, { value: undefined, extra: 1 })).toEqual({
      value: 'kept',
      extra: 1,
    });
  });

  it('empty authored / empty intrinsic pass through', () => {
    expect(mergeIntrinsicParams({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(mergeIntrinsicParams({}, { b: 2 })).toEqual({ b: 2 });
  });
});
