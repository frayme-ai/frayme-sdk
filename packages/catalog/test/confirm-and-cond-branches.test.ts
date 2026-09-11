/**
 * Two holes in the validation surface.
 *
 * (1)  Binding-level `confirm` was COMPLETELY unvalidated. The element schema does
 *     not model `on` at all, so a missing message, a bogus variant, a typo'd key
 *     and a wrong-typed value all validated clean and rendered an empty or
 *     default-labelled modal. It is the guard on the most consequential controls a
 *     spec has, and it was the least-checked thing in the file.
 *
 * (2)  The prop gate skipped EVERY dynamic value, which made it — the only prop gate
 *     that fires, since the rest is enum-scoped — trivially dodgeable: wrapping a
 *     bad value in a binding walked straight past it. A bare {$state} genuinely
 *     cannot be checked, its value arrives at runtime. A {$cond} carries its
 *     outcomes as LITERALS, and those are exactly what the prop will take.
 *
 * Both gates were measured against existing specs before landing: zero hits.
 * They close the holes for what comes next without churning what exists.
 */
import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const check = (el: any): string[] => {
  const r = validateSpec(
    // `/x` is seeded: the fixtures below read it through a binding, and an
    // unseeded read that nothing writes is its own finding
    // (validate/structure.ts). This file is about the confirm + $cond gates.
    { root: 'b', elements: { b: el }, state: { x: 'primary' }, actions: { del: { kind: 'agent' } } } as any,
    { resolution: true } as any,
  );
  return (r.errors ?? []).filter((e: string) => /confirm|variant/i.test(e));
};
const btn = (extra: any): any => ({ type: 'Button', props: { label: 'Delete' }, on: { press: { action: 'del', ...extra } } });

describe('binding-level confirm is validated', () => {
  it('catches a typo\'d key', () => {
    // The reason this gate exists. `confirmText` renders a default-labelled modal
    // and says nothing about it — the author believes they set the button copy.
    const errs = check(btn({ confirm: { message: 'Sure?', confirmText: 'Yes' } }));
    expect(errs.join()).toContain('confirmText: not a confirm field');
  });

  it('catches a variant outside default|danger', () => {
    // "destructive" is a documented recurring habit in this codebase.
    expect(check(btn({ confirm: { message: 'Sure?', variant: 'destructive' } })).join()).toContain('not one of default|danger');
  });

  it('requires a message', () => {
    // The runtime falls back to the button label for a title, so a title is
    // optional. The MESSAGE carries the consequence, which is the whole job — an
    // empty body asks the reader to approve something unnamed.
    expect(check(btn({ confirm: { title: 'Delete?' } })).join()).toContain('confirm.message: required');
  });

  it('catches a wrong-typed confirm', () => {
    expect(check(btn({ confirm: 12345 })).join()).toContain('must be an object, a message string, or true');
  });

  it('catches a confirm on a BUILT-IN mutation, where the guard silently never fires', () => {
    // json-render's execute() handles setState/push/pop and returns BEFORE it reads
    // `confirm`. A "Clear all" that LOOKS guarded is worse than one that visibly is
    // not — the reader is told there is a safety net that does not exist.
    const el = { type: 'Button', props: { label: 'Clear' }, on: { press: { action: 'setState', params: { statePath: '/x' }, confirm: { message: 'Sure?' } } } };
    expect(check(el).join()).toContain('runs it BEFORE the confirm gate');
  });

  it('passes the object form', () => {
    expect(check(btn({ confirm: { message: 'This cannot be undone.', variant: 'danger' } }))).toEqual([]);
  });

  it('passes the string shorthand — the runtime coerces it to a message', () => {
    expect(check(btn({ confirm: 'This cannot be undone.' }))).toEqual([]);
  });
});

describe('a binding is not automatically uncheckable', () => {
  const v = (variant: unknown): any => ({ type: 'Button', props: { label: 'Go', variant } });

  it('catches a bogus enum hiding in a $cond branch', () => {
    const errs = check(v({ $cond: { $state: '/x' }, $then: 'destructive', $else: 'primary' }));
    expect(errs.join()).toContain('a $cond branch resolves to this literal');
  });

  it('passes a $cond whose branches are both valid', () => {
    expect(check(v({ $cond: { $state: '/x' }, $then: 'danger', $else: 'primary' }))).toEqual([]);
  });

  it('still passes a bare $state — its value genuinely arrives at runtime', () => {
    // The skip this gate narrows is CORRECT here. Flagging it would make every
    // legitimately dynamic prop an error.
    expect(check(v({ $state: '/x' }))).toEqual([]);
  });

  it('still catches a plain literal, as it always did', () => {
    expect(check(v('destructive')).join()).toContain('is not a valid Button.variant');
  });
});
