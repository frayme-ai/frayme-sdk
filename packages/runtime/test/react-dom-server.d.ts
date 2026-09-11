/**
 * `@types/react-dom` is not installed in this workspace (only `@types/react`),
 * so `react-dom/server` resolves to an untyped JS entry and `tsc --noEmit`
 * fails on the implicit any. These tests render through the SSR entry on
 * purpose — the fabrication hole was found with a server-side probe and the fix
 * has to be proved the same way — so declare the two functions they use.
 */
declare module 'react-dom/server' {
  import type { ReactNode } from 'react';
  export function renderToString(node: ReactNode): string;
  export function renderToStaticMarkup(node: ReactNode): string;
}
