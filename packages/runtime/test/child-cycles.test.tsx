/**
 * CHILD-CYCLE GUARD — `cutChildCycles` and its wiring in FraymeRenderer.
 *
 * Seen in production: the model streamed `"bracket": { children: [..., "bracket"] }`
 * and `"view-toggle": { children: ["view-toggle"] }`. json-render's ElementRenderer
 * maps children → nested ElementRenderer with no visited set, so a self-child (or
 * an ancestor cycle a → b → a) is an unbounded React work loop — no stack overflow,
 * just a tab pinned at 100% CPU. It was NOT confined to streaming: the catalog's
 * cycle check (validate/resolution.ts) is an opt-in stage the runtime never
 * switched on, so the default strict gate passed a cyclic spec and strict mode
 * hung the same way (pinned by the last test below).
 *
 * The rule under test: one DFS over the children graph (root first, then every
 * unreached element); an edge whose target is still on the DFS stack — the
 * element itself or an ancestor — is dropped; everything else keeps its order.
 *
 * The render tests carry their OWN detector: a registry component that counts
 * its renders and throws past LIMIT, which json-render's per-element error
 * boundary swallows. So a regression fails the assertion instead of pinning the
 * vitest worker (a per-test timeout cannot interrupt a synchronous render loop).
 * The first render test is the CONTROL — it feeds the un-cut spec to the raw
 * upstream Renderer and proves the guard trips; without that, a green suite
 * would prove nothing.
 */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { cutChildCycles, cutChildCyclesWithReport } from '../src/core/child-cycles.js';
import { validateFraymeSpec } from '../src/core/validate.js';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { FraymeMessageRenderer, SPEC_DATA_PART_TYPE } from '../src/ai-sdk/index.js';
import {
  JSONUIProvider,
  Renderer,
  type ComponentRegistry,
  type ComponentRenderProps,
} from '../src/react/upstream.js';

type El = { type: string; props?: Record<string, unknown>; children?: unknown[] };
const spec = (root: string | null, elements: Record<string, El>): Spec =>
  ({ root, elements, state: {} }) as unknown as Spec;
const kids = (s: Spec, id: string): unknown[] | undefined =>
  (s as unknown as { elements: Record<string, El> }).elements[id]?.children;

/** Independent cycle DETECTOR (not a cutter): throws if any walk revisits a node on its own path. */
function assertAcyclic(s: Spec): void {
  const els = (s as unknown as { elements: Record<string, El> }).elements;
  const onPath = new Set<string>();
  const done = new Set<string>();
  let steps = 0;
  const go = (id: string): void => {
    if (++steps > 10_000) throw new Error('walk did not terminate');
    if (onPath.has(id)) throw new Error(`still cyclic at "${id}"`);
    if (done.has(id) || !els[id]) return;
    onPath.add(id);
    for (const c of els[id]!.children ?? []) if (typeof c === 'string') go(c);
    onPath.delete(id);
    done.add(id);
  };
  for (const id of Object.keys(els)) go(id);
}

/** The exact shape that hung the tab, with `type` parameterised. */
const liveShape = (type = 'Stack'): Spec =>
  spec('page', {
    page: { type, props: { label: 'page' }, children: ['bracket', 'view-toggle'] },
    bracket: { type, props: { label: 'bracket' }, children: ['round-1', 'bracket'] },
    'round-1': { type, props: { label: 'round-1' } },
    'view-toggle': { type, props: { label: 'view-toggle' }, children: ['view-toggle'] },
  });

afterEach(() => vi.restoreAllMocks());

/* ── the pure rule ───────────────────────────────────────────────────────── */

describe('cutChildCycles — the pure rule', () => {
  it('drops an element\'s own id from its children (the live "bracket" / "view-toggle" shape)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = cutChildCycles(liveShape());
    expect(kids(out, 'bracket')).toEqual(['round-1']);
    expect(kids(out, 'view-toggle')).toEqual([]);
    expect(kids(out, 'page')).toEqual(['bracket', 'view-toggle']);
    assertAcyclic(out);
  });

  it('two-node cycle: cuts the back-edge b → a and keeps a → b', () => {
    const s = spec('a', {
      a: { type: 'Stack', children: ['b'] },
      b: { type: 'Stack', children: ['a'] },
    });
    const { spec: out, dropped } = cutChildCyclesWithReport(s);
    expect(kids(out, 'a')).toEqual(['b']);
    expect(kids(out, 'b')).toEqual([]);
    expect(dropped).toEqual([{ parent: 'b', child: 'a', index: 0 }]);
    assertAcyclic(out);
  });

  it('three-node cycle: exactly one edge goes (c → a) and the rest of the ring survives', () => {
    const s = spec('a', {
      a: { type: 'Stack', children: ['b'] },
      b: { type: 'Stack', children: ['c'] },
      c: { type: 'Stack', children: ['a'] },
    });
    const { spec: out, dropped } = cutChildCyclesWithReport(s);
    expect(kids(out, 'a')).toEqual(['b']);
    expect(kids(out, 'b')).toEqual(['c']);
    expect(kids(out, 'c')).toEqual([]);
    expect(dropped).toEqual([{ parent: 'c', child: 'a', index: 0 }]);
    assertAcyclic(out);
  });

  it('cuts the back-edge to a GRANDPARENT too, not only the direct parent', () => {
    // root → mid → leaf-ish → root: the offending edge points two levels up.
    const s = spec('root', {
      root: { type: 'Stack', children: ['mid'] },
      mid: { type: 'Stack', children: ['deep', 'sib'] },
      deep: { type: 'Stack', children: ['root'] },
      sib: { type: 'Text' },
    });
    const { spec: out, dropped } = cutChildCyclesWithReport(s);
    expect(dropped).toEqual([{ parent: 'deep', child: 'root', index: 0 }]);
    expect(kids(out, 'mid')).toEqual(['deep', 'sib']);
    assertAcyclic(out);
  });

  it('keeps first-occurrence order of the surviving children', () => {
    const s = spec('a', {
      a: { type: 'Stack', children: ['x', 'a', 'y', 'a', 'z'] },
      x: { type: 'Text' },
      y: { type: 'Text' },
      z: { type: 'Text' },
    });
    const { spec: out, dropped } = cutChildCyclesWithReport(s);
    expect(kids(out, 'a')).toEqual(['x', 'y', 'z']);
    expect(dropped.map((d) => d.index)).toEqual([1, 3]);
  });

  it('an acyclic spec comes back as the SAME reference — a tree and a shared-child diamond alike', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tree = spec('page', {
      page: { type: 'Stack', children: ['h', 's'] },
      h: { type: 'Heading', props: { text: 'Hi' } },
      s: { type: 'Stack', children: ['t1', 't2'] },
      t1: { type: 'Text' },
      t2: { type: 'Text' },
    });
    // `d` is reached from BOTH a and b — a cross-edge, legal, must survive intact.
    const diamond = spec('r', {
      r: { type: 'Stack', children: ['a', 'b'] },
      a: { type: 'Stack', children: ['d'] },
      b: { type: 'Stack', children: ['d'] },
      d: { type: 'Text' },
    });
    const treeBefore = structuredClone(tree);
    const diamondBefore = structuredClone(diamond);
    expect(cutChildCycles(tree)).toBe(tree);
    expect(cutChildCycles(diamond)).toBe(diamond);
    expect(cutChildCyclesWithReport(diamond).dropped).toEqual([]);
    expect(tree).toEqual(treeBefore);
    expect(diamond).toEqual(diamondBefore);
    expect(warn).not.toHaveBeenCalled();
  });

  it('never mutates its input, and shares every untouched element with it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = liveShape();
    const before = structuredClone(s);
    const out = cutChildCycles(s);
    expect(s).toEqual(before); // input untouched, deep
    expect(out).not.toBe(s);
    const inEls = (s as unknown as { elements: Record<string, El> }).elements;
    const outEls = (out as unknown as { elements: Record<string, El> }).elements;
    expect(outEls['round-1']).toBe(inEls['round-1']); // untouched → same object
    expect(outEls.page).toBe(inEls.page);
    expect(outEls.bracket).not.toBe(inEls.bracket); // lost an edge → copied
    expect(inEls.bracket!.children).toEqual(['round-1', 'bracket']); // the original array survives
  });

  it('cuts cycles among elements NOT reachable from root too, and shrugs at root-less / element-less snapshots', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = spec('r', {
      r: { type: 'Text' },
      p: { type: 'Stack', children: ['q'] },
      q: { type: 'Stack', children: ['p'] },
    });
    const { spec: out, dropped } = cutChildCyclesWithReport(s);
    expect(dropped).toHaveLength(1);
    assertAcyclic(out);

    // The first streamed patch: {root} with no elements yet.
    const rootOnly = { root: 'page' } as unknown as Spec;
    expect(cutChildCycles(rootOnly)).toBe(rootOnly);
    const empty = spec(null, {});
    expect(cutChildCycles(empty)).toBe(empty);
    expect(cutChildCycles(null)).toBeNull();
    expect(cutChildCycles(undefined)).toBeUndefined();
  });

  it('leaves non-string entries and dangling ids alone (json-render owns those warnings)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = spec('a', {
      a: { type: 'Stack', children: ['ghost', 42, null, 'a', 'b'] },
      b: { type: 'Text' },
    });
    const { spec: out, dropped } = cutChildCyclesWithReport(s);
    expect(kids(out, 'a')).toEqual(['ghost', 42, null, 'b']);
    expect(dropped).toEqual([{ parent: 'a', child: 'a', index: 3 }]);
  });

  it('warns ONCE per call, naming every dropped edge — and stays silent when nothing is cut', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cutChildCycles(liveShape());
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]![0]);
    expect(msg).toMatch(/dropped 2 cyclic child edges/);
    expect(msg).toContain('bracket → itself');
    expect(msg).toContain('view-toggle → itself');

    cutChildCycles(spec('t', { t: { type: 'Text' } }));
    expect(warn).toHaveBeenCalledTimes(1); // clean spec: no second warning

    // An ancestor edge is named parent → child, not "itself".
    cutChildCycles(spec('a', { a: { type: 'Stack', children: ['b'] }, b: { type: 'Stack', children: ['a'] } }));
    expect(String(warn.mock.calls[1]![0])).toMatch(/dropped 1 cyclic child edge \(.*\): b → a$/);
  });
});

/* ── the renderer — proof it no longer hangs ─────────────────────────────── */

const LIMIT = 200;

/** Counts its renders and throws past LIMIT — turns an unbounded loop into a
 *  caught error, so a regression FAILS instead of freezing the worker. */
function makeGuard() {
  let renders = 0;
  function Guard({ element, children }: ComponentRenderProps) {
    renders += 1;
    if (renders > LIMIT) {
      throw new Error(`render guard tripped after ${LIMIT} renders — the children graph is still cyclic`);
    }
    const label = (element.props as { label?: unknown }).label;
    return <div data-guard={typeof label === 'string' ? label : ''}>{children}</div>;
  }
  return { Guard, renders: () => renders };
}

const labels = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-guard]')].map((n) => n.getAttribute('data-guard') ?? '');

describe('FraymeRenderer — a cyclic spec renders instead of recursing forever', () => {
  it(
    'CONTROL: the un-cut spec DOES trip the guard on the raw upstream Renderer (the detector is live)',
    { timeout: 10_000 },
    () => {
      vi.spyOn(console, 'error').mockImplementation(() => {}); // the boundary logs the thrown guard
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { Guard, renders } = makeGuard();
      const registry: ComponentRegistry = { Loop: Guard };
      render(
        <JSONUIProvider registry={registry}>
          <Renderer spec={liveShape('Loop')} registry={registry} />
        </JSONUIProvider>,
      );
      expect(renders()).toBeGreaterThan(LIMIT);
    },
  );

  const registry: ComponentRegistry = {}; // stable identity across rerenders

  it(
    'renders the live shape (self-listing "bracket" + "view-toggle") on the progressive path, each element once',
    { timeout: 10_000 },
    () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { Guard, renders } = makeGuard();
      registry.Loop = Guard;
      const { container } = render(
        <FraymeRenderer spec={liveShape('Loop')} mode="progressive" components={registry} loading />,
      );
      // Document order = tree order; every element exactly once.
      expect(labels(container)).toEqual(['page', 'bracket', 'round-1', 'view-toggle']);
      expect(container.querySelector('[data-guard="bracket"] [data-guard="bracket"]')).toBeNull();
      expect(container.querySelector('[data-guard="view-toggle"]')!.children).toHaveLength(0);
      expect(renders()).toBeLessThanOrEqual(LIMIT / 10);
      expect(warn.mock.calls.flat().join(' ')).toMatch(/bracket → itself.*view-toggle → itself/);
    },
  );

  it(
    'mid-stream: a snapshot that GROWS a cycle on a later op re-renders cleanly',
    { timeout: 10_000 },
    () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { Guard, renders } = makeGuard();
      registry.Loop = Guard;
      const clean = spec('page', {
        page: { type: 'Loop', props: { label: 'page' }, children: ['bracket'] },
        bracket: { type: 'Loop', props: { label: 'bracket' }, children: ['round-1'] },
        'round-1': { type: 'Loop', props: { label: 'round-1' } },
      });
      const { container, rerender } = render(
        <FraymeRenderer spec={clean} mode="progressive" components={registry} loading />,
      );
      expect(labels(container)).toEqual(['page', 'bracket', 'round-1']);
      rerender(<FraymeRenderer spec={liveShape('Loop')} mode="progressive" components={registry} loading />);
      expect(labels(container)).toEqual(['page', 'bracket', 'round-1', 'view-toggle']);
      expect(renders()).toBeLessThanOrEqual(LIMIT / 10);
    },
  );

  it(
    'the AI SDK adapter (data-spec parts → buildSpecFromParts) goes through the same guard',
    { timeout: 10_000 },
    () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { Guard, renders } = makeGuard();
      registry.Loop = Guard;
      const message = {
        parts: [{ type: SPEC_DATA_PART_TYPE, data: { type: 'flat', spec: liveShape('Loop') } }],
      };
      const { container } = render(<FraymeMessageRenderer message={message} components={registry} />);
      expect(labels(container)).toEqual(['page', 'bracket', 'round-1', 'view-toggle']);
      expect(renders()).toBeLessThanOrEqual(LIMIT / 10);
    },
  );

  it('strict mode: the gate rules on the RAW spec; the CUT tree is what renders — no hang either way', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = spec('page', {
      page: { type: 'Stack', props: {}, children: ['t', 'page'] },
      t: { type: 'Text', props: { text: 'hi from the cut tree' } },
    });
    // MEASURED: the catalog's cycle check (validate/resolution.ts) is an
    // opt-in stage (`resolution: true`) that validateFraymeSpec does not enable,
    // so the default strict gate PASSES a cyclic spec — which is why strict mode
    // hung exactly like progressive did. Pinned here so that switching the stage
    // on (a deliberate choice — it also enforces size/depth limits) fails THIS line
    // loudly instead of silently changing what the assertions below mean.
    expect(validateFraymeSpec(s).ok).toBe(true);
    const { container } = render(<FraymeRenderer spec={s} mode="strict" />);
    expect(container.querySelector('.frayme-invalid')).toBeNull();
    // Rendered exactly once — the self-edge page → page is gone.
    expect(container.textContent!.split('hi from the cut tree')).toHaveLength(2);
  });
});
