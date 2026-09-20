# KanbanCard

A single board card: a title, optional description, status label chips, an assignee avatar + meta line, and (when `moveable`) left/right move buttons that emit `move`. A click on the card body emits `change`. Set `rowActions` for per-card action buttons (emits `commit` with this card's id), or pass children to append your own controls into the card footer. Place inside a BoardColumn. Never carries native drag.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "kanban-card",
  "elements": {
    "kanban-card": {
      "type": "KanbanCard",
      "props": {
        "title": "Wire the webhook receiver",
        "description": "Verify signatures and enqueue events for processing.",
        "labels": [
          {
            "text": "backend",
            "tone": "info"
          },
          {
            "text": "blocked",
            "tone": "critical"
          }
        ],
        "assignee": "Priya Gupta",
        "meta": "#42",
        "moveable": true,
        "rowActions": [
          {
            "id": "reassign",
            "label": "Reassign"
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
| `id` | `string` | Stable card identifier echoed verbatim in the `change`/`move` params so the agent resolves WHICH card was acted on without re-indexing by title (safe when titles duplicate or are absent). Set to the underlying record id. |
| `title` | `string` | The card headline, one short line naming the work item (truncates). Also identifies the card in the `change`/`move` params. |
| `description` | `string` | Short supporting line under the title (plain escaped text, no markdown/HTML). |
| `labels` | `({ text: string, tone: "neutral" \| "success" \| "warning" \| "critical" \| "info", color: string })[]` | Small status chips along the top: each a {text, tone, optional color} (tone: neutral·success·warning·critical·info; set color to paint a single chip exactly). |
| `assignee` | `string` | Assignee name, shown as an initials avatar in the card footer. |
| `meta` | `string` | A short meta string in the footer (e.g. "3d" or "#42"). Display only. |
| `moveable` | `boolean` | Show left/right move buttons that emit `move` (the spec-expressible alternative to native drag, which is NOT supported). |
| `accent` | `string` | Left accent rule color on the card (default the border token). Names a specific brand color. |
| `bg` | `string` | Resting card surface (background) colour (default the card token). The resting/unselected card fill, not an accent. |
| `color` | `string` | On-surface text colour of the card, the title and the assignee-avatar initials (default the foreground token). Pair with `bg` so a dark card fill keeps a readable title; wins over the board/column `cardColor` cascade. |
| `borderColor` | `string` | Resting card border colour (default the border token). The resting card outline, not the left accent rule. |
| `mutedColor` | `string` | Secondary/muted text colour, the card description, the footer meta line, and the move-affordance chevrons; the assignee-avatar fill follows it as a soft 15% tint (default the muted-foreground token; avatar defaults to the muted token). |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the card title (default medium). Set to override the baked title weight. |
| `rowActions` | `({ id: string, label: string, icon: string, variant: "ghost" \| "outline" \| "primary" \| "secondary" \| "danger", confirm: object \| boolean \| string, disabled: boolean })[]` | Action buttons drawn in THIS card's footer, the per-card idiom on the slot-authored board (the KanbanBoard `rowActions` prop is the same contract for the data-authored one). Each { id, label?, icon?, variant?, confirm?, disabled? }; clicking emits `commit` { action:id, id, card, column, assignee, meta } with this card's own id. `confirm` is ON BY DEFAULT, pass `confirm:false` to opt out. |

## Events

### change

The card body was clicked (open intent); params carry {id, card, assignee, meta}, the stable id (null if unset), the title, and the resolved assignee/meta so the agent can act without re-indexing by title.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### move

A left/right move button was pressed while `moveable` is on; params carry {id, card, dir, assignee, meta}, the stable id (null if unset), the title, the direction ("left" | "right"), and the resolved assignee/meta. A standalone card cannot relocate itself, the host routes the move.

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

A `rowActions` button on this card was pressed; params carry {action, id, card, column, assignee, meta}, the action id plus this card's own id, so the handler acts on the right record without re-indexing by title.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
