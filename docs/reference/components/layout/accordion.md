# Accordion

Collapsible sections. Items as [{title, content}]. Type 'single' (default) or 'multiple'. Bind `openIndexes` with { $bindState } so the agent (or a sibling control) can read which section indexes are currently expanded from spec.state.

## Example

```json
{
  "root": "accordion",
  "elements": {
    "accordion": {
      "type": "Accordion",
      "props": {
        "items": [
          {
            "title": "Shipping",
            "content": "Ships in 2-3 business days."
          },
          {
            "title": "Returns",
            "content": "Free returns within 30 days."
          },
          {
            "title": "Warranty",
            "content": "Covered for 1 year from purchase."
          }
        ],
        "type": "single",
        "defaultOpenIndex": null,
        "variant": null,
        "size": null,
        "radius": null,
        "radiusValue": null,
        "borderColor": null,
        "accent": null,
        "mutedColor": null,
        "chevronIcon": null,
        "openIndexes": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ title: string, content: string })[]` | The sections as [{title, content}] — both plain strings (content is NOT a child slot), e.g. [{"title":"Shipping","content":"Ships in 2-3 business days."}]. For rich child components use Collapsible instead. |
| `type` | `"single" \| "multiple"` | Expansion mode: single (opening one section closes the others, default) · multiple (sections open and close independently). |
| `defaultOpenIndex` | `number \| number[]` | Item index (or indices, with type:multiple) expanded by default. Omit to start fully collapsed. |
| `variant` | `"bordered" \| "separated" \| "ghost"` | Container chrome: bordered (boxed, default) · separated (gapped cards) · ghost (borderless). |
| `size` | `"sm" \| "md" \| "lg"` | Section density — padding + font size of each trigger (the panel body padding follows), and the caret glyph size (14/16/18): sm · md (default) · lg. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner radius of the boxed container (variant:bordered) AND of each item card (variant:separated); default md. |
| `radiusValue` | `string \| number` | Exact corner radius of the container and of each separated item card (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `borderColor` | `string` | Border color of the outer box AND the dividers between sections (each card edge on variant:separated); default the border token. |
| `accent` | `string` | Text colour of the OPEN section's header title and its caret glyph (default: inherits the surrounding ink). Names a specific colour for the active section. |
| `mutedColor` | `string` | Secondary/muted text colour — the expanded panel body copy (default the muted-foreground token). |
| `chevronIcon` | `string` | Expand/collapse caret glyph — an icon NAME from the closed registry (e.g. "chevron-down", "plus"). Unknown/omitted → the default ▾ caret. Never raw SVG. |
| `openIndexes` | `number[]` | Indexes of the currently-expanded sections, mirrored back here into (bindable) spec.state on every toggle. Bind with { $bindState } so a Button/agent can read which sections are open; with type:single it holds at most one index. Seeds from `defaultOpenIndex` when omitted. |

## Events

### change

A section was expanded or collapsed; params carry {openIndexes} — the full resolved array of currently-expanded item indexes (with type:single it holds at most one).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
