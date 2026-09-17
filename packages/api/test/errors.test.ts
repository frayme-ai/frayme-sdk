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
  ERROR_CODE_TO_STATUS,
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
  it('maps the codes that share a status to that status\'s class, keeping the code', () => {
    const cases = [
      ['SERVICE_UNAVAILABLE', 503, ModelUnavailableError],
      ['INVALID_MANIFEST', 400, BadRequestError],
      ['CUSTOM_SLICE_TOO_LARGE', 400, BadRequestError],
      ['FEATURE_LIMIT', 403, AuthorizationError],
    ] as const;
    for (const [code, status, cls] of cases) {
      const err = errorFromEventCode(code, 'x');
      expect(err, code).toBeInstanceOf(cls);
      expect(err.status, code).toBe(status);
      expect(err.code, code).toBe(code);
    }
  });

  it('lists the general code first for each shared status', () => {
    const firstCodeFor = (status: number) =>
      Object.entries(ERROR_CODE_TO_STATUS).find(([, mapped]) => mapped === status)?.[0];
    expect(firstCodeFor(400)).toBe('BAD_REQUEST');
    expect(firstCodeFor(403)).toBe('FORBIDDEN');
    expect(firstCodeFor(503)).toBe('MODEL_UNAVAILABLE');
  });

  it('unknown codes fall back to InternalServerError', () => {
    expect(errorFromEventCode('SOMETHING_NEW', 'x')).toBeInstanceOf(InternalServerError);
  });
});
