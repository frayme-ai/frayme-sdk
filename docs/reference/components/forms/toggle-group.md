# ToggleGroup

Group of toggle buttons. Type 'single' (default) or 'multiple'. Use { $bindState } on value. `attached` joins them into a segmented control (outer end caps rounded by radius/radiusValue, inner edges square). `activeColor`/`activeText` color the selected item; `trackColor`/`borderColor`/`color` color the resting (unselected) items. Optional per-item `icons` add a leading glyph (index-aligned to `items`). Keyboard focus shows a ring and resting items give hover feedback.

## Example

```json
{
  "root": "toggle-group",
  "elements": {
    "toggle-group": {
      "type": "ToggleGroup",
      "props": {
        "items": [
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
        "type": "single",
        "value": "week",
        "orientation": null,
        "attached": true,
        "variant": null,
        "tone": null,
        "activeColor": null,
        "activeText": null,
        "trackColor": null,
        "borderColor": null,
        "color": null,
        "gapValue": null,
        "radiusValue": null,
        "icons": null,
        "emitOnChange": null,
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
| `items` | `({ label: string, value: string })[]` | The segmented options as [{label, value}], label is the visible chip text, value the id tracked in `value`, e.g. [{"label":"Bold","value":"bold"},{"label":"Italic","value":"italic"}]. |
| `type` | `"single" \| "multiple"` | single (default, one item pressed at a time, like Radio) vs multiple (any number pressed, like a checkbox group). Determines how `value` is read/written. |
| `value` | `string` | Currently pressed item(s). For `type:single` a single item `value`; for `type:multiple` a comma-separated list of pressed values (e.g. "bold,italic"). Use `{ $bindState }` for two-way binding; otherwise sets the initial selection (default none pressed). |
| `orientation` | `"horizontal" \| "vertical"` | Axis the items lay out on: horizontal (a row, default) · vertical (a stacked column). Reach for vertical in a narrow sidebar or when the labels are long enough to crowd a row. |
| `attached` | `boolean` | Segmented (joined, no gap) vs spaced chips (default false = spaced). |
| `variant` | `"default" \| "outline"` | Resting look of each unselected item: default (filled card surface) · outline (bordered, transparent fill). Use `outline` for a lighter toolbar; the selected item always fills with `activeColor`/`accent`. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent (decoupled from variant): neutral · success · warning · critical · info |
| `activeColor` | `string` | Background fill of the selected item (default a neutral muted-token fill, matching shadcn/Radix Toggle), the ground `activeText` is read against. Reads via the aria-pressed: recipe. |
| `activeText` | `string` | Selected-item text color (default the foreground token). |
| `trackColor` | `string` | Resting (unselected) item background fill (default the card token), the ground the resting `color` label is read against. Distinct from `activeColor`, which colours the selected item. |
| `borderColor` | `string` | Resting (unselected) item border color (default the border token). Distinct from `activeColor`, which colors the selected item. |
| `color` | `string` | Resting (unselected) item text color (default the foreground token). Distinct from `activeText`, which colors the selected item, completes the resting fill/border/text trio (Pagination parity). |
| `gapValue` | `string \| number` | Exact spacing between items (e.g. "8px") when not `attached`. Default ~4px. |
| `radiusValue` | `string \| number` | Exact corner radius of each item (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default; when `attached` joins the items into a segmented control it rounds only the OUTER end-cap corners (first/last item, ButtonGroup parity, inner edges stay square). |
| `icons` | `string[]` | Optional per-item leading icon NAMES from the closed icon registry (or a single emoji glyph, rendered as-is), parallel to `items` (index-aligned), e.g. ["bold","italic","underline"] for a formatting toolbar (default none). Never raw SVG; unknown/absent names render no glyph. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |
| `accent` | `string` | Background fill of the selected item when no `activeColor` is set (default the muted token); pairs with `accentText` for the selected label. |
| `accentText` | `string` | Text colour of the label printed on the `accent` fill, the on-fill ink. Defaults to the card token, the inverse of the fill in both light and dark. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner-radius token for the control (default `md`); drop to `sm`/`none` on dense toolbars, `lg` or `full` for a pill-shaped button. |
| `size` | `"sm" \| "md" \| "lg"` | Control height + padding + font-size together (default md). |
| `fullWidth` | `boolean` | Stretch the control to fill its container width (default false); set true for stacked mobile CTAs or a button that spans a form row. |
| `align` | `"start" \| "center" \| "end"` | Inline content / justification within the control (default center). |
| `disabled` | `boolean` | Grey out + block input (adds `disabled`/`aria-disabled`). Also what the runtime sets once an action this control feeds has committed, see the param freeze. |

## Events

### change

An item was clicked, updating `value` per `type`; params carry {value, toggled} where `toggled` is the clicked item's value. Only fires when `emitOnChange` !== false; the bound `value` state stays live regardless (an external Button can read the accumulated selection from state).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
