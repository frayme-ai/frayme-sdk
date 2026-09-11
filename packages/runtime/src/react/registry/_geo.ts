/* _geo — pure equirectangular projection + auto-fit + graticule (MapView).
 *
 * v1 is the reusable low-risk MATH only: no land outline (deferred until a 2nd
 * consumer needs polygons). Equirectangular is pure linear (no trig, no pole
 * singularity). Every output Number.isFinite-guarded; a degenerate/zero-span
 * bound collapses to DEFAULT_BOUNDS (no div-by-zero). NO React / Date / random —
 * deterministic (byte-identical SSR). The component validates lat/lng via
 * safeLatLng BEFORE feeding this engine; here we only guard the math. */

export const MAX_GRID_LINES = 48;
export const DEFAULT_BOUNDS: GeoBounds = { west: -180, east: 180, south: -85, north: 85 };
const MIN_SPAN = 1e-4; // floor-span guard against zero-area div-by-zero

const fin = (v: unknown, fb: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export interface GeoBounds { west: number; east: number; south: number; north: number }
export interface LngLat { lng: number; lat: number }
export interface Frac { x: number; y: number }

/** Coerce a partial/garbage bounds to a legal, non-degenerate GeoBounds. */
export function normalizeBounds(b?: Partial<GeoBounds> | null): GeoBounds {
  if (!b || typeof b !== 'object') return DEFAULT_BOUNDS;
  let west = clamp(fin(b.west, DEFAULT_BOUNDS.west), -180, 180);
  let east = clamp(fin(b.east, DEFAULT_BOUNDS.east), -180, 180);
  let south = clamp(fin(b.south, DEFAULT_BOUNDS.south), -90, 90);
  let north = clamp(fin(b.north, DEFAULT_BOUNDS.north), -90, 90);
  if (west > east) { const t = west; west = east; east = t; }
  if (south > north) { const t = south; south = north; north = t; }
  if (east - west < MIN_SPAN || north - south < MIN_SPAN) return DEFAULT_BOUNDS;
  return { west, east, south, north };
}

/** Auto-fit bounds around a set of points, with a fractional pad. */
export function boundsFromPoints(pts: LngLat[], padFrac = 0.15): GeoBounds {
  const valid = (Array.isArray(pts) ? pts : []).filter(
    (p) => p && Number.isFinite(p.lng) && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180,
  );
  if (valid.length === 0) return DEFAULT_BOUNDS;
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const p of valid) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  let spanX = east - west, spanY = north - south;
  if (spanX < MIN_SPAN) { const c = (east + west) / 2; west = c - 1; east = c + 1; spanX = 2; }
  if (spanY < MIN_SPAN) { const c = (north + south) / 2; south = c - 1; north = c + 1; spanY = 2; }
  const pf = fin(padFrac, 0.15);
  return normalizeBounds({ west: west - spanX * pf, east: east + spanX * pf, south: south - spanY * pf, north: north + spanY * pf });
}

export interface Projection {
  bounds: GeoBounds;
  /** Fractional position (0..1 within the box) — for a %-positioned overlay over a stretched SVG. */
  projectFrac(lng: number, lat: number): Frac;
  /** Absolute position in a width×height viewBox. */
  project(lng: number, lat: number, width: number, height: number): Frac;
  /** True when the point falls inside the (inclusive) bounds — drop, don't clamp, outsiders. */
  inBounds(lng: number, lat: number): boolean;
  /** Aspect ratio (spanX / spanY) of the bounds, clamped to a sane box range. */
  ratio: number;
}

export function makeProjection(boundsIn: Partial<GeoBounds> | null | undefined): Projection {
  const b = normalizeBounds(boundsIn);
  const spanX = Math.max(MIN_SPAN, b.east - b.west);
  const spanY = Math.max(MIN_SPAN, b.north - b.south);
  const ratio = clamp(spanX / spanY, 0.4, 3.2);
  return {
    bounds: b,
    ratio: fin(ratio, 1.6),
    projectFrac(lng, lat) {
      return { x: fin((fin(lng, b.west) - b.west) / spanX, 0), y: fin((b.north - fin(lat, b.north)) / spanY, 0) };
    },
    project(lng, lat, width, height) {
      const f = this.projectFrac(lng, lat);
      return { x: fin(f.x * fin(width, 1000), 0), y: fin(f.y * fin(height, 625), 0) };
    },
    inBounds(lng, lat) {
      return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
    },
  };
}

const NICE = [1, 2, 5, 10, 15, 30, 45, 60, 90];
function niceStep(raw: number): number {
  const r = fin(raw, 30);
  if (r <= 0) return 30;
  for (const n of NICE) if (n >= r) return n;
  // fall back to powers of 10 above 90
  let p = 90;
  while (p < r && p < 1e6) p *= 2;
  return p;
}

function axisTicks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const s = step > 0 ? step : 30;
  let v = Math.ceil(min / s) * s;
  let guard = 0;
  while (v <= max + 1e-9 && guard < MAX_GRID_LINES) { out.push(Number(v.toFixed(4))); v += s; guard++; }
  return out;
}

/** Graticule lines (lng verticals + lat horizontals) within bounds, capped. */
export function graticule(boundsIn: Partial<GeoBounds> | null | undefined, targetLines = 6): { lng: number[]; lat: number[] } {
  const b = normalizeBounds(boundsIn);
  const t = Math.max(1, fin(targetLines, 6));
  return {
    lng: axisTicks(b.west, b.east, niceStep((b.east - b.west) / t)),
    lat: axisTicks(b.south, b.north, niceStep((b.north - b.south) / t)),
  };
}

/** Format a signed degree with a hemisphere suffix (e.g. 37.8 → "37.8°N"). */
export function fmtLat(lat: number): string {
  const v = fin(lat, 0);
  return `${Math.abs(v).toFixed(Math.abs(v) % 1 ? 1 : 0)}°${v >= 0 ? 'N' : 'S'}`;
}
export function fmtLng(lng: number): string {
  const v = fin(lng, 0);
  return `${Math.abs(v).toFixed(Math.abs(v) % 1 ? 1 : 0)}°${v >= 0 ? 'E' : 'W'}`;
}

/** Format a PIN's coordinate pair. The graticule formatters above round to one
 * decimal, which is ~11km — fine for an axis label, misleading under a hotel
 * marker. Four decimals is ~11m; trailing zeros are trimmed so
 * a round coordinate still reads clean. */
export function fmtPoint(lat: number, lng: number): string {
  const one = (v: number, pos: string, neg: string): string => {
    const n = fin(v, 0);
    const s = Math.abs(n).toFixed(4).replace(/\.?0+$/, '');
    return `${s}°${n >= 0 ? pos : neg}`;
  };
  return `${one(lat, 'N', 'S')}, ${one(lng, 'E', 'W')}`;
}
