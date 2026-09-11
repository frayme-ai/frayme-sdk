# Tree

A hierarchical expand/collapse tree. Branch rows toggle their children (aria-expanded); recursion is hard-capped by `maxDepth` and array-guarded at every level. When `selectable`, clicking a row selects its `value` locally (works with no binding) and emits `select`. role=tree / treeitem. Bind `value`, `expandedPaths` with `{ $bindState }` so the agent (or a sibling control) can read the current selection and the open/collapsed branch paths from spec.state.

## Example

```json
{
  "root": "tree",
  "elements": {
    "tree": {
      "type": "Tree",
      "props": {
        "nodes": [
          {
            "label": "src",
            "children": [
              {
                "label": "components",
                "children": [
                  {
                    "label": "Button.tsx"
                  },
                  {
                    "label": "Card.tsx"
                  }
                ]
              },
              {
                "label": "index.ts"
              }
            ]
          },
          {
            "label": "package.json"
          }
        ],
        "defaultExpandedDepth": 1,
        "selectable": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `nodes` | `lazy[]` | The root nodes. Each: a label, an optional icon NAME, an optional `value` (returned on select), and optional `children` of the same shape (nested any depth — capped by `maxDepth`). |
| `maxDepth` | `number` | Hard cap on nesting depth rendered (1–8, default 6). Nodes deeper than this are not rendered, bounding the recursion. A plain count, not a visual dimension. |
| `defaultExpandedDepth` | `number` | Expand all nodes down to this depth on first render (0 = all collapsed, default). Below it nodes start collapsed. A plain count, not a visual dimension. |
| `selectable` | `boolean` | Make node rows selectable: clicking a leaf/label sets the selected `value` (locally, no binding needed) and emits `select`. Off by default (expand/collapse only). |
| `value` | `string` | The selected node value, mirrored here into spec.state (works with {$bindState}) so an external control can read the current selection; falls back to the node label when the node has no value. |
| `expandedPaths` | `string[]` | The currently-expanded branch paths (dot-joined node indices, e.g. "0.1"), mirrored here into spec.state so an external control can read/restore the open/collapsed tree. |
| `emptyText` | `string` | Message shown when there are no nodes (default "No items"). Set to localise or contextualise the empty tree; escaped text. |
| `size` | `"sm" \| "md" \| "lg"` | Row density — the vertical padding + label text size of every row: sm (dense file list, ~13px) · md (default, 14px) · lg (spacious doc nav, 16px). |
| `accent` | `string` | Color of the selected row — its text plus a soft 14% row fill (default primary token). Names a specific brand color. |
| `lineColor` | `string` | Color of the resting tree furniture — the expand/collapse chevrons and the node icon glyphs (default the muted-foreground token); no indent-guide lines are rendered. The selected row still uses `accent`. |

## Events

### select

A node row was clicked (or Enter/Space) while `selectable` is on; params carry {value} — the node `value`, falling back to its label.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### change

A branch was expanded or collapsed (chevron click, ArrowRight/ArrowLeft, or Enter on a branch); params carry {expandedPaths, value} — the full resolved array of open node paths plus the currently selected value (or null).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
