# NodeGraph

A directed graph / flowchart / live pipeline: author nodes + edges (structure only) and the engine computes a deterministic layered layout with routed connectors and arrowheads. Each node can carry a status (idle/running/done/error/blocked) with a progress bar, an icon, a sublabel and a meta badge, turning it into a live agent-execution view. Node hit-targets are focusable HTML buttons; single-select by default, or set multiSelect to pick a bindable set of nodes. Stateless-seeded, SSR-safe; click a node to emit `select`.

## Example

```json
{
  "root": "node-graph",
  "elements": {
    "node-graph": {
      "type": "NodeGraph",
      "props": {
        "direction": "TB",
        "multiSelect": false,
        "nodes": [
          {
            "id": "ingest",
            "label": "Ingest data",
            "sublabel": "1,204 rows",
            "status": "done",
            "meta": "0.8s"
          },
          {
            "id": "clean",
            "label": "Clean & validate",
            "status": "done",
            "meta": "1.2s"
          },
          {
            "id": "embed",
            "label": "Generate embeddings",
            "sublabel": "model: text-3",
            "status": "running",
            "progress": 62
          },
          {
            "id": "index",
            "label": "Build index",
            "status": "blocked"
          },
          {
            "id": "deploy",
            "label": "Deploy",
            "status": "idle"
          }
        ],
        "edges": [
          {
            "from": "ingest",
            "to": "clean"
          },
          {
            "from": "clean",
            "to": "embed"
          },
          {
            "from": "embed",
            "to": "index"
          },
          {
            "from": "index",
            "to": "deploy"
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
| `nodes` | `({ id: string, label: string, sublabel: string, icon: string, status: "idle" \| "running" \| "done" \| "error" \| "blocked", progress: number, meta: string, tone: "neutral" \| "info" \| "success" \| "warning" \| "critical", color: string, group: string })[]` | The graph nodes { id, label?, status?, progress?, sublabel?, icon?, meta?, tone?, color?, group? }. Omit for a demo pipeline. Capped at 120. |
| `edges` | `({ from: string, to: string, label: string })[]` | Directed edges { from, to, label? } referencing node ids. Self-edges + unknown ids are dropped; cycles are broken for layout. Capped at 240. |
| `direction` | `"TB" \| "LR"` | Layout flow direction: TB (top→bottom, the default) or LR (left→right). |
| `nodeShape` | `"rounded" \| "pill" \| "rect"` | Shape of each node box: rounded, pill, or rect (default rounded). |
| `multiSelect` | `boolean` | Allow selecting a SET of nodes (default false, single-select). When true, clicking toggles a node in the selection and `select` carries the full set. |
| `selectedIds` | `string[]` | Node ids selected initially (multi-select). Bind with { $bindState } so an external Button can read the current node selection from spec.state. |
| `showStatus` | `boolean` | Show the per-node status indicator + progress bar when a node has a status/progress (default true). |
| `showArrows` | `boolean` | Draw directional arrowheads at the target end of each edge (default `true`); set `false` for an undirected/plain-connector look. |
| `showEdgeLabels` | `boolean` | Render the label text on edges that have one (default true). |
| `nodeWidth` | `number` | Width of every node box in px (default `168`, clamped `64..300`); widen for longer labels or narrow for a compact graph. |
| `nodeHeight` | `number` | Node height in px (default auto, taller for status/sublabel nodes, clamped 32..140). |
| `accent` | `string` | Default node border + selection-ring + progress-bar color (default the primary token). |
| `lineColor` | `string` | Edge line + arrowhead color (default the border token). |
| `mutedColor` | `string` | Edge labels, sublabels + secondary text (default the muted-foreground token). |

## Events

### select

A node was clicked. Single-select: params carry { id, label, value, index, group, status }. Multi-select (multiSelect=true): params carry { id, selected, selection (all selected ids), count, nodes (the selected {id,label,status}) }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
