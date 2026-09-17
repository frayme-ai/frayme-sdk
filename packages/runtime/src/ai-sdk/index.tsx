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
 *
 * Client side, with the Frayme tools on the host's agent (the tool outputs
 * carry the screen, and a press goes back as the user's next message):
 *   {message.parts.map((part, i) => {
 *     const hit = fraymePart(part, message);
 *     return hit && <FraymeResult key={i} {...hit} onPress={(e) => sendMessage(pressMessage(e))} />;
 *   })}
 */
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { SPEC_DATA_PART_TYPE } from '@json-render/core';
import type { DynamicActionEvent, OnDynamicAction } from '../core/events.js';
import type { FraymeResultOutput } from '../react/result.js';
import { pressThreadText } from '../core/press-message.js';
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

/**
 * The message's `data-spec` parts, deep-copied. `buildSpecFromParts` patches in
 * place, and a flat part is folded in with `Object.assign`, so every patch after
 * it wrote INTO that part's own spec: the message in the chat's store changed
 * under the host, and the next rebuild of the same parts started from the
 * patched copy and applied each patch a second time. Parts are JSON off the
 * wire, so the fallbacks only matter for a host that put something else there:
 * a JSON copy for what structuredClone refuses, then the parts as they are
 * (the old behaviour) rather than a blank screen.
 */
function copySpecParts(parts: DataPart[] | undefined): DataPart[] {
  if (!Array.isArray(parts)) return [];
  const specParts = parts.filter((part) => part != null && part.type === SPEC_DATA_PART_TYPE);
  try {
    return structuredClone(specParts);
  } catch {
    try {
      return JSON.parse(JSON.stringify(specParts)) as DataPart[];
    } catch {
      return specParts;
    }
  }
}

/** Render the json-render spec carried in an AI SDK message's `data-spec` parts. */
export function FraymeMessageRenderer({
  message,
  mode = 'progressive',
  ...rendererProps
}: FraymeMessageRendererProps): ReactNode {
  const spec = useMemo(() => buildSpecFromParts(copySpecParts(message.parts)), [message.parts]);
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
      : pressThreadText(event, options.includeState !== false);
    return options.sendMessage?.({ text }); // text fallback
  };
}

/* ── Frayme tools inside the host's own chat ──────────────────────────────── */

/** The tool names the Frayme agent tools register under. */
const FRAYME_TOOL_NAMES: ReadonlySet<string> = new Set(['frayme_compose', 'frayme_action']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The tool a part belongs to: `tool-<name>` for a static tool, `toolName` for a dynamic one. */
function toolNameOf(part: Record<string, unknown>): string | undefined {
  const type = part.type;
  if (type === 'dynamic-tool') return typeof part.toolName === 'string' ? part.toolName : undefined;
  if (typeof type === 'string' && type.startsWith('tool-')) return type.slice('tool-'.length);
  return undefined;
}

/**
 * Whether a failed Frayme call was followed, in the same message, by another
 * Frayme call that was not refused: the model tried again, and the old error
 * would sit above the screen that replaced it. Needs the message's parts; a
 * caller that passes no message keeps every error.
 */
function supersededInMessage(part: Record<string, unknown>, message: { parts?: readonly unknown[] } | undefined): boolean {
  const parts = message?.parts;
  if (!Array.isArray(parts)) return false;
  const at = parts.indexOf(part);
  if (at < 0) return false;
  for (let i = at + 1; i < parts.length; i += 1) {
    const later: unknown = parts[i];
    if (!isRecord(later)) continue;
    const name = toolNameOf(later);
    if (name === undefined || !FRAYME_TOOL_NAMES.has(name)) continue;
    // Still running, or finished with anything but a refusal.
    if (later.state === 'input-streaming' || later.state === 'input-available') return true;
    if (later.state === 'output-available' && !(isRecord(later.output) && later.output.refused === true)) return true;
  }
  return false;
}

/**
 * What, if anything, a message part has for `<FraymeResult>`:
 *
 *  · a `frayme_compose` / `frayme_action` tool part (static `tool-<name>`, or a
 *    `dynamic-tool` with that `toolName`) in state `output-available` whose
 *    output is an object with a `status` → `{ output, final }`, where `final`
 *    is false only for a preliminary (still streaming) output. A refused
 *    output (`refused: true`, written for the model) is `null`, and so is an
 *    error the model already retried later in the same message (pass the
 *    message for that);
 *  · a text part of a USER message whose `metadata.frayme` is an event with an
 *    `action` name (what `pressMessage` sends) → `{ press }`;
 *  · anything else → `null`.
 *
 * Reads structurally, so it needs no `ai` import and never throws on a part it
 * does not recognise. A press whose `params` is not an object is handed on with
 * `params: {}`; the output is handed on as it is, since `<FraymeResult>` reads
 * it defensively and never mutates it. A user message carries one text part
 * per `pressMessage`, so one press yields one card.
 */
export function fraymePart(
  part: unknown,
  message?: { role?: string; metadata?: unknown; parts?: readonly unknown[] },
): { output: FraymeResultOutput; final: boolean } | { press: DynamicActionEvent } | null {
  if (!isRecord(part)) return null;

  const toolName = toolNameOf(part);
  if (toolName !== undefined) {
    if (!FRAYME_TOOL_NAMES.has(toolName) || part.state !== 'output-available') return null;
    const output = part.output;
    if (!isRecord(output) || typeof output.status !== 'string') return null;
    // A refusal is the tool talking to the model; the user has nothing to see.
    if (output.refused === true) return null;
    if (output.status === 'error' && supersededInMessage(part, message)) return null;
    return { output: output as unknown as FraymeResultOutput, final: part.preliminary !== true };
  }

  if (part.type === 'text' && message?.role === 'user' && isRecord(message.metadata)) {
    const event = message.metadata.frayme;
    if (!isRecord(event) || typeof event.action !== 'string') return null;
    const press = (isRecord(event.params) ? event : { ...event, params: {} }) as unknown as DynamicActionEvent;
    return { press };
  }

  return null;
}

// The press message is pure and lives in the core, so a server can write it too.
export { pressMessage, type PressMessageOptions } from '../core/press-message.js';
