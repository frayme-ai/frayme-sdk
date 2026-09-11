import type { Usage } from '../api-types.js';

/** `event: compose.started` — fired once per generation attempt's stream start. */
export interface ComposeStartedEvent {
  type: 'compose.started';
  generation_id: string;
  model: string;
}

/**
 * `event: op` — one validated json-render JSONL operation (RFC 6902 shaped).
 * Ops are LIVE AND PROVISIONAL until `compose.completed` arrives; a
 * `compose.restarted` event means every op so far must be discarded.
 */
export interface OpEvent {
  type: 'op';
  op: string;
  path: string;
  value?: unknown;
  from?: string;
}

/** `event: compose.restarted` — the previous attempt failed validation; discard all rendered state. */
export interface ComposeRestartedEvent {
  type: 'compose.restarted';
  generation_id: string;
  /** The model serving the NEXT attempt. */
  model: string;
  reason: { code: string };
}

/** `event: compose.completed` — terminal success; the only event that makes ops final. */
export interface ComposeCompletedEvent {
  type: 'compose.completed';
  generation_id: string;
  model: string;
  operation_count: number;
  usage: Usage;
  validated: true;
  replayed?: boolean;
}

/**
 * Every event the low-level stream yields. In-band `error` events are NOT
 * yielded — they are mapped to typed `FraymeError`s and thrown.
 */
export type ComposeStreamEvent =
  | ComposeStartedEvent
  | OpEvent
  | ComposeRestartedEvent
  | ComposeCompletedEvent;
