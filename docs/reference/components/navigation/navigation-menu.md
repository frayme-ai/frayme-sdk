# NavigationMenu

A two-level navigation menu with flyout submenus. Each top-level item is a link, or — when it has `children` — a button (aria-haspopup/aria-expanded) that toggles a one-level flyout of sub-links (internal state, live without a binding; Escape or an outside click dismisses it). Leaf links are scheme-guarded &lt;a>s; `select` is emitted on navigation. Use as the primary site/app nav.

## Example

```json
{
  "root": "navigation-menu",
  "elements": {
    "navigation-menu": {
      "type": "NavigationMenu",
      "props": {
        "items": [
          {
            "label": "Home",
            "href": "/"
          },
          {
            "label": "Products",
            "children": [
              {
                "label": "API",
                "href": "/api",
                "description": "Compose UI from natural language"
              },
              {
                "label": "Platform",
                "href": "/platform",
                "description": "Ship MCP Apps to Claude"
              }
            ]
          },
          {
            "label": "Docs",
            "href": "/docs",
            "icon": "home"
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
| `items` | `({ label: string, href: string, icon: string, active: boolean, children: object[] })[]` | Top-level nav entries. A plain entry is a link ({label, href, icon, active}); an entry WITH `children` becomes a toggle that opens a flyout of sub-items ({label, href, description, icon}). Set `active:true` on the current-page entry. |
| `orientation` | `"horizontal" \| "vertical"` | Bar direction: horizontal (top nav, default) · vertical (a sidebar-style menu). |
| `accent` | `string` | Accent TEXT COLOUR for the nav links — the link/trigger hover, the open flyout trigger incl. its chevron, AND the current-page (`active`) entry (default the foreground token). Names a specific brand color. |
| `mutedColor` | `string` | Secondary/muted text colour — the sub-item description lines inside the flyout + the trigger chevron at rest (default the muted-foreground token). |
| `bg` | `string` | Background fill of the flyout submenu panel (default the card token). Pair with `borderColor` so a branded nav does not pop a default-white menu. |
| `borderColor` | `string` | Border colour of the flyout submenu panel (default the border token). Pair with `bg` for a branded flyout surface. |

## Events

### select

A nav link was clicked — a top-level leaf or a flyout sub-link; params carry {label, href, index}, plus {parent} (the top-level label) for sub-links.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
