# LogConsole

A virtualized log console: thousands of lines with fixed-row virtualization, per-line severity color from a closed level enum, ANSI stripped to plain text, a level+search toolbar, wrap toggle, copy, and sticky auto-scroll (follow) with a "jump to latest" pill. Fed by a static snapshot the host recomposes (no socket). Escaped text; SSR-safe (renders top-anchored, jumps to the tail on mount). Bind `levels`, `query`, `follow`, `wrap`, `selectedIndex` with `{ $bindState }` so the agent (or a sibling control) can read the live view state from spec.state — `levels` holds the enabled severity filter, `query` the active search text, `follow` whether auto-scroll is on, `wrap` whether long lines wrap, `selectedIndex` the selected line index.

## Example

```json
{
  "root": "log-console",
  "elements": {
    "log-console": {
      "type": "LogConsole",
      "props": {
        "lines": [
          {
            "text": "[server] listening on :3005",
            "level": "info",
            "timestamp": "12:00:01"
          },
          {
            "text": "GET /explorer 200 14ms",
            "level": "debug",
            "timestamp": "12:00:02"
          },
          {
            "text": "cache miss for catalog.prompt()",
            "level": "warn",
            "timestamp": "12:00:03"
          },
          {
            "text": "POST /v1/compose 200 3.4s",
            "level": "info",
            "timestamp": "12:00:05"
          },
          {
            "text": "validateSpec: 1 unsafe color rejected",
            "level": "warn",
            "timestamp": "12:00:06"
          },
          {
            "text": "Cold start took 41s",
            "level": "error",
            "timestamp": "12:00:47"
          },
          {
            "text": "adapter loaded · frayme-0.17.1",
            "level": "info",
            "timestamp": "12:00:48"
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
| `lines` | `(string \| object)[]` | The log lines snapshot; each is a plain string OR { text, level?, timestamp?, source? }. The host recomposes to append. ANSI codes are stripped. Capped at the newest 5000; each line truncated to 2000 chars. |
| `levels` | `("debug" \| "info" \| "warn" \| "error" \| "fatal")[]` | Which severity levels are shown initially (default all). The toolbar chips toggle them; the active set is mirrored into (bindable) state so an external Button can read the current severity filter. |
| `query` | `string` | The search query text, held in (bindable) state so an external Button can read the active filter without waiting for a per-keystroke `search` emit. Seeds the search box and stays in sync as the user types. |
| `follow` | `boolean` | Auto-scroll to the newest line as it arrives (default true); the current follow preference mirrors back into (bindable) state so an external Button can read whether auto-scroll is on. Pauses when the user scrolls up; a "jump to latest" pill re-enables it. |
| `showToolbar` | `boolean` | Show the level/search/wrap toolbar (default true). |
| `showTimestamps` | `boolean` | Show the per-line timestamp column when present (default true). |
| `wrap` | `boolean` | Wrap long lines instead of horizontal scroll (default false); the current wrap toggle mirrors back into (bindable) state so an external Button can read whether long-line wrapping is on. |
| `selectedIndex` | `number` | Zero-based index of the currently-selected log line; a line click writes the index here (mirrored into bindable state) so an external Button can read which line is selected. null = nothing selected. |
| `showSearch` | `boolean` | Show the search box for filtering log lines (default true). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |
| `maxHeight` | `string \| number` | Max console height before the body scrolls (default 24rem). |
| `rowHeight` | `number` | Fixed row height in px for virtualization (default 20, clamped 16..40). |
| `accent` | `string` | Accent color of the active toolbar controls + jump pill (default the primary token). |
| `background` | `string` | Console surface background (default the card token). |

## Events

### search

The search query changed; params carry { query }. Only fires when emitOnChange !== false — otherwise the query lives in (bindable) state and is read on demand (e.g. via the copy `commit` or an external Button).

| Key | Type | Description |
| --- | --- | --- |
| `query` | `string` | The current query text. |

### change

A view change: { name:"levels", value:string[] } · { name:"follow", value } · { name:"wrap", value }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### select

A line was clicked; params carry { index, text, level, timestampLabel, source }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### commit

The copy affordance was used; params carry { control:"copy", count, text (the joined copied lines), levels (currently-enabled severities), query (active search) } so the agent gets the exact copied content plus the filter context that produced it.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
