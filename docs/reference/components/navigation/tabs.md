# Tabs

Tab navigation: a tablist built from `tabs` [{label, value}] above a single shared children panel. The children do NOT switch per tab by themselves, bind `value` with { $bindState } and drive child visibility from that state (or use `defaultValue` for uncontrolled). Choose Tabs to switch between peer views in place; Accordion/Collapsible stack expandable sections instead, and ToggleGroup/ButtonGroup pick a value rather than a view.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "tabs",
  "elements": {
    "tabs": {
      "type": "Tabs",
      "props": {
        "tabs": [
          {
            "label": "Overview",
            "value": "overview"
          },
          {
            "label": "Billing",
            "value": "billing"
          },
          {
            "label": "Team",
            "value": "team"
          }
        ],
        "defaultValue": "overview",
        "value": null,
        "variant": null,
        "size": null,
        "align": null,
        "fitted": null,
        "accent": null,
        "radiusValue": null,
        "mutedColor": null,
        "trackColor": null,
        "borderColor": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `tabs` | `({ label: string, value: string, icon: string, count: number })[]` | The tab list as [{label, value, icon?, count?}], label is the visible tab text, value the state value bound/emitted on selection, with an optional leading `icon` (registry name) and trailing `count` badge, e.g. [{"label":"Inbox","value":"inbox","icon":"mail","count":3},{"label":"Billing","value":"billing"}]. |
| `defaultValue` | `string` | Initial active tab `value` for uncontrolled use (default: the first tab). Ignored once a bound `value` resolves. |
| `value` | `string` | Controlled active tab (a tab `value`). Use { $bindState } for two-way binding so other elements can read and drive the active tab. |
| `variant` | `"underline" \| "pill" \| "enclosed"` | Tab visual style: underline (default) · pill (segmented chips) · enclosed (boxed tabs). |
| `size` | `"sm" \| "md" \| "lg"` | Tab density, padding + font size of each tab: sm · md (default) · lg. |
| `align` | `"start" \| "center" \| "end" \| "stretch"` | Tablist distribution. `stretch` makes full-width tabs that share the row. |
| `fitted` | `boolean` | Split available width equally between tabs (full-width fitted tabs). |
| `accent` | `string` | Text colour of the ACTIVE tab label on every variant (carried 65% toward the surrounding ink so a brand colour keeps contrast), and the colour of the 2px underline indicator rule beneath it on variant:underline. Default: the inherited surface ink. |
| `radiusValue` | `string \| number` | Exact corner radius of the segmented pill track (variant:pill only), e.g. "12px" / "1rem". Default the theme radius; no effect on the underline/enclosed variants. |
| `mutedColor` | `string` | Text colour of the inactive (resting) tab labels and of their trailing count badges (default the muted-foreground token). |
| `trackColor` | `string` | Background of the segmented pill track behind the tabs on variant:pill; on variant:underline/enclosed the same value is instead the colour of the divider rule under the rail and of the selected enclosed tab's side/top edges (default the border/muted token). |
| `borderColor` | `string` | Resting (unselected) tab border colour for enclosed tabs (variant:enclosed), the inactive tab edge before selection (default transparent; the selected tab keeps its own border). |

## Events

### change

A tab was clicked; params carry {value, label} of the newly active tab.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
