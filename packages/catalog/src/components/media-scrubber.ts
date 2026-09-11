/**
 * Frayme MediaScrubber — a VISUAL-ONLY media timeline (Time-geometry).
 *
 * A horizontal bar showing a pre-computed waveform (or thumbnail-strip / flat track)
 * with a draggable playhead, a buffered/played fill and chapter markers. It does NOT
 * own or drive a real <video>/<audio> element (that variant is deliberately out — see
 * the media-control security rule); it EMITS seek/play intents for the host to act on.
 *
 * POSTURE: OWNS-THE-PLAYHEAD — seeds a local `pos` (seconds) from `currentTime`
 * (static props only), re-seeds on prop change, but the seed effect GUARDS on a
 * scrubbing ref so it never fights the finger. ONE stable track element carries the
 * pointer capture; the playhead + hover bubble are absolutely-positioned children
 * (never re-parented). pointercancel/lostpointercapture end the scrub (idempotent).
 *
 * SECURITY: consumes only NUMBERS (safeUnit/finite-guarded) + escaped labels;
 * waveform samples clamped + capped; colors via colorSchema→safeColor.
 *
 * Component: MediaScrubber.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

export const mediaScrubberComponents = {
  MediaScrubber: {
    props: z.object({
      duration: z.number().nullable().describe('Total media length in SECONDS — the full span of the track (default `100`); set to the real clip length so seek fractions map correctly.'),
      currentTime: z.number().nullable().describe('Current playhead position in seconds (default 0). The host updates this during playback; the scrubber follows.'),
      value: z.number().nullable().describe('The live seek position in seconds, held in (bindable) state so an external Button can read where the playhead is. Seeds from currentTime when unbound; bind it to expose the scrub position.'),
      buffered: z.number().nullable().describe('Buffered-up-to position in seconds (default none) — renders a secondary fill.'),
      waveform: z.array(z.number()).nullable().describe('Pre-computed waveform amplitudes 0..1 (or any positive scale, normalized). Omit for a flat track. Capped at 2000 samples.'),
      chapters: z.array(z.object({ id: z.string().nullable(), time: z.number(), label: z.string().nullable() })).nullable().describe('Chapter markers { id?, time (seconds), label? } placed along the axis. Capped at 200.'),
      playing: z.boolean().nullable().describe('Whether media is currently playing (default false) — sets the play/pause button state.'),
      showPlayButton: z.boolean().nullable().describe('Show the play/pause button that emits a play/pause `commit` intent (default `true`); hide it for a seek-only scrubber.'),
      showTime: z.boolean().nullable().describe('Show the "current / duration" time readout (default true).'),
      showThumbnails: z.boolean().nullable().describe('Reserve a taller track for a thumbnail strip look (default false).'),
      showSubmit: z.boolean().nullable().describe('Show an internal Submit button that emits `commit` with the current playhead position on demand (default false). Use it when no external Button reads the bound seek value.'),
      submitLabel: z.string().nullable().describe('Label for the internal Submit button when showSubmit is on (default "Seek"). Ignored unless showSubmit is true.'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      variant: z.enum(['waveform', 'bar', 'line']).nullable().describe('Track style: waveform (default; needs waveform data, falls back to bar) · bar (a solid fill track) · line.'),
      height: dimensionSchema({ units: ['px', 'rem'], min: 32, max: 160 }).describe('Height of the scrubber track / waveform area (default 3rem).'),
      accent: colorSchema.describe('Played fill + playhead color (default the primary token).'),
      trackColor: colorSchema.describe('Color of the unplayed portion of the track behind the playhead (default the `muted` token); set a token or hex to theme the base rail.'),
      bufferedColor: colorSchema.describe('Buffered fill color (default the muted-foreground token).'),
    }),
    description:
      'A visual media scrubber: a waveform / bar / line track with a draggable playhead, played + buffered fills, chapter markers, an optional play/pause button and a time readout. It does not drive a media element — it emits seek (`change`) and play/pause (`commit`) intents for the host. Owns the playhead position locally (seeded from currentTime); SSR-safe; one stable track carries the drag so no pointer-capture bugs. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the live seek position (playhead in seconds) from spec.state.',
    example: {
      duration: 214,
      currentTime: 62,
      buffered: 140,
      waveform: [0.2, 0.5, 0.8, 0.6, 0.9, 0.4, 0.7, 0.3, 0.85, 0.5, 0.6, 0.95, 0.4, 0.7, 0.55, 0.8, 0.3, 0.6, 0.9, 0.45, 0.7, 0.5, 0.65, 0.8],
      chapters: [{ id: 'c1', time: 0, label: 'Intro' }, { id: 'c2', time: 90, label: 'Verse' }, { id: 'c3', time: 160, label: 'Outro' }],
      variant: 'waveform',
    },
    events: ['change', 'commit', 'select'],
    eventsDoc: {
      change: 'The playhead was moved (drag-end or arrow key); params carry { time (seconds), fraction (0..1), timeLabel }. Only fires when emitOnChange !== false — otherwise the position lives in (bindable) state and is delivered on commit/submit.',
      commit: 'Either the play/pause button was pressed — params carry { action: "play"|"pause", playing (requested next state) } — OR the internal Submit button (showSubmit) settled the playhead — params carry { time (seconds), fraction (0..1), timeLabel }.',
      select: 'A chapter marker was clicked; params carry { id, index, time, label, fraction, timeLabel }.',
    },
  },
};
