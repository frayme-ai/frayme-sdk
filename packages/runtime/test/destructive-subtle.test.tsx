/**
 * Destructive surfaces are QUIET — red, but not in the eyes. A destructive
 * PRESSABLE surface reads as red text + a red glyph behind a HAIRLINE red
 * outline, with NO resting fill; the red wash appears only on hover. It never
 * reads as a tinted slab, and never as a saturated red slab (a resting fill +
 * full-strength border, repeated per table row, reads too loud).
 *
 * The one treatment (registry/actions.tsx Button `danger`/`tone:critical`,
 * misc-extended IconButton, ai-flow Confirmation, confirm-modal, DataTable
 * row-delete):
 *   `border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)]`
 *   + `text-[color:var(--color-danger)]`
 *   + `hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]`
 *   and NO resting background.
 * Pressed-selection variants (Toggle/ButtonGroup `critical`) carry the same intent
 * as a red border + red label with the fill neutralised — no red wash there.
 * This file pins the treatment and — just as importantly — the BOUNDARY: solid
 * colour is still correct for small non-pressable INDICATORS (rails, dots,
 * markers) and for an explicit `variant:"solid"` opt-in. Those must not drift
 * into the destructive treatment, so a regression in either direction fails here.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

/** Same, with seeded spec.state — Toast only renders while its openPath is truthy. */
const drawWithState = (type: string, props: Record<string, unknown>, state: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type, props } }, state } as unknown as Spec}
      mode="progressive"
    />,
  );

const has = (el: Element, token: string): boolean => el.classList.contains(token);

/** The 12% tint classes, still used by small non-pressable INDICATORS (e.g. a
 *  Stepper critical step marker) — NOT the destructive-control treatment anymore. */
const TINT = (token: string): string => `[background:color-mix(in_srgb,var(--color-${token})_12%,transparent)]`;
const TINT_BORDER = (token: string): string => `border-[color:var(--color-${token})]`;
const TINT_TEXT = (token: string): string => `text-[color:var(--color-${token})]`;

/** The quiet-red destructive-control treatment (no resting fill, hairline
 *  border, red label, hover-only wash). */
const HAIRLINE_BORDER = 'border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)]';
const HOVER_WASH = 'hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]';

/** Asserts the full quiet-red danger treatment AND the absence of BOTH the old
 *  saturated slab and the superseded 12%-fill/full-border tint. */
const expectSubtleDanger = (el: Element): void => {
  expect(has(el, HAIRLINE_BORDER), 'danger hairline border').toBe(true);
  expect(has(el, TINT_TEXT('danger')), 'danger label').toBe(true);
  expect(has(el, HOVER_WASH), 'danger hover-only wash').toBe(true);
  expect(has(el, TINT('danger')), 'no resting fill').toBe(false);
  expect(has(el, TINT_BORDER('danger')), 'no full-strength border').toBe(false);
  expect(has(el, 'bg-danger'), 'no saturated slab').toBe(false);
  expect(has(el, 'text-danger-foreground'), 'no on-slab label').toBe(false);
};

/* ── IconButton — the toolbar/table-row destructive ───────────────────────── */

describe('IconButton — destructive is tinted, primary is neutral', () => {
  const base = { icon: 'trash', label: 'Delete row' };

  it('variant:danger → tint + red border + red glyph, never bg-danger', () => {
    const { container } = draw('IconButton', { ...base, variant: 'danger' });
    expectSubtleDanger(container.querySelector('button')!);
  });

  it('tone:critical → the same treatment as variant:danger', () => {
    const { container } = draw('IconButton', { ...base, tone: 'critical' });
    expectSubtleDanger(container.querySelector('button')!);
  });

  it('variant:primary → Button parity (neutral high-contrast), not the brand slab', () => {
    const { container } = draw('IconButton', { ...base, variant: 'primary' });
    const btn = container.querySelector('button')!;
    expect(has(btn, 'bg-foreground')).toBe(true);
    expect(has(btn, 'text-card')).toBe(true);
    expect(has(btn, 'bg-primary')).toBe(false);
  });

  it('no resting shadow on any variant (Button parity)', () => {
    for (const variant of ['primary', 'danger', 'secondary', 'ghost', 'outline']) {
      const view = draw('IconButton', { ...base, variant });
      expect(has(view.container.querySelector('button')!, 'shadow-sm'), variant).toBe(false);
      view.unmount();
    }
  });
});

/* ── ButtonGroup — the pressed segment ────────────────────────────────────── */

describe('ButtonGroup — pressed segment', () => {
  const buttons = [
    { label: 'Keep', value: 'a' },
    { label: 'Purge', value: 'b' },
  ];
  const pressedOf = (container: Element): HTMLElement =>
    [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-pressed') === 'true')!;

  it('tone:critical → the pressed segment has NO fill, only a red border + red label', () => {
    const { container } = draw('ButtonGroup', { buttons, selected: 'b', tone: 'critical' });
    const pressed = pressedOf(container);
    // quiet-red: the pressed segment carries the selection with a red border +
    // red label and NO fill. bg-transparent is load-bearing — it neutralises the
    // default `solid` variant's `aria-pressed:bg-foreground`, which would otherwise
    // bleed a near-black slab through once the old red tint was removed.
    expect(has(pressed, 'aria-pressed:bg-transparent')).toBe(true);
    expect(has(pressed, 'aria-pressed:text-danger')).toBe(true);
    expect(has(pressed, 'aria-pressed:bg-danger/10')).toBe(false);
    expect(has(pressed, 'aria-pressed:bg-danger')).toBe(false);
    expect(has(pressed, 'aria-pressed:bg-foreground')).toBe(false); // no near-black bleed
    expect(has(pressed, 'aria-pressed:text-danger-foreground')).toBe(false);
    // the border still routes through the var channel, never a border-{tone} utility
    expect(has(pressed, 'aria-pressed:[--fr-bgroup-border:var(--color-danger)]')).toBe(true);
  });

  it('variant:solid (default) → the pressed fill is neutral high-contrast, not the brand fill', () => {
    const { container } = draw('ButtonGroup', { buttons, selected: 'a' });
    const pressed = pressedOf(container);
    expect(has(pressed, 'aria-pressed:bg-foreground')).toBe(true);
    expect(has(pressed, 'aria-pressed:text-card')).toBe(true);
    expect(has(pressed, 'aria-pressed:bg-primary')).toBe(false);
    expect(has(pressed, 'aria-pressed:text-primary-foreground')).toBe(false);
  });
});

/* ── Confirmation — the catalog's loudest destructive gate ────────────────── */

describe('Confirmation — the confirm button', () => {
  it('tone:critical → tinted, so "Delete 3 files?" is not a red slab', () => {
    const { container } = draw('Confirmation', {
      message: 'Delete 3 files from the project?',
      confirmLabel: 'Delete',
      tone: 'critical',
    });
    const confirm = container.querySelectorAll('button')[0];
    expect(confirm.textContent).toBe('Delete');
    expectSubtleDanger(confirm);
    expect(has(confirm, 'shadow-sm')).toBe(false);
  });

  it('tone unset (neutral) → the neutral high-contrast primary, not bg-primary', () => {
    const { container } = draw('Confirmation', { message: 'Proceed?' });
    const confirm = container.querySelectorAll('button')[0];
    expect(has(confirm, 'bg-foreground')).toBe(true);
    expect(has(confirm, 'text-card')).toBe(true);
    expect(has(confirm, 'bg-primary')).toBe(false);
  });
});

/* ── Stepper — a failed step marker ───────────────────────────────────────── */

describe('Stepper — the critical step marker', () => {
  it('tone:critical → tinted disc with a red ring, keeping the border-2 footprint', () => {
    const { container } = draw('Stepper', {
      steps: [{ label: 'Account' }, { label: 'Payment', tone: 'critical' }, { label: 'Done' }],
      current: 2,
    });
    const markers = [...container.querySelectorAll('span[aria-hidden]')].filter((s) => has(s, 'rounded-full'));
    const critical = markers.find((m) => has(m, TINT('danger')));
    expect(critical, 'critical marker').toBeTruthy();
    expect(has(critical!, TINT_BORDER('danger'))).toBe(true);
    expect(has(critical!, '[color:var(--color-danger)]')).toBe(true);
    // border-2 matches the current/future markers, so the circle keeps its size
    expect(has(critical!, 'border-2')).toBe(true);
    expect(has(critical!, 'bg-danger')).toBe(false);
  });
});

/* ── Link rendered AS a button — Button parity ────────────────────────────── */

describe('Link variant:button — matches Button, not the old px-4/py-2 brand slab', () => {
  it('neutral high-contrast fill, Button md footprint, no resting shadow', () => {
    const { container } = draw('Link', { label: 'Open dashboard', href: 'https://example.com', variant: 'button' });
    const a = container.querySelector('a')!;
    expect(has(a, 'bg-foreground')).toBe(true);
    expect(has(a, 'text-card')).toBe(true);
    expect(has(a, 'bg-primary')).toBe(false);
    expect(has(a, 'text-primary-foreground')).toBe(false);
    // Button's md size step: px-3.5 py-1.5 / 0.875rem with the paired leading ratio
    expect(has(a, 'px-3.5')).toBe(true);
    expect(has(a, 'py-1.5')).toBe(true);
    expect(has(a, 'px-4')).toBe(false);
    expect(has(a, 'py-2')).toBe(false);
    expect(has(a, '[--fr-link-fs-default:0.875rem]')).toBe(true);
    expect(has(a, 'leading-[calc(1.25/0.875)]')).toBe(true);
    expect(has(a, 'shadow-sm')).toBe(false);
  });

  it('an explicit size:lg still wins — only the md/default footprint moved', () => {
    const { container } = draw('Link', { label: 'Open', href: 'https://example.com', variant: 'button', size: 'lg' });
    const a = container.querySelector('a')!;
    expect(has(a, '[--fr-link-fs-default:1.125rem]')).toBe(true);
    expect(has(a, '[--fr-link-fs-default:0.875rem]')).toBe(false);
  });

  it('a text link is untouched by the button compound (still the 1rem md step)', () => {
    const { container } = draw('Link', { label: 'Read more', href: 'https://example.com' });
    const a = container.querySelector('a')!;
    expect(has(a, '[--fr-link-fs-default:1rem]')).toBe(true);
    expect(has(a, 'bg-foreground')).toBe(false);
  });
});

/* ── THE BOUNDARY — small non-pressable indicators stay SOLID ─────────────── */

describe('the deliberate boundary: indicators keep the solid colour', () => {
  it('NotificationCenter critical rail + dot stay bg-danger (a 2px rail cannot be a tint)', () => {
    const { container } = draw('NotificationCenter', {
      items: [{ id: 'n1', title: 'Disk quota exceeded', tone: 'critical', unread: true }],
    });
    const solid = [...container.querySelectorAll('span[aria-hidden="true"]')].filter((s) => has(s, 'bg-danger'));
    // one rail (w-0.5, full height) + one unread dot
    expect(solid.length, 'rail + unread dot both solid').toBe(2);
    const rail = solid.find((s) => has(s, 'w-0.5'))!;
    expect(rail, 'the tone rail').toBeTruthy();
    expect(has(rail, TINT('danger')), 'the rail must NOT be tinted').toBe(false);
  });

  it('Toast variant:"solid" is an explicit opt-in and keeps the saturated fill', () => {
    const { container } = drawWithState(
      'Toast',
      { title: 'Deploy failed', openPath: 'open', tone: 'critical', variant: 'solid' },
      { open: true },
    );
    const toast = container.querySelector('.bg-danger');
    expect(toast, 'solid critical toast keeps bg-danger').toBeTruthy();
  });
  /* Regression: a pressed
   * critical Toggle is a PRESSABLE selected-state. It used the arbitrary-PROPERTY form
   * ([background:…]) rather than a bg-* utility, so it never matched the `bg-danger`
   * grep the first pass was driven by — a pressed Toggle was still a full red slab.
   * Under the quiet-red law it now carries a HAIRLINE red border (30% mix) + red label
   * over the base neutral pressed surface, with NO red fill (neither the saturated slab
   * nor the superseded 12% wash). */
  it('Toggle pressed critical is a red hairline border + red label, not a fill', () => {
    const html = draw('Toggle', { label: 'Mute', tone: 'critical', pressed: true }).container.innerHTML;
    expect(html).toContain('color-mix(in_srgb,var(--color-danger)_30%,transparent)'); // hairline border
    expect(html).not.toContain('color-mix(in_srgb,var(--color-danger)_12%,transparent)'); // no resting red fill
    expect(html).not.toContain('[background:var(--color-danger)]'); // no saturated slab
  });

  it('Pagination selected page uses the neutral high-contrast fill', () => {
    const html = draw('Pagination', { page: 2, totalPages: 5 }).container.innerHTML;
    expect(html).toContain('var(--color-foreground)');
    expect(html).not.toContain('var(--color-primary)');
  });

  it('semantic tones are tinted CONSISTENTLY, not just critical', () => {
    // critical alone being tinted left one recipe speaking two visual languages.
    for (const tone of ['success', 'warning', 'info'] as const) {
      const html = draw('IconButton', { icon: 'check', label: tone, tone }).container.innerHTML;
      expect(html, `IconButton tone:${tone}`).toContain('color-mix');
      expect(html, `IconButton tone:${tone} must not be a slab`).not.toContain(`bg-${tone}`);
    }
  });
});
