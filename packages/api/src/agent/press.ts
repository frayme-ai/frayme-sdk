/**
 * Presses: a user's action on a rendered screen, as it travels back to the agent.
 *
 * A host moves the runtime's action event through its own chat plumbing: as
 * the message itself, wrapped as `{ frayme }`, or in message metadata. These
 * helpers read it back from any of those, turn it into the wire's
 * `action_context`, and find the spec the press was made on so the next
 * compose can build on it. All of them read chat history, which is content:
 * none of them throws.
 */
import type { Spec } from '@json-render/core';
import type { ComposeActionContext } from '../api-types.js';
import { actionInputSchema, type ActionToolInput } from '../tools/index.js';

export type FraymePress = ActionToolInput;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePress(value: unknown): FraymePress | undefined {
  const parsed = actionInputSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Read a press from the event itself, `{ frayme: event }`, or
 * `{ metadata: { frayme: event } }`. Returns undefined for anything else,
 * including an event that fails the `frayme_action` schema.
 */
export function readPress(value: unknown): FraymePress | undefined {
  try {
    const direct = parsePress(value);
    if (direct || !isRecord(value)) return direct;
    const wrapped = value.frayme !== undefined ? parsePress(value.frayme) : undefined;
    if (wrapped) return wrapped;
    const metadata = value.metadata;
    return isRecord(metadata) && metadata.frayme !== undefined ? parsePress(metadata.frayme) : undefined;
  } catch {
    // A hostile getter or proxy in the history: treat it as no press.
    return undefined;
  }
}

/**
 * The part of a press the server accepts as `action_context`. The server keeps
 * that object strict, so the host-only fields (`label`, `description`) and the
 * next screen's inputs (`prompt`, `data`, `actions`, `signals`) are dropped.
 */
export function actionContextOf(press: FraymePress): ComposeActionContext {
  const context: ComposeActionContext = { action: press.action };
  if (press.event !== undefined) context.event = press.event;
  if (press.params !== undefined) context.params = press.params;
  if (press.state !== undefined) context.state = press.state;
  if (press.element_id !== undefined) context.element_id = press.element_id;
  if (press.generation_id !== undefined) context.generation_id = press.generation_id;
  return context;
}

// Chat histories nest tool outputs a few levels down (message, part, output).
// These bounds keep a walk over a long or hostile history cheap.
const MAX_DEPTH = 16;
const MAX_NODES = 100_000;

/**
 * Find the spec a generation produced, anywhere in a chat history: an object
 * with this `generation_id`, a `spec` object, and a `complete` status (or no
 * status at all, as on a plain compose result). The LAST match wins, so a
 * spec saved later in the history beats an earlier copy. Returns a deep copy.
 */
export function findPriorSpec(messages: unknown, generationId: string): Spec | undefined {
  if (typeof generationId !== 'string' || generationId === '') return undefined;
  let found: Spec | undefined;
  let visited = 0;
  // Ancestors, not every node seen: a shared object may appear twice in a
  // history and both places count for "last match wins"; only a cycle stops.
  const ancestors = new Set<object>();

  const walk = (value: unknown, depth: number): void => {
    if (typeof value !== 'object' || value === null) return;
    if (depth > MAX_DEPTH || visited >= MAX_NODES || ancestors.has(value)) return;
    visited += 1;
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1);
        return;
      }
      const record = value as Record<string, unknown>;
      const spec = record.spec;
      if (typeof record.generation_id === 'string' && isRecord(spec)) {
        if (
          record.generation_id === generationId &&
          (record.status === undefined || record.status === 'complete')
        ) {
          found = spec as unknown as Spec;
        }
        // A spec never holds another generation's output: skip walking it.
        for (const [key, child] of Object.entries(record)) {
          if (key !== 'spec') walk(child, depth + 1);
        }
        return;
      }
      for (const child of Object.values(record)) walk(child, depth + 1);
    } finally {
      ancestors.delete(value);
    }
  };

  try {
    walk(messages, 0);
    return found === undefined ? undefined : structuredClone(found);
  } catch {
    return undefined;
  }
}
