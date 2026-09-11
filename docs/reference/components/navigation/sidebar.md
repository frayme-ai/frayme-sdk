# Sidebar

Vertical app navigation rail. Renders an &lt;aside> with an optional title header and SidebarItem children. `collapsed` gives an icon-only rail.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "sidebar",
  "elements": {
    "sidebar": {
      "type": "Sidebar",
      "props": {
        "title": "Workspace",
        "variant": "default"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Optional header label shown at the top of the rail (e.g. the app/section name). Omit for a bare rail. |
| `variant` | `"default" \| "floating" \| "ghost"` | Rail chrome: default (solid panel with right border) · floating (rounded, shadowed, inset card) · ghost (transparent, no border). |
| `collapsed` | `boolean` | Collapse to a narrow icon-only rail (hides the title + item labels). Pair with SidebarItem `icon`s. |
| `size` | `"sm" \| "md" \| "lg"` | Rail width: sm (~12rem) · md (~16rem, default) · lg (~20rem). When `collapsed`, width is fixed narrow regardless. |
| `width` | `string \| number` | Exact rail width (e.g. 280px / 18rem). Overrides the `size` enum, which is the default. Ignored when `collapsed` (the narrow icon rail is fixed). |
| `sticky` | `boolean` | Pin the rail to the viewport top while the page scrolls (position: sticky). |
| `bg` | `string` | Rail background fill. Names a specific surface color (e.g. a dark nav rail); default is the card token. |
| `borderColor` | `string` | Right-edge / floating-card border color (default border token). |
| `accent` | `string` | Accent color for the title + propagated to the active SidebarItem highlight; default the primary token. |
| `mutedColor` | `string` | Secondary/muted text colour — the uppercase title kicker when no accent is set (default the muted-foreground token). |
