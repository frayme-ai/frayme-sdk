/**
 * CHILD-CYCLE GUARD — make the `children` graph a DAG before json-render sees it.
 *
 * Seen in production: the model streamed `"bracket": { children: [..., "bracket"] }`
 * and `"view-toggle": { children: ["view-toggle"] }`. json-render's ElementRenderer
 * maps `children` → nested ElementRenderer with no visited set, so a self-child (or
 * an ancestor cycle a → b → a) is an unbounded React work loop: no stack overflow,
 * just a tab pinned at 100% CPU. The strict catalog gate already names a cycle
 * (`resolution.ts`: "cycle in the children graph"), but streaming snapshots never
 * pass through it — the hang is mid-stream.
 *
 * The rule: one DFS over the children graph, root first, then every element not
 * reached from root (so the result is a DAG in full, not only under root). An
 * edge whose target is still ON THE DFS STACK is a back-edge — the element itself
 * or one of its ancestors — and is dropped; every other edge is kept in its
 * original order. Removing every back-edge of a DFS leaves an acyclic graph (any
 * cycle contains at least one), and a child shared by two parents (a diamond) is
 * a cross-edge, not a back-edge, so legal DAGs come through untouched.
 *
 * PURE. The input is never mutated: an acyclic spec returns the SAME reference
 * (so identity-keyed memos stay stable), a cyclic one gets a shallow copy in
 * which only the elements that lost an edge are re-created. O(V + E).
 *
 * NO MODULE-LEVEL CACHE, deliberately. `@frayme/api`'s compose stream hands the
 * same accumulator object to every `op` handler and mutates it in place
 * (applySpecStreamPatch), and the AG-UI fold does the same — a WeakMap keyed on
 * the `elements` object would answer "no cycle" for a snapshot that has since
 * grown one. Memoise at the React seam instead (FraymeRenderer keys on spec
 * identity, the same contract its renderSpec memo already relies on).
 */
import { isDev } from './dev.js';

/** One dropped edge: `parent.children[index]` referenced `child`. */
export interface DroppedChildEdge {
  parent: string;
  child: string;
  /** Position in the ORIGINAL children array. */
  index: number;
}

export interface CutChildCyclesResult<T> {
  /** The input itself when nothing was dropped; otherwise a structurally-shared copy. */
  spec: T;
  dropped: readonly DroppedChildEdge[];
}

type SpecLike = { root?: unknown; elements?: unknown };

const GRAY = 1; // on the DFS stack — an ancestor of the node being expanded
const BLACK = 2; // fully expanded

function childrenOf(el: unknown): readonly unknown[] {
  if (!el || typeof el !== 'object') return [];
  const kids = (el as { children?: unknown }).children;
  return Array.isArray(kids) ? kids : [];
}

/**
 * Silent form: the cut spec plus the list of dropped edges. Use this when you
 * want to report the repair yourself (a repair log, a metric); `cutChildCycles`
 * wraps it with the one-line dev warning.
 */
export function cutChildCyclesWithReport<T>(spec: T): CutChildCyclesResult<T> {
  const s = spec as unknown as SpecLike | null | undefined;
  if (!s || typeof s !== 'object') return { spec, dropped: [] };
  const elements = s.elements;
  if (!elements || typeof elements !== 'object') return { spec, dropped: [] };
  const els = elements as Record<string, unknown>;

  const color = new Map<string, typeof GRAY | typeof BLACK>();
  const cuts = new Map<string, Set<number>>();
  const dropped: DroppedChildEdge[] = [];

  // Iterative DFS: a streaming snapshot is unvalidated, so its depth is unbounded
  // and a recursive walk could overflow the stack on a pathological chain.
  const visit = (start: string): void => {
    if (color.has(start)) return;
    const stack: Array<{ id: string; kids: readonly unknown[]; i: number }> = [];
    const enter = (id: string): void => {
      color.set(id, GRAY);
      stack.push({ id, kids: childrenOf(els[id]), i: 0 });
    };
    enter(start);
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      if (top.i >= top.kids.length) {
        color.set(top.id, BLACK);
        stack.pop();
        continue;
      }
      const index = top.i++;
      const child = top.kids[index];
      if (typeof child !== 'string') continue; // malformed entry — not ours to judge
      const state = color.get(child);
      if (state === GRAY) {
        // Back-edge: the element itself (child === top.id) or an ancestor.
        let set = cuts.get(top.id);
        if (!set) cuts.set(top.id, (set = new Set()));
        set.add(index);
        dropped.push({ parent: top.id, child, index });
        continue;
      }
      if (state === BLACK) continue; // shared child (DAG) — legal, keep
      if (!Object.hasOwn(els, child)) continue; // dangling id — json-render warns + skips
      enter(child);
    }
  };

  const root = s.root;
  if (typeof root === 'string' && Object.hasOwn(els, root)) visit(root);
  for (const id of Object.keys(els)) visit(id);

  if (dropped.length === 0) return { spec, dropped };

  const next: Record<string, unknown> = {};
  for (const [id, el] of Object.entries(els)) {
    const set = cuts.get(id);
    if (!set) {
      next[id] = el;
      continue;
    }
    const kids = childrenOf(el);
    next[id] = { ...(el as object), children: kids.filter((_, i) => !set.has(i)) };
  }
  return { spec: { ...(spec as object), elements: next } as unknown as T, dropped };
}

/**
 * Return a spec whose every element's `children` drops (a) its own id and (b) any
 * ancestor along the children graph — the back-edges that would make json-render
 * recurse forever. Order of the surviving children is preserved. Same reference
 * back when there is nothing to cut. Logs ONE `console.warn` per call listing the
 * dropped edges, outside production.
 */
export function cutChildCycles<T>(spec: T): T {
  const { spec: cut, dropped } = cutChildCyclesWithReport(spec);
  if (dropped.length > 0 && isDev) {
    const edges = dropped
      .map((d) => (d.parent === d.child ? `${d.parent} → itself` : `${d.parent} → ${d.child}`))
      .join(', ');
    console.warn(
      `[frayme] cutChildCycles: dropped ${dropped.length} cyclic child edge${dropped.length === 1 ? '' : 's'} ` +
        `(json-render would recurse forever): ${edges}`,
    );
  }
  return cut;
}
