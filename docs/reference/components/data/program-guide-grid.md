# ProgramGuideGrid

A broadcast EPG: a channel gutter on the left, a proportional horizontal time axis across the top, and one timeline row per channel with programmes as duration-sized cells and a live now-line. Times are "HH:MM" or minutes-from-midnight, validated and positioned proportionally. Stateless, SSR-safe; click a programme to emit `select`. Bind `selectedId` with `{ $bindState }` so the agent (or a sibling control) can read the id of the currently-selected programme from spec.state.

## Example

```json
{
  "root": "program-guide-grid",
  "elements": {
    "program-guide-grid": {
      "type": "ProgramGuideGrid",
      "props": {
        "channels": [
          {
            "id": "bbc1",
            "label": "BBC One"
          },
          {
            "id": "itv",
            "label": "ITV"
          },
          {
            "id": "ch4",
            "label": "Channel 4"
          }
        ],
        "startHour": 18,
        "endHour": 24,
        "programs": [
          {
            "id": "p1",
            "channel": "bbc1",
            "title": "The News at Six",
            "start": "18:00",
            "end": "18:30"
          },
          {
            "id": "p2",
            "channel": "bbc1",
            "title": "Countryfile",
            "subtitle": "The Dales",
            "start": "18:30",
            "end": "19:30"
          },
          {
            "id": "p3",
            "channel": "bbc1",
            "title": "Match of the Day",
            "start": "19:30",
            "end": "21:00",
            "color": "#16a34a"
          },
          {
            "id": "p4",
            "channel": "itv",
            "title": "Coronation Street",
            "start": "18:00",
            "end": "19:00"
          },
          {
            "id": "p5",
            "channel": "itv",
            "title": "Britain's Got Talent",
            "start": "19:00",
            "end": "21:00",
            "color": "#f59e0b"
          },
          {
            "id": "p6",
            "channel": "ch4",
            "title": "Channel 4 News",
            "start": "19:00",
            "end": "20:00"
          },
          {
            "id": "p7",
            "channel": "ch4",
            "title": "Grand Designs",
            "start": "20:00",
            "end": "21:00"
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
| `channels` | `({ id: string, label: string, logo: string })[]` | The channel rows { id, label, logo? }. Omit for a demo. Capped at 60. |
| `programs` | `({ id: string, channel: string, title: string, subtitle: string, start: string \| number, end: string \| number, color: string })[]` | The programmes; each is { id?, channel (a channel id), title, subtitle?, start, end, color? }. start/end are "HH:MM" or minutes-from-midnight. Capped at 1000. |
| `startHour` | `number` | First hour shown on the time axis, `0..23` (default `6`); lower it for overnight/early listings, pair with `endHour`. |
| `endHour` | `number` | Last hour shown on the time axis, `1..24` (default `24`); narrow the `startHour..endHour` window to a prime-time slice. |
| `hourWidth` | `number` | Pixel width of one hour (default 120, clamped 40..400). Sets the scrollable timeline width. |
| `rowHeight` | `number` | Height of a channel row in px (default 56, clamped 32..120). |
| `tickStep` | `"30" \| "60" \| "120"` | Spacing of the time-axis tick marks in minutes: `30`, `60`, or `120` (default `60`); use `30` for tighter granularity. |
| `hour12` | `boolean` | Use 12-hour (am/pm) time-axis labels instead of 24-hour (default true). |
| `nowLine` | `boolean` | Show a live current-time line (default true; hidden when outside the window). |
| `showChannelBar` | `boolean` | Show the left channel gutter with logos/labels (default `true`); set `false` for a timeline-only strip when channels are labelled elsewhere. |
| `accent` | `string` | Default programme color + now-line (default the primary token). |
| `gridColor` | `string` | Gridline + divider color (default the border token). |
| `mutedColor` | `string` | Axis labels + channel labels color (default the muted-foreground token). |
| `selectedId` | `string` | The id of the currently-selected programme; mirrored back here into (bindable) spec.state on every click so a Button can read which programme is selected. Bind with { $bindState }. |

## Events

### select

A programme was clicked; params carry { id, channel, channelLabel, title, subtitle, start, end, startTime, endTime }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
