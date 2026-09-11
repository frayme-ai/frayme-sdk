/**
 * Pointer-target + contrast guard for the SMALL-TARGETS group (accessibility audit):
 * inputs-choice (MultiSelect/TagInput) · media-extended (Marquee/Figure).
 *
 * WCAG 2.5.8 wants 24×24 CSS px of pointer target. What the audit measured, and
 * what each assertion below pins:
 *   - the chip ✕ shared by MultiSelect and TagInput is `p-0.5` around a 13px
 *     glyph = 17×17 — 30 findings, the largest shape in inputs-choice. It cannot
 *     grow: a 24px button inside the chip's py-0.5 makes the chip 28px and grows
 *     the whole sm field 32px → 36px. So it carries a 24×24 ::before instead and
 *     the INK stays 17px.
 *   - MultiSelect's clear-all ✕ measured 23×23 (p-1 + a 15px glyph) — one pixel
 *     short — and its chevron exactly 24 by arithmetic. Both sit in the field's
 *     ≥24px content box, so both take the min box directly.
 *   - TagInput's draft <input> had no height of its own (border-0, no padding,
 *     font:inherit) = one line box, 20px at sm / 23px at md. 12 findings.
 *   - Marquee's viewport carries tabIndex={0} and was 16-20px tall (the ticker's
 *     line box) — 22 findings. Under prefers-reduced-motion frayme.css turns that
 *     same box into a thin-scrollbar scroller, where ~11px of scrollbar in a 20px
 *     box is the real defect.
 *
 * Contrast (WCAG 1.4.3), same files:
 *   - Figure's credit sat at `opacity-70` on top of the figcaption's muted colour;
 *     the two compound to 3.62:1 light / 3.94:1 dark at 12px, against a 4.5 floor.
 *     The audit could not see it — its contrast pass reads computed `color` and
 *     composites background alpha only, so element opacity is invisible to it.
 *
 * Style follows test/a11y-targets-inputs.test.tsx: assert the class contract on
 * the rendered element, since the geometry is entirely class-driven.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const OPTS = [
  { label: 'Design', value: 'design' },
  { label: 'Research', value: 'research' },
];

/* ── the chip ✕ — target grows, ink does not ──────────────────────────────── */

describe('chip ✕ (MultiSelect + TagInput) — a 24×24 ::before carries the target', () => {
  const chipRemoves = (type: string, props: Record<string, unknown>) => {
    const { container } = draw(type, props);
    const bs = [...container.querySelectorAll('button[aria-label^="Remove "]')];
    expect(bs.length, type).toBeGreaterThan(0);
    return bs;
  };

  it('MultiSelect chips carry the overlay at every size', () => {
    for (const size of [undefined, 'sm', 'md', 'lg']) {
      for (const b of chipRemoves('MultiSelect', { options: OPTS, value: ['design'], size })) {
        expect(b.className).toContain('relative');
        expect(b.className).toContain('before:absolute');
        expect(b.className).toContain('before:h-6');
        expect(b.className).toContain('before:w-6');
        expect(b.className).toContain("before:content-['']");
        // Centred on the button, or the overlay would hang off one side into the
        // neighbouring chip instead of into this chip's own padding.
        expect(b.className).toContain('before:-translate-x-1/2');
        expect(b.className).toContain('before:-translate-y-1/2');
      }
    }
  });

  it('TagInput chips carry the identical overlay (one shared recipe)', () => {
    for (const b of chipRemoves('TagInput', { value: ['alpha', 'beta'] })) {
      expect(b.className).toContain('before:h-6');
      expect(b.className).toContain('before:w-6');
      expect(b.className).toContain("before:content-['']");
    }
    // The two components must not drift apart: same string, same floor.
    const ms = chipRemoves('MultiSelect', { options: OPTS, value: ['design'] })[0];
    const ti = chipRemoves('TagInput', { value: ['alpha'] })[0];
    expect(ti.className).toBe(ms.className);
  });

  it('the VISUAL stays 17px — no min box on the button, no growth in the chip', () => {
    const { container } = draw('MultiSelect', { options: OPTS, value: ['design'], size: 'sm' });
    const b = container.querySelector('button[aria-label^="Remove "]')!;
    // min-h-6 here would push the chip to 28px and the sm field from 32 to 36,
    // moving every generated chip field to buy 7px of target.
    expect(b.className).not.toContain('min-h-6');
    expect(b.className).not.toContain('min-w-6');
    expect(b.className).toContain('p-0.5');
    expect(b.parentElement!.className).toContain('py-0.5');
  });
});

/* ── MultiSelect field chrome — clear-all ✕ and chevron ───────────────────── */

describe('MultiSelect field chrome clears 24×24', () => {
  it('the clear-all ✕ takes the min box (was 23×23 — one pixel short)', () => {
    const { container } = draw('MultiSelect', { options: OPTS, value: ['design'], clearable: true });
    const b = container.querySelector('button[aria-label="Clear all"]')!;
    expect(b).toBeTruthy();
    expect(b.className).toContain('min-h-6');
    expect(b.className).toContain('min-w-6');
    // min-*, never h-6/w-6: a fixed box clips a larger glyph instead of growing.
    expect(b.className).not.toMatch(/(^|\s)h-6(\s|$)/);
    expect(b.className).not.toMatch(/(^|\s)w-6(\s|$)/);
  });

  it('the chevron states its floor rather than meeting it by arithmetic', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const { container } = draw('MultiSelect', { options: OPTS, size });
      const b = container.querySelector('button[aria-label="Open options"]')!;
      expect(b, size).toBeTruthy();
      expect(b.className, size).toContain('min-h-6');
      expect(b.className, size).toContain('min-w-6');
    }
  });
});

/* ── TagInput draft field — the control you tap to start typing ───────────── */

describe('TagInput — the draft input has a height of its own', () => {
  it('min-h-6 at every size (it had none: border-0, no padding, font:inherit)', () => {
    for (const size of [undefined, 'sm', 'md', 'lg']) {
      const { container } = draw('TagInput', { value: ['alpha'], size });
      const input = container.querySelector('input[type="text"]')!;
      expect(input.className, String(size)).toContain('min-h-6');
      // The width floor was never the problem and must survive.
      expect(input.className, String(size)).toContain('min-w-[6ch]');
    }
  });
});

/* ── Marquee viewport — the focusable (and, reduced-motion, scrollable) box ── */

describe('Marquee — the horizontal viewport clears the 24px floor', () => {
  it('a horizontal ticker gets min-h-6 and centres its track in the taller box', () => {
    for (const direction of [undefined, 'left', 'right']) {
      const { container } = draw('Marquee', { items: ['Alpha', 'Beta'], direction, size: 'sm' });
      const vp = container.querySelector('.fr-marquee')!;
      expect(vp, String(direction)).toBeTruthy();
      // It is a target because it takes focus deliberately (tabIndex=0), and a
      // reduced-motion scroller with a ~11px scrollbar needs the room.
      expect(vp.getAttribute('tabindex'), String(direction)).toBe('0');
      expect(vp.className, String(direction)).toContain('min-h-6');
      expect(vp.className, String(direction)).toContain('content-center');
    }
  });

  it('a VERTICAL marquee keeps its height var and must NOT be content-centred', () => {
    for (const direction of ['up', 'down']) {
      const { container } = draw('Marquee', { items: ['Alpha', 'Beta'], direction });
      const vp = container.querySelector('.fr-marquee')!;
      // Its track deliberately overflows the fixed height; centring an
      // overflowing child would shift the translateY(-50%) loop's origin.
      expect(vp.className, direction).not.toContain('content-center');
      expect(vp.className, direction).toContain('[height:var(--fr-marquee-h,12rem)]');
    }
  });
});

/* ── Figure credit — compounded opacity was 3.62:1 ────────────────────────── */

describe('Figure — the credit meets 4.5:1', () => {
  it('no opacity multiplier on top of the muted caption colour', () => {
    const { container } = draw('Figure', {
      src: 'https://example.com/a.jpg',
      alt: 'A photo',
      caption: 'A caption',
      credit: 'Photo: Someone',
    });
    const cap = container.querySelector('figcaption')!;
    expect(cap.className).toContain('[color:var(--fr-figure-muted,var(--color-muted-foreground))]');
    const spans = [...cap.querySelectorAll('span')];
    expect(spans).toHaveLength(2);
    // #52525b at 70% over the white card composites to 3.62:1 at 12px (3.94:1
    // dark). Any opacity utility here re-opens that, whatever its value.
    for (const s of spans) expect(s.className).not.toMatch(/opacity-\d/);
    expect(cap.textContent).toContain('Photo: Someone');
  });

  it('a credit with no caption still renders at full strength', () => {
    const { container } = draw('Figure', { src: 'https://example.com/a.jpg', credit: 'Photo: Someone' });
    const cap = container.querySelector('figcaption')!;
    expect(cap.querySelector('span')!.className).not.toMatch(/opacity-\d/);
  });
});
