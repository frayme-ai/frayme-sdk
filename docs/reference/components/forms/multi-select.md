# MultiSelect

Multi-choice select that shows chosen items as removable chips plus an open option menu (selected options carry a check). Reach for it over a stack of checkboxes when the user picks several values from a longer list and you want the selection summarised inline. Use { $bindState } on value for two-way binding; toggling an option or removing a chip emits change; the optional clear-all × emits dismiss; an optional Apply button (submitLabel) emits commit with the full selection. Set `max` to cap picks (options lock once reached), `searchable` to add an in-menu filter, and `chips: false` to collapse selections into a "N selected" summary.

## Example

```json
{
  "root": "multi-select",
  "elements": {
    "multi-select": {
      "type": "MultiSelect",
      "props": {
        "options": [
          {
            "label": "Design",
            "value": "design"
          },
          {
            "label": "Engineering",
            "value": "eng"
          }
        ],
        "placeholder": "Pick teams…"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `options` | `({ label: string, value: string })[]` | The selectable options ({ label, value }). Required content — the menu the user picks from. |
| `value` | `string[]` | The selected value strings. Use { $bindState } for two-way binding; toggling/removing rewrites this array. |
| `placeholder` | `string` | Hint shown in the control when nothing is selected (e.g. "Pick tags…"). |
| `max` | `number` | Cap on the number of selections; options are blocked once reached. |
| `size` | `"sm" \| "md" \| "lg"` | Control height/font-size/padding token (default `md`); use `sm` in dense toolbars, `lg` for touch or roomy forms. |
| `searchable` | `boolean` | Show a filter input at the top of the menu to narrow the options. |
| `chips` | `boolean` | Render selections as removable chips inside the control (default true); when false, show a "N selected" summary. |
| `clearable` | `boolean` | Show a single clear-all × beside the chevron that deselects everything at once (default false). The × appears only when there is at least one selection. |
| `disabled` | `boolean` | Grey out the control (60% opacity, not-allowed cursor) and block toggling, removing chips, and opening the option menu (default false). |
| `accent` | `string` | Brand color for the control (default the primary token for the focus ring/checkmark/hover tint): the focus ring, the selected-option checkmark fill, the option hover/focus tint, and — when set with no `borderColor` — the resting control border (an explicit `borderColor` wins). Also tints the selection chips; unset chips render a neutral (muted) fill instead. |
| `accentText` | `string` | Text colour of the check glyph on the selected-option checkbox fill, paired with `accent` (default the primary-foreground token). Set when a light/custom accent needs dark on-fill ink. |
| `borderColor` | `string` | Resting border colour of the control, the open option-menu panel, and the in-menu filter input (default the border token). Wins over `accent` on the resting border when both are set. |
| `bg` | `string` | Background colour of the control AND the open option-menu panel (default the card token). |
| `mutedColor` | `string` | Secondary/muted text colour — placeholder, the chevron, the "No options" empty state, and (when set) the in-menu filter placeholder (default the muted-foreground token). |
| `emptyText` | `string` | Override the empty/no-options message shown in the open menu (default "No options"). Escaped text — set to localise or reword it (e.g. "Nothing here"). |
| `submitLabel` | `string` | When set, render an internal Apply/Confirm button under the control that emits `commit` with the full { value } selection on demand — the submit path for bound use without a separate external Button. Absent → no button (default). |
| `menuWidth` | `string \| number` | Explicit width of the open option menu (e.g. "20rem"; default matches the control). |
| `radiusValue` | `string \| number` | Exact corner radius of the control surface (e.g. "12px" or "0.75rem"; default the frayme radius). Overrides the default rounding. |

## Events

### change

A menu option was toggled or a selected chip was removed; params carry { value, toggled, checked }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### dismiss

The clear-all × (when `clearable`) was pressed, deselecting everything; params carry { all: true, value: [] } (the now-empty selection).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

### search

The in-menu filter text changed (when `searchable`); params carry { query } — bind it to fetch/filter options.

| Key | Type | Description |
| --- | --- | --- |
| `query` | `string` | The current query text. |

### commit

The internal Apply button (when `submitLabel` is set) was pressed; params carry { value } — the full committed selection on demand.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
