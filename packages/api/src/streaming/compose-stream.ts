import {
  applySpecStreamPatch,
  type Spec,
  type SpecStreamLine,
} from '@json-render/core';
import { APIConnectionError, APIUserAbortError, FraymeError } from '../core/errors.js';
import type { Usage } from '../api-types.js';
import { composeEvents } from './event-stream.js';
import type {
  ComposeCompletedEvent,
  ComposeRestartedEvent,
  ComposeStartedEvent,
  ComposeStreamEvent,
  OpEvent,
} from './events.js';

export interface FinalSpec {
  spec: Spec;
  generationId: string;
  model: string;
  operationCount: number;
  usage: Usage;
  replayed: boolean;
}

export interface ComposeStreamHandlers {
  started: (event: ComposeStartedEvent) => void;
  /** Raw op + the progressively accumulated spec snapshot (Anthropic's event+snapshot pattern). */
  op: (event: OpEvent, snapshot: Spec) => void;
  /** The previous attempt failed — the internal snapshot has been reset; discard rendered state. */
  restarted: (event: ComposeRestartedEvent) => void;
  completed: (event: ComposeCompletedEvent) => void;
  /** Stream failed with a typed error (never fired for consumer-initiated aborts). */
  error: (error: FraymeError) => void;
  /** Consumer aborted via `.abort()`, `.controller`, or a passed signal. */
  abort: (error: APIUserAbortError) => void;
  /** Always fired exactly once, after success, error, or abort. */
  end: () => void;
}

type QueueItem =
  | { kind: 'event'; event: ComposeStreamEvent }
  | { kind: 'error'; error: unknown }
  | { kind: 'done' };

/**
 * High-level compose stream: an async iterable of typed events AND an event
 * emitter AND a spec accumulator, in one object.
 *
 *   const stream = frayme.compose.stream({ prompt });
 *   stream.on('op', (op, snapshot) => render(snapshot));
 *   stream.on('restarted', () => clearRendered());
 *   const { spec } = await stream.finalSpec();
 */
export class ComposeStream implements AsyncIterable<ComposeStreamEvent> {
  readonly controller: AbortController;

  #handlers: { [K in keyof ComposeStreamHandlers]: Array<ComposeStreamHandlers[K]> } = {
    started: [],
    op: [],
    restarted: [],
    completed: [],
    error: [],
    abort: [],
    end: [],
  };

  #queue: QueueItem[] = [];
  #wake: (() => void) | undefined;
  #finished = false;

  // Seed `elements` so early snapshots ({root} before any element patch) are
  // always renderable — consumers index spec.elements[spec.root] unguarded.
  // In prior_spec ("evolve") mode the seed is the prior spec, so the server's
  // minimal patch applies over it (and re-seeds on restart).
  #seed: Partial<Spec> = { elements: {} };
  // Accumulator applied via applySpecStreamPatch (parse-once: the op object is
  // applied directly — no JSON.stringify→reparse round-trip). Cloned from #seed
  // so we never mutate the caller's prior_spec (applySpecStreamPatch mutates in
  // place). Equivalence vs the old stream compiler is pinned by
  // test/op-accumulation-equivalence.test.ts.
  #acc: Spec = { elements: {} } as Spec;
  #completed: ComposeCompletedEvent | undefined;

  #finalSpec: Promise<FinalSpec>;
  #resolveFinal!: (value: FinalSpec) => void;
  #rejectFinal!: (reason: unknown) => void;

  constructor(
    responsePromise: Promise<{ response: Response; controller: AbortController }>,
    opts: {
      firstEventTimeoutMs: number;
      /**
       * The controller whose signal was composed into the transport request —
       * aborting it cancels the fetch and any in-flight body read.
       */
      controller: AbortController;
      /** Prior spec to seed the accumulator with (prior_spec / evolve mode). */
      seed?: Partial<Spec>;
    },
  ) {
    this.controller = opts.controller;
    if (opts.seed) {
      this.#seed = opts.seed;
      this.#acc = structuredClone(opts.seed) as Spec;
    }
    this.#finalSpec = new Promise<FinalSpec>((resolve, reject) => {
      this.#resolveFinal = resolve;
      this.#rejectFinal = reject;
    });
    // finalSpec() is optional API — don't crash the process when nobody awaits it.
    this.#finalSpec.catch(() => {});
    void this.#pump(responsePromise, opts);
  }

  on<K extends keyof ComposeStreamHandlers>(event: K, handler: ComposeStreamHandlers[K]): this {
    this.#handlers[event].push(handler);
    return this;
  }

  /** Abort the stream and the underlying network request. */
  abort(): void {
    this.controller.abort();
  }

  /** Resolves with the validated final spec on `compose.completed`; rejects on error/abort. */
  finalSpec(): Promise<FinalSpec> {
    return this.#finalSpec;
  }

  /** The spec as accumulated so far (provisional until `compose.completed`). */
  currentSpec(): Spec {
    return this.#acc;
  }

  #emit<K extends keyof ComposeStreamHandlers>(
    event: K,
    ...args: Parameters<ComposeStreamHandlers[K]>
  ): void {
    for (const handler of this.#handlers[event]) {
      try {
        (handler as (...a: Parameters<ComposeStreamHandlers[K]>) => void)(...args);
      } catch (err) {
        // A consumer handler threw — never let it abort the stream or get
        // misclassified downstream as a network error (APIConnectionError).
        console.error(`[frayme] compose "${String(event)}" handler threw:`, err);
      }
    }
  }

  #push(item: QueueItem): void {
    this.#queue.push(item);
    this.#wake?.();
    this.#wake = undefined;
  }

  async #pump(
    responsePromise: Promise<{ response: Response; controller: AbortController }>,
    opts: { firstEventTimeoutMs: number },
  ): Promise<void> {
    let transportController: AbortController | undefined;
    try {
      const { response, controller } = await responsePromise;
      transportController = controller;
      if (this.controller.signal.aborted) {
        throw new APIUserAbortError('Compose stream was aborted.');
      }

      // The first-event deadline aborts the TRANSPORT controller (a connection
      // failure), never `this.controller` (which signals a USER abort).
      for await (const event of composeEvents(response, {
        firstEventTimeoutMs: opts.firstEventTimeoutMs,
        controller,
      })) {
        switch (event.type) {
          case 'compose.started':
            this.#emit('started', event);
            break;
          case 'op': {
            const { type: _type, ...patch } = event;
            // applySpecStreamPatch is generic over Record<string, unknown> and
            // mutates+returns the base; Spec lacks an index signature so cast
            // through unknown (same pattern as @frayme/runtime ag-ui/events).
            this.#acc = applySpecStreamPatch(
              this.#acc as unknown as Record<string, unknown>,
              patch as unknown as SpecStreamLine,
            ) as unknown as Spec;
            this.#emit('op', event, this.#acc);
            break;
          }
          case 'compose.restarted':
            this.#acc = structuredClone(this.#seed) as Spec;
            this.#emit('restarted', event);
            break;
          case 'compose.completed':
            this.#completed = event;
            this.#emit('completed', event);
            break;
        }
        this.#push({ kind: 'event', event });
      }

      if (this.#completed) {
        this.#resolveFinal({
          spec: this.#acc,
          generationId: this.#completed.generation_id,
          model: this.#completed.model,
          operationCount: this.#completed.operation_count,
          usage: this.#completed.usage,
          replayed: this.#completed.replayed ?? false,
        });
        this.#push({ kind: 'done' });
      } else {
        throw new FraymeError('Stream ended before compose.completed.');
      }
    } catch (err) {
      const aborted =
        err instanceof APIUserAbortError ||
        this.controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError');
      if (aborted) {
        transportController?.abort();
        const abortError =
          err instanceof APIUserAbortError
            ? err
            : new APIUserAbortError('Compose stream was aborted.');
        this.#rejectFinal(abortError);
        this.#emit('abort', abortError);
        this.#push({ kind: 'done' }); // consumer-initiated: iterator ENDS cleanly, no throw
      } else {
        const error =
          err instanceof FraymeError
            ? err
            : new APIConnectionError(
                `Stream connection failed: ${err instanceof Error ? err.message : String(err)}`,
              );
        this.#rejectFinal(error);
        this.#emit('error', error);
        this.#push({ kind: 'error', error });
      }
    } finally {
      this.#finished = true;
      this.#emit('end');
      this.#wake?.();
      this.#wake = undefined;
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<ComposeStreamEvent, void, undefined> {
    let cursor = 0;
    try {
      for (;;) {
        while (cursor < this.#queue.length) {
          const item = this.#queue[cursor++]!;
          if (item.kind === 'event') yield item.event;
          else if (item.kind === 'error') throw item.error;
          else return;
        }
        if (this.#finished) return;
        await new Promise<void>((resolve) => {
          this.#wake = resolve;
        });
      }
    } finally {
      // `break` out of a for-await cancels the stream (Anthropic convention).
      if (!this.#finished) this.controller.abort();
    }
  }
}
