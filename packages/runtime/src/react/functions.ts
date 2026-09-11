/**
 * `$computed` — the golden function registry.
 *
 * json-render's `{ $computed: "<name>", args?: {...} }` calls a HOST-REGISTERED
 * function with its args already resolved (so an arg may itself be
 * `{ $state: "/qty" }`, or another `$computed`). Frayme registered NONE, which
 * meant every `$computed` in a spec resolved to `undefined` — and two
 * components turned that `undefined` into a confident wrong number. This module
 * is the registry; `FraymeRenderer` passes it to `JSONUIProvider`, so every
 * render path (index, ag-ui, ai-sdk, custom — they all go through the one
 * wrapper) gets the same vocabulary, client and SSR alike.
 *
 * ── THE SET IS FROZEN ─────────────────────────────────────────────────────
 * Once a model has learned this vocabulary these names are permanent. You
 * may ADD a function later; you may never RENAME or REMOVE one, because a spec
 * authored against the old name would silently resolve to
 * nothing. Six operations ship:
 *
 *   sum · subtract · product · divide · mean · percentChange
 *
 * WHY THESE SIX. Each is an operation an author plainly means when figures
 * meet — a total, a difference, a product, a quotient, an average, a change. The
 * rejected candidates (percentOf, count, range, countDistinct, percentOfTotal,
 * fractionOfTotal, ratio, min, max) are shapes that fit ANY two numbers rather
 * than operations an author meant: a function that matches by accident is a
 * function that fabricates by accident.
 *
 * `percentChange` ships deliberately even though it is the hardest of the six
 * to verify statically. A static spec has no interaction to credit, and the
 * reactive case (a total that recomputes as an input changes) is exactly where
 * a percentage delta earns its place.
 *
 * Everything else stays out. Most of the rejected list is composable from these
 * six anyway — `$computed` args are resolved recursively, so a percent-of-total
 * is `product(divide(part, whole), 100)` — and each name we do not ship is one
 * fewer thing the model can hallucinate a meaning for.
 *
 * ── THE CONTRACT: UNDEFINED, NEVER ZERO ───────────────────────────────────
 * A missing arg, a non-numeric arg, a division by zero, a non-finite result:
 * every one returns `undefined`. Returning 0 on a reactive screen with nothing
 * selected yet is the "£3,195 with nothing selected" bug shipped as library
 * behaviour — a fabricated number that no reader can detect. `undefined` is a
 * PRESENTATION defect (the component renders its empty state, which the reader
 * sees); a wrong number is a TRUTH defect (which nobody sees). We take the one
 * the reader can catch.
 *
 * Strictness follows the same rule. If a collection is present but ANY entry is
 * non-numeric, the whole result is `undefined` rather than a total of the
 * parseable subset — silently summing three of five rows is the worst failure in the
 * set, because the number LOOKS right.
 */

/** json-render's registered-function shape (`@json-render/core`'s `ComputedFunction`). */
export type ComputedFn = (args: Record<string, unknown>) => unknown;

/** The frozen vocabulary. Add only; never rename, never remove. */
export type FraymeComputedName =
  | 'sum'
  | 'subtract'
  | 'product'
  | 'divide'
  | 'mean'
  | 'percentChange';

/* ── PRESENTATION STRIPPING ───────────────────────────────────────────────────
 *
 * A request supplies its figures the way a human wrote them: `"$214"`,
 * `"¥86,400,000"`, `"1,234.5"`, `"42%"`, `"(1,200)"`. An earlier version of this
 * module refused all of those on the grounds that "guessing a locale is
 * inventing a value". The consequence: every figure a request stated in one of
 * those forms was refused — and each is a number the request already states, so
 * refusing it does not protect the reader, it just moves a real figure into the
 * empty state.
 *
 * So we strip presentation. We do NOT guess a locale: the grammar below accepts
 * only ONE unambiguous convention (`.` decimal, 3-digit groups) and REFUSES
 * anything ambiguous — `"1.200,50"` returns `undefined`, it does not become
 * 1.2 or 1200.5. Refusal is still the answer whenever the string does not parse
 * cleanly and wholly, which is what keeps the contract below intact.
 *
 * What is stripped, and nothing else:
 *   - a Unicode currency symbol (`\p{Sc}`: $ £ € ¥ ₹ …) at EITHER end
 *   - group separators inside the digits — `,` and the space family
 *     (SPACE, NBSP, NARROW NBSP, THIN SPACE) — in strict groups of 3
 *   - ONE leading sign (`-`, `+`, or U+2212 MINUS), before or after the symbol
 *   - accountancy parentheses: `"(1,200)"` → `-1200`
 *   - ONE trailing `%`
 *
 * Currency CODES (`"USD 214"`, `"214 EUR"`) are deliberately NOT stripped: a
 * bare run of letters next to digits is not reliably a currency, and this set
 * was scoped to the forms requests actually use.
 *
 * `%` DOES NOT DIVIDE. `"42%"` is the number 42, not 0.42 — the same convention
 * `percentChange` already returns (`12.5`, not `0.125`), so a percentage
 * round-trips through the registry unchanged. Dividing would be interpreting the
 * value, and this pass only removes ink.
 */

/** Group separators we accept INSIDE a number: comma and the space family. */
const GROUP_SEP = /[,\u00A0\u202F\u2009 ]/g;
/** `1,234` · `86,400,000` · `1 234.5` — strict 3-digit groups, `.` decimal. */
/* The LEADING GROUP MAY NOT BE A BARE ZERO. `0,750` matched the old
 * pattern and came back 750 \u2014 but no English-grouped number is ever written with a
 * leading `0` group; you write `750`. A `0` before a comma is therefore a DECIMAL
 * separator, and German `0,750` is 0.75. Reading it as 750 is a 1000x fabrication,
 * not an ambiguity to resolve. `[1-9]` on the first digit refuses it while leaving
 * every real grouped number ("428,750", "86,400,000", "1,234.5") untouched.
 * The genuinely ambiguous forms were already refused: "12,34", "1,5", "1.200,50". */
const GROUPED = /^[1-9]\d{0,2}(?:[,\u00A0\u202F\u2009 ]\d{3})+(?:\.\d+)?$/;
/** `1234` · `1234.5` · `.5` — ungrouped digits, `.` decimal. */
const PLAIN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
/** One sign character. U+2212 is the real minus a typographer emits. */
const SIGN = /^([+\-\u2212])\s*/;

/**
 * Parse a FORMATTED numeric string, or `undefined`.
 *
 * Only ever reached for strings `Number()` already rejected, so it can add
 * values but can never change one — see `num`.
 */
function unformat(raw: string): number | undefined {
  let s = raw;

  // Accountancy negative. A sign INSIDE the brackets is a double negative
  // nobody means on purpose, so it is refused below rather than guessed.
  let factor = 1;
  const paren = /^\(\s*([\s\S]*?)\s*\)$/.exec(s);
  if (paren) {
    factor = -1;
    s = paren[1];
  }
  if (s === '') return undefined;

  // ONE trailing percent. The value is unchanged; see the note above.
  if (s.endsWith('%')) s = s.slice(0, -1).trimEnd();
  if (s === '') return undefined;

  // ONE leading sign, on either side of the currency symbol ("-$5" and "$-5"),
  // then a symbol at either end. Each is taken at most once, so "--5" and
  // "$$5" stay refusals.
  let signed = false;
  const lead = SIGN.exec(s);
  if (lead) {
    if (paren) return undefined; // "(-5)" — ambiguous, refuse
    signed = true;
    if (lead[1] !== '+') factor = -factor;
    s = s.slice(lead[0].length);
  }
  const leadCur = /^\p{Sc}\s*/u.exec(s);
  if (leadCur) s = s.slice(leadCur[0].length);
  if (!signed) {
    const inner = SIGN.exec(s);
    if (inner) {
      if (paren) return undefined;
      if (inner[1] !== '+') factor = -factor;
      s = s.slice(inner[0].length);
    }
  }
  const tailCur = /\s*\p{Sc}$/u.exec(s);
  if (tailCur) s = s.slice(0, s.length - tailCur[0].length);

  s = s.trim();
  if (s === '') return undefined;

  // Whatever is left must be digits in ONE unambiguous convention. Anything
  // else — "1.200,50", "12,34", "1-2", "n/a" — is refused, not guessed.
  let core: string;
  if (GROUPED.test(s)) core = s.replace(GROUP_SEP, '');
  else if (PLAIN.test(s)) core = s;
  else return undefined;

  const n = Number(core);
  if (!Number.isFinite(n)) return undefined;
  return factor * n;
}

/**
 * Coerce ONE arg to a finite number, or `undefined`.
 *
 * Accepts a finite `number`; a non-empty string that parses cleanly and wholly
 * (`"12"`, `"12.5"`, `"1e3"`); and a string carrying only PRESENTATION on top of
 * such a number (`"$214"`, `"¥86,400,000"`, `"1,234.5"`, `"42%"`, `"(1,200)"`).
 * Rejects everything else — notably:
 *  - `true`  (`Number(true) === 1` — a boolean is not a quantity)
 *  - `""` / `"   "` / `[]` (`Number()` maps all three to 0 — the exact
 *    zero-fabrication this contract exists to stop)
 *  - `"not a number"`, `"1.200,50"`, `"12,34"` — an unparseable or AMBIGUOUS
 *    string is `undefined`, never 0. Turning text into 0 fabricates a figure;
 *    `undefined` renders the empty state, which the reader can see.
 *
 * ORDERING IS THE PROOF. `Number()` runs FIRST and returns on success, so a
 * genuine number and every string that already parsed keep byte-identical
 * behaviour; `unformat` is only ever reached where the old code returned
 * `undefined`. This change can therefore only turn refusals into values — it
 * cannot alter one that already resolved.
 */
/* EXPORTED on purpose. Hand-written copies of this coercion have existed outside this
 * module, and they silently fell behind the day `unformat` landed — still refusing operands
 * as "not numeric" on the grounds that "the runtime does not strip", which had stopped
 * being true. A coercion that decides whether a figure is convertible must have exactly
 * ONE definition, and it belongs beside the functions that use it. Import this; never
 * transcribe it. */
export function coerceComputedOperand(v: unknown): number | undefined {
  return num(v);
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return undefined;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
    return unformat(t);
  }
  return undefined;
}

/**
 * Kill binary floating-point residue without inventing precision.
 * `0.1 + 0.2` is `0.30000000000000004`; a double carries ~15.95 significant
 * digits, so re-reading the result at 15 significant digits removes the
 * representation artefact and cannot change a value that was meaningfully
 * distinct at that magnitude. Non-finite (overflow, 0/0) → `undefined`.
 */
function clean(x: number): number | undefined {
  if (!Number.isFinite(x)) return undefined;
  const r = Number(x.toPrecision(15));
  return Number.isFinite(r) ? r : undefined;
}

/** Read `field` off a collection item. Supports a dotted path (`price.net`). */
function readField(item: unknown, field: string): unknown {
  let cur: unknown = item;
  for (const seg of field.split('.')) {
    if (seg === '') continue;
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * The AGGREGATION shape. Two accepted forms, so a summary component can total a
 * column without the author flattening it first:
 *
 *   { over: <array>, field?: "<key or dotted path>" }   // total a column
 *   { values: [<number>, <number>, …] }                 // an explicit list
 *
 * Returns `undefined` when the collection is absent or is not an array (the
 * unseeded-state case: `{ $state: "/lineItems" }` over nothing resolves to
 * `undefined`, not `[]`), or when ANY entry fails `num`. An EMPTY array is a
 * real, well-formed answer — "nothing in the cart" — and is returned as `[]`
 * for each operation to interpret.
 *
 * `over` wins if both forms are present.
 */
function collect(args: Record<string, unknown>): number[] | undefined {
  const src = 'over' in args ? args.over : 'values' in args ? args.values : undefined;
  if (!Array.isArray(src)) return undefined;
  const field = typeof args.field === 'string' && args.field !== '' ? args.field : null;
  const out: number[] = [];
  for (const item of src) {
    const n = num(field === null ? item : readField(item, field));
    if (n === undefined) return undefined; // strict: a partial total is a truth defect
    out.push(n);
  }
  return out;
}

/** Binary operands, in order. Either missing/non-numeric → `undefined`. */
function pair(args: Record<string, unknown>, ka: string, kb: string): [number, number] | undefined {
  const a = num(args[ka]);
  const b = num(args[kb]);
  return a === undefined || b === undefined ? undefined : [a, b];
}

/**
 * The operand list every AGGREGATE reads: the collection forms first, then the
 * two-scalar `{ a, b }` form, because a model reaching for "add these two" will
 * write `sum` with `a`/`b` before it writes `values: [...]`. One helper, so all
 * three aggregates accept byte-identical shapes and the model never has to
 * remember which one is special.
 */
function operands(args: Record<string, unknown>): number[] | undefined {
  const xs = collect(args);
  if (xs !== undefined) return xs;
  if ('a' in args || 'b' in args) return pair(args, 'a', 'b');
  return undefined;
}

export const fraymeComputedFunctions: Record<FraymeComputedName, ComputedFn> = {
  /**
   * Total. `{ over, field? }`, `{ values }`, or `{ a, b }`.
   * An EMPTY collection totals 0 — that is TRUE ("the cart is empty, the total
   * is nothing"), and it is distinguishable from the unseeded case, which
   * arrives as `undefined` rather than `[]` and returns `undefined`.
   */
  sum: (args) => {
    const xs = operands(args);
    if (xs === undefined) return undefined;
    let t = 0;
    for (const x of xs) t += x;
    return clean(t);
  },

  /**
   * Product. `{ over, field? }`, `{ values }`, or `{ a, b }` — the CPQ
   * workhorse (`qty × unitPrice`). An empty collection returns `undefined`, NOT the
   * multiplicative identity 1: a bare "1" on screen would be an artefact of
   * arithmetic, not a fact about anything.
   */
  product: (args) => {
    const xs = operands(args);
    if (xs === undefined || xs.length === 0) return undefined;
    let t = 1;
    for (const x of xs) t *= x;
    return clean(t);
  },

  /** `a − b`. */
  subtract: (args) => {
    const ab = pair(args, 'a', 'b');
    return ab === undefined ? undefined : clean(ab[0] - ab[1]);
  },

  /** `a ÷ b`. `b === 0` → `undefined` (never `Infinity`, never `NaN`). */
  divide: (args) => {
    const ab = pair(args, 'a', 'b');
    if (ab === undefined || ab[1] === 0) return undefined;
    return clean(ab[0] / ab[1]);
  },

  /**
   * Arithmetic mean. `{ over, field? }`, `{ values }`, or `{ a, b }`.
   * An empty collection returns `undefined` — the mean of nothing is not 0, it
   * does not exist.
   */
  mean: (args) => {
    const xs = operands(args);
    if (xs === undefined || xs.length === 0) return undefined;
    let t = 0;
    for (const x of xs) t += x;
    return clean(t / xs.length);
  },

  /**
   * Percentage change from a baseline to a current value, as a NUMBER (`12.5`,
   * not `"12.5%"`) so the component owns the formatting.
   *
   * Named operands `{ from, to }` rather than `{ a, b }` on purpose: the two
   * arguments are not interchangeable and reversed operands produce a wrong
   * number that renders with total confidence. Naming the direction is the
   * cheapest defence against the only defect class nobody can see.
   *
   * Divided by `|from|` so a rise from a negative baseline still reads as a
   * rise. `from === 0` → `undefined` (change from nothing is undefined, not
   * infinite).
   */
  percentChange: (args) => {
    const ft = pair(args, 'from', 'to');
    if (ft === undefined || ft[0] === 0) return undefined;
    return clean(((ft[1] - ft[0]) / Math.abs(ft[0])) * 100);
  },
};

/**
 * The registered names, DERIVED from the registry — so this list cannot claim a
 * function the runtime does not actually implement.
 *
 * The catalog's resolution gate keeps a mirror of this set (it must: the
 * dependency runs runtime → catalog, so the catalog cannot import the runtime
 * without a cycle). Both sides are pinned by a test against the same explicit
 * literal, so a change to either turns the other red.
 */
export const COMPUTED_FUNCTION_NAMES: readonly string[] = Object.keys(fraymeComputedFunctions);
