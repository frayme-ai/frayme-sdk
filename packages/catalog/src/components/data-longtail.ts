/**
 * Frayme data long-tail — power/utility components on the same
 * truly-dynamic foundation as the rest of the catalog.
 *
 * Same locked contract: bounded ENUM atoms (the bounded menu a spec draws from) + the
 * two validated VALUE channels (`colorSchema` for a color, `dimensionSchema` for
 * a length). Every enum/value prop is `.nullable()` + `.describe()` (one sentence
 * naming WHEN to reach for it); defaults live
 * in the renderer's CVA `defaultVariants` / a `?? default`, so a props-less spec
 * still renders polished.
 *
 * SECURITY (non-negotiable):
 *  - JsonView nodes, Menubar labels/shortcuts all render as ESCAPED React text —
 *    never markup. The model supplies content + numbers + validated colors; never
 *    a class, never a CSS-property string, never HTML.
 *  - A model-named color goes through `colorSchema` here → `styleVars` → a
 *    `--fr-<comp>-<role>` var read by a STATIC arbitrary class (token fallback).
 *  - A model-named dimension goes through `dimensionSchema` → a dim var.
 *  - Links (Menubar items) flow through `safeUrl` at the point of use.
 *
 * Channel legend: E enum · C content · N number · SC safeColor (VALUE) ·
 * D dimension (VALUE).
 *
 * Components: JsonView · Menubar · Fab · RelativeTime.
 * (The former DataGrid folded into DataTable — see components/data-table.ts.)
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Size, Tone, Density, BorderStyle, Shadow, IconName } from './_shared.js';

/* The bounded icon-name menu shared by Menubar items + the Fab. The canonical
 * vocabulary now lives in `_shared.ts` (`IconName`) so a new glyph family (e.g.
 * the weather set) is added once and every consumer picks it up; `.nullable()`
 * here keeps these props optional. The renderer resolves the name against the
 * closed icon registry; an unknown name simply renders no glyph. */
const iconName = IconName.nullable();

export const dataLongtailComponents = {
  // ===========================================================================
  // JsonView — a read-only, collapsible, ESCAPED JSON tree
  // ===========================================================================
  JsonView: {
    props: z.object({
      data: z.any().describe('Any JSON value (object / array / primitive). Rendered as an escaped, collapsible tree — never as markup.'),
      defaultExpandedDepth: z.number().nullable().describe('Tree depth expanded on first render (default 1). Deeper branches start collapsed.'),
      maxDepth: z.number().nullable().describe('Hard cap on rendered depth (default 8, hard-capped internally); nodes past it show "…".'),
      accent: colorSchema.describe('Color for object/array KEYS (default the primary token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the expand/collapse chevrons, tree punctuation, braces, child-count badges, and null/undefined tokens (default the muted-foreground token).'),
      showCount: z.boolean().nullable().describe('Show child-count badges on collapsed objects/arrays (e.g. "{ 4 }").'),
      copyable: z.boolean().nullable().describe('Show a small copy button in the top-right that copies the pretty-printed root value to the clipboard (default false; opt-in to avoid chrome by default).'),
      size: Size.describe('Overall font scale of the whole JSON tree (sm · md default · lg). Use `sm` for a dense inspector panel; overridden by the exact `fontSize` channel when set.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 9, max: 24 }).describe('Exact tree font-size (e.g. 13px / 0.9rem). Overrides the `size` enum, which is the default.'),
    }),
    description:
      'A read-only, collapsible JSON tree. `data` is any JSON value; objects/arrays are expandable nodes, primitives are colored escaped tokens. Recursion is hard-capped so a deep/cyclic-looking object cannot crash the render.',
    example: {
      data: { user: { name: 'Ada', roles: ['admin', 'editor'], active: true }, count: 3 },
      defaultExpandedDepth: 2,
      showCount: true,
    },
  },

  // ===========================================================================
  // Menubar — an app-style horizontal menu bar (File / Edit / View)
  // ===========================================================================
  Menubar: {
    props: z.object({
      menus: z
        .array(
          z.object({
            label: z.string().describe('The top-level menu label (e.g. "File").'),
            items: z
              .array(
                z.object({
                  label: z.string().nullable().describe('The menu item text (omit on a separator).'),
                  href: z.string().nullable().describe('Optional navigation target for the item (scheme-checked).'),
                  icon: iconName.describe('Optional leading glyph by name.'),
                  disabled: z.boolean().nullable().describe('Render the item greyed out + non-interactive.'),
                  separator: z.boolean().nullable().describe('Render a divider line instead of an item.'),
                  shortcut: z.string().nullable().describe('Keyboard hint shown right-aligned (e.g. "⌘S").'),
                })
              )
              .nullable()
              .describe('The dropdown items for this menu; each is { label?, href?, icon?, disabled?, separator?, shortcut? }.'),
          }),
        )
        .nullable()
        .describe('The top-level menus rendered left to right on the bar; each is { label, items[] } and opens a dropdown of its `items` on click (e.g. File · Edit · View). Omit for an empty bar.'),
      activeItem: z
        .string()
        .nullable()
        .describe('Write target for WHICH menu item the user selected: bind with { $bindState } and the renderer writes the selected item label (or its index) here before emitting `select`, so the host can attribute the selection. Emit-only when unbound.'),
      accent: colorSchema.describe('Color for the currently-OPEN top-level menu label (default the foreground token); closed labels and selected items are not tinted.'),
      borderColor: colorSchema.describe('Border colour for the whole menu chrome — the bar frame, the dropdown panel border, item separators, and shortcut-chip edges (default the border token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the item leading icons, keyboard shortcuts, and the empty "No items" line (default the muted-foreground token).'),
      size: Size.describe('Overall scale of the bar: sm · md (default) · lg. Sets the top-level label and dropdown-item text size + padding.'),
      dense: z.boolean().nullable().describe('Tighter vertical padding on the bar and dropdown items for a compact toolbar look (default false).'),
      // CONTENT / i18n — frozen English string, defaulting to the current literal.
      emptyText: z.string().nullable().describe('Override the message shown in a menu with no items (default "No items"). Escaped text — set for i18n.'),
    }),
    description:
      'An application-style horizontal menu bar (File / Edit / View). Each top-level label opens a dropdown of items (with optional icon, shortcut, separator, disabled). Items with an href navigate (scheme-checked). Bind `activeItem` with `{ $bindState }` so the agent (or a sibling control) can read which menu item was selected (its label or index) from spec.state.',
    example: {
      menus: [
        {
          label: 'File',
          items: [
            { label: 'New', shortcut: '⌘N', icon: 'plus' },
            { label: 'Save', shortcut: '⌘S', icon: 'save' },
            { separator: true },
            { label: 'Export', icon: 'download' },
          ],
        },
        { label: 'Edit', items: [{ label: 'Undo', shortcut: '⌘Z' }, { label: 'Redo', shortcut: '⇧⌘Z', disabled: true }] },
      ],
    },
    events: ['select'],
    eventsDoc: {
      select: 'A dropdown item without an `href` was clicked; params carry { value, label, index } (value/label are the item\'s `label`, index is its position within that menu\'s items).',
    },
  },

  // ===========================================================================
  // Fab — a floating action button with an optional speed-dial
  // ===========================================================================
  Fab: {
    props: z.object({
      icon: iconName.describe('The main button glyph, from the closed icon registry (or a single emoji glyph, rendered as-is) (default "plus"). Unknown/absent names fall back to plus.'),
      label: z.string().nullable().describe('Accessible label for the main button (default "Actions").'),
      actions: z
        .array(
          z.object({
            label: z.string().nullable().describe('The action label shown on its chip.'),
            icon: iconName.describe('The action glyph by name.'),
            tone: Tone.describe('Semantic color of the action button (default neutral).'),
          }),
        )
        .nullable()
        .describe('Speed-dial actions that fan out when the FAB is opened; each is { label?, icon?, tone? } and emits `commit`.'),
      activeAction: z
        .string()
        .nullable()
        .describe('Write target for WHICH speed-dial action the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting `commit`, so the host can attribute the action. Emit-only when unbound.'),
      position: z
        .enum(['bottom-right', 'bottom-left', 'top-right', 'top-left'])
        .nullable()
        .describe('Corner within the component’s own frame: bottom-right (default) · bottom-left · top-right · top-left.'),
      accent: colorSchema.describe('Main-button fill color (default the primary token).'),
      accentText: colorSchema.describe('Main-button glyph color, paired with `accent` (default the primary-foreground token).'),
      borderStyle: BorderStyle.describe('Line style of the surrounding frame: solid · dashed (default) · dotted.'),
      size: z.enum(['md', 'lg']).nullable().describe('Main-button diameter + glyph size: md (3rem button, default) · lg (3.5rem button, larger glyph).'),
      sizeValue: dimensionSchema({ units: ['px', 'rem'], min: 32, max: 80 }).describe('Exact main-button diameter — width + height (e.g. 56px / 3.5rem). Overrides the `size` enum, which is the default. Ignored (width becomes auto) when `extended`.'),
      extended: z.boolean().nullable().describe('Render Material’s extended FAB — a pill showing the `label` text beside the icon instead of a bare circle (default false). Requires a `label`; reuses the accent/accentText/shadow channels unchanged.'),
      shadow: Shadow.describe('Drop-shadow depth of the main button: none · sm · md · lg · xl (default the baked floating shadow).'),
    }),
    description:
      'A floating action button anchored to a corner of its own frame, with an optional speed-dial that fans actions out when opened. Each action emits `commit`. Positioned absolutely within the renderer’s frame (never fixed to the viewport). Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which speed-dial action was triggered (its label or index) from spec.state.',
    example: {
      icon: 'plus',
      label: 'Create',
      actions: [
        { label: 'New doc', icon: 'edit' },
        { label: 'Upload', icon: 'upload' },
        { label: 'Invite', icon: 'users', tone: 'info' },
      ],
    },
    events: ['commit'],
    eventsDoc: {
      commit: 'A speed-dial action chip was clicked (fires per-action, not on opening the dial); params carry { label, index }. If `actions` is empty, clicking the main button itself emits this with { label } instead of toggling the dial.',
    },
  },

  // ===========================================================================
  // RelativeTime — a self-updating "2h ago" / countdown "expires in 3:42"
  // ===========================================================================
  RelativeTime: {
    props: z.object({
      target: z
        .union([z.string(), z.number()])
        .describe('The reference time: an ISO date/time string OR an epoch-milliseconds number.'),
      mode: z
        .enum(['relative', 'countdown'])
        .nullable()
        .describe('relative (default, "2h ago" / "in 3 days") · countdown (ticks down to the target, clamps at "expired").'),
      format: z
        .enum(['short', 'long'])
        .nullable()
        .describe('Wording: short (default, "2h ago") · long ("2 hours ago").'),
      prefix: z.string().nullable().describe('Static text shown before the time (e.g. "Updated").'),
      suffix: z.string().nullable().describe('Static text appended after the rendered time/countdown (e.g. "(local)"). Omit for none.'),
      tone: Tone.describe('Semantic text color (default neutral; use `critical` for an expiring countdown).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the prefix/suffix labels and the unknown-time dash (default the muted-foreground token).'),
      // CONTENT / i18n — the relative-time vocabulary, each word defaulting to the
      // current English. Only the supplied keys are overridden; the rest stay English.
      labels: z
        .object({
          justNow: z.string().nullable().describe('The sub-5s-delta phrase for `format:long` only (default "just now"); the short format always renders a fixed "now".'),
          ago: z.string().nullable().describe('The word/affix for a past time (default "ago", appended after the duration, e.g. "2 hours ago").'),
          in: z.string().nullable().describe('The word/affix for a future time (default "in", prepended before the duration, e.g. "in 2 hours").'),
          expired: z.string().nullable().describe('The countdown-finished label (default "expired").'),
          second: z.string().nullable().describe('Long unit word for seconds (default "second"; pluralized by appending "s").'),
          minute: z.string().nullable().describe('Long unit word for minutes (default "minute").'),
          hour: z.string().nullable().describe('Long unit word for hours (default "hour").'),
          day: z.string().nullable().describe('Long unit word for days (default "day").'),
          week: z.string().nullable().describe('Long unit word for weeks (default "week").'),
          month: z.string().nullable().describe('Long unit word for months (default "month").'),
          year: z.string().nullable().describe('Long unit word for years (default "year").'),
        })
        .nullable()
        .describe('Override the relative-time vocabulary for localization. Each key defaults to the current English; supply only the ones you want to change. `in`/`ago` apply to BOTH short and long formats; the unit words and the long "just now" apply to `format:long` only (short mode uses fixed compact suffixes and "now").'),
    }),
    description:
      'A self-updating relative timestamp ("2h ago") or countdown ("expires in 3:42"). `target` is an ISO string or epoch ms. SSR-safe: renders a static initial string, then ticks on the client. The <time> element carries the machine-readable ISO `dateTime` and a hover `title` with the absolute (locale-formatted) time. An unparseable target renders a muted dash.',
    example: { target: '2026-06-25T09:00:00Z', mode: 'relative', prefix: 'Updated' },
  },
};
