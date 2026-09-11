'use client';
import type { CSSProperties, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, fontClass } from './_style.js';
import { clampInt } from './_num.js';
import { safeColor, safeLatLng } from '@frayme/catalog/validate';
import { makeProjection, boundsFromPoints, graticule, fmtLat, fmtLng, type GeoBounds } from './_geo.js';

/* Catalog component (map-view): MapView — static geographic locator.
 * STATELESS pure-view: the _geo engine projects every point + the graticule.
 * Graticule LINES live in a preserveAspectRatio='none' SVG (lines survive stretch);
 * degree labels + markers are HTML in a PERCENT overlay (text would distort in the
 * stretched SVG). ONE frac coordinate model → overlay tracks exactly. Per-marker
 * color INLINE (safeColor). Out-of-bounds markers DROPPED. select-only. */

const TONE_FILL: Record<string, string> = {
  neutral: 'var(--color-muted-foreground)', info: 'var(--color-primary)', success: 'var(--color-success)', warning: 'var(--color-warning)', critical: 'var(--color-danger)',
};

interface MarkerIn { id?: string | null; label?: string | null; lng: number; lat: number; tone?: string | null; color?: string | null; value?: number | string | null }

const DEMO: MarkerIn[] = [
  { id: 'sf', label: 'San Francisco', lng: -122.42, lat: 37.77, tone: 'info' },
  { id: 'ldn', label: 'London', lng: -0.13, lat: 51.51, tone: 'success' },
  { id: 'tky', label: 'Tokyo', lng: 139.69, lat: 35.69, tone: 'warning' },
];

export function MapView({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    markers?: MarkerIn[] | null;
    bounds?: Partial<GeoBounds> | null;
    showGraticule?: boolean | null;
    showLabels?: boolean | null;
    selectedId?: string | null;
    confirmLabel?: string | null;
    height?: number | null;
    accent?: unknown;
    waterColor?: unknown;
    gridColor?: unknown;
    mutedColor?: unknown;
    font?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  // The selected marker id lands in (bindable) spec.state so an external Button (or a
  // sibling component) can read the current selection; falls back to local state when
  // the author did not bind `selectedId`. The `select` emit stays as a fallback stream.
  const [selectedId, setSelectedId] = useBoundProp<string | null>(
    p.selectedId ?? null,
    (bindings as { selectedId?: unknown } | undefined)?.selectedId,
  );

  const provided = Array.isArray(p.markers);
  const raw = provided ? (p.markers as MarkerIn[]) : DEMO;
  const showGrid = p.showGraticule !== false;
  const showLabels = p.showLabels !== false;
  const maxHeight = clampInt(p.height, 200, 720, 380);

  // validate → project → drop out-of-bounds (never clamp-stack).
  const valid = raw.map((m) => { const ll = safeLatLng({ lat: m.lat, lng: m.lng }); return ll ? { m, ll } : null; }).filter(Boolean) as { m: MarkerIn; ll: { lat: number; lng: number } }[];
  const bounds = p.bounds ?? boundsFromPoints(valid.map((v) => ({ lng: v.ll.lng, lat: v.ll.lat })));
  const proj = makeProjection(bounds);
  const shown = valid
    .filter((v) => proj.inBounds(v.ll.lng, v.ll.lat))
    .map((v, i) => { const f = proj.projectFrac(v.ll.lng, v.ll.lat); return { ...v, key: v.m.id ?? `m${i}`, fx: f.x * 100, fy: f.y * 100 }; });
  const grid = showGrid ? graticule(bounds) : { lng: [], lat: [] };

  // Optional internal submit: emit `commit` with the currently-selected marker's full
  // detail on demand (an alternative to replaying the `select` stream). Reads in-scope
  // `selectedId`/`shown` in the handler — never a setState updater.
  const confirmLabel = typeof p.confirmLabel === 'string' ? p.confirmLabel.trim().slice(0, 80) : '';
  const onConfirm = (): void => {
    const s = shown.find((m) => m.key === selectedId);
    if (!s) return;
    emitWith('commit', {
      id: s.key,
      label: s.m.label ?? '',
      value: s.m.value ?? null,
      lng: s.ll.lng,
      lat: s.ll.lat,
      tone: s.m.tone ?? null,
    });
  };

  const vars = styleVars(
    { var: '--fr-mv-accent', value: p.accent, kind: 'color' },
    { var: '--fr-mv-water', value: p.waterColor, kind: 'color' },
    { var: '--fr-mv-grid', value: p.gridColor, kind: 'color' },
    { var: '--fr-mv-muted', value: p.mutedColor, kind: 'color' },
  );
  const mutedText = 'text-[color:var(--fr-mv-muted,var(--color-muted-foreground))]';

  const dotStyle = (m: MarkerIn): CSSProperties => {
    const col = safeColor(m.color);
    return { backgroundColor: col ?? TONE_FILL[(m.tone as string) ?? 'info'] ?? TONE_FILL.info };
  };

  return (
    <div style={vars} className={cn('w-full', fontClass(p.font))}>
      <div
        className="relative mx-auto w-full overflow-hidden rounded-lg border border-border bg-[color:var(--fr-mv-water,var(--color-muted))]"
        style={{ aspectRatio: String(proj.ratio), maxHeight }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {grid.lng.map((lng, i) => { const x = proj.projectFrac(lng, 0).x * 100; return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={100} stroke="var(--fr-mv-grid, var(--color-border))" strokeWidth={0.2} />; })}
          {grid.lat.map((lat, i) => { const y = proj.projectFrac(0, lat).y * 100; return <line key={`h${i}`} x1={0} y1={y} x2={100} y2={y} stroke="var(--fr-mv-grid, var(--color-border))" strokeWidth={0.2} />; })}
        </svg>

        {showLabels && (
          <>
            {grid.lng.map((lng, i) => { const x = proj.projectFrac(lng, 0).x * 100; return <div key={`vl${i}`} className={cn('pointer-events-none absolute bottom-0.5 -translate-x-1/2 text-[9px] tabular-nums', mutedText)} style={{ left: `${x}%` }}>{fmtLng(lng)}</div>; })}
            {grid.lat.map((lat, i) => { const y = proj.projectFrac(0, lat).y * 100; return <div key={`hl${i}`} className={cn('pointer-events-none absolute left-0.5 -translate-y-1/2 text-[9px] tabular-nums', mutedText)} style={{ top: `${y}%` }}>{fmtLat(lat)}</div>; })}
          </>
        )}

        {shown.map((s) => {
          const selected = selectedId != null && s.key === selectedId;
          const label = s.m.label ?? '';
          const showLabel = (showLabels || selected) && label;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => { setSelectedId(s.key); emitWith('select', { id: s.key, label, value: s.m.value ?? null, lng: s.ll.lng, lat: s.ll.lat, tone: s.m.tone ?? null }); }}
              aria-label={label || `${fmtLat(s.ll.lat)}, ${fmtLng(s.ll.lng)}`}
              aria-pressed={selected}
              className="absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"
              style={{ left: `${s.fx}%`, top: `${s.fy}%` }}
            >
              <span className="flex flex-col items-center gap-0.5">
                <span
                  className={cn('block rounded-full border-2 border-card shadow', selected ? 'h-4 w-4 ring-2 ring-offset-1 ring-[color:var(--fr-mv-accent,var(--fr-accent))]' : 'h-3 w-3')}
                  style={dotStyle(s.m)}
                />
                {showLabel && (
                  // A pin label is a place NAME — losing its tail ("San Francis…")
                  // loses the marker's identity. It wraps to a DECLARED two-line
                  // budget instead of clipping at one. The 8rem cap stays: this is
                  // an absolute overlay on the map plate, so an unbounded label
                  // would sit across its neighbours.
                  <span className={cn('max-w-[8rem] line-clamp-2 break-words rounded bg-card/90 px-1 text-center text-[10px] font-medium leading-tight text-foreground shadow-sm', selected && 'font-semibold')} title={label || undefined}>
                    {label}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {shown.length === 0 && (
          <div className={cn('absolute inset-0 grid place-items-center text-sm', mutedText)}>No markers in view</div>
        )}
      </div>

      {confirmLabel && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onConfirm}
            disabled={selectedId == null}
            className="inline-flex items-center rounded-md bg-[color:var(--fr-mv-accent,var(--color-foreground))] px-3 py-1.5 text-xs font-medium text-card shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-mv-accent,var(--fr-accent))_20%,transparent)]"
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </div>
  );
}
