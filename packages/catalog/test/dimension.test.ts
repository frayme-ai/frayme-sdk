import { describe, expect, it } from 'vitest';
import { safeDimension } from '../src/validate/dimension.js';

describe('safeDimension — the validated dimension/count channel', () => {
  it('accepts bare numbers (length → px, count → integer)', () => {
    expect(safeDimension(16)).toBe('16px');
    expect(safeDimension(0)).toBe('0px');
    expect(safeDimension(3, { kind: 'count' })).toBe('3');
    expect(safeDimension(2.6, { kind: 'count' })).toBe('3'); // rounded
  });

  it('accepts <number><unit> strings within the allowlist', () => {
    for (const [v, out] of [
      ['16px', '16px'],
      ['1.5rem', '1.5rem'],
      ['50%', '50%'],
      ['12ch', '12ch'],
      ['100vw', '100vw'],
      ['2fr', '2fr'],
      ['100', '100px'], // unitless string → px
    ] as const) {
      expect(safeDimension(v), v).toBe(out);
    }
  });

  it('clamps rem/em against PX-EQUIVALENT bounds (a "1rem" fontSize must NOT become "8rem")', () => {
    // Regression: bounds are authored in px scale (fontSize min:8/max:96); the
    // clamp used to hit the raw magnitude, turning "1rem" into "8rem" (128px).
    const fs = { units: ['px', 'rem'] as ('px' | 'rem')[], min: 8, max: 96 };
    expect(safeDimension('1rem', fs)).toBe('1rem'); // 16px-equiv, inside bounds
    expect(safeDimension('2.5rem', fs)).toBe('2.5rem'); // 40px-equiv
    expect(safeDimension('0.25rem', fs)).toBe('0.5rem'); // 4px-equiv → clamped UP to 8px = 0.5rem
    expect(safeDimension('8rem', fs)).toBe('6rem'); // 128px-equiv → clamped DOWN to 96px = 6rem
    expect(safeDimension('12px', fs)).toBe('12px'); // px path byte-identical
    expect(safeDimension('4px', fs)).toBe('8px'); // px min clamp unchanged
  });

  it('accepts sizing keywords for the length kind', () => {
    expect(safeDimension('auto')).toBe('auto');
    expect(safeDimension('min-content')).toBe('min-content');
    expect(safeDimension('fit-content')).toBe('fit-content');
  });

  it('clamps magnitude to [min, max] (and % to 100)', () => {
    expect(safeDimension(99999)).toBe('4096px'); // default max
    expect(safeDimension(5000, { max: 4096 })).toBe('4096px');
    expect(safeDimension('150%')).toBe('100%'); // % auto-capped
    expect(safeDimension(50, { kind: 'count', min: 1, max: 12 })).toBe('12');
    expect(safeDimension(0, { kind: 'count', min: 1, max: 6 })).toBe('1');
  });

  it('honours the unit allowlist and the count/length split', () => {
    expect(safeDimension('12px', { units: ['rem'] })).toBeNull(); // px not allowed
    expect(safeDimension('5rem', { kind: 'count' })).toBeNull(); // a count carries no unit
    expect(safeDimension('12pt')).toBeNull(); // pt not in the default allowlist
    expect(safeDimension('auto', { kind: 'count' })).toBeNull(); // keywords are length-only
    expect(safeDimension('auto', { allowKeywords: false })).toBeNull();
  });

  it('honours allowNegative (off by default)', () => {
    expect(safeDimension('-5px')).toBeNull();
    expect(safeDimension(-5)).toBeNull();
    expect(safeDimension('-5px', { allowNegative: true })).toBe('-5px');
  });

  it('rejects injection / break-out attempts', () => {
    for (const bad of [
      '16px;}body{display:none',
      '10px; background:url(//evil.test)',
      'calc(100% - 10px)',
      'var(--x)',
      'url(//evil.test)',
      'expression(alert(1))',
      '100px/* comment */',
      '<script>',
      '10 px', // internal whitespace
      '1e10', // scientific notation
      '123456px', // > 5 integer digits
      'red', // not a number/keyword
      '100%}', // stray brace
    ]) {
      expect(safeDimension(bad), bad).toBeNull();
    }
  });

  it('rejects non-finite numbers, non-strings and empties', () => {
    expect(safeDimension(Number.NaN)).toBeNull();
    expect(safeDimension(Number.POSITIVE_INFINITY)).toBeNull();
    expect(safeDimension({})).toBeNull();
    expect(safeDimension(['16px'])).toBeNull();
    expect(safeDimension(null)).toBeNull();
    expect(safeDimension(undefined)).toBeNull();
    expect(safeDimension('')).toBeNull();
    expect(safeDimension('   ')).toBeNull();
  });
});
