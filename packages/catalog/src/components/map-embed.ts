/**
 * Frayme MapEmbed — the "Google Maps widget" (Geo cluster).
 *
 * Renders a REAL interactive map in a hardened, hostname-allowlisted, sandboxed
 * iframe — built keyless from a `query` / `center` (the classic no-API-key
 * ?output=embed), or from an official `embedUrl` the host builds with THEIR own
 * key (Frayme never stores a key). Where a surface blocks frames (the strict MCP
 * Apps CSP `frame-src`) or no valid src can be built, it degrades to a static
 * location card — a labeled surface (+ a static SVG locator when a coordinate is
 * given) with an always-present "Open in Google Maps" link.
 *
 * POSTURE: display component; an optional "Use this location" CTA emits `commit`.
 *
 * SECURITY: the iframe src passes safeEmbedUrl (https + Google/Mapbox/OSM
 * hostname allowlist — the component-level backstop, since there is no host
 * `frame-src` CSP yet); the frame is sandboxed (allow-scripts allow-same-origin
 * allow-popups) with a strict referrer policy; `query` is encodeURIComponent'd and
 * every built URL re-checked by safeUrl/safeEmbedUrl; `center` is safeLatLng-
 * validated; the open-out link carries rel="noopener noreferrer"; all text is
 * escaped; Frayme never holds or logs an API key (only the host's URL carries one).
 *
 * Component: MapEmbed.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

export const mapEmbedComponents = {
  MapEmbed: {
    props: z.object({
      query: z.string().nullable().describe('A place name or address (e.g. "Eiffel Tower, Paris") shown as the card label and turned into the "Open in Google Maps" link; URL-encoded and length-capped before use.'),
      center: z.object({ lat: z.number(), lng: z.number() }).nullable().describe('An optional { lat, lng } coordinate (lat -90..90, lng -180..180) that renders a live keyless OpenStreetMap embed centered on the point (and the static locator fallback); an invalid point is ignored. This is the map\'s ONLY pin — there is no markers or route prop; for several stops, centre on the most important one, widen `zoom` to cover the rest, and name them in `title` or a caption.'),
      zoom: z.number().nullable().describe('Map zoom level, clamped 1..21 (default 14); controls how tight the coordinate embed frames the point. Higher is closer in.'),
      embedUrl: z.string().nullable().describe('Optional official embed URL you build with your OWN provider key (Google Maps Embed API / Mapbox / OpenStreetMap); https + a hostname allowlist are enforced. Wins over query/center. Frayme never stores the key.'),
      interactive: z.boolean().nullable().describe('Embed the live, pannable map in a sandboxed iframe (default true). Set false ONLY when the host surface cannot show frames (a locked MCP surface) — never because the request wants a route or several pins: the map shows ONE pin at `center`, so centre it on the most important point and list the other stops in a caption. The server drops a `false` that has no such reason.'),
      title: z.string().nullable().describe('Accessible title for the map region and the card heading, e.g. "Map of our London office" (default "Map"). Escaped text, length-capped.'),
      placeName: z.string().nullable().describe('Human-readable place label shown on the static card and used in the link\'s accessible name; falls back to `query` then `title`. Escaped text, length-capped.'),
      showCoords: z.boolean().nullable().describe('Show the formatted latitude/longitude line under the place label when a valid `center` is present (default true); has no effect in query-only mode.'),
      selectable: z.boolean().nullable().describe('Add a "Use this location" button that emits the canonical `commit` event with the resolved location (default false); a pure signal, no navigation or fetch.'),
      selectedLocation: z.object({ query: z.string().nullable(), center: z.object({ lat: z.number(), lng: z.number() }).nullable(), zoom: z.number().nullable(), source: z.enum(['query', 'center']).nullable() }).nullable().describe('Bindable holder for the chosen location { query, center, zoom, source }; the "Use this location" click writes the resolved value here so an external Button can read it from state without replaying the commit event.'),
      aspect: z.enum(['auto', '1/1', '4/3', '3/2', '16/9', '21/9', '3/4']).nullable().describe('Fixed aspect-ratio of the map body to prevent layout jump (default 16/9); "auto" is treated as 16/9 to keep a bounded height.'),
      height: dimensionSchema({ units: ['px', 'rem'], min: 120, max: 800 }).describe('Optional exact height for the map body (e.g. "320px") that overrides the aspect box; validated and clamped to 120..800.'),
      accent: colorSchema.describe('Brand color for the locator pin, the "Use this location" focus ring and the open-map link (default the primary token); a bad value falls back to the token.'),
      borderColor: colorSchema.describe('Resting border color of the card and map frame (default the border token); a validated color placed behind a token fallback.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the card and map frame (e.g. "12px"); overrides the default rounding, bounded to px/rem 0..64.'),
    }),
    description:
      'The map widget: renders a real interactive map in a hardened, hostname-allowlisted, sandboxed iframe — a keyless OpenStreetMap embed when a `center` {lat,lng} is given, or your official Google Maps / Mapbox `embedUrl` (built with your own key, which Frayme never stores). Where a surface blocks frames or only a text `query` is known, it degrades to a static location card with a coordinate locator and an "Open in Google Maps" link. Provide `query` for an address label or `center` for a live map; set `selectable` to emit `commit` with the resolved location. Bind `selectedLocation` with { $bindState } so the agent (or a sibling control) can read the chosen location { query, center, zoom, source } from spec.state.',
    example: {
      query: 'Eiffel Tower, Paris',
      center: { lat: 48.8584, lng: 2.2945 },
      title: 'Map of the Eiffel Tower',
      placeName: 'Eiffel Tower',
      zoom: 15,
      selectable: true,
    },
    events: ['commit'],
    eventsDoc: {
      commit: 'Fires when `selectable` is on and the user clicks "Use this location"; params carry { query, center, zoom, source } for the resolved location.',
    },
  },
};
