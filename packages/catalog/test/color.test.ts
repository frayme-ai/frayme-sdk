import { describe, expect, it } from 'vitest';
import { safeColor } from '../src/validate/color.js';

describe('safeColor — the validated color-value channel', () => {
  it('accepts real CSS colors', () => {
    for (const c of [
      '#fff',
      '#ffff',
      '#6366f1',
      '#6366f180',
      'rgb(255, 0, 0)',
      'rgba(0,0,0,0.5)',
      'hsl(200 50% 50%)',
      'oklch(0.7 0.1 200)',
      'lab(50% 40 59.5)',
      'red',
      'transparent',
      'currentColor',
    ]) {
      expect(safeColor(c), c).toBe(c);
    }
  });

  it('rejects injection / break-out attempts', () => {
    for (const bad of [
      'red; background:url(//evil.test)',
      'url(//evil.test)',
      'rgb(0,0,0); } body{}',
      'expression(alert(1))',
      'var(--x)',
      '#fff/* comment */',
      '<script>',
      'rgb(0,0,0)\n}',
      "url('x')",
      '#xyz', // not valid hex
      '#12345', // wrong hex length
      'a'.repeat(100), // too long
    ]) {
      expect(safeColor(bad), bad).toBeNull();
    }
  });

  it('rejects non-strings and empties', () => {
    expect(safeColor(123)).toBeNull();
    expect(safeColor(null)).toBeNull();
    expect(safeColor(undefined)).toBeNull();
    expect(safeColor('')).toBeNull();
    expect(safeColor('   ')).toBeNull();
  });
});
