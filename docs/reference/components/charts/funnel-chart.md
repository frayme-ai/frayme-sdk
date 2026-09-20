# FunnelChart

Conversion funnel: stacked trapezoid stages narrowing as values drop. Each stage is { label, value, color? }; width is value÷max. `showPercent` annotates conversion vs the first stage.

## Example

```json
{
  "root": "funnel-chart",
  "elements": {
    "funnel-chart": {
      "type": "FunnelChart",
      "props": {
        "stages": [
          {
            "label": "Visited",
            "value": 1000
          },
          {
            "label": "Signed up",
            "value": 420
          },
          {
            "label": "Activated",
            "value": 180
          },
          {
            "label": "Paid",
            "value": 64
          }
        ],
        "showPercent": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `stages` | `({ label: string, value: number, color: string })[]` | The funnel stages top→bottom; each is { label, value, color? }. Stage width = value ÷ the largest stage. |
| `orientation` | `"vertical" \| "horizontal"` | Narrowing direction: vertical (stages stacked top→bottom, default) · horizontal (stages flow left→right). |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Head colour of the funnel’s single-hue ramp; stages step from it toward the card surface, densest first. It does NOT give each stage a different hue. brand (the primary hue, default) · cool (teal) · warm (amber) · mono (neutral grey tints) · categorical (a set of distinct hues has no ordered reading on a funnel, so this renders the brand ramp). A per-stage `color` overrides that stage. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~220px). Bounded 80-800. |
| `size` | `"sm" \| "md" \| "lg"` | Overall scale of dots, labels, and strokes (default md). |
| `showValues` | `boolean` | Print each stage’s value in the stage list below the funnel (default true). |
| `showPercent` | `boolean` | Print each stage’s percent of the FIRST stage (conversion rate; default false). |
| `mutedColor` | `string` | Secondary/muted text colour, the conversion-rate percent beside each stage and the empty-state caption (default the muted-foreground token). |
| `fillOpacity` | `"solid" \| "soft"` | Band fill weight: solid (the stage ramp at full strength, default) · soft (translucent bands, for a funnel used as a backdrop behind other content). soft shallows the stage ramp so the late stages stay visible, so keep solid when the colour step down the stages is doing the work. |
| `emptyText` | `string` | Override the empty-state message shown when there is no renderable data (default "No data"). |
| `ariaLabel` | `string` | Override the chart’s accessible summary (the role="img" aria-label). Default is an auto-computed description of the data. |
