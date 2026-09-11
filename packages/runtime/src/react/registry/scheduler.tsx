'use client';
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { safeTimeMinutes, safeColor } from '@frayme/catalog/validate';
import { layoutTimeBlocks, hourTicks, yToMinutes, type TimedInput } from './_timegrid.js';
import { clampInt, clamp, snapTo } from './_num.js';

/* Catalog component (scheduler): Scheduler — a professional day/week scheduler.
 *
 * Owns the FULL event set in state (seeded from the `events` prop, re-seeded when
 * it changes). Create / edit / delete / drag-move / resize all mutate that state
 * (instant render) AND emit a fully-populated intent (commit/change/move/dismiss/
 * select) for the host to persist. Rides the TimeAxisGrid engine.
 *
 * All event blocks live in ONE absolute overlay spanning the columns area (not
 * nested per-column), so an event can be dragged ACROSS columns without React
 * re-parenting the node (which would drop the pointer capture mid-drag).
 *
 * SSR-safe: the grid renders on the server; the now-line + popover are client-only.
 * `editable:false` → read-only (clicking opens a view-only popover, emits select). */

const MAX_EVENTS = 400;
const MOVE_THRESHOLD_PX = 3;
const POP_W = 292;
const POP_H = 260;

interface ColDef {
  label: string;
}
interface EvtInput {
  id?: string | null;
  title?: string;
  start?: string | number;
  end?: string | number;
  column?: number | null;
  subtitle?: string | null;
  description?: string | null;
  color?: unknown;
  locked?: boolean | null;
}
interface SEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  column: number;
  subtitle?: string;
  description?: string;
  color?: string;
  /** End-user-immutable (permission fidelity): no drag/resize/edit/
   *  delete — the block opens a READ-ONLY popover and still emits `select`.
   *  Only ever set on prop-seeded events; UI-created events are never locked. */
  locked?: boolean;
}
interface Sel {
  id: string;
  mode: 'view' | 'edit';
  anchor: { x: number; y: number };
}
interface EditForm {
  title: string;
  start: string;
  end: string;
  subtitle: string;
  description: string;
}
interface DragState {
  id: string;
  mode: 'move' | 'resize';
  startClientX: number;
  startClientY: number;
  areaLeft: number;
  areaWidth: number;
  areaHeight: number;
  numCols: number;
  origColumn: number;
  origStart: number;
  origEnd: number;
  moved: boolean;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
const fmt24 = (min: number): string => `${pad2(Math.floor(min / 60) % 24)}:${pad2(Math.round(min) % 60)}`;
function fmt12(min: number): string {
  const H = Math.floor(min / 60) % 24;
  const m = Math.round(min) % 60;
  const ap = H < 12 ? 'AM' : 'PM';
  const h = H % 12 === 0 ? 12 : H % 12;
  return `${h}:${pad2(m)} ${ap}`;
}
// Canonical is "HH:MM" 24h, but the model naturally drifts to 12-hour forms
// ("10:00 AM", "2 PM") — the strict regex silently dropped EVERY event of a
// caravan-schedule sample (seed() `continue`s on null → empty calendar).
// Accept an optional AM/PM suffix and bare-hour forms; 24h behavior unchanged.
function parseHM(s: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const mm = m[2] !== undefined ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase();
  if (mm > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
  } else {
    if (m[2] === undefined) return null; // bare "10" without AM/PM stays invalid
    if (h > 23) return null;
  }
  return h * 60 + mm;
}

export function Scheduler({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    columns?: ColDef[] | null;
    events?: EvtInput[] | null;
    value?: EvtInput[] | null;
    startHour?: number | null;
    endHour?: number | null;
    hourHeight?: number | null;
    hour12?: boolean | null;
    nowLine?: boolean | null;
    editable?: boolean | null;
    lockExisting?: boolean | null;
    snapMinutes?: number | null;
    defaultDuration?: number | null;
    newEventTitle?: string | null;
    accent?: unknown;
    gridColor?: unknown;
    mutedColor?: unknown;
    showSubmit?: boolean | null;
    submitLabel?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  const columns: ColDef[] = Array.isArray(p.columns) && p.columns.length ? p.columns.slice(0, 14) : [{ label: 'Today' }];
  const startHour = clampInt(p.startHour, 0, 23, 8);
  const endHour = Math.max(startHour + 1, clampInt(p.endHour, 1, 24, 18));
  const winStart = startHour * 60;
  const winEnd = endHour * 60;
  const spanMin = Math.max(1, winEnd - winStart);
  const hourHeight = clampInt(p.hourHeight, 28, 120, 48);
  const gridHeight = (endHour - startHour) * hourHeight;
  const ticks = hourTicks(startHour, endHour);
  const editable = p.editable !== false;
  // lockExisting = the "add-only" permission shape: every PROP-SEEDED
  // event is stamped locked at seed time, so the end user can create new entries
  // but never mutate the supplied ones. UI-created events are never stamped.
  const lockExisting = p.lockExisting === true;
  const hour12 = p.hour12 !== false;
  const snap = clampInt(p.snapMinutes, 0, 120, 15);
  const minDur = Math.max(snap || 0, 15);
  const defaultDuration = clampInt(p.defaultDuration, 5, spanMin, 60);
  const newEventTitle = typeof p.newEventTitle === 'string' ? p.newEventTitle : 'New event';
  const showSubmit = p.showSubmit === true;
  const submitLabel = typeof p.submitLabel === 'string' && p.submitLabel ? p.submitLabel : 'Save schedule';
  const label = (min: number): string => (hour12 ? fmt12(min) : fmt24(min));
  const colW = 100 / columns.length;

  const seed = (): SEvent[] => {
    const arr = Array.isArray(p.events) ? p.events : [];
    const out: SEvent[] = [];
    for (let i = 0; i < Math.min(arr.length, MAX_EVENTS); i++) {
      const e = arr[i];
      const s = safeTimeMinutes(e.start);
      let en = safeTimeMinutes(e.end);
      if (s == null) continue;
      if (en == null || en <= s) en = Math.min(winEnd, s + defaultDuration);
      out.push({
        id: typeof e.id === 'string' && e.id ? e.id : `e${i}`,
        title: typeof e.title === 'string' ? e.title : '',
        start: s,
        end: en,
        column: clampInt(e.column, 0, columns.length - 1, 0),
        subtitle: typeof e.subtitle === 'string' ? e.subtitle : undefined,
        description: typeof e.description === 'string' ? e.description : undefined,
        color: safeColor(e.color) ?? undefined,
        locked: e.locked === true || lockExisting || undefined,
      });
    }
    return out;
  };
  const eventsKey = JSON.stringify(p.events ?? null);
  const [events, setEvents] = useState<SEvent[]>(seed);
  // Mirror the committed schedule into (bindable) spec.state so an external Button
  // can read the full event set without replaying every create/edit/move/delete emit.
  const [, setBoundValue] = useBoundProp<EvtInput[]>(
    p.value ?? undefined,
    (bindings as { events?: unknown; value?: unknown } | undefined)?.events ??
      (bindings as { value?: unknown } | undefined)?.value,
  );
  const snapshot = (list: SEvent[]): EvtInput[] =>
    list.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      column: e.column,
      subtitle: e.subtitle ?? null,
      description: e.description ?? null,
      color: e.color ?? null,
      locked: e.locked === true ? true : null,
    }));
  // `commitEvents` is the single mutation gateway: it updates local render state AND
  // mirrors the resolved snapshot into bound spec.state. Callers pass the next list.
  const commitEvents = (next: SEvent[]): void => {
    setEvents(next);
    setBoundValue(snapshot(next));
  };
  const [sel, setSel] = useState<Sel | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const idRef = useRef(0);
  useEffect(() => {
    const seeded = seed();
    setEvents(seeded);
    setBoundValue(snapshot(seeded));
    setSel(null);
    setForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);

  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const update = (): void => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const showNow = p.nowLine !== false && nowMin != null && nowMin >= winStart && nowMin <= winEnd;
  const nowTop = showNow ? ((nowMin! - winStart) / spanMin) * 100 : 0;

  const byId = (id: string): SEvent | undefined => events.find((e) => e.id === id);
  const payload = (ev: SEvent): Record<string, unknown> => ({
    id: ev.id,
    title: ev.title,
    subtitle: ev.subtitle ?? null,
    description: ev.description ?? null,
    start: ev.start,
    end: ev.end,
    startTime: fmt24(ev.start),
    endTime: fmt24(ev.end),
    startLabel: label(ev.start),
    endLabel: label(ev.end),
    durationMinutes: ev.end - ev.start,
    column: ev.column,
    columnLabel: columns[ev.column]?.label ?? null,
    locked: ev.locked === true,
  });

  const closeSel = (): void => {
    setSel(null);
    setForm(null);
  };

  const createAt = (ci: number, e: ReactMouseEvent): void => {
    if (!editable) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const start = yToMinutes(e.clientY, rect.top, rect.height, winStart, winEnd, snap);
    const end = Math.min(winEnd, start + defaultDuration);
    if (end - start < 5 || events.length >= MAX_EVENTS) return;
    const ev: SEvent = { id: `n${++idRef.current}`, title: newEventTitle, start, end, column: ci };
    commitEvents([...events, ev]);
    emitWith('commit', payload(ev));
    setSel({ id: ev.id, mode: 'edit', anchor: { x: e.clientX, y: e.clientY } });
    setForm({ title: ev.title, start: fmt24(ev.start), end: fmt24(ev.end), subtitle: '', description: '' });
  };

  const openView = (ev: SEvent, rect: DOMRect): void => {
    setSel({ id: ev.id, mode: 'view', anchor: { x: rect.right + 8, y: rect.top } });
    setForm(null);
    emitWith('select', payload(ev));
  };

  const startEdit = (ev: SEvent): void => {
    if (!editable || ev.locked === true) return;
    setForm({ title: ev.title, start: fmt24(ev.start), end: fmt24(ev.end), subtitle: ev.subtitle ?? '', description: ev.description ?? '' });
    setSel((s) => (s ? { ...s, mode: 'edit' } : s));
  };

  const saveEdit = (): void => {
    if (!sel || !form) return;
    const cur = byId(sel.id);
    if (!cur) return closeSel();
    const ps = parseHM(form.start);
    let pe = parseHM(form.end);
    const start = ps == null ? cur.start : clamp(ps, winStart, winEnd - minDur);
    if (pe == null || pe <= start) pe = Math.min(winEnd, start + (cur.end - cur.start || defaultDuration));
    const end = clamp(pe, start + minDur, winEnd);
    const updated: SEvent = { ...cur, title: form.title.trim() || cur.title, start, end, subtitle: form.subtitle.trim() || undefined, description: form.description.trim() || undefined };
    commitEvents(events.map((e) => (e.id === updated.id ? updated : e)));
    emitWith('change', payload(updated));
    setSel((s) => (s ? { ...s, mode: 'view' } : s));
    setForm(null);
  };

  const deleteEvent = (id: string): void => {
    const ev = byId(id);
    if (!ev || ev.locked === true) return;
    commitEvents(events.filter((e) => e.id !== id));
    emitWith('dismiss', { id: ev.id, title: ev.title, start: ev.start, end: ev.end, column: ev.column });
    closeSel();
  };

  // On-demand whole-schedule submit: emit ONE commit carrying the full resolved
  // event set (the internal-submit path). Reads the in-scope `events` — never a
  // setState updater — and mirrors the same snapshot into bound spec.state.
  const submitSchedule = (): void => {
    const snap = snapshot(events);
    setBoundValue(snap);
    emitWith('commit', { events: snap, count: snap.length });
  };

  const finalFromDrag = (d: DragState, clientX: number, clientY: number): { start: number; end: number; column: number } => {
    const dyMin = ((clientY - d.startClientY) / (d.areaHeight || gridHeight)) * spanMin;
    const dur = d.origEnd - d.origStart;
    if (d.mode === 'move') {
      const ns = clamp(snapTo(d.origStart + dyMin, snap), winStart, winEnd - dur);
      const w = d.areaWidth / d.numCols;
      const col = w > 0 ? clamp(Math.floor((clientX - d.areaLeft) / w), 0, d.numCols - 1) : d.origColumn;
      return { start: ns, end: ns + dur, column: col };
    }
    const ne = clamp(snapTo(d.origEnd + dyMin, snap), d.origStart + minDur, winEnd);
    return { start: d.origStart, end: ne, column: d.origColumn };
  };
  const applyDrag = (id: string, start: number, end: number, column: number): void => {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, start, end, column } : e)));
  };

  const onBlockPointerDown = (e: ReactPointerEvent, ev: SEvent): void => {
    e.stopPropagation();
    // Locked events never drag/resize — pointer-up with no drag state still
    // opens the (read-only) popover and emits `select`, same as editable:false.
    if (!editable || ev.locked === true) return;
    const el = e.currentTarget as HTMLElement;
    const area = el.closest('[data-grid]') as HTMLElement | null;
    const ar = area?.getBoundingClientRect();
    const tgt = e.target as HTMLElement;
    const isResize = tgt?.dataset?.resize === '1' || tgt?.closest?.('[data-resize="1"]') != null;
    dragRef.current = {
      id: ev.id,
      mode: isResize ? 'resize' : 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      areaLeft: ar?.left ?? 0,
      areaWidth: ar?.width ?? 1,
      areaHeight: ar?.height ?? gridHeight,
      numCols: columns.length,
      origColumn: ev.column,
      origStart: ev.start,
      origEnd: ev.end,
      moved: false,
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* stale pointer */
    }
  };
  const onBlockPointerMove = (e: ReactPointerEvent): void => {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientY - d.startClientY) > MOVE_THRESHOLD_PX || Math.abs(e.clientX - d.startClientX) > MOVE_THRESHOLD_PX) d.moved = true;
    if (!d.moved) return;
    const { start, end, column } = finalFromDrag(d, e.clientX, e.clientY);
    applyDrag(d.id, start, end, column);
  };
  const onBlockPointerUp = (e: ReactPointerEvent, ev: SEvent): void => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.moved) {
      openView(ev, (e.currentTarget as HTMLElement).getBoundingClientRect());
      return;
    }
    const { start, end, column } = finalFromDrag(d, e.clientX, e.clientY);
    commitEvents(events.map((el) => (el.id === d.id ? { ...el, start, end, column } : el)));
    emitWith('move', payload({ ...ev, start, end, column }));
  };

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeSel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const vars = styleVars(
    { var: '--fr-sch-accent', value: p.accent, kind: 'color' },
    { var: '--fr-sch-grid', value: p.gridColor, kind: 'color' },
    { var: '--fr-sch-muted', value: p.mutedColor, kind: 'color' },
  );

  // Positioned blocks — one flat overlay across the whole columns area.
  const positioned: Array<{ ev: SEvent; left: number; width: number; top: number; height: number; z: number; stacked: boolean }> = [];
  for (let ci = 0; ci < columns.length; ci++) {
    const colEvents = events.filter((e) => e.column === ci);
    const lay = layoutTimeBlocks(colEvents.map<TimedInput>((e) => ({ start: e.start, end: e.end })), winStart, winEnd);
    colEvents.forEach((ev, i) => {
      const pos = lay[i];
      // Equal lane splits crushed titles ("Board de…" at 66px).
      // Overlaps now CASCADE like desktop calendars: each lane offsets right a
      // little and extends to the column edge, with later lanes stacked on top
      // (zIndex) — every block keeps near-full width for its title.
      const offset = pos.laneCount > 1 ? Math.min(14, colW * 0.28 / (pos.laneCount - 1)) : 0;
      const left = ci * colW + pos.laneIndex * offset;
      const width = colW - pos.laneIndex * offset;
      positioned.push({ ev, left, width, top: pos.top, height: pos.height, z: pos.laneIndex, stacked: pos.laneCount > 1 });
    });
  }

  const selEvent = sel ? byId(sel.id) : undefined;
  const pop = sel && typeof window !== 'undefined' ? clampPopover(sel.anchor) : null;

  return (
    <div
      className="w-full overflow-x-auto rounded-lg border border-[color:var(--fr-sch-grid,var(--color-border))]"
      style={vars}
      // The grid is a horizontal scroller (the body below holds a 32rem floor), and
      // a scroll container that cannot take focus cannot be scrolled without a
      // pointer. The event blocks ARE focusable, but they do not cover the scroll
      // area — an empty schedule has none at all, and a day whose events all sit in
      // column 1 leaves the later columns, the hour axis and the header row with no
      // focusable content to walk to. So the scrollport earns its own tab stop
      // (Carousel precedent, same reasoning).
      // role="group", not "region": region is a LANDMARK, so every schedule on a
      // page would compete with the page's real landmarks in a screen reader's
      // navigation list. A named group announces the scrollport without that cost.
      //
      // The meta text INSIDE the blocks (time + subtitle) is deliberately NOT
      // re-inked here. It sits on the block's 12% tint rather than on the card, and
      // it measured 4.09:1 — but that was `--frayme-muted-fg`
      // #71717a, which moved to #52525b in frayme.css for exactly this
      // class of failure. On the new token the same spans measure 6.54:1 resting /
      // 5.82:1 hovered (light) and 5.45:1 (dark). A local color-mix on top of that
      // is the per-component patch the token change explicitly rejected.
      role="group"
      aria-label="Schedule"
      tabIndex={0}
    >
      <div className="min-w-[32rem]">
        {/* Header row */}
        <div className="flex border-b border-[color:var(--fr-sch-grid,var(--color-border))]">
          <div className="w-14 shrink-0" aria-hidden="true" />
          {columns.map((c, i) => (
            <div key={i} className="flex-1 border-l border-[color:var(--fr-sch-grid,var(--color-border))] px-2 py-2 text-center text-sm font-medium text-[color:var(--fr-sch-muted,var(--color-muted-foreground))]">
              {c.label}
            </div>
          ))}
        </div>

        {/* Body — the first/last hour labels were CLAMPED inside the
            container (translate hacks), landing ~10px off their pitch lines. All
            labels now center on their rules; the py-2 wrapper provides the
            headroom that the clamping used to fake. */}
        <div className="py-2">
        <div className="flex" style={{ height: `${gridHeight}px` }}>
          <div className="relative w-14 shrink-0">
            {ticks.map((t, i) => (
              <div
                key={i}
                className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-[color:var(--fr-sch-muted,var(--color-muted-foreground))]"
                style={{ top: `${t.topPct}%` }}
              >
                {t.label ? (hour12 ? t.label : fmt24((startHour + i) * 60)) : ''}
              </div>
            ))}
          </div>

          {/* Columns area — one relative container holding a background grid + a blocks overlay */}
          <div data-grid className="relative flex-1">
            {/* Background: per-column click-to-create + gridlines */}
            <div className="absolute inset-0 flex">
              {columns.map((_c, ci) => (
                <div
                  key={ci}
                  data-col={ci}
                  onClick={(e) => createAt(ci, e)}
                  className={cn('relative flex-1 border-l border-[color:var(--fr-sch-grid,var(--color-border))]', editable && 'hover:bg-[color:var(--fr-sch-accent,var(--fr-accent))]/[0.03]')}
                >
                  {ticks.map((t, i) =>
                    i === 0 ? null : (
                      <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-[color:var(--fr-sch-grid,var(--color-border))] opacity-80" style={{ top: `${t.topPct}%` }} aria-hidden="true" />
                    ),
                  )}
                </div>
              ))}
            </div>

            {/* Now line — one line across the whole area */}
            {showNow && (
              <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-[color:var(--fr-sch-accent,var(--color-primary))]" style={{ top: `${nowTop}%` }} aria-hidden="true">
                <span className="absolute left-0 -top-1 h-2 w-2 rounded-full bg-[color:var(--fr-sch-accent,var(--color-primary))]" />
              </div>
            )}

            {/* Blocks overlay — pointer-events pass through empty space to the columns below */}
            <div className="pointer-events-none absolute inset-0 z-20">
              {positioned.map(({ ev: b, left, width, top, height, z, stacked }) => {
                const active = sel?.id === b.id;
                // Content gates were %-of-window (blind to the real
                // pixel size), so 60-min blocks showed 3 lines in ~44px and
                // clipped. Gate on PIXELS instead.
                const pxH = (height / 100) * gridHeight;
                const showTime = pxH >= 34;
                const showSubtitle = b.subtitle != null && pxH >= 56;
                const titleClamp2 = pxH >= 44;
                const blockStyle: CSSProperties = {
                  top: `${top}%`,
                  height: `${height}%`,
                  left: `calc(${left}% + 2px)`,
                  width: `calc(${width}% - 4px)`,
                  zIndex: 20 + z,
                  ...styleVars({ var: '--fr-sch-ev', value: b.color, kind: 'color' }),
                };
                return (
                  <div
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${b.title}, ${label(b.start)} to ${label(b.end)}`}
                    style={blockStyle}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openView(b, (e.currentTarget as HTMLElement).getBoundingClientRect());
                      }
                    }}
                    onPointerDown={(e) => onBlockPointerDown(e, b)}
                    onPointerMove={onBlockPointerMove}
                    onPointerUp={(e) => onBlockPointerUp(e, b)}
                    className={cn(
                      'group pointer-events-auto absolute overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left text-xs leading-tight transition select-none touch-none',
                      // Stacked overlaps get an opaque face + hairline ring so the
                      // cascade reads as layers, not bleed-through. That face is
                      // composited over --color-card, and a Card's authored `bg`
                      // re-points --fr-card-bg, never --color-card — so this branch
                      // is still a LIGHT slab inside a dark authored card and must
                      // carry the token its fill is partnered with. The title below
                      // is `text-current` for the ordinary 12%-tint case; it picks
                      // this up by inheritance when the block paints its own face.
                      stacked && 'text-foreground bg-clip-padding shadow-sm ring-1 ring-[color:var(--color-border)] [background-color:color-mix(in_srgb,var(--fr-sch-ev,var(--fr-sch-accent,var(--color-primary)))_12%,var(--color-card))]',
                      editable && b.locked !== true ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                      active && 'ring-2 ring-offset-1',
                      'border-[color:var(--fr-sch-ev,var(--fr-sch-accent,var(--color-primary)))]',
                      'ring-[color:var(--fr-sch-ev,var(--fr-sch-accent,var(--color-primary)))]',
                      'bg-[color:var(--fr-sch-ev,var(--fr-sch-accent,var(--color-primary)))]/12',
                      'hover:bg-[color:var(--fr-sch-ev,var(--fr-sch-accent,var(--color-primary)))]/20',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sch-ev,var(--fr-sch-accent,var(--fr-accent)))_20%,transparent)]',
                    )}
                  >
                    {/* EARNED single line: an event block is absolutely positioned
                        and its height IS the duration (top/height %), so the box
                        cannot grow to hold more text. The pixel gates above already
                        buy the two-line budget wherever the duration pays for it;
                        under 44px only one line fits and the ellipsis is the honest
                        bound (full title stays in title= and the popover).
                        break-words on the clamped branch is the shear guard — a word
                        longer than the block is otherwise cut mid-glyph. */}
                    {/* An un-stacked block's fill is a 12% tint of its own colour —
                        88% of what shows through is the surface the schedule sits
                        on, and the Scheduler root paints nothing (border only). So
                        the title INHERITS rather than resetting to the global token:
                        inside an authored `Card { bg:"#12161f", color:"#e2e6f0" }`
                        text-foreground printed rgb(24,24,27) on a near-#12161f
                        block = 1.02:1. currentColor is --frayme-fg at the top level,
                        which IS --color-foreground (frayme.css:138), so an un-nested
                        schedule is byte-identical; the `stacked` branch above
                        restores the token for the one case that paints a real face. */}
                    <span className={cn('block font-semibold text-current', titleClamp2 ? 'line-clamp-2 break-words' : 'truncate')} title={b.title || undefined}>{b.title}</span>
                    {/* These two meta lines are the spans the contrast audit flagged —
                        they sit on the block's tint, not on the card. Left on the
                        muted token on purpose; see the note on the component root. */}
                    {showTime && <span className="block text-[10px] tabular-nums text-[color:var(--fr-sch-muted,var(--color-muted-foreground))]">{label(b.start)} – {label(b.end)}</span>}
                    {/* Same fixed-height contract: the subtitle only renders once the
                        block is ≥56px, i.e. once exactly one more line is paid for. */}
                    {showSubtitle && <span className="block truncate text-[color:var(--fr-sch-muted,var(--color-muted-foreground))]" title={b.subtitle || undefined}>{b.subtitle}</span>}
                    {editable && b.locked !== true && (
                      <span data-resize="1" className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-end justify-center opacity-0 group-hover:opacity-100" aria-hidden="true">
                        <span data-resize="1" className="mb-0.5 block h-0.5 w-6 rounded-full bg-[color:var(--fr-sch-ev,var(--fr-sch-accent,var(--color-primary)))]" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* Scroll affordance: a bottom fade inside the scroll
            container so a cropped grid reads as scrollable, not severed. */}
        <div className="pointer-events-none sticky bottom-0 -mt-5 h-5 bg-gradient-to-t from-[var(--color-card)] to-transparent" aria-hidden="true" />
        </div>

        {/* Whole-schedule submit — opt-in on-demand snapshot of the full event set,
            so an agent gets one commit{events} without replaying every interaction. */}
        {showSubmit && editable && (
          <div className="flex justify-end border-t border-[color:var(--fr-sch-grid,var(--color-border))] px-3 py-2">
            <button
              type="button"
              onClick={submitSchedule}
              className="inline-flex items-center justify-center rounded-md bg-[color:var(--fr-sch-accent,var(--color-foreground))] px-3 py-1.5 text-sm font-medium text-card hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sch-accent,var(--fr-accent))_20%,transparent)]"
            >
              {submitLabel}
            </button>
          </div>
        )}
      </div>

      {/* Event popover — view / edit / delete */}
      {sel && selEvent && pop && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeSel} aria-hidden="true" />
          <div
            role="dialog"
            aria-label={sel.mode === 'edit' ? 'Edit event' : 'Event details'}
            // This popover and everything in it KEEP text-foreground, on both of the
            // inherited-ink exemptions at once: it is `position:fixed`, so it escapes
            // the authored container and is viewport-placed rather than sitting on
            // that surface, AND it paints its own opaque `bg-card`. Its inputs below
            // do the same for the same second reason.
            className="fixed z-50 w-[292px] rounded-xl border border-border bg-card p-4 text-foreground shadow-xl"
            style={{ left: `${pop.left}px`, top: `${pop.top}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {sel.mode === 'view' || !form ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-[color:var(--fr-sch-ev,var(--fr-sch-accent,var(--color-primary)))]" style={selEvent.color ? ({ ['--fr-sch-ev']: selEvent.color } as CSSProperties) : undefined} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    {/* The popover is the place the grid block DEFERS to for the full
                        title, so it may not clip in turn: the dialog has a fixed width
                        but a free height, so the heading wraps. */}
                    <h3 className="break-words text-sm font-semibold text-foreground" title={selEvent.title || 'Untitled'}>{selEvent.title || 'Untitled'}</h3>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {label(selEvent.start)} – {label(selEvent.end)} · {columns[selEvent.column]?.label ?? ''}
                    </p>
                  </div>
                  {/* An explicit 28px box, not padding around the glyph. This
                      stylesheet ships WITHOUT Tailwind preflight, so a bare <button>
                      keeps the UA's 13.3px font: the ✕ plus p-1 measured ~17x23px —
                      under the 24x24 CSS px WCAG 2.5.8 asks of a pointer target, and
                      it is the only way out of the popover for a touch user. 28, not
                      24, so it is not sitting exactly on the floor (Carousel arrows
                      took 36 for the same reason). The negative margins keep the
                      glyph optically where it was. */}
                  <button type="button" onClick={closeSel} aria-label="Close" className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_70%,transparent)]">✕</button>
                </div>
                {selEvent.subtitle && <p className="text-xs text-foreground">{selEvent.subtitle}</p>}
                {selEvent.description && <p className="text-xs text-muted-foreground">{selEvent.description}</p>}
                {editable && selEvent.locked !== true && (
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => startEdit(selEvent)} className="inline-flex flex-1 items-center justify-center rounded-md bg-[color:var(--fr-sch-accent,var(--color-foreground))] px-3 py-1.5 text-sm font-medium text-card hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sch-accent,var(--fr-accent))_20%,transparent)]">
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteEvent(selEvent.id)} className="inline-flex items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">
                      Delete
                    </button>
                  </div>
                )}
                {editable && selEvent.locked === true && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Locked — this entry can’t be changed here.</p>
                )}
              </div>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit();
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Edit event</h3>
                  {/* Same 28px target as the view-mode close above. */}
                  <button type="button" onClick={closeSel} aria-label="Close" className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_70%,transparent)]">✕</button>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Title
                  <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sch-accent,var(--fr-accent))_20%,transparent)]" />
                </label>
                <div className="flex gap-2">
                  <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Start
                    <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sch-accent,var(--fr-accent))_20%,transparent)]" />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
                    End
                    <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sch-accent,var(--fr-accent))_20%,transparent)]" />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Note
                  <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Location / attendee…" className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sch-accent,var(--fr-accent))_20%,transparent)]" />
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <button type="submit" className="inline-flex flex-1 items-center justify-center rounded-md bg-[color:var(--fr-sch-accent,var(--color-foreground))] px-3 py-1.5 text-sm font-medium text-card hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sch-accent,var(--fr-accent))_20%,transparent)]">
                    Save
                  </button>
                  <button type="button" onClick={() => deleteEvent(selEvent.id)} className="inline-flex items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">
                    Delete
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function clampPopover(anchor: { x: number; y: number }): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchor.x;
  if (left + POP_W > vw - 8) left = anchor.x - POP_W - 16;
  left = Math.max(8, Math.min(left, vw - POP_W - 8));
  const top = Math.max(8, Math.min(anchor.y, vh - POP_H - 8));
  return { left, top };
}
