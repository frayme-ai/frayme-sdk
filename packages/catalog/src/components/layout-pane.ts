/**
 * Frayme layout-pane — 4 schemas for resizable panes + a windowed list + a
 * description list. Components whose value is in
 * the LAYOUT and the (hand-rolled, zero-dep) INTERACTION, not in heavy content.
 *
 * Same established foundation as every shipped component: bounded ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for
 * color, `dimensionSchema` for length/count). Every enum/value prop is
 * `.nullable()` + `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA
 * `defaultVariants` / guarded fallbacks, so a props-less spec still renders
 * polished.
 *
 * Channel legend: E enum · C content · D dimension (VALUE).
 *
 * Components: SplitPane · Resizable · VirtualList · DescriptionList.
 *
 * INTERACTION is hand-rolled with ZERO new deps:
 *   - SplitPane / Resizable drag → plain pointer events (setPointerCapture).
 *   - VirtualList windowing → scroll math (onScroll → visible slice + spacers).
 * Every interactive state stays live WITHOUT a binding (internal useState /
 * useLocalOrBound) — a control is never a dead affordance.
 *
 * RESERVED element-field names are NEVER used as a prop (`visible`/`on`/`type`/…).
 * The SplitPane split % is carried under the NON-reserved `splitPercent`.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Font, Leading, Tracking, Weight } from './_shared.js';

export const layoutPaneComponents = {
  // =========================================================================
  // SplitPane — two resizable panes with a draggable divider
  // =========================================================================
  SplitPane: {
    props: z.object({
      orientation: z
        .enum(['horizontal', 'vertical'])
        .nullable()
        .describe('Split axis: horizontal (default — two panes side-by-side, vertical divider) · vertical (stacked panes, horizontal divider).'),
      splitPercent: z
        .number()
        .nullable()
        .describe('Starting size of the FIRST pane as a percentage (10–90, default 50). Drag the divider to change it; a plain percentage, not a CSS dimension.'),
      minSize: z
        .number()
        .nullable()
        .describe('Minimum size of EITHER pane as a percentage (the drag clamps between this and 100−this; default 10). A plain percentage, not a CSS dimension.'),
      height: dimensionSchema({ units: ['px', 'rem', 'vh', '%'], max: 2000 }).describe('Height of the whole split container (e.g. "24rem" or "400px"; default 24rem). Drives `--fr-splitpane-h`.'),
      bordered: z.boolean().nullable().describe('Wrap the container in a rounded bordered card (default true).'),
      bg: colorSchema.describe('Background fill of the split container (default the card token). Names a specific brand color.'),
      color: colorSchema.describe('Text colour inside the panes (default the foreground token).'),
      borderColor: colorSchema.describe('Border colour of the container when `bordered` AND the resting pane divider, so both travel together (default the border token). The divider still turns primary on hover/drag.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the bordered container (e.g. "12px"; default the Frayme radius token). Only applies when `bordered`.'),
    }),
    slots: ['default'],
    events: ['move'],
    eventsDoc: {
      move: 'The divider was dragged (fires ONCE on pointer-release, not per move) or arrow-keyed; params carry {splitPercent} — the first pane’s final size, 10–90.',
    },
    description:
      'Two resizable panes (give it EXACTLY two children) separated by a draggable divider. Drag the divider (or focus it and use the arrow keys) to resize; the split stays live without any binding. Use for a list/detail or editor/preview layout.',
    example: { orientation: 'horizontal', splitPercent: 40 },
  },

  // =========================================================================
  // Resizable — a single panel the user resizes via an edge/corner handle
  // =========================================================================
  Resizable: {
    props: z.object({
      width: dimensionSchema({ units: ['px', 'rem', '%'], max: 2000 }).describe('Starting width (e.g. "320px" / "20rem"; default 320px). The drag handle adjusts it. Parsed to px (rem ≈ 16px); a "%" value is not parsed and falls back to the 320px default.'),
      height: dimensionSchema({ units: ['px', 'rem', 'vh'], max: 2000 }).describe('Starting height (e.g. "240px" / "15rem"; default 240px). The drag handle adjusts it when the axis allows. Parsed to px (rem ≈ 16px); a "vh" value is not parsed and falls back to the 240px default.'),
      axis: z
        .enum(['horizontal', 'vertical', 'both'])
        .nullable()
        .describe('Which dimension(s) the user can resize: horizontal (width only, default) · vertical (height only) · both (a corner handle).'),
      minWidth: dimensionSchema({ units: ['px', 'rem'], max: 2000 }).describe('Smallest width the horizontal drag can shrink the panel to (default 120px). Raise it to stop the user collapsing a sidebar past its usable content width.'),
      minHeight: dimensionSchema({ units: ['px', 'rem'], max: 2000 }).describe('Smallest height the vertical drag can shrink the panel to (default 80px). Raise it to keep a resizable preview/console tall enough to stay useful.'),
      bordered: z.boolean().nullable().describe('Wrap the panel in a rounded bordered card (default true).'),
      bg: colorSchema.describe('Background fill of the panel (default the card token). Names a specific brand color.'),
      color: colorSchema.describe('Text colour inside the panel (default the foreground token).'),
      borderColor: colorSchema.describe('Border colour of the panel when `bordered` (default the border token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the bordered panel (e.g. "12px"; default the Frayme radius token). Only applies when `bordered`.'),
      size: z
        .object({ w: z.number(), h: z.number() })
        .nullable()
        .describe('The current panel size as { w, h } in pixels. Bindable: the resized dimensions are mirrored here into (bindable) spec.state on every drag/arrow-key, so an external Button can read the panel size without replaying `move` events. Seeds the initial size when set.'),
    }),
    slots: ['default'],
    events: ['move'],
    eventsDoc: {
      move: 'The resize handle was dragged (fires ONCE on pointer-release, not per move) or arrow-keyed; params carry {width, height, axis} — the final size in px.',
    },
    description:
      'A single panel the user resizes by dragging an edge (or corner) handle. Put any content inside as the child. The size stays live without a binding — drag updates it via pointer events. Use to let the user widen a sidebar, panel, or preview box. Bind `size` with `{ $bindState }` so the agent (or a sibling control) can read the current panel dimensions ({ w, h } in pixels) from spec.state.',
    example: { axis: 'horizontal', width: '320px' },
  },

  // =========================================================================
  // VirtualList — a windowed (virtualized) scrollable list
  // =========================================================================
  VirtualList: {
    props: z.object({
      items: z
        .array(
          z.object({
            label: z.string(),
            description: z.string().nullable(),
            icon: z.string().nullable(),
            value: z.string().nullable(),
            trailing: z.string().nullable(),
          }),
        )
        .nullable()
        .describe('The list rows. Each: a label, an optional muted description, an optional leading icon NAME (closed registry), an optional value (used for selection), and an optional trailing text. Only the visible slice is rendered.'),
      itemHeight: z
        .number()
        .nullable()
        .describe('Fixed row height in pixels (default 44). Windowing needs a fixed height; if omitted every row renders. A plain px count, not a CSS dimension.'),
      maxHeight: dimensionSchema({ units: ['px', 'rem', 'vh'], max: 2000 }).describe('Height of the scroll viewport (e.g. "20rem"; default 20rem). The list scrolls inside it. Drives `--fr-vlist-h`.'),
      overscan: z
        .number()
        .nullable()
        .describe('Extra rows rendered above/below the visible window for smooth scrolling (default 4). A plain count.'),
      selectable: z
        .boolean()
        .nullable()
        .describe('Make rows clickable — clicking sets the selected value and emits `select` (default false).'),
      value: z
        .string()
        .nullable()
        .describe('The currently selected row value (the clicked row\'s `value`, falling back to its label). Mirrored back here into spec.state so it works with {$bindState} — bind it and an external control (e.g. a Submit Button) can read the current selection.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — each row description, the trailing meta text, the row leading icon, and the empty-state label (default the muted-foreground token).'),
      bg: colorSchema.describe('Background fill of the list viewport (default the card token). Names a specific brand color.'),
      color: colorSchema.describe('Primary text colour — each row label (default the foreground token).'),
      borderColor: colorSchema.describe('Border colour of the list viewport AND the dividers between rows, so both travel together (default the border token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner rounding of the list viewport (e.g. "12px"; default the Frayme radius token).'),
    }),
    events: ['select'],
    eventsDoc: {
      select: 'A row was clicked while `selectable` is on (also sets the selection locally); params carry {value, label} — the row `value`, falling back to its label.',
    },
    description:
      'A long list rendered with hand-rolled virtualization (only the visible rows are in the DOM, for performance). It scrolls inside a fixed-height viewport; with `selectable`, clicking a row selects it (live without a binding) and emits `select`. Use for big option/result lists. Bind `value` with `{ $bindState }` so the agent (or a sibling control) can read the currently selected row value from spec.state.',
    example: {
      items: [
        { label: 'Alpha', description: 'First item' },
        { label: 'Bravo', description: 'Second item' },
        { label: 'Charlie', description: 'Third item' },
      ],
      selectable: true,
    },
  },

  // =========================================================================
  // DescriptionList — key/value term-definition pairs (display-only)
  // =========================================================================
  DescriptionList: {
    props: z.object({
      items: z
        .array(z.object({ term: z.string(), description: z.string() }))
        .nullable()
        .describe('The term/definition pairs, rendered as semantic <dt>/<dd>. Plain text — no markdown/HTML.'),
      layout: z
        .enum(['stacked', 'inline', 'grid'])
        .nullable()
        .describe('Arrangement: stacked (term above value, default) · inline (term left, value right per row) · grid (multi-column term/value pairs).'),
      density: z
        .enum(['compact', 'normal', 'comfortable'])
        .nullable()
        .describe('Vertical spacing between term/definition pairs: compact · normal (default) · comfortable. Reach for `compact` on a dense spec sheet and `comfortable` for a roomy details panel.'),
      columns: z
        .number()
        .nullable()
        .describe('Number of columns when layout is grid (1–3, default 2). Ignored for stacked/inline. A grid track count.'),
      bordered: z
        .boolean()
        .nullable()
        .describe('Draw divider lines between rows (default false). Turn on to visually separate many pairs; the line color follows `borderColor`.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the term (<dt>) labels (default the muted-foreground token).'),
      color: colorSchema.describe('Primary text colour — the definition (<dd>) values (default the foreground token).'),
      borderColor: colorSchema.describe('Colour of the divider lines between rows when `bordered` (default the border token).'),
      font: Font.describe('Typeface for the whole description-list region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the term (<dt>) labels only — the definitions keep their own weight (light · normal · medium · semibold · bold; default medium).'),
      tracking: Tracking.describe('Letter-spacing of the whole list text — terms and definitions (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the whole list text — terms and definitions (tight · snug · normal · relaxed · loose; default the list default).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the whole list text — terms AND definitions together (e.g. "16px" / "1rem"). Default 0.875rem definitions / 0.8125rem terms.'),
    }),
    description:
      'A list of term → definition pairs rendered as a semantic <dl>/<dt>/<dd>. Pick stacked, inline, or grid layout. Display-only — use for metadata, spec sheets, or a details panel.',
    example: {
      items: [
        { term: 'Status', description: 'Active' },
        { term: 'Plan', description: 'Pro' },
        { term: 'Region', description: 'eu-west-2' },
      ],
      layout: 'inline',
    },
  },
};
