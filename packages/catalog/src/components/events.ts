/**
 * Canonical event taxonomy — the single bounded vocabulary of interaction events
 * the model emits and an agent host handles. It collapses the renderer's
 * ad-hoc event names into these 8 verbs.
 *
 * WHY collapse: the event KEY is the contract between a spec's `on:{<event>:…}`
 * wiring and the renderer that listens for it — a mismatch silently no-ops. A
 * small, synonym-free set is what a generator can reliably emit correctly
 * (one rule per intent, not per-component trivia) and what an agent host can
 * switch over as a closed contract. The WHICH-item specificity that the old
 * names (selectRow vs selectDate, the six "activate" synonyms) tried to carry
 * lives in the action `params` / a bound discriminator, NOT in the verb.
 *
 * This module is pure data + tiny helpers (no Zod, no React) so it is importable
 * from both `@frayme/catalog` (schema authoring, the gate) and the runtime (the
 * FraymeRenderer ingestion hook + the conformance test).
 */

/** The 8 canonical interaction verbs. The closed model-facing event vocabulary. */
export const CANONICAL_EVENTS = [
  'commit', // primary action / CTA — the user activated the main affordance
  'select', // pick an item from a set (row, date, option, menu item)
  'change', // a value or disclosure (open/expanded) state changed
  'dismiss', // close / discard / remove / clear
  'search', // query-text input for filtering
  'sort', // request a sort column/direction
  'page', // pagination change
  'move', // reposition (reorder, drag, resize a divider)
] as const;

export type CanonicalEvent = (typeof CANONICAL_EVENTS)[number];

/**
 * Legacy/native event name → canonical verb. The source of truth for the
 * collapse. Identity rows are included so a canonical name round-trips
 * (`canonicalize('commit') === 'commit'`).
 *
 * `focus`/`blur`/`input` resolve to `change` HERE (so a historical `on:{focus}`
 * still binds), but they are deliberately EXCLUDED from any component's
 * advertised `events[]` — they are browser lifecycle, not agent-actionable.
 */
export const EVENT_ALIASES = {
  // commit — the user activated the primary affordance
  press: 'commit',
  submit: 'commit',
  action: 'commit',
  confirm: 'commit',
  complete: 'commit',
  choose: 'commit',
  commit: 'commit',
  // select — pick an item from a set
  select: 'select',
  selectRow: 'select',
  selectDate: 'select',
  // change — value / disclosure changed
  change: 'change',
  toggle: 'change',
  open: 'change',
  input: 'change',
  focus: 'change',
  blur: 'change',
  // dismiss — close / discard
  dismiss: 'dismiss',
  close: 'dismiss',
  remove: 'dismiss',
  clear: 'dismiss',
  deny: 'dismiss',
  // 1:1 verbs
  search: 'search',
  sort: 'sort',
  pageChange: 'page',
  page: 'page',
  move: 'move',
  resize: 'move',
} as const satisfies Record<string, CanonicalEvent>;

export type LegacyEvent = keyof typeof EVENT_ALIASES;

/* ── EVENT_CONTRACT — the verb semantics + intrinsic payloads as DATA ─────────
 *
 * The single machine-readable source for what each verb MEANS and what params
 * the runtime intrinsically attaches when it fires. Everything that teaches or
 * consumes the loop reads THIS: `prompt()` embeds it, the tool JSON embeds it
 * so a host agent knows what comes back, and the
 * runtime's `IntrinsicEventPayloads` type is conformance-tested against it so
 * the documented payload can never drift from the implemented one.
 *
 * Payload entries document the INTRINSIC floor: the runtime merges these under
 * any spec-authored params (authored keys win per-key). Keys marked optional
 * appear when the interaction provides them.
 */

/** One documented key of a verb's intrinsic payload. */
export interface EventPayloadKeyDoc {
  key: string;
  type: string;
  optional: boolean;
  doc: string;
}

/** The full documented contract for one canonical verb. */
export interface EventContractEntry {
  verb: CanonicalEvent;
  description: string;
  payload: EventPayloadKeyDoc[];
}

export const EVENT_CONTRACT: Record<CanonicalEvent, EventContractEntry> = {
  commit: {
    verb: 'commit',
    description:
      'The user activated the primary affordance — a button/CTA press, Enter in an input, a form submit, a palette/menu action. The terminal "do it" signal of a surface.',
    payload: [
      { key: 'value', type: 'string', optional: true, doc: 'The committed text/value when the affordance carries one (e.g. the typed prompt on Enter).' },
      { key: 'fields', type: 'Record<string, unknown>', optional: true, doc: 'All named field values collected at submit (Form only, via FormData).' },
      { key: 'label', type: 'string', optional: true, doc: 'The visible label of the activated control — item identity for mapped buttons/actions.' },
      { key: 'name', type: 'string', optional: true, doc: 'The control’s machine name when it has one.' },
      { key: 'index', type: 'number', optional: true, doc: 'Position of the activated item when it came from a list (Fab actions, pricing plans).' },
      { key: 'control', type: 'string', optional: true, doc: 'Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach").' },
    ],
  },
  select: {
    verb: 'select',
    description:
      'The user picked an item from a set — a table row, a calendar day, an option, a tree node, a list item. Identifies WHICH item in the params, not in the verb.',
    payload: [
      { key: 'value', type: 'unknown', optional: true, doc: 'The picked item’s value (row object, ISO date, option value, node value).' },
      { key: 'label', type: 'string', optional: true, doc: 'The picked item’s visible label when distinct from value.' },
      { key: 'id', type: 'string | number', optional: true, doc: 'The picked item’s id when the data carries one.' },
      { key: 'index', type: 'number', optional: true, doc: 'The picked item’s position in the rendered set.' },
      { key: 'selected', type: 'unknown[]', optional: true, doc: 'The FULL selection set after the pick (multi-select surfaces).' },
      { key: 'checked', type: 'boolean', optional: true, doc: 'Whether the pick turned the item on or off (checkbox-style rows).' },
    ],
  },
  change: {
    verb: 'change',
    description:
      'A value or disclosure state changed — typing, toggling, sliding, picking a date, expanding a section. The continuous "state moved" signal (commit is the terminal one).',
    payload: [
      { key: 'value', type: 'unknown', optional: true, doc: 'The new value after the change.' },
      { key: 'name', type: 'string', optional: true, doc: 'The control’s machine name when it has one.' },
    ],
  },
  dismiss: {
    verb: 'dismiss',
    description:
      'The user closed, discarded, removed or cleared something — a toast/banner close, a chip remove, a clear-all, a deny.',
    payload: [
      { key: 'value', type: 'unknown', optional: true, doc: 'The dismissed item’s value/key when it identifies one.' },
      { key: 'label', type: 'string', optional: true, doc: 'The dismissed item’s visible label.' },
      { key: 'index', type: 'number', optional: true, doc: 'The dismissed item’s position when it came from a list.' },
      { key: 'all', type: 'boolean', optional: true, doc: 'True when the interaction cleared the whole set (clear-all).' },
      { key: 'auto', type: 'boolean', optional: true, doc: 'True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture.' },
    ],
  },
  search: {
    verb: 'search',
    description: 'The user entered query text to filter or search a surface.',
    payload: [{ key: 'query', type: 'string', optional: false, doc: 'The current query text.' }],
  },
  sort: {
    verb: 'sort',
    description: 'The user requested a sort — clicking a sortable column header cycles direction.',
    payload: [
      { key: 'sortBy', type: 'string', optional: false, doc: 'The column key to sort by.' },
      { key: 'sortDir', type: "'asc' | 'desc' | 'none'", optional: false, doc: 'The requested direction after this interaction.' },
    ],
  },
  page: {
    verb: 'page',
    description:
      'The user navigated pagination — a next/prev arrow, a numbered page button, or a table footer pager.',
    payload: [{ key: 'page', type: 'number', optional: false, doc: 'The target page (1-based, clamped to range).' }],
  },
  move: {
    verb: 'move',
    description:
      'The user repositioned something — dragging a kanban card, reordering, or resizing a divider. Pointer-driven resizes emit ONCE on release with the final geometry.',
    payload: [
      { key: 'card', type: 'unknown', optional: true, doc: 'The moved card/item (kanban).' },
      { key: 'fromColumn', type: 'string', optional: true, doc: 'Source column key (kanban).' },
      { key: 'toColumn', type: 'string', optional: true, doc: 'Target column key (kanban).' },
      { key: 'fromIndex', type: 'number', optional: true, doc: 'Source position (kanban/reorder).' },
      { key: 'toIndex', type: 'number', optional: true, doc: 'Target position (kanban/reorder).' },
      { key: 'splitPercent', type: 'number', optional: true, doc: 'Final divider position (SplitPane, 0–100, on pointer-up).' },
      { key: 'width', type: 'number', optional: true, doc: 'Final width in px (Resizable, on pointer-up).' },
      { key: 'height', type: 'number', optional: true, doc: 'Final height in px (Resizable, on pointer-up).' },
      { key: 'axis', type: "'x' | 'y' | 'both'", optional: true, doc: 'Which axis the resize changed (Resizable).' },
    ],
  },
};

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_EVENTS);

/** True if `name` is already one of the 8 canonical verbs. */
export function isCanonical(name: string): name is CanonicalEvent {
  return CANONICAL_SET.has(name);
}

/**
 * Map any legacy/native or canonical event name to its canonical verb. Returns
 * `undefined` for an unrecognized name — callers (the ingestion hook, the
 * conformance test) decide whether to pass it through unchanged or flag it.
 */
export function canonicalize(name: string): CanonicalEvent | undefined {
  return (EVENT_ALIASES as Record<string, CanonicalEvent>)[name];
}

/* ── COMPONENT-SCOPED event vocabulary ───────────────────────────────────────
 *
 * Two things the global 8-verb collapse cannot express, kept deliberately OUT of
 * CANONICAL_EVENTS so the agent-facing contract stays exactly 8 verbs: the
 * prompt, the tool JSON, and `manifest.events: CanonicalEvent[]` are all
 * generated from that set, and widening it would change the served prompt —
 * i.e. break train↔serve parity with the model currently in production.
 *
 * Both maps are keyed by component TYPE and are read by exactly two callers:
 * `validateActionWiring` (so the spelling validates) and the runtime's
 * `normalizeSpecProps` (so the spelling actually binds). One source of truth,
 * the same way `EVENT_ALIASES` already serves both sides.
 */

/**
 * ALIAS — a different spelling of a verb the component ALREADY emits. The
 * runtime rewrites the key to the target verb before json-render binds, so the
 * existing renderer fires it with no renderer change at all.
 *
 * `commit` on the date pickers: they emit `select`, but `commit` is the verb the
 * catalog teaches everywhere else for "the user settled on a value", so models
 * reach for it and ate a rejected attempt each time.
 */
export const COMPONENT_EVENT_ALIASES: Record<string, Readonly<Record<string, CanonicalEvent>>> = {
  DatePicker: { commit: 'select' },
  DateRangePicker: { commit: 'select' },
};

/**
 * EXTRA — a distinct verb a component's renderer GENUINELY fires, splitting an
 * over-loaded canonical verb into the names the caller actually reaches for.
 * These are NOT canonical verbs and never enter `events[]`, the prompt, or the
 * tool JSON; they are accepted spellings that the renderer honours.
 *
 * `add`/`update` on DataTable: the table has always supported add-row
 * (`addable`) and inline edit (`editable`), but reported BOTH through one
 * `commit` with an `action` discriminator. The model instead writes `on.add` /
 * `on.update`, which validated as errors — so the binder dropped the wiring and
 * injected a raw stub button in its place. The renderer now fires the specific
 * verb when the author declared it and `commit` otherwise, so exactly one of
 * them fires per interaction and every existing `on.commit` table is untouched.
 */
export const COMPONENT_EXTRA_EVENTS: Record<string, readonly string[]> = {
  DataTable: ['add', 'update'],
};

/**
 * The event key a spec authored on `type` should BIND under: a component-scoped
 * alias first, then the global collapse, else the key unchanged (which is how an
 * EXTRA verb survives to reach its renderer). Shared by the validator and the
 * runtime normalizer so the two can never diverge.
 */
export function resolveEventKey(type: string, key: string): string {
  return COMPONENT_EVENT_ALIASES[type]?.[key] ?? canonicalize(key) ?? key;
}

/** Every event spelling `type` accepts, for validation and error messages. */
export function acceptedEventKeys(type: string, declared: readonly string[]): string[] {
  return [...declared, ...(COMPONENT_EXTRA_EVENTS[type] ?? []), ...Object.keys(COMPONENT_EVENT_ALIASES[type] ?? {})];
}

/**
 * Map a legacy `events[]` array to a de-duped, order-preserved canonical array.
 * Used to author the normalized schemas and to assert in the conformance test.
 * Unrecognized names are dropped (the conformance test catches genuine drift).
 */
export function canonicalEvents(legacy: readonly string[]): CanonicalEvent[] {
  const out: CanonicalEvent[] = [];
  for (const name of legacy) {
    const verb = canonicalize(name);
    if (verb && !out.includes(verb)) out.push(verb);
  }
  return out;
}

/**
 * Inverse of `EVENT_ALIASES`: each canonical verb → the legacy/native names that
 * collapse into it. Used by the conformance test. (The runtime ingestion hook
 * canonicalizes inward and does not need this.)
 */
export const CANONICAL_TO_LEGACY: Record<CanonicalEvent, readonly string[]> = (() => {
  const out = Object.fromEntries(CANONICAL_EVENTS.map((v) => [v, [] as string[]])) as Record<
    CanonicalEvent,
    string[]
  >;
  for (const [legacy, verb] of Object.entries(EVENT_ALIASES)) out[verb].push(legacy);
  return out;
})();
