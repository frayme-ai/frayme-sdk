/**
 * Icon registry — the CLOSED, name-resolved glyph set.
 *
 * SECURITY (master §4.6): a KNOWN name renders OUR `<svg>`; an UNKNOWN name (or
 * non-string) renders NOTHING — no crash, no markup from spec input. The `icon`
 * props only ever carry a lookup NAME, never raw SVG.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconName } from '@frayme/catalog';
import { Icon, ICON_NAMES, hasIcon } from '../src/react/registry/icons.js';

describe('icon registry', () => {
  it('a KNOWN name renders an <svg>', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // our author-controlled glyph geometry is present (a <path>), not empty.
    expect(svg!.querySelector('path, circle, line, rect')).toBeTruthy();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it('an UNKNOWN name renders nothing (no svg, no crash, no markup)', () => {
    const { container } = render(<Icon name="totally-made-up-glyph" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('null / undefined / non-string names render nothing', () => {
    expect(render(<Icon name={null} />).container.innerHTML).toBe('');
    expect(render(<Icon name={undefined} />).container.innerHTML).toBe('');
    // a name that is not in the registry can never inject — only the KEY is used.
    const { container } = render(<Icon name={'<script>alert(1)</script>' as string} />);
    expect(container.innerHTML).toBe('');
  });

  it('hasIcon reflects the closed set; a sane spread of common glyphs ships', () => {
    expect(hasIcon('check')).toBe(true);
    expect(hasIcon('arrow-right')).toBe(true);
    expect(hasIcon('chevron-down')).toBe(true);
    expect(hasIcon('not-a-real-icon')).toBe(false);
    // The registry has grown well past the original 40-60 seed.
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(40);
  });

  it('INVARIANT: the catalog IconName enum === the runtime registry glyph set (zero-diff both ways)', () => {
    // The validated `IconName` menu (catalog) and the glyph set the runtime can
    // actually draw (`ICON_NAMES` = ICONS + FILLED_ICONS) must be EXACTLY equal.
    //  - enum member with no registry entry → validates but renders BLANK.
    //  - registry glyph missing from the enum → drawn but UNUSABLE (fails validation).
    const enumNames = new Set<string>(IconName.options);
    const registryNames = new Set<string>(ICON_NAMES);

    // (a) every enum member resolves to a real glyph (zero blank-render names).
    const blank = [...enumNames].filter((n) => !registryNames.has(n));
    expect(blank, `enum names with NO registry entry (would render blank): ${blank.join(', ')}`).toEqual([]);

    // (b) every registry glyph is exposed in the enum (zero unusable glyphs).
    const missing = [...registryNames].filter((n) => !enumNames.has(n));
    expect(missing, `registry glyphs NOT in the enum (drawn but unusable): ${missing.join(', ')}`).toEqual([]);

    // Same size ⇒ sets are equal (no duplicates possible — both are Sets).
    expect(enumNames.size).toBe(registryNames.size);
    expect(ICON_NAMES.length).toBe(IconName.options.length);
  });

  it('every IconName enum member renders a non-empty <svg> (spot: no member draws blank)', () => {
    for (const name of IconName.options) {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, `${name} should render an <svg>`).toBeTruthy();
      expect(
        svg!.querySelector('path, circle, line, rect, polygon, polyline, ellipse'),
        `${name} should render glyph geometry, not blank`,
      ).toBeTruthy();
    }
  });

  it('size controls the rendered dimensions', () => {
    const { container } = render(<Icon name="x" size={28} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('28');
    expect(svg.getAttribute('height')).toBe('28');
  });

  it('filled brand glyphs render fill=currentColor / stroke=none', () => {
    for (const brand of ['github', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube']) {
      expect(hasIcon(brand), `${brand} should be a known glyph`).toBe(true);
      const { container } = render(<Icon name={brand} />);
      const svg = container.querySelector('svg')!;
      expect(svg, `${brand} renders an svg`).toBeTruthy();
      expect(svg.getAttribute('fill')).toBe('currentColor');
      expect(svg.getAttribute('stroke')).toBe('none');
      expect(svg.querySelector('path')).toBeTruthy();
    }
  });

  it('stroke glyphs stay stroke-based (fill=none, stroke=currentColor)', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });

  it('"x" remains the close glyph (stroke), NOT a Twitter brand mark', () => {
    const { container } = render(<Icon name="x" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('fill')).toBe('none');
  });
});
