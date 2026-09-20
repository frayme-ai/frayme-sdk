# PricingTable

A DISPLAY-ONLY plan-comparison grid: several plan columns with price, features, and an optional CTA. Each plan CTA is an &lt;a> when a ctaHref is set, otherwise a button that emits `commit`. Never carries payment/checkout fields, the host routes the choice. Reach for PricingTable over several standalone PlanCards when comparing 2+ plans side by side in one grid; use PlanCard alone for a single plan or a non-uniform layout.

## Example

```json
{
  "root": "pricing-table",
  "elements": {
    "pricing-table": {
      "type": "PricingTable",
      "props": {
        "plans": [
          {
            "name": "Free",
            "price": "£0",
            "period": "/mo",
            "features": [
              "100 generations",
              "Community support"
            ],
            "ctaLabel": "Get started"
          },
          {
            "name": "Pro",
            "price": "£99",
            "period": "/mo",
            "features": [
              "10,000 generations",
              "Priority support"
            ],
            "highlighted": true,
            "ctaLabel": "Choose Pro"
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
| `plans` | `({ name: string, price: string, period: string, description: string, features: string[], badge: string, highlighted: boolean, ctaLabel: string, ctaHref: string })[]` | The plans to compare. Each: name, price, optional period/description, a feature list, an optional ribbon `badge`, an optional highlight flag, and an optional CTA label/href. NEVER any payment/card fields. |
| `period` | `"monthly" \| "yearly"` | Global billing-period enum shown above the grid as "Billed monthly/yearly" (display only, no toggle/checkout). Ignored when `periodLabel` is set. |
| `periodLabel` | `string` | Free-form billing-period caption shown above the grid (e.g. "Billed annually, save 20%", or a localised string), rendered verbatim. Overrides the `period` enum default; omit both for no caption. |
| `columns` | `number` | Number of plan columns (1-12 grid track count). Defaults to the plan count when omitted. |
| `accent` | `string` | Background fill of the featured plan's CTA button and of a plan's ribbon badge, plus the highlight ring and the feature check marks (default the primary token). Their label is always the card token, so choose a value dark enough to carry it. |
| `bg` | `string` | Background fill of EVERY plan card, applied uniformly (default the card token). Pair with `color` for legible copy on a saturated surface. |
| `color` | `string` | Primary text colour on each plan card, the plan name, price value, feature-list items, and the neutral (non-highlighted) CTA label (default the foreground token). Set a readable value when `bg` is a saturated surface. |
| `borderColor` | `string` | Border colour of every non-highlighted plan card and its neutral CTA button (default the border token; the highlighted plan keeps its accent ring). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow elevation applied to every plan card (none/sm/md/lg/xl; default none), raise the whole grid off the page. |
| `mutedColor` | `string` | Secondary/muted text colour, the billed-period label, plan descriptions, and price-period suffixes (default the muted-foreground token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole pricing-table region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of each plan price value (default semibold). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of each plan name (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of each plan name (tight · snug · normal · relaxed · loose; default the plan-name default). |
| `fontSize` | `string \| number` | Exact font size of each plan name (e.g. "20px" / "1.25rem"). Default 0.875rem. |
| `showCta` | `boolean` | Whether each plan renders a CTA button (default true). Set false for a STATIC, read-only price comparison, a plain fees/features grid with NO "Choose plan" buttons. Use this on read-only recipes, where a CTA would be a dead affordance. |

## Events

### commit

A plan's CTA button was pressed (no `ctaHref` set on that plan); params carry {plan, index, price}, the plan name, its column index, and its price string.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
