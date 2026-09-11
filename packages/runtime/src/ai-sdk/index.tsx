'use client';
/**
 * @frayme/runtime/ai-sdk — Vercel AI SDK adapter.
 *
 * Server side (route handler — import from '@frayme/runtime', NOT this module):
 *   const stream = frayme.compose.stream({ prompt });
 *   for await (const part of composeStreamToDataParts(stream)) {
 *     writer.write({ type: 'data-spec', data: part });
 *   }
 *
 * Client side:
 *   const { messages, addToolResult, sendMessage } = useChat();
 *   <FraymeMessageRenderer
 *     message={message}
 *     onDynamicAction={createDynamicActionForwarder({ sendMessage })}
 *   />
 */
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { SPEC_DATA_PART_TYPE } from '@json-render/core';
import type { DynamicActionEvent, OnDynamicAction } from '../core/events.js';
import { paramsWithoutTitleLabel } from '../core/receipt.js';
import { threadState } from '../core/thread-state.js';
import { threadText } from '../core/thread-text.js';
import { FraymeRenderer, type FraymeRendererProps } from '../react/FraymeRenderer.js';
import { buildSpecFromParts, type DataPart } from '../react/upstream.js';

export { SPEC_DATA_PART_TYPE };

/** Minimal structural view of an AI SDK UIMessage — no `ai` import required here. */
export interface MessageLike {
  parts?: DataPart[];
}

export interface FraymeMessageRendererProps extends Omit<FraymeRendererProps, 'spec' | 'mode'> {
  message: MessageLike;
  /**
   * Defaults to `progressive`: parts stream in live, and the server already
   * validated before billing. A final `flat` part naturally implements the
   * restart-discard semantics (it replaces the whole snapshot).
   */
  mode?: FraymeRendererProps['mode'];
}

/** Render the json-render spec carried in an AI SDK message's `data-spec` parts. */
export function FraymeMessageRenderer({
  message,
  mode = 'progressive',
  ...rendererProps
}: FraymeMessageRendererProps): ReactNode {
  const spec = useMemo(() => buildSpecFromParts(message.parts ?? []), [message.parts]);
  if (!spec) return null;
  return <FraymeRenderer spec={spec} mode={mode} {...rendererProps} />;
}

export interface DynamicActionForwarderOptions {
  /**
   * STRUCTURED sink (preferred) — receives the FULL enriched event
   * (`{action, event, params, state, generation_id, element_id, label, description}`),
   * losslessly. Wire it to the `frayme_action` round-trip tool (call its
   * `execute` → `/v1/compose` with `action_context`), or to your own handling —
   * and hand the same event to `<FraymeActionReceipt event={e} />` to show the
   * press as a card in the thread. When set, this takes precedence over
   * `sendMessage`. (NOTE: `useChat().addToolResult` does NOT fit here — it
   * resolves an AGENT-initiated tool call; a user click has no pending call.)
   */
  onAction?: (event: DynamicActionEvent) => unknown;
  /**
   * Fallback sink — `useChat().sendMessage`. The action is delivered as the
   * user's next message (text); the agent's `frayme_compose` tool takes it from
   * there. LOSSY: `action` + `params` survive as `threadText`, and `state` as
   * the compact `threadState` block appended under it (the agent must read all
   * three channels, and before that block existed this path dropped the third:
   * every gesture the carrier gate had batched into `state._ui` vanished on a
   * text-only host). `event` / `generation_id` /
   * `element_id` / `label` / `description` still do not survive. Prefer
   * `onAction` for the full round trip.
   */
  sendMessage?: (message: { text: string }) => unknown;
  /**
   * Append the state block to the default `sendMessage` text. Default TRUE:
   * `false` sends the name + params text alone —
   * `threadText(action, params minus the control's own label)`, e.g.
   * "Approve refund\n- Order ID: 4821" — for a host whose agent already reads
   * state from elsewhere, or one that prints `threadState(event.state, …)`
   * itself. Ignored when `format` is set.
   *
   * NOTE: no option restores the pre-receipt default. Previously the text was
   * `${action}: ${JSON.stringify(params)}` ("approveRefund: {"orderId":"4821"}")
   * — which read as code in a chat thread — and that form is gone. A host whose
   * agent parses it can keep it byte-for-byte with
   * `format: (a, p) => Object.keys(p).length ? `${a}: ${JSON.stringify(p)}` : a`.
   */
  includeState?: boolean;
  /**
   * Optional formatter for the `sendMessage` text. Default: `threadText(action,
   * params)` — the humanized action name, then one `- Key: value` bullet per
   * non-blank param (core/thread-text.ts), with the
   * pressed control's own `label` entry left OUT of the bullets (a Button's
   * payload carries `{ label }`; the shape is "no button label", and the
   * card drops the same entry — core/receipt.ts `paramsWithoutTitleLabel`) —
   * then, unless `includeState` is `false`, a blank line and
   * `threadState(event.state, { exclude: { elementId, verb } })`: an "Also
   * recorded" heading, one bullet per local gesture in `state._ui` (the firing
   * control's own mirror excluded — it IS the action) and one per bound value
   * (core/thread-state.ts). The old default, `action: {json params}`, read as
   * code in a chat thread, so it was replaced.
   *
   * A custom `format` REPLACES the whole text, state block included: it
   * receives the params AS DISPATCHED (label entry included — dropping it is
   * the default's rule, not the contract) plus the full event as a third
   * argument, so a host can head its own text with `event.label`, quote
   * `event.description`, and call `threadState(event.state, …)` itself where
   * it wants the state to land.
   */
  format?: (action: string, params: Record<string, unknown>, event: DynamicActionEvent) => string;
}

/** Bridge spec-bound dynamic actions back into the AI SDK chat loop. */
export function createDynamicActionForwarder(
  options: DynamicActionForwarderOptions,
): OnDynamicAction {
  return (event) => {
    if (options.onAction) return options.onAction(event); // structured, full event
    const text = options.format
      ? options.format(event.action, event.params, event)
      : defaultText(event, options.includeState !== false);
    return options.sendMessage?.({ text }); // text fallback
  };
}

/**
 * The default `sendMessage` text: the press (`threadText`), then what the user
 * did locally before it (`threadState`), separated by
 * one blank line so a model reading plain text sees two blocks, not one list.
 * The firing control's own mirror entry is excluded: `threadText` just printed
 * it. An empty state block appends nothing, so an event with no state (or
 * nothing in it beyond the press) sends exactly the press text alone.
 */
function defaultText(event: DynamicActionEvent, includeState: boolean): string {
  const head = threadText(event.action, paramsWithoutTitleLabel(event));
  if (!includeState) return head;
  const tail = threadState(event.state, { exclude: { elementId: event.element_id, verb: event.event } });
  return tail === '' ? head : `${head}\n\n${tail}`;
}
