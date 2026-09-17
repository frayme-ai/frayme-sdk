import { describe, expect, it } from 'vitest';
import { actionContextOf, findPriorSpec, readPress, type FraymePress } from '../src/agent/index.js';

const press: FraymePress = {
  action: 'approveRefund',
  event: 'commit',
  params: { refundId: 'R-7' },
  state: { note: 'ok', _ui: { approve: { commit: { label: 'Approve' } } } },
  element_id: 'approve',
  label: 'Approve',
  description: 'Approve the refund.',
  generation_id: 'gen_1',
};

const specA = { root: 'a', elements: { a: { type: 'Card', props: { title: 'A' } } } };
const specB = { root: 'b', elements: { b: { type: 'Card', props: { title: 'B' } } } };

describe('readPress', () => {
  it('reads the event itself', () => {
    expect(readPress(press)).toEqual(press);
  });

  it('reads { frayme: event } and { metadata: { frayme: event } }', () => {
    expect(readPress({ frayme: press })).toEqual(press);
    expect(readPress({ role: 'user', metadata: { frayme: press }, parts: [{ type: 'text', text: 'Approve' }] })).toEqual(
      press,
    );
  });

  it('falls through to metadata when the frayme wrapper is not a valid event', () => {
    expect(readPress({ frayme: { nope: true }, metadata: { frayme: press } })).toEqual(press);
  });

  it('keeps the next-screen fields and drops keys the schema does not know', () => {
    const read = readPress({
      ...press,
      prompt: 'Show the receipt.',
      data: { receipt: 'RC-1' },
      actions: [{ name: 'done' }],
      signals: { density: 'compact' },
      extra: 'dropped',
    });
    expect(read).toMatchObject({ prompt: 'Show the receipt.', data: { receipt: 'RC-1' }, actions: [{ name: 'done' }] });
    expect(read).not.toHaveProperty('extra');
  });

  it('returns undefined for anything that is not a valid press', () => {
    for (const value of [
      undefined,
      null,
      'approveRefund',
      42,
      [],
      [press],
      {},
      { action: '' },
      { action: 'x'.repeat(61) },
      { frayme: 'approveRefund' },
      { metadata: null },
      { metadata: { frayme: { action: 7 } } },
      { message: { metadata: { frayme: press } } }, // only the documented places are read
    ]) {
      expect(readPress(value), JSON.stringify(value)).toBeUndefined();
    }
  });

  it('never throws on a hostile value', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('trap');
        },
        ownKeys() {
          throw new Error('trap');
        },
      },
    );
    expect(readPress(hostile)).toBeUndefined();
    expect(readPress({ get frayme(): never { throw new Error('getter'); } })).toBeUndefined();
  });
});

describe('actionContextOf', () => {
  it('keeps exactly the wire action_context fields', () => {
    const context = actionContextOf({
      ...press,
      prompt: 'next',
      data: { a: 1 },
      actions: [{ name: 'done' }],
      signals: { density: 'rich' },
    });
    expect(context).toEqual({
      action: 'approveRefund',
      event: 'commit',
      params: { refundId: 'R-7' },
      state: { note: 'ok', _ui: { approve: { commit: { label: 'Approve' } } } },
      element_id: 'approve',
      generation_id: 'gen_1',
    });
    for (const key of ['label', 'description', 'prompt', 'data', 'actions', 'signals']) {
      expect(context).not.toHaveProperty(key);
    }
  });

  it('leaves out fields the press does not have', () => {
    expect(actionContextOf({ action: 'go' })).toEqual({ action: 'go' });
    expect(Object.keys(actionContextOf({ action: 'go', event: 'commit' }))).toEqual(['action', 'event']);
  });
});

describe('findPriorSpec', () => {
  it('finds a complete tool output nested in a chat history and returns a copy', () => {
    const messages = [
      { role: 'user', parts: [{ type: 'text', text: 'Show refunds' }] },
      {
        role: 'assistant',
        parts: [
          { type: 'tool-frayme_compose', state: 'output-available', output: { status: 'complete', generation_id: 'gen_1', spec: specA } },
        ],
      },
    ];
    const found = findPriorSpec(messages, 'gen_1');
    expect(found).toEqual(specA);
    expect(found).not.toBe(specA);
    (found as unknown as { root: string }).root = 'changed';
    expect(specA.root).toBe('a');
  });

  it('accepts an object with no status field (a plain compose result)', () => {
    expect(findPriorSpec({ result: { generation_id: 'gen_2', spec: specB, model: 'm' } }, 'gen_2')).toEqual(specB);
  });

  it('ignores outputs that are not complete, or whose spec is not an object', () => {
    const history = [
      { status: 'streaming', generation_id: 'gen_1', spec: specA },
      { status: 'error', generation_id: 'gen_1', spec: specA },
      { status: 'restarted', generation_id: 'gen_1', spec: null },
      { generation_id: 'gen_1', spec: 'not a spec' },
      { generation_id: 'gen_1', spec: [specA] },
      { generation_id: 'gen_other', spec: specB },
    ];
    expect(findPriorSpec(history, 'gen_1')).toBeUndefined();
    expect(findPriorSpec(history, 'gen_other')).toEqual(specB);
  });

  it('the last match wins', () => {
    const history = [
      { output: { status: 'complete', generation_id: 'gen_1', spec: specA } },
      { output: { status: 'complete', generation_id: 'gen_1', spec: specB } },
    ];
    expect(findPriorSpec(history, 'gen_1')).toEqual(specB);
  });

  it('a shared object counts at every place it appears', () => {
    const a = { status: 'complete', generation_id: 'gen_1', spec: specA };
    const b = { status: 'complete', generation_id: 'gen_1', spec: specB };
    expect(findPriorSpec([a, b, a], 'gen_1')).toEqual(specA);
  });

  it('does not look inside a spec for another generation', () => {
    const decoy = { status: 'complete', generation_id: 'gen_1', spec: specB };
    const outer = {
      status: 'complete',
      generation_id: 'gen_0',
      spec: { root: 'x', elements: {}, state: { saved: decoy } },
    };
    expect(findPriorSpec([outer], 'gen_1')).toBeUndefined();
  });

  it('is cycle-safe and depth-limited', () => {
    const cyclic: Record<string, unknown> = { generation_id: 'gen_1', status: 'complete', spec: specA };
    cyclic.self = cyclic;
    const loop: unknown[] = [];
    loop.push(loop, cyclic);
    expect(findPriorSpec(loop, 'gen_1')).toEqual(specA);

    let deep: unknown = { generation_id: 'gen_deep', spec: specA };
    for (let i = 0; i < 40; i++) deep = { child: deep };
    expect(findPriorSpec(deep, 'gen_deep')).toBeUndefined();
    let shallow: unknown = { generation_id: 'gen_deep', spec: specA };
    for (let i = 0; i < 5; i++) shallow = { child: shallow };
    expect(findPriorSpec(shallow, 'gen_deep')).toEqual(specA);
  });

  it('returns undefined for no match, odd input, or an uncopyable spec, and never throws', () => {
    expect(findPriorSpec([], 'gen_1')).toBeUndefined();
    expect(findPriorSpec(null, 'gen_1')).toBeUndefined();
    expect(findPriorSpec('gen_1', 'gen_1')).toBeUndefined();
    expect(findPriorSpec([{ generation_id: 'gen_1', spec: specA }], '')).toBeUndefined();
    expect(findPriorSpec([{ generation_id: 'gen_1', spec: specA }], undefined as never)).toBeUndefined();
    expect(findPriorSpec([{ generation_id: 'gen_1', spec: { fn: () => 1 } }], 'gen_1')).toBeUndefined();
    const hostile = new Proxy([], {
      get() {
        throw new Error('trap');
      },
    });
    expect(findPriorSpec(hostile, 'gen_1')).toBeUndefined();
  });
});
