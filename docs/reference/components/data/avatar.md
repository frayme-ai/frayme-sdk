# Avatar

Circular user avatar: renders the image at `src`, falling back to initials derived from `name` when the image is absent or fails to load. Choose Avatar for people/account identity (comment authors, headers, member lists); use Image for general pictures. Supports a token-colored status `ring` and xs-xl sizes.

## Example

```json
{
  "root": "avatar",
  "elements": {
    "avatar": {
      "type": "Avatar",
      "props": {
        "name": "Jane Doe",
        "size": "md"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `string` | Image URL for the avatar photo (javascript:/file: schemes rejected). When omitted or the load fails, initials derived from `name` render instead. |
| `name` | `string` | The person’s display name — REQUIRED. Drives the fallback initials (first letters of the first two words: "Jane Doe" → "JD"), the img alt text, and the hover tooltip. |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Box diameter and initials font size together: xs · sm · md (default) · lg · xl. Drop to `xs`/`sm` for inline/list rows, `lg`/`xl` for a profile header; use `sizeValue` for an exact diameter. |
| `sizeValue` | `string \| number` | Exact box diameter (width + height, e.g. "80px" / "5rem"). Overrides the `size` enum, which is the default (initials font size still follows the enum). |
| `shape` | `"circle" \| "rounded" \| "square"` | Corner shape: circle (default) · rounded · square. |
| `ring` | `"none" \| "default" \| "success" \| "warning" \| "critical" \| "info"` | Status ring around the avatar, token-colored (default none). |
| `border` | `boolean` | Render a token border (common for on-image avatars). |
| `bg` | `string` | Fallback background color behind the initials (default muted token). |
| `color` | `string` | Text colour of the fallback initials shown when there is no image (default the foreground token). Pair it with a branded `bg` for a coloured monogram chip. |
| `borderColor` | `string` | Border colour (implies a border; default the border token). |
| `ringColor` | `string` | Exact status-ring color (overrides the `ring` token color). |
