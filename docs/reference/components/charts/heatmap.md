# Heatmap

A 2D heatmap: a grid of cells where each cell is tinted by its numeric magnitude (value / grid-max). Use for activity/density matrices (contribution calendars, correlation grids, cohort tables). `cells` is rows-of-columns numbers; `xLabels`/`yLabels` annotate the axes.

## Example

```json
{
  "root": "heatmap",
  "elements": {
    "heatmap": {
      "type": "Heatmap",
      "props": {
        "cells": [
          [
            1,
            4,
            9
          ],
          [
            3,
            0,
            6
          ],
          [
            8,
            2,
            5
          ]
        ],
        "colorScale": "brand",
        "xLabels": [
          "Mon",
          "Tue",
          "Wed"
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `cells` | `number[][]` | A 2D grid of numbers (rows of columns). Each cell is colored by its value relative to the grid max. |
| `colorScale` | `"brand" \| "cool" \| "warm" \| "success"` | Color ramp for cell intensity: cool (blue, default) · brand (the brand hue) · warm (amber/red) · success (green, GitHub-style). Cell opacity scales with value/max. |
| `cellSize` | `"sm" \| "md" \| "lg"` | Square cell size (default md). `sm` for dense calendars, `lg` for a small grid. |
| `showValues` | `boolean` | Print each cell value inside the cell (default false; best with `cellSize:lg`). |
| `showLegend` | `boolean` | Show a low→high intensity scale key ("Less ▫▫▪▪ More", GitHub/Tremor style) under the grid, tinted by the resolved scale colour (default false). |
| `xLabels` | `string[]` | Column header labels (content), one per column. Omit for an unlabeled grid. |
| `yLabels` | `string[]` | Row labels (content), one per row, shown on the left. Omit for an unlabeled grid. |
| `mutedColor` | `string` | Secondary/muted text colour, the x/y axis header labels around the grid and the empty-state caption (default the muted-foreground token). |
| `scaleColor` | `string` | Exact high-end colour of the intensity scale; cells blend from the muted token (low) to this colour (high). Overrides `colorScale`. |
| `valueColor` | `string` | In-cell value text colour when `showValues` is on, every printed cell number (default the foreground token). Set a light colour when high-intensity cells run dark. |
| `emptyText` | `string` | Override the empty-state message shown when there is no data (default "No data"). |
| `ariaLabel` | `string` | Override the screen-reader label for the grid (default the computed "Heatmap, N rows by M columns" summary). |
