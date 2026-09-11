import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * YouTube card (no iframe). The only gate-covered value channel is
 * `width` (a DIM_KEY); a rich spec must validate with resolution ON and an
 * unsafe width must be REJECTED with failureCategory 'unsafe_value'.
 */
const wrap = (id: string, el: Record<string, unknown>) => ({
  root: 'root',
  state: {},
  elements: { root: { type: 'Stack', props: { gap: 'md' }, children: [id] }, [id]: el },
});

describe('YouTube validates with resolution ON', () => {
  it('rich YouTube spec is valid', () => {
    const spec = wrap('yt', {
      type: 'YouTube',
      props: { videoId: 'dQw4w9WgXcQ', title: 'Demo', thumbnailQuality: 'hq', aspect: '16/9', showTitle: true, radius: 'lg', width: '480px' },
    });
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('url-form YouTube spec is valid', () => {
    const spec = wrap('yt2', { type: 'YouTube', props: { url: 'https://youtu.be/dQw4w9WgXcQ', width: '100%' } });
    expect(validateSpec(spec, { resolution: true }).valid).toBe(true);
  });
});

describe('YouTube adversarial width rejected', () => {
  const ADV = [
    { name: 'injection width', value: '480px;}<x>' },
    { name: 'calc width', value: 'calc(100% - 1px)' },
    { name: 'var width', value: 'var(--evil)' },
    { name: 'url width', value: 'url(//x)' },
  ];
  it.each(ADV)('rejects $name', ({ value }) => {
    const spec = wrap('yt', { type: 'YouTube', props: { videoId: 'dQw4w9WgXcQ', width: value } });
    expect(validateSpec(spec).valid).toBe(true);
    const g = validateSpec(spec, { resolution: true });
    expect(g.valid).toBe(false);
    expect(g.failureCategory).toBe('unsafe_value');
  });
});
