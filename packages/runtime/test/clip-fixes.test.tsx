/**
 * Text-clipping fixes.
 *
 * Two components were cutting real content:
 *   - DescriptionList inline: the term was `max-w-[60%] truncate` with default
 *     shrink while the value took its content width, so EVERY term ellipsised
 *     ("Airport transfer" → "Airport tr…", "Data" → "Da…") in a 682px row whose
 *     value needed 580px; the `text-right` value ragged-left on every wrap and
 *     its content-sized box left no column edge.
 *   - Tabs: `truncate` sat on the BUTTON, but its only child was an inline-flex
 *     span with overflow:visible, so the span escaped the clip box and the
 *     ellipsis never rendered — labels were hard-cut mid-glyph, with no
 *     horizontal-scroll fallback either.
 *
 * FOLLOW-UP (truncation pass): the first fix removed the escaping clip box but
 * left fitted tabs ellipsising. That was measured as the same defect class —
 * a fitted tab is `flex-1`, so it can NEVER overflow into the rail's scroller
 * the way a non-fitted tab does; the ellipsis was pure deletion (4 tabs at
 * 320px ⇒ ~72px each). Fitted tabs now wrap. Non-fitted tabs are unchanged:
 * shrink-0 + nowrap + a scrolling rail is a real single-line contract.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

describe('DescriptionList inline — terms get a real column and never ellipsise', () => {
  const items = [
    { term: 'Airport transfer', description: 'Narita Express to Shibuya, 83 minutes, ¥3,250 each way' },
    { term: 'Getting around', description: 'Suica card' },
    { term: 'Data', description: '20GB eSIM' },
    { term: 'September weather', description: 'Warm and humid, 26°C average high with typhoon season tailing off' },
  ];

  it('the row is a two-track grid; the term wraps instead of truncating', () => {
    const { container } = draw('DescriptionList', { items, layout: 'inline' });
    const row = container.querySelector('dt')!.parentElement!;
    expect(row.className).toContain('grid-cols-[minmax(7rem,30%)_1fr]');
    for (const dt of container.querySelectorAll('dt')) {
      expect(dt.className).not.toContain('truncate');
      expect(dt.className).not.toContain('max-w-[60%]');
      expect(dt.className).toContain('break-words');
    }
  });

  /* WAS: 'long values left-align …; short ones keep the right edge' — i.e. the test
     asserted the alignment was decided PER ROW. That is the defect, not the contract:
     one long value in an otherwise short list flipped that single row and the value
     column stopped lining up. Seen twice by eye, both at 33 chars, and many generated
     inline lists hold both short and long values.
     The contract is now per LIST: a right edge only helps scanning when EVERY value is
     short and single-line, so as soon as one can wrap the whole column goes left
     together. This list contains long values, so all four are left. */
  it('alignment is decided once for the LIST, not per row — a mixed list is uniformly left', () => {
    const { container } = draw('DescriptionList', { items, layout: 'inline' });
    const dds = [...container.querySelectorAll('dd')];
    // every row agrees, because two of the four values exceed the 24-char threshold
    for (const dd of dds) expect(dd.className).toContain('text-left');
    for (const dd of dds) expect(dd.className).not.toContain('text-right');
  });

  it('grid + stacked layouts also wrap their terms', () => {
    for (const layout of ['grid', 'stacked'] as const) {
      const { container } = draw('DescriptionList', { items, layout });
      for (const dt of container.querySelectorAll('dt')) {
        expect(dt.className).not.toContain('truncate');
        expect(dt.className).toContain('break-words');
      }
    }
  });
});

describe('Tabs — the rail scrolls instead of hard-cutting labels', () => {
  const tabs = [
    { value: 'd1', label: 'Day 1 · Shibuya & Shinjuku', icon: 'calendar' },
    { value: 'd2', label: 'Day 2 · Asakusa & Akihabara', count: 6 },
    { value: 'd3', label: 'Day 3 · Tsukiji & teamLab' },
  ];

  it('the tablist is horizontally scrollable and carries the fade marker', () => {
    const { container } = draw('Tabs', { tabs, value: 'd1' });
    const list = container.querySelector('[role="tablist"]')!;
    expect(list.className).toContain('overflow-x-auto');
    expect(list.className).toContain('fr-tabscroll');
  });

  it('non-fitted tabs keep their natural width (shrink-0, no truncate)', () => {
    const { container } = draw('Tabs', { tabs, value: 'd1' });
    for (const tab of container.querySelectorAll('[role="tab"]')) {
      expect(tab.className).toContain('shrink-0');
      expect(tab.className).not.toContain('truncate');
    }
  });

  it('fitted tabs share the row, so they wrap rather than lose the label tail', () => {
    const { container } = draw('Tabs', { tabs, value: 'd1', fitted: true });
    for (const tab of container.querySelectorAll('[role="tab"]')) {
      // flex-1 means the tab can never reach the rail's scroller, so an
      // ellipsis here would only ever delete words.
      expect(tab.className).toContain('break-words');
      expect(tab.className).not.toContain('truncate');
      expect(tab.className).not.toContain('shrink-0');
    }
  });

  it('the icon/count wrapper is capped at the button box so the label wraps inside the tab', () => {
    const { container } = draw('Tabs', { tabs, value: 'd1', fitted: true });
    const wrapper = container.querySelector('[role="tab"] span.inline-flex')!;
    expect(wrapper.className).toContain('max-w-full');
    expect(wrapper.className).toContain('min-w-0');
    // icon + count are shrink-0, so the label node is the one that gives
    expect(wrapper.querySelector('span.break-words')).not.toBeNull();
    expect(wrapper.querySelector('span.truncate')).toBeNull();
  });
});
