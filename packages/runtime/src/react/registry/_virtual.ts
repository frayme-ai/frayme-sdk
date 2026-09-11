'use client';
import { useState, useEffect, useCallback } from 'react';
import type { RefObject, UIEvent } from 'react';

/* _virtual — fixed-row list virtualization (LogConsole + NotificationCenter-when-large).
 *
 * Renders only the visible slice of a long list into the DOM, with two spacer divs
 * (padTop/padBottom) so the native scrollbar stays accurate. FIXED row height only
 * (logs/notifications are single-line-ish); variable height is out of v1.
 *
 * SSR-safe: before the viewport is measured, `viewportH` is 0 → a sensible default
 * height is used so the TOP slice renders on the server (no getBoundingClientRect at
 * render). The measure happens in an effect (client) via ResizeObserver. */

export interface Windowed<T> {
  total: number;
  padTop: number;
  padBottom: number;
  slice: { item: T; index: number }[];
  onScroll: (e: UIEvent<HTMLElement>) => void;
}

export function useWindowedList<T>(opts: { items: T[]; rowHeight: number; overscan?: number; scrollRef: RefObject<HTMLElement | null> }): Windowed<T> {
  const { items, rowHeight, overscan = 6, scrollRef } = opts;
  const rh = Math.max(1, rowHeight);
  const total = items.length;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewportH(el.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    setViewportH((h) => (el.clientHeight !== h ? el.clientHeight : h));
  }, []);

  const vh = viewportH || 360; // pre-measure default so the top slice renders on SSR
  const first = Math.max(0, Math.floor(scrollTop / rh) - overscan);
  const count = Math.max(0, Math.min(total - first, Math.ceil(vh / rh) + 2 * overscan));
  const slice: { item: T; index: number }[] = [];
  for (let i = first; i < first + count; i++) slice.push({ item: items[i], index: i });

  return {
    total,
    padTop: first * rh,
    padBottom: Math.max(0, (total - first - count) * rh),
    slice,
    onScroll,
  };
}
