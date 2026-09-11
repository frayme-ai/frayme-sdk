import { APIConnectionError, FraymeError, errorFromEventCode } from '../core/errors.js';
import { parseSSE } from '../core/sse.js';
import type { ComposeStreamEvent } from './events.js';

interface ErrorEventPayload {
  type: 'error';
  error: { code: string; message: string };
}

/**
 * Turn a 200 `text/event-stream` Response into typed compose events.
 *
 * - asserts the content type
 * - JSON-parses each `data:` payload (malformed data fails LOUD — never skipped)
 * - in-band `error` events become thrown typed FraymeErrors
 * - enforces a first-event deadline (keepalive pings are comments and do not count)
 */
export async function* composeEvents(
  response: Response,
  opts: { firstEventTimeoutMs: number; controller: AbortController },
): AsyncGenerator<ComposeStreamEvent, void, undefined> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    throw new FraymeError(
      `Expected a text/event-stream response but received "${contentType}".`,
      { status: response.status },
    );
  }
  if (!response.body) {
    throw new APIConnectionError('Stream response has no body.');
  }

  const messages = parseSSE(response.body)[Symbol.asyncIterator]();
  let first = true;

  try {
    for (;;) {
      let result: IteratorResult<{ event: string | undefined; data: string }>;
      if (first) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            opts.controller.abort();
            reject(
              new APIConnectionError(
                `No event received from the compose stream within ${opts.firstEventTimeoutMs}ms.`,
              ),
            );
          }, opts.firstEventTimeoutMs);
        });
        try {
          result = await Promise.race([messages.next(), deadline]);
        } finally {
          clearTimeout(timer);
        }
        first = false;
      } else {
        result = await messages.next();
      }

      if (result.done) return;
      const { data } = result.value;

      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        throw new FraymeError(`Malformed event data received from stream: ${data.slice(0, 120)}`);
      }

      const typed = payload as ComposeStreamEvent | ErrorEventPayload;
      if (typed.type === 'error') {
        throw errorFromEventCode(typed.error.code, typed.error.message);
      }
      yield typed;
    }
  } finally {
    await messages.return?.(undefined as never).catch(() => {});
  }
}
