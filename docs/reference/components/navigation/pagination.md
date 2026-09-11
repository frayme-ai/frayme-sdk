# Pagination

Page navigation. Use { $bindState } on page for current page number. `siblingCount` sets how many numbers flank the current page. `accent`/`accentText` color the active page; `color`/`borderColor` color the resting (unselected) page buttons.

## Example

```json
{
  "root": "pagination",
  "elements": {
    "pagination": {
      "type": "Pagination",
      "props": {
        "totalPages": 12,
        "page": 3,
        "shape": null,
        "variant": null,
        "showEdges": null,
        "showPrevNext": null,
        "siblingCount": null,
        "color": null,
        "borderColor": null,
        "mutedColor": null,
        "prevLabel": null,
        "nextLabel": null,
        "firstLabel": null,
        "lastLabel": null,
        "prevIcon": null,
        "nextIcon": null,
        "firstIcon": null,
        "lastIcon": null,
        "accent": null,
        "accentText": null,
        "radius": null,
        "size": null,
        "fullWidth": null,
        "align": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `totalPages` | `number` | Total number of pages (1-based). Bounds the rendered page-number window and clamps navigation — `page` can never exceed it. |
| `page` | `number` | Current page number (1-based). Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial page (default 1). |
| `shape` | `"square" \| "rounded" \| "circle"` | Silhouette of each page button — square (sharp corners) · rounded (default) · circle (fully round pills). |
| `variant` | `"solid" \| "outline" \| "ghost"` | Resting look of the unselected page buttons: solid (filled) · outline (bordered, default) · ghost (transparent until hover). The active page always fills with `accent` regardless; use `ghost` for a lighter, borderless pager. |
| `showEdges` | `boolean` | Show the « » first/last jump buttons flanking the pager (default true). Turn them off for a compact pager, or when `totalPages` is small enough that prev/next already reach every page. |
| `showPrevNext` | `boolean` | Show the ‹ › previous/next arrow buttons flanking the page numbers (default true = shown). |
| `siblingCount` | `string \| number` | How many page numbers flank the current page (1-7; default 3). |
| `color` | `string` | Resting (unselected) page-button text color (default the foreground token). Distinct from `accentText`, which colors the active page. |
| `borderColor` | `string` | Resting (unselected) page-button border color (default the border token). Distinct from `accent`, which colors the active page. |
| `mutedColor` | `string` | Text colour of the … overflow ellipsis separators between the page numbers (default the muted-foreground token). |
| `prevLabel` | `string` | aria-label for the ‹ previous-page button (default "Previous page"). Override to localise. |
| `nextLabel` | `string` | aria-label for the › next-page button (default "Next page"). Override to localise. |
| `firstLabel` | `string` | aria-label for the « first-page jump button (default "First page"). Override to localise. |
| `lastLabel` | `string` | aria-label for the » last-page jump button (default "Last page"). Override to localise. |
| `prevIcon` | `string` | Glyph NAME for the previous-page button (default the ‹ char). Unknown/absent keeps ‹. Never raw SVG. |
| `nextIcon` | `string` | Glyph NAME for the next-page button (default the › char). Unknown/absent keeps ›. Never raw SVG. |
| `firstIcon` | `string` | Glyph NAME for the first-page button (default the « char). Unknown/absent keeps «. Never raw SVG. |
| `lastIcon` | `string` | Glyph NAME for the last-page button (default the » char). Unknown/absent keeps ». Never raw SVG. |
| `accent` | `string` | Background fill and border of the current/active page button, plus a faint 10% tint of the same colour as the hover background on the resting ones (default the foreground token). Pairs with `accentText` for the numeral on that fill. |
| `accentText` | `string` | Text colour of the label printed on the `accent` fill — the on-fill ink (default the primary-foreground token). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner-radius token for the control (default `md`); drop to `sm`/`none` on dense toolbars, `lg` or `full` for a pill-shaped button. |
| `size` | `"sm" \| "md" \| "lg"` | Control height + padding + font-size together (default md). |
| `fullWidth` | `boolean` | Stretch the control to fill its container width (default false); set true for stacked mobile CTAs or a button that spans a form row. |
| `align` | `"start" \| "center" \| "end"` | Horizontal placement of the pager row (start · center · end; default start). |

## Events

### page

A page number, arrow, or edge-jump button was clicked; params carry {page}, the clamped 1-based target page.

| Key | Type | Description |
| --- | --- | --- |
| `page` | `number` | The target page (1-based, clamped to range). |

See [Events](../../events.md) for the full payload contract.
