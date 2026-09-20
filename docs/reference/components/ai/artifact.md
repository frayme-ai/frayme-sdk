# Artifact

A generated-artifact panel: a header (kind icon + title + copy button) over an escaped-text body. Use to present a code snippet, a written document, or a preview the assistant produced. Reach for this when a chunk of generated output deserves its own framed, copyable surface, set apart from the running Message prose rather than inlined into it. Pick `kind` to switch the header glyph and body treatment (mono for `code`), and the header copy button lifts the whole `content` to the clipboard, flipping `copyLabel`→`copiedLabel` for ~1.5s.

## Example

```json
{
  "root": "artifact",
  "elements": {
    "artifact": {
      "type": "Artifact",
      "props": {
        "title": "fibonacci.ts",
        "kind": "code",
        "content": "export const fib = (n: number): number =>\n  n < 2 ? n : fib(n - 1) + fib(n - 2);"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Artifact name shown in the panel header, next to the `kind` glyph (e.g. a filename or document title). Required, it labels the panel. |
| `content` | `string` | The artifact body, rendered as ESCAPED text (mono when kind=code). Never interpreted as markup. |
| `kind` | `"code" \| "document" \| "preview"` | What the artifact is: code (mono body + code glyph) · document (prose body + file glyph) · preview (rendered-output framing + eye glyph). Default document. |
| `maxHeight` | `string \| number` | Exact max height of the scrollable artifact body (e.g. 600px / 40vh). Overrides the built-in 28rem cap, which is the default. |
| `copyLabel` | `string` | Text on the copy button in its resting state (default "Copy"). Escaped text, set for localization. |
| `copiedLabel` | `string` | Text on the copy button for ~1.5s after a successful copy, and its accessible label (default "Copied"). Escaped text, set for localization. |
| `accent` | `string` | Header accent color: the kind glyph + title (default foreground token). |
| `color` | `string` | Body text colour of the artifact content (default the foreground token). Pair with a dark `bg` so the body stays legible on the repainted panel. |
| `bg` | `string` | Background fill of the artifact panel surface AND the copy-button chip (default card token). |
| `borderColor` | `string` | Border colour of the artifact panel, its header divider, and the copy-button chip (default the border token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Outer panel border style: solid (default) · dashed · dotted. |
| `borderWidthValue` | `string \| number` | Exact outer panel border thickness in px (e.g. "2px"; default 1px). |
| `mutedColor` | `string` | Secondary/muted text colour, the copy-button label (default the muted-foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow elevation of the artifact panel, none · sm · md · lg · xl; default flat. Set to lift the artifact off the page as a raised surface. |
