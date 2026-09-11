/**
 * PRESS → THREAD TEXT. What a host writes into the chat thread when the user
 * presses a control that fires a declared action.
 *
 * Shape: the humanized ACTION NAME, then its
 * params as a bullet list. Nothing else — no button label, no action description,
 * no source-priority logic. One deterministic form for every action.
 *
 *     Track price
 *     - Model ID: vantor-dualzone-55
 *     - Current price GBP: 149
 *     - Duration days: 14
 *
 * IT WRITES STRUCTURE, NOT ENGLISH — the load-bearing constraint. Keys are
 * humanized; VALUES are formatted but never rewritten. Button labels are often
 * not English, and action names follow suit (`verlängerungAblehnen`). So there
 * is no conjugation, no sentence building and no re-casing of anything a caller
 * supplied: German capitalizes nouns mid-sentence, Japanese has no case at all,
 * and any rule clever enough to "fix" a value is a rule that corrupts the ones
 * it does not understand. Tense, if a host wants it, belongs in the frame the
 * host puts around this — never inside it.
 *
 * PURE: no React, no @json-render, no I/O. Safe on a server, in an MCP handler, or
 * in the renderer at dispatch.
 */

/**
 * Acronyms fixed up PER WORD, not per key. Testing the whole key gets `arr` → ARR
 * right and `runId` → "Run id" wrong — and the compound is the common case.
 */
const ACRONYMS = new Set([
  'api', 'arr', 'cta', 'crm', 'csv', 'eta', 'eur', 'gbp', 'id', 'ip', 'kpi', 'otp',
  'pdf', 'po', 'sku', 'sla', 'sms', 'ui', 'url', 'usd', 'ux', 'vat',
]);

/** Split camelCase / snake_case / kebab-case into words, preserving acronym runs. */
function words(input: string): string[] {
  return String(input ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')   // HTTPServer → HTTP Server
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * `launchPlaybook` → "Launch playbook" · `verlängerungAblehnen` → "Verlängerung ablehnen"
 *
 * Sentence case, not title case. A word that is ALL CAPS or a single letter is left
 * exactly as written, so `explainNoteG` keeps its "G" and an acronym survives.
 */
export function humanizeName(name: string): string {
  const ws = words(name).map((w) => (/^[A-Z]+$/.test(w) || w.length === 1 ? w : w.toLowerCase()));
  const s = ws.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** `renewalDate` → "Renewal date" · `currentPriceGbp` → "Current price GBP" */
export function humanizeKey(key: string): string {
  return humanizeName(key)
    .split(' ')
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w))
    .join(' ');
}

/**
 * Is this param worth a bullet? Blank ones are dropped entirely — a thread reads
 * better without "Note: —" in it.
 *
 * BLANK IS NOT FALSY, and conflating them is the bug waiting to happen here.
 * `confirmed: false` is the whole point of a confirmation param and `days: 0` is a
 * real answer; a plain `if (!value)` would silently delete both. Blank means: no
 * value was supplied — undefined, null, an empty or whitespace-only string, an
 * empty list, or an empty object.
 */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;                                   // false, 0, NaN are VALUES
}

/**
 * FORMATTED, never rewritten. Numbers get thousands separators, booleans read as
 * Yes/No, short arrays inline and longer ones are counted. A string is returned
 * exactly as supplied — that is the whole point (see the module note).
 *
 * Blank inputs still map to an em dash so the function is total, but `threadText`
 * filters them out before they get here — see isBlank.
 *
 * NEVER THROWS ON A CYCLE. The receipt card renders every
 * event's params through this at render time, and a host-built event can carry
 * a self-referencing object (renderer-produced params are JSON-derived and never
 * do); the naive recursion hit `RangeError: Maximum call stack size exceeded`
 * in the middle of the host's thread render. `path` tracks the objects on the
 * CURRENT descent only — a value that is merely shared (the same row object
 * under two keys) still formats twice; only a true back-edge prints the marker.
 */
export function formatValue(value: unknown): string {
  return formatValueIn(value, new Set());
}

function formatValueIn(value: unknown, path: Set<object>): string {
  if (isBlank(value)) return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-GB') : String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object' && value !== null) {
    if (path.has(value)) return '[circular]';
    path.add(value);
    try {
      if (Array.isArray(value)) {
        return value.length <= 4 ? value.map((v) => formatValueIn(v, path)).join(', ') : `${value.length} items`;
      }
      return Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => !isBlank(v))
        .map(([k, v]) => `${humanizeKey(k)}: ${formatValueIn(v, path)}`)
        .join(', ');
    } finally {
      path.delete(value);
    }
  }
  return String(value);
}

export interface ThreadTextOptions {
  /** Bullet marker. Default '-'; pass '•' for a host that renders plain text. */
  bullet?: string;
  /** Cap the bullets, appending "+N more". Default: no cap — the host knows its own budget. */
  maxParams?: number;
}

/**
 * The transform. Returns plain text: a heading line, then one bullet per param.
 * An action with no params returns the heading alone, with no trailing newline.
 */
export function threadText(
  action: string,
  params: Record<string, unknown> = {},
  options: ThreadTextOptions = {},
): string {
  const bullet = options.bullet ?? '-';
  const lines = [humanizeName(action)];
  // Blank params get no bullet at all. `false` and `0` are values, not blanks —
  // see isBlank.
  const entries = Object.entries(params ?? {}).filter(([, v]) => !isBlank(v));
  const cap = options.maxParams;
  const shown = typeof cap === 'number' && cap >= 0 ? entries.slice(0, cap) : entries;
  for (const [k, v] of shown) lines.push(`${bullet} ${humanizeKey(k)}: ${formatValue(v)}`);
  const hidden = entries.length - shown.length;
  if (hidden > 0) lines.push(`${bullet} +${hidden} more`);
  return lines.join('\n');
}
