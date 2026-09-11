/**
 * Frayme inputs-choice — 4 option-selection inputs built on the established
 * "truly-dynamic" foundation (matches forms-extended.ts byte-for-byte in style).
 *
 * These are the CHOICE controls that sit alongside the base form controls
 * (Input/Select/… in forms.tsx): a multi-choice select with removable chips, a
 * single-select typeahead, a free-form tag/chip entry, and an inline exclusive
 * segmented switch.
 *
 * Channel legend (mirrors _shared.ts): E enum · C content · SC safeColor (VALUE)
 * · D dimension (VALUE). Every enum/value prop is `.nullable()` + `.describe()`
 * (one sentence naming WHEN to reach for it);
 * defaults live in the renderer's CVA `defaultVariants`, NOT here, so a
 * props-less spec still renders polished. Closed enums only — never z.string()
 * for a visual/behavioral selector.
 *
 * RENDER-ONLY: these render selection state from an untrusted spec and emit a
 * pure-signal event; the host wires the handlers. They perform no privileged
 * side effects (no navigation, no fetch).
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

/** An { label, value } option row (the shared content shape for the menus). */
const optionSchema = z.object({
  label: z.string().describe('Human-readable option text shown in the list/chip.'),
  value: z.string().describe('The stable value committed when the option is chosen.'),
});

export const inputsChoiceComponents = {
  // =========================================================================
  // MultiSelect — multi-choice select that shows chosen items as removable
  // chips, with an open option menu (each selected option carries a check).
  // =========================================================================
  MultiSelect: {
    props: z.object({
      options: z
        .array(optionSchema)
        .describe('The selectable options ({ label, value }). Required content — the menu the user picks from.'),
      value: z
        .array(z.string())
        .nullable()
        .describe('The selected value strings. Use { $bindState } for two-way binding; toggling/removing rewrites this array.'),
      placeholder: z.string().nullable().describe('Hint shown in the control when nothing is selected (e.g. "Pick tags…").'),
      max: z.number().nullable().describe('Cap on the number of selections; options are blocked once reached.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height/font-size/padding token (default `md`); use `sm` in dense toolbars, `lg` for touch or roomy forms.'),
      searchable: z.boolean().nullable().describe('Show a filter input at the top of the menu to narrow the options.'),
      chips: z.boolean().nullable().describe('Render selections as removable chips inside the control (default true); when false, show a "N selected" summary.'),
      clearable: z.boolean().nullable().describe('Show a single clear-all × beside the chevron that deselects everything at once (default false). The × appears only when there is at least one selection.'),
      disabled: z.boolean().nullable().describe('Grey out the control (60% opacity, not-allowed cursor) and block toggling, removing chips, and opening the option menu (default false).'),
      accent: colorSchema.describe('Brand color for the control (default the primary token for the focus ring/checkmark/hover tint): the focus ring, the selected-option checkmark fill, the option hover/focus tint, and — when set with no `borderColor` — the resting control border (an explicit `borderColor` wins). Also tints the selection chips; unset chips render a neutral (muted) fill instead.'),
      accentText: colorSchema.describe('Text colour of the check glyph on the selected-option checkbox fill, paired with `accent` (default the primary-foreground token). Set when a light/custom accent needs dark on-fill ink.'),
      borderColor: colorSchema.describe('Resting border colour of the control, the open option-menu panel, and the in-menu filter input (default the border token). Wins over `accent` on the resting border when both are set.'),
      bg: colorSchema.describe('Background colour of the control AND the open option-menu panel (default the card token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — placeholder, the chevron, the "No options" empty state, and (when set) the in-menu filter placeholder (default the muted-foreground token).'),
      emptyText: z.string().nullable().describe('Override the empty/no-options message shown in the open menu (default "No options"). Escaped text — set to localise or reword it (e.g. "Nothing here").'),
      submitLabel: z.string().nullable().describe('When set, render an internal Apply/Confirm button under the control that emits `commit` with the full { value } selection on demand — the submit path for bound use without a separate external Button. Absent → no button (default).'),
      menuWidth: dimensionSchema({ units: ['px', 'rem', '%'], max: 720 }).describe('Explicit width of the open option menu (e.g. "20rem"; default matches the control).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the control surface (e.g. "12px" or "0.75rem"; default the frayme radius). Overrides the default rounding.'),
    }),
    events: ['change', 'dismiss', 'search', 'commit'],
    eventsDoc: {
      change: 'A menu option was toggled or a selected chip was removed; params carry { value, toggled, checked }.',
      dismiss: 'The clear-all × (when `clearable`) was pressed, deselecting everything; params carry { all: true, value: [] } (the now-empty selection).',
      search: 'The in-menu filter text changed (when `searchable`); params carry { query } — bind it to fetch/filter options.',
      commit: 'The internal Apply button (when `submitLabel` is set) was pressed; params carry { value } — the full committed selection on demand.',
    },
    description:
      'Multi-choice select that shows chosen items as removable chips plus an open option menu (selected options carry a check). Reach for it over a stack of checkboxes when the user picks several values from a longer list and you want the selection summarised inline. Use { $bindState } on value for two-way binding; toggling an option or removing a chip emits change; the optional clear-all × emits dismiss; an optional Apply button (submitLabel) emits commit with the full selection. Set `max` to cap picks (options lock once reached), `searchable` to add an in-menu filter, and `chips: false` to collapse selections into a "N selected" summary.',
    example: {
      options: [
        { label: 'Design', value: 'design' },
        { label: 'Engineering', value: 'eng' },
      ],
      placeholder: 'Pick teams…',
    },
  },

  // =========================================================================
  // Combobox — single-select typeahead / autocomplete. Filters options by the
  // typed query; optionally lets the user commit a typed value not in the list.
  // =========================================================================
  Combobox: {
    props: z.object({
      options: z
        .array(optionSchema)
        .describe('The autocomplete options ({ label, value }). Required content — filtered by the typed query.'),
      value: z.string().nullable().describe('The committed selected value. Use { $bindState } for two-way binding.'),
      placeholder: z.string().nullable().describe('Empty-input hint text shown before the user types (default none); keep it a short verb phrase, e.g. "Search a country…", that names what to look for.'),
      creatable: z.boolean().nullable().describe('Offer a "Create \"x\"" row so the user can commit a typed value not in the list.'),
      emitOnChange: z
        .boolean()
        .nullable()
        .describe('Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.'),
      loading: z.boolean().nullable().describe('Show a trailing spinner while options are being fetched.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height/font-size/padding token (default `md`); use `sm` in dense toolbars, `lg` for touch or roomy forms.'),
      disabled: z.boolean().nullable().describe('Grey out the input (60% opacity, not-allowed cursor) and block typing, opening the menu, and selecting an option (default false).'),
      accent: colorSchema.describe('Colour of the create-row TEXT and the selected row\'s check glyph, printed on the menu panel; also the focus ring and a 12% row hover/active tint (default the primary token).'),
      borderColor: colorSchema.describe('Resting border colour of the input box AND the open menu panel (default the border token). Wins over `accent` on the resting border when both are set.'),
      bg: colorSchema.describe('Input + menu background color (default card token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the input placeholder, the trailing chevron, the loading spinner, and the "No matches" empty state (default the muted-foreground token).'),
      emptyText: z.string().nullable().describe('Override the no-results message shown when the query matches no options (default "No matches"). Escaped text — set to localise or reword it.'),
      menuWidth: dimensionSchema({ units: ['px', 'rem', '%'], max: 720 }).describe('Explicit width of the open menu (e.g. "18rem"; default matches the input).'),
      maxHeight: dimensionSchema({ units: ['px', 'rem'], max: 600 }).describe('Scroll cap on the option menu (e.g. "16rem") before it scrolls.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the input surface (e.g. "12px" or "0.75rem"; default the frayme radius). Overrides the default rounding.'),
    }),
    events: ['change', 'search', 'commit'],
    eventsDoc: {
      change: 'An option was selected, or the "Create" row committed a typed value not in the list; params carry { value }.',
      search: 'The query text changed as the user typed; params carry { query }. Only fires when emitOnChange !== false — set emitOnChange false to hold the query in state and suppress the per-keystroke stream.',
      commit: 'The current input query was committed on Enter (with no menu selection) or on blur; params carry { value } — the on-demand submit of partial/typed input so an external Button can read it.',
    },
    description:
      'Single-select typeahead / autocomplete. The input holds the query; a filtered menu lists matching options (case-insensitive substring of label), with an optional "Create \"x\"" row when creatable. Use { $bindState } on value for the committed selection; selecting/creating emits change, typing emits search (gated by emitOnChange), Enter/blur commits the raw query.',
    example: {
      options: [
        { label: 'United Kingdom', value: 'uk' },
        { label: 'United States', value: 'us' },
      ],
      placeholder: 'Search…',
    },
  },

  // =========================================================================
  // TagInput — free-form chip/tag entry (Enter or comma adds a tag, Backspace
  // on an empty input removes the last). Existing tags render as removable chips.
  // =========================================================================
  TagInput: {
    props: z.object({
      value: z
        .array(z.string())
        .nullable()
        .describe('The current tags. Use { $bindState } for two-way binding; adding/removing rewrites this array.'),
      suggestions: z
        .array(z.string())
        .nullable()
        .describe('Optional autocomplete hints surfaced via a native datalist as the user types.'),
      max: z.number().nullable().describe('Cap on the number of tags; input is blocked once reached.'),
      placeholder: z.string().nullable().describe('Hint shown in the bare input when no tags are present (default none); keep it a short prompt, e.g. "Add a tag…", cueing the user to type-then-Enter.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Field height/font-size/padding token (default `md`); use `sm` in dense forms, `lg` for touch or roomy layouts.'),
      disabled: z.boolean().nullable().describe('Grey out the field (60% opacity, not-allowed cursor) and block adding or removing tags (default false).'),
      removable: z.boolean().nullable().describe('Show an × on each chip to remove it (default true).'),
      lockedTags: z
        .array(z.string())
        .nullable()
        .describe('Tags the end user cannot remove: chips matching these strings render without the × and Backspace skips them — system-applied labels ("KYC-verified", "auto-tagged") stay while the user adds their own. UI-level enforcement only — the host still validates.'),
      accent: colorSchema.describe('Focus-within ring colour (default the primary token); it also supplies the background tint of the tag chips together with those chips\' text colour, and — with no `borderColor` — tints the resting field border (an explicit `borderColor` wins). Unset chips render a neutral muted fill instead.'),
      borderColor: colorSchema.describe('Resting border color of the field (default border token). Wins over `accent` on the resting border when both are set.'),
      bg: colorSchema.describe('Field background colour behind the chips and input (default the card token; bindable safeColor). Set on tinted surfaces to blend the field into the surrounding card.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the bare input placeholder (default the muted-foreground token).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius of the field surface (e.g. "12px" or "0.75rem"; default the frayme radius). Overrides the default rounding.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'A tag was added (Enter/comma) or removed (chip × or Backspace); params carry { value, toggled, checked }.' },
    description:
      'Free-form chip/tag entry. Existing tags render as removable chips followed by a bare input; Enter or comma adds the trimmed tag (respecting max), Backspace on an empty input removes the last. Use { $bindState } on value for two-way binding; every add/remove emits change.',
    example: { placeholder: 'Add a tag…', value: ['design', 'ai'] },
  },

  // =========================================================================
  // SegmentedControl — inline exclusive option group (view/sort/density switch).
  // The selected option gets a raised pill; clicking selects + emits change.
  // =========================================================================
  SegmentedControl: {
    props: z.object({
      options: z
        .array(
          z.object({
            label: z.string().describe('Segment text (becomes the aria-label when iconOnly).'),
            value: z.string().describe('The value committed when this segment is selected.'),
            icon: z.string().nullable().describe('Optional leading glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (unknown → omitted).'),
          }),
        )
        .describe('The exclusive segments ({ label, value, icon? }). Required content.'),
      label: z
        .string()
        .nullable()
        .describe('Field label rendered above the track (default none). Set it whenever the control sits beside LABELLED fields — an unlabelled switch next to a labelled select is both ambiguous ("Morning/Afternoon" of what?) and a row that cannot line up, since its neighbour carries a label line and it does not.'),
      value: z.string().nullable().describe('The selected segment value. Use { $bindState } for two-way binding.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Track height/font-size/padding token (default `md`); use `sm` in dense toolbars, `lg` for touch or prominent switches.'),
      fullWidth: z.boolean().nullable().describe('Stretch the track to the container width with equal-width segments.'),
      iconOnly: z.boolean().nullable().describe('Show only the icon for each segment (label moves to aria-label).'),
      accent: colorSchema.describe('Background fill of the selected pill (default the card token — a raised neutral pill) and the ground `accentText` is read against; every segment\'s keyboard focus ring derives from it too (default the primary token).'),
      accentText: colorSchema.describe('Text color on the selected pill (default the foreground token; primary-foreground when `accent` is set, so a saturated fill keeps readable ink).'),
      trackColor: colorSchema.describe('Resting track colour behind the pills — the rounded rail the segments sit on (default the muted token).'),
      connectorColor: colorSchema.describe('Colour of the thin dividers between resting (unselected) segments (default the border token; suppressed beside the selected pill).'),
      disabled: z.boolean().nullable().describe('Grey out the whole track (60% opacity, not-allowed cursor) and block selecting any segment (default false).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe('Exact corner radius shared by the rail and the segment pills (e.g. "12px" or "0.75rem"; default the frayme radius). Overrides the default rounding.'),
    }),
    events: ['change'],
    eventsDoc: { change: 'A different segment was clicked/selected; params carry { value } (the newly selected segment\'s value).' },
    description:
      'Inline exclusive option group (a view/sort/density switch): a rounded track of segments where the selected one gets a raised pill (aria-pressed). Icons resolve against the closed registry. Use { $bindState } on value for two-way binding; clicking a segment emits change.',
    example: {
      options: [
        { label: 'List', value: 'list' },
        { label: 'Grid', value: 'grid' },
      ],
      value: 'list',
    },
  },
};
