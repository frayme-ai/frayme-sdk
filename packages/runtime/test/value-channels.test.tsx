/**
 * Regression guard for the just-fixed INERT VALUE CHANNELS.
 *
 * For each fixed channel the test asserts the TRIPLE:
 *   (a) the channel var is present in the target element's inline style attr,
 *   (b) the CONSUMING class is present in its className,
 *   (c) the competing token class it must dedupe is ABSENT when the prop is set.
 *
 * Plus per-component UNSET-DEFAULT tests: a spec with the channel prop
 * explicitly unset (null) renders BYTE-IDENTICAL innerHTML to a spec that never
 * mentions the prop at all.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── borderColor channels (border-[color:…] group form vs border-border) ──── */

type BorderCase = {
  type: string;
  props: Record<string, unknown>;
  selector: string;
  cls: string;
  cssVar: string;
};

const BORDER_CASES: BorderCase[] = [
  {
    type: 'Alert',
    props: { title: 'Heads up' },
    selector: '[role="status"]',
    cls: 'border-[color:var(--fr-alert-border,var(--color-border))]',
    cssVar: '--fr-alert-border',
  },
  {
    type: 'Banner',
    // tone:neutral bakes the plain `border-border` token (the dedupe competitor).
    props: { message: 'Maintenance tonight', tone: 'neutral' },
    selector: '[role="status"]',
    cls: 'border-[color:var(--fr-banner-border,var(--color-border))]',
    cssVar: '--fr-banner-border',
  },
  {
    type: 'Callout',
    // left-accent is the variant that bakes `border-border` (the competitor).
    props: { message: 'Note this', variant: 'left-accent' },
    selector: '[role="note"]',
    cls: 'border-[color:var(--fr-callout-border,var(--color-border))]',
    cssVar: '--fr-callout-border',
  },
  {
    type: 'Confirmation',
    props: { message: 'Proceed?' },
    selector: '[role="group"]',
    cls: 'border-[color:var(--fr-confirm-border,var(--color-border))]',
    cssVar: '--fr-confirm-border',
  },
  {
    type: 'ToolCall',
    props: { name: 'search_web' },
    selector: '[data-state]',
    cls: 'border-[color:var(--fr-tool-border,var(--color-border))]',
    cssVar: '--fr-tool-border',
  },
  {
    type: 'Artifact',
    props: { title: 'report.md', content: 'hello' },
    selector: 'figure',
    cls: 'border-[color:var(--fr-artifact-border,var(--color-border))]',
    cssVar: '--fr-artifact-border',
  },
  {
    type: 'Conversation',
    // bordered:true bakes `border-border` — the competitor the value must dedupe.
    props: { bordered: true },
    selector: '[role="log"]',
    cls: 'border-[color:var(--fr-conv-border,var(--color-border))]',
    cssVar: '--fr-conv-border',
  },
  {
    type: 'Toggle',
    props: { label: 'Bold' },
    selector: 'button',
    cls: 'border-[color:var(--fr-toggle-border,var(--color-border))]',
    cssVar: '--fr-toggle-border',
  },
];

describe('value channels — borderColor triple (var + consumer class + competitor deduped)', () => {
  for (const c of BORDER_CASES) {
    it(`${c.type}: borderColor lands in ${c.cssVar}, ${c.cls} present, border-border absent`, () => {
      const { container } = draw(c.type, { ...c.props, borderColor: '#ff0000' });
      const el = container.querySelector(c.selector);
      expect(el, `${c.type} target ${c.selector}`).not.toBeNull();
      // (a) the channel var is on the element's inline style
      expect(styleOf(el!)).toContain(c.cssVar);
      // (b) the consuming group-form class is present
      expect(has(el!, c.cls), `consumer class on ${c.type}`).toBe(true);
      // (c) the competing token class was deduped away
      expect(has(el!, 'border-border'), `border-border deduped on ${c.type}`).toBe(false);
    });
  }

  it('ToggleGroup: borderColor var on the group, consumer class on every item, border-border absent', () => {
    const { container } = draw('ToggleGroup', {
      items: [
        { label: 'One', value: 'one' },
        { label: 'Two', value: 'two' },
      ],
      borderColor: '#ff0000',
    });
    const group = container.querySelector('[role="group"]')!;
    expect(group).not.toBeNull();
    // (a) the resting var rides on the group wrapper and cascades to the items
    expect(styleOf(group)).toContain('--fr-toggle-border');
    const buttons = [...group.querySelectorAll('button')];
    expect(buttons.length).toBe(2);
    for (const btn of buttons) {
      // (b) each item button reads the var through the group-form class
      expect(has(btn, 'border-[color:var(--fr-toggle-border,var(--color-border))]')).toBe(true);
      // (c) the variant's border-border token was deduped away
      expect(has(btn, 'border-border')).toBe(false);
    }
  });
});

/* ── gapValue channels (gap-[var(…)] group form vs the gap-* enum class) ──── */

describe('value channels — gapValue triple', () => {
  it('Grid: gapValue lands in --fr-grid-gap, gap-[var(--fr-grid-gap)] present, gap-4 absent', () => {
    const { container } = draw('Grid', { gapValue: '24px' });
    const el = container.querySelector('[style*="--fr-grid-gap"]');
    expect(el, 'Grid element carrying --fr-grid-gap').not.toBeNull();
    expect(has(el!, 'grid')).toBe(true);
    expect(styleOf(el!)).toContain('--fr-grid-gap');
    expect(has(el!, 'gap-[var(--fr-grid-gap)]')).toBe(true);
    // default gap enum (md → gap-4) must be deduped by the group form
    expect(has(el!, 'gap-4')).toBe(false);
  });

  it('Stack: gapValue lands in --fr-stack-gap, gap-[var(--fr-stack-gap)] present, gap-4 absent', () => {
    const { container } = draw('Stack', { gapValue: '12px' });
    const el = container.querySelector('[style*="--fr-stack-gap"]');
    expect(el, 'Stack element carrying --fr-stack-gap').not.toBeNull();
    expect(styleOf(el!)).toContain('--fr-stack-gap');
    expect(has(el!, 'gap-[var(--fr-stack-gap)]')).toBe(true);
    expect(has(el!, 'gap-4')).toBe(false);
  });
});

/* ── DataTable headerColor (the RC-2 conditional sticky-inherit) ──────────── */

/**
 * jsdom's cssstyle REJECTS the `background: inherit` shorthand (the value never
 * lands in the style attribute), so the DOM can't be inspected directly. We spy
 * on the CSSStyleDeclaration `background` setter instead — React assigns inline
 * styles through it — and capture exactly what the renderer tried to paint.
 */
function captureBackgroundAssignments(fn: () => void): string[] {
  const proto = CSSStyleDeclaration.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'background')!;
  const seen: string[] = [];
  Object.defineProperty(proto, 'background', {
    ...desc,
    set(v: unknown) {
      seen.push(String(v));
      desc.set!.call(this, v);
    },
  });
  try {
    fn();
  } finally {
    Object.defineProperty(proto, 'background', desc);
  }
  return seen;
}

describe('value channels — DataTable headerColor', () => {
  const tableProps = {
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'seats', label: 'Seats' },
    ],
    rows: [{ name: 'Acme', seats: 12 }],
    selectable: true,
  };

  it('headerColor SET: var on the table; th inline background is NOT "inherit"', () => {
    let container!: HTMLElement;
    const assigned = captureBackgroundAssignments(() => {
      ({ container } = draw('DataTable', { ...tableProps, headerColor: '#123456' }));
    });
    const table = container.querySelector('table')!;
    // (a) the channel var is present on the table's inline style
    expect(styleOf(table)).toContain('--fr-dt-header');
    expect(container.querySelectorAll('th').length).toBe(3); // select-all + 2 cols
    // The RC-2 fix: the sticky-opacity `inherit` is DROPPED when headerColor is
    // set (style.background stays unassigned), so --fr-dt-header can paint.
    expect(assigned).not.toContain('inherit');
  });

  it('headerColor UNSET: every th gets background "inherit" (sticky head stays opaque)', () => {
    let container!: HTMLElement;
    const assigned = captureBackgroundAssignments(() => {
      ({ container } = draw('DataTable', tableProps));
    });
    const thCount = container.querySelectorAll('th').length;
    expect(thCount).toBe(3);
    expect(assigned.filter((v) => v === 'inherit').length).toBe(thCount);
  });
});

/* ── SegmentedControl accentText WITHOUT accent ───────────────────────────── */

describe('value channels — SegmentedControl accentText (no accent set)', () => {
  it('selected pill: --fr-sc-accent-text var + the foreground-fallback reader class; text-foreground absent', () => {
    const { container } = draw('SegmentedControl', {
      options: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
      ],
      value: 'day',
      accentText: '#00ff00',
    });
    const selected = container.querySelector('button[aria-pressed="true"]');
    expect(selected).not.toBeNull();
    // (a) the var rides on the SELECTED pill's inline style
    expect(styleOf(selected!)).toContain('--fr-sc-accent-text');
    // (b) with NO accent, the accentText-only reader (foreground-token fallback) applies
    expect(has(selected!, '[color:var(--fr-sc-accent-text,var(--color-foreground))]')).toBe(true);
    // (c) the competing token class is absent when the channel is set
    expect(has(selected!, 'text-foreground')).toBe(false);
    // and the accent-set variant of the reader must NOT be used
    expect(has(selected!, '[color:var(--fr-sc-accent-text,var(--color-primary-foreground))]')).toBe(false);
  });
});

/* ── Progress color beats the tone enum ───────────────────────────────────── */

describe('value channels — Progress color (value > tone enum)', () => {
  it('color SET with tone:success → var on wrapper, bar reader present, tone class DROPPED from the bar', () => {
    const { container } = draw('Progress', { value: 40, tone: 'success', color: '#ff00ff' });
    // (a) the channel var is on the field wrapper (cascades to the bar)
    const wrapper = container.querySelector('[style*="--fr-progress-bar"]');
    expect(wrapper, 'Progress wrapper carrying --fr-progress-bar').not.toBeNull();
    const bar = container.querySelector('[role="progressbar"]')!.firstElementChild!;
    // (b) the bar reads the var through its baked background reader
    expect(has(bar, '[background:var(--fr-progress-bar,var(--color-primary))]')).toBe(true);
    // (c) the tone enum class (which would set --fr-progress-bar ON the bar and
    // beat the wrapper-inherited value) must be dropped when color is set
    expect(has(bar, '[--fr-progress-bar:var(--color-success)]')).toBe(false);
  });

  it('color UNSET with tone:success → the tone class IS on the bar (enum path intact)', () => {
    const { container } = draw('Progress', { value: 40, tone: 'success' });
    const bar = container.querySelector('[role="progressbar"]')!.firstElementChild!;
    expect(has(bar, '[--fr-progress-bar:var(--color-success)]')).toBe(true);
  });
});

/* ── KanbanCard accent (border-l-[color:…] side-specific channel) ─────────── */

describe('value channels — KanbanCard accent', () => {
  it('accent lands in --fr-kanbancard-accent; the border-l reader class is the SOLE border-l color source', () => {
    const { container } = draw('KanbanCard', { title: 'Ship it', accent: '#0000ff' });
    // (a) the var rides on the KanbanCard wrapper
    const wrapper = container.querySelector('[style*="--fr-kanbancard-accent"]');
    expect(wrapper, 'KanbanCard wrapper carrying --fr-kanbancard-accent').not.toBeNull();
    // (b) the card body consumes it via the static border-l color reader
    const body = wrapper!.firstElementChild!;
    expect(
      has(body, 'border-l-[color:var(--fr-kanbancard-accent,var(--fr-kanbancard-bd,var(--color-border)))]'),
    ).toBe(true);
    // (c) no competing border-l color class — the reader is the single source
    const borderLColorTokens = [...body.classList].filter((t) => t.startsWith('border-l-[color:'));
    expect(borderLColorTokens).toHaveLength(1);
  });
});

/* ── UNSET-DEFAULT byte-identical rule ────────────────────────────────────── */

type UnsetCase = { type: string; props: Record<string, unknown>; channel: string };

const UNSET_CASES: UnsetCase[] = [
  { type: 'Alert', props: { title: 'Heads up' }, channel: 'borderColor' },
  { type: 'Banner', props: { message: 'Maintenance tonight', tone: 'neutral' }, channel: 'borderColor' },
  { type: 'Callout', props: { message: 'Note this', variant: 'left-accent' }, channel: 'borderColor' },
  { type: 'Confirmation', props: { message: 'Proceed?' }, channel: 'borderColor' },
  { type: 'ToolCall', props: { name: 'search_web' }, channel: 'borderColor' },
  { type: 'Artifact', props: { title: 'report.md', content: 'hello' }, channel: 'borderColor' },
  { type: 'Conversation', props: { bordered: true }, channel: 'borderColor' },
  { type: 'Toggle', props: { label: 'Bold' }, channel: 'borderColor' },
  {
    type: 'ToggleGroup',
    props: {
      items: [
        { label: 'One', value: 'one' },
        { label: 'Two', value: 'two' },
      ],
    },
    channel: 'borderColor',
  },
  { type: 'Grid', props: {}, channel: 'gapValue' },
  { type: 'Stack', props: {}, channel: 'gapValue' },
  {
    type: 'DataTable',
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ name: 'Acme' }],
    },
    channel: 'headerColor',
  },
  {
    type: 'SegmentedControl',
    props: {
      options: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
      ],
      value: 'day',
    },
    channel: 'accentText',
  },
  { type: 'Progress', props: { value: 40, tone: 'success' }, channel: 'color' },
  { type: 'KanbanCard', props: { title: 'Ship it' }, channel: 'accent' },
];

/** Canonicalise React's per-MOUNT `useId` token. Trigger↔panel ids (aria-controls)
 *  carry it so two `repeat` rows cannot share one id; two separate renders then
 *  differ in that token alone, which is orthogonal to the null-vs-absent question
 *  here. Measured: without this, the assertion fails even when both sides are
 *  given IDENTICAL props — it would stop testing prop handling entirely. */
const canonIds = (html: string): string => html.replace(/_r_[0-9a-z]+_/g, '_rID_');

describe('value channels — unset default is byte-identical to prop-not-mentioned', () => {
  for (const c of UNSET_CASES) {
    it(`${c.type}: ${c.channel}:null renders byte-identical to the prop being absent`, () => {
      const withNull = draw(c.type, { ...c.props, [c.channel]: null });
      const nullHtml = withNull.container.innerHTML;
      withNull.unmount();
      const without = draw(c.type, { ...c.props });
      expect(canonIds(nullHtml)).toBe(canonIds(without.container.innerHTML));
    });
  }
});

/* ── DatePicker/Calendar base-text channel (--fr-cal-fg) ─────────────────────
   `color` recolors the REGULAR day numbers, the month title, and the chosen
   field value — muted/disabled days keep mutedColor, the selected day keeps
   accentText. Added later (the general date text had no channel at all). */

describe('date components — base text color channel (--fr-cal-fg)', () => {
  it('DatePicker: color lands in --fr-cal-fg; field + default day cells consume the fg var chain', () => {
    const { container } = draw('DatePicker', { mode: 'inline', value: '2026-07-15', color: '#ff00aa' });
    const root = container.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(styleOf(root)).toContain('--fr-cal-fg');
    // the field surface consumes the chain (chosen value text follows it)
    const fgReaders = container.querySelectorAll(
      '.text-\\[color\\:var\\(--fr-cal-fg\\,var\\(--color-foreground\\)\\)\\]',
    );
    expect(fgReaders.length).toBeGreaterThan(2); // field + month title + day cells
    // no node still carries the old hardcoded token on the recolorable surfaces
    expect(container.querySelector('.text-foreground')).toBeNull();
  });

  it('Calendar: color channel present; selected day still reads accent-fg, muted days keep the muted var', () => {
    const { container } = draw('Calendar', { value: '2026-07-15', month: '2026-07', color: '#ff00aa' });
    const root = container.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(styleOf(root)).toContain('--fr-cal-fg');
    const selected = container.querySelector('[aria-pressed="true"], [aria-selected="true"]');
    if (selected) {
      expect(selected.className).toContain('--fr-cal-accent-fg');
    }
  });

  it('DatePicker: color:null renders byte-identical to the prop being absent', () => {
    const withNull = draw('DatePicker', { mode: 'inline', value: '2026-07-15', color: null });
    const nullHtml = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('DatePicker', { mode: 'inline', value: '2026-07-15' });
    expect(canonIds(nullHtml)).toBe(canonIds(without.container.innerHTML));
  });
});
