import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const yt = (props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type: 'YouTube', props } } }) as unknown as Spec;

describe('YouTube', () => {
  it('renders a watch link + thumbnail for a valid videoId (no iframe)', () => {
    const { container } = render(<FraymeRenderer spec={yt({ videoId: 'dQw4w9WgXcQ', title: 'Demo' })} mode="strict" />);
    expect(container.querySelector('iframe')).toBeNull();
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toContain('noopener');
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('maps thumbnailQuality to the right image variant', () => {
    const { container } = render(<FraymeRenderer spec={yt({ videoId: 'dQw4w9WgXcQ', thumbnailQuality: 'maxres' })} mode="strict" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  });

  it('parses the id from a full watch URL', () => {
    const { container } = render(<FraymeRenderer spec={yt({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s' })} mode="strict" />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('parses the id from a youtu.be short URL', () => {
    const { container } = render(<FraymeRenderer spec={yt({ url: 'https://youtu.be/dQw4w9WgXcQ' })} mode="strict" />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('rejects a malformed/too-long/injected id → placeholder, no link', () => {
    for (const bad of ['"><script>', 'short', 'this-is-way-too-long', 'abc def_1234', 'javascript:x']) {
      const { container } = render(<FraymeRenderer spec={yt({ videoId: bad })} mode="strict" />);
      expect(container.querySelector('a'), `should not link for ${bad}`).toBeNull();
      expect(container.querySelector('img'), `should not load a thumbnail for ${bad}`).toBeNull();
      expect(container.textContent).toContain('No video');
    }
  });

  it('renders the placeholder (no crash) when props-less', () => {
    expect(() => render(<FraymeRenderer spec={yt({})} mode="strict" />)).not.toThrow();
  });
});
