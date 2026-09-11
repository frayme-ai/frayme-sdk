/**
 * Regression guard for the PARTIAL-PROP / COHERENCE-GROUP fixes
 * (layout / inputs-choice / inputs-date / charts-proportion / marketing-hero).
 *
 * For each fixed channel the test asserts the TRIPLE:
 *   (a) the channel var is present in the target element's inline style attr,
 *   (b) the CONSUMING class is present in its className,
 *   (c) the competing token class it must dedupe/replace is ABSENT.
 *
 * Plus per-component UNSET-DEFAULT tests: a spec with the channel prop
 * explicitly unset (null) renders BYTE-IDENTICAL innerHTML to a spec that never
 * mentions the prop at all.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const has = (el: Element, token: string): boolean => el.classList.contains(token);
const anyHas = (root: Element, token: string): boolean =>
  [...root.querySelectorAll('*')].some((el) => el.classList.contains(token));

const TABS = {
  tabs: [
    { label: 'One', value: 'one' },
    { label: 'Two', value: 'two' },
  ],
};
const CB_OPTS = {
  options: [
    { label: 'United Kingdom', value: 'uk' },
    { label: 'United States', value: 'us' },
  ],
};
const SANKEY = {
  nodes: [{ label: 'Visitors' }, { label: 'Paid' }],
  links: [{ source: 0, target: 1, value: 90 }],
};

/* ── Tabs: accent covers the selected tab on EVERY variant (HIGH) ──────────── */

describe('Tabs — accent on pill/enclosed selected tab', () => {
  for (const variant of ['pill', 'enclosed'] as const) {
    it(`${variant}: accent var on wrapper, ink reader on the selected tab, text-foreground deduped`, () => {
      const { container } = draw('Tabs', { ...TABS, variant, accent: '#ff0000' });
      const wrapper = container.querySelector('.frayme-root')!.firstElementChild!;
      expect(styleOf(wrapper)).toContain('--fr-tabs-accent');
      // the label reads the contrast-guarded ink var, which itself blends the
      // accent. The blend below is the one settled on, unchanged; it
      // is now spelled --fr-tabs-ink-FILL because these two variants paint their
      // own bg-card slab and the plain --fr-tabs-ink went to `currentColor` for
      // the transparent underline rail (test/inherited-foreground-inputs-overlay-layout.test.tsx).
      expect(has(wrapper, '[--fr-tabs-ink-fill:color-mix(in_oklab,var(--fr-tabs-accent)_65%,var(--color-foreground))]')).toBe(true);
      const selected = container.querySelector('[role="tab"][aria-selected="true"]')!;
      expect(selected).not.toBeNull();
      expect(has(selected, 'text-[color:var(--fr-tabs-ink-fill)]')).toBe(true);
      expect(has(selected, 'text-foreground')).toBe(false);
    });
  }

  it('pill without accent: the selected tab keeps text-foreground (default intact)', () => {
    const { container } = draw('Tabs', { ...TABS, variant: 'pill' });
    const selected = container.querySelector('[role="tab"][aria-selected="true"]')!;
    expect(has(selected, 'text-foreground')).toBe(true);
    expect(has(selected, 'text-[color:var(--fr-tabs-ink)]')).toBe(false);
  });

  it('underline: the indicator keeps the RAW accent while the label takes the ink blend', () => {
    const { container } = draw('Tabs', { ...TABS, accent: '#7c3aed' });
    const selected = container.querySelector('[role="tab"][aria-selected="true"]')!;
    expect(has(selected, 'border-b-[color:var(--fr-tabs-accent)]')).toBe(true);
    expect(has(selected, 'text-[color:var(--fr-tabs-ink)]')).toBe(true);
    expect(has(selected, 'text-[color:var(--fr-tabs-accent)]')).toBe(false);
  });

  it('enclosed: selected tab edge reads the trackColor channel, border-border gone', () => {
    const { container } = draw('Tabs', { ...TABS, variant: 'enclosed', trackColor: '#00ff00' });
    const wrapper = container.querySelector('.frayme-root')!.firstElementChild!;
    expect(styleOf(wrapper)).toContain('--fr-tabs-track');
    const selected = container.querySelector('[role="tab"][aria-selected="true"]')!;
    expect(has(selected, 'border-[color:var(--fr-tabs-track,var(--color-border))]')).toBe(true);
    expect(has(selected, 'border-border')).toBe(false);
    // the bottom knock-out must survive the group-form all-sides class
    expect(has(selected, 'border-b-card')).toBe(true);
  });
});

/* ── Accordion: radius channel covers the separated item cards (HIGH) ──────── */

describe('Accordion — separated items read the radius var-chain', () => {
  it('radiusValue var on wrapper; item consumes the chain; rounded-frayme absent', () => {
    const { container } = draw('Accordion', {
      items: [{ title: 'A', content: 'x' }],
      variant: 'separated',
      radiusValue: '2px',
    });
    const wrapper = container.querySelector('.frayme-root')!.firstElementChild!;
    expect(styleOf(wrapper)).toContain('--fr-acc-radius');
    const item = wrapper.firstElementChild!;
    expect(
      has(item, '[border-radius:var(--fr-acc-radius,var(--fr-acc-radius-default,var(--radius-frayme)))]'),
    ).toBe(true);
    expect(has(item, 'rounded-frayme')).toBe(false);
  });
});

/* ── Separator: labelled-path length reader + labelColor channel (MED) ─────── */

describe('Separator — labelled divider length + labelColor', () => {
  it('length: reader class + mx-auto on the wrap, var in style', () => {
    const { container } = draw('Separator', { label: 'OR', length: '60%' });
    const wrap = container.querySelector('[role="separator"]')!;
    expect(styleOf(wrap)).toContain('--fr-sep-len');
    expect(has(wrap, '[width:var(--fr-sep-len,100%)]')).toBe(true);
    expect(has(wrap, 'mx-auto')).toBe(true);
  });

  it('labelColor: var on the wrap, label span reads it, text-muted-foreground absent', () => {
    const { container } = draw('Separator', { label: 'OR', labelColor: '#ff0000' });
    const wrap = container.querySelector('[role="separator"]')!;
    expect(styleOf(wrap)).toContain('--fr-sep-label');
    const label = [...wrap.querySelectorAll('span')].find((s) => s.textContent === 'OR')!;
    expect(has(label, 'text-[color:var(--fr-sep-label,var(--color-muted-foreground))]')).toBe(true);
    expect(has(label, 'text-muted-foreground')).toBe(false);
  });

  it('length unset: no width reader / mx-auto on a labelled divider (default intact)', () => {
    const { container } = draw('Separator', { label: 'OR' });
    const wrap = container.querySelector('[role="separator"]')!;
    expect(has(wrap, '[width:var(--fr-sep-len,100%)]')).toBe(false);
    expect(has(wrap, 'mx-auto')).toBe(false);
  });
});

/* ── Carousel: prev/next controls follow cardBg/borderColor (MED) ──────────── */

describe('Carousel — control buttons read the card channels', () => {
  it('vars ride the outer wrapper; both arrows consume them; token classes absent', () => {
    const { container } = draw('Carousel', {
      items: [{ title: 'X', description: 'd' }],
      showControls: true,
      cardBg: '#111111',
      borderColor: '#00ff00',
    });
    const wrapper = container.querySelector('.frayme-root')!.firstElementChild!;
    expect(styleOf(wrapper)).toContain('--fr-car-bg');
    expect(styleOf(wrapper)).toContain('--fr-car-border');
    for (const label of ['Previous', 'Next']) {
      const btn = container.querySelector(`button[aria-label="${label}"]`)!;
      expect(btn, label).not.toBeNull();
      expect(has(btn, '[background:var(--fr-car-bg,var(--color-card))]')).toBe(true);
      expect(has(btn, '[border-color:var(--fr-car-border,var(--color-border))]')).toBe(true);
      expect(has(btn, 'bg-card')).toBe(false);
      expect(has(btn, 'border-border')).toBe(false);
    }
  });
});

/* ── Collapsible: body padding scales with the size enum (MED) ─────────────── */

describe('Collapsible — body padding follows the size enum', () => {
  it('size:lg → body gutter matches the trigger (px-5 pb-4)', () => {
    const { container } = draw('Collapsible', { title: 'T', defaultOpen: true, size: 'lg' });
    const body = container.querySelector('button[aria-expanded="true"]')!.nextElementSibling!;
    expect(has(body, 'px-5')).toBe(true);
    expect(has(body, 'pb-4')).toBe(true);
  });

  // REGRESSION — the 0px seam. A support-triage page rendered a trailing note
  // ("Crews come in from the Cannon Street end…") flush against the <dl> above
  // it, measured at exactly 0px, because the body carried padding but no rhythm
  // rule for stacked children. Every size must separate siblings, and no size
  // may disturb a single-child body.
  it.each([
    ['sm', 'mt-2'],
    ['md', 'mt-3'],
    ['lg', 'mt-3.5'],
  ])('size:%s → stacked children get a seam (%s)', (size, seam) => {
    const { container } = draw('Collapsible', { title: 'T', defaultOpen: true, size });
    const body = container.querySelector('button[aria-expanded="true"]')!.nextElementSibling!;
    expect(body.className).toContain(`[&>*+*]:${seam}`);
  });

  it('the seam is sibling-scoped, so a single-child body is untouched', () => {
    // `*+*` selects only an element PRECEDED by a sibling. A one-child body —
    // the overwhelmingly common case — must render byte-identically to before.
    const { container } = draw('Collapsible', { title: 'T', defaultOpen: true });
    const body = container.querySelector('button[aria-expanded="true"]')!.nextElementSibling!;
    expect(body.className.startsWith('px-4 pb-3.5')).toBe(true);
    expect(body.className).not.toContain('mt-3 ');   // never a bare margin
    expect(body.className).not.toContain('space-y');  // never a layout-model change
  });

  it('default (md) → the prior px-4 pb-3.5 padding, plus the stacked-child seam', () => {
    const { container } = draw('Collapsible', { title: 'T', defaultOpen: true });
    const body = container.querySelector('button[aria-expanded="true"]')!.nextElementSibling!;
    // The PADDING pin is the point of this test and is unchanged. The seam class
    // is additive and deliberate: the body renders arbitrary authored children
    // and previously stacked them at a 0px seam (a trailing note welded to the
    // description grid above it). `*+*` means it cannot affect a single-child
    // body, so this md default still renders identically wherever it always did.
    expect(body.className).toBe('px-4 pb-3.5 [&>*+*]:mt-3');
  });
});

/* ── Combobox: chevron + spinner follow mutedColor (HIGH) ──────────────────── */

describe('Combobox — trailing chevron + spinner read the muted channel', () => {
  it('chevron: var on the control, reader class present, text-muted-foreground absent', () => {
    const { container } = draw('Combobox', { ...CB_OPTS, mutedColor: '#123456' });
    const control = container.querySelector('[role="combobox"]')!.parentElement!;
    expect(styleOf(control)).toContain('--fr-cb-muted');
    const chevron = control.querySelector('span[aria-hidden]')!;
    expect(has(chevron, '[color:var(--fr-cb-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(chevron, 'text-muted-foreground')).toBe(false);
  });

  it('loading spinner reads the same muted channel', () => {
    const { container } = draw('Combobox', { ...CB_OPTS, loading: true, mutedColor: '#123456' });
    const spinner = container.querySelector('.animate-spin')!;
    expect(spinner).not.toBeNull();
    expect(has(spinner, '[color:var(--fr-cb-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(spinner, 'text-muted-foreground')).toBe(false);
  });
});

/* ── MultiSelect/Combobox menus: field + popover coherence group (MED) ─────── */

describe('choice menus — bg/borderColor cover the open panel', () => {
  it('MultiSelect: open menu carries the vars + reader classes; tokens absent', () => {
    const { container } = draw('MultiSelect', { ...CB_OPTS, bg: '#111111', borderColor: '#00ff00' });
    fireEvent.click(container.querySelector('button[aria-haspopup="listbox"]')!);
    const menu = container.querySelector('[role="listbox"]')!;
    expect(menu).not.toBeNull();
    expect(styleOf(menu)).toContain('--fr-ms-bg');
    expect(styleOf(menu)).toContain('--fr-ms-border');
    expect(has(menu, 'border-[color:var(--fr-ms-border,var(--color-border))]')).toBe(true);
    expect(has(menu, '[background:var(--fr-ms-bg,var(--color-card))]')).toBe(true);
    expect(has(menu, 'border-border')).toBe(false);
    expect(has(menu, 'bg-card')).toBe(false);
  });

  it('Combobox: open menu border reads the borderColor channel', () => {
    const { container } = draw('Combobox', { ...CB_OPTS, borderColor: '#00ff00' });
    fireEvent.focus(container.querySelector('[role="combobox"]')!);
    const menu = container.querySelector('[role="listbox"]')!;
    expect(menu).not.toBeNull();
    expect(styleOf(menu)).toContain('--fr-cb-border');
    expect(has(menu, 'border-[color:var(--fr-cb-border,var(--color-border))]')).toBe(true);
    expect(has(menu, 'border-border')).toBe(false);
  });
});

/* ── resting-border precedence: borderColor wins over accent (MED) ─────────── */

describe('choice family — borderColor beats accent on the resting border', () => {
  it('MultiSelect: accent alone takes the border; accent + borderColor does NOT', () => {
    const alone = draw('MultiSelect', { ...CB_OPTS, accent: '#ff0000' });
    const controlAlone = alone.container.querySelector('[aria-haspopup="listbox"]')!.parentElement!;
    expect(has(controlAlone, '[border-color:var(--fr-ms-accent)]')).toBe(true);
    alone.unmount();
    const both = draw('MultiSelect', { ...CB_OPTS, accent: '#ff0000', borderColor: '#00ff00' });
    const controlBoth = both.container.querySelector('[aria-haspopup="listbox"]')!.parentElement!;
    expect(has(controlBoth, '[border-color:var(--fr-ms-accent)]')).toBe(false);
    expect(styleOf(controlBoth)).toContain('--fr-ms-border');
  });

  it('TagInput: accent + borderColor set → the accent border override is absent', () => {
    const { container } = draw('TagInput', { accent: '#ff0000', borderColor: '#00ff00' });
    const field = container.querySelector('input')!.parentElement!;
    expect(has(field, '[border-color:var(--fr-ti-accent)]')).toBe(false);
  });

  it('Combobox: accent + borderColor set → the accent border override is absent', () => {
    const { container } = draw('Combobox', { ...CB_OPTS, accent: '#ff0000', borderColor: '#00ff00' });
    const control = container.querySelector('[role="combobox"]')!.parentElement!;
    expect(has(control, '[border-color:var(--fr-cb-accent)]')).toBe(false);
  });
});

/* ── SegmentedControl: focus ring derives from accent (MED) ────────────────── */

describe('SegmentedControl — segment focus ring from the accent channel', () => {
  it('accent var on the group; every segment carries the accent ring reader', () => {
    const { container } = draw('SegmentedControl', {
      options: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
      ],
      value: 'day',
      accent: '#ff0000',
    });
    const group = container.querySelector('[role="group"]')!;
    expect(styleOf(group)).toContain('--fr-sc-accent');
    for (const btn of group.querySelectorAll('button')) {
      expect(has(btn, 'focus-visible:[--tw-ring-color:var(--fr-sc-accent,var(--fr-accent))]')).toBe(true);
      expect(has(btn, 'focus-visible:[--tw-ring-color:var(--color-primary)]')).toBe(false);
    }
  });
});

/* ── date components: MonthHeader chevrons consume the 3 channels (HIGH) ───── */

describe('date components — month-nav chevrons read muted/fg/accent', () => {
  it('DatePicker: chevron triple (muted var + readers + tokens absent) with accent hover', () => {
    const { container } = draw('DatePicker', { mode: 'inline',
      value: '2026-07-15',
      mutedColor: '#123456',
      accent: '#ff0000',
    });
    const root = container.querySelector('.frayme-root')!.firstElementChild!;
    expect(styleOf(root)).toContain('--fr-cal-muted');
    const prev = container.querySelector('button[aria-label="Previous month"]')!;
    expect(prev).not.toBeNull();
    expect(has(prev, 'text-[color:var(--fr-cal-muted,var(--color-muted-foreground))]')).toBe(true);
    // Still the TOKEN, deliberately: the chevron sits on the picker panel's own
    // --color-card fill, so it is not part of the inherited-ink fix — only the
    // transparent preset chip below is (see test/inherited-foreground-inputs-overlay-layout.test.tsx).
    expect(has(prev, 'hover:text-[color:var(--fr-cal-fg,var(--color-foreground))]')).toBe(true);
    expect(has(prev, 'focus-visible:[--tw-ring-color:var(--fr-cal-accent,var(--fr-accent))]')).toBe(true);
    expect(has(prev, 'hover:[background:color-mix(in_srgb,var(--fr-cal-accent)_10%,transparent)]')).toBe(true);
    expect(has(prev, 'text-muted-foreground')).toBe(false);
    expect(has(prev, 'hover:text-foreground')).toBe(false);
    expect(has(prev, 'focus-visible:ring-primary')).toBe(false);
    expect(has(prev, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });

  it('Calendar: chevrons keep the token hover when no accent is named', () => {
    const { container } = draw('Calendar', { month: '2026-07' });
    const next = container.querySelector('button[aria-label="Next month"]')!;
    expect(has(next, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(next, 'text-[color:var(--fr-cal-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(next, 'text-muted-foreground')).toBe(false);
  });
});

/* ── date pickers: the inline panel border reads borderColor (HIGH) ────────── */

describe('date pickers — panel border completes the chrome group', () => {
  for (const type of ['DatePicker', 'DateRangePicker'] as const) {
    it(`${type}: no border-border anywhere; the panel consumes the border var`, () => {
      const props =
        type === 'DatePicker' ? { value: '2026-07-15', borderColor: '#00ff00', mode: 'inline' } : { borderColor: '#00ff00', mode: 'inline' };
      const { container } = draw(type, props);
      const root = container.querySelector('.frayme-root')!.firstElementChild!;
      expect(styleOf(root)).toContain('--fr-cal-border');
      expect(anyHas(container, 'border-border')).toBe(false);
      const readers = [...container.querySelectorAll('*')].filter((el) =>
        el.classList.contains('[border-color:var(--fr-cal-border,var(--color-border))]'),
      );
      // field box + calendar panel at minimum
      expect(readers.length).toBeGreaterThanOrEqual(2);
    });
  }
});

/* ── DateRangePicker: quick-range presets consume the themed channels (HIGH) ── */

describe('DateRangePicker — preset buttons join the theme group', () => {
  const props = {
    presets: [{ label: 'Last 7 days', start: '2026-06-19', end: '2026-06-25' }],
    borderColor: '#00ff00',
    color: '#ffffff',
    accent: '#ff0000',
    bg: '#222222',
    radiusValue: '4px',
    // chrome assertions target the always-visible panel; popover mode hides it
    // until the trigger opens (see the popover-behaviour suite).
    mode: 'inline' as const,
  };

  it('preset: border/text/ring/radius/bg readers present, token classes absent', () => {
    const { container } = draw('DateRangePicker', props);
    const preset = container.querySelector('[role="group"][aria-label="Quick ranges"] button')!;
    expect(preset).not.toBeNull();
    expect(has(preset, '[border-color:var(--fr-cal-border,var(--color-border))]')).toBe(true);
    expect(has(preset, 'text-[color:var(--fr-cal-fg,currentColor)]')).toBe(true);
    expect(has(preset, 'focus-visible:[--tw-ring-color:var(--fr-cal-accent,var(--fr-accent))]')).toBe(true);
    expect(has(preset, '[border-radius:var(--fr-cal-radius,var(--radius-frayme))]')).toBe(true);
    expect(has(preset, '[background:var(--fr-cal-bg,transparent)]')).toBe(true);
    expect(has(preset, 'hover:[background:color-mix(in_srgb,var(--fr-cal-accent)_10%,transparent)]')).toBe(true);
    expect(has(preset, 'rounded-frayme')).toBe(false);
    expect(has(preset, 'border-border')).toBe(false);
    expect(has(preset, 'text-foreground')).toBe(false);
    expect(has(preset, 'focus-visible:ring-primary')).toBe(false);
    expect(has(preset, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });

  it('preset without accent keeps the token hover (default hover intact)', () => {
    const { container } = draw('DateRangePicker', { mode: 'inline',
      presets: [{ label: 'Last 7 days', start: '2026-06-19', end: '2026-06-25' }],
    });
    const preset = container.querySelector('[role="group"][aria-label="Quick ranges"] button')!;
    expect(has(preset, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
    expect(has(preset, 'hover:[background:color-mix(in_srgb,var(--fr-cal-accent)_10%,transparent)]')).toBe(false);
  });
});

/* ── day cells: hover travels with the accent channel (MED) ────────────────── */

describe('date components — day-cell hover from accent', () => {
  it('DatePicker with accent: default day cells swap hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] for the accent wash', () => {
    const { container } = draw('DatePicker', { mode: 'inline', value: '2026-07-15', accent: '#ff0000' });
    const day = [...container.querySelectorAll('[role="gridcell"]')].find(
      (el) => el.getAttribute('aria-selected') === 'false' && !el.hasAttribute('disabled'),
    )!;
    expect(day).not.toBeNull();
    expect(has(day, 'hover:[background:color-mix(in_srgb,var(--fr-cal-accent)_10%,transparent)]')).toBe(true);
    expect(has(day, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
  });

  it('DatePicker without accent: the token hover is intact on default day cells', () => {
    const { container } = draw('DatePicker', { mode: 'inline', value: '2026-07-15' });
    const day = [...container.querySelectorAll('[role="gridcell"]')].find(
      (el) => el.getAttribute('aria-selected') === 'false' && !el.hasAttribute('disabled'),
    )!;
    expect(has(day, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(true);
  });
});

/* ── Sankey: showLegend completes the chart coherence group (MED) ──────────── */

describe('Sankey — showLegend', () => {
  it('showLegend:false hides the legend', () => {
    const { container } = draw('Sankey', { ...SANKEY, showLegend: false });
    expect(container.querySelector('ul')).toBeNull();
  });

  it('default shows the legend (prior behavior)', () => {
    const { container } = draw('Sankey', SANKEY);
    expect(container.querySelector('ul')).not.toBeNull();
  });
});

/* ── Hero/CTA: non-primary action buttons on a custom surface (HIGH) ───────── */

describe('Hero/CTA — secondary/outline/ghost buttons read the band fg on a surface', () => {
  it('Hero: outline/ghost/secondary consume --fr-hero-fg; token classes deduped', () => {
    const { container } = draw('Hero', {
      title: 'T',
      bg: '#111111',
      color: '#ffffff',
      actions: [
        { label: 'A' }, // primary (first)
        { label: 'B', variant: 'outline' },
        { label: 'C', variant: 'ghost' },
        { label: 'D', variant: 'secondary' },
      ],
    });
    const band = container.querySelector('section')!;
    expect(styleOf(band)).toContain('--fr-hero-bg');
    expect(styleOf(band)).toContain('--fr-hero-fg');
    const buttons = [...band.querySelectorAll('button')];
    const outline = buttons.find((b) => b.textContent === 'B')!;
    const ghost = buttons.find((b) => b.textContent === 'C')!;
    const secondary = buttons.find((b) => b.textContent === 'D')!;
    for (const btn of [outline, ghost, secondary]) {
      expect(has(btn, 'text-[color:var(--fr-hero-fg,var(--color-primary-foreground))]')).toBe(true);
      expect(has(btn, 'text-foreground')).toBe(false);
      expect(has(btn, 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]')).toBe(false);
    }
    expect(has(outline, 'border-current')).toBe(true);
    expect(has(outline, 'border-border')).toBe(false);
    expect(has(secondary, 'bg-muted')).toBe(false);
    expect(has(secondary, 'bg-[color:color-mix(in_srgb,currentColor_15%,transparent)]')).toBe(true);
    // the primary (filled) button keeps its own treatment — quiet-defaults
    // made that the neutral high-contrast fill (bg-foreground), not the brand slab.
    const primary = buttons.find((b) => b.textContent === 'A')!;
    expect(has(primary, 'bg-foreground')).toBe(true);
    expect(has(primary, 'bg-primary')).toBe(false);
  });

  it('Hero without a surface: buttons keep their token classes (default intact)', () => {
    const { container } = draw('Hero', {
      title: 'T',
      actions: [{ label: 'A' }, { label: 'B', variant: 'outline' }],
    });
    const outline = [...container.querySelectorAll('button')].find((b) => b.textContent === 'B')!;
    expect(has(outline, 'border-border')).toBe(true);
    expect(has(outline, 'text-foreground')).toBe(true);
  });

  it('CTA: ghost button on a custom bg reads --fr-cta-fg', () => {
    const { container } = draw('CTA', {
      title: 'T',
      bg: '#111111',
      actions: [{ label: 'A' }, { label: 'B', variant: 'ghost' }],
    });
    const ghost = [...container.querySelectorAll('button')].find((b) => b.textContent === 'B')!;
    expect(has(ghost, 'text-[color:var(--fr-cta-fg,var(--color-primary-foreground))]')).toBe(true);
    expect(has(ghost, 'text-foreground')).toBe(false);
  });

  it('CTA variant:card ignores bg for the buttons (card keeps its own surface)', () => {
    const { container } = draw('CTA', {
      title: 'T',
      bg: '#111111',
      variant: 'card',
      actions: [{ label: 'A' }, { label: 'B', variant: 'ghost' }],
    });
    const ghost = [...container.querySelectorAll('button')].find((b) => b.textContent === 'B')!;
    expect(has(ghost, 'text-foreground')).toBe(true);
  });
});

/* ── FeatureGrid: container→card cascade completeness (MED) ────────────────── */

describe('FeatureGrid — full uniform-styling cascade', () => {
  it('borderWidthValue/fontSize cascade as vars; borderStyle/font/tracking/leading thread as props', () => {
    const { container } = draw('FeatureGrid', {
      features: [{ icon: 'sparkles', title: 'A', description: 'd' }],
      variant: 'bordered',
      borderStyle: 'dashed',
      borderWidthValue: '3px',
      fontSize: '18px',
      font: 'mono',
      tracking: 'wide',
      leading: 'loose',
    });
    const grid = container.querySelector('.frayme-root')!.firstElementChild!;
    expect(styleOf(grid)).toContain('--fr-fcard-bw');
    expect(styleOf(grid)).toContain('--fr-fcard-fs');
    const card = grid.firstElementChild!;
    expect(has(card, 'border-dashed')).toBe(true);
    expect(has(card, 'border-solid')).toBe(false);
    expect(has(card, 'font-mono')).toBe(true);
    const title = card.querySelector('h3')!;
    expect(has(title, 'tracking-wide')).toBe(true);
    expect(has(title, 'leading-loose')).toBe(true);
    expect(has(title, 'leading-normal')).toBe(false);
    expect(has(title, '[font-size:var(--fr-fcard-fs,1rem)]')).toBe(true);
  });
});

/* ── on-surface color channel: Box / Container / Stack / Grid / Card (HIGH) ──
 *
 * What this table pins is the CHANNEL: a named `color` lands in the component's
 * var and the root carries a text-color GROUP-form reader, so children inherit
 * and the baked token class dedupes. The reader's in-var FALLBACK is a separate
 * decision and it has moved to `currentColor` — it is only reached when the
 * named colour is INVALID, and resetting an authored dark surface to the global
 * token there was the inherited-foreground defect. Card keeps
 * --color-card-foreground: it always paints a fill of its own.
 * See test/inherited-foreground-inputs-overlay-layout.test.tsx, which measures the resulting ink. */

type FgCase = { type: string; props: Record<string, unknown>; cssVar: string; cls: string };

// The reader chain gained a --fr-surface-fg step: a container that paints a `bg`
// and names no `color` now inherits the ink DERIVED from that bg, because 25
// components downstream expose no `color` prop and no spec could correct them.
// An authored colour still wins — it is still the first var in the chain, which is
// what these cases assert.
const FG_CASES: FgCase[] = [
  {
    type: 'Box',
    props: { bg: '#111111' },
    cssVar: '--fr-box-fg',
    cls: 'text-[color:var(--fr-box-fg,var(--fr-surface-fg,currentColor))]',
  },
  {
    type: 'Container',
    props: { bg: '#111111' },
    cssVar: '--fr-cont-fg',
    cls: 'text-[color:var(--fr-cont-fg,var(--fr-surface-fg,currentColor))]',
  },
  {
    type: 'Stack',
    props: { bg: '#111111' },
    cssVar: '--fr-stack-fg',
    cls: 'text-[color:var(--fr-stack-fg,var(--fr-surface-fg,currentColor))]',
  },
  {
    type: 'Grid',
    props: { bg: '#111111' },
    cssVar: '--fr-grid-fg',
    cls: 'text-[color:var(--fr-grid-fg,var(--fr-surface-fg,currentColor))]',
  },
  {
    type: 'Card',
    props: { title: 'T', description: 'd' },
    cssVar: '--fr-card-fg',
    cls: 'text-[color:var(--fr-card-fg,var(--fr-surface-fg,var(--color-card-foreground)))]',
  },
];

describe('layout surfaces — on-surface `color` channel on the root (children inherit)', () => {
  for (const c of FG_CASES) {
    it(`${c.type}: color lands in ${c.cssVar}; group-form reader on the surface root`, () => {
      const { container } = draw(c.type, { ...c.props, color: '#eeeeee' });
      const el = container.querySelector(`[style*="${c.cssVar}"]`);
      expect(el, `${c.type} root carrying ${c.cssVar}`).not.toBeNull();
      expect(has(el!, c.cls), `reader class on ${c.type}`).toBe(true);
    });
  }

  it('Card: the baked text-card-foreground is deduped when color is set', () => {
    const { container } = draw('Card', { title: 'T', color: '#eeeeee' });
    const card = container.querySelector('section')!;
    expect(has(card, 'text-card-foreground')).toBe(false);
    // title keeps its own accent behavior (accent var falls back to inherit).
    // h2, not h3: PageHeader emits h1, so an h3 default skipped a heading level
    // on every screen with a page header and a card.
    const title = card.querySelector('h2')!;
    expect(has(title, 'text-[color:var(--fr-card-accent,inherit)]')).toBe(true);
  });

  it('Card without color keeps text-card-foreground (default intact)', () => {
    const { container } = draw('Card', { title: 'T' });
    const card = container.querySelector('section')!;
    expect(has(card, 'text-card-foreground')).toBe(true);
  });
});

/* ── UNSET-DEFAULT byte-identical rule (every touched component) ───────────── */

type UnsetCase = { type: string; props: Record<string, unknown>; channel: string };

const UNSET_CASES: UnsetCase[] = [
  { type: 'Tabs', props: { ...TABS, variant: 'pill' }, channel: 'accent' },
  {
    type: 'Accordion',
    props: { items: [{ title: 'A', content: 'x' }], variant: 'separated' },
    channel: 'radiusValue',
  },
  { type: 'Separator', props: { label: 'OR' }, channel: 'labelColor' },
  { type: 'Separator', props: { label: 'OR' }, channel: 'length' },
  {
    type: 'Carousel',
    props: { items: [{ title: 'X', description: 'd' }], showControls: true },
    channel: 'cardBg',
  },
  { type: 'Collapsible', props: { title: 'T', defaultOpen: true }, channel: 'size' },
  { type: 'Card', props: { title: 'T', description: 'd' }, channel: 'color' },
  { type: 'Stack', props: {}, channel: 'color' },
  { type: 'Grid', props: {}, channel: 'color' },
  { type: 'Box', props: {}, channel: 'color' },
  { type: 'Container', props: {}, channel: 'color' },
  { type: 'MultiSelect', props: CB_OPTS, channel: 'borderColor' },
  { type: 'Combobox', props: CB_OPTS, channel: 'mutedColor' },
  { type: 'TagInput', props: { value: ['a'] }, channel: 'accent' },
  {
    type: 'SegmentedControl',
    props: {
      options: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
      ],
      value: 'day',
    },
    channel: 'accent',
  },
  { type: 'DatePicker', props: { value: '2026-07-15' }, channel: 'accent' },
  {
    type: 'DateRangePicker',
    props: { presets: [{ label: 'Last 7 days', start: '2026-06-19', end: '2026-06-25' }] },
    channel: 'accent',
  },
  { type: 'Calendar', props: { month: '2026-07' }, channel: 'accent' },
  { type: 'Sankey', props: SANKEY, channel: 'showLegend' },
  { type: 'Hero', props: { title: 'T', actions: [{ label: 'A' }, { label: 'B', variant: 'outline' }] }, channel: 'bg' },
  { type: 'CTA', props: { title: 'T', actions: [{ label: 'A' }] }, channel: 'bg' },
  {
    type: 'FeatureGrid',
    props: { features: [{ icon: 'sparkles', title: 'A', description: 'd' }], variant: 'bordered' },
    channel: 'fontSize',
  },
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
      const withNull = draw(c.type, { ...c.props, [c.channel]: null });
      const nullHtml = withNull.container.innerHTML;
      withNull.unmount();
      const without = draw(c.type, { ...c.props });
      expect(canonIds(nullHtml)).toBe(canonIds(without.container.innerHTML));
    });
  }
});
