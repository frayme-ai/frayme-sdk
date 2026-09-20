# ButtonGroup

Segmented button group. Use { $bindState } on selected for selected value. `accent` colors the selected segment; `trackColor` colors the resting (unselected) segments.

## Example

```json
{
  "root": "button-group",
  "elements": {
    "button-group": {
      "type": "ButtonGroup",
      "props": {
        "buttons": [
          {
            "label": "Day",
            "value": "day"
          },
          {
            "label": "Week",
            "value": "week"
          },
          {
            "label": "Month",
            "value": "month"
          }
        ],
        "selected": "week",
        "orientation": null,
        "variant": null,
        "tone": null,
        "borderColor": null,
        "trackColor": null,
        "icons": null,
        "radiusValue": null,
        "accent": null,
        "accentText": null,
        "radius": null,
        "size": null,
        "fullWidth": null,
        "align": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `buttons` | `({ label: string, value: string })[]` | The segments as [{label, value}], label is the visible segment text, value the id emitted on `change` and matched against `selected`, e.g. [{"label":"Day","value":"day"},{"label":"Week","value":"week"}]. |
| `selected` | `string` | Currently active segment (must match one button's `value`). Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial selection (default none active). |
| `orientation` | `"horizontal" \| "vertical"` | Lay the segments out as a row (default) or stacked in a column. |
| `variant` | `"solid" \| "outline"` | Filled selected segment (default solid) vs outlined. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent (decoupled from variant): neutral · success · warning · critical · info |
| `borderColor` | `string` | Segment divider/border color (default border token). |
| `trackColor` | `string` | Resting (unselected) segment background fill (default the card token; transparent for `variant:outline`), the ground those segments' labels are read against. Distinct from `accent`, which colours the selected segment. |
| `icons` | `string[]` | Optional per-segment leading icon NAMES from the closed icon registry (or a single emoji glyph, rendered as-is), parallel to `buttons`. Never raw SVG; unknown names render nothing. |
| `radiusValue` | `string \| number` | Exact corner radius of the OUTER end-cap corners (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default; the joined inner edges stay square. |
| `accent` | `string` | Selected-segment colour: with `variant:solid` (default) it is the background fill and border of the pressed segment; with `variant:outline` it is that segment's label text colour and border instead (default the primary token). |
| `accentText` | `string` | Text colour of the label printed on the `accent` fill, the on-fill ink. Defaults to the card token, the inverse of the fill in both light and dark. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner-radius token for the control (default `md`); drop to `sm`/`none` on dense toolbars, `lg` or `full` for a pill-shaped button. |
| `size` | `"sm" \| "md" \| "lg"` | Control height + padding + font-size together (default md). |
| `fullWidth` | `boolean` | Stretch the control to fill its container width (default false); set true for stacked mobile CTAs or a button that spans a form row. |
| `align` | `"start" \| "center" \| "end"` | Inline content / justification within the control (default center). |
| `disabled` | `boolean` | Grey out + block input (adds `disabled`/`aria-disabled`). Also what the runtime sets once an action this control feeds has committed, see the param freeze. |

## Events

### change

A segment was clicked, becoming the new `selected`; params carry {value, label, index}.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
