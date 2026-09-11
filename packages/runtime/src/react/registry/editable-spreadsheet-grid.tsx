'use client';
import { useState } from 'react';
import type { ReactNode, KeyboardEvent } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { clampInt } from './_num.js';
import { useGridEditState, type GridSeed } from './_gridedit.js';
import { useLocalOrBound as useBoundProp } from './_state.js';

/* Catalog component (editable-spreadsheet-grid): EditableSpreadsheetGrid — bounded
 * single-cell-edit grid over useGridEditState. OWNS the matrix; edit one cell at a
 * time (click/Enter → input → commit on blur/Enter, Escape cancels). NOT formulas.
 * Sticky header uses opaque bg-card. Escaped text; emits in handlers. */

type Cell = string | number | boolean | null;
interface ColDef {
  key: string;
  label?: string | null;
  type?: 'text' | 'number' | 'select' | null;
  readonly?: boolean | null;
  align?: 'left' | 'center' | 'right' | null;
  options?: string[] | null;
}

const DEMO_COLS: ColDef[] = [
  { key: 'item', label: 'Line item' },
  { key: 'qty', label: 'Qty', type: 'number', align: 'right' },
  { key: 'price', label: 'Unit £', type: 'number', align: 'right' },
  { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Approved', 'Paid'] },
];
const DEMO_ROWS = [
  { item: 'Design retainer', qty: 1, price: 4200, status: 'Approved' },
  { item: 'API credits', qty: 12, price: 99, status: 'Paid' },
  { item: 'Support hours', qty: 8, price: 120, status: 'Draft' },
];

const ALIGN: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
const disp = (v: Cell): string => (v == null ? '' : String(v));

export function EditableSpreadsheetGrid({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    columns?: ColDef[] | null;
    rows?: (Cell[] | Record<string, Cell>)[] | null;
    value?: Cell[][] | null;
    editable?: boolean | null;
    lockedRows?: number[] | null;
    showRowHeaders?: boolean | null;
    rowLabels?: string[] | null;
    zebra?: boolean | null;
    stickyHeader?: boolean | null;
    allowAddRow?: boolean | null;
    showSave?: boolean | null;
    saveLabel?: string | null;
    emptyLabel?: string | null;
    rowHeight?: number | null;
    accent?: unknown;
    headerTextColor?: unknown;
    gridColor?: unknown;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const [buffer, setBuffer] = useState('');

  const columns = Array.isArray(p.columns) && p.columns.length ? p.columns.slice(0, 40) : DEMO_COLS;
  const editable = p.editable !== false;
  // Permission fidelity: 0-based row indices that are end-user-immutable
  // (formula/total/template rows) while the rest of the grid stays editable.
  const lockedRows = new Set(Array.isArray(p.lockedRows) ? p.lockedRows.filter((n) => Number.isInteger(n) && n >= 0) : []);
  const showRowHeaders = p.showRowHeaders === true;
  const zebra = p.zebra !== false;
  const sticky = p.stickyHeader !== false;
  const rowHeight = clampInt(p.rowHeight, 24, 80, 36);
  const providedRows = Array.isArray(p.rows);

  const seed = (): GridSeed<Cell> => {
    const raw = providedRows ? (p.rows as (Cell[] | Record<string, Cell>)[]) : DEMO_ROWS;
    const rows: Cell[][] = raw.map((row) => (Array.isArray(row) ? columns.map((_c, ci) => (row[ci] ?? null)) : columns.map((c) => ((row as Record<string, Cell>)[c.key] ?? null))));
    return { rows, rowCount: rows.length, colCount: columns.length };
  };
  const seedKey = JSON.stringify({ c: p.columns ?? null, r: p.rows ?? null });

  const onChange = (r: number, c: number, value: Cell, prev: Cell): void => {
    emitWith('change', { name: columns[c]?.key ?? String(c), value, rowIndex: r, columnIndex: c, previous: prev });
  };
  const g = useGridEditState<Cell>(seed, seedKey, { onChange });
  // Bindable composite: the full cell matrix lands in spec.state so an external Button
  // can read the edited grid without replaying the change stream. Local-fallback when unbound.
  const [, setBoundValue] = useBoundProp<Cell[][]>(
    (p.value ?? undefined) as Cell[][] | undefined,
    (bindings as { value?: unknown } | undefined)?.value,
  );
  const mirror = (grid: Cell[][]): void => { setBoundValue(grid.map((row) => row.slice())); };

  const vars = styleVars(
    { var: '--fr-sg-accent', value: p.accent, kind: 'color' },
    { var: '--fr-sg-head', value: p.headerTextColor, kind: 'color' },
    { var: '--fr-sg-grid', value: p.gridColor, kind: 'color' },
  );
  const gridB = 'border-[color:var(--fr-sg-grid,var(--color-border))]';
  const headText = 'text-[color:var(--fr-sg-head,var(--color-muted-foreground))]';

  const startEdit = (r: number, c: number): void => {
    const col = columns[c];
    g.setSelected({ r, c });
    emitWith('select', { value: g.grid[r]?.[c] ?? null, label: disp(g.grid[r]?.[c] ?? null), id: col?.key ?? String(c), rowIndex: r, columnIndex: c });
    if (!editable || col?.readonly || lockedRows.has(r)) return;
    setBuffer(disp(g.grid[r]?.[c] ?? null));
    g.setEditing({ r, c });
  };
  const commitEdit = (r: number, c: number): void => {
    const col = columns[c];
    let val: Cell = buffer;
    if (col?.type === 'number') {
      const n = Number(buffer);
      val = buffer.trim() === '' ? null : Number.isFinite(n) ? n : (g.grid[r]?.[c] ?? null);
    }
    g.setCell(r, c, val);
    mirror(g.gridRef.current);
    g.setEditing(null);
  };
  const onCellKey = (e: KeyboardEvent, r: number, c: number): void => {
    if (g.editing) return; // input owns keys while editing
    if (e.key === 'ArrowUp') { e.preventDefault(); g.moveSelection(-1, 0); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); g.moveSelection(1, 0); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); g.moveSelection(0, -1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); g.moveSelection(0, 1); }
    else if (e.key === 'Enter') { e.preventDefault(); startEdit(r, c); }
  };

  const addRow = (): void => {
    const at = g.rowCount;
    const columnKeys = columns.map((col) => col.key);
    // Blank row appended at `at`; carry insert position + column keys so the host adds it deterministically.
    emitWith('commit', { reason: 'addRow', at, rowCount: at + 1, columnKeys, row: columnKeys.map(() => null as Cell) });
  };
  const save = (): void => {
    const grid = g.grid;
    const changes: { rowIndex: number; columnIndex: number; columnKey: string; value: Cell }[] = [];
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (g.isDirty(r, c)) {
          changes.push({ rowIndex: r, columnIndex: c, columnKey: columns[c]?.key ?? String(c), value: row[c] ?? null });
        }
      }
    }
    mirror(grid);
    emitWith('commit', { reason: 'save', rowCount: g.rowCount, changes, rows: grid.map((row) => row.slice()) });
    g.clearDirty();
  };

  const rowLabelAt = (r: number): string => (Array.isArray(p.rowLabels) && p.rowLabels[r] != null ? String(p.rowLabels[r]) : String(r + 1));
  const isEmpty = g.rowCount === 0;

  return (
    <div style={vars} className={cn('w-full overflow-hidden rounded-lg border bg-card', gridB)}>
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {showRowHeaders && <th scope="col" className={cn('border-b px-2 py-2 text-left text-xs font-semibold', sticky && 'sticky top-0 z-10 bg-card', gridB, headText)} />}
              {columns.map((col, ci) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn('border-b px-2.5 py-2 text-xs font-semibold', ALIGN[col.align ?? 'left'], sticky && 'sticky top-0 z-10 bg-card', gridB, headText)}
                >
                  {col.label ?? col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={columns.length + (showRowHeaders ? 1 : 0)} className={cn('px-2 py-10 text-center text-sm', headText)}>
                  {p.emptyLabel ?? 'No rows yet'}
                </td>
              </tr>
            ) : (
              g.grid.map((row, r) => (
                <tr key={r} className={cn(zebra && r % 2 === 1 && 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]/30')}>
                  {showRowHeaders && <th scope="row" className={cn('border-b px-2 text-left text-xs font-medium', gridB, headText)} style={{ height: `${rowHeight}px` }}>{rowLabelAt(r)}</th>}
                  {row.map((val, c) => {
                    const col = columns[c];
                    const isSel = g.selected?.r === r && g.selected?.c === c;
                    const isEd = g.editing?.r === r && g.editing?.c === c;
                    const ro = !editable || col?.readonly === true || lockedRows.has(r);
                    return (
                      <td
                        key={c}
                        role="gridcell"
                        tabIndex={isSel ? 0 : -1}
                        aria-readonly={ro}
                        onClick={() => startEdit(r, c)}
                        onKeyDown={(e) => onCellKey(e, r, c)}
                        style={{ height: `${rowHeight}px` }}
                        className={cn(
                          'border-b px-2.5 py-1 outline-none', ALIGN[col?.align ?? 'left'], gridB,
                          !ro && 'cursor-text', ro && 'cursor-default',
                          isSel && !isEd && 'ring-2 ring-inset ring-[color:var(--fr-sg-accent,var(--fr-accent))]',
                        )}
                      >
                        {isEd ? (
                          col?.type === 'select' ? (
                            <select
                              autoFocus
                              value={buffer}
                              onChange={(e) => { setBuffer(e.target.value); }}
                              onBlur={() => commitEdit(r, c)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(r, c); } else if (e.key === 'Escape') { e.preventDefault(); g.setEditing(null); } }}
                              className="w-full bg-transparent text-sm outline-none"
                            >
                              <option value=""></option>
                              {(col.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              autoFocus
                              type={col?.type === 'number' ? 'number' : 'text'}
                              value={buffer}
                              onChange={(e) => setBuffer(e.target.value)}
                              onBlur={() => commitEdit(r, c)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(r, c); } else if (e.key === 'Escape') { e.preventDefault(); g.setEditing(null); } }}
                              className={cn('w-full bg-transparent text-sm outline-none', ALIGN[col?.align ?? 'left'])}
                            />
                          )
                        ) : (
                          // KEPT: a spreadsheet cell is the fixed-single-line
                          // contract itself — every <td> carries an explicit
                          // `rowHeight` px height, so wrapping would spill out of
                          // a row that cannot grow. The full value stays reachable
                          // (title, and one click swaps the cell for its input).
                          <span className={cn('block truncate text-foreground', g.isDirty(r, c) && 'font-medium')} title={disp(val) || undefined}>{disp(val)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(p.allowAddRow === true || p.showSave === true) && (
        <div className={cn('flex items-center justify-between gap-2 border-t px-3 py-2', gridB)}>
          {p.allowAddRow === true && editable ? (
            <button type="button" onClick={addRow} className={cn('text-xs font-medium text-[color:var(--fr-sg-accent,var(--color-primary))] hover:underline')}>+ Add row</button>
          ) : <span />}
          {p.showSave === true && editable && (
            <button type="button" onClick={save} disabled={g.dirtyCount === 0} className="rounded-md bg-[color:var(--fr-sg-accent,var(--color-foreground))] px-3 py-1.5 text-sm font-semibold text-card hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sg-accent,var(--fr-accent))_20%,transparent)]">
              {p.saveLabel ?? 'Save'} {g.dirtyCount > 0 && `(${g.dirtyCount})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
