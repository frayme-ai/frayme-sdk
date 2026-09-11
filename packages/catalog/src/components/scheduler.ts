/**
 * Frayme Scheduler — a professional day/week scheduler you can SCHEDULE on.
 *
 * Rides the shared TimeAxisGrid engine (runtime `_timegrid.ts`): a vertical hour
 * axis with one column per day/resource, events as duration-sized blocks that
 * split into side-by-side lanes on overlap, a live current-time line, and a full
 * interaction model — create, view, edit, delete, reschedule (drag), resize.
 *
 * STATE + ACTIONS (the declarative-safe way): the component holds the COMPLETE
 * event set in its own state, seeded from the `events` prop and re-seeded when the
 * prop changes (a host recompose). Every mutation updates that state so the change
 * shows instantly AND emits a fully-populated intent — `commit` (create), `change`
 * (edit), `move` (drag/resize), `dismiss` (delete), `select` (open) — for the host
 * to persist. It never mutates the stored spec directly.
 *
 * SECURITY: times pass `safeTimeMinutes`; the engine computes every
 * coordinate; the event set is count-capped (render-bomb guard); titles/subtitles/
 * descriptions render as ESCAPED text; per-event colors flow through `colorSchema`.
 *
 * Channel legend: E enum · C content · T time (validated NUMBER) · SC safeColor.
 *
 * Component: Scheduler.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

export const schedulerComponents = {
  Scheduler: {
    props: z.object({
      columns: z
        .array(
          z.object({
            label: z.string().describe('Column header — a day ("Mon") or a resource (a room / provider / channel).'),
          }),
        )
        .nullable()
        .describe('The day/resource columns, left to right; each is { label }. Defaults to a single "Today" column.'),
      events: z
        .array(
          z.object({
            id: z.string().nullable().describe('Stable id for the event, echoed in every action payload so the host can match it back. Auto-assigned if omitted.'),
            title: z.string().describe('Event title (escaped text).'),
            start: z.union([z.string(), z.number()]).describe('Start time: "HH:MM" (24h) or minutes-from-midnight (0..1440).'),
            end: z.union([z.string(), z.number()]).describe('End time: "HH:MM" or minutes-from-midnight; coerced to a minimum duration above start.'),
            column: z.number().nullable().describe('0-based index of the column this event belongs to (default 0).'),
            subtitle: z.string().nullable().describe('Secondary line shown on the block + in the popover (e.g. a location/attendee). Escaped text.'),
            description: z.string().nullable().describe('Longer details shown in the event popover only. Escaped text.'),
            color: colorSchema.describe('Accent color of this event block (default the primary token).'),
            locked: z.boolean().nullable().describe('End-user-immutable: THIS event cannot be dragged, resized, edited, or deleted — clicking it opens a read-only popover (select still fires). Set it when the REQUEST scopes what the user may change ("confirmed bookings stay fixed", "existing shifts are managed elsewhere"). UI-level enforcement only — the host still validates every intent.'),
          }),
        )
        .nullable()
        .describe('The events to place; each is { id?, title, start, end, column?, subtitle?, description?, color?, locked? }. Events with unparseable times are skipped. The component holds these in state and mutates them as the user schedules — except `locked` events, which stay exactly as supplied.'),
      value: z
        .array(
          z.object({
            id: z.string().nullable().describe('Stable id for the event, echoed in every action payload so the host can match it back.'),
            title: z.string().describe('Event title (escaped text).'),
            start: z.union([z.string(), z.number()]).describe('Start time: "HH:MM" (24h) or minutes-from-midnight (0..1440).'),
            end: z.union([z.string(), z.number()]).describe('End time: "HH:MM" or minutes-from-midnight.'),
            column: z.number().nullable().describe('0-based index of the column this event belongs to.'),
            subtitle: z.string().nullable().describe('Secondary line shown on the block + in the popover.'),
            description: z.string().nullable().describe('Longer details shown in the event popover only.'),
            color: colorSchema.describe('Accent color of this event block.'),
          }),
        )
        .nullable()
        .describe('Bindable ($bindState) mirror of the LIVE schedule: the component writes the full resolved event set here on every create/edit/move/delete, so an external Button can read the current schedule from spec.state without replaying the event stream. Seed it or leave it for the component to populate.'),
      startHour: z.number().nullable().describe('First hour shown at the top of the time axis, 0..23 (default 8); lower it for early-morning schedules so events are not clipped off the grid.'),
      endHour: z.number().nullable().describe('Last hour shown on the axis, 1..24 (default 18); coerced above startHour.'),
      hourHeight: z.number().nullable().describe('Pixel height of one hour row (default 48; clamped 28..120). Sets the grid’s overall height.'),
      hour12: z.boolean().nullable().describe('Show 12-hour clock labels ("9:00 AM") vs 24-hour ("09:00") on the axis + popover (default true = 12-hour).'),
      nowLine: z.boolean().nullable().describe('Show a live "current time" line across the grid (client-only; default true). Hidden when the current time is outside the window.'),
      editable: z.boolean().nullable().describe('Allow scheduling (default true): click an empty slot to CREATE (opens an inline editor), click an event to VIEW/EDIT/DELETE it in a popover, drag to RESCHEDULE, drag the bottom edge to RESIZE. Set false for a read-only grid (clicking an event still opens a read-only popover and emits `select`).'),
      lockExisting: z.boolean().nullable().describe('The ADD-ONLY permission shape: lock every event supplied via props (as if each carried locked:true) while empty-slot creation stays live — the end user can schedule NEW entries but cannot move, edit, or delete the existing ones. Use when the request grants create-but-not-modify rights ("crew can book new slots; confirmed appointments are read-only"). UI-level enforcement only — the host still validates every intent.'),
      snapMinutes: z.number().nullable().describe('Snap increment in minutes for create/drag (default 15; e.g. 30 for half-hour slots). 0 disables snapping.'),
      defaultDuration: z.number().nullable().describe('Length in minutes of an event created by clicking an empty slot (default 60).'),
      newEventTitle: z.string().nullable().describe('Title given to a click-created event before it is edited (default "New event"). Escaped text.'),
      showSubmit: z
        .boolean()
        .nullable()
        .describe('Show an on-demand "Save schedule" button in the footer that emits ONE commit carrying the full resolved event set (default false). Use it when the host wants a single whole-schedule snapshot instead of persisting each per-event intent.'),
      submitLabel: z.string().nullable().describe('Label for the whole-schedule submit button when showSubmit is on (default "Save schedule"). Escaped text.'),
      accent: colorSchema.describe('Default event-block color + the now-line color (default the primary token).'),
      gridColor: colorSchema.describe('Hour gridline + column divider color (default the border token).'),
      mutedColor: colorSchema.describe('Axis labels + column headers color (default the muted-foreground token).'),
    }),
    description:
      'A professional day/week scheduler: a vertical hour axis with one column per day or resource, events as duration-sized blocks that split into side-by-side lanes when they overlap, and a live current-time line. It holds the full event set in state — click an empty slot to create (with an inline editor), click an event to view / edit / delete it in a popover, drag to reschedule, and drag its bottom edge to resize. Every change renders instantly AND emits a fully-populated intent (commit / change / move / dismiss / select) for the host to persist. Times are "HH:MM" or minutes-from-midnight, validated and positioned proportionally. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the live event set (mirrored on every create/edit/move/delete) from spec.state. PERMISSION FIDELITY: when the request scopes what the end user may change, mirror it exactly — `locked` per event or `lockExisting` for add-only grids; these are UX-level locks, the host still validates every intent.',
    example: {
      columns: [{ label: 'Mon' }, { label: 'Tue' }, { label: 'Wed' }],
      startHour: 8,
      endHour: 18,
      events: [
        { id: 'standup', title: 'Standup', start: '09:00', end: '09:30', column: 0, subtitle: 'Team sync' },
        { id: 'design', title: 'Design review', start: '10:00', end: '11:30', column: 0, subtitle: 'Room 2', description: 'Review the new scheduler mockups with the design team.' },
        { id: 'oneone', title: '1:1 with Sam', start: '10:30', end: '11:00', column: 0 },
        { id: 'lunch', title: 'Lunch', start: '12:00', end: '13:00', column: 1, color: '#16a34a' },
        { id: 'focus', title: 'Focus block', start: '14:00', end: '16:00', column: 2, subtitle: 'Deep work' },
        { id: 'demo', title: 'Client demo', start: '15:30', end: '16:30', column: 1, subtitle: 'Zoom', color: '#f59e0b' },
      ],
    },
    events: ['select', 'commit', 'change', 'move', 'dismiss'],
    eventsDoc: {
      select: 'An event was opened (clicked without dragging); params carry the full event { id, title, subtitle, start, end, startTime, endTime, startLabel, endLabel, durationMinutes, column, columnLabel }.',
      commit: 'Either an empty slot was clicked to CREATE an event (params carry the full new event, same shape as `select`; the host adds it and recomposes) OR the opt-in "Save schedule" footer button was pressed (params carry { events, count } — the full resolved event set as a single whole-schedule snapshot).',
      change: 'An event was EDITED in the popover (title / time / subtitle) and saved; params carry the full updated event. The host should update it and recompose.',
      move: 'An event was dragged to RESCHEDULE or resized; params carry the full updated event (start/end changed, duration preserved on a move). The host should update it and recompose.',
      dismiss: 'An event was DELETED from its popover; params carry the removed event { id, title, start, end, column }. The host should remove it and recompose.',
    },
  },
};
