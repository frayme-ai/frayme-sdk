# ColorPicker

Swatch-grid color picker with an optional hex field and a live preview chip. Two-way bound on `value`; per-swatch `color` overrides the default palette slot. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the currently selected color string from spec.state.

## Example

```json
{
  "root": "color-picker",
  "elements": {
    "color-picker": {
      "type": "ColorPicker",
      "props": {
        "label": "Brand color",
        "value": "#2563eb",
        "swatches": [
          {
            "color": "#2563eb"
          },
          {
            "color": "#10b981"
          },
          {
            "color": "#f59e0b"
          },
          {
            "color": "#ef4444"
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
| `value` | `string` | Currently selected color string (e.g. "#3b82f6"). Use { $bindState } for two-way binding. |
| `swatches` | `({ color: string, label: string })[]` | Preset swatches to choose from; each is { color, label? }. Omit for a sensible default palette. |
| `showInput` | `boolean` | Show a hex text field under the grid for free entry (default true). |
| `columns` | `string \| number` | Swatch-grid column count (default 6). Reach for fewer on narrow surfaces. |
| `accent` | `string` | Selection-ring + focus color around the active swatch, and the hex field’s focus border + ring (default primary token). |
| `bg` | `string` | Background fill of the preview chip (empty state) and the hex field (default the card token). |
| `borderColor` | `string` | Border colour of the preview chip and the hex field (default the border token). |
| `radiusValue` | `string \| number` | Exact corner rounding of the preview chip and the hex field (e.g. "12px" / "1rem"; default the frayme radius token). |
| `size` | `"sm" \| "md" \| "lg"` | Scale of the swatch tiles and preview chip: `sm` · `md` (default) · `lg`. Reach for `sm` in a dense toolbar/inline palette, `lg` for a prominent brand-colour picker. |
| `label` | `string` | Field label shown above the picker. Keep short (1-3 words), e.g. "Brand color". |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the field label (default medium); set to dial the emphasis up or down. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the field label (default normal); reach for `wide`/`wider` on an uppercase caption. |
| `disabled` | `boolean` | Grey out the whole control (60% opacity, not-allowed cursor) and block picking a swatch or typing the hex field (default false). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |
| `mutedColor` | `string` | Secondary/muted text colour — the selected-value hex readout beside the preview chip (default the muted-foreground token). |

## Events

### change

A swatch was clicked or the hex field was edited; params carry { value } (the new color string). Only fires when `emitOnChange` !== false — otherwise the value lives in bindable state for an external Button to read.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
