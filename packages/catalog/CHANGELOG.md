# @frayme/catalog

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
