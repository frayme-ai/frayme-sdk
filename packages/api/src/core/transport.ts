import type { ResolvedConfig } from '../options.js';
import { APIConnectionError, APIUserAbortError, castError, type FraymeError } from './errors.js';
import { userAgent } from './platform.js';
import { backoffMs, isRetryableStatus, retryAfterMs, sleep } from './retry.js';

export interface RequestSpec {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  /** Sets Accept: text/event-stream and returns the raw Response. */
  stream?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
  maxRetries?: number;
}

export interface TransportResult {
  response: Response;
  /** Abort this to cancel the request and any in-flight stream read. */
  controller: AbortController;
}

function buildHeaders(cfg: ResolvedConfig, spec: RequestSpec): Headers {
  const headers = new Headers(cfg.defaultHeaders);
  headers.set('Accept', spec.stream ? 'text/event-stream' : 'application/json');
  if (!headers.has('User-Agent')) headers.set('User-Agent', userAgent());
  if (cfg.apiKey != null) headers.set('Authorization', `Bearer ${cfg.apiKey}`);
  if (spec.body !== undefined) headers.set('Content-Type', 'application/json');
  if (spec.idempotencyKey) headers.set('Idempotency-Key', spec.idempotencyKey);
  return headers;
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Fetch with retries. Retries happen ONLY while acquiring a successful
 * response — the moment a 2xx exists (streaming or not), the retry loop is
 * permanently exited. Mid-stream failures are the caller's domain.
 */
export async function request(cfg: ResolvedConfig, spec: RequestSpec): Promise<TransportResult> {
  const controller = new AbortController();
  const signals: AbortSignal[] = [controller.signal, AbortSignal.timeout(cfg.timeout)];
  if (spec.signal) signals.push(spec.signal);
  const signal = AbortSignal.any(signals);

  const maxRetries = spec.maxRetries ?? cfg.maxRetries;
  const url = `${cfg.baseURL}${spec.path}`;
  const headers = buildHeaders(cfg, spec);
  const init: RequestInit = {
    method: spec.method,
    headers,
    signal,
    ...(spec.body !== undefined ? { body: JSON.stringify(spec.body) } : {}),
  };

  let lastError: FraymeError | undefined;
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await cfg.fetch(url, init);
    } catch (err) {
      if (spec.signal?.aborted || controller.signal.aborted) {
        throw new APIUserAbortError('Request was aborted.');
      }
      if (signal.aborted) {
        throw new APIConnectionError(`Request timed out after ${cfg.timeout}ms.`);
      }
      lastError = new APIConnectionError(
        `Connection error: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt), signal);
        continue;
      }
      throw lastError;
    }

    if (response.ok) return { response, controller };

    const retryable = isRetryableStatus(response.status);
    if (retryable && attempt < maxRetries) {
      const serverDelay = retryAfterMs(response.headers.get('retry-after'));
      const delay = Math.max(backoffMs(attempt), serverDelay ?? 0);
      response.body?.cancel().catch(() => {});
      await sleep(delay, signal);
      continue;
    }

    throw castError(response.status, await parseErrorBody(response), response.headers);
  }
}

/** Perform a JSON request and unwrap the `{success:true, data}` envelope. */
export async function requestData<T>(cfg: ResolvedConfig, spec: RequestSpec): Promise<T> {
  const { response } = await request(cfg, { ...spec, stream: false });
  const json = (await response.json().catch(() => {
    throw new APIConnectionError('Failed to parse JSON response body.');
  })) as { success?: boolean; data?: T };
  return (json.data ?? (json as unknown)) as T;
}
