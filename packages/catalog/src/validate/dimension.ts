/**
 * `safeDimension` — the validated DIMENSION/NUMBER-VALUE channel (the continuous
 * twin of `safeColor`). The secure way the model passes a real CSS length or a
 * count directly in a spec (e.g. a card `width`, a grid `columns`, a skeleton
 * `height`).
 *
 * Same security model as `safeColor`: arbitrary CSS *classes* are banned
 * (injection + they don't compile at runtime), but a validated *value* is data,
 * not CSS, and is applied via an inline CSS variable read by a static `var()`
 * recipe — never concatenated into a className. This validator proves a value is
 * a real, safe CSS length / unitless count before the renderer uses it.
 *
 * Accepts:
 *  - a bare `number`        → clamped; `count` → rounded integer string, else `"<n>px"`
 *  - `"<number><unit>"`     → unit ∈ the (optional) allowlist
 *  - keywords `auto | min-content | max-content | fit-content` (length kind only)
 * Rejects everything that could break out of a CSS value: `; { } < > ( )`,
 * `url()`, `calc()`, `expression`, `var()`, internal whitespace, scientific
 * notation, and magnitudes with more than 5 integer digits.
 */

const ALL_UNITS = ['px', 'rem', 'em', '%', 'fr', 'vw', 'vh', 'ch'] as const;
export type DimUnit = (typeof ALL_UNITS)[number];

const KEYWORDS = new Set(['auto', 'min-content', 'max-content', 'fit-content']);

/** A number (≤5 integer digits, ≤4 decimals) followed by an optional letter/`%` unit. */
const NUM_UNIT = /^(-?\d{1,5}(?:\.\d{1,4})?)([a-z%]*)$/i;

export interface DimOpts {
  /** Clamp lower bound of the numeric magnitude (default 0). */
  min?: number;
  /** Clamp upper bound (default 4096; `%` is auto-capped to 100). */
  max?: number;
  /** `length` → emit a px/unit string; `count` → emit a unitless integer. */
  kind?: 'length' | 'count';
  /** Unit allowlist (default: all of px/rem/em/%/fr/vw/vh/ch). */
  units?: DimUnit[];
  /** Permit `auto`/`min-content`/`max-content`/`fit-content` (length only; default true). */
  allowKeywords?: boolean;
  /** Permit negative magnitudes (default false). */
  allowNegative?: boolean;
}

interface Resolved {
  min: number;
  max: number;
  kind: 'length' | 'count';
  allowed: readonly DimUnit[];
  allowNegative: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Clamp + format a parsed magnitude/unit pair, or `null` if it isn't representable. */
function emit(num: number, unit: string, o: Resolved): string | null {
  if (!Number.isFinite(num)) return null;
  if (num < 0 && !o.allowNegative) return null;

  if (o.kind === 'count') {
    if (unit) return null; // a count is always unitless
    const lo = o.allowNegative ? -o.max : o.min;
    return String(Math.round(clamp(num, lo, o.max)));
  }

  // length
  if (!unit) {
    const lo = o.allowNegative ? -o.max : o.min;
    return `${clamp(num, lo, o.max)}px`;
  }
  if (unit === '%') {
    if (!o.allowed.includes('%')) return null;
    const hi = Math.min(o.max, 100);
    const lo = o.allowNegative ? -hi : Math.max(o.min, 0);
    return `${clamp(num, lo, hi)}%`;
  }
  if (!o.allowed.includes(unit as DimUnit)) return null;
  // Bounds are authored in PX SCALE (e.g. fontSize min:8/max:96). Clamping the
  // raw magnitude is unit-blind — "1rem" against min:8 became "8rem" (128px!).
  // Scale font-relative units to px-equivalents for the clamp, then scale back.
  const PX_PER: Partial<Record<string, number>> = { rem: 16, em: 16 };
  const scale = PX_PER[unit] ?? 1;
  const lo = o.allowNegative ? -o.max : o.min;
  const clamped = clamp(num * scale, lo, o.max) / scale;
  return `${Number(clamped.toFixed(4))}${unit}`;
}

/** Returns a safe CSS length / count string, or `null` if the value is unsafe. */
export function safeDimension(value: unknown, opts: DimOpts = {}): string | null {
  const o: Resolved = {
    min: opts.min ?? 0,
    max: opts.max ?? 4096,
    kind: opts.kind ?? 'length',
    allowed: opts.units ?? ALL_UNITS,
    allowNegative: opts.allowNegative ?? false,
  };
  const allowKeywords = opts.allowKeywords ?? true;

  // ── number input ─────────────────────────────────────────────────────────
  if (typeof value === 'number') return emit(value, '', o);
  if (typeof value !== 'string') return null;

  const v = value.trim();
  if (v.length === 0 || v.length > 32) return null;

  // Hard reject the CSS break-out / function surface (any internal whitespace,
  // declaration breaks, brackets/parens, or a function call).
  if (/[\s;{}<>()]/.test(v)) return null;
  if (/url|expression|calc|var/i.test(v)) return null;

  // ── keyword input (length kind only) ─────────────────────────────────────
  const lower = v.toLowerCase();
  if (KEYWORDS.has(lower)) return allowKeywords && o.kind === 'length' ? lower : null;

  // ── <number><unit?> input ────────────────────────────────────────────────
  const m = NUM_UNIT.exec(v);
  if (!m) return null;
  return emit(Number(m[1]), m[2].toLowerCase(), o);
}
