export const INITIAL_RETRY_DELAY_MS = 500;
export const MAX_RETRY_DELAY_MS = 5_000;
export const MAX_RETRY_AFTER_MS = 60_000;

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

/** Exponential backoff with equal jitter: min(500·2^n, 5000) × rand[0.5, 1.0). */
export function backoffMs(retryIndex: number): number {
  const base = Math.min(INITIAL_RETRY_DELAY_MS * 2 ** retryIndex, MAX_RETRY_DELAY_MS);
  return base * (0.5 + Math.random() * 0.5);
}

/** Parse a Retry-After header (seconds or HTTP-date) → ms, honored only within (0, 60s]. */
export function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  let ms: number | undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    ms = seconds * 1000;
  } else {
    const date = Date.parse(header);
    if (!Number.isNaN(date)) ms = date - Date.now();
  }
  if (ms === undefined || ms <= 0 || ms > MAX_RETRY_AFTER_MS) return undefined;
  return ms;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
