/**
 * A follow-up request cut to fit the API's size ceilings.
 *
 * A press can be far larger than the screen it came from: a table's row action
 * carries every row in `params`, and `state` repeats them. Sent whole, such a
 * press is a 400 before any model call, and sending it again fails the same
 * way. So the parts the next screen can do without go first: the state (the
 * params already hold what the control resolved), then the params (the action
 * name and ids still say what was pressed). A prior screen over its ceiling is
 * left out, and the next screen is built from the press alone.
 */
import type { Spec } from '@json-render/core';
import type { ComposeActionContext } from './api-types.js';
import { ACTION_CONTEXT_MAX_CHARS, PRIOR_SPEC_MAX_CHARS } from './limits.js';

/** What `fitContinuation` left out to fit. */
export type FraymeTrimmed = 'state' | 'params' | 'prior_spec';

export interface FitContinuationInput {
  action_context?: ComposeActionContext;
  prior_spec?: Spec | Record<string, unknown>;
}

export interface FitContinuationResult extends FitContinuationInput {
  /** In the order they were left out; empty when everything fits. */
  trimmed: FraymeTrimmed[];
}

/** The serialized size, or Infinity for a value that cannot be serialized (it could not be sent). */
export function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value ?? null).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Fit an `action_context` and a `prior_spec` to the API's ceilings. Returns new
 * objects where anything was left out and never mutates the input.
 */
export function fitContinuation(input: FitContinuationInput): FitContinuationResult {
  const out: FitContinuationResult = { trimmed: [] };
  if (input.prior_spec !== undefined) {
    if (jsonSize(input.prior_spec) <= PRIOR_SPEC_MAX_CHARS) out.prior_spec = input.prior_spec;
    else out.trimmed.push('prior_spec');
  }
  let context = input.action_context;
  if (context !== undefined && jsonSize(context) > ACTION_CONTEXT_MAX_CHARS && context.state !== undefined) {
    const { state: _state, ...rest } = context;
    context = rest;
    out.trimmed.push('state');
  }
  if (context !== undefined && jsonSize(context) > ACTION_CONTEXT_MAX_CHARS && context.params !== undefined) {
    const { params: _params, ...rest } = context;
    context = rest;
    out.trimmed.push('params');
  }
  if (context !== undefined) out.action_context = context;
  return out;
}
