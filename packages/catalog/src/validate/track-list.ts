/**
 * `safeTrackList` — the validated GRID TRACK LIST channel.
 *
 * A matrix whose columns have different natural widths (a wide name, a narrow
 * amount, a very wide sparkline) cannot be expressed by a column COUNT: equal
 * fractions give every field the same room. Authors were hand-rolling such
 * screens as independent rows, which is why their headers pointed at the wrong
 * columns — nothing shared a track.
 *
 * The value reaches CSS, so it is proved against a CLOSED grammar rather than
 * escaped: a space-separated list of tracks, each one a number with an allowed
 * unit, a content keyword, or a minmax()/repeat() of those. Anything else —
 * including any character that could close the declaration — returns null and
 * the caller falls back to its default template.
 */

const UNIT = String.raw`(?:\d+(?:\.\d+)?)(?:fr|px|rem|em|%|ch)`;
/**
 * A bare `0` is unitless but IS a valid length, and it is the one that matters:
 * `minmax(0, 1fr)` is how a track is made shrinkable. A bare `1fr` means
 * `minmax(AUTO, 1fr)`, and that automatic minimum is the item's min-content —
 * for any cell holding a nowrap/truncate descendant that is the full
 * untruncated string, so the track grows past the container and the content
 * escapes the render surface. Rejecting `0` would have left authors unable to
 * write the only safe form.
 */
const ZERO = String.raw`0`;
const KEYWORD = String.raw`auto|min-content|max-content`;
const SIMPLE = String.raw`(?:${UNIT}|${ZERO}|${KEYWORD})`;
const MINMAX = String.raw`minmax\(\s*${SIMPLE}\s*,\s*${SIMPLE}\s*\)`;
const TRACK = String.raw`(?:${MINMAX}|${SIMPLE})`;
const REPEAT = String.raw`repeat\(\s*[1-9]\d?\s*,\s*${TRACK}\s*\)`;
const ONE = new RegExp(String.raw`^(?:${REPEAT}|${TRACK})$`);

/** Hard ceilings: a track list longer than this is a mistake, not a layout. */
const MAX_TRACKS = 12;
const MAX_LEN = 200;

/**
 * Validate a grid track list ("2fr 96px 96px minmax(120px,1fr)").
 * Returns the normalised string, or null when it is not a well-formed list.
 */
export function safeTrackList(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > MAX_LEN) return null;
  // split on whitespace that is NOT inside parentheses
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of raw) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) return null;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) { parts.push(cur); cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur) parts.push(cur);
  if (depth !== 0) return null;
  if (parts.length === 0 || parts.length > MAX_TRACKS) return null;
  for (const p of parts) if (!ONE.test(p)) return null;
  return parts.join(' ');
}
