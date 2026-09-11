'use client';
import { useState, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { clampInt } from './_num.js';
import { spanBlocks, axisTicks } from './_timegrid.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { safeTimeMinutes, safeColor } from '@frayme/catalog/validate';

/* Catalog component (program-guide-grid): ProgramGuideGrid (EPG). STATELESS pure-view
 * — cell positions recompute from props each render via spanBlocks; the only local
 * state is the client-only now-line minute. No drag/pointer capture. Per-programme
 * color is INLINE (safeColor). Times pass safeTimeMinutes. */

const MAX_CHANNELS = 60;
const MAX_PROGRAMS = 1000;

interface Ch {
  id?: string | null;
  label: string;
}
interface Prog {
  id?: string | null;
  channel: string;
  title: string;
  subtitle?: string | null;
  start?: string | number;
  end?: string | number;
  color?: unknown;
}

const fmt = (min: number, hour12: boolean): string => {
  const H = Math.floor(min / 60) % 24;
  const m = min % 60;
  if (!hour12) return `${String(H).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ap = H < 12 ? 'AM' : 'PM';
  const h = H % 12 === 0 ? 12 : H % 12;
  return m === 0 ? `${h} ${ap}` : `${h}:${String(m).padStart(2, '0')} ${ap}`;
};

export function ProgramGuideGrid({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    channels?: Ch[] | null;
    programs?: Prog[] | null;
    startHour?: number | null;
    endHour?: number | null;
    hourWidth?: number | null;
    rowHeight?: number | null;
    tickStep?: string | null;
    hour12?: boolean | null;
    nowLine?: boolean | null;
    showChannelBar?: boolean | null;
    accent?: unknown;
    gridColor?: unknown;
    mutedColor?: unknown;
    selectedId?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const [, setSelectedId] = useBoundProp<string | null>(
    p.selectedId ?? null,
    (bindings as { selectedId?: unknown } | undefined)?.selectedId,
  );

  const channels = (Array.isArray(p.channels) ? p.channels : [{ label: 'Channel 1' }]).slice(0, MAX_CHANNELS).map((c, i) => ({ ...c, id: typeof c.id === 'string' && c.id ? c.id : `ch${i}` }));
  const programs = (Array.isArray(p.programs) ? p.programs : []).slice(0, MAX_PROGRAMS);
  const startHour = clampInt(p.startHour, 0, 23, 6);
  const endHour = Math.max(startHour + 1, clampInt(p.endHour, 1, 24, 24));
  const winStart = startHour * 60;
  const winEnd = endHour * 60;
  const span = Math.max(1, winEnd - winStart);
  const hourWidth = clampInt(p.hourWidth, 40, 400, 120);
  const rowHeight = clampInt(p.rowHeight, 32, 120, 56);
  const tickStep = clampInt(Number(p.tickStep), 30, 120, 60);
  const hour12 = p.hour12 !== false;
  const showBar = p.showChannelBar !== false;
  const timelineW = ((endHour - startHour) * 60 * hourWidth) / 60;
  const gutterW = showBar ? 128 : 0;
  const ticks = axisTicks(winStart, winEnd, tickStep);

  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const upd = (): void => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); };
    upd();
    const id = window.setInterval(upd, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const showNow = p.nowLine !== false && nowMin != null && nowMin >= winStart && nowMin <= winEnd;
  const nowLeft = showNow ? ((nowMin! - winStart) / span) * 100 : 0;

  const vars = styleVars(
    { var: '--fr-epg-accent', value: p.accent, kind: 'color' },
    { var: '--fr-epg-grid', value: p.gridColor, kind: 'color' },
    { var: '--fr-epg-muted', value: p.mutedColor, kind: 'color' },
  );
  const gridB = 'border-[color:var(--fr-epg-grid,var(--color-border))]';
  const mutedText = 'text-[color:var(--fr-epg-muted,var(--color-muted-foreground))]';

  return (
    <div style={vars} className={cn('w-full overflow-x-auto rounded-lg border', gridB)}>
      <div style={{ width: gutterW + timelineW }}>
        {/* Axis */}
        <div className={cn('flex border-b', gridB)}>
          {showBar && <div className={cn('sticky left-0 z-20 shrink-0 border-r bg-card', gridB)} style={{ width: gutterW }} />}
          <div className="relative" style={{ width: timelineW, height: 28 }}>
            {ticks.map((t, i) => (
              <div key={i} className={cn('absolute top-0 h-full border-l pl-1 text-[11px] tabular-nums', gridB, mutedText)} style={{ left: `${t.leftPct}%` }}>
                {t.min < winEnd ? fmt(t.min, hour12) : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Channel rows */}
        {channels.map((ch) => {
          const rowProgs = programs
            .map((pr, gi) => ({ pr, gi, s: safeTimeMinutes(pr.start), e: safeTimeMinutes(pr.end) }))
            .filter((x) => x.pr.channel === ch.id && x.s != null && x.e != null);
          const blocks = spanBlocks(rowProgs.map((x) => ({ start: x.s as number, end: x.e as number })), winStart, winEnd);
          return (
            <div key={ch.id} className={cn('flex border-b', gridB)} style={{ height: rowHeight }}>
              {showBar && (
                <div className={cn('sticky left-0 z-10 flex shrink-0 items-center border-r bg-card px-2 text-sm font-medium text-foreground', gridB)} style={{ width: gutterW }}>
                  {/* EARNED single line: the channel gutter is a fixed 128px column
                      inside a row whose height is pinned to `rowHeight` — a grid
                      cell, not free-flowing text. Full label stays in the title. */}
                  <span className="truncate" title={ch.label || undefined}>{ch.label}</span>
                </div>
              )}
              <div className="relative" style={{ width: timelineW }}>
                {ticks.map((t, i) => (
                  <div key={i} className={cn('pointer-events-none absolute top-0 h-full border-l opacity-40', gridB)} style={{ left: `${t.leftPct}%` }} aria-hidden="true" />
                ))}
                {showNow && <div className="pointer-events-none absolute top-0 z-10 h-full border-l-2 border-[color:var(--fr-epg-accent,var(--color-primary))]" style={{ left: `${nowLeft}%` }} aria-hidden="true" />}
                {rowProgs.map((x, i) => {
                  const b = blocks[i];
                  if (b.widthPct <= 0) return null;
                  const col = safeColor(x.pr.color) ?? undefined;
                  const style: CSSProperties = { left: `calc(${b.leftPct}% + 1px)`, width: `calc(${b.widthPct}% - 2px)`, top: 3, bottom: 3, color: col };
                  return (
                    <button
                      key={x.pr.id ?? x.gi}
                      type="button"
                      onClick={() => {
                        setSelectedId(x.pr.id ?? `p${x.gi}`);
                        emitWith('select', { id: x.pr.id ?? `p${x.gi}`, channel: ch.id, channelLabel: ch.label, title: x.pr.title, subtitle: x.pr.subtitle ?? null, start: x.s, end: x.e, startTime: fmt(x.s as number, false), endTime: fmt(x.e as number, false) });
                      }}
                      style={style}
                      className="absolute overflow-hidden rounded border-l-2 border-[currentColor] bg-[currentColor]/[0.10] px-1.5 py-1 text-left text-xs leading-tight text-foreground hover:bg-[currentColor]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[currentColor]"
                    >
                      {/* EARNED single line: a programme block is an absolutely
                          positioned cell whose box is fixed on BOTH axes — width by
                          the airtime span, height by top:3/bottom:3 inside the
                          `rowHeight` row. Wrapping cannot buy space here (the block
                          is overflow-hidden), so an ellipsis is the honest bound and
                          the full text stays in the title + the select payload. */}
                      <span className="block truncate font-semibold" title={x.pr.title || undefined}>{x.pr.title}</span>
                      {x.pr.subtitle != null && <span className={cn('block truncate', mutedText)} title={x.pr.subtitle || undefined}>{x.pr.subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
