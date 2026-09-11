# NotificationCenter

A read/unread notification inbox fed by a static snapshot: category tabs with unread counts, per-item action buttons, mark-read / mark-all-read / dismiss, and an "unread only" filter. The host recomposes the items (no socket). Owns the read/dismiss overlay locally and emits a fully-populated intent on every interaction. Escaped text, SSR-safe. Bind `readIds`, `dismissedIds`, `activeTab`, `unreadOnly` with `{ $bindState }` so the agent (or a sibling control) can read the live overlay from spec.state — `readIds` holds the ids marked read, `dismissedIds` the ids dismissed, `activeTab` the selected category tab key, `unreadOnly` the filter toggle.

## Example

```json
{
  "root": "notification-center",
  "elements": {
    "notification-center": {
      "type": "NotificationCenter",
      "props": {
        "items": [
          {
            "id": "n1",
            "title": "Ada commented on your PR",
            "body": "\"This is much cleaner — ship it.\"",
            "category": "mentions",
            "timestampLabel": "2m ago",
            "unread": true,
            "tone": "info",
            "actions": [
              {
                "label": "View",
                "value": "view"
              },
              {
                "label": "Reply",
                "value": "reply"
              }
            ]
          },
          {
            "id": "n2",
            "title": "Deployment succeeded",
            "body": "Payments API · production",
            "category": "system",
            "timestampLabel": "18m ago",
            "unread": true,
            "tone": "success"
          },
          {
            "id": "n3",
            "title": "Build failed on frayme-dev",
            "category": "system",
            "timestampLabel": "1h ago",
            "unread": false,
            "tone": "critical",
            "actions": [
              {
                "label": "Retry",
                "value": "retry"
              }
            ]
          },
          {
            "id": "n4",
            "title": "Grace invited you to Design Review",
            "category": "mentions",
            "timestampLabel": "3h ago",
            "unread": false,
            "tone": "neutral"
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
| `items` | `({ id: string, title: string, body: string, category: string, timestampLabel: string, unread: boolean, tone: "neutral" \| "info" \| "success" \| "warning" \| "critical", actions: object[] })[]` | The notifications snapshot; the host recomposes it. Each is { id, title, body?, category?, timestampLabel?, unread?, tone?, actions? }. Capped at 200. |
| `categories` | `({ key: string, label: string })[]` | Explicit category tabs { key, label }. Omit to derive tabs from the distinct item categories. |
| `showTabs` | `boolean` | Show the category tab bar with per-tab unread counts (default `true`); set `false` for a single flat list when items span one category. |
| `showUnreadOnly` | `boolean` | Start with the "unread only" filter on (default false). |
| `markReadOnOpen` | `boolean` | Mark an item read when it is opened/clicked (default true). |
| `showMarkAll` | `boolean` | Show the "Mark all read" action that clears every unread dot at once (default `true`); hide it to force per-item reads. |
| `showSubmit` | `boolean` | Show an on-demand "Save inbox" button in the footer that emits ONE commit carrying the full overlay { readIds, dismissedIds, activeTab, unreadOnly } (default false). Use it when the host wants a single whole-inbox snapshot instead of persisting each per-item intent. |
| `submitLabel` | `string` | Label for the whole-inbox submit button when showSubmit is on (default "Save inbox"). Escaped text. |
| `readIds` | `string[]` | Bindable ($bindState) mirror of the ids marked READ in this session; the component writes it on every read/mark-all toggle so an external Button can read the final read-set from spec.state without replaying every emit. |
| `dismissedIds` | `string[]` | Bindable ($bindState) mirror of the ids DISMISSED in this session; the component writes it on each dismiss so the final dismissed-set is readable from spec.state without replaying every emit. |
| `activeTab` | `string` | Bindable ($bindState) mirror of the currently selected category tab key (or "all"); the component writes it on each tab switch so the current tab is readable from spec.state. |
| `unreadOnly` | `boolean` | Bindable ($bindState) mirror of the "unread only" filter toggle; the component writes it whenever the filter changes so its state is readable from spec.state. |
| `emptyLabel` | `string` | Message when there are no notifications (default "You're all caught up"). Escaped text. |
| `maxHeight` | `string \| number` | Caps the item list at this height and makes it a scroller, `px`/`rem`, clamped `120..800px` (an unparseable value falls back to `28rem`). OMIT it — the default — and the list does NOT scroll: every row renders in full. Name it (e.g. `28rem`) only when the inbox must fit a fixed-height panel. |
| `accent` | `string` | Accent color of the active tab + unread affordances (default the primary token). |
| `mutedColor` | `string` | Secondary color — timestamps, body, counts (default the muted-foreground token). |

## Events

### select

A notification was opened; params carry { id, title, body, category, timestampLabel, unread }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### commit

Either an item action button was pressed (params carry { id, title, category, actionValue, actionLabel }) OR the opt-in "Save inbox" footer button was pressed (params carry the full overlay snapshot { readIds, dismissedIds, activeTab, unreadOnly }).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### change

A view change: { name:"read", id, value } · { name:"markAll", value:true, ids } · { name:"tab", value, label } · { name:"unreadOnly", value }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### dismiss

A notification was dismissed: single { id, title, category, index } or clear-all { all:true, ids }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
