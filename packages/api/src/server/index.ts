/**
 * @frayme/api/server: a compose proxy for your own server route.
 *
 * The browser must never hold a Frayme key, so a browser client runs keyless
 * against a route of yours, and that route holds the key:
 *
 *   // app/api/frayme/[...path]/route.ts
 *   export const POST = createFraymeHandler({ authorize: (req) => getSession(req) });
 *
 *   // in the browser
 *   const frayme = new Frayme({ apiKey: null, baseURL: '/api/frayme' });
 *
 * The handler is a plain `(Request) => Promise<Response>`, so it mounts in any
 * fetch-style server. It answers in the API's own formats (the SSE stream, or
 * the JSON envelope for `stream: false`), so the keyless client parses both
 * unchanged.
 */
import type { ComposeRequest } from '../api-types.js';
import { Frayme } from '../client.js';
import {
  APIConnectionError,
  APIUserAbortError,
  AuthenticationError,
  AuthorizationError,
  ERROR_CODE_TO_STATUS,
  FraymeError,
  RateLimitError,
} from '../core/errors.js';
import type { RequestMethodOptions } from '../resources/compose.js';
import type { ComposeStream } from '../streaming/compose-stream.js';
import type { ComposeStreamEvent } from '../streaming/events.js';

export interface FraymeHandlerOptions {
  /**
   * Decide whether this request may compose. Falsy (or a throw) answers 401.
   * Read headers or cookies here, not the body: the handler reads the body next.
   */
  authorize: (request: Request) => unknown | Promise<unknown>;
  /** Default `new Frayme()`, which reads FRAYME_API_KEY and FRAYME_BASE_URL. */
  client?: Frayme;
  /** Always set by the server; the browser cannot choose it. Default `declared_only`. */
  actionPolicy?: 'open' | 'declared_only';
  /** Largest request body accepted, in bytes: a positive number. Default 128 KiB. */
  maxBodyBytes?: number;
  /** Let the browser send `custom_components`. Default false. */
  allowCustomComponents?: boolean;
}

const DEFAULT_MAX_BODY_BYTES = 128 * 1024;
// The API writes a keepalive comment this often; the proxy does the same so an
// idle proxy or load balancer between it and the browser keeps the stream open.
const PING_MS = 15_000;

/**
 * The request fields a browser may send. `action_policy` is deliberately
 * absent: it is the server's decision. So are `metadata` (the server's
 * business) and `custom_components` (opt-in, below).
 */
const ALLOWED_KEYS = new Set([
  'prompt',
  'signals',
  'mode',
  'context',
  'max_operations',
  'data',
  'actions',
  'prior_spec',
  'action_context',
]);

// Forwarded as the API request's own key, so a browser's retry of the same
// call replays upstream instead of composing (and billing) again. The API
// allows up to 255 characters; a header can only carry printable ASCII safely.
const IDEMPOTENCY_KEY = /^[\x20-\x7E]{1,255}$/;

const NOT_CONFIGURED = 'The compose proxy is not configured.';

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-accel-buffering': 'no',
};

const encoder = new TextEncoder();

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// The event name is written raw on its own line, so only a plain token may
// pass: a newline in it would let one frame forge another.
const EVENT_NAME = /^[A-Za-z0-9_.-]{1,64}$/;

/** One upstream event as a frame, or '' for an event whose name is unsafe to write. */
function eventFrame(event: ComposeStreamEvent): string {
  return typeof event.type === 'string' && EVENT_NAME.test(event.type) ? sseFrame(event.type, event) : '';
}

/** The wire code for a status, for errors that arrived without one. */
function codeForStatus(status: number): string {
  for (const [code, mapped] of Object.entries(ERROR_CODE_TO_STATUS)) {
    if (mapped === status) return code;
  }
  return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST';
}

/**
 * The API refused the SERVER's key: missing, revoked, or without the scope.
 * That is this server's configuration, not the browser user's session, so it
 * must not reach the browser as a 401 or 403 (which reads as "signed out").
 * `FEATURE_LIMIT` is a 403 about the request itself, so it passes through.
 */
function isServerKeyProblem(err: FraymeError): boolean {
  return err instanceof AuthenticationError || (err instanceof AuthorizationError && err.code !== 'FEATURE_LIMIT');
}

interface WireError {
  status: number;
  code: string;
  message: string;
  headers: Record<string, string>;
}

/**
 * Map any failure to what the API itself would send. Messages are forwarded
 * only when they came from the API (they carry a wire code); anything raised
 * locally gets a fixed message, so nothing about this server leaks out.
 */
function toWireError(err: unknown): WireError {
  const headers: Record<string, string> = {};
  if (err instanceof FraymeError) {
    if (err.requestId) headers['x-request-id'] = err.requestId;
    if (isServerKeyProblem(err)) {
      console.error('[frayme] compose proxy: the Frayme API refused this server\'s key:', err.code, err.message);
      return { status: 500, code: 'INTERNAL_SERVER_ERROR', message: NOT_CONFIGURED, headers };
    }
    if (err instanceof RateLimitError && err.retryAfter !== undefined) {
      headers['retry-after'] = String(err.retryAfter);
    }
    if (err.code) {
      const status = err.status ?? ERROR_CODE_TO_STATUS[err.code] ?? 500;
      return { status, code: err.code, message: err.message, headers };
    }
    if (err instanceof APIConnectionError) {
      return { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'The Frayme API could not be reached.', headers };
    }
    // A status below 400 here means the API answered 2xx with something unusable.
    if (err.status !== undefined && err.status >= 400 && err.status <= 599) {
      return {
        status: err.status,
        code: codeForStatus(err.status),
        message: `The Frayme API answered with status ${err.status}.`,
        headers,
      };
    }
    return { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'The compose request failed.', headers };
  }
  return { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred', headers };
}

function jsonError(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ success: false, error: { message, code } }), {
    status,
    headers: { 'content-type': 'application/json', ...BASE_HEADERS, ...headers },
  });
}

/**
 * Only a JSON body is accepted. A cross-site HTML form can post `text/plain`
 * with the user's cookies and no preflight, and a body shaped as JSON would
 * then compose on that user's session. Requiring `application/json` makes any
 * cross-origin call go through a CORS preflight first.
 */
function isJsonRequest(request: Request): boolean {
  const type = request.headers.get('content-type');
  return type !== null && type.split(';', 1)[0]!.trim().toLowerCase() === 'application/json';
}

class BodyTooLarge extends Error {}

/** Read the body as text, refusing past `limit` bytes without buffering the excess. */
async function readBody(request: Request, limit: number): Promise<string> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new BodyTooLarge();
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new BodyTooLarge();
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Build the proxy handler. Order of checks: method, authorization, content
 * type, idempotency key, body size, JSON, allowed keys; only then is the API
 * called. The request path is ignored, so the handler can sit behind any route
 * (a keyless client with `baseURL: '/api/frayme'` calls
 * `/api/frayme/v1/compose`). It streams unless the body says `stream: false`,
 * which `compose.create()` sends; that call gets the API's JSON envelope, as
 * the API itself would answer.
 */
export function createFraymeHandler(options: FraymeHandlerOptions): (request: Request) => Promise<Response> {
  if (typeof options?.authorize !== 'function') {
    throw new TypeError('createFraymeHandler needs an `authorize` function.');
  }
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  // A bad cap is a configuration error, and NaN would silently remove it.
  if (typeof maxBodyBytes !== 'number' || !Number.isFinite(maxBodyBytes) || maxBodyBytes <= 0) {
    throw new TypeError('createFraymeHandler: `maxBodyBytes` must be a positive number of bytes.');
  }
  const actionPolicy = options.actionPolicy ?? 'declared_only';
  if (actionPolicy !== 'declared_only' && actionPolicy !== 'open') {
    throw new TypeError("createFraymeHandler: `actionPolicy` must be 'declared_only' or 'open'.");
  }
  const allowCustomComponents = options.allowCustomComponents === true;
  // Created on first use, so importing the route never needs the key (a build
  // step may evaluate the module without one).
  let client = options.client;

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return jsonError(405, 'BAD_REQUEST', 'Only POST is supported.', { allow: 'POST' });
    }

    let allowed: unknown;
    try {
      allowed = await options.authorize(request);
    } catch {
      // The reason stays on the server: it may name users, sessions or internals.
      allowed = false;
    }
    if (!allowed) return jsonError(401, 'AUTHENTICATION_REQUIRED', 'Not authorized.');

    if (!isJsonRequest(request)) {
      return jsonError(415, 'BAD_REQUEST', 'The request body must be sent as application/json.');
    }

    const idempotencyKey = request.headers.get('idempotency-key') || undefined;
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return jsonError(400, 'BAD_REQUEST', 'The Idempotency-Key header must be 1 to 255 printable ASCII characters.');
    }

    let text: string;
    try {
      text = await readBody(request, maxBodyBytes);
    } catch (err) {
      if (err instanceof BodyTooLarge) {
        return jsonError(413, 'BAD_REQUEST', `The request body is larger than ${maxBodyBytes} bytes.`);
      }
      return jsonError(400, 'BAD_REQUEST', 'The request body could not be read.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonError(400, 'BAD_REQUEST', 'The request body is not valid JSON.');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return jsonError(400, 'BAD_REQUEST', 'The request body must be a JSON object.');
    }

    const entries: Array<[string, unknown]> = [];
    let buffered = false;
    for (const [key, value] of Object.entries(parsed)) {
      // The flag picks the answer's format below; the API call sets its own.
      // Only an explicit false buffers, as on the API, where true is the default.
      if (key === 'stream') {
        buffered = value === false;
        continue;
      }
      if (ALLOWED_KEYS.has(key) || (key === 'custom_components' && allowCustomComponents)) {
        entries.push([key, value]);
        continue;
      }
      return jsonError(400, 'BAD_REQUEST', `Unknown field "${key.slice(0, 80)}".`);
    }
    // fromEntries defines own properties, so no key can reach a prototype.
    const body = Object.fromEntries(entries) as Omit<ComposeRequest, 'stream'>;
    body.action_policy = actionPolicy;

    try {
      client ??= new Frayme();
    } catch (err) {
      console.error('[frayme] compose proxy is not configured:', err);
      return jsonError(500, 'INTERNAL_SERVER_ERROR', NOT_CONFIGURED);
    }

    const callOptions: RequestMethodOptions = {
      signal: request.signal,
      // The browser client retries this route itself; retrying here as well
      // would multiply one call into many upstream composes.
      maxRetries: 0,
    };
    if (idempotencyKey !== undefined) callOptions.idempotencyKey = idempotencyKey;

    if (buffered) {
      try {
        const data = await client.compose.create({ ...body, stream: false }, callOptions);
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { 'content-type': 'application/json', ...BASE_HEADERS },
        });
      } catch (err) {
        if (err instanceof APIUserAbortError || request.signal.aborted) {
          return jsonError(499, 'BAD_REQUEST', 'The request was aborted.');
        }
        const wire = toWireError(err);
        return jsonError(wire.status, wire.code, wire.message, wire.headers);
      }
    }

    let compose: ComposeStream;
    let events: AsyncIterator<ComposeStreamEvent>;
    let first: IteratorResult<ComposeStreamEvent>;
    try {
      compose = client.compose.stream(body, callOptions);
      events = compose[Symbol.asyncIterator]();
      // Wait for the first event: until then a failure can still be a real
      // HTTP status, which the browser client turns into the right error class.
      first = await events.next();
    } catch (err) {
      const wire = toWireError(err);
      return jsonError(wire.status, wire.code, wire.message, wire.headers);
    }
    if (first.done) {
      // Only an abort ends the stream without an event; the browser has gone.
      return jsonError(499, 'BAD_REQUEST', 'The request was aborted.');
    }

    const firstEvent: ComposeStreamEvent = first.value;
    const upstream = compose;
    const rest = events;
    let closed = false;
    const sse = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (chunk: string): void => {
          if (closed || chunk === '') return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closed = true;
          }
        };
        const ping = setInterval(() => write(': ping\n\n'), PING_MS);
        write(eventFrame(firstEvent));

        void (async () => {
          try {
            for (;;) {
              const next = await rest.next();
              if (next.done) break;
              write(eventFrame(next.value));
            }
          } catch (err) {
            if (!(err instanceof APIUserAbortError) && !request.signal.aborted) {
              // After the 200 the status is spent: the error goes in-band.
              const wire = toWireError(err);
              write(sseFrame('error', { type: 'error', error: { code: wire.code, message: wire.message } }));
            }
          } finally {
            clearInterval(ping);
            if (!closed) {
              closed = true;
              try {
                controller.close();
              } catch {
                // already closed by the reader
              }
            }
          }
        })();
      },
      cancel() {
        // The browser stopped reading: stop the upstream generation too.
        closed = true;
        upstream.abort();
      },
    });

    return new Response(sse, {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8', ...BASE_HEADERS },
    });
  };
}
