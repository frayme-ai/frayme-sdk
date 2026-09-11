/* TimeAxisGrid — the shared time→coordinate layout engine.
 *
 * Powers Scheduler (and, later, ProgramGuideGrid/EPG + MediaScrubber). Turns a
 * list of timed events into positioned blocks: each block's TOP and HEIGHT are a
 * percentage of the visible time window, and overlapping events are split into
 * side-by-side lanes so none is hidden.
 *
 * SECURITY (§4.6): the engine consumes only NUMBERS (minutes, already validated
 * by `safeTimeMinutes` at the call site), computes every coordinate itself, and
 * clamps blocks into the window — a spec value never becomes markup. The caller
 * caps the event count (render-bomb guard).
 *
 * Positions are unitless percentages, so no new coordinate value KIND is needed —
 * time is just an axis number. */

export interface TimedInput {
  /** Start minute-of-day (0..1440). */
  start: number;
  /** End minute-of-day (0..1440); coerced to ≥ start. */
  end: number;
}

export interface PositionedBlock {
  /** % from the top of the window. */
  top: number;
  /** % height of the window (min 1). */
  height: number;
  /** 0-based lane within an overlap cluster. */
  laneIndex: number;
  /** Number of side-by-side lanes to divide the column width by. */
  laneCount: number;
}

/**
 * Lay timed events into positioned blocks within [winStart, winEnd] minutes.
 * Greedy lane assignment (leftmost free lane) + per-event lane count from its
 * overlap cluster, so concurrent events tile the column width without hiding.
 * Input order is preserved in the output (index-aligned).
 */
export function layoutTimeBlocks(events: TimedInput[], winStart: number, winEnd: number): PositionedBlock[] {
  const span = Math.max(1, winEnd - winStart);
  const clamped = events.map((e, i) => {
    const s = Math.max(winStart, Math.min(e.start, winEnd));
    const en = Math.max(s, Math.min(e.end, winEnd));
    return { s, en, i };
  });

  // Greedy lane assignment: sort by start (then longer first), place each event
  // in the first lane whose previous event has already ended.
  const order = [...clamped].sort((a, b) => a.s - b.s || b.en - a.en);
  const laneEnd: number[] = [];
  const lane = new Array<number>(events.length).fill(0);
  for (const e of order) {
    let li = laneEnd.findIndex((end) => end <= e.s);
    if (li === -1) {
      li = laneEnd.length;
      laneEnd.push(e.en);
    } else {
      laneEnd[li] = e.en;
    }
    lane[e.i] = li;
  }

  // laneCount = (max lane index across the event's overlap cluster) + 1.
  return clamped.map((e) => {
    let maxLane = lane[e.i];
    for (const f of clamped) {
      if (f.i === e.i) continue;
      if (f.s < e.en && f.en > e.s) maxLane = Math.max(maxLane, lane[f.i]);
    }
    return {
      top: ((e.s - winStart) / span) * 100,
      height: (Math.max(1, e.en - e.s) / span) * 100,
      laneIndex: lane[e.i],
      laneCount: maxLane + 1,
    };
  });
}

/**
 * Convert a pointer Y (client px) over a column into a snapped minute-of-day
 * within [winStart, winEnd]. The inverse of the block layout — used for
 * click-to-create and drag-to-reschedule. `snap` (minutes) rounds the result;
 * 0 disables snapping.
 */
export function yToMinutes(
  clientY: number,
  rectTop: number,
  rectHeight: number,
  winStart: number,
  winEnd: number,
  snap: number,
): number {
  if (!(rectHeight > 0)) return winStart;
  const frac = Math.max(0, Math.min(1, (clientY - rectTop) / rectHeight));
  const raw = winStart + frac * (winEnd - winStart);
  const snapped = snap > 0 ? Math.round(raw / snap) * snap : raw;
  return Math.max(winStart, Math.min(winEnd, snapped));
}

/** Hour tick labels (e.g. "9 AM") for the axis, from startHour to endHour inclusive. */
export function hourTicks(startHour: number, endHour: number): Array<{ hour: number; label: string; topPct: number }> {
  const s = Math.max(0, Math.min(23, Math.floor(startHour)));
  const e = Math.max(s + 1, Math.min(24, Math.floor(endHour)));
  const span = (e - s) * 60;
  const out: Array<{ hour: number; label: string; topPct: number }> = [];
  for (let h = s; h <= e; h++) {
    const hr = h % 24;
    const ampm = hr < 12 ? 'AM' : 'PM';
    const h12 = hr % 12 === 0 ? 12 : hr % 12;
    out.push({ hour: h, label: h === 24 ? '' : `${h12} ${ampm}`, topPct: (((h - s) * 60) / span) * 100 });
  }
  return out;
}

/* ── Horizontal / fractional extensions (EPG + MediaScrubber) ─────────────────
   Pure, unitless-%, Number.isFinite-guarded, SSR-safe (no window/Date). */

const fin = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);
const clampN = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

export interface SpanBlock {
  leftPct: number;
  widthPct: number;
  index: number;
}

/**
 * The HORIZONTAL twin of layoutTimeBlocks for a SINGLE lane (one EPG row): clamp
 * each [start,end] into the window and place it by percentage. No lane splitting —
 * an EPG row is one timeline. Width is clamped so a block never overflows the right
 * edge; a block fully outside the window gets widthPct 0 (drop it at the call site).
 */
export function spanBlocks(events: { start: number; end: number }[], winStart: number, winEnd: number): SpanBlock[] {
  const span = Math.max(1, winEnd - winStart);
  return events.map((e, index) => {
    const s = clampN(fin(e.start, winStart), winStart, winEnd);
    const en = clampN(fin(e.end, s), s, winEnd);
    const leftPct = ((s - winStart) / span) * 100;
    const widthPct = Math.max(0, Math.min((Math.max(1, en - s) / span) * 100, 100 - leftPct));
    return { leftPct, widthPct, index };
  });
}

/** Evenly-spaced axis ticks (minutes) with a guaranteed terminal tick at winEnd (100%). Capped at 49. */
export function axisTicks(winStart: number, winEnd: number, stepMin: number): { min: number; leftPct: number }[] {
  const span = Math.max(1, winEnd - winStart);
  const step = Math.max(1, Math.floor(stepMin));
  const out: { min: number; leftPct: number }[] = [];
  for (let m = winStart; m <= winEnd && out.length < 48; m += step) out.push({ min: m, leftPct: ((m - winStart) / span) * 100 });
  if (!out.length || out[out.length - 1].min !== winEnd) out.push({ min: winEnd, leftPct: 100 });
  return out;
}

/** Inverse of horizontal placement: a pointer X over a track → a snapped minute in [winStart,winEnd]. */
export function xToMinutes(clientX: number, rectLeft: number, rectWidth: number, winStart: number, winEnd: number, snap: number): number {
  if (!(rectWidth > 0)) return winStart;
  const frac = clampN((clientX - rectLeft) / rectWidth, 0, 1);
  const raw = winStart + frac * (winEnd - winStart);
  const snapped = snap > 0 ? Math.round(raw / snap) * snap : raw;
  return clampN(snapped, winStart, winEnd);
}

/** Fraction 0..1 → seconds within a duration, and the inverse. Div-by-zero guarded. */
export function fracToTime(frac: number, duration: number): number {
  return clampN(fin(frac, 0), 0, 1) * Math.max(0, fin(duration, 0));
}
export function timeToFrac(time: number, duration: number): number {
  const d = Math.max(0, fin(duration, 0));
  return d > 0 ? clampN(fin(time, 0) / d, 0, 1) : 0;
}

/** Seconds → "m:ss" (or "h:mm:ss" past an hour). */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(fin(seconds, 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
