# Resizable

A single panel the user resizes by dragging an edge (or corner) handle. Put any content inside as the child. The size stays live without a binding, drag updates it via pointer events. Use to let the user widen a sidebar, panel, or preview box. Bind `size` with `{ $bindState }` so the agent (or a sibling control) can read the current panel dimensions ({ w, h } in pixels) from spec.state.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "resizable",
  "elements": {
    "resizable": {
      "type": "Resizable",
      "props": {
        "axis": "horizontal",
        "width": "320px"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `width` | `string \| number` | Starting width (e.g. "320px" / "20rem"; default 320px). The drag handle adjusts it. Parsed to px (rem ≈ 16px); a "%" value is not parsed and falls back to the 320px default. |
| `height` | `string \| number` | Starting height (e.g. "240px" / "15rem"; default 240px). The drag handle adjusts it when the axis allows. Parsed to px (rem ≈ 16px); a "vh" value is not parsed and falls back to the 240px default. |
| `axis` | `"horizontal" \| "vertical" \| "both"` | Which dimension(s) the user can resize: horizontal (width only, default) · vertical (height only) · both (a corner handle). |
| `minWidth` | `string \| number` | Smallest width the horizontal drag can shrink the panel to (default 120px). Raise it to stop the user collapsing a sidebar past its usable content width. |
| `minHeight` | `string \| number` | Smallest height the vertical drag can shrink the panel to (default 80px). Raise it to keep a resizable preview/console tall enough to stay useful. |
| `bordered` | `boolean` | Wrap the panel in a rounded bordered card (default true). |
| `bg` | `string` | Background fill of the panel (default the card token). Names a specific brand color. |
| `color` | `string` | Text colour inside the panel (default the foreground token). |
| `borderColor` | `string` | Border colour of the panel when `bordered` (default the border token). |
| `radiusValue` | `string \| number` | Exact corner rounding of the bordered panel (e.g. "12px"; default the Frayme radius token). Only applies when `bordered`. |
| `size` | `{ w: number, h: number }` | The current panel size as { w, h } in pixels. Bindable: the resized dimensions are mirrored here into (bindable) spec.state on every drag/arrow-key, so an external Button can read the panel size without replaying `move` events. Seeds the initial size when set. |

## Events

### move

The resize handle was dragged (fires ONCE on pointer-release, not per move) or arrow-keyed; params carry {width, height, axis}, the final size in px.

| Key | Type | Description |
| --- | --- | --- |
| `card` | `unknown` | Optional. The moved card/item (kanban). |
| `fromColumn` | `string` | Optional. Source column key (kanban). |
| `toColumn` | `string` | Optional. Target column key (kanban). |
| `fromIndex` | `number` | Optional. Source position (kanban/reorder). |
| `toIndex` | `number` | Optional. Target position (kanban/reorder). |
| `splitPercent` | `number` | Optional. Final divider position (SplitPane, 0-100, on pointer-up). |
| `width` | `number` | Optional. Final width in px (Resizable, on pointer-up). |
| `height` | `number` | Optional. Final height in px (Resizable, on pointer-up). |
| `axis` | `'x' \| 'y' \| 'both'` | Optional. Which axis the resize changed (Resizable). |

See [Events](../../events.md) for the full payload contract.
