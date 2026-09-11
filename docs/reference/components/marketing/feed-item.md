# FeedItem

A social feed entry: author avatar + name/title + timestamp, a text body, optional attached media, and a row of footer action buttons (like/comment/share) that emit `commit` (host-routed). An action can be marked `active` (pressed/liked, tinted by `accent`); `countFormat:"compact"` abbreviates counters (24k). Group several in a Stack for a feed. Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which action label (or index) the user triggered from spec.state.

## Example

```json
{
  "root": "feed-item",
  "elements": {
    "feed-item": {
      "type": "FeedItem",
      "props": {
        "authorName": "Ada Lovelace",
        "authorTitle": "@ada",
        "timestamp": "2h",
        "body": "Just shipped the new analytics dashboard.",
        "countFormat": "compact",
        "actions": [
          {
            "icon": "heart",
            "label": "Like",
            "count": 24000,
            "active": true
          },
          {
            "icon": "send",
            "label": "Share",
            "count": 3
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
| `id` | `string` | Stable identifier for THIS post/feed item (e.g. a post id or slug). Echoed in the `commit` payload so the host knows which post an action fired on when several FeedItems share a feed. |
| `authorName` | `string` | The post author's name (required) — shown bold beside the avatar and used to derive its initials fallback. |
| `authorTitle` | `string` | Secondary line under the author name (e.g. a handle, role, or "@username"). |
| `avatarSrc` | `string` | Author avatar image URL (raster only; falls back to initials from authorName). |
| `timestamp` | `string` | Right-aligned time/meta text (e.g. "2h", "Jun 24"). |
| `body` | `string` | The post text (plain escaped text — no markdown/HTML parsing). |
| `mediaSrc` | `string` | Optional attached media image URL (raster only; bad/absent → a tinted placeholder). |
| `mediaAlt` | `string` | Alt text for the attached media image (accessibility). Falls back to `authorName` when the image loads but no alt is set; only shown as visible text if the image fails. |
| `aspect` | `"auto" \| "1/1" \| "4/3" \| "3/2" \| "16/9" \| "21/9" \| "3/4"` | Aspect ratio of the attached-media frame: auto · 1/1 · 4/3 · 3/2 · 16/9 (default) · 21/9 · 3/4. |
| `actions` | `({ icon: string, label: string, count: number, active: boolean })[]` | Footer action buttons (e.g. like / comment / share). Each shows an icon + optional label + optional count + optional `active` (pressed/liked) flag; clicking emits `commit`. |
| `activeAction` | `string` | Write target for WHICH action/item the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting, so the host can attribute the action. Emit-only when unbound. |
| `countFormat` | `"plain" \| "compact"` | How action counters render: plain (raw number, e.g. 24000, default) · compact (abbreviated, e.g. 24k / 1.2M). Applies to every action count in this item. |
| `variant` | `"card" \| "plain"` | Surface treatment: card (bordered surface, default) · plain (no border/background, for tight feeds). |
| `accent` | `string` | Brand color for a pressed/liked action (an action with `active:true` tints its icon + label + count to this; default the primary token). Names the "liked" color. |
| `mutedColor` | `string` | Secondary/muted text colour — the author handle/title, the timestamp, and the resting footer action buttons (icons/labels/counters) (default the muted-foreground token). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line height of the post body text: tight · snug · normal · relaxed (default) · loose. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole feed item region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the author name (light · normal · medium · semibold · bold; default semibold). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the author name (tighter · tight · normal · wide · wider; default normal). |
| `fontSize` | `string \| number` | Exact font size of the author name (e.g. "20px" / "1.25rem"). Default inherited (1rem). |

## Events

### commit

A footer action button (like/comment/share) was pressed; params carry {id, label, index, active} — this post's `id`, the pressed action's label, its 0-based index in the actions array, and its `active`/liked state at press time. `activeAction` (when bound) is written first so the host can attribute which action fired.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
