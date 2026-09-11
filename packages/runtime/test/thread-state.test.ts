import { describe, expect, it } from 'vitest';
import { threadState } from '../src/core/thread-state.js';

/**
 * The state half of the text path (the agent reads
 * name + params + STATE). Like thread-text.test.ts these are mostly about
 * keeping the transform dumb about language: element ids are humanized, card
 * titles / labels / values are printed EXACTLY as stored, and nothing is ever
 * thrown at content. Payload shapes are the renderer's own emit sites
 * (core/intrinsic.ts IntrinsicEventPayloads).
 */
const H = 'Also recorded';

describe('threadState — one bullet per gesture, per verb', () => {
  it('move (kanban): the card VERBATIM, then fromColumn → toColumn', () => {
    const state = { _ui: { board: { move: { card: 'Fix login bug', fromColumn: 'To do', toColumn: 'In progress', fromIndex: 0, toIndex: 2 } } } };
    expect(threadState(state)).toBe(`${H}\n- Board · move: Fix login bug, To do → In progress`);
  });

  it('move (slot-mode card): the card title wins over the id; both columns when named', () => {
    const move = { id: 'T-8841', card: '#8841 Birria Bros', dir: 'right', fromColumn: 'Fired', toColumn: 'Plating', assignee: 'Marco Vela', meta: '11 min' };
    // (`Card t8841`: humanizeName lowercases a mixed letter+digit word — its rule, pinned in thread-text.test.ts)
    expect(threadState({ _ui: { cardT8841: { move } } })).toBe(`${H}\n- Card t8841 · move: #8841 Birria Bros, Fired → Plating`);
    // no neighbour column known → the direction; no title → the id
    expect(threadState({ _ui: { cardT8841: { move: { id: 'T-8841', dir: 'left', fromColumn: 'Fired', toColumn: null } } } }))
      .toBe(`${H}\n- Card t8841 · move: T-8841 → left`);
  });

  it('move (splitpane / resizable): splitPercent · width×height', () => {
    expect(threadState({ _ui: { pane: { move: { splitPercent: 62.5 } } } })).toBe(`${H}\n- Pane · move: 62.5%`);
    expect(threadState({ _ui: { sidebar: { move: { width: 1280, height: 720, axis: 'x' } } } }))
      .toBe(`${H}\n- Sidebar · move: 1,280×720`);
  });

  it('move with none of those keys falls through to the formatted payload', () => {
    expect(threadState({ _ui: { cal: { move: { id: 'ev1', start: '09:00', end: '10:00' } } } }))
      .toBe(`${H}\n- Cal · move: ID: ev1, Start: 09:00, End: 10:00`);
  });

  it('change: the humanized field name then the value — not repeated when the name IS the element id', () => {
    expect(threadState({ _ui: { filters: { change: { value: 'EU', name: 'region' } } } })).toBe(`${H}\n- Filters · change: Region: EU`);
    expect(threadState({ _ui: { region: { change: { value: 'EU', name: 'region' } } } })).toBe(`${H}\n- Region · change: EU`);
    expect(threadState({ _ui: { qty: { change: { value: 0, name: null } } } })).toBe(`${H}\n- Qty · change: 0`);
  });

  it('change without a `value` key prints the whole payload (a card open, a column collapse)', () => {
    expect(threadState({ _ui: { board: { change: { card: 'Usage dashboard', column: 'In progress', index: 1 } } } }))
      .toBe(`${H}\n- Board · change: Card: Usage dashboard, Column: In progress, Index: 1`);
    expect(threadState({ _ui: { col2: { change: { column: 'Done', collapsed: true } } } }))
      .toBe(`${H}\n- Col2 · change: Column: Done, Collapsed: Yes`);
  });

  /**
   * THE IDENTITY HALF. intrinsic.ts documents `change` as
   * `{ value?, name?, … } + component identity` — the first cut printed
   * `name: value` and dropped everything else, so a PermissionMatrix cell read
   * "Matrix · change: Yes" with no role and no capability. The head stays; the
   * rest of the payload follows it. Shapes are the registry's own emit sites.
   */
  it('change keeps the identity keys after the head — which cell, which item, which country', () => {
    // permission-matrix.tsx onChange
    expect(threadState({ _ui: { matrix: { change: { role: 'admin', capability: 'export', value: true, previous: false, rowIndex: 1, columnIndex: 2 } } } }))
      .toBe(`${H}\n- Matrix · change: Yes, Role: admin, Capability: export, Previous: No, Row index: 1, Column index: 2`);
    // editable-spreadsheet-grid.tsx onChange — the column key is the name, the row survives
    expect(threadState({ _ui: { sheet: { change: { name: 'amount', value: 42, rowIndex: 3, columnIndex: 1, previous: 40 } } } }))
      .toBe(`${H}\n- Sheet · change: Amount: 42, Row index: 3, Column index: 1, Previous: 40`);
    // inputs-choice.tsx ChipGroup toggle — the full set, then which chip moved
    expect(threadState({ _ui: { tags: { change: { value: ['a', 'b'], toggled: 'b', checked: true } } } }))
      .toBe(`${H}\n- Tags · change: a, b, Toggled: b, Checked: Yes`);
    // inputs-specialized.tsx PhoneInput country pick
    expect(threadState({ _ui: { phone: { change: { value: '+44 20 7946 0000', country: 'GB' } } } }))
      .toBe(`${H}\n- Phone · change: +44 20 7946 0000, Country: GB`);
  });

  it('change with a BLANK value is a clear: no em-dash, no bullet unless the payload says what was cleared', () => {
    // forms-extended.tsx SearchField × → { value: '', name } · inputs-numeric.tsx emptied → { value: null }
    expect(threadState({ _ui: { q: { change: { value: '', name: 'q' } } } })).toBe('');
    expect(threadState({ _ui: { search: { change: { value: '', name: 'q' } } } })).toBe('');
    expect(threadState({ _ui: { qty: { change: { value: null } } } })).toBe('');
    // a cleared spreadsheet cell still names its column and row — the name rides as a plain key
    expect(threadState({ _ui: { sheet: { change: { name: 'amount', value: '', rowIndex: 3, columnIndex: 1, previous: 42 } } } }))
      .toBe(`${H}\n- Sheet · change: Name: amount, Row index: 3, Column index: 1, Previous: 42`);
  });

  it('select: label ?? value verbatim, plus checked / selected when present, then the identity keys', () => {
    expect(threadState({ _ui: { plan: { select: { value: 'pro', label: 'Pro (annual)' } } } })).toBe(`${H}\n- Plan · select: Pro (annual)`);
    expect(threadState({ _ui: { plan: { select: { value: 'pro', label: null } } } })).toBe(`${H}\n- Plan · select: pro`);
    expect(threadState({ _ui: { rows: { select: { id: 'r2', label: 'Contoso Ltd', checked: true, selected: ['r1', 'r2'] } } } }))
      .toBe(`${H}\n- Rows · select: Contoso Ltd, Checked: Yes, Selected: r1, r2, ID: r2`);
    // an unchecked row is a different gesture from a checked one — `false` is a value
    expect(threadState({ _ui: { rows: { select: { label: 'Contoso Ltd', checked: false } } } }))
      .toBe(`${H}\n- Rows · select: Contoso Ltd, Checked: No`);
    // neither label nor value → the payload
    expect(threadState({ _ui: { doc: { select: { id: 'b3', index: 2, type: 'heading' } } } }))
      .toBe(`${H}\n- Doc · select: ID: b3, Index: 2, Type: heading`);
  });

  it('select (DataTable row / FloorPlan): the row that was toggled survives; the selected-rows snapshot is counted', () => {
    // data-table.tsx row-select: { id, index, checked, row, selected, selectedRows } — no label; the first cut
    // printed "Checked: Yes, Selected: r1, r2" and nothing that identified the row
    const rows = [{ ref: 'TXN-4821', amount: 120 }, { ref: 'TXN-4822', amount: 480 }];
    expect(threadState({ _ui: { table: { select: { id: 'r2', index: 1, checked: true, row: rows[1], selected: ['r1', 'r2'], selectedRows: rows } } } }))
      .toBe(`${H}\n- Table · select: Checked: Yes, Selected: r1, r2, ID: r2, Index: 1, Row: Ref: TXN-4822, Amount: 480, Selected rows: 2 items`);
    // >4 selected: the set is counted, the id still says which row
    expect(threadState({ _ui: { table: { select: { id: 'r5', index: 4, checked: true, selected: ['r1', 'r2', 'r3', 'r4', 'r5'] } } } }))
      .toBe(`${H}\n- Table · select: Checked: Yes, Selected: 5 items, ID: r5, Index: 4`);
    // floor-plan.tsx: `selected` is a boolean here, `selection` the set
    expect(threadState({ _ui: { floor: { select: { id: 't12', selected: true, selection: ['t12'], count: 1, total: 240, currency: 'GBP', totalLabel: '£240' } } } }))
      .toBe(`${H}\n- Floor · select: Selected: Yes, ID: t12, Selection: t12, Count: 1, Total: 240, Currency: GBP, Total label: £240`);
  });

  it('sort: sortBy sortDir', () => {
    expect(threadState({ _ui: { ledger: { sort: { sortBy: 'amount', sortDir: 'desc' } } } })).toBe(`${H}\n- Ledger · sort: amount desc`);
  });

  it('page: the page number', () => {
    expect(threadState({ _ui: { ledger: { page: { page: 3 } } } })).toBe(`${H}\n- Ledger · page: 3`);
  });

  it('search: the query verbatim — no trimming, no casing', () => {
    expect(threadState({ _ui: { search: { search: { query: 'Nordwind GmbH ' } } } })).toBe(`${H}\n- Search · search: Nordwind GmbH `);
  });

  it('dismiss: label ?? value, or "all"', () => {
    expect(threadState({ _ui: { toast1: { dismiss: { label: 'Saved' } } } })).toBe(`${H}\n- Toast1 · dismiss: Saved`);
    expect(threadState({ _ui: { chips: { dismiss: { value: 'eu', index: 2 } } } })).toBe(`${H}\n- Chips · dismiss: eu`);
    expect(threadState({ _ui: { chips: { dismiss: { all: true } } } })).toBe(`${H}\n- Chips · dismiss: all`);
    expect(threadState({ _ui: { toast2: { dismiss: { index: 0, auto: true } } } })).toBe(`${H}\n- Toast2 · dismiss: Index: 0, Auto: Yes`);
  });

  it('dismiss with auto:true (misc-extended.tsx Toast timeout) is flagged — the runtime did it, not the user', () => {
    // intrinsic.ts: `auto` marks a dismiss the RUNTIME initiated. The first cut printed it as a click.
    expect(threadState({ _ui: { toast: { dismiss: { label: 'Saved', auto: true } } } })).toBe(`${H}\n- Toast · dismiss: Saved, Auto: Yes`);
    expect(threadState({ _ui: { toast: { dismiss: { label: null, auto: true } } } })).toBe(`${H}\n- Toast · dismiss: Auto: Yes`);
  });

  it('commit: the payload minus the control\'s own label (a Form\'s fields, a row action\'s row)', () => {
    expect(threadState({ _ui: { form: { commit: { fields: { email: 'a@b.c', plan: 'pro' } } } } }))
      .toBe(`${H}\n- Form · commit: Fields: Email: a@b.c, Plan: pro`);
    expect(threadState({ _ui: { table: { commit: { action: 'hold', index: 1, row: { ref: 'TXN-4822', amount: 480 }, label: 'Hold' } } } }))
      .toBe(`${H}\n- Table · commit: Action: hold, Index: 1, Row: Ref: TXN-4822, Amount: 480`);
    // a bare `{ label }` press is another control's NAME — it was its own message when it fired
    expect(threadState({ _ui: { other: { commit: { label: 'Refresh' } } } })).toBe('');
  });

  it('commit: a press whose residue is only WHERE the control sat (index / href / external) is a bare press too', () => {
    // marketing-hero.tsx CTA · actions.tsx Link · data-longtail.tsx / feedback-extended.tsx row action — all their own message when fired;
    // "Hero · commit: Index: 0, Href: /book" is noise with no subject
    expect(threadState({ _ui: { hero: { commit: { label: 'Book now', index: 0, href: '/book' } } } })).toBe('');
    expect(threadState({ _ui: { link: { commit: { href: 'https://x.y', label: 'Docs', external: true } } } })).toBe('');
    expect(threadState({ _ui: { list: { commit: { label: 'Archive', index: 3 } } } })).toBe('');
    // a content key keeps it: time-clock.tsx lap { index, elapsedMs }
    expect(threadState({ _ui: { clock: { commit: { index: 2, elapsedMs: 61250 } } } })).toBe(`${H}\n- Clock · commit: Index: 2, Elapsed ms: 61,250`);
  });

  /**
   * COUNT, DON'T DUMP — AT EVERY DEPTH. The first cut counted
   * only a top-level bound array; a record array nested in a payload or inside
   * a bound object went through formatValue, which inlines ≤4 elements in full.
   * data-table.tsx:732 stashes `rows: <the whole table>` in every row-action
   * commit, so the next press of any other control printed every row's every
   * field for a ≤4-row table.
   */
  it('commit (DataTable row action): the row inline, the `rows` snapshot COUNTED', () => {
    const rows = [{ ref: 'TXN-4821', amount: 120 }, { ref: 'TXN-4822', amount: 480 }, { ref: 'TXN-4823', amount: 75 }];
    expect(threadState({ _ui: { table: { commit: { action: 'hold', index: 1, row: rows[1], rows } } } }))
      .toBe(`${H}\n- Table · commit: Action: hold, Index: 1, Row: Ref: TXN-4822, Amount: 480, Rows: 3 items`);
    // bulk action { action, selectedRows } · spreadsheet save { reason, rowCount, changes, rows: grid } · scheduler { events, count }
    expect(threadState({ _ui: { table: { commit: { action: 'approve', selectedRows: rows.slice(0, 2) } } } }))
      .toBe(`${H}\n- Table · commit: Action: approve, Selected rows: 2 items`);
    expect(threadState({ _ui: { sheet: { commit: { reason: 'save', rowCount: 2, changes: 1, rows: [[1, 'a'], [2, 'b']] } } } }))
      .toBe(`${H}\n- Sheet · commit: Reason: save, Row count: 2, Changes: 1, Rows: 2 items`);
    expect(threadState({ _ui: { cal: { commit: { events: [{ id: 'e1', start: 9 }], count: 1 } } } }))
      .toBe(`${H}\n- Cal · commit: Events: 1 item, Count: 1`);
  });

  it('an unknown verb prints the formatted payload', () => {
    expect(threadState({ _ui: { widget: { poke: { times: 3 } } } })).toBe(`${H}\n- Widget · poke: Times: 3`);
  });

  it('a payload that is not an object still prints (formatValue) — never a throw', () => {
    expect(threadState({ _ui: { x: { change: 'raw' } } })).toBe(`${H}\n- X · change: raw`);
    expect(threadState({ _ui: { x: { change: 7 } } })).toBe(`${H}\n- X · change: 7`);
  });
});

describe('threadState — what is left out', () => {
  const state = {
    region: 'EU',
    _ui: {
      region: { change: { value: 'EU', name: 'region' } },
      track: { commit: { label: 'Track price' }, select: { value: 'weekly' } },
    },
  };

  it('EXCLUDES the firing control\'s own mirror entry — it IS the action', () => {
    expect(threadState(state, { exclude: { elementId: 'track', verb: 'commit' } }))
      .toBe(`${H}\n- Region · change: EU\n- Track · select: weekly\n- Region: EU`);
  });

  it('excludes the element\'s WHOLE entry when the verb is unknown (an action bound to more than one event)', () => {
    expect(threadState(state, { exclude: { elementId: 'track' } })).toBe(`${H}\n- Region · change: EU\n- Region: EU`);
  });

  it('excludes nothing without an elementId — a programmatic dispatch owns no mirror', () => {
    expect(threadState(state, { exclude: { verb: 'select' } })).toBe(threadState(state));
    expect(threadState(state, { exclude: {} })).toBe(threadState(state));
  });

  it('skips the row-scoped __rows sub-map entirely (a duplicate of the shared slot)', () => {
    const s = { _ui: { table: { commit: { action: 'hold', index: 1 }, __rows: { 1: { commit: { action: 'hold', index: 1 } } } } } };
    expect(threadState(s)).toBe(`${H}\n- Table · commit: Action: hold, Index: 1`);
    expect(threadState(s).split('\n')).toHaveLength(2);
  });

  it('drops blank payloads and blank bound values; keeps false and 0 (the falsy trap)', () => {
    const s = {
      note: '', tags: [], meta: {}, spaces: '   ', gone: null,
      confirmed: false, retries: 0,
      _ui: { a: { change: {} }, b: { select: null }, c: { search: { query: '' } }, d: { change: { value: false, name: 'opt' } } },
    };
    // `c`'s payload is not blank as an object but every field in it is — formatValue
    // prints nothing for it, and a gesture with nothing to print gets no bullet
    expect(threadState(s)).toBe(`${H}\n- D · change: Opt: No\n- Confirmed: No\n- Retries: 0`);
  });

  it('skips a _ui entry whose verbs map is not an object', () => {
    expect(threadState({ _ui: { junk: 'x', board: { move: { card: 'A', fromColumn: 'B', toColumn: 'C' } } } }))
      .toBe(`${H}\n- Board · move: A, B → C`);
  });
});

describe('threadState — bound values', () => {
  it('lists every top-level key but _ui, humanized, after the gestures, in stored order', () => {
    const state = { currentPriceGbp: 149, region: 'EU', _ui: { region: { change: { value: 'EU', name: 'region' } } }, durationDays: 14 };
    expect(threadState(state)).toBe(`${H}\n- Region · change: EU\n- Current price GBP: 149\n- Region: EU\n- Duration days: 14`);
  });

  it('COUNTS an array of records — a 3-lane board is "3 items", not a dump of every card', () => {
    const board = [
      { title: 'To do', cards: [{ title: 'Write release notes' }] },
      { title: 'In progress', cards: [{ title: 'Usage dashboard' }, { title: 'Fix login bug' }] },
      { title: 'Done', cards: [] },
    ];
    expect(threadState({ board })).toBe(`${H}\n- Board: 3 items`);
    expect(threadState({ rows: [{ ref: 'TXN-1' }] })).toBe(`${H}\n- Rows: 1 item`);
  });

  it('an object and a short scalar array keep formatValue\'s rules', () => {
    expect(threadState({ filters: { region: 'EU', status: 'open' } })).toBe(`${H}\n- Filters: Region: EU, Status: open`);
    expect(threadState({ tags: ['a', 'b'] })).toBe(`${H}\n- Tags: a, b`);
    expect(threadState({ tags: [1, 2, 3, 4, 5] })).toBe(`${H}\n- Tags: 5 items`);
  });

  it('COUNTS a record array nested inside a bound object too — the rule holds at every depth', () => {
    expect(threadState({ filters: { tags: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }], region: 'EU' } }))
      .toBe(`${H}\n- Filters: Tags: 2 items, Region: EU`);
    expect(threadState({ order: { lines: [{ sku: 'A1' }], note: 'rush' } })).toBe(`${H}\n- Order: Lines: 1 item, Note: rush`);
  });

  it('bound values alone (no _ui) still produce the block', () => {
    expect(threadState({ email: 'a@b.c' })).toBe(`${H}\n- Email: a@b.c`);
  });
});

describe('threadState — options', () => {
  const many = { _ui: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`f${i}`, { change: { value: i, name: null } }])) };

  it('caps at 12 lines by default, then "+N more"', () => {
    const out = threadState(many).split('\n');
    expect(out).toHaveLength(14);                        // heading + 12 + the tail
    expect(out[1]).toBe('- F0 · change: 0');
    expect(out[12]).toBe('- F11 · change: 11');
    expect(out[13]).toBe('- +3 more');
  });

  it('counts only the lines it will SHOW when capping — a blank never consumes a slot', () => {
    const s = { a: 1, blank: '', b: 2, c: 3 };
    expect(threadState(s, { maxLines: 2 })).toBe(`${H}\n- A: 1\n- B: 2\n- +1 more`);
  });

  it('takes a custom bullet and heading', () => {
    expect(threadState({ region: 'EU' }, { bullet: '•', heading: 'Zustand' })).toBe('Zustand\n• Region: EU');
  });

  it('maxLines: 0 is nothing to say — never the heading over a lone "+N more"', () => {
    // the first cut printed "Also recorded\n- +2 more" here
    expect(threadState({ a: 1, b: 2 }, { maxLines: 0 })).toBe('');
    expect(threadState(many, { maxLines: -1 })).toBe('');
    expect(threadState({ a: 1, b: 2 }, { maxLines: 1 })).toBe(`${H}\n- A: 1\n- +1 more`);
  });
});

describe('threadState — structure, not English', () => {
  it('carries a German element id, name and value through untouched', () => {
    const state = {
      betragEur: 18400,
      _ui: { verlängerungAblehnen: { change: { value: 'Nordwind GmbH', name: 'absender' } } },
    };
    expect(threadState(state)).toBe(`${H}\n- Verlängerung ablehnen · change: Absender: Nordwind GmbH\n- Betrag EUR: 18,400`);
  });

  it('leaves a Japanese element id, label and card title exactly as stored — there is no case to change', () => {
    const state = {
      _ui: {
        注文リスト: { select: { value: 'o-2', label: '注文 #2 を確認' } },
        ボード: { move: { card: '記録しています', fromColumn: '未着手', toColumn: '進行中' } },
      },
    };
    expect(threadState(state)).toBe(`${H}\n- 注文リスト · select: 注文 #2 を確認\n- ボード · move: 記録しています, 未着手 → 進行中`);
  });
});

describe('threadState — never throws, never the heading alone', () => {
  it('returns "" for undefined / null / a primitive / an array', () => {
    for (const v of [undefined, null, 0, 1, '', 'state', true, [], [{ _ui: {} }], Symbol('s'), 10n]) {
      expect(threadState(v)).toBe('');
    }
  });

  it('returns "" when there is nothing to say — no heading on its own', () => {
    expect(threadState({})).toBe('');
    expect(threadState({ _ui: {} })).toBe('');
    expect(threadState({ _ui: { save: { commit: { label: 'Save' } } } }, { exclude: { elementId: 'save', verb: 'commit' } })).toBe('');
    expect(threadState({ note: '', _ui: { a: {} } })).toBe('');
  });

  it('formats a cyclic payload and a cyclic bound value without throwing', () => {
    const circ: Record<string, unknown> = { id: 1 };
    circ.self = circ;
    expect(() => threadState({ loop: circ, _ui: { w: { poke: circ } } })).not.toThrow();
    expect(threadState({ loop: circ, _ui: { w: { poke: circ } } }))
      .toBe(`${H}\n- W · poke: ID: 1, Self: [circular]\n- Loop: ID: 1, Self: [circular]`);
  });

  it('survives a getter that throws — the send path gets "" rather than an exception', () => {
    const hostile = { get _ui(): unknown { throw new Error('nope'); } };
    expect(() => threadState(hostile)).not.toThrow();
    expect(threadState(hostile)).toBe('');
  });
});
