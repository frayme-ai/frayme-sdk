/**
 * Pointer-target + contrast guard for the INPUTS group (accessibility audit):
 * inputs-numeric (RangeSlider/Rating) · block-document-editor · ai-content
 * (InlineCitation/DiffView).
 *
 * WCAG 2.5.8 wants 24×24 CSS px of pointer target. What the audit measured, and
 * what each assertion below pins:
 *   - RangeSlider's two overlaid <input type=range> were `inset-0 h-full`, i.e.
 *     the TRACK's height: 4px (sm) / 6px (md) / 8px (lg). The native thumb pseudo
 *     is 1.25rem and overflowed that box, so the target depended on the engine
 *     hit-testing an overflowing pseudo-element.
 *   - block-document-editor's block-type <select> measured 22px tall
 *     (text-xs + py-0.5 + border) and its remove-column/row/field ✕ buttons were
 *     bare `text-xs` spans at ~10×16.
 *   - Rating's star buttons shrink-wrapped the glyph: 16×16 (sm), 22×22 (md, the
 *     DEFAULT), 28×28 (lg).
 *   - InlineCitation's linked marker is ~20×14 and CANNOT grow — it is align-super
 *     inside prose — so it carries a 24×24 ::before overlay instead. The <sup>
 *     form is not a pointer target and must NOT get one.
 *
 * Contrast (WCAG 1.4.3), same files:
 *   - the block-header control row rested at `opacity-60`, compositing its muted
 *     glyphs to 2.31:1 (light) / 3.29:1 (dark);
 *   - DiffView's line-number gutter was the muted colour at 60% alpha = 2.31:1.
 * Both now sit at the full muted token (4.83:1 light / 6.91:1 dark).
 *
 * Style follows test/clip-fixes.test.tsx: assert the class contract on the
 * rendered element, since the geometry is entirely class-driven.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

/* ── RangeSlider — the draggable strip is 24px tall, centred on the track ──── */

describe('RangeSlider — the overlaid range inputs carry a 24px hit strip', () => {
  it('both thumbs get min-h-6 and are centred on the track, not stretched to it', () => {
    const { container } = draw('RangeSlider', { min: 0, max: 100, valueMin: 20, valueMax: 80 });
    const inputs = [...container.querySelectorAll('input[type="range"]')];
    expect(inputs).toHaveLength(2);
    for (const el of inputs) {
      expect(el.className).toContain('min-h-6');
      // Centred rather than inset-0: with inset-0 a min-height taller than the
      // track resolves DOWNWARD (over-constrained absolute positioning drops
      // `bottom`), which would hang the strip below the track instead of around it.
      expect(el.className).toContain('top-1/2');
      expect(el.className).toContain('-translate-y-1/2');
      expect(el.className).not.toContain('inset-0');
    }
  });

  it('holds at every size — the track height (h-1/h-1.5/h-2) never sets the target', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const { container } = draw('RangeSlider', { min: 0, max: 100, valueMin: 20, valueMax: 80, size });
      for (const el of container.querySelectorAll('input[type="range"]')) {
        expect(el.className).toContain('min-h-6');
      }
    }
  });
});

/* ── Rating — each star owns a 24×24 box ──────────────────────────────────── */

describe('Rating — star buttons clear 24×24 at every size', () => {
  it('sm (16px glyph) and the md default (22px) both get the min box', () => {
    for (const props of [{ value: 3, size: 'sm' }, { value: 3 }, { value: 3, size: 'lg' }]) {
      const { container } = draw('Rating', props);
      const stars = [...container.querySelectorAll('button[role="radio"]')];
      expect(stars.length).toBeGreaterThan(0);
      for (const b of stars) {
        expect(b.className).toContain('min-h-6');
        expect(b.className).toContain('min-w-6');
      }
    }
  });

  it('readOnly renders no buttons at all — nothing to size', () => {
    const { container } = draw('Rating', { value: 3, readOnly: true });
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

/* ── BlockDocumentEditor — chrome controls and the resting-dim contrast ────── */

describe('BlockDocumentEditor — every glyph control clears 24×24', () => {
  it('the block-type select is at least 24px tall (was 22)', () => {
    const { container } = draw('BlockDocumentEditor', {});
    const selects = [...container.querySelectorAll('select[aria-label="Block type"]')];
    expect(selects.length).toBeGreaterThan(0);
    for (const s of selects) expect(s.className).toContain('min-h-6');
  });

  it('the ▲▼⧉✕ block-header controls carry the min box', () => {
    const { container } = draw('BlockDocumentEditor', {});
    for (const label of ['Move up', 'Move down', 'Duplicate', 'Delete block']) {
      const b = container.querySelector(`button[aria-label="${label}"]`)!;
      expect(b, label).toBeTruthy();
      expect(b.className, label).toContain('min-h-6');
      expect(b.className, label).toContain('min-w-6');
    }
  });

  it('the in-body remove-column / remove-row / remove-field ✕ share that floor', () => {
    // The default document seeds a `table` block (2 cols × 2 rows) and a `fields`
    // block, so all three ✕ variants render without extra props.
    const { container } = draw('BlockDocumentEditor', {});
    for (const label of ['Delete column 1', 'Delete row 1', 'Delete field 1']) {
      const b = container.querySelector(`button[aria-label="${label}"]`)!;
      expect(b, label).toBeTruthy();
      expect(b.className, label).toContain('min-h-6');
      expect(b.className, label).toContain('min-w-6');
    }
  });

  it('the block-header row no longer rests at opacity-60 (2.31:1 muted glyphs)', () => {
    const { container } = draw('BlockDocumentEditor', {});
    const row = container.querySelector('select[aria-label="Block type"]')!.parentElement!;
    expect(row.className).not.toContain('opacity-60');
    expect(row.className).not.toContain('group-hover:opacity-100');
  });
});

/* ── InlineCitation — overlay on the link, nothing on the marker ───────────── */

describe('InlineCitation — a 24×24 overlay carries the target, the glyph stays inline', () => {
  it('the linked form gets an out-of-flow 24×24 ::before and keeps its inline size', () => {
    const { container } = draw('InlineCitation', { index: 1, url: 'https://json-render.dev' });
    const a = container.querySelector('a')!;
    expect(a.className).toContain('relative');
    expect(a.className).toContain('before:absolute');
    expect(a.className).toContain('before:h-6');
    expect(a.className).toContain('before:w-6');
    expect(a.className).toContain("before:content-['']");
    // The VISUAL must not have grown — no min-h/min-w on the marker itself, or the
    // superscript would set the line height of every paragraph that cites a source.
    expect(a.className).not.toContain('min-h-6');
    expect(a.className).not.toContain('min-w-6');
    expect(a.className).toContain('text-[0.625rem]');
  });

  it('the unlinked <sup> marker is not a pointer target and gets no overlay', () => {
    const { container } = draw('InlineCitation', { index: 2 });
    const sup = container.querySelector('sup')!;
    expect(sup.className).not.toContain('before:h-6');
    expect(sup.className).not.toContain('before:absolute');
  });
});

/* ── DiffView — the line-number gutter is legible ─────────────────────────── */

describe('DiffView — line numbers meet 4.5:1', () => {
  it('the gutter reads the muted token at full strength, not a 60% mix', () => {
    const { container } = draw('DiffView', { before: 'a\nb', after: 'a\nc', showLineNumbers: true });
    const gutters = [...container.querySelectorAll('span.w-8')];
    expect(gutters.length).toBeGreaterThan(0);
    for (const g of gutters) {
      expect(g.className).toContain('[color:var(--fr-diff-muted,var(--color-muted-foreground))]');
      expect(g.className).not.toContain('_60%');
    }
  });

  it('the mutedColor value channel still drives the gutter', () => {
    const { container } = draw('DiffView', { before: 'a', after: 'b', showLineNumbers: true, mutedColor: '#334155' });
    const fig = container.querySelector('figure')!;
    expect(fig.getAttribute('style') ?? '').toContain('--fr-diff-muted');
    expect(container.querySelector('span.w-8')!.className).toContain('--fr-diff-muted');
  });
});
