# CopyButton

One-click copy-to-clipboard button that flips to a transient "Copied!" state with a check icon. Self-contained — no host wiring needed. Reach for it beside a command, code snippet, URL or API key to give the user a frictionless copy; the label reverts to `label` after ~1.5s and it emits no events, so it never round-trips to the agent.

## Example

```json
{
  "root": "copy-button",
  "elements": {
    "copy-button": {
      "type": "CopyButton",
      "props": {
        "value": "npm i @frayme/runtime",
        "label": "Copy command"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `string` | The exact text written to the clipboard on click (e.g. a command, URL, code snippet or API key). Copied verbatim with no trimming; if empty/absent nothing is copied. |
| `label` | `string` | Resting button label before a click (default "Copy"). Keep to 1-2 words, verb-first. |
| `copiedLabel` | `string` | Label shown for ~1.5s after a successful copy (default "Copied!"). |
| `variant` | `"default" \| "primary" \| "secondary" \| "ghost" \| "outline"` | Visual style: default · primary (filled) · secondary · ghost (text-only) · outline. |
| `size` | `"sm" \| "md" \| "lg"` | Control height + padding + font size (default md). |
| `icon` | `"copy" \| "clipboard" \| "link" \| "none"` | Leading icon: copy (default) · clipboard · link · none. |
