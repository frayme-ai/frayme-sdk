/**
 * INHERITED-FOREGROUND guard — data-table, charts-extra, charts-radial, scheduler.
 *
 * Same defect class as the other inherited-foreground-*.test.tsx files. A spec authors
 * `Card { bg:"#12161f", color:"#e2e6f0" }`, the colour inherits correctly down the
 * tree, and then a component RESETS it to the global token. Measured on
 * a generated feature-flag console:
 *
 *   SECTION (Card)  color rgb(226,230,240)  bg rgb(18,22,31)   <- authored
 *   DIV             color rgb(226,230,240)                     <- inherits
 *   BUTTON          color rgb(24,24,27)                        <- RESETS  1.02:1
 *
 * `currentColor` as the LAST RESORT of a foreground chain is safe because
 * frayme.css:138 points BOTH `.frayme-root { color }` and `--color-foreground` at
 * `--frayme-fg`: at the top level the two resolve to the same value, so a props-less
 * render is byte-identical, and inside an authored container the inherited one is
 * the only correct answer. On the `color` property `currentColor` computes to the
 * INHERITED value — no cycle. The COMPUTED describe near the bottom proves BOTH
 * halves of that claim rather than trusting it.
 *
 * This file's own findings, which are why it is not a rename:
 *
 *  1. DataTable's <table> paints NO background (its wrapper is a bare `div.w-full`),
 *     so ONE declaration — `tableRecipe`'s `[color:var(--color-foreground)]` — was
 *     resetting the ink for every body cell in the component. But the PINNED cells
 *     composite their band over `--color-card` to stay opaque over scrolled content,
 *     and a Card's authored `bg` re-points `--fr-card-bg`, never `--color-card`. So
 *     the root inherits and those cells carry `pinInk` (`text-foreground`) back.
 *     Without that pairing the fix would have put the card's light ink on a
 *     still-light frozen column: the same bug reversed.
 *  2. DataTable's pagination footer set the muted colour on the ROW, which is why
 *     its three buttons each had to re-assert `text-foreground` to climb back out of
 *     muted. Moving muted onto the page-label span (the only child that wants it)
 *     is what lets the buttons inherit — the same move charts.tsx made for Legend,
 *     and repeated here for charts-radial's Legend.
 *  3. Scheduler event blocks are a 12% tint (88% of the surface shows through) —
 *     EXCEPT the `stacked` branch, which paints an opaque face over `--color-card`.
 *     Title inherits; the stacked branch restores the token.
 *  4. Heatmap's in-cell value sits on the cell's own opaque fill and KEEPS the
 *     token, as do the solid accent buttons, the `bg-muted` chip, the `bg-card`
 *     editor rail, ColumnHeader (its own `--color-muted` slab) and the Scheduler
 *     popover (`position:fixed` AND its own `bg-card`).
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* A class counts as a RESET when it declares `color` from --color-foreground:
 * `text-foreground`, `text-[color:var(--fr-x-fg,var(--color-foreground))]`, or a
 * bare `[color:…var(--color-foreground)…]`. Background/border/shadow declarations
 * are skipped on purpose — a wash, a rail or a seam mixed FROM the token is not
 * ink (DataTable's `pinRightSeam` is exactly that, and stays). */
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

const ROWS = [
  { name: 'Ada Lovelace', plan: 'Pro' },
  { name: 'Grace Hopper', plan: 'Free' },
];
const COLS = [
  { key: 'name', label: 'Name' },
  { key: 'plan', label: 'Plan' },
];

const EVENTS = [{ id: 'a', title: 'Design review', start: '09:00', end: '11:00', subtitle: 'Studio 2' }];

/* ── the chain, end to end ────────────────────────────────────────────────── */

describe('an authored Card reaches its content: no ink reset on the chain', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    // A plain data cell: its ink came from the <table>, three levels up.
    ['DataTable', { columns: COLS, rows: ROWS }, 'tbody td span.break-words'],
    ['BarList', { data: [{ label: 'Direct', value: 40 }] }, 'span.break-words'],
    ['ProgressCircle', { value: 62 }, 'span.tabular-nums'],
    ['Gantt', { tasks: [{ label: 'Migrate data', start: 0, end: 4 }] }, 'span.break-words'],
    ['Gauge', { value: 62 }, 'span.tabular-nums'],
    ['RadialBar', { data: [{ label: 'Mobile', value: 60 }], showLegend: true, showValues: true }, 'ul li span.tabular-nums'],
    ['Scheduler', { events: EVENTS }, '[role="button"][aria-label] span.truncate, [role="button"][aria-label] span.break-words'],
  ];

  for (const [type, props, pick] of cases) {
    it(`${type} (${pick}) inherits the Card's ink the whole way down`, () => {
      expect(chainResets(type, props, pick)).toEqual([]);
    });
  }
});

/* ── data-table.tsx ───────────────────────────────────────────────────────── */

describe('data-table — the table inherits, the opaque cells keep the token', () => {
  it('the <table> root is text-current, not the foreground token', () => {
    const { container } = draw('DataTable', { columns: COLS, rows: ROWS });
    const table = container.querySelector('table')!;
    expect(has(table, 'text-current')).toBe(true);
    expect(has(table, '[color:var(--color-foreground)]')).toBe(false);
    // It may inherit BECAUSE it paints nothing: no background class anywhere on it.
    expect([...table.classList].some((c) => /^bg-|^\[background/.test(c))).toBe(false);
  });

  it('ghost + outline row actions pair card ink with the card fill they now paint', () => {
    // CHANGED with the tinted actions column. These used to paint NOTHING — no
    // fill, transparent border — so their surface was the row's and `text-current`
    // was right: inside a Card with an authored dark `bg` the row's ink is light,
    // and a hard reset to text-foreground would have put dark ink on a dark row.
    //
    // They now paint an opaque card fill, because a bordered-but-empty chip
    // dissolved into the #f4f4f5 actions band it sits on. The invariant is
    // unchanged and the answer simply moves with the fill: a chip that paints
    // --color-card must name the ink that token is partnered with, exactly as the
    // pinned cells already do (see pinInk). `text-current` would now inherit a dark
    // card's LIGHT ink onto the chip's own LIGHT fill.
    for (const variant of ['ghost', 'outline']) {
      const { container, unmount } = draw('DataTable', {
        columns: COLS,
        rows: ROWS,
        rowActions: [{ id: 'view', label: 'View', variant }],
      });
      const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'View')!;
      // The chip is now EMBOSSED FROM THE SURFACE rather than painted a flat card
      // colour: .fr-dt-chip lifts --fr-surface toward white for the face and edges it
      // with a theme-appropriate hairline, so it reads as raised on white, on navy,
      // and on any authored colour. `bg-card` was a white slab — correct on a white
      // page, a glaring block on a dark one. Ink inherits again, because the face is
      // now made OF the surface and the surface already carries its ink.
      expect(has(btn, 'fr-dt-chip'), `${variant} is embossed from the surface`).toBe(true);
      expect(has(btn, 'bg-card'), `${variant} no longer paints a flat card slab`).toBe(false);
      unmount();
    }
  });

  it('secondary folds into the card-filled chip in ROW scope', () => {
    // `secondary` drew one distinction: a quiet FILL against no fill. The tinted
    // actions column erases exactly that, and its fill was bg-muted — the same
    // token as the column — so the chip rendered invisible. In row scope it now
    // folds into outline. It is a rare shape in generated specs.
    // Bulk actions keep the variant: they sit on a bar, not on the column.
    const { container } = draw('DataTable', {
      columns: COLS,
      rows: ROWS,
      rowActions: [{ id: 'view', label: 'View', variant: 'secondary' }],
    });
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'View')!;
    expect(has(btn, 'bg-muted'), 'no longer the column token').toBe(false);
    expect(has(btn, 'fr-dt-chip'), 'folds into the embossed chip').toBe(true);
  });

  it('primary KEEPS its own pairing — text-card on the accent fill', () => {
    const { container } = draw('DataTable', {
      columns: COLS,
      rows: ROWS,
      rowActions: [{ id: 'go', label: 'Go', variant: 'primary' }],
    });
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Go')!;
    expect(has(btn, 'bg-[var(--fr-dt-accent,var(--color-foreground))]')).toBe(true);
    expect(has(btn, 'text-[color:var(--color-card)]')).toBe(true);
  });

  it('the PINNED actions cell carries pinInk: it composites over --color-card', () => {
    const { container } = draw('DataTable', {
      columns: COLS,
      rows: ROWS,
      rowActions: [{ id: 'view', label: 'View' }],
    });
    const cell = container.querySelector('tbody tr td.sticky.right-0')!;
    expect(cell, 'the right-pinned actions cell').not.toBeNull();
    // The fill it paints is opaque — now the tinted actions surface rather than a
    // flat bg-card, but still a light token fill that the row band mixes INTO…
    expect(has(cell, 'fr-dt-actions')).toBe(true);
    // …and its INK now rides the same class, not a pinned utility. .fr-dt-actions
    // shades --fr-card-bg and pairs `color` with --fr-card-fg, so a yellow or dark
    // authored table gets an actions column that belongs to it. A hardcoded
    // text-foreground here would be dark ink on a dark card.
    expect(has(cell, 'text-foreground'), 'ink rides the class now').toBe(false);
  });

  it('the PINNED first column carries pinInk too, on every row band', () => {
    const { container } = draw('DataTable', { columns: COLS, rows: ROWS, pinnedFirst: true, striped: true });
    const cells = [...container.querySelectorAll('tbody td.sticky.left-0')];
    expect(cells.length).toBe(2);
    for (const cell of cells) {
      expect(has(cell, 'text-foreground'), cell.className).toBe(true);
      // Each band composites over --color-card (or is flat bg-card) — opaque either way.
      expect(
        has(cell, 'bg-card') || [...cell.classList].some((c) => c.startsWith('[background:') && c.includes('--color-card')),
        cell.className,
      ).toBe(true);
    }
  });

  it('the pagination footer no longer inks the ROW — muted moved to the page label', () => {
    const { container } = draw('DataTable', { columns: COLS, rows: ROWS, pageSize: 1 });
    const label = [...container.querySelectorAll('span')].find((s) => /^Page 1 of/.test(s.textContent ?? ''))!;
    expect(label, 'the page counter').not.toBeUndefined();
    expect(has(label, '[color:var(--fr-dt-muted,var(--color-muted-foreground))]')).toBe(true);
    const footer = label.closest('div')!.parentElement!;
    expect(has(footer, '[color:var(--fr-dt-muted,var(--color-muted-foreground))]')).toBe(false);
    // …which is what lets the prev/next buttons inherit instead of resetting.
    for (const name of ['Prev', 'Next']) {
      const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name))!;
      expect(has(btn, 'text-current'), name).toBe(true);
      expect(has(btn, 'text-foreground'), name).toBe(false);
    }
  });

  it('the bulk-bar count inherits: bg-muted/40 is a wash, not a fill', () => {
    const { container } = draw('DataTable', { columns: COLS, rows: ROWS, selectable: true });
    // The bar only exists once a row is selected, so select one for real.
    const box = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1];
    expect(box, 'a row checkbox').not.toBeUndefined();
    fireEvent.click(box);
    const bar = container.querySelector('.bg-muted\\/40')!;
    expect(bar, 'the bulk-action bar').not.toBeNull();
    const count = bar.querySelector('span')!;
    expect(count.textContent).toBe('1 selected');
    expect(has(count, 'text-current')).toBe(true);
    expect(has(count, 'text-foreground')).toBe(false);
  });

  it('ColumnHeader paints a SURFACE-RELATIVE band, and its ink still names a token', () => {
    // The band moved off the pinned --color-muted fallback and onto .fr-band, which
    // shades --fr-surface — otherwise a table on a navy page painted a WHITE strip
    // across its own header. The authored --fr-ch-header channel is untouched and
    // still wins when set.
    //
    // The INK deliberately keeps its token: --color-muted-foreground is a MUTED ink
    // and the band is a light shade of whatever it sits on, so the two still pair
    // at the default surface. If that stops holding on authored surfaces it is
    // a contrast check that will say so, in a real render.
    const { container } = draw('ColumnHeader', { label: 'Name', sortable: true });
    const root = container.querySelector('[role="columnheader"]')!;
    expect(has(root, 'fr-band'), 'band is surface-relative').toBe(true);
    expect(has(root, '[background:var(--fr-ch-header,var(--color-muted))]'), 'no pinned muted slab').toBe(false);
    // The ink chain is UNCHANGED in value; only its delivery moved. `.fr-band` sets
    // `color: inherit` at (0,2,0), which out-ranks a (0,1,0) text utility, so the ink
    // this line asserts was being computed and then discarded — the header inherited
    // the table's colour instead. Measured 2.64:1 on an authored #1d4ed8 header.
    // --fr-band-ink is read INSIDE .fr-band, so the same chain now actually applies.
    expect(has(root, '[--fr-band-ink:var(--fr-ch-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(container.querySelector('button')!, 'hover:text-foreground')).toBe(true);
  });
});

/* ── charts-extra.tsx ─────────────────────────────────────────────────────── */

describe('charts-extra — content ink inherits, in-cell ink does not', () => {
  it('BarList row label: the axisColor chain ends in currentColor', () => {
    const { container } = draw('BarList', { data: [{ label: 'Direct', value: 40 }] });
    const label = container.querySelector('span.break-words')!;
    expect(has(label, 'text-[color:var(--fr-barlist-axis,currentColor)]')).toBe(true);
    expect(has(label, 'text-[color:var(--fr-barlist-axis,var(--color-foreground))]')).toBe(false);
  });

  it('ProgressCircle readout: the valueColor chain ends in currentColor', () => {
    const { container } = draw('ProgressCircle', { value: 62 });
    const pct = container.querySelector('span.tabular-nums')!;
    expect(has(pct, '[color:var(--fr-ring-value,currentColor)]')).toBe(true);
    expect(has(pct, '[color:var(--fr-ring-value,var(--color-foreground))]')).toBe(false);
  });

  it('Gantt task name: the axisColor chain ends in currentColor', () => {
    const { container } = draw('Gantt', { tasks: [{ label: 'Migrate data', start: 0, end: 4 }] });
    const name = container.querySelector('span.break-words')!;
    expect(has(name, '[color:var(--fr-gantt-axis,currentColor)]')).toBe(true);
    expect(has(name, '[color:var(--fr-gantt-axis,var(--color-foreground))]')).toBe(false);
  });

  it('Heatmap in-cell value KEEPS the token — it sits on the cell\'s own fill', () => {
    const { container } = draw('Heatmap', { cells: [[4, 1]], showValues: true });
    const cell = [...container.querySelectorAll('span')].find((s) => /--fr-heat-a/.test(s.getAttribute('style') ?? ''))!;
    expect(cell, 'a heat cell').not.toBeUndefined();
    expect(has(cell, 'text-[color:var(--fr-heat-value,var(--color-foreground))]')).toBe(true);
    // It may NOT inherit because its fill is an opaque mix into --color-muted.
    expect(
      has(cell, '[background:color-mix(in_srgb,var(--fr-heat-scale,var(--fr-heat-color))_calc(var(--fr-heat-a,0)*1%),var(--color-muted))]'),
    ).toBe(true);
  });
});

/* ── charts-radial.tsx ────────────────────────────────────────────────────── */

describe('charts-radial — the chart root and its readouts inherit', () => {
  it('chartWrap is text-current, not text-foreground', () => {
    const { container } = draw('Gauge', { value: 62 });
    const wrap = container.querySelector('.flex.w-full.flex-col.gap-2')!;
    expect(wrap, 'the chart root').not.toBeNull();
    expect(has(wrap, 'text-current')).toBe(true);
    expect(has(wrap, 'text-foreground')).toBe(false);
  });

  it('Gauge readout: the valueColor chain ends in currentColor', () => {
    const { container } = draw('Gauge', { value: 62 });
    const v = container.querySelector('span.tabular-nums')!;
    expect(has(v, '[color:var(--fr-gauge-value,currentColor)]')).toBe(true);
    expect(has(v, '[color:var(--fr-gauge-value,var(--color-foreground))]')).toBe(false);
  });

  it('Legend: the muted colour sits on the NAME, so the meta value inherits', () => {
    const { container } = draw('RadialBar', {
      data: [{ label: 'Mobile', value: 60 }],
      showLegend: true,
      showValues: true,
    });
    const ul = container.querySelector('ul.list-none')!;
    // The list itself no longer declares a colour — it used to, which forced the
    // meta value to climb back out of muted with a hard --color-foreground.
    expect(colorResets(ul)).toEqual([]);
    expect([...ul.classList].some((c) => /--fr-.*-muted/.test(c))).toBe(false);
    const name = ul.querySelector('span.break-words')!;
    expect([...name.classList].some((c) => /\[color:var\(--fr-.*-muted,var\(--color-muted-foreground\)\)\]/.test(c))).toBe(true);
    const meta = ul.querySelector('span.tabular-nums')!;
    expect(has(meta, '[color:var(--fr-legend-value,currentColor)]')).toBe(true);
    expect(has(meta, '[color:var(--fr-legend-value,var(--color-foreground))]')).toBe(false);
  });
});

/* ── scheduler.tsx ────────────────────────────────────────────────────────── */

describe('scheduler — the tinted block inherits, the opaque face does not', () => {
  const block = (c: HTMLElement): HTMLElement => c.querySelector<HTMLElement>('[role="button"][aria-label]')!;

  it('an un-stacked event title is text-current: the block is a 12% tint', () => {
    const { container } = draw('Scheduler', { events: EVENTS });
    const b = block(container);
    expect(b.className).toContain('/12');
    const title = [...b.querySelectorAll('span')].find((s) => s.textContent === 'Design review')!;
    expect(has(title, 'text-current')).toBe(true);
    expect(has(title, 'text-foreground')).toBe(false);
  });

  it('the STACKED branch restores the token — it paints an opaque --color-card face', () => {
    const { container } = draw('Scheduler', {
      // Overlapping events force the cascade, which paints the opaque face.
      events: [
        { id: 'a', title: 'Design review', start: '09:00', end: '11:00' },
        { id: 'b', title: 'Retro', start: '09:30', end: '10:30' },
      ],
    });
    const stacked = [...container.querySelectorAll<HTMLElement>('[role="button"][aria-label]')].filter((b) =>
      b.className.includes('--color-card'),
    );
    expect(stacked.length, 'the cascade painted at least one opaque face').toBeGreaterThan(0);
    for (const b of stacked) expect(has(b, 'text-foreground'), b.className).toBe(true);
  });

  it('the popover KEEPS the token — fixed-positioned AND its own bg-card', () => {
    const { container } = draw('Scheduler', { events: EVENTS });
    fireEvent.keyDown(block(container), { key: 'Enter' });
    const pop = container.querySelector('.fixed.z-50')!;
    expect(pop, 'the event popover').not.toBeNull();
    expect(has(pop, 'bg-card')).toBe(true);
    expect(has(pop, 'text-foreground')).toBe(true);
  });

  it('the whole-schedule submit KEEPS its own pairing: text-card on the accent fill', () => {
    const { container } = draw('Scheduler', { events: EVENTS, editable: true, showSubmit: true });
    const btn = [...container.querySelectorAll('button')].find((x) => x.className.includes('--fr-sch-accent'))!;
    expect(btn, 'the submit button').not.toBeUndefined();
    expect(has(btn, 'bg-[color:var(--fr-sch-accent,var(--color-foreground))]')).toBe(true);
    expect(has(btn, 'text-card')).toBe(true);
  });
});

/* ── the COMPUTED assertions ─────────────────────────────────────────────────
 * Everything above is structural because jsdom has no Tailwind sheet. Measured
 * directly (see inherited-foreground-charts-structure-layout.test.tsx): jsdom DOES resolve `currentColor` on the `color` property to
 * the inherited value, but returns `var(--x)` verbatim — so the var-chain sites can
 * only be pinned structurally, while the plain `text-current` ones can be measured
 * end to end. The declarations injected below are exactly what Tailwind emits for
 * these class names; the ancestor sets `color` inline rather than through Card's
 * `--fr-card-fg` chain for the same jsdom reason, which does not change the question
 * being asked. rgb(24,24,27) is #18181b, the --color-foreground token the accessibility
 * audit kept finding on dark cards.
 *
 * BOTH halves of the safety argument are measured here: the authored colour must
 * ARRIVE inside a dark container, and the TOP-LEVEL rendering must be UNCHANGED —
 * because `.frayme-root { color: var(--frayme-fg) }` and `--color-foreground:
 * var(--frayme-fg)` are the same value, an un-nested render must compute to exactly
 * what `text-foreground` used to give. */

const TW = '.text-current{color:currentColor}.text-foreground{color:rgb(24,24,27)}';

const inside = (ink: string, type: string, props: Record<string, unknown>) =>
  render(
    <div style={{ color: ink }}>
      <style>{TW}</style>
      <FraymeRenderer spec={one(type, props)} mode="progressive" />
    </div>,
  );

describe('COMPUTED: the ink arrives, and the top level does not move', () => {
  it('a DataTable cell inside a dark container computes to the container ink', () => {
    const { container } = inside('rgb(226, 230, 240)', 'DataTable', { columns: COLS, rows: ROWS });
    const cell = [...container.querySelectorAll('tbody span')].find((s) => s.textContent === 'Ada Lovelace')!;
    expect(getComputedStyle(cell).color).toBe('rgb(226, 230, 240)');
    expect(getComputedStyle(cell).color).not.toBe('rgb(24, 24, 27)');
  });

  it('the SAME DataTable cell at the top level is unchanged — currentColor == the token', () => {
    // rgb(24,24,27) is what `.frayme-root { color: var(--frayme-fg) }` resolves to,
    // and it is the same value --color-foreground carries. If currentColor did not
    // equal the token at root, this is the assertion that would break.
    const { container } = inside('rgb(24, 24, 27)', 'DataTable', { columns: COLS, rows: ROWS });
    const cell = [...container.querySelectorAll('tbody span')].find((s) => s.textContent === 'Ada Lovelace')!;
    expect(getComputedStyle(cell).color).toBe('rgb(24, 24, 27)');
  });

  it('a Scheduler event title inside a dark container computes to the container ink', () => {
    const { container } = inside('rgb(226, 230, 240)', 'Scheduler', { events: EVENTS });
    const title = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Design review')!;
    expect(getComputedStyle(title).color).toBe('rgb(226, 230, 240)');
    expect(getComputedStyle(title).color).not.toBe('rgb(24, 24, 27)');
  });

  it('the SAME Scheduler title at the top level is unchanged', () => {
    const { container } = inside('rgb(24, 24, 27)', 'Scheduler', { events: EVENTS });
    const title = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Design review')!;
    expect(getComputedStyle(title).color).toBe('rgb(24, 24, 27)');
  });
});
