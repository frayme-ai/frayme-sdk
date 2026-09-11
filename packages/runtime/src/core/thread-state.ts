/**
 * STATE → THREAD TEXT. The compact summary of what the user did LOCALLY that a
 * text-only host appends under `threadText` when a control fires a declared
 * action.
 *
 * The agent must read all three channels — the
 * control's NAME, the PARAMS, and the STATE. The structured `onAction` path
 * already carries `event.state`; the `sendMessage` text path sent
 * `threadText(action, params)` alone and DROPPED it — so every gesture the
 * carrier gate had batched into `state._ui` (a Kanban move, a Select change,
 * a sort) reached a structured host and vanished on a text one. This closes
 * the gap on the MESSAGE TO THE MODEL only: the receipt card (core/receipt.ts)
 * keeps hiding state, deliberately.
 *
 *     Save board                            ← threadText: the ACTION NAME
 *                                             (`saveBoard`), never the button
 *                                             label
 *                                           ← one blank line
 *     Also recorded                         ← this module, from here down
 *     - Board · move: Fix login bug, To do → In progress
 *     - Region · change: EU
 *     - Board: 3 items
 *
 * Two kinds of bullet, in this order:
 *  · one per recorded GESTURE in `state._ui` — `<Element> · <verb>: <payload>`,
 *    the element id humanized, the verb as the runtime named it, the payload
 *    laid out per verb (see gestureDetail) so a move reads as a move and a
 *    search as its query, not as a key dump — and, after that head, every
 *    other key the payload carries (a `select` that printed
 *    only `Checked: Yes` named WHAT changed but not WHICH row; the identity
 *    half of the payload — id, index, row, role, column — is exactly what the
 *    mirror holds and the model was not told);
 *  · one per BOUND VALUE — every top-level state key except `_ui`, as
 *    `<Key>: <value>`.
 *
 * COUNT, DON'T DUMP — at every depth. `formatValue` inlines an array of ≤4
 * elements because a param's short list IS its content (`tags: a, b`); but an
 * array of RECORDS (a board's columns, a table's rows, a form's line items) is
 * a data set, and inlining even three rows dumps the whole arrangement into the
 * message when the gesture bullets already say what changed. So a record array
 * is counted — `Board: 3 items` — wherever it sits: a top-level bound value, a
 * key inside a bound object, or a key inside a gesture payload (for instance,
 * a DataTable row action stashes `rows: <the whole table>` in its commit, and
 * the first cut printed every row's every field for a ≤4-row table). Scalars
 * and scalar arrays keep formatValue's rules — see `detail`.
 *
 * THE BLOCK IS THE CURRENT MIRROR, NOT THE UNSENT DELTA. `state._ui` keeps one
 * entry per control for the life of the session and this module reads state
 * alone — it cannot know which entries an earlier press already carried. So a
 * gesture the model has heard about is repeated under every later press until
 * the control is touched again, and a control that fired its OWN message (a
 * bare press, a Form submit, a row action) leaves a mirror that reappears
 * here. The one carrier we can recognise from shape alone is the bare press —
 * a `commit` that is `{ label }`, or `{ label }` plus positional keys
 * (`index`, `href`, `external`) — and it gets no bullet; anything richer is
 * kept because it may be the only record of what was entered. A true delta
 * needs the gate's own dispatch log, which pure state does not carry.
 *
 * IT WRITES STRUCTURE, NOT ENGLISH — the same constraint as core/thread-text.ts,
 * which this reuses rather than restates: keys and element ids are humanized,
 * values are formatted and never rewritten, labels and card titles are the
 * caller's strings exactly as supplied (labels are often not English;
 * German capitalises nouns mid-sentence, Japanese has no case at all). No
 * verb is conjugated: "· move:" is a field name, not a sentence.
 *
 * BLANK GETS NO BULLET — one rule for every verb. A blank payload,
 * a blank bound value, a gesture whose detail formats to nothing: skipped, never
 * an em-dash. `false` and `0` are values (see isBlank).
 *
 * NEVER THROWS ON CONTENT. `state` arrives from a live store and, on a
 * host-built event, from anywhere: undefined, null, a primitive, an array, a
 * payload that is a string, a cyclic object. Every shape produces a string or
 * `''` — a message to the model is never worth a throw in the host's send path.
 *
 * PURE: no React, no @json-render, no I/O. Safe on a server, in an MCP handler,
 * or in the renderer at dispatch.
 */
import { formatValue, humanizeKey, isBlank } from './thread-text.js';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
/** A non-blank string, else null — the "verbatim or nothing" reader for labels and names. */
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

export interface ThreadStateOptions {
  /** Bullet marker. Default '-'; pass '•' for a host that renders plain text. */
  bullet?: string;
  /**
   * Cap the bullets (gestures and bound values together), appending "+N more".
   * Default 12 — unlike `threadText`, which is uncapped, state is unbounded: a
   * long session leaves a mirror entry per control the user touched, and the
   * model's context is the host's budget to spend, not ours. `0` (or less)
   * means no bullets at all, which is nothing to say → `''` — never the
   * heading over a lone "+N more".
   */
  maxLines?: number;
  /**
   * The firing control's own mirror entry — it IS the action, not a prior
   * gesture, and `threadText` already printed it as the heading and params.
   * `elementId` is required for anything to be excluded (a programmatic
   * dispatch has no element, so nothing is its own); `verb` narrows it when
   * known, and its absence (an action bound to more than one event, where
   * `DynamicActionEvent.event` is omitted as ambiguous) excludes the element's
   * whole entry — every mirror the firing control wrote is the action's.
   */
  exclude?: { elementId?: string; verb?: string };
  /** The line above the bullets. Default 'Also recorded'. Never printed alone. */
  heading?: string;
}

/**
 * The module's formatter: `formatValue`'s rules for scalars, booleans, numbers,
 * strings and scalar arrays, plus the record-count rule at EVERY depth — any
 * array with an object in it prints as `N item(s)`, never its contents. Objects
 * print as `Key: value` entries, blanks dropped, humanized keys, and a cyclic
 * back-edge prints `[circular]` exactly as formatValue does (the receipt work
 * hit `RangeError` on a host-built self-referencing param). Total: a blank
 * prints '—' like formatValue, but every caller here guards blanks first.
 */
function detail(value: unknown): string {
  return detailIn(value, new Set());
}

function detailIn(value: unknown, path: Set<object>): string {
  if (Array.isArray(value)) {
    if (value.some((v) => typeof v === 'object' && v !== null)) {
      return `${value.length.toLocaleString('en-GB')} item${value.length === 1 ? '' : 's'}`;
    }
    return formatValue(value);
  }
  if (!isRec(value)) return formatValue(value);
  if (path.has(value)) return '[circular]';
  path.add(value);
  try {
    return Object.entries(value)
      .filter(([, v]) => !isBlank(v))
      .map(([k, v]) => `${humanizeKey(k)}: ${detailIn(v, path)}`)
      .join(', ');
  } finally {
    path.delete(value);
  }
}

/** `payload` minus the keys a verb has already laid out — what is left to append. */
function rest(p: Rec, ...taken: string[]): Rec {
  const out: Rec = {};
  for (const [k, v] of Object.entries(p)) if (!taken.includes(k)) out[k] = v;
  return out;
}

/** Head + the remaining keys, either side optional; '' when both are empty. */
function join(head: string | null, tail: string): string {
  if (head === null || head === '') return tail;
  return tail === '' ? head : `${head}, ${tail}`;
}

/**
 * A `commit` mirror that is only a press: `{ label }` alone, or `{ label }` with
 * nothing but WHERE the control sat (a hero CTA's `index` + `href`, a Link's
 * `href` + `external`, a list row action's `index`). Its name was its own
 * message when it fired; the residue names no subject. Any
 * content key — a Form's `fields`, a row action's `action` + `row`, a lap's
 * `elapsedMs` — makes it a gesture worth a line.
 */
const POSITIONAL = new Set(['index', 'href', 'external']);
function isBarePress(withoutLabel: Rec): boolean {
  return Object.entries(withoutLabel).every(([k, v]) => POSITIONAL.has(k) || isBlank(v));
}

/**
 * The per-verb layout of a gesture payload — the shapes are the renderer's own
 * emit sites (core/intrinsic.ts IntrinsicEventPayloads). Each verb prints its
 * HEAD (the part that reads as the gesture) and then appends every other
 * non-blank key through `detail`, so the identity a payload carries is never
 * dropped. Anything a verb does not name falls through to `detail(payload)`,
 * so an unknown verb or an unexpected shape still prints its keys rather than
 * nothing or a throw.
 */
function gestureDetail(verb: string, payload: unknown, elementId: string): string {
  if (!isRec(payload)) return formatValue(payload);
  const p = payload;
  switch (verb) {
    case 'move': {
      // kanban { card, fromColumn, toColumn } · slot-mode card { id, card, dir,
      // fromColumn, toColumn } · splitpane { splitPercent } · resizable
      // { width, height, axis }. The card's title (else its id) VERBATIM, then
      // where it went; a direction only when no column names it. A move's
      // remaining keys (fromIndex/toIndex, assignee, meta, axis) are position
      // and decoration, not identity — the columns already say where; they
      // are deliberately NOT appended.
      const name = str(p.card) ?? str(p.id);
      const from = str(p.fromColumn);
      const to = str(p.toColumn);
      const dir = str(p.dir);
      if (from && to) return name ? `${name}, ${from} → ${to}` : `${from} → ${to}`;
      if (name && dir) return `${name} → ${dir}`;
      if (!isBlank(p.splitPercent)) return `${formatValue(p.splitPercent)}%`;
      if (!isBlank(p.width) && !isBlank(p.height)) return `${formatValue(p.width)}×${formatValue(p.height)}`;
      return detail(payload);
    }
    case 'change': {
      // { value?, name?, … } + component identity (toggled/card/column/index —
      // core/intrinsic.ts). The field name (humanized) then the value, then
      // the identity keys: a PermissionMatrix's role + capability, a
      // spreadsheet cell's rowIndex + columnIndex, a ChipGroup's toggled item.
      // A name that merely repeats the element id (a Select called `region`
      // inside element `region`) is not printed twice. A BLANK value is a
      // clear (a search field's ×, a number input emptied): no head and no
      // em-dash — the same rule as every other verb here — and the
      // name rides with the rest as a plain key so a cleared cell still says
      // which column; a clear with nothing else in it gets no bullet at all.
      // No `value` key → the whole payload (a card open, a column collapse).
      if (!('value' in p)) return detail(payload);
      const name = str(p.name);
      const shown = name !== null && name !== elementId ? name : null;
      if (isBlank(p.value)) {
        const tail = rest(p, 'value', 'name');
        return isBlank(tail) ? '' : detail(shown ? { name: shown, ...tail } : tail);
      }
      const value = formatValue(p.value);
      const head = shown ? `${humanizeKey(shown)}: ${value}` : value;
      return join(head, detail(rest(p, 'value', 'name')));
    }
    case 'select': {
      // { value?, label?, id?, index?, selected?, checked? } + whatever the
      // control adds (a DataTable row's `row` and `selectedRows`, a FloorPlan's
      // `selection` + totals). The label, else the value, verbatim — plus the
      // checkbox / multi-select state when the payload carries it, since
      // "picked X" and "unpicked X" differ only there — then the identity keys.
      const head = str(p.label) ?? (isBlank(p.value) ? null : formatValue(p.value));
      const extra: string[] = [];
      if (!isBlank(p.checked)) extra.push(`${humanizeKey('checked')}: ${formatValue(p.checked)}`);
      if (!isBlank(p.selected)) extra.push(`${humanizeKey('selected')}: ${detail(p.selected)}`);
      const lead = [head, ...extra].filter((s): s is string => s !== null).join(', ');
      return join(lead, detail(rest(p, 'label', 'value', 'checked', 'selected')));
    }
    case 'sort': {
      const by = str(p.sortBy);
      const dir = str(p.sortDir);
      return by ? (dir ? `${by} ${dir}` : by) : detail(payload);
    }
    case 'page':
      return isBlank(p.page) ? detail(payload) : formatValue(p.page);
    case 'search':
      return isBlank(p.query) ? detail(payload) : formatValue(p.query);
    case 'dismiss': {
      // { value?, label?, index?, all?, auto? }. The label, else the value, is
      // the identity (a chip's `index` adds nothing to its value). `auto: true`
      // marks a dismiss the RUNTIME initiated — a Toast timing out
      // (core/intrinsic.ts) — not a user gesture; it is kept, because the
      // model reads the state, but flagged so it cannot be
      // mistaken for a click.
      if (p.all === true) return 'all';
      const head = str(p.label) ?? (isBlank(p.value) ? null : formatValue(p.value));
      const auto = p.auto === true ? `${humanizeKey('auto')}: ${formatValue(true)}` : '';
      return head === null ? detail(payload) : join(head, auto);
    }
    case 'commit': {
      // A press payload carries the control's `label`; that is the control's
      // NAME, not what the user entered, so it is left out — the same rule the
      // receipt applies to the firing control (core/receipt.ts
      // paramsWithoutTitleLabel). A bare press (see isBarePress) gets no line.
      // What remains: a Form's `fields`, a row action's `action` + `row` (+ its
      // `rows` snapshot, counted), a PromptInput's `value`.
      const withoutLabel = rest(p, 'label');
      return isBarePress(withoutLabel) ? '' : detail(withoutLabel);
    }
    default:
      return detail(payload);
  }
}

/**
 * The transform. Returns plain text: the heading, then one bullet per recorded
 * gesture, then one per bound value — or `''` when there is nothing to say
 * (never the heading alone).
 */
export function threadState(state: unknown, options: ThreadStateOptions = {}): string {
  try {
    return threadStateUnguarded(state, options);
  } catch {
    // Content can be anything a host builds (a getter that throws, a hostile
    // Proxy). The send path must not die on it; '' is the honest fallback —
    // nothing was said, nothing was invented.
    return '';
  }
}

function threadStateUnguarded(state: unknown, options: ThreadStateOptions): string {
  if (!isRec(state)) return '';
  const cap = options.maxLines ?? 12;
  // A cap of 0 asks for no bullets: nothing to say, so nothing is said — the
  // heading over a lone "+N more" is the shape this module promises never to
  // print.
  if (typeof cap === 'number' && cap <= 0) return '';
  const bullet = options.bullet ?? '-';
  const lines: string[] = [];

  // 1 — the gestures, in stored order: /_ui/<elementId>/<verb> = payload.
  const ui = state._ui;
  if (isRec(ui)) {
    const ex = options.exclude;
    for (const [elementId, verbs] of Object.entries(ui)) {
      if (!isRec(verbs)) continue;
      const excludeAll = ex?.elementId !== undefined && ex.elementId === elementId && ex.verb === undefined;
      if (excludeAll) continue;
      for (const [verb, payload] of Object.entries(verbs)) {
        // `__rows` is the row-scoped mirror (core/intrinsic.ts take()) — a
        // duplicate of the shared slot keyed by repeat index, written alongside
        // it, never instead of it. Any `__`-prefixed sibling is runtime
        // bookkeeping of the same kind and is not a verb.
        if (verb.startsWith('__')) continue;
        if (ex?.elementId !== undefined && ex.elementId === elementId && ex.verb === verb) continue;
        // Blank → the mirror recorded nothing worth a line. A `commit` that is
        // only a press is another control's NAME — the agent already received
        // it as a message of its own when it fired (see isBarePress).
        if (isBlank(payload)) continue;
        const detailText = gestureDetail(verb, payload, elementId);
        if (detailText === '') continue;
        lines.push(`${bullet} ${humanizeKey(elementId)} · ${verb}: ${detailText}`);
      }
    }
  }

  // 2 — the bound values: every top-level key but `_ui`, blanks dropped
  // (`false` and `0` are values — see isBlank), record arrays counted at any
  // depth (see detail).
  for (const [key, value] of Object.entries(state)) {
    if (key === '_ui' || isBlank(value)) continue;
    lines.push(`${bullet} ${humanizeKey(key)}: ${detail(value)}`);
  }

  if (lines.length === 0) return '';
  const shown = typeof cap === 'number' ? lines.slice(0, cap) : lines;
  const out = [options.heading ?? 'Also recorded', ...shown];
  const hidden = lines.length - shown.length;
  if (hidden > 0) out.push(`${bullet} +${hidden} more`);
  return out.join('\n');
}
