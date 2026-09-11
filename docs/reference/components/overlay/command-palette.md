# CommandPalette

Cmd-k fuzzy action launcher rendered as an INLINE command surface (no portal, SSR-safe). Renders a search header + grouped command items, filters items by a case-insensitive substring of the query, and emits select on an item click. Full keyboard navigation: ArrowDown/ArrowUp move the highlighted command through the filtered list (wrapping) and Enter activates it (aria-activedescendant tracks the active row). Use { $bindState } on value for two-way binding; bind on.select for the handler.

## Example

```json
{
  "root": "command-palette",
  "elements": {
    "command-palette": {
      "type": "CommandPalette",
      "props": {
        "placeholder": "Type a command or search…",
        "groups": [
          {
            "heading": "Actions",
            "items": [
              {
                "label": "New file",
                "icon": "plus",
                "shortcut": "⌘N",
                "value": "new-file"
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
| `placeholder` | `string` | Search-header empty hint (default "Type a command or search…"). |
| `groups` | `({ heading: string, items: object[] })[]` | Command groups, each an optional heading + a list of items. The required content of the palette. |
| `value` | `string` | Current query string. Use { $bindState } for two-way binding. |
| `selected` | `string` | The highlighted command’s value. Follows the user’s click/hover; bind with { $bindState } to read which command fired. |
| `emptyText` | `string` | Message when nothing matches the query (default "No results"). |
| `accent` | `string` | Active/highlighted item color (the highlighted match; default primary token). |
| `bg` | `string` | Fill color of the command surface (default the card token). Set it to match a themed shell; the outer edge/dividers read `borderColor`, not this. |
| `borderColor` | `string` | Surface chrome border color — the outer border, the search-header divider, and the shortcut kbd-chip border (default border token). |
| `mutedColor` | `string` | Secondary/muted text colour — the group headings, the empty "No results" state, the shortcut hints, the search icon + placeholder, and the per-item leading icons (default the muted-foreground token). |
| `menuWidth` | `string \| number` | Explicit width of the command surface (e.g. "32rem"; default 100% of its container). Set a fixed value to cap the palette at a comfortable reading width instead of stretching full-bleed. |
| `maxHeight` | `string \| number` | Scroll cap on the results list (e.g. "20rem"; the list scrolls beyond it). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Elevation of the floating command surface — none · sm · md · lg · xl (default sm). Reach for a larger value to make the palette read as lifted above the page. |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for the command surface (fast/normal/slow). Default: no animation — the palette appears instantly. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |

## Events

### change

The search input text changed; fires alongside search on the same keystroke; params carry { value } (the new query text). Only fires when emitOnChange !== false.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### search

The search input text changed; fires alongside change on the same keystroke; params carry { query } (the new query text). Only fires when emitOnChange !== false.

| Key | Type | Description |
| --- | --- | --- |
| `query` | `string` | The current query text. |

### select

A command item was clicked or activated with Enter/Space; params carry { value, label } (the item's value + label).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
