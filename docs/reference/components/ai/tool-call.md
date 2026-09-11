# ToolCall

A collapsible card for a single agent tool call: header is a tool icon + name + a state pill (colored by `state`); the body shows the input and output as mono escaped text. Use one per tool invocation. Reach for this when you want the transcript to expose HOW the agent acted — the concrete function, its arguments, and its result — rather than just narrating it in prose. Stack several between the Reasoning trace and the final Message to show a chain of calls; drive `state` from pending→running→success/error as the call progresses, and set `defaultOpen` to reveal the input/output without a click.

## Example

```json
{
  "root": "tool-call",
  "elements": {
    "tool-call": {
      "type": "ToolCall",
      "props": {
        "name": "search_web",
        "input": "{ \"query\": \"frayme pricing\" }",
        "state": "running"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `name` | `string` | The tool / function name being called (e.g. "search_web", "run_sql"). Shown in the header next to a tool icon. |
| `input` | `string` | The arguments passed to the tool, shown in the expanded body as mono escaped text (e.g. a JSON string). Never rendered as markup. |
| `output` | `string` | The result returned by the tool, shown in the expanded body as mono escaped text. Never rendered as markup. |
| `state` | `"pending" \| "running" \| "success" \| "error"` | Lifecycle of the call, shown as a colored pill: pending (queued) · running (in flight, animated) · success (done) · error (failed). Default pending. |
| `defaultOpen` | `boolean` | Start expanded to show input/output (default collapsed). |
| `stateLabels` | `{ pending: string, running: string, success: string, error: string }` | Localised text for the state pill, per state — any subset of {pending, running, success, error}. Each falls back to its English default (Pending / Running / Done / Failed). Escaped text. |
| `inputLabel` | `string` | Section heading above the tool input in the expanded body (default "Input"). Escaped text — set for localization. |
| `outputLabel` | `string` | Section heading above the tool output in the expanded body (default "Output"). Escaped text — set for localization. |
| `bg` | `string` | Background fill of the tool-call card surface (default card token). |
| `borderColor` | `string` | Border colour of the card frame — the outer edge AND the internal divider above the expanded Input/Output body (default the border token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Card border line style: solid (default) · dashed · dotted. |
| `borderWidthValue` | `string \| number` | Exact card border thickness (e.g. "2px"; default 1px). |
| `mutedColor` | `string` | Secondary/muted colour — the header tool icon, the expand chevron, and the Input/Output section labels (default the muted-foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow elevation of the tool-call card: none · sm · md · lg · xl. Raise it to make the call float above the transcript (default flat). |
