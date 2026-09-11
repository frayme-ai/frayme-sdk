/**
 * Minimal ambient declarations for the Node built-ins used by the file-scanning
 * conformance test. The monorepo intentionally ships no `@types/node` (lean
 * dev deps); these cover only what `event-conformance.test.tsx` calls. Vitest
 * provides the real implementations at run time.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}
