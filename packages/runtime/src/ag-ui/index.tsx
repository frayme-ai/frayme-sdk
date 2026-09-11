'use client';
/**
 * @frayme/runtime/ag-ui — AG-UI protocol adapter.
 *
 * AG-UI is the transport between the CONSUMER'S agent and their front-end
 * (LangGraph, CrewAI, Mastra, Pydantic AI, Agno, … — anything on the AG-UI
 * integrations matrix). Frayme is a tool the agent calls; the spec travels to
 * the browser out-of-band as a CUSTOM `frayme:spec` event, and dynamic actions
 * return via the `frayme:action` frontend tool.
 *
 *   const { spec, onAgUiEvent, restartKey } = useFraymeAgUiSpec();
 *   useEffect(() => agent.subscribe({ onEvent: ({ event }) => onAgUiEvent(event) }), [agent]);
 *   <FraymeAgUiRenderer spec={spec} restartKey={restartKey} onDynamicAction={…} />
 */
import type { Spec } from '@json-render/core';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import type { DynamicActionEvent, OnDynamicAction } from '../core/events.js';
import { FraymeRenderer, type FraymeRendererProps } from '../react/FraymeRenderer.js';
import {
  FRAYME_ACTION_TOOL,
  FRAYME_SPEC_EVENT,
  foldSpecPart,
  specPartFromAgUiEvent,
} from './events.js';

export { FRAYME_ACTION_TOOL, FRAYME_SPEC_EVENT, foldSpecPart, specPartFromAgUiEvent };

export interface UseFraymeAgUiSpecReturn {
  spec: Spec | null;
  /** Feed every AG-UI event here; non-Frayme events are ignored. */
  onAgUiEvent: (event: unknown) => void;
  /** Bumps whenever a flat spec replaces the snapshot (restart semantics). */
  restartKey: number;
  reset: () => void;
}

/** Accumulate the Frayme spec carried in an AG-UI event stream. */
export function useFraymeAgUiSpec(): UseFraymeAgUiSpecReturn {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [restartKey, setRestartKey] = useState(0);

  const onAgUiEvent = useCallback((event: unknown) => {
    const part = specPartFromAgUiEvent(event);
    if (!part) return;
    if (part.type === 'flat' || part.type === 'nested') setRestartKey((k) => k + 1);
    setSpec((current) => foldSpecPart(current, part));
  }, []);

  const reset = useCallback(() => {
    setSpec(null);
    setRestartKey((k) => k + 1);
  }, []);

  return { spec, onAgUiEvent, restartKey, reset };
}

export type FraymeAgUiRendererProps = FraymeRendererProps;

/** Thin alias of FraymeRenderer — same surface as the AI SDK path, different bridge. */
export function FraymeAgUiRenderer(props: FraymeAgUiRendererProps): ReactNode {
  return <FraymeRenderer mode={props.mode ?? 'progressive'} {...props} />;
}

/**
 * The frontend-tool definition the consumer registers with their AG-UI client
 * (e.g. CopilotKit's useFrontendTool). Dynamic actions arrive as calls to this
 * tool; wire its handler to your agent loop.
 */
export const fraymeActionToolDefinition = {
  name: FRAYME_ACTION_TOOL,
  description:
    'Receives user interactions from Frayme-rendered UI (form submissions, button presses bound to named actions). The enriched event carries: action, the canonical event verb, resolved params, a live state snapshot, the element that fired (element_id), the originating generation_id, and — when known — the pressed control’s label (verbatim) and the host’s description of the action.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'The bound action name from the spec.' },
      event: { type: 'string', description: 'Canonical event verb that fired (commit/select/change/…).' },
      params: { type: 'object', description: 'Resolved action params (often form state).' },
      state: { type: 'object', description: 'Live state snapshot at fire time (the user’s entries).' },
      // The forwarder passes the event object whole, so this always arrived; the
      // schema simply did not say so until the carrier gate made it load-bearing.
      element_id: { type: 'string', description: 'The spec id of the element that fired (the Button, or the DataTable whose row/bulk action was pressed).' },
      generation_id: { type: 'string', description: 'The compose generation this UI came from.' },
      // The receipt fields (core/action-enrich.ts). Same
      // story as element_id: the forwarder always passed them; a host deriving
      // its handler's typed args from this schema (CopilotKit useFrontendTool,
      // a strict-mode registration) could not see them until the schema said so.
      label: { type: 'string', description: 'The pressed control’s label, verbatim, when the fire names one (absent otherwise — never invented).' },
      description: { type: 'string', description: 'What the action does, in the host’s words: its actionContract entry, else the consumer actions map entry, else spec.actions[name].description.' },
    },
    required: ['action'],
  },
} as const;

/**
 * Outbound AG-UI forwarder — turns a Frayme dynamic action into a STRUCTURED
 * payload for the agent (parity with the inbound `frayme:spec` CUSTOM-event
 * convention: `{ name, value }`). Wire `emit` to your AG-UI client — e.g.
 * `agent.runAgent({ forwardedProps: { frayme: payload } })`, or a CUSTOM event
 * emitter. Carries the FULL enriched event, not a lossy text message. (AG-UI was
 * inbound-only before; this completes the round trip.)
 */
export function createAgUiActionForwarder(options: {
  emit: (payload: { name: typeof FRAYME_ACTION_TOOL; value: DynamicActionEvent }) => unknown;
}): OnDynamicAction {
  return (event) => options.emit({ name: FRAYME_ACTION_TOOL, value: event });
}
