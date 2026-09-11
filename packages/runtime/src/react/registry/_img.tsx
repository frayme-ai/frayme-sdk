'use client';
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { safeImageSrc } from './url-safety.js';

/**
 * SafeImage — the ONE sanctioned `<img>` for the catalog.
 *
 * Two failure modes a raw `<img>` handles badly and that a spec WILL hit (an
 * agent supplies a dead/blocked/typo URL):
 *  1. an UNSAFE/absent src (rejected by `safeImageSrc` — http/https + raster
 *     data: only) → never renders an active resource;
 *  2. a valid-but-failing src (404/blocked/offline) → a raw `<img>` shows the
 *     ugly browser broken-image glyph.
 *
 * SafeImage routes BOTH to a caller-supplied `fallback` (a placeholder block,
 * initials, an icon) so a broken URL falls back gracefully instead of showing a
 * broken icon. `src` is validated internally (callers pass the raw spec value);
 * `onError` flips to the fallback on a load failure; the error state resets when
 * the src changes (so a recompose that swaps the image re-tries).
 */
export function SafeImage({
  src,
  alt,
  className,
  style,
  loading = 'lazy',
  draggable,
  ariaHidden,
  fallback = null,
}: {
  src?: unknown;
  alt?: string | null;
  className?: string;
  style?: CSSProperties;
  loading?: 'lazy' | 'eager';
  draggable?: boolean;
  /** Mark the rendered image decorative (mirrors a raw `<img aria-hidden>`). */
  ariaHidden?: boolean;
  /** Rendered when the src is unsafe/absent OR fails to load. */
  fallback?: ReactNode;
}): ReactNode {
  const safe = safeImageSrc(src);
  const [errored, setErrored] = useState(false);
  // Reset on src change so a recompose that swaps the image re-attempts the load.
  useEffect(() => {
    setErrored(false);
  }, [safe]);

  if (!safe || errored) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safe}
      alt={alt ?? ''}
      className={className}
      style={style}
      loading={loading}
      draggable={draggable}
      aria-hidden={ariaHidden}
      onError={() => setErrored(true)}
    />
  );
}
