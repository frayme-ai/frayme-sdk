# FacetList

A multi-select facet list with optional result counts: each row is a labelled checkbox that toggles its value in the selected set (live without any binding) and emits `change`. Set `max` to collapse a long list behind a "Show more". Use one per facet group in a sidebar. Bind `selected` with `{ $bindState }` so the agent (or a sibling control) can read the live set of checked facet values from spec.state.

## Example

```json
{
  "root": "facet-list",
  "elements": {
    "facet-list": {
      "type": "FacetList",
      "props": {
        "title": "Status",
        "facets": [
          {
            "label": "Open",
            "value": "open",
            "count": 24
          },
          {
            "label": "In progress",
            "value": "in-progress",
            "count": 8
          },
          {
            "label": "Closed",
            "value": "closed",
            "count": 132
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
| `title` | `string` | Optional heading above the facet list (e.g. "Category"). |
| `facets` | `({ label: string, value: string, count: number, checked: boolean })[]` | The selectable facets (each: label, value, optional result count, optional initial checked). Counts are plain numbers, not visual dimensions. |
| `selected` | `string[]` | Currently-selected facet values — interactive out of the box; bind with `{ $bindState }` for two-way sync with the result set (mirrored into spec.state on every toggle so an external Apply button can read the whole selection). |
| `max` | `number` | Collapse to the first N facets behind a "Show more" toggle (a plain count, not a visual dimension). Omit to show all. |
| `showMoreLabel` | `string` | Label for the expand toggle when collapsed (default "Show {n} more", where {n} is the hidden count). Use the literal `{n}` placeholder to position the count; escaped text. |
| `showLessLabel` | `string` | Label for the collapse toggle when expanded (default "Show less"). Set for localisation; escaped text. |
| `accent` | `string` | Brand color for the checked checkbox fill (default primary token). Names a specific brand color. |
| `accentText` | `string` | Check-glyph colour ON the accent fill of a checked facet (default the primary-foreground token). Pair with a light `accent` so the tick stays visible. |
| `mutedColor` | `string` | Secondary/muted text colour — the group title, each facet result count, and the show-more toggle (default the muted-foreground token). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |

## Events

### change

A facet checkbox was toggled; params carry {value, toggled} — the FULL selected array after the toggle plus the facet value that flipped. Only fires when `emitOnChange` !== false; the selection stays live in (bindable) state regardless, so an external Button can read it via spec.state.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
