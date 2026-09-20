# PageHeader

Page/section header: eyebrow + title + description on the left, with action controls (children) on the right. Use at the top of a page or panel, NOT as a content Card. Reach for this to introduce a page or a major section and to anchor its primary actions (e.g. a "New" or "Invite" Button passed as children) on the same row as the heading. Set `align:"center"` to turn it into a centered hero header (children then stack below); set `divider` for the conventional dashboard rule that separates the header from the content beneath it.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "page-header",
  "elements": {
    "page-header": {
      "type": "PageHeader",
      "props": {
        "eyebrow": "Workspace",
        "title": "Team members",
        "description": "Manage who has access"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `eyebrow` | `string` | Small uppercase kicker above the title (e.g. a section/category label). |
| `title` | `string` | The header's main heading (e.g. "Team members"). Short noun phrase, this is the page/section name, not a sentence. |
| `description` | `string` | Supporting subtitle under the `title` (e.g. "Manage who has access"). One short sentence; omit for a title-only header. |
| `align` | `"start" \| "center"` | Text alignment of the header block: start (left, default, actions sit on the right) · center (centered hero header). |
| `size` | `"sm" \| "md" \| "lg"` | Title scale + spacing (default md). Use `lg` for a top-of-page hero. |
| `fontSize` | `string \| number` | Exact title font-size (e.g. 28px / 2.25rem). Overrides ONLY the title type scale of the `size` enum (the default); header spacing stays on `size`. |
| `divider` | `boolean` | Draw a bottom border rule (with bottom padding) separating the header from the content below, the conventional dashboard/section header divider (shadcn/Ant PageHeader). Off by default. |
| `accent` | `string` | Text colour of the header `title` heading (default the inherited foreground). Names a specific brand colour for the heading; on a filled band (`bg`) the band's `accentText` takes this channel over instead. |
| `bg` | `string` | Brand band background fill. When set, the header renders as a filled, padded, rounded BAND, a deliberate brand moment (use ONLY when the request supplies brand colors; omit to stay quiet/neutral, the default). Pair with `accentText` for the on-band text color. |
| `accentText` | `string` | Text color ON a filled band, the title, eyebrow, and description (only meaningful together with `bg`). Default: white, for contrast on a dark brand band. |
| `mutedColor` | `string` | Secondary/muted text colour, the eyebrow kicker and the description subtitle (default the muted-foreground token). |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Title font weight (default semibold). Reach for `bold` for a heavier hero heading or `medium` for a lighter one. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Title letter-spacing (default normal). Use `tight`/`tighter` to condense a large hero title or `wide` for an airy heading. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Title line-height (default tight). Bump to `snug`/`normal` when the title wraps to multiple lines. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole header region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
