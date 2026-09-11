'use client';
import { useId } from 'react';
import type { ComponentRenderProps } from '../upstream.js';

/**
 * Stable, INSTANCE-unique ids for trigger↔panel pairings (`aria-controls`,
 * `aria-labelledby`, `aria-describedby`).
 *
 * The spec id alone is not enough. `__fid` is the element's key in
 * `spec.elements`, and json-render's `repeat` re-renders that element's CHILDREN
 * once per row — so every row reuses one `__fid`. Verified by rendering a Tree
 * inside a two-row repeat: both rows emitted `role="group"` carrying the
 * identical id, and row two's `treeitem` pointed a screen reader at row one's
 * group. The same shape affects the shipped Accordion and Tabs pairings.
 *
 * `useId()` closes it: React gives each component INSTANCE its own value, so two
 * repeat rows differ. The registry avoided it because a host may SSR the renderer
 * into a larger tree and hydrate elsewhere, where positional ids can diverge —
 * but the trigger and its panel are rendered by the SAME component and read the
 * SAME value, so a divergence changes the string on both sides at once and the
 * pairing never breaks. The spec id stays in the middle so ids remain legible
 * when debugging a real spec.
 */
export function useAriaId(scope: string, element: ComponentRenderProps['element']): (...parts: Array<string | number>) => string {
  const instance = useId().replace(/[^a-zA-Z0-9_-]+/g, '');
  const raw = (element as { props?: { __fid?: unknown } }).props?.__fid;
  const fid = typeof raw === 'string' ? raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') : '';
  return (...parts) => {
    const tail = parts
      .map((s) => String(s).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''))
      .filter((s) => s.length > 0)
      .join('-');
    return ['frayme', scope, fid, instance, tail].filter((s) => s.length > 0).join('-');
  };
}
