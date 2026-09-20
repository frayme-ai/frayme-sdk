# Candlestick

An OHLC candlestick finance chart. Each candle is { label?, open, high, low, close }; the wick spans low→high and the body open→close. Up candles are colored with the success token, down candles with the danger token; chart-level `upColor`/`downColor` override those tokens (no PER-CANDLE color).

## Example

```json
{
  "root": "candlestick",
  "elements": {
    "candlestick": {
      "type": "Candlestick",
      "props": {
        "data": [
          {
            "label": "Mon",
            "open": 30,
            "high": 36,
            "low": 28,
            "close": 34
          },
          {
            "label": "Tue",
            "open": 34,
            "high": 38,
            "low": 32,
            "close": 31
          },
          {
            "label": "Wed",
            "open": 31,
            "high": 35,
            "low": 29,
            "close": 35
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
| `data` | `({ label: string, open: number, high: number, low: number, close: number })[]` | OHLC candles; each is { label?, open, high, low, close }. Up candles (close≥open) use the success token, down candles the danger token. |
| `height` | `string \| number` | Plot height (e.g. "240px" or "16rem"; default ~200px). Bounded 80-800. |
| `showGrid` | `boolean` | Draw horizontal price gridlines behind the candles (default true). |
| `showAxis` | `boolean` | Show the x-axis labels under the candles (default false). |
| `showYAxis` | `boolean` | Show price tick labels down the left edge (default false). |
| `size` | `"sm" \| "md" \| "lg"` | Candle body width / wick thickness scale (default md). |
| `upColor` | `string` | Exact fill for rising candles (close≥open). Default the success token. |
| `downColor` | `string` | Exact fill for falling candles (close&lt;open). Default the danger token. |
| `gridColor` | `string` | Exact colour of the horizontal price gridlines. Default the border token. |
| `axisColor` | `string` | Text colour of the x-axis date labels under the plot and the y-axis price tick values down the left gutter (default the muted-foreground token). |
| `mutedColor` | `string` | Secondary/muted text colour, the empty-state caption (default the muted-foreground token). |
| `emptyText` | `string` | Override the empty-state message shown when there are no valid candles (default "No data"). |
| `ariaLabel` | `string` | Override the screen-reader summary of the chart (default "Candlestick chart, N candles"). |
