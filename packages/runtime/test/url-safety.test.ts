import { describe, expect, it } from 'vitest';
import { safeUrl, safeImageSrc, linkTargetRel } from '../src/react/registry/url-safety.js';

describe('safeUrl — navigable link scheme guard', () => {
  it('passes http/https/mailto/tel + relative/fragment', () => {
    for (const u of ['https://x.test', 'http://x.test', 'mailto:a@b.co', 'tel:+1', '/path', '#frag', 'rel/path']) {
      expect(safeUrl(u), u).toBe(u);
    }
  });
  it('neutralizes dangerous schemes to "#"', () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'java\tscript:alert(1)']) {
      expect(safeUrl(u), u).toBe('#');
    }
  });
});

describe('safeImageSrc — raster-only media guard', () => {
  it('passes http/https/relative + raster data URIs', () => {
    expect(safeImageSrc('https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(safeImageSrc('/a.png')).toBe('/a.png');
    expect(safeImageSrc('data:image/png;base64,iVBOR')).toBe('data:image/png;base64,iVBOR');
  });
  it('rejects svg+xml data, blob:, and dangerous schemes (→ null)', () => {
    for (const s of ['data:image/svg+xml,<svg>', 'blob:https://x', 'javascript:x', 'data:text/html,x']) {
      expect(safeImageSrc(s), s).toBeNull();
    }
  });
  it('caps inline data-URI length (~256KB) to bound memory/DoS', () => {
    const under = 'data:image/png;base64,' + 'A'.repeat(256 * 1024 - 100); // within budget
    const over = 'data:image/png;base64,' + 'A'.repeat(256 * 1024); // exceeds budget
    expect(safeImageSrc(under), 'under-budget raster data-URI passes').toBe(under);
    expect(safeImageSrc(over), 'over-budget data-URI rejected').toBeNull();
  });
});

describe('linkTargetRel — secure external-link attributes', () => {
  it('an external link always gets target=_blank + rel=noopener noreferrer', () => {
    expect(linkTargetRel(true)).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
  });
  it('a non-external link gets neither (no target/rel)', () => {
    for (const v of [false, null, undefined]) {
      expect(linkTargetRel(v)).toEqual({});
    }
  });
});
