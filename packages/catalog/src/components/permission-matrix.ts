/**
 * Frayme PermissionMatrix — a role × capability access grid of TRI-STATE toggles
 * (allow / deny / inherit) — the canonical "who can do what" control for RBAC /
 * feature-per-plan admin surfaces.
 *
 * POSTURE: OWNS-THE-SET editable via the shared useGridEditState engine (same as the
 * spreadsheet). Owns the matrix of tri-state tokens; cells cycle on click; row/column
 * headers bulk-apply. Emits a fully-populated intent in handlers (never inside an
 * updater); nothing is written back to the spec.
 *
 * SECURITY: labels/descriptions render as ESCAPED text; the cell value is a
 * CLOSED enum → static class; allow/deny colors via colorSchema→safeColor; capped at
 * 200 × 40.
 *
 * Component: PermissionMatrix.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

const rc = z.object({ key: z.string(), label: z.string().nullable(), description: z.string().nullable() });

export const permissionMatrixComponents = {
  PermissionMatrix: {
    props: z.object({
      roles: z.array(rc).nullable().describe('The rows (roles/plans); each is { key, label?, description? }. Omit for a demo.'),
      capabilities: z.array(rc).nullable().describe('The columns (capabilities/features); each is { key, label?, description? }. Omit for a demo.'),
      values: z
        .array(z.union([z.array(z.enum(['allow', 'deny', 'inherit'])), z.record(z.string(), z.enum(['allow', 'deny', 'inherit']))]))
        .nullable()
        .describe('The role×capability matrix (also the bindable live value): an array of state arrays (aligned to capabilities) OR objects keyed by capability.key. Omit for an all-"inherit" matrix. Values ∈ allow|deny|inherit. Bind this to spec.state and it is mirrored on every cell toggle/bulk/Save so an external Button can read the edited permissions.'),
      states: z.enum(['tristate', 'binary']).nullable().describe('Cell states: tristate (allow/deny/inherit, default) or binary (allow/deny only).'),
      disabledCells: z.array(z.object({ role: z.string(), capability: z.string() })).nullable().describe('Cells that cannot be edited (rendered dimmed, skipped by bulk).'),
      editable: z.boolean().nullable().describe('Allow toggling cells + bulk apply (default true). Set false for a read-only matrix (clicking still emits select).'),
      allowBulk: z.boolean().nullable().describe('Allow bulk apply by clicking a column/row header (default true).'),
      showLegend: z.boolean().nullable().describe('Show the allow/deny/inherit legend (default true).'),
      showSave: z.boolean().nullable().describe('Show a "Save permissions" button that emits one commit snapshot of the whole matrix (values + the changed cells) on demand (default false). Use it as the internal submit path when no external Button reads the bound values.'),
      saveLabel: z.string().nullable().describe('Text shown on the Save button when showSave is on (default "Save permissions").'),
      showRoleDescriptions: z.boolean().nullable().describe('Show each role\'s description under its label (default false).'),
      stickyHeader: z.boolean().nullable().describe('Keep the capability header row visible while scrolling (default true).'),
      allowColor: colorSchema.describe('The "allow" state colour, used on both sides at once: it is the TEXT COLOUR of the ✓ glyph in each allowed cell and in the legend, and at 10% strength it is also that cell\'s background wash — so the tick reads against a tint of itself over the card surface. Default the success token.'),
      denyColor: colorSchema.describe('The "deny" state colour, used on both sides at once: it is the TEXT COLOUR of the ✕ glyph in each denied cell and in the legend, and at 10% strength it is also that cell\'s background wash — so the cross reads against a tint of itself over the card surface. Default the danger token.'),
      accent: colorSchema.describe('Interaction colour. As a BACKGROUND it fills the "Save permissions" button, whose label is always the card token — so it has to stay dark enough to carry that label (it falls back to the foreground token there, not the primary one). As a TEXT COLOUR it paints a role row-header on hover. It also draws the selected-cell ring and every focus ring, which are lines.'),
      /* RENAMED. `headerColor` meant the header TEXT here and the header BACKGROUND on
         DataTable/ColumnHeader — one name, two opposite results. The majority sense
         (background) keeps the short name; this text sense moves to an explicit one.
         NO ALIAS: an alias would keep BOTH senses alive under the old name, which is
         the exact ambiguity this rename removes — the model would still see
         headerColor meaning two things. */
      headerTextColor: colorSchema.describe('Header text color (default the muted-foreground token).'),
    }),
    description:
      'A role × capability permission grid: each cell is a tri-state toggle (allow / deny / inherit) that cycles on click, with column/row-header bulk apply, a legend, optional role descriptions and a sticky header. Owns the matrix in state and emits a fully-populated intent on every change. Escaped text; the cell value is a closed enum; SSR-safe; capped at 200×40. Bind `values` with `{ $bindState }` so the agent (or a sibling control) can read the live edited role×capability matrix (each cell allow|deny|inherit) from spec.state.',
    example: {
      roles: [
        { key: 'admin', label: 'Admin' },
        { key: 'editor', label: 'Editor' },
        { key: 'viewer', label: 'Viewer' },
      ],
      capabilities: [
        { key: 'read', label: 'Read' },
        { key: 'write', label: 'Write' },
        { key: 'delete', label: 'Delete' },
        { key: 'admin', label: 'Manage' },
      ],
      values: [
        ['allow', 'allow', 'allow', 'allow'],
        ['allow', 'allow', 'deny', 'inherit'],
        ['allow', 'deny', 'deny', 'deny'],
      ],
    },
    events: ['change', 'commit', 'select'],
    eventsDoc: {
      change: 'A cell was toggled; params carry { role, capability, value, previous, rowIndex, columnIndex }.',
      commit: 'A bulk apply OR a Save-permissions press. On bulk: { reason: "bulk-column"|"bulk-row", state (the applied allow|deny|inherit), key (the header clicked), keyKind ("role" when reason=bulk-row, else "capability"), cells (the resolved changed cells, each { role, capability, value }), count }. On save: { reason: "save", values: the full current matrix, changed: [{ role, capability, value, rowIndex, columnIndex }] for every dirty cell, count }.',
      select: 'A cell was focused/clicked; params carry { role, capability, value, label }.',
    },
  },
};
