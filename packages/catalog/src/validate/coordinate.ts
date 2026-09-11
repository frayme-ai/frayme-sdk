/**
 * safeCoordinate family — the validated GEOMETRY value channels (the secure way
 * the model passes positions/times in a spec: map markers, signature strokes,
 * seat/floor coordinates, scheduler times).
 *
 * Like `safeColor` / `safeDimension`, each of these proves a value is a real,
 * bounded, FINITE geometry primitive BEFORE the renderer uses it (as an SVG
 * attribute or a computed coordinate), and returns `null` on any failure so the
 * render omits it and its token/no-op default wins. A spec value NEVER becomes
 * markup — the renderer owns the path/rect/line markup; these validators only
 * clear the NUMBERS that fill it.
 *
 * SECURITY: every value is `Number.isFinite`-checked (no NaN/±Infinity →
 * no broken SVG geometry / layout explosion), range-clamped/rejected, and every
 * list is length-capped (a render-bomb guard mirroring the chart finite-filter).
 * Enforcement lives HERE and is called from each component's render body — the
 * authoring-time gate reports mistakes early, but the render body is what
 * neutralizes an untrusted generated value at serve time.
 *
 * NOTE: raw SVG path `d` strings are deliberately NOT handled here — a path
 * validator must tokenize-and-rebuild (never regex-allowlist-and-forward) and
 * ships with its consumer (FloorPlan). This module covers the numeric channels.
 */

/** A finite number within [min, max] inclusive, else null. */
export function safeNumberIn(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

/** A normalized scalar in [0, 1] (a fraction of a container), else null. */
export function safeUnit(value: unknown): number | null {
  return safeNumberIn(value, 0, 1);
}

/**
 * A geographic point → a validated `{ lat, lng }`, else null. Accepts
 * `{ lat, lng }`, `{ latitude, longitude }`, or `[lat, lng]`. lat ∈ [-90, 90],
 * lng ∈ [-180, 180]; both finite.
 */
export function safeLatLng(value: unknown): { lat: number; lng: number } | null {
  let lat: unknown;
  let lng: unknown;
  if (Array.isArray(value) && value.length >= 2) {
    lat = value[0];
    lng = value[1];
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    lat = o.lat ?? o.latitude;
    lng = o.lng ?? o.lon ?? o.longitude;
  } else {
    return null;
  }
  const la = safeNumberIn(lat, -90, 90);
  const ln = safeNumberIn(lng, -180, 180);
  if (la === null || ln === null) return null;
  return { lat: la, lng: ln };
}

/**
 * A normalized point `{ x, y }` with both in [0, 1], else null. Accepts
 * `{ x, y }` or `[x, y]`. This is the canvas/annotation/seat coordinate — a
 * fraction of the surface, so it stays correct across any render size.
 */
export function safePoint(value: unknown): { x: number; y: number } | null {
  let x: unknown;
  let y: unknown;
  if (Array.isArray(value) && value.length >= 2) {
    x = value[0];
    y = value[1];
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    x = o.x;
    y = o.y;
  } else {
    return null;
  }
  const xx = safeUnit(x);
  const yy = safeUnit(y);
  if (xx === null || yy === null) return null;
  return { x: xx, y: yy };
}

/**
 * A capped list of normalized points (a stroke / polygon / marker set), filtered
 * to only the valid points. Returns null when the input isn't an array or has no
 * valid point. `max` caps the length (render-bomb guard; default 4096).
 */
export function safePointList(value: unknown, max = 4096): Array<{ x: number; y: number }> | null {
  if (!Array.isArray(value)) return null;
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : 4096;
  const out: Array<{ x: number; y: number }> = [];
  for (const p of value) {
    const pt = safePoint(p);
    if (pt) out.push(pt);
    if (out.length >= cap) break;
  }
  return out.length ? out : null;
}

/**
 * A time-of-day as MINUTES from midnight (0..1440), from a number (minutes) or an
 * "HH:MM" 24-hour string, else null. The scheduler/EPG position channel — a
 * unitless axis number, never a length. 1440 (24:00) is allowed as an end-of-day
 * boundary; a number is rounded to the nearest minute.
 */
export function safeTimeMinutes(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? safeNumberIn(Math.round(value), 0, 1440) : null;
  }
  if (typeof value === 'string') {
    // Canonical is "HH:MM" 24h, but generated specs naturally drift to 12-hour
    // forms ("10:00 AM", "2 PM"), which a strict match would silently drop.
    // Accept an optional AM/PM suffix (bare hour allowed WITH the suffix only);
    // pure-24h behavior is unchanged.
    const m = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\.?$/i);
    if (!m) return null;
    let h = Number(m[1]);
    const min = m[2] !== undefined ? Number(m[2]) : 0;
    const ap = m[3]?.toLowerCase();
    if (min > 59) return null;
    if (ap) {
      if (h < 1 || h > 12) return null;
      if (ap === 'pm' && h !== 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
    } else {
      if (m[2] === undefined) return null; // bare "10" without AM/PM stays invalid
      if (h > 24 || (h === 24 && min > 0)) return null;
    }
    return h * 60 + min;
  }
  return null;
}
