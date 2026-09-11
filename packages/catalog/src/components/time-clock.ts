/**
 * Frayme time-clock family — the duration-clock components (Timer · Stopwatch).
 *
 * Same locked contract as the rest of the catalog: bounded ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for a
 * color, `dimensionSchema` for a length). Every enum/value prop is `.nullable()`
 * + `.describe()`; defaults live in the renderer, so a props-less spec still
 * renders a polished, ticking clock.
 *
 * ARCHITECTURE (the "self-ticking posture"): a live clock ticks
 * in React state ONLY — it is seeded from static props (a `duration` number / a
 * zero baseline), ticks against the wall clock on the client, and NEVER writes a
 * running/elapsed value back into the stored spec. This is the exact SSR-safe
 * pattern the shipped `RelativeTime` uses; it introduces NO self-mutating spec
 * primitive. The declarative-static spec model is preserved.
 *
 * SECURITY (non-negotiable): no new value channel. Inputs are NUMBERS
 * (duration/seconds, Number.isFinite-guarded + clamped in the renderer), bounded
 * ENUMS, validated colors (`colorSchema`), and validated dimensions
 * (`dimensionSchema`). Labels render as ESCAPED React text — never markup.
 *
 * Channel legend: E enum · C content · N number · SC safeColor (VALUE) ·
 * D dimension (VALUE).
 *
 * Components: Timer · Stopwatch.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Size, Tone } from './_shared.js';

/** Readout formats shared by both clocks. `auto` picks mm:ss under an hour, else hh:mm:ss. */
const clockFormat = z
  .enum(['auto', 'mm:ss', 'hh:mm:ss'])
  .nullable()
  .describe('Readout format: auto (default — mm:ss under an hour, hh:mm:ss at/over it) · mm:ss · hh:mm:ss.');

export const timeClockComponents = {
  // ===========================================================================
  // Timer — a countdown clock (mm:ss / hh:mm:ss) with optional progress ring
  // ===========================================================================
  Timer: {
    props: z.object({
      duration: z
        .number()
        .describe('Countdown length in SECONDS (e.g. 300 for 5 minutes). Required; clamped to a finite, non-negative value.'),
      autoStart: z.boolean().nullable().describe('Begin counting down on first render (default false — the user presses Start).'),
      format: clockFormat,
      showControls: z.boolean().nullable().describe('Show the Start / Pause / Reset buttons (default true). Set false for a display-only countdown driven by `autoStart`.'),
      showProgress: z.boolean().nullable().describe('Draw a circular progress ring that depletes as the countdown runs (default false).'),
      tone: Tone.describe('Semantic color of the readout: neutral (default) · success · warning · critical (use for an expiring timer) · info.'),
      accent: colorSchema.describe('Brand color for the progress ring + the primary Start button (default the primary token).'),
      mutedColor: colorSchema.describe('Secondary/muted colour — the ring track, the paused hint, and the control-button chrome (default the muted-foreground token).'),
      size: Size.describe('Overall readout scale: sm · md (default) · lg · xl.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 12, max: 96 }).describe('Exact readout font-size (e.g. 48px / 3rem). Overrides the `size` enum, which is the default.'),
      // CONTENT / i18n — frozen English strings, each defaulting to the current literal.
      expiredLabel: z.string().nullable().describe('Text shown when the countdown reaches zero (default "Time\'s up"). Escaped text.'),
      startLabel: z.string().nullable().describe('Start/Resume button label (default "Start"). Escaped text — set for i18n.'),
      pauseLabel: z.string().nullable().describe('Pause button label (default "Pause"). Escaped text.'),
      resetLabel: z.string().nullable().describe('Reset button label (default "Reset"). Escaped text.'),
    }),
    description:
      'A countdown timer that ticks down from `duration` seconds to zero, with a mm:ss / hh:mm:ss readout, optional Start / Pause / Reset controls, and an optional circular progress ring. SSR-safe: renders the static full duration on the server, then ticks on the client; the running/remaining value is ephemeral and never written back to the spec. Emits `commit` when it reaches zero.',
    example: { duration: 300, showProgress: true },
    events: ['commit'],
    eventsDoc: {
      commit: 'The countdown reached zero; params carry { reason: "complete", duration } (duration is the original countdown length in seconds). Fires once per run; a Reset then Start can fire it again.',
    },
  },

  // ===========================================================================
  // Stopwatch — a count-up clock with Start / Pause / Reset / Lap
  // ===========================================================================
  Stopwatch: {
    props: z.object({
      autoStart: z.boolean().nullable().describe('Begin counting up on first render (default false — the user presses Start).'),
      format: clockFormat,
      precision: z
        .enum(['seconds', 'centiseconds'])
        .nullable()
        .describe('Readout resolution: seconds (default) · centiseconds (adds ".cs", ticks ~10×/s — use for lap-timing).'),
      showControls: z.boolean().nullable().describe('Show the Start / Pause / Reset buttons (default true).'),
      showLaps: z.boolean().nullable().describe('Show a Lap button + the recorded lap list (default false).'),
      laps: z
        .array(z.number())
        .nullable()
        .describe(
          'The recorded lap times in ms, mirrored back here into spec.state so a Button/handler can read the captured laps; bindable — bind with {$bindState}.',
        ),
      tone: Tone.describe('Semantic color of the readout: neutral (default) · success · warning · critical · info.'),
      accent: colorSchema.describe('Brand color for the primary Start button + lap markers (default the primary token).'),
      mutedColor: colorSchema.describe('Secondary/muted colour — the lap list, paused hint, and control-button chrome (default the muted-foreground token).'),
      size: Size.describe('Overall readout scale: sm · md (default) · lg · xl.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 12, max: 96 }).describe('Exact readout font-size (e.g. 48px / 3rem). Overrides the `size` enum, which is the default.'),
      // CONTENT / i18n — frozen English strings, each defaulting to the current literal.
      startLabel: z.string().nullable().describe('Start/Resume button label (default "Start"). Escaped text — set for i18n.'),
      pauseLabel: z.string().nullable().describe('Pause button label (default "Pause"). Escaped text.'),
      resetLabel: z.string().nullable().describe('Reset button label (default "Reset"). Escaped text.'),
      lapLabel: z.string().nullable().describe('Text on the Lap button that records the current split time (default "Lap"). Escaped text — set for i18n or to relabel the split action.'),
    }),
    description:
      'A stopwatch that counts up from zero, with a mm:ss / hh:mm:ss readout (optional centisecond precision), Start / Pause / Reset controls, and an optional Lap list. SSR-safe: renders 0 on the server, then ticks on the client; elapsed time is ephemeral and never written back to the spec. Emits `commit` on each Lap. Bind `laps` with `{ $bindState }` so the agent (or a sibling control) can read the captured lap times (ms) from spec.state.',
    example: { showLaps: true, precision: 'centiseconds' },
    events: ['commit'],
    eventsDoc: {
      commit: 'The Lap button was pressed; params carry { index, elapsedMs } (index is the 1-based lap number, elapsedMs the total elapsed at that lap).',
    },
  },
};
