'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars, fontClass } from './_style.js';
import { safeColor, safeNumberIn, safePoint, safePointList } from '@frayme/catalog/validate';
import { safeImageSrc } from './url-safety.js';
import { usePointerStrokes, type NormPoint } from './_canvas.js';
import { useLocalOrBound as useBoundProp } from './_state.js';

/** normalized [0,1] points → an SVG `points` string over the 0..100 viewBox. */
const polyPoints = (pts: NormPoint[]): string => pts.map((pt) => `${(pt.x * 100).toFixed(1)},${(pt.y * 100).toFixed(1)}`).join(' ');

/* Catalog component (media-annotator): MediaAnnotator — image markup (pin/box/freehand).
 * OWNS-THE-SET (marks are internal state seeded from props). ONE capture surface: the
 * freehand engine's surfaceRef AND the pin/box handlers attach to the SAME overlay SVG,
 * dispatched by the active tool. Committed freehand renders from folded MARK objects; the
 * engine buffer is transient (single-owner). A tool switch force-ends any active gesture.
 * Emits in handlers reading refs — NEVER a functional updater. v1: create+select+label+
 * delete; NO drag-reposition (deferred). Coords normalized to the object-contain content box. */

const MAX_ANNOTATIONS = 200;
const MAX_LABEL = 200;
const MOVE_THRESHOLD = 4; // px — tap vs drag for the box tool

type Tool = 'select' | 'pin' | 'box' | 'freehand' | 'text';
type Kind = 'pin' | 'box' | 'freehand' | 'text';
interface Mark { id: string; kind: Kind; label: string; color: string | null; x?: number; y?: number; w?: number; h?: number; points?: NormPoint[] }
interface AnnoIn { id?: unknown; kind?: unknown; label?: unknown; color?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown; points?: unknown }

const capLabel = (v: unknown): string => (typeof v === 'string' ? v.slice(0, MAX_LABEL) : '');

/* ── ink for a fill the AUTHOR pinned ──────────────────────────────────────────
 *
 * Two surfaces in this file are painted from a colour the spec supplies — the
 * active tool chip / Save button (`accent`) and the pin head (a mark's `color`)
 * — and both carried ink that follows the THEME (`text-card`,
 * `text-primary-foreground`). A fixed fill under flipping ink fails in whichever
 * mode the fill does not suit, and which mode that is depends on the colour.
 * Measured in Chromium on typical authored colours:
 *
 *                                       light   dark
 *   tool chip   accent  #0C8A5B          4.37   3.88   (both — mid luminance)
 *   pin head    color   #2563eb          5.17   3.62
 *   pin head    color   #d97706          3.19   5.88
 *   pin head    color   #fde68a          1.25  15.03
 *   pin head    (unset → --color-primary) 5.17   7.36   ← the token pair is right
 *
 * So the ink has to be pinned to the FILL, not to the mode. Every colour has at
 * least one of black/white clearing 4.5:1 against it, and the crossover is where
 * 1.05/(L+0.05) meets (L+0.05)/0.05, i.e. L = 0.1791 — picking the better side
 * there is never worse than 4.58:1 for ANY fill.
 *
 * An UNSET or unreadable channel returns null and the component keeps the token
 * pair it always had, so a props-less render is byte-identical — and the token
 * pair is already correct there, because both halves flip together. Readable
 * means hex or rgb(): `safeColor` also admits named colours, hsl(), oklch() and
 * friends, and a wrong luminance would be worse than no opinion. */
const HEX_INK = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function fixedInk(value: unknown): string | null {
  const c = safeColor(value);
  if (c === null) return null;
  let rgb: [number, number, number] | null = null;
  if (HEX_INK.test(c)) {
    const h = c.slice(1);
    const wide = h.length >= 6;
    rgb = [0, 1, 2].map((i) => (wide ? parseInt(h.slice(i * 2, i * 2 + 2), 16) : parseInt(h[i] + h[i], 16))) as [number, number, number];
  } else {
    const m = /^rgba?\(([^)]+)\)$/i.exec(c);
    if (m) {
      const n = m[1].split(/[,\s/]+/).filter(Boolean);
      if (n.length >= 3 && n.slice(0, 3).every((v) => /^-?[\d.]+%?$/.test(v))) {
        rgb = n.slice(0, 3).map((v) => (v.endsWith('%') ? (Number.parseFloat(v) * 255) / 100 : Number(v))) as [number, number, number];
      }
    }
  }
  if (rgb === null || rgb.some((v) => !Number.isFinite(v))) return null;
  const f = (v: number): number => {
    const x = Math.min(255, Math.max(0, v)) / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  return lum > 0.1791 ? '#000000' : '#ffffff';
}

function ingest(raw: AnnoIn[]): Mark[] {
  const out: Mark[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length && out.length < MAX_ANNOTATIONS; i++) {
    const a = raw[i];
    if (!a) continue;
    const id = typeof a.id === 'string' && a.id ? a.id : `a${i}`;
    if (seen.has(id)) continue;
    const base = { id, label: capLabel(a.label), color: safeColor(a.color) };
    if (a.kind === 'pin') {
      const pt = safePoint({ x: a.x, y: a.y });
      if (!pt) continue;
      out.push({ ...base, kind: 'pin', x: pt.x, y: pt.y });
    } else if (a.kind === 'box') {
      const x = safeNumberIn(a.x, 0, 1), y = safeNumberIn(a.y, 0, 1), w = safeNumberIn(a.w, 0, 1), h = safeNumberIn(a.h, 0, 1);
      if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) continue;
      out.push({ ...base, kind: 'box', x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) });
    } else if (a.kind === 'freehand') {
      const pts = safePointList(a.points, 4096);
      if (!pts || pts.length < 2) continue;
      out.push({ ...base, kind: 'freehand', points: pts });
    } else if (a.kind === 'text') {
      const pt = safePoint({ x: a.x, y: a.y });
      if (!pt) continue;
      out.push({ ...base, kind: 'text', x: pt.x, y: pt.y }); // the text content IS the label
    } else continue;
    seen.add(id);
  }
  return out;
}

export function MediaAnnotator({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    src?: string | null;
    alt?: string | null;
    annotations?: AnnoIn[] | null;
    mode?: Tool | null;
    editable?: boolean | null;
    showToolbar?: boolean | null;
    showLabels?: boolean | null;
    aspect?: number | null;
    activeColor?: unknown;
    accent?: unknown;
    mutedColor?: unknown;
    font?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  const editable = p.editable !== false;
  const showToolbar = p.showToolbar !== false && editable;
  const showLabels = p.showLabels !== false;
  const aspect = Math.min(3, Math.max(0.5, safeNumberIn(p.aspect, 0.5, 3) ?? 1.7778));
  const src = safeImageSrc(p.src);
  const activeColor = safeColor(p.activeColor);

  // ── owns-the-set ──────────────────────────────────────────────────────────
  const rawAnnos = Array.isArray(p.annotations) ? p.annotations : [];
  const annoKey = useMemo(() => JSON.stringify(rawAnnos), [rawAnnos]);
  // Bindable mirror: every create/edit/delete/clear funnels through setMarks (via
  // writeMarks), so the FULL resolved Mark[] lands in spec.state and an external
  // Button bound with { $bindState } can read all annotations. Falls back to local
  // useState when the binding path is absent (unbound render stays byte-identical).
  const [boundMarks, setMarks] = useBoundProp<Mark[]>(
    ingest(rawAnnos),
    (bindings as { annotations?: unknown } | undefined)?.annotations,
  );
  const marks: Mark[] = Array.isArray(boundMarks) ? boundMarks : [];
  const marksRef = useRef<Mark[]>(marks);
  const idCounter = useRef(0);

  const [tool, setTool] = useState<Tool>(() => (['select', 'pin', 'box', 'freehand', 'text'] as Tool[]).includes(p.mode as Tool) ? (p.mode as Tool) : 'select');
  const toolRef = useRef<Tool>(tool);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [boxDraft, setBoxDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const boxStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const writeMarks = useCallback((next: Mark[]) => { marksRef.current = next; setMarks(next); }, []);

  // ── freehand engine (transient capture only; folded into marks on end) ──────
  const foldStroke = useCallback((strokes: NormPoint[][]) => {
    if (!editable || toolRef.current !== 'freehand') return;
    const last = strokes[strokes.length - 1];
    if (!last || last.length < 2) return; // nothing to fold (also the re-entrant empty from clear)
    if (marksRef.current.length >= MAX_ANNOTATIONS) return;
    const id = `fh${++idCounter.current}`;
    const points = last.map((pt) => ({ x: pt.x, y: pt.y }));
    const next = [...marksRef.current, { id, kind: 'freehand' as const, label: '', color: activeColor, points }];
    writeMarks(next);
    emitWith('commit', { id, kind: 'freehand', points, count: next.length });
  }, [editable, activeColor, writeMarks, emitWith]);

  const engine = usePointerStrokes(foldStroke, !editable);
  // clear the transient engine buffer AFTER a stroke folds (so it never accumulates)
  useEffect(() => { if (!engine.drawing && engine.strokes.length > 0) engine.clear(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [engine.drawing]);

  // atomic re-seed on annoKey: reset marks + selection + in-flight gestures together
  useEffect(() => {
    const seeded = ingest(rawAnnos);
    marksRef.current = seeded;
    setMarks(seeded);
    setOpenId(null);
    setBoxDraft(null);
    boxStart.current = null;
    engine.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annoKey]);

  const switchTool = (t: Tool): void => {
    // force-end any active gesture before switching (no stranded drag/draw)
    engine.clear();
    setBoxDraft(null);
    boxStart.current = null;
    setTool(t);
    toolRef.current = t;
  };

  // ── content box (object-contain fit) ────────────────────────────────────────
  const contentBox = useMemo(() => {
    if (!natural || natural.w <= 0 || natural.h <= 0) return { left: 0, top: 0, width: 100, height: 100 };
    const imgAsp = natural.w / natural.h;
    if (imgAsp >= aspect) { const h = (aspect / imgAsp) * 100; return { left: 0, top: (100 - h) / 2, width: 100, height: h }; }
    const w = (imgAsp / aspect) * 100; return { left: (100 - w) / 2, top: 0, width: w, height: 100 };
  }, [natural, aspect]);

  const toNorm = useCallback((e: ReactPointerEvent): NormPoint | null => {
    const el = engine.surfaceRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, [engine.surfaceRef]);

  const addPin = (pt: NormPoint): void => {
    if (marksRef.current.length >= MAX_ANNOTATIONS) return;
    const id = `pin${++idCounter.current}`;
    const next = [...marksRef.current, { id, kind: 'pin' as const, label: '', color: activeColor, x: pt.x, y: pt.y }];
    writeMarks(next);
    emitWith('commit', { id, kind: 'pin', x: pt.x, y: pt.y, count: next.length });
  };

  const addText = (pt: NormPoint): void => {
    if (marksRef.current.length >= MAX_ANNOTATIONS) return;
    const id = `text${++idCounter.current}`;
    const next = [...marksRef.current, { id, kind: 'text' as const, label: '', color: activeColor, x: pt.x, y: pt.y }];
    writeMarks(next);
    emitWith('commit', { id, kind: 'text', x: pt.x, y: pt.y, text: '', count: next.length });
    // open the editor immediately so the user types the text content (the label IS the text)
    setOpenId(id);
    setDraftLabel('');
  };

  // ── shared-surface pointer handlers (dispatch by tool) ──────────────────────
  const onDown = (e: ReactPointerEvent): void => {
    if (!editable) return;
    const t = toolRef.current;
    if (t === 'freehand') return engine.handlers.onPointerDown(e);
    if (t === 'pin') { const pt = toNorm(e); if (pt) addPin(pt); return; }
    if (t === 'text') { const pt = toNorm(e); if (pt) addText(pt); return; }
    if (t === 'box') {
      const pt = toNorm(e); if (!pt) return;
      boxStart.current = { x: pt.x, y: pt.y, px: e.clientX, py: e.clientY };
      try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* stale pointer */ }
    }
  };
  const onMove = (e: ReactPointerEvent): void => {
    const t = toolRef.current;
    if (t === 'freehand') return engine.handlers.onPointerMove(e);
    if (t === 'box' && boxStart.current) {
      const pt = toNorm(e); if (!pt) return;
      const s = boxStart.current;
      setBoxDraft({ x: Math.min(s.x, pt.x), y: Math.min(s.y, pt.y), w: Math.abs(pt.x - s.x), h: Math.abs(pt.y - s.y) });
    }
  };
  const endBox = (e: ReactPointerEvent): void => {
    const s = boxStart.current;
    boxStart.current = null; // null at the top (idempotent)
    if (!s) return;
    const moved = Math.abs(e.clientX - s.px) > MOVE_THRESHOLD || Math.abs(e.clientY - s.py) > MOVE_THRESHOLD;
    const pt = toNorm(e);
    setBoxDraft(null);
    if (!moved || !pt) return;
    if (marksRef.current.length >= MAX_ANNOTATIONS) return;
    const x = Math.min(s.x, pt.x), y = Math.min(s.y, pt.y), w = Math.abs(pt.x - s.x), h = Math.abs(pt.y - s.y);
    if (w < 0.01 || h < 0.01) return;
    const id = `box${++idCounter.current}`;
    const next = [...marksRef.current, { id, kind: 'box' as const, label: '', color: activeColor, x, y, w, h }];
    writeMarks(next);
    emitWith('commit', { id, kind: 'box', x, y, w, h, count: next.length });
  };
  const onUp = (e: ReactPointerEvent): void => {
    const t = toolRef.current;
    if (t === 'freehand') return engine.handlers.onPointerUp(e);
    if (t === 'box') endBox(e);
  };
  const onCancel = (e: ReactPointerEvent): void => { engine.handlers.onPointerCancel(e); boxStart.current = null; setBoxDraft(null); };

  // ── selection / edit / delete (all emit in handlers) ────────────────────────
  const geomOf = (m: Mark): Record<string, unknown> =>
    m.kind === 'pin' ? { x: m.x, y: m.y }
      : m.kind === 'text' ? { x: m.x, y: m.y, text: m.label }
        : m.kind === 'box' ? { x: m.x, y: m.y, w: m.w, h: m.h }
          : { points: m.points ?? [] };
  const openMark = (m: Mark): void => {
    const payload = { id: m.id, kind: m.kind, label: m.label, ...geomOf(m) };
    if (!editable) { emitWith('select', payload); return; }
    setOpenId(m.id);
    setDraftLabel(m.label);
    emitWith('select', payload);
  };
  const saveLabel = (): void => {
    const id = openId; if (id === null) return;
    const label = draftLabel.slice(0, MAX_LABEL);
    const next = marksRef.current.map((m) => (m.id === id ? { ...m, label } : m));
    const m = next.find((x) => x.id === id);
    writeMarks(next);
    setOpenId(null);
    if (m) emitWith('change', { id, kind: m.kind, label });
  };
  const deleteMark = (id: string): void => {
    const m = marksRef.current.find((x) => x.id === id);
    const next = marksRef.current.filter((x) => x.id !== id);
    writeMarks(next);
    setOpenId(null);
    if (m) emitWith('dismiss', { id, kind: m.kind });
  };
  const clearAll = (): void => {
    const prev = marksRef.current.length;
    if (prev === 0) return;
    writeMarks([]);
    setOpenId(null);
    emitWith('dismiss', { op: 'clear', previousCount: prev });
  };

  // Escape closes the popover
  useEffect(() => {
    if (openId === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  const vars = {
    ...styleVars(
      { var: '--fr-ma-accent', value: p.accent, kind: 'color' },
      { var: '--fr-ma-active', value: p.activeColor, kind: 'color' },
      { var: '--fr-ma-muted', value: p.mutedColor, kind: 'color' },
    ),
    // The ink for the accent SLAB (chip / Save), pinned to the accent the author
    // fixed. Absent when they set none — the slab is --color-foreground then, and
    // --color-card is already its partner in both modes. See fixedInk above.
    // A spec that set its OWN accent owns its ink: a readable colour gets a derived
    // ink, one we cannot read pins the token pair it always had. Only with no accent
    // of its own does the slab fall through to the theme's --fr-accent-ink, because
    // only then is the fill actually the theme's accent. Letting an unreadable spec
    // accent fall through would print an ink computed for a DIFFERENT colour.
    ...(safeColor(p.accent) === null ? {} : { '--fr-ma-ink': fixedInk(p.accent) ?? 'var(--color-card)' }),
  } as CSSProperties;
  const mutedText = 'text-[color:var(--fr-ma-muted,var(--color-muted-foreground))]';
  // The slab's ink, as one expression: the pinned value when the accent is
  // authored, the token pair otherwise (byte-identical to the old `text-card`).
  const slabInk = 'text-[color:var(--fr-ma-ink,var(--fr-accent-ink,var(--color-card)))]';
  const accentVar = 'var(--fr-ma-accent, var(--fr-accent))';
  const inkFor = (m: Mark): string => safeColor(m.color) ?? 'var(--fr-ma-active, var(--color-primary))';
  /** Same pairing for a pin head, whose fill is per-MARK rather than per-chart —
   *  and, for a mark that names no colour of its own, the chart-level
   *  `activeColor` that `inkFor` hands it (measured 1.25:1 in light on the
   *  #fde68a an author can put there). Neither set → the token, correctly. */
  const pinInk = (m: Mark): string => fixedInk(m.color) ?? fixedInk(p.activeColor) ?? 'var(--color-primary-foreground)';
  const captureActive = editable && tool !== 'select';
  const openMarkObj = marks.find((m) => m.id === openId) ?? null;

  const TOOLS: { key: Tool; label: string; glyph: string }[] = [
    { key: 'select', label: 'Select', glyph: '⤢' },
    { key: 'pin', label: 'Pin', glyph: '📍' },
    { key: 'box', label: 'Box', glyph: '▭' },
    { key: 'text', label: 'Text', glyph: 'T' },
    { key: 'freehand', label: 'Draw', glyph: '✎' },
  ];

  return (
    <div style={vars} className={cn('w-full', fontClass(p.font))}>
      {showToolbar && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Annotation tool" className="inline-flex overflow-hidden rounded-lg border border-border">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={tool === t.key}
                onClick={() => switchTool(t.key)}
                className={cn('flex items-center gap-1 px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ma-accent,var(--color-foreground))_20%,transparent)]', tool === t.key ? cn('bg-[color:var(--fr-ma-accent,var(--fr-accent))]', slabInk) : 'bg-card text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')}
              >
                <span aria-hidden="true">{t.glyph}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
          {/* `text-current`, not `text-foreground` — the ONE unpainted foreground in
              this file. Every other label here sits on a fill this component paints
              itself (the tool buttons' `bg-card`, the pin/box chips' `bg-card/90`
              over the photo, the popover's `bg-card`) and so KEEPS the token; this
              button is border-only, so its surface is whatever contains the
              annotator. Inside an authored `Card { bg:"#12161f",
              color:"#e2e6f0" }`: the section carried rgb(226,230,240), the toolbar
              div inherited it, and this button RESET to rgb(24,24,27) — 1.02:1,
              near-black on dark navy, with the spec having done nothing wrong.
              Inheriting instead measures the authored rgb(226,230,240): 14.49:1.
              Byte-identical at the top level, because frayme.css points BOTH
              `.frayme-root { color }` and --color-foreground at --frayme-fg; on the
              `color` property currentColor computes to the INHERITED value, so
              there is no cycle. The deliberate KEEPS are pinned alongside this in
              test/inherited-foreground-canvas-overlay.test.tsx. */}
          <button type="button" onClick={clearAll} disabled={marks.length === 0} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-current transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ma-accent,var(--fr-accent))_20%,transparent)]">
            Clear
          </button>
          <span className={cn('ml-auto text-xs tabular-nums', mutedText)}>{marks.length} annotation{marks.length === 1 ? '' : 's'}</span>
        </div>
      )}

      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]" style={{ aspectRatio: String(aspect) }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            // The annotated image IS the subject of the screen. An empty alt
            // hands a screen-reader user a set of pins floating over nothing,
            // even when the photograph carries the whole point of the screen.
            alt={typeof p.alt === 'string' && p.alt.trim() ? p.alt : 'Annotated image'}
            draggable={false} onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth > 0) setNatural({ w: im.naturalWidth, h: im.naturalHeight }); }} className="absolute inset-0 h-full w-full select-none object-contain" />
        ) : (
          <div className={cn('absolute inset-0 grid place-items-center text-sm', mutedText)}>No image</div>
        )}

        {/* overlay positioned over the image CONTENT BOX (contain-fit) */}
        <div className="absolute" style={{ left: `${contentBox.left}%`, top: `${contentBox.top}%`, width: `${contentBox.width}%`, height: `${contentBox.height}%` }}>
          {/* committed shapes (from marks) + live capture, in ONE stretched SVG */}
          <svg
            ref={engine.surfaceRef}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className={cn('absolute inset-0 h-full w-full', captureActive ? 'cursor-crosshair touch-none select-none' : 'pointer-events-none')}
            style={captureActive ? { pointerEvents: 'all' } : undefined}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            onPointerCancel={onCancel}
            onLostPointerCapture={onCancel}
          >
            {marks.filter((m) => m.kind === 'box').map((m) => (
              <rect key={m.id} x={(m.x ?? 0) * 100} y={(m.y ?? 0) * 100} width={(m.w ?? 0) * 100} height={(m.h ?? 0) * 100} fill="none" stroke={openId === m.id ? accentVar : inkFor(m)} strokeWidth={openId === m.id ? 3 : 2} vectorEffect="non-scaling-stroke" />
            ))}
            {marks.filter((m) => m.kind === 'freehand').map((m) => (
              <polyline key={m.id} points={polyPoints(m.points ?? [])} fill="none" stroke={openId === m.id ? accentVar : inkFor(m)} strokeWidth={openId === m.id ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {/* live freehand (transient, only the in-progress stroke) */}
            {engine.drawing && engine.strokes.length > 0 && (
              <polyline points={polyPoints(engine.strokes[engine.strokes.length - 1] ?? [])} fill="none" stroke={'var(--fr-ma-active, var(--color-primary))'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            )}
            {/* live box draft */}
            {boxDraft && <rect x={boxDraft.x * 100} y={boxDraft.y * 100} width={boxDraft.w * 100} height={boxDraft.h * 100} fill="none" stroke={'var(--fr-ma-active, var(--color-primary))'} strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
          </svg>

          {/* pins + hit-targets + labels (HTML — undistorted, focusable) */}
          {marks.map((m) => {
            const selected = openId === m.id;
            if (m.kind === 'pin') {
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openMark(m)}
                  aria-label={(m.label || 'Pin') + (selected ? ', selected' : '')}
                  disabled={captureActive}
                  className={cn('absolute -translate-x-1/2 -translate-y-full focus-visible:outline-none', captureActive && 'pointer-events-none')}
                  style={{ left: `${(m.x ?? 0) * 100}%`, top: `${(m.y ?? 0) * 100}%` }}
                >
                  <span className="flex flex-col items-center">
                    {/* the head's fill is the MARK's colour — data, and fixed in
                        both modes — so its glyph is pinned to that fill rather
                        than to --color-primary-foreground, which flipped out from
                        under it (measured 3.62 dark on #2563eb, 3.19 light on
                        #d97706). Unset colour → the token, whose pair is right. */}
                    <span className={cn('grid h-5 w-5 place-items-center rounded-full border-2 border-card text-[10px] shadow', selected && 'ring-2 ring-offset-1')} style={{ backgroundColor: inkFor(m), color: pinInk(m), ...(selected ? { boxShadow: `0 0 0 2px var(--color-card), 0 0 0 4px ${accentVar}` } : {}) } as CSSProperties}>●</span>
                    <span className="-mt-0.5 h-2 w-0.5" style={{ backgroundColor: inkFor(m) }} />
                    {/* The 10rem cap STAYS — this chip floats over the image, so an
                        uncapped label would run across the artwork and over its
                        neighbours. What goes is the truncate: the cap is a wrapping
                        width, not a clip, so a long pin label now stacks under the
                        pin instead of ending in an ellipsis. */}
                    {showLabels && m.label && <span className="mt-0.5 max-w-[10rem] break-words rounded bg-card/90 px-1 text-center text-[10px] font-medium leading-tight text-foreground shadow-sm" title={m.label}>{m.label}</span>}
                  </span>
                </button>
              );
            }
            if (m.kind === 'text') {
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openMark(m)}
                  aria-label={(m.label || 'Text annotation') + (selected ? ', selected' : '')}
                  disabled={captureActive}
                  className={cn('absolute max-w-[14rem] -translate-x-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-left text-xs font-semibold leading-tight shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ma-accent,var(--fr-accent))_20%,transparent)]', captureActive && 'pointer-events-none', selected ? 'ring-2 ring-offset-1' : '')}
                  style={{ left: `${(m.x ?? 0) * 100}%`, top: `${(m.y ?? 0) * 100}%`, color: inkFor(m), backgroundColor: 'color-mix(in srgb, var(--color-card) 85%, transparent)' }}
                >
                  {m.label || 'Text…'}
                </button>
              );
            }
            // box / freehand hit-target: a small clickable label chip at the anchor
            const ax = m.kind === 'box' ? (m.x ?? 0) : (m.points?.[0]?.x ?? 0);
            const ay = m.kind === 'box' ? (m.y ?? 0) : (m.points?.[0]?.y ?? 0);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => openMark(m)}
                aria-label={(m.label || m.kind) + (selected ? ', selected' : '')}
                disabled={captureActive}
                className={cn('absolute -translate-y-full rounded px-1 text-[10px] font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ma-accent,var(--color-foreground))_20%,transparent)]', captureActive && 'pointer-events-none', selected ? cn('bg-[color:var(--fr-ma-accent,var(--fr-accent))]', slabInk) : 'bg-card/90 text-foreground')}
                style={{ left: `${ax * 100}%`, top: `${ay * 100}%` }}
              >
                {showLabels && m.label ? m.label : m.kind}
              </button>
            );
          })}
        </div>

        {/* edit popover */}
        {editable && openMarkObj && (
          <>
            <div className="absolute inset-0 z-10" onClick={() => setOpenId(null)} aria-hidden="true" />
            <div role="dialog" aria-label="Edit annotation" className="absolute left-1/2 top-1/2 z-20 w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-3 text-foreground shadow-lg">
              <div className={cn('mb-1.5 text-xs font-medium uppercase tracking-wide', mutedText)}>{openMarkObj.kind}</div>
              <input
                autoFocus
                value={draftLabel}
                maxLength={MAX_LABEL}
                onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveLabel(); } }}
                placeholder="Label…"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ma-accent,var(--fr-accent))_20%,transparent)]"
              />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <button type="button" onClick={() => deleteMark(openMarkObj.id)} className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[color:var(--color-danger)] transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--color-danger)_70%,transparent)]">
                  Delete
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setOpenId(null)} className="rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ma-accent,var(--fr-accent))_20%,transparent)]">Cancel</button>
                  <button type="button" onClick={saveLabel} className={cn('rounded-md bg-[color:var(--fr-ma-accent,var(--fr-accent))] px-2.5 py-1.5 text-sm font-medium shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ma-accent,var(--fr-accent))_20%,transparent)]', slabInk)}>Save</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
