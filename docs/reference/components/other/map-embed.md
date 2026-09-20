# MapEmbed

The map widget: renders a real interactive map in a hardened, hostname-allowlisted, sandboxed iframe, a keyless OpenStreetMap embed when a `center` {lat,lng} is given, or your official Google Maps / Mapbox `embedUrl` (built with your own key, which Frayme never stores). Where a surface blocks frames or only a text `query` is known, it degrades to a static location card with a coordinate locator and an "Open in Google Maps" link. Provide `query` for an address label or `center` for a live map; set `selectable` to emit `commit` with the resolved location. Bind `selectedLocation` with { $bindState } so the agent (or a sibling control) can read the chosen location { query, center, zoom, source } from spec.state.

## Example

```json
{
  "root": "map-embed",
  "elements": {
    "map-embed": {
      "type": "MapEmbed",
      "props": {
        "query": "Eiffel Tower, Paris",
        "center": {
          "lat": 48.8584,
          "lng": 2.2945
        },
        "title": "Map of the Eiffel Tower",
        "placeName": "Eiffel Tower",
        "zoom": 15,
        "selectable": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `query` | `string` | A place name or address (e.g. "Eiffel Tower, Paris") shown as the card label and turned into the "Open in Google Maps" link; URL-encoded and length-capped before use. |
| `center` | `{ lat: number, lng: number }` | An optional { lat, lng } coordinate (lat -90..90, lng -180..180) that renders a live keyless OpenStreetMap embed centered on the point (and the static locator fallback); an invalid point is ignored. This is the map's ONLY pin, there is no markers or route prop; for several stops, centre on the most important one, widen `zoom` to cover the rest, and name them in `title` or a caption. |
| `zoom` | `number` | Map zoom level, clamped 1..21 (default 14); controls how tight the coordinate embed frames the point. Higher is closer in. |
| `embedUrl` | `string` | Optional official embed URL you build with your OWN provider key (Google Maps Embed API / Mapbox / OpenStreetMap); https + a hostname allowlist are enforced. Wins over query/center. Frayme never stores the key. |
| `interactive` | `boolean` | Embed the live, pannable map in a sandboxed iframe (default true). Set false ONLY when the host surface cannot show frames (a locked MCP surface), never because the request wants a route or several pins: the map shows ONE pin at `center`, so centre it on the most important point and list the other stops in a caption. The server drops a `false` that has no such reason. |
| `title` | `string` | Accessible title for the map region and the card heading, e.g. "Map of our London office" (default "Map"). Escaped text, length-capped. |
| `placeName` | `string` | Human-readable place label shown on the static card and used in the link's accessible name; falls back to `query` then `title`. Escaped text, length-capped. |
| `showCoords` | `boolean` | Show the formatted latitude/longitude line under the place label when a valid `center` is present (default true); has no effect in query-only mode. |
| `selectable` | `boolean` | Add a "Use this location" button that emits the canonical `commit` event with the resolved location (default false); a pure signal, no navigation or fetch. |
| `selectedLocation` | `{ query: string, center: { lat: number, lng: number }, zoom: number, source: "query" \| "center" }` | Bindable holder for the chosen location { query, center, zoom, source }; the "Use this location" click writes the resolved value here so an external Button can read it from state without replaying the commit event. |
| `aspect` | `"auto" \| "1/1" \| "4/3" \| "3/2" \| "16/9" \| "21/9" \| "3/4"` | Fixed aspect-ratio of the map body to prevent layout jump (default 16/9); "auto" is treated as 16/9 to keep a bounded height. |
| `height` | `string \| number` | Optional exact height for the map body (e.g. "320px") that overrides the aspect box; validated and clamped to 120..800. |
| `accent` | `string` | Brand color for the locator pin, the "Use this location" focus ring and the open-map link (default the primary token); a bad value falls back to the token. |
| `borderColor` | `string` | Resting border color of the card and map frame (default the border token); a validated color placed behind a token fallback. |
| `radiusValue` | `string \| number` | Exact corner radius of the card and map frame (e.g. "12px"); overrides the default rounding, bounded to px/rem 0..64. |

## Events

### commit

Fires when `selectable` is on and the user clicks "Use this location"; params carry { query, center, zoom, source } for the resolved location.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
