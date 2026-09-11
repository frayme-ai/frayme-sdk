# BoardColumn

One kanban column: a header (title + optional count badge) over a vertical stack of KanbanCard children. Set `collapsible` to make the header a button that collapses the body, `columnBg` to recolor the lane, and `emptyText` for the no-cards placeholder. Place several inside a KanbanBoard slot. Bind `collapsed` with `{ $bindState }` so the agent (or a sibling control) can read or drive whether the column body is collapsed from spec.state.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "board-column",
  "elements": {
    "board-column": {
      "type": "BoardColumn",
      "props": {
        "title": "In progress",
        "count": 3,
        "collapsible": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | The column header title — one short status/stage name (e.g. "In progress"). Also identifies the column in the `change` params. |
| `count` | `number` | Small count badge shown next to the title (e.g. how many cards). A plain count, not a visual dimension. |
| `accent` | `string` | Column header accent — the title's TEXT COLOUR (default the foreground token) + the rule under the header (default the border token). Names a specific brand color. |
| `collapsible` | `boolean` | Make the header a toggle that collapses/expands the column body (internal state — works without a binding). |
| `collapsed` | `boolean` | Bindable current collapsed state of the column body (distinct from `collapsible`, which merely enables the toggle). Bind this to spec.state so an external control can read or drive whether the column is collapsed; the header toggle mirrors it here. Optional — unbound, collapse still works via internal state. |
| `columnBg` | `string` | The column TRACK surface fill — the shell the cards sit on (default a subtle muted wash, bg-muted/40). Names a specific column background; this is the column lane, NOT the card fill (`cardBg`). |
| `emptyText` | `string` | Placeholder message shown in the column body when it has no cards (e.g. "No cards yet"). Omit for a bare empty column (the default). Escaped text. |
| `cardBg` | `string` | Resting card surface (background) colour for the cards in this column (default the card token). Cascades to KanbanCard children that do not set their own. |
| `cardColor` | `string` | On-surface text colour for the cards in this column — each card title + assignee-avatar initials (default the foreground token). Pair with `cardBg`; cascades to KanbanCard children that do not set their own `color`. |
| `borderColor` | `string` | Resting card border colour for the cards in this column (default the border token). Cascades to KanbanCard children that do not set their own. |
| `mutedColor` | `string` | Secondary/muted text colour — the count badge beside the column title + the collapse caret (default the muted-foreground token). |

## Events

### change

The header was toggled while `collapsible` is on; params carry {column, collapsed} — the column title and the NEW collapsed state.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
