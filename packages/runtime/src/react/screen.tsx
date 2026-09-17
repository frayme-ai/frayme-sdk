'use client';
/**
 * FRAYME SCREEN: a composed screen with no chat around it.
 *
 *   <FraymeProvider endpoint="/api/frayme">
 *     <FraymeScreen
 *       prompt="The open orders, newest first, with a Refund button per row"
 *       data={{ orders }}
 *       actions={[{ name: 'refundOrder', params: ['orderId'] }]}
 *       onAction={(event, screen) => screen.continue(event)}
 *     />
 *   </FraymeProvider>
 *
 * The props ARE the request: the screen composes on mount and again whenever
 * `prompt`, `data`, `actions`, `signals` or `context` change by value (a stable
 * deep compare, so an inline object literal does not recompose on every host
 * render). A prop-driven compose is a fresh create and mounts a fresh renderer
 * that never sees the previous screen, so none of its state leaks into the new
 * one.
 *
 * The handle (`onAction`'s second argument, or `useFraymeScreen`'s return)
 * moves the screen on without a chat:
 *  · `edit(prompt)`             the same screen, changed: `mode: 'edit'` with
 *                               the last complete screen as `prior_spec`.
 *  · `continue(event, prompt?)` the next step after a press:
 *                               `mode: 'continue_journey'`, the press as
 *                               `action_context`, the last complete screen as
 *                               `prior_spec`, both cut to the API's size
 *                               ceilings (`fitContinuation`).
 *  · `retry()`                  the last request again, after it failed.
 * Edit and continue resend the props' `data`, `actions`, `signals` and
 * `context` (an action left out of an edit comes back unwired), and `extra`
 * overrides any of them.
 *
 * ONLY A COMPLETE SCREEN IS EVER A `prior_spec`. A snapshot taken mid-stream,
 * or left behind by `abort()`, can point at elements that never arrived; the
 * server rejects it, and the half-built screen would then be shown under the
 * strict gate. So the follow-up starts from the last screen that finished, and
 * with none there is nothing to edit and `edit` sends a fresh create instead.
 *
 * Edit and continue keep the renderer mounted, so the user's input merges into
 * the next spec the way the renderer already merges a patch. Until the
 * follow-up's first op arrives the screen it started from stays up (the stream
 * clears its snapshot when it starts, and a blank flash between two screens
 * reads as a failure); if the follow-up fails, that screen stays up under the
 * error notice, which offers "Try again" when trying again could help. The
 * control the user pressed stays latched (the renderer never re-arms a fired
 * control), so that button, or the host calling `retry()`, is the way on. A
 * server restart still clears everything, as it does everywhere else.
 *
 * Built on `useFraymeCompose`, so restarts, stale-stream guards and aborts
 * behave exactly as they do there.
 */
import type { ComposeAction, ComposeActionContext, ComposeRequest, Frayme, FraymeError } from '@frayme/api';
import { fitContinuation } from '@frayme/api';
import type { Spec } from '@json-render/core';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { DynamicActionEvent } from '../core/events.js';
import type { ThemeInput, ThemeScheme } from '../core/theme.js';
import { FraymeRenderer } from './FraymeRenderer.js';
import { useFrayme } from './FraymeProvider.js';
import { FraymeNotice, errorMessageOf, isRetryable } from './notice.js';
import { MISSING_CLIENT_MESSAGE, useFraymeCompose, type ComposeStatus } from './useFraymeCompose.js';

type ComposeBody = Omit<ComposeRequest, 'stream'>;

export interface UseFraymeScreenOptions {
  /** What the screen should be. */
  prompt: string;
  /** Facts the screen must show verbatim. */
  data?: Record<string, unknown>;
  /** The actions the screen's controls fire. */
  actions?: ComposeAction[];
  signals?: ComposeRequest['signals'];
  context?: ComposeRequest['context'];
  /** Defaults to the provider's client (including one built from its `endpoint`). */
  client?: Frayme;
}

export interface FraymeScreenHandle {
  /**
   * What the screen shows: the live snapshot while streaming, the validated
   * spec once complete, and the screen an edit or continue started from until
   * that follow-up's first op (or after it fails).
   */
  spec: Spec | null;
  /** `streaming` from the moment the props change, before the request is sent. */
  status: ComposeStatus;
  /**
   * The generation `spec` belongs to: the stream's own once it has said, and
   * the earlier screen's while that screen is the one shown.
   */
  generationId?: string;
  /** Change the last complete screen in place (a fresh create when there is none). */
  edit(prompt: string, extra?: Partial<ComposeRequest>): Promise<void>;
  /** Compose the next step after a press, from the last complete screen. */
  continue(event: DynamicActionEvent, prompt?: string, extra?: Partial<ComposeRequest>): Promise<void>;
  /**
   * Send the last request again, unchanged, when it failed (`status` is
   * `error`). Does nothing otherwise.
   */
  retry(): Promise<void>;
  /** Stop the compose in flight, if any. */
  abort(): void;
}

export interface UseFraymeScreenReturn extends FraymeScreenHandle {
  /** Pass to `<FraymeRenderer restartKey>`: bumps when the server restarts an attempt. */
  restartKey: number;
  /** Pass as the renderer's React `key`: bumps on every prop-driven fresh create. */
  screenKey: number;
  model: string | undefined;
  error: FraymeError | undefined;
}

export interface FraymeScreenProps extends UseFraymeScreenOptions {
  /** A press on the screen, with the handle to move it on. */
  onAction?: (event: DynamicActionEvent, screen: FraymeScreenHandle) => void | Promise<void>;
  className?: string;
  theme?: ThemeInput;
  scheme?: ThemeScheme;
  /** Shown until the first part of the screen arrives. Default: nothing. */
  fallback?: ReactNode;
}

/**
 * A key that is equal exactly when the request is equal by value, as it would
 * go over the wire: object keys sorted, so `{ a, b }` and `{ b, a }` agree, and
 * anything with a `toJSON` (a Date) keyed by what it serialises to.
 * Never throws on content: a cycle becomes a marker and a BigInt its digits. A
 * value that still cannot be walked (a throwing getter) gives a CONSTANT key,
 * never a random one, because a key that differs on every render would
 * recompose on every render.
 */
function stableKey(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (typeof v === 'bigint') return `${v.toString()}n`;
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return '[cycle]';
    seen.add(v);
    let out: unknown;
    const toJSON = (v as { toJSON?: unknown }).toJSON;
    if (typeof toJSON === 'function') out = walk(toJSON.call(v));
    else if (Array.isArray(v)) out = v.map(walk);
    else {
      out = Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, walk((v as Record<string, unknown>)[k])]),
      );
    }
    seen.delete(v);
    return out;
  };
  try {
    return JSON.stringify(walk(value)) ?? '';
  } catch {
    return '[unserialisable]';
  }
}

/** The request fields a prop set carries, with unset ones left off the wire. */
function baseRequest(options: UseFraymeScreenOptions): ComposeBody {
  const body: ComposeBody = { prompt: options.prompt };
  if (options.data !== undefined) body.data = options.data;
  if (options.actions !== undefined) body.actions = options.actions;
  if (options.signals !== undefined) body.signals = options.signals;
  if (options.context !== undefined) body.context = options.context;
  return body;
}

/**
 * What the server needs to know about a press. The receipt fields (`label`,
 * `description`) are for the thread card, not the model, and anything else a
 * host hung on the event is not part of the wire contract, so the context is
 * built from the known fields rather than by deleting two.
 */
function actionContextOf(event: DynamicActionEvent): ComposeActionContext {
  const context: ComposeActionContext = { action: event.action };
  if (event.event !== undefined) context.event = event.event;
  if (event.params !== undefined) context.params = event.params;
  if (event.state !== undefined) context.state = event.state;
  if (event.element_id !== undefined) context.element_id = event.element_id;
  if (event.generation_id !== undefined) context.generation_id = event.generation_id;
  return context;
}

/** `extra` without the fields each handle method owns, and without `stream`. */
function extraFields(extra: Partial<ComposeRequest> | undefined): Partial<ComposeBody> {
  if (!extra) return {};
  const { stream: _stream, mode: _mode, prior_spec: _prior, action_context: _context, ...rest } = extra;
  return rest;
}

/** Chatless compose state plus the handle. Throws the setup error when no client is available. */
export function useFraymeScreen(options: UseFraymeScreenOptions): UseFraymeScreenReturn {
  const ctx = useFrayme();
  const client = options.client ?? ctx.client;
  // Thrown during render, so an error boundary shows it. The same call inside
  // the mount effect would only reject a promise nobody is holding.
  if (!client) throw new Error(MISSING_CLIENT_MESSAGE);

  const composeState = useFraymeCompose(client);
  const { compose, spec: liveSpec, restartKey, model, abort } = composeState;

  const base = baseRequest(options);
  const requestKey = stableKey(base);

  // The request the compose effect last STARTED. Between a prop change and
  // that effect, the hook still holds the previous screen, marked complete;
  // handed to the renderer that remounts for the new request, it would seed
  // the new state store from the old screen's `state`, and on a shared key the
  // renderer's merge keeps the stored value. So until the effect has run, the
  // screen is empty and on its way. Written only in the effect.
  const startedKeyRef = useRef<string | null>(null);
  const pending = startedKeyRef.current !== requestKey;
  // The last screen that finished, the only kind a follow-up may send as
  // `prior_spec`. Cleared by a fresh create; recorded here, during render,
  // like the other refs the handle reads, so a handler never sees it stale.
  const lastCompleteRef = useRef<Spec | null>(null);
  if (!pending && composeState.status === 'complete' && liveSpec) lastCompleteRef.current = liveSpec;
  // The screen an edit / continue started from: always a lastCompleteRef value
  // (or null), set immediately before the compose that changes state, so every
  // render that reads it sees the current value.
  const heldRef = useRef<Spec | null>(null);
  const held = heldRef.current;

  const status: ComposeStatus = pending ? 'streaming' : composeState.status;
  let spec: Spec | null;
  let showingHeld = false;
  if (pending || status === 'restarting') {
    spec = null; // a new request on its way, or the agent-authoritative discard
  } else if (status === 'complete') {
    spec = liveSpec;
  } else if (status !== 'error' && liveSpec) {
    spec = liveSpec; // streaming, or the snapshot an abort left
  } else {
    // An error, or a follow-up before its first op (or aborted before one):
    // the last good screen, if any. Never a failed attempt's partial.
    spec = held;
    showingHeld = held !== null;
  }
  // The id belongs with the screen: a held screen is an earlier generation's,
  // whatever the attempt in flight or just failed has been told.
  const heldGenerationId = (held as { generation_id?: unknown } | null)?.generation_id;
  const generationId = pending
    ? undefined
    : showingHeld
      ? typeof heldGenerationId === 'string'
        ? heldGenerationId
        : undefined
      : composeState.generationId;
  const error = pending ? undefined : composeState.error;

  // Latest values for the handle methods, which are created once so a host can
  // hold on to them without their going stale.
  const baseRef = useRef(base);
  baseRef.current = base;
  const statusRef = useRef(status);
  statusRef.current = status;
  const composeRef = useRef(compose);
  composeRef.current = compose;
  // The body of the last compose sent, for `retry`.
  const lastBodyRef = useRef<ComposeBody | null>(null);
  const send = useCallback(async (body: ComposeBody): Promise<void> => {
    lastBodyRef.current = body;
    await composeRef.current(body);
  }, []);

  // One epoch per distinct request. Counted during render (idempotent: a
  // repeated render sees the same key) so the renderer remounts in the same
  // commit that starts the new compose.
  const epochRef = useRef({ key: requestKey, epoch: 0 });
  if (epochRef.current.key !== requestKey) {
    epochRef.current = { key: requestKey, epoch: epochRef.current.epoch + 1 };
  }
  const screenKey = epochRef.current.epoch;

  // Keyed on the request's VALUE only. `compose` changes identity with the
  // client, and a client built inline would otherwise recompose on every render.
  useEffect(() => {
    startedKeyRef.current = requestKey;
    heldRef.current = null;
    lastCompleteRef.current = null;
    void send(baseRef.current);
    return () => abort();
  }, [requestKey, abort, send]);

  const edit = useCallback(async (prompt: string, extra?: Partial<ComposeRequest>): Promise<void> => {
    const prior = lastCompleteRef.current;
    heldRef.current = prior;
    const body: ComposeBody = { ...baseRef.current, ...extraFields(extra), prompt };
    // With no finished screen there is nothing to edit: send a fresh create
    // rather than an edit the server would reject for its missing prior_spec.
    if (prior) {
      body.mode = 'edit';
      body.prior_spec = prior;
    }
    await send(body);
  }, [send]);

  const continueJourney = useCallback(
    async (event: DynamicActionEvent, prompt?: string, extra?: Partial<ComposeRequest>): Promise<void> => {
      const prior = lastCompleteRef.current;
      heldRef.current = prior;
      const body: ComposeBody = {
        ...baseRef.current,
        ...extraFields(extra),
        prompt:
          prompt ??
          (typeof extra?.prompt === 'string' ? extra.prompt : undefined) ??
          `The user triggered the "${event.action}" action. Continue the journey.`,
        mode: 'continue_journey',
      };
      // A big table press, or a big screen, is cut to the API's ceilings
      // rather than refused: the state goes first, then the params, and a
      // screen too large to send is left out.
      const fit = fitContinuation({ action_context: actionContextOf(event), prior_spec: prior ?? undefined });
      if (fit.action_context) body.action_context = fit.action_context;
      if (fit.prior_spec) body.prior_spec = fit.prior_spec;
      await send(body);
    },
    [send],
  );

  // The same body, so a failed edit or continue is retried from the same
  // screen, which `heldRef` still holds (nothing completed since).
  const retry = useCallback(async (): Promise<void> => {
    const body = lastBodyRef.current;
    if (!body || statusRef.current !== 'error') return;
    await composeRef.current(body);
  }, []);

  return useMemo(
    () => ({
      spec,
      status,
      generationId,
      edit,
      continue: continueJourney,
      retry,
      abort,
      restartKey,
      screenKey,
      model,
      error,
    }),
    [spec, status, generationId, edit, continueJourney, retry, abort, restartKey, screenKey, model, error],
  );
}

export function FraymeScreen({
  onAction,
  className,
  theme,
  scheme,
  fallback = null,
  ...options
}: FraymeScreenProps): ReactNode {
  const screen = useFraymeScreen(options);

  // The renderer reads its handler through a live ref, so a stable wrapper is
  // enough; it always hands the host the newest handle.
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const screenRef = useRef<FraymeScreenHandle>(screen);
  screenRef.current = screen;
  const onDynamicAction = useCallback(
    (event: DynamicActionEvent) => onActionRef.current?.(event, screenRef.current),
    [],
  );

  const failed = screen.status === 'error';
  const streaming = screen.status === 'streaming' || screen.status === 'restarting';
  const retry = screen.retry;
  const onRetry = useCallback(() => {
    void retry();
  }, [retry]);
  // The renderer is ALWAYS mounted (it renders nothing for a null spec), so its
  // state store lives across an edit or continue; only `screenKey` (a fresh
  // create) or `restartKey` (a server restart) resets it.
  return (
    <>
      {failed && (
        <FraymeNotice
          tone="error"
          className={className}
          theme={theme}
          scheme={scheme}
          onRetry={isRetryable(screen.error) ? onRetry : undefined}
        >
          {errorMessageOf(screen.error)}
        </FraymeNotice>
      )}
      {!failed && !screen.spec && fallback}
      <FraymeRenderer
        key={screen.screenKey}
        spec={screen.spec}
        // Strict for a completed spec, and under an error, where the spec is
        // the last COMPLETE screen or nothing (never the failed attempt's
        // partial). Everything else is a snapshot: a stream in flight, or the
        // partial one an abort leaves behind, which the strict gate would reject.
        mode={screen.status === 'complete' || failed ? 'strict' : 'progressive'}
        loading={streaming}
        restartKey={screen.restartKey}
        onDynamicAction={onAction ? onDynamicAction : undefined}
        className={className}
        theme={theme}
        scheme={scheme}
      />
    </>
  );
}
