/**
 * FORMFIELD HELP/ERROR DEDUPE: the same sentence must not print twice.
 *
 * Observed in a live compose (capture gen_e621aca6): the model wrote
 *   FormField { label: 'Full name', helpText: S }
 *     Input   { label: 'Full name', labelPlacement: 'hidden', helpText: S }
 * FormField printed S and the Input printed S again, directly underneath. The
 * renderer already absorbs the repeated LABEL (labelPlacement hidden); this
 * absorbs the repeated help line the same way.
 *
 * The rule is deliberately narrow. A control inside a FormField drops ONLY a
 * line that is identical, in kind and text, to the line the FormField itself
 * prints. Different text prints both. A help line never swallows an error line.
 * Outside a FormField nothing changes at all.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const S = "As you'd like it printed on your paperwork.";

const draw = (spec: Record<string, unknown>) =>
  render(<FraymeRenderer spec={spec as unknown as Spec} mode="progressive" />).container;

/** FormField wrapping ONE control. */
const wrapped = (ff: Record<string, unknown>, type: string, control: Record<string, unknown>) =>
  draw({
    root: 'ff',
    state: {},
    elements: {
      ff: { type: 'FormField', props: { label: 'Full name', ...ff }, children: ['ctl'] },
      ctl: { type, props: control },
    },
  });

/** How many leaf elements print exactly `text`. */
const printed = (root: Element, text: string): number =>
  [...root.querySelectorAll('span')].filter((el) => el.children.length === 0 && el.textContent === text).length;

/* Every renderer that draws a help line (forms.tsx HelpLine call sites). */
const CONTROLS: Array<[string, Record<string, unknown>]> = [
  ['Input', { label: 'Full name', name: 'fullName', labelPlacement: 'hidden' }],
  ['Textarea', { label: 'Notes', name: 'notes', labelPlacement: 'hidden' }],
  ['Select', { label: 'Plan', name: 'plan', options: ['a', 'b'], labelPlacement: 'hidden' }],
  ['Checkbox', { label: 'Agree', name: 'agree' }],
  ['Radio', { label: 'Size', name: 'size', options: ['s', 'm'] }],
  ['Switch', { label: 'Alerts', name: 'alerts' }],
  ['Slider', { label: 'Budget', name: 'budget', value: 5 }],
];

describe('FormField + control repeating the same help text', () => {
  it('the observed spec prints the sentence ONCE (was twice)', () => {
    const c = wrapped({ required: true, helpText: S }, 'Input', {
      label: 'Full name',
      name: 'fullName',
      labelPlacement: 'hidden',
      required: true,
      helpText: S,
    });
    expect(printed(c, S)).toBe(1);
    // The one that survives is the FormField's, which the group describes itself by.
    const group = c.querySelector('[role="group"]')!;
    const descId = group.getAttribute('aria-describedby');
    expect(descId).not.toBeNull();
    const desc = c.querySelector(`#${descId}`);
    expect(desc).not.toBeNull();
    expect(desc!.textContent).toBe(S);
  });

  it.each(CONTROLS)('%s: identical help inside a FormField prints once', (type, props) => {
    const c = wrapped({ helpText: S }, type, { ...props, helpText: S });
    expect(printed(c, S)).toBe(1);
  });

  it.each(CONTROLS)('%s: different help inside a FormField prints both', (type, props) => {
    const c = wrapped({ helpText: S }, type, { ...props, helpText: 'Use your legal name.' });
    expect(printed(c, S)).toBe(1);
    expect(printed(c, 'Use your legal name.')).toBe(1);
  });

  it.each(CONTROLS)('%s: a bare control (no FormField) still prints its help', (type, props) => {
    const c = draw({ root: 'ctl', state: {}, elements: { ctl: { type, props: { ...props, helpText: S } } } });
    expect(printed(c, S)).toBe(1);
  });

  it('whitespace-only differences count as identical', () => {
    const c = wrapped({ helpText: S }, 'Input', { label: 'Full name', name: 'fullName', helpText: `  ${S} ` });
    expect(printed(c, S)).toBe(1);
    expect(c.textContent).not.toContain(`  ${S} `);
  });

  it('a malformed non-string help value never matches and never throws', () => {
    const c = wrapped({ helpText: 42 }, 'Input', { label: 'Full name', name: 'fullName', helpText: 42 });
    expect(printed(c, '42')).toBe(2);
  });

  it('a FormField with no help line does not suppress the control help', () => {
    const c = wrapped({}, 'Input', { label: 'Full name', name: 'fullName', helpText: S });
    expect(printed(c, S)).toBe(1);
    expect(c.querySelector('[role="group"]')!.hasAttribute('aria-describedby')).toBe(false);
  });

  it('only descendants of the FormField are deduped; a sibling control outside it keeps its line', () => {
    const c = draw({
      root: 'stack',
      state: {},
      elements: {
        stack: { type: 'Stack', props: {}, children: ['ff', 'loose'] },
        ff: { type: 'FormField', props: { label: 'Full name', helpText: S }, children: ['inner'] },
        inner: { type: 'Input', props: { label: 'Full name', name: 'fullName', labelPlacement: 'hidden', helpText: S } },
        loose: { type: 'Input', props: { label: 'Nickname', name: 'nick', helpText: S } },
      },
    });
    // FormField's line + the loose Input's line; the inner duplicate is gone.
    expect(printed(c, S)).toBe(2);
    const loose = c.querySelector('input[name="nick"]')!.closest('div.flex.flex-col')!;
    expect(printed(loose, S)).toBe(1);
  });
});

describe('FormField + control repeating the same error text', () => {
  const E = 'Enter your full name.';

  it('identical errorText prints once, and the control is still aria-invalid', () => {
    const c = wrapped({ errorText: E }, 'Input', { label: 'Full name', name: 'fullName', errorText: E });
    expect(printed(c, E)).toBe(1);
    expect(c.querySelectorAll('[role="alert"]').length).toBe(1);
    expect(c.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('different errorText prints both', () => {
    const c = wrapped({ errorText: E }, 'Input', { label: 'Full name', name: 'fullName', errorText: 'Too short.' });
    expect(printed(c, E)).toBe(1);
    expect(printed(c, 'Too short.')).toBe(1);
    expect(c.querySelectorAll('[role="alert"]').length).toBe(2);
  });

  it('a help line never swallows an error line with the same words', () => {
    const c = wrapped({ helpText: E }, 'Input', { label: 'Full name', name: 'fullName', errorText: E });
    expect(printed(c, E)).toBe(2);
    expect(c.querySelectorAll('[role="alert"]').length).toBe(1);
  });

  it('compares against what the FormField PRINTS: its error hides its help, so the control help still shows', () => {
    const c = wrapped({ helpText: S, errorText: E }, 'Input', { label: 'Full name', name: 'fullName', helpText: S });
    expect(printed(c, E)).toBe(1);
    expect(printed(c, S)).toBe(1);
  });

  it('a suppressed control error does not fall back to printing the control help', () => {
    const c = wrapped({ errorText: E }, 'Input', { label: 'Full name', name: 'fullName', helpText: S, errorText: E });
    expect(printed(c, E)).toBe(1);
    expect(printed(c, S)).toBe(0);
  });
});

describe('outside a FormField nothing changes', () => {
  it.each(CONTROLS)('%s: bare help line markup is exactly the pre-change markup', (type, props) => {
    const c = draw({ root: 'ctl', state: {}, elements: { ctl: { type, props: { ...props, helpText: S } } } });
    const line = [...c.querySelectorAll('span')].find((el) => el.textContent === S && el.children.length === 0)!;
    expect(line.outerHTML).toBe(
      `<span class="text-[0.8125rem] leading-snug [color:var(--fr-field-muted,var(--color-muted-foreground))]">${S}</span>`,
    );
  });

  it.each(CONTROLS)('%s: bare error line markup is exactly the pre-change markup', (type, props) => {
    const c = draw({ root: 'ctl', state: {}, elements: { ctl: { type, props: { ...props, errorText: 'Required.' } } } });
    const line = c.querySelector('[role="alert"]')!;
    expect(line.outerHTML).toBe('<span class="text-[0.8125rem] leading-snug text-danger" role="alert">Required.</span>');
  });
});

/* THE LABEL, ONE FIELD OVER. Models repeat the FormField's caption on the control
 * inside it, and when they forget labelPlacement hidden it prints twice. In the
 * training data this is the COMMON case: 14 of 529 FormField to control pairs
 * repeat the label visibly (Cause > Select Cause, Notes > Textarea Notes). The
 * control keeps an identical label for screen readers only, so its accessible name
 * survives; only the visible copy goes. */
describe('a control inside a FormField does not print its caption twice', () => {
  /** Innermost elements whose own text is exactly `text`. */
  const occurrences = (root: Element, text: string): Element[] =>
    [...root.querySelectorAll('*')].filter(
      (el) => el.textContent?.trim() === text && ![...el.children].some((c) => c.textContent?.trim() === text),
    );
  const visible = (root: Element, text: string) => occurrences(root, text).filter((el) => !el.closest('.sr-only')).length;
  const screenReaderOnly = (root: Element, text: string) => occurrences(root, text).filter((el) => el.closest('.sr-only')).length;

  for (const type of ['Input', 'Textarea', 'Select']) {
    it(`${type}: an identical label prints once, and stays as the accessible name`, () => {
      const extra = type === 'Select' ? { options: [{ label: 'A', value: 'a' }] } : {};
      const root = wrapped({}, type, { label: 'Full name', name: 'n', ...extra });
      expect(visible(root, 'Full name')).toBe(1);
      expect(screenReaderOnly(root, 'Full name')).toBe(1);
    });
  }

  it('a different label on the control still prints both', () => {
    const root = wrapped({}, 'Input', { label: 'Given name', name: 'n' });
    expect(visible(root, 'Full name')).toBe(1);
    expect(visible(root, 'Given name')).toBe(1);
  });

  it('whitespace does not defeat the match', () => {
    const root = wrapped({}, 'Input', { label: '  Full name ', name: 'n' });
    expect(visible(root, 'Full name')).toBe(1);
  });

  it('an explicit labelPlacement still wins, as the chrome promises', () => {
    const root = wrapped({}, 'Input', { label: 'Full name', name: 'n', labelPlacement: 'top' });
    expect(visible(root, 'Full name')).toBe(2);
  });

  it('a bare control outside any FormField prints its label as before', () => {
    const root = draw({ root: 'i', state: {}, elements: { i: { type: 'Input', props: { label: 'Full name', name: 'n' } } } });
    expect(visible(root, 'Full name')).toBe(1);
    expect(screenReaderOnly(root, 'Full name')).toBe(0);
  });
});
