import { describe, expect, it } from 'vitest';

import { derefItemParams } from '../src/core/item-params.js';

const spec = {
  elements: {
    'approve-btn': {
      type: 'Button',
      on: {
        press: [
          { action: 'approveClaim', params: { claimId: { $item: 'claim' } } },
          { action: 'removeState', params: { statePath: '/picked' } },
        ],
      },
    },
    'reject-btn': {
      type: 'Button',
      on: {
        press: {
          action: 'rejectClaim',
          params: { claimId: { $item: 'claim' }, reason: { $state: '/rejectReason' } },
        },
      },
    },
  },
};

const state: Record<string, unknown> = {
  '/claims/0/claim': 'RC-2214',
  '/rejectReason': 'blurry receipt',
};
const get = (p: string) => state[p];

describe('derefItemParams', () => {
  it('dereferences an $item-authored param that arrived as a scoped path', () => {
    const out = derefItemParams(spec, 'approveClaim', { claimId: '/claims/0/claim', label: 'Approve claim' }, get);
    expect(out.claimId).toBe('RC-2214');
    expect(out.label).toBe('Approve claim'); // non-$item keys untouched
  });

  it('handles single-binding (non-array) on blocks', () => {
    const out = derefItemParams(spec, 'rejectClaim', { claimId: '/claims/0/claim', reason: 'blurry receipt' }, get);
    expect(out.claimId).toBe('RC-2214');
    expect(out.reason).toBe('blurry receipt'); // $state params already resolved upstream — passthrough
  });

  it('never rewrites keys the spec did not author as $item', () => {
    const out = derefItemParams(spec, 'approveClaim', { claimId: '/claims/0/claim', note: '/claims/0/claim' }, get);
    expect(out.note).toBe('/claims/0/claim');
  });

  it('leaves unresolvable paths and non-path values untouched', () => {
    const out = derefItemParams(spec, 'approveClaim', { claimId: '/nope/7/x' }, get);
    expect(out.claimId).toBe('/nope/7/x');
    const out2 = derefItemParams(spec, 'approveClaim', { claimId: 'RC-9000' }, get);
    expect(out2.claimId).toBe('RC-9000');
  });

  it('is identity (same reference) for actions with no $item params', () => {
    const params = { statePath: '/picked' };
    expect(derefItemParams(spec, 'removeState', params, get)).toBe(params);
  });
});
