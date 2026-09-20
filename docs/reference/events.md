# Events

Every interactive Frayme component emits one or more of eight canonical event verbs, a closed vocabulary, so handlers written once work across the whole catalog.

```ts
import { CANONICAL_EVENTS, EVENT_CONTRACT, componentEvents } from '@frayme/catalog';

CANONICAL_EVENTS; // ["commit","select","change","dismiss","search","sort","page","move"]
componentEvents('Button'); // ['commit']
componentEvents('Card');   // [], display-only, no events
```

Most interactions (typing, toggling tabs, local filters) resolve inside the renderer without a round-trip; only spec-declared actions reach your host. When an event fires, its payload carries the intrinsic keys below.

## commit

The user activated the primary affordance, a button/CTA press, Enter in an input, a form submit, a palette/menu action. The terminal "do it" signal of a surface.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

## select

The user picked an item from a set, a table row, a calendar day, an option, a tree node, a list item. Identifies WHICH item in the params, not in the verb.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

## change

A value or disclosure state changed, typing, toggling, sliding, picking a date, expanding a section. The continuous "state moved" signal (commit is the terminal one).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

## dismiss

The user closed, discarded, removed or cleared something, a toast/banner close, a chip remove, a clear-all, a deny.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

## search

The user entered query text to filter or search a surface.

| Key | Type | Description |
| --- | --- | --- |
| `query` | `string` | The current query text. |

## sort

The user requested a sort, clicking a sortable column header cycles direction.

| Key | Type | Description |
| --- | --- | --- |
| `sortBy` | `string` | The column key to sort by. |
| `sortDir` | `'asc' \| 'desc' \| 'none'` | The requested direction after this interaction. |

## page

The user navigated pagination, a next/prev arrow, a numbered page button, or a table footer pager.

| Key | Type | Description |
| --- | --- | --- |
| `page` | `number` | The target page (1-based, clamped to range). |

## move

The user repositioned something, dragging a kanban card, reordering, or resizing a divider. Pointer-driven resizes emit ONCE on release with the final geometry.

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

## Component-specific spellings

A few components accept extra event keys on top of the canonical eight. They are exported as `COMPONENT_EXTRA_EVENTS` (distinct verbs the renderer fires when bound) and `COMPONENT_EVENT_ALIASES` (alternative spellings of a verb the component already emits); `acceptedEventKeys(type, declared)` lists every key a type accepts.

- `DataTable`: `add`, `update` (component-specific verbs)
- `DatePicker`: `commit` → `select` (aliases)
- `DateRangePicker`: `commit` → `select` (aliases)

Each component page lists which verbs that component emits, with component-specific notes.
