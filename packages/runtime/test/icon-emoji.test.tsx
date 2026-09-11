/**
 * Icons accept a registry NAME or a single emoji glyph.
 * Host data carries emoji ("🗼" on a trip stop, "🗺️" on a summary tile) and the model
 * passes it through verbatim; a registry-only slot drew an EMPTY muted square on Stat
 * and nothing at all elsewhere. Emoji never appear in generated icon values,
 * so this is host input the runtime must simply honour.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { hasIcon, isEmojiGlyph } from '../src/react/registry/icons.js';

const draw = (type: string, props: Record<string, unknown>) =>
  render(
    <FraymeRenderer spec={{ root: 'el', elements: { el: { type, props } }, state: {} } as unknown as Spec} mode="progressive" />,
  ).container;

describe('icons — a registry NAME or an emoji glyph', () => {
  it('recognises one emoji glyph (VS16, ZWJ, keycap, flag, lone symbol) and rejects words', () => {
    for (const g of ['🗼', '🗺️', '✉️', '👨‍👩‍👧', '🇫🇷', '1️⃣', '$', '%', '→', '★']) expect(isEmojiGlyph(g), g).toBe(true);
    for (const w of ['star', 'abc', 'x', '12', '🗼🗼', '', 'not-an-icon']) expect(isEmojiGlyph(w), w).toBe(false);
    expect(hasIcon('🗼')).toBe(true);
    expect(hasIcon('star')).toBe(true);
    expect(hasIcon('not-an-icon')).toBe(false);
  });

  it('Stat renders an emoji icon inside its category square', () => {
    const c = draw('Stat', { label: 'Total stops', value: '11', icon: '🗺️', layout: 'split' });
    const square = c.querySelector('.h-9.w-9');
    expect(square).not.toBeNull();
    expect(square?.textContent).toBe('🗺️');
  });

  it('Stat draws NO empty square for an unknown icon name (the blank-box defect)', () => {
    const c = draw('Stat', { label: 'Total stops', value: '11', icon: 'not-an-icon', layout: 'split' });
    expect(c.querySelector('.h-9.w-9')).toBeNull();
    expect(c.textContent).toContain('Total stops');
  });

  it('Stat with a registry name still draws the svg glyph', () => {
    const c = draw('Stat', { label: 'Revenue', value: '£1', icon: 'star', layout: 'split' });
    expect(c.querySelector('.h-9.w-9 svg')).not.toBeNull();
  });

  it('Button renders an emoji icon next to its label', () => {
    const c = draw('Button', { label: 'Send the itinerary', icon: '✉️' });
    expect(c.textContent).toContain('✉️');
    expect(c.textContent).toContain('Send the itinerary');
  });

  it('a Timeline stop bound from state shows its emoji (inside the dot, size lg — the documented contract)', () => {
    const spec = {
      root: 'el',
      state: { stops: [{ title: 'Eiffel Tower', description: 'Go up early', icon: '🗼' }] },
      elements: { el: { type: 'Timeline', props: { orientation: 'vertical', size: 'lg', items: { $state: '/stops' } } } },
    } as unknown as Spec;
    const c = render(<FraymeRenderer spec={spec} mode="progressive" />).container;
    expect(c.textContent).toContain('Eiffel Tower');
    expect(c.textContent).toContain('🗼');
  });
});
