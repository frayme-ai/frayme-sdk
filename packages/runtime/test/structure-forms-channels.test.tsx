/**
 * Regression guard — PARTIAL-PROP / COHERENCE-GROUP fixes:
 * structure-flow (Timeline/TimelineItem/Stepper/Tree) · inputs-numeric
 * (NumberInput/RangeSlider) · layout-pane (SplitPane/VirtualList) · util-overlay
 * (Backdrop/Kbd) · forms (Slider/HelpLine) · charts-proportion (Sankey) ·
 * layout (Grid) · actions (Toggle/ToggleGroup) · board-nav (KanbanCard).
 *
 * Follows test/value-channels.test.tsx: for each fixed channel the TRIPLE —
 *   (a) the channel var lands on the target element's inline style,
 *   (b) the CONSUMING class (group form / var chain) is present,
 *   (c) the competing token class is ABSENT,
 * plus per-component UNSET-DEFAULT tests: prop explicitly null renders
 * BYTE-IDENTICAL innerHTML to the prop never being mentioned.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/** Strip React's per-INSTANCE useId token from aria pairing ids before a
 *  byte-identical comparison. Two separate mounts legitimately differ there:
 *  ids must be unique per instance or a component inside a json-render `repeat`
 *  emits duplicate ids and points row two's trigger at row one's panel (see
 *  test/aria-repeat-ids.test.tsx). The invariant these tests protect — a null
 *  prop renders the same as an absent prop — is unaffected. */
const norm = (html: string): string => html.replace(/_r_[0-9a-z]+_/g, '_rID_');

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── Timeline — connector offset follows the size enum ─────────────────────── */

describe('Timeline — connector offset per size (md byte-identical)', () => {
  const items = [{ title: 'One' }, { title: 'Two' }];

  it('horizontal: sm→top-1.5, lg→top-2.5, md keeps top-2', () => {
    for (const [size, cls] of [
      ['sm', 'top-1.5'],
      ['md', 'top-2'],
      ['lg', 'top-2.5'],
    ] as const) {
      const { container, unmount } = draw('Timeline', { items, orientation: 'horizontal', size });
      const rail = container.querySelector('li > span[aria-hidden]');
      expect(rail, `horizontal rail at size ${size}`).not.toBeNull();
      expect(has(rail!, cls), `${cls} on the ${size} horizontal rail`).toBe(true);
      unmount();
    }
  });

  it('vertical: the rail runs dot-bottom → row-bottom so consecutive segments MEET (one continuous line)', () => {
    // Previously the rail lived inside the dot column, whose
    // flex-stretched height excludes the row's pb-6 — every segment stopped
    // ~32px short and the connector read as broken ticks. It is now a child of
    // the ROW, pinned bottom-0, so each segment meets the next row's dot.
    for (const [size, top, x] of [
      ['sm', 'top-3', 'left-[calc(0.375rem-1px)]'],
      ['md', 'top-4', 'left-[calc(0.5rem-1px)]'],
      ['lg', 'top-5', 'left-[calc(0.625rem-1px)]'],
    ] as const) {
      const { container, unmount } = draw('Timeline', { items, size });
      const rail = [...container.querySelectorAll('span[aria-hidden]')].find((s) => has(s, 'w-0.5'));
      expect(rail, `vertical rail at size ${size}`).not.toBeNull();
      expect(has(rail!, top)).toBe(true);
      expect(has(rail!, 'bottom-0')).toBe(true);
      expect(has(rail!, x)).toBe(true);
      // it hangs off the ROW (li), not the dot column
      expect(rail!.parentElement!.tagName).toBe('LI');
      unmount();
    }
  });

  it('size:null renders byte-identical to size absent (md default)', () => {
    const withNull = draw('Timeline', { items, size: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Timeline', { items });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── TimelineItem — connectorColor channel + dot-chained active ring ───────── */

describe('TimelineItem — connectorColor + active ring follows dotColor', () => {
  it('connectorColor triple: var on the wrapper, rail reads the line var, bg-border absent', () => {
    const { container } = draw('TimelineItem', { title: 'Deployed', connectorColor: '#ff0000' });
    const wrapper = container.querySelector('[style*="--fr-timelineitem-line"]');
    expect(wrapper, 'wrapper carrying --fr-timelineitem-line').not.toBeNull();
    const rail = [...container.querySelectorAll('span[aria-hidden]')].find((s) => has(s, 'w-0.5'));
    expect(rail).not.toBeNull();
    expect(has(rail!, '[background:var(--fr-timelineitem-line,var(--color-border))]')).toBe(true);
    expect(has(rail!, 'bg-border')).toBe(false);
  });

  it('active ring chains the dot var: [--tw-ring-color:var(--fr-timelineitem-dot,var(--fr-accent))]', () => {
    const { container } = draw('TimelineItem', { title: 'Now', active: true, dotColor: '#00ff00' });
    const dot = container.querySelector('span.z-\\[1\\]');
    expect(dot).not.toBeNull();
    expect(has(dot!, '[--tw-ring-color:var(--fr-timelineitem-dot,var(--fr-accent))]')).toBe(true);
    expect(has(dot!, '[--tw-ring-color:var(--color-primary)]')).toBe(false);
  });

  for (const channel of ['connectorColor', 'dotColor']) {
    it(`${channel}:null renders byte-identical to the prop being absent`, () => {
      const withNull = draw('TimelineItem', { title: 'Deployed', active: true, [channel]: null });
      const nullHtml = norm(withNull.container.innerHTML);
      withNull.unmount();
      const without = draw('TimelineItem', { title: 'Deployed', active: true });
      expect(nullHtml).toBe(norm(without.container.innerHTML));
    });
  }
});

/* ── Stepper — future labels join mutedColor; future marker ring joins connectorColor ── */

describe('Stepper — incomplete chrome coherence', () => {
  const steps = [{ label: 'Account' }, { label: 'Billing' }, { label: 'Done' }];

  it('future label reads the muted var chain; text-muted-foreground gone from labels', () => {
    const { container } = draw('Stepper', { steps, current: 1, mutedColor: '#123456' });
    const ol = container.querySelector('ol')!;
    expect(styleOf(ol)).toContain('--fr-stepper-muted');
    const futureLabel = [...container.querySelectorAll('span')].find((s) =>
      has(s, 'text-[color:var(--fr-stepper-muted,var(--color-muted-foreground))]'),
    );
    expect(futureLabel, 'future label consuming the muted chain').not.toBeNull();
    const tokenLabel = [...container.querySelectorAll('span')].find(
      (s) => has(s, 'text-muted-foreground') && has(s, 'truncate'),
    );
    expect(tokenLabel, 'no truncated label still carries the raw token').toBeUndefined();
  });

  it('un-reached marker border reads the line var chain; border-border absent', () => {
    const { container } = draw('Stepper', { steps, current: 1, connectorColor: '#654321' });
    const ol = container.querySelector('ol')!;
    expect(styleOf(ol)).toContain('--fr-stepper-line');
    const futureMarker = [...container.querySelectorAll('span')].find((s) =>
      has(s, 'border-[color:var(--fr-stepper-line,var(--color-border))]'),
    );
    expect(futureMarker, 'future marker consuming the line chain').not.toBeNull();
    expect([...container.querySelectorAll('*')].some((el) => has(el, 'border-border'))).toBe(false);
  });

  for (const channel of ['mutedColor', 'connectorColor']) {
    it(`${channel}:null renders byte-identical to the prop being absent`, () => {
      const withNull = draw('Stepper', { steps, current: 1, [channel]: null });
      const nullHtml = norm(withNull.container.innerHTML);
      withNull.unmount();
      const without = draw('Stepper', { steps, current: 1 });
      expect(nullHtml).toBe(norm(without.container.innerHTML));
    });
  }
});

/* ── Tree — node glyph joins lineColor; selected row gets the 14% accent fill ── */

describe('Tree — furniture + selected-row treatment', () => {
  const nodes = [
    { label: 'src', icon: 'check', children: [{ label: 'index.ts' }] },
    { label: 'package.json', icon: 'check' },
  ];

  it('node icon reads the lineColor chain; the raw muted token is gone from icon slots', () => {
    const { container } = draw('Tree', { nodes, lineColor: '#ff8800' });
    const tree = container.querySelector('[role="tree"]')!;
    expect(styleOf(tree)).toContain('--fr-tree-line');
    const glyph = [...container.querySelectorAll('span')].find(
      (s) => has(s, 'shrink-0') && has(s, 'text-[color:var(--fr-tree-line,var(--color-muted-foreground))]'),
    );
    expect(glyph, 'node glyph consuming the line chain').not.toBeNull();
    expect([...container.querySelectorAll('span')].some((s) => has(s, 'text-muted-foreground'))).toBe(false);
  });

  it('selecting a row applies the accent 14% color-mix row fill (SidebarItem pattern)', () => {
    const { container } = draw('Tree', { nodes, selectable: true, accent: '#0000ff' });
    const row = container.querySelector('[role="treeitem"]')!;
    fireEvent.click(row);
    const rowDiv = row.querySelector('div')!;
    // quiet-defaults: the 14% color-mix row fill is unchanged; only the unset
    // fallback moved from the brand token to the neutral high-contrast foreground.
    expect(
      has(rowDiv, '[background:color-mix(in_srgb,var(--fr-tree-accent,var(--fr-accent))_14%,transparent)]'),
    ).toBe(true);
    expect(has(rowDiv, 'text-current')).toBe(true);
  });

  for (const channel of ['lineColor', 'accent']) {
    it(`${channel}:null renders byte-identical to the prop being absent`, () => {
      const withNull = draw('Tree', { nodes, [channel]: null });
      const nullHtml = norm(withNull.container.innerHTML);
      withNull.unmount();
      const without = draw('Tree', { nodes });
      expect(nullHtml).toBe(norm(without.container.innerHTML));
    });
  }
});

/* ── NumberInput — step buttons + placeholder join mutedColor; ring binds accent ── */

describe('NumberInput — muted chrome + accent focus ring', () => {
  it('step buttons read the muted chain (token gone) and bind the accent focus ring', () => {
    const { container } = draw('NumberInput', { value: 1, mutedColor: '#336699', accent: '#993366' });
    const wrap = container.querySelector('[style*="--fr-number-muted"]');
    expect(wrap, 'wrap carrying --fr-number-muted').not.toBeNull();
    for (const label of ['Decrease', 'Increase']) {
      const btn = container.querySelector(`button[aria-label="${label}"]`)!;
      expect(btn).not.toBeNull();
      expect(has(btn, 'text-[color:var(--fr-number-muted,var(--color-muted-foreground))]')).toBe(true);
      expect(has(btn, 'text-muted-foreground')).toBe(false);
      expect(has(btn, 'focus-visible:[--tw-ring-color:var(--fr-number-accent,var(--fr-accent))]')).toBe(true);
    }
  });

  it('placeholder reads the muted chain; placeholder:text-muted-foreground gone', () => {
    const { container } = draw('NumberInput', { placeholder: 'Qty', mutedColor: '#336699' });
    const input = container.querySelector('input')!;
    expect(has(input, 'placeholder:text-[color:var(--fr-number-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(input, 'placeholder:text-muted-foreground')).toBe(false);
  });

  it('mutedColor:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('NumberInput', { value: 1, placeholder: 'Qty', mutedColor: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('NumberInput', { value: 1, placeholder: 'Qty' });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── RangeSlider — out-of-range histogram bars join trackColor ─────────────── */

describe('RangeSlider — inactive-surfaces coherence (histogram)', () => {
  const props = {
    min: 0,
    max: 100,
    valueMin: 40,
    valueMax: 60,
    showHistogram: true,
    histogram: [1, 2, 3, 4, 5, 5, 4, 3, 2, 1],
  };

  it('out-of-range bars read the track var chain (muted fallback); bg-muted gone', () => {
    const { container } = draw('RangeSlider', { ...props, trackColor: '#abcdef' });
    const root = container.querySelector('[role="group"]')!;
    expect(styleOf(root)).toContain('--fr-range-track');
    const bars = [...container.querySelectorAll('span')].filter((s) => has(s, 'flex-1'));
    expect(bars.length).toBe(10);
    // bar 0 (center 0%) is out of the 40–60 selection; bar 4 (≈44%) is inside
    expect(has(bars[0], '[background:var(--fr-range-track,var(--color-muted))]')).toBe(true);
    expect(has(bars[0], 'bg-muted')).toBe(false);
    expect(has(bars[4], '[background:var(--fr-range-accent,var(--fr-accent))]')).toBe(true);
  });

  it('trackColor:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('RangeSlider', { ...props, trackColor: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('RangeSlider', { ...props });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── SplitPane — resting divider joins borderColor ─────────────────────────── */

describe('SplitPane — divider follows the container borderColor', () => {
  it('divider reads the border var chain; bg-border gone; hover/focus primaries kept', () => {
    const { container } = draw('SplitPane', { borderColor: '#224466' });
    const outer = container.querySelector('[style*="--fr-splitpane-border"]');
    expect(outer, 'container carrying --fr-splitpane-border').not.toBeNull();
    const divider = container.querySelector('[role="separator"]')!;
    expect(has(divider, '[background:var(--fr-splitpane-border,var(--color-border))]')).toBe(true);
    expect(has(divider, 'bg-border')).toBe(false);
    expect(has(divider, 'hover:bg-primary/40')).toBe(true);
  });

  it('borderColor:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('SplitPane', { borderColor: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('SplitPane', {});
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── VirtualList — leading icon joins mutedColor; row dividers join borderColor ── */

describe('VirtualList — icon + divider coherence', () => {
  const items = [
    { label: 'Alpha', description: 'first', icon: 'check' },
    { label: 'Beta', trailing: '42' },
  ];

  it('row icon reads the muted chain (token gone); dividers read the border chain (divide-border gone)', () => {
    const { container } = draw('VirtualList', { items, mutedColor: '#445566', borderColor: '#665544' });
    const viewport = container.querySelector('[role="listbox"]')!;
    expect(styleOf(viewport)).toContain('--fr-vlist-muted');
    expect(styleOf(viewport)).toContain('--fr-vlist-border');
    const icon = [...container.querySelectorAll('span')].find(
      (s) => has(s, 'shrink-0') && has(s, 'text-[color:var(--fr-vlist-muted,var(--color-muted-foreground))]'),
    );
    expect(icon, 'leading icon consuming the muted chain').not.toBeNull();
    expect([...container.querySelectorAll('span')].some((s) => has(s, 'text-muted-foreground'))).toBe(false);
    const rows = container.querySelector('.divide-y')!;
    expect(has(rows, '[&>*+*]:[border-color:var(--fr-vlist-border,var(--color-border))]')).toBe(true);
    expect(has(rows, 'divide-border')).toBe(false);
  });

  for (const channel of ['mutedColor', 'borderColor']) {
    it(`${channel}:null renders byte-identical to the prop being absent`, () => {
      const withNull = draw('VirtualList', { items, [channel]: null });
      const nullHtml = norm(withNull.container.innerHTML);
      withNull.unmount();
      const without = draw('VirtualList', { items });
      expect(nullHtml).toBe(norm(without.container.innerHTML));
    });
  }
});

/* ── Backdrop — opacity enum composes with overlayColor via color-mix ──────── */

describe('Backdrop — opacity × overlayColor composition', () => {
  it('scrim class mixes the fill var at the enum percentage (overlayColor no longer bypasses opacity)', () => {
    const { container } = draw('Backdrop', { active: true, overlayColor: '#112233', opacity: 'light' });
    const scrim = container.querySelector('.z-30')!;
    expect(scrim).not.toBeNull();
    expect(styleOf(scrim)).toContain('--fr-backdrop-fill');
    expect(has(scrim, 'bg-[color:color-mix(in_srgb,var(--fr-backdrop-fill,#000)_25%,transparent)]')).toBe(true);
    // the old direct-var form (which let the color bypass opacity) is gone
    expect(has(scrim, 'bg-[color:var(--fr-backdrop-fill,rgba(0,0,0,0.25))]')).toBe(false);
  });

  it('default (medium) uses the 45% mix', () => {
    const { container } = draw('Backdrop', { active: true });
    const scrim = container.querySelector('.z-30')!;
    expect(has(scrim, 'bg-[color:color-mix(in_srgb,var(--fr-backdrop-fill,#000)_45%,transparent)]')).toBe(true);
  });

  it('overlayColor:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('Backdrop', { active: true, overlayColor: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Backdrop', { active: true });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── Kbd — the solid key-lip shadow chains borderColor ─────────────────────── */

describe('Kbd — key-lip shadow follows borderColor', () => {
  it('solid chip shadow reads the border var chain; the token-only shadow is gone', () => {
    const { container } = draw('Kbd', { keys: ['Cmd', 'K'], borderColor: '#778899' });
    const wrap = container.querySelector('[style*="--fr-kbd-border"]');
    expect(wrap, 'wrapper carrying --fr-kbd-border').not.toBeNull();
    const chip = container.querySelector('kbd')!;
    expect(has(chip, 'shadow-[0_1px_0_var(--fr-kbd-border,var(--color-border))]')).toBe(true);
    expect(has(chip, 'shadow-[0_1px_0_var(--color-border)]')).toBe(false);
  });

  it('borderColor:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('Kbd', { keys: ['Cmd', 'K'], borderColor: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Kbd', { keys: ['Cmd', 'K'] });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── Slider — showValue readout survives labelPlacement:hidden ─────────────── */

describe('Slider — value readout escapes the sr-only label', () => {
  it('labelPlacement:hidden keeps the readout visible OUTSIDE the label', () => {
    const { container } = draw('Slider', { label: 'Volume', name: 'vol', value: 40, labelPlacement: 'hidden' });
    const readout = [...container.querySelectorAll('span')].find((s) => s.textContent === '40');
    expect(readout, 'visible value readout').toBeDefined();
    expect(readout!.closest('label'), 'readout must NOT sit inside the sr-only label').toBeNull();
    // the label itself stays in the DOM for a11y, visually hidden
    expect(container.querySelector('label.sr-only')).not.toBeNull();
  });

  it('default placement keeps the readout INSIDE the label (unchanged path)', () => {
    const { container } = draw('Slider', { label: 'Volume', name: 'vol', value: 40 });
    const readout = [...container.querySelectorAll('span')].find((s) => s.textContent === '40');
    expect(readout).toBeDefined();
    expect(readout!.closest('label')).not.toBeNull();
  });

  it('labelPlacement:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('Slider', { label: 'Volume', name: 'vol', value: 40, labelPlacement: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Slider', { label: 'Volume', name: 'vol', value: 40 });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── forms HelpLine — the error line is announced (role=alert) ─────────────── */

describe('forms HelpLine — role=alert family parity', () => {
  it('Input errorText renders with role=alert', () => {
    const { container } = draw('Input', { label: 'Email', name: 'email', errorText: 'Required field' });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toBe('Required field');
  });

  it('helpText alone renders WITHOUT role=alert', () => {
    const { container } = draw('Input', { label: 'Email', name: 'email', helpText: 'We never share it' });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

/* ── Sankey — the shared fillOpacity enum reaches the flow bands ───────────── */

describe('Sankey — fillOpacity on link bands', () => {
  const data = {
    nodes: [{ label: 'A' }, { label: 'B' }],
    links: [{ source: 0, target: 1, value: 10 }],
  };
  const bandOf = (container: HTMLElement) => container.querySelector('svg path')!;

  it('solid → 0.45, soft → 0.12', () => {
    const solid = draw('Sankey', { ...data, fillOpacity: 'solid' });
    expect(bandOf(solid.container).getAttribute('fill-opacity')).toBe('0.45');
    solid.unmount();
    const soft = draw('Sankey', { ...data, fillOpacity: 'soft' });
    expect(bandOf(soft.container).getAttribute('fill-opacity')).toBe('0.12');
  });

  it('fillOpacity:null renders byte-identical to the prop being absent (0.22 kept)', () => {
    const withNull = draw('Sankey', { ...data, fillOpacity: null });
    const nullHtml = norm(withNull.container.innerHTML);
    expect(bandOf(withNull.container).getAttribute('fill-opacity')).toBe('0.22');
    withNull.unmount();
    const without = draw('Sankey', { ...data });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── Grid — font channel parity with the other layout containers ───────────── */

describe('Grid — font typeface cascade', () => {
  it('font:mono lands as font-mono on the grid root', () => {
    const { container } = draw('Grid', { font: 'mono' });
    const el = container.querySelector('.grid');
    expect(el).not.toBeNull();
    expect(has(el!, 'font-mono')).toBe(true);
  });

  it('font:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('Grid', { font: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Grid', {});
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── Toggle / ToggleGroup — resting text `color` channel (Pagination parity) ── */

describe('Toggle/ToggleGroup — resting text color channel', () => {
  it('Toggle: color triple — var on the button, group-form reader present, text-foreground deduped', () => {
    const { container } = draw('Toggle', { label: 'Bold', color: '#ff0066' });
    const btn = container.querySelector('button')!;
    expect(styleOf(btn)).toContain('--fr-toggle-fg');
    expect(has(btn, 'text-[color:var(--fr-toggle-fg,var(--color-foreground))]')).toBe(true);
    expect(has(btn, 'text-foreground')).toBe(false);
  });

  it('ToggleGroup: var on the group, reader on every item, token deduped', () => {
    const { container } = draw('ToggleGroup', {
      items: [
        { label: 'One', value: 'one' },
        { label: 'Two', value: 'two' },
      ],
      color: '#ff0066',
    });
    const group = container.querySelector('[role="group"]')!;
    expect(styleOf(group)).toContain('--fr-toggle-fg');
    const buttons = [...group.querySelectorAll('button')];
    expect(buttons.length).toBe(2);
    for (const btn of buttons) {
      expect(has(btn, 'text-[color:var(--fr-toggle-fg,var(--color-foreground))]')).toBe(true);
      expect(has(btn, 'text-foreground')).toBe(false);
    }
  });

  it('Toggle color:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('Toggle', { label: 'Bold', color: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('Toggle', { label: 'Bold' });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });

  it('ToggleGroup color:null renders byte-identical to the prop being absent', () => {
    const items = [
      { label: 'One', value: 'one' },
      { label: 'Two', value: 'two' },
    ];
    const withNull = draw('ToggleGroup', { items, color: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('ToggleGroup', { items });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});

/* ── KanbanCard — the assignee avatar fill derives from mutedColor ─────────── */

describe('KanbanCard — avatar fill follows the card muted chain', () => {
  it('mutedColor set → --fr-kanbancard-avatar is a 15% color-mix; the avatar reads the var chain (bg-muted gone)', () => {
    const { container } = draw('KanbanCard', { title: 'Ship it', assignee: 'Priya Gupta', mutedColor: '#123456' });
    const wrapper = container.querySelector('[style*="--fr-kanbancard-avatar"]');
    expect(wrapper, 'wrapper carrying the derived avatar var').not.toBeNull();
    expect(styleOf(wrapper!)).toContain('color-mix(in srgb, #123456 15%, transparent)');
    const avatar = container.querySelector('span[title="Priya Gupta"]')!;
    expect(has(avatar, '[background:var(--fr-kanbancard-avatar,var(--color-muted))]')).toBe(true);
    expect(has(avatar, 'bg-muted')).toBe(false);
  });

  it('mutedColor unset → no avatar var (the muted-token fallback holds)', () => {
    const { container } = draw('KanbanCard', { title: 'Ship it', assignee: 'PG' });
    expect(container.querySelector('[style*="--fr-kanbancard-avatar"]')).toBeNull();
  });

  it('mutedColor:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('KanbanCard', { title: 'Ship it', assignee: 'PG', mutedColor: null });
    const nullHtml = norm(withNull.container.innerHTML);
    withNull.unmount();
    const without = draw('KanbanCard', { title: 'Ship it', assignee: 'PG' });
    expect(nullHtml).toBe(norm(without.container.innerHTML));
  });
});
