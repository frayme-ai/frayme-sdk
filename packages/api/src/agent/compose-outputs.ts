/**
 * A compose stream as a sequence of self-contained outputs.
 *
 * Agent frameworks stream a tool's progress as a series of whole values (the
 * AI SDK's preliminary tool results, for one). `composeOutputs` turns
 * `client.compose.stream` into exactly that: each yield is a complete,
 * independent object a UI can render on its own, and the last yield is always
 * terminal. The spec rides in these outputs for the UI; `fraymeModelView` is
 * the part the MODEL may see, which never includes the spec.
 */
import type { Spec } from '@json-render/core';
import type { ComposeRequest } from '../api-types.js';
import type { Frayme } from '../client.js';
import {
  APIUserAbortError,
  BadRequestError,
  FraymeError,
  RateLimitError,
  ValidationError,
} from '../core/errors.js';
import type { ComposeStream } from '../streaming/compose-stream.js';
import type { FraymeTrimmed } from '../fit.js';

export type FraymeComposeStatus = 'streaming' | 'restarted' | 'complete' | 'error';

export interface FraymeComposeError {
  message: string;
  code?: string;
  status?: number;
  /** Seconds to wait before retrying, when the API said so. */
  retry_after?: number;
  /**
   * Whether calling again this turn could succeed. Unset means "decide from
   * `status`" (see `composeErrorRetryable`); a caller sets it when it knows
   * better, as for a setup error no retry can fix.
   */
  retryable?: boolean;
}

export interface FraymeComposeOutput {
  status: FraymeComposeStatus;
  generation_id?: string;
  model?: string;
  /** Ops applied in the current attempt; the server's final count once complete. */
  op_count: number;
  /** How many times the server discarded an attempt and started over. */
  restart_count: number;
  /** The spec so far (streaming), the final spec (complete), otherwise null. */
  spec: Spec | null;
  error?: FraymeComposeError;
  /**
   * The call was refused before anything was composed (a second compose in a
   * turn, a press that does not match). It is for the model only: a UI shows
   * nothing for it.
   */
  refused?: boolean;
  /**
   * The server rejected the prior screen, so this is a fresh screen built
   * without it. The model is told, so it never reports an edit that did not
   * happen.
   */
  prior_spec_dropped?: boolean;
  /**
   * What the caller left out of the request to fit the API's size ceilings
   * (`fitContinuation`). The composer never saw those parts.
   */
  trimmed?: FraymeTrimmed[];
}

export interface ComposeOutputsOptions {
  signal?: AbortSignal;
  /** At most one streaming yield per this many ms. Default 100; clamped to 0..2^31-1. */
  snapshotEveryMs?: number;
  /** Retry once as a fresh screen when the server rejects `prior_spec`. Default true. */
  retryWithoutPriorSpec?: boolean;
}

/** Error code of the output yielded when the compose is aborted. */
const ABORTED = 'ABORTED';
const DEFAULT_SNAPSHOT_EVERY_MS = 100;
// The longest delay a timer honours. Node fires a longer (or infinite) one
// after 1 ms instead, which would turn the throttle off rather than up.
const MAX_TIMER_MS = 2 ** 31 - 1;

/** The throttle window: the default for anything unusable, clamped to what a timer can wait. */
function snapshotWindow(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_SNAPSHOT_EVERY_MS;
  return Math.min(MAX_TIMER_MS, Math.max(0, value));
}

function isRequestObject(value: unknown): value is Omit<ComposeRequest, 'stream'> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toComposeError(err: unknown, signal: AbortSignal | undefined): FraymeComposeError {
  if (err instanceof APIUserAbortError || signal?.aborted) {
    return { message: 'The compose was aborted.', code: ABORTED };
  }
  if (err instanceof FraymeError) {
    const out: FraymeComposeError = { message: err.message };
    if (err.code !== undefined) out.code = err.code;
    if (err.status !== undefined) out.status = err.status;
    if (err instanceof RateLimitError && err.retryAfter !== undefined) out.retry_after = err.retryAfter;
    return out;
  }
  return { message: err instanceof Error ? err.message : 'The compose failed unexpectedly.' };
}

/**
 * A rejected `prior_spec` is the one request error a caller can recover from
 * without changing intent: the screen can still be built fresh. Only a 400 or
 * 422 counts, and only before any op, so nothing half-rendered is replaced.
 */
function isPriorSpecRejection(err: unknown): boolean {
  return err instanceof BadRequestError || err instanceof ValidationError;
}

/** The same request as a fresh screen: no prior spec, and `edit` becomes the default create. */
function withoutPriorSpec(body: Omit<ComposeRequest, 'stream'>): Omit<ComposeRequest, 'stream'> {
  const { prior_spec: _prior, mode, ...rest } = body;
  return mode === undefined || mode === 'edit' ? rest : { ...rest, mode };
}

/**
 * Stream one compose as outputs: throttled `streaming` snapshots (the first op
 * always yields at once, and a consumer that falls behind gets only the latest
 * one), an immediate `restarted` yield with `spec: null`, and a terminal
 * `complete` or `error` as the LAST yield. It never throws; an abort ends in an
 * `error` output with code `ABORTED`, and a request that is not an object in a
 * `BAD_REQUEST` one. Stopping the iteration early aborts the stream.
 */
export async function* composeOutputs(
  client: Frayme,
  request: Omit<ComposeRequest, 'stream'>,
  options: ComposeOutputsOptions = {},
): AsyncGenerator<FraymeComposeOutput, void, undefined> {
  const everyMs = snapshotWindow(options?.snapshotEveryMs);
  const retryFresh = options?.retryWithoutPriorSpec ?? true;
  const signal = options?.signal;
  if (!isRequestObject(request)) {
    // A model or a JavaScript caller can hand over anything; say so as an output.
    yield {
      status: 'error',
      op_count: 0,
      restart_count: 0,
      spec: null,
      error: { message: 'The compose request must be an object.', code: 'BAD_REQUEST' },
    };
    return;
  }
  let body = request;
  let retried = false;
  let restartCount = 0;

  for (;;) {
    let generationId: string | undefined;
    let model: string | undefined;
    let opCount = 0;
    let sawOp = false;
    let live: ComposeStream | undefined;
    let ended = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let terminal: FraymeComposeOutput;

    const output = (status: FraymeComposeStatus, spec: Spec | null): FraymeComposeOutput => {
      const out: FraymeComposeOutput = { status, op_count: opCount, restart_count: restartCount, spec };
      if (generationId !== undefined) out.generation_id = generationId;
      if (model !== undefined) out.model = model;
      if (retried) out.prior_spec_dropped = true;
      return out;
    };
    const clearTimer = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };

    try {
      const stream = client.compose.stream(body, { signal });
      live = stream;

      // Outputs are built INSIDE the stream's handlers, which run in step with
      // its accumulator. The stream reads ahead of any consumer, so a snapshot
      // taken later, while draining its events, could already hold ops from a
      // later event or from the attempt after a restart.
      const queue: FraymeComposeOutput[] = [];
      let wake: (() => void) | undefined;
      let lastShownAt = Number.NEGATIVE_INFINITY; // so the first op shows at once
      const push = (out: FraymeComposeOutput): void => {
        // Each snapshot is the whole spec so far, so a newer one makes an
        // unread older one useless. A slow consumer gets the latest, never a
        // backlog of stale ones that delays the terminal output. A `restarted`
        // output is never replaced: the consumer must see it to clear the screen.
        if (out.status === 'streaming' && queue.at(-1)?.status === 'streaming') {
          queue[queue.length - 1] = out;
        } else {
          queue.push(out);
        }
        const resume = wake;
        wake = undefined;
        resume?.();
      };
      const showSnapshot = (): void => {
        clearTimer();
        lastShownAt = Date.now();
        push(output('streaming', stream.snapshot()));
      };

      stream
        .on('started', (event) => {
          generationId = event.generation_id;
          model = event.model;
        })
        .on('op', () => {
          opCount += 1;
          sawOp = true;
          const wait = everyMs - (Date.now() - lastShownAt);
          if (wait <= 0) showSnapshot();
          // Inside the window: one trailing snapshot shows whatever arrived by
          // its end, so a burst followed by a quiet spell is not left unshown.
          else timer ??= setTimeout(showSnapshot, wait);
        })
        .on('restarted', (event) => {
          clearTimer();
          restartCount += 1;
          generationId = event.generation_id;
          model = event.model;
          opCount = 0;
          // The next attempt's first op shows at once, like the first op of all.
          lastShownAt = Number.NEGATIVE_INFINITY;
          push(output('restarted', null));
        })
        .on('end', () => {
          clearTimer();
          ended = true;
          const resume = wake;
          wake = undefined;
          resume?.();
        });

      while (!ended || queue.length > 0) {
        const next = queue.shift();
        if (next) {
          yield next;
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }

      // Success and abort both end the stream; finalSpec tells them apart.
      const final = await stream.finalSpec();
      generationId = final.generationId;
      model = final.model;
      opCount = final.operationCount;
      terminal = output('complete', structuredClone(final.spec));
    } catch (err) {
      if (
        retryFresh &&
        !retried &&
        !sawOp &&
        body.prior_spec !== undefined &&
        !signal?.aborted &&
        isPriorSpecRejection(err)
      ) {
        retried = true;
        body = withoutPriorSpec(body);
        continue;
      }
      terminal = { ...output('error', null), error: toComposeError(err, signal) };
    } finally {
      clearTimer();
      // Still running only when the consumer stopped iterating mid-stream.
      if (!ended) live?.abort();
    }

    yield terminal;
    return;
  }
}

/**
 * Whether a failed compose could succeed if the model called again this turn.
 * A request the model can change (400, 422), a server or network failure, and
 * a refusal the model can correct all could; an abort, a missing or refused
 * key, an exhausted plan and a rate limit cannot, and retrying them only
 * spends the turn's steps.
 */
export function composeErrorRetryable(error: FraymeComposeError | undefined): boolean {
  if (!error) return false;
  if (typeof error.retryable === 'boolean') return error.retryable;
  if (error.code === ABORTED || error.code === ONE_COMPOSE_PER_TURN) return false;
  const status = error.status;
  if (typeof status !== 'number') return true;
  return status === 400 || status === 422 || status >= 500;
}

const NOT_RETRYABLE_NEXT =
  'Calling again this turn will not help. Tell the user what happened, in plain words.';

/**
 * What the model may see of an output. The spec is for the renderer only: it
 * is large, and handing it to the model invites the model to repeat it as text.
 */
const TRIMMED_NOTE: Record<FraymeTrimmed, string> = {
  state: 'the press was too large to send whole, so its state was left out',
  params: 'the press was too large to send whole, so its params were left out',
  prior_spec: 'the earlier screen was too large to send, so the new screen was built without it',
};

/** The size cuts, as the model reads them, or nothing. */
function trimmedView(output: FraymeComposeOutput): { trimmed?: FraymeTrimmed[]; trimmed_note?: string } {
  const trimmed = output.trimmed?.filter((t): t is FraymeTrimmed => t in TRIMMED_NOTE);
  if (!trimmed?.length) return {};
  return { trimmed, trimmed_note: `${trimmed.map((t) => TRIMMED_NOTE[t]).join('; ')}.` };
}

export function fraymeModelView(output: FraymeComposeOutput): unknown {
  if (output.status === 'complete') {
    const view: Record<string, unknown> = {
      generation_id: output.generation_id,
      status: 'complete',
      operation_count: output.op_count,
    };
    if (output.prior_spec_dropped) {
      view.prior_screen_dropped = true;
      view.note = 'The earlier screen could not be used, so this is a new screen built from the prompt alone.';
    }
    return { ...view, ...trimmedView(output) };
  }
  if (output.status === 'error') {
    const retryable = composeErrorRetryable(output.error);
    const view: {
      status: 'error';
      message: string;
      code?: string;
      retryable: boolean;
      retry_after?: number;
      next?: string;
    } = {
      status: 'error',
      message: output.error?.message ?? 'The compose failed.',
      retryable,
    };
    if (output.error?.code !== undefined) view.code = output.error.code;
    if (output.error?.retry_after !== undefined) view.retry_after = output.error.retry_after;
    if (!retryable && output.error?.code !== ONE_COMPOSE_PER_TURN) view.next = NOT_RETRYABLE_NEXT;
    return { ...view, ...trimmedView(output) };
  }
  // A non-terminal output as the last one the model sees means the stream was cut off.
  return { status: 'interrupted', message: 'The screen did not finish rendering.' };
}

/**
 * One compose per agent turn. A model that composes twice in one turn replaces
 * the screen the user is looking at before they can act on it; the guard lets
 * the first call through and refuses the rest. Create one per turn.
 *
 * `release` hands the turn's compose back, for a compose that failed: it put
 * nothing on screen the user could act on, so a second try replaces nothing.
 */
export function createComposeGuard(): { claim(): boolean; release(): void } {
  let claimed = false;
  return {
    claim(): boolean {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    release(): void {
      claimed = false;
    },
  };
}

export const ONE_COMPOSE_PER_TURN = 'ONE_COMPOSE_PER_TURN';

/** The output a refused second compose returns, written for the model to read. */
export function oneComposePerTurnOutput(): FraymeComposeOutput {
  return {
    status: 'error',
    op_count: 0,
    restart_count: 0,
    spec: null,
    refused: true,
    error: {
      code: ONE_COMPOSE_PER_TURN,
      retryable: false,
      message:
        'A screen was already composed this turn, so this call was not run. Do not call frayme_compose again in this turn: reply to the user in text, and compose the next screen after they respond.',
    },
  };
}
