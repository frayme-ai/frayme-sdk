'use client';
import { useRef, useState, useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/* CanvasSurface — the shared 2D pointer-capture engine.
 *
 * Powers SignaturePad (and, later, MediaAnnotator freehand + FloorPlan draw). It
 * captures pointer strokes over a ref'd surface as NORMALIZED [0,1] points, so
 * the geometry is render-size-independent and stays correct across any layout.
 *
 * SECURITY (§4.6): every captured coordinate is clamped to [0,1] and
 * Number.isFinite-checked at the point of capture (bad geometry can never enter
 * state), each stroke's point count and the total stroke count are hard-capped
 * (render-bomb guard), and the surface only ever produces NUMBERS — the consuming
 * component owns the SVG markup. This mirrors the catalog `safePoint`/
 * `safePointList` validators (the spec-side equivalent for pre-supplied geometry).
 *
 * The emit contract: `onChange` is invoked from POINTER EVENT HANDLERS only
 * (pointer-up / clear), NEVER inside a state updater — emitting inside an updater
 * runs during render and triggers a cross-component setState. Handlers read the
 * latest strokes from a ref, so no functional-updater emit is needed. */

export type NormPoint = { x: number; y: number };

const MAX_POINTS_PER_STROKE = 2048;
const MAX_STROKES = 256;

export interface CanvasSurface {
  /** Ref to attach to the drawable SVG element (used to normalize pointer coords). */
  surfaceRef: React.MutableRefObject<SVGSVGElement | null>;
  /** The captured strokes — each a list of normalized [0,1] points. */
  strokes: NormPoint[][];
  /** True while a stroke is in progress. */
  drawing: boolean;
  /** Spread onto the drawable surface. */
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerLeave: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
    onLostPointerCapture: (e: ReactPointerEvent) => void;
  };
  /** Remove all strokes. */
  clear: () => void;
  /** Remove the most recent stroke. */
  undo: () => void;
  /** True when there are no strokes. */
  empty: boolean;
}

export function usePointerStrokes(
  onChange?: (strokes: NormPoint[][], empty: boolean) => void,
  disabled?: boolean,
): CanvasSurface {
  const surfaceRef = useRef<SVGSVGElement | null>(null);
  const strokesRef = useRef<NormPoint[][]>([]);
  const [strokes, setStrokes] = useState<NormPoint[][]>([]);
  const [drawing, setDrawing] = useState(false);
  const drawingRef = useRef(false);

  // Single write path: mirror to the ref (so handlers can read the latest without
  // a functional updater) AND to state (for render). No emit happens here.
  const commit = useCallback((next: NormPoint[][]) => {
    strokesRef.current = next;
    setStrokes(next);
  }, []);

  const toNorm = useCallback((e: ReactPointerEvent): NormPoint | null => {
    const el = surfaceRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (disabled) return;
      if (strokesRef.current.length >= MAX_STROKES) return;
      const p = toNorm(e);
      if (!p) return;
      drawingRef.current = true;
      setDrawing(true);
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* setPointerCapture can throw on stale pointers — ignore */
      }
      commit([...strokesRef.current, [p]]);
    },
    [disabled, toNorm, commit],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!drawingRef.current) return;
      const p = toNorm(e);
      if (!p) return;
      const cur = strokesRef.current;
      if (!cur.length) return;
      const last = cur[cur.length - 1];
      if (last.length >= MAX_POINTS_PER_STROKE) return;
      commit([...cur.slice(0, -1), [...last, p]]);
    },
    [toNorm, commit],
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setDrawing(false);
    const s = strokesRef.current;
    onChange?.(s, s.every((st) => st.length === 0)); // emit in the handler, never an updater
  }, [onChange]);

  const clear = useCallback(() => {
    commit([]);
    onChange?.([], true);
  }, [commit, onChange]);

  const undo = useCallback(() => {
    const next = strokesRef.current.slice(0, -1);
    commit(next);
    onChange?.(next, next.length === 0);
  }, [commit, onChange]);

  return {
    surfaceRef,
    strokes,
    drawing,
    // pointercancel (OS/gesture interrupt) + lostpointercapture (capture yanked)
    // MUST end the stroke too — otherwise drawingRef strands and the next pointer
    // move keeps drawing a "ghost" stroke the user never started. endStroke is
    // idempotent (guards on drawingRef), so the up→lostcapture pair is safe.
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endStroke,
      onPointerLeave: endStroke,
      onPointerCancel: endStroke,
      onLostPointerCapture: endStroke,
    },
    clear,
    undo,
    empty: strokes.length === 0,
  };
}

/** Build an SVG polyline `points` string from normalized [0,1] points over a
 * fixed 0..1000 viewBox (paired with preserveAspectRatio="none" +
 * vector-effect="non-scaling-stroke" so the ink stays uniform at any size). */
export function pointsAttr(stroke: NormPoint[]): string {
  return stroke.map((p) => `${(p.x * 1000).toFixed(1)},${(p.y * 1000).toFixed(1)}`).join(' ');
}
