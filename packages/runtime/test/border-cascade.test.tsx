/**
 * The tone-vs-borderColor cascade collision class.
 *
 * A borderColor value channel is INERT whenever a component also bakes a
 * `border-{tone}` (or `border-border`) UTILITY on the same element, because the
 * bare arbitrary-property reader `[border-color:var(…)]` does NOT tw-merge-dedupe
 * a border-color utility (they are different groups) — the utility survives and
 * wins by stylesheet order / specificity. The fix is either the GROUP form
 * `border-[color:var(…)]` (which DOES dedupe the utility and wins when added last)
 * or routing the tone through the SAME var (a var-setter, never a border util).
 *
 * These tests are the EMPIRICAL arbiter: they run the real `cn`/tailwind-merge and
 * assert (a) the reader/var is present, (b) the competing border UTILITY is gone,
 * and (c) the unset default is byte-identical. jsdom cannot apply the compiled
 * stylesheet, so the className (post-merge) is the ground truth for who wins.
 *
 * Covers: Tag, Badge (latent), ButtonGroup (pressed state), CTA, and the
 * Separator vertical-label fix.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);
const rootOf = (c: HTMLElement): HTMLElement =>
  c.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
const styleOf = (el: Element): string => el.getAttribute('style') ?? '';

describe('Tag borderColor overrides an outline tone border', () => {
  it('outline + tone:success + borderColor → group-form reader present, border-success DEDUPED away, var set', () => {
    const { container } = draw('Tag', { label: 'Tag', variant: 'outline', tone: 'success', borderColor: '#ff00aa' });
    const el = rootOf(container);
    expect(el.classList.contains('border-[color:var(--fr-tag-border,var(--color-border))]')).toBe(true);
    expect(el.classList.contains('border-success')).toBe(false); // the whole point
    expect(styleOf(el)).toContain('--fr-tag-border');
  });

  it('outline + tone:success WITHOUT borderColor keeps the tone border (byte-identical unset)', () => {
    const withNull = draw('Tag', { label: 'Tag', variant: 'outline', tone: 'success', borderColor: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Tag', { label: 'Tag', variant: 'outline', tone: 'success' });
    expect(html).toBe(without.container.innerHTML);
    // and the tone border utility IS present when borderColor is absent
    expect(rootOf(without.container).classList.contains('border-success')).toBe(true);
  });
});

describe('Badge borderColor overrides the outline border-border', () => {
  it('outline + borderColor → group-form reader present, border-border DEDUPED away, var set', () => {
    const { container } = draw('Badge', { text: 'New', variant: 'outline', borderColor: '#ff00aa' });
    const el = rootOf(container);
    expect(el.classList.contains('border-[color:var(--fr-badge-border,var(--color-border))]')).toBe(true);
    expect(el.classList.contains('border-border')).toBe(false);
    expect(styleOf(el)).toContain('--fr-badge-border');
  });

  it('outline WITHOUT borderColor keeps border-border (byte-identical unset)', () => {
    const withNull = draw('Badge', { text: 'New', variant: 'outline', borderColor: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Badge', { text: 'New', variant: 'outline' });
    expect(html).toBe(without.container.innerHTML);
    expect(rootOf(without.container).classList.contains('border-border')).toBe(true);
  });
});

describe('ButtonGroup pressed border routes through the var', () => {
  const buttons = [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ];

  it('solid + tone:success + selected: pressed item carries the tone VAR-SETTER, no border-{tone}/border-primary util', () => {
    const { container } = draw('ButtonGroup', { buttons, selected: 'a', variant: 'solid', tone: 'success', borderColor: '#ff00aa' });
    const group = container.querySelector('[role="group"]')!;
    expect(styleOf(group)).toContain('--fr-bgroup-border'); // borderColor rides the group, cascades to items
    const pressed = [...group.querySelectorAll('button')].find((b) => b.getAttribute('aria-pressed') === 'true')!;
    expect(pressed).toBeTruthy();
    // CRITICAL (the cascade gap): borderColor must ride the pressed BUTTON itself,
    // not just the group. The button's own `aria-pressed:[--fr-bgroup-border:tone]` class sets
    // the var element-level and beats an INHERITED group var — so the inline var must be on the
    // same element to win. A className-only check missed this; assert the element-level var.
    expect(styleOf(pressed)).toContain('--fr-bgroup-border');
    // tone flows through the var-setter (dedupes variant.solid's setter by cva order)
    expect(pressed.classList.contains('aria-pressed:[--fr-bgroup-border:var(--color-success)]')).toBe(true);
    // NO competing border-color utility survives on the pressed segment
    expect(pressed.classList.contains('aria-pressed:border-success')).toBe(false);
    expect(pressed.classList.contains('aria-pressed:border-primary')).toBe(false);
    expect(pressed.classList.contains('border-success')).toBe(false);
    expect(pressed.classList.contains('border-primary')).toBe(false);
  });

  it('tone:success overrides variant.solid pressed border (var-setter dedup, tone wins by cva order)', () => {
    const { container } = draw('ButtonGroup', { buttons, selected: 'a', variant: 'solid', tone: 'success' });
    const pressed = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-pressed') === 'true')!;
    expect(pressed.classList.contains('aria-pressed:[--fr-bgroup-border:var(--color-success)]')).toBe(true);
    // the variant.solid setter was deduped away (same property, later wins). Now:
    // variant.solid sets --color-foreground (the neutral high-contrast pressed fill),
    // not --color-primary — assert the CURRENT setter is gone or this loses its teeth.
    expect(pressed.classList.contains('aria-pressed:[--fr-bgroup-border:var(--color-foreground)]')).toBe(false);
    expect(pressed.classList.contains('aria-pressed:[--fr-bgroup-border:var(--color-primary)]')).toBe(false);
  });
});

describe('CTA card borderColor overrides the tone border', () => {
  it('card + tone:info + borderColor → --fr-cta-border inline var, NO border-info utility', () => {
    const { container } = draw('CTA', { title: 'Upgrade', variant: 'card', tone: 'info', borderColor: '#ff00aa' });
    const el = rootOf(container);
    expect(styleOf(el)).toContain('--fr-cta-border');
    expect(el.className).not.toContain('border-info'); // the utility is gone catalog-wide for CTA
    // the base reader is the sole border-color source
    expect(el.classList.contains('[border-color:var(--fr-cta-border,var(--color-border))]')).toBe(true);
  });

  it('card + tone:info WITHOUT borderColor routes the tone through the var (no border-info util)', () => {
    const { container } = draw('CTA', { title: 'Upgrade', variant: 'card', tone: 'info' });
    const el = rootOf(container);
    expect(el.classList.contains('[--fr-cta-border:var(--color-info)]')).toBe(true);
    expect(el.className).not.toContain('border-info');
  });

  it('card + tone:neutral (default) is byte-identical with borderColor:null vs absent', () => {
    const withNull = draw('CTA', { title: 'Upgrade', variant: 'card', tone: 'neutral', borderColor: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('CTA', { title: 'Upgrade', variant: 'card', tone: 'neutral' });
    expect(html).toBe(without.container.innerHTML);
  });
});

describe('Alert & Toast solid+tone borderColor already correct', () => {
  // Both already use the GROUP form `border-[color:…]` added LAST, which
  // tw-merge dedupes against the solid `border-{tone}` compound → borderColor
  // wins. These lock that in against a future regression.
  it('Alert solid + tone:success + borderColor → border-success deduped, group-form reader wins', () => {
    const { container } = draw('Alert', { title: 'Saved', variant: 'solid', tone: 'success', borderColor: '#ff00aa' });
    const el = container.querySelector('[role="status"]') as HTMLElement;
    expect(el.classList.contains('border-[color:var(--fr-alert-border,var(--color-border))]')).toBe(true);
    expect(el.classList.contains('border-success')).toBe(false);
    expect(styleOf(el)).toContain('--fr-alert-border');
  });

  it('Toast solid + tone:success + borderColor → border-success deduped, group-form reader wins', () => {
    const { container } = draw('Toast', { message: 'Saved', variant: 'solid', tone: 'success', borderColor: '#ff00aa' });
    const el = rootOf(container);
    expect(el.classList.contains('border-[color:var(--fr-toast-border,var(--color-border))]')).toBe(true);
    expect(el.classList.contains('border-success')).toBe(false);
    expect(styleOf(el)).toContain('--fr-toast-border');
  });
});

describe('Separator renders its label in vertical orientation', () => {
  it('vertical + label renders the label text (was silently dropped)', () => {
    const { container } = draw('Separator', { orientation: 'vertical', label: 'OR' });
    const sep = container.querySelector('[role="separator"]')!;
    expect(sep).toBeTruthy();
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.textContent).toContain('OR'); // the bug: this was empty before
  });

  it('horizontal + label still renders (byte-identical to a horizontal labelled divider)', () => {
    const { container } = draw('Separator', { orientation: 'horizontal', label: 'OR' });
    expect(container.querySelector('[role="separator"]')!.textContent).toContain('OR');
  });

  it('plain vertical (no label) is byte-identical with label:null vs absent', () => {
    const withNull = draw('Separator', { orientation: 'vertical', label: null });
    const html = withNull.container.innerHTML;
    withNull.unmount();
    const without = draw('Separator', { orientation: 'vertical' });
    expect(html).toBe(without.container.innerHTML);
  });
});
