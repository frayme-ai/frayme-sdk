import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  CompositionFailedError,
  FraymeError,
  IdempotencyKeyInUseError,
  InternalServerError,
  ModelUnavailableError,
  PaymentRequiredError,
  QuotaExceededError,
  RateLimitError,
  ValidationError,
  castError,
  errorFromEventCode,
} from '../src/core/errors.js';

const envelope = (code: string, message = 'boom'): unknown => ({
  success: false,
  error: { message, code },
});

describe('castError', () => {
  it.each([
    [400, 'BAD_REQUEST', BadRequestError],
    [401, 'AUTHENTICATION_REQUIRED', AuthenticationError],
    [402, 'PAYMENT_REQUIRED', PaymentRequiredError],
    [403, 'FORBIDDEN', AuthorizationError],
    [409, 'IDEMPOTENCY_KEY_IN_USE', IdempotencyKeyInUseError],
    [422, 'VALIDATION_ERROR', ValidationError],
    [502, 'COMPOSITION_FAILED', CompositionFailedError],
    [503, 'MODEL_UNAVAILABLE', ModelUnavailableError],
    [500, 'INTERNAL_SERVER_ERROR', InternalServerError],
  ] as const)('%i %s → %o', (status, code, cls) => {
    const err = castError(status, envelope(code));
    expect(err).toBeInstanceOf(cls);
    expect(err.status).toBe(status);
    expect(err.code).toBe(code);
    expect(err.message).toBe('boom');
  });

  it('splits 429 on the code: RATE_LIMITED (with retryAfter) vs QUOTA_EXCEEDED', () => {
    const rl = castError(429, envelope('RATE_LIMITED'), new Headers({ 'retry-after': '7' }));
    expect(rl).toBeInstanceOf(RateLimitError);
    expect((rl as RateLimitError).retryAfter).toBe(7);

    const quota = castError(429, envelope('QUOTA_EXCEEDED'));
    expect(quota).toBeInstanceOf(QuotaExceededError);
  });

  it('captures x-request-id and survives non-JSON bodies', () => {
    const err = castError(500, 'gateway exploded', new Headers({ 'x-request-id': 'req_42' }));
    expect(err.requestId).toBe('req_42');
    expect(err.message).toContain('gateway exploded');
    const fallback = castError(418, {});
    expect(fallback).toBeInstanceOf(FraymeError);
    expect(fallback.message).toContain('418');
  });
});

describe('errorFromEventCode (in-band stream errors)', () => {
  it('maps COMPOSITION_FAILED to the 502 class without an HTTP response', () => {
    const err = errorFromEventCode('COMPOSITION_FAILED', 'validation failed after fallback');
    expect(err).toBeInstanceOf(CompositionFailedError);
    expect(err.status).toBe(502);
  });
  it('unknown codes fall back to InternalServerError', () => {
    expect(errorFromEventCode('SOMETHING_NEW', 'x')).toBeInstanceOf(InternalServerError);
  });
});
