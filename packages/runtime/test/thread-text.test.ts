import { describe, expect, it } from 'vitest';
import { threadText, humanizeName, humanizeKey, formatValue, isBlank } from '../src/core/thread-text.js';

/**
 * The transform is deliberately dumb about language, and these tests are mostly
 * about keeping it that way. The negatives are the point: every "improvement"
 * someone will be tempted to add later — conjugate the verb, title-case the words,
 * tidy the value — breaks a large share of real specs, which are not English.
 */
describe('humanizeName', () => {
  it('splits camelCase into sentence case', () => {
    expect(humanizeName('launchPlaybook')).toBe('Launch playbook');
    expect(humanizeName('submitLeaveRequest')).toBe('Submit leave request');
  });

  it('handles snake_case and kebab-case the same way', () => {
    expect(humanizeName('send_snag_list')).toBe('Send snag list');
    expect(humanizeName('send-snag-list')).toBe('Send snag list');
  });

  it('KEEPS a trailing single capital — "Note G" is not "note g"', () => {
    expect(humanizeName('explainNoteG')).toBe('Explain note G');
  });

  it('keeps an acronym run intact', () => {
    expect(humanizeName('parseHTTPResponse')).toBe('Parse HTTP response');
  });

  it('does NOT anglicize a non-English name — many real specs are not English', () => {
    expect(humanizeName('verlängerungAblehnen')).toBe('Verlängerung ablehnen');
  });

  it('survives junk without throwing', () => {
    expect(humanizeName('')).toBe('');
    expect(humanizeName(undefined as unknown as string)).toBe('');
  });
});

describe('humanizeKey — acronyms are fixed per WORD, not per key', () => {
  it('uppercases an acronym that is the whole key', () => {
    expect(humanizeKey('arr')).toBe('ARR');
  });

  it('uppercases an acronym at the TAIL of a compound — the common case', () => {
    expect(humanizeKey('runId')).toBe('Run ID');
    expect(humanizeKey('currentPriceGbp')).toBe('Current price GBP');
  });

  it('leaves an ordinary word alone', () => {
    expect(humanizeKey('renewalDate')).toBe('Renewal date');
  });
});

describe('formatValue — formatted, never rewritten', () => {
  it('separates thousands', () => expect(formatValue(86000)).toBe('86,000'));
  it('reads booleans as Yes/No', () => {
    expect(formatValue(true)).toBe('Yes');
    expect(formatValue(false)).toBe('No');
  });
  it('inlines a short array and counts a long one', () => {
    expect(formatValue(['a', 'b'])).toBe('a, b');
    expect(formatValue([1, 2, 3, 4, 5])).toBe('5 items');
  });
  it('returns a string EXACTLY as supplied — no casing, no trimming of meaning', () => {
    expect(formatValue('champion-left-save')).toBe('champion-left-save');
    expect(formatValue('記録しています')).toBe('記録しています');
    expect(formatValue('Nordwind GmbH')).toBe('Nordwind GmbH');
  });
  it('maps a blank to an em dash so the function is total (threadText filters first)', () => {
    expect(formatValue('')).toBe('—');
    expect(formatValue(null)).toBe('—');
  });
  it('does not print [object Object]', () => {
    expect(formatValue({ from: 'A', to: 'B' })).toBe('From: A, To: B');
  });
  it('does not print a raw NaN/Infinity through toLocaleString', () => {
    expect(formatValue(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });
});

describe('threadText', () => {
  it('is a heading plus one bullet per param', () => {
    expect(threadText('trackPrice', { modelName: 'Vantor DualZone 5.5L', currentPriceGbp: 149, durationDays: 14 }))
      .toBe('Track price\n- Model name: Vantor DualZone 5.5L\n- Current price GBP: 149\n- Duration days: 14');
  });

  it('an action with NO params is the heading alone, no trailing newline', () => {
    expect(threadText('refreshFeed')).toBe('Refresh feed');
    expect(threadText('refreshFeed', {})).toBe('Refresh feed');
  });

  it('DROPS every blank param — no "Note: —" noise in the thread', () => {
    expect(threadText('submitLeaveRequest', {
      note: '', approver: undefined, cc: null, tags: [], meta: {}, spaces: '   ',
    })).toBe('Submit leave request');
  });

  /**
   * THE FALSY TRAP. `confirmed: false` is the entire point of a confirmation param
   * and `days: 0` is a real answer. A plain `if (!value)` filter deletes both, and
   * the thread then reports the OPPOSITE of what the user did — the failure mode
   * this test exists to prevent.
   */
  it('KEEPS false and 0 — they are values, not blanks', () => {
    expect(threadText('runJob', { env: 'production', confirmed: false, retries: 0 }))
      .toBe('Run job\n- Env: production\n- Confirmed: No\n- Retries: 0');
  });

  it('drops blanks from a nested object too', () => {
    expect(threadText('sendNotice', { to: { name: 'Dana', cc: '', id: 42 } }))
      .toBe('Send notice\n- To: Name: Dana, ID: 42');
  });

  /**
   * NEVER THROWS ON A CYCLE. The receipt card runs every param
   * through formatValue at render time; a host-built event with a self-referencing
   * object used to blow the stack in the middle of the thread render. Only a true
   * back-edge prints the marker — a value that is merely SHARED under two keys is
   * still formatted both times.
   */
  it('formats a cyclic object without throwing, and a merely shared object twice', () => {
    const circ: Record<string, unknown> = { id: 1 };
    circ.self = circ;
    expect(() => formatValue(circ)).not.toThrow();
    expect(formatValue(circ)).toBe('ID: 1, Self: [circular]');
    expect(threadText('x', { a: circ })).toBe('X\n- A: ID: 1, Self: [circular]');
    const list: unknown[] = ['a'];
    list.push(list);
    expect(formatValue(list)).toBe('a, [circular]');
    const shared = { n: 1 };
    expect(formatValue({ p: shared, q: shared })).toBe('P: N: 1, Q: N: 1');
  });

  it('counts only the params it will SHOW when capping', () => {
    // a blank must not consume a slot, nor inflate "+N more"
    expect(threadText('x', { a: 1, blank: '', b: 2, c: 3 }, { maxParams: 2 }))
      .toBe('X\n- A: 1\n- B: 2\n- +1 more');
  });

  it('caps with "+N more" only when asked', () => {
    const p = { a: 1, b: 2, c: 3, d: 4 };
    expect(threadText('x', p, { maxParams: 2 })).toBe('X\n- A: 1\n- B: 2\n- +2 more');
    expect(threadText('x', p).split('\n')).toHaveLength(5);   // uncapped by default
  });

  it('takes a custom bullet', () => {
    expect(threadText('runJob', { env: 'production' }, { bullet: '•' })).toBe('Run job\n• Env: production');
  });

  it('carries a non-English action and value through untouched', () => {
    expect(threadText('verlängerungAblehnen', { sender: 'Nordwind GmbH', betragEur: 18400 }))
      .toBe('Verlängerung ablehnen\n- Sender: Nordwind GmbH\n- Betrag EUR: 18,400');
  });
});

describe('isBlank — the falsy trap, pinned directly', () => {
  it('treats absent/empty as blank', () => {
    for (const v of [undefined, null, '', '   ', [], {}]) expect(isBlank(v)).toBe(true);
  });
  it('treats false, 0 and NaN as VALUES', () => {
    for (const v of [false, 0, Number.NaN, -0]) expect(isBlank(v)).toBe(false);
  });
});
