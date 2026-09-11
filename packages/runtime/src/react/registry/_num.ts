/* Shared numeric helpers for catalog component renderers.
 *
 * These were copy-pasted (and starting to drift) across component impls; keeping
 * one definition guarantees identical clamping/snapping behaviour everywhere and
 * gives every new component a single, tested import. All are pure + finite-safe. */

/**
 * Coerce an untrusted value to an INTEGER within [min, max], or `fallback` when it
 * is not a finite number. The workhorse for prop bounds (hours, counts, sizes).
 */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

/** Clamp a finite number into [min, max]. (No coercion — caller guarantees a number.) */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Round `v` to the nearest multiple of `snap` (snap ≤ 0 → no snapping). */
export function snapTo(v: number, snap: number): number {
  return snap > 0 ? Math.round(v / snap) * snap : v;
}

/* ── display formatting for tabular values ───────────────────────────────────
 * Deterministic and locale-free (no Intl): the same spec must render the same
 * bytes on every host and in SSR. `format` shapes the DISPLAY only — sorting,
 * filtering and editing keep reading the raw value. */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1234567.5 → "1,234,567.5" (grouping only, no rounding surprises). */
export function groupDigits(n: number): string {
  const neg = n < 0;
  const [int, frac] = Math.abs(n).toString().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/**
 * Format a cell value for display. Unknown/absent format → the raw string, so
 * an unformatted column is byte-identical to before.
 *   number   1234567   → "1,234,567"
 *   currency 210000    → "£210,000"        (prefix supplies the symbol)
 *   percent  12.5      → "12.5%"
 *   date     2026-08-07 → "7 Aug 2026"     (ISO only; anything else passes through)
 */
export function formatCell(
  value: unknown,
  format: unknown,
  prefix?: unknown,
  suffix?: unknown,
): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  if (raw === '') return '';
  const pre = typeof prefix === 'string' ? prefix : '';
  const suf = typeof suffix === 'string' ? suffix : '';
  if (format === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) return `${pre}${raw}${suf}`;
    const month = MONTHS_SHORT[Number(m[2]) - 1];
    if (month === undefined) return `${pre}${raw}${suf}`;
    return `${pre}${Number(m[3])} ${month} ${m[1]}${suf}`;
  }
  const n = typeof value === 'number' ? value : Number(raw);
  if (!Number.isFinite(n)) return `${pre}${raw}${suf}`;
  if (format === 'number') return `${pre}${groupDigits(n)}${suf}`;
  if (format === 'currency') return `${pre || '£'}${groupDigits(n)}${suf}`;
  if (format === 'percent') return `${pre}${groupDigits(n)}%${suf}`;
  return `${pre}${raw}${suf}`;
}

/* ── numeric READOUT formatting (KPI values: Gauge / Stat / Donut centre) ─────
 * Three separate readouts were found printing a raw JS number glued to
 * its unit ("874MW", "2140parcels/hour") or leaking float noise
 * ("130.14999999999998"). These two helpers are the single answer. */

/** Kill IEEE float noise, then optionally cap the decimals.
 *  `130.14999999999998` → "130.15" (12 significant digits round-trips the noise
 *  away without touching honest precision: 0.001 stays "0.001"). Pass `dp` to
 *  additionally cap decimals (the Donut centre rounds to its series precision). */
export function trimFloat(n: number, dp?: number): string {
  if (!Number.isFinite(n)) return '';
  const cleaned = Number(n.toPrecision(12));
  const r = dp === undefined ? cleaned : Number(cleaned.toFixed(Math.max(0, Math.min(10, Math.round(dp)))));
  return String(r);
}

/** A readout number: noise-trimmed then digit-grouped. 2140 → "2,140". */
export function formatReadout(n: number, dp?: number): string {
  const t = trimFloat(n, dp);
  return t === '' ? '' : groupDigits(Number(t));
}

/** THIN SPACE (U+2009) — the typographic gap between a number and its unit. */
export const THIN_SPACE = '\u2009';

/** Units that sit TIGHT against the number by convention (%, degrees, ×, 2.4x). */
export function unitGap(unit: string): string {
  const u = unit.trim();
  if (u === '') return '';
  if (u === 'x') return '';
  return /^[%\u00b0\u2030\u2032\u2033\u00d7]/.test(u) ? '' : THIN_SPACE;
}
