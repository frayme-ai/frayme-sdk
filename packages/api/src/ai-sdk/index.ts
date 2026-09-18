/**
 * @frayme/api/ai-sdk: the Frayme tools for a Vercel AI SDK agent.
 *
 *   const tools = { ...yourTools, ...fraymeTools({ messages }) };
 *   return streamText({
 *     model, tools,
 *     messages: await convertToModelMessages(messages, { tools }),
 *     stopWhen: stepCountIs(6),
 *   }).toUIMessageStreamResponse();
 *
 * The chat, the model and the loop stay the host's. These tools only compose:
 *
 *  · `frayme_compose` streams the screen as preliminary tool outputs, so the
 *    UI draws it live (`fraymePart` + `<FraymeResult>` in @frayme/runtime).
 *    The model sees only `generation_id`, status and op count, never the spec
 *    (`toModelOutput`, which `convertToModelMessages` applies only when it is
 *    given `{ tools }`).
 *  · `frayme_action` answers a press. The user's message carries the full
 *    event in `metadata.frayme` (`pressMessage` in @frayme/runtime); the model
 *    forwards the short press line it reads, and this tool restores the params
 *    and state from the metadata and the pressed screen from the history.
 *  · `lookup_intent` and `query_source` appear only when the host passes
 *    intents or sources.
 *
 * WHAT "AUTHORITATIVE" MEANS HERE. The press, the history and the screens all
 * come from the client, so they are the user's own data, never trusted input:
 * the server validates every spec and action it is sent. What these tools
 * guarantee is narrower: the model cannot write a press, a screen or a
 * `prior_spec`. Screens are read only from the outputs of Frayme's own tool
 * calls, and a press only from the latest user message.
 *
 * Only types are imported from `ai`, so this entry adds no runtime dependency.
 */
import type { JSONValue, Tool, ToolExecutionOptions } from 'ai';
import type { Spec } from '@json-render/core';
import { z } from 'zod';
import type { ComposeRequest } from '../api-types.js';
import { Frayme } from '../client.js';
import { fitContinuation, jsonSize, type FraymeTrimmed } from '../fit.js';
import { ACTION_NAME_MAX_CHARS, ACTION_NAME_MIN_CHARS, PRIOR_SPEC_MAX_CHARS } from '../limits.js';
import {
  actionInputExamples,
  actionInputSchema,
  actionToolDefinition,
  composeInputExamples,
  composeInputSchema,
  composeToolDefinition,
  type ActionToolInput,
} from '../tools/index.js';
import {
  composeErrorRetryable,
  composeOutputs,
  createComposeGuard,
  fraymeModelView,
  oneComposePerTurnOutput,
  type FraymeComposeOutput,
} from '../agent/compose-outputs.js';
import {
  fraymeIntentSchema,
  lookupIntentTool,
  type FraymeIntent,
  type FraymeIntentExample,
} from '../agent/intents.js';
import { type FraymePress } from '../agent/press.js';
import {
  querySourceTool,
  type FraymeSources,
  type QuerySourceInput,
  type QuerySourceResult,
} from '../agent/sources.js';
import type { FraymeToolSpec } from '../agent/tool-spec.js';

export type { FraymeComposeOutput } from '../agent/compose-outputs.js';

/** The prefix of the press text the 0.4.0 guides sent: `__frayme_action__:` + event JSON. */
const LEGACY_PRESS_PREFIX = '__frayme_action__:';

const FRAYME_TOOL_NAMES: ReadonlySet<string> = new Set(['frayme_compose', 'frayme_action']);
const EDIT_OF_MAX_CHARS = 120;
/**
 * The AI SDK reads every yield as soon as it is made and queues it for the
 * client, so a slow client never makes `composeOutputs` skip a snapshot. The
 * window is the only limit on how many whole-spec snapshots are sent.
 */
const DEFAULT_SNAPSHOT_EVERY_MS = 250;

/** The event field limits the wire enforces; a longer value is dropped, never sent. */
const EVENT_MAX_CHARS = 40;
const ID_MAX_CHARS = 120;

export const NO_PRESS = 'NO_PRESS';
export const PRESS_MISMATCH = 'PRESS_MISMATCH';
export const PRESS_INVALID = 'PRESS_INVALID';
export const UNKNOWN_SCREEN = 'UNKNOWN_SCREEN';
export const SCREEN_TOO_LARGE = 'SCREEN_TOO_LARGE';
export const CLIENT_ERROR = 'CLIENT_ERROR';

const editOfField = z
  .string()
  .min(1)
  .max(EDIT_OF_MAX_CHARS)
  .optional()
  .describe(
    'The generation_id of an earlier screen to build on, from that frayme_compose result. The tool attaches that screen for you. Pair it with mode "edit" (the default when edit_of is set) to change the screen in place, or "continue_journey" for the next step.',
  );

/**
 * `frayme_compose` as the model calls it here. The model never sees a spec, so
 * it cannot pass one back: `prior_spec` is gone (a value the model invents is
 * stripped by the schema) and `edit_of` names the screen instead. Custom
 * component manifests are left out too: they are the host's code, never the
 * model's to write.
 */
export const fraymeComposeInputSchema = composeInputSchema
  .omit({ prior_spec: true, custom_components: true })
  .extend({ edit_of: editOfField });

export type FraymeComposeToolInput = z.infer<typeof fraymeComposeInputSchema>;

/** Without the chat history no earlier screen can be found, so `edit_of` is not offered. */
const composeWithoutHistorySchema = composeInputSchema.omit({ prior_spec: true, custom_components: true });

const COMPOSE_HOST_NOTE =
  '\n\nIN THIS APP: specs never reach you, so never pass `prior_spec`. To edit or continue a screen, pass `edit_of` with its generation_id and the tool attaches that screen. Where an example above shows "prior_spec", send "edit_of" instead.';

const COMPOSE_NO_HISTORY_NOTE =
  '\n\nIN THIS APP: earlier screens are not available to this tool, so never pass `prior_spec`. Describe each screen in full.';

const ACTION_HOST_NOTE =
  '\n\nIN THIS APP: a press reaches you as the user\'s message, ending in a line that starts with "frayme_action" followed by the event JSON. Call frayme_action with that JSON as it is, plus `prompt`, `data`, `actions` and `signals` for the next screen. The tool reads the press from that message and sends none of it onward: the next screen is composed fresh, so name in `data` every value the user entered that it must show, and describe the press in `prompt`. Call frayme_action only for such a press; for anything else, call frayme_compose.';

export interface FraymeToolsOptions {
  /** The API client. Default: `new Frayme()`, which reads `FRAYME_API_KEY` and `FRAYME_BASE_URL`. */
  client?: Frayme;
  /**
   * The chat's UI messages exactly as the client posted them (`useChat` posts
   * them as `messages`), metadata included. They hold what the model never
   * sees: each screen's spec and each press's full event. With them, a press
   * is checked and restored and `edit_of` is offered; without them, a press is
   * forwarded as the model wrote it and every screen is built fresh.
   */
  messages?: readonly unknown[];
  /**
   * This app's intents, offered through `lookup_intent`. Checked against
   * `fraymeIntentSchema` when the tools are built, so intents read from a JSON
   * file (whose enum values TypeScript widens to `string`) are accepted as they
   * are, and a malformed one fails at setup rather than inside a model turn.
   */
  intents?: readonly FraymeIntent[] | readonly unknown[];
  /** This app's data sources, offered through `query_source`. */
  sources?: FraymeSources;
  /** Default `declared_only`: the screen gets no controls beyond the declared actions. */
  actionPolicy?: 'open' | 'declared_only';
  /** The host's colour scheme, sent as `context.theme` on every compose. */
  scheme?: 'light' | 'dark';
  /** At most one live snapshot per this many ms. Default 250. */
  snapshotEveryMs?: number;
}

/**
 * A type alias, not an interface: an alias gets an implicit index signature,
 * so the set spreads into the AI SDK's `ToolSet` (`streamText({ tools })`).
 */
export type FraymeTools = {
  frayme_compose: Tool<FraymeComposeToolInput, FraymeComposeOutput>;
  frayme_action: Tool<ActionToolInput, FraymeComposeOutput>;
  lookup_intent?: Tool<{ name: string }, FraymeIntentExample | { error: string }>;
  query_source?: Tool<QuerySourceInput, QuerySourceResult | { error: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A call the tool turned down before composing: the model can correct it, the user sees nothing. */
function refusal(code: string, message: string): FraymeComposeOutput {
  return {
    status: 'error',
    op_count: 0,
    restart_count: 0,
    spec: null,
    refused: true,
    error: { code, message, retryable: true },
  };
}

/** What the model reads back from a compose: never the spec. */
function toModelOutput({ output }: { output: FraymeComposeOutput }): { type: 'json'; value: JSONValue } {
  return { type: 'json', value: fraymeModelView(output) as JSONValue };
}

/* ── Reading the chat history ─────────────────────────────────────────── */

/** The output of a finished Frayme tool call in a UI message part, or undefined. */
function fraymeOutputOf(part: unknown): Record<string, unknown> | undefined {
  if (!isRecord(part) || part.state !== 'output-available' || part.preliminary === true) return undefined;
  const type = part.type;
  const name =
    type === 'dynamic-tool'
      ? part.toolName
      : typeof type === 'string' && type.startsWith('tool-')
        ? type.slice('tool-'.length)
        : undefined;
  if (typeof name !== 'string' || !FRAYME_TOOL_NAMES.has(name)) return undefined;
  return isRecord(part.output) ? part.output : undefined;
}

/** The index of the last user message, or -1. */
function lastUserIndex(messages: readonly unknown[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message: unknown = messages[i];
    if (isRecord(message) && message.role === 'user') return i;
  }
  return -1;
}

/** Every Frayme tool output in the assistant messages from `from` on, in order. */
function fraymeOutputs(messages: readonly unknown[], from: number): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = Math.max(0, from); i < messages.length; i += 1) {
    const message: unknown = messages[i];
    if (!isRecord(message) || message.role !== 'assistant' || !Array.isArray(message.parts)) continue;
    for (const part of message.parts) {
      const output = fraymeOutputOf(part);
      if (output) out.push(output);
    }
  }
  return out;
}

/**
 * Whether this turn already put a screen up: an assistant message after the
 * latest user message holds a Frayme output that is not an error. That
 * happens when a turn carries on in a new request (after a tool approval, or a
 * tool the client ran), and the turn's one compose is then already spent.
 */
function turnComposed(messages: readonly unknown[] | undefined): boolean {
  if (!Array.isArray(messages)) return false;
  try {
    return fraymeOutputs(messages, lastUserIndex(messages) + 1).some((output) => output.status !== 'error');
  } catch {
    return false;
  }
}

/**
 * The spec a finished screen in this chat showed, found ONLY in the outputs of
 * Frayme's own tool calls: anything the model wrote (a tool input, a text) or
 * another tool returned is never read. The last match wins. A deep copy.
 */
function screenIn(messages: readonly unknown[] | undefined, generationId: string): Spec | undefined {
  if (!Array.isArray(messages) || generationId === '') return undefined;
  try {
    let found: unknown;
    for (const output of fraymeOutputs(messages, 0)) {
      if (output.status === 'complete' && output.generation_id === generationId && isRecord(output.spec)) {
        found = output.spec;
      }
    }
    return found === undefined ? undefined : (structuredClone(found) as Spec);
  } catch {
    return undefined;
  }
}

type PressRead = { press: FraymePress } | { invalid: string };

/**
 * An event as the page sent it, read leniently: the renderer draws a card for
 * any event with an action name, so the tool accepts the same. Only the action
 * name must fit the wire; any other field that does not is dropped.
 */
function looseEvent(value: unknown): PressRead | undefined {
  if (!isRecord(value) || typeof value.action !== 'string') return undefined;
  const action = value.action;
  if (action.length < ACTION_NAME_MIN_CHARS || action.length > ACTION_NAME_MAX_CHARS) {
    return {
      invalid: `The pressed control names an action of ${action.length} characters; action names are ${ACTION_NAME_MIN_CHARS} to ${ACTION_NAME_MAX_CHARS}. Tell the user the button could not be handled.`,
    };
  }
  const press: FraymePress = { action };
  const text = (key: 'event' | 'element_id' | 'generation_id', max: number): void => {
    const field = value[key];
    if (typeof field === 'string' && field.length <= max) press[key] = field;
  };
  text('event', EVENT_MAX_CHARS);
  text('element_id', ID_MAX_CHARS);
  text('generation_id', ID_MAX_CHARS);
  if (typeof value.label === 'string') press.label = value.label;
  if (typeof value.description === 'string') press.description = value.description;
  if (isRecord(value.params)) press.params = value.params;
  if (isRecord(value.state)) press.state = value.state;
  return { press };
}

/** The press on one user message: its metadata first, then a 0.4.0-style press text. */
function pressOn(message: Record<string, unknown>): PressRead | undefined {
  const metadata = message.metadata;
  if (isRecord(metadata) && metadata.frayme !== undefined) {
    const read = looseEvent(metadata.frayme);
    if (read) return read;
  }
  const parts = message.parts;
  if (!Array.isArray(parts)) return undefined;
  for (const part of parts) {
    if (!isRecord(part) || part.type !== 'text' || typeof part.text !== 'string') continue;
    const text = part.text.trimStart();
    if (!text.startsWith(LEGACY_PRESS_PREFIX)) continue;
    try {
      return looseEvent(JSON.parse(text.slice(LEGACY_PRESS_PREFIX.length)));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** The press this turn answers, if any, and whether it could be read. */
function pressState(messages: readonly unknown[] | undefined): PressRead | undefined {
  if (!Array.isArray(messages)) return undefined;
  try {
    const index = lastUserIndex(messages);
    if (index < 0 || turnComposed(messages)) return undefined;
    return pressOn(messages[index] as Record<string, unknown>);
  } catch {
    // A hostile getter or proxy in the history: no press.
    return undefined;
  }
}

/**
 * The press the model is answering this turn: the event on the LAST user
 * message, from its metadata or, failing that, a 0.4.0-style press text.
 * Undefined when that message is not a press, when this turn already
 * answered it, or when the event cannot be sent. Never throws.
 */
export function pendingPress(messages: readonly unknown[] | undefined): FraymePress | undefined {
  const read = pressState(messages);
  return read && 'press' in read ? read.press : undefined;
}

/* ── Setup ─────────────────────────────────────────────────────────────── */

/** The intents as the schema reads them. A bad intent is a setup error, so it throws. */
function parseIntents(intents: readonly unknown[]): FraymeIntent[] {
  return intents.map((intent, i) => {
    const parsed = fraymeIntentSchema.safeParse(intent);
    if (parsed.success) return parsed.data;
    const issue = parsed.error.issues[0];
    const where = [`intents[${i}]`, ...(issue?.path ?? []).map(String)].join('.');
    throw new Error(`Invalid intent at ${where}: ${issue?.message ?? 'not an intent'}`);
  });
}

/** A framework-neutral tool as an AI SDK tool. */
function asAiTool<I, O>(spec: FraymeToolSpec<I, O>): Tool<I, O> {
  return {
    description: spec.description,
    inputSchema: spec.inputSchema,
    execute: (input: I, options: ToolExecutionOptions) => spec.execute(input, { signal: options.abortSignal }),
  } as unknown as Tool<I, O>;
}

/**
 * The compose examples for this host. Example 5 teaches `prior_spec`: with the
 * history it names the screen instead, and without it the example is left
 * out, since no earlier screen can be used.
 */
function composeExamples(withHistory: boolean): Array<{ input: FraymeComposeToolInput }> {
  const out: Array<{ input: FraymeComposeToolInput }> = [];
  for (const example of composeInputExamples) {
    const { prior_spec: prior, custom_components: _custom, ...rest } = example;
    if (prior === undefined) out.push({ input: rest });
    else if (withHistory) out.push({ input: { ...rest, edit_of: 'gen_4b8e1c' } });
  }
  return out;
}

/** The action examples as the model sees a press here: the press line, then its own additions. */
function pressLineExamples(): Array<{ input: ActionToolInput }> {
  return actionInputExamples.map((example) => {
    const input: ActionToolInput = { action: example.action };
    for (const key of ['event', 'element_id', 'label', 'generation_id', 'prompt'] as const) {
      if (example[key] !== undefined) input[key] = example[key];
    }
    if (example.data !== undefined) input.data = example.data;
    if (example.actions !== undefined) input.actions = example.actions;
    if (example.signals !== undefined) input.signals = example.signals;
    return { input };
  });
}

/**
 * The Frayme tools for one agent turn. Create them per request, with that
 * request's `messages`: the tools share one compose per turn, and read the
 * press and the earlier screens from those messages. A set created once and
 * reused would spend its one compose on the first request.
 */
export function fraymeTools(options: FraymeToolsOptions = {}): FraymeTools {
  const messages = options.messages;
  const withHistory = messages !== undefined;
  const actionPolicy = options.actionPolicy ?? 'declared_only';
  const snapshotEveryMs = options.snapshotEveryMs ?? DEFAULT_SNAPSHOT_EVERY_MS;
  const guard = createComposeGuard();
  // A turn that carries on in a new request has already used its compose.
  if (turnComposed(messages)) guard.claim();
  let client = options.client;

  /** The host's context wins over the model's: the host knows the surface it draws on. */
  const withContext = (context: ComposeRequest['context']): ComposeRequest['context'] => {
    const merged = { ...context };
    if (options.scheme !== undefined) merged.theme = options.scheme;
    return Object.keys(merged).length > 0 ? merged : undefined;
  };

  /** Run one compose as outputs, claiming the turn's one compose first. */
  async function* run(
    build: () => { request: Omit<ComposeRequest, 'stream'>; trimmed: FraymeTrimmed[] } | FraymeComposeOutput,
    signal: AbortSignal | undefined,
  ): AsyncGenerator<FraymeComposeOutput, void, undefined> {
    if (!guard.claim()) {
      yield oneComposePerTurnOutput();
      return;
    }
    let last: FraymeComposeOutput | undefined;
    try {
      const built = build();
      if ('status' in built) {
        last = built;
        yield built;
        return;
      }
      const { request, trimmed } = built;
      // Built on first use, so a missing key is an error output, not a throw at setup.
      client ??= new Frayme();
      for await (const output of composeOutputs(client, request, {
        signal,
        snapshotEveryMs,
        // An edit the server rejects must not quietly become a new screen:
        // the model would report a change that never happened.
        retryWithoutPriorSpec: request.mode !== 'edit',
      })) {
        last = trimmed.length > 0 ? { ...output, trimmed } : output;
        yield last;
      }
    } catch (err) {
      // A setup problem (no API key): no retry this turn can fix it.
      last = {
        status: 'error',
        op_count: 0,
        restart_count: 0,
        spec: null,
        error: {
          code: CLIENT_ERROR,
          message: err instanceof Error ? err.message : 'The compose could not start.',
          retryable: false,
        },
      };
      yield last;
    } finally {
      // A failed compose put nothing on screen the user can act on. When a
      // second call could succeed, the turn's compose is handed back for it;
      // a permanent failure (a key, a plan limit, a rate limit, an abort)
      // keeps it, so the model does not spend the turn's steps retrying.
      if (last?.status === 'error' && composeErrorRetryable(last.error)) guard.release();
    }
  }

  const frayme_compose: Tool<FraymeComposeToolInput, FraymeComposeOutput> = {
    description: composeToolDefinition.description + (withHistory ? COMPOSE_HOST_NOTE : COMPOSE_NO_HISTORY_NOTE),
    inputSchema: (withHistory ? fraymeComposeInputSchema : composeWithoutHistorySchema) as typeof fraymeComposeInputSchema,
    inputExamples: composeExamples(withHistory),
    execute: (input, { abortSignal }) =>
      run(() => {
        const { edit_of: editOf, context, ...rest } = input;
        const request: Omit<ComposeRequest, 'stream'> = { ...rest, action_policy: actionPolicy };
        const merged = withContext(context);
        if (merged) request.context = merged;
        const trimmed: FraymeTrimmed[] = [];
        if (editOf !== undefined) {
          const prior = screenIn(messages, editOf);
          if (!prior) {
            return refusal(
              UNKNOWN_SCREEN,
              `No finished screen with generation_id "${editOf.slice(0, EDIT_OF_MAX_CHARS)}" is in this chat. Check the id from an earlier frayme_compose result, or leave edit_of out to build a new screen.`,
            );
          }
          request.mode = input.mode === 'continue_journey' ? 'continue_journey' : 'edit';
          const size = jsonSize(prior);
          if (size <= PRIOR_SPEC_MAX_CHARS) {
            request.prior_spec = prior;
          } else if (request.mode === 'edit') {
            // An edit needs the screen it changes; one too large to send cannot be edited.
            return refusal(
              SCREEN_TOO_LARGE,
              `The screen ${editOf.slice(0, EDIT_OF_MAX_CHARS)} is too large to edit (${size.toLocaleString('en-US')} of ${PRIOR_SPEC_MAX_CHARS.toLocaleString('en-US')} characters). Leave edit_of out and describe the whole new screen instead.`,
            );
          } else {
            trimmed.push('prior_spec');
          }
        } else if (input.mode === 'edit') {
          return refusal(
            UNKNOWN_SCREEN,
            withHistory
              ? 'mode "edit" needs edit_of, the generation_id of the screen to change.'
              : 'Earlier screens are not available here, so mode "edit" cannot be used. Describe the whole screen instead.',
          );
        }
        return { request, trimmed };
      }, abortSignal),
    toModelOutput,
  };

  const frayme_action: Tool<ActionToolInput, FraymeComposeOutput> = {
    description: actionToolDefinition.description + (withHistory ? ACTION_HOST_NOTE : ''),
    inputSchema: actionInputSchema,
    inputExamples: withHistory ? pressLineExamples() : actionInputExamples.map((input) => ({ input })),
    execute: (input, { abortSignal }) =>
      run(() => {
        let press: FraymePress = input;
        if (withHistory) {
          const read = pressState(messages);
          if (!read) {
            return refusal(
              NO_PRESS,
              'frayme_action answers a press the user made on a screen, and the latest user message is not an unanswered press. To show a screen, call frayme_compose.',
            );
          }
          if ('invalid' in read) return refusal(PRESS_INVALID, read.invalid);
          const pending = read.press;
          if (
            input.action !== pending.action ||
            (input.generation_id !== undefined &&
              pending.generation_id !== undefined &&
              input.generation_id !== pending.generation_id)
          ) {
            return refusal(
              PRESS_MISMATCH,
              `The user pressed "${pending.action}"${pending.generation_id ? ` on ${pending.generation_id}` : ''}. Call frayme_action with that event as it is.`,
            );
          }
          // The event the user's page sent wins over the model's copy of it;
          // only the next screen's inputs are the model's own.
          press = { ...pending };
          if (input.prompt !== undefined) press.prompt = input.prompt;
          if (input.data !== undefined) press.data = input.data;
          if (input.actions !== undefined) press.actions = input.actions;
          if (input.signals !== undefined) press.signals = input.signals;
        }

        // A PRESS IS A CREATE, NOT AN EDIT, and the pressed screen is deliberately
        // NOT attached. `prior_spec` reaches the composer as "the user is EDITING an
        // existing UI, REUSE the same element ids", so a press answered that way
        // hands the same screen back instead of moving the journey on. Measured on a
        // filled 16-element form: with the screen attached, two runs produced no
        // usable next screen; as a create carrying the values, both produced one on a
        // single pass, at an eighth of the bytes.
        //
        // `action_context` is not attached either. No prompt reads that field, so the
        // state posted there conveyed nothing to the model while still crossing the
        // wire, typed values and all.
        //
        // A press therefore reaches the composer the way an ask does: named in the
        // prompt, with the values the next screen must show in `data`. Two rules the
        // caller has to keep, both of which the tool's description states:
        //   press meta goes in the PROMPT, never in `data`, because a `data` key the
        //     composer does not use is rendered on the screen as a detail card;
        //   `actions` names only what leads FORWARD, never the control just pressed,
        //     because a declared action with required params that nothing binds makes
        //     the server re-inject the form the next screen was meant to replace.
        const request: Omit<ComposeRequest, 'stream'> = {
          prompt: press.prompt ?? `The user pressed the "${press.action}" control. Show the next step.`,
          action_policy: actionPolicy,
        };
        const context = withContext(undefined);
        if (context) request.context = context;
        if (press.data !== undefined) request.data = press.data;
        if (press.actions !== undefined) request.actions = press.actions;
        if (press.signals !== undefined) request.signals = press.signals;
        return { request, trimmed: [] };
      }, abortSignal),
    toModelOutput,
  };

  const tools: FraymeTools = { frayme_compose, frayme_action };
  const intents =
    options.intents && options.intents.length > 0 ? lookupIntentTool(parseIntents(options.intents)) : undefined;
  if (intents) tools.lookup_intent = asAiTool(intents);
  const sources = options.sources ? querySourceTool(options.sources) : undefined;
  if (sources) tools.query_source = asAiTool(sources);
  return tools;
}
