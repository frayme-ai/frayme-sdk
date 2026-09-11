/**
 * Frayme MediaAnnotator — annotate an image with pins, boxes, and freehand ink
 * (Pointer-canvas cluster).
 *
 * The model authors an image `src` + optional pre-placed `annotations` (normalized
 * 0..1 coords); the user adds pins / boxes / freehand strokes via the toolbar, then
 * labels or deletes them. Used for design review, medical imaging markup, bug
 * capture, inspection, moderation, photo callouts.
 *
 * POSTURE: OWNS-THE-SET (annotations are internal state seeded from props). ONE
 * capture surface — the freehand engine (usePointerStrokes) and the pin/box pointer
 * handlers share a single overlay SVG, dispatched by the active tool. Committed
 * freehand renders from the folded MARK objects; the engine buffer is transient
 * capture only (single-owner, no double-render).
 *
 * v1 SCOPE (documented, like FloorPlan): CREATE (pin tap / box drag / freehand draw)
 * + SELECT + edit-label + delete + clear. Drag-REPOSITION / RESIZE of existing marks
 * is DEFERRED (it re-opens the move/resize pointer-capture contract) — so v1 emits
 * commit / change / select / dismiss (no `move`). Create/draw is pointer-only;
 * view + select + delete are keyboard-reachable.
 *
 * IMAGE FIT: object-contain (letterbox); annotation coords are normalized to the
 * RENDERED IMAGE CONTENT BOX (measured on load), so a pin lands where the user
 * clicked at any container size / aspect mismatch. src → safeImageSrc (http/https +
 * raster data: only) with a placeholder fallback; the box has a fixed aspect to
 * prevent layout jump.
 *
 * SECURITY: pins via safePoint, boxes via safeNumberIn(0..1), freehand via
 * safePointList (cap 4096); an annotation invalid for its kind is SKIPPED; per-mark
 * color inline (safeColor); MAX_ANNOTATIONS 200 enforced at seed AND in every create
 * handler; labels capped 200 chars at seed + edit; the image passes safeImageSrc; all
 * text escaped.
 *
 * Component: MediaAnnotator.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

const annotationSchema = z.object({
  id: z.string().nullable(),
  kind: z.enum(['pin', 'box', 'freehand', 'text']),
  label: z.string().nullable(),
  color: colorSchema,
  // pin: x,y  · box: x,y,w,h  · (all normalized 0..1 of the image content box)
  x: z.number().nullable(),
  y: z.number().nullable(),
  w: z.number().nullable(),
  h: z.number().nullable(),
  // freehand
  points: z.array(z.object({ x: z.number(), y: z.number() })).nullable(),
});

export const mediaAnnotatorComponents = {
  MediaAnnotator: {
    props: z.object({
      src: z.string().nullable().describe('Image URL or raster data: URI (http/https + raster data only; svg/blob rejected). Omit → a placeholder canvas.'),
      alt: z
        .string()
        .nullable()
        .describe('What the image SHOWS, for anyone who cannot see it. This image is the subject of the screen — the thing being annotated — so leaving it undescribed hands a screen-reader user a set of pins floating over nothing. Describe the scene, not the task: "Bathroom tiling with four snags marked", never "Annotated image". Omit only when the image is genuinely decorative, which for this component it never is.'),
      annotations: z
        .array(annotationSchema)
        .nullable()
        .describe('Pre-placed annotations, each a pin { kind:"pin", x, y }, box { kind:"box", x, y, w, h }, freehand { kind:"freehand", points:[{x,y}] }, or text { kind:"text", x, y, label } (the label is the shown text) in normalized 0..1 image-content-box coords, with { id?, label?, color? }. Invalid marks are skipped. Capped at 200. Bindable: the current annotation set (each mark with its resolved geometry — pin/text {x,y}, box {x,y,w,h}, freehand {points}, normalized 0..1) is mirrored back here into spec.state on every create/edit/delete/clear, so an external Button bound with { $bindState } can read all annotations.'),
      mode: z.enum(['select', 'pin', 'box', 'freehand', 'text']).nullable().describe('Initial tool (default select). The toolbar switches tools (pin/box/text/draw); select lets you open/edit/delete a mark.'),
      editable: z.boolean().nullable().describe('Allow creating/editing/deleting annotations (default true). When false, a read-only viewer.'),
      showToolbar: z.boolean().nullable().describe('Show the toolbar of drawing tools (pin/box/text/draw) plus the clear action (default true); set false to hide it for a read-only or externally-controlled viewer.'),
      showLabels: z.boolean().nullable().describe('Show each annotation\'s text label on the canvas (default true).'),
      aspect: z.number().nullable().describe('Canvas width/height ratio (default 1.78, clamped 0.5..3).'),
      activeColor: colorSchema.describe('Color applied to newly created annotations (default the primary token).'),
      accent: colorSchema.describe('Selection outline + toolbar accent (default the primary token).'),
      mutedColor: colorSchema.describe('Labels + secondary text (default the muted-foreground token).'),
    }),
    description:
      'Annotate an image with pins, boxes, text notes, and freehand ink. Author an image + optional pre-placed marks; the user adds/labels/deletes annotations from a toolbar. One shared capture surface; coords are normalized to the object-contain image content box so marks stay aligned at any size. Stateless-seeded (owns the set), SSR-safe. Emits `commit` (create, with geometry), `change` (label/text edit), `select` (open), `dismiss` (delete/clear). v1: no drag-reposition. Bind `annotations` with `{ $bindState }` so the agent (or a sibling control) can read the live annotation set — each mark with its resolved geometry (pin/text {x,y}, box {x,y,w,h}, freehand {points}, normalized 0..1) — from spec.state.',
    example: {
      mode: 'select',
      src: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
      annotations: [
        { id: 'p1', kind: 'pin', x: 0.32, y: 0.4, label: 'Check exposure here' },
        { id: 'b1', kind: 'box', x: 0.55, y: 0.2, w: 0.28, h: 0.3, label: 'Crop region', color: '#16a34a' },
        { id: 'f1', kind: 'freehand', label: 'Horizon line', color: '#d97706', points: [{ x: 0.08, y: 0.66 }, { x: 0.24, y: 0.63 }, { x: 0.42, y: 0.64 }, { x: 0.6, y: 0.62 }] },
        { id: 'tx1', kind: 'text', x: 0.4, y: 0.82, label: 'Great composition here', color: '#2563eb' },
      ],
    },
    events: ['commit', 'change', 'select', 'dismiss'],
    eventsDoc: {
      commit: 'A new annotation was created; params carry { id, kind, count } plus its drawn geometry — pin/text add { x, y }, box adds { x, y, w, h }, freehand adds { points:[{x,y}] } (normalized 0..1 image-content-box coords). A text mark is created empty; its content arrives via `change`.',
      change: "An annotation's label/text was edited; params carry { id, kind, label } (for a text mark the label IS the shown text).",
      select: 'An annotation was opened; params carry { id, kind, label } plus its geometry — pin/text add { x, y } (text adds its { text }), box adds { x, y, w, h }, freehand adds { points:[{x,y}] } (normalized 0..1 coords).',
      dismiss: 'An annotation was deleted, or all were cleared; params carry { id, kind } (delete) or { op:"clear", previousCount } (clear).',
    },
  },
};
