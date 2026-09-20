# Stopwatch

A stopwatch that counts up from zero, with a mm:ss / hh:mm:ss readout (optional centisecond precision), Start / Pause / Reset controls, and an optional Lap list. SSR-safe: renders 0 on the server, then ticks on the client; elapsed time is ephemeral and never written back to the spec. Emits `commit` on each Lap. Bind `laps` with `{ $bindState }` so the agent (or a sibling control) can read the captured lap times (ms) from spec.state.

## Example

```json
{
  "root": "stopwatch",
  "elements": {
    "stopwatch": {
      "type": "Stopwatch",
      "props": {
        "showLaps": true,
        "precision": "centiseconds"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `autoStart` | `boolean` | Begin counting up on first render (default false, the user presses Start). |
| `format` | `"auto" \| "mm:ss" \| "hh:mm:ss"` | Readout format: auto (default, mm:ss under an hour, hh:mm:ss at/over it) · mm:ss · hh:mm:ss. |
| `precision` | `"seconds" \| "centiseconds"` | Readout resolution: seconds (default) · centiseconds (adds ".cs", ticks ~10×/s, use for lap-timing). |
| `showControls` | `boolean` | Show the Start / Pause / Reset buttons (default true). |
| `showLaps` | `boolean` | Show a Lap button + the recorded lap list (default false). |
| `laps` | `number[]` | The recorded lap times in ms, mirrored back here into spec.state so a Button/handler can read the captured laps; bindable, bind with {$bindState}. |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color of the readout: neutral (default) · success · warning · critical · info. |
| `accent` | `string` | Brand color for the primary Start button + lap markers (default the primary token). |
| `mutedColor` | `string` | Secondary/muted colour, the lap list, paused hint, and control-button chrome (default the muted-foreground token). |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Overall readout scale: sm · md (default) · lg · xl. |
| `fontSize` | `string \| number` | Exact readout font-size (e.g. 48px / 3rem). Overrides the `size` enum, which is the default. |
| `startLabel` | `string` | Start/Resume button label (default "Start"). Escaped text, set for i18n. |
| `pauseLabel` | `string` | Pause button label (default "Pause"). Escaped text. |
| `resetLabel` | `string` | Reset button label (default "Reset"). Escaped text. |
| `lapLabel` | `string` | Text on the Lap button that records the current split time (default "Lap"). Escaped text, set for i18n or to relabel the split action. |

## Events

### commit

The Lap button was pressed; params carry { index, elapsedMs } (index is the 1-based lap number, elapsedMs the total elapsed at that lap).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
