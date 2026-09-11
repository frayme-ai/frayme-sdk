# Charts

17 components in this group.

| Component | Description |
|---|---|
| [AreaChart](area-chart.md) | Filled area chart (one or more series). Each series is { name, points:number[], color? }. `stacked` cumulates  |
| [BarChart](bar-chart.md) | Bar/column chart. Single-series: `data` = { label, value, color? }[]. Multi-series (grouped or stacked compari |
| [BarList](bar-list.md) | A ranked list of horizontal bars (Tremor BarList style): each row is a label with a bar sized proportionally t |
| [Candlestick](candlestick.md) | An OHLC candlestick finance chart. Each candle is { label?, open, high, low, close }; the wick spans low→high  |
| [DonutChart](donut-chart.md) | Donut / ring chart of proportional segments. Each datum is { label, value, color? }; arcs are value÷total. `sh |
| [FunnelChart](funnel-chart.md) | Conversion funnel: stacked trapezoid stages narrowing as values drop. Each stage is { label, value, color? };  |
| [Gauge](gauge.md) | A single-value half-circle (180°) gauge dial. The arc sweep = (value−min)/(max−min). `thresholds` color the ar |
| [Heatmap](heatmap.md) | A 2D heatmap: a grid of cells where each cell is tinted by its numeric magnitude (value / grid-max). Use for a |
| [LineChart](line-chart.md) | Line chart (one or more series). Each series is { name, points:number[], color? }. `palette` colors series wit |
| [PieChart](pie-chart.md) | Full proportional pie chart (no center hole). Each datum is { label, value, color? }; wedge angle is value÷tot |
| [RadarChart](radar-chart.md) | Radar / spider chart comparing series across shared axes. `axes` are the spoke labels; each series is { name,  |
| [RadialBar](radial-bar.md) | Concentric proportional rings (one per datum). Each ring’s arc = value÷max of a full circle; the first datum i |
| [Sankey](sankey.md) | Sankey flow diagram: bands flow left→right between nodes laid out in columns. `nodes` are { label, color? }; ` |
| [ScatterChart](scatter-chart.md) | Scatter plot of X/Y points across one or more series. Each series is { name, points:{x,y}[], color? }; both ax |
| [Sparkline](sparkline.md) | A tiny inline trend chart (no axes). `points` is a number[]; `type` picks line/area/bar; `tone` or `color` set |
| [Tracker](tracker.md) | A row of equal-width status blocks (Tremor-style tracker). Each block is colored by its `tone` token (success/ |
| [Treemap](treemap.md) | A single-level treemap of proportional rectangles (slice-and-dice). Each datum is { label, value, color? }; re |
