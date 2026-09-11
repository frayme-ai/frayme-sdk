import { describe, expect, it } from 'vitest';

import { validateActionWiring } from '../src/validate/index.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const spec = (elements: any, actions?: any): any => ({
  root: 'r',
  elements,
  ...(actions ? { actions } : {}),
});

describe('validateActionWiring (action subset)', () => {
  it('passes a control wired to a declared spec.actions handler', () => {
    const r = validateActionWiring(
      spec(
        { b: { type: 'Button', props: {}, on: { commit: { action: 'doIt' } } } },
        { doIt: { kind: 'agent' } },
      ),
    );
    expect(r.valid).toBe(true);
  });

  it('flags a non-builtin action with no spec.actions handler (referential integrity)', () => {
    const r = validateActionWiring(
      spec({ b: { type: 'Button', props: {}, on: { commit: { action: 'ghost' } } } }),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/ghost.*no spec\.actions/);
  });

  it('exempts builtin state actions (setState/pushState/removeState)', () => {
    const r = validateActionWiring(
      spec({ b: { type: 'Button', props: {}, on: { commit: { action: 'setState' } } } }),
    );
    expect(r.valid).toBe(true);
  });

  it('canonicalizes a legacy on-key (press → commit ∈ Button events)', () => {
    const r = validateActionWiring(
      spec(
        { b: { type: 'Button', props: {}, on: { press: { action: 'doIt' } } } },
        { doIt: { kind: 'agent' } },
      ),
    );
    expect(r.valid).toBe(true);
  });

  it('flags an event key the component does not advertise', () => {
    const r = validateActionWiring(
      spec(
        { b: { type: 'Button', props: {}, on: { sort: { action: 'doIt' } } } },
        { doIt: { kind: 'agent' } },
      ),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/sort.*is not an event of Button/);
  });

  it('flags a phantom action in the ARRAY form of on (json-render allows on[event][])', () => {
    const r = validateActionWiring(
      spec({ b: { type: 'Button', props: {}, on: { commit: [{ action: 'phantom' }] } } }),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/phantom.*no spec\.actions/);
  });

  it('passes a valid action in the array form', () => {
    const r = validateActionWiring(
      spec(
        { b: { type: 'Button', props: {}, on: { commit: [{ action: 'doIt' }] } } },
        { doIt: { kind: 'agent' } },
      ),
    );
    expect(r.valid).toBe(true);
  });

  it('does NOT let a prototype-chain name bypass referential integrity', () => {
    for (const name of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
      const r = validateActionWiring(
        spec({ b: { type: 'Button', props: {}, on: { commit: { action: name } } } }),
      );
      expect(r.valid, `"${name}" must NOT pass with empty spec.actions`).toBe(false);
    }
  });

  it('skips the event-vocab check for display components with no events[]', () => {
    const r = validateActionWiring(
      spec(
        { h: { type: 'Heading', props: {}, on: { commit: { action: 'doIt' } } } },
        { doIt: { kind: 'agent' } },
      ),
    );
    expect(r.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// In-flight feedback: builtins on the commit verb are
// contract-invisible — `commit: [setState /submitting, namedAction]` resolves
// to the named action; a builtin-only binding has no contract surface.
// ---------------------------------------------------------------------------
import { validateActionContract } from '../src/validate/index.js';

describe('validateActionContract vs feedback arrays', () => {
  const feedbackSpec = (commit: unknown) =>
    ({
      root: 'page',
      state: { submitting: false, note: '' },
      actions: { postComment: { kind: 'agent' } },
      elements: {
        page: { type: 'Stack', props: {}, children: ['box', 'btn'] },
        box: {
          type: 'Textarea',
          props: {
            label: 'Comment',
            value: { $bindState: '/note' },
            disabled: { $state: '/submitting' },
          },
        },
        btn: {
          type: 'Button',
          props: { label: 'Comment', loading: { $state: '/submitting' } },
          on: { commit },
        },
      },
    }) as never;

  it('setState-first commit array resolves to the named action', () => {
    const r = validateActionContract(
      feedbackSpec([
        { action: 'setState', params: { statePath: '/submitting', value: true } },
        { action: 'postComment', params: { note: { $state: '/note' } } },
      ]),
      [
        {
          name: 'postComment',
          required: true,
          params: { type: 'object', properties: { note: { type: 'string' } } },
        },
      ] as never,
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('builtin-only commit binding has no contract surface', () => {
    const r = validateActionContract(
      feedbackSpec({ action: 'setState', params: { statePath: '/submitting', value: true } }),
      [{ name: 'postComment', required: false }] as never,
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
});
