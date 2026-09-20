# Menubar

An application-style horizontal menu bar (File / Edit / View). Each top-level label opens a dropdown of items (with optional icon, shortcut, separator, disabled). Items with an href navigate (scheme-checked). Bind `activeItem` with `{ $bindState }` so the agent (or a sibling control) can read which menu item was selected (its label or index) from spec.state.

## Example

```json
{
  "root": "menubar",
  "elements": {
    "menubar": {
      "type": "Menubar",
      "props": {
        "menus": [
          {
            "label": "File",
            "items": [
              {
                "label": "New",
                "shortcut": "⌘N",
                "icon": "plus"
              },
              {
                "label": "Save",
                "shortcut": "⌘S",
                "icon": "save"
              },
              {
                "separator": true
              },
              {
                "label": "Export",
                "icon": "download"
              }
            ]
          },
          {
            "label": "Edit",
            "items": [
              {
                "label": "Undo",
                "shortcut": "⌘Z"
              },
              {
                "label": "Redo",
                "shortcut": "⇧⌘Z",
                "disabled": true
              }
            ]
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
| `menus` | `({ label: string, items: object[] })[]` | The top-level menus rendered left to right on the bar; each is { label, items[] } and opens a dropdown of its `items` on click (e.g. File · Edit · View). Omit for an empty bar. |
| `activeItem` | `string` | Write target for WHICH menu item the user selected: bind with { $bindState } and the renderer writes the selected item label (or its index) here before emitting `select`, so the host can attribute the selection. Emit-only when unbound. |
| `accent` | `string` | Color for the currently-OPEN top-level menu label (default the foreground token); closed labels and selected items are not tinted. |
| `borderColor` | `string` | Border colour for the whole menu chrome, the bar frame, the dropdown panel border, item separators, and shortcut-chip edges (default the border token). |
| `mutedColor` | `string` | Secondary/muted text colour, the item leading icons, keyboard shortcuts, and the empty "No items" line (default the muted-foreground token). |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Overall scale of the bar: sm · md (default) · lg. Sets the top-level label and dropdown-item text size + padding. |
| `dense` | `boolean` | Tighter vertical padding on the bar and dropdown items for a compact toolbar look (default false). |
| `emptyText` | `string` | Override the message shown in a menu with no items (default "No items"). Escaped text, set for i18n. |

## Events

### select

A dropdown item without an `href` was clicked; params carry { value, label, index } (value/label are the item's `label`, index is its position within that menu's items).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
