# Conversation

The scrollable chat log shell — a vertical, auto-scrolling container (role="log", aria-live polite) that holds Message children. Wrap the messages of a chat thread in this; pair with a PromptInput below it. Reach for this as the outermost frame of any conversation surface — it owns the scroll viewport and live-region semantics so individual Message rows do not have to. By default `autoScroll` pins the log to the newest message as rows are appended (the live-thread behaviour); set `bordered` when the chat sits inside a larger page rather than filling it.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "conversation",
  "elements": {
    "conversation": {
      "type": "Conversation",
      "props": {
        "density": "normal",
        "bordered": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `density` | `"compact" \| "normal" \| "comfortable"` | Vertical gap between messages: compact (dense logs) · normal (default) · comfortable (roomy). |
| `bordered` | `boolean` | Wrap the log in a bordered card surface — use when the chat sits inside a larger page; omit for a flush full-bleed thread. |
| `maxHeight` | `"sm" \| "md" \| "lg" \| "full"` | Scroll viewport height: sm · md (default) · lg · full (no cap; the page scrolls instead). |
| `autoScroll` | `boolean` | Keep the log pinned to the newest message as messages are appended (default true) — the expected live-thread behaviour. Set false to leave the reader's scroll position alone when new messages arrive. |
| `bg` | `string` | Exact background fill of the conversation surface (default card token). |
| `borderColor` | `string` | Border colour of the bordered card surface (default the border token; applies when `bordered`). |
| `borderWidthValue` | `string \| number` | Exact thickness of the bordered card surface border (e.g. "2px"; default 1px; applies when `bordered`). |
