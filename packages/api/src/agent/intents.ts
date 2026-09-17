/**
 * Intents: an app's own worked `frayme_compose` calls.
 *
 * The SDK's tool JSON already teaches the call shape with generic examples. An
 * intent is the same thing written by the app for its own screens: a layout
 * prompt plus the signals and actions that app uses. The HOST AGENT reads one
 * through the `lookup_intent` tool and then writes its own compose call with
 * the real data. Intents never reach `/v1/compose` and are never merged into a
 * request; they only inform what the agent writes.
 */
import { z } from 'zod';
import { composeInputSchema, type ComposeToolInput } from '../tools/index.js';
import type { FraymeToolSpec } from './tool-spec.js';

export interface FraymeIntent {
  /** Lowercase identifier the agent passes to `lookup_intent`. */
  name: string;
  /** When this intent applies, in one line. Listed in the tool description. */
  description: string;
  /** The example `prompt`: the layout, regions and behaviour of the screen. */
  layout: string;
  signals?: ComposeToolInput['signals'];
  actions?: ComposeToolInput['actions'];
}

const INTENT_NAME = /^[a-z][a-z0-9_]{1,39}$/;

/**
 * Validates an intent where it is authored (a settings screen, a config file).
 * Strict at the top level so a misspelt key is an error rather than a silently
 * dropped setting. `none` is reserved: agents use it to mean "no intent fits".
 */
export const fraymeIntentSchema = z.strictObject({
  name: z
    .string()
    .regex(INTENT_NAME, 'Intent names are 2 to 40 characters: a lowercase letter, then lowercase letters, digits or underscores.')
    .refine((name) => name !== 'none', { message: 'The intent name "none" is reserved.' }),
  description: z.string().min(1).max(200),
  layout: z.string().min(1).max(800),
  signals: composeInputSchema.shape.signals,
  // A duplicate action name would be two declarations fighting over one binding.
  actions: composeInputSchema.shape.actions.refine(
    (actions) => actions === undefined || new Set(actions.map((a) => a.name)).size === actions.length,
    { message: 'Action names must be unique within an intent.' },
  ),
});

/** What `lookup_intent` returns: the intent as an example compose call. */
export interface FraymeIntentExample {
  intent: string;
  description: string;
  example_call: {
    prompt: string;
    signals?: ComposeToolInput['signals'];
    actions?: ComposeToolInput['actions'];
  };
}

/**
 * The intent in the shape of a `frayme_compose` call. Empty signals or actions
 * are left out so the example never teaches an empty field. Everything is
 * deep-copied: an agent framework may keep or mutate a tool result, and that
 * must never reach the app's intent list.
 */
export function intentExample(intent: FraymeIntent): FraymeIntentExample {
  const example_call: FraymeIntentExample['example_call'] = { prompt: intent.layout };
  if (intent.signals && Object.keys(intent.signals).length > 0) {
    example_call.signals = structuredClone(intent.signals);
  }
  if (intent.actions && intent.actions.length > 0) {
    example_call.actions = structuredClone(intent.actions);
  }
  return { intent: intent.name, description: intent.description, example_call };
}

/**
 * The `lookup_intent` tool, or `undefined` when the app has no intents (a tool
 * with nothing to look up only costs the model a decision).
 *
 * Duplicate names throw here, when the tool is built: that is a configuration
 * error the developer must see. Once built, the tool never throws.
 */
export function lookupIntentTool(
  intents: readonly FraymeIntent[],
): FraymeToolSpec<{ name: string }, FraymeIntentExample | { error: string }> | undefined {
  if (intents.length === 0) return undefined;

  // Examples are built (and so cloned once) up front: anything in an intent
  // that cannot be copied fails at build time, not inside a model turn.
  const examples = new Map<string, FraymeIntentExample>();
  for (const intent of intents) {
    if (examples.has(intent.name)) {
      throw new Error(`Duplicate intent name "${intent.name}". Intent names must be unique.`);
    }
    examples.set(intent.name, intentExample(intent));
  }
  const names = [...examples.keys()];

  const description = [
    "Look up one of this app's intents. Intents are this app's own example frayme_compose calls, in the same shape as the examples in the frayme_compose description: a layout prompt plus the signals and actions this app uses for that kind of screen.",
    '',
    'Intents:',
    ...intents.map((intent) => `- ${intent.name}: ${intent.description}`),
    '',
    "When the user's request matches an intent, read it with this tool first. Then write your own frayme_compose call: keep the layout, signals and actions that fit, put the real facts for this request in `data`, and never copy example values as facts.",
  ].join('\n');

  return {
    name: 'lookup_intent',
    description,
    inputSchema: z.object({
      name: z.enum(names as [string, ...string[]]).describe('The intent to read.'),
    }),
    execute: async (input) => {
      const name = typeof input?.name === 'string' ? input.name : '';
      const example = examples.get(name);
      if (!example) {
        // The name is model input: echo a bounded slice, never the whole string.
        return { error: `Unknown intent "${name.slice(0, 80)}". Known intents: ${names.join(', ')}.` };
      }
      return structuredClone(example);
    },
  };
}
