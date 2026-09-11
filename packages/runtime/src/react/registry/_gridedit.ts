'use client';
import { useState, useRef, useEffect } from 'react';
import { clampInt } from './_num.js';

/* _gridedit — headless 2D cell-edit engine (EditableSpreadsheetGrid + PermissionMatrix).
 *
 * The grid analogue of _timegrid/_canvas: owns a rows×cols matrix + selection +
 * editing coord + dirty set. Same disciplines — single write-path + ref mirror,
 * JSON seedKey re-seed, clampInt-guarded caps, NO wall-clock/random/window at seed.
 * The consumer's seed() normalizes untrusted input to a clean matrix; the engine
 * caps it (a 10k×10k spec renders bounded) and owns all mutation. onChange runs
 * AFTER setState in the handler — never inside a setState updater, and the engine
 * never emits. Keyboard navigation is PURE geometry (clamped), disabled-cell
 * skipping is the consumer's bounded post-step. */

export const MAX_GRID_ROWS = 200;
export const MAX_GRID_COLS = 40;
export const MAX_GRID_CELLS = 4000;

export interface GridCoord {
  r: number;
  c: number;
}
export interface GridSeed<T> {
  rows: T[][];
  rowCount: number;
  colCount: number;
}
export interface GridEdit<T> {
  grid: T[][];
  rowCount: number;
  colCount: number;
  selected: GridCoord | null;
  setSelected: (c: GridCoord | null) => void;
  editing: GridCoord | null;
  setEditing: (c: GridCoord | null) => void;
  setCell: (r: number, c: number, value: T) => void;
  isDirty: (r: number, c: number) => boolean;
  dirtyCount: number;
  clearDirty: () => void;
  moveSelection: (dr: number, dc: number) => void;
  gridRef: React.MutableRefObject<T[][]>;
}

function capSeed<T>(s: GridSeed<T>): GridSeed<T> {
  const colCount = Math.max(0, Math.min(s.colCount, MAX_GRID_COLS));
  let rows = s.rows.slice(0, MAX_GRID_ROWS).map((r) => r.slice(0, colCount || MAX_GRID_COLS));
  if (colCount > 0) {
    const maxRows = Math.min(rows.length, Math.floor(MAX_GRID_CELLS / colCount));
    rows = rows.slice(0, maxRows);
  }
  return { rows, rowCount: rows.length, colCount };
}

export function useGridEditState<T>(seed: () => GridSeed<T>, seedKey: string, opts?: { onChange?: (r: number, c: number, value: T, prev: T) => void }): GridEdit<T> {
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const onChangeRef = useRef(opts?.onChange);
  onChangeRef.current = opts?.onChange;

  const [grid, setGrid] = useState<T[][]>(() => capSeed(seedRef.current()).rows);
  const gridRef = useRef<T[][]>(grid);
  gridRef.current = grid;
  const [selected, setSelected] = useState<GridCoord | null>(null);
  const [editing, setEditing] = useState<GridCoord | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const s = capSeed(seedRef.current());
    gridRef.current = s.rows;
    setGrid(s.rows);
    setSelected(null);
    setEditing(null);
    setDirty(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;

  const setCell = (r: number, c: number, value: T): void => {
    const cur = gridRef.current;
    if (r < 0 || r >= cur.length || c < 0 || c >= (cur[r]?.length ?? 0)) return;
    const prev = cur[r][c];
    if (prev === value) return;
    const next = cur.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row));
    gridRef.current = next;
    setGrid(next);
    setDirty((s) => new Set(s).add(`${r},${c}`));
    onChangeRef.current?.(r, c, value, prev);
  };

  const moveSelection = (dr: number, dc: number): void => {
    setSelected((sel) => {
      const base = sel ?? { r: 0, c: 0 };
      return { r: clampInt(base.r + dr, 0, Math.max(0, rowCount - 1), 0), c: clampInt(base.c + dc, 0, Math.max(0, colCount - 1), 0) };
    });
  };

  return {
    grid,
    rowCount,
    colCount,
    selected,
    setSelected,
    editing,
    setEditing,
    setCell,
    isDirty: (r, c) => dirty.has(`${r},${c}`),
    dirtyCount: dirty.size,
    clearDirty: () => setDirty(new Set()),
    moveSelection,
    gridRef,
  };
}
