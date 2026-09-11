/**
 * Toggletip — disclosure semantics must not outlive the disclosed element.
 *
 * `aria-expanded` and `aria-controls` were emitted unconditionally while the
 * bubble mounted only on `open && content != null`. Because `content` is
 * `z.string().nullable()` in the catalog schema, a VALID spec produced a trigger
 * that announced itself expanded and pointed `aria-controls` at an id that
 * never entered the document — a screen reader following the reference lands
 * nowhere, permanently, not just while closed.
 *
 * The rule these tests pin: no bubble, no disclosure. When there IS a bubble,
 * `aria-controls` must resolve to exactly one live element.
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';

import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'Toggletip', props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  );

describe('Toggletip — disclosure attributes track the bubble', () => {
  it('content ABSENT: trigger carries no disclosure semantics, open or closed', () => {
    const { container } = draw({ label: 'Why this number?' });
    const btn = container.querySelector('button')!;
    expect(btn).not.toBeNull();

    for (const phase of ['closed', 'opened'] as const) {
      if (phase === 'opened') fireEvent.click(btn);
      // The pre-fix bug reported expanded=true with a dangling controls target.
      expect(btn.getAttribute('aria-expanded')).toBeNull();
      expect(btn.getAttribute('aria-controls')).toBeNull();
      expect(btn.getAttribute('aria-haspopup')).toBeNull();
    }
  });

  it('content NULL is treated exactly as absent (the schema permits it)', () => {
    const { container } = draw({ label: 'Why this number?', content: null });
    const btn = container.querySelector('button')!;
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBeNull();
    expect(btn.getAttribute('aria-controls')).toBeNull();
  });

  it('content PRESENT: expanded flips and aria-controls resolves to exactly one element', () => {
    const { container } = draw({ label: 'Why this number?', content: 'Trailing 30 days, excluding refunds.' });
    const btn = container.querySelector('button')!;

    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    const id = btn.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    // Resolution, not mere presence — the whole point of the defect.
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.textContent).toContain('Trailing 30 days');
  });
});
