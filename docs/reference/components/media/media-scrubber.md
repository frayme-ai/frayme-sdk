# MediaScrubber

A visual media scrubber: a waveform / bar / line track with a draggable playhead, played + buffered fills, chapter markers, an optional play/pause button and a time readout. It does not drive a media element — it emits seek (`change`) and play/pause (`commit`) intents for the host. Owns the playhead position locally (seeded from currentTime); SSR-safe; one stable track carries the drag so no pointer-capture bugs. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the live seek position (playhead in seconds) from spec.state.

## Example

```json
{
  "root": "media-scrubber",
  "elements": {
    "media-scrubber": {
      "type": "MediaScrubber",
      "props": {
        "duration": 214,
        "currentTime": 62,
        "buffered": 140,
        "waveform": [
          0.2,
          0.5,
          0.8,
          0.6,
          0.9,
          0.4,
          0.7,
          0.3,
          0.85,
          0.5,
          0.6,
          0.95,
          0.4,
          0.7,
          0.55,
          0.8,
          0.3,
          0.6,
          0.9,
          0.45,
          0.7,
          0.5,
          0.65,
          0.8
        ],
        "chapters": [
          {
            "id": "c1",
            "time": 0,
            "label": "Intro"
          },
          {
            "id": "c2",
            "time": 90,
            "label": "Verse"
          },
          {
            "id": "c3",
            "time": 160,
            "label": "Outro"
          }
        ],
        "variant": "waveform"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `duration` | `number` | Total media length in SECONDS — the full span of the track (default `100`); set to the real clip length so seek fractions map correctly. |
| `currentTime` | `number` | Current playhead position in seconds (default 0). The host updates this during playback; the scrubber follows. |
| `value` | `number` | The live seek position in seconds, held in (bindable) state so an external Button can read where the playhead is. Seeds from currentTime when unbound; bind it to expose the scrub position. |
| `buffered` | `number` | Buffered-up-to position in seconds (default none) — renders a secondary fill. |
| `waveform` | `number[]` | Pre-computed waveform amplitudes 0..1 (or any positive scale, normalized). Omit for a flat track. Capped at 2000 samples. |
| `chapters` | `({ id: string, time: number, label: string })[]` | Chapter markers { id?, time (seconds), label? } placed along the axis. Capped at 200. |
| `playing` | `boolean` | Whether media is currently playing (default false) — sets the play/pause button state. |
| `showPlayButton` | `boolean` | Show the play/pause button that emits a play/pause `commit` intent (default `true`); hide it for a seek-only scrubber. |
| `showTime` | `boolean` | Show the "current / duration" time readout (default true). |
| `showThumbnails` | `boolean` | Reserve a taller track for a thumbnail strip look (default false). |
| `showSubmit` | `boolean` | Show an internal Submit button that emits `commit` with the current playhead position on demand (default false). Use it when no external Button reads the bound seek value. |
| `submitLabel` | `string` | Label for the internal Submit button when showSubmit is on (default "Seek"). Ignored unless showSubmit is true. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |
| `variant` | `"waveform" \| "bar" \| "line"` | Track style: waveform (default; needs waveform data, falls back to bar) · bar (a solid fill track) · line. |
| `height` | `string \| number` | Height of the scrubber track / waveform area (default 3rem). |
| `accent` | `string` | Played fill + playhead color (default the primary token). |
| `trackColor` | `string` | Color of the unplayed portion of the track behind the playhead (default the `muted` token); set a token or hex to theme the base rail. |
| `bufferedColor` | `string` | Buffered fill color (default the muted-foreground token). |

## Events

### change

The playhead was moved (drag-end or arrow key); params carry { time (seconds), fraction (0..1), timeLabel }. Only fires when emitOnChange !== false — otherwise the position lives in (bindable) state and is delivered on commit/submit.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

Either the play/pause button was pressed — params carry { action: "play"|"pause", playing (requested next state) } — OR the internal Submit button (showSubmit) settled the playhead — params carry { time (seconds), fraction (0..1), timeLabel }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### select

A chapter marker was clicked; params carry { id, index, time, label, fraction, timeLabel }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
