# RangeSlider

Dual-thumb range filter for a price/age band, with an optional histogram behind the track. Bind valueMin & valueMax with { $bindState }; the thumbs clamp so valueMin never crosses valueMax. accent fills the selected range.

## Example

```json
{
  "root": "range-slider",
  "elements": {
    "range-slider": {
      "type": "RangeSlider",
      "props": {
        "min": 0,
        "max": 1000,
        "valueMin": 200,
        "valueMax": 800,
        "marks": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `min` | `number` | Scale minimum, the left end of the track (default 0); `valueMin` clamps to this floor. Set for a domain other than 0. |
| `max` | `number` | Scale maximum, the right end of the track (default 100); `valueMax` clamps to this ceiling. Set for a price/age domain wider than 100. |
| `step` | `number` | Thumb increment applied when dragging either handle (default 1; e.g. 5 for whole-band price steps). |
| `valueMin` | `number` | Current lower selection. Use { $bindState } for two-way binding. |
| `valueMax` | `number` | Current upper selection. Use { $bindState } for two-way binding. |
| `showHistogram` | `boolean` | Render the `histogram` bars behind the track (a distribution preview). |
| `histogram` | `number[]` | Bar heights drawn behind the track (normalized to the tallest); pair with showHistogram. |
| `marks` | `boolean` | Show the `min` & `max` tick labels under the two ends of the track (default false). Turn on to anchor the scale; distinct from `showValues`, which reads out the selected band. |
| `showValues` | `boolean` | Render the currently-SELECTED band as a "lo, hi" readout above the track (default false). Distinct from `marks` (which only labels the scale min & max). |
| `valuePrefix` | `string` | Text prefixed to each value in the `showValues` readout (e.g. "£", "$"; default none). |
| `valueSuffix` | `string` | Text suffixed to each value in the `showValues` readout (e.g. "%", "km"; default none). |
| `size` | `"sm" \| "md" \| "lg"` | Track thickness and thumb diameter (default md; sm=4px track/12px thumb, md=6px/16px, lg=8px/20px). |
| `width` | `string \| number` | Exact slider width (e.g. 320px / 24rem). Overrides the default 100% fill. |
| `disabled` | `boolean` | Grey out the whole control (60% opacity, not-allowed cursor) and block dragging both thumbs (default false). |
| `accent` | `string` | The selected-range fill + thumb color (default primary token). |
| `trackColor` | `string` | The inactive-surface colour outside the selected range, the unfilled track (default border token) and the out-of-range histogram bars when `showHistogram` (default muted token). |
| `mutedColor` | `string` | Secondary/muted text colour, the min & max tick `marks` labels (default the muted-foreground token). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |

## Events

### change

Either thumb was dragged to a new position; params carry { valueMin, valueMax } (the full current band, not just the moved thumb). Only fires when emitOnChange !== false.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
