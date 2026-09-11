/**
 * Frayme LogConsole — a virtualized, severity-colored log viewer (Live-snapshot).
 *
 * Fixed-row virtualization for thousands of lines, per-line severity color from a
 * CLOSED level enum, ANSI escape codes STRIPPED to plain text (author ANSI never
 * becomes color or markup), a level/search toolbar, and client-side sticky
 * auto-scroll ("follow") with a "jump to latest" affordance. NO socket — the HOST
 * recomposes `lines`.
 *
 * POSTURE: STATELESS-VIEW over the snapshot + local view state (enabled levels,
 * query, wrap, follow, selection). The lines are derived-and-rendered each render
 * (parsed → ANSI-stripped → filtered, memoized); nothing is written back to the spec.
 *
 * SECURITY: stripAnsi at ingest (severity color comes ONLY from the `level`
 * enum, never author ANSI); all text ESCAPED; lines capped at 5000, each truncated
 * to 2000 chars; per-row highlight segments capped.
 *
 * Component: LogConsole.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

const lineSchema = z.union([
  z.string(),
  z.object({
    text: z.string(),
    level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).nullable(),
    timestamp: z.string().nullable(),
    source: z.string().nullable(),
  }),
]);

export const logConsoleComponents = {
  LogConsole: {
    props: z.object({
      lines: z.array(lineSchema).nullable().describe('The log lines snapshot; each is a plain string OR { text, level?, timestamp?, source? }. The host recomposes to append. ANSI codes are stripped. Capped at the newest 5000; each line truncated to 2000 chars.'),
      levels: z.array(z.enum(['debug', 'info', 'warn', 'error', 'fatal'])).nullable().describe('Which severity levels are shown initially (default all). The toolbar chips toggle them; the active set is mirrored into (bindable) state so an external Button can read the current severity filter.'),
      query: z.string().nullable().describe('The search query text, held in (bindable) state so an external Button can read the active filter without waiting for a per-keystroke `search` emit. Seeds the search box and stays in sync as the user types.'),
      follow: z.boolean().nullable().describe('Auto-scroll to the newest line as it arrives (default true); the current follow preference mirrors back into (bindable) state so an external Button can read whether auto-scroll is on. Pauses when the user scrolls up; a "jump to latest" pill re-enables it.'),
      showToolbar: z.boolean().nullable().describe('Show the level/search/wrap toolbar (default true).'),
      showTimestamps: z.boolean().nullable().describe('Show the per-line timestamp column when present (default true).'),
      wrap: z.boolean().nullable().describe('Wrap long lines instead of horizontal scroll (default false); the current wrap toggle mirrors back into (bindable) state so an external Button can read whether long-line wrapping is on.'),
      selectedIndex: z.number().nullable().describe('Zero-based index of the currently-selected log line; a line click writes the index here (mirrored into bindable state) so an external Button can read which line is selected. null = nothing selected.'),
      showSearch: z.boolean().nullable().describe('Show the search box for filtering log lines (default true).'),
      emitOnChange: z.boolean().nullable().describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      maxHeight: dimensionSchema({ units: ['px', 'rem'], min: 120, max: 900 }).describe('Max console height before the body scrolls (default 24rem).'),
      rowHeight: z.number().nullable().describe('Fixed row height in px for virtualization (default 20, clamped 16..40).'),
      accent: colorSchema.describe('Accent color of the active toolbar controls + jump pill (default the primary token).'),
      background: colorSchema.describe('Console surface background (default the card token).'),
    }),
    description:
      'A virtualized log console: thousands of lines with fixed-row virtualization, per-line severity color from a closed level enum, ANSI stripped to plain text, a level+search toolbar, wrap toggle, copy, and sticky auto-scroll (follow) with a "jump to latest" pill. Fed by a static snapshot the host recomposes (no socket). Escaped text; SSR-safe (renders top-anchored, jumps to the tail on mount). Bind `levels`, `query`, `follow`, `wrap`, `selectedIndex` with `{ $bindState }` so the agent (or a sibling control) can read the live view state from spec.state — `levels` holds the enabled severity filter, `query` the active search text, `follow` whether auto-scroll is on, `wrap` whether long lines wrap, `selectedIndex` the selected line index.',
    example: {
      lines: [
        { text: '[server] listening on :3005', level: 'info', timestamp: '12:00:01' },
        { text: 'GET /explorer 200 14ms', level: 'debug', timestamp: '12:00:02' },
        { text: 'cache miss for catalog.prompt()', level: 'warn', timestamp: '12:00:03' },
        { text: 'POST /v1/compose 200 3.4s', level: 'info', timestamp: '12:00:05' },
        { text: 'validateSpec: 1 unsafe color rejected', level: 'warn', timestamp: '12:00:06' },
        { text: 'Cold start took 41s', level: 'error', timestamp: '12:00:47' },
        { text: 'adapter loaded · frayme-0.17.1', level: 'info', timestamp: '12:00:48' },
      ],
    },
    events: ['search', 'change', 'select', 'commit'],
    eventsDoc: {
      search: 'The search query changed; params carry { query }. Only fires when emitOnChange !== false — otherwise the query lives in (bindable) state and is read on demand (e.g. via the copy `commit` or an external Button).',
      change: 'A view change: { name:"levels", value:string[] } · { name:"follow", value } · { name:"wrap", value }.',
      select: 'A line was clicked; params carry { index, text, level, timestampLabel, source }.',
      commit: 'The copy affordance was used; params carry { control:"copy", count, text (the joined copied lines), levels (currently-enabled severities), query (active search) } so the agent gets the exact copied content plus the filter context that produced it.',
    },
  },
};
