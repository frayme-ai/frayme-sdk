# FAQ

An accordion of question/answer rows. Each header is a button (aria-expanded) that toggles its answer region (emits `change`); set `allowMultiple` to keep several open. Interactive out of the box — works without any binding. Bind `openIndices` with `{ $bindState }` so the agent (or a sibling control) can read the live set of expanded row indices from spec.state.

## Example

```json
{
  "root": "faq",
  "elements": {
    "faq": {
      "type": "FAQ",
      "props": {
        "items": [
          {
            "question": "Can I cancel anytime?",
            "answer": "Yes — plans are month-to-month with no lock-in."
          },
          {
            "question": "Do you offer a free tier?",
            "answer": "The Free plan includes 100 generations a month."
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
| `items` | `({ question: string, answer: string })[]` | The Q&A rows. Each row expands/collapses on click (plain text answers — no markdown/HTML). |
| `allowMultiple` | `boolean` | Allow several rows open at once (default false — opening one closes the others, classic accordion). |
| `variant` | `"bordered" \| "separated" \| "plain"` | Treatment: bordered (single bordered card, default) · separated (each row its own card) · plain (dividers only). |
| `defaultOpenIndex` | `number` | Index of the row to start expanded (0-based). Omit to start with all rows collapsed. |
| `openIndices` | `number[]` | The currently-expanded row indices (0-based). Bind with { $bindState } and the renderer mirrors the FULL open-set here on every toggle so an external Button can read which questions are open; lives without any binding. Works for accordion (single) and allowMultiple (many). `defaultOpenIndex` remains the initial-seed config. |
| `chevronIcon` | `string` | Glyph NAME (closed icon registry) for the expand/collapse affordance — it rotates 180° when open (default "chevron-down"). Unknown/absent → the default glyph; never raw SVG. |
| `accent` | `string` | Text colour of the expanded row's question header and its chevron glyph (default the foreground token). Names a specific brand colour. |
| `color` | `string` | Resting (closed) question-header text colour — the collapsed rows' question text and their chevron (the chevron follows at ~70% strength; default the foreground token). Does NOT touch the expanded row, which uses `accent`. |
| `borderColor` | `string` | Colour of the row dividers / card borders between questions (default the border token). |
| `mutedColor` | `string` | Secondary/muted text colour — the expanded answer body (default the muted-foreground token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole FAQ region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the question headers (light · normal · medium · semibold · bold; default medium). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the question headers (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the question headers (tight · snug · normal · relaxed · loose; default normal). |
| `fontSize` | `string \| number` | Exact font size of the question headers (e.g. "20px" / "1.25rem"). Default 0.9375rem. |

## Events

### change

A question header was toggled open/closed; params carry {index, open, name} — the row index, its NEW open state, and its question text.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
