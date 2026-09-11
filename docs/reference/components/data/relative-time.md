# RelativeTime

A self-updating relative timestamp ("2h ago") or countdown ("expires in 3:42"). `target` is an ISO string or epoch ms. SSR-safe: renders a static initial string, then ticks on the client. The &lt;time> element carries the machine-readable ISO `dateTime` and a hover `title` with the absolute (locale-formatted) time. An unparseable target renders a muted dash.

## Example

```json
{
  "root": "relative-time",
  "elements": {
    "relative-time": {
      "type": "RelativeTime",
      "props": {
        "target": "2026-06-25T09:00:00Z",
        "mode": "relative",
        "prefix": "Updated"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `target` | `string \| number` | The reference time: an ISO date/time string OR an epoch-milliseconds number. |
| `mode` | `"relative" \| "countdown"` | relative (default, "2h ago" / "in 3 days") · countdown (ticks down to the target, clamps at "expired"). |
| `format` | `"short" \| "long"` | Wording: short (default, "2h ago") · long ("2 hours ago"). |
| `prefix` | `string` | Static text shown before the time (e.g. "Updated"). |
| `suffix` | `string` | Static text appended after the rendered time/countdown (e.g. "(local)"). Omit for none. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic text color (default neutral; use `critical` for an expiring countdown). |
| `mutedColor` | `string` | Secondary/muted text colour — the prefix/suffix labels and the unknown-time dash (default the muted-foreground token). |
| `labels` | `{ justNow: string, ago: string, in: string, expired: string, second: string, minute: string, hour: string, day: string, week: string, month: string, year: string }` | Override the relative-time vocabulary for localization. Each key defaults to the current English; supply only the ones you want to change. `in`/`ago` apply to BOTH short and long formats; the unit words and the long "just now" apply to `format:long` only (short mode uses fixed compact suffixes and "now"). |
