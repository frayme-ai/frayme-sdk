import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { Icon, hasIcon } from '../src/react/registry/icons.js';

const mc = (props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type: 'MessageContent', props } } }) as unknown as Spec;

describe('MessageContent safe inline markdown', () => {
  it('tokenizes **bold**, *italic*, `code` into escaped React elements', () => {
    const { container } = render(
      <FraymeRenderer spec={mc({ content: 'a **bold** and `code` and *italic* end', variant: 'markdown' })} mode="strict" />,
    );
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('code')?.textContent).toBe('code');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('never parses raw HTML — tags in content stay literal text', () => {
    const { container } = render(
      <FraymeRenderer spec={mc({ content: 'x <b>nope</b> <img src=q onerror=hack> y', variant: 'markdown' })} mode="strict" />,
    );
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<b>nope</b>');
  });

  it('variant:text does NOT tokenize (markers stay literal)', () => {
    const { container } = render(
      <FraymeRenderer spec={mc({ content: '**not bold**', variant: 'text' })} mode="strict" />,
    );
    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toContain('**not bold**');
  });
});

describe('stroke glyphs (clipboard, paperclip)', () => {
  it('clipboard + paperclip are known stroke glyphs', () => {
    for (const name of ['clipboard', 'paperclip']) {
      expect(hasIcon(name), `${name} is registered`).toBe(true);
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.querySelector('path')).toBeTruthy();
    }
  });
});
