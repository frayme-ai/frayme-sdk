import { useEffect, useRef } from 'react';

/**
 * Scroll-edge affordances, MEASURED rather than inferred.
 *
 * The previous mechanism was the two-layer `background-attachment: local/scroll`
 * trick: a shadow pinned to the viewport edge, and a "cover" gradient attached to
 * the content that slid over it whenever there was nothing more to reach. It is a
 * clever trick and it failed here three times, because the cover has to REPAINT
 * THE PARENT'S BACKGROUND and CSS cannot know what that is. It was hardcoded to
 * `--color-card`, so on a page surface, a muted section, or inside a Card with an
 * authored `bg` (which re-points `--fr-card-bg`, never `--color-card`) the cover
 * painted the WRONG COLOUR — a visible band that read as a grey blob washing over
 * real data. Sub-pixel overflow made it paint on content that does not scroll at
 * all, and the layer order silently inverted the whole effect.
 *
 * So: no cover. This measures the element and toggles a data attribute, and the
 * CSS paints ONE layer — the shadow — only while there is genuinely more content
 * that way. Nothing has to guess a background colour, because nothing is painted
 * over. An affordance that cannot be wrong about whether it applies.
 *
 * Attributes are written straight to the DOM node instead of through state: these
 * fire on every scroll frame, and a setState per frame would re-render a table on
 * every pixel of travel.
 */
export function useScrollEdges<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  useScrollEdgesOn(ref);
  return ref;
}

/** Same measurement, attached to a ref the caller already owns — the Tabs rail
 *  keeps its own ref for scroll-into-view, and one element takes one ref. */
export function useScrollEdgesOn<T extends HTMLElement>(ref: { current: T | null }): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 1px of slack. Sub-pixel layout routinely leaves scrollWidth a fraction above
    // clientWidth on content that visibly does not scroll, and that fraction is
    // what used to paint a permanent fade.
    const SLACK = 1;
    const measure = () => {
      const moreX = el.scrollWidth - el.clientWidth > SLACK
        && el.scrollLeft + el.clientWidth < el.scrollWidth - SLACK;
      const moreY = el.scrollHeight - el.clientHeight > SLACK
        && el.scrollTop + el.clientHeight < el.scrollHeight - SLACK;
      el.toggleAttribute('data-fr-more-x', moreX);
      el.toggleAttribute('data-fr-more-y', moreY);
    };

    measure();
    // GUARDED. ResizeObserver is absent in jsdom and in any older engine, and an
    // unguarded `new ResizeObserver` throws straight through this hook into
    // json-render's ElementErrorBoundary — which unmounts the WHOLE component. The
    // first version of this took DataTable, Tabs, ToggleGroup, ButtonGroup and
    // NotificationCenter down to zero rendered output wherever it was missing: 102
    // test failures, and a blank table for any consumer on an engine without it.
    // A scroll affordance must never be able to cost you the component it decorates.
    const hasRO = typeof ResizeObserver !== 'undefined';
    // The CONTENT resizing matters as much as the box: a table that gains a column
    // starts overflowing without the scroller itself changing size.
    const ro = hasRO ? new ResizeObserver(measure) : null;
    if (ro) {
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    }
    // Without RO the viewport is still a signal worth having — it catches the common
    // case (the window narrows until the table overflows) even if it misses content
    // growing on its own.
    const onResize = ro ? null : measure;
    if (onResize && typeof window !== 'undefined') window.addEventListener('resize', onResize, { passive: true });
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro?.disconnect();
      if (onResize && typeof window !== 'undefined') window.removeEventListener('resize', onResize);
      el.removeEventListener('scroll', measure);
    };
  }, []);

}
