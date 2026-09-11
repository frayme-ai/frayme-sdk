'use client';
import { useState, useRef, useEffect } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { clampInt } from './_num.js';
import { fracToTime, timeToFrac, formatDuration } from './_timegrid.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { safeColor, safeDimension, type DimOpts } from '@frayme/catalog/validate';

/* Catalog component (media-scrubber): MediaScrubber — visual-only media timeline.
 * OWNS-THE-PLAYHEAD: pos seeds from currentTime (static props), re-seeds on change
 * but the effect GUARDS on scrubbingRef so it never fights the finger. ONE stable
 * track carries the pointer capture; playhead + bubble are children (no re-parent).
 * pointercancel/lostpointercapture end the scrub (idempotent). Emits in handlers. */

const H_OPTS: DimOpts = { units: ['px', 'rem'], min: 32, max: 160 };
const MAX_SAMPLES = 2000;
const MAX_CHAPTERS = 200;

interface Chapter {
  id?: string | null;
  time: number;
  label?: string | null;
}

export function MediaScrubber({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    duration?: number | null;
    currentTime?: number | null;
    value?: number | null;
    buffered?: number | null;
    waveform?: number[] | null;
    chapters?: Chapter[] | null;
    playing?: boolean | null;
    showPlayButton?: boolean | null;
    showTime?: boolean | null;
    showThumbnails?: boolean | null;
    showSubmit?: boolean | null;
    submitLabel?: string | null;
    emitOnChange?: boolean | null;
    variant?: string | null;
    height?: unknown;
    accent?: unknown;
    trackColor?: unknown;
    bufferedColor?: unknown;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  const duration = Math.max(0, Number.isFinite(p.duration) ? (p.duration as number) : 100);
  const seedTime = Math.max(0, Math.min(Number.isFinite(p.currentTime) ? (p.currentTime as number) : 0, duration));
  const showPlay = p.showPlayButton !== false;
  const showTime = p.showTime !== false;
  const playing = p.playing === true;
  const variant = (p.variant as string) ?? 'waveform';
  const waveform = (Array.isArray(p.waveform) ? p.waveform : []).slice(0, MAX_SAMPLES).map((v) => (Number.isFinite(v) ? Math.max(0, Math.min(v, 1e6)) : 0));
  const chapters = (Array.isArray(p.chapters) ? p.chapters : []).slice(0, MAX_CHAPTERS).filter((c) => Number.isFinite(c?.time));
  const buffered = Number.isFinite(p.buffered) ? Math.max(0, Math.min(p.buffered as number, duration)) : null;

  // Playhead position lands in (bindable) spec.state so an external Button can read the
  // live seek time; falls back to local state when unbound.
  const boundValue = (bindings as { value?: unknown } | undefined)?.value;
  const [posState, setPosState] = useBoundProp<number>(
    Number.isFinite(p.value) ? (p.value as number) : seedTime,
    boundValue,
  );
  const pos = Math.max(0, Math.min(Number.isFinite(posState) ? (posState as number) : seedTime, duration));
  const setPos = setPosState;
  const posRef = useRef(pos);
  posRef.current = pos;
  const scrubbingRef = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);
  const seedKey = `${p.currentTime}|${duration}`;
  useEffect(() => {
    if (scrubbingRef.current) return; // don't yank the playhead out from under the finger
    if (boundValue) return; // when bound, the store owns the position — don't re-seed over it
    setPos(seedTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const vars = styleVars(
    { var: '--fr-ms-accent', value: p.accent, kind: 'color' },
    { var: '--fr-ms-track', value: p.trackColor, kind: 'color' },
    { var: '--fr-ms-buf', value: p.bufferedColor, kind: 'color' },
  );
  const trackH = safeDimension(p.height, H_OPTS) ?? (p.showThumbnails ? '4.5rem' : '3rem');
  const posFrac = timeToFrac(pos, duration);
  const bufFrac = buffered != null ? timeToFrac(buffered, duration) : 0;
  const maxWave = waveform.length ? Math.max(...waveform, 0.0001) : 1;

  const seekFromX = (clientX: number, el: HTMLElement): void => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return;
    const t = fracToTime((clientX - r.left) / r.width, duration);
    posRef.current = t;
    setPos(t);
  };
  const onDown = (e: ReactPointerEvent): void => {
    const el = e.currentTarget as HTMLElement;
    scrubbingRef.current = true;
    setScrubbing(true);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* stale pointer */
    }
    seekFromX(e.clientX, el);
  };
  const onMove = (e: ReactPointerEvent): void => {
    if (!scrubbingRef.current) return;
    seekFromX(e.clientX, e.currentTarget as HTMLElement);
  };
  const endScrub = (): void => {
    if (!scrubbingRef.current) return; // idempotent across up + lostcapture
    scrubbingRef.current = false;
    setScrubbing(false);
    const t = posRef.current;
    emitWith('change', { time: Math.round(t), fraction: timeToFrac(t, duration), timeLabel: formatDuration(t) });
  };
  const togglePlay = (): void => emitWith('commit', { action: playing ? 'pause' : 'play', playing: !playing });
  const submitPosition = (): void => {
    const t = posRef.current;
    emitWith('commit', { time: Math.round(t), fraction: timeToFrac(t, duration), timeLabel: formatDuration(t) });
  };
  const pickChapter = (c: Chapter, index: number): void => {
    emitWith('select', { id: c.id ?? `ch${index}`, index, time: c.time, label: c.label ?? null, fraction: timeToFrac(c.time, duration), timeLabel: formatDuration(c.time) });
  };

  const accent = 'var(--fr-ms-accent, var(--color-primary))';
  const track = 'var(--fr-ms-track, var(--color-muted))';

  return (
    <div style={vars} className="flex w-full items-center gap-3">
      {showPlay && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-[color:var(--fr-ms-accent,var(--color-foreground))] text-card hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ms-accent,var(--fr-accent))_20%,transparent)]"
        >
          {playing ? '❚❚' : '▶'}
        </button>
      )}

      <div className="min-w-0 flex-1">
        {/* Track (the single pointer-capture surface) */}
        <div
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(pos)}
      aria-valuetext={`${formatDuration(pos)} of ${formatDuration(duration)}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              const t = Math.max(0, Math.min(posRef.current + (e.key === 'ArrowRight' ? 5 : -5), duration));
              posRef.current = t;
              setPos(t);
              emitWith('change', { time: Math.round(t), fraction: timeToFrac(t, duration), timeLabel: formatDuration(t) });
            }
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onLostPointerCapture={endScrub}
          className={cn('relative w-full cursor-pointer touch-none select-none overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ms-accent,var(--fr-accent))_20%,transparent)]', scrubbing && 'ring-2 ring-[color:var(--fr-ms-accent,var(--fr-accent))]')}
          style={{ height: trackH, backgroundColor: track }}
        >
          {/* buffered fill */}
          {buffered != null && <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: `${bufFrac * 100}%`, backgroundColor: 'var(--fr-ms-buf, var(--color-muted-foreground))', opacity: 0.25 }} aria-hidden="true" />}

          {variant === 'waveform' && waveform.length > 0 ? (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
              {waveform.map((v, i) => {
                const x = (i / waveform.length) * 100;
                const bw = (100 / waveform.length) * 0.72;
                const h = (v / maxWave) * 90;
                const played = i / waveform.length <= posFrac;
                return <rect key={i} x={x} y={50 - h / 2} width={bw} height={h} rx={0.5} fill={played ? accent : track} style={{ opacity: played ? 1 : 0.55 }} />;
              })}
            </svg>
          ) : variant === 'line' ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2" style={{ backgroundColor: track }} aria-hidden="true" />
              <div className="pointer-events-none absolute top-1/2 left-0 h-0.5 -translate-y-1/2" style={{ width: `${posFrac * 100}%`, backgroundColor: accent }} aria-hidden="true" />
            </>
          ) : (
            <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: `${posFrac * 100}%`, backgroundColor: accent, opacity: 0.85 }} aria-hidden="true" />
          )}

          {/* chapter markers */}
          {chapters.map((c, i) => (
            <button
              key={c.id ?? i}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); pickChapter(c, i); }}
              title={c.label ?? undefined}
              aria-label={`Chapter ${c.label ?? i + 1}`}
              className="absolute top-0 z-10 h-full w-6 -translate-x-1/2 cursor-pointer bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-1 before:-translate-x-1/2 before:bg-foreground/30 before:content-[''] hover:before:bg-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ms-accent,var(--fr-accent))_20%,transparent)]"
              style={{ left: `${timeToFrac(c.time, duration) * 100}%` }}
            />
          ))}

          {/* playhead */}
          <div className="pointer-events-none absolute top-0 z-20 h-full w-0.5 -translate-x-1/2 bg-[color:var(--fr-ms-accent,var(--color-primary))]" style={{ left: `${posFrac * 100}%` }} aria-hidden="true">
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--fr-ms-accent,var(--color-primary))] shadow" />
          </div>
        </div>
      </div>

      {showTime && (
        <span className="shrink-0 select-none font-mono text-xs tabular-nums text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]">
          {formatDuration(pos)} / {formatDuration(duration)}
        </span>
      )}

      {p.showSubmit === true && (
        <button
          type="button"
          onClick={submitPosition}
          className="shrink-0 rounded-md bg-[color:var(--fr-ms-accent,var(--color-foreground))] px-3 py-1.5 text-xs font-medium text-card hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ms-accent,var(--fr-accent))_20%,transparent)]"
        >
          {typeof p.submitLabel === 'string' && p.submitLabel.trim() ? p.submitLabel : 'Seek'}
        </button>
      )}
    </div>
  );
}
