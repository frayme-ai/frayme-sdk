'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import type { ReactNode, UIEvent } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { clampInt } from './_num.js';
import { safeDimension, type DimOpts } from '@frayme/catalog/validate';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { useWindowedList } from './_virtual.js';
import { useStickyAutoScroll } from './_scroll.js';

/* Catalog component (log-console): LogConsole — virtualized severity-colored log viewer.
 *
 * STATELESS-VIEW over the `lines` snapshot + local view state (levels/query/wrap/
 * follow/selection). Lines are parsed → ANSI-STRIPPED → filtered via useMemo each
 * render; never written back to the spec. Fixed-row virtualization (useWindowedList)
 * + sticky follow (useStickyAutoScroll, SSR top-anchored + post-mount tail jump).
 * Severity color comes ONLY from the closed `level` enum — author ANSI is stripped
 * to plain text, never rendered as color/markup. */

const MAX_LINES = 5000;
const MAX_LINE_LEN = 2000;
const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
type Level = (typeof LEVELS)[number];
const H_OPTS: DimOpts = { units: ['px', 'rem'], min: 120, max: 900 };

/* `info` KEEPS `text-foreground` (it does NOT inherit), and so does the
   level-less row below. The log body is the one place that looks like it should
   inherit — it is monospace CONTENT — but LogConsole PAINTS the surface under it:
   the scroller carries an inline `backgroundColor: var(--fr-log-bg,
   var(--color-card))`, and an authored Card sets --fr-card-bg, never --color-card,
   so that surface is still #ffffff inside a dark card. Measured on Card
   bg:#12161f color:#e2e6f0: token 17.72:1, inherited 1.25:1 — white on white.
   The same string dresses the toolbar's severity chips, which paint their own
   `bg-muted` (token 16.12:1, inherited 1.14:1), so both readers agree.
   NOT fixed here, and NOT this defect: a model-supplied `background` (a dark
   terminal) darkens the surface while this token stays #18181b. currentColor
   would not repair that either — it resolves to the page/card ink, which is dark
   on a default page. That needs a paired on-fill `color` channel (the
   "card fill + on-fill text" coherence group), which is a separate change. */
const LEVEL_COLOR: Record<Level, string> = {
  debug: 'text-muted-foreground',
  info: 'text-foreground',
  warn: 'text-warning',
  error: 'text-danger',
  fatal: 'text-danger font-semibold',
};

interface RawLine {
  text: string;
  level?: Level | null;
  timestamp?: string | null;
  source?: string | null;
}
interface Line {
  text: string;
  level?: Level;
  ts?: string;
  source?: string;
}

/** Strip ANSI CSI (incl. SGR colors) + OSC sequences + other control chars to plain text. */
function stripAnsi(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

export function LogConsole({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    lines?: (string | RawLine)[] | null;
    levels?: Level[] | null;
    query?: string | null;
    follow?: boolean | null;
    showToolbar?: boolean | null;
    showTimestamps?: boolean | null;
    wrap?: boolean | null;
    showSearch?: boolean | null;
    emitOnChange?: boolean | null;
    selectedIndex?: number | null;
    maxHeight?: unknown;
    rowHeight?: number | null;
    accent?: unknown;
    background?: unknown;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const showToolbar = p.showToolbar !== false;
  const showTimestamps = p.showTimestamps !== false;
  const showSearch = p.showSearch !== false;
  const rowHeight = clampInt(p.rowHeight, 16, 40, 20);
  const maxH = safeDimension(p.maxHeight, H_OPTS) ?? '24rem';

  const linesKey = JSON.stringify(p.lines ?? null);
  const parsed = useMemo<Line[]>(() => {
    const raw = Array.isArray(p.lines) ? p.lines : [];
    const start = Math.max(0, raw.length - MAX_LINES);
    const out: Line[] = [];
    for (let i = start; i < raw.length; i++) {
      const l = raw[i];
      if (typeof l === 'string') out.push({ text: stripAnsi(l).slice(0, MAX_LINE_LEN) });
      else if (l && typeof l === 'object' && typeof l.text === 'string') {
        out.push({
          text: stripAnsi(l.text).slice(0, MAX_LINE_LEN),
          level: (LEVELS as readonly string[]).includes(l.level as string) ? (l.level as Level) : undefined,
          ts: typeof l.timestamp === 'string' ? l.timestamp : undefined,
          source: typeof l.source === 'string' ? l.source : undefined,
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey]);

  // Local view state — reset levels/wrap/follow on prop change; PRESERVE query.
  // The queryable view state (query, enabled levels, selected line) is routed through
  // (bindable) state so an external Button can read the active filter/selection.
  const levelsKey = JSON.stringify(p.levels ?? null);
  const [enabled, setEnabled] = useState<Set<Level>>(() => new Set(Array.isArray(p.levels) ? p.levels : LEVELS));
  const [queryState, setQueryState] = useBoundProp<string>(
    typeof p.query === 'string' ? p.query : '',
    (bindings as { query?: unknown } | undefined)?.query,
  );
  const query = typeof queryState === 'string' ? queryState : '';
  // Mirror the enabled-levels set into (bindable) state so the active severity filter is readable.
  const [, setLevelsState] = useBoundProp<Level[]>(
    Array.isArray(p.levels) ? p.levels : [...LEVELS],
    (bindings as { levels?: unknown } | undefined)?.levels,
  );
  const [wrapState, setWrap] = useBoundProp<boolean>(
    p.wrap === true,
    (bindings as { wrap?: unknown } | undefined)?.wrap,
  );
  const wrap = wrapState === true;
  const [followState, setFollowOn] = useBoundProp<boolean>(
    p.follow !== false,
    (bindings as { follow?: unknown } | undefined)?.follow,
  );
  const followOn = followState !== false;
  const [selectedState, setSelectedState] = useBoundProp<number | null>(
    typeof p.selectedIndex === 'number' ? p.selectedIndex : null,
    (bindings as { selectedIndex?: unknown } | undefined)?.selectedIndex,
  );
  const selected = selectedState ?? null;
  useEffect(() => {
    setEnabled(new Set(Array.isArray(p.levels) ? p.levels : LEVELS));
    setWrap(p.wrap === true);
    setFollowOn(p.follow !== false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey, p.wrap, p.follow]);

  const filtered = useMemo<Line[]>(() => {
    const q = query.trim().toLowerCase();
    return parsed.filter((l) => (!l.level || enabled.has(l.level)) && (!q || l.text.toLowerCase().includes(q)));
  }, [parsed, enabled, query]);

  const win = useWindowedList<Line>({ items: filtered, rowHeight, scrollRef });
  const sticky = useStickyAutoScroll({ scrollRef, follow: followOn, dep: filtered.length });
  const onScroll = (e: UIEvent<HTMLElement>): void => {
    win.onScroll(e);
    sticky.onScroll(e);
  };

  const vars = styleVars(
    { var: '--fr-log-accent', value: p.accent, kind: 'color' },
    { var: '--fr-log-bg', value: p.background, kind: 'color' },
  );

  const toggleLevel = (lvl: Level): void => {
    const next = new Set(enabled);
    if (next.has(lvl)) next.delete(lvl);
    else next.add(lvl);
    setEnabled(next);
    setLevelsState([...next]); // mirror into (bindable) state — unconditional
    emitWith('change', { name: 'levels', value: [...next] });
  };
  const onSearch = (v: string): void => {
    setQueryState(v); // keep the value live in (bindable) state unconditionally
    if (p.emitOnChange !== false) emitWith('search', { query: v });
  };
  const toggleWrap = (): void => {
    setWrap(!wrap);
    emitWith('change', { name: 'wrap', value: !wrap });
  };
  const jumpLatest = (): void => {
    sticky.scrollToBottom();
    setFollowOn(true);
    emitWith('change', { name: 'follow', value: true });
  };
  const copyAll = (): void => {
    const text = filtered.map((l) => l.text).join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    emitWith('commit', { control: 'copy', count: filtered.length, text, levels: [...enabled], query: query.trim() });
  };
  const selectLine = (l: Line, index: number): void => {
    setSelectedState(index);
    emitWith('select', { index, text: l.text, level: l.level ?? null, timestampLabel: l.ts ?? null, source: l.source ?? null });
  };

  const renderRow = (l: Line, index: number): ReactNode => (
    <div
      key={index}
      role="button"
      tabIndex={0}
      onClick={() => selectLine(l, index)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectLine(l, index); } }}
      style={wrap ? undefined : { height: `${rowHeight}px` }}
      className={cn(
        'flex cursor-default items-baseline gap-2 px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-log-accent,var(--fr-accent))_20%,transparent)]',
        selected === index && 'bg-[color:var(--fr-log-accent,var(--color-foreground))]/10',
        // EARNED single line: in the !wrap mode every row is pinned to exactly
        // `rowHeight` px (style above) because useWindowedList virtualizes on a
        // FIXED row height — a wrapped row would desync padTop/padBottom and the
        // scrollbar. The `wrap` prop/toolbar toggle is the escape hatch: it turns
        // virtualization off and switches the text below to whitespace-pre-wrap.
        !wrap && 'items-center whitespace-nowrap',
        wrap && 'py-0.5',
      )}
    >
      {showTimestamps && l.ts && <span className="shrink-0 select-none text-muted-foreground/70">{l.ts}</span>}
      {l.level && <span className={cn('w-10 shrink-0 select-none uppercase', LEVEL_COLOR[l.level])}>{l.level}</span>}
      {/* truncate only on the fixed-height virtualized row (see above); the wrap
          mode is the full-text view. */}
      <span className={cn(wrap ? 'break-all whitespace-pre-wrap' : 'truncate', l.level ? LEVEL_COLOR[l.level] : 'text-foreground')} title={l.text || undefined}>{l.text}</span>
    </div>
  );

  return (
    <div style={vars} className="w-full overflow-hidden rounded-lg border border-border">
      {/* The toolbar takes the component's OWN background. `bg-card` here ignored
          --fr-log-bg entirely, so a LogConsole with background:"#0b1020" rendered a
          dark body under a white strip — the same light-island shape as the table
          header. The scroller below already reads this var; the toolbar did not. */}
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5" style={{ backgroundColor: 'var(--fr-log-bg, var(--color-card))' }}>
          <div className="flex items-center gap-1">
            {LEVELS.map((lvl) => {
              const on = enabled.has(lvl);
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => toggleLevel(lvl)}
                  aria-pressed={on}
                  className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', on ? cn(LEVEL_COLOR[lvl], 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]') : 'text-muted-foreground/50')}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
          {showSearch && (
            <input
              type="search"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search…"
              aria-label="Search logs"
              className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-log-accent,var(--fr-accent))_20%,transparent)]"
            />
          )}
          <button type="button" onClick={toggleWrap} aria-pressed={wrap} className={cn('rounded px-1.5 py-1 text-xs', wrap ? 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground' : 'text-muted-foreground')}>
            Wrap
          </button>
          <button type="button" onClick={copyAll} className="rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]">
            Copy
          </button>
        </div>
      )}

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{ height: maxH, backgroundColor: 'var(--fr-log-bg, var(--color-card))' }}
          role="log"
          aria-label="Log console"
          aria-live="off"
          className="overflow-auto font-mono text-[11px] leading-tight"
        >
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">No log lines</p>
          ) : wrap ? (
            filtered.map((l, i) => renderRow(l, i))
          ) : (
            <>
              <div style={{ height: `${win.padTop}px` }} />
              {win.slice.map(({ item, index }) => renderRow(item, index))}
              <div style={{ height: `${win.padBottom}px` }} />
            </>
          )}
        </div>

        {!sticky.pinned && filtered.length > 0 && (
          <button
            type="button"
            onClick={jumpLatest}
            className="absolute bottom-2 right-3 rounded-full bg-[color:var(--fr-log-accent,var(--color-foreground))] px-3 py-1 text-xs font-medium text-card shadow-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-log-accent,var(--fr-accent))_20%,transparent)]"
          >
            ↓ Jump to latest
          </button>
        )}
      </div>
    </div>
  );
}
