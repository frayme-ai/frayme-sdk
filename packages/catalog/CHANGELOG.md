# @frayme/catalog

## 0.4.1

- Prop descriptions corrected where they named a default the renderer does not have. These strings are the vocabulary a model composes against, so a wrong default teaches a wrong spec.
  - `accent` on the action family: the default is the neutral high-contrast fill, not the primary token.
  - `accentText` on the action family, and on `Link`: the on-fill ink defaults to the `card` token, which is the inverse of the fill in both light and dark, not the primary-foreground token.
  - `accent` on `Link` (`variant:button`): the default is the neutral high-contrast fill, matching `Button`.
  - `accent` on the field family: the default is the `accent` token, which is a neutral until a theme sets one.
  - `Button.variant`: `primary` is described as a solid neutral high-contrast fill. The `At most one primary per view` rule is unchanged.
- No schema, no enum and no validation behaviour changes.

## 0.4.0

- `CATALOG_VERSION` is now `frayme-0.19.0`.
- Action declarations may carry a `description`; `spec.actions[name].description` is read by the runtime for confirm dialogs, action events and receipts.
- `validateSpec` no longer reports reads of the runtime-written `/_ui/…` state mirror as dead pointers.
- Vocabulary: `DropdownMenu` emits `commit`; `KanbanBoard`/`KanbanCard` gained `rowActions` and `commit`; `DataTable` columns gained `format`/`prefix`/`suffix` and row/bulk actions gained `confirm`/`disabled`; `headerColor` → `headerTextColor` on `Table`, `EditableSpreadsheetGrid`, `PermissionMatrix`; `DatePicker`/`DateRangePicker` gained `mode` (default `popover`).
- **Breaking:** the JSONL-ops entry point on `@frayme/catalog/validate` is now `validateOps`, returning `OpsValidationResult`. The previous names of these two exports are removed with no alias; behaviour and options are unchanged. Lands in the next minor release, so `^0.3.0` consumers are unaffected until they upgrade.

## 0.3.0: Initial public release

- The full Frayme component vocabulary as Zod schemas. See `CATALOG_COMPONENT_COUNT` for the current size. Zero React dependencies.
- Public spec validation via `fraymeCatalog.validate()` (catalog prop-checking + json-render referential integrity).
- Tiered LLM prompt generation via `fraymeCatalog.prompt()`, versioned by `CATALOG_VERSION`.
