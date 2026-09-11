'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { RefObject, UIEvent } from 'react';

/* _scroll — sticky auto-scroll to bottom (LogConsole follow mode).
 *
 * Keeps a scroll container pinned to the bottom as new content arrives WHEN follow
 * is on AND the user hasn't scrolled up. SSR-safe: the list renders top-anchored on
 * the server; the jump-to-bottom is a post-mount effect (never a layout read during
 * render). `pinned` is a ref (read in the dep effect so it sees the live value) plus
 * a state mirror for rendering a "jump to latest" affordance. */

export interface StickyScroll {
  pinned: boolean;
  onScroll: (e: UIEvent<HTMLElement>) => void;
  scrollToBottom: () => void;
}

export function useStickyAutoScroll(opts: { scrollRef: RefObject<HTMLElement | null>; follow: boolean; dep: unknown }): StickyScroll {
  const { scrollRef, follow, dep } = opts;
  const pinnedRef = useRef(true);
  const [pinned, setPinned] = useState(true);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollRef]);

  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
    pinnedRef.current = atBottom;
    setPinned(atBottom);
  }, []);

  // Post-mount jump (SSR renders top-anchored; the tail is applied on the client).
  useEffect(() => {
    if (follow) {
      scrollToBottom();
      pinnedRef.current = true;
      setPinned(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New content arrived: stay pinned only if the user is still at the bottom.
  useEffect(() => {
    if (follow && pinnedRef.current) scrollToBottom();
  }, [dep, follow, scrollToBottom]);

  return { pinned, onScroll, scrollToBottom };
}
