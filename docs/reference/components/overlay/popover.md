# Popover

Click-triggered floating panel showing `content` next to a `trigger` button. Light-dismiss: clicking outside the panel or pressing Escape closes it (re-clicking the trigger also toggles). Use over Tooltip when the panel needs to stay open for reading/interaction rather than vanish on mouse-out, and over DropdownMenu when the panel is free-form text rather than a list of selectable items. Bind `open` with { $bindState } so the agent (or a sibling control) can read whether the panel is currently open from spec.state.

## Example

```json
{
  "root": "popover",
  "elements": {
    "popover": {
      "type": "Popover",
      "props": {
        "trigger": "Filters",
        "content": "Narrow results by status, owner, and date range.",
        "open": null,
        "defaultOpen": null,
        "triggerVariant": null,
        "placement": "bottom",
        "align": null,
        "size": null,
        "radius": null,
        "radiusValue": null,
        "bg": null,
        "borderColor": null,
        "accent": null,
        "width": null,
        "shadow": null,
        "motion": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `trigger` | `string` | The trigger button label (e.g. "More info", "Filters"). Click toggles the floating `content` panel open/closed. |
| `content` | `string` | Text rendered inside the floating panel once opened. For richer content than plain text, compose the panel from other components instead of this one Popover. |
| `open` | `boolean` | Controlled open state of the floating panel. Use { $bindState } so an external Button can read/drive whether the popover is open — mirrored back into spec.state on every open/close. Omit for uncontrolled (see defaultOpen). |
| `defaultOpen` | `boolean` | Start the panel open on first render (uncontrolled; default false = closed). Ignored once a bound `open` resolves. |
| `triggerVariant` | `"default" \| "outline" \| "ghost"` | Trigger button style: default (filled) · outline · ghost. |
| `placement` | `"bottom" \| "top" \| "left" \| "right"` | Which side of the trigger the panel opens toward (default bottom). |
| `align` | `"start" \| "center" \| "end"` | Panel alignment along the trigger edge (default start). |
| `size` | `"sm" \| "md" \| "lg"` | Panel min-width + padding: sm · md (default) · lg. For an exact width use `width`. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding of the floating panel — none · sm · md · lg · full (default md, the frayme radius token). |
| `radiusValue` | `string \| number` | Exact panel corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `bg` | `string` | Background colour of the floating panel surface (default the card token). Pair with a dark value for a branded popover so the `content` stays legible on the fill. |
| `borderColor` | `string` | Border colour of the floating panel (default the border token). Set it to tint the panel outline — e.g. to match a custom `bg` or a brand edge. |
| `accent` | `string` | Text colour of the trigger button label — and its border on the outline variant — when `triggerVariant` is outline or ghost (default the primary token). |
| `width` | `string \| number` | Exact panel width (e.g. "16rem"). Overrides the `size` enum min-width. |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Elevation of the floating popover panel (none · sm · md · lg · xl); overrides the default raised shadow. |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for this overlay (fast/normal/slow). Default: no animation — the panel appears instantly. |

## Events

### change

The panel was opened or closed — via the trigger, an outside click, or Escape; params carry {open} — the resolved boolean open state after the toggle.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
