/**
 * Regression guard — PARTIAL-PROP + COHERENCE-GROUP fixes across
 * charts.tsx / ai-flow.tsx / charts-extra.tsx / charts-radial.tsx (Tracker) /
 * data-display.tsx (Alert, Avatar) / overlay-surfaces.tsx (Dialog, Drawer).
 *
 * Follows test/value-channels.test.tsx exactly: for each fixed channel the
 * TRIPLE — (a) the channel var is present in the target element's inline style
 * attr, (b) the CONSUMING group-form class is present, (c) the competing token
 * class is ABSENT — plus per-component UNSET-DEFAULT tests (channel explicitly
 * null renders BYTE-IDENTICAL innerHTML to the prop never being mentioned).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}) =>
  render(<FraymeRenderer spec={one(type, props, state)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── HIGH: TypingIndicator — the three bouncing dots follow mutedColor ─────── */

describe('TypingIndicator — dots inherit the mutedColor chain (bg-current)', () => {
  it('mutedColor SET: var on the wrapper, wrapper reader class present, dots bg-current, bg-muted-foreground absent', () => {
    const { container } = draw('TypingIndicator', { label: 'Thinking', mutedColor: '#ff0000' });
    const wrap = container.querySelector('[role="status"]')!;
    expect(wrap).not.toBeNull();
    // (a) the channel var rides on the wrapper
    expect(styleOf(wrap)).toContain('--fr-typing-muted');
    // (b) the wrapper's consuming class (the dots inherit via currentColor)
    expect(has(wrap, '[color:var(--fr-typing-muted,var(--color-muted-foreground))]')).toBe(true);
    // the three dots paint with bg-current so they follow the wrapper colour
    const dots = container.querySelectorAll('.bg-current');
    expect(dots.length).toBe(3);
    // (c) the old hardcoded token is gone from every dot
    expect(container.querySelector('.bg-muted-foreground')).toBeNull();
  });
});

/* ── HIGH: Dialog & Drawer — on-surface `color` channel on the panel ───────── */

describe('Dialog/Drawer — panel on-surface color channel (--fr-dialog-fg)', () => {
  const state = { ui: { open: true } };

  it('Dialog: color lands in --fr-dialog-fg; panel reads the group form; text-card-foreground absent', () => {
    const { container } = draw('Dialog', { title: 'T', openPath: '/ui/open', color: '#00ff88' }, state);
    const panel = container.querySelector('[role="dialog"]')!;
    expect(panel).not.toBeNull();
    expect(styleOf(panel)).toContain('--fr-dialog-fg');
    expect(has(panel, 'text-[color:var(--fr-dialog-fg,var(--fr-surface-fg,var(--color-card-foreground)))]')).toBe(true);
    expect(has(panel, 'text-card-foreground')).toBe(false);
  });

  it('Drawer: color lands in --fr-dialog-fg; panel reads the group form; text-card-foreground absent', () => {
    const { container } = draw('Drawer', { title: 'T', openPath: '/ui/open', color: '#00ff88' }, state);
    const panel = container.querySelector('[role="dialog"]')!;
    expect(panel).not.toBeNull();
    expect(styleOf(panel)).toContain('--fr-dialog-fg');
    expect(has(panel, 'text-[color:var(--fr-dialog-fg,var(--fr-surface-fg,var(--color-card-foreground)))]')).toBe(true);
    expect(has(panel, 'text-card-foreground')).toBe(false);
  });

  it('Dialog: × close button reads the mutedColor chain; text-muted-foreground absent', () => {
    const { container } = draw('Dialog', { title: 'T', openPath: '/ui/open', mutedColor: '#123456' }, state);
    const panel = container.querySelector('[role="dialog"]')!;
    expect(styleOf(panel)).toContain('--fr-dialog-muted');
    const close = container.querySelector('button[aria-label="Close"]')!;
    expect(close).not.toBeNull();
    expect(has(close, 'text-[color:var(--fr-dialog-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(close, 'text-muted-foreground')).toBe(false);
  });

  it('Drawer: × close button reads the mutedColor chain; text-muted-foreground absent', () => {
    const { container } = draw('Drawer', { title: 'T', openPath: '/ui/open', mutedColor: '#123456' }, state);
    const close = container.querySelector('button[aria-label="Close"]')!;
    expect(close).not.toBeNull();
    expect(has(close, 'text-[color:var(--fr-dialog-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(close, 'text-muted-foreground')).toBe(false);
  });
});

/* ── HIGH: Alert — "status accent" coherence group ─────────────────────────── */

describe('Alert — tone/type feed the default accent (icon + accentBar)', () => {
  it('tone:success + accentBar: the default-accent var class is set and both readers chain through it', () => {
    const { container } = draw('Alert', { title: 'Saved', tone: 'success', accentBar: true });
    const root = container.querySelector('[role="status"]')!;
    expect(root).not.toBeNull();
    // the semantic step sets the DEFAULT accent var
    expect(has(root, '[--fr-alert-accent-default:var(--color-success)]')).toBe(true);
    // the accentBar reads accent -> accent-default -> foreground
    expect(
      has(root, '[border-left-color:var(--fr-alert-accent,var(--fr-alert-accent-default,var(--color-foreground)))]'),
    ).toBe(true);
    // the icon glyph reads accent -> accent-default -> inherit
    const icon = root.querySelector('span[aria-hidden="true"]')!;
    expect(icon).not.toBeNull();
    expect(has(icon, '[color:var(--fr-alert-accent,var(--fr-alert-accent-default,inherit))]')).toBe(true);
  });

  it('type:error also sets the danger default accent', () => {
    const { container } = draw('Alert', { title: 'Oops', type: 'error', accentBar: true });
    const root = container.querySelector('[role="status"]')!;
    expect(has(root, '[--fr-alert-accent-default:var(--color-danger)]')).toBe(true);
  });

  it('explicit accent still wins: --fr-alert-accent lands on the root', () => {
    const { container } = draw('Alert', { title: 'Saved', tone: 'success', accentBar: true, accent: '#123456' });
    const root = container.querySelector('[role="status"]')!;
    expect(styleOf(root)).toContain('--fr-alert-accent');
  });

  it('variant:solid resets the default accent to currentColor (no tone-on-tone vanish)', () => {
    const { container } = draw('Alert', { title: 'Saved', tone: 'success', variant: 'solid', accentBar: true });
    const root = container.querySelector('[role="status"]')!;
    expect(has(root, '[--fr-alert-accent-default:currentColor]')).toBe(true);
    // tw-merge dropped the tone's default (same arbitrary-property group)
    expect(has(root, '[--fr-alert-accent-default:var(--color-success)]')).toBe(false);
  });

  it('props-less (neutral type:info) sets NO default accent — the old inherit/foreground default holds', () => {
    const { container } = draw('Alert', { title: 'Note' });
    const root = container.querySelector('[role="status"]')!;
    const defaults = [...root.classList].filter((c) => c.startsWith('[--fr-alert-accent-default:'));
    expect(defaults).toHaveLength(0);
  });
});

/* ── HIGH: invalid per-datum colour must fall back, never delete the mark ───── */

describe('charts-extra/radial — invalid model colour falls back to palette/tone', () => {
  it('BarList: INVALID row color → var omitted on the track, fill reads var(--fr-bar-fill, <ramp>)', () => {
    const { container } = draw('BarList', { data: [{ label: 'A', value: 10, color: 'not-a-color' }] });
    const item = container.querySelector('[role="listitem"]')!;
    const track = item.querySelectorAll('div')[1]; // label row div, then the track
    expect(track).toBeDefined();
    // styleVars omitted the failing colour
    expect(styleOf(track)).not.toContain('--fr-bar-fill');
    const bar = track.firstElementChild!;
    // the read carries the palette slot INSIDE the var as the fallback
    expect(styleOf(bar)).toContain('var(--fr-bar-fill,');
    expect(styleOf(bar)).toContain('var(--color-primary)');
  });

  it('BarList: VALID row color → the track carries --fr-bar-fill', () => {
    const { container } = draw('BarList', { data: [{ label: 'A', value: 10, color: '#123456' }] });
    const item = container.querySelector('[role="listitem"]')!;
    const track = item.querySelectorAll('div')[1];
    expect(styleOf(track)).toContain('--fr-bar-fill');
  });

  it('ProgressCircle: INVALID color → the arc stroke reads var(--fr-ring-arc, <tone token>)', () => {
    const { container } = draw('ProgressCircle', { value: 40, tone: 'success', color: 'not-a-color' });
    const svg = container.querySelector('svg')!;
    expect(styleOf(svg)).not.toContain('--fr-ring-arc');
    const arc = svg.querySelectorAll('circle')[1];
    expect(arc.getAttribute('stroke')).toBe('var(--fr-ring-arc, var(--color-success))');
  });

  it('Gantt: INVALID task color → the bar fill reads var(--fr-gantt-fill, <ramp>)', () => {
    const { container } = draw('Gantt', { tasks: [{ label: 'T', start: 0, end: 5, color: 'not-a-color' }] });
    const bar = container.querySelector('[title^="T:"]')!;
    expect(bar).not.toBeNull();
    expect(styleOf(bar)).toContain('var(--fr-gantt-fill,');
    expect(styleOf(bar)).toContain('var(--color-primary)');
    // styleVars omitted the failing colour on the track
    expect(bar.parentElement && styleOf(bar.parentElement)).not.toContain('--fr-gantt-fill:');
  });

  it('Tracker: INVALID block color → falls back to the tone token class (block stays visible)', () => {
    const { container } = draw('Tracker', { data: [{ tone: 'success', color: 'not-a-color' }] });
    const block = container.querySelector('[role="group"] > div > div > div')!;
    expect(block).not.toBeNull();
    expect(has(block, 'bg-success')).toBe(true);
    expect(has(block, '[background:var(--fr-tracker-bg)]')).toBe(false);
  });

  it('Tracker: VALID block color → the var path is used (class + inline var)', () => {
    const { container } = draw('Tracker', { data: [{ tone: 'success', color: '#22c55e' }] });
    const block = container.querySelector('[role="group"] > div > div > div')!;
    expect(has(block, '[background:var(--fr-tracker-bg)]')).toBe(true);
    expect(styleOf(block)).toContain('--fr-tracker-bg');
    expect(has(block, 'bg-success')).toBe(false);
  });
});

/* ── value-annotation channel (axisColor) across the charts family ─────────── */

describe('charts — axisColor covers every showValues-style numeric annotation', () => {
  it('BarChart: axisColor var on the wrapper; value spans read the group form; text-foreground absent on them', () => {
    const { container } = draw('BarChart', {
      data: [
        { label: 'Mon', value: 12 },
        { label: 'Tue', value: 19 },
      ],
      axisColor: '#ff0000',
    });
    const wrapper = container.querySelector('[style*="--fr-barchart-axis"]');
    expect(wrapper, 'BarChart wrapper carrying --fr-barchart-axis').not.toBeNull();
    // Fallback moved --color-foreground -> currentColor (inherited-foreground): the value
    // labels sit on the container's surface, and the token was a hard reset that
    // painted them near-black inside an authored dark Card. The CHANNEL this test
    // guards — axisColor reaching every value span through one var — is unchanged.
    const readers = container.querySelectorAll(
      '.text-\\[color\\:var\\(--fr-barchart-axis\\,currentColor\\)\\]',
    );
    expect(readers.length).toBe(2); // one value span per bar (showValues default true)
    for (const span of readers) expect(has(span, 'text-foreground')).toBe(false);
  });

  it('DonutChart: axisColor var on the root; the center total reads the group form; text-foreground absent on it', () => {
    const { container } = draw('DonutChart', {
      data: [
        { label: 'A', value: 60 },
        { label: 'B', value: 40 },
      ],
      axisColor: '#ff0000',
    });
    const root = container.querySelector('[style*="--fr-donutchart-axis"]');
    expect(root, 'DonutChart root carrying --fr-donutchart-axis').not.toBeNull();
    // Same fallback move as BarChart above (inherited-foreground); the channel is unchanged.
    const total = container.querySelector(
      '.text-\\[color\\:var\\(--fr-donutchart-axis\\,currentColor\\)\\]',
    )!;
    expect(total).not.toBeNull();
    expect(total.textContent).toBe('100');
    expect(has(total, 'text-foreground')).toBe(false);
  });

  it('DonutChart: totalLabel replaces the hardcoded "Total" caption', () => {
    const { container } = draw('DonutChart', {
      data: [{ label: 'A', value: 60 }],
      totalLabel: 'Sessions',
    });
    expect(container.textContent).toContain('Sessions');
    expect(container.textContent).not.toContain('Total');
  });
});

/* ── charts.tsx EmptyChart — mutedColor + emptyText reach the empty state ──── */

describe('charts — the shared empty state is mutedColor-aware', () => {
  it('AreaChart empty: emptyText renders and the muted reader/var pair is live', () => {
    const { container } = draw('AreaChart', { series: [], mutedColor: '#ff0000', emptyText: 'Nothing yet' });
    const empty = container.querySelector('[role="img"]')!;
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe('Nothing yet');
    expect(styleOf(empty)).toContain('--fr-areachart-muted');
    expect(has(empty, '[color:var(--fr-areachart-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(empty, 'text-muted-foreground')).toBe(false);
  });

  it('BarList empty: renders the family EmptyChart with emptyText + the muted chain', () => {
    const { container } = draw('BarList', { data: [], mutedColor: '#ff0000', emptyText: 'No rows' });
    const empty = container.querySelector('[role="img"]')!;
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe('No rows');
    expect(styleOf(empty)).toContain('--fr-barlist-muted');
    expect(has(empty, '[color:var(--fr-barlist-muted,var(--color-muted-foreground))]')).toBe(true);
  });

  it('Heatmap empty: renders the family EmptyChart (default "No data")', () => {
    const { container } = draw('Heatmap', { cells: [] });
    const empty = container.querySelector('[role="img"]')!;
    expect(empty.textContent).toBe('No data');
    expect(has(empty, '[color:var(--fr-heat-muted,var(--color-muted-foreground))]')).toBe(true);
  });

  it('Gantt empty: renders the family EmptyChart with emptyText', () => {
    const { container } = draw('Gantt', { tasks: [], emptyText: 'No tasks' });
    const empty = container.querySelector('[role="img"]')!;
    expect(empty.textContent).toBe('No tasks');
    expect(has(empty, '[color:var(--fr-gantt-muted,var(--color-muted-foreground))]')).toBe(true);
  });
});

/* ── BarList axisColor / Gantt trackColor / Heatmap valueColor riders ──────── */

describe('charts-extra — new per-part channels', () => {
  it('BarList: axisColor var on the root; the row label reads the group form; text-foreground absent on it', () => {
    const { container } = draw('BarList', { data: [{ label: 'Home', value: 10 }], axisColor: '#ff0000' });
    const root = container.querySelector('[role="list"]')!;
    expect(styleOf(root)).toContain('--fr-barlist-axis');
    // The selector names the whole class, so it carries the chain's LAST RESORT
    // with it; that moved to `currentColor` in the inherited-foreground pass. The
    // CHANNEL this test is about (--fr-barlist-axis reaching the row label) and the
    // computed default are both unchanged — see test/inherited-foreground-datatable-charts-scheduler.test.tsx.
    const label = container.querySelector(
      '.text-\\[color\\:var\\(--fr-barlist-axis\\,currentColor\\)\\]',
    )!;
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Home');
    expect(has(label, 'text-foreground')).toBe(false);
  });

  it('Gantt: trackColor var on the root; the track reads bg-[color:…]; bg-muted deduped', () => {
    const { container } = draw('Gantt', {
      tasks: [{ label: 'T', start: 0, end: 5 }],
      trackColor: '#ff0000',
    });
    const root = container.querySelector('[role="img"]')!;
    expect(styleOf(root)).toContain('--fr-gantt-track');
    const track = container.querySelector('[title^="T:"]')!.parentElement!;
    expect(has(track, 'bg-[color:var(--fr-gantt-track,var(--color-muted))]')).toBe(true);
    expect(has(track, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });

  it('Gantt: trackColor UNSET keeps the bg-muted token (no reader class)', () => {
    const { container } = draw('Gantt', { tasks: [{ label: 'T', start: 0, end: 5 }] });
    const track = container.querySelector('[title^="T:"]')!.parentElement!;
    expect(has(track, 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(track, 'bg-[color:var(--fr-gantt-track,var(--color-muted))]')).toBe(false);
  });

  it('Heatmap: valueColor var on the root; cells read the group form; text-foreground absent on them', () => {
    const { container } = draw('Heatmap', { cells: [[1, 2]], showValues: true, valueColor: '#ffffff' });
    const root = container.querySelector('[role="img"]')!;
    expect(styleOf(root)).toContain('--fr-heat-value');
    const cells = container.querySelectorAll(
      '.text-\\[color\\:var\\(--fr-heat-value\\,var\\(--color-foreground\\)\\)\\]',
    );
    expect(cells.length).toBe(2);
    for (const cell of cells) expect(has(cell, 'text-foreground')).toBe(false);
  });
});

/* ── ai-flow riders — Reasoning icon, ToolCall icon/chevron/divider, Confirmation ── */

describe('ai-flow — muted icons + card-frame coherence', () => {
  it('Reasoning: the sparkles icon has NO own colour class (inherits the header var chain)', () => {
    const { container } = draw('Reasoning', { content: 'thinking…', mutedColor: '#ff0000' });
    const iconSpan = container.querySelector('button span')!;
    expect(iconSpan).not.toBeNull();
    expect(has(iconSpan, 'text-muted-foreground')).toBe(false);
  });

  it('ToolCall: header icon + chevron read the mutedColor chain; token class absent', () => {
    const { container } = draw('ToolCall', { name: 'search', input: 'q', mutedColor: '#ff0000' });
    const wrap = container.querySelector('[data-state]')!;
    expect(styleOf(wrap)).toContain('--fr-tool-muted');
    const readers = container.querySelectorAll(
      '.text-\\[color\\:var\\(--fr-tool-muted\\,var\\(--color-muted-foreground\\)\\)\\]',
    );
    expect(readers.length).toBe(2); // tool icon + expand chevron
    // the token class must be gone from BOTH readers (the state pill keeps its own)
    for (const r of readers) expect(has(r, 'text-muted-foreground')).toBe(false);
  });

  it('ToolCall: borderColor also recolors the expanded body divider (border-border deduped)', () => {
    const { container } = draw('ToolCall', {
      name: 'search',
      input: 'q',
      defaultOpen: true,
      borderColor: '#ff0000',
    });
    const body = container.querySelector('[data-state] > div')!;
    expect(body).not.toBeNull();
    expect(has(body, 'border-t')).toBe(true);
    expect(has(body, 'border-[color:var(--fr-tool-border,var(--color-border))]')).toBe(true);
    expect(has(body, 'border-border')).toBe(false);
  });

  it('ToolCall: borderColor UNSET keeps the divider token class (byte-identical path)', () => {
    const { container } = draw('ToolCall', { name: 'search', input: 'q', defaultOpen: true });
    const body = container.querySelector('[data-state] > div')!;
    expect(has(body, 'border-border')).toBe(true);
    expect(has(body, 'border-[color:var(--fr-tool-border,var(--color-border))]')).toBe(false);
  });

  it('Confirmation: color var on the card; message + deny label read the --fr-confirm-fg chain', () => {
    const { container } = draw('Confirmation', { message: 'Proceed?', color: '#00ff00' });
    const card = container.querySelector('[role="group"]')!;
    expect(styleOf(card)).toContain('--fr-confirm-fg');
    const msg = container.querySelector('p')!;
    expect(has(msg, 'text-[color:var(--fr-confirm-fg,var(--color-foreground))]')).toBe(true);
    expect(has(msg, 'text-foreground')).toBe(false);
    const deny = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Deny')!;
    expect(has(deny, 'text-[color:var(--fr-confirm-fg,var(--color-muted-foreground))]')).toBe(true);
    expect(has(deny, 'text-muted-foreground')).toBe(false);
  });
});

/* ── Avatar — ring offset follows the surface token ────────────────────────── */

describe('Avatar — status-ring offset uses the card token, not the white default', () => {
  it('every ring variant sets the offset-colour var chain', () => {
    for (const ring of ['default', 'success', 'warning', 'critical', 'info']) {
      const { container, unmount } = draw('Avatar', { name: 'Jane Doe', ring });
      const box = container.querySelector('.ring-2')!;
      expect(box, `Avatar ring:${ring}`).not.toBeNull();
      expect(has(box, '[--tw-ring-offset-color:var(--fr-avatar-ring-offset,var(--color-card))]')).toBe(true);
      unmount();
    }
  });

  it('ring:none renders no offset-colour class', () => {
    const { container } = draw('Avatar', { name: 'Jane Doe' });
    expect(
      container.querySelector(
        '.\\[--tw-ring-offset-color\\:var\\(--fr-avatar-ring-offset\\,var\\(--color-card\\)\\)\\]',
      ),
    ).toBeNull();
  });
});

/* ── UNSET-DEFAULT byte-identical rule (per touched component) ─────────────── */

type UnsetCase = {
  type: string;
  props: Record<string, unknown>;
  channel: string;
  state?: Record<string, unknown>;
};

const series = [{ name: 'S', points: [1, 2, 3] }];
const openState = { ui: { open: true } };

const UNSET_CASES: UnsetCase[] = [
  { type: 'AreaChart', props: { series, showValues: true }, channel: 'axisColor' },
  { type: 'LineChart', props: { series, showValues: true }, channel: 'axisColor' },
  { type: 'BarChart', props: { data: [{ label: 'A', value: 1 }] }, channel: 'axisColor' },
  { type: 'DonutChart', props: { data: [{ label: 'A', value: 1 }] }, channel: 'axisColor' },
  { type: 'DonutChart', props: { data: [{ label: 'A', value: 1 }] }, channel: 'totalLabel' },
  { type: 'AreaChart', props: { series: [] }, channel: 'emptyText' },
  { type: 'TypingIndicator', props: { label: 'Typing' }, channel: 'mutedColor' },
  { type: 'Reasoning', props: { content: 'c', defaultOpen: true }, channel: 'mutedColor' },
  { type: 'ToolCall', props: { name: 'x', input: 'i', defaultOpen: true }, channel: 'borderColor' },
  { type: 'Confirmation', props: { message: 'Proceed?' }, channel: 'color' },
  { type: 'BarList', props: { data: [{ label: 'A', value: 1 }] }, channel: 'axisColor' },
  { type: 'BarList', props: { data: [] }, channel: 'emptyText' },
  { type: 'ProgressCircle', props: { value: 40, tone: 'success' }, channel: 'color' },
  { type: 'Heatmap', props: { cells: [[1, 2]], showValues: true }, channel: 'valueColor' },
  { type: 'Gantt', props: { tasks: [{ label: 'T', start: 0, end: 5 }] }, channel: 'trackColor' },
  { type: 'Alert', props: { title: 'Note', tone: 'success', accentBar: true }, channel: 'accent' },
  { type: 'Avatar', props: { name: 'Jane Doe', ring: 'success' }, channel: 'ringColor' },
  { type: 'Dialog', props: { title: 'T', openPath: '/ui/open' }, channel: 'color', state: openState },
  { type: 'Drawer', props: { title: 'T', openPath: '/ui/open' }, channel: 'color', state: openState },
];

/** Canonicalise React's per-MOUNT `useId` token. Trigger↔panel ids (aria-controls)
 *  carry it so two `repeat` rows cannot share one id; two separate renders then
 *  differ in that token alone, which is orthogonal to the null-vs-absent question
 *  here. Measured: without this, the assertion fails even when both sides are
 *  given IDENTICAL props — it would stop testing prop handling entirely. */
const canonIds = (html: string): string => html.replace(/_r_[0-9a-z]+_/g, '_rID_');

describe('unset default is byte-identical to prop-not-mentioned', () => {
  for (const c of UNSET_CASES) {
    it(`${c.type}: ${c.channel}:null renders byte-identical to the prop being absent`, () => {
      const withNull = draw(c.type, { ...c.props, [c.channel]: null }, c.state ?? {});
      const nullHtml = withNull.container.innerHTML;
      withNull.unmount();
      const without = draw(c.type, { ...c.props }, c.state ?? {});
      expect(canonIds(nullHtml)).toBe(canonIds(without.container.innerHTML));
    });
  }

  it('Tracker: per-block color:null renders byte-identical to the key being absent', () => {
    const withNull = draw('Tracker', { data: [{ tone: 'success', color: null }] });
    const nullHtml = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Tracker', { data: [{ tone: 'success' }] });
    expect(canonIds(nullHtml)).toBe(canonIds(without.container.innerHTML));
  });
});
