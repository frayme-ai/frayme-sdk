/**
 * A press as the user's next chat message, for any host.
 *
 * PURE: no React and no AI SDK import, so a server that receives the runtime's
 * event some other way (its own route, a queue) writes the same message the
 * browser helper does, and an agent reads a press the same way wherever it came
 * from. `@frayme/runtime/ai-sdk` re-exports `pressMessage` for `useChat`.
 */
import type { DynamicActionEvent } from './events.js';
import { paramsWithoutTitleLabel } from './receipt.js';
import { threadState } from './thread-state.js';
import { threadText } from './thread-text.js';

export interface PressMessageOptions {
  /** Append the state block to the text, as the forwarder's default does. Default true. */
  includeState?: boolean;
}

/**
 * The press as thread text: the press (`threadText`), then what the user did
 * locally before it (`threadState`), separated by one blank line so a model
 * reading plain text sees two blocks, not one list. The firing control's own
 * mirror entry is excluded: `threadText` just printed it. An empty state block
 * appends nothing, so an event with no state (or nothing in it beyond the
 * press) gives exactly the press text alone.
 */
export function pressThreadText(event: DynamicActionEvent, includeState = true): string {
  const head = threadText(event.action, paramsWithoutTitleLabel(event));
  if (!includeState) return head;
  const tail = threadState(event.state, { exclude: { elementId: event.element_id, verb: event.event } });
  return tail === '' ? head : `${head}\n\n${tail}`;
}

/** The event fields a model forwards to `frayme_action`, in the order it reads them. */
const PRESS_LINE_KEYS = ['event', 'element_id', 'label', 'generation_id'] as const;

/**
 * The last line of a press message: `frayme_action` and the event without its
 * params and state. It gives the model what it needs to call the tool (the
 * action name above all, which the humanized text does not spell), and stays
 * short: `fraymeTools` in @frayme/api restores params and state from the
 * metadata, where they arrive exactly as the renderer dispatched them.
 */
export function pressLine(event: DynamicActionEvent): string {
  const line: Record<string, string> = { action: event.action };
  for (const key of PRESS_LINE_KEYS) {
    const value = event[key];
    if (typeof value === 'string') line[key] = value;
  }
  return `frayme_action ${JSON.stringify(line)}`;
}

/**
 * A press as the user's next chat message. The text is what the forwarder's
 * default `sendMessage` path writes (`threadText` plus `threadState`), so the
 * agent reads a press the same way whichever path sent it, followed by one
 * `frayme_action {...}` line the agent forwards to that tool. The FULL event
 * rides under `metadata.frayme`: the host's renderer draws the card from it
 * (`fraymePart` finds it there, so the text is never shown), and
 * `fraymeTools` restores the fields the text drops. Pass it to
 * `useChat().sendMessage`.
 */
export function pressMessage(
  event: DynamicActionEvent,
  options: PressMessageOptions = {},
): { text: string; metadata: { frayme: DynamicActionEvent } } {
  return {
    text: `${pressThreadText(event, options.includeState !== false)}\n\n${pressLine(event)}`,
    metadata: { frayme: event },
  };
}
