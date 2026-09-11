/**
 * Frayme board-nav — 4 schemas for kanban boards + multi-level navigation.
 *
 * Rides the SAME established foundation as the
 * shipped catalog: bounded ENUM atoms from `_shared.ts` (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for color, the
 * dimension channel where needed). Every enum/value prop is `.nullable()` +
 * `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants`, so a
 * props-less spec still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE).
 *
 * Components: KanbanBoard · BoardColumn · KanbanCard · NavigationMenu.
 *
 * NOTE: the board is a DISPLAY board — there is no native drag (not
 * spec-expressible). A card carries an optional left/right MOVE affordance that
 * emits `move`, and a card body click emits `change`; the host routes both. The
 * NavigationMenu flyouts open via internal state (live without a binding), and
 * every leaf link is a scheme-guarded <a>.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, rowActionsSchema, Weight } from './_shared.js';

// URL-scheme guard (defense-in-depth alongside the renderer's runtime
// sanitization): reject specs carrying javascript:/data:/vbscript:/file: in a
// navigable href. Mirrors the helper in marketing-page.ts (kept local — no dep
// added). Control chars are stripped so `java\tscript:` can't slip past.
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeHref = (s: string): boolean =>
  !/^\s*(javascript|data|vbscript|file):/i.test(stripWhitespace(s));
const safeHref = z.string().refine(isSafeHref, 'href uses an unsafe URL scheme');

// A label tone for the small card chips — reuses the unified semantic vocabulary
// (`critical` IS the danger sense; there is no `danger`/`destructive`).
const labelTone = z.enum(['neutral', 'success', 'warning', 'critical', 'info']);

// One card's shape — shared by KanbanBoard's inline `columns[].cards[]` and the
// KanbanCard schema's own props, so there is a single card vocabulary.
const cardShape = z.object({
  id: z.string().nullable().describe('Stable card identifier echoed verbatim in the `change`/`move`/`commit` params so the agent resolves WHICH card was acted on without re-indexing by title. Set to the underlying record id.'),
  title: z.string(),
  description: z.string().nullable(),
  labels: z
    .array(
      z.object({
        text: z.string(),
        tone: labelTone.nullable(),
        color: colorSchema.describe('Exact per-chip color override — when set, paints THIS chip in this colour instead of its tone (default the tone color).'),
      }),
    )
    .nullable(),
  assignee: z.string().nullable(),
  meta: z.string().nullable(),
  locked: z
    .boolean()
    .nullable()
    .describe('This card never shows move arrows, even on a movable board — done/archived/confirmed cards stay in their lane while others move ("shipped orders don\'t leave Done"). UI-level enforcement only — the host still validates.'),
});

export const boardNavComponents = {
  // =========================================================================
  // KanbanBoard — a horizontal row of columns (display board)
  // =========================================================================
  KanbanBoard: {
    props: z.object({
      columns: z
        .array(
          z.object({
            title: z.string(),
            count: z.number().nullable(),
            accent: colorSchema,
            cards: z.array(cardShape).nullable(),
          }),
        )
        .nullable()
        .describe('The columns to render (each: title, optional count, optional header accent, and a cards list). Omit and pass BoardColumn children instead for full control.'),
      board: z
        .array(
          z.object({
            title: z.string(),
            cards: z.array(cardShape).nullable(),
          }),
        )
        .nullable()
        .describe('Bindable live board arrangement (each column: title + its cards). Bind this to spec.state so an external Button reads the CURRENT column→cards layout after moves without replaying every `move`; the board mirrors the arrangement here on each move. Usually bound, not literal.'),
      showSave: z
        .boolean()
        .nullable()
        .describe('Show an internal Save button under the board that emits `commit` with the full current arrangement — the on-demand submit path (default off; a data board is often read via the bound `board` state alone).'),
      saveLabel: z
        .string()
        .nullable()
        .describe('Label for the internal Save button when `showSave` is on (default "Save board"). A short verb phrase naming the commit action.'),
      rowActions: rowActionsSchema.describe('Per-CARD action buttons drawn in the footer of every card on the board — the way to put "reassign this driver" / "cancel this booking" ON the item it acts on instead of in one global form beside the board. Each { id, label?, icon?, variant?, confirm?, disabled? }; clicking emits `commit` { action:id, id, card, column, index, assignee, meta } — `id` is THAT card\'s own id, so the handler never has to re-derive which card was pressed. `icon` is a registry name; `variant` is the button colour (ghost/outline/primary/secondary/danger, default outline); `disabled` greys THIS action out (bind it to state so an action that already fired cannot fire twice). `confirm` gates THIS action with the shared modal and is ON BY DEFAULT — pass `confirm:false` for a genuinely benign action.'),
      gap: z
        .enum(['none', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Horizontal space between the columns: none · sm · md (default) · lg · xl. Widen to `lg`/`xl` for airier lanes; overridden by the exact `gapValue` channel when set.'),
      gapValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 96 }).describe(
        'Exact horizontal space between columns (e.g. 24px / 1.5rem). Overrides the `gap` enum, which is the default.',
      ),
      itemWidth: dimensionSchema({ units: ['px', 'rem'], min: 160, max: 560 }).describe(
        'Exact width of each column (e.g. 320px / 20rem). Default 18rem (no enum) — set this to widen or narrow the columns.',
      ),
      accent: colorSchema.describe('Default header accent applied to every column that does not set its own — the column title\'s TEXT COLOUR (default the foreground token) + the rule under the header (default the border token).'),
      cardBg: colorSchema.describe('Resting card surface (background) colour for every card on the board (default the card token). The resting/unselected card fill, not an accent.'),
      cardColor: colorSchema.describe('On-surface text colour for every card on the board — each card title + assignee-avatar initials (default the foreground token). Pair with `cardBg` so a dark card fill keeps readable titles; cascades to cards that do not set their own `color`.'),
      borderColor: colorSchema.describe('Resting card border colour for every card on the board (default the border token). The resting card outline, not the left accent rule.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour across the board — column count badges plus each card description, meta line, and move-affordance chevrons (default the muted-foreground token).'),
    }),
    slots: ['default'],
    events: ['change', 'move', 'commit'],
    eventsDoc: {
      change: 'A card body was clicked (open intent) in a data-driven board; params carry {card, column, index}.',
      move: 'A card’s left/right move button was pressed in a data-driven board (the board relocates the card itself); params carry {card, fromColumn, toColumn, fromIndex, toIndex}.',
      commit: 'EITHER a per-card `rowActions` button was pressed — params carry {action, id, card, column, index, assignee, meta}, where `action` is the action id and `id` is that card\'s own id — OR the internal Save button (shown when `showSave` is on) was pressed, params carrying {columns}, the full current arrangement. The presence of `action` distinguishes them.',
    },
    description:
      'A horizontal, side-scrolling row of kanban columns. Either pass a `columns` array (each with its own cards) OR a slot of BoardColumn children. Display board — cards move via the per-card affordance (emits `move`), a card body click emits `change`. There is NO native drag. Set `rowActions` to put an action button on EVERY card (the per-card idiom — "reassign this one", not one form for the whole board); its `commit` carries the pressed card\'s own id. Bind `board` with `{ $bindState }` so the agent (or a sibling control) can read the live column→cards arrangement after moves from spec.state. READ-ONLY boards show no move arrows: the left/right affordances render only when something consumes a move — `on.move` wired, `board` bound, or `showSave` on.',
    example: {
      columns: [
        { title: 'To do', count: 2, cards: [{ title: 'Draft launch post' }, { title: 'Wire MCP server' }] },
        { title: 'In progress', count: 1, cards: [{ title: 'Usage dashboard', assignee: 'PG', meta: '2d' }] },
        { title: 'Done', cards: [{ title: 'Component library' }] },
      ],
    },
  },

  // =========================================================================
  // BoardColumn — one kanban column (collapsible)
  // =========================================================================
  BoardColumn: {
    props: z.object({
      title: z.string().describe('The column header title — one short status/stage name (e.g. "In progress"). Also identifies the column in the `change` params.'),
      count: z.number().nullable().describe('Small count badge shown next to the title (e.g. how many cards). A plain count, not a visual dimension.'),
      accent: colorSchema.describe('Column header accent — the title\'s TEXT COLOUR (default the foreground token) + the rule under the header (default the border token). Names a specific brand color.'),
      collapsible: z
        .boolean()
        .nullable()
        .describe('Make the header a toggle that collapses/expands the column body (internal state — works without a binding).'),
      collapsed: z
        .boolean()
        .nullable()
        .describe('Bindable current collapsed state of the column body (distinct from `collapsible`, which merely enables the toggle). Bind this to spec.state so an external control can read or drive whether the column is collapsed; the header toggle mirrors it here. Optional — unbound, collapse still works via internal state.'),
      columnBg: colorSchema.describe('The column TRACK surface fill — the shell the cards sit on (default a subtle muted wash, bg-muted/40). Names a specific column background; this is the column lane, NOT the card fill (`cardBg`).'),
      emptyText: z
        .string()
        .nullable()
        .describe('Placeholder message shown in the column body when it has no cards (e.g. "No cards yet"). Omit for a bare empty column (the default). Escaped text.'),
      cardBg: colorSchema.describe('Resting card surface (background) colour for the cards in this column (default the card token). Cascades to KanbanCard children that do not set their own.'),
      cardColor: colorSchema.describe('On-surface text colour for the cards in this column — each card title + assignee-avatar initials (default the foreground token). Pair with `cardBg`; cascades to KanbanCard children that do not set their own `color`.'),
      borderColor: colorSchema.describe('Resting card border colour for the cards in this column (default the border token). Cascades to KanbanCard children that do not set their own.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the count badge beside the column title + the collapse caret (default the muted-foreground token).'),
    }),
    slots: ['default'],
    events: ['change'],
    eventsDoc: {
      change: 'The header was toggled while `collapsible` is on; params carry {column, collapsed} — the column title and the NEW collapsed state.',
    },
    description:
      'One kanban column: a header (title + optional count badge) over a vertical stack of KanbanCard children. Set `collapsible` to make the header a button that collapses the body, `columnBg` to recolor the lane, and `emptyText` for the no-cards placeholder. Place several inside a KanbanBoard slot. Bind `collapsed` with `{ $bindState }` so the agent (or a sibling control) can read or drive whether the column body is collapsed from spec.state.',
    example: { title: 'In progress', count: 3, collapsible: true },
  },

  // =========================================================================
  // KanbanCard — one card (move affordance + open)
  // =========================================================================
  KanbanCard: {
    props: z.object({
      id: z.string().nullable().describe('Stable card identifier echoed verbatim in the `change`/`move` params so the agent resolves WHICH card was acted on without re-indexing by title (safe when titles duplicate or are absent). Set to the underlying record id.'),
      title: z.string().describe('The card headline — one short line naming the work item (truncates). Also identifies the card in the `change`/`move` params.'),
      description: z.string().nullable().describe('Short supporting line under the title (plain escaped text — no markdown/HTML).'),
      labels: z
        .array(
          z.object({
            text: z.string(),
            tone: labelTone.nullable(),
            color: colorSchema.describe('Exact per-chip color override — when set, paints THIS chip in this colour instead of its tone (default the tone color).'),
          }),
        )
        .nullable()
        .describe('Small status chips along the top: each a {text, tone, optional color} (tone: neutral·success·warning·critical·info; set color to paint a single chip exactly).'),
      assignee: z.string().nullable().describe('Assignee name — shown as an initials avatar in the card footer.'),
      meta: z.string().nullable().describe('A short meta string in the footer (e.g. "3d" or "#42"). Display only.'),
      moveable: z
        .boolean()
        .nullable()
        .describe('Show left/right move buttons that emit `move` (the spec-expressible alternative to native drag, which is NOT supported).'),
      accent: colorSchema.describe('Left accent rule color on the card (default the border token). Names a specific brand color.'),
      bg: colorSchema.describe('Resting card surface (background) colour (default the card token). The resting/unselected card fill, not an accent.'),
      color: colorSchema.describe('On-surface text colour of the card — the title and the assignee-avatar initials (default the foreground token). Pair with `bg` so a dark card fill keeps a readable title; wins over the board/column `cardColor` cascade.'),
      borderColor: colorSchema.describe('Resting card border colour (default the border token). The resting card outline, not the left accent rule.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the card description, the footer meta line, and the move-affordance chevrons; the assignee-avatar fill follows it as a soft 15% tint (default the muted-foreground token; avatar defaults to the muted token).'),
      weight: Weight.describe('Font weight of the card title (default medium). Set to override the baked title weight.'),
      rowActions: rowActionsSchema.describe('Action buttons drawn in THIS card\'s footer — the per-card idiom on the slot-authored board (the KanbanBoard `rowActions` prop is the same contract for the data-authored one). Each { id, label?, icon?, variant?, confirm?, disabled? }; clicking emits `commit` { action:id, id, card, column, assignee, meta } with this card\'s own id. `confirm` is ON BY DEFAULT — pass `confirm:false` to opt out.'),
    }),
    slots: ['default'],
    events: ['change', 'move', 'commit'],
    eventsDoc: {
      change: 'The card body was clicked (open intent); params carry {id, card, assignee, meta} — the stable id (null if unset), the title, and the resolved assignee/meta so the agent can act without re-indexing by title.',
      commit: 'A `rowActions` button on this card was pressed; params carry {action, id, card, column, assignee, meta} — the action id plus this card\'s own id, so the handler acts on the right record without re-indexing by title.',
      move: 'A left/right move button was pressed while `moveable` is on; params carry {id, card, dir, assignee, meta} — the stable id (null if unset), the title, the direction ("left" | "right"), and the resolved assignee/meta. A standalone card cannot relocate itself — the host routes the move.',
    },
    description:
      'A single board card: a title, optional description, status label chips, an assignee avatar + meta line, and (when `moveable`) left/right move buttons that emit `move`. A click on the card body emits `change`. Set `rowActions` for per-card action buttons (emits `commit` with this card\'s id), or pass children to append your own controls into the card footer. Place inside a BoardColumn. Never carries native drag.',
    example: {
      title: 'Wire the MCP server',
      description: 'Multi-tenant SSE endpoint per workspace slug.',
      labels: [{ text: 'backend', tone: 'info' }, { text: 'blocked', tone: 'critical' }],
      assignee: 'Priya Gupta',
      meta: '#42',
      moveable: true,
      rowActions: [{ id: 'reassign', label: 'Reassign' }],
    },
  },

  // =========================================================================
  // NavigationMenu — multi-level nav with flyout submenus
  // =========================================================================
  NavigationMenu: {
    props: z.object({
      items: z
        .array(
          z.object({
            label: z.string(),
            href: safeHref.nullable(),
            icon: z.string().nullable(),
            active: z
              .boolean()
              .nullable()
              .describe('Mark THIS top-level entry as the current page — it renders in the `accent` color (semibold) and carries aria-current="page". Set on at most one entry (the active route).'),
            children: z
              .array(
                z.object({
                  label: z.string(),
                  href: safeHref.nullable(),
                  description: z.string().nullable(),
                  icon: z.string().nullable(),
                }),
              )
              .nullable(),
          }),
        )
        .nullable()
        .describe('Top-level nav entries. A plain entry is a link ({label, href, icon, active}); an entry WITH `children` becomes a toggle that opens a flyout of sub-items ({label, href, description, icon}). Set `active:true` on the current-page entry.'),
      orientation: z
        .enum(['horizontal', 'vertical'])
        .nullable()
        .describe('Bar direction: horizontal (top nav, default) · vertical (a sidebar-style menu).'),
      accent: colorSchema.describe('Accent TEXT COLOUR for the nav links — the link/trigger hover, the open flyout trigger incl. its chevron, AND the current-page (`active`) entry (default the foreground token). Names a specific brand color.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the sub-item description lines inside the flyout + the trigger chevron at rest (default the muted-foreground token).'),
      bg: colorSchema.describe('Background fill of the flyout submenu panel (default the card token). Pair with `borderColor` so a branded nav does not pop a default-white menu.'),
      borderColor: colorSchema.describe('Border colour of the flyout submenu panel (default the border token). Pair with `bg` for a branded flyout surface.'),
    }),
    events: ['select'],
    eventsDoc: {
      select: 'A nav link was clicked — a top-level leaf or a flyout sub-link; params carry {label, href, index}, plus {parent} (the top-level label) for sub-links.',
    },
    description:
      'A two-level navigation menu with flyout submenus. Each top-level item is a link, or — when it has `children` — a button (aria-haspopup/aria-expanded) that toggles a one-level flyout of sub-links (internal state, live without a binding; Escape or an outside click dismisses it). Leaf links are scheme-guarded <a>s; `select` is emitted on navigation. Use as the primary site/app nav.',
    example: {
      items: [
        { label: 'Home', href: '/' },
        {
          label: 'Products',
          children: [
            { label: 'API', href: '/api', description: 'Compose UI from natural language' },
            { label: 'Platform', href: '/platform', description: 'Ship MCP Apps to Claude' },
          ],
        },
        { label: 'Docs', href: '/docs', icon: 'home' },
      ],
    },
  },
};
