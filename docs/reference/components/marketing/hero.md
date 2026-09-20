# Hero

A marketing hero band: eyebrow + headline + subtitle + a row of CTA buttons, with an optional image (end/start/background) or custom body (children). Background can be a solid `bg` or a `gradientFrom`/`gradientTo` gradient; a background image can carry a tinted `overlayColor`/`overlayOpacity` scrim for contrast. CTAs with `href` navigate; CTAs without one emit `commit`. Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which CTA label (or index) the user triggered from spec.state.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "hero",
  "elements": {
    "hero": {
      "type": "Hero",
      "props": {
        "eyebrow": "New",
        "title": "Ship MCP apps without code",
        "subtitle": "Generate interactive AI apps from natural language and deploy them to Claude and ChatGPT.",
        "actions": [
          {
            "label": "Get started",
            "variant": "primary",
            "icon": "arrow-right"
          },
          {
            "label": "View docs",
            "href": "/docs",
            "variant": "outline"
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
| `eyebrow` | `string` | Small uppercase kicker above the headline (e.g. a category/announcement label). |
| `title` | `string` | The headline (required). Keep to one short punchy sentence or fragment, the largest text on the band, so avoid wrapping past 2 lines. |
| `subtitle` | `string` | Supporting paragraph under the headline that expands on the value proposition (default none). Keep it to one or two sentences, the headline carries the punch, this adds the detail. |
| `align` | `"left" \| "center"` | Text + content alignment of the band: left (default, pairs with end/start media) · center (centered hero). |
| `size` | `"sm" \| "md" \| "lg"` | Vertical padding + headline scale (default md). Use `lg` for a full landing hero. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole hero band; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the headline (default bold). Set to override the baked headline weight. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the headline (default tight). Set to tighten or loosen the headline tracking. |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line height of the headline (default tight). Set to open up or compress the headline leading. |
| `fontSize` | `string \| number` | Exact font size of the headline (e.g. "40px" / "2.5rem"). Default set by `size` (md → 2.5rem). |
| `mediaSrc` | `string` | Hero image URL (raster only; svg/data-svg rejected). Placement controlled by `mediaPosition`; a failed/absent src degrades to a tinted placeholder. |
| `mediaPosition` | `"end" \| "start" \| "background" \| "none"` | Where the image sits: end (right of the copy, default) · start (left) · background (full-bleed behind, copy overlaid) · none (no media). |
| `mediaAspect` | `"auto" \| "1/1" \| "4/3" \| "3/2" \| "16/9" \| "21/9" \| "3/4"` | Lock the end/start hero image to a fixed aspect ratio (default unset, height-clamped at max-h; no effect on the background placement). |
| `actions` | `({ label: string, href: string, external: boolean, variant: "primary" \| "secondary" \| "outline" \| "ghost", icon: string })[]` | Row of CTA buttons. Each with `href` renders an &lt;a>; each without renders a &lt;button> that emits `commit`. First action defaults to primary. |
| `activeAction` | `string` | Write target for WHICH action the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting `commit`, so the host can attribute the action. Emit-only when unbound. |
| `maxWidth` | `"sm" \| "md" \| "lg" \| "full"` | Max content width of the band (Container scale): sm · md · lg (default) · full (edge-to-edge). |
| `bg` | `string` | Solid band background fill. Wins when set; otherwise the card/gradient default. |
| `gradientFrom` | `string` | Start colour of the band's background gradient (top-left). Pair with `gradientTo`; a solid `bg` wins over the gradient. |
| `gradientTo` | `string` | End colour of the band's background gradient (bottom-right). Pair with `gradientFrom`; a solid `bg` wins over the gradient. |
| `accent` | `string` | Background fill of the primary CTA button, and the colour of the eyebrow kicker above the headline (default the primary token). The headline reads `color`, not `accent`. |
| `accentText` | `string` | Text colour on the accent-filled primary CTA button (default the on-primary token). Set when a saturated `accent` needs a legible label. |
| `color` | `string` | Text colour of the headline and subtitle, and of the secondary/outline/ghost action-button labels (and the outline button's border) on a custom surface. Defaults to the theme foreground on a plain band and to a light on-fill token when `bg`, a gradient, or background media paints the band. |
| `mutedColor` | `string` | Secondary/muted text colour, the subtitle paragraph on the default (non-surface) band (default the muted-foreground token). |
| `overlayColor` | `string` | Scrim tint over a `mediaPosition:"background"` image (default the page background token). Set a dark value so the light on-image copy stays legible over an arbitrary photo. No effect unless the media is placed as a background. |
| `overlayOpacity` | `"none" \| "light" \| "medium" \| "heavy"` | Strength of the background-media scrim: none (0%) · light (30%) · medium (60%, default) · heavy (80%). Pairs with `overlayColor` for contrast over the photo. No effect unless the media is placed as a background. |

## Events

### commit

An action button without an `href` was pressed; params carry {label, index, href}: the pressed button's text, its 0-based position in the `actions` array (disambiguates duplicate/null labels), and its `href` (null for an emitting button). `activeAction` (when bound) is written first so the host can attribute which button fired.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
