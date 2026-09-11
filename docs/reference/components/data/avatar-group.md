# AvatarGroup

An overlapping stack of avatars with a "+N" overflow chip — for showing who is on a team / who reacted. Each avatar is an image (sanitized) or an initials fallback from the name. Reach for it wherever a compact "who" summary beats a full list: set `max` to cap how many faces show before the rest collapse into the "+N" chip, and `size`/`sizeValue` to scale the whole row.

## Example

```json
{
  "root": "avatar-group",
  "elements": {
    "avatar-group": {
      "type": "AvatarGroup",
      "props": {
        "items": [
          {
            "name": "Ada Lovelace"
          },
          {
            "name": "Alan Turing"
          },
          {
            "name": "Grace Hopper"
          },
          {
            "name": "Edsger Dijkstra"
          }
        ],
        "max": 3
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `({ src: string, name: string, alt: string })[]` | The people in the stack. The first `max` render as overlapping avatars; the rest collapse into a "+N" chip. |
| `max` | `number` | How many avatars to show before collapsing the rest into a "+N" overflow chip (plain number; default 5). |
| `size` | `"xs" \| "sm" \| "md" \| "lg"` | Avatar diameter enum: xs (24px) · sm (28px) · md (40px, default) · lg (56px). Overridden by the exact `sizeValue` channel when set. |
| `sizeValue` | `string \| number` | Exact avatar diameter (e.g. 48px / 3rem). Overrides the `size` enum, which is the default. |
| `ring` | `boolean` | Add a card-colored ring between overlapping avatars so they read as separate (default true). |
| `mutedColor` | `string` | Secondary/muted text colour — the "+N" overflow chip (default the muted-foreground token). |
