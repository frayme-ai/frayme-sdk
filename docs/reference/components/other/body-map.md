# BodyMap

An anatomical body-region selector on a baked stylized figure (~17 named regions, front or back). Author which regions to highlight (marks) and which is selected — the component owns all geometry. Region hit-targets are focusable HTML buttons; per-region highlight color is inline. Stateless, SSR-safe; click a region to emit `select`. Ideal for pain/symptom tracking and injury reports. Bind `selectedRegion` with `{ $bindState }` so the agent (or a sibling control) can read the clicked region id from spec.state.

## Example

```json
{
  "root": "body-map",
  "elements": {
    "body-map": {
      "type": "BodyMap",
      "props": {
        "view": "front",
        "selectedRegion": "chest",
        "marks": [
          {
            "region": "chest",
            "tone": "critical",
            "label": "Sharp pain"
          },
          {
            "region": "leftShin",
            "tone": "warning",
            "label": "Aching"
          },
          {
            "region": "rightHand",
            "tone": "info",
            "label": "Numb"
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
| `view` | `"front" \| "back"` | Which side of the figure to show (default front). Changes the region labels (chest→upper back, etc.). |
| `marks` | `({ region: "head" \| "neck" \| "chest" \| "abdomen" \| "pelvis" \| "rightUpperArm" \| "rightForearm" \| "rightHand" \| "leftUpperArm" \| "leftForearm" \| "leftHand" \| "rightThigh" \| … (+5 more), tone: "neutral" \| "info" \| "success" \| "warning" \| "critical", color: string, label: string })[]` | Regions to highlight, each { region, tone?, color?, label? }. `region` must be one of the known anatomical ids; unknown ids are ignored. Omit for a plain figure. |
| `selectedRegion` | `"head" \| "neck" \| "chest" \| "abdomen" \| "pelvis" \| "rightUpperArm" \| "rightForearm" \| "rightHand" \| "leftUpperArm" \| "leftForearm" \| "leftHand" \| "rightThigh" \| … (+5 more)` | The selected region id — the component writes the user-clicked region here into spec.state (bind with a bindable { $bindState } reference) so an external Button can read which region is selected; also seeds the initial selection. One of the ~17 known region ids. |
| `showLegend` | `boolean` | Show a legend of the highlighted regions below the figure (default true). |
| `accent` | `string` | Selection outline color (default the primary token). |
| `bodyColor` | `string` | Default (unmarked) region fill (default the muted token). |
| `lineColor` | `string` | Stroke colour of the anatomical figure outline (default the `border` token); set a brand or higher-contrast colour to match the surrounding UI. |
| `mutedColor` | `string` | Legend + secondary text (default the muted-foreground token). |

## Events

### select

A region was clicked; params carry { id, label, value, tone }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
