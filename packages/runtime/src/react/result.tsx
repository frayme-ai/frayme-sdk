'use client';
/**
 * FRAYME RESULT: one Frayme result inside a developer's own chat.
 *
 *   {message.parts.map((part, i) => {
 *     const hit = fraymePart(part, message);           // @frayme/runtime/ai-sdk
 *     return hit && <FraymeResult key={i} {...hit} onPress={send} />;
 *   })}
 *
 * The chat belongs to the host: its framework streams the `frayme_compose` /
 * `frayme_action` tool outputs and the user's presses, and this component
 * draws whichever one it is handed. It owns no transport and no state beyond
 * the renderer's own.
 *
 * WHAT IT DRAWS, in order:
 *  · `press`        the thread card for a press the user already made.
 *  · `refused`      nothing: the tool turned the call down before composing,
 *                   and the reason is written for the model, not the user.
 *  · `error`        a notice with the message; never a spec, which on a
 *                   failed compose is partial at best.
 *  · final complete the spec under the strict catalog gate (the default mode;
 *                   `skipValidation` stays off, so an off-catalog spec shows the
 *                   invalid box rather than rendering).
 *  · final, not complete
 *                   a stream saved mid-way (the chat was reloaded while it
 *                   ran, or the tool call was cut off): a notice saying so,
 *                   plus whatever did arrive, display-only. Its controls stay
 *                   inert because the agent never saw that screen finish, so a
 *                   press on it would answer a question nobody asked.
 *  · otherwise      the live snapshot, progressive and loading, which never
 *                   runs the strict gate and so never flashes the invalid box
 *                   over a half-built screen. It takes input (typed text
 *                   survives into the finished screen) but no presses.
 *
 * `final` defaults to "the status is terminal", so a host that passes only the
 * output gets strict rendering once it completes and live rendering before.
 *
 * NEVER MUTATES `output`. The generation id is carried onto the rendered spec
 * (a press reads `spec.generation_id` to correlate back to its compose) through
 * a shallow copy, only when the spec does not carry one already.
 */
import type { Spec } from '@json-render/core';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { DynamicActionEvent, OnDynamicAction } from '../core/events.js';
import type { ThemeInput, ThemeScheme } from '../core/theme.js';
import { FraymeActionReceipt } from './action-receipt.js';
import { FraymeRenderer } from './FraymeRenderer.js';
import { FraymeNotice, errorMessageOf } from './notice.js';

/**
 * The slice of a compose tool's output this component reads. Structurally the
 * agent core's compose output, restated here so the runtime needs nothing
 * beyond the API client it already depends on.
 */
export interface FraymeResultOutput {
  status: 'streaming' | 'restarted' | 'complete' | 'error';
  generation_id?: string;
  op_count?: number;
  restart_count?: number;
  spec: Spec | null;
  error?: { message: string; code?: string };
  /** A call the tool turned down before composing. It is for the model only, so nothing is drawn. */
  refused?: boolean;
}

export interface FraymeResultProps {
  /** The tool output: a live snapshot, the final spec, or an error. */
  output?: FraymeResultOutput;
  /**
   * Whether `output` is the last one this tool call will produce (the AI SDK's
   * `preliminary !== true`). Default: true once the status is terminal.
   */
  final?: boolean;
  /** A press the user made; when set, the thread card is drawn instead of `output`. */
  press?: DynamicActionEvent;
  /** Receives presses on the rendered screen (e.g. `(e) => sendMessage(pressMessage(e))`). */
  onPress?: OnDynamicAction;
  /**
   * Whether a finished screen takes presses now. Default true. Pass false
   * while `useChat` reports `submitted` or `streaming`: a press then would
   * start a second request alongside the one in flight. Until it settles the
   * controls stay visible and a press does nothing (and nothing latches), so
   * after an error the screen is still live and the user can press again.
   */
  interactive?: boolean;
  /** Show the press's `state` on its card. Default false. */
  showState?: boolean;
  className?: string;
  theme?: ThemeInput;
  scheme?: ThemeScheme;
}

const INTERRUPTED = 'This screen did not finish.';

function isSpecObject(value: unknown): value is Spec {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The spec to render: the output's own, carrying the generation id, never the same object mutated. */
function renderableSpec(spec: unknown, generationId: unknown): Spec | null {
  if (!isSpecObject(spec)) return null;
  if (typeof generationId !== 'string' || generationId === '') return spec;
  if ((spec as { generation_id?: unknown }).generation_id != null) return spec;
  return { ...spec, generation_id: generationId } as Spec;
}

export function FraymeResult({
  output,
  final,
  press,
  onPress,
  interactive = true,
  showState,
  className,
  theme,
  scheme,
}: FraymeResultProps): ReactNode {
  const spec = useMemo(
    () => renderableSpec(output?.spec, output?.generation_id),
    [output?.spec, output?.generation_id],
  );

  if (press) {
    return (
      <FraymeActionReceipt event={press} showState={showState} className={className} theme={theme} scheme={scheme} />
    );
  }
  if (!output || typeof output !== 'object' || output.refused === true) return null;

  const status = output.status;
  if (status === 'error') {
    return (
      <FraymeNotice tone="error" className={className} theme={theme} scheme={scheme}>
        {errorMessageOf(output.error)}
      </FraymeNotice>
    );
  }

  const complete = status === 'complete';
  const isFinal = final ?? complete;
  // One restart key for every branch that renders, so the streaming render and
  // the final one share a state store and a user's early input survives.
  const restartKey = typeof output.restart_count === 'number' ? output.restart_count : 0;

  if (isFinal && complete) {
    return (
      <FraymeRenderer
        spec={spec}
        restartKey={restartKey}
        onDynamicAction={onPress}
        interactive={interactive}
        className={className}
        theme={theme}
        scheme={scheme}
      />
    );
  }

  if (isFinal) {
    return (
      <>
        <FraymeNotice tone="info" className={className} theme={theme} scheme={scheme}>
          {INTERRUPTED}
        </FraymeNotice>
        {spec && (
          <FraymeRenderer
            spec={spec}
            mode="progressive"
            restartKey={restartKey}
            interactive={false}
            className={className}
            theme={theme}
            scheme={scheme}
          />
        )}
      </>
    );
  }

  // The live snapshot takes input but no presses: the agent has not seen the
  // screen finish, and a press now would answer a screen still being built.
  return (
    <FraymeRenderer
      spec={spec}
      mode="progressive"
      loading
      restartKey={restartKey}
      interactive={false}
      className={className}
      theme={theme}
      scheme={scheme}
    />
  );
}
