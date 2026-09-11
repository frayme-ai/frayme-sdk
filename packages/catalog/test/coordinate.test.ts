import { describe, expect, it } from 'vitest';
import {
  safeNumberIn,
  safeUnit,
  safeLatLng,
  safePoint,
  safePointList,
  safeTimeMinutes,
} from '../src/validate/coordinate.js';

describe('safeNumberIn — bounded finite scalar', () => {
  it('passes finite numbers within range', () => {
    expect(safeNumberIn(5, 0, 10)).toBe(5);
    expect(safeNumberIn(0, 0, 10)).toBe(0);
    expect(safeNumberIn(10, 0, 10)).toBe(10);
    expect(safeNumberIn(-3.5, -10, 10)).toBe(-3.5);
  });
  it('rejects out-of-range, NaN, ±Infinity, and non-numbers', () => {
    for (const v of [11, -1, NaN, Infinity, -Infinity, '5', null, undefined, {}, [5]]) {
      expect(safeNumberIn(v, 0, 10), String(v)).toBeNull();
    }
  });
});

describe('safeUnit — normalized [0,1]', () => {
  it('passes fractions', () => {
    for (const v of [0, 0.5, 1]) expect(safeUnit(v), String(v)).toBe(v);
  });
  it('rejects values outside [0,1] and non-finite', () => {
    for (const v of [-0.01, 1.01, NaN, Infinity, '0.5']) expect(safeUnit(v), String(v)).toBeNull();
  });
});

describe('safeLatLng — geographic point', () => {
  it('accepts {lat,lng}, {latitude,longitude}, and [lat,lng]', () => {
    expect(safeLatLng({ lat: 51.5, lng: -0.12 })).toEqual({ lat: 51.5, lng: -0.12 });
    expect(safeLatLng({ latitude: -33.9, longitude: 151.2 })).toEqual({ lat: -33.9, lng: 151.2 });
    expect(safeLatLng([40.7, -74])).toEqual({ lat: 40.7, lng: -74 });
  });
  it('rejects out-of-range lat/lng, NaN, and malformed shapes', () => {
    for (const v of [
      { lat: 91, lng: 0 }, // lat > 90
      { lat: 0, lng: 181 }, // lng > 180
      { lat: NaN, lng: 0 },
      { lat: 0 }, // missing lng
      'here',
      null,
      [1],
    ]) {
      expect(safeLatLng(v), JSON.stringify(v)).toBeNull();
    }
  });
});

describe('safePoint — normalized {x,y}', () => {
  it('accepts {x,y} and [x,y] in [0,1]', () => {
    expect(safePoint({ x: 0.25, y: 0.75 })).toEqual({ x: 0.25, y: 0.75 });
    expect(safePoint([0, 1])).toEqual({ x: 0, y: 1 });
  });
  it('rejects out-of-unit, missing axis, NaN', () => {
    for (const v of [{ x: 1.5, y: 0 }, { x: 0.5 }, { x: NaN, y: 0 }, [2, 0], 'x', null]) {
      expect(safePoint(v), JSON.stringify(v)).toBeNull();
    }
  });
});

describe('safePointList — capped, filtered stroke/polygon', () => {
  it('filters to valid points and preserves order', () => {
    const out = safePointList([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0.5, y: 0.5 }]);
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }]); // the out-of-unit middle point dropped
  });
  it('caps the length (render-bomb guard)', () => {
    const many = Array.from({ length: 5000 }, () => ({ x: 0.5, y: 0.5 }));
    expect(safePointList(many, 4096)?.length).toBe(4096);
  });
  it('returns null for a non-array or all-invalid input', () => {
    expect(safePointList('nope')).toBeNull();
    expect(safePointList([{ x: 9, y: 9 }])).toBeNull();
    expect(safePointList([])).toBeNull();
  });
});

describe('safeTimeMinutes — minutes-of-day channel', () => {
  it('accepts minutes numbers and "HH:MM" strings', () => {
    expect(safeTimeMinutes(0)).toBe(0);
    expect(safeTimeMinutes(1440)).toBe(1440);
    expect(safeTimeMinutes(90.4)).toBe(90); // rounded
    expect(safeTimeMinutes('09:30')).toBe(570);
    expect(safeTimeMinutes('24:00')).toBe(1440);
  });
  it('rejects out-of-range, malformed strings, NaN', () => {
    for (const v of [-1, 1441, NaN, Infinity, '25:00', '09:60', '9:5', 'noon', null, {}]) {
      expect(safeTimeMinutes(v), String(v)).toBeNull();
    }
  });
});
