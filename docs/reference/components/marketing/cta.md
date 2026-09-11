# CTA

A focused call-to-action band (smaller than Hero): title + description + 1-2 action buttons. `variant` picks banner/card/split layout; `tone`/`accent` color it. CTAs with `href` navigate; CTAs without one emit `commit`. Reach for CTA over Hero for a single mid/end-of-page nudge — Hero owns the top-of-page band with a headline + media. Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which CTA label (or index) the user triggered from spec.state.

## Example

```json
{
  "root": "cta",
  "elements": {
    "cta": {
      "type": "CTA",
      "props": {
        "title": "Ready to start building?",
        "description": "Spin up your first MCP app in minutes.",
        "actions": [
          {
            "label": "Start free",
            "variant": "primary"
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
| `title` | `string` | The CTA headline (required). Short and action-oriented — a nudge, not a full pitch (e.g. "Ready to start building?"). |
| `description` | `string` | One supporting sentence under the title explaining the value/next step. Keep to a single line where possible — long copy belongs in a Hero, not a CTA. |
| `variant` | `"banner" \| "card" \| "split"` | Layout: banner (full-width tinted strip, default) · card (bordered panel) · split (copy left, actions right). |
| `align` | `"left" \| "center"` | Text alignment of the copy block: left (default for split) · center (default for banner/card). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole CTA band; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the title (default semibold). Set to override the baked title weight. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the title (default normal). Set to tighten or loosen the title tracking. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line height of the title (default tight). Set to open up or compress the title leading. |
| `fontSize` | `string \| number` | Exact font size of the title (e.g. "20px" / "1.25rem"). Default 1.5rem. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic surface tint via token (default neutral). Use `info`/`success` for upgrade/onboarding nudges. |
| `actions` | `({ label: string, href: string, external: boolean, variant: "primary" \| "secondary" \| "outline" \| "ghost", icon: string })[]` | 1-2 CTA buttons. Each with `href` renders an &lt;a>; each without renders a &lt;button> that emits `commit`. |
| `activeAction` | `string` | Write target for WHICH action the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting `commit`, so the host can attribute the action. Emit-only when unbound. |
| `bg` | `string` | Solid background fill of the banner/split band — wins over `tone`. No effect on the `card` variant, which keeps its own bordered card surface. |
| `accent` | `string` | Background fill of the primary action button, and the colour of the CTA title (default the primary token). Pair it with `accentText` for the label on that fill. |
| `accentText` | `string` | Text colour on the accent-filled primary CTA button (default the on-primary token). Set when a saturated `accent` needs a legible label. |
| `color` | `string` | Title + description text colour, and the labels (and outline border) of the secondary/outline/ghost action buttons — only meaningful together with `bg`, which is what paints the surface they sit on (defaults to a readable light on-fill token). Set a dark value when the band is light. |
| `mutedColor` | `string` | Secondary/muted text colour — the description line on the default (non-surface) band (default the muted-foreground token). |
| `borderColor` | `string` | Border colour of the `card` variant only (default the border token; ignored on banner/split which have no border). Set to brand the bordered CTA panel edge. |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style of the `card` variant only: solid (default) · dashed · dotted. No effect on banner/split. |
| `borderWidthValue` | `string \| number` | Exact border thickness of the `card` variant in px (e.g. "2px"; default 1px). No effect on banner/split. |

## Events

### commit

An action button without an `href` was pressed; params carry {label, index, href}: the pressed button's text, its 0-based position in the `actions` array (disambiguates duplicate/null labels), and its `href` (null for an emitting button). `activeAction` (when bound) is written first so the host can attribute which button fired.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
