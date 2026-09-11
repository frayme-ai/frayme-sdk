/**
 * Frayme MapView — a static geographic locator (Geo cluster).
 *
 * The model authors POINTS ONLY — markers of { lng, lat, label, tone|color } —
 * and the shared _geo engine (equirectangular projection) computes every
 * position + the graticule. Bounds auto-fit the markers unless given. v1 is a
 * coordinate locator (graticule + markers); the land outline is deferred.
 *
 * POSTURE: STATELESS pure-view, select-only. Marker hit-targets are HTML
 * <button>s in a PERCENT-positioned overlay over a stretched SVG grid (so they
 * track exactly, and focus rings render on real HTML). Per-marker color INLINE
 * (safeColor). Markers OUTSIDE the bounds are DROPPED (never clamp-stacked).
 *
 * SECURITY: lat/lng validated via safeLatLng (finite, in range) before
 * projection; the engine owns all geometry + caps the graticule (48 lines);
 * per-marker color inline-validated; labels escaped.
 *
 * Component: MapView.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

export const mapViewComponents = {
  MapView: {
    props: z.object({
      markers: z
        .array(
          z.object({
            id: z.string().nullable(),
            label: z.string().nullable(),
            lng: z.number(),
            lat: z.number(),
            tone: z.enum(['neutral', 'info', 'success', 'warning', 'critical']).nullable(),
            color: colorSchema,
            value: z.union([z.number(), z.string()]).nullable(),
          }),
        )
        .nullable()
        .describe('Map markers, each { lng, lat, id?, label?, tone?, color?, value? }. lat ∈ [-90,90], lng ∈ [-180,180]; invalid or out-of-bounds markers are dropped. Omit for a demo.'),
      bounds: z
        .object({ west: z.number(), east: z.number(), south: z.number(), north: z.number() })
        .nullable()
        .describe('Optional viewport { west, east, south, north } in degrees. Omit to auto-fit the markers with a small pad.'),
      showGraticule: z.boolean().nullable().describe('Draw the latitude/longitude reference grid (default true).'),
      showLabels: z.boolean().nullable().describe('Show marker labels + graticule degree labels (default true).'),
      selectedId: z.string().nullable().describe('Marker id drawn as selected (accent ring, label pinned); also bindable — a marker click writes the current selection here so an external Button can read the chosen id from state.'),
      confirmLabel: z.string().nullable().describe('Optional label for an internal confirm button (e.g. "Confirm selection") that emits `commit` with the currently-selected marker\'s full detail on demand; omit to hide it (external Button via bound `selectedId` still works).'),
      height: z.number().nullable().describe('Max map height in px (default 380, clamped 200..720).'),
      accent: colorSchema.describe('Selection ring + default marker color (default the primary token).'),
      waterColor: colorSchema.describe('Fill color of the map background behind the graticule (default a `muted` token); set a token or hex to theme the base plate.'),
      gridColor: colorSchema.describe('Color of the latitude/longitude graticule lines (default the `border` token); set a token or hex to make the grid subtler or bolder.'),
      mutedColor: colorSchema.describe('Degree labels + secondary text (default the muted-foreground token).'),
    }),
    description:
      'A static geographic locator: author markers by lng/lat (points only) and the equirectangular engine projects each onto an auto-fit graticule. Marker hit-targets are focusable HTML buttons in a percent-positioned overlay; per-marker color is inline; out-of-bounds markers are dropped. Stateless, SSR-safe; click a marker to emit `select`. A coordinate locator (no land outline in v1). Bind `selectedId` with `{ $bindState }` so the agent (or a sibling control) can read the clicked marker id from spec.state.',
    example: {
      showGraticule: true,
      showLabels: true,
      selectedId: 'sf',
      markers: [
        { id: 'sf', label: 'San Francisco', lng: -122.42, lat: 37.77, tone: 'info' },
        { id: 'ldn', label: 'London', lng: -0.13, lat: 51.51, tone: 'success' },
        { id: 'tky', label: 'Tokyo', lng: 139.69, lat: 35.69, tone: 'warning' },
      ],
    },
    events: ['select', 'commit'],
    eventsDoc: {
      select: 'A marker was clicked; params carry { id, label, value, lng, lat, tone }. The clicked id is also written to the bindable `selectedId` state.',
      commit: 'Fires when `confirmLabel` is set and the user clicks the confirm button; params carry the currently-selected marker\'s { id, label, value, lng, lat, tone } on demand (no need to replay the select stream).',
    },
  },
};
