/**
 * `checks` / `validateOn`, wired.
 *
 * The catalog has described this surface to the model in full detail for as long as
 * it has existed, and NOTHING in the runtime read it. The model believed the
 * documentation and emitted `checks` across many generated specs; every one of those
 * screens shipped a validation system that did precisely nothing, and shipped it as
 * a success, because the fallback only fires on validation FAILURE.
 *
 * The design decision these tests encode: ENABLED-THEN-VALIDATE. A submit button
 * stays pressable, and pressing an incomplete form reveals errors on the fields that
 * are wrong. The alternative — disabled-until-valid — cannot tell the reader WHY it
 * is disabled, is skipped by some screen readers, and forces them to reverse-engineer
 * a form to find the one empty box.
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { runChecks, isEmptyValue } from '../src/react/field-validation.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const REQUIRED = [{ type: 'required', message: 'Give us a name' }];

const form = (fields: Record<string, any>, order: string[]): Spec =>
  ({
    root: 'f',
    elements: {
      f: { type: 'Form', props: {}, children: [...order, 'go'] },
      ...fields,
      go: { type: 'Button', props: { label: 'Submit', submit: true }, on: { press: { action: 'save', confirm: false } } },
    },
    state: {},
    actions: { save: { kind: 'agent' } },
  }) as unknown as Spec;

const draw = (spec: Spec, onAction = vi.fn()) => ({
  ...render(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onAction} />),
  onAction,
});
const submit = (c: HTMLElement) => fireEvent.click([...c.querySelectorAll('button')].find((b) => b.textContent === 'Submit')!);

describe('runChecks — the rules themselves', () => {
  it('required fails on empty and passes on a value', () => {
    expect(runChecks(REQUIRED, '')).toBe('Give us a name');
    expect(runChecks(REQUIRED, 'Ada')).toBeNull();
  });

  it('treats 0 as an ANSWER, not as empty', () => {
    // The trap the binding language falls into: bare truthiness reads 0 as falsy, so
    // a valid zero — a quantity, a threshold, a price of nothing — fails `required`
    // and the reader is told to fill in a field they already filled in.
    expect(isEmptyValue(0)).toBe(false);
    expect(runChecks(REQUIRED, 0)).toBeNull();
  });

  it('treats an empty array as empty, which truthiness does not', () => {
    // The same trap pointing the other way: [] is truthy, so an untouched
    // multi-select would sail through a required gate.
    expect(isEmptyValue([])).toBe(true);
    expect(runChecks(REQUIRED, [])).toBe('Give us a name');
    expect(runChecks(REQUIRED, ['a'])).toBeNull();
  });

  it('required on a boolean control means CHECKED', () => {
    // `false` is a legitimate value in general, but an unticked consent box is not a
    // completed field. The checked state is passed separately for exactly this.
    expect(runChecks(REQUIRED, false, false)).toBe('Give us a name');
    expect(runChecks(REQUIRED, true, true)).toBeNull();
  });

  it('runs minLength, pattern and email', () => {
    expect(runChecks([{ type: 'minLength', message: 'Too short', args: { min: 3 } }], 'ab')).toBe('Too short');
    expect(runChecks([{ type: 'pattern', message: 'Digits only', args: { pattern: '^[0-9]+$' } }], 'abc')).toBe('Digits only');
    expect(runChecks([{ type: 'email', message: 'Not an email' }], 'nope')).toBe('Not an email');
    expect(runChecks([{ type: 'email', message: 'Not an email' }], 'a@b.co')).toBeNull();
  });

  it('every non-required rule is vacuous on an empty field', () => {
    // Only `required` decides whether emptiness is allowed. A blank OPTIONAL field
    // reporting "too short" is noise the reader cannot act on.
    expect(runChecks([{ type: 'minLength', message: 'Too short', args: { min: 3 } }], '')).toBeNull();
    expect(runChecks([{ type: 'email', message: 'Not an email' }], '')).toBeNull();
  });

  it('passes an UNKNOWN rule type instead of failing the field', () => {
    // The catalog's list is open-ended ("required · minLength · … · …"). Blocking a
    // form on a rule this runtime has never heard of is a dead end for the reader.
    expect(runChecks([{ type: 'iban', message: 'Bad IBAN' }], 'whatever')).toBeNull();
  });

  it('survives an unparseable pattern rather than blaming the reader', () => {
    expect(runChecks([{ type: 'pattern', message: 'Bad', args: { pattern: '([' } }], 'x')).toBeNull();
  });
});

describe('the form gate — enabled, then validated', () => {
  const withChecks = (checks: unknown) =>
    form({ nm: { type: 'Input', props: { label: 'Name', name: 'nm', checks } } }, ['nm']);

  it('blocks the action and shows the message when a check fails', () => {
    const { container, onAction } = draw(withChecks(REQUIRED));
    expect(container.textContent).not.toContain('Give us a name');
    submit(container);
    expect(container.textContent, 'the message is revealed').toContain('Give us a name');
    expect(onAction, 'and the action did NOT fire').not.toHaveBeenCalled();
  });

  it('lets a valid form through', () => {
    const { container, onAction } = draw(withChecks(REQUIRED));
    fireEvent.change(container.querySelector('input')!, { target: { value: 'Ada' } });
    submit(container);
    expect(container.textContent).not.toContain('Give us a name');
    expect(onAction).toHaveBeenCalled();
  });

  it('the button is NOT disabled while the form is incomplete', () => {
    // The design decision, asserted. A dead control cannot say why it is dead.
    const { container } = draw(withChecks(REQUIRED));
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Submit')!;
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('reveals EVERY failing field, not just the first', () => {
    // The whole advantage over native reportValidity(), which shows one browser
    // tooltip on the first invalid field and stops.
    const spec = form(
      {
        a: { type: 'Input', props: { label: 'A', name: 'a', checks: [{ type: 'required', message: 'A is needed' }] } },
        b: { type: 'Input', props: { label: 'B', name: 'b', checks: [{ type: 'required', message: 'B is needed' }] } },
      },
      ['a', 'b'],
    );
    const { container } = draw(spec);
    submit(container);
    expect(container.textContent).toContain('A is needed');
    expect(container.textContent).toContain('B is needed');
  });

  it('honours plain `required:true`, with no checks array', () => {
    // Generated specs overwhelmingly use `required` and never `checks`. It has to mean
    // something on its own or the wiring helps almost nobody.
    const spec = form({ nm: { type: 'Input', props: { label: 'Name', name: 'nm', required: true } } }, ['nm']);
    const { container, onAction } = draw(spec);
    submit(container);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('lets an AUTHORED errorText win over a computed pass', () => {
    // A spec that states an error is reporting something this runtime cannot know —
    // a server rejection, a cross-field rule. A local pass must not erase it.
    const spec = form(
      { nm: { type: 'Input', props: { label: 'Name', name: 'nm', value: 'Ada', errorText: 'That name is taken' } } },
      ['nm'],
    );
    const { container } = draw(spec);
    expect(container.textContent).toContain('That name is taken');
  });
});

describe('validateOn timing', () => {
  const timed = (validateOn: string) =>
    form({ nm: { type: 'Input', props: { label: 'Name', name: 'nm', checks: REQUIRED, validateOn } } }, ['nm']);

  it('change — reveals live, without waiting for blur or submit', () => {
    const { container } = draw(timed('change'));
    expect(container.textContent).toContain('Give us a name');
  });

  it('blur — silent until the field is left', () => {
    const { container } = draw(timed('blur'));
    expect(container.textContent, 'not before').not.toContain('Give us a name');
    fireEvent.blur(container.querySelector('input')!);
    expect(container.textContent, 'after leaving it').toContain('Give us a name');
  });

  it('submit — silent through blur, revealed on submit', () => {
    const { container } = draw(timed('submit'));
    fireEvent.blur(container.querySelector('input')!);
    expect(container.textContent, 'blur does not arm submit timing').not.toContain('Give us a name');
    submit(container);
    expect(container.textContent).toContain('Give us a name');
  });

  it('a submit reveals a blur-timed field the reader never focused', () => {
    // Otherwise the one field they skipped is the one that stays silent — which is
    // precisely the field they need told about.
    const { container } = draw(timed('blur'));
    submit(container);
    expect(container.textContent).toContain('Give us a name');
  });
});
