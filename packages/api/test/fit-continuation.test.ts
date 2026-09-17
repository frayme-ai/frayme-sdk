import { describe, expect, it } from 'vitest';
import {
  ACTION_CONTEXT_MAX_CHARS,
  COMPOSE_DATA_MAX_CHARS,
  PRIOR_SPEC_MAX_CHARS,
  fitContinuation,
  jsonSize,
} from '../src/index.js';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `R-${i}`, note: 'x'.repeat(40) }));

describe('fitContinuation', () => {
  it('keeps everything that fits, and says nothing was cut', () => {
    const context = { action: 'go', params: { id: '7' }, state: { a: 1 } };
    const spec = { root: 'r', elements: {} };
    const out = fitContinuation({ action_context: context, prior_spec: spec });
    expect(out).toEqual({ action_context: context, prior_spec: spec, trimmed: [] });
    expect(out.action_context).toBe(context);
  });

  it('drops state first, then params, and never the action or ids', () => {
    const big = { action: 'reassign', event: 'commit', element_id: 't', generation_id: 'g', params: { row: { id: 1 } }, state: { rows: rows(400) } };
    const stateless = fitContinuation({ action_context: big });
    expect(stateless.trimmed).toEqual(['state']);
    expect(stateless.action_context).toEqual({ action: 'reassign', event: 'commit', element_id: 't', generation_id: 'g', params: { row: { id: 1 } } });
    expect(big.state).toBeDefined(); // the input is untouched

    const both = { ...big, params: { rows: rows(400) } };
    const bare = fitContinuation({ action_context: both });
    expect(bare.trimmed).toEqual(['state', 'params']);
    expect(bare.action_context).toEqual({ action: 'reassign', event: 'commit', element_id: 't', generation_id: 'g' });
    expect(jsonSize(bare.action_context)).toBeLessThanOrEqual(ACTION_CONTEXT_MAX_CHARS);
  });

  it('keeps state when params alone are the problem', () => {
    const context = { action: 'x', params: { rows: rows(400) }, state: { small: true } };
    const out = fitContinuation({ action_context: context });
    // State goes first by rule, then params; both were needed to fit.
    expect(out.trimmed).toEqual(['state', 'params']);
  });

  it('leaves out a prior screen over its ceiling', () => {
    const spec = { root: 'r', elements: { r: { type: 'Text', props: { content: 'y'.repeat(PRIOR_SPEC_MAX_CHARS) } } } };
    const out = fitContinuation({ prior_spec: spec });
    expect(out).toEqual({ trimmed: ['prior_spec'] });
  });

  it('treats a value that cannot be serialized as too large', () => {
    const cyclic: Record<string, unknown> = { action: 'x' };
    cyclic.params = cyclic;
    expect(jsonSize(cyclic)).toBe(Number.POSITIVE_INFINITY);
    expect(jsonSize(undefined)).toBe(4);
  });

  it('exports the ceilings the API enforces', () => {
    expect([COMPOSE_DATA_MAX_CHARS, PRIOR_SPEC_MAX_CHARS, ACTION_CONTEXT_MAX_CHARS]).toEqual([48_000, 48_000, 16_000]);
  });
});
