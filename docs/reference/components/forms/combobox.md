# Combobox

Single-select typeahead / autocomplete. The input holds the query; a filtered menu lists matching options (case-insensitive substring of label), with an optional "Create "x"" row when creatable. Use { $bindState } on value for the committed selection; selecting/creating emits change, typing emits search (gated by emitOnChange), Enter/blur commits the raw query.

## Example

```json
{
  "root": "combobox",
  "elements": {
    "combobox": {
      "type": "Combobox",
      "props": {
        "options": [
          {
            "label": "United Kingdom",
            "value": "uk"
          },
          {
            "label": "United States",
            "value": "us"
          }
        ],
        "placeholder": "Search…"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `options` | `({ label: string, value: string })[]` | The autocomplete options ({ label, value }). Required content, filtered by the typed query. |
| `value` | `string` | The committed selected value. Use { $bindState } for two-way binding. |
| `placeholder` | `string` | Empty-input hint text shown before the user types (default none); keep it a short verb phrase, e.g. "Search a country…", that names what to look for. |
| `creatable` | `boolean` | Offer a "Create "x"" row so the user can commit a typed value not in the list. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |
| `loading` | `boolean` | Show a trailing spinner while options are being fetched. |
| `size` | `"sm" \| "md" \| "lg"` | Control height/font-size/padding token (default `md`); use `sm` in dense toolbars, `lg` for touch or roomy forms. |
| `disabled` | `boolean` | Grey out the input (60% opacity, not-allowed cursor) and block typing, opening the menu, and selecting an option (default false). |
| `accent` | `string` | Colour of the create-row TEXT and the selected row's check glyph, printed on the menu panel; also the focus ring and a 12% row hover/active tint (default the primary token). |
| `borderColor` | `string` | Resting border colour of the input box AND the open menu panel (default the border token). Wins over `accent` on the resting border when both are set. |
| `bg` | `string` | Input + menu background color (default card token). |
| `mutedColor` | `string` | Secondary/muted text colour, the input placeholder, the trailing chevron, the loading spinner, and the "No matches" empty state (default the muted-foreground token). |
| `emptyText` | `string` | Override the no-results message shown when the query matches no options (default "No matches"). Escaped text, set to localise or reword it. |
| `menuWidth` | `string \| number` | Explicit width of the open menu (e.g. "18rem"; default matches the input). |
| `maxHeight` | `string \| number` | Scroll cap on the option menu (e.g. "16rem") before it scrolls. |
| `radiusValue` | `string \| number` | Exact corner radius of the input surface (e.g. "12px" or "0.75rem"; default the frayme radius). Overrides the default rounding. |

## Events

### change

An option was selected, or the "Create" row committed a typed value not in the list; params carry { value }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### search

The query text changed as the user typed; params carry { query }. Only fires when emitOnChange !== false, set emitOnChange false to hold the query in state and suppress the per-keystroke stream.

| Key | Type | Description |
| --- | --- | --- |
| `query` | `string` | The current query text. |

### commit

The current input query was committed on Enter (with no menu selection) or on blur; params carry { value }, the on-demand submit of partial/typed input so an external Button can read it.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
