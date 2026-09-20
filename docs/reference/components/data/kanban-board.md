# KanbanBoard

A horizontal, side-scrolling row of kanban columns. Either pass a `columns` array (each with its own cards) OR a slot of BoardColumn children. Display board, cards move via the per-card affordance (emits `move`), a card body click emits `change`. There is NO native drag. Set `rowActions` to put an action button on EVERY card (the per-card idiom, "reassign this one", not one form for the whole board); its `commit` carries the pressed card's own id. Bind `board` with `{ $bindState }` so the agent (or a sibling control) can read the live column→cards arrangement after moves from spec.state. READ-ONLY boards show no move arrows: the left/right affordances render only when something consumes a move, `on.move` wired, `board` bound, or `showSave` on.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "kanban-board",
  "elements": {
    "kanban-board": {
      "type": "KanbanBoard",
      "props": {
        "columns": [
          {
            "title": "To do",
            "count": 2,
            "cards": [
              {
                "title": "Draft launch post"
              },
              {
                "title": "Wire webhook receiver"
              }
            ]
          },
          {
            "title": "In progress",
            "count": 1,
            "cards": [
              {
                "title": "Usage dashboard",
                "assignee": "PG",
                "meta": "2d"
              }
            ]
          },
          {
            "title": "Done",
            "cards": [
              {
                "title": "Component library"
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
| `columns` | `({ title: string, count: number, accent: string, cards: object[] })[]` | The columns to render (each: title, optional count, optional header accent, and a cards list). Omit and pass BoardColumn children instead for full control. |
| `board` | `({ title: string, cards: object[] })[]` | Bindable live board arrangement (each column: title + its cards). Bind this to spec.state so an external Button reads the CURRENT column→cards layout after moves without replaying every `move`; the board mirrors the arrangement here on each move. Usually bound, not literal. |
| `showSave` | `boolean` | Show an internal Save button under the board that emits `commit` with the full current arrangement, the on-demand submit path (default off; a data board is often read via the bound `board` state alone). |
| `saveLabel` | `string` | Label for the internal Save button when `showSave` is on (default "Save board"). A short verb phrase naming the commit action. |
| `rowActions` | `({ id: string, label: string, icon: string, variant: "ghost" \| "outline" \| "primary" \| "secondary" \| "danger", confirm: object \| boolean \| string, disabled: boolean })[]` | Per-CARD action buttons drawn in the footer of every card on the board, the way to put "reassign this driver" / "cancel this booking" ON the item it acts on instead of in one global form beside the board. Each { id, label?, icon?, variant?, confirm?, disabled? }; clicking emits `commit` { action:id, id, card, column, index, assignee, meta }, `id` is THAT card's own id, so the handler never has to re-derive which card was pressed. `icon` is a registry name; `variant` is the button colour (ghost/outline/primary/secondary/danger, default outline); `disabled` greys THIS action out (bind it to state so an action that already fired cannot fire twice). `confirm` gates THIS action with the shared modal and is ON BY DEFAULT, pass `confirm:false` for a genuinely benign action. |
| `gap` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Horizontal space between the columns: none · sm · md (default) · lg · xl. Widen to `lg`/`xl` for airier lanes; overridden by the exact `gapValue` channel when set. |
| `gapValue` | `string \| number` | Exact horizontal space between columns (e.g. 24px / 1.5rem). Overrides the `gap` enum, which is the default. |
| `itemWidth` | `string \| number` | Exact width of each column (e.g. 320px / 20rem). Default 18rem (no enum), set this to widen or narrow the columns. |
| `accent` | `string` | Default header accent applied to every column that does not set its own, the column title's TEXT COLOUR (default the foreground token) + the rule under the header (default the border token). |
| `cardBg` | `string` | Resting card surface (background) colour for every card on the board (default the card token). The resting/unselected card fill, not an accent. |
| `cardColor` | `string` | On-surface text colour for every card on the board, each card title + assignee-avatar initials (default the foreground token). Pair with `cardBg` so a dark card fill keeps readable titles; cascades to cards that do not set their own `color`. |
| `borderColor` | `string` | Resting card border colour for every card on the board (default the border token). The resting card outline, not the left accent rule. |
| `mutedColor` | `string` | Secondary/muted text colour across the board, column count badges plus each card description, meta line, and move-affordance chevrons (default the muted-foreground token). |

## Events

### change

A card body was clicked (open intent) in a data-driven board; params carry {card, column, index}.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### move

A card’s left/right move button was pressed in a data-driven board (the board relocates the card itself); params carry {card, fromColumn, toColumn, fromIndex, toIndex}.

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

### commit

EITHER a per-card `rowActions` button was pressed, params carry {action, id, card, column, index, assignee, meta}, where `action` is the action id and `id` is that card's own id, OR the internal Save button (shown when `showSave` is on) was pressed, params carrying {columns}, the full current arrangement. The presence of `action` distinguishes them.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
