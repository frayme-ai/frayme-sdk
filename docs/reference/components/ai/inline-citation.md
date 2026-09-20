# InlineCitation

A small superscript "[n]" citation chip that links to a source in a new tab, with the excerpt as its hover tooltip. Place inline next to a claim in generated text. Reach for this when a single sentence needs a numbered footnote-style reference, as opposed to the Sources panel that lists the full reference set. It sits mid-flow inside a Message / MessageContent body and, unlike Sources, renders just the number, hover reveals the `excerpt` as a native title tooltip.

## Example

```json
{
  "root": "inline-citation",
  "elements": {
    "inline-citation": {
      "type": "InlineCitation",
      "props": {
        "index": 1,
        "url": "https://json-render.dev",
        "excerpt": "The open UI specification standard."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `index` | `number` | The citation number shown as a superscript "[n]" marker. |
| `url` | `string` | Link to the cited source (opens in a new tab). Omit to render a non-linked marker. |
| `excerpt` | `string` | Source snippet surfaced as the link tooltip (title attribute). |
| `accent` | `string` | Marker color for the superscript "[n]" chip and its link (default the info/link token). Name a brand color to match a custom citation palette. |
