# Icon

A standalone icon glyph, placeable anywhere (in a Stack, beside a Text label, in a Card header) — not tied to a Button or other host. `name` is a glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (never raw SVG; unknown names render nothing); `size` picks the box (xs..xl, default md) and `color` tints it (defaults to the inherited foreground colour). Set `label` when the icon carries meaning so it is announced to assistive tech; leave it off for a decorative glyph, which is then aria-hidden. A LEAF — it renders no children.

## Example

```json
{
  "root": "icon",
  "elements": {
    "icon": {
      "type": "Icon",
      "props": {
        "name": "sun",
        "size": "lg"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `name` | [`IconName`](../../icons.md) | The glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "sun", "cloud-rain", "bell", "check"). Required. Never raw SVG; an unknown name renders nothing. |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Glyph box size: xs (14px) · sm (18px) · md (24px, default) · lg (32px) · xl (48px). Bump to `lg`/`xl` for a focal/illustrative glyph, drop to `xs`/`sm` for an inline marker. |
| `color` | `string` | Glyph colour (default the foreground token — inherits the surrounding text colour). Names a specific brand/semantic colour for the icon. |
| `label` | `string` | Accessible label (aria-label) describing what the icon means (e.g. "Sunny"). Omit for a purely decorative glyph — it is then hidden from assistive tech (aria-hidden). |
