# Sankey

Sankey flow diagram: bands flow left→right between nodes laid out in columns. `nodes` are { label, color? }; `links` are { source, target, value } by node index. Band thickness and node height scale with flow.

## Example

```json
{
  "root": "sankey",
  "elements": {
    "sankey": {
      "type": "Sankey",
      "props": {
        "nodes": [
          {
            "label": "Visitors"
          },
          {
            "label": "Sign-ups"
          },
          {
            "label": "Trials"
          },
          {
            "label": "Paid"
          }
        ],
        "links": [
          {
            "source": 0,
            "target": 1,
            "value": 500
          },
          {
            "source": 1,
            "target": 2,
            "value": 220
          },
          {
            "source": 2,
            "target": 3,
            "value": 90
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
| `nodes` | `({ label: string, color: string })[]` | The nodes; each is { label, color? }. Referenced by index from `links`. |
| `links` | `({ source: number, target: number, value: number, color: string })[]` | The flows between nodes; each is { source:index, target:index, value, color? }. Out-of-range / non-finite links are dropped. |
| `nodeWidth` | `"thin" \| "md" \| "thick"` | Width of each node bar: thin · md (default) · thick. |
| `palette` | `"brand" \| "cool" \| "warm" \| "categorical" \| "mono"` | Named series-color set (token-based): brand (primary + sky/teal/amber/rose, default) · cool (blues/teals) · warm (oranges/reds) · categorical (distinct hues) · mono (one-color tints). A per-item `color` overrides its slot. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~220px). Bounded 80-800. |
| `fillOpacity` | `"solid" \| "soft"` | Flow-band fill weight: solid (heavier, more opaque bands) · soft (lighter, more translucent). Default keeps the current band opacity. |
| `showValues` | `boolean` | Print each node’s total throughput in the legend below the chart (default false). |
| `showLegend` | `boolean` | Show the legend mapping colour→node label below the diagram (default true). Hide it when the node labels alone carry the story. |
| `mutedColor` | `string` | Secondary/muted text colour, the legend node names and the empty-state caption (default the muted-foreground token). |
| `emptyText` | `string` | Override the empty-state message shown when there is no renderable data (default "No data"). |
| `ariaLabel` | `string` | Override the chart’s accessible summary (the role="img" aria-label). Default is an auto-computed description of the data. |
