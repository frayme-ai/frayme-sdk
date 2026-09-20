# Rating

Star/heart rating that doubles as an input or a display. Clicking sets value + emits change unless readOnly; when interactive, hovering an icon previews the fill up to it. allowHalf renders fractional fills (display side). Use { $bindState } on value for two-way binding; color names the filled-icon color, mutedColor the empty icons.

## Example

```json
{
  "root": "rating",
  "elements": {
    "rating": {
      "type": "Rating",
      "props": {
        "value": 4,
        "max": 5,
        "icon": "star"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `number` | Current rating, 0..max. Use { $bindState } for two-way binding. |
| `max` | `number` | Number of icons rendered (default 5; clamped 1..20 by the renderer). |
| `icon` | `"star" \| "heart"` | Glyph repeated across the row: `star` (default) for reviews/scores, or `heart` for likes/favourites. Purely visual, does not change the value semantics. |
| `allowHalf` | `boolean` | Render half-filled icons for fractional values (display side; clicks still set whole steps). |
| `readOnly` | `boolean` | Display-only, no hover/click (renders as an image with an accessible "Rated N of M" label). |
| `size` | `"sm" \| "md" \| "lg"` | Icon size in px (default md; sm=16px, md=22px, lg=28px). |
| `color` | `string` | Text colour of the filled star/heart glyphs at rest (default a warning/amber token). Set it against the surface the rating sits on; `mutedColor` colours the unfilled glyphs. |
| `accent` | `string` | Keyboard focus-ring color, AND the hover-preview fill color when interactive: hovering icon N previews icons 1..N filled in this colour (reverting on mouse-leave). Defaults to `color`, else the primary token. |
| `mutedColor` | `string` | Text colour of the unfilled star/heart glyphs, the empty base layer under each icon (default the muted-foreground token). Set it up on tinted or dark cards where the default glyph disappears. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |

## Events

### change

An icon was clicked to set the rating (not readOnly); params carry { value } (the whole-number rating set). Only fires when emitOnChange !== false.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
