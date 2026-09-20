# CodeBlock

Read-only code block. Renders `code` as escaped text (never HTML) in a mono &lt;pre>&lt;code> with an optional header (filename + language) and a copy button (in the header, or floating in the corner for a headerless block; `showCopy`/`copyLabel`/`copiedLabel` control it). `theme` can force a fixed dark/light surface; no syntax highlighting yet.

## Example

```json
{
  "root": "code-block",
  "elements": {
    "code-block": {
      "type": "CodeBlock",
      "props": {
        "code": "const x = 1;\nconsole.log(x);",
        "language": "ts",
        "filename": "demo.ts",
        "showLineNumbers": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `code` | `string` | The code to display (required). Rendered as escaped text, never interpreted as HTML. |
| `filename` | `string` | Optional filename shown in the header bar (e.g. "server.ts"). |
| `language` | `"plaintext" \| "js" \| "ts" \| "tsx" \| "jsx" \| "json" \| "bash" \| "shell" \| "python" \| "html" \| "css" \| "sql" \| "yaml" \| "markdown" \| "go" \| "rust"` | Language LABEL shown in the header (no syntax highlighting yet, purely a tag; default plaintext). |
| `showLineNumbers` | `boolean` | Render a left gutter with 1-based line numbers alongside the code (default false). Turn on for multi-line snippets you want to reference by line; the gutter uses the softer `mutedColor` tint. |
| `wrap` | `boolean` | Soft-wrap long lines instead of horizontal scrolling (default false = scroll). |
| `maxHeight` | `string \| number` | Exact scroll cap on the code body (e.g. "320px" / "60vh"); the code scrolls vertically past it. Default unbounded (the block grows to fit). |
| `size` | `"sm" \| "md"` | Code font size + padding density together: sm · md (default). Use `sm` for a tight inline snippet or a dense docs block where vertical space is scarce. |
| `theme` | `"auto" \| "light" \| "dark"` | Surface theme: `auto` (default) follows the page/workspace dark mode like every component · `dark` forces a dark code surface even on a light page (the classic docs code block) · `light` forces a light surface even in dark mode. |
| `mutedColor` | `string` | Secondary/muted text colour, the header language label, the copy-button text, and the line-number gutter (the gutter keeps its softer 70% tint of this colour; default the muted-foreground token). |
| `showCopy` | `boolean` | Show a copy-to-clipboard button (default true). When a header (filename/language) is present the button sits in the header; when there is NO header a corner button floats over the code so a bare snippet still has copy. Set false to remove the copy affordance entirely. |
| `copyLabel` | `string` | Text + aria-label for the copy button in its idle state (default "Copy"). Escaped text, set to localise it. |
| `copiedLabel` | `string` | Text + aria-label for the copy button just after copying (default "Copied"). Escaped text, set to localise it. |
