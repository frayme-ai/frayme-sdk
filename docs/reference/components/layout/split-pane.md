# SplitPane

Two resizable panes (give it EXACTLY two children) separated by a draggable divider. Drag the divider (or focus it and use the arrow keys) to resize; the split stays live without any binding. Use for a list/detail or editor/preview layout.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "split-pane",
  "elements": {
    "split-pane": {
      "type": "SplitPane",
      "props": {
        "orientation": "horizontal",
        "splitPercent": 40
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical"` | Split axis: horizontal (default — two panes side-by-side, vertical divider) · vertical (stacked panes, horizontal divider). |
| `splitPercent` | `number` | Starting size of the FIRST pane as a percentage (10–90, default 50). Drag the divider to change it; a plain percentage, not a CSS dimension. |
| `minSize` | `number` | Minimum size of EITHER pane as a percentage (the drag clamps between this and 100−this; default 10). A plain percentage, not a CSS dimension. |
| `height` | `string \| number` | Height of the whole split container (e.g. "24rem" or "400px"; default 24rem). Drives `--fr-splitpane-h`. |
| `bordered` | `boolean` | Wrap the container in a rounded bordered card (default true). |
| `bg` | `string` | Background fill of the split container (default the card token). Names a specific brand color. |
| `color` | `string` | Text colour inside the panes (default the foreground token). |
| `borderColor` | `string` | Border colour of the container when `bordered` AND the resting pane divider, so both travel together (default the border token). The divider still turns primary on hover/drag. |
| `radiusValue` | `string \| number` | Exact corner rounding of the bordered container (e.g. "12px"; default the Frayme radius token). Only applies when `bordered`. |

## Events

### move

The divider was dragged (fires ONCE on pointer-release, not per move) or arrow-keyed; params carry {splitPercent} — the first pane’s final size, 10–90.

| Key | Type | Description |
| --- | --- | --- |
| `card` | `unknown` | Optional. The moved card/item (kanban). |
| `fromColumn` | `string` | Optional. Source column key (kanban). |
| `toColumn` | `string` | Optional. Target column key (kanban). |
| `fromIndex` | `number` | Optional. Source position (kanban/reorder). |
| `toIndex` | `number` | Optional. Target position (kanban/reorder). |
| `splitPercent` | `number` | Optional. Final divider position (SplitPane, 0–100, on pointer-up). |
| `width` | `number` | Optional. Final width in px (Resizable, on pointer-up). |
| `height` | `number` | Optional. Final height in px (Resizable, on pointer-up). |
| `axis` | `'x' \| 'y' \| 'both'` | Optional. Which axis the resize changed (Resizable). |

See [Events](../../events.md) for the full payload contract.
