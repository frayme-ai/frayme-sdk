/** SSE frame builders matching the exact Frayme wire format, plus stream fabricators. */

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const frame = {
  started: (over: Record<string, unknown> = {}): string =>
    sse('compose.started', { type: 'compose.started', generation_id: 'gen_1', model: 'frayme', ...over }),
  op: (patch: Record<string, unknown>): string => sse('op', { type: 'op', ...patch }),
  restarted: (over: Record<string, unknown> = {}): string =>
    sse('compose.restarted', {
      type: 'compose.restarted',
      generation_id: 'gen_1',
      model: 'frayme/fallback-model',
      reason: { code: 'catalog_validation_failed' },
      ...over,
    }),
  completed: (over: Record<string, unknown> = {}): string =>
    sse('compose.completed', {
      type: 'compose.completed',
      generation_id: 'gen_1',
      model: 'frayme',
      operation_count: 3,
      usage: { input_tokens: 100, output_tokens: 200 },
      validated: true,
      ...over,
    }),
  errorEvent: (code: string, message: string): string =>
    sse('error', { type: 'error', error: { code, message } }),
  ping: (): string => ': ping\n\n',
};

/** A canonical 3-op sequence that builds {root: 'card', elements: {card, txt}}. */
export const OPS = [
  { op: 'add', path: '/root', value: 'card' },
  { op: 'add', path: '/elements/card', value: { type: 'Card', props: {}, children: ['txt'] } },
  { op: 'add', path: '/elements/txt', value: { type: 'Text', props: { content: 'Hi' } } },
];

export const happyPayload = (over: Record<string, unknown> = {}): string =>
  frame.started() + OPS.map((p) => frame.op(p)).join('') + frame.completed(over);

const encoder = new TextEncoder();

/** Encode a payload and emit it in chunks split at the given byte offsets (or one chunk). */
export function sseStream(payload: string, opts: { splitAt?: number[] } = {}): ReadableStream<Uint8Array> {
  const bytes = encoder.encode(payload);
  const offsets = [...(opts.splitAt ?? [])].sort((a, b) => a - b).filter((n) => n > 0 && n < bytes.length);
  const chunks: Uint8Array[] = [];
  let prev = 0;
  for (const off of offsets) {
    chunks.push(bytes.slice(prev, off));
    prev = off;
  }
  chunks.push(bytes.slice(prev));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

/** A stream that emits initial frames, then stays open (pings on demand). Errors with AbortError when `signal` aborts — mimicking real fetch. */
export function openStream(initial: string, signal?: AbortSignal): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(initial));
      signal?.addEventListener(
        'abort',
        () => {
          try {
            controller.error(new DOMException('The operation was aborted.', 'AbortError'));
          } catch {
            /* already closed */
          }
        },
        { once: true },
      );
      // never closes on its own
    },
  });
}

/** A stream that emits frames then dies with a connection error. */
export function dyingStream(initial: string, error: Error): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(initial));
      controller.error(error);
    },
  });
}
