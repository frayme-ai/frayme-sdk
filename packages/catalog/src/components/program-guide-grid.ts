/**
 * Frayme ProgramGuideGrid (EPG) — a broadcast-style electronic program guide (Time-geometry).
 *
 * A fixed channel gutter on the left, a proportional HORIZONTAL time axis across the
 * top, and one timeline row per channel where each programme is a duration-sized cell
 * placed by start/end. Rides the TimeAxisGrid engine (spanBlocks + axisTicks).
 *
 * POSTURE: STATELESS pure-view — cell positions recompute from props each render via
 * spanBlocks; the only local state is the client-only now-line minute. No drag, no
 * pointer capture. Emits `select` when a programme is clicked.
 *
 * SECURITY: titles/labels render as ESCAPED text; times pass safeTimeMinutes;
 * per-programme color is INLINE (safeColor); channels/programs capped.
 *
 * Component: ProgramGuideGrid.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

export const programGuideGridComponents = {
  ProgramGuideGrid: {
    props: z.object({
      channels: z.array(z.object({ id: z.string().nullable(), label: z.string(), logo: z.string().nullable() })).nullable().describe('The channel rows { id, label, logo? }. Omit for a demo. Capped at 60.'),
      programs: z
        .array(z.object({ id: z.string().nullable(), channel: z.string(), title: z.string(), subtitle: z.string().nullable(), start: z.union([z.string(), z.number()]), end: z.union([z.string(), z.number()]), color: colorSchema }))
        .nullable()
        .describe('The programmes; each is { id?, channel (a channel id), title, subtitle?, start, end, color? }. start/end are "HH:MM" or minutes-from-midnight. Capped at 1000.'),
      startHour: z.number().nullable().describe('First hour shown on the time axis, `0..23` (default `6`); lower it for overnight/early listings, pair with `endHour`.'),
      endHour: z.number().nullable().describe('Last hour shown on the time axis, `1..24` (default `24`); narrow the `startHour..endHour` window to a prime-time slice.'),
      hourWidth: z.number().nullable().describe('Pixel width of one hour (default 120, clamped 40..400). Sets the scrollable timeline width.'),
      rowHeight: z.number().nullable().describe('Height of a channel row in px (default 56, clamped 32..120).'),
      tickStep: z.enum(['30', '60', '120']).nullable().describe('Spacing of the time-axis tick marks in minutes: `30`, `60`, or `120` (default `60`); use `30` for tighter granularity.'),
      hour12: z.boolean().nullable().describe('Use 12-hour (am/pm) time-axis labels instead of 24-hour (default true).'),
      nowLine: z.boolean().nullable().describe('Show a live current-time line (default true; hidden when outside the window).'),
      showChannelBar: z.boolean().nullable().describe('Show the left channel gutter with logos/labels (default `true`); set `false` for a timeline-only strip when channels are labelled elsewhere.'),
      accent: colorSchema.describe('Default programme color + now-line (default the primary token).'),
      gridColor: colorSchema.describe('Gridline + divider color (default the border token).'),
      mutedColor: colorSchema.describe('Axis labels + channel labels color (default the muted-foreground token).'),
      selectedId: z.string().nullable().describe('The id of the currently-selected programme; mirrored back here into (bindable) spec.state on every click so a Button can read which programme is selected. Bind with { $bindState }.'),
    }),
    description:
      'A broadcast EPG: a channel gutter on the left, a proportional horizontal time axis across the top, and one timeline row per channel with programmes as duration-sized cells and a live now-line. Times are "HH:MM" or minutes-from-midnight, validated and positioned proportionally. Stateless, SSR-safe; click a programme to emit `select`. Bind `selectedId` with `{ $bindState }` so the agent (or a sibling control) can read the id of the currently-selected programme from spec.state.',
    example: {
      channels: [{ id: 'bbc1', label: 'BBC One' }, { id: 'itv', label: 'ITV' }, { id: 'ch4', label: 'Channel 4' }],
      startHour: 18,
      endHour: 24,
      programs: [
        { id: 'p1', channel: 'bbc1', title: 'The News at Six', start: '18:00', end: '18:30' },
        { id: 'p2', channel: 'bbc1', title: 'Countryfile', subtitle: 'The Dales', start: '18:30', end: '19:30' },
        { id: 'p3', channel: 'bbc1', title: 'Match of the Day', start: '19:30', end: '21:00', color: '#16a34a' },
        { id: 'p4', channel: 'itv', title: 'Coronation Street', start: '18:00', end: '19:00' },
        { id: 'p5', channel: 'itv', title: 'Britain\'s Got Talent', start: '19:00', end: '21:00', color: '#f59e0b' },
        { id: 'p6', channel: 'ch4', title: 'Channel 4 News', start: '19:00', end: '20:00' },
        { id: 'p7', channel: 'ch4', title: 'Grand Designs', start: '20:00', end: '21:00' },
      ],
    },
    events: ['select'],
    eventsDoc: {
      select: 'A programme was clicked; params carry { id, channel, channelLabel, title, subtitle, start, end, startTime, endTime }.',
    },
  },
};
