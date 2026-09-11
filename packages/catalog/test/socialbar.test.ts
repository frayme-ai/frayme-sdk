import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * SocialBar. Its gate-covered value channel is `accent` (a COLOR_KEY).
 * A rich spec validates with resolution ON; an unsafe accent is REJECTED with
 * failureCategory 'unsafe_value'.
 */
const wrap = (id: string, el: Record<string, unknown>) => ({
  root: 'root',
  state: {},
  elements: { root: { type: 'Stack', props: { gap: 'md' }, children: [id] }, [id]: el },
});

describe('SocialBar validates with resolution ON', () => {
  it('rich SocialBar spec is valid', () => {
    const spec = wrap('sb', {
      type: 'SocialBar',
      props: {
        items: [
          { network: 'github', href: 'https://github.com/frayme' },
          { network: 'twitter', href: 'https://twitter.com/frayme' },
          { icon: 'mail', href: 'mailto:hi@frayme.ai', label: 'Email' },
        ],
        variant: 'filled',
        size: 'lg',
        align: 'center',
        accent: '#7c3aed',
        accentText: '#ffffff',
      },
    });
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });
});

describe('SocialBar adversarial color channels rejected', () => {
  const ADV = ['red;}<x>', 'expression(alert(1))', 'url(//evil)', 'var(--evil)'];
  it.each(ADV)('rejects accent %s', (accent) => {
    const spec = wrap('sb', { type: 'SocialBar', props: { items: [{ network: 'github', href: 'https://x.com' }], accent } });
    expect(validateSpec(spec).valid).toBe(true);
    const g = validateSpec(spec, { resolution: true });
    expect(g.valid).toBe(false);
    expect(g.failureCategory).toBe('unsafe_value');
  });
  it.each(ADV)('rejects accentText %s', (accentText) => {
    const spec = wrap('sb', { type: 'SocialBar', props: { items: [{ network: 'github', href: 'https://x.com' }], variant: 'filled', accentText } });
    const g = validateSpec(spec, { resolution: true });
    expect(g.valid).toBe(false);
    expect(g.failureCategory).toBe('unsafe_value');
  });
});
