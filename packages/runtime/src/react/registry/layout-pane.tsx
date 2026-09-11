'use client';
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { fontClass, leadingClass, styleVars, surfaceField, surfaceInk, surfaceMuted, surfaceRaised, surfaceSunken, trackingClass, weightClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';

/* Catalog group (layout-pane): SplitPane, Resizable, VirtualList,
 * DescriptionList.
 *
 * Same truly-dynamic contract as the shipped catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a model-named dimension) NEVER become classes — they land in
 *     `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, <token>)` utilities with a fallback. The class set
 *     stays a closed build-time set (no JIT, no injection); only the var VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the fallback wins (props-less → polished).
 *
 * INTERACTION is hand-rolled, ZERO new deps, and live WITHOUT a binding:
 *   - SplitPane / Resizable DRAG → plain pointer events. The divider/handle has
 *     onPointerDown → setPointerCapture → onPointerMove updates a clamped useState
 *     (% for SplitPane, px for Resizable) → onPointerUp releases. SSR-safe: the
 *     window / getBoundingClientRect is touched ONLY inside the handler. Arrow
 *     keys nudge the SplitPane split.
 *   - VirtualList WINDOWING → onScroll → setScrollTop(useState) → render ONLY the
 *     visible slice with a top spacer (start*itemHeight) and a bottom spacer so
 *     the scrollbar stays correct. If itemHeight is absent, every row renders.
 *
 * Numbers are Number.isFinite-guarded; every array is Array.isArray-guarded;
 * every enum defaults via CVA / a guarded fallback. Icons resolve against the
 * closed registry (guarded by hasIcon; unknown/null → nothing). Text bodies are
 * plain auto-escaped React children — never markup. */

/* ── shared number helpers ────────────────────────────────────────────────── */

/** Clamp a finite number into [lo, hi]; fall back to `dflt` when not finite. */
function clampNum(v: unknown, dflt: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(n, lo), hi);
}

/* ── SplitPane ────────────────────────────────────────────────────────────── */

/* `--fr-splitpane-fg` KEEPS its --color-foreground fallback while DescriptionList's
 * moved to currentColor. A SplitPane paints its own surface: `bordered` defaults
 * TRUE and lays down `[background:var(--fr-splitpane-bg,var(--color-card))]`, and
 * Card's authored `bg` sets --fr-card-bg, never --color-card — so inside a dark
 * authored Card this pane is still a LIGHT card, and inheriting that card's light
 * ink would put white text on it. Same for Resizable and VirtualList below. The
 * rule is the surface, not the component: text that paints keeps the token, text
 * that inherits its surface follows the container. */
const splitWrap = cva('flex w-full overflow-hidden text-[color:var(--fr-splitpane-fg,var(--fr-surface-fg,var(--color-foreground)))] [height:var(--fr-splitpane-h,24rem)]', {
  variants: {
    orientation: { horizontal: 'flex-row', vertical: 'flex-col' },
    bordered: {
      // radiusValue var-chain on the bordered container — no radius enum, so the
      // token-fallback IS the byte-identical default (was a bare rounded-frayme); an
      // exact radiusValue (--fr-splitpane-radius) wins. NOT co-located with rounded-*.
      true: 'border [border-radius:var(--fr-splitpane-radius,var(--radius-frayme))] [border-color:var(--fr-splitpane-border,var(--color-border))] [background:var(--fr-splitpane-bg,var(--color-card))]',
      false: '',
    },
  },
  defaultVariants: { orientation: 'horizontal', bordered: true },
});

export function SplitPane({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    orientation?: string | null;
    splitPercent?: number | null;
    minSize?: number | null;
    height?: string | number | null;
    bordered?: boolean | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    radiusValue?: string | number | null;
  };
  const orientation = (p.orientation as 'horizontal' | 'vertical' | null) ?? 'horizontal';
  const bordered = p.bordered !== false;
  const minSize = clampNum(p.minSize, 10, 0, 45);
  const initial = clampNum(p.splitPercent, 50, minSize, 100 - minSize);

  // Two-way when bound, internal otherwise — the split stays live unbound.
  const [splitRaw, setSplit] = useBoundProp<number>(initial, bindings?.splitPercent);
  const split = clampNum(splitRaw, initial, minSize, 100 - minSize);
  const emitWith = useIntrinsicEmit(emit, element);

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Live split % during a drag — null when no drag occurred; emitted ONCE at pointer-up.
  const dragPctRef = useRef<number | null>(null);
  const isHorizontal = orientation === 'horizontal';

  // Compute the new split % from a pointer event, against the live container box.
  // window/getBoundingClientRect are touched ONLY here (inside the handler) → SSR-safe.
  const updateFromPointer = (clientX: number, clientY: number): void => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const span = isHorizontal ? rect.width : rect.height;
    if (span <= 0) return;
    const offset = isHorizontal ? clientX - rect.left : clientY - rect.top;
    const pct = (offset / span) * 100;
    const next = clampNum(pct, split, minSize, 100 - minSize);
    setSplit(next);
    dragPctRef.current = next;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.buttons === 0) return; // only while dragging (button held)
    updateFromPointer(e.clientX, e.clientY);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // Emit ONCE per drag (not per pointermove) — only when a drag actually moved the split.
    const pct = dragPctRef.current;
    dragPctRef.current = null;
    if (pct != null) emitWith('move', { splitPercent: Math.round(pct * 10) / 10 });
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const dec = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
    const inc = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    if (e.key === dec || e.key === inc) {
      e.preventDefault();
      const delta = e.key === inc ? 2 : -2;
      const next = clampNum(split + delta, split, minSize, 100 - minSize);
      setSplit(next);
      emitWith('move', { splitPercent: next });
    }
  };

  // EXACTLY two panes — extra children are ignored, a single child fills pane one.
  const kids = Array.isArray(children) ? children : children != null ? [children] : [];
  const first = kids[0] ?? null;
  const second = kids[1] ?? null;

  const firstStyle: CSSProperties = isHorizontal
    ? { flex: `0 0 ${split}%`, minWidth: 0 }
    : { flex: `0 0 ${split}%`, minHeight: 0 };
  const secondStyle: CSSProperties = isHorizontal
    ? { flex: `1 1 0%`, minWidth: 0 }
    : { flex: `1 1 0%`, minHeight: 0 };

  return (
    <div
      ref={containerRef}
      // fr-splitpane: a split needs room to BE a split. At 320px, two 208px
      // panes gave one side 58px and everything inside it collapsed. frayme.css
      // stacks it on a narrow container, the same doctrine as every other fixed
      // layout.
      className={cn('fr-splitpane', splitWrap({ orientation, bordered }), p.bg != null && '[background:var(--fr-splitpane-bg)]',
        // A bordered SplitPane paints var(--fr-splitpane-bg,var(--color-card)) and
        // `bordered` defaults true, so with no authored bg the channel is RESET to the
        // token actually painted — otherwise a plain SplitPane inside a dark Card is a
        // white pane carrying that Card's navy, and a DataTable in it paints a DARK
        // actions column onto WHITE. Byte-identical: this is what the unpublished
        // chain already resolved to.
        bordered && p.bg == null && '[--fr-surface:var(--color-card)] [--fr-surface-fg:var(--color-foreground)] [--fr-surface-muted:var(--color-muted-foreground)] [--fr-surface-sunken:var(--color-muted)] [--fr-surface-raised:var(--color-card)] [--fr-surface-field:var(--color-card)]')}
      style={styleVars(
        { var: '--fr-splitpane-h', value: p.height, kind: 'dim', opts: { units: ['px', 'rem', 'vh', '%'], max: 2000 } },
        { var: '--fr-splitpane-bg', value: p.bg, kind: 'color' },
                // Publish the shared surface channel too — see Card/Stack/Grid. A descendant
        // compositing over "whatever is behind me" (the DataTable actions column) needs
        // the NEAREST painter, which only one shared name can give it.
        // --fr-surface alone is not enough: 61 components accept `bg` and NONE
        // derives ink from it, and 25 of them expose no `color` prop at all. The
        // paired ink is published here so the whole subtree inherits it — see
        // surfaceStyle in _style.ts.
        { var: '--fr-surface', value: p.bg, kind: 'color' },
        { var: '--fr-surface-fg', value: surfaceInk(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-muted', value: surfaceMuted(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-field', value: surfaceField(p.bg) as string, kind: 'raw' },
      { var: '--fr-surface-sunken', value: surfaceSunken(p.bg) as string, kind: 'raw' },
      { var: '--fr-surface-raised', value: surfaceRaised(p.bg) as string, kind: 'raw' },
        { var: '--fr-splitpane-fg', value: p.color, kind: 'color' },
        { var: '--fr-splitpane-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-splitpane-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      <div className="overflow-auto" style={firstStyle}>
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(split)}
        aria-valuemin={Math.round(minSize)}
        aria-valuemax={Math.round(100 - minSize)}
        aria-label="Resize panes"
        tabIndex={0}
        className={cn(
          // Resting divider joins the borderColor channel (container edge + divider
          // travel together); border token inside the var so unset is byte-identical.
          // The hover/focus primary states keep their conventional interaction color.
          'group relative flex shrink-0 items-center justify-center [background:var(--fr-splitpane-border,var(--color-border))] outline-none transition-colors hover:bg-primary/40 focus-visible:bg-primary/50 focus-visible:ring-2 focus-visible:ring-primary/50',
          isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span
          aria-hidden
          className={cn(
            'rounded-full bg-muted-foreground/50 transition-colors group-hover:bg-primary-foreground',
            isHorizontal ? 'h-8 w-0.5' : 'h-0.5 w-8',
          )}
        />
      </div>
      <div className="overflow-auto" style={secondStyle}>
        {second}
      </div>
    </div>
  );
}

/* ── Resizable ────────────────────────────────────────────────────────────── */

/** Parse a dimension VALUE down to a px number for the drag math (px/rem only;
 *  rem ≈ 16px). Non-finite/percent → the fallback. */
function toPx(v: unknown, dflt: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.trim().match(/^(-?\d*\.?\d+)(px|rem)?$/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return m[2]?.toLowerCase() === 'rem' ? n * 16 : n;
    }
  }
  return dflt;
}

export function Resizable({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    width?: string | number | null;
    height?: string | number | null;
    axis?: string | null;
    minWidth?: string | number | null;
    minHeight?: string | number | null;
    bordered?: boolean | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    radiusValue?: string | number | null;
    size?: { w?: number; h?: number } | null;
  };
  const axis = (p.axis as 'horizontal' | 'vertical' | 'both' | null) ?? 'horizontal';
  const bordered = p.bordered !== false;
  const canX = axis === 'horizontal' || axis === 'both';
  const canY = axis === 'vertical' || axis === 'both';

  const minW = clampNum(toPx(p.minWidth, 120), 120, 24, 2000);
  const minH = clampNum(toPx(p.minHeight, 80), 80, 24, 2000);
  const initW = clampNum(toPx(p.width, 320), 320, minW, 2000);
  const initH = clampNum(toPx(p.height, 240), 240, minH, 2000);

  // Two-way when bound, internal otherwise — the panel resizes without any
  // binding, and the resized {w,h} lands in spec.state so an external Button can
  // read the current dimensions. The prop `size` seeds the bound value.
  const seedSize = {
    w: clampNum(p.size?.w, initW, minW, 2000),
    h: clampNum(p.size?.h, initH, minH, 2000),
  };
  const [sizeRaw, setSizeRaw] = useBoundProp<{ w: number; h: number }>(seedSize, bindings?.size);
  const size = sizeRaw ?? seedSize;
  const setSize = setSizeRaw;
  const emitWith = useIntrinsicEmit(emit, element);
  // Drag origin captured at pointer-down so the move math is delta-based.
  const dragRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  // Live px size during a drag — null when no drag occurred; emitted ONCE at pointer-up.
  const liveSizeRef = useRef<{ w: number; h: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d || e.buttons === 0) return;
    const nextW = canX ? clampNum(d.w + (e.clientX - d.x), d.w, minW, 2000) : size.w;
    const nextH = canY ? clampNum(d.h + (e.clientY - d.y), d.h, minH, 2000) : size.h;
    setSize({ w: nextW, h: nextH });
    liveSizeRef.current = { w: nextW, h: nextH };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // Emit ONCE per drag (not per pointermove) — only when a drag actually resized the panel.
    const s = liveSizeRef.current;
    liveSizeRef.current = null;
    if (s) emitWith('move', { width: s.w, height: s.h, axis });
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    let dw = 0;
    let dh = 0;
    if (canX && e.key === 'ArrowLeft') dw = -8;
    else if (canX && e.key === 'ArrowRight') dw = 8;
    else if (canY && e.key === 'ArrowUp') dh = -8;
    else if (canY && e.key === 'ArrowDown') dh = 8;
    else return;
    e.preventDefault();
    const nextW = clampNum(size.w + dw, size.w, minW, 2000);
    const nextH = clampNum(size.h + dh, size.h, minH, 2000);
    setSize({ w: nextW, h: nextH });
    emitWith('move', { width: nextW, height: nextH, axis });
  };

  const boxStyle: CSSProperties = {
    width: size.w,
    height: canY ? size.h : undefined,
    ...styleVars(
      { var: '--fr-resizable-bg', value: p.bg, kind: 'color' },
      // Publish the shared surface channel, exactly as SplitPane does above. Resizable
      // was the one PAINTING container publishing nothing at all, so a DataTable inside
      // a Resizable{bg:"#12161f"} still painted a WHITE actions column — the original
      // light-island bug rather than the staleness one.
      { var: '--fr-surface', value: p.bg, kind: 'color' },
      { var: '--fr-surface-fg', value: surfaceInk(p.bg, p.color) as string, kind: 'raw' },
      { var: '--fr-surface-muted', value: surfaceMuted(p.bg, p.color) as string, kind: 'raw' },
      { var: '--fr-surface-field', value: surfaceField(p.bg) as string, kind: 'raw' },
      { var: '--fr-surface-sunken', value: surfaceSunken(p.bg) as string, kind: 'raw' },
      { var: '--fr-surface-raised', value: surfaceRaised(p.bg) as string, kind: 'raw' },
      { var: '--fr-resizable-fg', value: p.color, kind: 'color' },
      { var: '--fr-resizable-border', value: p.borderColor, kind: 'color' },
      { var: '--fr-resizable-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
    ),
  };

  // The handle: a thin edge for one axis, a corner grip for `both`.
  const handleCommon =
    'absolute z-10 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary/50';
  let handle: ReactNode = null;
  if (axis === 'both') {
    handle = (
      <div
        role="separator"
        aria-label="Resize"
        aria-valuenow={Math.round(size.w)}
        aria-valuemin={Math.round(minW)}
        aria-valuemax={2000}
        tabIndex={0}
        className={cn(handleCommon, 'bottom-0 right-0 flex h-4 w-4 cursor-nwse-resize items-end justify-end text-[color:var(--fr-surface-muted,var(--color-muted-foreground))] hover:text-foreground')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden className="h-2.5 w-2.5 rounded-br-frayme border-b-2 border-r-2 border-current" />
      </div>
    );
  } else if (canX) {
    handle = (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize width"
        aria-valuenow={Math.round(size.w)}
        aria-valuemin={Math.round(minW)}
        aria-valuemax={2000}
        tabIndex={0}
        className={cn(handleCommon, 'inset-y-0 right-0 flex w-2 cursor-col-resize items-center justify-center hover:bg-primary/20')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden className="h-8 w-0.5 rounded-full bg-muted-foreground/50" />
      </div>
    );
  } else {
    handle = (
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize height"
        aria-valuenow={Math.round(size.h)}
        aria-valuemin={Math.round(minH)}
        aria-valuemax={2000}
        tabIndex={0}
        className={cn(handleCommon, 'inset-x-0 bottom-0 flex h-2 cursor-row-resize items-center justify-center hover:bg-primary/20')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden className="h-0.5 w-8 rounded-full bg-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Token fallback KEPT (not currentColor) — the bordered branch below paints
        // --color-card and `bordered` defaults true. See splitWrap's note.
        'relative max-w-full overflow-hidden text-[color:var(--fr-resizable-fg,var(--fr-surface-fg,var(--color-foreground)))]',
        // radiusValue var-chain on the bordered panel — no radius enum, so the
        // token-fallback IS the byte-identical default (was a bare rounded-frayme); an
        // exact radiusValue (--fr-resizable-radius) wins. NOT co-located with rounded-*.
        bordered ? 'border [border-radius:var(--fr-resizable-radius,var(--radius-frayme))] [border-color:var(--fr-resizable-border,var(--color-border))] [background:var(--fr-resizable-bg,var(--color-card))]' : '',
        // bg applies even when borderless (the bordered branch carries the card default).
        p.bg != null && '[background:var(--fr-resizable-bg)]',
        // and the other half of the same defect: the bordered branch paints
        // var(--fr-resizable-bg,var(--color-card)) and bordered defaults TRUE, so with no
        // authored bg the channel is RESET to the token actually painted rather than left
        // describing an ancestor's surface.
        bordered && p.bg == null && '[--fr-surface:var(--color-card)] [--fr-surface-fg:var(--color-foreground)] [--fr-surface-muted:var(--color-muted-foreground)] [--fr-surface-sunken:var(--color-muted)] [--fr-surface-raised:var(--color-card)] [--fr-surface-field:var(--color-card)]',
      )}
      style={boxStyle}
    >
      <div className="h-full w-full overflow-auto p-3">{children}</div>
      {handle}
    </div>
  );
}

/* ── VirtualList ──────────────────────────────────────────────────────────── */

type VRow = { label?: string; description?: string | null; icon?: string | null; value?: string | null; trailing?: string | null };

/** One rendered row (shared by the windowed + render-all paths). */
function VirtualRow({
  row,
  height,
  selectable,
  selected,
  onSelect,
}: {
  row: VRow;
  height: number;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
}): ReactNode {
  const iconName = typeof row.icon === 'string' && hasIcon(row.icon) ? row.icon : null;
  const inner = (
    <>
      {iconName != null && (
        // The leading icon joins the muted coherence group (description/meta/empty
        // state) — the var is set on the viewport and cascades; token fallback inside.
        <span className="shrink-0 text-[color:var(--fr-vlist-muted,var(--color-muted-foreground))]" aria-hidden>
          <Icon name={iconName} size={16} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        {/* truncate is EARNED on both lines: a virtual row's height is a hard
            contract — the caller's `itemHeight` drives the window arithmetic
            (topSpacer = start*itemHeight, visibleCount = viewportH/itemHeight)
            and is applied as an inline style below, so a wrapped label would
            overflow its own row and land on top of the next one. The single
            line is the price of windowing; the full text stays in `title`. */}
        {/* Token fallback KEPT (not currentColor): every VirtualList shell paints
            [background:var(--fr-vlist-bg,var(--color-card))] unconditionally, so a
            row label is text on its own surface. See splitWrap's note. */}
        <span className="truncate text-sm font-medium text-[color:var(--fr-vlist-fg,var(--color-foreground))]" title={row.label ?? undefined}>{row.label ?? ''}</span>
        {row.description != null && <span className="truncate text-[0.8125rem] [color:var(--fr-vlist-muted,var(--color-muted-foreground))]" title={row.description}>{row.description}</span>}
      </span>
      {row.trailing != null && <span className="shrink-0 text-[0.8125rem] tabular-nums [color:var(--fr-vlist-muted,var(--color-muted-foreground))]">{row.trailing}</span>}
    </>
  );
  const common = 'flex w-full items-center gap-2.5 px-3 text-left';
  if (selectable) {
    // role=option (inside the listbox) + aria-selected — NOT a button/aria-pressed.
    return (
      <div
        role="option"
        aria-selected={selected}
        tabIndex={0}
        style={{ height }}
        className={cn(
          common,
          'cursor-pointer outline-none transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50',
          // quiet defaults: a chosen row is a neutral surface, not a brand tint.
          selected && 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
        )}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        {inner}
      </div>
    );
  }
  return (
    <div role="option" aria-selected={false} style={{ height }} className={cn(common)}>
      {inner}
    </div>
  );
}

export function VirtualList({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: VRow[] | null;
    itemHeight?: number | null;
    maxHeight?: string | number | null;
    overscan?: number | null;
    selectable?: boolean | null;
    mutedColor?: string | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    radiusValue?: string | number | null;
    value?: string | null;
  };
  const items = Array.isArray(p.items) ? p.items.filter((it): it is VRow => it != null && typeof it === 'object') : [];
  const selectable = p.selectable === true;
  const overscan = Math.round(clampNum(p.overscan, 4, 0, 50));
  // A fixed, finite itemHeight enables windowing; absent → render every row.
  const hasFixedHeight = typeof p.itemHeight === 'number' && Number.isFinite(p.itemHeight) && p.itemHeight > 0;
  const itemHeight = hasFixedHeight ? clampNum(p.itemHeight, 44, 16, 400) : 44;

  // Selection (live without a binding) + scroll position + measured viewport.
  const [selected, setSelected] = useBoundProp<string | null>(typeof p.value === 'string' ? p.value : null, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const [scrollTop, setScrollTop] = useState(0);
  // Measured viewport height (px) so the window covers the WHOLE visible area —
  // a hardcoded row count under-renders tall viewports (blank space at the bottom).
  const [viewportH, setViewportH] = useState(320);
  const measure = (el: HTMLElement | null): void => {
    if (el && el.clientHeight > 0 && el.clientHeight !== viewportH) setViewportH(el.clientHeight);
  };

  const heightStyle = styleVars(
    {
      var: '--fr-vlist-h',
      value: p.maxHeight,
      kind: 'dim',
      opts: { units: ['px', 'rem', 'vh'], max: 2000 },
    },
    { var: '--fr-vlist-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-vlist-bg', value: p.bg, kind: 'color' },
    { var: '--fr-vlist-fg', value: p.color, kind: 'color' },
    { var: '--fr-vlist-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-vlist-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  );

  const onRowSelect = (row: VRow): void => {
    if (!selectable) return;
    setSelected(row.value ?? row.label ?? null);
    emitWith('select', { value: row.value ?? row.label ?? null, label: row.label ?? null });
  };
  const keyFor = (row: VRow, i: number): string => `${row.value ?? row.label ?? 'row'}-${i}`;

  // Empty state.
  if (items.length === 0) {
    return (
      <div
        className="flex items-center justify-center border [border-radius:var(--fr-vlist-radius,var(--radius-frayme))] [border-color:var(--fr-vlist-border,var(--color-border))] [background:var(--fr-vlist-bg,var(--color-card))] px-4 py-8 text-sm [color:var(--fr-vlist-muted,var(--color-muted-foreground))] [height:var(--fr-vlist-h,20rem)]"
        style={heightStyle}
      >
        No items
      </div>
    );
  }

  // Render-all fallback (no fixed height) — still scrolls inside the viewport.
  if (!hasFixedHeight) {
    return (
      <div
        role="listbox"
        className="overflow-auto border [border-radius:var(--fr-vlist-radius,var(--radius-frayme))] [border-color:var(--fr-vlist-border,var(--color-border))] [background:var(--fr-vlist-bg,var(--color-card))] [height:var(--fr-vlist-h,20rem)]"
        style={heightStyle}
      >
        {/* row dividers join the borderColor group (viewport edge + dividers) —
          the DescriptionList child-selector pattern, border token as fallback */}
      <div className="divide-y [&>*+*]:[border-color:var(--fr-vlist-border,var(--color-border))]">
          {items.map((row, i) => {
            const val = row.value ?? row.label ?? null;
            return (
              <VirtualRow
                key={keyFor(row, i)}
                row={row}
                height={itemHeight}
                selectable={selectable}
                selected={selectable && val != null && val === selected}
                onSelect={() => onRowSelect(row)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Windowed path — only the visible slice is in the DOM, with top/bottom spacers.
  const total = items.length;
  const totalHeight = total * itemHeight;
  // Rows that fit the MEASURED viewport (+overscan both ends) — covers any height.
  const visibleCount = Math.max(1, Math.ceil(viewportH / itemHeight));
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(total, start + visibleCount + overscan * 2);
  const topSpacer = start * itemHeight;
  const bottomSpacer = Math.max(0, totalHeight - end * itemHeight);
  const slice = items.slice(start, end);

  return (
    <div
      role="listbox"
      ref={measure}
      className="overflow-auto border [border-radius:var(--fr-vlist-radius,var(--radius-frayme))] [border-color:var(--fr-vlist-border,var(--color-border))] [background:var(--fr-vlist-bg,var(--color-card))] [height:var(--fr-vlist-h,20rem)]"
      style={heightStyle}
      onScroll={(e) => {
        setScrollTop(e.currentTarget.scrollTop);
        measure(e.currentTarget);
      }}
    >
      <div style={{ height: topSpacer }} aria-hidden />
      {/* row dividers join the borderColor group (viewport edge + dividers) —
          the DescriptionList child-selector pattern, border token as fallback */}
      <div className="divide-y [&>*+*]:[border-color:var(--fr-vlist-border,var(--color-border))]">
        {slice.map((row, i) => {
          const realIndex = start + i;
          const val = row.value ?? row.label ?? null;
          return (
            <VirtualRow
              key={keyFor(row, realIndex)}
              row={row}
              height={itemHeight}
              selectable={selectable}
              selected={selectable && val != null && val === selected}
              onSelect={() => onRowSelect(row)}
            />
          );
        })}
      </div>
      <div style={{ height: bottomSpacer }} aria-hidden />
    </div>
  );
}

/* ── DescriptionList ──────────────────────────────────────────────────────── */

// fontSize is a single source: the prior `text-sm` is folded into the var
// fallback (byte-identical when unset) and an exact fontSize (--fr-dl-fs) wins.
// leading-[calc(1.25/0.875)] reproduces the unitless line-height text-sm bundled
// (leadingClass added LAST dedupe-wins the leading group). NOT co-located with
// any text-* utility.
/* INHERITED FOREGROUND for the <dd> values below. `--fr-dl-fg` (the `color` prop)
 * falls back to `currentColor`, not --color-foreground: a DescriptionList paints
 * NO surface of its own — `bordered` only adds divider borders — so every value
 * sits on whatever contains the list. The token was a hard RESET; a spec authoring
 * `Card { bg:"#12161f", color:"#e2e6f0" }` had that colour inherit down and then
 * each value snap back to #18181b, contrast ratio 1.02 on dark navy, and the spec
 * did nothing wrong. The two are the same value at the top level (.frayme-root
 * sets `color: var(--frayme-fg)` and --color-foreground IS var(--frayme-fg)), so
 * a props-less list is byte-identical; only the authored-container case moves.
 * SplitPane / Resizable / VirtualList in this file KEEP the token — see their
 * notes: each paints --color-card, so their text is on its own surface. */
const dlWrap = cva('w-full [font-size:var(--fr-dl-fs,0.875rem)] leading-[calc(1.25/0.875)]', {
  variants: {
    density: { compact: '', normal: '', comfortable: '' },
  },
  defaultVariants: { density: 'normal' },
});

const ROW_GAP: Record<string, string> = {
  compact: 'gap-y-1.5',
  normal: 'gap-y-3',
  comfortable: 'gap-y-5',
};
const PAIR_PAD: Record<string, string> = {
  compact: 'py-1.5',
  normal: 'py-2.5',
  comfortable: 'py-3.5',
};

// Canonical item shape is { term, description }, but the model very often emits
// { label, value } (the naming DataTable columns / most components use) — that
// passed the shallow gate yet rendered EMPTY dt/dd, leaving a dead gap.
// Read both spellings so either renders. `key` is
// a further common alias for the term.
type DlItem = { term?: string; description?: string; label?: string; value?: string; key?: string; definition?: string };
const dlTerm = (it: DlItem): string => it.term ?? it.label ?? it.key ?? '';
// `definition` joined the alias set: the model paired term/definition
// (natural English) on a wizard summary and every value rendered empty.
const dlValue = (it: DlItem): string => it.description ?? it.value ?? it.definition ?? '';

export function DescriptionList({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: Array<DlItem> | null;
    layout?: string | null;
    density?: string | null;
    columns?: number | null;
    bordered?: boolean | null;
    mutedColor?: string | null;
    color?: string | null;
    borderColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const items = Array.isArray(p.items)
    ? p.items.filter((it): it is { term?: string; description?: string } => it != null && typeof it === 'object')
    : [];
  const layout = (p.layout as 'stacked' | 'inline' | 'grid' | null) ?? 'stacked';
  const density = (p.density as 'compact' | 'normal' | 'comfortable' | null) ?? 'normal';
  const bordered = p.bordered === true;
  const cols = Math.round(clampNum(p.columns, 2, 1, 3));
  const dlColors = styleVars(
    { var: '--fr-dl-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-dl-fg', value: p.color, kind: 'color' },
    { var: '--fr-dl-border', value: p.borderColor, kind: 'color' },
    // exact font size for the WHOLE list text — the dl base (dd) reads it with a
    // 0.875rem fallback, each dt with its own 0.8125rem fallback.
    { var: '--fr-dl-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  );
  // font cascades from the root; weight targets the TERM (dt) only;
  // tracking/leading inherit to the whole list. Unset → undefined → cn drops
  // them (byte-identical defaults). Placed LAST so a set value dedupe-wins.
  const dlTypography = cn(fontClass(p.font), trackingClass(p.tracking), leadingClass(p.leading));

  if (items.length === 0) return null;

  // Grid: term/value pairs flow into N columns.
  if (layout === 'grid') {
    return (
      <dl
        // fr-dl-grid: an authored column COUNT is a target, not a lock. At 272px
        // a 3-up grid gives each term/value pair ~85px and the text stacks
        // vertically — 57 shattered elements traced here and to the inline
        // layout. frayme.css collapses it on a narrow container, exactly like
        // fr-grid-fixed and fr-sg-fixed already do.
        className={cn(dlWrap({ density }), 'fr-dl-grid grid gap-x-8', ROW_GAP[density], dlTypography)}
        style={{ ...dlColors, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {items.map((it, i) => (
          <div key={i} className={cn('flex min-w-0 flex-col gap-0.5', bordered && 'border-b [border-color:var(--fr-dl-border,var(--color-border))]', bordered && PAIR_PAD[density])}>
            <dt className={cn('break-words [font-size:var(--fr-dl-fs,0.8125rem)] font-medium [color:var(--fr-dl-muted,var(--color-muted-foreground))]', weightClass(p.weight))}>{dlTerm(it)}</dt>
            <dd className="m-0 break-words font-medium [color:var(--fr-dl-fg,currentColor)]">{dlValue(it)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  // Inline: term column on the left, value on the right, one row each.
  //
  // The row is a GRID, not a flex justify-between: the term was
  // `max-w-[60%] truncate` with default shrink while the value took its content
  // width, so EVERY term truncated — "Airport transfer" → "Airport tr…", and
  // "Data" → "Da…" in a 682px row whose value needed 580px. A fixed first track
  // (minmax(140px,30%)) gives the terms a real column that wraps instead of
  // ellipsising, and left-aligning the value gives the value column an edge (it
  // was `text-right` + content-sized, so multi-line values ragged-left and every
  // row's left edge sat at a different x).
  //
  // Right-alignment is reserved for the case it was meant for: SHORT single-line
  // values (numbers, dates, statuses) where a right edge aids scanning. Anything
  // long enough to wrap reads left-aligned.
  if (layout === 'inline') {
    const RIGHT_ALIGN_MAX = 24;
    // DECIDED ONCE FOR THE LIST, NOT PER ROW. The per-row form of this test flipped a
    // SINGLE row when one value ran long and left every other row right-aligned, so the
    // value column stopped lining up and the list read as broken. Two reported
    // sightings, both at exactly 33 chars: "An ONT and a Hollowbrook 6 router" sat
    // mid-card under three right-aligned siblings, and "26 Ashgrove Rise, Bristol BS9
    // 4TN" did the same above a right-aligned account number. Lists that mix short
    // and long values are common, and values behind {$cond}/{$state} (including
    // both sightings) resolve at runtime and cannot be checked statically.
    //
    // The original intent is kept: a right edge aids scanning ONLY when every value is
    // short and single-line. As soon as one value can wrap, ragged-left multi-line text
    // is the worse artifact, so the whole column goes left TOGETHER. Consistency across
    // the column beats per-row optimisation — a column that changes alignment row to row
    // is the bug, not the alignment of any one row.
    const rightAlign = items.every((it) => dlValue(it).length <= RIGHT_ALIGN_MAX);
    return (
      <dl className={cn(dlWrap({ density }), 'flex flex-col', bordered && 'divide-y [&>*+*]:[border-color:var(--fr-dl-border,var(--color-border))]', dlTypography)} style={dlColors}>
        {items.map((it, i) => (
          // fr-dl-inline: the term's 7rem floor plus a 1.5rem gap eats 8.5rem
          // before the value gets anything, so inside a padded card at phone
          // width the value column can fall under a single character and the
          // text stacks vertically (measured, not assumed). The marker
          // lets frayme.css collapse the pair to one column on a narrow
          // container, the same way every other fixed template already does.
          <div key={i} className={cn('fr-dl-inline grid grid-cols-[minmax(7rem,30%)_1fr] items-baseline gap-x-6', PAIR_PAD[density])}>
            {/* Both cells are text LEAVES, so neither takes min-w-0: their
                automatic minimum IS their longest word, which is the floor
                break-words breaks against. Under it the term column spelled a
                word one character per line — the grid track is what gives
                (fr-dl-inline collapses the pair on a narrow container), not the
                word. */}
            <dt className={cn('font-medium break-words [color:var(--fr-dl-muted,var(--color-muted-foreground))]', weightClass(p.weight))}>{dlTerm(it)}</dt>
            <dd
              className={cn(
                'm-0 break-words font-medium [color:var(--fr-dl-fg,currentColor)]',
                rightAlign ? 'text-right' : 'text-left',
              )}
            >
              {dlValue(it)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  // Stacked (default): term above value.
  return (
    <dl className={cn(dlWrap({ density }), 'flex flex-col', ROW_GAP[density], bordered && 'divide-y [&>*+*]:[border-color:var(--fr-dl-border,var(--color-border))]', dlTypography)} style={dlColors}>
      {items.map((it, i) => (
        <div key={i} className={cn('flex min-w-0 flex-col gap-0.5', bordered && PAIR_PAD[density])}>
          <dt className={cn('break-words [font-size:var(--fr-dl-fs,0.8125rem)] font-medium [color:var(--fr-dl-muted,var(--color-muted-foreground))]', weightClass(p.weight))}>{dlTerm(it)}</dt>
          <dd className="m-0 break-words font-medium [color:var(--fr-dl-fg,currentColor)]">{dlValue(it)}</dd>
        </div>
      ))}
    </dl>
  );
}
