/**
 * ACTIONS + overlays + base display/layout half of shadcn-base.
 *
 * Covers every item in this family that changes a class or behavior:
 *   value-channel items → the TRIPLE (var on style · consuming group-form class ·
 *     competitor token deduped); additive items → UNSET renders byte-identical to
 *     the prop being absent; behavioral items → fireEvent/keyboard; the Toast timer
 *     item → vi.useFakeTimers().
 *
 * Items: Carousel media + dots · Tabs icon/count · caret size · Card gap ·
 * Alert SVG icons · Table columnAlign · Heading tracking atom + clamp ·
 * focus-visible ring · Toast auto-dismiss · Button icon size · ToggleGroup
 * icons · resting hover · CodeBlock copy · DropdownMenu dismiss + check ·
 * SegmentedControl mutedColor · FileUpload progress + remove · CommandPalette
 * keyboard · Combobox keyboard · MultiSelect clear-all · Popover dismiss ·
 * Tooltip sizing + elevation · Kbd font + bg · Dialog/Drawer close + typography.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state }) as unknown as Spec;

const oneOn = (
  type: string,
  props: Record<string, unknown>,
  on: Record<string, unknown>,
  state: Record<string, unknown> = {},
): Spec =>
  ({ root: 'el', elements: { el: { type, props, on } }, state }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>, state?: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props, state)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);

/** Render with an on-handler and capture the DynamicActionEvent. */
function drawWithAction(type: string, props: Record<string, unknown>, on: Record<string, unknown>, state?: Record<string, unknown>) {
  const onDynamicAction = vi.fn();
  // The host under test is widened INTO the dynamic-action gate (core/dynamic-
  // gate.ts): FileUpload / CommandPalette / MultiSelect / Combobox are not carriers
  // by default, and these assertions are about the payload each sends when it is
  // allowed to dispatch.
  const r = render(
    <FraymeRenderer spec={oneOn(type, props, on, state)} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={['Button', 'DataTable', type]} />,
  );
  return { ...r, onDynamicAction };
}

/* ══════════════════════════════════════════════════════════════════════════
 * Kbd — font enum + bg channel
 * ════════════════════════════════════════════════════════════════════════ */
describe('Kbd — font + bg', () => {
  it('bg SET (solid): var on the region + [background:var] reader on the chip, bg-muted deduped', () => {
    const { container } = draw('Kbd', { keys: ['Cmd', 'K'], bg: '#123456' });
    const region = container.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(styleOf(region)).toContain('--fr-kbd-bg');
    const chip = container.querySelector('kbd')!;
    expect(has(chip, '[background:var(--fr-kbd-bg,var(--color-muted))]')).toBe(true);
    expect(has(chip, 'bg-muted')).toBe(false);
  });

  it('font SET → a font-* utility on the region, base font-sans deduped', () => {
    const { container } = draw('Kbd', { keys: ['A'], font: 'mono' });
    const region = container.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(has(region, 'font-mono')).toBe(true);
    expect(has(region, 'font-sans')).toBe(false);
  });

  it('bg/font UNSET → byte-identical to prop absent', () => {
    const a = draw('Kbd', { keys: ['Esc'], bg: null, font: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Kbd', { keys: ['Esc'] });
    expect(html).toBe(b.container.innerHTML);
  });

  it('bg IGNORED on outline (transparent chips) → no [background:var] reader', () => {
    const { container } = draw('Kbd', { keys: ['X'], variant: 'outline', bg: '#123456' });
    const chip = container.querySelector('kbd')!;
    expect(has(chip, '[background:var(--fr-kbd-bg,var(--color-muted))]')).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * FileUpload — per-file progress bar + render-only remove ×
 * ════════════════════════════════════════════════════════════════════════ */
describe('FileUpload — progress + remove', () => {
  it('progress SET → a progressbar with the accent fill and the clamped width', () => {
    const { container } = draw('FileUpload', { files: [{ name: 'a.pdf', status: 'uploading', progress: 150 }] });
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute('aria-valuenow')).toBe('100'); // clamped
    const fill = bar!.firstElementChild as HTMLElement;
    expect(has(fill, '[background:var(--fr-upload-accent,var(--color-primary))]')).toBe(true);
    expect(fill.style.width).toBe('100%');
  });

  it('remove × emits dismiss { index, label }', () => {
    const { container, onDynamicAction } = drawWithAction(
      'FileUpload',
      { files: [{ name: 'first.png' }, { name: 'second.png' }] },
      { dismiss: { action: 'remove_file', confirm: false } },
    );
    const removeBtns = [...container.querySelectorAll('button[aria-label^="Remove"]')];
    expect(removeBtns.length).toBe(2);
    fireEvent.click(removeBtns[1]!);
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'remove_file',
      event: 'dismiss',
      params: { index: 1, label: 'second.png' },
    });
  });

  it('progress UNSET (files without progress) → no progressbar rendered', () => {
    const { container } = draw('FileUpload', { files: [{ name: 'a.pdf', status: 'done' }] });
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('no files → byte-identical with/without the new prop shape', () => {
    const a = draw('FileUpload', { label: 'Upload', files: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('FileUpload', { label: 'Upload' });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * CommandPalette — keyboard navigation
 * ════════════════════════════════════════════════════════════════════════ */
describe('CommandPalette — keyboard nav', () => {
  const groups = [
    { heading: 'Actions', items: [
      { label: 'New file', value: 'new' },
      { label: 'Open', value: 'open' },
      { label: 'Close', value: 'close' },
    ] },
  ];

  it('ArrowDown moves the active option (aria-selected) forward', () => {
    const { container } = draw('CommandPalette', { groups });
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
    // first option is active by default
    const options = () => [...container.querySelectorAll('[role="option"]')];
    expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options()[1]!.getAttribute('aria-selected')).toBe('true');
    expect(options()[0]!.getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowUp from the first wraps to the last', () => {
    const { container } = draw('CommandPalette', { groups });
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const options = [...container.querySelectorAll('[role="option"]')];
    expect(options[options.length - 1]!.getAttribute('aria-selected')).toBe('true');
  });

  it('Enter on the input activates the active option (emits select)', () => {
    const { container, onDynamicAction } = drawWithAction(
      'CommandPalette',
      { groups },
      { select: { action: 'run_cmd', confirm: false } },
    );
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // → "Open"
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'run_cmd',
      event: 'select',
      params: { value: 'open' },
    });
  });

  it('input exposes aria-activedescendant pointing at an existing option id', () => {
    const { container } = draw('CommandPalette', { groups });
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
    const active = input.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    // look the option up by getElementById (no CSS.escape → jsdom-safe)
    expect(container.ownerDocument.getElementById(active!)).not.toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * MultiSelect — clear-all affordance
 * ════════════════════════════════════════════════════════════════════════ */
describe('MultiSelect — clearable', () => {
  const options = [
    { label: 'Design', value: 'design' },
    { label: 'Eng', value: 'eng' },
  ];

  it('clearable + selection → a Clear all × that emits dismiss { all:true }', () => {
    const { container, onDynamicAction } = drawWithAction(
      'MultiSelect',
      { options, value: ['design', 'eng'], clearable: true },
      { dismiss: { action: 'clear_all', confirm: false } },
    );
    const clearBtn = container.querySelector('button[aria-label="Clear all"]');
    expect(clearBtn).not.toBeNull();
    fireEvent.click(clearBtn!);
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'clear_all',
      event: 'dismiss',
      params: { all: true },
    });
  });

  it('clearable but NO selection → no clear × rendered', () => {
    const { container } = draw('MultiSelect', { options, value: [], clearable: true });
    expect(container.querySelector('button[aria-label="Clear all"]')).toBeNull();
  });

  it('clearable UNSET → byte-identical to prop absent (chevron keeps ml-auto)', () => {
    const a = draw('MultiSelect', { options, value: ['design'], clearable: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('MultiSelect', { options, value: ['design'] });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Toast — auto-dismiss (fake timers)
 * ════════════════════════════════════════════════════════════════════════ */
describe('Toast — auto-dismiss', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('duration:short → closes after 3000ms and emits dismiss { auto:true }', () => {
    vi.useFakeTimers();
    const onDynamicAction = vi.fn();
    const spec = oneOn(
      'Toast',
      { title: 'Saved', openPath: 'open', duration: 'short' },
      { dismiss: { action: 'on_close', confirm: false } },
      { open: true },
    );
    // Toast widened into the dynamic-action gate — the test is about the timer
    // firing `dismiss {auto:true}`, observable only when Toast may dispatch.
    const { container } = render(
      <FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={['Button', 'DataTable', 'Toast']} />,
    );
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'on_close',
      event: 'dismiss',
      params: { auto: true },
    });
  });

  it('duration:sticky (default) → no timer fires, toast stays', () => {
    vi.useFakeTimers();
    const onDynamicAction = vi.fn();
    const spec = oneOn(
      'Toast',
      { title: 'Sticky', openPath: 'open' },
      { dismiss: { action: 'on_close', confirm: false } },
      { open: true },
    );
    // Same widening as the short-duration case, so "no timer fires" is proven
    // against a Toast that COULD have dispatched — not one the gate silenced.
    const { container } = render(
      <FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={['Button', 'DataTable', 'Toast']} />,
    );
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(onDynamicAction).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * focus-visible ring on toggle / bgItem / pageBtn / ddItem
 * ════════════════════════════════════════════════════════════════════════ */
describe('focus-visible ring across the action family', () => {
  it('Toggle carries the shared focus ring recipe', () => {
    const { container } = draw('Toggle', { label: 'Bold' });
    const btn = container.querySelector('button')!;
    expect(has(btn, 'focus-visible:ring-2')).toBe(true);
    expect(has(btn, 'focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_40%,transparent)]')).toBe(true);
  });

  it('ButtonGroup segments carry the ring', () => {
    const { container } = draw('ButtonGroup', { buttons: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] });
    const btn = container.querySelector('button')!;
    expect(has(btn, 'focus-visible:ring-2')).toBe(true);
  });

  it('Pagination cells carry the ring', () => {
    const { container } = draw('Pagination', { totalPages: 5, page: 2 });
    const btn = container.querySelector('button')!;
    expect(has(btn, 'focus-visible:ring-2')).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Button — icon scales with size
 * ════════════════════════════════════════════════════════════════════════ */
describe('Button — icon size scales', () => {
  it('size:lg renders an 18px glyph; size:md renders 16px', () => {
    const lg = draw('Button', { label: 'Go', icon: 'check', size: 'lg' });
    const svgLg = lg.container.querySelector('svg')!;
    expect(svgLg.getAttribute('width')).toBe('18');
    lg.unmount();
    const md = draw('Button', { label: 'Go', icon: 'check', size: 'md' });
    const svgMd = md.container.querySelector('svg')!;
    expect(svgMd.getAttribute('width')).toBe('16');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * ToggleGroup — per-item icons
 * ════════════════════════════════════════════════════════════════════════ */
describe('ToggleGroup — icons', () => {
  it('icons array renders a leading glyph per item (known registry names)', () => {
    const { container } = draw('ToggleGroup', {
      items: [{ label: 'Mail', value: 'mail' }, { label: 'Star', value: 'star' }],
      icons: ['mail', 'star'],
    });
    const svgs = container.querySelectorAll('button svg');
    expect(svgs.length).toBe(2);
  });

  it('icons UNSET → byte-identical to prop absent', () => {
    const items = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }];
    const a = draw('ToggleGroup', { items, icons: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('ToggleGroup', { items });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * resting hover feedback (Toggle / ButtonGroup)
 * ════════════════════════════════════════════════════════════════════════ */
describe('resting hover feedback', () => {
  it('Toggle (no accent) → token hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', () => {
    const { container } = draw('Toggle', { label: 'X' });
    expect(has(container.querySelector('button')!, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
  });

  it('Toggle (accent set) → accent-derived color-mix hover, NOT hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', () => {
    const { container } = draw('Toggle', { label: 'X', accent: '#ff0000' });
    const btn = container.querySelector('button')!;
    expect(has(btn, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
    expect([...btn.classList].some((c) => c.startsWith('hover:[background:color-mix'))).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * DropdownMenu — dismissal + selection check
 * ════════════════════════════════════════════════════════════════════════ */
describe('DropdownMenu — check glyph + Escape close', () => {
  const items = [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }];

  it('open menu shows a trailing check on the selected item only', () => {
    const { container } = draw('DropdownMenu', { label: 'Pick', items, value: 'two' });
    fireEvent.click(container.querySelector('button')!); // open
    const menuItems = [...container.querySelectorAll('[role="menuitem"]')];
    expect(menuItems.length).toBe(2);
    // selected item ('Two') renders an svg check, the other does not
    expect(menuItems[1]!.querySelector('svg')).not.toBeNull();
    expect(menuItems[0]!.querySelector('svg')).toBeNull();
  });

  it('Escape closes the open menu', () => {
    const { container } = draw('DropdownMenu', { label: 'Pick', items });
    fireEvent.click(container.querySelector('button')!);
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * SegmentedControl — mutedColor channel
 * ════════════════════════════════════════════════════════════════════════ */
describe('SegmentedControl — mutedColor', () => {
  it('mutedColor SET → var present on the control', () => {
    const { container } = draw('SegmentedControl', {
      options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
      value: 'a',
      mutedColor: '#888888',
    });
    const withVar = container.querySelector('[style*="--fr-sc-muted"]');
    expect(withVar).not.toBeNull();
  });

  it('mutedColor UNSET → byte-identical to prop absent', () => {
    const opts = { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }], value: 'a' };
    const a = draw('SegmentedControl', { ...opts, mutedColor: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('SegmentedControl', opts);
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Combobox — keyboard access (verify-present)
 * ════════════════════════════════════════════════════════════════════════ */
describe('Combobox — keyboard', () => {
  it('ArrowDown then Enter selects the active option (emits change)', () => {
    const { container, onDynamicAction } = drawWithAction(
      'Combobox',
      { options: [{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b' }] },
      { change: { action: 'pick', confirm: false } },
    );
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.focus(input); // opens the menu
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // active → first option
    fireEvent.keyDown(input, { key: 'Enter' }); // commit the active option
    expect(onDynamicAction).toHaveBeenCalled();
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'pick', event: 'change', params: { value: 'a' } });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Carousel — media slot + pagination dots
 * ════════════════════════════════════════════════════════════════════════ */
describe('Carousel — media + dots', () => {
  it('per-item icon renders a media glyph; showDots renders a dot per card', () => {
    const { container } = draw('Carousel', {
      items: [{ title: 'A', icon: 'bell' }, { title: 'B', icon: 'star' }],
      showDots: true,
    });
    // 2 media glyphs + a dot per card. The strip is plain buttons carrying
    // aria-current — never a tablist (no panels, no roving tabindex).
    const strip = container.querySelector('[role="group"][aria-label="Carousel pagination"]')!;
    expect(strip).not.toBeNull();
    const dots = strip.querySelectorAll('button');
    expect(dots.length).toBe(2);
    expect(dots[0]!.getAttribute('aria-current')).toBe('true');
    expect(dots[1]!.getAttribute('aria-current')).toBeNull();
    // each dot names the card it scrolls to
    expect(dots[0]!.getAttribute('aria-label')).toBe('Go to A');
    expect(dots[1]!.getAttribute('aria-label')).toBe('Go to B');
    expect(strip.querySelector('[role="tab"]')).toBeNull();
  });

  it('per-item image renders a SafeImage <img> when the URL is safe', () => {
    const { container } = draw('Carousel', { items: [{ title: 'A', image: 'https://example.com/a.png' }] });
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('no media + no showDots → byte-identical to prop absent', () => {
    const items = [{ title: 'A', description: 'x' }];
    const a = draw('Carousel', { items, showDots: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Carousel', { items });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Tabs — per-tab icon + count
 * ════════════════════════════════════════════════════════════════════════ */

/** Canonicalise React's per-MOUNT `useId` token — the same normalizer, for the
 *  same reason, as `canonIds` in ai-components.test.tsx. Tabs' tab↔panel ids used to be
 *  minted from the spec id ALONE, which two `repeat` rows SHARED (row two's tab
 *  aimed a screen reader at row one's panel — the shape _aria.ts names for this
 *  pairing); they now come from `useAriaId`, which folds in `useId()` so the rows
 *  differ. Two separate renders then differ in that token alone, which has
 *  nothing to do with the null-vs-absent question the case below exists to test.
 *  Everything else in the two strings is still compared byte for byte. */
const canonIds = (html: string): string => html.replace(/_r_[0-9a-z]+_/g, '_rID_');

describe('Tabs — icon + count', () => {
  it('icon + count render on a tab', () => {
    const { container } = draw('Tabs', {
      tabs: [{ label: 'Inbox', value: 'inbox', icon: 'mail', count: 3 }, { label: 'Sent', value: 'sent' }],
      defaultValue: 'inbox',
    });
    const firstTab = container.querySelector('[role="tab"]')!;
    expect(firstTab.querySelector('svg')).not.toBeNull();
    expect(firstTab.textContent).toContain('3');
  });

  it('plain tabs (no icon/count) → byte-identical to prop absent', () => {
    const tabs = [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }];
    const a = draw('Tabs', { tabs, defaultValue: 'one' });
    const html = a.container.innerHTML;
    a.unmount();
    // adding icon:null/count:null to the objects must not change the render
    const b = draw('Tabs', { tabs: tabs.map((t) => ({ ...t, icon: null, count: null })), defaultValue: 'one' });
    expect(canonIds(html)).toBe(canonIds(b.container.innerHTML));
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Accordion / Collapsible — caret scales with size
 * ════════════════════════════════════════════════════════════════════════ */
describe('caret size scales with size enum', () => {
  it('Accordion size:lg → 18px caret; size:md → 16px', () => {
    const lg = draw('Accordion', { items: [{ title: 'T', content: 'C' }], size: 'lg', chevronIcon: 'chevron-down' });
    expect(lg.container.querySelector('svg')!.getAttribute('width')).toBe('18');
    lg.unmount();
    const md = draw('Accordion', { items: [{ title: 'T', content: 'C' }], size: 'md', chevronIcon: 'chevron-down' });
    expect(md.container.querySelector('svg')!.getAttribute('width')).toBe('16');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Card — content gap enum
 * ════════════════════════════════════════════════════════════════════════ */
describe('Card — gap enum', () => {
  it('gap:lg → gap-6 on the content column; default md keeps gap-4', () => {
    const lg = draw('Card', { title: 'T', gap: 'lg' });
    const contentLg = [...lg.container.querySelectorAll('div')].find((d) => d.classList.contains('flex-col'))!;
    expect(has(contentLg, 'gap-6')).toBe(true);
    lg.unmount();
    const md = draw('Card', { title: 'T' });
    const contentMd = [...md.container.querySelectorAll('div')].find((d) => d.classList.contains('flex-col'))!;
    expect(has(contentMd, 'gap-4')).toBe(true);
  });

  it('gap UNSET → byte-identical to prop absent', () => {
    const a = draw('Card', { title: 'T', gap: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Card', { title: 'T' });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Popover — light-dismiss (Escape)
 * ════════════════════════════════════════════════════════════════════════ */
describe('Popover — dismiss', () => {
  it('Escape closes the open popover', () => {
    const { container } = draw('Popover', { trigger: 'Open', content: 'Hi' });
    fireEvent.click(container.querySelector('button')!);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('outside mousedown closes the open popover', () => {
    const { container } = draw('Popover', { trigger: 'Open', content: 'Hi' });
    fireEvent.click(container.querySelector('button')!);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Tooltip — maxWidthValue + shadow/motion
 * ════════════════════════════════════════════════════════════════════════ */
describe('Tooltip — sizing + elevation', () => {
  it('maxWidthValue SET → the bubble wraps (whitespace-normal dedupes nowrap) + reads the cap var', () => {
    const { container } = draw('Tooltip', { text: 'API key', content: 'A long tooltip sentence', maxWidthValue: '16rem' });
    const bubble = container.querySelector('[role="tooltip"]')!;
    expect(has(bubble, 'whitespace-normal')).toBe(true);
    expect(has(bubble, 'whitespace-nowrap')).toBe(false);
    expect(has(bubble, '[max-width:var(--fr-tt-maxw)]')).toBe(true);
  });

  it('shadow SET → a shadow-* utility on the bubble', () => {
    const { container } = draw('Tooltip', { text: 'X', content: 'Y', shadow: 'lg' });
    expect(has(container.querySelector('[role="tooltip"]')!, 'shadow-lg')).toBe(true);
  });

  it('maxWidthValue/shadow/motion UNSET → byte-identical to prop absent (default cap stays)', () => {
    const a = draw('Tooltip', { text: 'X', content: 'Y', maxWidthValue: null, shadow: null, motion: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Tooltip', { text: 'X', content: 'Y' });
    expect(html).toBe(b.container.innerHTML);
    // The null≡absent invariant above is what this test is for and is unchanged.
    // The default it lands on is not: the bubble used to be whitespace-nowrap
    // with no ceiling, which overran the render surface by up to 1057px on real
    // content. The unset default is now a container-relative cap.
    const bubble = b.container.querySelector('[role="tooltip"]')!;
    expect(has(bubble, 'whitespace-nowrap')).toBe(false);
    expect(has(bubble, 'whitespace-normal')).toBe(true);
    expect(has(bubble, '[max-width:min(18rem,calc(100cqw-1.5rem))]')).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Dialog / Drawer — close button states + typography
 * ════════════════════════════════════════════════════════════════════════ */
describe('Dialog & Drawer — close + typography', () => {
  it('Dialog close button gains the focus ring + hover opacity', () => {
    const spec = one('Dialog', { title: 'Confirm', openPath: 'open' }, { open: true });
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    const close = container.querySelector('button[aria-label="Close"]')!;
    expect(has(close, 'focus-visible:ring-2')).toBe(true);
    expect(has(close, 'hover:opacity-100')).toBe(true);
    expect(has(close, 'opacity-70')).toBe(true);
  });

  it('Dialog font blanket → a font-* utility on the panel', () => {
    const spec = one('Dialog', { title: 'C', openPath: 'open', font: 'serif' }, { open: true });
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    const panel = container.querySelector('[role="dialog"]')!;
    expect(has(panel, 'font-serif')).toBe(true);
  });

  it('Dialog title leading → a leading-* utility on the h3', () => {
    const spec = one('Dialog', { title: 'C', openPath: 'open', leading: 'relaxed' }, { open: true });
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(has(container.querySelector('h3')!, 'leading-relaxed')).toBe(true);
  });

  it('Dialog font/leading UNSET → byte-identical to prop absent', () => {
    const specA = one('Dialog', { title: 'C', openPath: 'open', font: null, leading: null }, { open: true });
    const a = render(<FraymeRenderer spec={specA} mode="progressive" />);
    const html = a.container.innerHTML;
    a.unmount();
    const specB = one('Dialog', { title: 'C', openPath: 'open' }, { open: true });
    const b = render(<FraymeRenderer spec={specB} mode="progressive" />);
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Alert — registry SVG status icons + widened icon prop
 * ════════════════════════════════════════════════════════════════════════ */
describe('Alert — SVG icons', () => {
  it('renders an <svg> status glyph (not a unicode char) by default', () => {
    const { container } = draw('Alert', { title: 'Saved', type: 'success' });
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('icon:none → no status glyph', () => {
    const { container } = draw('Alert', { title: 'x', type: 'info', icon: 'none' });
    // the only possible svg would be the status icon; dismiss is off → none present
    expect(container.querySelector('svg')).toBeNull();
  });

  it('widened icon prop: an arbitrary registry name renders that glyph', () => {
    const { container } = draw('Alert', { title: 'x', type: 'info', icon: 'bell' });
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Table — per-column alignment
 * ════════════════════════════════════════════════════════════════════════ */
describe('Table — columnAlign', () => {
  it('columnAlign right-aligns the second column th + td', () => {
    const { container } = draw('Table', {
      columns: ['Name', 'Amount'],
      rows: [['Acme', '£12']],
      columnAlign: ['left', 'right'],
    });
    const ths = [...container.querySelectorAll('th')];
    expect(has(ths[1]!, 'text-right')).toBe(true);
    const tds = [...container.querySelectorAll('td')];
    expect(has(tds[1]!, 'text-right')).toBe(true);
  });

  it('columnAlign UNSET → byte-identical to prop absent', () => {
    const base = { columns: ['A', 'B'], rows: [['1', '2']] };
    const a = draw('Table', { ...base, columnAlign: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Table', base);
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Heading — shared tracking atom + clamp
 * ════════════════════════════════════════════════════════════════════════ */
describe('Heading — tracking atom + clamp', () => {
  it('tracking:wider (5-step atom) → tracking-wider, base tracking-normal deduped', () => {
    const { container } = draw('Heading', { text: 'Hi', tracking: 'wider' });
    const h = container.querySelector('h1,h2,h3,h4')!;
    expect(has(h, 'tracking-wider')).toBe(true);
    expect(has(h, 'tracking-normal')).toBe(false);
  });

  it('clamp:2 → line-clamp utility + the clamp count var', () => {
    const { container } = draw('Heading', { text: 'Long heading', clamp: 2 });
    const h = container.querySelector('h1,h2,h3,h4') as HTMLElement;
    expect(has(h, '[-webkit-line-clamp:var(--fr-heading-clamp)]')).toBe(true);
    expect(styleOf(h)).toContain('--fr-heading-clamp');
  });

  it('tracking/clamp UNSET → byte-identical to prop absent (base tracking-normal stays)', () => {
    const a = draw('Heading', { text: 'Hi', tracking: null, clamp: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Heading', { text: 'Hi' });
    expect(html).toBe(b.container.innerHTML);
    expect(has(b.container.querySelector('h1,h2,h3,h4')!, 'tracking-normal')).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * CodeBlock — copy availability + labels
 * ════════════════════════════════════════════════════════════════════════ */
describe('CodeBlock — copy', () => {
  it('headerless block gains a floating copy button (showCopy default true)', () => {
    const { container } = draw('CodeBlock', { code: 'const x = 1;' });
    const copyBtn = container.querySelector('button[aria-label="Copy"]');
    expect(copyBtn).not.toBeNull();
  });

  it('showCopy:false on a headerless block → no copy button', () => {
    const { container } = draw('CodeBlock', { code: 'const x = 1;', showCopy: false });
    expect(container.querySelector('button')).toBeNull();
  });

  it('copyLabel override localises the button aria-label', () => {
    const { container } = draw('CodeBlock', { code: 'x', copyLabel: 'Kopieren' });
    expect(container.querySelector('button[aria-label="Kopieren"]')).not.toBeNull();
  });
});
