# MapView

A static geographic locator: author markers by lng/lat (points only) and the equirectangular engine projects each onto an auto-fit graticule. Marker hit-targets are focusable HTML buttons in a percent-positioned overlay; per-marker color is inline; out-of-bounds markers are dropped. Stateless, SSR-safe; click a marker to emit `select`. A coordinate locator (no land outline in v1). Bind `selectedId` with `{ $bindState }` so the agent (or a sibling control) can read the clicked marker id from spec.state.

## Example

```json
{
  "root": "map-view",
  "elements": {
    "map-view": {
      "type": "MapView",
      "props": {
        "showGraticule": true,
        "showLabels": true,
        "selectedId": "sf",
        "markers": [
          {
            "id": "sf",
            "label": "San Francisco",
            "lng": -122.42,
            "lat": 37.77,
            "tone": "info"
          },
          {
            "id": "ldn",
            "label": "London",
            "lng": -0.13,
            "lat": 51.51,
            "tone": "success"
          },
          {
            "id": "tky",
            "label": "Tokyo",
            "lng": 139.69,
            "lat": 35.69,
            "tone": "warning"
          }
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `markers` | `({ id: string, label: string, lng: number, lat: number, tone: "neutral" \| "info" \| "success" \| "warning" \| "critical", color: string, value: number \| string })[]` | Map markers, each { lng, lat, id?, label?, tone?, color?, value? }. lat ∈ [-90,90], lng ∈ [-180,180]; invalid or out-of-bounds markers are dropped. Omit for a demo. |
| `bounds` | `{ west: number, east: number, south: number, north: number }` | Optional viewport { west, east, south, north } in degrees. Omit to auto-fit the markers with a small pad. |
| `showGraticule` | `boolean` | Draw the latitude/longitude reference grid (default true). |
| `showLabels` | `boolean` | Show marker labels + graticule degree labels (default true). |
| `selectedId` | `string` | Marker id drawn as selected (accent ring, label pinned); also bindable — a marker click writes the current selection here so an external Button can read the chosen id from state. |
| `confirmLabel` | `string` | Optional label for an internal confirm button (e.g. "Confirm selection") that emits `commit` with the currently-selected marker's full detail on demand; omit to hide it (external Button via bound `selectedId` still works). |
| `height` | `number` | Max map height in px (default 380, clamped 200..720). |
| `accent` | `string` | Selection ring + default marker color (default the primary token). |
| `waterColor` | `string` | Fill color of the map background behind the graticule (default a `muted` token); set a token or hex to theme the base plate. |
| `gridColor` | `string` | Color of the latitude/longitude graticule lines (default the `border` token); set a token or hex to make the grid subtler or bolder. |
| `mutedColor` | `string` | Degree labels + secondary text (default the muted-foreground token). |

## Events

### select

A marker was clicked; params carry { id, label, value, lng, lat, tone }. The clicked id is also written to the bindable `selectedId` state.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### commit

Fires when `confirmLabel` is set and the user clicks the confirm button; params carry the currently-selected marker's { id, label, value, lng, lat, tone } on demand (no need to replay the select stream).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
