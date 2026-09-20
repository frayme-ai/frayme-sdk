# Toggletip

A click-to-reveal info bubble anchored to a small trigger button, the accessible, keyboard-dismissable alternative to a hover-only tooltip (works on touch, supports Escape/outside-click to close). Prefer HoverCard when the reveal should be a richer title+description+image preview, or a native browser `title` tooltip when no interaction/accessibility guarantee is needed. Shows the `icon` glyph when `label` is unset; content only appears while toggled open.

## Example

```json
{
  "root": "toggletip",
  "elements": {
    "toggletip": {
      "type": "Toggletip",
      "props": {
        "label": "Pricing",
        "content": "Charges renew monthly. Cancel anytime."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | Text label on the trigger button. When omitted, the `icon` glyph is shown instead. |
| `icon` | `string` | Registry icon name for the trigger when there is no `label` (default an info circle). |
| `content` | `string` | The text shown inside the revealed bubble, the help/explanation the trigger discloses. Keep it to a sentence or two of escaped plain text; it only appears while the tip is toggled open. |
| `ariaLabel` | `string` | Accessible name (aria-label) for the icon-only trigger when there is no `label` (default "More information"). Escaped text, set for localization. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | Which side of the trigger the bubble/card opens on (default top for Toggletip, bottom for HoverCard). |
| `accent` | `string` | Accent color for the trigger glyph (default the foreground token) + bubble border (default the border token). |
| `color` | `string` | Primary text colour for the bubble body (default the foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow depth of the floating bubble, set to lift or flatten it (default lg). |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for the revealed bubble (fast/normal/slow). Default: no animation, appears instantly. |
| `size` | `"sm" \| "md" \| "lg"` | Trigger button + bubble scale: sm (h-6) · md (h-7, default) · lg (h-8). Also sets the bubble's max-width. |
