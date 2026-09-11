# Comment

A single comment: author avatar + name + timestamp, the comment text, and a row of action buttons (reply/like) that emit `commit`. Set `depth` to indent a reply, or nest replies as children (a Comment or CommentThread in the default slot). Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which action label (or index) the user triggered from spec.state.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "comment",
  "elements": {
    "comment": {
      "type": "Comment",
      "props": {
        "authorName": "Grace Hopper",
        "timestamp": "5m ago",
        "body": "Great work — shipping this unblocks the whole team.",
        "actions": [
          {
            "icon": "send",
            "label": "Reply"
          },
          {
            "icon": "heart",
            "label": "Like"
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
| `id` | `string` | Stable identifier for THIS comment (e.g. a comment id). Echoed in the `commit` payload so the host knows which comment an action (reply/like) fired on when several Comments are on screen. |
| `authorName` | `string` | The commenter's name (required) — shown bold beside the avatar and used to derive its initials fallback. |
| `avatarSrc` | `string` | Author avatar image URL (raster only; falls back to initials from authorName). |
| `timestamp` | `string` | Muted meta text next to the author name (e.g. "5m ago"). |
| `body` | `string` | The comment text (plain escaped text — no markdown/HTML parsing). |
| `actions` | `({ icon: string, label: string, count: number, active: boolean })[]` | Footer action buttons (e.g. reply / like). Each shows an icon + optional label + optional count + optional `active` (pressed/liked) flag; clicking emits `commit`. |
| `activeAction` | `string` | Write target for WHICH action/item the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting, so the host can attribute the action. Emit-only when unbound. |
| `countFormat` | `"plain" \| "compact"` | How action counters render: plain (raw number, default) · compact (abbreviated, e.g. 24k / 1.2M). Applies to every action count on this comment. |
| `depth` | `number` | Nesting depth 0–6 — indents the comment to show it is a reply (plain number; default 0). |
| `accent` | `string` | Brand color for a pressed/liked action (an action with `active:true` tints its icon + label + count to this; default the primary token). |
| `mutedColor` | `string` | Secondary/muted text colour — the timestamp/meta next to the author name and the resting action buttons (icons/labels) (default the muted-foreground token). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line height of the comment body text: tight · snug · normal · relaxed (default) · loose. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole comment region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the author name (light · normal · medium · semibold · bold; default semibold). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the author name + comment body (tighter · tight · normal · wide · wider; default normal). |
| `fontSize` | `string \| number` | Exact font size of the author name + comment body (e.g. "16px" / "1rem"). Default 0.875rem. |

## Events

### commit

A footer action button (reply/like) was pressed; params carry {id, label, index, active} — this comment's `id`, the pressed action's label, its 0-based index in the actions array, and its `active`/liked state at press time. `activeAction` (when bound) is written first so the host can attribute which action fired.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
