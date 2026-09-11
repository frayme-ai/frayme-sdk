/**
 * Figure.ratio — the schema enum and the renderer's map must agree.
 *
 * They drifted: `21/9` was in VIDEO_ASPECT and in the shared `Aspect` enum from
 * the start, but neither Figure's schema enum nor FIGURE_RATIO carried it. A
 * generated spec asked for a panoramic figure, and got a schema rejection for a
 * ratio the renderer already knew how to draw.
 *
 * A drift like that is invisible until someone happens to author the missing
 * value, so this pins the agreement in both directions rather than pinning the
 * one value that was missing.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { fraymeCatalog } from '@frayme/catalog';

import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const RATIOS = ['auto', '16/9', '4/3', '1/1', '21/9', '3/2'] as const;

const draw = (ratio: string) =>
  render(
    <FraymeRenderer
      spec={
        {
          root: 'f',
          elements: { f: { type: 'Figure', props: { src: 'https://example.com/a.png', alt: 'A', ratio } } },
          state: {},
        } as unknown as Spec
      }
      mode="progressive"
    />,
  );

describe('Figure.ratio — schema ↔ renderer agreement', () => {
  it('every schema option is accepted by the catalog', () => {
    const schema = fraymeCatalog.data.components.Figure.props;
    for (const ratio of RATIOS) {
      const r = schema.safeParse({ src: 'https://example.com/a.png', alt: 'A', ratio });
      const badRatio = r.success
        ? []
        : r.error.issues.filter((i: { path?: unknown[] }) => i.path?.[0] === 'ratio');
      expect(badRatio, `ratio ${ratio} rejected by the Figure schema`).toEqual([]);
    }
  });

  it('every schema option renders a real aspect class (none silently falls through)', () => {
    for (const ratio of RATIOS) {
      const { container, unmount } = draw(ratio);
      const html = container.innerHTML;
      // `auto` is deliberately the empty class — every OTHER option must paint one.
      if (ratio !== 'auto') {
        expect(html, `ratio ${ratio} produced no aspect class`).toMatch(/aspect-(video|square|\[)/);
      }
      unmount();
    }
  });

  it('21/9 renders the ultrawide frame — the value that exposed the drift', () => {
    const { container } = draw('21/9');
    expect(container.innerHTML).toContain('aspect-[21/9]');
  });

  it('a ratio outside the enum does not silently render as some other frame', () => {
    const { container } = draw('16:9'); // colon form — a real authoring mistake
    expect(container.innerHTML).not.toContain('aspect-video');
  });
});
