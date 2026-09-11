import { describe, expect, it } from 'vitest';
import { styleVars } from '../src/react/registry/_style.js';

describe('styleVars — the value-channel applier', () => {
  it('emits validated values as --* custom properties', () => {
    const s = styleVars(
      { var: '--fr-card-bg', value: '#6366f1', kind: 'color' },
      { var: '--fr-skel-w', value: '100%', kind: 'dim' },
    ) as Record<string, string>;
    expect(s['--fr-card-bg']).toBe('#6366f1');
    expect(s['--fr-skel-w']).toBe('100%');
  });

  it('omits null/undefined so the recipe falls back to its token default', () => {
    const s = styleVars(
      { var: '--fr-a', value: null, kind: 'color' },
      { var: '--fr-b', value: undefined, kind: 'dim' },
    ) as Record<string, string>;
    expect('--fr-a' in s).toBe(false);
    expect('--fr-b' in s).toBe(false);
  });

  it('omits unsafe values — they never reach the DOM (defence in depth)', () => {
    const s = styleVars(
      { var: '--fr-bg', value: 'red; }body{', kind: 'color' },
      { var: '--fr-w', value: '10px;}x{', kind: 'dim' },
      { var: '--fr-c', value: 'var(--evil)', kind: 'color' },
    ) as Record<string, string>;
    expect(Object.keys(s)).toHaveLength(0);
  });

  it('applies dimension opts (count channel, clamped)', () => {
    const s = styleVars({
      var: '--fr-grid-cols',
      value: 50,
      kind: 'dim',
      opts: { kind: 'count', min: 1, max: 6 },
    }) as Record<string, string>;
    expect(s['--fr-grid-cols']).toBe('6');
  });
});
