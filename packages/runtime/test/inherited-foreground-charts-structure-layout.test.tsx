/**
 * INHERITED-FOREGROUND guard — charts, structure-flow, layout-pane, data-display.
 *
 * Same defect class as test/inherited-foreground-feedback-board-filter.test.tsx. A spec authors
 * `Card { bg:"#12161f", color:"#e2e6f0" }`, the colour inherits correctly down two
 * levels, and then a component RESETS it to the global token. Measured on
 * a generated feature-flag console:
 *
 *   SECTION (Card)  color rgb(226,230,240)  bg rgb(18,22,31)   <- authored
 *   DIV             color rgb(226,230,240)                     <- inherits
 *   BUTTON          color rgb(24,24,27)                        <- RESETS  1.02:1
 *
 * Many contrast findings in generated specs are this shape — text the
 * same colour as its own background — and the spec did nothing wrong.
 *
 * `currentColor` as the LAST RESORT of a foreground chain is safe because
 * frayme.css points BOTH `.frayme-root { color }` and `--color-foreground` at
 * `--frayme-fg`: at the top level the two resolve to the same value, so a
 * props-less render is byte-identical, and inside an authored container the
 * inherited one is the only correct answer. On the `color` property `currentColor`
 * computes to the INHERITED colour — no cycle.
 *
 * It is NOT a blanket rename, and the second half of this file is what pins that.
 * An element that paints its OWN opaque fill (bg-muted, --color-card, a stacked
 * bar's series colour) must KEEP the token its fill is partnered with: Card's
 * authored `bg` sets `--fr-card-bg`, never `--color-card`/`--color-muted`, so those
 * slabs are still LIGHT inside a dark card and inheriting the card's light ink
 * would be the same bug pointing the other way.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── the chain probe ──────────────────────────────────────────────────────────
 * The measurement that motivated all of this was a CHAIN measurement: not "does
 * this one span look right" but "does anything between the authored Card and the
 * text re-declare the global foreground token". So the probe walks that chain.
 *
 * A class counts as a RESET when it declares `color` from --color-foreground —
 * `text-foreground`, `text-[color:var(--fr-x-fg,var(--color-foreground))]`, or a
 * bare `[color:…var(--color-foreground)…]`. Background/border declarations are
 * skipped on purpose: a wash or a rail mixed FROM the token is not ink. */
const colorResets = (el: Element): string[] =>
  [...el.classList].filter(
    (c) => c === 'text-foreground' || /^(?:text-)?\[color:.*--color-foreground/.test(c),
  );

/** Render `type` INSIDE an authored dark Card and return the resets found on the
 *  chain from the Card down to (and including) the element `pick` selects. */
const chainResets = (type: string, props: Record<string, unknown>, pick: string): string[] => {
  const spec = {
    root: 'card',
    elements: {
      card: { type: 'Card', props: { bg: '#12161f', color: '#e2e6f0' }, children: ['probe'] },
      probe: { type, props },
    },
    state: {},
  } as unknown as Spec;
  const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
  const target = container.querySelector(pick);
  expect(target, `${type}: probe selector ${pick} matched nothing`).not.toBeNull();
  const out: string[] = [];
  for (let el: Element | null = target; el != null && el !== container; el = el.parentElement) {
    out.push(...colorResets(el).map((c) => `${el!.tagName.toLowerCase()}.${c}`));
  }
  return out;
};

/* ── the chain, end to end ────────────────────────────────────────────────── */

describe('an authored Card reaches its content: no ink reset on the chain', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['Timeline', { items: [{ title: 'Deployed' }] }, 'li span'],
    // `span.break-words` is the step LABEL, not the marker disc — the disc paints
    // its own fill and legitimately keeps the token (pinned further down).
    ['Stepper', { steps: [{ label: 'Account' }, { label: 'Billing' }], current: 0 }, 'span.break-words'],
    ['Tree', { nodes: [{ label: 'src', children: [{ label: 'index.ts' }] }] }, 'li > div'],
    ['DescriptionList', { items: [{ term: 'Plan', value: 'Pro' }] }, 'dd'],
    ['BarChart', { data: [{ label: 'Mon', value: 12 }], showValues: true }, 'span.tabular-nums'],
    ['DonutChart', { data: [{ label: 'A', value: 60 }] }, 'span.tabular-nums'],
    ['Badge', { text: 'Draft', variant: 'outline' }, 'span'],
    ['Badge', { text: 'Live', tone: 'success' }, 'span'],
  ];

  for (const [type, props, pick] of cases) {
    it(`${type} (${pick}) inherits the Card's ink the whole way down`, () => {
      expect(chainResets(type, props, pick)).toEqual([]);
    });
  }
});

/* ── the one COMPUTED-colour assertion ───────────────────────────────────────
 * Everything above is structural because jsdom has no Tailwind sheet. Measured
 * directly: jsdom DOES resolve `currentColor`
 * on the `color` property to the inherited value, but returns `var(--x)` verbatim
 * — so the var-chain sites can only be pinned structurally here, while the plain
 * `text-current` ones can be measured end to end. The two declarations injected
 * below are exactly what Tailwind emits for these class names; the ancestor sets
 * `color` inline rather than through Card's `--fr-card-fg` chain for the same
 * jsdom reason, which does not change the question being asked (does the
 * descendant RESET the inherited colour). rgb(24,24,27) is #18181b, the
 * --color-foreground token the accessibility audit kept finding on dark cards. */

describe('COMPUTED: the ink actually arrives', () => {
  it('a Timeline title inside a dark container computes to the container ink', () => {
    const { container } = render(
      <div style={{ color: 'rgb(226, 230, 240)' }}>
        <style>{'.text-current{color:currentColor}.text-foreground{color:rgb(24,24,27)}'}</style>
        <FraymeRenderer spec={one('Timeline', { items: [{ title: 'Deployed' }] })} mode="progressive" />
      </div>,
    );
    const title = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Deployed')!;
    expect(getComputedStyle(title).color).toBe('rgb(226, 230, 240)');
    expect(getComputedStyle(title).color).not.toBe('rgb(24, 24, 27)');
  });
});

/* ── charts.tsx ───────────────────────────────────────────────────────────── */

describe('charts — the chart root and its value annotations inherit', () => {
  it('chartWrap is text-current, not text-foreground', () => {
    const { container } = draw('BarChart', { data: [{ label: 'Mon', value: 12 }] });
    const wrap = container.querySelector('.flex.w-full.flex-col.gap-2')!;
    expect(wrap, 'the chart root').not.toBeNull();
    expect(has(wrap, 'text-current')).toBe(true);
    expect(has(wrap, 'text-foreground')).toBe(false);
  });

  it('BarChart value labels: axisColor chain ends in currentColor', () => {
    const { container } = draw('BarChart', { data: [{ label: 'Mon', value: 12 }], showValues: true });
    const v = container.querySelector('span.tabular-nums')!;
    expect(has(v, 'text-[color:var(--fr-barchart-axis,currentColor)]')).toBe(true);
    expect(has(v, 'text-[color:var(--fr-barchart-axis,var(--color-foreground))]')).toBe(false);
  });

  it('DonutChart centre total: axisColor chain ends in currentColor', () => {
    const { container } = draw('DonutChart', { data: [{ label: 'A', value: 60 }] });
    const total = container.querySelector('span.tabular-nums')!;
    expect(has(total, 'text-[color:var(--fr-donutchart-axis,currentColor)]')).toBe(true);
    expect(has(total, 'text-[color:var(--fr-donutchart-axis,var(--color-foreground))]')).toBe(false);
  });

  it('Legend: the muted colour sits on the NAME, so the meta value inherits', () => {
    const { container } = draw('DonutChart', { data: [{ label: 'A', value: 60 }], showValues: true, showLegend: true });
    const ul = container.querySelector('ul.list-none')!;
    // The list itself no longer declares a colour — it used to, which forced the
    // meta value to climb back out of muted with a hard text-foreground.
    expect(ul.getAttribute('style')).toBeNull();
    const name = ul.querySelector('span.break-words')!;
    expect(name.getAttribute('style')).toContain('--fr-donutchart-muted');
    const meta = ul.querySelector('span.tabular-nums')!;
    expect(has(meta, 'text-foreground')).toBe(false);
    expect(colorResets(meta)).toEqual([]);
  });

  it('the STACKED bar in-segment label KEEPS the token — it is on the series fill', () => {
    const { container } = draw('BarChart', {
      series: [{ name: 'A', values: [10] }, { name: 'B', values: [10] }],
      labels: ['Mon'],
      groupMode: 'stacked',
      showValues: true,
    });
    const inBar = container.querySelector('span.relative.tabular-nums')!;
    expect(inBar, 'a stacked in-segment value label').not.toBeNull();
    expect(has(inBar, 'text-[color:var(--fr-barchart-axis,var(--color-foreground))]')).toBe(true);
  });
});

/* ── structure-flow.tsx ───────────────────────────────────────────────────── */

describe('structure-flow — unpainted text inherits, painted discs do not', () => {
  it('Timeline title + TimelineItem title are text-current', () => {
    const { container } = draw('Timeline', { items: [{ title: 'Deployed' }] });
    const title = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Deployed')!;
    expect(has(title, 'text-current')).toBe(true);
    expect(has(title, 'text-foreground')).toBe(false);
  });

  it('Stepper: the CURRENT step label is text-current', () => {
    const { container } = draw('Stepper', { steps: [{ label: 'Account' }, { label: 'Billing' }], current: 0 });
    const label = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Account')!;
    expect(has(label, 'text-current')).toBe(true);
    expect(has(label, 'text-foreground')).toBe(false);
  });

  it('Stepper: the COMPLETED marker disc keeps the token — it paints its own fill', () => {
    const { container } = draw('Stepper', { steps: [{ label: 'Account' }, { label: 'Billing' }], current: 1 });
    const disc = container.querySelector('span.rounded-full')!;
    expect(has(disc, '[background:var(--fr-stepper-accent,var(--color-foreground))]')).toBe(true);
    expect(has(disc, 'text-[var(--color-card)]')).toBe(true);
  });

  it('Tree rows inherit: unselected is text-current, selected accent falls to currentColor', () => {
    const { container } = draw('Tree', {
      nodes: [{ label: 'src', children: [{ label: 'index.ts' }] }],
      selectable: true,
      value: 'src',
      defaultExpandedDepth: 1,
    });
    const row = container.querySelector('li > div')!;
    expect(has(row, 'text-foreground')).toBe(false);
    expect(has(row, 'text-current')).toBe(true);
    const li = container.querySelector('li')!;
    // The selected li carries the accent chain; unselected carries none. Either
    // way nothing on the row may name --color-foreground as a COLOUR.
    expect(has(li, '[color:var(--fr-tree-accent,var(--color-foreground))]')).toBe(false);
  });

  it('the selection WASH keeps the token: it is a background, not ink', () => {
    const { container } = draw('Tree', { nodes: [{ label: 'src' }], selectable: true, value: 'src' });
    const row = container.querySelector('li > div')!;
    expect(has(row, '[background:color-mix(in_srgb,var(--fr-tree-accent,var(--color-foreground))_14%,transparent)]')).toBe(true);
  });
});

/* ── layout-pane.tsx ──────────────────────────────────────────────────────── */

describe('layout-pane — DescriptionList inherits; the card-painting panes do not', () => {
  for (const layout of ['stacked', 'inline', 'grid']) {
    it(`DescriptionList (${layout}): the value chain ends in currentColor`, () => {
      const { container } = draw('DescriptionList', { items: [{ term: 'Plan', value: 'Pro' }], layout });
      const dd = container.querySelector('dd')!;
      expect(has(dd, '[color:var(--fr-dl-fg,currentColor)]')).toBe(true);
      expect(has(dd, '[color:var(--fr-dl-fg,var(--color-foreground))]')).toBe(false);
    });
  }

  /* The token is still where this chain LANDS when the pane is unstyled — it now
     arrives via --fr-surface-fg, which the pane pins to var(--color-foreground) in
     the same cn() that resets --fr-surface. The premise is unchanged and widened: a
     pane that paints its own surface must carry the ink paired with THAT surface, so
     an AUTHORED bg now yields the ink derived from it instead of the light token. */
  it('SplitPane KEEPS the token — bordered defaults true and paints --color-card', () => {
    const { container } = draw('SplitPane', {});
    const pane = container.querySelector('.fr-splitpane')!;
    expect(has(pane, 'text-[color:var(--fr-splitpane-fg,var(--fr-surface-fg,var(--color-foreground)))]')).toBe(true);
    expect(has(pane, '[background:var(--fr-splitpane-bg,var(--color-card))]')).toBe(true);
  });

  it('VirtualList row labels KEEP the token — the shell always paints --color-card', () => {
    const { container } = draw('VirtualList', { items: [{ label: 'Row one' }] });
    const label = container.querySelector('span.truncate.font-medium')!;
    expect(label.textContent).toBe('Row one');
    expect(has(label, 'text-[color:var(--fr-vlist-fg,var(--color-foreground))]')).toBe(true);
    const shell = container.querySelector('.overflow-auto')!;
    expect(has(shell, '[background:var(--fr-vlist-bg,var(--color-card))]')).toBe(true);
  });
});

/* ── data-display.tsx ─────────────────────────────────────────────────────── */

describe('data-display — transparent chips inherit, opaque slabs keep the token', () => {
  for (const [tone, token] of [
    ['success', 'success'],
    ['warning', 'warning'],
    ['critical', 'danger'],
    ['info', 'info'],
  ] as const) {
    it(`Badge tone=${tone}: the 12% wash mixes 20% of the INHERITED ink`, () => {
      const { container } = draw('Badge', { text: 'Live', tone });
      const chip = container.querySelector('span')!;
      expect(has(chip, `text-[color:color-mix(in_srgb,var(--frayme-${token})_80%,currentColor)]`)).toBe(true);
      expect(has(chip, `text-[color:color-mix(in_srgb,var(--frayme-${token})_80%,var(--color-foreground))]`)).toBe(false);
      // It may inherit BECAUSE its own fill is 88% transparent.
      expect(has(chip, `bg-[color-mix(in_srgb,var(--frayme-${token})_12%,transparent)]`)).toBe(true);
    });
  }

  it('Badge variant=outline: bg-transparent → text-current', () => {
    const { container } = draw('Badge', { text: 'Draft', variant: 'outline' });
    const chip = container.querySelector('span')!;
    expect(has(chip, 'bg-transparent')).toBe(true);
    expect(has(chip, 'text-current')).toBe(true);
    expect(has(chip, 'text-foreground')).toBe(false);
  });

  /* Was "KEEP text-foreground — bg-muted is an opaque token fill". Opacity was never
     the reason the token was safe; the token being immovable was. Now that --color-muted
     is re-pointed per surface, an opaque chip on an authored dark card would be a light
     island, so both halves move onto the channel together. The invariant this file
     exists for is untouched: a chip that paints its own fill carries ink paired with
     THAT fill, and never inherits the surface's. */
  it('Badge secondary/neutral ride the surface channel — fill and ink together', () => {
    for (const props of [{ variant: 'secondary' }, { tone: 'neutral' }]) {
      const { container, unmount } = draw('Badge', { text: 'Chip', ...props });
      const chip = container.querySelector('span')!;
      expect(has(chip, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]'), `${JSON.stringify(props)} paints the sunken channel`).toBe(true);
      expect(has(chip, 'text-[color:var(--fr-surface-fg,var(--color-foreground))]'), `${JSON.stringify(props)} pairs its ink`).toBe(true);
      expect(has(chip, 'text-foreground'), `${JSON.stringify(props)} no longer pins the token`).toBe(false);
      unmount();
    }
  });

  it('Avatar initials KEEP the token — they sit on the avatar\'s own --color-muted disc', () => {
    const { container } = draw('Avatar', { name: 'Ada Lovelace' });
    const disc = container.querySelector('span')!;
    expect(has(disc, '[background:var(--fr-avatar-bg,var(--fr-surface-sunken,var(--color-muted)))]')).toBe(true);
    expect(has(disc, '[color:var(--fr-avatar-fg,var(--fr-surface-fg,var(--color-foreground)))]')).toBe(true);
  });
});
