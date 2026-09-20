# PermissionMatrix

A role × capability permission grid: each cell is a tri-state toggle (allow / deny / inherit) that cycles on click, with column/row-header bulk apply, a legend, optional role descriptions and a sticky header. Owns the matrix in state and emits a fully-populated intent on every change. Escaped text; the cell value is a closed enum; SSR-safe; capped at 200×40. Bind `values` with `{ $bindState }` so the agent (or a sibling control) can read the live edited role×capability matrix (each cell allow|deny|inherit) from spec.state.

## Example

```json
{
  "root": "permission-matrix",
  "elements": {
    "permission-matrix": {
      "type": "PermissionMatrix",
      "props": {
        "roles": [
          {
            "key": "admin",
            "label": "Admin"
          },
          {
            "key": "editor",
            "label": "Editor"
          },
          {
            "key": "viewer",
            "label": "Viewer"
          }
        ],
        "capabilities": [
          {
            "key": "read",
            "label": "Read"
          },
          {
            "key": "write",
            "label": "Write"
          },
          {
            "key": "delete",
            "label": "Delete"
          },
          {
            "key": "admin",
            "label": "Manage"
          }
        ],
        "values": [
          [
            "allow",
            "allow",
            "allow",
            "allow"
          ],
          [
            "allow",
            "allow",
            "deny",
            "inherit"
          ],
          [
            "allow",
            "deny",
            "deny",
            "deny"
          ]
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `roles` | `({ key: string, label: string, description: string })[]` | The rows (roles/plans); each is { key, label?, description? }. Omit for a demo. |
| `capabilities` | `({ key: string, label: string, description: string })[]` | The columns (capabilities/features); each is { key, label?, description? }. Omit for a demo. |
| `values` | `(("allow" \| "deny" \| "inherit")[] \| Record&lt;string, "allow" \| "deny" \| "inherit">)[]` | The role×capability matrix (also the bindable live value): an array of state arrays (aligned to capabilities) OR objects keyed by capability.key. Omit for an all-"inherit" matrix. Values ∈ allow\|deny\|inherit. Bind this to spec.state and it is mirrored on every cell toggle/bulk/Save so an external Button can read the edited permissions. |
| `states` | `"tristate" \| "binary"` | Cell states: tristate (allow/deny/inherit, default) or binary (allow/deny only). |
| `disabledCells` | `({ role: string, capability: string })[]` | Cells that cannot be edited (rendered dimmed, skipped by bulk). |
| `editable` | `boolean` | Allow toggling cells + bulk apply (default true). Set false for a read-only matrix (clicking still emits select). |
| `allowBulk` | `boolean` | Allow bulk apply by clicking a column/row header (default true). |
| `showLegend` | `boolean` | Show the allow/deny/inherit legend (default true). |
| `showSave` | `boolean` | Show a "Save permissions" button that emits one commit snapshot of the whole matrix (values + the changed cells) on demand (default false). Use it as the internal submit path when no external Button reads the bound values. |
| `saveLabel` | `string` | Text shown on the Save button when showSave is on (default "Save permissions"). |
| `showRoleDescriptions` | `boolean` | Show each role's description under its label (default false). |
| `stickyHeader` | `boolean` | Keep the capability header row visible while scrolling (default true). |
| `allowColor` | `string` | The "allow" state colour, used on both sides at once: it is the TEXT COLOUR of the ✓ glyph in each allowed cell and in the legend, and at 10% strength it is also that cell's background wash, so the tick reads against a tint of itself over the card surface. Default the success token. |
| `denyColor` | `string` | The "deny" state colour, used on both sides at once: it is the TEXT COLOUR of the ✕ glyph in each denied cell and in the legend, and at 10% strength it is also that cell's background wash, so the cross reads against a tint of itself over the card surface. Default the danger token. |
| `accent` | `string` | Interaction colour. As a BACKGROUND it fills the "Save permissions" button, whose label is always the card token, so it has to stay dark enough to carry that label (it falls back to the foreground token there, not the primary one). As a TEXT COLOUR it paints a role row-header on hover. It also draws the selected-cell ring and every focus ring, which are lines. |
| `headerTextColor` | `string` | Header text color (default the muted-foreground token). |

## Events

### change

A cell was toggled; params carry { role, capability, value, previous, rowIndex, columnIndex }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

A bulk apply OR a Save-permissions press. On bulk: { reason: "bulk-column"|"bulk-row", state (the applied allow|deny|inherit), key (the header clicked), keyKind ("role" when reason=bulk-row, else "capability"), cells (the resolved changed cells, each { role, capability, value }), count }. On save: { reason: "save", values: the full current matrix, changed: [{ role, capability, value, rowIndex, columnIndex }] for every dirty cell, count }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### select

A cell was focused/clicked; params carry { role, capability, value, label }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
