import { describe, expect, it } from 'vitest';
import { Frayme } from '../src/client.js';
import {
  actionInputSchema,
  actionToolDefinition,
  composeInputSchema,
  composeToolDefinition,
  createActionTool,
  createComposeTool,
} from '../src/tools/index.js';
import { buildMockFetch } from './helpers/mock-fetch.js';

describe('composeToolDefinition', () => {
  it('mirrors the wire bounds: prompt 1–4000, context limits, max_operations 1–200', () => {
    expect(composeInputSchema.safeParse({ prompt: 'a dashboard' }).success).toBe(true);
    expect(composeInputSchema.safeParse({ prompt: '' }).success).toBe(false);
    expect(composeInputSchema.safeParse({ prompt: 'x'.repeat(4001) }).success).toBe(false);
    expect(
      composeInputSchema.safeParse({ prompt: 'x', context: { theme: 'y'.repeat(41) } }).success,
    ).toBe(false);
    expect(composeInputSchema.safeParse({ prompt: 'x', max_operations: 0 }).success).toBe(false);
    expect(composeInputSchema.safeParse({ prompt: 'x', max_operations: 200 }).success).toBe(true);
  });

  it('implements Standard Schema (the `~standard` marker frameworks detect)', () => {
    expect(
      (composeInputSchema as unknown as { ['~standard']?: unknown })['~standard'],
    ).toBeDefined();
    expect(composeToolDefinition.name).toBe('frayme_compose');
    expect(composeToolDefinition.inputSchema).toBe(composeInputSchema);
  });
});

describe('createComposeTool', () => {
  it('executes a non-streaming compose through the bound client', async () => {
    const mock = buildMockFetch([
      {
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            generation_id: 'gen_t',
            spec: { root: 'r', elements: {} },
            model: 'frayme',
            operation_count: 1,
            validated: true,
            usage: { input_tokens: 1, output_tokens: 2 },
          },
        }),
      },
    ]);
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch });
    const tool = createComposeTool(frayme);
    const result = await tool.execute({ prompt: 'a settings panel' });
    expect(result.generation_id).toBe('gen_t');
    expect(JSON.parse(mock.calls[0]!.body!)).toMatchObject({ prompt: 'a settings panel', stream: false });
  });
});

describe('frayme_action round-trip tool', () => {
  it('frayme_compose advertises an outputSchema; frayme_action is a distinct tool', () => {
    expect(composeToolDefinition.outputSchema).toBeDefined();
    expect(actionToolDefinition.name).toBe('frayme_action');
    expect(actionInputSchema.safeParse({ action: 'doIt' }).success).toBe(true);
    expect(actionInputSchema.safeParse({}).success).toBe(false); // action is required
  });

  it('executes a plain create: the press is named in the prompt, nothing else is sent', async () => {
    const mock = buildMockFetch([
      {
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            generation_id: 'gen_a',
            spec: { root: 'r', elements: {} },
            model: 'frayme',
            operation_count: 1,
            validated: true,
            usage: { input_tokens: 1, output_tokens: 2 },
          },
        }),
      },
    ]);
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch });
    const tool = createActionTool(frayme);
    const result = await tool.execute({
      action: 'approveRefund',
      params: { amount: 50 },
      event: 'commit',
      generation_id: 'gen_a',
    });
    expect(result.generation_id).toBe('gen_a');
    const body = JSON.parse(mock.calls[0]!.body!);
    expect(body).toMatchObject({ stream: false });
    // A PRESS IS A CREATE. action_context reached no prompt, so the params and the
    // state posted there told the model nothing while still crossing the wire.
    expect(body).not.toHaveProperty('mode');
    expect(body).not.toHaveProperty('action_context');
    expect(body).not.toHaveProperty('prior_spec');
    // The press still reaches the model, named in the prompt.
    expect(body.prompt).toMatch(/approveRefund/);
    expect(body.prompt).not.toMatch(/[\u2013\u2014]/);
  });

  /*
   * ACCEPTED, NOT FORWARDED. The event's `label` / `description`
   * are on the tool schema so a verbatim forward is carried rather than
   * silently stripped, but `/v1/compose` rejects unknown `action_context`
   * fields with 400 — so the bound tool must leave them out of the request.
   * The request must otherwise be byte-for-byte what it was.
   */
  it('sends none of the event: not its label, not its params, not the state it was pressed on', async () => {
    const mock = buildMockFetch([
      {
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            generation_id: 'gen_b',
            spec: { root: 'r', elements: {} },
            model: 'frayme',
            operation_count: 1,
            validated: true,
            usage: { input_tokens: 1, output_tokens: 2 },
          },
        }),
      },
    ]);
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch });
    const tool = createActionTool(frayme);
    await tool.execute({
      action: 'saveDayPlan',
      event: 'commit',
      element_id: 'savePlanBtn',
      label: "Save today's plan",
      description: 'Push the arrangement to the floor screens.',
      params: { board: [] },
      state: { _ui: { jobBoard: { move: { card: 'J-2229' } } } },
      generation_id: 'gen_b',
    });
    const body = JSON.parse(mock.calls[0]!.body!);
    expect(body).not.toHaveProperty('action_context');
    expect(body).not.toHaveProperty('label');
    expect(body).not.toHaveProperty('description');
    // The card the user moved never leaves the browser.
    const wire = JSON.stringify(body);
    expect(wire).not.toContain('J-2229');
    expect(wire).not.toContain('jobBoard');
    // The action is still named, so the model knows what happened.
    expect(body.prompt).toMatch(/saveDayPlan/);
  });

  it('createComposeTool / createActionTool carry `inputExamples` alongside the definition (AI SDK / Mastra core field)', () => {
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test' });
    const compose = createComposeTool(frayme);
    const action = createActionTool(frayme);
    expect(compose.name).toBe('frayme_compose');
    expect(compose.inputSchema).toBe(composeInputSchema);
    expect(Array.isArray(compose.inputExamples)).toBe(true);
    expect(compose.inputExamples[0]).toHaveProperty('input');
    expect(action.inputSchema).toBe(actionInputSchema);
    expect(action.inputExamples[0]).toHaveProperty('input');
  });
});
