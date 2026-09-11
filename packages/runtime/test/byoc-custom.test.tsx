/**
 * BYOC — the runtime author kit + wrapper. Verifies: prop-gate IACVT, typed
 * emit → DynamicActionEvent, dev warnings (undeclared + unbound verbs), the
 * strict-mode `catalog` prop (accept vs fail-closed), the Fallback dev hint, and
 * built-in byte-identity (the non-BYOC path is untouched).
 */
import { fireEvent, render } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { defineFraymeComponent, type FraymeParts, type ManifestInput } from '@frayme/catalog';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { createCustomComponents } from '../src/react/custom.js';
import * as kit from '../src/react/index.js';

/* ── the reference manifest + a custom component ─────────────────────────── */

const SEATMAP: ManifestInput = {
  name: 'SeatMap',
  description:
    'Interactive seat map showing availability across a grid of selectable seats with a legend. Picking a free seat emits select with the seat id; use it for any seat, desk, or slot picking flow.',
  props: {
    rows: { kind: 'count', min: 1, max: 60, doc: 'Number of seat rows to draw in the grid (1 to 60), which drives the overall height.' },
    accent: { kind: 'color', doc: 'Fill colour for the currently selected seat (any CSS colour); defaults to the workspace primary token.' },
    value: { kind: 'string', doc: 'The currently selected seat id; bind it with $bindState to persist the selection into spec state.' },
  },
  events: ['select'],
  eventsDoc: { select: 'Fires when the user picks a free seat; value is the seat id.' },
  example: { rows: 30, value: null },
};

const SeatMapManifest = defineFraymeComponent(SEATMAP);

function SeatMapView({ props, emit }: FraymeParts<typeof SeatMapManifest>) {
  return (
    <div data-testid="seatmap" data-accent={String(props.accent)} data-rows={String(props.rows)}>
      <button data-testid="pick" onClick={() => emit('select', { value: '12C' })}>pick</button>
      <button data-testid="bad-verb" onClick={() => emit('sort', { value: 'x' })}>bad</button>
    </div>
  );
}

const custom = () => createCustomComponents([{ manifest: SeatMapManifest, component: SeatMapView }]);

const seatSpec = (props: Record<string, unknown> = {}, bound = true): Spec =>
  ({
    root: 'a',
    elements: { a: { type: 'SeatMap', props, ...(bound ? { on: { select: { action: 'pick_seat', confirm: false } } } : {}) } },
  }) as unknown as Spec;

afterEach(() => vi.restoreAllMocks());

/* ── createCustomComponents ──────────────────────────────────────────────── */

describe('createCustomComponents', () => {
  it('returns a registry (with the custom name) + a catalog union', () => {
    const c = custom();
    expect(Object.keys(c.registry)).toContain('SeatMap');
    expect(c.catalog.componentNames).toContain('SeatMap');
  });
  it('throws on a duplicate custom component', () => {
    expect(() => createCustomComponents([
      { manifest: SeatMapManifest, component: SeatMapView },
      { manifest: SeatMapManifest, component: SeatMapView },
    ])).toThrow(/duplicate custom component/);
  });
});

/* ── rendering + prop-gate IACVT ─────────────────────────────────────────── */

describe('rendering + prop gate', () => {
  it('renders the custom component in strict mode when the union catalog is passed', () => {
    const c = custom();
    const { getByTestId } = render(
      <FraymeRenderer spec={seatSpec({ rows: 20 })} catalog={c.catalog} components={c.registry} />,
    );
    expect(getByTestId('seatmap').getAttribute('data-rows')).toBe('20');
  });

  it('IACVT: an invalid prop value is dropped to null, valid ones kept, element never dropped', () => {
    const c = custom();
    const { getByTestId } = render(
      <FraymeRenderer spec={seatSpec({ rows: 20, accent: 12345 })} catalog={c.catalog} components={c.registry} />,
    );
    const el = getByTestId('seatmap');
    expect(el.getAttribute('data-rows')).toBe('20'); // valid kept
    expect(el.getAttribute('data-accent')).toBe('null'); // invalid colour → null
  });

  it('cleanProps: strips unknown keys, nulls invalid values, keeps valid', () => {
    const cleaned = SeatMapManifest.cleanProps({ rows: 5, accent: '#ff0000', bogus: 'x', value: 999 });
    expect(cleaned).toEqual({ rows: 5, accent: '#ff0000', value: null }); // bogus stripped, value(999) invalid→null
    expect('bogus' in cleaned).toBe(false);
  });
});

/* ── typed emit → DynamicActionEvent ─────────────────────────────────────── */

describe('emit → agent', () => {
  /* A custom component is not in the default carrier list (core/dynamic-gate.ts):
     its declared action stays local unless the host widens `dynamicActionTypes`
     with the custom type name (or the binding says live:true). These two tests
     are about the emit→event plumbing, so the gate is widened to SeatMap. */
  it('a declared, bound verb forwards to onDynamicAction with the intrinsic payload', () => {
    const c = custom();
    const onDynamicAction = vi.fn();
    const { getByTestId } = render(
      <FraymeRenderer
        spec={seatSpec({ rows: 10 })}
        catalog={c.catalog}
        components={c.registry}
        onDynamicAction={onDynamicAction}
        dynamicActionTypes={['Button', 'DataTable', 'SeatMap']}
      />,
    );
    fireEvent.click(getByTestId('pick'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0][0];
    expect(ev).toMatchObject({ action: 'pick_seat', event: 'select' });
    expect(ev.params).toMatchObject({ value: '12C' });
  });

  it('warns (dev) on an UNDECLARED verb but still forwards', () => {
    const c = custom();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // bind sort so it would forward; the manifest doesn't declare it.
    const spec = { root: 'a', elements: { a: { type: 'SeatMap', props: {}, on: { sort: { action: 'do_sort', confirm: false } } } } } as unknown as Spec;
    const onDynamicAction = vi.fn();
    const { getByTestId } = render(
      <FraymeRenderer
        spec={spec}
        catalog={c.catalog}
        components={c.registry}
        onDynamicAction={onDynamicAction}
        dynamicActionTypes={['Button', 'DataTable', 'SeatMap']}
      />,
    );
    fireEvent.click(getByTestId('bad-verb'));
    expect(warn.mock.calls.flat().join(' ')).toMatch(/not in its manifest events/);
    expect(onDynamicAction).toHaveBeenCalled(); // forwarded anyway
  });

  it('warns (dev) when a declared verb is emitted but the model never bound it', () => {
    const c = custom();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // NO on.select binding → the emit will drop upstream.
    const { getByTestId } = render(
      <FraymeRenderer spec={seatSpec({}, false)} catalog={c.catalog} components={c.registry} onDynamicAction={vi.fn()} />,
    );
    fireEvent.click(getByTestId('pick'));
    expect(warn.mock.calls.flat().join(' ')).toMatch(/did not bind on\.select/);
  });
});

/* ── strict-mode catalog: accept vs fail-closed ──────────────────────────── */

describe('strict-mode catalog prop', () => {
  it('WITH the union catalog, a custom-type spec passes the gate and renders', () => {
    const c = custom();
    const { queryByTestId } = render(
      <FraymeRenderer spec={seatSpec({ rows: 3 })} catalog={c.catalog} components={c.registry} />,
    );
    expect(queryByTestId('seatmap')).not.toBeNull();
  });

  it('WITHOUT the catalog, strict mode fail-closes (the custom type is not rendered)', () => {
    const c = custom();
    const { queryByTestId, container } = render(
      <FraymeRenderer spec={seatSpec({ rows: 3 })} components={c.registry} />,
    );
    expect(queryByTestId('seatmap')).toBeNull(); // fail-closed → InvalidSpec, tree not rendered
    expect(container.textContent ?? '').not.toContain('12C');
  });

  it('progressive mode renders the custom type without a catalog (registry is the safety net)', () => {
    const c = custom();
    const { queryByTestId } = render(
      <FraymeRenderer spec={seatSpec({ rows: 3 })} mode="progressive" components={c.registry} />,
    );
    expect(queryByTestId('seatmap')).not.toBeNull();
  });
});

/* ── Fallback dev hint ───────────────────────────────────────────────────── */

describe('Fallback dev hint', () => {
  it('renders the inert Fallback + an articulate dev hint when the type is unregistered', () => {
    const c = custom();
    // progressive so the missing renderer hits Fallback rather than the strict gate
    const { container } = render(
      <FraymeRenderer spec={seatSpec({ rows: 3 })} mode="progressive" catalog={c.catalog} />,
    );
    const fb = container.querySelector('[data-frayme-fallback="SeatMap"]');
    expect(fb).not.toBeNull();
    expect(container.querySelector('[data-frayme-fallback-hint="SeatMap"]')?.textContent ?? '').toMatch(/createCustomComponents/);
  });
});

/* ── byte-identity: the non-BYOC path is untouched ───────────────────────── */

describe('built-in byte-identity', () => {
  const buttonSpec = { root: 'a', elements: { a: { type: 'Button', props: { label: 'Go' } } } } as unknown as Spec;

  it('a built-in-only spec renders identical HTML with and without the custom registry/catalog', () => {
    const c = custom();
    const plain = render(<FraymeRenderer spec={buttonSpec} />);
    const plainHtml = plain.container.innerHTML;
    plain.unmount();
    const withCustom = render(<FraymeRenderer spec={buttonSpec} catalog={c.catalog} components={c.registry} />);
    expect(withCustom.container.innerHTML).toBe(plainHtml);
  });
});

/* ── author kit ──────────────────────────────────────────────────────────── */

describe('author kit exports', () => {
  it('re-exports the house helpers a custom renderer needs', () => {
    for (const name of ['useLocalOrBound', 'styleVars', 'cn', 'Icon', 'hasIcon', 'ICON_NAMES', 'safeUrl', 'safeImageSrc', 'safeColor', 'safeDimension', 'useIntrinsicEmit', 'createCustomComponents']) {
      expect(kit, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it('styleVars + cn + safeColor behave for a custom renderer', () => {
    expect(kit.cn('a', 'b', false && 'c')).toBe('a b');
    expect(kit.safeColor('#ff0000')).toBe('#ff0000');
    expect(kit.safeColor('url(evil)')).toBeNull();
    const vars = kit.styleVars({ var: '--fr-x', value: '#00ff00', kind: 'color' });
    expect((vars as Record<string, unknown>)['--fr-x']).toBe('#00ff00');
  });

  it('safeDimension + hasIcon behave for a custom renderer', () => {
    expect(kit.safeDimension('12rem', { units: ['rem'] })).toBe('12rem');
    expect(kit.safeDimension('calc(100% - 2px)')).toBeNull();
    expect(typeof kit.hasIcon).toBe('function');
    expect(Array.isArray(kit.ICON_NAMES)).toBe(true);
  });
});

/* ── a custom renderer that USES the author kit ──────────────────────────── */

const CHIP: ManifestInput = {
  ...SEATMAP,
  name: 'BrandChip',
  description: 'A small branded chip label used to tag content with a workspace colour accent. Purely presentational; renders its label text with the accent colour applied.',
  events: [],
  eventsDoc: undefined,
};
const BrandChipManifest = defineFraymeComponent(CHIP);
function BrandChipView({ props }: FraymeParts<typeof BrandChipManifest>) {
  const vars = kit.styleVars({ var: '--fr-chip', value: props.accent, kind: 'color' });
  return <span data-testid="chip" className={kit.cn('chip', props.rows ? 'has-rows' : '')} style={vars}>{String(props.value ?? '')}</span>;
}

describe('kit-using custom renderer + multi-component registry', () => {
  it('registers two customs and renders one that consumes styleVars/cn', () => {
    const c = createCustomComponents([
      { manifest: SeatMapManifest, component: SeatMapView },
      { manifest: BrandChipManifest, component: BrandChipView },
    ]);
    expect(c.catalog.componentNames).toEqual(expect.arrayContaining(['SeatMap', 'BrandChip', 'Button']));
    const spec = { root: 'a', elements: { a: { type: 'BrandChip', props: { accent: '#123456', value: 'VIP', rows: 2 } } } } as unknown as Spec;
    const { getByTestId } = render(<FraymeRenderer spec={spec} catalog={c.catalog} components={c.registry} />);
    const chip = getByTestId('chip');
    expect(chip.textContent).toBe('VIP');
    expect(chip.getAttribute('style') ?? '').toContain('--fr-chip');
    expect(chip.className).toContain('has-rows');
  });
});

/* ── array-prop IACVT + clientOnly ───────────────────────────────────────── */

describe('array prop cleaning + clientOnly', () => {
  const ARR: ManifestInput = {
    ...SEATMAP,
    name: 'TagList',
    description: 'Renders a list of tag chips from a bound array of tag objects. Each tag has a label and an optional tone; purely presentational display list.',
    props: {
      tags: { kind: 'array', maxItems: 20, doc: 'The list of tags to render, each with a label and an optional tone value shown as a chip.', of: { label: { kind: 'string', doc: 'The visible text of the tag chip shown to the end user in the list.' } } },
    },
    events: [],
    eventsDoc: undefined,
    example: { tags: [{ label: 'a' }] },
  };
  const TagListManifest = defineFraymeComponent(ARR);

  it('cleanProps keeps a valid array and nulls a malformed one', () => {
    expect(TagListManifest.cleanProps({ tags: [{ label: 'ok' }] })).toEqual({ tags: [{ label: 'ok' }] });
    expect(TagListManifest.cleanProps({ tags: 'not-an-array' })).toEqual({ tags: null });
  });

  it('clientOnly component renders (mounts after hydration in jsdom)', () => {
    const c = createCustomComponents([{ manifest: SeatMapManifest, component: SeatMapView, clientOnly: true }]);
    const { queryByTestId, container } = render(
      <FraymeRenderer spec={seatSpec({ rows: 4 })} mode="progressive" components={c.registry} />,
    );
    // useEffect runs in jsdom → the real component mounts; either way, no crash.
    expect(container.querySelector('[data-frayme-clientonly], [data-testid="seatmap"]')).not.toBeNull();
    expect(queryByTestId('seatmap')).not.toBeNull();
  });

  // H4 (vet): a clientOnly author component that USES A HOOK must not violate the
  // Rules of Hooks. Pre-fix the wrapper called the author as a bare function, so the
  // skeleton→mounted re-render changed the wrapper's hook count → "rendered more
  // hooks than during the previous render". Rendering the author as an element gives
  // it its own fiber, so its hooks are consistent across its own renders.
  it('clientOnly component that uses a hook mounts without a Rules-of-Hooks crash', () => {
    const HOOKED: ManifestInput = {
      name: 'ClockView',
      description:
        'A tiny client-only clock badge that reads the browser clock on mount. Use it whenever a prompt asks for a live time or a component that must run only in the browser.',
      props: { label: { kind: 'string', doc: 'A short caption rendered beside the live clock time value.' } },
      events: ['select'],
      example: { label: 'now' },
    };
    const ClockManifest = defineFraymeComponent(HOOKED);
    function ClockView({ props }: FraymeParts<typeof ClockManifest>) {
      // Two hooks — exactly what a window/document component (the clientOnly use
      // case) needs, and what the author-kit useLocalOrBound is built on.
      const [ticks, setTicks] = useState(0);
      useEffect(() => setTicks((t) => t + 1), []);
      return <div data-testid="clock" data-ticks={ticks}>{String(props.label)}</div>;
    }
    const c = createCustomComponents([{ manifest: ClockManifest, component: ClockView, clientOnly: true }]);
    const spec = { root: 'a', elements: { a: { type: 'ClockView', props: { label: 'now' } } } } as unknown as Spec;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let queryByTestId!: ReturnType<typeof render>['queryByTestId'];
    expect(() => {
      ({ queryByTestId } = render(<FraymeRenderer spec={spec} mode="progressive" components={c.registry} />));
    }).not.toThrow();
    expect(queryByTestId('clock')).not.toBeNull();
    // No React "rendered more hooks" / Rules-of-Hooks error was logged.
    const hookErr = errSpy.mock.calls.flat().join(' ');
    expect(hookErr).not.toMatch(/more hooks|Rules of Hooks|Rendered fewer hooks/i);
  });
});
