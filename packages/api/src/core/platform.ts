import { VERSION } from '../version.js';

/**
 * Browser-like = window + document present. Workers, Deno, Bun, and Node all
 * fail this check; jsdom intentionally passes it (it IS a browser context for
 * the purposes of secret-key exposure).
 */
export function isBrowserLike(): boolean {
  return (
    typeof (globalThis as { window?: unknown }).window !== 'undefined' &&
    typeof (globalThis as { document?: unknown }).document !== 'undefined'
  );
}

export function userAgent(): string {
  return `frayme-node/${VERSION}`;
}
