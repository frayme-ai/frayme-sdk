# FilterPanel

A vertical filter panel grouping several collapsible facet sections, plus an Apply button. Each section header toggles its facets (aria-expanded, live without any binding); toggling a facet emits `change` (unless `emitOnChange` is false) and Apply emits `commit` with the full selection. Use as the left rail of a search/results layout. Bind `selections` with `{ $bindState }` so the agent (or a sibling control) can read the cross-section selection map (section heading → checked facet values) from spec.state.

## Example

```json
{
  "root": "filter-panel",
  "elements": {
    "filter-panel": {
      "type": "FilterPanel",
      "props": {
        "title": "Filters",
        "sections": [
          {
            "heading": "Status",
            "facets": [
              {
                "label": "Open",
                "value": "open",
                "count": 24
              },
              {
                "label": "Closed",
                "value": "closed",
                "count": 132
              }
            ]
          },
          {
            "heading": "Priority",
            "facets": [
              {
                "label": "High",
                "value": "high",
                "count": 6
              },
              {
                "label": "Low",
                "value": "low",
                "count": 41
              }
            ],
            "collapsed": true
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
| `title` | `string` | Optional panel title shown at the top (e.g. "Filters"). |
| `sections` | `({ heading: string, facets: object[], collapsed: boolean })[]` | Facet groups (each: a heading, an optional facet list {label, value, count?, checked?}, and an optional initial-collapsed flag). Each header expands/collapses its section. |
| `accent` | `string` | Brand color for the checked checkbox fill across all sections (default primary token). Names a specific brand color. |
| `accentText` | `string` | Check-glyph colour ON the accent fill of a checked facet (default the primary-foreground token). Pair with a light `accent` so the tick stays visible. |
| `mutedColor` | `string` | Secondary/muted text colour — the per-facet result counts and the section-header collapse chevrons across all sections (default the muted-foreground token). |
| `selections` | `Record&lt;string, string[]>` | Bindable cross-section selection map (section heading → its checked facet values). Mirrors the accumulated multi-section selection into (bindable) state so an external Apply button can read the whole panel via spec.state; two-way when bound. |
| `applyLabel` | `string` | Label + accessible label of the internal Apply submit button that commits the full selection map (default "Apply filters"). Set for localisation; escaped text. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |

## Events

### change

A facet checkbox inside one of the sections was toggled; params carry {section, option, checked} — the section heading, the facet value, and its new state — PLUS the resolved selection: {selected} (that section’s full checked values after the toggle) and {selections} (a heading → checked-values map across ALL sections). Read `selections` for the complete current filter state. Only fires when `emitOnChange` !== false; the selection stays live in (bindable) state regardless.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

The Apply button was pressed; params carry {selections} — the FULL heading → checked-values map across all sections. The submit path for reading the complete panel selection on demand (always fires regardless of `emitOnChange`).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
