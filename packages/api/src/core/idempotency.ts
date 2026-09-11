/**
 * One idempotency key is generated per LOGICAL compose call (before attempt 1)
 * and reused verbatim across every retry attempt — that is what makes retried
 * POSTs double-bill-proof (the server replays the stored result for a key it
 * has already completed).
 */
export function generateIdempotencyKey(): string {
  return `frayme-node-retry-${crypto.randomUUID()}`;
}
