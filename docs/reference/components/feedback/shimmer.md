# Shimmer

A streaming placeholder: N animated shimmer lines (the last shorter) shown while the assistant is still generating text. Purely decorative (aria-hidden). Default 3 lines.

## Example

```json
{
  "root": "shimmer",
  "elements": {
    "shimmer": {
      "type": "Shimmer",
      "props": {
        "lines": 3
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `lines` | `string \| number` | How many shimmer lines to render (1-6; the last is shorter). Use while streaming text is still arriving. |
