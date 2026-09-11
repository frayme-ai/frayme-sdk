# Toggle

Toggle button. Use { $bindState } on pressed for state binding. `activeColor`/`activeText` color the pressed state; `trackColor`/`borderColor`/`color` color the resting (unpressed) state.

## Example

```json
{
  "root": "toggle",
  "elements": {
    "toggle": {
      "type": "Toggle",
      "props": {
        "label": "Bold",
        "pressed": false,
        "variant": "outline",
        "iconOnly": null,
        "tone": null,
        "activeColor": null,
        "activeText": null,
        "trackColor": null,
        "borderColor": null,
        "color": null,
        "radiusValue": null,
        "icon": null,
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
| `label` | `string` | The button text (or, when `iconOnly` is set, the accessible name only — the visible label is hidden and `icon` shows instead). Keep to 1-2 words ("Bold", "Mute"). |
| `pressed` | `boolean` | Whether the toggle is currently pressed/active. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial state (default false). |
| `variant` | `"default" \| "outline"` | Resting (unpressed) look: default (filled card surface) · outline (bordered, transparent fill). The pressed state always fills with `activeColor`/`accent` regardless of `variant`. |
| `iconOnly` | `boolean` | Square icon button; `label` becomes the aria-label. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic intent (decoupled from variant): neutral · success · warning · critical · info |
| `activeColor` | `string` | Background fill (and matching border) when pressed — default a neutral muted-token fill, matching shadcn/Radix Toggle. Reads via the aria-pressed: recipe, and is the ground `activeText` is read against. |
| `activeText` | `string` | Text color when pressed (default the foreground token). |
| `trackColor` | `string` | Resting (unpressed) background fill of the control (default the card token) — the ground the resting `color` label is read against. Distinct from `activeColor`, which colours the pressed state. |
| `borderColor` | `string` | Resting (unpressed) border color (default the border token). Distinct from `activeColor`, which colors the pressed state. |
| `color` | `string` | Resting (unpressed) label text color (default the foreground token). Distinct from `activeText`, which colors the pressed state — completes the resting fill/border/text trio (Pagination parity). |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default; in an `attached`/segmented ToggleGroup it rounds only the outer end-cap corners (inner edges stay square). |
| `icon` | `string` | Leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "bold", "bell"). Never raw SVG; unknown names render nothing. |
| `accent` | `string` | Background fill of the pressed state when no `activeColor` is set (default the muted token); pairs with `accentText` for the pressed label. |
| `accentText` | `string` | Text colour of the label printed on the `accent` fill — the on-fill ink (default the primary-foreground token). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner-radius token for the control (default `md`); drop to `sm`/`none` on dense toolbars, `lg` or `full` for a pill-shaped button. |
| `size` | `"sm" \| "md" \| "lg"` | Control height + padding + font-size together (default md). |
| `fullWidth` | `boolean` | Stretch the control to fill its container width (default false); set true for stacked mobile CTAs or a button that spans a form row. |
| `align` | `"start" \| "center" \| "end"` | Inline content / justification within the control (default center). |
| `disabled` | `boolean` | Grey out + block input (adds `disabled`/`aria-disabled`). Also what the runtime sets once an action this control feeds has committed — see the param freeze. |

## Events

### change

The button was clicked, flipping `pressed`; params carry {pressed}.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
