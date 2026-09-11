# PlanCard

A single plan/price card: name, price + period, a feature list with check marks, an optional ribbon badge, and a CTA. The CTA is an &lt;a> when a ctaHref is set, otherwise a button that emits `commit`. Display-only — never any card-number/payment fields.

## Example

```json
{
  "root": "plan-card",
  "elements": {
    "plan-card": {
      "type": "PlanCard",
      "props": {
        "name": "Pro",
        "price": "£99",
        "period": "/mo",
        "description": "For growing teams.",
        "features": [
          "10,000 generations",
          "Priority support",
          "Stripe Connect"
        ],
        "badge": "Most popular",
        "highlighted": true,
        "ctaLabel": "Choose Pro"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `name` | `string` | The plan name (required, e.g. "Pro", "Free"). Short — one or two words, shown truncated at the top of the card. |
| `price` | `string` | The price value (required), pre-formatted text including the currency symbol (e.g. "£99", "$0", "Custom"). Not a number — Frayme never computes currency. |
| `period` | `string` | Billing period suffix after the price (e.g. "/mo", "/year"). |
| `description` | `string` | Short supporting line under the plan name (e.g. "For growing teams"). Rendered in `mutedColor`; omit for a name-and-price-only card. |
| `features` | `string[]` | Bullet list of what the plan includes (each rendered with a check mark). |
| `badge` | `string` | Small ribbon label (e.g. "Most popular", "Best value"). |
| `highlighted` | `boolean` | Emphasize this card (accent ring + filled CTA) — use for the recommended plan. |
| `ctaLabel` | `string` | The CTA button/link text (default "Choose plan"). Set a plan-specific verb like "Start free" or "Choose Pro"; it is echoed in the `commit` payload as the button label. |
| `ctaHref` | `string` | Make the CTA a navigable link. Omit to render a button that emits `commit`. |
| `accent` | `string` | Background fill of the highlighted plan's CTA button and of the ribbon badge, plus the highlight ring and the feature check marks (default the primary token). Pair it with `accentText` for the label on that fill. |
| `accentText` | `string` | Text colour on the accent-filled CTA button + ribbon badge (default the on-primary token). Set when a saturated `accent` needs a legible label. |
| `bg` | `string` | Exact background fill of the card surface (a brand surface). Pair it with `color` so the on-card copy stays legible. |
| `borderColor` | `string` | Card border colour — the card edge and the neutral (non-highlighted) CTA button border (default the border token; ignored when `highlighted` swaps the card border for an accent ring). |
| `color` | `string` | Text colour of the on-card copy — plan name, price and feature lines — when a custom `bg` surface is set, and of the neutral CTA label always (defaults to a readable light on-fill token). Set a dark value for a light card. |
| `mutedColor` | `string` | Secondary/muted text colour — the plan description and price-period suffix on the default (no custom `bg`) card (default the muted-foreground token). |
| `borderWidthValue` | `string \| number` | Exact card border thickness (e.g. "2px"; default 1px). Ignored when `highlighted` swaps the border for an accent ring. |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow elevation of the card surface (none/sm/md/lg/xl; default none) — raise a featured plan off the page. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole plan-card region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the price value (default semibold). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the plan name (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the plan name (tight · snug · normal · relaxed · loose; default the plan-name default). |
| `fontSize` | `string \| number` | Exact font size of the plan name (e.g. "20px" / "1.25rem"). Default 0.875rem. |

## Events

### commit

The CTA button was pressed (no `ctaHref` set); params carry {name, price, label} — the plan name, its pre-formatted price string, and the CTA label (falling back to the plan name), so the host always has the chosen plan identity and price.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
