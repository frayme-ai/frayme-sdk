# CommentThread

A recursive comment thread: top-level comments each with optional nested `replies` (same shape), indented per level and hard-capped at `maxDepth`. When `collapsible`, each subtree can be collapsed/expanded inline (internal state). For per-comment action buttons (reply/like), use the standalone Comment component. Bind `collapsed` with `{ $bindState }` so the agent (or a sibling control) can read the live set of collapsed reply-subtree keys from spec.state.

## Example

```json
{
  "root": "comment-thread",
  "elements": {
    "comment-thread": {
      "type": "CommentThread",
      "props": {
        "comments": [
          {
            "authorName": "Ada Lovelace",
            "timestamp": "1h",
            "body": "Loving the new feed layout.",
            "replies": [
              {
                "authorName": "Alan Turing",
                "timestamp": "50m",
                "body": "Agreed, much cleaner."
              }
            ]
          }
        ],
        "maxDepth": 4
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `comments` | `({ authorName: string, avatarSrc: string, timestamp: string, body: string, replies: any[] })[]` | The top-level comments. Each may carry a `replies` array of the same shape, rendered recursively up to `maxDepth`. |
| `maxDepth` | `number` | Hard cap on reply nesting 1-6, guards against deep/cyclic trees (default 4). Replies past the cap are not rendered. |
| `collapsible` | `boolean` | When true, each comment with replies shows a toggle to collapse/expand its reply subtree (works without a binding). Default true. |
| `collapsed` | `string[]` | The stable keys of comment subtrees the user has collapsed. Bind with { $bindState } so an agent/Button can read which reply threads are currently hidden; the full collapsed-key set is mirrored back here on every collapse/expand toggle. |
| `mutedColor` | `string` | Secondary/muted text colour, per-comment timestamps/meta and the collapse/expand reply toggle (default the muted-foreground token). |
| `borderColor` | `string` | Colour of the nested-reply rail, the vertical line down the left of each reply group (default the border token). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line height of every comment body in the thread: tight · snug · normal · relaxed (default) · loose. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole thread; cascades to every comment via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of every author name in the thread (light · normal · medium · semibold · bold; default semibold). Matches the standalone Comment channel. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of author names + comment bodies across the thread (tighter · tight · normal · wide · wider; default normal). Matches the standalone Comment channel. |
| `fontSize` | `string \| number` | Exact font size of author names + comment bodies across the thread (e.g. "16px" / "1rem"). Default 0.875rem. Matches the standalone Comment channel. |

## Events

### change

A reply subtree was collapsed or expanded; params carry {collapsed, key}, the full resolved array of collapsed subtree keys plus the `key` of the subtree just toggled.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
