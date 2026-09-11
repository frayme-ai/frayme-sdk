/**
 * Frayme NotificationCenter — a read/unread inbox fed by a static snapshot (Live-snapshot).
 *
 * Category tabs with unread counts, per-item actions, mark-read / mark-all-read /
 * dismiss, an "unread only" filter, and a muted empty state. NO socket — the HOST
 * recomposes `items`; the "live" feel comes from re-seeding.
 *
 * POSTURE: OWNS-THE-SET-OVERLAY — the items snapshot is the CONTENT source of truth;
 * the component owns a LOCAL overlay of view state (readIds, dismissedIds, activeTab,
 * unreadOnly, openId). Re-seed on the items key resets read/dismiss/open but preserves
 * the user's tab + filter. Emits are in handlers, never inside a setState updater.
 *
 * SECURITY: title/body/labels render as ESCAPED text; tone is a CLOSED enum →
 * static class; colors via colorSchema→safeColor; items capped at 200.
 *
 * Component: NotificationCenter.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

export const notificationCenterComponents = {
  NotificationCenter: {
    props: z.object({
      items: z
        .array(
          z.object({
            id: z.string().nullable().describe('Stable id, echoed in every payload.'),
            title: z.string().describe('The notification title (escaped).'),
            body: z.string().nullable().describe('Optional body/detail line (escaped).'),
            category: z.string().nullable().describe('Category key this item belongs to (drives the tabs).'),
            timestampLabel: z.string().nullable().describe('Pre-formatted relative time (e.g. "2h ago"). Escaped text — the host formats it.'),
            unread: z.boolean().nullable().describe('Whether the item is unread (drives the dot + tab counts).'),
            tone: z.enum(['neutral', 'info', 'success', 'warning', 'critical']).nullable().describe('Semantic tone → the colored left rail + dot (default neutral).'),
            actions: z.array(z.object({ label: z.string(), value: z.string().nullable() })).nullable().describe('Optional action buttons on the item; each emits `commit`.'),
          }),
        )
        .nullable()
        .describe('The notifications snapshot; the host recomposes it. Each is { id, title, body?, category?, timestampLabel?, unread?, tone?, actions? }. Capped at 200.'),
      categories: z.array(z.object({ key: z.string(), label: z.string() })).nullable().describe('Explicit category tabs { key, label }. Omit to derive tabs from the distinct item categories.'),
      showTabs: z.boolean().nullable().describe('Show the category tab bar with per-tab unread counts (default `true`); set `false` for a single flat list when items span one category.'),
      showUnreadOnly: z.boolean().nullable().describe('Start with the "unread only" filter on (default false).'),
      markReadOnOpen: z.boolean().nullable().describe('Mark an item read when it is opened/clicked (default true).'),
      showMarkAll: z.boolean().nullable().describe('Show the "Mark all read" action that clears every unread dot at once (default `true`); hide it to force per-item reads.'),
      showSubmit: z
        .boolean()
        .nullable()
        .describe('Show an on-demand "Save inbox" button in the footer that emits ONE commit carrying the full overlay { readIds, dismissedIds, activeTab, unreadOnly } (default false). Use it when the host wants a single whole-inbox snapshot instead of persisting each per-item intent.'),
      submitLabel: z.string().nullable().describe('Label for the whole-inbox submit button when showSubmit is on (default "Save inbox"). Escaped text.'),
      readIds: z.array(z.string()).nullable().describe('Bindable ($bindState) mirror of the ids marked READ in this session; the component writes it on every read/mark-all toggle so an external Button can read the final read-set from spec.state without replaying every emit.'),
      dismissedIds: z.array(z.string()).nullable().describe('Bindable ($bindState) mirror of the ids DISMISSED in this session; the component writes it on each dismiss so the final dismissed-set is readable from spec.state without replaying every emit.'),
      activeTab: z.string().nullable().describe('Bindable ($bindState) mirror of the currently selected category tab key (or "all"); the component writes it on each tab switch so the current tab is readable from spec.state.'),
      unreadOnly: z.boolean().nullable().describe('Bindable ($bindState) mirror of the "unread only" filter toggle; the component writes it whenever the filter changes so its state is readable from spec.state.'),
      emptyLabel: z.string().nullable().describe('Message when there are no notifications (default "You\'re all caught up"). Escaped text.'),
      maxHeight: dimensionSchema({ units: ['px', 'rem'], min: 120, max: 800 }).describe('Caps the item list at this height and makes it a scroller, `px`/`rem`, clamped `120..800px` (an unparseable value falls back to `28rem`). OMIT it — the default — and the list does NOT scroll: every row renders in full. Name it (e.g. `28rem`) only when the inbox must fit a fixed-height panel.'),
      accent: colorSchema.describe('Accent color of the active tab + unread affordances (default the primary token).'),
      mutedColor: colorSchema.describe('Secondary color — timestamps, body, counts (default the muted-foreground token).'),
    }),
    description:
      'A read/unread notification inbox fed by a static snapshot: category tabs with unread counts, per-item action buttons, mark-read / mark-all-read / dismiss, and an "unread only" filter. The host recomposes the items (no socket). Owns the read/dismiss overlay locally and emits a fully-populated intent on every interaction. Escaped text, SSR-safe. Bind `readIds`, `dismissedIds`, `activeTab`, `unreadOnly` with `{ $bindState }` so the agent (or a sibling control) can read the live overlay from spec.state — `readIds` holds the ids marked read, `dismissedIds` the ids dismissed, `activeTab` the selected category tab key, `unreadOnly` the filter toggle.',
    example: {
      items: [
        { id: 'n1', title: 'Ada commented on your PR', body: '"This is much cleaner — ship it."', category: 'mentions', timestampLabel: '2m ago', unread: true, tone: 'info', actions: [{ label: 'View', value: 'view' }, { label: 'Reply', value: 'reply' }] },
        { id: 'n2', title: 'Deployment succeeded', body: 'Payments API · production', category: 'system', timestampLabel: '18m ago', unread: true, tone: 'success' },
        { id: 'n3', title: 'Build failed on frayme-dev', category: 'system', timestampLabel: '1h ago', unread: false, tone: 'critical', actions: [{ label: 'Retry', value: 'retry' }] },
        { id: 'n4', title: 'Grace invited you to Design Review', category: 'mentions', timestampLabel: '3h ago', unread: false, tone: 'neutral' },
      ],
    },
    events: ['select', 'commit', 'change', 'dismiss'],
    eventsDoc: {
      select: 'A notification was opened; params carry { id, title, body, category, timestampLabel, unread }.',
      commit: 'Either an item action button was pressed (params carry { id, title, category, actionValue, actionLabel }) OR the opt-in "Save inbox" footer button was pressed (params carry the full overlay snapshot { readIds, dismissedIds, activeTab, unreadOnly }).',
      change: 'A view change: { name:"read", id, value } · { name:"markAll", value:true, ids } · { name:"tab", value, label } · { name:"unreadOnly", value }.',
      dismiss: 'A notification was dismissed: single { id, title, category, index } or clear-all { all:true, ids }.',
    },
  },
};
