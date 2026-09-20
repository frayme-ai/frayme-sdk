# Slider

Draggable single-thumb range control bound to a numeric `value` between `min` and `max`. Use for a continuous or evenly-stepped numeric setting (volume, price budget), reach for Input `type:number` instead when precise keyboard entry matters more than a visual range, and for a discrete small option set (2-5 named choices) prefer Radio/ToggleGroup. Use `{ $bindState }` on `value` for two-way binding.

## Example

```json
{
  "root": "slider",
  "elements": {
    "slider": {
      "type": "Slider",
      "props": {
        "label": "Budget",
        "name": "budget",
        "min": 0,
        "max": 1000,
        "step": null,
        "value": 250,
        "showValue": null,
        "trackColor": null,
        "valueSuffix": "£",
        "marks": null,
        "mutedColor": null,
        "emitOnChange": null,
        "disabled": null,
        "readonly": null,
        "required": null,
        "helpText": null,
        "errorText": null,
        "size": null,
        "labelPlacement": null,
        "labelColor": null,
        "accent": null,
        "width": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The field label shown above the track (or visually hidden via `labelPlacement:hidden`). Keep to 1-3 words ("Volume", "Budget"). Omit for a bare slider with no caption. |
| `name` | `string` | The form field name, the key this value is collected under in a Form's `commit` `fields` payload, and used to derive the field's DOM id. |
| `min` | `number` | Range minimum, in the same units as `value` (default 0). |
| `max` | `number` | Range maximum, in the same units as `value` (default 100). |
| `step` | `number` | Increment the thumb snaps to on drag/arrow-key (default 1). Use a fraction (e.g. 0.1) for finer control. |
| `value` | `number` | Current numeric position within [min, max]. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial position. |
| `showValue` | `boolean` | Render the live numeric readout beside the label (default true). Suffix it via `valueSuffix`. |
| `trackColor` | `string` | Colour of the unfilled portion of the track behind the thumb (default the border token); the filled portion + thumb use `accent`. Set it for contrast on a dark/tinted surface. |
| `valueSuffix` | `string` | Unit string appended to the live numeric readout (e.g. "%", "°C", " GB"); default none. Set it so the value reads with its unit, pairs with `showValue`, which renders the readout. |
| `marks` | `number[] \| object[]` | Tick labels under the track, each positioned at its true value along the min-max range (marks need not be evenly spaced): array of numbers, or {value,label} objects. |
| `mutedColor` | `string` | Secondary/muted text colour, the value readout + mark labels (default the muted-foreground token). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |
| `disabled` | `boolean` | Grey out + block input (adds `disabled`/`aria-disabled`). |
| `readonly` | `boolean` | Value is visible but not editable (`readOnly`; Select/Switch/Slider become non-interactive). |
| `required` | `boolean` | Mark the field required (`required` attr + a required marker on the label). |
| `helpText` | `string` | Muted hint line under the control, formatting guidance or context (hidden while `errorText` is set). |
| `errorText` | `string` | Error message under the field, the danger help line + `aria-invalid` on the control; the text-box controls (Input/Textarea/Select) also get a danger control border (overrides helpText when set). |
| `size` | `"sm" \| "md" \| "lg"` | Control height, font-size, and padding together (default `md`); use `sm` in dense forms and filter rows, `lg` for touch targets or roomy layouts. |
| `labelPlacement` | `"top" \| "hidden"` | Label position: top (default) · hidden (visually removed but kept for a11y via sr-only). |
| `labelColor` | `string` | Text colour of the field label/legend line above or beside the control (default the foreground token, inherits). Help text stays `mutedColor`; the error line stays the danger token. |
| `accent` | `string` | Brand color lever: focus ring + checked/active fill. Defaults to the accent token, a neutral until a theme sets one. |
| `width` | `string \| number` | Field width (e.g. "12rem" or "100%"; default 100%). For Checkbox/Radio/Switch (default auto) it constrains the whole field incl. label wrap. |

## Events

### change

The thumb moved to a new value (drag or arrow key); params carry {value, name}. Only fires when `emitOnChange` !== false; the bound `value` state stays live regardless.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

The drag/interaction settled on one final value (pointer released, or the value changed via keyboard); params carry {value, name}, the single settled value per interaction, always emitted even when `emitOnChange` is false.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
