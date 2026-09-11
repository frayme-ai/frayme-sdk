# Breadcrumb

Hierarchical breadcrumb path trail. items go root → current; the last item is the current page (no link). Earlier items with an href become safe anchor links. Set `maxItems` to collapse a deep trail (first · … · last few).

## Example

```json
{
  "root": "breadcrumb",
  "elements": {
    "breadcrumb": {
      "type": "Breadcrumb",
      "props": {
        "items": [
          {
            "label": "Home",
            "href": "/"
          },
          {
            "label": "Settings",
            "href": "/settings"
          },
          {
            "label": "Profile",
            "href": null
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
| `items` | `({ label: string, href: string })[]` | Ordered trail from root to the current page. The LAST item is the current page (rendered as plain text with aria-current, no link); give the earlier items an href to make them clickable. |
| `separator` | `"slash" \| "chevron" \| "dot" \| "arrow"` | Glyph between items: chevron "›" (default) · slash "/" · dot "•" · arrow "→". |
| `size` | `"sm" \| "md" \| "lg"` | Font size of the trail (default md). Use sm for a dense sub-header. |
| `maxItems` | `number` | Collapse a long trail: when the number of items exceeds this cap (minimum 3), keep the first item, replace the middle with a single non-clickable "…" entry, and keep the trailing items so the current page always shows (shadcn BreadcrumbEllipsis convention). Omit (default) or a value ≥ the item count to show every item. A plain count, not a dimension. |
| `accent` | `string` | Color of the current/last item (and link hover). Names a specific brand color; default is the foreground token. |
| `mutedColor` | `string` | Secondary/muted text colour — the non-current trail items, link rest state, and the separator glyphs (at 70% strength; default the muted-foreground token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole breadcrumb trail; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the crumb labels (light · normal · medium · semibold · bold; default normal, with the current page medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the crumb labels (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the crumb labels (tight · snug · normal · relaxed · loose; default the size default). |
| `fontSize` | `string \| number` | Exact font size of the crumb labels (e.g. "20px" / "1.25rem"). Overrides the `size` enum, which is the default (md ≈ 0.9375rem). |
