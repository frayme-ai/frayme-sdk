import { describe, expect, it } from 'vitest';
import {
  fraymeIntentSchema,
  intentExample,
  lookupIntentTool,
  type FraymeIntent,
} from '../src/agent/index.js';
import { composeInputSchema } from '../src/tools/index.js';

const refundQueue: FraymeIntent = {
  name: 'refund_queue',
  description: 'Review pending refund requests and approve or reject them.',
  layout: 'A compact queue of pending refunds: one row per request with customer, amount and reason, and approve or reject on each row.',
  signals: { data_shape: ['table'], density: 'compact', patterns: ['row-actions'] },
  actions: [
    { name: 'approveRefund', role: 'Approve', required: true, requiredItems: ['refundId'] },
    { name: 'rejectRefund', role: 'Reject', confirm: true },
  ],
};

const orderStatus: FraymeIntent = {
  name: 'order_status',
  description: 'Show where one order is.',
  layout: 'A single order card with a delivery timeline.',
};

describe('fraymeIntentSchema', () => {
  it('accepts a full intent and a minimal one', () => {
    expect(fraymeIntentSchema.safeParse(refundQueue).success).toBe(true);
    expect(fraymeIntentSchema.safeParse(orderStatus).success).toBe(true);
  });

  it('enforces the name pattern and reserves "none"', () => {
    const named = (name: string) => fraymeIntentSchema.safeParse({ ...orderStatus, name }).success;
    expect(named('ab')).toBe(true);
    expect(named('a'.repeat(40))).toBe(true);
    expect(named('a')).toBe(false); // too short
    expect(named('a'.repeat(41))).toBe(false);
    expect(named('Order_status')).toBe(false); // uppercase
    expect(named('1order')).toBe(false); // must start with a letter
    expect(named('order-status')).toBe(false); // hyphen
    expect(named('none')).toBe(false);
  });

  it('bounds description (1..200) and layout (1..800)', () => {
    const parse = (over: Partial<FraymeIntent>) => fraymeIntentSchema.safeParse({ ...orderStatus, ...over }).success;
    expect(parse({ description: '' })).toBe(false);
    expect(parse({ description: 'd'.repeat(200) })).toBe(true);
    expect(parse({ description: 'd'.repeat(201) })).toBe(false);
    expect(parse({ layout: '' })).toBe(false);
    expect(parse({ layout: 'l'.repeat(800) })).toBe(true);
    expect(parse({ layout: 'l'.repeat(801) })).toBe(false);
  });

  it('is strict: an unknown top-level key is an error, not a dropped setting', () => {
    expect(fraymeIntentSchema.safeParse({ ...orderStatus, prompt: 'x' }).success).toBe(false);
    expect(fraymeIntentSchema.safeParse({ ...orderStatus, data: {} }).success).toBe(false);
  });

  it('validates signals and actions with the compose tool schema', () => {
    expect(
      fraymeIntentSchema.safeParse({ ...orderStatus, signals: { density: 'huge' } }).success,
    ).toBe(false);
    expect(
      fraymeIntentSchema.safeParse({ ...orderStatus, actions: [{ name: 'a'.repeat(61) }] }).success,
    ).toBe(false);
  });

  it('rejects duplicate action names, without changing the compose tool schema', () => {
    const dupes = [{ name: 'save' }, { name: 'save' }];
    expect(fraymeIntentSchema.safeParse({ ...orderStatus, actions: dupes }).success).toBe(false);
    // The refinement is on a copy: frayme_compose itself still accepts the same list.
    expect(composeInputSchema.safeParse({ prompt: 'x', actions: dupes }).success).toBe(true);
  });
});

describe('intentExample', () => {
  it('turns an intent into an example frayme_compose call with layout as the prompt', () => {
    expect(intentExample(refundQueue)).toEqual({
      intent: 'refund_queue',
      description: refundQueue.description,
      example_call: {
        prompt: refundQueue.layout,
        signals: refundQueue.signals,
        actions: refundQueue.actions,
      },
    });
  });

  it('leaves out empty or missing signals and actions', () => {
    expect(intentExample(orderStatus).example_call).toEqual({ prompt: orderStatus.layout });
    const empty = intentExample({ ...orderStatus, signals: {}, actions: [] });
    expect(empty.example_call).toEqual({ prompt: orderStatus.layout });
    expect(empty.example_call).not.toHaveProperty('signals');
    expect(empty.example_call).not.toHaveProperty('actions');
  });

  it('deep-copies: mutating the example never reaches the intent', () => {
    const example = intentExample(refundQueue);
    expect(example.example_call.signals).not.toBe(refundQueue.signals);
    expect(example.example_call.actions).not.toBe(refundQueue.actions);
    example.example_call.signals!.data_shape!.push('chart');
    example.example_call.actions![0]!.requiredItems!.push('note');
    expect(refundQueue.signals!.data_shape).toEqual(['table']);
    expect(refundQueue.actions![0]!.requiredItems).toEqual(['refundId']);
  });

  it('the example call is a valid frayme_compose input', () => {
    expect(composeInputSchema.safeParse(intentExample(refundQueue).example_call).success).toBe(true);
  });
});

describe('lookupIntentTool', () => {
  it('returns undefined when there are no intents', () => {
    expect(lookupIntentTool([])).toBeUndefined();
  });

  it('throws at build time on a duplicate name', () => {
    expect(() => lookupIntentTool([orderStatus, { ...orderStatus, description: 'again' }])).toThrow(
      /Duplicate intent name "order_status"/,
    );
  });

  it('is named lookup_intent and describes the intents as example compose calls', () => {
    const tool = lookupIntentTool([refundQueue, orderStatus])!;
    expect(tool.name).toBe('lookup_intent');
    expect(tool.description).toContain('example frayme_compose calls');
    expect(tool.description).toContain('same shape as the examples');
    expect(tool.description).toContain(`- refund_queue: ${refundQueue.description}`);
    expect(tool.description).toContain(`- order_status: ${orderStatus.description}`);
    expect(tool.description).toMatch(/matches an intent, read it/);
    expect(tool.description).toContain('write your own frayme_compose call');
    expect(tool.description).toContain('`data`');
    expect(tool.description).not.toMatch(/[\u2013\u2014]/);
  });

  it('accepts only known names in its input schema', () => {
    const tool = lookupIntentTool([refundQueue, orderStatus])!;
    expect(tool.inputSchema.safeParse({ name: 'refund_queue' }).success).toBe(true);
    expect(tool.inputSchema.safeParse({ name: 'order_status' }).success).toBe(true);
    expect(tool.inputSchema.safeParse({ name: 'nope' }).success).toBe(false);
    expect(tool.inputSchema.safeParse({}).success).toBe(false);
  });

  it('returns the intent example for a known name', async () => {
    const tool = lookupIntentTool([refundQueue, orderStatus])!;
    expect(await tool.execute({ name: 'refund_queue' })).toEqual(intentExample(refundQueue));
  });

  it('returns an error for an unknown name and never throws', async () => {
    const tool = lookupIntentTool([refundQueue])!;
    const result = await tool.execute({ name: 'constructor' });
    expect(result).toEqual({ error: expect.stringContaining('Unknown intent "constructor"') });
    expect((result as { error: string }).error).toContain('refund_queue');
    await expect(tool.execute({ name: '__proto__' })).resolves.toHaveProperty('error');
    await expect(tool.execute(undefined as never)).resolves.toHaveProperty('error');
  });

  it('hands out a fresh copy per call, so a caller cannot corrupt later results', async () => {
    const tool = lookupIntentTool([refundQueue])!;
    const first = (await tool.execute({ name: 'refund_queue' })) as ReturnType<typeof intentExample>;
    first.example_call.prompt = 'changed';
    first.example_call.actions!.length = 0;
    const second = (await tool.execute({ name: 'refund_queue' })) as ReturnType<typeof intentExample>;
    expect(second.example_call.prompt).toBe(refundQueue.layout);
    expect(second.example_call.actions).toHaveLength(2);
  });

  it('is not affected by later changes to the intent list it was built from', async () => {
    const intents = [structuredClone(orderStatus)];
    const tool = lookupIntentTool(intents)!;
    intents[0]!.layout = 'something else';
    const result = (await tool.execute({ name: 'order_status' })) as ReturnType<typeof intentExample>;
    expect(result.example_call.prompt).toBe(orderStatus.layout);
  });
});
