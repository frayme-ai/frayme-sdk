# FeatureCard

One feature cell: an icon + title + description. Set `href` to make the whole card a link, otherwise it is a button that emits `commit`. Use inside a FeatureGrid or any grid/stack.

## Example

```json
{
  "root": "feature-card",
  "elements": {
    "feature-card": {
      "type": "FeatureCard",
      "props": {
        "icon": "sparkles",
        "title": "Generative UI",
        "description": "Interactive AI apps from a prompt."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `icon` | `string` | Feature icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "sparkles", "lock"). Never raw SVG; unknown names render nothing. |
| `title` | `string` | The feature name (required). Short — 2-5 words, noun-phrase (e.g. "Generative UI"), truncates on overflow. |
| `description` | `string` | One or two sentences explaining the feature. Clamped to 3 lines — keep it tight. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole feature card; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the feature title (default semibold). Set to override the baked title weight. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the feature title (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the feature title (tight · snug · normal · relaxed · loose; default normal). |
| `fontSize` | `string \| number` | Exact font size of the feature title (e.g. "18px" / "1.125rem"). Default 1rem. |
| `href` | `string` | Make the WHOLE card a navigable link (rendered as a guarded &lt;a>). Omit to render an interactive card that emits `commit`. |
| `external` | `boolean` | When `href` is set: open in a new tab (adds target=_blank + rel=noopener noreferrer). |
| `variant` | `"plain" \| "bordered" \| "elevated"` | Surface treatment: plain (no chrome, default) · bordered (border) · elevated (border + shadow). |
| `align` | `"start" \| "center"` | Content alignment: start (left, default) · center. |
| `accent` | `string` | Text colour of the feature icon glyph inside its chip (default the primary token); `iconBg` paints the chip behind it. |
| `iconBg` | `string` | Fill colour of the icon chip behind the glyph (default the muted token). Set a tinted brand fill (e.g. a soft accent wash) for the tinted-chip marketing look. |
| `borderColor` | `string` | Border colour for the bordered/elevated variants (default the border token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style for the bordered/elevated variants: solid (default) · dashed · dotted. |
| `borderWidthValue` | `string \| number` | Exact border thickness for the bordered/elevated variants (e.g. "2px"; default 1px). No effect on the plain variant. |
| `color` | `string` | Primary text colour — the feature title (default the foreground token). |
| `mutedColor` | `string` | Secondary/muted text colour — the feature description under the title (default the muted-foreground token). |
| `titleLevel` | `"h1" \| "h2" \| "h3" \| "h4"` | Heading level of the feature `title` (default h3 — a feature card is content under a section heading). Set it to h2 when the card sits directly under the PageHeader with no section heading between, so the screen's headings nest legally — a document that jumps h1 to h3 has no outline for anyone navigating by heading. |

## Events

### commit

The card was pressed while it has no `href` (a plain &lt;button>, not a link); params carry {label} — the card title.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
