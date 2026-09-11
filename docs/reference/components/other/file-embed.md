# FileEmbed

A document viewer: renders a PDF in the browser's inert native viewer, an Office file (docx/xlsx/pptx) via the Microsoft Office Online viewer (a fixed, sandboxed host), or an image inline — inferring the kind from the file extension. Where a surface blocks frames or the kind is unknown, it degrades to a labeled card with an "Open / Download" link. Display-only, provider-neutral, no key stored; the file URL is https-gated via safeUrl. Office files must be at a public URL the viewer can fetch.

## Example

```json
{
  "root": "file-embed",
  "elements": {
    "file-embed": {
      "type": "FileEmbed",
      "props": {
        "src": "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf",
        "kind": "pdf",
        "title": "Sample report",
        "filename": "tracemonkey.pdf"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `string` | The document URL (http/https). For an Office file it must be a PUBLIC URL the Microsoft viewer can fetch; a PDF renders in the browser natively. |
| `kind` | `"auto" \| "pdf" \| "office" \| "image"` | How to render: auto (infer from the file extension, default), pdf (native viewer), office (docx/xlsx/pptx via the Office Online viewer), or image. |
| `title` | `string` | Accessible title for the viewer region and the header line (e.g. "Q3 report.pdf"; default "Document"). Escaped text. |
| `filename` | `string` | Display file name shown in the header and the fallback card (defaults to the last path segment of src). Escaped text. |
| `showToolbar` | `boolean` | Show the header bar with the title/filename and the Open link (default true). |
| `allowDownload` | `boolean` | Show the "Open / Download" link that opens the file in a new tab (default true). |
| `aspect` | `"auto" \| "1/1" \| "4/3" \| "3/2" \| "16/9" \| "21/9" \| "3/4"` | Fixed aspect-ratio of the viewer to prevent layout jump (default 3/4, a portrait document shape); "auto" is treated as 3/4. |
| `height` | `string \| number` | Optional exact viewer height (e.g. "640px") overriding the aspect box; validated and clamped 160..1200. |
| `accent` | `string` | Accent color of the header file glyph, the fallback card icon, and the Open link (default the primary token). |
| `borderColor` | `string` | Resting border color of the viewer frame + header (default the border token). |
| `radiusValue` | `string \| number` | Exact corner radius of the viewer frame (e.g. "12px"); overrides the default rounding, bounded to px/rem 0..64. |
