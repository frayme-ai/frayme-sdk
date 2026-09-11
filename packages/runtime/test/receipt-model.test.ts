/**
 * THE RECEIPT MODEL (core/receipt.ts) — the pure content of the thread card.
 *
 * The card shows the control's NAME (its label,
 * VERBATIM — never re-cased; the fallback alone is derived), the action's
 * DESCRIPTION (the host's words, or no line at all — never the action name
 * again), and a human-readable TABLE of the params. State is not on the card.
 *
 * As with thread-text.test.ts, the negatives are the point: every "improvement"
 * someone will be tempted to add — title-case the label, echo the name as a
 * description, drop a `false` — breaks a large share of real specs or the contract.
 */
import { describe, expect, it } from 'vitest';
import { paramsWithoutTitleLabel, receiptModel, titleLabel } from '../src/core/receipt.js';
import { resolveActionDescription } from '../src/core/action-enrich.js';

describe('title — the label VERBATIM, else the humanized action name', () => {
  it('uses event.label exactly as supplied', () => {
    expect(receiptModel({ action: 'trackPrice', params: {}, label: 'Track price' }).title).toBe('Track price');
  });

  it('does NOT re-case a German label — nouns are capitalised mid-sentence', () => {
    const label = 'Auf die Warteliste setzen';
    expect(receiptModel({ action: 'aufDieWartelisteSetzen', params: {}, label }).title).toBe(label);
  });

  it('does NOT touch a Japanese label — there is no case to touch', () => {
    const label = '選考枠を押さえる';
    expect(receiptModel({ action: 'reserveSlot', params: {}, label }).title).toBe(label);
  });

  it('does NOT title-case or trim a lowercase / padded label either', () => {
    expect(receiptModel({ action: 'approve', params: {}, label: 'approve refund' }).title).toBe('approve refund');
    expect(receiptModel({ action: 'approve', params: {}, label: ' Approve ' }).title).toBe(' Approve ');
  });

  /**
   * A malformed event with no `action` is the ONE way to an empty title. It is
   * not padded with an invented word (the card is structure, not English) and it
   * does not throw — the DOM test pins that the card then carries no accessible
   * name rather than an empty one.
   */
  it('is empty — and nothing else — for a malformed event with no action', () => {
    const m = receiptModel({} as never);
    expect(m.title).toBe('');
    expect(m.rows).toEqual([]);
    expect(m).not.toHaveProperty('description');
  });

  it('falls back to humanizeName(action) when there is no label', () => {
    expect(receiptModel({ action: 'trackPrice', params: {} }).title).toBe('Track price');
    expect(receiptModel({ action: 'verlängerungAblehnen', params: {} }).title).toBe('Verlängerung ablehnen');
  });

  it('treats a blank label as no label', () => {
    expect(receiptModel({ action: 'trackPrice', params: {}, label: '   ' }).title).toBe('Track price');
    expect(receiptModel({ action: 'trackPrice', params: {}, label: '' }).title).toBe('Track price');
  });
});

describe('description — the host\'s words or nothing; precedence contract → consumer actions map → spec.actions → omitted', () => {
  const spec = { actions: { trackPrice: { kind: 'agent', description: 'Watches a listing and alerts you on a drop.' } } };
  const SPEC_TEXT = 'Watches a listing and alerts you on a drop.';

  it('the actionContract entry wins over spec.actions', () => {
    const contract = [{ name: 'trackPrice', description: 'Contract text.' }];
    expect(resolveActionDescription(contract, undefined, spec, 'trackPrice')).toBe('Contract text.');
  });

  it('falls back to spec.actions[name].description when the contract has no entry, or an entry with no description', () => {
    expect(resolveActionDescription([], undefined, spec, 'trackPrice')).toBe(SPEC_TEXT);
    expect(resolveActionDescription(undefined, undefined, spec, 'trackPrice')).toBe(SPEC_TEXT);
    expect(resolveActionDescription([{ name: 'trackPrice' }], undefined, spec, 'trackPrice')).toBe(SPEC_TEXT);
    expect(resolveActionDescription([{ name: 'trackPrice', description: '  ' }], undefined, spec, 'trackPrice')).toBe(SPEC_TEXT);
  });

  /**
   * THE CONSUMER MAP IS A SOURCE. `description?` sits on every
   * spec-authorable kind — the value type of the consumer's `actions` map too —
   * and a host that routes through a map and writes it there must not be handed
   * the server-stamped copy instead. It sits BELOW the contract (the host's
   * declaration to compose) and ABOVE the spec (the stamped copy of it).
   */
  it('a consumer `actions` map entry\'s description beats spec.actions and loses to the contract', () => {
    const map = { trackPrice: { kind: 'agent' as const, description: 'Map text.' } };
    expect(resolveActionDescription(undefined, map, spec, 'trackPrice')).toBe('Map text.');
    expect(resolveActionDescription([{ name: 'trackPrice', description: 'Contract text.' }], map, spec, 'trackPrice')).toBe('Contract text.');
    expect(resolveActionDescription([{ name: 'trackPrice' }], map, spec, 'trackPrice')).toBe('Map text.');
  });

  it('a map entry that describes nothing — a bare kind, a deny, a bare function, a blank — falls through to the spec', () => {
    expect(resolveActionDescription(undefined, { trackPrice: { kind: 'agent' } }, spec, 'trackPrice')).toBe(SPEC_TEXT);
    expect(resolveActionDescription(undefined, { trackPrice: false }, spec, 'trackPrice')).toBe(SPEC_TEXT);
    expect(resolveActionDescription(undefined, { trackPrice: () => undefined }, spec, 'trackPrice')).toBe(SPEC_TEXT);
    expect(resolveActionDescription(undefined, { trackPrice: { kind: 'agent', description: ' \n' } }, spec, 'trackPrice')).toBe(SPEC_TEXT);
    expect(resolveActionDescription(undefined, { other: { kind: 'agent', description: 'x' } }, spec, 'trackPrice')).toBe(SPEC_TEXT);
    expect(resolveActionDescription(undefined, null, spec, 'trackPrice')).toBe(SPEC_TEXT);
  });

  it('is undefined when no source has one — NEVER the action name', () => {
    expect(resolveActionDescription(undefined, undefined, { actions: { trackPrice: { kind: 'agent' } } }, 'trackPrice')).toBeUndefined();
    expect(resolveActionDescription([{ name: 'other', description: 'x' }], undefined, {}, 'trackPrice')).toBeUndefined();
    expect(resolveActionDescription(undefined, null, null, 'trackPrice')).toBeUndefined();
    expect(resolveActionDescription(undefined, undefined, { actions: 'nope' }, 'trackPrice')).toBeUndefined();
    expect(resolveActionDescription(undefined, { trackPrice: { kind: 'agent' } }, {}, 'trackPrice')).toBeUndefined();
  });

  it('trims the description (host prose keeps its trailing newline otherwise)', () => {
    expect(resolveActionDescription([{ name: 'a', description: '  Runs it.\n' }], undefined, {}, 'a')).toBe('Runs it.');
    expect(resolveActionDescription(undefined, { a: { kind: 'agent', description: ' Maps it.\n' } }, {}, 'a')).toBe('Maps it.');
  });

  it('own-property only — a name like "constructor" resolves nothing from the prototype, on the map or the spec', () => {
    expect(resolveActionDescription(undefined, undefined, { actions: {} }, 'constructor')).toBeUndefined();
    expect(resolveActionDescription(undefined, {}, {}, 'constructor')).toBeUndefined();
  });

  it('receiptModel carries a description only when the event has a non-blank one', () => {
    expect(receiptModel({ action: 'a', params: {}, description: 'Does a thing.' }).description).toBe('Does a thing.');
    expect(receiptModel({ action: 'a', params: {} })).not.toHaveProperty('description');
    expect(receiptModel({ action: 'a', params: {}, description: '  ' })).not.toHaveProperty('description');
  });
});

/**
 * THE ONE SHARED RULE. The card and the AI SDK forwarder's
 * default text both drop the `label` param that IS the pressed control's label —
 * from the same helper, so the two thread surfaces cannot disagree the way they
 * did when the forwarder printed "Label: Approve" under "Approve refund".
 */
describe('paramsWithoutTitleLabel / titleLabel — the label that became the title is not a param', () => {
  it('drops `label` only when it is strictly the non-blank event.label', () => {
    expect(paramsWithoutTitleLabel({ params: { label: 'Approve', orderId: '4821' }, label: 'Approve' })).toEqual({ orderId: '4821' });
    expect(paramsWithoutTitleLabel({ params: { label: 'Shelf label A' }, label: 'Approve' })).toEqual({ label: 'Shelf label A' });
    expect(paramsWithoutTitleLabel({ params: { label: 'Approve' } })).toEqual({ label: 'Approve' });
    expect(paramsWithoutTitleLabel({ params: { label: ' ' }, label: ' ' })).toEqual({ label: ' ' }); // blank is no title
    expect(paramsWithoutTitleLabel({ params: { orderId: '4821' }, label: 'Approve' })).toEqual({ orderId: '4821' });
  });

  it('never mutates the event\'s params, and passes them through by identity when nothing is dropped', () => {
    const params = { label: 'Approve', orderId: '4821' };
    const out = paramsWithoutTitleLabel({ params, label: 'Approve' });
    expect(params).toEqual({ label: 'Approve', orderId: '4821' });
    expect(out).not.toBe(params);
    const untouched = { orderId: '4821' };
    expect(paramsWithoutTitleLabel({ params: untouched, label: 'Approve' })).toBe(untouched);
    expect(paramsWithoutTitleLabel({ params: undefined as never })).toEqual({});
  });

  it('titleLabel is the non-blank label verbatim, else undefined', () => {
    expect(titleLabel({ label: ' Ok ' })).toBe(' Ok ');
    expect(titleLabel({ label: '   ' })).toBeUndefined();
    expect(titleLabel({})).toBeUndefined();
  });
});

describe('rows — the params, humanized keys, formatted values', () => {
  it('drops `label` when it became the title (a Button\'s payload carries its own label)', () => {
    const m = receiptModel({ action: 'approve', params: { label: 'Approve', orderId: '4821' }, label: 'Approve' });
    expect(m.title).toBe('Approve');
    expect(m.rows).toEqual([{ key: 'orderId', label: 'Order ID', value: '4821' }]);
  });

  it('KEEPS an authored `label` param that differs from the title — it is data', () => {
    const m = receiptModel({ action: 'approve', params: { label: 'Shelf label A' }, label: 'Approve' });
    expect(m.rows).toEqual([{ key: 'label', label: 'Label', value: 'Shelf label A' }]);
  });

  it('keeps `label` as a row when the title was the fallback', () => {
    const m = receiptModel({ action: 'approve', params: { label: 'Approve' } });
    expect(m.title).toBe('Approve');
    expect(m.rows).toEqual([{ key: 'label', label: 'Label', value: 'Approve' }]);
  });

  it('drops blanks — undefined, null, empty / whitespace strings, empty arrays and objects', () => {
    const m = receiptModel({
      action: 'a',
      params: { u: undefined, n: null, e: '', w: '  ', arr: [], obj: {}, kept: 'x' },
    });
    expect(m.rows.map((r) => r.key)).toEqual(['kept']);
  });

  it('KEEPS false and 0 — they are values, not blanks', () => {
    const m = receiptModel({ action: 'a', params: { confirmed: false, days: 0 } });
    expect(m.rows).toEqual([
      { key: 'confirmed', label: 'Confirmed', value: 'No' },
      { key: 'days', label: 'Days', value: '0' },
    ]);
  });

  it('humanizes keys per word with acronyms fixed, and formats numbers', () => {
    const m = receiptModel({ action: 'a', params: { currentPriceGbp: 149000, modelId: 'vantor-dualzone-55' } });
    expect(m.rows).toEqual([
      { key: 'currentPriceGbp', label: 'Current price GBP', value: '149,000' },
      { key: 'modelId', label: 'Model ID', value: 'vantor-dualzone-55' },
    ]);
  });

  it('never rewrites a string value', () => {
    const m = receiptModel({ action: 'a', params: { note: 'champion-left-save', jp: '記録しています' } });
    expect(m.rows.map((r) => r.value)).toEqual(['champion-left-save', '記録しています']);
  });

  it('flattens a nested row object to "Key: value" pairs (a DataTable row action\'s `row`)', () => {
    const m = receiptModel({
      action: 'tableAct',
      params: { action: 'approve', row: { ref: 'TXN-1', customer: 'Nordwind GmbH', amount: 1200, note: '' } },
    });
    expect(m.rows).toEqual([
      { key: 'action', label: 'Action', value: 'approve' },
      { key: 'row', label: 'Row', value: 'Ref: TXN-1, Customer: Nordwind GmbH, Amount: 1,200' },
    ]);
  });

  it('counts a long array rather than listing it (a DataTable\'s 200-record `rows`)', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: i }));
    const m = receiptModel({ action: 'tableAct', params: { rows } });
    expect(m.rows).toEqual([{ key: 'rows', label: 'Rows', value: '200 items' }]);
  });

  it('inlines a short array', () => {
    expect(receiptModel({ action: 'a', params: { tags: ['red', 'blue'] } }).rows[0]!.value).toBe('red, blue');
  });

  it('honours omitKeys', () => {
    const m = receiptModel({ action: 'a', params: { rows: [1, 2, 3], index: 1 } }, { omitKeys: ['rows'] });
    expect(m.rows.map((r) => r.key)).toEqual(['index']);
  });

  it('preserves param order', () => {
    const m = receiptModel({ action: 'a', params: { z: 1, a: 2, m: 3 } });
    expect(m.rows.map((r) => r.key)).toEqual(['z', 'a', 'm']);
  });

  it('survives a missing params object', () => {
    expect(receiptModel({ action: 'a', params: undefined as unknown as Record<string, unknown> }).rows).toEqual([]);
  });
});

describe('state — off the card unless asked for, and then untouched', () => {
  const state = { _ui: { region: { change: { value: 'apac' } } }, amount: 420 };

  it('is absent by default', () => {
    expect(receiptModel({ action: 'a', params: {}, state })).not.toHaveProperty('state');
  });

  it('is the SAME object with includeState — no copy, no reshaping', () => {
    const m = receiptModel({ action: 'a', params: {}, state }, { includeState: true });
    expect(m.state).toBe(state);
  });

  it('stays absent with includeState when the event has no state', () => {
    expect(receiptModel({ action: 'a', params: {} }, { includeState: true })).not.toHaveProperty('state');
  });
});
