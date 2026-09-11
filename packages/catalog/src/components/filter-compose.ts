/**
 * Frayme filter-compose — 4 schemas for faceted filtering + a rich composer.
 *
 * Same truly-dynamic contract as the shipped catalog: bounded ENUM atoms from
 * `_shared.ts` (the bounded menu a spec draws from) + the two validated VALUE channels
 * (`colorSchema` for color; the dimension channel where a real length is wanted).
 * Every enum/value prop is `.nullable()` + `.describe()` (one sentence naming WHEN
 * to reach for it); defaults live in the
 * renderer's CVA `defaultVariants`, so a props-less spec still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE).
 *
 * Components: FilterBar · FacetList · FilterPanel · RichComposer.
 *
 * INTERACTIVITY (the catalog-wide rule #9): every interactive surface stays live
 * WITHOUT a binding — internal `useState` (removed chips, show-more, section
 * collapse) or `useLocalOrBound` (search value, selected facets, composer text).
 * `emit(...)` is an ADDITIONAL host signal, never the only effect.
 *
 * RichComposer is a secure WYSIWYG contentEditable editor (Salesforce Rich Text
 * Area-style): a contentEditable surface + a formatting toolbar driven by the
 * browser's execCommand. It is secure for untrusted specs — a spec-supplied value
 * is inserted as PLAIN TEXT (never innerHTML), paste is coerced to plain text,
 * links are URL-guarded, and the output is sanitised to a small tag allowlist.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

/* The composer toolbar tools — a CLOSED menu of markdown wrappers. Avoids any
 * collision with the gate value-key names (width, height, gap, columns, length). */
const ComposerTool = z.enum([
  'bold', 'italic', 'underline', 'strike',
  'h1', 'h2', 'h3',
  'link', 'image',
  'bullet', 'number',
  'code', 'inlineCode', 'quote', 'divider',
  'clear',
]);

/* The shared UI-for-Agents describe for the per-keystroke/per-toggle emit gate.
 * Kept as one constant so every component's `emitOnChange` prop reads identically.  >=40 chars, DEFAULT TRUE (backward-compatible). */
const EMIT_ON_CHANGE_DESC =
  'Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.';

export const filterComposeComponents = {
  // =========================================================================
  // FilterBar — a horizontal row of active filters + a search + a clear-all
  // =========================================================================
  FilterBar: {
    props: z.object({
      filters: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
            removable: z.boolean().nullable(),
          }),
        )
        .nullable()
        .describe('Active filters shown as chips (each: label, value, optional removable flag). A removable chip shows an × that drops it.'),
      searchPlaceholder: z.string().nullable().describe('Placeholder for the inline search input (default "Search…"). Omit `searchPlaceholder` AND give no filters to render just the search.'),
      searchValue: z.string().nullable().describe('Current search text (interactive out of the box; bind it for two-way sync). To make the search DO something locally, bind this with { $bindState } to a state path and bind a sibling DataTable `filterText` { $state } to the same path — typing then narrows the table rows live, no agent round-trip.'),
      activeFilters: z
        .array(z.string())
        .nullable()
        .describe('Bindable live set of chip values still shown (after removals). Mirrors the current active-filter set into (bindable) state so an external Apply button can read the whole bar via spec.state; two-way when bound.'),
      emitOnChange: z.boolean().nullable().describe(EMIT_ON_CHANGE_DESC),
      searchLabel: z.string().nullable().describe('Accessible label for the search input when no `searchPlaceholder` is set (default "Search"). Feeds aria-label — escaped text.'),
      showClear: z.boolean().nullable().describe('Show a "Clear all" action that resets the chips + search (default true when any chip is present).'),
      clearLabel: z.string().nullable().describe('Text + accessible label of the clear-all action (default "Clear all"). Set for localisation; escaped text.'),
      removeLabel: z.string().nullable().describe('Accessible label PREFIX for each removable chip × — the chip label is appended (default "Remove", e.g. "Remove Status: Open"). Escaped text.'),
      removeIcon: z.string().nullable().describe('Glyph NAME (closed icon registry) for the chip remove ×  (default "x"). Unknown/absent → the default ×. Never raw SVG.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height + chip/font size together (default md).'),
      accent: colorSchema.describe('Brand color for the chip fill + search focus ring. Names a specific brand color; unset chips render a neutral (muted) fill instead of a tint.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the search magnifier icon, the search placeholder, and the "Clear all" action (default the muted-foreground token).'),
    }),
    events: ['change', 'dismiss', 'search', 'commit'],
    eventsDoc: {
      change: 'The bar state moved (chip removed, cleared, or a search keystroke); params carry the FULL resolved state — {query} (current search text), {removed} (all removed chip values), and {activeFilters} (the chip values still shown). Read `activeFilters` for the live filter set. Only fires when `emitOnChange` !== false — set that false to receive the state on `commit`/`dismiss` instead of per keystroke.',
      dismiss: 'A chip’s × was clicked (params: {value} — that chip’s value) or the clear-all was pressed (params: {all: true}).',
      search: 'The search input received typing (fires per keystroke); params carry {query} — the current text. Suppressed when `emitOnChange` is false.',
      commit: 'The Apply button was pressed; params carry the FULL resolved bar state — {query, removed, activeFilters}. The submit path for reading the whole bar on demand (always fires regardless of `emitOnChange`).',
    },
    description:
      'A horizontal filter bar: removable active-filter chips, an inline search box, a clear-all, and an Apply button. Removing a chip or clearing is live without any binding (internal removed-set + search state); each also emits a host signal (`dismiss` on chip remove + clear-all, `search` + `change` on type unless `emitOnChange` is false, `commit` on Apply). Use above a results list/grid. Bind `activeFilters` with `{ $bindState }` so the agent (or a sibling control) can read the live set of chip values still shown from spec.state.',
    example: {
      filters: [
        { label: 'Status: Open', value: 'status:open', removable: true },
        { label: 'Owner: Me', value: 'owner:me', removable: true },
      ],
      searchPlaceholder: 'Search issues…',
    },
  },

  // =========================================================================
  // FacetList — a list of filter facets with counts + checkboxes (multi-select)
  // =========================================================================
  FacetList: {
    props: z.object({
      title: z.string().nullable().describe('Optional heading above the facet list (e.g. "Category").'),
      facets: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
            count: z.number().nullable(),
            checked: z.boolean().nullable(),
          }),
        )
        .nullable()
        .describe('The selectable facets (each: label, value, optional result count, optional initial checked). Counts are plain numbers, not visual dimensions.'),
      selected: z
        .array(z.string())
        .nullable()
        .describe('Currently-selected facet values — interactive out of the box; bind with `{ $bindState }` for two-way sync with the result set (mirrored into spec.state on every toggle so an external Apply button can read the whole selection).'),
      max: z
        .number()
        .nullable()
        .describe('Collapse to the first N facets behind a "Show more" toggle (a plain count, not a visual dimension). Omit to show all.'),
      showMoreLabel: z
        .string()
        .nullable()
        .describe('Label for the expand toggle when collapsed (default "Show {n} more", where {n} is the hidden count). Use the literal `{n}` placeholder to position the count; escaped text.'),
      showLessLabel: z
        .string()
        .nullable()
        .describe('Label for the collapse toggle when expanded (default "Show less"). Set for localisation; escaped text.'),
      accent: colorSchema.describe('Brand color for the checked checkbox fill (default primary token). Names a specific brand color.'),
      accentText: colorSchema.describe('Check-glyph colour ON the accent fill of a checked facet (default the primary-foreground token). Pair with a light `accent` so the tick stays visible.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the group title, each facet result count, and the show-more toggle (default the muted-foreground token).'),
      emitOnChange: z.boolean().nullable().describe(EMIT_ON_CHANGE_DESC),
    }),
    events: ['change'],
    eventsDoc: {
      change: 'A facet checkbox was toggled; params carry {value, toggled} — the FULL selected array after the toggle plus the facet value that flipped. Only fires when `emitOnChange` !== false; the selection stays live in (bindable) state regardless, so an external Button can read it via spec.state.',
    },
    description:
      'A multi-select facet list with optional result counts: each row is a labelled checkbox that toggles its value in the selected set (live without any binding) and emits `change`. Set `max` to collapse a long list behind a "Show more". Use one per facet group in a sidebar. Bind `selected` with `{ $bindState }` so the agent (or a sibling control) can read the live set of checked facet values from spec.state.',
    example: {
      title: 'Status',
      facets: [
        { label: 'Open', value: 'open', count: 24 },
        { label: 'In progress', value: 'in-progress', count: 8 },
        { label: 'Closed', value: 'closed', count: 132 },
      ],
    },
  },

  // =========================================================================
  // FilterPanel — a vertical panel grouping several collapsible facet sections
  // =========================================================================
  FilterPanel: {
    props: z.object({
      title: z.string().nullable().describe('Optional panel title shown at the top (e.g. "Filters").'),
      sections: z
        .array(
          z.object({
            heading: z.string(),
            facets: z
              .array(
                z.object({
                  label: z.string(),
                  value: z.string(),
                  count: z.number().nullable(),
                  checked: z.boolean().nullable(),
                }),
              )
              .nullable(),
            collapsed: z.boolean().nullable(),
          }),
        )
        .nullable()
        .describe('Facet groups (each: a heading, an optional facet list {label, value, count?, checked?}, and an optional initial-collapsed flag). Each header expands/collapses its section.'),
      accent: colorSchema.describe('Brand color for the checked checkbox fill across all sections (default primary token). Names a specific brand color.'),
      accentText: colorSchema.describe('Check-glyph colour ON the accent fill of a checked facet (default the primary-foreground token). Pair with a light `accent` so the tick stays visible.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the per-facet result counts and the section-header collapse chevrons across all sections (default the muted-foreground token).'),
      selections: z
        .record(z.string(), z.array(z.string()))
        .nullable()
        .describe('Bindable cross-section selection map (section heading → its checked facet values). Mirrors the accumulated multi-section selection into (bindable) state so an external Apply button can read the whole panel via spec.state; two-way when bound.'),
      applyLabel: z.string().nullable().describe('Label + accessible label of the internal Apply submit button that commits the full selection map (default "Apply filters"). Set for localisation; escaped text.'),
      emitOnChange: z.boolean().nullable().describe(EMIT_ON_CHANGE_DESC),
    }),
    events: ['change', 'commit'],
    eventsDoc: {
      change: 'A facet checkbox inside one of the sections was toggled; params carry {section, option, checked} — the section heading, the facet value, and its new state — PLUS the resolved selection: {selected} (that section’s full checked values after the toggle) and {selections} (a heading → checked-values map across ALL sections). Read `selections` for the complete current filter state. Only fires when `emitOnChange` !== false; the selection stays live in (bindable) state regardless.',
      commit: 'The Apply button was pressed; params carry {selections} — the FULL heading → checked-values map across all sections. The submit path for reading the complete panel selection on demand (always fires regardless of `emitOnChange`).',
    },
    description:
      'A vertical filter panel grouping several collapsible facet sections, plus an Apply button. Each section header toggles its facets (aria-expanded, live without any binding); toggling a facet emits `change` (unless `emitOnChange` is false) and Apply emits `commit` with the full selection. Use as the left rail of a search/results layout. Bind `selections` with `{ $bindState }` so the agent (or a sibling control) can read the cross-section selection map (section heading → checked facet values) from spec.state.',
    example: {
      title: 'Filters',
      sections: [
        { heading: 'Status', facets: [{ label: 'Open', value: 'open', count: 24 }, { label: 'Closed', value: 'closed', count: 132 }] },
        { heading: 'Priority', facets: [{ label: 'High', value: 'high', count: 6 }, { label: 'Low', value: 'low', count: 41 }], collapsed: true },
      ],
    },
  },

  // =========================================================================
  // RichComposer — a plain-text rich composer (textarea + markdown toolbar)
  // =========================================================================
  RichComposer: {
    props: z.object({
      value: z.string().nullable().describe('Composer content — sanitised rich-text HTML the editor produces (interactive out of the box; bind it for two-way sync). A spec-supplied value is inserted as PLAIN TEXT (never injected as HTML).'),
      placeholder: z.string().nullable().describe('Placeholder shown when the editor is empty (default "Write a message…").'),
      toolbar: z
        .array(ComposerTool)
        .nullable()
        .describe('Which formatting tools to show, in order, from [bold, italic, underline, strike, h1, h2, h3, link, image, bullet, number, code (block), inlineCode, quote, divider, clear]. Unknown entries are ignored; omit for a full-blown default set (all of the above).'),
      maxLength: z
        .number()
        .nullable()
        .describe('Maximum character count — shows a live counter that turns danger-red when the limit is exceeded (typing is not blocked). A plain count, not a visual dimension.'),
      submitLabel: z.string().nullable().describe('Text for the send button that fires `commit` (default "Send"). Set a context verb like "Comment" or "Post"; escaped text.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Editor + toolbar density together: sm · md (default) · lg. Sets the font size, toolbar button scale, and editor min-height (which the exact `minHeight` channel can override).'),
      minHeight: dimensionSchema({ units: ['px', 'rem'], min: 48, max: 480 }).describe('Exact min-height of the editor area (e.g. "160px" / "10rem"). Overrides the min-height set by the `size` enum, which is the default; font/toolbar density still follows `size`.'),
      disabled: z.boolean().nullable().describe('Grey out + block the toolbar, the editor, and submit (e.g. while a form section is locked). Parity with PromptInput.'),
      loading: z.boolean().nullable().describe('Show a spinner on the send button + block the toolbar/editor/submit while an in-flight submit is processing (sets aria-busy). Parity with PromptInput.'),
      accent: colorSchema.describe('Brand color for the send button fill + focus ring (default primary token). Names a specific brand color.'),
      accentText: colorSchema.describe('Text/icon colour ON the accent-filled send + link-apply buttons (default the primary-foreground token). Pair with a saturated `accent` to keep the label legible.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the formatting-toolbar buttons, the empty-state placeholder, and the character counter (default the muted-foreground token).'),
      emitOnChange: z.boolean().nullable().describe(EMIT_ON_CHANGE_DESC),
      readMode: z.boolean().nullable().describe('Enable a rendered read-only VIEW: after Send the composer flips to a formatted read view of the sanitised content with an Edit button to return; it also starts in read view when seeded with a `value`. Default false (stays editable after Send).'),
      editLabel: z.string().nullable().describe('Text for the Edit button shown in read mode (default "Edit"). Escaped text — only used when `readMode` is on.'),
    }),
    events: ['change', 'commit'],
    eventsDoc: {
      change: 'The editor content changed — typing, a toolbar format, a link apply, or a paste; params carry {value} — the sanitised HTML. Only fires when `emitOnChange` !== false; the sanitised value stays live in (bindable) state regardless, so an external Button can read it via spec.state.',
      commit: 'The send button was pressed; params carry {value} — the final sanitised HTML of the message.',
    },
    description:
      'A full-blown WYSIWYG rich-text composer (Salesforce Rich Text Area-style): a contentEditable surface + a deep formatting toolbar — bold/italic/underline/strike, H1–H3 headings, bulleted + numbered lists, quote, code block + inline code, link (URL), image (URL), horizontal divider, and clear — plus a send button. Active inline formats highlight as pressed. Secure for untrusted specs: a spec value is inserted as plain text, paste is coerced to plain text, links + image sources are URL-guarded, and the output is sanitised to a small tag allowlist on every change. Live without any binding; the sanitised HTML stays in (bindable) state, `commit` fires on send, `change` on edit.',
    example: {
      placeholder: 'Write a comment…',
      toolbar: ['bold', 'italic', 'underline', 'h2', 'link', 'image', 'bullet', 'number', 'code', 'inlineCode', 'quote', 'divider', 'clear'],
      submitLabel: 'Comment',
    },
  },
};
