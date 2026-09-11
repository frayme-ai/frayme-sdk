import { afterEach, describe, expect, it, vi } from 'vitest';
import { backoffMs, isRetryableStatus, retryAfterMs } from '../src/core/retry.js';

afterEach(() => vi.restoreAllMocks());

describe('isRetryableStatus', () => {
  it('matches the openai-node retry set: 408, 409, 429, >=500', () => {
    for (const s of [408, 409, 429, 500, 502, 503, 504, 599]) {
      expect(isRetryableStatus(s), String(s)).toBe(true);
    }
    for (const s of [400, 401, 402, 403, 404, 422]) {
      expect(isRetryableStatus(s), String(s)).toBe(false);
    }
  });
});

describe('backoffMs', () => {
  it('is exponential (500·2^n capped at 5000) with equal jitter [0.5, 1.0)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // jitter factor 0.5
    expect(backoffMs(0)).toBe(250);
    expect(backoffMs(1)).toBe(500);
    expect(backoffMs(3)).toBe(2000);
    expect(backoffMs(10)).toBe(2500); // capped base 5000 × 0.5
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    expect(backoffMs(0)).toBeLessThan(500);
    expect(backoffMs(0)).toBeGreaterThan(499);
  });
});

describe('retryAfterMs', () => {
  it('parses integer seconds within (0, 60s]', () => {
    expect(retryAfterMs('1')).toBe(1000);
    expect(retryAfterMs('60')).toBe(60000);
  });
  it('rejects missing, zero, negative, and >60s values', () => {
    expect(retryAfterMs(null)).toBeUndefined();
    expect(retryAfterMs('0')).toBeUndefined();
    expect(retryAfterMs('-5')).toBeUndefined();
    expect(retryAfterMs('61')).toBeUndefined();
    expect(retryAfterMs('garbage')).toBeUndefined();
  });
  it('parses HTTP-dates within the cap', () => {
    const inFuture = new Date(Date.now() + 5000).toUTCString();
    const ms = retryAfterMs(inFuture);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });
});
