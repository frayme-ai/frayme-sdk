'use client';
import type { ComponentRenderProps } from '../upstream.js';
import { isDev } from '../dev.js';

/**
 * Inert fallback for unknown component types and not-yet-implemented stubs.
 * Renders a labeled placeholder so a stray type can never hard-fail a page —
 * and never executes anything from the spec. In dev it also names the likely
 * fix (the #1 BYOC integration mistake: the API composed a custom type but the
 * renderer's `components` registry doesn't have it).
 */
export function Fallback({ element, children }: ComponentRenderProps): React.ReactNode {
  return (
    <div className="frayme-fallback" data-frayme-fallback={element.type}>
      <span className="frayme-fallback-label">{element.type}</span>
      {isDev && (
        <span className="frayme-fallback-hint" data-frayme-fallback-hint={element.type}>
          {`"${element.type}" isn't in this renderer's components. If it's a custom component, pass your registry: components={createCustomComponents([…]).registry} (and catalog={….catalog}).`}
        </span>
      )}
      {children}
    </div>
  );
}
