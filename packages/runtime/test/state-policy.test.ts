import { describe, expect, it } from 'vitest';

import { mergeOnRehydrate, resolveInitialState } from '../src/core/state-policy';

describe('mergeOnRehydrate', () => {
  it("keeps the client's value for a field the user edited", () => {
    expect(mergeOnRehydrate({ amount: '40', tab: 'a' }, { amount: '27', tab: 'a' })).toEqual({
      amount: '27',
      tab: 'a',
    });
  });

  it('brings through new agent fields (structure is agent-authoritative)', () => {
    expect(mergeOnRehydrate({ amount: '40', sortBy: 'date' }, { amount: '27' })).toEqual({
      amount: '27',
      sortBy: 'date',
    });
  });

  it('drops client-only fields the agent removed', () => {
    expect(mergeOnRehydrate({ amount: '40' }, { amount: '27', stale: 'x' })).toEqual({
      amount: '27',
    });
  });

  it('returns the agent state untouched when there is no client state', () => {
    const agent = { a: 1 };
    expect(mergeOnRehydrate(agent, undefined)).toBe(agent);
  });

  it('ignores undefined client values', () => {
    expect(mergeOnRehydrate({ a: '1' }, { a: undefined })).toEqual({ a: '1' });
  });
});

describe('resolveInitialState', () => {
  it('reads spec.state', () => {
    expect(resolveInitialState({ state: { x: 1 } })).toEqual({ x: 1 });
  });

  it('defaults to {} when state is absent or the spec is null', () => {
    expect(resolveInitialState({})).toEqual({});
    expect(resolveInitialState(null)).toEqual({});
  });
});
