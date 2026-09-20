# VirtualList

A long list rendered with hand-rolled virtualization (only the visible rows are in the DOM, for performance). It scrolls inside a fixed-height viewport; with `selectable`, clicking a row selects it (live without a binding) and emits `select`. Use for big option/result lists. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the currently selected row value from spec.state.

## Example

```json
{
  "root": "virtual-list",
  "elements": {
    "virtual-list": {
      "type": "VirtualList",
      "props": {
        "items": [
          {
            "label": "Alpha",
            "description": "First item"
          },
          {
            "label": "Bravo",
            "description": "Second item"
          },
          {
            "label": "Charlie",
            "description": "Third item"
          }
        ],
        "selectable": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ label: string, description: string, icon: string, value: string, trailing: string })[]` | The list rows. Each: a label, an optional muted description, an optional leading icon NAME (closed registry), an optional value (used for selection), and an optional trailing text. Only the visible slice is rendered. |
| `itemHeight` | `number` | Fixed row height in pixels (default 44). Windowing needs a fixed height; if omitted every row renders. A plain px count, not a CSS dimension. |
| `maxHeight` | `string \| number` | Height of the scroll viewport (e.g. "20rem"; default 20rem). The list scrolls inside it. Drives `--fr-vlist-h`. |
| `overscan` | `number` | Extra rows rendered above/below the visible window for smooth scrolling (default 4). A plain count. |
| `selectable` | `boolean` | Make rows clickable, clicking sets the selected value and emits `select` (default false). |
| `value` | `string` | The currently selected row value (the clicked row's `value`, falling back to its label). Mirrored back here into spec.state so it works with {$bindState}, bind it and an external control (e.g. a Submit Button) can read the current selection. |
| `mutedColor` | `string` | Secondary/muted text colour, each row description, the trailing meta text, the row leading icon, and the empty-state label (default the muted-foreground token). |
| `bg` | `string` | Background fill of the list viewport (default the card token). Names a specific brand color. |
| `color` | `string` | Primary text colour, each row label (default the foreground token). |
| `borderColor` | `string` | Border colour of the list viewport AND the dividers between rows, so both travel together (default the border token). |
| `radiusValue` | `string \| number` | Exact corner rounding of the list viewport (e.g. "12px"; default the Frayme radius token). |

## Events

### select

A row was clicked while `selectable` is on (also sets the selection locally); params carry {value, label}, the row `value`, falling back to its label.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
