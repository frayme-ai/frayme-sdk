'use client';
import { useState, useRef, useEffect, useMemo, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { useScrollEdges } from '../use-scroll-edges.js';
import { styleVars, surfaceInk } from './_style.js';
import { safeDimension } from '@frayme/catalog/validate';
import { formatCell } from './_num.js';
import { Icon, hasIcon } from './icons.js';
import { FraymeConfirmModal } from '../confirm-modal.js';
import { type ConfirmCfg, type RowActionDef, type RowActionVariant, asConfirmCfg, deriveConfirm, wantsConfirm } from './_rowaction.js';

/** Substitute {current}/{total} into a page-label template (escaped text). */
function formatPageLabel(template: string, current: number, total: number): string {
  return template.replace(/\{current\}/g, String(current)).replace(/\{total\}/g, String(total));
}

/* Catalog group (data-table): DataTable, ColumnHeader.
 *
 * The sortable / selectable / paginated table family. Same truly-dynamic
 * contract as Phases 1–4 + the catalog waves:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color/dimension the model names directly) NEVER become
 *     classes — they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`,
 *     read by STATIC arbitrary `var(--fr-…, var(--color-…))` utilities. The class
 *     set stays a closed, build-time set (no JIT, no injection); only the var's
 *     VALUE is model-supplied, and `styleVars` re-validates + omits any
 *     failing/absent value so the token fallback wins (props-less → polished).
 *
 * value > enum precedence: the conditional override class (e.g.
 * `p.headerColor != null && '[background:var(--fr-dt-header)]'`) is only added
 * to cn() when the model supplied that value, so the enum/token class wins when
 * absent and the var wins when present (added LAST → tailwind-merge keeps it).
 *
 * RENDER-ONLY: this is a generative-UI table rendered from an UNTRUSTED spec in
 * a sandboxed iframe. It renders state and emits events; it performs no
 * privileged side effects. Sorting/paging are client-side over the provided
 * rows; cell values render as escaped React text (never markup). Every array is
 * guarded (Array.isArray) and every numeric bound is Number.isFinite-checked so
 * a props-less / partially-streamed element cannot crash. Interaction events
 * carry intrinsic payloads via `emitWith` (sort/page/select identity + value). */

/* ── shared scale maps (density × size → padding / font) ──────────────────── */

const cellPad = cva('', {
  variants: {
    density: {
      compact: 'px-2.5 py-1.5',
      normal: 'px-3 py-2.5',
      comfortable: 'px-4 py-3.5',
    },
  },
  defaultVariants: { density: 'normal' },
});

/* The <table> paints NO background of its own — the wrapper below it is a bare
 * `div.w-full` — so its surface is whatever contains it, and every body cell
 * inherits its ink from here. That made this one declaration the single largest
 * ink reset in the file: inside a spec's `Card { bg:"#12161f", color:"#e2e6f0" }`
 * the authored light ink reached the <table> and this class threw it away for
 * --color-foreground, printing near-black rows on a dark navy card (rgb(24,24,27)
 * on rgb(18,22,31) = 1.02:1). `currentColor` is the same value at the top level —
 * frayme.css points BOTH `.frayme-root { color }` and --color-foreground at
 * --frayme-fg — so a props-less table is byte-identical, and inside an authored
 * container the inherited ink is the only correct answer.
 *
 * The cells that paint an OPAQUE fill do NOT come along: see `pinInk` below. */
const tableRecipe = cva('w-full border-collapse text-left text-current', {
  variants: {
    size: { sm: 'text-[0.8125rem]', md: 'text-sm', lg: 'text-base' },
    bordered: { true: 'border-solid [border-width:var(--fr-dt-bw,1px)] [border-color:var(--fr-dt-border,var(--color-border))]', false: '' },
  },
  defaultVariants: { size: 'md', bordered: false },
});

/* Header cell. `headerColor` overrides the muted token via a var; sortable heads
   are buttons, so the cell itself stays a plain <th>. `borderColor` re-tints the
   header underline (token fallback when unset). */
const headRecipe = cva('fr-band font-semibold [--fr-band-ink:var(--fr-dt-muted,var(--color-muted-foreground))] [--fr-band-authored:var(--fr-dt-header)]', {
  variants: {
    align: { start: 'text-left', center: 'text-center', end: 'text-right' },
    bordered: { true: 'border-b [border-color:var(--fr-dt-border,var(--color-border))]', false: 'border-b [border-color:var(--fr-dt-border,var(--color-border))]' },
  },
  defaultVariants: { align: 'start', bordered: false },
});

/* No accent in the base — `accent` tints ONLY the ACTIVE sort button (the
   conditional in the render), matching DataGrid + the accent describe ("header
   sort-indicator color"). Hover is applied per-state in the render so an active
   accent doesn't flash to foreground on hover. */
/* The padding/negative-margin pair is the whole point of the box metrics here:
   the button is the only tap target in a header cell, so it carries a 2rem floor
   plus its own padding, and the matching negative margins hand that growth back
   to the cell's existing padding — the hit area grows, the header row's height
   and the label's position do not move. */
const sortBtn = cva(
  'inline-flex min-h-8 items-center gap-1 -my-1 -mx-1 px-1 py-1 rounded-sm font-semibold cursor-pointer outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]',
  {
    variants: {
      align: { start: 'flex-row', center: 'flex-row', end: 'flex-row-reverse' },
    },
    defaultVariants: { align: 'start' },
  },
);

// `tabular-nums`: lining figures so right-aligned numeric columns line up
// digit-for-digit (proportional digits misalign decimals/thousands). Harmless on
// text cells (only affects digit glyphs).
const bodyCell = cva('align-middle tabular-nums', {
  variants: {
    align: { start: 'text-left', center: 'text-center', end: 'text-right' },
    // Non-bordered row dividers route through the SAME --fr-dt-border var as the
    // header underline (keeping the soft 60% alpha via color-mix), so borderColor
    // recolors ALL grid lines coherently with or without `bordered`.
    bordered: {
      true: 'border-b [border-color:var(--fr-dt-border,var(--color-border))]',
      false: 'border-b [border-color:color-mix(in_srgb,var(--fr-dt-border,var(--color-border))_60%,transparent)]',
    },
  },
  defaultVariants: { align: 'start', bordered: false },
});

type Align = 'start' | 'center' | 'end';
/** Lenient validation accepts prop values the enum doesn't list, and generators
 * commonly write the CSS-idiom `right`/`left` for numeric columns instead of the
 * schema's `end`/`start`. Those hit no cva key and fell back to `start` —
 * numbers rendered LEFT. Map the CSS aliases so a lenient-validated
 * `align:"right"` still renders right. */
const normAlign = (a: unknown): Align => (a === 'right' ? 'end' : a === 'left' ? 'start' : a === 'center' || a === 'end' || a === 'start' ? a : 'start');
type SortDir = 'asc' | 'desc' | 'none';
type CellValue = string | number;
type RowData = Record<string, CellValue>;
type EditorType = 'text' | 'number' | 'select';

interface ColumnDef {
  key: string;
  label: string;
  align?: Align | null;
  sortable?: boolean | null;
  editable?: boolean | null;
  type?: EditorType | null;
  options?: string[] | null;
  width?: string | null;
  // DISPLAY only — sort, filter and the row editor keep reading the raw value,
  // so a formatted amount still sorts numerically and edits as a number.
  format?: 'number' | 'currency' | 'percent' | 'date' | null;
  prefix?: string | null;
  suffix?: string | null;
}

/** A stable-id working row — the id survives add/delete so selection/edit/sort
 *  identity does not shift with the (index-based) row array. */
interface WorkingRow {
  rid: string;
  data: RowData;
  /** Permission fidelity: a locked row is end-user-immutable — no
   *  selection, no edit/delete row actions. Stamped at seed from row.locked
   *  or the table-level lockExisting; added rows are never locked. */
  locked?: boolean;
}

/* The per-item action contract (shape + confirm gate) now lives in _rowaction.ts
 * so KanbanBoard/KanbanCard reach for the SAME one rather than growing a second
 * "are you sure?" that can drift from this one. Rendering stays here — a row cell
 * is not a card footer. */

/** Button classes by variant (color) — shared by row + bulk action buttons. */
function actionBtnCls(variant: RowActionVariant | null | undefined, iconOnly: boolean): string {
  const pad = iconOnly ? 'p-1.5' : 'px-2.5 py-1';
  const base = `inline-flex items-center gap-1.5 rounded-frayme outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] ${pad}`;
  switch (variant) {
    // quiet defaults: primary row/bulk action = Button's neutral high-contrast
    // fill (bg-foreground/text-card) via the --fr-dt-accent fallback, not a brand slab;
    // an author `accent` still fills brand. danger = "still red but not in the eyes":
    // no resting fill, hairline red border (30% mix), red label + icon, hover-only red
    // wash — repeated per row it no longer reads as a column of pink chips.
    case 'primary':
      return `${base} border border-transparent bg-[var(--fr-dt-accent,var(--color-foreground))] text-[color:var(--color-card)] hover:opacity-90`;
    case 'danger':
      return `${base} border border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-danger hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]`;
    // `secondary` KEEPS text-foreground: bg-muted is an OPAQUE token fill, and a
    // Card's authored `bg` sets --fr-card-bg, never --color-muted — the chip is
    // still a light slab inside a dark card, so its label belongs to the token its
    // fill is partnered with. `ghost`/`outline` paint NOTHING (transparent border,
    // no fill), so their surface is the row's, and text-foreground was a hard reset
    // to the global token: on a `Card { bg:"#12161f" }` row that measured
    // rgb(24,24,27) on rgb(18,22,31) = 1.02:1. currentColor resolves to the same
    // --frayme-fg at the top level, so an un-nested table is byte-identical.
    case 'secondary':
      return `${base} border border-transparent bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/70`;
    case 'ghost':
      return `${base} border border-transparent text-current hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]`;
    default: // outline
      return `${base} border border-[color:var(--fr-dt-border,var(--color-border))] text-current hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]`;
  }
}

/** Row-scope button classes. A row action is drawn once PER ROW, so the actions
 *  column is the most repeated surface on the page and must not out-shout the
 *  page's own primary action: an action with no authored `variant` renders
 *  OUTLINE — a hairline border and no fill. Quiet is what a spec gets for free,
 *  but a bare label reads as text and loses the affordance entirely, so the
 *  border stays. Emphasis stays available — an authored
 *  `primary` fills — and the fill COLOR stays on the `accent` value channel
 *  (`--fr-dt-accent`, neutral foreground token as its fallback): un-accented reads
 *  as the quiet high-contrast fill, an authored accent paints the button. Never
 *  append a color class here — a static class lands last and would win under
 *  tailwind-merge, silencing that channel. Bulk actions (one bar, one copy) take
 *  actionBtnCls directly. */
function rowActionBtnCls(variant: RowActionVariant | null | undefined, iconOnly: boolean): string {
  // `ghost` is FOLDED TO OUTLINE in a row. It paints nothing at all — transparent
  // border, no fill, inherited ink — so a row action rendered ghost reads as plain
  // text until hovered. That is the same failure the outline DEFAULT exists to
  // prevent ("a bare label reads as text and loses the affordance entirely, so the
  // border stays"); an authored ghost was simply bypassing it. Ghost row actions
  // also skew destructive — the least visible treatment on the most consequential
  // control.
  // Bulk actions keep ghost: one bar, one copy, not repeated per row.
  // The actions column is TINTED (fr-dt-actions), and most row actions paint no
  // fill at all — outline and ghost are a hairline border over
  // whatever the row happens to be. A bordered-but-empty chip on a tinted column is
  // a #e4e4e7 border against a #f4f4f5 ground: the control dissolves into the very
  // band meant to set it apart. `secondary` was worse than dissolved — its bg-muted
  // fill IS the column token, so it rendered invisible.
  //
  // So the chip carries its OWN ground. A card-filled button reads as raised on the
  // tint, and — the part that matters beyond this one column — it no longer depends
  // on knowing what is behind it: white row, zebra band, selected row, or a Card
  // with an authored dark `bg` all render the same legible chip. That is the same
  // reasoning that already makes the pinned column composite over --color-card
  // (see pinBg/pinInk); this extends it to the controls sitting on it.
  //
  // `primary` is untouched — it already paints an opaque fill. `secondary` folds in
  // with the rest: the tier it drew (a quiet FILL against no fill) is precisely the
  // distinction a tinted column erases, and it is vanishingly rare on a row action.
  const v = variant === 'ghost' || variant === 'secondary' ? 'outline' : (variant ?? 'outline');
  const cls = actionBtnCls(v, iconOnly);
  // Ink stays with the fill it is partnered with: the chip is card-toned even inside
  // a dark authored card, so `text-current` (which inherits that card's light ink)
  // would land light-on-light. danger keeps its red label, which reads on card.
  // THROUGH cn(), not string concatenation. actionBtnCls already carries
  // `text-current` for these variants; appending `text-foreground` with `+` leaves
  // BOTH on the element and lets stylesheet order decide, which is the exact hazard
  // this file warns about a few lines up. tailwind-merge resolves the conflict and
  // keeps the last-declared intent.
  // The chip is EMBOSSED from the surface (see .fr-dt-chip in frayme.css), not
  // painted a flat card colour — `bg-card` was a white slab, correct on a white
  // page and a glaring block on a navy one.
  if (v === 'outline') return cn(cls, 'fr-dt-chip');
  if (v === 'danger') return cn(cls, 'fr-dt-chip');
  return cls;
}

/** Best-effort px value of a column width for resize seeding (px only). */
function safeWidthPx(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const m = value.match(/^(\d+(?:\.\d+)?)px$/);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/* The aria-sort glyph for a column head given its active sort state. */
function SortGlyph({ dir }: { dir: SortDir }): ReactNode {
  if (dir === 'asc') return <Icon name="chevron-up" size={14} />;
  if (dir === 'desc') return <Icon name="chevron-down" size={14} />;
  // neutral / unsorted — a faint up/down hint.
  return (
    <span className="inline-flex flex-col opacity-40" aria-hidden>
      <Icon name="chevron-up" size={11} />
      <Icon name="chevron-down" size={11} />
    </span>
  );
}

function ariaSortFor(active: boolean, dir: SortDir): 'ascending' | 'descending' | 'none' {
  if (!active || dir === 'none') return 'none';
  return dir === 'asc' ? 'ascending' : 'descending';
}

/* ── DataTable ────────────────────────────────────────────────────────────── */

export function DataTable({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    columns?: ColumnDef[] | null;
    rows?: RowData[] | null;
    selectable?: boolean | null;
    selectedRows?: RowData[] | null;
    // CRUD
    rowActions?: RowActionDef[] | null;
    editable?: boolean | null;
    deletable?: boolean | null;
    addable?: boolean | null;
    lockExisting?: boolean | null;
    bulkActions?: { id: string; label: string; tone?: 'neutral' | 'primary' | 'danger' | null; confirm?: ConfirmCfg | null; disabled?: boolean | null }[] | null;
    editLabel?: string | null;
    deleteLabel?: string | null;
    addLabel?: string | null;
    actionIcons?: boolean | null;
    confirmDelete?: boolean | null;
    confirmDeleteText?: string | null;
    saveLabel?: string | null;
    cancelLabel?: string | null;
    // folded from DataGrid
    resizable?: boolean | null;
    pinnedFirst?: boolean | null;
    sortBy?: string | null;
    sortDir?: SortDir | null;
    page?: number | null;
    pageSize?: number | null;
    filterText?: string | null;
    /** Per-column exact-match filters: column key → wanted value (bind entries
     *  to picklist state, e.g. {"sector":{"$state":"/sector"}}). Empty entry =
     *  no filter for that column; AND across keys; applied before filterText. */
    filterValues?: Record<string, unknown> | null;
    /** Bounded row filter on ONE key: keep rows where min <= row[key] <= max.
     *  Bind min/max to the paths a DateRangePicker (ISO dates) or two
     *  NumberInputs write. Numeric compare when everything parses as numbers,
     *  else string compare (ISO YYYY-MM-DD sorts chronologically). An empty
     *  bound is open-ended; the key may be a non-displayed row field. */
    filterRange?: { key?: string | null; min?: unknown; max?: unknown } | null;
    striped?: boolean | null;
    bordered?: boolean | null;
    hoverable?: boolean | null;
    density?: 'compact' | 'normal' | 'comfortable' | null;
    size?: 'sm' | 'md' | 'lg' | null;
    accent?: string | null;
    headerColor?: string | null;
    borderColor?: string | null;
    borderWidthValue?: string | number | null;
    mutedColor?: string | null;
    maxHeight?: string | number | null;
    caption?: string | null;
    ariaLabel?: string | null;
    emptyText?: string | null;
    prevLabel?: string | null;
    nextLabel?: string | null;
    pageLabel?: string | null;
    prevIcon?: string | null;
    nextIcon?: string | null;
  };

  // CONTENT / i18n — each defaults to the exact current literal; glyph names
  // resolve ONLY through the closed registry (unknown/absent → the default chevron).
  const emptyText = p.emptyText ?? 'No rows to display.';
  // The aria-label of each pager button. Defaults to the EXACT current literal
  // ("Previous page"/"Next page"); the visible "Prev"/"Next" text stays the default
  // unless overridden, so a props-less spec is byte-identical.
  const prevLabel = p.prevLabel ?? 'Previous page';
  const nextLabel = p.nextLabel ?? 'Next page';
  const prevIcon = typeof p.prevIcon === 'string' && hasIcon(p.prevIcon) ? p.prevIcon : 'chevron-left';
  const nextIcon = typeof p.nextIcon === 'string' && hasIcon(p.nextIcon) ? p.nextIcon : 'chevron-right';
  // CRUD button labels — each defaults to the exact English literal (escaped text).
  const editLabel = p.editLabel ?? 'Edit';
  const deleteLabel = p.deleteLabel ?? 'Delete';
  const addLabel = p.addLabel ?? 'Add row';
  const actionIcons = p.actionIcons === true;
  const confirmDelete = p.confirmDelete === true;
  const confirmDeleteText = typeof p.confirmDeleteText === 'string' && p.confirmDeleteText.trim() ? p.confirmDeleteText : 'This will permanently delete the selected row(s). This action cannot be undone.';
  const saveLabel = p.saveLabel ?? 'Save';
  const cancelLabel = p.cancelLabel ?? 'Cancel';

  // Guard every array (a streamed element may arrive before its props patch).
  const columns = Array.isArray(p.columns) ? p.columns.filter((c) => c && typeof c.key === 'string') : [];
  const propRows = Array.isArray(p.rows) ? p.rows.filter((r): r is RowData => r != null && typeof r === 'object') : [];

  const density = (p.density as 'compact' | 'normal' | 'comfortable' | null) ?? undefined;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const bordered = (p.bordered ?? false) as true | false;
  const hoverable = p.hoverable ?? true;
  const striped = p.striped === true;
  const selectable = p.selectable === true;
  // CRUD toggles + DataGrid-folded layout flags (all default OFF per the catalog).
  const editable = p.editable === true;
  const deletable = p.deletable === true;
  const addable = p.addable === true;
  const resizable = p.resizable === true;
  const pinnedFirst = p.pinnedFirst === true;
  const bulkActions = Array.isArray(p.bulkActions)
    ? p.bulkActions.filter((b): b is { id: string; label: string; tone?: 'neutral' | 'primary' | 'danger' | null; confirm?: ConfirmCfg | null; disabled?: boolean | null } => b != null && typeof b === 'object' && typeof b.id === 'string')
    : [];

  // Resolve the per-row actions: explicit `rowActions` is authoritative; otherwise
  // synthesize edit/delete from the editable/deletable/actionIcons/confirmDelete
  // shorthands (backward-compat). Each action carries its own icon/variant/confirm.
  const rowActions: RowActionDef[] = (() => {
    const raw = Array.isArray(p.rowActions) ? p.rowActions.filter((a): a is RowActionDef => !!a && typeof a.id === 'string') : null;
    if (raw && raw.length) return raw;
    const out: RowActionDef[] = [];
    // No variant on the synthesized edit — it takes rowActionBtnCls's quiet default.
    if (editable) out.push({ id: 'edit', label: actionIcons ? null : editLabel, icon: actionIcons ? 'edit' : null });
    if (deletable) out.push({ id: 'delete', label: actionIcons ? null : deleteLabel, icon: actionIcons ? 'trash' : null, variant: 'danger', confirm: confirmDelete ? { message: confirmDeleteText, variant: 'danger' } : null });
    return out;
  })();
  const deleteAction = rowActions.find((a) => a.id === 'delete');
  // An "Actions" trailing column is drawn whenever a per-row action exists.
  const showActions = rowActions.length > 0;

  const [sortBy, setSortBy] = useBoundProp<string>(p.sortBy ?? undefined, bindings?.sortBy);
  const [sortDir, setSortDir] = useBoundProp<SortDir>((p.sortDir as SortDir) ?? undefined, bindings?.sortDir);
  const [page, setPage] = useBoundProp<number>(p.page ?? undefined, bindings?.page);
  // Local live search (local-first rule): point `filterText` at the same
  // state path a FilterBar/Input writes and the visible rows narrow client-side —
  // no agent round-trip. A filter is a VIEW: selection/edits keep the full set.
  // The usual shape is a {"$state"} prop — json-render re-resolves it LIVE on
  // every state write, so read the prop directly each render; useBoundProp would
  // seed once and go stale. A {"$bindState"} arrives via `bindings` instead.
  const [filterTextBound] = useBoundProp<string>((p.filterText as string) ?? undefined, bindings?.filterText);
  const filterTextRaw = bindings?.filterText != null ? filterTextBound : (p.filterText as string | null | undefined);

  const emitWith = useIntrinsicEmit(emit, element);

  /* CRUD verb resolution. `add` and `update` are component-scoped spellings
     (catalog COMPONENT_EXTRA_EVENTS) for the two commits that already carry an
     `action` discriminator. Exactly ONE verb fires per interaction: the specific
     one when the author declared it, `commit` otherwise. That ordering is what
     makes this backward compatible — every existing table declares `on.commit`
     and is untouched — and it is also what prevents a table that
     declares BOTH from firing the same round trip to the agent twice. The
     payload is unchanged either way, so `action:'add'` still discriminates for
     anything reading it. */
  const onKeys = ((element as { on?: Record<string, unknown> }).on ?? {}) as Record<string, unknown>;
  const boundTo = (verb: 'add' | 'update'): boolean => verb in onKeys;

  // ── Stable-id working-rows model ─────────────────────────────────────────────
  // The rows are held locally as { rid, data } records so a row's identity
  // (used for selection, editing, sort, delete) survives add/delete — indices
  // shift, rids do not. Seeded from `rows` (rid = `r${i}`); re-seeded when the
  // rows prop changes (keyed by content). New rows get a monotonic `n${++counter}`.
  const ridCounter = useRef(0);
  const rowsKey = useMemo(() => JSON.stringify(propRows), [propRows]);
  const lockExisting = p.lockExisting === true;
  const seedWorking = (): WorkingRow[] =>
    propRows.map((data, i) => ({ rid: `r${i}`, data, locked: (data as { locked?: unknown }).locked === true || lockExisting || undefined }));
  const [working, setWorkingState] = useState<WorkingRow[]>(seedWorking);
  const workingRef = useRef<WorkingRow[]>(working);
  const setWorking = (next: WorkingRow[]): void => {
    workingRef.current = next;
    setWorkingState(next);
  };
  useEffect(() => {
    const seeded = seedWorking();
    workingRef.current = seeded;
    setWorkingState(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey]);
  // A fresh rid for a UI-added row.
  const nextRid = (): string => `n${++ridCounter.current}`;
  // The full current row set (plain data records) — mirrored into every CRUD
  // payload so the live rows are agent-readable from spec.state without binding.
  const dataOf = (rows: WorkingRow[]): RowData[] => rows.map((r) => r.data);

  // ── Selection (keyed by rid) ─────────────────────────────────────────────────
  // The RESOLVED selected row records land in the declared, bindable `selectedRows`
  // prop (spec.state) on every toggle. Selection IDENTITY is the row's stable rid,
  // held locally in a Set + ref; it is seeded from `selectedRows` by matching row
  // content against the working rows.
  const [, setBoundSelectedRows] = useBoundProp<RowData[]>(
    Array.isArray(p.selectedRows) ? p.selectedRows : [],
    bindings?.selectedRows,
  );
  const seedKey = useMemo(
    () => rowsKey + '|' + JSON.stringify(p.selectedRows ?? []),
    [rowsKey, p.selectedRows],
  );
  const seedSelected = (): Set<string> => {
    const want = Array.isArray(p.selectedRows) ? p.selectedRows : [];
    const set = new Set<string>();
    const base = seedWorking();
    for (const w of want) {
      const key = JSON.stringify(w);
      const hit = base.find((r) => JSON.stringify(r.data) === key);
      if (hit) set.add(hit.rid);
    }
    return set;
  };
  const [selected, setSelectedState] = useState<Set<string>>(seedSelected);
  const selRef = useRef<Set<string>>(selected);
  useEffect(() => {
    const s = seedSelected();
    selRef.current = s;
    setSelectedState(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  // ── Row editor + Add-row drafts ──────────────────────────────────────────────
  const [editingRid, setEditingRid] = useState<string | null>(null);
  const [draft, setDraft] = useState<RowData>({});
  // Generic per-action confirm gate (a row or bulk action carrying a `confirm`):
  // holds the derived confirm config + the deferred run. One shared modal renders it.
  const [pending, setPending] = useState<{ config: ConfirmCfg & { confirmIcon?: string }; run: () => void } | null>(null);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<RowData>({});

  // The trailing actions column is drawn when there are per-row actions (Edit/Delete),
  // OR only WHILE actively adding/editing — so a pure `addable` table doesn't carry a
  // permanent empty pinned column at rest (a reported defect: "extra white space
  // at the end of the table"). The add-row draft's Save/Cancel still get their column
  // because opening the draft sets `adding` true.
  const showActionsCol = showActions || adding || editingRid !== null;

  // Per-column value filters BEFORE the text filter (the picklist-filter
  // idiom): `filterValues` is a record of
  // column key → wanted value, typically authored as {"sector":{"$state":"/sector"}}
  // so a Select bound to the same path drives the table live. AND semantics
  // across keys; a null/undefined/'' entry (cleared Select) filters nothing.
  // Exact match on the stringified cell — a filter is a VIEW (like filterText):
  // selection/edits keep the full set. Absent prop → identity (byte-identical).
  const filterValues =
    p.filterValues && typeof p.filterValues === 'object' && !Array.isArray(p.filterValues)
      ? Object.entries(p.filterValues as Record<string, unknown>).filter(
          ([, v]) => v !== null && v !== undefined && String(v).trim() !== '',
        )
      : [];
  const valueFiltered = filterValues.length
    ? working.filter((r) =>
        filterValues.every(([key, want]) => {
          const v = r.data?.[key];
          return v !== null && v !== undefined && String(v) === String(want);
        }),
      )
    : working;

  // Bounded filter on one key (the DateRangePicker↔table idiom): keep
  // rows inside [min, max]. Numeric compare when all three parse as numbers,
  // else string compare (ISO dates sort chronologically). Empty bound = open
  // end; rows lacking the key drop only when a bound is active.
  const fr = p.filterRange && typeof p.filterRange === 'object' ? p.filterRange : null;
  const frKey = typeof fr?.key === 'string' && fr.key ? fr.key : null;
  const frMin = fr?.min !== null && fr?.min !== undefined && String(fr.min).trim() !== '' ? fr.min : null;
  const frMax = fr?.max !== null && fr?.max !== undefined && String(fr.max).trim() !== '' ? fr.max : null;
  const rangeFiltered =
    frKey && (frMin !== null || frMax !== null)
      ? valueFiltered.filter((r) => {
          const v = r.data?.[frKey];
          if (v === null || v === undefined) return false;
          const nums = [v, frMin, frMax].filter((x) => x !== null).map((x) => Number(x));
          const numeric = nums.every((n) => Number.isFinite(n));
          const cmp = (a: unknown, b: unknown): number =>
            numeric ? Number(a) - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
          if (frMin !== null && cmp(v, frMin) < 0) return false;
          if (frMax !== null && cmp(v, frMax) > 0) return false;
          return true;
        })
      : valueFiltered;

  // Local text filter BEFORE paging/sorting: case-insensitive substring match
  // across every string/number cell. Empty/absent filter → identity (byte-identical).
  const filterText = typeof filterTextRaw === 'string' ? filterTextRaw.trim().toLowerCase() : '';
  const visible = filterText
    ? rangeFiltered.filter((r) =>
        columns.some((c) => {
          const v = r.data?.[c.key];
          return (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(filterText);
        }),
      )
    : rangeFiltered;

  // Plain numeric bounds — Number.isFinite filter, sane fallbacks.
  const pageSize = Number.isFinite(p.pageSize) && (p.pageSize as number) > 0 ? Math.floor(p.pageSize as number) : 10;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Number.isFinite(page) && (page as number) >= 1 ? Math.min(Math.floor(page as number), totalPages) : 1;

  // Client-side sort over the visible rows (string|number aware), carrying each
  // row's rid so identity survives sort + paging, then slice.
  const activeDir: SortDir = (sortDir as SortDir) ?? 'none';
  const sorted =
    typeof sortBy === 'string' && sortBy.length > 0 && activeDir !== 'none'
      ? [...visible].sort((a, b) => {
          const av = a.data?.[sortBy];
          const bv = b.data?.[sortBy];
          let cmp: number;
          if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
          else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
          return activeDir === 'asc' ? cmp : -cmp;
        })
      : visible;

  const start = (currentPage - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);

  // asc → desc → none cycle for a column head.
  function toggleSort(key: string): void {
    let nextDir: SortDir;
    if (sortBy !== key) nextDir = 'asc';
    else if (activeDir === 'asc') nextDir = 'desc';
    else if (activeDir === 'desc') nextDir = 'none';
    else nextDir = 'asc';
    setSortBy(nextDir === 'none' ? '' : key);
    setSortDir(nextDir);
    emitWith('sort', { sortBy: nextDir === 'none' ? '' : key, sortDir: nextDir });
  }

  function goToPage(next: number): void {
    const clamped = Math.min(Math.max(1, next), totalPages);
    setPage(clamped);
    emitWith('page', { page: clamped });
  }

  // Resolve selection rids to their row records (the actual data a streaming
  // agent can act on — not a bare id it would have to re-map against a rows array).
  function resolveRows(ids: string[]): RowData[] {
    const rows = workingRef.current;
    return ids
      .map((rid) => rows.find((r) => r.rid === rid)?.data)
      .filter((r): r is RowData => r != null);
  }

  function writeSelection(next: Set<string>): RowData[] {
    const nextIds = [...next];
    const resolved = resolveRows(nextIds);
    selRef.current = next;
    setSelectedState(next);
    setBoundSelectedRows(resolved); // write spec.state BEFORE emit → the action snapshot is current
    return resolved;
  }

  function toggleRow(rid: string): void {
    if (workingRef.current.find((r) => r.rid === rid)?.locked === true) return; // locked rows are unselectable
    const next = new Set(selRef.current);
    if (next.has(rid)) next.delete(rid);
    else next.add(rid);
    const row = workingRef.current.find((r) => r.rid === rid)?.data ?? null;
    const index = workingRef.current.findIndex((r) => r.rid === rid);
    const resolved = writeSelection(next);
    // index = the row's CURRENT position in the working array; row = the resolved
    // record it toggled; selectedRows = the FULL resolved current selection.
    emitWith('select', {
      id: rid,
      index,
      checked: next.has(rid),
      row,
      selected: [...next],
      selectedRows: resolved,
    });
  }

  // Locked rows never enter the selection — select-all covers the page's
  // selectable rows only (permission fidelity).
  const sliceIds = slice.filter((it) => it.locked !== true).map((it) => it.rid);
  const allOnPageSelected = sliceIds.length > 0 && sliceIds.every((rid) => selected.has(rid));
  function toggleAll(): void {
    const next = new Set(selRef.current);
    if (allOnPageSelected) sliceIds.forEach((rid) => next.delete(rid));
    else sliceIds.forEach((rid) => next.add(rid));
    const resolved = writeSelection(next);
    // `all` = whether this toggled the page ON; selectedRows = the full resolved
    // selection after the bulk toggle so the agent sees exactly which records hold.
    emitWith('select', {
      selected: [...next],
      selectedRows: resolved,
      all: !allOnPageSelected,
    });
  }

  // ── Row editor lifecycle ─────────────────────────────────────────────────────
  function beginEdit(rid: string): void {
    const row = workingRef.current.find((r) => r.rid === rid);
    if (!row || row.locked === true) return;
    setAdding(false); // only one editor open at a time
    setEditingRid(rid);
    setDraft({ ...row.data });
  }
  function cancelEdit(): void {
    setEditingRid(null);
    setDraft({});
  }
  function saveEdit(): void {
    const rid = editingRid;
    if (rid == null) return;
    const index = workingRef.current.findIndex((r) => r.rid === rid);
    if (index < 0) {
      cancelEdit();
      return;
    }
    const savedDraft: RowData = { ...draft };
    const nextRows = workingRef.current.map((r) => (r.rid === rid ? { rid, data: savedDraft } : r));
    setWorking(nextRows);
    // If the edited row is selected, keep the bound selection records fresh.
    if (selRef.current.has(rid)) setBoundSelectedRows(resolveRows([...selRef.current]));
    setEditingRid(null);
    setDraft({});
    const editPayload = { action: 'edit', index, row: savedDraft, rows: dataOf(nextRows) };
    if (boundTo('update')) emitWith('update', editPayload);
    else emitWith('commit', editPayload);
  }

  // ── Delete row (guarded by an optional confirm modal) ────────────────────────
  // `label` is the text the pressed delete button DREW (`a.label`; null when
  // icon-only). Stashed in the payload the way a Button stashes its own — the
  // receipt card (core/action-enrich.ts) is headed by the pressed control's
  // label, and a synthesized `deletable: true` delete has no `rowActions[]` entry
  // in the spec for the row-action lookup to find, so the emit must say it
  // itself (a "Remove claim" press was once carded as "Table act").
  // The `affordance` names the gesture for the carrier gate exactly as the
  // custom row actions below do — this IS a row action press, whatever the
  // verb; the built-in id only chose the verb.
  function doDeleteRow(rid: string, label: string | null = null): void {
    const index = workingRef.current.findIndex((r) => r.rid === rid);
    if (index < 0) return;
    const row = workingRef.current[index].data;
    const nextRows = workingRef.current.filter((r) => r.rid !== rid);
    setWorking(nextRows);
    // Drop it from the selection too (identity is gone).
    if (selRef.current.has(rid)) {
      const nextSel = new Set(selRef.current);
      nextSel.delete(rid);
      writeSelection(nextSel);
    }
    if (editingRid === rid) cancelEdit();
    emitWith(
      'dismiss',
      { action: 'delete', ...(label !== null ? { label } : {}), index, row, rows: dataOf(nextRows) },
      { affordance: 'row-action' },
    );
  }
  // A row action fires: edit/delete are built-ins, any other id emits a custom
  // `commit`. A `confirm` on the action defers it behind the shared modal.
  function runRowAction(a: RowActionDef, rid: string): void {
    if (a.id === 'edit') { beginEdit(rid); return; }
    if (a.id === 'delete') { doDeleteRow(rid, typeof a.label === 'string' && a.label !== '' ? a.label : null); return; }
    const index = workingRef.current.findIndex((r) => r.rid === rid);
    const row = index >= 0 ? workingRef.current[index].data : null;
    // `affordance` names the gesture for the carrier gate (core/dynamic-gate.ts):
    // a row action press is a carrier on every host that draws the _rowaction.ts
    // contract, whatever the host's own type says.
    emitWith('commit', { action: a.id, index, row, rows: dataOf(workingRef.current) }, { affordance: 'row-action' });
  }
  function onRowAction(a: RowActionDef, rid: string): void {
    if (wantsConfirm(a.confirm)) setPending({ config: deriveConfirm(a.label, a.variant, a.confirm, a.icon), run: () => runRowAction(a, rid) });
    else runRowAction(a, rid);
  }

  // ── Add row ──────────────────────────────────────────────────────────────────
  // A NEW row needs its values from somewhere: when no column is flagged
  // `editable`, the add editor opens EVERY column (`addable` with zero
  // editable columns produced an inputless editor that saved blank rows).
  // Row EDITS keep respecting per-column `editable`.
  const noEditableCols = !columns.some((c) => c.editable === true);
  function beginAdd(): void {
    setEditingRid(null); // close any open row editor
    const blank: RowData = {};
    for (const col of columns) {
      if (col.editable || noEditableCols) blank[col.key] = col.type === 'number' ? 0 : '';
    }
    setAddDraft(blank);
    setAdding(true);
  }
  function cancelAdd(): void {
    setAdding(false);
    setAddDraft({});
  }
  function saveAdd(): void {
    const row: RowData = { ...addDraft };
    const nextRows = [...workingRef.current, { rid: nextRid(), data: row }];
    setWorking(nextRows);
    setAdding(false);
    setAddDraft({});
    const addPayload = { action: 'add', row, rows: dataOf(nextRows) };
    if (boundTo('add')) emitWith('add', addPayload);
    else emitWith('commit', addPayload);
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  // The built-in bulk delete stashes the label it drew ("Delete selected") and
  // asserts the bulk-action affordance, for the same reason the row delete
  // above does: `__delete__` is not an entry in `bulkActions[]`, so the receipt
  // lookup cannot name it — the emit must.
  function doBulkDelete(label: string): void {
    const sel = selRef.current;
    if (sel.size === 0) return;
    const removed = resolveRows([...sel]);
    const nextRows = workingRef.current.filter((r) => !sel.has(r.rid));
    setWorking(nextRows);
    const emptySel = new Set<string>();
    selRef.current = emptySel;
    setSelectedState(emptySel);
    setBoundSelectedRows([]); // write spec.state BEFORE emit
    emitWith('dismiss', { action: 'bulkDelete', label, removed, rows: dataOf(nextRows) }, { affordance: 'bulk-action' });
  }
  function runBulk(id: string, label: string): void {
    if (id === '__delete__') { doBulkDelete(label); return; }
    const selectedRows = resolveRows([...selRef.current]);
    emitWith('commit', { action: id, selectedRows }, { affordance: 'bulk-action' });
  }
  function onBulk(id: string, label: string, variant: RowActionVariant | undefined, confirm: ConfirmCfg | null | undefined): void {
    if (selRef.current.size === 0) return;
    if (wantsConfirm(confirm)) setPending({ config: deriveConfirm(label, variant, confirm), run: () => runBulk(id, label) });
    else runBulk(id, label);
  }

  // ── Column resize (folded from DataGrid) ─────────────────────────────────────
  const [widths, setWidths] = useState<Record<number, number>>({});
  // Toggles data-fr-more-x/y on the scroller so the edge fade and the pinned-column
  // seam paint ONLY while something actually scrolls that way.
  const scrollRef = useScrollEdges<HTMLDivElement>();
  const dragRef = useRef<{ index: number; startX: number; startW: number } | null>(null);
  function onResizeDown(index: number, e: ReactPointerEvent<HTMLSpanElement>): void {
    e.preventDefault();
    e.stopPropagation();
    const seeded = widths[index] ?? safeWidthPx(columns[index]?.width) ?? 140;
    dragRef.current = { index, startX: e.clientX, startW: seeded };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture may be unavailable in some test envs — ignore. */
    }
  }
  function onResizeMove(e: ReactPointerEvent<HTMLSpanElement>): void {
    const d = dragRef.current;
    if (!d) return;
    const w = Math.max(56, Math.min(640, d.startW + (e.clientX - d.startX)));
    setWidths((prev) => (prev[d.index] === w ? prev : { ...prev, [d.index]: w }));
  }
  function onResizeUp(e: ReactPointerEvent<HTMLSpanElement>): void {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
  function colStyle(col: ColumnDef, index: number): CSSProperties {
    const live = widths[index];
    if (live != null) return { width: `${live}px` };
    const seeded = safeDimension(col.width, { units: ['px', 'rem'], max: 1200 });
    if (seeded != null) return { width: seeded };
    // Under fixed layout every column needs a concrete width for drag-resize to bite.
    return resizable ? { width: '160px' } : {};
  }

  const checkboxCls =
    // The checkbox outline joins the borderColor channel (--fr-dt-border, token
    // fallback → byte-identical unset) so branded grid lines don't leave stock
    // checkbox boxes behind.
    'h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-[color:var(--fr-dt-border,var(--color-border))] accent-[var(--fr-dt-accent,var(--fr-accent))] focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]';

  // `maxHeight` is the only thing that gives this table a vertical scroll region,
  // so it is also the only thing that can make a sticky <thead> mean anything:
  // the wrapper below is `overflow-x-auto` otherwise, which never scrolls in y.
  const capped = p.maxHeight != null;

  // A header cell that scrolled content passes UNDER has to be OPAQUE, and it has
  // to paint the same surface its neighbours show. Those neighbours inherit the
  // surface behind the table (see headBg), so the fallback here is the CARD token,
  // not muted; --fr-dt-header still wins whenever the author sets one.
  const headOpaqueBg = '[background:var(--fr-dt-header,var(--color-card))]';
  // The inline `background: inherit` is what makes an un-themed head show the
  // surface behind the table instead of headRecipe's muted token. It beats every
  // class, so it is withheld when headerColor is set (so --fr-dt-header can paint)
  // and on any cell headOpaqueBg has to fill — `inherit` resolves to the
  // transparent row, and scrolled content would print straight through it.
  const headBg = (opaque: boolean): CSSProperties | undefined =>
    p.headerColor != null || opaque ? undefined : { background: 'inherit' };

  // Sticky-left classes for the frozen first DATA column (pinnedFirst). The head
  // takes headOpaqueBg; body cells composite their band OVER the card token so the
  // freeze covers horizontally-scrolled content without breaking the
  // stripe/selection tint (mirrors DataGrid's pinCls approach).
  const pinClsHead = 'sticky left-0 z-20';
  const pinClsBody = 'sticky left-0 z-10';
  // The TRAILING actions column (row Edit/Delete + the add-row Save/Cancel) pins to
  // the RIGHT edge so it never scrolls off-screen on a wide table (a reported
  // defect: "add a row but no save button" — the Save was in the actions column,
  // clipped off the right). Mirrors the left-pin: opaque header var; body cells
  // composite the row band via `pinBg` so the freeze covers scrolled content.
  // The seam (hairline + a short leftward shadow) is what tells the eye the
  // remaining columns run UNDER this one rather than behind floating buttons.
  // --color-foreground here is a SHADOW, not ink — it is not part of the inherited-
  // foreground fix and stays on the token deliberately (a seam mixed from the page's
  // darkest value is what reads as depth in both themes).
  // The shadow now lives in frayme.css under `[data-fr-more-x] .fr-pinseam`, so it
  // appears only while columns genuinely run under this one. The hairline stays put.
  // NO unconditional border. The hairline used to be permanent on the reasoning
  // that "a column separator is always honest" — but the column now BLENDS into the
  // table, and a border around a region whose fill follows the zebra is a
  // contradiction: the line says "distinct region", the fill says "part of the
  // rows". Read as a bordered box with a non-uniform interior, which is exactly what
  // it looked like. Both the hairline and the shadow are now gated on real overflow
  // (frayme.css), so the seam appears when there is genuinely something scrolling
  // under it and the column is otherwise seamless.
  const pinRightSeam = 'fr-pinseam';
  // Ink for the cells that must be OPAQUE. A pinned/frozen cell has to cover
  // horizontally-scrolled content, so it composites its band over --color-card
  // (see `pinBg`) — and a Card's authored `bg` re-points --fr-card-bg, never
  // --color-card, so that band stays LIGHT inside a dark authored card. The table
  // root now inherits its ink (see tableRecipe), so without this the card's light
  // ink would land on that light band: the same defect pointing the other way.
  // These cells paint their own fill, so they name the token that fill is
  // partnered with. Unchanged at the top level, where the two are the same value.
  // NOT applied to the ACTIONS cells. Those now shade --fr-card-bg (see
  // .fr-dt-actions in frayme.css), so their ink follows the card too — pinning the
  // global token there would put dark text on a dark authored card. The pinned
  // FIRST column still composites over --color-card and still needs this.
  const pinInk = 'text-foreground';
  // The trailing actions column is CHROME, not data — it holds controls, never a
  // value — so it carries one shade more than the row band it sits on. Composited,
  // never overlaid: this column has to stay OPAQUE because it covers horizontally
  // scrolled content, and a translucent tint would let those columns show through.
  // The row band stays visible underneath (zebra and selection still read), so the
  // column reads as one step deeper rather than as a flat separate surface.
  const pinRightHead = cn('sticky right-0 z-20', 'fr-dt-actions fr-dt-actions--head', pinRightSeam);
  const pinRightBody = cn('sticky right-0 z-10', pinRightSeam);
  // The first pinned DATA column is column index 0 only when there is no leading
  // checkbox column in front of it (parity with DataGrid).
  const canPinFirst = pinnedFirst && !selectable;

  // A controlled editor input for one cell of a draft (row editor or add row).
  // Invoked as a plain function (not a JSX <Component/>) so the <input> keeps a
  // stable element identity across the parent's re-render on each keystroke — a
  // JSX element here would remount the input and blow away focus/caret.
  function renderEditorCell({ col, value, onChange }: { col: ColumnDef; value: CellValue | undefined; onChange: (v: CellValue) => void }): ReactNode {
    const type = (col.type as EditorType | null) ?? 'text';
    const inputCls =
      'w-full rounded-sm border border-[color:var(--fr-dt-border,var(--color-border))] bg-card px-2 py-1 text-inherit text-foreground outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]';
    const label = `Edit ${col.label}`;
    if (type === 'select') {
      const options = Array.isArray(col.options) ? col.options.filter((o) => typeof o === 'string') : [];
      return (
        <select className={inputCls} aria-label={label} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)}>
          {/* An empty first option so an unset select is representable. */}
          {options.every((o) => o !== String(value ?? '')) && <option value={String(value ?? '')}>{String(value ?? '')}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    if (type === 'number') {
      return (
        <input
          type="number"
          className={inputCls}
          aria-label={label}
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            onChange(Number.isFinite(n) ? n : e.target.value);
          }}
        />
      );
    }
    return (
      <input type="text" className={inputCls} aria-label={label} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
    );
  }

  // Render an editor row's cells + a Save/Cancel actions cell. Shared by the
  // inline row editor and the trailing add-row editor. Also invoked as a plain
  // function (see renderEditorCell) to keep the input tree stable across renders.
  function renderEditorRowCells({ current, patch, onSave, onCancel, allEditable }: { current: RowData; patch: (key: string, v: CellValue) => void; onSave: () => void; onCancel: () => void; allEditable?: boolean }): ReactNode {
    return (
      <>
        {columns.map((col, ci) => {
          const align = normAlign(col.align);
          const isPinned = canPinFirst && ci === 0;
          return (
            <td key={col.key} className={cn(bodyCell({ align, bordered }), cellPad({ density }), isPinned && cn(pinClsBody, 'bg-card', pinInk))} style={colStyle(col, ci)}>
              {col.editable || allEditable === true ? (
                renderEditorCell({ col, value: current[col.key], onChange: (v) => patch(col.key, v) })
              ) : (
                // The read-only cells of an editor row wrap like the body cells
                // they line up with: a row being edited has no fixed height (the
                // inputs set it), so a nowrap span here only bought an ellipsis
                // inside an authored column width.
                <span className="block break-words" title={typeof current[col.key] === 'number' || typeof current[col.key] === 'string' ? String(current[col.key]) : undefined}>
                  {typeof current[col.key] === 'number' || typeof current[col.key] === 'string' ? String(current[col.key]) : ''}
                </span>
              )}
            </td>
          );
        })}
        {showActionsCol && (
          // KEPT nowrap: the pinned actions rail is a button strip, not text —
          // `w-0` sizes the column to exactly those buttons and nowrap keeps
          // Save/Cancel on the one line the strip is. Nothing clips (no
          // overflow:hidden anywhere on this path), so no word can be lost.
          <td className={cn(bodyCell({ align: 'end', bordered }), cellPad({ density }), 'w-0 whitespace-nowrap', pinRightBody, 'fr-dt-actions')}>
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex items-center rounded-frayme border border-transparent bg-[var(--fr-dt-accent,var(--color-foreground))] px-2.5 py-1 text-[color:var(--color-card)] outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
                onClick={onSave}
              >
                {saveLabel}
              </button>
              {/* KEEPS text-foreground (as does the input recipe above): this rail
                  sits in the `bg-card` actions cell, an opaque --color-card fill
                  that an authored Card's `bg` does not re-point. Inheriting the
                  card's light ink here would be white-on-white. */}
              <button
                type="button"
                className="inline-flex items-center rounded-frayme border border-[color:var(--fr-dt-border,var(--color-border))] px-2.5 py-1 text-foreground outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
                onClick={onCancel}
              >
                {cancelLabel}
              </button>
            </div>
          </td>
        )}
      </>
    );
  }

  const colSpanAll = columns.length + (selectable ? 1 : 0) + (showActionsCol ? 1 : 0) || 1;

  // Scroll, don't compress. `w-full` alone lets a narrow viewport squeeze the real
  // columns to nothing behind the pinned actions column (which keeps its natural
  // width because it is sticky). Floor the table at a readable width per column so
  // the wrapper's overflow-x takes over instead. Derived from the column count —
  // never a spec value — but it still travels the value channel so the class stays
  // static; clamped to safeDimension's ceiling so the var can't drop out.
  const minTableWidth = columns.length > 0
    ? `${Math.min(4000, columns.length * 128 + (selectable ? 48 : 0) + (showActionsCol ? 132 : 0))}px`
    : null;
  // ONE min-width word, so no ordering decides which survives tailwind-merge:
  // `max(100%, floor)` states both rules at once — fill the container, and never
  // fall below the readable floor. The var keeps its own 0px fallback so the class
  // is meaningful even if styleVars drops the value.
  const tableMinW = minTableWidth != null ? 'min-w-[max(100%,var(--fr-dt-minw,0px))]' : 'min-w-full';

  // The table's accessible name, which a <caption> is the only element that can
  // carry from INSIDE the table (the heading a screen places above it is not
  // reachable from here). An authored `caption` — or `ariaLabel` for a name that
  // is not meant to print — is the spec's own text; with neither, the name is
  // derived from the column labels and stays visually hidden, since a spec that
  // named nothing must not gain on-screen copy it did not ask for.
  const captionText = typeof p.caption === 'string' && p.caption.trim() ? p.caption : null;
  const headingList = columns.map((c) => (typeof c.label === 'string' ? c.label.trim() : '')).filter(Boolean);
  const hiddenName =
    captionText != null
      ? null
      : typeof p.ariaLabel === 'string' && p.ariaLabel.trim()
        ? p.ariaLabel
        : headingList.length
          ? `Data table: ${headingList.join(', ')}`
          : null;

  const table = (
    <table
      // resizable → fixed layout so each column honors its px width exactly (auto
      // layout treats width as a mere suggestion + redistributes). w-max lets the
      // table grow past the container (the wrapper scrolls) as columns widen; the
      // min-width floor holds in both layouts.
      className={cn(tableRecipe({ size, bordered }), resizable && '[table-layout:fixed] w-max', tableMinW)}
      style={styleVars(
        { var: '--fr-dt-minw', value: minTableWidth, kind: 'dim', opts: { units: ['px'], max: 4000 } },
        { var: '--fr-dt-accent', value: p.accent, kind: 'color' },
        { var: '--fr-dt-header', value: p.headerColor, kind: 'color' },
        /* Ink PAIRED with the authored header fill. Once headerColor actually
           painted (it was inert — .fr-band out-ranked it), the header read
           2.64:1: #18181b on #1d4ed8. The muted token knows nothing about the
           colour an author just put underneath it, so the ink is derived from
           that fill by luminance and only when one is named. */
        { var: '--fr-dt-muted', value: (p.headerColor != null ? surfaceInk(p.headerColor) : null) as string, kind: 'raw' },
        { var: '--fr-dt-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-dt-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        { var: '--fr-dt-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      {/* First child of <table>, which is where the element is legal. */}
      {captionText != null ? (
        <caption className="caption-bottom pt-2 text-[0.8125rem] [color:var(--fr-dt-muted,var(--color-muted-foreground))]">{captionText}</caption>
      ) : hiddenName != null ? (
        <caption className="sr-only">{hiddenName}</caption>
      ) : null}
      {/* A sticky head is only claimed where a vertical scroll region exists to
          stick within — `capped`. Everywhere else the head has nothing to outlive. */}
      <thead className={capped ? 'sticky top-0 z-10' : undefined}>
        <tr>
          {selectable && (
            <th
              scope="col"
              className={cn(headRecipe({ bordered }), cellPad({ density }), resizable ? 'w-[46px]' : 'w-0', capped && headOpaqueBg)}
              style={headBg(capped)}
            >
              {/* The label is the TARGET: a bare 16px checkbox is a 16px target
                  (WCAG 2.5.8 wants 24), and the cell's padding does not count
                  because the cell is not clickable. The input keeps its own
                  aria-label, so the empty label adds no naming ambiguity. */}
              <label className="inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  className={checkboxCls}
                  checked={allOnPageSelected}
                  aria-label="Select all rows on this page"
                  onChange={toggleAll}
                />
              </label>
            </th>
          )}
          {columns.map((col, ci) => {
            const align = normAlign(col.align);
            const active = sortBy === col.key && activeDir !== 'none';
            const isPinned = canPinFirst && ci === 0;
            // Pinned (x) or capped (y): either way something scrolls beneath this cell.
            const scrolledUnder = isPinned || capped;
            return (
              <th
                key={col.key}
                scope="col"
                className={cn('relative', headRecipe({ align, bordered }), cellPad({ density }), isPinned && pinClsHead, scrolledUnder && headOpaqueBg)}
                style={{ ...colStyle(col, ci), ...headBg(scrolledUnder) }}
                aria-sort={col.sortable ? ariaSortFor(sortBy === col.key, activeDir) : undefined}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className={cn(
                      sortBtn({ align }),
                      'max-w-full',
                      // Accent tints only the ACTIVE sort (label + glyph), and its
                      // hover stays accent (no foreground flash); inactive heads
                      // keep the plain foreground hover.
                      p.accent != null && active
                        ? 'text-[color:var(--fr-dt-accent,var(--fr-accent))] hover:text-[color:var(--fr-dt-accent,var(--fr-accent))]'
                        : 'hover:text-foreground',
                    )}
                    onClick={() => toggleSort(col.key)}
                  >
                    {/* A column heading is short and load-bearing, so it keeps
                        its own min-content width and wraps — and the DATA cell
                        below now wraps with it rather than ellipsising, so a
                        narrow column costs the row height, never a word. */}
                    <span title={col.label}>{col.label}</span>
                    <span className="shrink-0">
                      <SortGlyph dir={active ? activeDir : 'none'} />
                    </span>
                  </button>
                ) : (
                  <span className="block" title={col.label}>{col.label}</span>
                )}
                {resizable && (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${col.label}`}
                    className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none [background:color-mix(in_srgb,var(--fr-dt-accent,var(--color-border))_45%,transparent)] opacity-0 hover:opacity-100"
                    onPointerDown={(e) => onResizeDown(ci, e)}
                    onPointerMove={onResizeMove}
                    onPointerUp={onResizeUp}
                  />
                )}
              </th>
            );
          })}
          {showActionsCol && (
            // No sticky-opacity `inherit` here: this cell is pinned horizontally, and
            // `inherit` resolves to the transparent row — the scrolled-under column
            // headers would print straight onto "Actions". `pinRightHead` paints the
            // opaque fill instead, and --fr-dt-header still wins when the author
            // sets headerColor.
            <th
              scope="col"
              className={cn(headRecipe({ align: 'end', bordered }), cellPad({ density }), resizable ? 'w-[150px]' : 'w-0', pinRightHead)}
            >
              {/* NO VISIBLE LABEL. Removed for two reasons the
                  previous note did not address — it defended the word on WIDTH ("it has
                  room for it at any width"), which was never the objection:
                    1. IT IS HARDCODED ENGLISH. Many action labels are
                       non-Latin (デマンド警告を送る, Leistungsnachweis exportieren). An
                       English "Actions" heading over a Japanese table is simply wrong,
                       and unlike every other column header this one is not authored —
                       there is no `label` for the model to translate.
                    2. IT IS REDUNDANT. The buttons in the rail now read as buttons
                       (the chip carries its own ground, and the header no longer paints
                       a stray band), so a word announcing "these are actions" says what
                       the column already says.
                  The accessible name STAYS: a th with no name leaves screen-reader users
                  with an unannounced column, which would trade a visual nit for a real
                  accessibility regression. sr-only keeps it in the a11y tree only. */}
              {showActions && <span className="sr-only">Actions</span>}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {slice.length === 0 && !adding ? (
          <tr>
            <td
              className={cn(bodyCell({ bordered }), cellPad({ density }), 'text-center [color:var(--fr-dt-muted,var(--color-muted-foreground))]')}
              colSpan={colSpanAll}
            >
              {emptyText}
            </td>
          </tr>
        ) : (
          slice.map((it, i) => {
            const row = it.data;
            const rid = it.rid;
            const isSelected = selected.has(rid);
            const isEditing = editingRid === rid;
            const rowLocked = it.locked === true;
            // A pinned/frozen cell must be OPAQUE to cover horizontally-scrolled
            // content, but still match the row band — composite the zebra/selection
            // tint OVER the card token (opaque), not a flat bg-card.
            const zebra = striped && (start + i) % 2 === 1;
            const pinBg = isSelected
              ? '[background:color-mix(in_srgb,var(--fr-dt-accent,var(--fr-accent))_12%,var(--color-card))]'
              : zebra
                ? '[background:color-mix(in_srgb,var(--color-muted)_30%,var(--color-card))]'
                : 'bg-card';
            // Same three bands, one step deeper. Real classes (frayme.css), not Tailwind
            // arbitrary values: these are composed at runtime, so the complete class
            // string never appears in source and the scanner cannot extract it.
            const pinActionsBg = isSelected
              ? 'fr-dt-actions fr-dt-actions--selected'
              : zebra
                ? 'fr-dt-actions fr-dt-actions--zebra'
                : 'fr-dt-actions';
            return (
              <tr
                key={rid}
                aria-selected={selectable ? isSelected : undefined}
                className={cn(
                  !isEditing && hoverable && 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50',
                  zebra && 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]/30',
                  // selected-row tint via the accent value channel (token fallback).
                  isSelected && '[background:color-mix(in_srgb,var(--fr-dt-accent,var(--fr-accent))_12%,transparent)]',
                )}
              >
                {selectable && (
                  <td className={cn(bodyCell({ bordered }), cellPad({ density }), 'w-0')}>
                    {/* Locked rows are unselectable — the cell stays for column alignment. */}
                    {!rowLocked && (
                      // Same 24px target floor as the header box above.
                      <label className="inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          className={checkboxCls}
                          checked={isSelected}
                          aria-label={`Select row ${start + i + 1}`}
                          onChange={() => toggleRow(rid)}
                        />
                      </label>
                    )}
                  </td>
                )}
                {isEditing ? (
                  renderEditorRowCells({
                    current: draft,
                    patch: (key, v) => setDraft((d) => ({ ...d, [key]: v })),
                    onSave: saveEdit,
                    onCancel: cancelEdit,
                  })
                ) : (
                  <>
                    {columns.map((col, ci) => {
                      const align = normAlign(col.align);
                      const cell = row?.[col.key];
                      const isPinned = canPinFirst && ci === 0;
                      return (
                        <td
                          key={col.key}
                          className={cn(bodyCell({ align, bordered }), cellPad({ density }), isPinned && cn(pinClsBody, pinBg, pinInk, 'font-medium'))}
                          style={colStyle(col, ci)}
                        >
                          {/* A data cell wraps, it does not clip. `truncate` is
                              white-space:nowrap, and under an authored
                              `col.width` (or a drag-resized fixed layout) that
                              made the cell one unbreakable line sliced to the
                              column — a cap that never relaxes, at any viewport.
                              Wrapping spends row height, which the table has,
                              instead of words, which it does not. The head above
                              already wraps for exactly this reason. */}
                          <span className="block break-words" title={formatCell(cell, col.format, col.prefix, col.suffix) || undefined}>
                            {formatCell(cell, col.format, col.prefix, col.suffix)}
                          </span>
                        </td>
                      );
                    })}
                    {showActionsCol && (
                      // KEPT nowrap, same contract as the editor row's rail: a
                      // sized-to-content button strip with no overflow:hidden —
                      // it holds a line, it never deletes one.
                      <td className={cn(bodyCell({ align: 'end', bordered }), cellPad({ density }), 'w-0 whitespace-nowrap', pinRightBody, pinActionsBg)}>
                        <div className="inline-flex items-center gap-1.5">
                          {rowActions.filter((a) => !(rowLocked && (a.id === 'edit' || a.id === 'delete'))).map((a) => {
                            const name = a.label ?? a.id;
                            const showIcon = typeof a.icon === 'string' && hasIcon(a.icon);
                            const iconOnly = showIcon && !a.label;
                            return (
                              <button
                                key={a.id}
                                type="button"
                                aria-label={name}
                                title={iconOnly ? name : undefined}
                                className={rowActionBtnCls(a.variant, iconOnly)}
                                disabled={a.disabled === true}
                                onClick={() => onRowAction(a, rid)}
                              >
                                {showIcon && <Icon name={a.icon as string} size={15} />}
                                {!iconOnly && <span>{name}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            );
          })
        )}
        {/* Trailing add-row editor (only while the add draft is open). */}
        {adding && (
          <tr className="[background:color-mix(in_srgb,var(--fr-dt-accent,var(--fr-accent))_6%,transparent)]">
            {selectable && <td className={cn(bodyCell({ bordered }), cellPad({ density }), 'w-0')} />}
            {renderEditorRowCells({
              current: addDraft,
              patch: (key, v) => setAddDraft((d) => ({ ...d, [key]: v })),
              onSave: saveAdd,
              onCancel: cancelAdd,
              allEditable: noEditableCols,
            })}
          </tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div
      className="w-full"
      style={styleVars(
        { var: '--fr-dt-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-dt-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-dt-accent', value: p.accent, kind: 'color' },
      )}
    >
      {/* Bulk-action bar — above the table, only when rows are selected. */}
      {selectable && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-frayme border border-[color:var(--fr-dt-border,var(--color-border))] bg-muted/40 px-3 py-2 text-sm">
          {/* `bg-muted/40` is a WASH, not a fill — 60% of what shows through is the
              container's surface — so this count inherits rather than resetting.
              On a `Card { bg:"#12161f", color:"#e2e6f0" }` the bar composites to
              rgb(108,111,117); text-foreground read 3.62:1 there, the inherited ink
              4.04:1. Neither clears 4.5 (that is the wash's own translucency, a
              separate problem), but the reset was measurably the worse of the two
              and byte-identical to this at the top level. */}
          <span className="font-medium text-current" aria-live="polite">{`${selected.size} selected`}</span>
          <div className="ml-auto inline-flex flex-wrap items-center gap-1.5">
            {deleteAction && (
              <button
                type="button"
                className={actionBtnCls('danger', false)}
                onClick={() => onBulk('__delete__', 'Delete selected', 'danger', deleteAction.confirm)}
              >
                {actionIcons && <Icon name="trash" size={14} />}
                Delete selected
              </button>
            )}
            {bulkActions.map((b) => {
              const variant: RowActionVariant = b.tone === 'primary' ? 'primary' : b.tone === 'danger' ? 'danger' : 'outline';
              return (
                <button
                  key={b.id}
                  type="button"
                  className={actionBtnCls(variant, false)}
                  disabled={b.disabled === true}
                  onClick={() => onBulk(b.id, b.label, variant, b.confirm)}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* fr-tabscroll-card (frayme.css): thin scrollbar + a card-toned right-edge
          fade attached to the scrolled content, so the columns that run past the
          host's width announce themselves instead of ending flush at its edge.
          A table floors itself at a readable width per column and scrolls rather
          than compressing, so this wrapper overflows on any narrow host. */}
      {capped ? (
        <div
          ref={scrollRef}
          className={cn('fr-tabscroll-card fr-scrollfade-y overflow-auto [max-height:var(--fr-dt-maxh)]', bordered && 'rounded-frayme border-solid [border-width:var(--fr-dt-bw,1px)] [border-color:var(--fr-dt-border,var(--color-border))]')}
          style={styleVars(
            { var: '--fr-dt-maxh', value: p.maxHeight, kind: 'dim', opts: { units: ['px', 'rem'], max: 1200 } },
            { var: '--fr-dt-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
          ) as CSSProperties}
        >
          {table}
        </div>
      ) : (
        <div ref={scrollRef} className={cn('fr-tabscroll-card w-full overflow-x-auto', bordered && 'rounded-frayme')}>{table}</div>
      )}

      {/* Footer — pagination + the Add-row button. Rendered when either exists. */}
      {(totalPages > 1 || addable) && (
        // The muted colour moved OFF this row and onto the page-label span below —
        // the one child that wants it. It used to sit here, which is why the three
        // buttons in this footer each had to re-assert `text-foreground` to climb
        // back OUT of muted: a hard reset to the global token that stranded them at
        // near-black inside an authored dark Card. With muted on the label, the
        // buttons inherit the surface's ink instead, and the computed default is
        // unchanged — an un-nested footer inherits --frayme-fg, which IS
        // --color-foreground (frayme.css:138).
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <div className="inline-flex items-center gap-3">
            {addable && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-frayme border border-[color:var(--fr-dt-border,var(--color-border))] px-2.5 py-1.5 text-current outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={adding}
                onClick={beginAdd}
              >
                <Icon name="plus" size={15} />
                <span>{addLabel}</span>
              </button>
            )}
            {totalPages > 1 && (
              // The footer's muted colour now lives HERE (see the row above): the
              // page counter is the only secondary text in this strip.
              <span aria-live="polite" className="[color:var(--fr-dt-muted,var(--color-muted-foreground))]">
                {p.pageLabel != null
                  ? formatPageLabel(p.pageLabel, currentPage, totalPages)
                  : `Page ${currentPage} of ${totalPages}`}
              </span>
            )}
          </div>
          {totalPages > 1 && (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-frayme border border-[color:var(--fr-dt-border,var(--color-border))] px-2.5 py-1.5 text-current outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage <= 1}
                aria-label={prevLabel}
                onClick={() => goToPage(currentPage - 1)}
              >
                <Icon name={prevIcon} size={15} />
                <span>{p.prevLabel ?? 'Prev'}</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-frayme border border-[color:var(--fr-dt-border,var(--color-border))] px-2.5 py-1.5 text-current outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage >= totalPages}
                aria-label={nextLabel}
                onClick={() => goToPage(currentPage + 1)}
              >
                <span>{p.nextLabel ?? 'Next'}</span>
                <Icon name={nextIcon} size={15} />
              </button>
            </div>
          )}
        </div>
      )}
      {/* One shared confirm modal — renders whichever row/bulk action carried a
          `confirm`, gating it before it runs (confirmation lives ON THE ACTION). */}
      {pending && (
        <FraymeConfirmModal
          config={{
            title: pending.config.title ?? undefined,
            message: pending.config.message ?? undefined,
            confirmLabel: pending.config.confirmLabel ?? undefined,
            cancelLabel: pending.config.cancelLabel ?? undefined,
            variant: pending.config.variant ?? undefined,
            confirmIcon: pending.config.confirmIcon,
          }}
          onConfirm={() => { const r = pending.run; setPending(null); r(); }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ── ColumnHeader ─────────────────────────────────────────────────────────── */

/* ColumnHeader is the one header in this file that really paints the muted band
   on itself AND puts muted-foreground text on it. (DataTable's own headRecipe
   carries the same two token classes but never renders that pair: the default
   head takes an inline `background: inherit` from headBg(), and every
   scrolled-under head takes headOpaqueBg's CARD fallback.) That pair was an
   a11y finding here — it measured 4.40:1 while --frayme-muted-fg was
   #71717a, under the 4.5 floor.

   NO local colour override, deliberately: the token moved to #52525b (zinc-600)
   in frayme.css and this band now reads 7.03:1 light / 5.88:1 dark. A local
   color-mix toward foreground was tried and measured first — it clears the floor
   too (8.11:1) but only by making this one header a DIFFERENT muted grey
   (#494951) from every other muted string in the system, which is the whole
   point of having the token. If this ever fails again, it fails for every muted
   surface at once and belongs in the token, not here. Guard:
   test/table-a11y.test.tsx re-measures this band from frayme.css. */
const colHeader = cva(
  'fr-band relative flex items-center gap-1 font-semibold [--fr-band-ink:var(--fr-ch-muted,var(--color-muted-foreground))] [--fr-band-authored:var(--fr-ch-header,transparent)] px-3 py-2.5 [width:var(--fr-ch-w,auto)] max-w-full',
  {
    variants: {
      align: { start: 'justify-start', center: 'justify-center', end: 'justify-end' },
    },
    defaultVariants: { align: 'start' },
  },
);

export function ColumnHeader({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    align?: Align | null;
    sortable?: boolean | null;
    sortDir?: SortDir | null;
    resizable?: boolean | null;
    width?: string | number | null;
    accent?: string | null;
    headerColor?: string | null;
    mutedColor?: string | null;
    borderColor?: string | null;
    borderWidthValue?: string | number | null;
  };
  const align = (p.align as Align | null) ?? 'start';
  const sortable = p.sortable === true;
  const resizable = p.resizable === true;
  // The header underline is OPT-IN — a props-less ColumnHeader stays underline-less
  // (byte-identical). Either border channel turns it on; it routes through
  // --fr-ch-border / --fr-ch-bw (token + 1px fallbacks), mirroring DataTable's head.
  const underline = p.borderColor != null || p.borderWidthValue != null;
  const emitWith = useIntrinsicEmit(emit, element);
  // Cycle the sort glyph (asc → desc → none) so a standalone header is
  // interactive on click, seeded from the authored sortDir. Route through
  // useLocalOrBound so the current sort direction lands in (bindable) spec.state
  // — an external Button can read it — mirroring the parent DataTable's sortDir.
  const [boundDir, setDir] = useBoundProp<SortDir>((p.sortDir as SortDir | null) ?? undefined, bindings?.sortDir);
  const dir: SortDir = boundDir ?? 'none';
  const active = dir !== 'none';

  function fireSort(): void {
    const nextDir: SortDir = dir === 'none' ? 'asc' : dir === 'asc' ? 'desc' : 'none';
    setDir(nextDir);
    emitWith('sort', { sortBy: p.label ?? null, sortDir: nextDir });
  }

  return (
    <div
      role="columnheader"
      aria-sort={sortable ? ariaSortFor(active, dir) : undefined}
      className={cn(
        colHeader({ align }),
        p.headerColor != null && '[--fr-band-authored:var(--fr-ch-header)]',
        p.width != null && '[width:var(--fr-ch-w)] max-w-full',
        // Opt-in bottom underline via arbitrary border-bottom props (no `border-b`
        // utility → no tw-merge width collision with the var-driven thickness).
        underline &&
          'border-solid [border-bottom-width:var(--fr-ch-bw,1px)] [border-bottom-color:var(--fr-ch-border,var(--color-border))]',
      )}
      style={styleVars(
        { var: '--fr-ch-header', value: p.headerColor, kind: 'color' },
        /* Ink PAIRED with the authored header fill. Once headerColor actually
           painted (it was inert — .fr-band out-ranked it), the header read
           2.64:1: #18181b on #1d4ed8. The muted token knows nothing about the
           colour an author just put underneath it, so the ink is derived from
           that fill by luminance and only when one is named. */
        { var: '--fr-ch-muted', value: (p.headerColor != null ? surfaceInk(p.headerColor) : null) as string, kind: 'raw' },
        { var: '--fr-ch-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-ch-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem'], max: 800 } },
        { var: '--fr-ch-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-ch-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        // accent lives on the ROOT (not the sort button) so BOTH the active sort
        // tint and the resize grip can read it.
        { var: '--fr-ch-accent', value: p.accent, kind: 'color' },
      )}
    >
      {sortable ? (
        <button
          type="button"
          className={cn(
            // Same box metrics as DataTable's sort button: a 2rem tap-target floor
            // plus padding, handed back to the header's own padding by the matching
            // negative margins so neither the header height nor the label moves.
            'inline-flex min-h-8 min-w-0 items-center gap-1 -my-1 -mx-1 px-1 py-1 rounded-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] hover:text-foreground',
            p.accent != null && active && '[color:var(--fr-ch-accent)]',
          )}
          onClick={fireSort}
        >
          {/* A standalone ColumnHeader is a flex child of whatever row the spec
              put it in, and every stack child carries min-width:0 (frayme.css) —
              so a nowrap label had its box shrink out from under it and lost the
              word that names the column. It wraps now, matching DataTable's own
              heads. No min-w-0 on the label itself — it is a LEAF, so its automatic
              minimum (min-content = its longest word) IS the floor that keeps the
              box from collapsing to one character per line; break-words stays as
              the shear guard for a word genuinely wider than the header. */}
          <span className="break-words" title={p.label}>{p.label}</span>
          <span className="shrink-0">
            <SortGlyph dir={dir} />
          </span>
        </button>
      ) : (
        // Same leaf treatment as the sortable branch: min-content floor, wraps.
        <span className="break-words" title={p.label}>{p.label}</span>
      )}

      {/* Render-only resize affordance — a visual grip, no real drag logic. */}
      {resizable && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize column"
          // The grip consumes the accent → borderColor → token chain (mirrors
          // DataGrid's accent-driven grip); unset channels keep the border token.
          className="absolute right-0 top-1/2 h-1/2 w-1 -translate-y-1/2 cursor-col-resize rounded-full [background:var(--fr-ch-accent,var(--fr-ch-border,var(--color-border)))]"
        />
      )}
    </div>
  );
}
