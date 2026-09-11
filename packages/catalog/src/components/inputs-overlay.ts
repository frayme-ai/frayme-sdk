/**
 * Frayme inputs-overlay — 2 render-only input/overlay surfaces built on the
 * established "truly-dynamic" foundation (matches forms-extended.ts byte-for-byte
 * in style).
 *
 * RENDER-ONLY (non-negotiable): these are GENERATIVE-UI components rendered in a
 * sandboxed MCP iframe from an UNTRUSTED spec. They render state, they never
 * perform privileged side effects. FileUpload shows a dropzone + a props/state-
 * driven file list and emits an event on selection — it NEVER reads or uploads
 * file contents. CommandPalette renders an inline command surface from props — no
 * portal, no real navigation. Interactivity = bindings (two-way value) + emitted
 * events; the host wires the handlers.
 *
 * Channel legend (mirrors _shared.ts): E enum · C content · SC safeColor (VALUE)
 * · D dimension (VALUE). Every enum/value prop is `.nullable()` + `.describe()`
 * (one sentence naming WHEN to reach for it);
 * defaults live in the renderer's CVA `defaultVariants`, NOT here, so a
 * props-less spec still renders polished. Closed enums only — never z.string()
 * for a visual/behavioral selector.
 */

import { z } from 'zod';
import { BorderStyle, Motion, Shadow, colorSchema, dimensionSchema } from './_shared.js';

export const inputsOverlayComponents = {
  // =========================================================================
  // FileUpload — a drag-drop / click upload ZONE. RENDER-ONLY (never auto-uploads):
  // it renders a dropzone + a props/state-driven file list, and on pick it READS
  // the chosen files and emits 'commit' with each file's metadata + a capped
  // data-URI so the host/agent actually receives what the user selected.
  // =========================================================================
  FileUpload: {
    props: z.object({
      accept: z
        .string()
        .nullable()
        .describe('Accepted file types (e.g. "image/*,.pdf") — shown as a hint AND set as the input `accept` attribute. Reach for it to constrain the picker.'),
      multiple: z.boolean().nullable().describe('Allow selecting more than one file (sets `multiple` on the input).'),
      maxSize: z
        .string()
        .nullable()
        .describe('Display-only size hint (e.g. "10MB"); rendered under the call-to-action. Not enforced — render-only.'),
      label: z.string().nullable().describe('The call-to-action line (default "Drag & drop or click to upload").'),
      hint: z.string().nullable().describe('Secondary muted line under the label (e.g. "Up to 5 files").'),
      icon: z
        .string()
        .nullable()
        .describe('Glyph name shown in the zone (default "upload"); unknown names render nothing.'),
      lockExisting: z
        .boolean()
        .nullable()
        .describe('Lock every file supplied via `files` (as if each carried locked:true): no remove × on prior uploads while new picks stay open — the evidence/document-packet shape ("submitted documents stay on file"). UI-level enforcement only — the host still validates.'),
      files: z
        .array(
          z.object({
            name: z.string().describe('File name shown in the list row.'),
            size: z.string().nullable().describe('Display-only size string (e.g. "2.4MB").'),
            status: z
              .enum(['uploading', 'done', 'error'])
              .nullable()
              .describe('Row status: uploading (spinner) · done (check) · error (alert).'),
            progress: z
              .number()
              .nullable()
              .describe('Upload progress 0–100 (clamped) → a 2px accent bar under the row. Omit/null for no bar (byte-identical). Typically paired with status:"uploading".'),
          }),
        )
        .nullable()
        .describe('Initial file list to seed the component (e.g. already-uploaded files). The component OWNS the list from here: picked files are appended and the remove × deletes rows. Each row shows name, optional size, a status indicator, and an optional progress bar.'),
      selectedFiles: z
        .array(
          z.object({
            name: z.string().describe('File name of a currently-picked file.'),
            size: z.string().nullable().describe('Display-only size string of the picked file (e.g. "2.4MB").'),
            status: z
              .enum(['uploading', 'done', 'error'])
              .nullable()
              .describe('Row status of the picked file: uploading · done · error.'),
            progress: z.number().nullable().describe('Upload progress 0–100 (clamped) of the picked file, or null.'),
          }),
        )
        .nullable()
        .describe('Bindable live list of the files the user has currently picked (name + size + status + progress). Mirrored back into (bindable) spec.state on every pick and every remove-× so an external Submit button can read the current file set — bind with { $bindState } for two-way. Distinct from `files` (one-way initial seed).'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Dropzone height, padding, and font size together (default md). Reach for `sm` for a compact inline attach control and `lg` for a prominent full-width upload panel.'),
      disabled: z.boolean().nullable().describe('Grey out the zone (60% opacity, not-allowed cursor) and block opening the native file picker (default false).'),
      accent: colorSchema.describe('Hover / keyboard-focus border + ring color of the zone (default primary token). There is no drag-over highlight state.'),
      borderColor: colorSchema.describe('The resting dashed border color (default border token).'),
      borderStyle: BorderStyle.describe('Dropzone border line style — solid · dashed · dotted (default dashed).'),
      bg: colorSchema.describe('Fill color of the dropzone interior (default the muted token). Name a brand color to tint the zone; the dashed edge reads `borderColor`, not this.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the hint line, the accept/size hint, the per-file size annotations, the zone upload icon (resting; hover keeps `accent`), the per-file-row leading icon, and the uploading spinner (default the muted-foreground token).'),
    }),
    events: ['commit', 'dismiss'],
    eventsDoc: {
      commit:
        'The user picked one or more files in the native picker; fires ONCE after all reads resolve with params { files, count }. `files` is an array of { name, size (bytes), type (MIME), lastModified (epoch ms), dataUrl } — dataUrl is a base64 data-URI for files at/under ~1MB (directly actionable) or null for larger files (metadata still delivered). `count` is files.length. This carries the actual picked artifact; the host does NOT need a separate upload flow to read small files.',
      dismiss:
        'A per-file remove × was pressed; the component OWNS the list so the row IS removed from the UI, and params carry { index, name, label, count } (the removed row position + name + the remaining file count).',
    },
    description:
      'Click-to-upload zone: a dashed zone wrapping a native file picker (drag-drop is NOT handled — dropping a file onto the zone does nothing). On pick it READS the chosen files and emits `commit` once with { files:[{ name, size, type, lastModified, dataUrl }], count } — dataUrl holds a base64 data-URI for files at/under ~1MB and null above the cap; it never auto-uploads. It also renders a props/state-driven list of selected files (name, size, status, optional progress bar, and a remove ×) and emits `dismiss` when a row × is pressed. Drive the list via the `files` prop; bind on.commit to receive the picked files and on.dismiss to wire removal. Bind `selectedFiles` with `{ $bindState }` so the agent (or a sibling control) can read the live list of currently-picked files (name + size + status + progress) from spec.state.',
    example: { label: 'Drag & drop or click to upload', accept: 'image/*,.pdf', maxSize: '10MB' },
  },

  // =========================================================================
  // CommandPalette — a cmd-k fuzzy action launcher rendered as an INLINE
  // command surface (no portal/modal-trap; SSR-safe). Filters items by the
  // query and emits 'select' on an item click.
  // =========================================================================
  CommandPalette: {
    props: z.object({
      placeholder: z.string().nullable().describe('Search-header empty hint (default "Type a command or search…").'),
      groups: z
        .array(
          z.object({
            heading: z.string().nullable().describe('Optional muted group heading.'),
            items: z
              .array(
                z.object({
                  label: z.string().describe('The command label (also what the query filters against).'),
                  icon: z.string().nullable().describe('Optional leading glyph name; unknown names render nothing.'),
                  shortcut: z.string().nullable().describe('Optional right-aligned keyboard shortcut hint (e.g. "⌘K").'),
                  value: z.string().describe('The value emitted on select (the host routes it).'),
                }),
              )
              .describe('The commands in this group.'),
          }),
        )
        .describe('Command groups, each an optional heading + a list of items. The required content of the palette.'),
      value: z.string().nullable().describe('Current query string. Use { $bindState } for two-way binding.'),
      selected: z.string().nullable().describe('The highlighted command’s value. Follows the user’s click/hover; bind with { $bindState } to read which command fired.'),
      emptyText: z.string().nullable().describe('Message when nothing matches the query (default "No results").'),
      accent: colorSchema.describe('Active/highlighted item color (the highlighted match; default primary token).'),
      bg: colorSchema.describe('Fill color of the command surface (default the card token). Set it to match a themed shell; the outer edge/dividers read `borderColor`, not this.'),
      borderColor: colorSchema.describe('Surface chrome border color — the outer border, the search-header divider, and the shortcut kbd-chip border (default border token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the group headings, the empty "No results" state, the shortcut hints, the search icon + placeholder, and the per-item leading icons (default the muted-foreground token).'),
      menuWidth: dimensionSchema({ units: ['px', 'rem', '%'], max: 900 }).describe('Explicit width of the command surface (e.g. "32rem"; default 100% of its container). Set a fixed value to cap the palette at a comfortable reading width instead of stretching full-bleed.'),
      maxHeight: dimensionSchema({ units: ['px', 'rem'], max: 1200 }).describe('Scroll cap on the results list (e.g. "20rem"; the list scrolls beyond it).'),
      shadow: Shadow.describe('Elevation of the floating command surface — none · sm · md · lg · xl (default sm). Reach for a larger value to make the palette read as lifted above the page.'),
      motion: Motion.describe('Enter-transition speed for the command surface (fast/normal/slow). Default: no animation — the palette appears instantly.'),
      emitOnChange: z
        .boolean()
        .nullable()
        .describe(
          'Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.',
        ),
    }),
    events: ['change', 'search', 'select'],
    eventsDoc: {
      change: 'The search input text changed; fires alongside search on the same keystroke; params carry { value } (the new query text). Only fires when emitOnChange !== false.',
      search: 'The search input text changed; fires alongside change on the same keystroke; params carry { query } (the new query text). Only fires when emitOnChange !== false.',
      select: 'A command item was clicked or activated with Enter/Space; params carry { value, label } (the item\'s value + label).',
    },
    description:
      'Cmd-k fuzzy action launcher rendered as an INLINE command surface (no portal, SSR-safe). Renders a search header + grouped command items, filters items by a case-insensitive substring of the query, and emits select on an item click. Full keyboard navigation: ArrowDown/ArrowUp move the highlighted command through the filtered list (wrapping) and Enter activates it (aria-activedescendant tracks the active row). Use { $bindState } on value for two-way binding; bind on.select for the handler.',
    example: {
      placeholder: 'Type a command or search…',
      groups: [{ heading: 'Actions', items: [{ label: 'New file', icon: 'plus', shortcut: '⌘N', value: 'new-file' }] }],
    },
  },
};
