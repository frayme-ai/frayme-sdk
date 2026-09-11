'use client';
import { useState, useRef, useEffect } from 'react';
import { clampInt } from './_num.js';

/* _doclist — headless ordered-list-editing engine (button/keyboard reorder, NO
 * drag). Shared owns-the-set discipline for list-shaped components. Because there
 * is no pointer capture and the block DOM never moves under a captured pointer,
 * the entire re-parenting / pointercancel / stuck-drag bug class is structurally
 * impossible here.
 *
 * Discipline (matches the production contract): seeds ONE useState from seed()
 * reading STATIC props only (never Date/window/random); re-seeds in an effect
 * keyed on seedKey (a JSON string of the authored input) and resets focus; caps
 * the working array at max at seed AND every insert; every mutator computes
 * `next` from a ref, calls setItems(next), THEN the onChange callback — onChange
 * is NEVER invoked inside a setState updater, and the engine itself NEVER emits
 * (the consumer wires onChange → emitWith in its handler). */

export type ListMeta<T> = {
  reason: 'move' | 'insert' | 'remove' | 'edit';
  fromIndex?: number;
  toIndex?: number;
  index?: number;
  item?: T;
};

export interface OrderedList<T> {
  items: T[];
  move: (index: number, dir: -1 | 1) => void;
  moveTo: (from: number, to: number) => void;
  insertAfter: (index: number, item: T) => void;
  removeAt: (index: number) => void;
  update: (index: number, patch: Partial<T>) => void;
  setItems: (next: T[]) => void;
  focusIndex: number | null;
  setFocusIndex: (i: number | null) => void;
  atCap: boolean;
}

export function useOrderedList<T>(
  seed: () => T[],
  seedKey: string,
  opts?: { max?: number; onChange?: (items: T[], meta: ListMeta<T>) => void },
): OrderedList<T> {
  const max = opts?.max ?? 256;
  const cap = (arr: T[]): T[] => (arr.length > max ? arr.slice(0, max) : arr);

  const seedRef = useRef(seed);
  seedRef.current = seed;
  const onChangeRef = useRef(opts?.onChange);
  onChangeRef.current = opts?.onChange;

  const [items, setItemsState] = useState<T[]>(() => cap(seedRef.current()));
  const itemsRef = useRef<T[]>(items);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  // Re-seed when the authored input changes (host recompose). STATIC props only.
  useEffect(() => {
    const s = cap(seedRef.current());
    itemsRef.current = s;
    setItemsState(s);
    setFocusIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  // The single write-path: mirror to the ref, set state, THEN notify (never inside
  // an updater, so the consumer's emit can't fire a cross-component setState mid-render).
  const commit = (next: T[], meta: ListMeta<T>): void => {
    const capped = cap(next);
    itemsRef.current = capped;
    setItemsState(capped);
    onChangeRef.current?.(capped, meta);
  };

  const move = (index: number, dir: -1 | 1): void => {
    const cur = itemsRef.current;
    const to = index + dir;
    if (index < 0 || index >= cur.length || to < 0 || to >= cur.length) return;
    const next = cur.slice();
    const [it] = next.splice(index, 1);
    next.splice(to, 0, it);
    commit(next, { reason: 'move', fromIndex: index, toIndex: to, item: it });
    setFocusIndex(to);
  };

  const moveTo = (from: number, to: number): void => {
    const cur = itemsRef.current;
    const f = clampInt(from, 0, cur.length - 1, 0);
    const t = clampInt(to, 0, cur.length - 1, 0);
    if (f === t || !cur.length) return;
    const next = cur.slice();
    const [it] = next.splice(f, 1);
    next.splice(t, 0, it);
    commit(next, { reason: 'move', fromIndex: f, toIndex: t, item: it });
    setFocusIndex(t);
  };

  const insertAfter = (index: number, item: T): void => {
    const cur = itemsRef.current;
    if (cur.length >= max) return;
    const at = clampInt(index, -1, cur.length - 1, cur.length - 1) + 1;
    const next = cur.slice();
    next.splice(at, 0, item);
    commit(next, { reason: 'insert', index: at, item });
    setFocusIndex(at);
  };

  const removeAt = (index: number): void => {
    const cur = itemsRef.current;
    if (index < 0 || index >= cur.length) return;
    const item = cur[index];
    const next = cur.filter((_, i) => i !== index);
    commit(next, { reason: 'remove', index, item });
    setFocusIndex(next.length ? Math.max(0, index - 1) : null);
  };

  const update = (index: number, patch: Partial<T>): void => {
    const cur = itemsRef.current;
    if (index < 0 || index >= cur.length) return;
    const next = cur.map((it, i) => (i === index ? { ...it, ...patch } : it));
    commit(next, { reason: 'edit', index, item: next[index] });
  };

  const setItems = (next: T[]): void => commit(next, { reason: 'edit' });

  return { items, move, moveTo, insertAfter, removeAt, update, setItems, focusIndex, setFocusIndex, atCap: items.length >= max };
}
