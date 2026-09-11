# SegmentedControl

Inline exclusive option group (a view/sort/density switch): a rounded track of segments where the selected one gets a raised pill (aria-pressed). Icons resolve against the closed registry. Use { $bindState } on value for two-way binding; clicking a segment emits change.

## Example

```json
{
  "root": "segmented-control",
  "elements": {
    "segmented-control": {
      "type": "SegmentedControl",
      "props": {
        "options": [
          {
            "label": "List",
            "value": "list"
          },
          {
            "label": "Grid",
            "value": "grid"
          }
        ],
        "value": "list"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `options` | `({ label: string, value: string, icon: string })[]` | The exclusive segments ({ label, value, icon? }). Required content. |
| `label` | `string` | Field label rendered above the track (default none). Set it whenever the control sits beside LABELLED fields — an unlabelled switch next to a labelled select is both ambiguous ("Morning/Afternoon" of what?) and a row that cannot line up, since its neighbour carries a label line and it does not. |
| `value` | `string` | The selected segment value. Use { $bindState } for two-way binding. |
| `size` | `"sm" \| "md" \| "lg"` | Track height/font-size/padding token (default `md`); use `sm` in dense toolbars, `lg` for touch or prominent switches. |
| `fullWidth` | `boolean` | Stretch the track to the container width with equal-width segments. |
| `iconOnly` | `boolean` | Show only the icon for each segment (label moves to aria-label). |
| `accent` | `string` | Background fill of the selected pill (default the card token — a raised neutral pill) and the ground `accentText` is read against; every segment's keyboard focus ring derives from it too (default the primary token). |
| `accentText` | `string` | Text color on the selected pill (default the foreground token; primary-foreground when `accent` is set, so a saturated fill keeps readable ink). |
| `trackColor` | `string` | Resting track colour behind the pills — the rounded rail the segments sit on (default the muted token). |
| `connectorColor` | `string` | Colour of the thin dividers between resting (unselected) segments (default the border token; suppressed beside the selected pill). |
| `disabled` | `boolean` | Grey out the whole track (60% opacity, not-allowed cursor) and block selecting any segment (default false). |
| `radiusValue` | `string \| number` | Exact corner radius shared by the rail and the segment pills (e.g. "12px" or "0.75rem"; default the frayme radius). Overrides the default rounding. |

## Events

### change

A different segment was clicked/selected; params carry { value } (the newly selected segment's value).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
