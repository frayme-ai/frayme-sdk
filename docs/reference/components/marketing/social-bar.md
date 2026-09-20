# SocialBar

A row of icon-only social/contact links, Twitter/X, Facebook, Instagram, LinkedIn, YouTube, GitHub (via `network`), or any registry glyph (via `icon`). Each link opens in a new tab (rel=noopener noreferrer). `variant` sets the chip treatment, `accent` tints it. Pairs with Footer.socials.

## Example

```json
{
  "root": "social-bar",
  "elements": {
    "social-bar": {
      "type": "SocialBar",
      "props": {
        "items": [
          {
            "network": "github",
            "href": "https://github.com/frayme"
          },
          {
            "network": "twitter",
            "href": "https://twitter.com/frayme"
          },
          {
            "network": "linkedin",
            "href": "https://www.linkedin.com/company/frayme"
          }
        ],
        "variant": "plain",
        "size": "md"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ network: "twitter" \| "facebook" \| "instagram" \| "linkedin" \| "youtube" \| "github", icon: string, href: string, label: string })[]` | The social/contact links, each renders as an icon-only link. Items that resolve to no known glyph are skipped. |
| `size` | `"sm" \| "md" \| "lg"` | Icon button diameter + glyph scale together: sm · md (default) · lg. Use `sm` for a footer strip, `lg` for a prominent contact row. |
| `variant` | `"plain" \| "filled" \| "outline"` | plain (bare icon, default) · filled (accent chip with on-accent icon) · outline (bordered chip). |
| `align` | `"start" \| "center" \| "end"` | Horizontal alignment of the icon row within its container: start (left, default) · center · end (right). Set `center` for a centered footer bar or `end` to right-align. |
| `accent` | `string` | Accent color, the icon color (plain/outline) or the chip fill (filled). Default is variant-dependent: muted-foreground (plain) · foreground (outline) · primary (filled). |
| `accentText` | `string` | On-accent icon color for the `filled` variant (pair with a custom `accent` so the icon stays legible on the fill; default = the on-primary token). |
