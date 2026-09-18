/**
 * `fraymeTools`: the Frayme tools inside a Vercel AI SDK agent.
 *
 * Two layers. The tool-level tests call `execute` the way the AI SDK does and
 * read the request each call sends. The agent-turn tests run a real
 * `streamText` loop against a scripted model, so they pin what the SDK
 * actually does with the tools: preliminary outputs reach the UI stream, and
 * the model reads the short view, never the spec.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertToModelMessages,
  readUIMessageStream,
  stepCountIs,
  streamText,
  type ToolExecutionOptions,
  type UIMessage,
} from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { Frayme } from '../src/client.js';
import {
  fraymeComposeInputSchema,
  fraymeTools,
  CLIENT_ERROR,
  NO_PRESS,
  pendingPress,
  PRESS_INVALID,
  PRESS_MISMATCH,
  SCREEN_TOO_LARGE,
  UNKNOWN_SCREEN,
  type FraymeComposeOutput,
  type FraymeToolsOptions,
} from '../src/ai-sdk/index.js';
import { ONE_COMPOSE_PER_TURN, type FraymeIntent } from '../src/agent/index.js';
import { actionInputSchema } from '../src/tools/index.js';

const actionInputSchemaAccepts = (input: unknown): boolean => actionInputSchema.safeParse(input).success;
import { frame, happyPayload, sseStream } from './helpers/fixtures.js';
import { buildMockFetch, type RecordedCall, type ScriptedResponse } from './helpers/mock-fetch.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const ok = (payload = happyPayload()): ScriptedResponse => ({ status: 200, sse: true, body: () => sseStream(payload) });

function setup(script: ScriptedResponse[], options: Omit<FraymeToolsOptions, 'client'> = {}) {
  const mock = buildMockFetch(script);
  const client = new Frayme({ apiKey: 'fr_live_x', baseURL: 'https://api.test', fetch: mock.fetch, maxRetries: 0 });
  return { tools: fraymeTools({ client, ...options }), calls: mock.calls };
}

const callOptions = (over: Partial<ToolExecutionOptions> = {}): ToolExecutionOptions => ({
  toolCallId: 'call_1',
  messages: [],
  ...over,
});

/** Run a tool the way the AI SDK does and keep every output. */
async function outputs(
  execute: ((input: never, options: ToolExecutionOptions) => unknown) | undefined,
  input: unknown,
): Promise<FraymeComposeOutput[]> {
  const result = execute?.(input as never, callOptions());
  const out: FraymeComposeOutput[] = [];
  for await (const value of result as AsyncIterable<FraymeComposeOutput>) out.push(value);
  return out;
}

const bodyOf = (call: RecordedCall | undefined): Record<string, unknown> => JSON.parse(call?.body ?? '{}');

/** A finished screen as a UI message holds it: a tool part whose output carries the spec. */
const SCREEN = {
  root: 'card',
  elements: {
    card: { type: 'Card', props: {}, children: ['btn'] },
    btn: { type: 'Button', props: { label: 'Show delayed' } },
  },
};

const assistantWithScreen = (generationId = 'gen_1') => ({
  id: 'a1',
  role: 'assistant',
  parts: [
    {
      type: 'tool-frayme_compose',
      toolCallId: 'call_0',
      state: 'output-available',
      input: { prompt: 'Orders' },
      output: { status: 'complete', generation_id: generationId, op_count: 2, restart_count: 0, spec: SCREEN },
    },
  ],
});

const PRESS = {
  action: 'showDelayed',
  event: 'commit',
  params: { status: 'Delayed', orders: 2 },
  state: { _ui: { ordersTable: { sort: { column: 'total', direction: 'desc' } } } },
  element_id: 'btn',
  label: 'Show delayed',
  description: 'Filter to delayed orders.',
  generation_id: 'gen_1',
};

const pressFromUser = (event: Record<string, unknown> = PRESS) => ({
  id: 'u2',
  role: 'user',
  metadata: { frayme: event },
  parts: [
    {
      type: 'text',
      text: 'Show delayed\n- Status: Delayed\n- Orders: 2\n\nfrayme_action {"action":"showDelayed","event":"commit","element_id":"btn","label":"Show delayed","generation_id":"gen_1"}',
    },
  ],
});

const history = () => [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'my orders' }] }, assistantWithScreen(), pressFromUser()];

describe('fraymeTools: frayme_compose', () => {
  it('streams live outputs and ends with the complete spec', async () => {
    const { tools, calls } = setup([ok()], { snapshotEveryMs: 0 });
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(out.length).toBeGreaterThan(1);
    expect(out.slice(0, -1).every((o) => o.status === 'streaming')).toBe(true);
    expect(out.at(-1)).toMatchObject({ status: 'complete', generation_id: 'gen_1', op_count: 3 });
    expect(out.at(-1)?.spec).toEqual({
      root: 'card',
      elements: {
        card: { type: 'Card', props: {}, children: ['txt'] },
        txt: { type: 'Text', props: { content: 'Hi' } },
      },
    });
    const body = bodyOf(calls[0]);
    expect(body).toMatchObject({ prompt: 'A card', action_policy: 'declared_only', stream: true });
    expect(body).not.toHaveProperty('prior_spec');
    expect(body).not.toHaveProperty('edit_of');
  });

  it('shows the model the short view, never the spec', async () => {
    const { tools } = setup([]);
    const complete: FraymeComposeOutput = {
      status: 'complete',
      generation_id: 'gen_1',
      op_count: 3,
      restart_count: 0,
      spec: { root: 'x', elements: {} },
    };
    const view = await tools.frayme_compose.toModelOutput?.({ toolCallId: 'c', input: { prompt: 'x' }, output: complete });
    expect(view).toEqual({ type: 'json', value: { generation_id: 'gen_1', status: 'complete', operation_count: 3 } });
  });

  it('drops a prior_spec the model wrote, since it never saw one', () => {
    const parsed = fraymeComposeInputSchema.parse({ prompt: 'x', prior_spec: { root: 'made-up', elements: {} } });
    expect(parsed).not.toHaveProperty('prior_spec');
  });

  it('edit_of attaches the named screen from the history and defaults to edit', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'Make the button red', edit_of: 'gen_1' });
    expect(out.at(-1)?.status).toBe('complete');
    const body = bodyOf(calls[0]);
    expect(body.mode).toBe('edit');
    expect(body.prior_spec).toEqual(SCREEN);
    expect(body).not.toHaveProperty('edit_of');
  });

  it('edit_of keeps an explicit continue_journey', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    await outputs(tools.frayme_compose.execute, { prompt: 'Next step', edit_of: 'gen_1', mode: 'continue_journey' });
    expect(bodyOf(calls[0]).mode).toBe('continue_journey');
  });

  it('an unknown edit_of is an error the model can read, and the turn may compose again', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    const first = await outputs(tools.frayme_compose.execute, { prompt: 'Edit it', edit_of: 'gen_nope' });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ status: 'error', error: { code: UNKNOWN_SCREEN } });
    expect(first[0]?.error?.message).toContain('gen_nope');
    expect(calls).toHaveLength(0);
    const second = await outputs(tools.frayme_compose.execute, { prompt: 'A new card' });
    expect(second.at(-1)?.status).toBe('complete');
  });

  it('mode edit without edit_of is refused before any request', async () => {
    const { tools, calls } = setup([], { messages: history() });
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'Edit it', mode: 'edit' });
    expect(out).toEqual([expect.objectContaining({ status: 'error', error: expect.objectContaining({ code: UNKNOWN_SCREEN }) })]);
    expect(calls).toHaveLength(0);
  });

  it('allows one compose per turn, across both tools', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    const again = await outputs(tools.frayme_compose.execute, { prompt: 'Another card' });
    expect(again).toEqual([expect.objectContaining({ error: expect.objectContaining({ code: ONE_COMPOSE_PER_TURN }) })]);
    const press = await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    expect(press[0]?.error?.code).toBe(ONE_COMPOSE_PER_TURN);
    expect(calls).toHaveLength(1);
  });

  it('a failed compose frees the turn for one more try', async () => {
    const { tools } = setup([{ status: 422, body: JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'bad' } }) }, ok()]);
    const failed = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(failed.at(-1)?.status).toBe('error');
    const retry = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(retry.at(-1)?.status).toBe('complete');
  });

  it('an error mid-stream ends in an error output', async () => {
    const { tools } = setup([ok(frame.started() + frame.errorEvent('UPSTREAM', 'boom'))]);
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(out.at(-1)).toMatchObject({ status: 'error', spec: null });
  });

  it('the host scheme wins over the model, and the rest of context is kept', async () => {
    const { tools, calls } = setup([ok()], { scheme: 'dark' });
    await outputs(tools.frayme_compose.execute, {
      prompt: 'A card',
      context: { theme: 'light', framework_hint: 'dashboard' },
    });
    expect(bodyOf(calls[0]).context).toEqual({ theme: 'dark', framework_hint: 'dashboard' });
  });

  it('sends no context when neither side set one', async () => {
    const { tools, calls } = setup([ok()]);
    await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(bodyOf(calls[0])).not.toHaveProperty('context');
  });

  it('actionPolicy open is passed through', async () => {
    const { tools, calls } = setup([ok()], { actionPolicy: 'open' });
    await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(bodyOf(calls[0]).action_policy).toBe('open');
  });

  it('a missing API key is an error output, not a throw', async () => {
    vi.stubEnv('FRAYME_API_KEY', '');
    const tools = fraymeTools();
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ status: 'error', error: { code: 'CLIENT_ERROR' } });
    expect(out[0]?.error?.message).toContain('FRAYME_API_KEY');
  });

  it('teaches edit_of, not prior_spec, in its examples', () => {
    const { tools } = setup([], { messages: history() });
    const examples = tools.frayme_compose.inputExamples ?? [];
    expect(examples.length).toBeGreaterThan(0);
    for (const { input } of examples) {
      expect(input).not.toHaveProperty('prior_spec');
      expect(fraymeComposeInputSchema.safeParse(input).success).toBe(true);
    }
    expect(examples.some(({ input }) => input.edit_of !== undefined)).toBe(true);
    expect(tools.frayme_compose.description).toContain('edit_of');
  });
});

describe('fraymeTools: frayme_action', () => {
  it('restores the press from the message metadata and the screen from the history', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    const out = await outputs(tools.frayme_action.execute, {
      action: 'showDelayed',
      event: 'commit',
      element_id: 'btn',
      label: 'Show delayed',
      generation_id: 'gen_1',
      prompt: 'Only delayed orders now.',
      data: { orders: [{ id: 'A-1', status: 'Delayed' }] },
      actions: [{ name: 'showAll', role: 'Show all' }],
      signals: { density: 'compact' },
    });
    expect(out.at(-1)?.status).toBe('complete');
    const body = bodyOf(calls[0]);
    expect(body).toMatchObject({
      prompt: 'Only delayed orders now.',
      action_policy: 'declared_only',
      data: { orders: [{ id: 'A-1', status: 'Delayed' }] },
      actions: [{ name: 'showAll', role: 'Show all' }],
      signals: { density: 'compact' },
    });
    // A PRESS IS A CREATE. The pressed screen turns the request into an edit, and
    // action_context reaches no prompt, so neither is sent and there is no mode.
    expect(body).not.toHaveProperty('mode');
    expect(body).not.toHaveProperty('prior_spec');
    expect(body).not.toHaveProperty('action_context');
    // Nothing the user typed, and nothing the screen held, crosses the wire.
    const wire = JSON.stringify(body);
    expect(wire).not.toContain('ordersTable');
    expect(wire).not.toContain('elements');
  });

  it('a model that invents params or state sends neither, because neither is on the wire', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    await outputs(tools.frayme_action.execute, {
      action: 'showDelayed',
      params: { status: 'Invented' },
      state: { made: 'up' },
      element_id: 'other',
    });
    // The old shape forwarded the page's own event so the model could not fake it.
    // A create carries no event at all, so an invention has nowhere to land.
    const wire = JSON.stringify(bodyOf(calls[0]));
    expect(wire).not.toContain('Invented');
    expect(wire).not.toContain('made');
    expect(bodyOf(calls[0])).not.toHaveProperty('action_context');
  });

  it('writes a plain default prompt when the model gives none', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    const prompt = String(bodyOf(calls[0]).prompt);
    expect(prompt).toContain('showDelayed');
    expect(prompt).not.toMatch(/[–—]/);
  });

  it('refuses when the latest user message is not a press', async () => {
    const messages = [...history(), { id: 'u3', role: 'user', parts: [{ type: 'text', text: 'approve it' }] }];
    const { tools, calls } = setup([ok()], { messages });
    const out = await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    expect(out).toEqual([expect.objectContaining({ error: expect.objectContaining({ code: NO_PRESS }) })]);
    expect(calls).toHaveLength(0);
    // The refusal freed the turn: the model can compose instead.
    const composed = await outputs(tools.frayme_compose.execute, { prompt: 'Approve screen' });
    expect(composed.at(-1)?.status).toBe('complete');
  });

  it('refuses a different action or screen than the one pressed', async () => {
    const { tools, calls } = setup([], { messages: history() });
    const wrongAction = await outputs(tools.frayme_action.execute, { action: 'deleteAll' });
    expect(wrongAction[0]?.error?.code).toBe(PRESS_MISMATCH);
    expect(wrongAction[0]?.error?.message).toContain('showDelayed');
    const wrongScreen = await outputs(tools.frayme_action.execute, { action: 'showDelayed', generation_id: 'gen_9' });
    expect(wrongScreen[0]?.error?.code).toBe(PRESS_MISMATCH);
    expect(calls).toHaveLength(0);
  });

  it('without messages, forwards the call as the model wrote it', async () => {
    const { tools, calls } = setup([ok()]);
    await outputs(tools.frayme_action.execute, {
      action: 'approve',
      params: { id: '7' },
      label: 'Approve',
      description: 'Approve it.',
      generation_id: 'gen_1',
    });
    const body = bodyOf(calls[0]);
    expect(body).not.toHaveProperty('action_context');
    expect(body).not.toHaveProperty('prior_spec');
    // The press still reaches the composer, by name, in the prompt.
    expect(String(body.prompt)).toContain('approve');
  });

  it('composes the same way whether or not the pressed screen is in the history', async () => {
    const withScreen = setup([ok()], { messages: history() });
    await outputs(withScreen.tools.frayme_action.execute, { action: 'showDelayed' });
    const without = setup([ok()], { messages: [pressFromUser()] });
    await outputs(without.tools.frayme_action.execute, { action: 'showDelayed' });
    // The screen is never attached, so having it changes nothing about the request.
    expect(bodyOf(without.calls[0])).toEqual(bodyOf(withScreen.calls[0]));
    expect(bodyOf(without.calls[0])).not.toHaveProperty('prior_spec');
  });

  it('reads a press sent the 0.4.0 way, as __frayme_action__ text', () => {
    const legacy = {
      id: 'u9',
      role: 'user',
      parts: [{ type: 'text', text: `__frayme_action__:${JSON.stringify(PRESS)}` }],
    };
    expect(pendingPress([legacy])).toMatchObject({ action: 'showDelayed', params: PRESS.params });
    expect(pendingPress([{ ...legacy, parts: [{ type: 'text', text: '__frayme_action__:{not json' }] }])).toBeUndefined();
  });

  it('pendingPress reads only the latest user message and never throws', () => {
    expect(pendingPress(history())).toMatchObject({ action: 'showDelayed' });
    // A press this turn already answered (the turn carried on in a new request) is not pending.
    expect(pendingPress([pressFromUser(), assistantWithScreen()])).toBeUndefined();
    expect(pendingPress([pressFromUser(), { role: 'user', parts: [] }])).toBeUndefined();
    expect(pendingPress(undefined)).toBeUndefined();
    const hostile = [{ role: 'user', get metadata() { throw new Error('no'); } }];
    expect(pendingPress(hostile)).toBeUndefined();
  });
});

describe('fraymeTools: what the user sees and what the turn allows', () => {
  const unauthorized: ScriptedResponse = {
    status: 401,
    body: JSON.stringify({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Bad key.' } }),
  };
  const rateLimited: ScriptedResponse = {
    status: 429,
    headers: { 'retry-after': '9' },
    body: JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Slow down.' } }),
  };
  const invalid: ScriptedResponse = {
    status: 422,
    body: JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'prior_spec is not a valid spec' } }),
  };

  it('marks every refusal as refused, so a UI shows nothing for it', async () => {
    const withText = [...history(), { id: 'u3', role: 'user', parts: [{ type: 'text', text: 'hi' }] }];
    const noPress = await outputs(setup([], { messages: withText }).tools.frayme_action.execute, { action: 'x' });
    const mismatch = await outputs(setup([], { messages: history() }).tools.frayme_action.execute, { action: 'x' });
    const unknown = await outputs(setup([], { messages: history() }).tools.frayme_compose.execute, {
      prompt: 'x',
      edit_of: 'gen_nope',
    });
    for (const out of [noPress, mismatch, unknown]) {
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ status: 'error', refused: true, error: { retryable: true } });
    }
    const { tools } = setup([ok()]);
    await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    const second = await outputs(tools.frayme_compose.execute, { prompt: 'Again' });
    expect(second[0]).toMatchObject({ refused: true });
  });

  it('a permanent failure keeps the turn: no retry on a bad key or a rate limit', async () => {
    for (const failure of [unauthorized, rateLimited]) {
      const { tools, calls } = setup([failure, ok()]);
      const first = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
      expect(first.at(-1)?.status).toBe('error');
      expect(first.at(-1)?.refused).toBeUndefined();
      const again = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
      expect(again[0]?.error?.code).toBe(ONE_COMPOSE_PER_TURN);
      expect(calls).toHaveLength(1);
    }
  });

  it('the model reads whether a retry can help, and when', async () => {
    const { tools } = setup([rateLimited]);
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    const view = await tools.frayme_compose.toModelOutput?.({ toolCallId: 'c', input: { prompt: 'A card' }, output: out.at(-1)! });
    expect(view).toEqual({
      type: 'json',
      value: expect.objectContaining({ status: 'error', code: 'RATE_LIMITED', retryable: false, retry_after: 9 }),
    });
  });

  it('a missing key is not retried either', async () => {
    vi.stubEnv('FRAYME_API_KEY', '');
    const tools = fraymeTools();
    const first = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(first[0]).toMatchObject({ error: { code: CLIENT_ERROR, retryable: false } });
    const again = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(again[0]?.error?.code).toBe(ONE_COMPOSE_PER_TURN);
  });

  it('an aborted compose keeps the turn', async () => {
    const { tools } = setup([ok()]);
    const controller = new AbortController();
    controller.abort();
    const result = tools.frayme_compose.execute?.({ prompt: 'A card' }, callOptions({ abortSignal: controller.signal }));
    const out: FraymeComposeOutput[] = [];
    for await (const value of result as AsyncIterable<FraymeComposeOutput>) out.push(value);
    expect(out.at(-1)?.error?.code).toBe('ABORTED');
    const again = await outputs(tools.frayme_compose.execute, { prompt: 'A card' });
    expect(again[0]?.error?.code).toBe(ONE_COMPOSE_PER_TURN);
  });

  it('a rejected edit is an error, never a new screen that looks like the edit', async () => {
    const { tools, calls } = setup([invalid, ok()], { messages: history() });
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'Make the button red', edit_of: 'gen_1' });
    expect(out.at(-1)).toMatchObject({ status: 'error', error: { status: 422 } });
    expect(calls).toHaveLength(1);
  });

  it('a rejected screen on a continue_journey is retried without it, and the model is told', async () => {
    // The ONE live path for this retry now: a model that names a screen with
    // edit_of but asks to move on rather than to change it in place.
    const { tools, calls } = setup([invalid, ok()], { messages: history() });
    const out = await outputs(tools.frayme_compose.execute, {
      prompt: 'Next step', edit_of: 'gen_1', mode: 'continue_journey',
    });
    expect(calls).toHaveLength(2);
    expect(bodyOf(calls[0]).prior_spec).toEqual(SCREEN);
    expect(bodyOf(calls[1])).not.toHaveProperty('prior_spec');
    expect(out.at(-1)).toMatchObject({ status: 'complete', prior_spec_dropped: true });
    const view = await tools.frayme_compose.toModelOutput?.({ toolCallId: 'c', input: { prompt: 'Next step' }, output: out.at(-1)! });
    expect(view).toMatchObject({ value: { prior_screen_dropped: true } });
  });

  it('a rejected screen on an EDIT is an error, never a silently fresh screen', async () => {
    // Dropping the spec would answer "change this screen" with a different one.
    const { tools, calls } = setup([invalid], { messages: history() });
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'Red button', edit_of: 'gen_1' });
    expect(calls).toHaveLength(1);
    expect(out.at(-1)?.status).toBe('error');
    expect(out.at(-1)?.prior_spec_dropped).toBeUndefined();
  });

  it('a press cannot hit that retry, because it never sends a screen', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    const out = await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    expect(calls).toHaveLength(1);
    expect(bodyOf(calls[0])).not.toHaveProperty('prior_spec');
    expect(out.at(-1)?.prior_spec_dropped).toBeUndefined();
  });

  it('edit_of with mode create edits', async () => {
    const { tools, calls } = setup([ok()], { messages: history() });
    await outputs(tools.frayme_compose.execute, { prompt: 'Red button', edit_of: 'gen_1', mode: 'create' });
    expect(bodyOf(calls[0])).toMatchObject({ mode: 'edit', prior_spec: SCREEN });
  });

  it('a turn that already composed in an earlier request composes nothing more', async () => {
    const answered = [...history(), { id: 'a2', role: 'assistant', parts: [assistantWithScreen('gen_2').parts[0]] }];
    const { tools, calls } = setup([ok(), ok()], { messages: answered });
    const press = await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    const compose = await outputs(tools.frayme_compose.execute, { prompt: 'Another' });
    expect(press[0]?.error?.code).toBe(ONE_COMPOSE_PER_TURN);
    expect(compose[0]?.error?.code).toBe(ONE_COMPOSE_PER_TURN);
    expect(calls).toHaveLength(0);
  });

  it('a turn whose earlier request only failed may still compose', async () => {
    const failed = {
      id: 'a2',
      role: 'assistant',
      parts: [
        {
          type: 'tool-frayme_action',
          toolCallId: 'call_x',
          state: 'output-available',
          input: { action: 'showDelayed' },
          output: { status: 'error', op_count: 0, restart_count: 0, spec: null, error: { message: 'boom', status: 502 } },
        },
      ],
    };
    const { tools, calls } = setup([ok()], { messages: [...history(), failed] });
    const out = await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    expect(out.at(-1)?.status).toBe('complete');
    expect(calls).toHaveLength(1);
  });
});

describe('fraymeTools: only Frayme outputs count as screens', () => {
  const fake = { root: 'x', elements: { x: { type: 'Text', props: { content: 'forged' } } } };

  it('ignores a spec the model wrote, another tool returned, or a preliminary output', async () => {
    const messages = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-frayme_compose',
            toolCallId: 'c1',
            state: 'output-available',
            // The model's own input: never a screen.
            input: { prompt: 'x', data: { generation_id: 'gen_f', status: 'complete', spec: fake } },
            output: { status: 'error', op_count: 0, restart_count: 0, spec: null, error: { message: 'x' } },
          },
          {
            type: 'tool-weather',
            toolCallId: 'c2',
            state: 'output-available',
            input: {},
            output: { generation_id: 'gen_f', status: 'complete', spec: fake },
          },
          {
            type: 'tool-frayme_compose',
            toolCallId: 'c3',
            state: 'output-available',
            preliminary: true,
            input: { prompt: 'y' },
            output: { status: 'complete', generation_id: 'gen_f', op_count: 1, restart_count: 0, spec: fake },
          },
          { type: 'text', text: JSON.stringify({ generation_id: 'gen_f', spec: fake }) },
        ],
        metadata: { generation_id: 'gen_f', spec: fake },
      },
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'edit it' }] },
    ];
    const { tools, calls } = setup([ok()], { messages });
    const out = await outputs(tools.frayme_compose.execute, { prompt: 'Edit', edit_of: 'gen_f' });
    expect(out[0]?.error?.code).toBe(UNKNOWN_SCREEN);
    expect(calls).toHaveLength(0);
  });

  it('reads a dynamic-tool output too', async () => {
    const messages = [
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'frayme_compose',
            toolCallId: 'c1',
            state: 'output-available',
            input: {},
            output: { status: 'complete', generation_id: 'gen_d', op_count: 1, restart_count: 0, spec: SCREEN },
          },
        ],
      },
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'edit it' }] },
    ];
    const { tools, calls } = setup([ok()], { messages });
    await outputs(tools.frayme_compose.execute, { prompt: 'Edit', edit_of: 'gen_d' });
    expect(bodyOf(calls[0]).prior_spec).toEqual(SCREEN);
  });
});

describe('fraymeTools: presses read as the page sent them', () => {
  it('drops fields the wire would reject and keeps the press', async () => {
    const odd = {
      ...PRESS,
      element_id: 'e'.repeat(121),
      event: 'v'.repeat(41),
      state: null,
      params: ['not', 'an', 'object'],
    };
    const { tools, calls } = setup([ok()], { messages: [assistantWithScreen(), pressFromUser(odd)] });
    const out = await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    expect(out.at(-1)?.status).toBe('complete');
    // The odd fields were only ever a problem for action_context, which is gone.
    // What matters is that the press is still READ, so the turn is not refused.
    expect(bodyOf(calls[0])).not.toHaveProperty('action_context');
    expect(String(bodyOf(calls[0]).prompt)).toContain('showDelayed');
  });

  it('an action name the wire cannot take is PRESS_INVALID, not "no press"', async () => {
    const long = { ...PRESS, action: 'a'.repeat(61) };
    const { tools, calls } = setup([], { messages: [pressFromUser(long)] });
    const out = await outputs(tools.frayme_action.execute, { action: 'a'.repeat(60) });
    expect(out[0]).toMatchObject({ refused: true, error: { code: PRESS_INVALID } });
    expect(calls).toHaveLength(0);
    expect(pendingPress([pressFromUser(long)])).toBeUndefined();
  });

  it('never offers custom components to the model', () => {
    const parsed = fraymeComposeInputSchema.parse({ prompt: 'x', custom_components: [{ name: 'Mine' }] });
    expect(parsed).not.toHaveProperty('custom_components');
  });
});

describe('fraymeTools: requests cut to the API size ceilings', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `R-${i}`, note: 'x'.repeat(40) }));
  const hugeScreen = () => ({
    root: 'r',
    elements: { r: { type: 'Text', props: { content: 'y'.repeat(50_000) } } },
  });

  it('a press on a huge table sends none of it, so there is nothing to trim', async () => {
    const big = { ...PRESS, params: { row: { id: 'R-1' } }, state: { rows: rows(400) } };
    const { tools, calls } = setup([ok()], { messages: [assistantWithScreen(), pressFromUser(big)] });
    const out = await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    const wire = JSON.stringify(bodyOf(calls[0]));
    expect(wire).not.toContain('R-1');
    expect(wire.length).toBeLessThan(400);
    // Trimming existed to fit the state and the screen. Neither is sent now.
    expect(out.every((o) => (o.trimmed ?? []).length === 0)).toBe(true);
  });

  it('a pressed screen too large to send changes nothing, because none is sent', async () => {
    const screen = { ...assistantWithScreen(), parts: [{ ...assistantWithScreen().parts[0], output: { status: 'complete', generation_id: 'gen_1', op_count: 1, restart_count: 0, spec: hugeScreen() } }] };
    const { tools, calls } = setup([ok()], { messages: [screen, pressFromUser()] });
    const out = await outputs(tools.frayme_action.execute, { action: 'showDelayed' });
    expect(bodyOf(calls[0])).not.toHaveProperty('prior_spec');
    expect(out.at(-1)?.trimmed ?? []).toEqual([]);
  });

  it('an edit of a screen too large to send is refused; continuing from it is not', async () => {
    const screen = { ...assistantWithScreen(), parts: [{ ...assistantWithScreen().parts[0], output: { status: 'complete', generation_id: 'gen_1', op_count: 1, restart_count: 0, spec: hugeScreen() } }] };
    const ask = { id: 'u9', role: 'user', parts: [{ type: 'text', text: 'change it' }] };
    const edit = setup([ok()], { messages: [screen, ask] });
    const refused = await outputs(edit.tools.frayme_compose.execute, { prompt: 'Red', edit_of: 'gen_1' });
    expect(refused[0]).toMatchObject({ refused: true, error: { code: SCREEN_TOO_LARGE } });
    expect(edit.calls).toHaveLength(0);
    // The refusal freed the turn.
    const fresh = await outputs(edit.tools.frayme_compose.execute, { prompt: 'A whole new screen' });
    expect(fresh.at(-1)?.status).toBe('complete');

    const next = setup([ok()], { messages: [screen, ask] });
    const out = await outputs(next.tools.frayme_compose.execute, { prompt: 'Next', edit_of: 'gen_1', mode: 'continue_journey' });
    expect(bodyOf(next.calls[0])).toMatchObject({ mode: 'continue_journey' });
    expect(bodyOf(next.calls[0])).not.toHaveProperty('prior_spec');
    expect(out.at(-1)?.trimmed).toEqual(['prior_spec']);
  });
});

describe('fraymeTools without the chat history', () => {
  it('offers no edit_of and says every screen is built whole', () => {
    const { tools } = setup([]);
    const schema = tools.frayme_compose.inputSchema as typeof fraymeComposeInputSchema;
    expect(schema.parse({ prompt: 'x', edit_of: 'gen_1' })).not.toHaveProperty('edit_of');
    expect(tools.frayme_compose.description).not.toContain('edit_of');
    expect(tools.frayme_compose.description).toContain('Describe each screen in full');
    for (const { input } of tools.frayme_compose.inputExamples ?? []) {
      expect(input).not.toHaveProperty('prior_spec');
      expect(input).not.toHaveProperty('edit_of');
    }
  });

  it('keeps the SDK action description and examples, which forward the whole event', () => {
    const bare = setup([]).tools.frayme_action;
    const full = setup([], { messages: history() }).tools.frayme_action;
    expect(bare.description).not.toContain('IN THIS APP');
    expect(full.description).toContain('IN THIS APP');
    expect((bare.inputExamples ?? []).some(({ input }) => input.params !== undefined)).toBe(true);
    for (const { input } of full.inputExamples ?? []) {
      expect(input).not.toHaveProperty('params');
      expect(input).not.toHaveProperty('state');
      expect(input).not.toHaveProperty('description');
      expect(actionInputSchemaAccepts(input)).toBe(true);
    }
  });

  it('mode edit is refused with a reason that fits', async () => {
    const out = await outputs(setup([]).tools.frayme_compose.execute, { prompt: 'x', mode: 'edit' });
    expect(out[0]?.error?.message).toContain('not available');
  });
});

describe('fraymeTools: intents and sources', () => {
  const intents: FraymeIntent[] = [
    { name: 'order_tracking', description: 'Where is my order.', layout: 'A timeline and an address card.' },
  ];

  it('adds lookup_intent and query_source only when given', () => {
    expect(Object.keys(setup([]).tools).sort()).toEqual(['frayme_action', 'frayme_compose']);
    expect(Object.keys(setup([], { intents: [] }).tools).sort()).toEqual(['frayme_action', 'frayme_compose']);
    const full = setup([], { intents, sources: { orders: [{ id: 'A-1' }] } }).tools;
    expect(Object.keys(full).sort()).toEqual(['frayme_action', 'frayme_compose', 'lookup_intent', 'query_source']);
  });

  it('accepts intents read from JSON, and names the field of a bad one', () => {
    const fromJson: Array<Record<string, unknown>> = JSON.parse(
      JSON.stringify([{ ...intents[0], signals: { density: 'compact' } }]),
    );
    expect(setup([], { intents: fromJson }).tools.lookup_intent).toBeDefined();
    const bad = [{ ...intents[0], signals: { density: 'huge' } }];
    expect(() => setup([], { intents: bad })).toThrow(/intents\[0\]\.signals\.density/);
    expect(() => setup([], { intents: [intents[0], intents[0]] })).toThrow(/Duplicate intent name/);
  });

  it('runs both through the AI SDK call shape', async () => {
    const { tools } = setup([], { intents, sources: { orders: [{ id: 'A-1', status: 'Delayed' }, { id: 'A-2' }] } });
    const intent = await tools.lookup_intent?.execute?.({ name: 'order_tracking' }, callOptions());
    expect(intent).toMatchObject({ intent: 'order_tracking', example_call: { prompt: 'A timeline and an address card.' } });
    const rows = await tools.query_source?.execute?.({ source: 'orders', search: 'delayed' }, callOptions());
    expect(rows).toMatchObject({ source: 'orders', matched: 1, rows: [{ id: 'A-1', status: 'Delayed' }] });
  });
});

/* A real agent turn */

type LanguageModelV3StreamPart =
  Awaited<ReturnType<MockLanguageModelV3['doStream']>>['stream'] extends ReadableStream<infer P> ? P : never;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function modelStream(parts: LanguageModelV3StreamPart[]) {
  return {
    stream: new ReadableStream<LanguageModelV3StreamPart>({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  };
}

const toolCallStep = (toolName: string, input: unknown, toolCallId = 'call_1'): LanguageModelV3StreamPart[] => [
  { type: 'stream-start', warnings: [] },
  { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
];

const textStep = (text: string): LanguageModelV3StreamPart[] => [
  { type: 'stream-start', warnings: [] },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage },
];

/** A model that plays the given steps in order and records every prompt it was sent. */
function scriptedModel(steps: LanguageModelV3StreamPart[][]) {
  const prompts: unknown[] = [];
  let step = 0;
  const model = new MockLanguageModelV3({
    doStream: async (options) => {
      prompts.push(options.prompt);
      const parts = steps[step] ?? textStep('done');
      step += 1;
      return modelStream(parts);
    },
  });
  return { model, prompts };
}

async function lastMessage(stream: ReadableStream<never> | AsyncIterable<never>): Promise<UIMessage> {
  let last: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream: stream as never })) last = message;
  if (!last) throw new Error('no message');
  return last;
}

describe('fraymeTools in a streamText turn', () => {
  it('streams the screen to the UI and shows the model only the short view', async () => {
    const { tools, calls } = setup([ok()], { snapshotEveryMs: 0 });
    const { model, prompts } = scriptedModel([toolCallStep('frayme_compose', { prompt: 'A card' }), textStep('Here it is.')]);
    const result = streamText({
      model,
      tools,
      messages: [{ role: 'user', content: 'show me a card' }],
      stopWhen: stepCountIs(4),
    });

    const chunks: Array<Record<string, unknown>> = [];
    for await (const chunk of result.toUIMessageStream()) chunks.push(chunk as Record<string, unknown>);
    const toolOutputs = chunks.filter((c) => c.type === 'tool-output-available');
    expect(toolOutputs.some((c) => c.preliminary === true)).toBe(true);
    const final = toolOutputs.at(-1);
    expect(final?.preliminary).not.toBe(true);
    expect(final?.output).toMatchObject({ status: 'complete', generation_id: 'gen_1' });
    expect((final?.output as FraymeComposeOutput).spec).not.toBeNull();
    expect(calls).toHaveLength(1);

    // The second model call reads the tool result: the view, not the spec.
    expect(prompts).toHaveLength(2);
    const seen = JSON.stringify(prompts[1]);
    expect(seen).toContain('"operation_count":3');
    expect(seen).not.toContain('"elements"');
  });

  it('a saved chat converts back to model messages without the spec', async () => {
    const { tools } = setup([ok()], { snapshotEveryMs: 0 });
    const { model } = scriptedModel([toolCallStep('frayme_compose', { prompt: 'A card' }), textStep('Here it is.')]);
    const result = streamText({ model, tools, messages: [{ role: 'user', content: 'card' }], stopWhen: stepCountIs(4) });
    const assistant = await lastMessage(result.toUIMessageStream() as never);
    const part = assistant.parts.find((p) => p.type === 'tool-frayme_compose') as Record<string, unknown> | undefined;
    expect(part?.state).toBe('output-available');
    expect((part?.output as FraymeComposeOutput).spec).not.toBeNull();

    const modelMessages = await convertToModelMessages(
      [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'card' }] }, assistant],
      { tools },
    );
    const text = JSON.stringify(modelMessages);
    expect(text).toContain('gen_1');
    expect(text).not.toContain('"elements"');
  });

  it('answers a press with the full event and the pressed screen', async () => {
    const messages = history();
    const { tools, calls } = setup([ok(happyPayload({ generation_id: 'gen_2' }))], { messages });
    const { model, prompts } = scriptedModel([
      toolCallStep('frayme_action', {
        action: 'showDelayed',
        event: 'commit',
        element_id: 'btn',
        label: 'Show delayed',
        generation_id: 'gen_1',
        prompt: 'Show only the delayed orders.',
      }),
      textStep('Filtered.'),
    ]);
    const result = streamText({
      model,
      tools,
      messages: await convertToModelMessages(messages as UIMessage[], { tools }),
      stopWhen: stepCountIs(4),
    });
    await result.consumeStream();
    await result.response;

    // The model read the press line, not the metadata or the spec.
    const first = JSON.stringify(prompts[0]);
    expect(first).toContain('frayme_action {\\"action\\":\\"showDelayed\\"');
    expect(first).not.toContain('"elements"');

    const body = bodyOf(calls[0]);
    expect(body).not.toHaveProperty('mode');
    expect(body).not.toHaveProperty('prior_spec');
    expect(body).not.toHaveProperty('action_context');
    expect(body.prompt).toBe('Show only the delayed orders.');
  });

  it('two composes in one step: one runs, the other is refused and draws nothing', async () => {
    const { tools, calls } = setup([ok(), ok()]);
    const { model } = scriptedModel([
      [
        { type: 'stream-start', warnings: [] },
        { type: 'tool-call', toolCallId: 'call_a', toolName: 'frayme_compose', input: JSON.stringify({ prompt: 'A' }) },
        { type: 'tool-call', toolCallId: 'call_b', toolName: 'frayme_compose', input: JSON.stringify({ prompt: 'B' }) },
        { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
      ],
      textStep('ok'),
    ]);
    const result = streamText({ model, tools, messages: [{ role: 'user', content: 'card' }], stopWhen: stepCountIs(4) });
    const chunks: Array<Record<string, unknown>> = [];
    for await (const chunk of result.toUIMessageStream()) chunks.push(chunk as Record<string, unknown>);
    expect(calls).toHaveLength(1);
    const finals = chunks.filter((c) => c.type === 'tool-output-available' && c.preliminary !== true);
    const outputsById = new Map(finals.map((c) => [c.toolCallId, c.output as FraymeComposeOutput]));
    const statuses = [...outputsById.values()].map((o) => (o.refused ? 'refused' : o.status)).sort();
    expect(statuses).toEqual(['complete', 'refused']);
  });

  it('a second compose in the same turn is refused, and the model is told why', async () => {
    const { tools, calls } = setup([ok()]);
    const { model, prompts } = scriptedModel([
      toolCallStep('frayme_compose', { prompt: 'A card' }),
      toolCallStep('frayme_compose', { prompt: 'Another card' }, 'call_2'),
      textStep('ok'),
    ]);
    const result = streamText({ model, tools, messages: [{ role: 'user', content: 'card' }], stopWhen: stepCountIs(5) });
    await result.consumeStream();
    await result.response;
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(prompts[2])).toContain(ONE_COMPOSE_PER_TURN);
  });
});
