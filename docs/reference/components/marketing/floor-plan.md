# FloorPlan

A select-only floor plan / seat map: author regions (rect or poly, normalized coords) with status + price, and the component renders a fixed-aspect plan with a running total. An optional `stage` landmark (a labeled bar or cinema-style curved screen on any edge) orients the plan — a stage, screen, pitch, or main-event area. Regions toggle on click (no drag, no pointer capture); sold/held/disabled are non-selectable and excluded from the total. Selectable regions are keyboard checkboxes; the total bar is a live status region. The live selection mirrors to (bindable) spec.state on every toggle, so an agent can read the current picks at any time. Stateless geometry, SSR-safe. Emits `select` (toggle, carries the full selection + total), `commit` (Confirm), `dismiss` (Clear).

## Example

```json
{
  "root": "floor-plan",
  "elements": {
    "floor-plan": {
      "type": "FloorPlan",
      "props": {
        "currency": "$",
        "selectedIds": [
          "a1"
        ],
        "stage": {
          "label": "STAGE",
          "edge": "top",
          "shape": "curve"
        },
        "regions": [
          {
            "id": "a1",
            "label": "A1",
            "kind": "rect",
            "x": 0.08,
            "y": 0.14,
            "w": 0.16,
            "h": 0.22,
            "price": 120,
            "status": "available"
          },
          {
            "id": "a2",
            "label": "A2",
            "kind": "rect",
            "x": 0.28,
            "y": 0.14,
            "w": 0.16,
            "h": 0.22,
            "price": 120,
            "status": "sold"
          },
          {
            "id": "a3",
            "label": "A3",
            "kind": "rect",
            "x": 0.48,
            "y": 0.14,
            "w": 0.16,
            "h": 0.22,
            "price": 150,
            "status": "available"
          },
          {
            "id": "vip",
            "label": "VIP Box",
            "kind": "poly",
            "points": [
              {
                "x": 0.72,
                "y": 0.12
              },
              {
                "x": 0.94,
                "y": 0.12
              },
              {
                "x": 0.94,
                "y": 0.42
              },
              {
                "x": 0.72,
                "y": 0.42
              }
            ],
            "price": 400,
            "status": "available",
            "color": "#7c3aed"
          },
          {
            "id": "b1",
            "label": "B1",
            "kind": "rect",
            "x": 0.08,
            "y": 0.56,
            "w": 0.16,
            "h": 0.22,
            "price": 90,
            "status": "available"
          },
          {
            "id": "b2",
            "label": "B2",
            "kind": "rect",
            "x": 0.28,
            "y": 0.56,
            "w": 0.16,
            "h": 0.22,
            "price": 90,
            "status": "held"
          },
          {
            "id": "b3",
            "label": "B3",
            "kind": "rect",
            "x": 0.48,
            "y": 0.56,
            "w": 0.16,
            "h": 0.22,
            "price": 110,
            "status": "available"
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
| `regions` | `({ id: string, label: string, kind: "rect" \| "poly", status: "available" \| "sold" \| "held" \| "disabled", price: number, color: string, x: number, y: number, w: number, h: number, points: object[] })[]` | The selectable regions. Each is a rect { kind:"rect", x, y, w, h } or poly { kind:"poly", points:[{x,y}] } in normalized 0..1 coords, with { id, label?, status?, price?, color? }. status sold/held/disabled are not selectable. Omit → an empty placeholder (never fabricate seats). Capped at 400. |
| `selectedIds` | `string[]` | Ids selected initially (only "available" regions; others ignored). Bindable: the live selection array is mirrored back here into (bindable) spec.state on every toggle/clear, so an external Button can read the current picks. |
| `multiSelect` | `boolean` | Allow selecting multiple regions (default true). When false, picking one replaces the selection. |
| `showTotal` | `boolean` | Show the running total + Confirm/Clear bar (default true). |
| `currency` | `string` | Currency symbol prefixed to the total (default "$", capped to 3 chars). |
| `stage` | `{ label: string, edge: "top" \| "bottom" \| "left" \| "right" \| "center", shape: "bar" \| "curve" \| "block", size: number, color: string }` | Optional non-interactive landmark orienting the plan — a stage, screen, pitch, ring, or "main event" area — as { label, edge: top\|bottom\|left\|right\|center (default top), shape: bar\|curve\|block (default bar), size?, color? }. shape:"curve" = a cinema-style screen arc (edges only), "bar" = a thin rounded band along the edge, "block" = a solid rounded rectangle (a center stage / dance floor / ring / a block hugging an edge). edge:"center" places it in the middle. `size` is a 0..1 fraction of the plan controlling the band thickness / block extent (default ~0.14 for bar, ~0.34 for a center block). Regions keep the full 0..1 space. |
| `aspect` | `number` | Plan width/height ratio (default 1.6, clamped 0.5..3). |
| `accent` | `string` | Selection fill + outline color (default the primary token). |
| `regionColor` | `string` | Default fill for available regions (default a light primary tint). |
| `lineColor` | `string` | Stroke colour of the region/room outlines drawn on the plan (default the `border` token); set a brand or higher-contrast colour to match the surrounding UI. |
| `mutedColor` | `string` | Labels + secondary text (default the muted-foreground token). |

## Events

### select

A region was toggled; params carry { id, selected, selection, count, total, currency, totalLabel }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### commit

Confirm was pressed; params carry { selection, count, total, totalLabel }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### dismiss

Clear was pressed; params carry { previousCount }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
