# FilterBar

A horizontal filter bar: removable active-filter chips, an inline search box, a clear-all, and an Apply button. Removing a chip or clearing is live without any binding (internal removed-set + search state); each also emits a host signal (`dismiss` on chip remove + clear-all, `search` + `change` on type unless `emitOnChange` is false, `commit` on Apply). Use above a results list/grid. Bind `activeFilters` with `{ $bindState }` so the agent (or a sibling control) can read the live set of chip values still shown from spec.state.

## Example

```json
{
  "root": "filter-bar",
  "elements": {
    "filter-bar": {
      "type": "FilterBar",
      "props": {
        "filters": [
          {
            "label": "Status: Open",
            "value": "status:open",
            "removable": true
          },
          {
            "label": "Owner: Me",
            "value": "owner:me",
            "removable": true
          }
        ],
        "searchPlaceholder": "Search issues…"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `filters` | `({ label: string, value: string, removable: boolean })[]` | Active filters shown as chips (each: label, value, optional removable flag). A removable chip shows an × that drops it. |
| `searchPlaceholder` | `string` | Placeholder for the inline search input (default "Search…"). Omit `searchPlaceholder` AND give no filters to render just the search. |
| `searchValue` | `string` | Current search text (interactive out of the box; bind it for two-way sync). To make the search DO something locally, bind this with { $bindState } to a state path and bind a sibling DataTable `filterText` { $state } to the same path — typing then narrows the table rows live, no agent round-trip. |
| `activeFilters` | `string[]` | Bindable live set of chip values still shown (after removals). Mirrors the current active-filter set into (bindable) state so an external Apply button can read the whole bar via spec.state; two-way when bound. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |
| `searchLabel` | `string` | Accessible label for the search input when no `searchPlaceholder` is set (default "Search"). Feeds aria-label — escaped text. |
| `showClear` | `boolean` | Show a "Clear all" action that resets the chips + search (default true when any chip is present). |
| `clearLabel` | `string` | Text + accessible label of the clear-all action (default "Clear all"). Set for localisation; escaped text. |
| `removeLabel` | `string` | Accessible label PREFIX for each removable chip × — the chip label is appended (default "Remove", e.g. "Remove Status: Open"). Escaped text. |
| `removeIcon` | `string` | Glyph NAME (closed icon registry) for the chip remove ×  (default "x"). Unknown/absent → the default ×. Never raw SVG. |
| `size` | `"sm" \| "md" \| "lg"` | Control height + chip/font size together (default md). |
| `accent` | `string` | Brand color for the chip fill + search focus ring. Names a specific brand color; unset chips render a neutral (muted) fill instead of a tint. |
| `mutedColor` | `string` | Secondary/muted text colour — the search magnifier icon, the search placeholder, and the "Clear all" action (default the muted-foreground token). |

## Events

### change

The bar state moved (chip removed, cleared, or a search keystroke); params carry the FULL resolved state — {query} (current search text), {removed} (all removed chip values), and {activeFilters} (the chip values still shown). Read `activeFilters` for the live filter set. Only fires when `emitOnChange` !== false — set that false to receive the state on `commit`/`dismiss` instead of per keystroke.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### dismiss

A chip’s × was clicked (params: {value} — that chip’s value) or the clear-all was pressed (params: {all: true}).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

### search

The search input received typing (fires per keystroke); params carry {query} — the current text. Suppressed when `emitOnChange` is false.

| Key | Type | Description |
| --- | --- | --- |
| `query` | `string` | The current query text. |

### commit

The Apply button was pressed; params carry the FULL resolved bar state — {query, removed, activeFilters}. The submit path for reading the whole bar on demand (always fires regardless of `emitOnChange`).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
