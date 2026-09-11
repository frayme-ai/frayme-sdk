# Timer

A countdown timer that ticks down from `duration` seconds to zero, with a mm:ss / hh:mm:ss readout, optional Start / Pause / Reset controls, and an optional circular progress ring. SSR-safe: renders the static full duration on the server, then ticks on the client; the running/remaining value is ephemeral and never written back to the spec. Emits `commit` when it reaches zero.

## Example

```json
{
  "root": "timer",
  "elements": {
    "timer": {
      "type": "Timer",
      "props": {
        "duration": 300,
        "showProgress": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `duration` | `number` | Countdown length in SECONDS (e.g. 300 for 5 minutes). Required; clamped to a finite, non-negative value. |
| `autoStart` | `boolean` | Begin counting down on first render (default false — the user presses Start). |
| `format` | `"auto" \| "mm:ss" \| "hh:mm:ss"` | Readout format: auto (default — mm:ss under an hour, hh:mm:ss at/over it) · mm:ss · hh:mm:ss. |
| `showControls` | `boolean` | Show the Start / Pause / Reset buttons (default true). Set false for a display-only countdown driven by `autoStart`. |
| `showProgress` | `boolean` | Draw a circular progress ring that depletes as the countdown runs (default false). |
| `tone` | `"neutral" \| "success" \| "warning" \| "critical" \| "info"` | Semantic color of the readout: neutral (default) · success · warning · critical (use for an expiring timer) · info. |
| `accent` | `string` | Brand color for the progress ring + the primary Start button (default the primary token). |
| `mutedColor` | `string` | Secondary/muted colour — the ring track, the paused hint, and the control-button chrome (default the muted-foreground token). |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Overall readout scale: sm · md (default) · lg · xl. |
| `fontSize` | `string \| number` | Exact readout font-size (e.g. 48px / 3rem). Overrides the `size` enum, which is the default. |
| `expiredLabel` | `string` | Text shown when the countdown reaches zero (default "Time's up"). Escaped text. |
| `startLabel` | `string` | Start/Resume button label (default "Start"). Escaped text — set for i18n. |
| `pauseLabel` | `string` | Pause button label (default "Pause"). Escaped text. |
| `resetLabel` | `string` | Reset button label (default "Reset"). Escaped text. |

## Events

### commit

The countdown reached zero; params carry { reason: "complete", duration } (duration is the original countdown length in seconds). Fires once per run; a Reset then Start can fire it again.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
