# Collapsible

Single expandable section: a full-width trigger showing `title` + a caret, with children revealed below when open. Choose it for one show/hide region holding real child components (advanced settings, filter panels); Accordion is the multi-section sibling but takes plain [{title, content}] strings only. Uncontrolled via `defaultOpen`, or bind `open` with { $bindState }.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "collapsible",
  "elements": {
    "collapsible": {
      "type": "Collapsible",
      "props": {
        "title": "Advanced options",
        "defaultOpen": false,
        "open": null,
        "variant": null,
        "size": null,
        "radius": null,
        "radiusValue": null,
        "iconPosition": null,
        "borderColor": null,
        "accent": null,
        "chevronIcon": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Trigger text — the always-visible section heading the user clicks to expand/collapse. Keep to 2-6 words ("Advanced options"). |
| `defaultOpen` | `boolean` | Start expanded on first render (uncontrolled; default false = collapsed). Ignored once a bound `open` resolves. |
| `open` | `boolean` | Controlled open state. Use { $bindState } to drive it from state; omit for uncontrolled (use defaultOpen instead). |
| `variant` | `"bordered" \| "ghost"` | With (bordered, default) or without (ghost) a surrounding border box. |
| `size` | `"sm" \| "md" \| "lg"` | Trigger + body padding and trigger font size (the body gutter tracks the trigger), and the caret glyph size (14/16/18). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner radius of the box: none · sm · md (default, the theme radius) · lg · full. Visible with variant:bordered; use `radiusValue` for an exact value. |
| `radiusValue` | `string \| number` | Exact corner radius of the box (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `iconPosition` | `"start" \| "end"` | Caret position relative to the title: start (left) or end (right, default). |
| `borderColor` | `string` | Border color of the surrounding box (default the border token); only visible with variant:bordered. Set it to tint the outline — e.g. a soft brand edge on a highlighted panel. |
| `accent` | `string` | Text colour of the trigger title and its caret glyph, in every open/closed state (default: inherits the surrounding ink). The body content keeps its own colours. |
| `chevronIcon` | `string` | Expand/collapse caret glyph — an icon NAME from the closed registry (e.g. "chevron-down", "plus"). Unknown/omitted → the default ▾ caret. Never raw SVG. |

## Events

### change

The section was expanded or collapsed via its trigger; params carry {open} — the resolved boolean open state after the toggle.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
