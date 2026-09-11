# PrintLayout

A print-ready paginated document: author-supplied sections (heading, paragraph, key-value fields, table, image, divider, page-break, spacer) laid into a fixed-width A4/Letter/Legal page preview with an optional running header/footer and a Print button. The Print button prints ONLY this layout (not the surrounding page). PDF export is a platform concern. Emits `commit` when Print is pressed. Stateless, SSR-safe, all text escaped; images pass safeImageSrc.

## Example

```json
{
  "root": "print-layout",
  "elements": {
    "print-layout": {
      "type": "PrintLayout",
      "props": {
        "title": "Q3 Revenue Report",
        "subtitle": "Acme Corp · Jul – Sep 2026",
        "sections": [
          {
            "kind": "heading",
            "text": "Executive summary",
            "level": 2
          },
          {
            "kind": "paragraph",
            "text": "Revenue grew 24% quarter-over-quarter, driven by the Platform tier and improved retention across all segments."
          },
          {
            "kind": "fields",
            "fields": [
              {
                "label": "Total revenue",
                "value": "£1,284,000"
              },
              {
                "label": "Net new customers",
                "value": "312"
              },
              {
                "label": "Churn",
                "value": "2.1%"
              }
            ]
          },
          {
            "kind": "heading",
            "text": "By product line",
            "level": 3
          },
          {
            "kind": "table",
            "columns": [
              "Product",
              "Revenue",
              "Growth"
            ],
            "rows": [
              [
                "Platform",
                "£742k",
                "+31%"
              ],
              [
                "API",
                "£389k",
                "+18%"
              ],
              [
                "Marketplace",
                "£153k",
                "+9%"
              ]
            ]
          },
          {
            "kind": "divider"
          },
          {
            "kind": "paragraph",
            "text": "Prepared by Finance. Confidential — do not distribute."
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
| `title` | `string` | Document title shown at the top of page 1 and (small) in the running header. Escaped text. Reach for it on every report/invoice. |
| `subtitle` | `string` | Secondary line under the title (e.g. a date range or client name). Escaped text. |
| `sections` | `({ id: string, kind: "heading" \| "paragraph" \| "fields" \| "table" \| "image" \| "divider" \| "pageBreak" \| "spacer", text: string, level: number, fields: object[], columns: string[], rows: string[][], src: string, alt: string, caption: string })[]` | The ordered document sections. Omit for a representative demo report. Capped at 500 sections; tables at 200 rows × 20 cols. |
| `pageSize` | `"a4" \| "letter" \| "legal" \| "auto"` | Page-preview width + print hint (default a4). "auto" = fluid width, single continuous flow. |
| `margin` | `"none" \| "narrow" \| "normal" \| "wide"` | Inner page padding around the printed content (default normal). |
| `showHeader` | `boolean` | Show a running header band (title + optional headerText) at the top of each page (default true). |
| `showFooter` | `boolean` | Show a running footer band (footerText + a page marker) (default true). |
| `showPageNumbers` | `boolean` | Render a "Page N of M" marker in the footer (default true). The preview counts page-break groups; true print pagination is the browser's job. |
| `showPrintButton` | `boolean` | Show the "Print" action above the page that calls window.print() (default true). Hidden in the printed output. |
| `printLabel` | `string` | Label of the print button (default "Print"). Escaped text. |
| `headerText` | `string` | Optional running-header caption (e.g. a company name; falls back to the title). Escaped text. |
| `footerText` | `string` | Optional running-footer caption (e.g. "Confidential"). Escaped text. |
| `accent` | `string` | Accent color of the title band, heading underlines and header/footer rules (default the primary token). |
| `buttonColor` | `string` | Fill color of the Print button (default follows the accent/primary token). Set independently of the document accent. |
| `mutedColor` | `string` | Secondary text color — subtitle, footer, table header, field labels (default the muted-foreground token). |
| `gridColor` | `string` | Table + divider + header/footer rule color (default the border token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Document typeface from the closed menu (default inherits the theme; serif suits formal reports). |

## Events

### commit

The Print button was activated (prints only this layout); params carry { reason: "print", title, sections (count), pageCount }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
