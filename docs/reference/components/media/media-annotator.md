# MediaAnnotator

Annotate an image with pins, boxes, text notes, and freehand ink. Author an image + optional pre-placed marks; the user adds/labels/deletes annotations from a toolbar. One shared capture surface; coords are normalized to the object-contain image content box so marks stay aligned at any size. Stateless-seeded (owns the set), SSR-safe. Emits `commit` (create, with geometry), `change` (label/text edit), `select` (open), `dismiss` (delete/clear). v1: no drag-reposition. Bind `annotations` with `{ $bindState }` so the agent (or a sibling control) can read the live annotation set, each mark with its resolved geometry (pin/text {x,y}, box {x,y,w,h}, freehand {points}, normalized 0..1), from spec.state.

## Example

```json
{
  "root": "media-annotator",
  "elements": {
    "media-annotator": {
      "type": "MediaAnnotator",
      "props": {
        "mode": "select",
        "src": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800",
        "annotations": [
          {
            "id": "p1",
            "kind": "pin",
            "x": 0.32,
            "y": 0.4,
            "label": "Check exposure here"
          },
          {
            "id": "b1",
            "kind": "box",
            "x": 0.55,
            "y": 0.2,
            "w": 0.28,
            "h": 0.3,
            "label": "Crop region",
            "color": "#16a34a"
          },
          {
            "id": "f1",
            "kind": "freehand",
            "label": "Horizon line",
            "color": "#d97706",
            "points": [
              {
                "x": 0.08,
                "y": 0.66
              },
              {
                "x": 0.24,
                "y": 0.63
              },
              {
                "x": 0.42,
                "y": 0.64
              },
              {
                "x": 0.6,
                "y": 0.62
              }
            ]
          },
          {
            "id": "tx1",
            "kind": "text",
            "x": 0.4,
            "y": 0.82,
            "label": "Great composition here",
            "color": "#2563eb"
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
| `src` | `string` | Image URL or raster data: URI (http/https + raster data only; svg/blob rejected). Omit → a placeholder canvas. |
| `alt` | `string` | What the image SHOWS, for anyone who cannot see it. This image is the subject of the screen, the thing being annotated, so leaving it undescribed hands a screen-reader user a set of pins floating over nothing. Describe the scene, not the task: "Bathroom tiling with four snags marked", never "Annotated image". Omit only when the image is genuinely decorative, which for this component it never is. |
| `annotations` | `({ id: string, kind: "pin" \| "box" \| "freehand" \| "text", label: string, color: string, x: number, y: number, w: number, h: number, points: object[] })[]` | Pre-placed annotations, each a pin { kind:"pin", x, y }, box { kind:"box", x, y, w, h }, freehand { kind:"freehand", points:[{x,y}] }, or text { kind:"text", x, y, label } (the label is the shown text) in normalized 0..1 image-content-box coords, with { id?, label?, color? }. Invalid marks are skipped. Capped at 200. Bindable: the current annotation set (each mark with its resolved geometry, pin/text {x,y}, box {x,y,w,h}, freehand {points}, normalized 0..1) is mirrored back here into spec.state on every create/edit/delete/clear, so an external Button bound with { $bindState } can read all annotations. |
| `mode` | `"select" \| "pin" \| "box" \| "freehand" \| "text"` | Initial tool (default select). The toolbar switches tools (pin/box/text/draw); select lets you open/edit/delete a mark. |
| `editable` | `boolean` | Allow creating/editing/deleting annotations (default true). When false, a read-only viewer. |
| `showToolbar` | `boolean` | Show the toolbar of drawing tools (pin/box/text/draw) plus the clear action (default true); set false to hide it for a read-only or externally-controlled viewer. |
| `showLabels` | `boolean` | Show each annotation's text label on the canvas (default true). |
| `aspect` | `number` | Canvas width/height ratio (default 1.78, clamped 0.5..3). |
| `activeColor` | `string` | Color applied to newly created annotations (default the primary token). |
| `accent` | `string` | Selection outline + toolbar accent (default the primary token). |
| `mutedColor` | `string` | Labels + secondary text (default the muted-foreground token). |

## Events

### commit

A new annotation was created; params carry { id, kind, count } plus its drawn geometry, pin/text add { x, y }, box adds { x, y, w, h }, freehand adds { points:[{x,y}] } (normalized 0..1 image-content-box coords). A text mark is created empty; its content arrives via `change`.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### change

An annotation's label/text was edited; params carry { id, kind, label } (for a text mark the label IS the shown text).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### select

An annotation was opened; params carry { id, kind, label } plus its geometry, pin/text add { x, y } (text adds its { text }), box adds { x, y, w, h }, freehand adds { points:[{x,y}] } (normalized 0..1 coords).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### dismiss

An annotation was deleted, or all were cleared; params carry { id, kind } (delete) or { op:"clear", previousCount } (clear).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
