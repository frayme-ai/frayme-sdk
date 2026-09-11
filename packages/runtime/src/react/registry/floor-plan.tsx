'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, fontClass } from './_style.js';
import { safeColor, safeNumberIn, safePointList } from '@frayme/catalog/validate';

/* Catalog component (floor-plan): FloorPlan — SELECT-ONLY region picker (v1).
 * No pointer capture (regions toggle on click). Selection is a Set MIRRORED to a
 * MANDATORY selectionRef — every handler reads selectionRef.current, builds the
 * payload, emitWith, THEN setSelection + updates the ref; ZERO emitWith inside a
 * functional updater. Geometry via safeNumberIn(0..1)/safePointList; per-region
 * fill INLINE (safeColor); prices via safeNumberIn (NaN/negative excluded); the
 * total is formatted by US. SVG regions are focusable (stroke focus ring — visible
 * on SVG, unlike a box-shadow ring). PROPS-LESS → empty placeholder (never fabricate). */

const MAX_REGIONS = 400;
const MAX_LABEL = 200;
const VBW = 1000;

const STATUS_FILL: Record<string, { fill: string; opacity: number }> = {
  sold: { fill: 'var(--color-muted)', opacity: 0.55 },
  held: { fill: 'var(--color-warning)', opacity: 0.3 },
  disabled: { fill: 'var(--color-muted)', opacity: 0.4 },
};
const STATUSES = new Set(['available', 'sold', 'held', 'disabled']);

interface PointN { x: number; y: number }
interface RegionIn { id?: unknown; label?: unknown; kind?: unknown; status?: unknown; price?: unknown; color?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown; points?: unknown }
interface Region { id: string; label: string; status: string; price: number | null; color: string | null; selectable: boolean; poly: string; cx: number; cy: number; w: number }

function ingest(raw: RegionIn[], vbh: number): Region[] {
  const out: Region[] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, MAX_REGIONS)) {
    if (!r || typeof r.id !== 'string' || seen.has(r.id)) continue;
    let pts: PointN[] | null = null;
    if (r.kind === 'rect') {
      const x = safeNumberIn(r.x, 0, 1), y = safeNumberIn(r.y, 0, 1), w = safeNumberIn(r.w, 0, 1), h = safeNumberIn(r.h, 0, 1);
      if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) continue;
      pts = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    } else if (r.kind === 'poly') {
      const p = safePointList(r.points, 4096);
      if (!p || p.length < 3) continue;
      pts = p;
    } else continue;
    // clamp to the box so a stray point can't escape the plan
    const clamped = pts.map((pt) => ({ x: Math.min(1, Math.max(0, pt.x)), y: Math.min(1, Math.max(0, pt.y)) }));
    const status = STATUSES.has(r.status as string) ? (r.status as string) : 'available';
    const price = safeNumberIn(r.price, 0, 1e9);
    const cx = clamped.reduce((s, p) => s + p.x, 0) / clamped.length;
    const cy = clamped.reduce((s, p) => s + p.y, 0) / clamped.length;
    // Region width in viewBox units — used to shrink over-long labels to fit
    // (raw SVG <text> never wraps, so a long label would otherwise overflow).
    const minX = Math.min(...clamped.map((p) => p.x));
    const maxX = Math.max(...clamped.map((p) => p.x));
    seen.add(r.id);
    out.push({
      id: r.id,
      label: typeof r.label === 'string' ? r.label.slice(0, MAX_LABEL) : '',
      status,
      price,
      color: safeColor(r.color),
      selectable: status === 'available',
      poly: clamped.map((p) => `${(p.x * VBW).toFixed(1)},${(p.y * vbh).toFixed(1)}`).join(' '),
      cx: cx * VBW,
      cy: cy * vbh,
      w: (maxX - minX) * VBW,
    });
  }
  return out;
}

interface StageDef { label: string; edge: 'top' | 'bottom' | 'left' | 'right' | 'center'; shape: 'bar' | 'curve' | 'block'; size: number | null; color: string | null }

/** Non-interactive landmark (stage / screen / pitch / ring / main-event area) — an
 *  edge band (bar), a cinema-style arc (curve), or a solid block, at an edge or centered. */
function StageBand({ stage, vbh }: { stage: StageDef; vbh: number }): ReactNode {
  const INSET = 26;
  const fill = stage.color ?? 'var(--color-foreground)';
  const text = stage.label.toUpperCase();
  const { edge, shape, size } = stage;
  const horizontal = edge === 'top' || edge === 'bottom';

  // Cinema-style screen arc (horizontal edges only).
  if (shape === 'curve' && horizontal) {
    const BAND = 56;
    const yTop = edge === 'top' ? INSET : vbh - INSET - BAND;
    const yc = yTop + BAND / 2;
    const bulge = edge === 'top' ? BAND * 0.6 : -BAND * 0.6;
    const d = `M ${INSET} ${yc} Q ${VBW / 2} ${yc + bulge} ${VBW - INSET} ${yc}`;
    return (
      <g aria-label={stage.label} className="pointer-events-none select-none">
        <path d={d} fill="none" stroke={fill} strokeWidth={9} strokeLinecap="round" strokeOpacity={0.9} />
        <text x={VBW / 2} y={edge === 'top' ? yc - 16 : yc + 16} textAnchor="middle" dominantBaseline="central" fontSize={23} fontWeight={700} letterSpacing="6" style={{ fill }}>{text}</text>
      </g>
    );
  }

  // Center → a centered rounded rectangle: a "square space" / center stage / ring.
  if (edge === 'center') {
    const fw = size ?? (shape === 'block' ? 0.34 : 0.5);
    const fh = size ?? (shape === 'block' ? 0.34 : 0.16);
    const w = Math.max(60, fw * VBW), h = Math.max(48, fh * vbh);
    const x = (VBW - w) / 2, y = (vbh - h) / 2;
    return (
      <g aria-label={stage.label} className="pointer-events-none select-none">
        <rect x={x} y={y} width={w} height={h} rx={16} style={{ fill, fillOpacity: 0.9 }} />
        <text x={VBW / 2} y={vbh / 2} textAnchor="middle" dominantBaseline="central" fontSize={24} fontWeight={700} letterSpacing="6" style={{ fill: 'var(--color-card)' }}>{text}</text>
      </g>
    );
  }

  // Edge band (bar) or block hugging the chosen edge; `size` sets the thickness.
  const span = horizontal ? vbh : VBW;
  const frac = size ?? (shape === 'block' ? 0.22 : 0.11);
  const BAND = Math.max(40, Math.min(span * 0.5, frac * span));
  let x = INSET, y = INSET, w = VBW - 2 * INSET, h = BAND, rot = 0;
  if (edge === 'bottom') y = vbh - INSET - BAND;
  else if (edge === 'left') { w = BAND; h = vbh - 2 * INSET; rot = -90; }
  else if (edge === 'right') { x = VBW - INSET - BAND; w = BAND; h = vbh - 2 * INSET; rot = 90; }
  const cx = x + w / 2, cy = y + h / 2;
  return (
    <g aria-label={stage.label} className="pointer-events-none select-none">
      <rect x={x} y={y} width={w} height={h} rx={shape === 'block' ? 16 : 12} style={{ fill, fillOpacity: 0.9 }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={23} fontWeight={700} letterSpacing="6" transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined} style={{ fill: 'var(--color-card)' }}>{text}</text>
    </g>
  );
}

export function FloorPlan({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    regions?: RegionIn[] | null;
    selectedIds?: string[] | null;
    multiSelect?: boolean | null;
    showTotal?: boolean | null;
    currency?: string | null;
    stage?: { label?: unknown; edge?: unknown; shape?: unknown; size?: unknown; color?: unknown } | null;
    aspect?: number | null;
    accent?: unknown;
    regionColor?: unknown;
    lineColor?: unknown;
    mutedColor?: unknown;
    font?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  const raw = Array.isArray(p.regions) ? p.regions : [];
  const multiSelect = p.multiSelect !== false;
  const showTotal = p.showTotal !== false;
  const currency = (typeof p.currency === 'string' ? p.currency : '$').slice(0, 3);
  const aspect = Math.min(3, Math.max(0.5, safeNumberIn(p.aspect, 0.5, 3) ?? 1.6));
  const vbh = Math.round(VBW / aspect);

  // Optional non-interactive landmark (stage / screen / pitch / main-event area).
  const stageRaw = p.stage && typeof p.stage === 'object' ? p.stage : null;
  const stage = stageRaw
    ? {
        label: typeof stageRaw.label === 'string' ? stageRaw.label.slice(0, 80) : 'STAGE',
        edge: (['top', 'bottom', 'left', 'right', 'center'] as const).includes(stageRaw.edge as never)
          ? (stageRaw.edge as 'top' | 'bottom' | 'left' | 'right' | 'center')
          : 'top',
        shape: stageRaw.shape === 'curve' ? ('curve' as const) : stageRaw.shape === 'block' ? ('block' as const) : ('bar' as const),
        size: safeNumberIn(stageRaw.size, 0.04, 0.9),
        color: safeColor(stageRaw.color),
      }
    : null;

  const regionsKey = useMemo(() => JSON.stringify(raw), [raw]);
  const regions = useMemo(() => ingest(raw, vbh), [regionsKey, vbh]);
  const selectableIds = useMemo(() => new Set(regions.filter((r) => r.selectable).map((r) => r.id)), [regions]);
  const priceById = useMemo(() => new Map(regions.map((r) => [r.id, r.price])), [regions]);

  const seedKey = useMemo(() => regionsKey + '|' + JSON.stringify(p.selectedIds ?? []), [regionsKey, p.selectedIds]);
  const seed = (): Set<string> => new Set((Array.isArray(p.selectedIds) ? p.selectedIds : []).filter((id) => selectableIds.has(id)));

  const [selection, setSelection] = useState<Set<string>>(seed);
  const selectionRef = useRef<Set<string>>(selection);
  // Bindable mirror: the committed selection ARRAY lands in spec.state so an
  // external Button can read the current picks (+ derived total via `commit`).
  // Local machinery (Set + ref) still drives geometry/emit; this only mirrors.
  const [, setBoundSelection] = useBoundProp<string[]>(
    Array.isArray(p.selectedIds) ? p.selectedIds : [],
    (bindings as { selectedIds?: unknown } | undefined)?.selectedIds,
  );
  useEffect(() => {
    const s = seed();
    selectionRef.current = s;
    setSelection(s);
    setBoundSelection([...s]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const totalsOf = (sel: Set<string>): { count: number; total: number; totalLabel: string } => {
    let total = 0;
    for (const id of sel) { const pr = priceById.get(id); if (typeof pr === 'number') total += pr; }
    return { count: sel.size, total, totalLabel: `${currency}${total.toFixed(2)}` };
  };

  const toggle = (id: string): void => {
    if (!selectableIds.has(id)) return;
    const cur = selectionRef.current;
    let next: Set<string>;
    if (multiSelect) { next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); }
    else next = cur.has(id) && cur.size === 1 ? new Set() : new Set([id]);
    const { count, total, totalLabel } = totalsOf(next);
    emitWith('select', { id, selected: next.has(id), selection: [...next], count, total, currency, totalLabel });
    selectionRef.current = next;
    setSelection(next);
    setBoundSelection([...next]);
  };

  const confirm = (): void => {
    const sel = selectionRef.current;
    const { count, total, totalLabel } = totalsOf(sel);
    emitWith('commit', { selection: [...sel], count, total, totalLabel });
  };
  const clear = (): void => {
    const prev = selectionRef.current.size;
    const next = new Set<string>();
    emitWith('dismiss', { previousCount: prev });
    selectionRef.current = next;
    setSelection(next);
    setBoundSelection([]);
  };

  const vars = styleVars(
    { var: '--fr-fp-accent', value: p.accent, kind: 'color' },
    { var: '--fr-fp-region', value: p.regionColor, kind: 'color' },
    { var: '--fr-fp-line', value: p.lineColor, kind: 'color' },
    { var: '--fr-fp-muted', value: p.mutedColor, kind: 'color' },
  );
  const mutedText = 'text-[color:var(--fr-fp-muted,var(--color-muted-foreground))]';
  const accentVar = 'var(--fr-fp-accent, var(--fr-accent))';

  if (regions.length === 0) {
    return <div style={vars} className={cn('grid min-h-[10rem] w-full place-items-center rounded-lg border border-dashed border-border bg-card text-sm', mutedText)}>No regions provided</div>;
  }

  const { count, total, totalLabel } = totalsOf(selection);

  return (
    <div style={vars} className={cn('w-full', fontClass(p.font))}>
      <div className="w-full overflow-x-auto">
        <div className="mx-auto min-w-[320px]" style={{ maxWidth: `${Math.round(vbh * aspect * 0.9)}px` }}>
          <svg viewBox={`0 0 ${VBW} ${vbh}`} preserveAspectRatio="xMidYMid meet" className="h-auto w-full rounded-lg border border-border bg-card" style={{ aspectRatio: String(aspect) }} role="group" aria-label="Floor plan">
            {stage && <StageBand stage={stage} vbh={vbh} />}
            {regions.map((r) => {
              const selected = selection.has(r.id);
              const f = selected
                ? { fill: accentVar, opacity: 0.85 }
                : r.selectable
                  ? { fill: r.color ?? 'var(--fr-fp-region, color-mix(in srgb, var(--color-primary) 14%, var(--color-card)))', opacity: 1 }
                  : STATUS_FILL[r.status] ?? { fill: 'var(--color-muted)', opacity: 0.5 };
              const labelFill = selected ? 'var(--color-primary-foreground)' : r.selectable ? 'var(--color-foreground)' : 'var(--color-muted-foreground)';
              return (
                <g
                  key={r.id}
                  role={r.selectable ? 'checkbox' : undefined}
                  aria-checked={r.selectable ? selected : undefined}
                  aria-disabled={r.selectable ? undefined : true}
                  aria-label={r.label + (r.price != null ? `, ${currency}${r.price.toFixed(2)}` : '') + (r.selectable ? '' : `, ${r.status}`)}
                  tabIndex={r.selectable ? 0 : -1}
                  onClick={() => toggle(r.id)}
                  onKeyDown={(e) => { if (r.selectable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(r.id); } }}
                  className={cn(
                    'outline-none [&>polygon]:transition-[stroke-width]',
                    r.selectable ? 'cursor-pointer [&:focus-visible>polygon]:[stroke-width:6px] [&:focus-visible>polygon]:[stroke:var(--fr-fp-accent,var(--fr-accent))]' : 'cursor-not-allowed',
                  )}
                >
                  <polygon
                    points={r.poly}
                    style={{ fill: f.fill, fillOpacity: f.opacity }}
                    stroke={selected ? accentVar : 'var(--fr-fp-line, var(--color-border))'}
                    strokeWidth={selected ? 4 : 2}
                    strokeLinejoin="round"
                  />
                  {(() => {
                    // Shrink over-long text to the region's own width (minus a
                    // small inset) so labels never spill past the block edges.
                    const avail = Math.max(0, r.w - 14);
                    const fitPx = (len: number, base: number) => Math.max(9, Math.min(base, avail / Math.max(1, len * 0.62)));
                    // Whole pounds print clean; anything with pence prints it.
                    // Rounding here charged $16.50 while showing $17 — and the
                    // accessible name said $16.50, which is also a label-in-name
                    // failure.
                    const priceStr =
                      r.price != null
                        ? `${currency}${Number.isInteger(r.price) ? r.price.toFixed(0) : r.price.toFixed(2)}`
                        : '';
                    return (
                      <>
                        {r.label && (
                          <text x={r.cx} y={r.price != null ? r.cy - 4 : r.cy} textAnchor="middle" dominantBaseline="central" style={{ fill: labelFill }} fontSize={fitPx(r.label.length, 22)} fontWeight={600} className="pointer-events-none select-none">
                            {r.label}
                          </text>
                        )}
                        {r.price != null && (
                          <text x={r.cx} y={r.cy + 20} textAnchor="middle" dominantBaseline="central" style={{ fill: labelFill }} fontSize={fitPx(priceStr.length, 18)} fillOpacity={0.8} className="pointer-events-none select-none">
                            {priceStr}
                          </text>
                        )}
                      </>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {showTotal && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
          <div role="status" aria-live="polite" className="text-sm">
            <span className="font-semibold text-foreground tabular-nums">{count}</span> <span className={mutedText}>selected</span>
            {count > 0 && <span className="ml-3 font-semibold text-foreground tabular-nums">{totalLabel}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={clear} disabled={count === 0} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-fp-accent,var(--fr-accent))_70%,transparent)]">
              Clear
            </button>
            <button type="button" onClick={confirm} disabled={count === 0} className="rounded-md bg-[color:var(--fr-fp-accent,var(--color-foreground))] px-3 py-1.5 text-sm font-medium text-[color:var(--fr-fp-accent-fg,var(--color-primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-fp-accent,var(--fr-accent))_70%,transparent)]">
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
