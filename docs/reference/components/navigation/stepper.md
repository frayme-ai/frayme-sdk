# Stepper

A numbered step-progress indicator. Completed steps (before `current`) show a check, the current step is highlighted (aria-current=step), and future steps are muted. A per-step `tone` marks a validation status (e.g. critical = a failed step, filled red with an ✕). When `clickable`, clicking a step sets `current` locally (works with no binding) and emits `change`.

## Example

```json
{
  "root": "stepper",
  "elements": {
    "stepper": {
      "type": "Stepper",
      "props": {
        "steps": [
          {
            "label": "Account"
          },
          {
            "label": "Profile"
          },
          {
            "label": "Billing"
          },
          {
            "label": "Done"
          }
        ],
        "current": 1,
        "clickable": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `steps` | `({ label: string, description: string, icon: string, tone: "neutral" \| "success" \| "warning" \| "critical" \| "info" })[]` | The ordered steps. Each: a label, an optional description, an optional icon NAME (shown instead of the number when not completed), and an optional `tone` marking a validation status (e.g. critical for a failed step). |
| `current` | `number` | The active step index (0-based). Stays live unbound (internal state); bind it to sync the active step across components. Completed steps (< current) show a check; future steps are muted. A plain index, not a visual dimension. |
| `orientation` | `"horizontal" \| "vertical"` | Lay the steps left-to-right (horizontal, default) or top-to-bottom (vertical). |
| `clickable` | `boolean` | Make each step a button that sets `current` to its index (locally, no binding needed) and emits `change`. Off by default (display-only progress). |
| `size` | `"sm" \| "md" \| "lg"` | Overall scale of the stepper — marker diameter, number/label/description text size, and the connector offsets that track them (default md). |
| `accent` | `string` | Color of the completed/current markers and the filled connector segment (default primary token). Names a specific brand color. |
| `connectorColor` | `string` | Color of the INCOMPLETE progress chrome — the connector segment between not-yet-reached steps AND the un-reached marker rings (default the border token). The completed segment stays `accent`. |
| `mutedColor` | `string` | Secondary/muted text colour — each step description line AND the not-yet-reached (future) step labels (default the muted-foreground token). |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the step labels (default medium). Set to override the baked label weight. |

## Events

### change

A step was clicked while `clickable` is on (also sets `current` locally); params carry {index, label} of the chosen step.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
