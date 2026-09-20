/**
 * frayme_action carries the NEXT screen's inputs: `data`, `actions` and
 * `signals`, with the compose tool's own schemas, forwarded as top-level
 * request fields and never inside the strict `action_context`.
 */
import { describe, expect, it } from 'vitest';
import { Frayme } from '../src/client.js';
import {
  actionInputSchema,
  actionToolDefinition,
  anthropicToolDefinitions,
  composeInputSchema,
  createActionTool,
} from '../src/tools/index.js';
import { MAX_ACTIONS_PER_REQUEST } from '../src/limits.js';
import { buildMockFetch } from './helpers/mock-fetch.js';

const success = JSON.stringify({
  success: true,
  data: {
    generation_id: 'gen_next',
    spec: { root: 'r', elements: {} },
    model: 'frayme',
    operation_count: 1,
    validated: true,
    usage: { input_tokens: 1, output_tokens: 1 },
  },
});

function boundTool() {
  const mock = buildMockFetch([{ status: 200, body: success }]);
  const tool = createActionTool(new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch }));
  return { tool, body: () => JSON.parse(mock.calls[0]!.body!) as Record<string, unknown> };
}

describe('frayme_action schema: next-screen fields', () => {
  it('accepts data, actions and signals and carries them through a parse', () => {
    const input = {
      action: 'approveRefund',
      data: { receipt: 'RC-1', total: '£40.00' },
      actions: [{ name: 'printReceipt', role: 'Print', required: true, requiredItems: ['receipt'] }],
      signals: { data_shape: ['document'], density: 'standard', tone: 'neutral' },
    };
    expect(actionInputSchema.parse(input)).toEqual(input);
  });

  it('applies the compose tool limits to them', () => {
    const tooMany = Array.from({ length: MAX_ACTIONS_PER_REQUEST + 1 }, (_, i) => ({ name: `a${i}` }));
    expect(actionInputSchema.safeParse({ action: 'go', actions: tooMany }).success).toBe(false);
    expect(actionInputSchema.safeParse({ action: 'go', signals: { density: 'huge' } }).success).toBe(false);
    expect(actionInputSchema.safeParse({ action: 'go', data: 'not an object' }).success).toBe(false);
    expect(actionInputSchema.safeParse({ action: 'go', actions: [{ name: '' }] }).success).toBe(false);
  });

  it('reuses the compose schemas but describes them for the next screen', () => {
    const shape = actionInputSchema.shape;
    expect(shape.data.description).toMatch(/NEXT screen/);
    expect(shape.signals.description).toMatch(/NEXT screen/);
    expect(shape.actions.description).toMatch(/NEXT screen/);
    // Forward actions only: re-declaring the pressed control with required params
    // makes the server put the form back.
    expect(shape.actions.description).toMatch(/lead FORWARD from here/);
    expect(shape.actions.description).toMatch(/Do NOT re-declare the control just pressed/);
    // The next screen is fresh, so an unnamed value is simply lost.
    expect(shape.data.description).toMatch(/COMPOSED FRESH/);
    // Same element schema as frayme_compose, so the limits cannot drift apart.
    expect(Object.keys(shape.actions.unwrap().element.shape)).toEqual(
      Object.keys(composeInputSchema.shape.actions.unwrap().element.shape),
    );
    // Re-describing made copies: the compose tool keeps its own wording.
    expect(composeInputSchema.shape.data.description).toMatch(/ALWAYS INCLUDE THIS FIELD/);
    expect(composeInputSchema.shape.actions.description).toMatch(/^DYNAMIC ACTIONS/);
    for (const key of ['data', 'actions', 'signals'] as const) {
      expect(shape[key].description).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it('the tool description says so in one sentence', () => {
    expect(actionToolDefinition.description).toContain('The NEXT SCREEN IS THEN COMPOSED FRESH from what you send');
    expect(actionToolDefinition.description).toContain('has to be named in `data`');
    // The old promise, which the staging A/B falsified: a press does not preserve
    // the state the user entered, because the screen is composed from scratch.
    expect(actionToolDefinition.description).not.toContain('preserving the live UI state');
    expect(actionToolDefinition.description).not.toContain('continue_journey');
  });

  it('the raw Anthropic definition advertises the three fields', () => {
    const action = anthropicToolDefinitions()[1]!;
    const properties = action.input_schema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty('data');
    expect(properties).toHaveProperty('actions');
    expect(properties).toHaveProperty('signals');
  });
});

describe('createActionTool: next-screen fields on the wire', () => {
  it('forwards them as the whole request, since the event itself is not sent', async () => {
    const { tool, body } = boundTool();
    await tool.execute({
      action: 'approveRefund',
      event: 'commit',
      params: { refundId: 'R-7' },
      label: 'Approve',
      description: 'Approve the refund.',
      generation_id: 'gen_prev',
      prompt: 'Show the receipt.',
      data: { receipt: 'RC-1' },
      actions: [{ name: 'printReceipt', requiredItems: ['receipt'] }],
      signals: { density: 'compact' },
    });
    // A PRESS IS A CREATE: the caller's prompt and values ARE the request.
    expect(body()).toEqual({
      prompt: 'Show the receipt.',
      data: { receipt: 'RC-1' },
      actions: [{ name: 'printReceipt', requiredItems: ['receipt'] }],
      signals: { density: 'compact' },
      stream: false,
    });
  });

  it('sends only a prompt when the caller gives nothing else', async () => {
    const { tool, body } = boundTool();
    await tool.execute({ action: 'approveRefund', generation_id: 'gen_prev' });
    const sent = body();
    expect(Object.keys(sent)).toEqual(['prompt', 'stream']);
    expect(String(sent.prompt)).toContain('approveRefund');
  });

  it('passes an empty data object through, since {} means "no fixed content"', async () => {
    const { tool, body } = boundTool();
    await tool.execute({ action: 'startOver', data: {} });
    expect(body().data).toEqual({});
  });
});

describe('createActionTool: a press on a huge table', () => {
  it('sends none of it, so there is no ceiling to fit and nothing to refuse', async () => {
    const { tool, body } = boundTool();
    const rows = Array.from({ length: 400 }, (_, i) => ({ id: `R-${i}`, note: 'x'.repeat(40) }));
    await tool.execute({ action: 'reassign', params: { row: { id: 'R-1' } }, state: { rows } });
    const wire = JSON.stringify(body());
    expect(wire).not.toContain('R-399');
    expect(wire).not.toContain('R-1');
    expect(wire.length).toBeLessThan(200);
  });
});

describe('frayme_compose actions[].requiredItems', () => {
  it('is carried, not stripped', () => {
    const parsed = composeInputSchema.parse({
      prompt: 'a refund form',
      actions: [{ name: 'approveRefund', params: { amount: { description: 'Amount' } }, requiredItems: ['amount'] }],
    });
    expect(parsed.actions?.[0]?.requiredItems).toEqual(['amount']);
  });

  it('is described for the flat params map, without dashes', () => {
    const describe_ = composeInputSchema.shape.actions.unwrap().element.shape.requiredItems.description ?? '';
    expect(describe_).toContain('flat map');
    expect(describe_).not.toMatch(/[\u2013\u2014]/);
  });
});
