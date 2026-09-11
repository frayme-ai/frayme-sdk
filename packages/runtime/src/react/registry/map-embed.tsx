'use client';
import { useEffect, useState, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, aspectClass } from './_style.js';
import { clampInt } from './_num.js';
import { safeColor, safeLatLng, safeDimension } from '@frayme/catalog/validate';
import { safeUrl, safeEmbedUrl, linkTargetRel } from './url-safety.js';
import { fmtPoint } from './_geo.js';

/* Catalog component (map-embed): MapEmbed — the "Google Maps widget".
 * A live map in a hardened, hostname-allowlisted (safeEmbedUrl), sandboxed iframe —
 * keyless from query/center or an official host-built embedUrl (no key ever stored).
 * Falls back to a static location card (+ coordinate locator) with an "Open in Google
 * Maps" link where a surface blocks frames. query encodeURIComponent'd + re-checked;
 * center safeLatLng-validated; pin color INLINE (safeColor); one emitWith('commit')
 * from a synchronous click. */

const MAX_LABEL = 200;
const cap = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, MAX_LABEL) : '');

export function MapEmbed({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    query?: string | null; center?: { lat?: unknown; lng?: unknown } | null; zoom?: number | null;
    embedUrl?: string | null; interactive?: boolean | null; title?: string | null; placeName?: string | null;
    showCoords?: boolean | null; selectable?: boolean | null; aspect?: string | null;
    height?: unknown; accent?: unknown; borderColor?: unknown; radiusValue?: unknown;
    selectedLocation?: unknown;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  const center = p.center ? safeLatLng({ lat: p.center.lat, lng: p.center.lng }) : null;
  const zoomN = clampInt(p.zoom, 1, 21, 14);
  const query = cap(p.query);
  const title = cap(p.title) || 'Map';
  const placeName = cap(p.placeName) || query || cap(p.title) || 'this location';
  const interactive = p.interactive !== false;
  const showCoords = p.showCoords !== false;
  const accentColor = safeColor(p.accent);

  // ── build the (allowlisted) iframe src ──────────────────────────────────────
  // Google's keyless "?output=embed" refuses framing (X-Frame-Options), so the
  // keyless coordinate map uses OpenStreetMap's frame-friendly embed. An official
  // Google/Mapbox/OSM `embedUrl` (host-built, may carry the host's key) wins.
  let iframeSrc: string | null = null;
  if (typeof p.embedUrl === 'string' && p.embedUrl.trim()) {
    iframeSrc = safeEmbedUrl(p.embedUrl);
  }
  if (!iframeSrc && center) {
    const span = Math.min(40, (360 / Math.pow(2, zoomN)) * 2.5); // lng degrees ~ viewport
    const dLng = span / 2;
    const dLat = (span * 0.6) / 2;
    const w = Math.max(-180, center.lng - dLng), e = Math.min(180, center.lng + dLng);
    const s = Math.max(-85, center.lat - dLat), n = Math.min(85, center.lat + dLat);
    iframeSrc = safeEmbedUrl(`https://www.openstreetmap.org/export/embed.html?bbox=${w}%2C${s}%2C${e}%2C${n}&layer=mapnik&marker=${center.lat}%2C${center.lng}`);
  }
  // query-only (no coordinate) → no reliable keyless live frame → static card + link.

  // ── the always-available "Open in Google Maps" escape link ──────────────────
  const linkQ = query ? encodeURIComponent(query) : center ? `${center.lat},${center.lng}` : '';
  const openHref = linkQ ? safeUrl(`https://www.google.com/maps/search/?api=1&query=${linkQ}`) : null;

  const showIframe = interactive && iframeSrc != null;
  const resolvedSource: 'query' | 'center' = center ? 'center' : 'query';

  const heightDim = safeDimension(p.height, { units: ['px', 'rem'], min: 120, max: 800 });
  const bodyStyle: CSSProperties = heightDim ? { height: heightDim } : {};
  const aspCls = heightDim ? undefined : aspectClass(p.aspect === 'auto' || p.aspect == null ? '16/9' : p.aspect) ?? 'aspect-video';

  const vars = styleVars(
    { var: '--fr-me-accent', value: p.accent, kind: 'color' },
    { var: '--fr-me-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-me-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  );
  const headingId = `fr-me-${placeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map'}`;

  const committedRef = useRef({ query: p.query ?? null, center, zoom: zoomN, source: resolvedSource });
  committedRef.current = { query: p.query ?? null, center, zoom: zoomN, source: resolvedSource };
  const [picked, setPicked] = useState<string | null>(null);
  // The resolved location lands in (bindable) spec.state so an external Button can
  // read the chosen { query, center, zoom, source } without replaying the commit.
  const [, setSelectedLocation] = useBoundProp<unknown>(
    p.selectedLocation,
    (bindings as { selectedLocation?: unknown } | undefined)?.selectedLocation,
  );
  const onUse = (): void => {
    const c = committedRef.current;
    setSelectedLocation({ query: c.query, center: c.center, zoom: c.zoom, source: c.source });
    emitWith('commit', { query: c.query, center: c.center, zoom: c.zoom, source: c.source });
    setPicked(placeName);
  };

  // Square bottom corners: the meta strip below continues the same box.
  const frameCls = 'w-full overflow-hidden border bg-[color:var(--fr-surface-sunken,var(--color-muted))] [border-color:var(--fr-me-border,var(--color-border))] [border-radius:var(--fr-me-radius,0.5rem)_var(--fr-me-radius,0.5rem)_0_0]';

  // ── lazy mount + resize re-key ──────────────────────────────────────────────
  // The OSM embed reads its container size at init. Mounted while the frame has
  // zero size (offscreen, display:none, or an offscreen test probe) it locks onto
  // a garbage viewport and renders the WRONG PLACE under a correct src —
  // South Australia under a Shibuya heading. `loading="lazy"` does
  // not cover it (it defers the FETCH, not the sizing). So: hold the iframe back
  // until the frame is both intersecting and non-zero, then re-key it when the
  // frame's size bucket changes so a resized map re-inits at the right viewport.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [sizeKey, setSizeKey] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    // Environments without IntersectionObserver (jsdom, older hosts) mount
    // immediately — the guard is an optimisation, never a hard dependency.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const r = entry.boundingClientRect;
        if (entry.isIntersecting && r.width > 0 && r.height > 0) {
          setVisible(true);
          io.disconnect();
        }
      }
    });
    io.observe(el);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      // Bucket to 50px so ordinary reflow noise does not thrash the iframe.
      let bucket = -1;
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const next = Math.round(entry.contentRect.width / 50);
          if (bucket === -1) { bucket = next; continue; }
          if (next !== bucket) {
            bucket = next;
            setSizeKey((k) => k + 1);
          }
        }
      });
      ro.observe(el);
    }
    return () => {
      io.disconnect();
      ro?.disconnect();
    };
  }, []);

  return (
    <div role="group" aria-labelledby={headingId} className="w-full" style={vars}>
      <div ref={frameRef} className={cn(frameCls, aspCls)} style={bodyStyle}>
        {showIframe ? (
          visible ? (
            <iframe
              key={sizeKey}
              title={title}
              src={iframeSrc as string}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              allow="fullscreen"
            />
          ) : (
            // pre-mount placeholder: keeps the frame's box (so the observer sees
            // a real size) without initialising the map at the wrong viewport
            <div className="h-full w-full" aria-hidden />
          )
        ) : (
          // static locator fallback (works on every surface, incl. locked MCP)
          <div className="relative grid h-full w-full place-items-center bg-[color-mix(in_srgb,var(--fr-me-accent,var(--color-primary))_8%,var(--color-card))]">
            {center ? (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                {[20, 40, 60, 80].map((v) => <line key={`h${v}`} x1={0} y1={v} x2={100} y2={v} stroke="var(--color-border)" strokeWidth={0.3} />)}
                {[20, 40, 60, 80].map((v) => <line key={`v${v}`} x1={v} y1={0} x2={v} y2={100} stroke="var(--color-border)" strokeWidth={0.3} />)}
              </svg>
            ) : null}
            <span className="relative flex flex-col items-center gap-1 text-center">
              <span style={accentColor ? { color: accentColor } : undefined} className={cn(!accentColor && 'text-[color:var(--fr-me-accent,var(--color-primary))]')} aria-hidden>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.4-7-11a7 7 0 0 1 14 0c0 4.6-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              </span>
              {/* The locator fallback exists to SAY where this is, so the place
                  name may not be clipped; it wraps inside the frame instead. The
                  16rem cap went with the truncate — it was a fixed cap that cut
                  a long name at 320px and at 2000px alike. */}
              <span className="max-w-full break-words px-2 text-sm font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))]" title={placeName}>{placeName}</span>
              {center && showCoords && <span className="text-xs tabular-nums text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]">{fmtPoint(center.lat, center.lng)}</span>}
            </span>
          </div>
        )}
      </div>

      {/* The meta row reads as part of the map, not as loose text under it: it
          sits in a bordered strip flush with the frame (caption
          + link floated on the page background and looked detached). */}
      <div className="-mt-px flex flex-wrap items-center gap-x-3 gap-y-1.5 border-x border-b px-3 py-2 [border-color:var(--fr-me-border,var(--color-border))] [border-radius:0_0_var(--fr-me-radius,0.5rem)_var(--fr-me-radius,0.5rem)]">
        {/* The strip is the map's accessible NAME (headingId) plus its coordinates
            — neither may lose words. The row already wraps (flex-wrap + gap-y
            above), so the text column drops to its own line before it squeezes,
            and each line wraps rather than clipping. */}
        <div className="min-w-0 flex-1">
          <div id={headingId} className="break-words text-sm font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))]" title={title}>{title}</div>
          {center && showCoords && <div className="break-words text-xs tabular-nums text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]" title={fmtPoint(center.lat, center.lng)}>{fmtPoint(center.lat, center.lng)}</div>}
        </div>
        {openHref && (
          <a
            href={openHref}
            {...linkTargetRel(true)}
            aria-label={`Open ${placeName} in Google Maps`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))] transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-me-accent,var(--fr-accent))_20%,transparent)]"
          >
            Open in Google Maps
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
          </a>
        )}
        {p.selectable === true && (openHref || iframeSrc) && (
          <button
            type="button"
            onClick={onUse}
            className="inline-flex shrink-0 items-center rounded-md bg-[color:var(--fr-me-accent,var(--color-foreground))] px-2.5 py-1.5 text-xs font-medium text-card shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-me-accent,var(--fr-accent))_20%,transparent)]"
          >
            Use this location
          </button>
        )}
      </div>

      <span className="sr-only" role="status" aria-live="polite">{picked ? `Location selected: ${picked}` : 'Interactive map — opens in Google Maps in a new tab'}</span>
      {!openHref && !iframeSrc && <div className="mt-1 text-xs text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]">No map location provided.</div>}
    </div>
  );
}
