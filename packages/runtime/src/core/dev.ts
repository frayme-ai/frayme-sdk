/**
 * `isDev` — true in non-production builds. Reads `process.env.NODE_ENV` (which
 * every bundler statically replaces) without pulling in @types/node: the ambient
 * declaration satisfies tsc for this package, and the try/catch makes the read
 * safe if `process` is genuinely undefined at runtime (default: not dev).
 * Used only to gate dev-only console warnings + the Fallback hint.
 *
 * Lives in the server-safe core (not `react/`) so core helpers can gate their
 * own warnings; `react/dev.ts` re-exports it for the client modules.
 */
declare const process: { env: { NODE_ENV?: string } };

export const isDev: boolean = (() => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();
