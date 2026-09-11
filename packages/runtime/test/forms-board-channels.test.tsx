/**
 * Regression guard for the PARTIAL-PROP / COHERENCE-GROUP fixes
 * (forms · board-nav · data-table · layout · misc-extended).
 *
 * Follows test/value-channels.test.tsx: for each fixed channel assert the
 * TRIPLE —
 *   (a) the channel var is present in the target element's inline style attr,
 *   (b) the CONSUMING class is present in its className,
 *   (c) the competing token class it must dedupe is ABSENT when the prop is set
 * — plus per-component UNSET-DEFAULT tests: a spec with the channel prop
 * explicitly unset (null) renders BYTE-IDENTICAL innerHTML to a spec that never
 * mentions the prop at all.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}) =>
  render(<FraymeRenderer spec={one(type, props, state)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── HIGH: Input/Textarea/Select error state (danger border + aria-invalid) ── */

const FIELD_BASE_BORDER = '[border-color:var(--fr-field-border,var(--color-border))]';
const FIELD_ERROR_BORDER = '[border-color:var(--color-danger)]';

// RETARGET: Input's border/bg/error now live on the ADORNMENT WRAPPER
// (the input's parent) — the bare <input> went transparent/borderless. So the
// border node for Input is the input's parentElement; Textarea/Select keep the
// border on the control itself. aria-invalid stays on the control in all cases.
const ERROR_CASES: Array<{ type: string; props: Record<string, unknown>; selector: string; borderOnParent: boolean }> = [
  { type: 'Input', props: { label: 'Email', name: 'email' }, selector: 'input', borderOnParent: true },
  { type: 'Textarea', props: { label: 'Notes', name: 'notes' }, selector: 'textarea', borderOnParent: false },
  { type: 'Select', props: { label: 'Plan', name: 'plan', options: ['Free', 'Pro'] }, selector: 'select', borderOnParent: false },
];

describe('forms — errorText adds a danger control border + aria-invalid', () => {
  for (const c of ERROR_CASES) {
    it(`${c.type}: errorText set → danger border class, resting border deduped, aria-invalid`, () => {
      const { container } = draw(c.type, { ...c.props, errorText: 'Required' });
      const control = container.querySelector(c.selector)!;
      expect(control).not.toBeNull();
      const borderNode = c.borderOnParent ? control.parentElement! : control;
      // (b) the danger border class is present (added LAST in cn)
      expect(has(borderNode, FIELD_ERROR_BORDER), `danger border on ${c.type}`).toBe(true);
      // (c) the competing resting border class was deduped away by tw-merge
      expect(has(borderNode, FIELD_BASE_BORDER), `resting border deduped on ${c.type}`).toBe(false);
      // behavior addition: the control is marked invalid for AT
      expect(control.getAttribute('aria-invalid')).toBe('true');
      // the help line went danger too (pre-existing behavior, still coherent)
      expect(container.querySelector('.text-danger')).not.toBeNull();
    });

    it(`${c.type}: no errorText → resting border intact, no aria-invalid, no danger class`, () => {
      const { container } = draw(c.type, c.props);
      const control = container.querySelector(c.selector)!;
      const borderNode = c.borderOnParent ? control.parentElement! : control;
      expect(has(borderNode, FIELD_BASE_BORDER)).toBe(true);
      expect(has(borderNode, FIELD_ERROR_BORDER)).toBe(false);
      expect(control.getAttribute('aria-invalid')).toBeNull();
    });
  }
});

/* ── forms riders: labelColor · width (Switch/Radio) · Select behaviors · marks ── */

const LABEL_READER = 'text-[color:var(--fr-field-label,var(--color-foreground))]';

describe('forms — labelColor channel (--fr-field-label on the field root)', () => {
  it('Input: labelColor → var on the root, reader class on the label', () => {
    const { container } = draw('Input', { label: 'Email', name: 'email', labelColor: '#336699' });
    const root = container.querySelector('[style*="--fr-field-label"]');
    expect(root, 'field root carrying --fr-field-label').not.toBeNull();
    const label = container.querySelector('label')!;
    expect(has(label, LABEL_READER)).toBe(true);
  });

  it('Radio: labelColor → var on the fieldset, reader class on the legend', () => {
    const { container } = draw('Radio', { label: 'Cycle', name: 'cycle', options: ['A', 'B'], labelColor: '#336699' });
    const fieldset = container.querySelector('fieldset')!;
    expect(styleOf(fieldset)).toContain('--fr-field-label');
    expect(has(container.querySelector('legend')!, LABEL_READER)).toBe(true);
  });
});

describe('forms — width consumption on Switch/Radio (was inert)', () => {
  it('Switch: width lands in --fr-field-w and the root reads it', () => {
    const { container } = draw('Switch', { label: 'Dark mode', name: 'dm', width: '12rem' });
    const root = container.querySelector('[style*="--fr-field-w"]');
    expect(root, 'Switch root carrying --fr-field-w').not.toBeNull();
    expect(has(root!, '[width:var(--fr-field-w)]')).toBe(true);
  });

  it('Radio: width lands in --fr-field-w and the fieldset reads it', () => {
    const { container } = draw('Radio', { label: 'Cycle', name: 'cycle', options: ['A', 'B'], width: '12rem' });
    const fieldset = container.querySelector('fieldset')!;
    expect(styleOf(fieldset)).toContain('--fr-field-w');
    expect(has(fieldset, '[width:var(--fr-field-w)]')).toBe(true);
  });
});

describe('forms — Select readonly + placeholder behaviors', () => {
  it('Select: readonly:true blocks the change (value stays empty)', () => {
    const { container } = draw('Select', { label: 'Plan', name: 'plan', options: ['Free', 'Pro'], readonly: true });
    const select = container.querySelector('select')! as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'Pro' } });
    expect(select.value).toBe('');
  });

  it('Select: empty value shows the placeholder in muted (class present), a real value drops it', () => {
    const mutedReader = 'text-[color:var(--fr-field-muted,var(--color-muted-foreground))]';
    const empty = draw('Select', { label: 'Plan', name: 'plan', options: ['Free', 'Pro'] });
    expect(has(empty.container.querySelector('select')!, mutedReader)).toBe(true);
    empty.unmount();
    const chosen = draw('Select', { label: 'Plan', name: 'plan', options: ['Free', 'Pro'], value: 'Pro' });
    expect(has(chosen.container.querySelector('select')!, mutedReader)).toBe(false);
  });
});

describe('forms — Slider marks sit at their true value positions', () => {
  it('marks [0, 10, 100] land at left 0% / 10% / 100% (absolute, not justify-between)', () => {
    const { container } = draw('Slider', { label: 'T', min: 0, max: 100, marks: [0, 10, 100] });
    const row = container.querySelector('.relative.h-4')!;
    expect(row, 'positioned marks row').not.toBeNull();
    const spans = [...row.querySelectorAll('span')] as HTMLElement[];
    expect(spans.length).toBe(3);
    expect(spans.map((s) => s.style.left)).toEqual(['0%', '10%', '100%']);
    for (const s of spans) expect(has(s, 'absolute')).toBe(true);
  });
});

/* ── HIGH: KanbanCard on-surface title/avatar (--fr-kanbancard-fg chain) ───── */

const KC_FG_READER = 'text-[color:var(--fr-kanbancard-fg,var(--color-foreground))]';

describe('KanbanCard — on-surface text channel chained board→column→card', () => {
  it('KanbanCard.color: var on the wrapper; title button + avatar read it; text-foreground gone', () => {
    const { container } = draw('KanbanCard', { title: 'Ship it', assignee: 'Priya Gupta', color: '#ffffff' });
    // (a) the channel var rides on the card wrapper
    const wrapper = container.querySelector('[style*="--fr-kanbancard-fg"]');
    expect(wrapper, 'KanbanCard wrapper carrying --fr-kanbancard-fg').not.toBeNull();
    // (b) the title button + the avatar initials consume the chain
    const title = container.querySelector('button')!;
    expect(has(title, KC_FG_READER)).toBe(true);
    const avatar = container.querySelector('span[title="Priya Gupta"]')!;
    expect(has(avatar, KC_FG_READER)).toBe(true);
    // (c) the old hardcoded token class is gone from both
    expect(has(title, 'text-foreground')).toBe(false);
    expect(has(avatar, 'text-foreground')).toBe(false);
  });

  it('KanbanBoard.cardColor: var cascades from the board to inline card titles', () => {
    const { container } = draw('KanbanBoard', {
      columns: [{ title: 'To do', cards: [{ title: 'Draft post' }] }],
      cardColor: '#ffffff',
    });
    const board = container.querySelector('[style*="--fr-kanbancard-fg"]');
    expect(board, 'board carrying --fr-kanbancard-fg').not.toBeNull();
    const title = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Draft post')!;
    expect(has(title, KC_FG_READER)).toBe(true);
  });

  it('BoardColumn.cardColor: var rides on the column section (cascades to card children)', () => {
    const { container } = draw('BoardColumn', { title: 'Doing', cardColor: '#ffffff' });
    const section = container.querySelector('section')!;
    expect(styleOf(section)).toContain('--fr-kanbancard-fg');
  });

  it('KanbanCard move buttons: muted chain at rest, fg chain on hover class, no token classes', () => {
    const { container } = draw('KanbanCard', { title: 'Ship it', moveable: true, mutedColor: '#888888' });
    const move = container.querySelector('button[aria-label="Move left"]')!;
    expect(
      has(move, 'text-[color:var(--fr-kanbancard-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))]'),
    ).toBe(true);
    expect(has(move, 'hover:text-[color:var(--fr-kanbancard-fg,var(--color-foreground))]')).toBe(true);
    expect(has(move, 'text-muted-foreground')).toBe(false);
    expect(has(move, 'hover:text-foreground')).toBe(false);
  });
});

describe('BoardColumn — collapse caret reads the muted chain', () => {
  it('caret span consumes the column/board muted vars, token class gone', () => {
    const { container } = draw('BoardColumn', { title: 'Doing', collapsible: true, mutedColor: '#888888' });
    const caret = container.querySelector('span[aria-hidden].ml-auto')!;
    expect(caret, 'collapse caret').not.toBeNull();
    expect(
      has(caret, 'text-[color:var(--fr-boardcolumn-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))]'),
    ).toBe(true);
    expect(has(caret, 'text-muted-foreground')).toBe(false);
  });
});

/* ── NavigationMenu: chevron state travel + flyout surface channels ────────── */

const NAV_ITEMS = [
  { label: 'Products', children: [{ label: 'API', href: '/api', description: 'Compose UI' }] },
];

describe('NavigationMenu — trigger chevron + flyout surface', () => {
  it('chevron: muted reader at rest; accent reader (muted deduped) when open', () => {
    const { container } = draw('NavigationMenu', { items: NAV_ITEMS, accent: '#7c3aed', mutedColor: '#888888' });
    const trigger = container.querySelector('button[aria-haspopup="menu"]')!;
    const chevron = trigger.querySelector('span[aria-hidden]')!;
    expect(has(chevron, 'text-[color:var(--fr-navmenu-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(chevron, 'text-muted-foreground')).toBe(false);
    fireEvent.click(trigger);
    const openChevron = container.querySelector('button[aria-haspopup="menu"] span[aria-hidden]')!;
    expect(has(openChevron, 'text-[color:var(--fr-navmenu-accent)]')).toBe(true);
    // the resting muted reader was deduped away by the LAST accent class
    expect(has(openChevron, 'text-[color:var(--fr-navmenu-muted,var(--color-muted-foreground))]')).toBe(false);
  });

  it('flyout panel: bg/borderColor vars on the nav; panel reads them; border-border + bg-card gone', () => {
    const { container } = draw('NavigationMenu', { items: NAV_ITEMS, bg: '#111111', borderColor: '#222222' });
    const nav = container.querySelector('nav')!;
    expect(styleOf(nav)).toContain('--fr-navmenu-bg');
    expect(styleOf(nav)).toContain('--fr-navmenu-border');
    fireEvent.click(container.querySelector('button[aria-haspopup="menu"]')!);
    const panel = container.querySelector('[role="menu"]')!;
    expect(panel).not.toBeNull();
    expect(has(panel, 'border-[color:var(--fr-navmenu-border,var(--color-border))]')).toBe(true);
    expect(has(panel, '[background:var(--fr-navmenu-bg,var(--color-card))]')).toBe(true);
    expect(has(panel, 'border-border')).toBe(false);
    expect(has(panel, 'bg-card')).toBe(false);
  });
});

/* ── HIGH: DataTable accent tints ONLY the active sort button ──────────────── */

const DT_PROPS = {
  columns: [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'seats', label: 'Seats', sortable: true },
  ],
  rows: [
    { name: 'Acme', seats: 12 },
    { name: 'Globex', seats: 4 },
  ],
};
const DT_ACCENT_READER = 'text-[color:var(--fr-dt-accent,var(--fr-accent))]';
const DT_OLD_BAKED = '[color:var(--fr-dt-accent,inherit)]';

describe('DataTable — accent tints only the ACTIVE sort head (baked accent dropped)', () => {
  it('accent + active sort: var on table, reader on the ACTIVE button only, no baked class anywhere', () => {
    const { container } = draw('DataTable', { ...DT_PROPS, accent: '#0ea5e9', sortBy: 'name', sortDir: 'asc' });
    // (a) the channel var is on the table's inline style
    expect(styleOf(container.querySelector('table')!)).toContain('--fr-dt-accent');
    const buttons = [...container.querySelectorAll('th button')];
    expect(buttons.length).toBe(2);
    const [active, inactive] = buttons;
    // (b) the ACTIVE head consumes the accent (rest + hover — no foreground flash)
    expect(has(active, DT_ACCENT_READER)).toBe(true);
    expect(has(active, 'hover:text-[color:var(--fr-dt-accent,var(--fr-accent))]')).toBe(true);
    expect(has(active, 'hover:text-foreground')).toBe(false);
    // the INACTIVE head is NOT tinted and keeps the plain foreground hover
    expect(has(inactive, DT_ACCENT_READER)).toBe(false);
    expect(has(inactive, 'hover:text-foreground')).toBe(true);
    // (c) the old always-on baked accent class is gone from every head
    for (const b of buttons) expect(has(b, DT_OLD_BAKED)).toBe(false);
  });

  it('row dividers (non-bordered) route through --fr-dt-border at 60% via color-mix', () => {
    const { container } = draw('DataTable', { ...DT_PROPS, borderColor: '#ff0000' });
    const td = container.querySelector('tbody td')!;
    expect(
      has(td, '[border-color:color-mix(in_srgb,var(--fr-dt-border,var(--color-border))_60%,transparent)]'),
    ).toBe(true);
    expect(has(td, 'border-border/60')).toBe(false);
  });

  it('pager buttons read --fr-dt-border (token fallback); border-border gone', () => {
    const { container } = draw('DataTable', { ...DT_PROPS, pageSize: 1, borderColor: '#ff0000' });
    const prev = container.querySelector('button[aria-label="Previous page"]')!;
    const next = container.querySelector('button[aria-label="Next page"]')!;
    for (const b of [prev, next]) {
      expect(b, 'pager button').not.toBeNull();
      expect(has(b, 'border-[color:var(--fr-dt-border,var(--color-border))]')).toBe(true);
      expect(has(b, 'border-border')).toBe(false);
    }
  });
});

describe('DataTable — pager buttons join the table-chrome border channel', () => {
  it('pager buttons read --fr-dt-border (token fallback); border-border gone', () => {
    const { container } = draw('DataTable', {
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ name: 'Acme' }, { name: 'Globex' }],
      pageSize: 1,
      borderColor: '#ff0000',
    });
    const prev = container.querySelector('button[aria-label="Previous page"]')!;
    const next = container.querySelector('button[aria-label="Next page"]')!;
    for (const b of [prev, next]) {
      expect(b, 'pager button').not.toBeNull();
      expect(has(b, 'border-[color:var(--fr-dt-border,var(--color-border))]')).toBe(true);
      expect(has(b, 'border-border')).toBe(false);
    }
  });
});

describe('ColumnHeader — resize grip consumes the accent→border→token chain', () => {
  it('grip reads the chain; bg-border gone; accent var moved to the ROOT', () => {
    const { container } = draw('ColumnHeader', { label: 'Revenue', sortable: true, resizable: true, accent: '#0ea5e9' });
    const root = container.querySelector('[role="columnheader"]')!;
    // (a) accent var now rides on the root (grip + sort button both read it)
    expect(styleOf(root)).toContain('--fr-ch-accent');
    const grip = container.querySelector('[role="separator"]')!;
    // (b) the grip consumes the chain
    expect(has(grip, '[background:var(--fr-ch-accent,var(--fr-ch-border,var(--color-border)))]')).toBe(true);
    // (c) the hardcoded token class is gone
    expect(has(grip, 'bg-border')).toBe(false);
  });
});

/* ── HIGH: layout on-surface `color` paired with `bg` ──────────────────────── */

/* The subject here is the CHANNEL — a named `color` lands in the var and the root
 * carries a text-color group-form reader so children inherit. The reader's in-var
 * FALLBACK is a separate decision, reached only when the named colour is INVALID
 * or absent, and it is now a two-step chain: --fr-surface-fg, then currentColor
 * (Card keeps --color-card-foreground as its last step — it always paints a fill
 * of its own). --fr-surface-fg is what the CONTAINER published: its authored
 * `color` if it named one, otherwise the ink DERIVED from its `bg`. That middle
 * step exists because 25 components downstream expose no `color` prop, so a spec
 * that paints a dark `bg` had no way to say what should be legible on it. Both
 * ends of the chain are still the earlier decisions: an authored colour wins
 * outright, and the global token is never the reset that caused the
 * inherited-foreground defect. The ink is measured in inherited-foreground-inputs-overlay-layout.test.tsx. */
type FgCase = { type: string; props: Record<string, unknown>; cssVar: string; cls: string };
const LAYOUT_FG_CASES: FgCase[] = [
  { type: 'Box', props: {}, cssVar: '--fr-box-fg', cls: 'text-[color:var(--fr-box-fg,var(--fr-surface-fg,currentColor))]' },
  { type: 'Container', props: {}, cssVar: '--fr-cont-fg', cls: 'text-[color:var(--fr-cont-fg,var(--fr-surface-fg,currentColor))]' },
  { type: 'Stack', props: {}, cssVar: '--fr-stack-fg', cls: 'text-[color:var(--fr-stack-fg,var(--fr-surface-fg,currentColor))]' },
  { type: 'Grid', props: {}, cssVar: '--fr-grid-fg', cls: 'text-[color:var(--fr-grid-fg,var(--fr-surface-fg,currentColor))]' },
  { type: 'Card', props: { title: 'Overview' }, cssVar: '--fr-card-fg', cls: 'text-[color:var(--fr-card-fg,var(--fr-surface-fg,var(--color-card-foreground)))]' },
  { type: 'Section', props: { title: 'Features' }, cssVar: '--fr-section-fg', cls: 'text-[color:var(--fr-section-fg,var(--fr-surface-fg,currentColor))]' },
];

describe('layout — on-surface color channel (bg↔color coherence pair)', () => {
  for (const c of LAYOUT_FG_CASES) {
    it(`${c.type}: color → ${c.cssVar} var + root reader class`, () => {
      const { container } = draw(c.type, { ...c.props, bg: '#111111', color: '#fafafa' });
      const el = container.querySelector(`[style*="${c.cssVar}"]`);
      expect(el, `${c.type} element carrying ${c.cssVar}`).not.toBeNull();
      expect(has(el!, c.cls), `reader class on ${c.type}`).toBe(true);
    });
  }

  it('Card: the color reader dedupes the baked text-card-foreground token', () => {
    const { container } = draw('Card', { title: 'Overview', color: '#fafafa' });
    const card = container.querySelector('[style*="--fr-card-fg"]')!;
    expect(has(card, 'text-card-foreground')).toBe(false);
  });

  it('Section: color cascades from the <section> root (children covered), h2 override kept', () => {
    const { container } = draw('Section', { title: 'Features', bg: '#111111', color: '#fafafa' });
    const section = container.querySelector('section')!;
    expect(has(section, 'text-[color:var(--fr-section-fg,var(--fr-surface-fg,currentColor))]')).toBe(true);
    const h2 = container.querySelector('h2')!;
    expect(has(h2, 'text-[color:var(--fr-section-fg,var(--fr-surface-fg,currentColor))]')).toBe(true);
  });
});

/* ── HIGH: CodeBlock line-number gutter joins the muted channel ────────────── */

const CB_GUTTER_READER =
  'text-[color:color-mix(in_srgb,var(--fr-codeblock-muted,var(--color-muted-foreground))_70%,transparent)]';

describe('CodeBlock — line-number gutter reads --fr-codeblock-muted (at 70%)', () => {
  it('mutedColor → var on the wrapper, gutter reads the color-mix chain, token/70 class gone', () => {
    const { container } = draw('CodeBlock', { code: 'a\nb', showLineNumbers: true, mutedColor: '#ff00aa' });
    // (a) the channel var rides on the block wrapper
    const wrapper = container.querySelector('[style*="--fr-codeblock-muted"]');
    expect(wrapper, 'CodeBlock wrapper carrying --fr-codeblock-muted').not.toBeNull();
    const gutter = container.querySelector('pre span[aria-hidden]')!;
    expect(gutter, 'line-number gutter').not.toBeNull();
    // (b) the gutter consumes the muted chain (kept at 70% via color-mix)
    expect(has(gutter, CB_GUTTER_READER)).toBe(true);
    // (c) the hardcoded token class is gone
    expect(has(gutter, 'text-muted-foreground/70')).toBe(false);
  });
});

/* ── Toast: the accent bar is reachable from the tone channel ──────────────── */

const TOAST_BAR_W = 'border-l-[3px]';
const TOAST_BAR_COLOR = '[border-left-color:var(--fr-toast-accent,var(--color-border))]';

describe('Toast — accent bar renders for non-neutral tones (subtle/outline)', () => {
  it('tone:success (subtle) shows the bar reading the tone-set accent var', () => {
    const { container } = draw('Toast', { title: 'Saved', openPath: 'toastOpen', tone: 'success' }, { toastOpen: true });
    const toast = container.querySelector('[role="status"]')!;
    expect(has(toast, TOAST_BAR_W)).toBe(true);
    expect(has(toast, TOAST_BAR_COLOR)).toBe(true);
  });

  it('tone:neutral shows NO bar (unchanged default); accent set still shows it', () => {
    const neutral = draw('Toast', { title: 'Saved', openPath: 'toastOpen' }, { toastOpen: true });
    const toast = neutral.container.querySelector('[role="status"]')!;
    expect(has(toast, TOAST_BAR_W)).toBe(false);
    neutral.unmount();
    const accented = draw('Toast', { title: 'Saved', openPath: 'toastOpen', accent: '#7c3aed' }, { toastOpen: true });
    expect(has(accented.container.querySelector('[role="status"]')!, TOAST_BAR_W)).toBe(true);
  });

  it('tone:success + variant:solid keeps the bar OFF (surface already the tone fill)', () => {
    const { container } = draw(
      'Toast',
      { title: 'Saved', openPath: 'toastOpen', tone: 'success', variant: 'solid' },
      { toastOpen: true },
    );
    expect(has(container.querySelector('[role="status"]')!, TOAST_BAR_W)).toBe(false);
  });
});

/* ── UNSET-DEFAULT byte-identical rule (every touched component) ───────────── */

type UnsetCase = { type: string; props: Record<string, unknown>; channel: string; state?: Record<string, unknown> };

const UNSET_CASES: UnsetCase[] = [
  { type: 'Input', props: { label: 'Email', name: 'email' }, channel: 'errorText' },
  { type: 'Input', props: { label: 'Email', name: 'email' }, channel: 'labelColor' },
  { type: 'Textarea', props: { label: 'Notes', name: 'notes' }, channel: 'errorText' },
  { type: 'Select', props: { label: 'Plan', name: 'plan', options: ['Free', 'Pro'] }, channel: 'errorText' },
  { type: 'Checkbox', props: { label: 'Updates', name: 'upd' }, channel: 'labelColor' },
  { type: 'Radio', props: { label: 'Cycle', name: 'cycle', options: ['A', 'B'] }, channel: 'width' },
  { type: 'Switch', props: { label: 'Dark mode', name: 'dm' }, channel: 'width' },
  { type: 'Slider', props: { label: 'T', min: 0, max: 100, marks: [0, 10, 100] }, channel: 'labelColor' },
  { type: 'KanbanCard', props: { title: 'Ship it', assignee: 'PG', moveable: true }, channel: 'color' },
  { type: 'KanbanBoard', props: { columns: [{ title: 'To do', cards: [{ title: 'Draft' }] }] }, channel: 'cardColor' },
  { type: 'BoardColumn', props: { title: 'Doing', collapsible: true }, channel: 'cardColor' },
  { type: 'NavigationMenu', props: { items: NAV_ITEMS }, channel: 'bg' },
  { type: 'NavigationMenu', props: { items: NAV_ITEMS }, channel: 'borderColor' },
  { type: 'DataTable', props: { ...DT_PROPS, sortBy: 'name', sortDir: 'asc', pageSize: 1 }, channel: 'accent' },
  {
    type: 'DataTable',
    props: { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Acme' }, { name: 'Globex' }], pageSize: 1 },
    channel: 'borderColor',
  },
  { type: 'ColumnHeader', props: { label: 'Revenue', sortable: true, resizable: true }, channel: 'accent' },
  { type: 'Box', props: {}, channel: 'color' },
  { type: 'Container', props: {}, channel: 'color' },
  { type: 'Stack', props: {}, channel: 'color' },
  { type: 'Grid', props: {}, channel: 'color' },
  { type: 'Card', props: { title: 'Overview' }, channel: 'color' },
  { type: 'Section', props: { title: 'Features', eyebrow: 'WHY' }, channel: 'color' },
  { type: 'CodeBlock', props: { code: 'a\nb', showLineNumbers: true }, channel: 'mutedColor' },
  { type: 'Toast', props: { title: 'Saved', openPath: 'toastOpen' }, channel: 'accent', state: { toastOpen: true } },
  { type: 'Toast', props: { title: 'Saved', openPath: 'toastOpen' }, channel: 'tone', state: { toastOpen: true } },
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
});
