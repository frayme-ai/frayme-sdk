/**
 * Frayme FloorPlan — a select-only region picker (Pointer-canvas cluster, v1).
 *
 * The model authors REGIONS ONLY — rect { x,y,w,h } or poly { points } in
 * normalized 0..1 coordinates, each with a status + price — and the component
 * projects them into a fixed-aspect plan. Used for seat maps, venue/room
 * booking, parking, table reservations, zone pickers.
 *
 * POSTURE (v1 SCOPE CUT): SELECT-ONLY — a selection Set + a running total. NO
 * path/`d` regions, NO draw tool, NO region drag-move (deferred). This removes
 * the whole path-validator + rubber-band + pointer-capture risk cluster: regions
 * toggle on click, no pointer capture at all.
 *
 * A PROPS-LESS spec renders an empty placeholder — it MUST NOT fabricate priced
 * seats (that would emit select/commit for fake regions). The demo lives ONLY in
 * this `example`, never as the production default.
 *
 * SECURITY: rect coords via safeNumberIn(0..1), poly via safePointList
 * (cap 4096); a region invalid for its kind is SKIPPED; per-region color inline
 * (safeColor); prices via safeNumberIn (NaN/negative excluded from the total);
 * the total is formatted by US (toFixed(2)), never a spec-supplied format string;
 * regions capped at 400; labels + currency length-capped. sold/held/disabled are
 * non-selectable and excluded from the total.
 *
 * Component: FloorPlan.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

const regionSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  kind: z.enum(['rect', 'poly']),
  status: z.enum(['available', 'sold', 'held', 'disabled']).nullable(),
  price: z.number().nullable(),
  color: colorSchema,
  // rect geometry (normalized 0..1)
  x: z.number().nullable(),
  y: z.number().nullable(),
  w: z.number().nullable(),
  h: z.number().nullable(),
  // poly geometry (normalized 0..1 points)
  points: z.array(z.object({ x: z.number(), y: z.number() })).nullable(),
});

export const floorPlanComponents = {
  FloorPlan: {
    props: z.object({
      regions: z
        .array(regionSchema)
        .nullable()
        .describe('The selectable regions. Each is a rect { kind:"rect", x, y, w, h } or poly { kind:"poly", points:[{x,y}] } in normalized 0..1 coords, with { id, label?, status?, price?, color? }. status sold/held/disabled are not selectable. Omit → an empty placeholder (never fabricate seats). Capped at 400.'),
      selectedIds: z.array(z.string()).nullable().describe('Ids selected initially (only "available" regions; others ignored). Bindable: the live selection array is mirrored back here into (bindable) spec.state on every toggle/clear, so an external Button can read the current picks.'),
      multiSelect: z.boolean().nullable().describe('Allow selecting multiple regions (default true). When false, picking one replaces the selection.'),
      showTotal: z.boolean().nullable().describe('Show the running total + Confirm/Clear bar (default true).'),
      currency: z.string().nullable().describe('Currency symbol prefixed to the total (default "$", capped to 3 chars).'),
      stage: z
        .object({
          label: z.string().nullable(),
          edge: z.enum(['top', 'bottom', 'left', 'right', 'center']).nullable(),
          shape: z.enum(['bar', 'curve', 'block']).nullable(),
          size: z.number().nullable(),
          color: colorSchema,
        })
        .nullable()
        .describe('Optional non-interactive landmark orienting the plan — a stage, screen, pitch, ring, or "main event" area — as { label, edge: top|bottom|left|right|center (default top), shape: bar|curve|block (default bar), size?, color? }. shape:"curve" = a cinema-style screen arc (edges only), "bar" = a thin rounded band along the edge, "block" = a solid rounded rectangle (a center stage / dance floor / ring / a block hugging an edge). edge:"center" places it in the middle. `size` is a 0..1 fraction of the plan controlling the band thickness / block extent (default ~0.14 for bar, ~0.34 for a center block). Regions keep the full 0..1 space.'),
      aspect: z.number().nullable().describe('Plan width/height ratio (default 1.6, clamped 0.5..3).'),
      accent: colorSchema.describe('Selection fill + outline color (default the primary token).'),
      regionColor: colorSchema.describe('Default fill for available regions (default a light primary tint).'),
      lineColor: colorSchema.describe('Stroke colour of the region/room outlines drawn on the plan (default the `border` token); set a brand or higher-contrast colour to match the surrounding UI.'),
      mutedColor: colorSchema.describe('Labels + secondary text (default the muted-foreground token).'),
    }),
    description:
      'A select-only floor plan / seat map: author regions (rect or poly, normalized coords) with status + price, and the component renders a fixed-aspect plan with a running total. An optional `stage` landmark (a labeled bar or cinema-style curved screen on any edge) orients the plan — a stage, screen, pitch, or main-event area. Regions toggle on click (no drag, no pointer capture); sold/held/disabled are non-selectable and excluded from the total. Selectable regions are keyboard checkboxes; the total bar is a live status region. The live selection mirrors to (bindable) spec.state on every toggle, so an agent can read the current picks at any time. Stateless geometry, SSR-safe. Emits `select` (toggle, carries the full selection + total), `commit` (Confirm), `dismiss` (Clear).',
    example: {
      currency: '$',
      selectedIds: ['a1'],
      stage: { label: 'STAGE', edge: 'top', shape: 'curve' },
      regions: [
        { id: 'a1', label: 'A1', kind: 'rect', x: 0.08, y: 0.14, w: 0.16, h: 0.22, price: 120, status: 'available' },
        { id: 'a2', label: 'A2', kind: 'rect', x: 0.28, y: 0.14, w: 0.16, h: 0.22, price: 120, status: 'sold' },
        { id: 'a3', label: 'A3', kind: 'rect', x: 0.48, y: 0.14, w: 0.16, h: 0.22, price: 150, status: 'available' },
        { id: 'vip', label: 'VIP Box', kind: 'poly', points: [{ x: 0.72, y: 0.12 }, { x: 0.94, y: 0.12 }, { x: 0.94, y: 0.42 }, { x: 0.72, y: 0.42 }], price: 400, status: 'available', color: '#7c3aed' },
        { id: 'b1', label: 'B1', kind: 'rect', x: 0.08, y: 0.56, w: 0.16, h: 0.22, price: 90, status: 'available' },
        { id: 'b2', label: 'B2', kind: 'rect', x: 0.28, y: 0.56, w: 0.16, h: 0.22, price: 90, status: 'held' },
        { id: 'b3', label: 'B3', kind: 'rect', x: 0.48, y: 0.56, w: 0.16, h: 0.22, price: 110, status: 'available' },
      ],
    },
    events: ['select', 'commit', 'dismiss'],
    eventsDoc: {
      select: 'A region was toggled; params carry { id, selected, selection, count, total, currency, totalLabel }.',
      commit: 'Confirm was pressed; params carry { selection, count, total, totalLabel }.',
      dismiss: 'Clear was pressed; params carry { previousCount }.',
    },
  },
};
