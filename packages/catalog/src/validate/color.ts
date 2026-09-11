/**
 * `safeColor` — the validated COLOR-VALUE channel (the secure way the model passes
 * real colors directly in a spec, e.g. a chart series or a brand accent).
 *
 * The security model bans arbitrary CSS *classes* (injection + they don't compile
 * at runtime). A validated color *value* is fundamentally different: it is data,
 * not CSS, and is applied via an inline CSS variable / a color-specific property —
 * never concatenated into a className. This validator proves a string is a real,
 * safe CSS color before the renderer uses it (the exact pattern as `safeUrl`).
 *
 * Accepts: hex (#rgb/#rgba/#rrggbb/#rrggbbaa), rgb()/rgba(), hsl()/hsla(),
 * oklch()/oklab()/lab()/lch()/color(), and bare named colors (red, transparent,
 * currentColor, …). Rejects everything that could break out of a CSS value:
 * `;` `{` `}` `<` `>`, `url(...)`, `expression`, comments, nested functions, and
 * `var(...)` (tokens go through the enum channel, not the value channel).
 */

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/** rgb/hsl/oklch/… — the inner charset excludes `(`, so no nested url()/function. */
const NUM_FUNC = /^(?:rgb|rgba|hsl|hsla|hwb|oklch|oklab|lab|lch|color)\(\s*[0-9a-zA-Z.,%/\s-]+\)$/;
/** A bare named color (or transparent/currentColor) — a single word can't inject. */
const NAMED = /^[a-zA-Z]{1,30}$/;

/** Returns the color if it is a real, safe CSS color value, else `null`. */
export function safeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length === 0 || v.length > 64) return null;
  // Hard reject anything that could close the declaration or pull in a resource.
  if (/[;{}<>]/.test(v) || /url\s*\(/i.test(v) || /expression/i.test(v) || /\/\*/.test(v) || /var\s*\(/i.test(v)) {
    return null;
  }
  if (HEX.test(v) || NUM_FUNC.test(v) || NAMED.test(v)) return v;
  return null;
}
