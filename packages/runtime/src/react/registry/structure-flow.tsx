'use client';
import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { accentTextVar, styleVars, weightClass, trackingClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { useAriaId } from './_aria.js';

/* Catalog group (structure-flow): Timeline, TimelineItem, Stepper, Tree.
 *
 * Same truly-dynamic contract as the shipped catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a model-named color) NEVER become classes — they land in
 *     `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC arbitrary
 *     `var(--fr-…, var(--color-…))` utilities WITH a token fallback (so props-less
 *     stays polished; a value never widens the closed compiled class set).
 *
 * INTERACTIVITY (catalog-wide rule): every interactive state is live WITHOUT a
 * binding. Stepper `current` flows through `useLocalOrBound` (local state when
 * unbound, two-way store-backed when bound) and a clickable step sets it directly.
 * Tree expand is an internal `useState` Set of node keys; Tree selection is
 * `useLocalOrBound`. `emit(...)` is an ADDITIONAL host signal, never the only
 * effect. Recursion (Tree) is hard-capped by maxDepth + array-guarded at every
 * level (copied from CommentThread).
 *
 * Icons are NAMES resolved against the closed `icons.ts` registry (guarded by
 * hasIcon; unknown/null → nothing). All text renders as plain escaped React
 * children — never markup. */

/* ── Shared tone → dot/marker color (semantic, token-backed) ───────────────── */

/** Deterministic ARIA ids for the trigger↔region pairings. React's `useId`
 *  diverges when a host SSRs the renderer inside a larger 'use client' tree (its
 *  ids are positional), so — as in forms.tsx/layout.tsx — the id derives from
 *  stable parts: the element's own spec id plus a per-part key. Unique within a
 *  spec (one spec id per element, one path per part). */
function ariaId(scope: string, ...parts: Array<string | number>): string {
  const tail = parts
    .map((s) => String(s).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter((s) => s.length > 0)
    .join('-');
  return tail.length > 0 ? `frayme-${scope}-${tail}` : `frayme-${scope}`;
}

/** The element's own spec id, stamped into props as `__fid` by FraymeRenderer
 *  (json-render does not pass the id down). Absent outside a FraymeRenderer, so
 *  the pairing falls back to the scope alone. */
function specId(element: ComponentRenderProps['element']): string {
  const raw = (element as { props?: { __fid?: unknown } }).props?.__fid;
  return typeof raw === 'string' ? raw : '';
}

/** Tone → the dot/marker background utility (semantic tokens; dark-mode safe). */
const TONE_DOT: Record<string, string> = {
  neutral: 'bg-muted-foreground/70',
  success: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
  info: 'bg-info',
};
function toneKey(t: unknown): string | null {
  return typeof t === 'string' && t in TONE_DOT ? t : null;
}
/* Timeline connector offsets PER DOT SIZE, so the rail meets the dot at every
 * size (previously hardcoded to the md offsets — sm/lg rails missed the dot).
 * md keeps the EXACT prior classes, so a size-less timeline is byte-identical.
 * Horizontal: top = the dot's vertical center (h-3/h-4/h-5 → 0.375/0.5/0.625rem).
 * Vertical: top = the dot's bottom edge; the height calc keeps the same end point. */
const TL_H_RAIL: Record<string, string> = { sm: 'top-1.5', md: 'top-2', lg: 'top-2.5' };
/* Vertical rail: the rail is a child of the ROW, running from
 * the dot's bottom edge to the row's bottom edge (bottom-0), so consecutive
 * rows' segments MEET and read as one continuous line. It used to live inside
 * the dot column, whose flex-stretched height excludes the row's pb-6 — that
 * left a ~32px gap under every dot and the connector read as broken ticks that
 * stuttered as item heights changed. The dots' ring-background masks the rail
 * behind each dot, so they still read as beads on one line.
 * `top` = the dot's bottom edge; `left` = the dot's centre minus half the rail. */
const TL_V_TOP: Record<string, string> = { sm: 'top-3', md: 'top-4', lg: 'top-5' };
const TL_V_X: Record<string, string> = {
  sm: 'left-[calc(0.375rem-1px)]',
  md: 'left-[calc(0.5rem-1px)]',
  lg: 'left-[calc(0.625rem-1px)]',
};
/* With a leading time column the dot column starts after it: w-14 (3.5rem) plus
 * the row's gap-3 (0.75rem). */
const TL_V_X_TIME: Record<string, string> = {
  sm: 'left-[calc(4.25rem+0.375rem-1px)]',
  md: 'left-[calc(4.25rem+0.5rem-1px)]',
  lg: 'left-[calc(4.25rem+0.625rem-1px)]',
};
/** Nudge the time baseline onto the dot's centre line, per dot size. */
const TL_TIME_PAD: Record<string, string> = { sm: 'pt-0', md: 'pt-px', lg: 'pt-0.5' };
/** Clamp a model count into lo..hi (props-less safe). */
function clampCount(v: unknown, dflt: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(Math.round(n), lo), hi);
}

/* ── Timeline ─────────────────────────────────────────────────────────────── */

type TimelineItemT = {
  title?: string;
  time?: string | null;
  description?: string | null;
  icon?: string | null;
  tone?: string | null;
  color?: string | null;
  active?: boolean | null;
};

const timelineDot = cva('z-[1] flex shrink-0 items-center justify-center rounded-full text-[var(--color-primary-foreground)] ring-4 ring-background', {
  variants: {
    size: {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    },
  },
  defaultVariants: { size: 'md' },
});
/* INHERITED FOREGROUND (`text-current`, not `text-foreground`). A timeline title
 * sits on whatever surface contains the timeline — the rail and dot paint, the
 * title does not. `text-foreground` was a hard RESET back to the global token:
 * a spec authoring `Card { bg:"#12161f", color:"#e2e6f0" }` had that colour
 * inherit down and then a title snap it to #18181b, contrast ratio 1.02 on dark
 * navy. The two are the same value at the top level (.frayme-root sets
 * `color: var(--frayme-fg)` and --color-foreground IS var(--frayme-fg)), so the
 * props-less default is byte-identical; only the authored-container case moves. */
const timelineTitle = cva('font-medium text-current', {
  variants: {
    size: { sm: 'text-[0.8125rem]', md: 'text-sm', lg: 'text-base' },
  },
  defaultVariants: { size: 'md' },
});

export function Timeline({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: TimelineItemT[] | null;
    orientation?: string | null;
    align?: string | null;
    size?: string | null;
    accent?: string | null;
    connectorColor?: string | null;
    mutedColor?: string | null;
    weight?: string | null;
    tracking?: string | null;
  };
  const items = Array.isArray(p.items)
    ? p.items.filter((it): it is TimelineItemT => it != null && typeof it === 'object')
    : [];
  const orientation = (p.orientation as 'vertical' | 'horizontal' | null) ?? 'vertical';
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  // `alternate` only applies in the vertical layout.
  const alternate = orientation === 'vertical' && p.align === 'alternate';
  const style = styleVars(
    { var: '--fr-timeline-accent', value: p.accent, kind: 'color' },
    { var: '--fr-timeline-line', value: p.connectorColor, kind: 'color' },
    { var: '--fr-timeline-muted', value: p.mutedColor, kind: 'color' },
  );
  // The connector rail: per-timeline `connectorColor` var, falling back to the border token.
  const rail = '[background:var(--fr-timeline-line,var(--color-border))]';

  /** One dot — its exact per-item `color`, else its tone color, else the timeline
   *  `accent` when set, else the neutral tone treatment (matching TimelineItem's
   *  own tone-less default — ONE family default, not an implicit primary). */
  const dot = (it: TimelineItemT): ReactNode => {
    const tk = toneKey(it.tone);
    const useItemColor = it.color != null;
    const iconName = typeof it.icon === 'string' && hasIcon(it.icon) ? it.icon : null;
    return (
      <span
        className={cn(
          timelineDot({ size }),
          useItemColor
            ? '[background:var(--fr-timeline-dot)]'
            : tk != null
              ? TONE_DOT[tk]
              : p.accent != null
                ? '[background:var(--fr-timeline-accent)]'
                : TONE_DOT.neutral,
          (it.active === true) && 'ring-2 [--tw-ring-color:var(--fr-timeline-accent,var(--fr-accent))]',
        )}
        style={useItemColor ? (styleVars({ var: '--fr-timeline-dot', value: it.color, kind: 'color' }) as CSSProperties) : undefined}
        aria-hidden
      >
        {iconName != null && size === 'lg' && <Icon name={iconName} size={12} />}
      </span>
    );
  };

  // Every item carries a time → the times earn their own aligned column (see
  // TL_V_X_TIME); a partial set stays inline so no row is left with a hole.
  const timeColumn =
    orientation === 'vertical' &&
    !alternate &&
    items.length > 1 &&
    items.every((it) => typeof it.time === 'string' && it.time.trim() !== '');

  const body = (it: TimelineItemT, alignEnd: boolean, timeHoisted = false): ReactNode => (
    <div className={cn('flex min-w-0 flex-col gap-0.5', alignEnd && 'items-end text-right')}>
      <div className="flex min-w-0 items-baseline gap-2">
        {/* The title wraps: the time chip beside it is shrink-0 so the title is
            the only item that gives, and the description below already wraps —
            the row has no fixed height to protect. A truncate here deleted the
            tail of every title the alternate/narrow layouts squeezed. No min-w-0
            on this LEAF: the shrink floor belongs on the two wrapper divs above
            it — here it lets break-words split the title one char per line. */}
        <span className={cn(timelineTitle({ size }), 'break-words', it.active === true && 'font-semibold', weightClass(p.weight), trackingClass(p.tracking))} title={it.title ?? undefined}>{it.title ?? ''}</span>
        {it.time != null && !timeHoisted && <span className="shrink-0 text-[0.75rem] [color:var(--fr-timeline-muted,var(--color-muted-foreground))]">{it.time}</span>}
      </div>
      {it.description != null && (
        <span className="text-[0.8125rem] leading-relaxed [color:var(--fr-timeline-muted,var(--color-muted-foreground))]">{it.description}</span>
      )}
    </div>
  );

  // Child `TimelineItem` ELEMENTS are the alternative to the `items` prop: each is
  // a self-contained row (own dot, own `last`-aware connector) and, crucially, each
  // honors its own `visible` binding — the ONLY way to express a conditionally
  // shown/hidden timeline (e.g. an "all steps / remaining only" filter), which the
  // static `items` array cannot. When present and `items` is empty, render the
  // runtime-provided children directly (already gated by their `visible` bindings).
  const childEls = Array.isArray(element.children) ? element.children : [];
  if (items.length === 0 && childEls.length > 0 && children != null) {
    return (
      <div className="flex w-full flex-col" style={style}>
        {children}
      </div>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <ol className="m-0 flex w-full list-none items-start gap-0 overflow-x-auto p-0" style={style}>
        {items.map((it, i) => (
          <li key={i} className="relative flex min-w-[8rem] flex-1 flex-col items-center gap-2 px-2">
            {i < items.length - 1 && (
              <span
                className={cn('absolute left-1/2', TL_H_RAIL[size] ?? TL_H_RAIL.md, 'h-0.5 w-full', rail)}
                aria-hidden
              />
            )}
            {dot(it)}
            <div className="flex flex-col items-center gap-0.5 text-center">{body(it, false)}</div>
          </li>
        ))}
      </ol>
    );
  }

  // Vertical
  return (
    <ol className="m-0 flex w-full list-none flex-col p-0" style={style}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const onRight = alternate && i % 2 === 1;
        if (alternate) {
          return (
            <li key={i} className="relative grid grid-cols-[1fr_auto_1fr] gap-3 pb-6 last:pb-0">
              {!last && (
                <span
                  className={cn('absolute bottom-0 left-1/2 w-0.5 -translate-x-1/2', TL_V_TOP[size] ?? TL_V_TOP.md, rail)}
                  aria-hidden
                />
              )}
              <div className="flex justify-end">{!onRight && body(it, true)}</div>
              <div className="relative flex flex-col items-center">{dot(it)}</div>
              <div className="flex justify-start">{onRight && body(it, false)}</div>
            </li>
          );
        }
        return (
          <li key={i} className="relative flex gap-3 pb-6 last:pb-0">
            {timeColumn && (
              // Times are the most scannable data in a schedule; inline after a
              // variable-length title they never form a column you can run your
              // eye down. When EVERY item carries a time, it
              // gets its own leading column — data-driven, no new prop.
              <span className={cn('w-14 shrink-0 pt-px text-right text-[0.75rem] tabular-nums', TL_TIME_PAD[size] ?? TL_TIME_PAD.md, '[color:var(--fr-timeline-muted,var(--color-muted-foreground))]')}>
                {it.time}
              </span>
            )}
            <div className="relative flex flex-col items-center">{dot(it)}</div>
            {!last && (
              <span
                className={cn('absolute bottom-0 w-0.5', TL_V_TOP[size] ?? TL_V_TOP.md, timeColumn ? TL_V_X_TIME[size] ?? TL_V_X_TIME.md : TL_V_X[size] ?? TL_V_X.md, rail)}
                aria-hidden
              />
            )}
            {/* min-w-0: a flex item's automatic minimum is its MIN-CONTENT, so
                this body refused to shrink and pushed the whole timeline out of
                the render surface (measured at 320px: 44.1px of overflow on one
                sample screen, 167.6px across 5 elements on another).
                TimelineItem below already carried it; this branch was missed. */}
            <div className="min-w-0 flex-1 pb-1 pt-px">{body(it, false, timeColumn)}</div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── TimelineItem (standalone) ────────────────────────────────────────────── */

export function TimelineItem({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    time?: string | null;
    description?: string | null;
    icon?: string | null;
    tone?: string | null;
    active?: boolean | null;
    last?: boolean | null;
    dotColor?: string | null;
    connectorColor?: string | null;
    mutedColor?: string | null;
    weight?: string | null;
    tracking?: string | null;
  };
  const tk = toneKey(p.tone);
  const iconName = typeof p.icon === 'string' && hasIcon(p.icon) ? p.icon : null;
  const last = p.last === true;
  const active = p.active === true;
  // A model `dotColor` overrides the tone; otherwise the tone token (or neutral).
  const useDotVar = p.dotColor != null;
  return (
    <div
      className="relative flex w-full gap-3"
      style={styleVars(
        { var: '--fr-timelineitem-dot', value: p.dotColor, kind: 'color' },
        { var: '--fr-timelineitem-line', value: p.connectorColor, kind: 'color' },
        { var: '--fr-timelineitem-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            'z-[1] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--color-primary-foreground)] ring-4 ring-background',
            useDotVar
              ? '[background:var(--fr-timelineitem-dot)]'
              : tk != null
                ? TONE_DOT[tk]
                : TONE_DOT.neutral,
            // The emphasis ring travels with a set dotColor (falls back to primary),
            // matching Timeline's accent-chained ring.
            active && 'ring-2 [--tw-ring-color:var(--fr-timelineitem-dot,var(--fr-accent))]',
          )}
          aria-hidden
        >
          {iconName != null && <Icon name={iconName} size={10} />}
        </span>
        {!last && (
          // connectorColor parity with Timeline: the rail reads the per-item line
          // var with the border token inside as fallback (sole background source).
          <span className="absolute top-4 h-[calc(100%-0.5rem)] w-0.5 [background:var(--fr-timelineitem-line,var(--color-border))]" aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-6">
        <div className="flex min-w-0 items-baseline gap-2">
          {/* Wraps, for the same reason as Timeline's own title row: the time is
              shrink-0, the description below wraps, no fixed row height. And no
              min-w-0, for the same reason too: the LEAF keeps its min-content
              floor so break-words can't split the title one char per line. */}
          {/* `text-current`, matching timelineTitle: the item title inherits the
              container's ink instead of resetting to the global token. */}
          <span className={cn('break-words text-sm text-current', active ? 'font-semibold' : 'font-medium', weightClass(p.weight), trackingClass(p.tracking))} title={p.title ?? undefined}>{p.title ?? ''}</span>
          {p.time != null && <span className="shrink-0 text-[0.75rem] [color:var(--fr-timelineitem-muted,var(--color-muted-foreground))]">{p.time}</span>}
        </div>
        {p.description != null && (
          <span className="text-[0.8125rem] leading-relaxed [color:var(--fr-timelineitem-muted,var(--color-muted-foreground))]">{p.description}</span>
        )}
        {children != null && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
}

/* ── Stepper ──────────────────────────────────────────────────────────────── */

type StepT = { label?: string; title?: string; description?: string | null; icon?: string | null; tone?: string | null };
// A step's caption reads `label`, but the model sometimes emits `title` (the
// PageHeader/Card naming) — read both so the step label never renders empty.
const stepLabel = (st: StepT): string => st.label ?? st.title ?? '';

const STEP_MARKER: Record<string, string> = { sm: 'h-6 w-6 text-[0.75rem]', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' };
const STEP_LABEL: Record<string, string> = { sm: 'text-[0.8125rem]', md: 'text-sm', lg: 'text-base' };

// Per-step `tone` (validation status) OVERRIDES the state-driven marker look with
// a filled semantic circle. Only the four non-default tones are honoured — the
// implicit un-toned step keeps its done/current/future chrome (byte-identical).
const STEP_TONE_MARKER: Record<string, string> = {
  // Tinted like `critical` below — a step marker states
  // status, it does not need to shout it; `border-2` keeps every marker the same
  // footprint so the disc does not jump size between steps.
  success: 'border-2 border-[color:var(--color-success)] [background:color-mix(in_srgb,var(--color-success)_12%,transparent)] [color:var(--color-success)]',
  warning: 'border-2 border-[color:var(--color-warning)] [background:color-mix(in_srgb,var(--color-warning)_12%,transparent)] [color:var(--color-warning)]',
  // A failed step used to be an h-8 solid red disc — the loudest thing
  // in a wizard. It now reads as the same tinted surface + red ring + red glyph the
  // Button `danger` variant uses; `border-2` matches the current/future markers so the
  // circle keeps its exact footprint instead of jumping size at the failed step. The
  // small TONE_DOT markers at the top of this file stay solid — they're 12px
  // indicators, not surfaces, and a tint would make them invisible.
  critical: 'border-2 border-[color:var(--color-danger)] [background:color-mix(in_srgb,var(--color-danger)_12%,transparent)] [color:var(--color-danger)]',
  info: 'border-2 border-[color:var(--color-info)] [background:color-mix(in_srgb,var(--color-info)_12%,transparent)] [color:var(--color-info)]',
};
// Default status glyph per tone (a step can still override via its own `icon`).
const STEP_TONE_GLYPH: Record<string, string> = {
  success: 'check',
  warning: 'alert-triangle',
  critical: 'x',
  info: 'info',
};
function stepToneKey(t: unknown): string | null {
  return typeof t === 'string' && t in STEP_TONE_MARKER ? t : null;
}

export function Stepper({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    steps?: StepT[] | null;
    current?: number | null;
    orientation?: string | null;
    clickable?: boolean | null;
    size?: string | null;
    accent?: string | null;
    connectorColor?: string | null;
    mutedColor?: string | null;
    weight?: string | null;
  };
  const steps = Array.isArray(p.steps)
    ? p.steps.filter((s): s is StepT => s != null && typeof s === 'object')
    : [];
  const orientation = (p.orientation as 'horizontal' | 'vertical' | null) ?? 'horizontal';
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const clickable = p.clickable === true;
  const markerSize = STEP_MARKER[size] ?? STEP_MARKER.md;
  const labelSize = STEP_LABEL[size] ?? STEP_LABEL.md;

  // INTERACTIVE: `current` is live unbound (local state) and two-way when bound.
  const start = clampCount(p.current, 0, 0, Math.max(steps.length - 1, 0));
  const [current, setCurrent] = useBoundProp<number>(start, bindings?.current);
  // Clamp at the READ site too — a bound `current` (raw store value) could be
  // out of range, which would silently drop the active-step highlight.
  const cur = clampCount(current, 0, 0, Math.max(steps.length - 1, 0));
  const emitWith = useIntrinsicEmit(emit, element);

  const select = (i: number): void => {
    if (!clickable) return;
    setCurrent(i);
    emitWith('change', { index: i, label: steps[i]?.label ?? null });
  };

  const style = styleVars(
    { var: '--fr-stepper-accent', value: p.accent, kind: 'color' },
    accentTextVar('--fr-stepper-accent-text', p.accent, undefined),
    { var: '--fr-stepper-line', value: p.connectorColor, kind: 'color' },
    { var: '--fr-stepper-muted', value: p.mutedColor, kind: 'color' },
  );
  const vertical = orientation === 'vertical';
  // The INCOMPLETE connector segment: per-stepper `connectorColor`, else border. The completed segment stays `accent`.
  const incompleteRail = '[background:var(--fr-stepper-line,var(--color-border))]';

  /** A step marker: check when completed, icon/number otherwise. State-driven look.
   *  A per-step `tone` (validation status) OVERRIDES the state look with a filled
   *  semantic circle + a status glyph (own `icon` still wins). Un-toned → the exact
   *  prior state chrome (byte-identical). */
  const marker = (st: StepT, i: number, done: boolean, isCur: boolean): ReactNode => {
    const iconName = typeof st.icon === 'string' && hasIcon(st.icon) ? st.icon : null;
    const tk = stepToneKey(st.tone);
    const glyphSize = size === 'sm' ? 14 : 16;
    // Toned steps show the step's own icon if it set one, else the tone's default glyph.
    const toneGlyph = tk != null ? iconName ?? STEP_TONE_GLYPH[tk] : null;
    return (
      <span
        className={cn(
          'z-[1] inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-4 ring-background transition-colors',
          markerSize,
          tk != null
            ? STEP_TONE_MARKER[tk]
            : done
              ? // quiet defaults: a completed step disc is neutral high-contrast
                // (foreground/card), not a brand circle; the current step and the
                // completed rail follow suit. A supplied `accent` still brands all three.
                // These two branches KEEP the --color-foreground token while the step
                // LABEL below moved to inherited ink: each disc paints its own fill
                // (foreground here, bg-background on the current step), so its glyph is
                // text on its OWN surface. Swapping in currentColor would let a dark
                // card's light ink land on the light disc it paints — a regression, not
                // a fix. Only unpainted text follows the container.
                '[background:var(--fr-stepper-accent,var(--fr-accent))] text-[color:var(--fr-stepper-accent-text,var(--fr-accent-ink,var(--color-card)))]'
              : isCur
                ? 'border-2 [border-color:var(--fr-stepper-accent,var(--color-foreground))] bg-background [color:var(--fr-stepper-accent,var(--color-foreground))]'
                // 'incomplete progress chrome' coherence group: the un-reached marker
                // ring reads the SAME line var as the incomplete rail (border fallback).
                : 'border-2 border-[color:var(--fr-stepper-line,var(--color-border))] bg-background text-muted-foreground',
        )}
        aria-hidden
      >
        {tk != null ? (
          <Icon name={toneGlyph!} size={glyphSize} />
        ) : done ? (
          <Icon name="check" size={glyphSize} />
        ) : iconName != null ? (
          <Icon name={iconName} size={glyphSize} />
        ) : (
          i + 1
        )}
      </span>
    );
  };

  const labelBlock = (st: StepT, isCur: boolean, alignCenter: boolean): ReactNode => (
    <div className={cn('flex min-w-0 flex-col gap-0.5', alignCenter && 'items-center text-center')}>
      {/* future/past labels join the muted channel (group form, token fallback).
          A horizontal stepper gives each step `flex-1 basis-[6rem] min-w-0`, so
          four steps at 320px leave ~72px apiece — a truncate there deleted the
          label of every step but the shortest. The label wraps (the connector
          rail is absolutely positioned off the MARKER, so a taller label block
          cannot move it), and the caption takes a DECLARED two-line budget
          instead of a silent one-line cut. The min-w-0 that lets a step give way
          lives on the `li` and on this block — NOT on the two LEAF spans, whose
          own min-content (their longest word) is the floor break-words needs. */}
      {/* The CURRENT step's label is `text-current`, not `text-foreground`: the
          label block paints nothing (only the marker disc does), so it must carry
          the container's ink through rather than reset to the global token — same
          1.02-ratio class as timelineTitle. Identical computed default. */}
      <span className={cn(labelSize, 'break-words font-medium', isCur ? 'text-current' : 'text-[color:var(--fr-stepper-muted,var(--color-muted-foreground))]', weightClass(p.weight))} title={stepLabel(st) || undefined}>{stepLabel(st)}</span>
      {st.description != null && <span className="line-clamp-2 break-words text-[0.75rem] [color:var(--fr-stepper-muted,var(--color-muted-foreground))]" title={st.description}>{st.description}</span>}
    </div>
  );

  if (vertical) {
    return (
      <ol className="m-0 flex list-none flex-col p-0" style={style} aria-label="Progress">
        {steps.map((st, i) => {
          const done = i < cur;
          const isCur = i === cur;
          const last = i === steps.length - 1;
          const inner = (
            <>
              <div className="relative flex flex-col items-center self-stretch">
                {marker(st, i, done, isCur)}
                {!last && (
                  <span
                    className={cn(
                      'absolute top-[var(--fr-step-line-top)] h-[calc(100%-var(--fr-step-line-top))] w-0.5',
                      done ? '[background:var(--fr-stepper-accent,var(--fr-accent))]' : incompleteRail,
                    )}
                    style={{ '--fr-step-line-top': size === 'sm' ? '1.5rem' : size === 'lg' ? '2.5rem' : '2rem' } as CSSProperties}
                    aria-hidden
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-6 pt-1">{labelBlock(st, isCur, false)}</div>
            </>
          );
          const liCls = 'flex gap-3 last:pb-0';
          return (
            <li key={i} className={liCls} aria-current={isCur ? 'step' : undefined}>
              {clickable ? (
                <button
                  type="button"
                  className="flex w-full cursor-pointer gap-3 border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
                  onClick={() => select(i)}
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  // Horizontal
  return (
    <ol className="m-0 flex w-full list-none items-start p-0" style={style} aria-label="Progress">
      {steps.map((st, i) => {
        const done = i < cur;
        const isCur = i === cur;
        const last = i === steps.length - 1;
        const content = (
          <>
            {marker(st, i, done, isCur)}
            <div className="mt-2 w-full min-w-0">{labelBlock(st, isCur, true)}</div>
          </>
        );
        return (
          <li
            key={i}
            className="relative flex min-w-0 flex-1 basis-[6rem] flex-col items-center px-1"
            aria-current={isCur ? 'step' : undefined}
          >
            {!last && (
              // The rail spans circle-EDGE to circle-EDGE (offset by the marker
              // radius `--fr-step-half`), never UNDER the markers — so it can't
              // show through them. The old `left-1/2 w-full` ran center-to-center
              // and relied on `ring/bg-background` to mask it, but `--color-background`
              // is `transparent` in the Frayme theme (components inherit their
              // surface), so the mask was a no-op and the connector bled through
              // the current/future step numeral. Vertically centered on the marker.
              <span
                className={cn(
                  'absolute h-0.5',
                  done ? '[background:var(--fr-stepper-accent,var(--fr-accent))]' : incompleteRail,
                )}
                style={{
                  '--fr-step-half': size === 'sm' ? '0.75rem' : size === 'lg' ? '1.25rem' : '1rem',
                  top: 'calc(var(--fr-step-half) - 1px)',
                  left: 'calc(50% + var(--fr-step-half))',
                  width: 'calc(100% - 2 * var(--fr-step-half))',
                } as CSSProperties}
                aria-hidden
              />
            )}
            {clickable ? (
              <button
                type="button"
                className="z-[1] flex w-full min-w-0 cursor-pointer flex-col items-center border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
                onClick={() => select(i)}
              >
                {content}
              </button>
            ) : (
              <div className="z-[1] flex w-full min-w-0 flex-col items-center">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Tree ─────────────────────────────────────────────────────────────────── */

type TreeNodeT = {
  label?: string;
  icon?: string | null;
  value?: string | null;
  children?: TreeNodeT[] | null;
};

// Row density: the `size` enum controls the vertical padding + text size of every
// tree row. md keeps the EXACT prior `py-1 text-sm` (byte-identical when unset).
const TREE_ROW: Record<string, string> = {
  sm: 'py-0.5 text-[0.8125rem]',
  md: 'py-1 text-sm',
  lg: 'py-1.5 text-base',
};

/** The children of a node that this tree actually renders: the same depth cap +
 *  array guard applied at every level, so the row order and the rendered rows
 *  can never disagree. */
function visibleChildren(node: TreeNodeT, depth: number, maxDepth: number): TreeNodeT[] {
  return depth < maxDepth && Array.isArray(node.children)
    ? node.children.filter((c): c is TreeNodeT => c != null && typeof c === 'object')
    : [];
}

/** The flattened, collapse-aware row order the arrow keys walk. A row cannot
 *  know which row follows it — that depends on whether its siblings are open —
 *  so the order is computed once at the root and read by every row. */
function collectTreeRows(
  nodes: TreeNodeT[],
  depth: number,
  prefix: string,
  maxDepth: number,
  expanded: Set<string>,
  out: string[],
): void {
  nodes.forEach((node, i) => {
    const path = `${prefix}${i}`;
    out.push(path);
    const children = visibleChildren(node, depth, maxDepth);
    if (children.length > 0 && expanded.has(path)) {
      collectTreeRows(children, depth + 1, `${path}.`, maxDepth, expanded, out);
    }
  });
}

/** Everything a row needs from the tree that owns it. Navigation is cross-node
 *  (the next row is a sibling's child, or an ancestor's sibling), so it lives at
 *  the root; a row only reports which path raised the event. */
type TreeNav = {
  /** The single tab stop. A tree is ONE stop; the arrow keys move inside it. */
  roving: string;
  /** DOM id for a branch row's own child `<ul role="group">` — the thing its
   *  aria-expanded opens, named through aria-controls WHILE OPEN (a collapsed
   *  branch renders no group, so it names nothing; see TreeNodeView). Built from
   *  the row's path (the same stable key the expand Set is keyed on) THROUGH
   *  `useAriaId`. This comment used to claim the id deliberately avoided `useId`
   *  because positional ids diverge under a host's SSR — the code stopped being
   *  true when `repeat` was measured putting the identical group id on every
   *  row (test/aria-repeat-ids.test.tsx); trigger and panel are rendered by the
   *  same component from the same value, so a divergence moves both at once. */
  groupId: (path: string) => string;
  register: (path: string, el: HTMLLIElement | null) => void;
  setActive: (path: string) => void;
  onRowKeyDown: (
    path: string,
    hasChildren: boolean,
    isOpen: boolean,
  ) => (e: ReactKeyboardEvent<HTMLLIElement>) => void;
};

/** One recursive tree node. Depth is hard-capped by the caller via maxDepth;
 *  every level array-guards `children`. Expand state lives in the shared Set
 *  (keyed by a stable path); selection flows through the caller's setter. */
function TreeNodeView({
  node,
  depth,
  path,
  maxDepth,
  rowClass,
  expanded,
  toggle,
  selectable,
  selectedValue,
  onSelect,
  nav,
}: {
  node: TreeNodeT;
  depth: number;
  path: string;
  maxDepth: number;
  // The density class for this size (py + text), threaded from the Tree root.
  rowClass: string;
  expanded: Set<string>;
  toggle: (key: string) => void;
  selectable: boolean;
  selectedValue: string | undefined;
  onSelect: (value: string) => void;
  nav: TreeNav;
}): ReactNode {
  const children = visibleChildren(node, depth, maxDepth);
  const hasChildren = children.length > 0;
  const isOpen = expanded.has(path);
  const iconName = typeof node.icon === 'string' && hasIcon(node.icon) ? node.icon : null;
  const value = typeof node.value === 'string' ? node.value : null;
  // Fallback identity so valueless nodes are still selectable: value → label → path.
  const v = value ?? node.label ?? path;
  const isSelected = selectable && v === selectedValue;

  const onRowClick = (): void => {
    if (hasChildren) toggle(path);
    if (selectable) onSelect(v);
  };

  return (
    // The <li> IS the focusable treeitem (not a wrapped button) — WAI tree pattern.
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      // Names the child group the row opens, gated on `hasChildren && isOpen` —
      // i.e. exactly when the <ul role="group"> below is actually rendered.
      // `hasChildren` alone was the shipped gate, on the reasoning that a
      // collapsed branch is dangling-but-legal because aria-expanded=false
      // already says there is nothing to reach — but a file tree is
      // COLLAPSED by default (defaultExpandedDepth defaults to 0), so that is
      // its resting state, not an edge case. aria-controls is only RECOMMENDED
      // for the disclosure pattern — dropping it while collapsed costs a reader
      // nothing, following an IDREF to no element strands them. A LEAF still
      // carries neither attribute: it opens nothing, ever.
      aria-controls={hasChildren && isOpen ? nav.groupId(path) : undefined}
      aria-selected={selectable ? isSelected : undefined}
      // Depth is 1-based in ARIA, and a treeitem's own <li> nesting is not a
      // level a reader can count once a subtree is collapsed.
      aria-level={depth + 1}
      // Roving tabindex: the whole tree is ONE tab stop; the arrow keys move
      // between the VISIBLE rows.
      tabIndex={nav.roving === path ? 0 : -1}
      ref={(el) => nav.register(path, el)}
      className={cn(
        'm-0 rounded-frayme outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]',
        // A selected row's accent falls back to the INHERITED ink, not the global
        // --color-foreground token: the row paints only a 14% transparent wash, so
        // the surface underneath it is the container's, and a hard reset put
        // near-black on an authored dark Card. `treeAccent` still wins, and the
        // unset default computes to the same colour it always did.
        isSelected && 'font-medium [color:var(--fr-tree-accent,currentColor)]',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onRowClick();
      }}
      onFocus={(e: ReactFocusEvent<HTMLLIElement>) => {
        // A treeitem WRAPS its descendants and focus bubbles, so an ancestor row
        // would otherwise claim the tab stop of every row beneath it.
        if (e.target === e.currentTarget) nav.setActive(path);
      }}
      onKeyDown={(e: ReactKeyboardEvent<HTMLLIElement>) => {
        // Same nesting: each row answers only for the keys raised on ITSELF.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onRowClick();
          return;
        }
        nav.onRowKeyDown(path, hasChildren, isOpen)(e);
      }}
    >
      <div
        // Selected row: the catalog's established accent row fill (SidebarItem's
        // 14% color-mix) alongside the accent text — accent stays the single channel.
        // Row density (py + text) comes from the size-driven rowClass (md = the
        // exact prior py-1 text-sm → byte-identical when size is unset).
        // The UNSELECTED row is `text-current` too now (it was `text-foreground`):
        // a tree row paints nothing until it is selected, so resetting to the global
        // token stranded every row at near-black inside an authored dark Card. The
        // selection WASH keeps the token inside its color-mix on purpose — that is a
        // background, and its 14% of the container's own ink would wash out against
        // the surface it is mixed over, where 14% of the token still reads as a band.
        className={cn('flex w-full cursor-pointer items-center gap-1.5 rounded-frayme pr-2 text-left transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', rowClass, isSelected ? 'text-current [background:color-mix(in_srgb,var(--fr-tree-accent,var(--fr-accent))_14%,transparent)]' : 'text-current')}
        style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[color:var(--fr-tree-line,var(--color-muted-foreground))]" aria-hidden>
          {hasChildren ? <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={16} /> : null}
        </span>
        {iconName != null && (
          // Node glyph joins the chevron in the 'tree furniture' group: same
          // lineColor var, same muted-foreground fallback (unset is identical).
          <span className={cn('shrink-0', isSelected ? 'text-current' : 'text-[color:var(--fr-tree-line,var(--color-muted-foreground))]')} aria-hidden>
            <Icon name={iconName} size={15} />
          </span>
        )}
        {/* Chevron + node glyph are shrink-0, the row height is the size enum's
            padding (not a fixed track), and a tree label is often the longest
            string on screen (paths, file names) — it wraps under its own
            indent rather than losing its tail. No min-w-0 on this LEAF: a path
            segment is exactly the long unbroken word that break-words would
            shatter one character per line once the min-content floor is gone. */}
        <span className="break-words" title={node.label ?? undefined}>{node.label ?? ''}</span>
      </div>
      {hasChildren && isOpen && (
        <ul id={nav.groupId(path)} role="group" className="m-0 list-none p-0">
          {children.map((child, i) => (
            <TreeNodeView
              key={i}
              node={child}
              depth={depth + 1}
              path={`${path}.${i}`}
              maxDepth={maxDepth}
              rowClass={rowClass}
              expanded={expanded}
              toggle={toggle}
              selectable={selectable}
              selectedValue={selectedValue}
              onSelect={onSelect}
              nav={nav}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Seed the initially-expanded key set: every branch path whose depth is below
 *  `defaultExpandedDepth` (and within `maxDepth`). Pure, runs once in the lazy
 *  `useState` initializer. */
function seedExpanded(nodes: TreeNodeT[], maxDepth: number, expandTo: number): Set<string> {
  const out = new Set<string>();
  const walk = (list: TreeNodeT[], depth: number, prefix: string): void => {
    if (depth >= maxDepth) return;
    list.forEach((node, i) => {
      const path = `${prefix}${i}`;
      const children = Array.isArray(node.children)
        ? node.children.filter((c): c is TreeNodeT => c != null && typeof c === 'object')
        : [];
      if (children.length > 0) {
        if (depth < expandTo) out.add(path);
        walk(children, depth + 1, `${path}.`);
      }
    });
  };
  walk(nodes, 0, '');
  return out;
}

export function Tree({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  // Instance-unique so two rows of a `repeat` cannot name the same group.
  const treeAriaId = useAriaId('tree', element);
  const p = (element.props ?? {}) as {
    nodes?: TreeNodeT[] | null;
    maxDepth?: number | null;
    defaultExpandedDepth?: number | null;
    selectable?: boolean | null;
    emptyText?: string | null;
    size?: string | null;
    accent?: string | null;
    lineColor?: string | null;
    value?: string | null;
    expandedPaths?: string[] | null;
  };
  const nodes = Array.isArray(p.nodes)
    ? p.nodes.filter((n): n is TreeNodeT => n != null && typeof n === 'object')
    : [];
  const maxDepth = clampCount(p.maxDepth, 6, 1, 8);
  const expandTo = clampCount(p.defaultExpandedDepth, 0, 0, 8);
  const selectable = p.selectable === true;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const rowClass = TREE_ROW[size] ?? TREE_ROW.md;

  // Expand state — two-way when bound (spec.state holds the open paths), local
  // otherwise. Backed by an ARRAY (mirror in/out) with a derived Set for reads,
  // so an external control can read/restore the open/collapsed tree.
  const [expandedPaths, setExpandedPaths] = useBoundProp<string[]>(
    Array.isArray(p.expandedPaths) ? p.expandedPaths : Array.from(seedExpanded(nodes, maxDepth, expandTo)),
    bindings?.expandedPaths,
  );
  const expanded = new Set<string>(Array.isArray(expandedPaths) ? expandedPaths : []);

  // Selection: two-way when bound, local otherwise — live either way.
  const [selectedValue, setSelectedValue] = useBoundProp<string>(
    typeof p.value === 'string' ? p.value : undefined,
    bindings?.value,
  );
  const emitWith = useIntrinsicEmit(emit, element);
  const toggle = (key: string): void => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Write the FULL resolved path set, and ALSO mirror it (plus the current
    // selected value) into spec.state/_ui via the intrinsic emit so the
    // expand/collapse is captured for the agent even when nothing is bound.
    const resolved = Array.from(next);
    emitWith('change', { expandedPaths: resolved, value: selectedValue ?? null });
    setExpandedPaths(resolved);
  };
  const onSelect = (value: string): void => {
    setSelectedValue(value);
    emitWith('select', { value });
  };

  // Keyboard navigation walks the VISIBLE rows in tree order — a collapsed
  // subtree is not reachable by ArrowDown, exactly as it is not reachable by eye.
  const rows: string[] = [];
  collectTreeRows(nodes, 0, '', maxDepth, expanded, rows);
  const [activePath, setActivePath] = useState<string>('');
  // A row that collapsed out from under the active path leaves the tree with no
  // tab stop, so the roving stop falls back to the first visible row.
  const rovingPath = rows.includes(activePath) ? activePath : (rows[0] ?? '');
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const goTo = (path: string | undefined): void => {
    if (path == null) return;
    setActivePath(path);
    rowRefs.current.get(path)?.focus();
  };
  const onRowKeyDown =
    (path: string, hasChildren: boolean, isOpen: boolean) =>
    (e: ReactKeyboardEvent<HTMLLIElement>): void => {
      const i = rows.indexOf(path);
      if (i < 0) return;
      // A key the tree consumes must stop BOTH its default action and the walk up
      // to the embedding host's own shortcuts (and Home/End scroll the host
      // document) — one ArrowDown is one intent, not two.
      const consume = (): void => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'ArrowRight') {
        if (!hasChildren) return;
        consume();
        if (!isOpen) toggle(path);
        else goTo(rows[i + 1]);
        return;
      }
      if (e.key === 'ArrowLeft') {
        if (hasChildren && isOpen) {
          consume();
          toggle(path);
          return;
        }
        // Already collapsed (or a leaf): step out to the parent row. A root row
        // has no parent path, so the key is left to the host.
        const cut = path.lastIndexOf('.');
        if (cut < 0) return;
        consume();
        goTo(path.slice(0, cut));
        return;
      }
      const to =
        e.key === 'ArrowDown' ? rows[i + 1]
        : e.key === 'ArrowUp' ? rows[i - 1]
        : e.key === 'Home' ? rows[0]
        : e.key === 'End' ? rows[rows.length - 1]
        : undefined;
      if (to == null) return;
      consume();
      goTo(to);
    };
  const nav: TreeNav = {
    roving: rovingPath,
    // The row path ('0', '0.2', '0.2.1') is unique per node within this tree, and
    // useAriaId adds the per-INSTANCE part: json-render's `repeat` re-renders an
    // element's children once per row reusing one spec id, so path + spec id alone
    // put a duplicate group id in the document and pointed row two's treeitem at
    // row one's group (reproduced in test/aria-repeat-ids.test.tsx — the earlier
    // citation here named test/zz-repeat-id.test.tsx, a working title that never
    // landed, so the pointer resolved to nothing).
    groupId: (path) => treeAriaId('g', path),
    register: (path, el) => {
      if (el) rowRefs.current.set(path, el);
      else rowRefs.current.delete(path);
    },
    setActive: setActivePath,
    onRowKeyDown,
  };

  if (nodes.length === 0) {
    return (
      <div className="px-2 py-3 text-sm text-muted-foreground" role="status">
        {p.emptyText ?? 'No items'}
      </div>
    );
  }

  return (
    <ul
      role="tree"
      // A landmark-like role with no name is announced as an unlabelled tree.
      // The catalog declares no title/label prop for Tree, so the name is a
      // fixed default rather than a value a spec can leave blank.
      aria-label="Tree"
      className="m-0 flex w-full list-none flex-col p-0"
      style={styleVars(
        { var: '--fr-tree-accent', value: p.accent, kind: 'color' },
        { var: '--fr-tree-line', value: p.lineColor, kind: 'color' },
      )}
    >
      {nodes.map((node, i) => (
        <TreeNodeView
          key={i}
          node={node}
          depth={0}
          path={String(i)}
          maxDepth={maxDepth}
          rowClass={rowClass}
          expanded={expanded}
          toggle={toggle}
          selectable={selectable}
          selectedValue={selectedValue}
          onSelect={onSelect}
          nav={nav}
        />
      ))}
    </ul>
  );
}
