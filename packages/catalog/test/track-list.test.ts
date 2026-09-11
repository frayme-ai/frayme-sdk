/**
 * safeTrackList — the grid track-list channel.
 *
 * The value lands in a CSS declaration, so it is proved against a closed
 * grammar rather than escaped: anything that is not a well-formed list of
 * tracks returns null and the caller keeps its default template.
 */
import { describe, expect, it } from 'vitest';
import { safeTrackList } from '../src/validate/track-list.js';

describe('safeTrackList — accepts real track lists', () => {
  it('takes fractions, fixed widths and content keywords', () => {
    expect(safeTrackList('2fr 96px 96px 1fr')).toBe('2fr 96px 96px 1fr');
    expect(safeTrackList('auto 1fr auto')).toBe('auto 1fr auto');
    expect(safeTrackList('min-content max-content')).toBe('min-content max-content');
    expect(safeTrackList('12rem 40% 3ch')).toBe('12rem 40% 3ch');
  });

  it('takes a bare 0 — the shrinkable minimum', () => {
    expect(safeTrackList('minmax(0,1fr) minmax(0,2fr)')).toBe('minmax(0,1fr) minmax(0,2fr)');
    expect(safeTrackList('minmax(0, 4.5rem) 1fr')).toBe('minmax(0, 4.5rem) 1fr');
    expect(safeTrackList('0 1fr')).toBe('0 1fr');
    expect(safeTrackList('01')).toBeNull();
    expect(safeTrackList('0.5')).toBeNull();
  });

  it('takes minmax() and repeat()', () => {
    expect(safeTrackList('minmax(120px,1fr) 2fr')).toBe('minmax(120px,1fr) 2fr');
    expect(safeTrackList('repeat(3, 1fr)')).toBe('repeat(3, 1fr)');
    expect(safeTrackList('2fr minmax( 8rem , max-content )')).toBe('2fr minmax( 8rem , max-content )');
  });

  it('normalises surrounding and repeated whitespace', () => {
    expect(safeTrackList('  2fr    96px ')).toBe('2fr 96px');
  });
});

describe('safeTrackList — rejects everything else', () => {
  it('rejects anything that could close or extend the declaration', () => {
    expect(safeTrackList('1fr; background:url(x)')).toBeNull();
    expect(safeTrackList('1fr} .frayme-root{display:none')).toBeNull();
    expect(safeTrackList('1fr /* c */ 2fr')).toBeNull();
    expect(safeTrackList('var(--x) 1fr')).toBeNull();
    expect(safeTrackList('calc(100% - 10px) 1fr')).toBeNull();
    expect(safeTrackList('url(data:,) 1fr')).toBeNull();
    expect(safeTrackList('expression(alert(1))')).toBeNull();
  });

  it('rejects malformed or unbounded lists', () => {
    expect(safeTrackList('')).toBeNull();
    expect(safeTrackList('   ')).toBeNull();
    expect(safeTrackList('1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr')).toBeNull(); // 13 tracks
    expect(safeTrackList('minmax(1fr')).toBeNull();
    expect(safeTrackList('minmax(1fr))')).toBeNull();
    expect(safeTrackList('10')).toBeNull(); // unitless
    expect(safeTrackList('1foo')).toBeNull();
    expect(safeTrackList('repeat(0, 1fr)')).toBeNull();
    expect(safeTrackList('a'.repeat(201))).toBeNull();
  });

  it('rejects non-strings', () => {
    for (const v of [null, undefined, 42, {}, ['1fr'], true]) expect(safeTrackList(v)).toBeNull();
  });
});
