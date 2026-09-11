/**
 * FORM CONTROLS regression guard — the fixes that
 * land in forms.tsx / forms-extended.tsx / inputs-specialized.tsx /
 * inputs-numeric.tsx / inputs-date.tsx.
 *
 * Follows test/value-channels.test.tsx: for each value channel assert the TRIPLE
 *   (a) the channel var is present on the target element's inline style,
 *   (b) the CONSUMING class is present in its className,
 *   (c) the competing token class it must dedupe is ABSENT when the prop is set.
 * Behavioral items use fireEvent/userEvent; additive items assert the UNSET
 * render is byte-identical to the prop being absent.
 *
 * Items covered: Input adornment wrapper · Select option objects · Textarea
 * showCount · Form disabled fieldset · ColorPicker channels · PhoneInput
 * mutedColor · radiusValue family-wide · OTPInput label + grouping · Rating
 * hover + empty-icon colour · RangeSlider readout · entered-value colour ·
 * Calendar today marker + event overflow.
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

/* ── Input adornment WRAPPER refactor + leading icon ────────────── */

describe('Input: border/bg move to the wrapper; adornments live inside', () => {
  const WRAP_BORDER = '[border-color:var(--fr-field-border,var(--color-border))]';
  // The --fr-surface-field step is the ground DERIVED from an authored surface;
  // unpublished when no container paints a bg, so this default case still resolves
  // to --color-card exactly as before. What is guarded here is unchanged: the
  // BOX is the wrapper and the <input> inside it is transparent and borderless.
  const WRAP_BG = '[background:var(--fr-field-bg,var(--fr-surface-field,var(--color-card)))]';

  it('the bordered box is the input WRAPPER (parent), not the <input>', () => {
    const { container } = draw('Input', { label: 'Email', name: 'email' });
    const input = container.querySelector('input')!;
    const wrap = input.parentElement!;
    // wrapper carries border/bg; input went transparent/borderless
    expect(has(wrap, WRAP_BORDER)).toBe(true);
    expect(has(wrap, WRAP_BG)).toBe(true);
    expect(has(input, WRAP_BORDER)).toBe(false);
    expect(has(input, 'border-0')).toBe(true);
    expect(has(input, 'bg-transparent')).toBe(true);
  });

  it('border/bg/width channels land on the WRAPPER', () => {
    const { container } = draw('Input', { label: 'Email', name: 'email', bg: '#101010', borderColor: '#334455', width: '20rem' });
    const wrap = container.querySelector('input')!.parentElement!;
    const s = styleOf(wrap);
    expect(s).toContain('--fr-field-bg');
    expect(s).toContain('--fr-field-border');
    expect(s).toContain('--fr-field-w');
  });

  it('leading icon (registry name) renders an <svg> inside the wrapper; unknown name renders nothing', () => {
    const known = draw('Input', { label: 'Email', name: 'email', icon: 'mail' });
    const wrap = known.container.querySelector('input')!.parentElement!;
    expect(wrap.querySelector('svg')).not.toBeNull();
    known.unmount();
    const unknown = draw('Input', { label: 'Email', name: 'email', icon: 'definitely-not-an-icon' });
    const wrap2 = unknown.container.querySelector('input')!.parentElement!;
    expect(wrap2.querySelector('svg')).toBeNull();
  });

  it('prefix/suffix render INSIDE the bordered wrapper (siblings of the input)', () => {
    const { container } = draw('Input', { label: 'Price', name: 'price', prefix: '£', suffix: '.00' });
    const input = container.querySelector('input')!;
    const wrap = input.parentElement!;
    const spans = [...wrap.querySelectorAll('span')].map((s) => s.textContent);
    expect(spans).toContain('£');
    expect(spans).toContain('.00');
  });

  it('disabled dims the WRAPPER (opacity-60) so adornments dim with the field', () => {
    const { container } = draw('Input', { label: 'Email', name: 'email', disabled: true, prefix: '£' });
    const wrap = container.querySelector('input')!.parentElement!;
    expect(has(wrap, 'opacity-60')).toBe(true);
  });

  it('UNSET (props-less) Input still renders the wrapper + a bare input', () => {
    const { container } = draw('Input', { label: 'Email', name: 'email' });
    const input = container.querySelector('input')!;
    // wrapper present, input inside it
    expect(input.parentElement!.tagName).toBe('DIV');
    expect(has(input.parentElement!, '[width:var(--fr-field-w,100%)]')).toBe(true);
  });
});

/* ── Select options union (strings OR {value,label}) ───────────────── */

describe('Select accepts {value,label} option pairs', () => {
  it('object options render label text with a distinct value', () => {
    const { container } = draw('Select', {
      label: 'Plan',
      name: 'plan',
      options: [{ value: 'sm', label: 'Small' }, { value: 'lg', label: 'Large' }],
    });
    const opts = [...container.querySelectorAll('option')].filter((o) => (o as HTMLOptionElement).value !== '');
    expect(opts.map((o) => (o as HTMLOptionElement).value)).toEqual(['sm', 'lg']);
    expect(opts.map((o) => o.textContent)).toEqual(['Small', 'Large']);
  });

  it('plain string options still render value===label (byte-identical to before)', () => {
    const withStrings = draw('Select', { label: 'Plan', name: 'plan', options: ['Free', 'Pro'] });
    const opts = [...withStrings.container.querySelectorAll('option')].filter((o) => (o as HTMLOptionElement).value !== '');
    expect(opts.map((o) => (o as HTMLOptionElement).value)).toEqual(['Free', 'Pro']);
    expect(opts.map((o) => o.textContent)).toEqual(['Free', 'Pro']);
  });
});

/* ── Textarea showCount without maxLength ─────────────────────────── */

describe('Textarea showCount renders a bare n when maxLength is absent', () => {
  it('showCount + no maxLength → a plain count (no slash)', () => {
    const { container } = draw('Textarea', { label: 'Bio', name: 'bio', value: 'abc', showCount: true });
    const counter = [...container.querySelectorAll('span')].find((s) => s.classList.contains('tabular-nums'))!;
    expect(counter.textContent).toBe('3');
  });

  it('showCount + maxLength → n/max (unchanged)', () => {
    const { container } = draw('Textarea', { label: 'Bio', name: 'bio', value: 'abc', showCount: true, maxLength: 10 });
    const counter = [...container.querySelectorAll('span')].find((s) => s.classList.contains('tabular-nums'))!;
    expect(counter.textContent).toBe('3/10');
  });

  it('showCount:null renders byte-identical to the prop being absent', () => {
    const a = draw('Textarea', { label: 'Bio', name: 'bio', showCount: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Textarea', { label: 'Bio', name: 'bio' });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ── Form disable-all via <fieldset disabled> ─────────────────────── */

const FORM_SPEC = (disabled: boolean | null | undefined): Spec =>
  ({
    root: 'form',
    elements: {
      form: { type: 'Form', props: disabled === undefined ? {} : { disabled }, children: ['inp'] },
      inp: { type: 'Input', props: { label: 'Email', name: 'email' } },
    },
    state: {},
  }) as unknown as Spec;

describe('Form.disabled cascades via a native fieldset', () => {
  it('disabled:true wraps children in a <fieldset disabled> (display:contents)', () => {
    const { container } = render(<FraymeRenderer spec={FORM_SPEC(true)} mode="progressive" />);
    const fs = container.querySelector('fieldset');
    expect(fs).not.toBeNull();
    expect(fs!.hasAttribute('disabled')).toBe(true);
    expect(has(fs!, 'contents')).toBe(true);
  });

  it('disabled:null renders byte-identical to disabled absent (no fieldset)', () => {
    const withNull = render(<FraymeRenderer spec={FORM_SPEC(null)} mode="progressive" />);
    const html = withNull.container.innerHTML;
    expect(withNull.container.querySelector('fieldset')).toBeNull();
    withNull.unmount();
    const without = render(<FraymeRenderer spec={FORM_SPEC(undefined)} mode="progressive" />);
    expect(html).toBe(without.container.innerHTML);
  });
});

/* ── ColorPicker bg/borderColor/radius channels ───────────────────── */

describe('ColorPicker bg + borderColor + radiusValue channels', () => {
  it('bg/border/radius vars land on the root; the hex field + chip read them', () => {
    const { container } = draw('ColorPicker', { value: '#123456', bg: '#0a0a0a', borderColor: '#445566', radiusValue: '10px' });
    const root = container.querySelector('[style*="--fr-colorpicker-bg"]')!;
    expect(root).not.toBeNull();
    expect(styleOf(root)).toContain('--fr-colorpicker-border');
    expect(styleOf(root)).toContain('--fr-cp-radius');
    const hex = container.querySelector('input[type="text"]')!;
    expect(has(hex, '[background:var(--fr-colorpicker-bg,var(--color-card))]')).toBe(true);
    expect(has(hex, '[border-color:var(--fr-colorpicker-border,var(--color-border))]')).toBe(true);
    expect(has(hex, '[border-radius:var(--fr-cp-radius,var(--radius-frayme))]')).toBe(true);
    // the old hardcoded token utilities are gone from the hex field
    expect(has(hex, 'bg-card')).toBe(false);
    expect(has(hex, 'border-border')).toBe(false);
    expect(has(hex, 'rounded-frayme')).toBe(false);
  });

  it('unset ColorPicker byte-identical (bg/borderColor/radiusValue null vs absent)', () => {
    const a = draw('ColorPicker', { value: '#123456', bg: null, borderColor: null, radiusValue: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('ColorPicker', { value: '#123456' });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ── PhoneInput mutedColor placeholder ────────────────────────────── */

describe('PhoneInput mutedColor routes to the number placeholder', () => {
  it('mutedColor → --fr-phone-muted var + placeholder reader class; token dropped', () => {
    const { container } = draw('PhoneInput', { placeholder: '7700 900000', mutedColor: '#778899' });
    const wrap = container.querySelector('[style*="--fr-phone-muted"]')!;
    expect(wrap).not.toBeNull();
    const tel = container.querySelector('input[type="tel"]')!;
    expect(has(tel, 'placeholder:text-[color:var(--fr-phone-muted,var(--color-muted-foreground))]')).toBe(true);
    expect(has(tel, 'placeholder:text-muted-foreground')).toBe(false);
  });

  it('unset PhoneInput byte-identical (mutedColor/radiusValue null vs absent)', () => {
    const a = draw('PhoneInput', { placeholder: 'x', mutedColor: null, radiusValue: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('PhoneInput', { placeholder: 'x' });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ── radiusValue family-wide (Time/Qty/Phone/OTP) ─────────────────── */

describe('radiusValue channel across the specialized/numeric inputs', () => {
  const CASES: Array<{ type: string; props: Record<string, unknown>; cssVar: string; readerCls: string }> = [
    { type: 'TimePicker', props: { value: '09:30', radiusValue: '12px' }, cssVar: '--fr-time-radius', readerCls: '[border-radius:var(--fr-time-radius,var(--fr-time-radius-default,var(--radius-frayme)))]' },
    { type: 'QuantityStepper', props: { value: 1, radiusValue: '12px' }, cssVar: '--fr-qty-radius', readerCls: '[border-radius:var(--fr-qty-radius,var(--fr-qty-radius-default,var(--radius-frayme)))]' },
    { type: 'PhoneInput', props: { placeholder: 'x', radiusValue: '12px' }, cssVar: '--fr-phone-radius', readerCls: '[border-radius:var(--fr-phone-radius,var(--fr-phone-radius-default,var(--radius-frayme)))]' },
    { type: 'OTPInput', props: { length: 4, radiusValue: '12px' }, cssVar: '--fr-otp-radius', readerCls: '[border-radius:var(--fr-otp-radius,var(--fr-otp-radius-default,var(--radius-frayme)))]' },
  ];
  for (const c of CASES) {
    it(`${c.type}: radiusValue → ${c.cssVar} var; the box reads the exact→default chain`, () => {
      const { container } = draw(c.type, c.props);
      // The var lands on the wrap element that ALSO carries the reader class
      // (OTPInput: each box). Find any element that reads the exact→default chain.
      const readers = [...container.querySelectorAll('*')].filter((el) => el.classList.contains(c.readerCls));
      expect(readers.length, `${c.type} reader class present`).toBeGreaterThan(0);
      // and the exact var is emitted somewhere in the subtree
      const carrier = container.querySelector(`[style*="${c.cssVar}"]`);
      expect(carrier, `${c.type} carrying ${c.cssVar}`).not.toBeNull();
    });
  }
});

/* ── OTPInput label + grouping ────────────────────────────────────── */

describe('OTPInput optional label + group separator', () => {
  it('label renders above the segment row; boxes still present', () => {
    const { container } = draw('OTPInput', { length: 6, label: 'Verification code' });
    expect(container.textContent).toContain('Verification code');
    expect(container.querySelectorAll('input').length).toBe(6);
  });

  it('groupSize:3 inserts a separator (default "-") between the two groups of a 6-box row', () => {
    const { container } = draw('OTPInput', { length: 6, groupSize: 3 });
    // exactly one separator between box 3 and box 4
    const seps = [...container.querySelectorAll('span[aria-hidden="true"]')].filter((s) => s.textContent === '-');
    expect(seps.length).toBe(1);
    expect(container.querySelectorAll('input').length).toBe(6);
  });

  it('groupSize with a custom separator glyph', () => {
    const { container } = draw('OTPInput', { length: 4, groupSize: 2, separator: '·' });
    const seps = [...container.querySelectorAll('span[aria-hidden="true"]')].filter((s) => s.textContent === '·');
    expect(seps.length).toBe(1);
  });

  it('no label + no groupSize renders byte-identical to a bare OTP (unset)', () => {
    const a = draw('OTPInput', { length: 6, label: null, groupSize: null, separator: null, color: null, radiusValue: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('OTPInput', { length: 6 });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ── Rating hover-preview fill ────────────────────────────────────── */

describe('Rating hover previews the fill up to the hovered icon', () => {
  it('hovering icon 3 fills icons 1..3 in the accent (preview); mouseleave reverts to value', () => {
    const { container } = draw('Rating', { value: 1, max: 5 });
    const buttons = [...container.querySelectorAll('button')];
    // resting: only 1 filled overlay (value=1), using the resting fill color
    const overlaysFor = () => [...container.querySelectorAll('.overflow-hidden')];
    expect(overlaysFor().length).toBe(1);
    // hover the 3rd star → 3 filled overlays in the accent-preview color
    fireEvent.mouseEnter(buttons[2]);
    const previewOverlays = overlaysFor();
    expect(previewOverlays.length).toBe(3);
    expect(previewOverlays.every((o) => has(o, '[color:var(--fr-rating-accent,var(--fr-accent))]'))).toBe(true);
    // mouseleave → revert to value=1
    fireEvent.mouseLeave(buttons[2]);
    expect(overlaysFor().length).toBe(1);
  });
});

/* ── Rating empty/base icon color (mutedColor) ────────────────────── */

describe('Rating empty-icon color routes through mutedColor', () => {
  it('empty base layer reads --fr-rating-muted; hardcoded text-muted-foreground gone', () => {
    const { container } = draw('Rating', { value: 2, max: 5, mutedColor: '#556677' });
    const root = container.querySelector('[style*="--fr-rating-muted"]')!;
    expect(root).not.toBeNull();
    const emptyLayers = [...container.querySelectorAll('span')].filter((s) =>
      s.classList.contains('[color:var(--fr-rating-muted,var(--color-muted-foreground))]'),
    );
    expect(emptyLayers.length).toBeGreaterThan(0);
    expect(container.querySelector('.text-muted-foreground')).toBeNull();
  });

  it('mutedColor:null byte-identical to absent', () => {
    const a = draw('Rating', { value: 2, max: 5, mutedColor: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Rating', { value: 2, max: 5 });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ── RangeSlider showValues readout ───────────────────────────────── */

describe('RangeSlider showValues renders a lo–hi band readout', () => {
  it('showValues renders "lo – hi" with prefix/suffix', () => {
    const { container } = draw('RangeSlider', { min: 0, max: 1000, valueMin: 200, valueMax: 800, showValues: true, valuePrefix: '£' });
    expect(container.textContent).toContain('£200 – £800');
  });

  it('showValues unset → no readout (byte-identical to absent)', () => {
    const a = draw('RangeSlider', { min: 0, max: 100, valueMin: 20, valueMax: 80, showValues: null, valuePrefix: null, valueSuffix: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('RangeSlider', { min: 0, max: 100, valueMin: 20, valueMax: 80 });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ── NumberInput + OTPInput entered-value text color ───────────────── */

describe('entered-value color channel (NumberInput + OTPInput)', () => {
  it('NumberInput color → --fr-number-fg var + reader; text-inherit gone from the field', () => {
    const { container } = draw('NumberInput', { value: 5, color: '#ddeeff' });
    const wrap = container.querySelector('[style*="--fr-number-fg"]')!;
    expect(wrap).not.toBeNull();
    const input = container.querySelector('input[type="number"]')!;
    expect(has(input, '[color:var(--fr-number-fg,inherit)]')).toBe(true);
    expect(has(input, 'text-inherit')).toBe(false);
  });

  it('OTPInput color → --fr-otp-fg reader on each box; text-foreground gone', () => {
    const { container } = draw('OTPInput', { length: 4, color: '#ddeeff' });
    const box = container.querySelector('input')!;
    expect(has(box, '[color:var(--fr-otp-fg,var(--color-foreground))]')).toBe(true);
    expect(has(box, 'text-foreground')).toBe(false);
  });

  it('NumberInput color:null byte-identical to absent', () => {
    const a = draw('NumberInput', { value: 5, color: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('NumberInput', { value: 5 });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ── Calendar today marker ────────────────────────────────────────── */

describe('Calendar marks today with an inset ring', () => {
  const RING = 'ring-1';
  it('the cell matching `today` gets the inset ring; a non-today cell does not', () => {
    const { container } = draw('Calendar', { month: '2026-06', today: '2026-06-15' });
    const rings = [...container.querySelectorAll('[role="gridcell"]')].filter((c) => c.classList.contains(RING));
    expect(rings.length).toBe(1);
    expect(rings[0].textContent).toContain('15');
  });

  it('selected wins over today when a day is both (no today ring on the selected cell)', () => {
    const { container } = draw('Calendar', { month: '2026-06', today: '2026-06-15', value: '2026-06-15' });
    const rings = [...container.querySelectorAll('[role="gridcell"]')].filter((c) => c.classList.contains(RING));
    expect(rings.length).toBe(0);
  });

  it('today:null byte-identical to absent', () => {
    const a = draw('Calendar', { month: '2026-06', today: null });
    const html = a.container.innerHTML;
    a.unmount();
    const b = draw('Calendar', { month: '2026-06' });
    expect(html).toBe(b.container.innerHTML);
  });
});

/* ── Calendar event-dot overflow (+N micro-indicator) ─────────────── */

describe('Calendar shows an overflow dot beyond 3 events', () => {
  it('a day with 5 events renders 3 tone dots + 1 muted overflow dot (4 total)', () => {
    const evts = Array.from({ length: 5 }, (_, i) => ({ date: '2026-06-10', label: `E${i}` }));
    const { container } = draw('Calendar', { month: '2026-06', events: evts });
    // find the cell for the 10th
    const cell = [...container.querySelectorAll('[role="gridcell"]')].find((c) => c.getAttribute('aria-label')?.includes('5 events'))!;
    expect(cell).not.toBeNull();
    const dotRow = cell.querySelector('[aria-hidden="true"]')!;
    expect(dotRow.querySelectorAll('span').length).toBe(4);
    // the last (overflow) dot reads the muted var
    const spans = [...dotRow.querySelectorAll('span')];
    expect(has(spans[3], '[background:var(--fr-cal-muted,var(--color-muted-foreground))]')).toBe(true);
  });

  it('a day with exactly 3 events shows 3 dots (no overflow) — byte-identical to before', () => {
    const evts = Array.from({ length: 3 }, (_, i) => ({ date: '2026-06-10', label: `E${i}` }));
    const { container } = draw('Calendar', { month: '2026-06', events: evts });
    const cell = [...container.querySelectorAll('[role="gridcell"]')].find((c) => c.getAttribute('aria-label')?.includes('3 events'))!;
    const dotRow = cell.querySelector('[aria-hidden="true"]')!;
    expect(dotRow.querySelectorAll('span').length).toBe(3);
  });
});
