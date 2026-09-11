/**
 * Frayme structure-flow — 4 schemas for sequence / progress / hierarchy:
 * Timeline · TimelineItem · Stepper · Tree.
 *
 * These ride the SAME established foundation as the shipped components: bounded
 * ENUM atoms from `_shared.ts` (the bounded menu a spec draws from) + the two
 * validated VALUE channels (`colorSchema` for color, the dimension channel where
 * a real length/count is wanted). Every enum/value prop is `.nullable()` +
 * `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants`, so a
 * props-less spec still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 *
 * INTERACTIVITY (the catalog-wide rule): Stepper `current` and Tree expand/select
 * stay LIVE without any spec binding — `current` flows through `useLocalOrBound`
 * (local React state when unbound, store-backed two-way when bound), Tree expand
 * is an internal `useState` Set and selection is `useLocalOrBound`. A clickable
 * step / a tree node click mutates that local state directly; `emit(...)` is an
 * ADDITIONAL host signal, never the only effect.
 *
 * VALUE-CHANNEL note: only `accent`/`dotColor` are real value channels here (they
 * are in the gate's COLOR_KEYS). `current`, `maxDepth`, `defaultExpandedDepth`
 * are plain numeric COUNTS that are NOT visual dimensions (an index / a tree
 * depth), so they stay `z.number().nullable()` — NOT routed through the dimension
 * channel.
 */

import { z } from 'zod';
import { colorSchema, Weight, Tracking } from './_shared.js';

/** Tone applied to a timeline dot / step marker (semantic intent, not a value). */
const ItemTone = z
  .enum(['neutral', 'success', 'warning', 'critical', 'info'])
  .nullable();

/** A single tree node, recursive on `children` (same shape). Kept lazy so the
 *  schema can reference itself; the renderer hard-caps the recursion depth. */
const treeNode: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    label: z.string(),
    icon: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
    children: z.array(treeNode).nullable().optional(),
  }),
);

export const structureFlowComponents = {
  // =========================================================================
  // Timeline — a sequence of events with dots + connectors
  // =========================================================================
  Timeline: {
    props: z.object({
      items: z
        .array(
          z.object({
            title: z.string(),
            time: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            icon: z.string().nullable().optional(),
            tone: ItemTone.optional(),
            color: colorSchema.optional().describe('Exact per-event dot color, overriding this event `tone` (a precise brand color). Falls back to `tone`/timeline `accent` when unset.'),
            active: z.boolean().nullable().optional(),
          }),
        )
        .nullable()
        .describe('The ordered events. Each: a title, an optional time/description, an optional icon NAME (closed registry — rendered inside the dot ONLY at size lg; at sm/md the dot is too small and the icon is ignored), a tone (or exact `color`) for its dot, and an `active` highlight flag.'),
      orientation: z
        .enum(['vertical', 'horizontal'])
        .nullable()
        .describe('Lay the events top-to-bottom (vertical, default) or left-to-right (horizontal). `align:alternate` applies only when vertical.'),
      align: z
        .enum(['left', 'alternate'])
        .nullable()
        .describe('Vertical layout: left (all events on one side of the line, default) · alternate (events zig-zag either side). Ignored when horizontal.'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Overall scale of the timeline — dot diameter, title text size, and the connector offsets that track them (default md). Item icons render inside the dot ONLY at lg.'),
      accent: colorSchema.describe('Color of the dots when an item has no `tone`/`color` (default a neutral muted tone — matching TimelineItem\'s own tone-less default — until set). Names a specific brand color.'),
      connectorColor: colorSchema.describe('Color of the connector line/rail between the event dots (default the border token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the per-item time and description lines (default the muted-foreground token).'),
      weight: Weight.describe('Font weight of the event titles (default medium; an `active` item is bolder unless this is set). Set to override the baked title weight.'),
      tracking: Tracking.describe('Letter-spacing of the event titles (default normal). Set to tighten or loosen the title tracking.'),
    }),
    description:
      'A vertical or horizontal sequence of events, each a dot on a connector line with a title, optional time/description, and icon. A dot uses its item `tone` color or the timeline `accent`; an `active` item is highlighted. Display-only — works with no binding.',
    example: {
      items: [
        { title: 'Order placed', time: '09:24', tone: 'success' },
        { title: 'Packed', time: '11:02', description: 'Left the warehouse.' },
        { title: 'Out for delivery', time: '14:18', active: true, tone: 'info' },
      ],
    },
  },

  // =========================================================================
  // TimelineItem — ONE standalone timeline entry (for composing a custom timeline)
  // =========================================================================
  TimelineItem: {
    props: z.object({
      title: z.string().describe('The entry headline — one short line (truncates), shown beside the optional `time`. Bolder when `active` is set.'),
      time: z.string().nullable().describe('Optional timestamp / meta line shown beside or under the title.'),
      description: z.string().nullable().describe('Optional supporting body text under the title (plain text — no markdown/HTML).'),
      icon: z.string().nullable().describe('Optional icon glyph NAME (from the closed icon registry (or a single emoji glyph, rendered as-is)) shown inside the dot. Unknown names render the plain dot.'),
      tone: ItemTone.describe('Semantic color of the dot (neutral default · success · warning · critical · info).'),
      active: z.boolean().nullable().describe('Emphasize this entry (ring + bolder title) — use for the current step.'),
      last: z.boolean().nullable().describe('Hide the trailing connector line below the dot — set on the final entry of a hand-composed timeline.'),
      dotColor: colorSchema.describe('Exact dot color, overriding `tone` (a precise brand color). Drives `--fr-timelineitem-dot`; the `active` emphasis ring follows it too.'),
      connectorColor: colorSchema.describe('Color of the trailing connector line below the dot (default the border token) — parity with Timeline `connectorColor` for hand-composed timelines.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the time line and the description body (default the muted-foreground token).'),
      weight: Weight.describe('Font weight of the entry title (default medium; an `active` entry is bolder unless this is set). Set to override the baked title weight.'),
      tracking: Tracking.describe('Letter-spacing of the entry title (default normal). Set to tighten or loosen the title tracking.'),
    }),
    slots: ['default'],
    description:
      'A single timeline entry — a dot (with optional icon), a connector line, and a title/time/description — for composing a custom timeline row by row. Set `last` on the final entry to drop the trailing connector. The default slot renders extra content under the body.',
    example: { title: 'Deployed to production', time: '2m ago', tone: 'success' },
  },

  // =========================================================================
  // Stepper — numbered step progress (interactive when clickable)
  // =========================================================================
  Stepper: {
    props: z.object({
      steps: z
        .array(
          z.object({
            label: z.string(),
            description: z.string().nullable().optional(),
            icon: z.string().nullable().optional(),
            tone: ItemTone.optional().describe('Per-step validation status that OVERRIDES the done/current/future look with a filled semantic marker + status glyph: critical → danger (an "x", for a failed/invalid step) · warning → amber (an "alert-triangle") · success → green (a "check") · info → blue (an "info"). Omit to keep the normal progress chrome. A toned step still shows its own `icon` if it set one.'),
          }),
        )
        .nullable()
        .describe('The ordered steps. Each: a label, an optional description, an optional icon NAME (shown instead of the number when not completed), and an optional `tone` marking a validation status (e.g. critical for a failed step).'),
      current: z
        .number()
        .nullable()
        .describe('The active step index (0-based). Stays live unbound (internal state); bind it to sync the active step across components. Completed steps (< current) show a check; future steps are muted. A plain index, not a visual dimension.'),
      orientation: z
        .enum(['horizontal', 'vertical'])
        .nullable()
        .describe('Lay the steps left-to-right (horizontal, default) or top-to-bottom (vertical).'),
      clickable: z
        .boolean()
        .nullable()
        .describe('Make each step a button that sets `current` to its index (locally, no binding needed) and emits `change`. Off by default (display-only progress).'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Overall scale of the stepper — marker diameter, number/label/description text size, and the connector offsets that track them (default md).'),
      accent: colorSchema.describe('Color of the completed/current markers and the filled connector segment (default primary token). Names a specific brand color.'),
      connectorColor: colorSchema.describe('Color of the INCOMPLETE progress chrome — the connector segment between not-yet-reached steps AND the un-reached marker rings (default the border token). The completed segment stays `accent`.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — each step description line AND the not-yet-reached (future) step labels (default the muted-foreground token).'),
      weight: Weight.describe('Font weight of the step labels (default medium). Set to override the baked label weight.'),
    }),
    events: ['change'],
    eventsDoc: {
      change: 'A step was clicked while `clickable` is on (also sets `current` locally); params carry {index, label} of the chosen step.',
    },
    description:
      'A numbered step-progress indicator. Completed steps (before `current`) show a check, the current step is highlighted (aria-current=step), and future steps are muted. A per-step `tone` marks a validation status (e.g. critical = a failed step, filled red with an ✕). When `clickable`, clicking a step sets `current` locally (works with no binding) and emits `change`.',
    example: {
      steps: [{ label: 'Account' }, { label: 'Profile' }, { label: 'Billing' }, { label: 'Done' }],
      current: 1,
      clickable: true,
    },
  },

  // =========================================================================
  // Tree — hierarchical expand/collapse tree (interactive)
  // =========================================================================
  Tree: {
    props: z.object({
      nodes: z
        .array(treeNode)
        .nullable()
        .describe('The root nodes. Each: a label, an optional icon NAME, an optional `value` (returned on select), and optional `children` of the same shape (nested any depth — capped by `maxDepth`).'),
      maxDepth: z
        .number()
        .nullable()
        .describe('Hard cap on nesting depth rendered (1–8, default 6). Nodes deeper than this are not rendered, bounding the recursion. A plain count, not a visual dimension.'),
      defaultExpandedDepth: z
        .number()
        .nullable()
        .describe('Expand all nodes down to this depth on first render (0 = all collapsed, default). Below it nodes start collapsed. A plain count, not a visual dimension.'),
      selectable: z
        .boolean()
        .nullable()
        .describe('Make node rows selectable: clicking a leaf/label sets the selected `value` (locally, no binding needed) and emits `select`. Off by default (expand/collapse only).'),
      value: z
        .string()
        .nullable()
        .describe('The selected node value, mirrored here into spec.state (works with {$bindState}) so an external control can read the current selection; falls back to the node label when the node has no value.'),
      expandedPaths: z
        .array(z.string())
        .nullable()
        .describe('The currently-expanded branch paths (dot-joined node indices, e.g. "0.1"), mirrored here into spec.state so an external control can read/restore the open/collapsed tree.'),
      emptyText: z
        .string()
        .nullable()
        .describe('Message shown when there are no nodes (default "No items"). Set to localise or contextualise the empty tree; escaped text.'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Row density — the vertical padding + label text size of every row: sm (dense file list, ~13px) · md (default, 14px) · lg (spacious doc nav, 16px).'),
      accent: colorSchema.describe('Color of the selected row — its text plus a soft 14% row fill (default primary token). Names a specific brand color.'),
      lineColor: colorSchema.describe('Color of the resting tree furniture — the expand/collapse chevrons and the node icon glyphs (default the muted-foreground token); no indent-guide lines are rendered. The selected row still uses `accent`.'),
    }),
    events: ['select', 'change'],
    eventsDoc: {
      select: 'A node row was clicked (or Enter/Space) while `selectable` is on; params carry {value} — the node `value`, falling back to its label.',
      change: 'A branch was expanded or collapsed (chevron click, ArrowRight/ArrowLeft, or Enter on a branch); params carry {expandedPaths, value} — the full resolved array of open node paths plus the currently selected value (or null).',
    },
    description:
      'A hierarchical expand/collapse tree. Branch rows toggle their children (aria-expanded); recursion is hard-capped by `maxDepth` and array-guarded at every level. When `selectable`, clicking a row selects its `value` locally (works with no binding) and emits `select`. role=tree / treeitem. Bind `value`, `expandedPaths` with `{ $bindState }` so the agent (or a sibling control) can read the current selection and the open/collapsed branch paths from spec.state.',
    example: {
      nodes: [
        {
          label: 'src',
          children: [
            { label: 'components', children: [{ label: 'Button.tsx' }, { label: 'Card.tsx' }] },
            { label: 'index.ts' },
          ],
        },
        { label: 'package.json' },
      ],
      defaultExpandedDepth: 1,
      selectable: true,
    },
  },
};
