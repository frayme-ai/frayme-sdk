import type { ComposeRequest, ComposeResult } from '../api-types.js';
import { generateIdempotencyKey } from '../core/idempotency.js';
import { request, requestData } from '../core/transport.js';
import type { ResolvedConfig } from '../options.js';
import { ComposeStream } from '../streaming/compose-stream.js';
import { composeEvents } from '../streaming/event-stream.js';
import type { ComposeStreamEvent } from '../streaming/events.js';

export interface RequestMethodOptions {
  signal?: AbortSignal;
  /** Supply your own Idempotency-Key; otherwise one is auto-generated when retries are enabled. */
  idempotencyKey?: string;
  maxRetries?: number;
}

export class ComposeResource {
  constructor(private readonly cfg: ResolvedConfig) {}

  #idempotencyKey(options: RequestMethodOptions | undefined): string | undefined {
    if (options?.idempotencyKey) return options.idempotencyKey;
    const maxRetries = options?.maxRetries ?? this.cfg.maxRetries;
    return maxRetries > 0 ? generateIdempotencyKey() : undefined;
  }

  /**
   * Low-level compose. `stream: true` resolves to a plain async iterable of
   * typed events (no accumulation); otherwise resolves to the final result.
   */
  create(
    body: ComposeRequest & { stream: true },
    options?: RequestMethodOptions,
  ): Promise<AsyncIterable<ComposeStreamEvent>>;
  create(
    body: ComposeRequest & { stream?: false | undefined },
    options?: RequestMethodOptions,
  ): Promise<ComposeResult>;
  async create(
    body: ComposeRequest,
    options?: RequestMethodOptions,
  ): Promise<AsyncIterable<ComposeStreamEvent> | ComposeResult> {
    const idempotencyKey = this.#idempotencyKey(options);
    if (body.stream === true) {
      const result = await request(this.cfg, {
        method: 'POST',
        path: '/v1/compose',
        body: { ...body, stream: true },
        stream: true,
        idempotencyKey,
        signal: options?.signal,
        maxRetries: options?.maxRetries,
      });
      return composeEvents(result.response, {
        firstEventTimeoutMs: this.cfg.firstEventTimeout,
        controller: result.controller,
      });
    }
    return requestData<ComposeResult>(this.cfg, {
      method: 'POST',
      path: '/v1/compose',
      body: { ...body, stream: false },
      idempotencyKey,
      signal: options?.signal,
      maxRetries: options?.maxRetries,
    });
  }

  /**
   * High-level streaming compose: returns a {@link ComposeStream} combining
   * `.on()` handlers, async iteration, spec accumulation, restart handling,
   * `.abort()`, and `finalSpec()`.
   */
  stream(
    body: Omit<ComposeRequest, 'stream'>,
    options?: RequestMethodOptions,
  ): ComposeStream {
    const controller = new AbortController();
    const signals = [controller.signal];
    if (options?.signal) signals.push(options.signal);
    // Read from the body before the request starts. A body that is not an
    // object (JavaScript callers can pass anything) then goes to the API and
    // fails there as a typed error on the stream, instead of throwing here
    // with the request already in flight and nobody to handle its failure.
    const seed = body?.prior_spec;

    const responsePromise = request(this.cfg, {
      method: 'POST',
      path: '/v1/compose',
      body: { ...body, stream: true },
      stream: true,
      idempotencyKey: this.#idempotencyKey(options),
      signal: AbortSignal.any(signals),
      maxRetries: options?.maxRetries,
    });

    try {
      return new ComposeStream(responsePromise, {
        firstEventTimeoutMs: this.cfg.firstEventTimeout,
        controller,
        // Seed the accumulator with prior_spec so an evolve patch applies in place.
        seed,
      });
    } catch (err) {
      // The stream could not be built (a prior_spec that cannot be copied):
      // cancel the request that already started, and keep its rejection from
      // going unhandled, since no stream will ever read it.
      controller.abort();
      responsePromise.catch(() => {});
      throw err;
    }
  }
}
