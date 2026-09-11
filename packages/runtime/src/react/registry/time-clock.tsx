'use client';
import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import type { DimOpts } from '@frayme/catalog/validate';

/* Catalog group (time-clock): Timer · Stopwatch — the duration-clock family.
 *
 * SELF-TICKING POSTURE: a live clock ticks in React state ONLY.
 * It is seeded from static props (Timer: `duration`; Stopwatch: a zero baseline),
 * ticks against the wall clock on the CLIENT via setInterval in an effect, and
 * NEVER writes a running/elapsed value back into the stored spec. This is the
 * exact SSR-safe pattern shipped `RelativeTime` uses — no self-mutating spec
 * primitive is introduced, and server + first-client paint agree (the seed is a
 * static prop value, not Date.now()).
 *
 * SECURITY (§4.6): no new value channel. Inputs are NUMBERS (duration, clamped +
 * Number.isFinite-guarded), bounded ENUMS, validated colors (`--fr-*` vars via
 * styleVars → safeColor), and validated dimensions (fontSize via safeDimension).
 * Every label renders as ESCAPED React text — never markup. */

const TONE_TEXT: Record<string, string> = {
  neutral: 'text-[color:var(--fr-surface-fg,var(--color-foreground))]',
  success: 'text-success',
  warning: 'text-warning',
  critical: 'text-danger',
  info: 'text-primary',
};

/** Ring progress stroke per tone (coherent with the readout); neutral → the brand accent var. */
const TONE_RING: Record<string, string> = {
  neutral: 'stroke-[color:var(--fr-clock-accent,var(--color-primary))]',
  success: 'stroke-success',
  warning: 'stroke-warning',
  critical: 'stroke-danger',
  info: 'stroke-primary',
};

/** Free-standing readout scale — a font-size utility; overridden by the exact `fontSize` var when set. */
const SIZE_CLS: Record<string, string> = {
  sm: 'text-4xl',
  md: 'text-6xl',
  lg: 'text-7xl',
  xl: 'text-8xl',
};

const FS_OPTS: DimOpts = { units: ['px', 'rem'], min: 12, max: 96 };

const READOUT_BASE = 'font-mono tabular-nums font-semibold leading-none tracking-tight';

// quiet defaults: the Start/Pause control is neutral high-contrast
// (foreground/card) by default, not a brand slab; a supplied `accent` still fills brand.
const PRIMARY_CLS =
  'inline-flex min-w-[5.5rem] items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold text-card ' +
  'bg-[color:var(--fr-clock-accent,var(--color-foreground))] shadow-sm hover:opacity-90 active:scale-[0.98] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-clock-accent,var(--fr-accent))_20%,transparent)] focus-visible:ring-offset-2 ' +
  'disabled:opacity-40 disabled:pointer-events-none transition';

const CONTROL_CLS =
  'inline-flex min-w-[5.5rem] items-center justify-center rounded-lg px-5 py-2 text-sm font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))] ' +
  'bg-[color:var(--fr-surface-sunken,var(--color-muted))]/60 hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-clock-accent,var(--fr-accent))_20%,transparent)] disabled:opacity-40 disabled:pointer-events-none transition';

type ClockFormat = 'auto' | 'mm:ss' | 'hh:mm:ss';

const two = (n: number): string => String(n).padStart(2, '0');

/** ms → mm:ss / hh:mm:ss, with optional ".cs" centiseconds. Never negative. */
function formatClock(ms: number, fmt: ClockFormat, centis = false): string {
  const clamped = Math.max(0, ms);
  const total = Math.floor(clamped / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const useH = fmt === 'hh:mm:ss' || (fmt === 'auto' && h > 0);
  let base = useH ? `${two(h)}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
  if (centis) base += `.${two(Math.floor((clamped % 1000) / 10))}`;
  return base;
}

/* ── Timer — countdown ─────────────────────────────────────────────────────── */

export function Timer({ element, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    duration?: number | null;
    autoStart?: boolean | null;
    format?: ClockFormat | null;
    showControls?: boolean | null;
    showProgress?: boolean | null;
    tone?: string | null;
    accent?: unknown;
    mutedColor?: unknown;
    size?: string | null;
    fontSize?: unknown;
    expiredLabel?: string | null;
    startLabel?: string | null;
    pauseLabel?: string | null;
    resetLabel?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  // Static, SSR-stable seed: the full authored duration (clamped, finite).
  const durationMs = (Number.isFinite(p.duration) ? Math.max(0, Math.min(p.duration as number, 360_000)) : 0) * 1000;
  const fmt = (p.format as ClockFormat | null) ?? 'auto';
  const showControls = p.showControls !== false;
  const tone = (p.tone as string) ?? 'neutral';

  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [running, setRunning] = useState(!!p.autoStart);
  const endRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  // Re-seed when the authored duration changes (props-driven reset).
  useEffect(() => {
    setRemainingMs(durationMs);
    setRunning(!!p.autoStart);
    firedRef.current = false;
    endRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  // Client-only tick: anchor an end time from the remaining-at-start, then count
  // down against the wall clock. On reaching zero: stop + emit `commit` once.
  useEffect(() => {
    if (!running || remainingMs <= 0) return;
    endRef.current = Date.now() + remainingMs;
    const tick = (): void => {
      const rem = Math.max(0, (endRef.current ?? 0) - Date.now());
      setRemainingMs(rem);
      if (rem <= 0) {
        setRunning(false);
        if (!firedRef.current) {
          firedRef.current = true;
          emitWith('commit', { reason: 'complete', duration: durationMs / 1000 });
        }
      }
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const done = remainingMs <= 0 && durationMs > 0;
  const fraction = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;

  const vars = styleVars(
    { var: '--fr-clock-accent', value: p.accent, kind: 'color' },
    { var: '--fr-clock-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-clock-fs', value: p.fontSize, kind: 'dim', opts: FS_OPTS },
  );
  const hasFs = '--fr-clock-fs' in (vars as Record<string, string>);
  const toneCls = TONE_TEXT[tone] ?? TONE_TEXT.neutral;
  const ringStroke = TONE_RING[tone] ?? TONE_RING.neutral;

  const readout = done ? (p.expiredLabel ?? "Time's up") : formatClock(remainingMs, fmt);
  const readoutSizeCls = hasFs ? '[font-size:var(--fr-clock-fs)]' : p.showProgress ? 'text-3xl' : (SIZE_CLS[(p.size as string) ?? 'md'] ?? SIZE_CLS.md);

  const toggle = (): void => {
    if (done) return;
    setRunning((r) => !r);
  };
  const reset = (): void => {
    setRunning(false);
    firedRef.current = false;
    endRef.current = null;
    setRemainingMs(durationMs);
  };

  const C = 2 * Math.PI * 44;
  return (
    <div className="inline-flex flex-col items-center gap-6" style={vars}>
      {p.showProgress ? (
        <div className="relative inline-grid h-44 w-44 place-items-center">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="countdown progress">
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="5" className="stroke-[color:var(--fr-clock-muted,var(--color-border))] opacity-40" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              className={cn(ringStroke, 'transition-[stroke-dashoffset] duration-300 ease-linear')}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - fraction)}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className={cn(READOUT_BASE, readoutSizeCls, done ? 'text-base font-medium' : toneCls)} role="timer" aria-live="off">
              {readout}
            </span>
          </div>
        </div>
      ) : (
        <span className={cn(READOUT_BASE, readoutSizeCls, done ? 'text-2xl' : '', toneCls)} role="timer" aria-live="off">
          {readout}
        </span>
      )}

      {showControls && (
        <div className="flex items-center gap-3">
          <button type="button" className={PRIMARY_CLS} onClick={toggle} disabled={done}>
            {running ? (p.pauseLabel ?? 'Pause') : (p.startLabel ?? 'Start')}
          </button>
          <button type="button" className={CONTROL_CLS} onClick={reset}>
            {p.resetLabel ?? 'Reset'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Stopwatch — count-up ──────────────────────────────────────────────────── */

export function Stopwatch({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    autoStart?: boolean | null;
    format?: ClockFormat | null;
    precision?: 'seconds' | 'centiseconds' | null;
    showControls?: boolean | null;
    showLaps?: boolean | null;
    tone?: string | null;
    accent?: unknown;
    mutedColor?: unknown;
    size?: string | null;
    fontSize?: unknown;
    startLabel?: string | null;
    pauseLabel?: string | null;
    resetLabel?: string | null;
    lapLabel?: string | null;
    laps?: number[] | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  const fmt = (p.format as ClockFormat | null) ?? 'auto';
  const centis = p.precision === 'centiseconds';
  const showControls = p.showControls !== false;
  const toneCls = TONE_TEXT[(p.tone as string) ?? 'neutral'] ?? TONE_TEXT.neutral;

  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(!!p.autoStart);
  const [laps, setLaps] = useBoundProp<number[]>(Array.isArray(p.laps) ? p.laps : [], bindings?.laps);
  const lapList = laps ?? [];
  const accRef = useRef(0); // elapsed accumulated across pause boundaries
  const startRef = useRef<number | null>(null);

  // Client-only tick: measure (now - start) + accumulated. On pause/unmount the
  // cleanup folds the live segment into the accumulator so time never drifts.
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const step = centis ? 50 : 250;
    const id = window.setInterval(() => {
      setElapsedMs(accRef.current + (Date.now() - (startRef.current ?? Date.now())));
    }, step);
    return () => {
      window.clearInterval(id);
      if (startRef.current != null) {
        accRef.current += Date.now() - startRef.current;
        startRef.current = null;
        setElapsedMs(accRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, centis]);

  const vars = styleVars(
    { var: '--fr-clock-accent', value: p.accent, kind: 'color' },
    { var: '--fr-clock-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-clock-fs', value: p.fontSize, kind: 'dim', opts: FS_OPTS },
  );
  const hasFs = '--fr-clock-fs' in (vars as Record<string, string>);
  const readoutSizeCls = hasFs ? '[font-size:var(--fr-clock-fs)]' : (SIZE_CLS[(p.size as string) ?? 'md'] ?? SIZE_CLS.md);

  const reset = (): void => {
    setRunning(false);
    accRef.current = 0;
    startRef.current = null;
    setElapsedMs(0);
    setLaps([]);
  };
  const lap = (): void => {
    const at = elapsedMs;
    // Emit in the click handler (an event), NEVER inside the setState updater —
    // an updater runs during render, and emitting there triggers a setState in
    // ActionProvider mid-render ("update a component while rendering another").
    emitWith('commit', { index: lapList.length + 1, elapsedMs: at });
    // Write the FULL resolved lap array into spec.state (bindable `laps`) — the
    // bound setter takes a value, not an updater, so resolve it from the current list.
    setLaps([...lapList, at]);
  };

  return (
    <div className="inline-flex flex-col items-center gap-6" style={vars}>
      <span className={cn(READOUT_BASE, readoutSizeCls, toneCls)} role="timer" aria-live="off">
        {formatClock(elapsedMs, fmt, centis)}
      </span>

      {showControls && (
        <div className="flex items-center gap-3">
          <button type="button" className={PRIMARY_CLS} onClick={() => setRunning((r) => !r)}>
            {running ? (p.pauseLabel ?? 'Pause') : (p.startLabel ?? 'Start')}
          </button>
          {p.showLaps && (
            <button type="button" className={CONTROL_CLS} onClick={lap} disabled={!running}>
              {p.lapLabel ?? 'Lap'}
            </button>
          )}
          <button type="button" className={CONTROL_CLS} onClick={reset}>
            {p.resetLabel ?? 'Reset'}
          </button>
        </div>
      )}

      {/* min(13rem,100%) below: a floor that outlives its container is not a
          floor, it is an escape — the list walked off a phone-width host. */}
      {p.showLaps && lapList.length > 0 && (
        <ol className="w-full min-w-[min(13rem,100%)] max-w-xs divide-y divide-border rounded-lg border border-border text-sm">
          {lapList.map((at, i) => (
            <li key={i} className="flex items-center justify-between gap-4 px-3 py-1.5 tabular-nums">
              <span className="text-[color:var(--fr-clock-muted,var(--color-muted-foreground))]">Lap {i + 1}</span>
              <span className="font-mono font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))]">{formatClock(at, fmt, centis)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
