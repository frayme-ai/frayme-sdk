import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import {
  declaredRequiredParams,
  isMissingRequired,
  missingRequiredFor,
} from '../src/react/required-guard.js';

/**
 * THE ACTION LIFECYCLE — four defects found by driving the rendered controls.
 *
 * Every case here was MEASURED against the unfixed runtime before it was written,
 * because four of the six claims in the brief did not survive that measurement:
 *   · a Form with `submit: true` DID dispatch, with a confirm modal, inside a
 *     Dialog and inside a Drawer — the way declared-commit Forms are normally
 *     authored. What it never did was LATCH.
 *   · `cancelLabel` was ALREADY honoured as an alias of `denyLabel`.
 *   · the Confirmation's commit DID reach the handler through the normal path.
 * What did reproduce is pinned below; each case carries its negative control,
 * because a guard that fires on everything is not a guard.
 */

const settle = () => new Promise((r) => setTimeout(r, 40));
const modal = () => document.querySelector('[data-fr-confirm]');
const notice = () => document.querySelector('[data-fr-required-notice]');
const buttons = (label: string) =>
  [...document.querySelectorAll('button')].filter((b) => b.textContent?.includes(label)) as HTMLButtonElement[];
const btn = (label: string) => buttons(label)[0];
const accept = async () => {
  const m = modal();
  if (m) fireEvent.click([...m.querySelectorAll('button')].at(-1)!);
  await settle();
};
const decline = async () => {
  const m = modal();
  if (m) fireEvent.click([...m.querySelectorAll('button')][0]!);
  await settle();
};

/* ── a declared REQUIRED param that resolves empty blocks the press ── */

/** One Button whose declared action requires `field`, bound to `/field`. */
const requiredSpec = (
  state: Record<string, unknown>,
  decl: Record<string, unknown>,
  binding: Record<string, unknown> = { field: { $state: '/field' } },
  extra: Record<string, unknown> = {},
): Spec =>
  ({
    root: 'page',
    state,
    actions: { doIt: { kind: 'agent', ...decl } },
    elements: {
      page: { type: 'Stack', props: {}, children: ['inp', 'go'] },
      inp: { type: 'Input', props: { label: 'Field', name: 'field', value: { $bindState: '/field' } } },
      go: {
        type: 'Button',
        props: { label: 'Send' },
        on: { commit: { action: 'doIt', params: binding, ...extra } },
      },
    },
  }) as unknown as Spec;

describe('a required param that resolves empty stops the press', () => {
  // EVERY empty type the brief names, each with its own case: they take different
  // branches (typeof string / Array.isArray / the `false` clause / absent key), and
  // one passing case says nothing about the other four.
  const EMPTY: Array<[string, unknown]> = [
    ['empty string', ''],
    ['whitespace-only string', '   '],
    ['empty array', []],
    ['false', false],
    ['null', null],
  ];
  for (const [name, value] of EMPTY) {
    it(`blocks on ${name} — no confirm modal, no dispatch`, async () => {
      const onDynamicAction = vi.fn();
      render(
        <FraymeRenderer
          spec={requiredSpec({ field: value }, { requiredItems: ['field'] })}
          mode="progressive"
          onDynamicAction={onDynamicAction}
        />,
      );
      fireEvent.click(btn('Send'));
      await settle();
      expect(modal(), 'a blocked press must not open the confirm').toBeNull();
      await accept();
      expect(onDynamicAction).not.toHaveBeenCalled();
    });
  }

  it('blocks on an UNWRITTEN $state path (the key is not in state at all)', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={requiredSpec({ other: 'x' }, { requiredItems: ['field'] })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btn('Send'));
    await settle();
    expect(modal()).toBeNull();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('blocks when the required param is ABSENT from the binding (the applyPermissions case)', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={requiredSpec({}, { requiredItems: ['matrix'] }, { label: 'Apply changes' })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btn('Send'));
    await settle();
    expect(onDynamicAction).not.toHaveBeenCalled();
    // Nothing on the screen binds `matrix`, so there is nothing to mark or focus —
    // the notice is the only thing that distinguishes a refusal from a dead button.
    expect(notice()?.textContent).toContain('matrix');
  });

  it('marks and FOCUSES the bound input, and clears the mark on the next edit', async () => {
    const { container } = render(
      <FraymeRenderer
        spec={requiredSpec({ field: '' }, { requiredItems: ['field'] })}
        mode="progressive"
        onDynamicAction={vi.fn()}
      />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBeNull();
    fireEvent.click(btn('Send'));
    await settle();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
    fireEvent.input(input, { target: { value: 'signed' } });
    expect(input.getAttribute('aria-invalid'), 'a stale error is a lie').toBeNull();
  });

  it('reads the JSON-Schema declaration shape too (params.required)', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={requiredSpec(
          { field: '' },
          { params: { type: 'object', properties: { field: {} }, required: ['field'] } },
        )}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btn('Send'));
    await settle();
    await accept();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  /* ── negative controls ── */

  it('NEGATIVE: a filled required param presses straight through', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={requiredSpec({ field: 'signed' }, { requiredItems: ['field'] })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btn('Send'));
    await settle();
    expect(modal()).not.toBeNull();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
  });

  it('NEGATIVE: 0 is an ANSWER, not an empty — a required quantity of zero goes', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={requiredSpec({ field: 0 }, { requiredItems: ['field'] })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btn('Send'));
    await settle();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('NEGATIVE: an empty param that is NOT declared required goes', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={requiredSpec({ field: '' }, { requiredItems: ['other'] }, { field: { $state: '/field' }, other: 'x' })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btn('Send'));
    await settle();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('NEGATIVE: a `live` binding is never gated — it fires on every change', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={requiredSpec({ field: '' }, { requiredItems: ['field'] }, { field: { $state: '/field' } }, { live: true })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btn('Send'));
    await settle();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('NEGATIVE: a BUILTIN never gates — "Add row" stays repeatable', async () => {
    const spec = {
      root: 'page',
      state: { field: '', rows: [] },
      actions: { push: { requiredItems: ['field'] } },
      elements: {
        page: { type: 'Stack', props: {}, children: ['go'] },
        go: {
          type: 'Button',
          props: { label: 'Add row' },
          on: { commit: { action: 'push', params: { path: '/rows', value: 1, field: { $state: '/field' } } } },
        },
      },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={vi.fn()} />);
    fireEvent.click(btn('Add row'));
    await settle();
    expect(notice()).toBeNull();
    expect(container.querySelector('[data-fr-required-notice]')).toBeNull();
  });

  it('NEGATIVE: a $item expression is not readable here and is never blocked on', () => {
    const spec = { actions: { doIt: { requiredItems: ['id'] } } };
    const binding = { action: 'doIt', params: { id: { $item: 'id' } } };
    expect(missingRequiredFor(spec, binding, undefined, () => undefined)).toEqual([]);
  });

  it('the resolution table itself (unit) — both declaration shapes, both empties', () => {
    expect(declaredRequiredParams({ actions: { a: { requiredItems: ['x'] } } }, 'a')).toEqual(['x']);
    expect(
      declaredRequiredParams({ actions: { a: { params: { type: 'object', properties: { x: {} }, required: ['x'] } } } }, 'a'),
    ).toEqual(['x']);
    expect(declaredRequiredParams({ actions: { a: { params: { x: { required: true }, y: {} } } } }, 'a')).toEqual(['x']);
    // A param legitimately NAMED `properties` must not be read as a schema wrapper.
    expect(declaredRequiredParams({ actions: { a: { params: { properties: { required: true } } } } }, 'a')).toEqual([
      'properties',
    ]);
    expect(declaredRequiredParams({ actions: { a: {} } }, 'a')).toEqual([]);
    expect([undefined, null, '', '  ', [], false, NaN].map(isMissingRequired)).toEqual([
      true, true, true, true, true, true, true,
    ]);
    expect([0, 'x', ['a'], true, {}].map(isMissingRequired)).toEqual([false, false, false, false, false]);
    // The Form's collected field values satisfy a param of the same name.
    expect(
      missingRequiredFor({ actions: { a: { requiredItems: ['note'] } } }, { action: 'a' }, { fields: { note: 'hi' } }, () => undefined),
    ).toEqual([]);
  });
});

/* ── the Form's declared commit, and the control that fires it ────── */

const formSpec = (opts: {
  action?: string;
  button?: Record<string, unknown>;
  buttonOn?: unknown;
  textarea?: boolean;
}): Spec =>
  ({
    root: 'page',
    state: { note: 'x', step: 'a' },
    actions: { escalate: { kind: 'agent' } },
    elements: {
      page: { type: 'Stack', props: {}, children: ['form'] },
      form: {
        type: 'Form',
        props: {},
        children: ['f1', 'submit'],
        on: { commit: { action: opts.action ?? 'escalate', params: { note: { $state: '/note' } } } },
      },
      f1: opts.textarea
        ? { type: 'Textarea', props: { label: 'Note', name: 'note' } }
        : { type: 'Input', props: { label: 'Note', name: 'note' } },
      submit: { type: 'Button', props: { label: 'Escalate', ...(opts.button ?? {}) }, ...(opts.buttonOn ? { on: opts.buttonOn } : {}) },
    },
  }) as unknown as Spec;

/* THE FORM IS A DEFAULT CARRIER under the dynamic-action gate (core/dynamic-gate.ts).
   Its declared commit is fired from the FORM element — the submit Button,
   bindings-less or submit:true, only triggers it — so the intrinsic fid is the
   Form's; and because a Form's commit fires solely from a submit gesture, the
   Form is in the default list and every render below runs under the DEFAULT gate.
   (The first cut left Form out and this case had to widen `dynamicActionTypes`
   to stay green — which masked the most common submit path going silent. Pinned
   from both sides in dynamic-gate.test.tsx (j).) */

describe("the Form's commit reaches its submit control, and dies with it", () => {
  it('submit:true — dispatches AND latches the button that fired it', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={formSpec({ button: { submit: true } })} mode="progressive" onDynamicAction={onDynamicAction} />);
    expect(btn('Escalate').disabled).toBe(false);
    fireEvent.click(btn('Escalate'));
    await settle();
    expect(modal(), 'the form commit still meets the confirm gate').not.toBeNull();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    // THE defect this row is really about: the fields froze, the button did not.
    expect(btn('Escalate').disabled).toBe(true);
  });

  it('a bindings-less Button inside the Form now submits it (was wired to nothing)', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={formSpec({})} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(btn('Escalate'));
    await settle();
    expect(modal()).not.toBeNull();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(btn('Escalate').disabled).toBe(true);
  });

  it('fires ONCE, not twice — the native submit and the context are not both taken', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={formSpec({ button: { submit: true } })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(btn('Escalate'));
    await settle();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('Enter in a text field commits the Form', async () => {
    const onDynamicAction = vi.fn();
    const { container } = render(<FraymeRenderer spec={formSpec({})} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.keyDown(container.querySelector('input')!, { key: 'Enter' });
    await settle();
    expect(modal()).not.toBeNull();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  /* ── negative controls ── */

  it('NEGATIVE: Enter in a TEXTAREA is a newline, not a submit', async () => {
    const onDynamicAction = vi.fn();
    const { container } = render(
      <FraymeRenderer spec={formSpec({ textarea: true })} mode="progressive" onDynamicAction={onDynamicAction} />,
    );
    fireEvent.keyDown(container.querySelector('textarea')!, { key: 'Enter' });
    await settle();
    expect(modal()).toBeNull();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('NEGATIVE: a Button with its OWN binding does its own job, not the form\'s', async () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={formSpec({ buttonOn: { commit: { action: 'setState', params: { statePath: '/step', value: 'b' } } } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(btn('Escalate'));
    await settle();
    await accept();
    expect(onDynamicAction, 'a Back/Cancel button must not send the form').not.toHaveBeenCalled();
    expect(btn('Escalate').disabled, 'and a builtin never latches').toBe(false);
  });

  it('NEGATIVE: a declined confirm leaves the submit control live', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={formSpec({ button: { submit: true } })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(btn('Escalate'));
    await settle();
    await decline();
    expect(onDynamicAction).not.toHaveBeenCalled();
    expect(btn('Escalate').disabled).toBe(false);
  });

  it('NEGATIVE: a Form whose commit is a BUILTIN never latches its submit', async () => {
    render(
      <FraymeRenderer
        spec={formSpec({ action: 'setState', button: { submit: true } })}
        mode="progressive"
        onDynamicAction={vi.fn()}
      />,
    );
    fireEvent.click(btn('Escalate'));
    await settle();
    await accept();
    expect(btn('Escalate').disabled).toBe(false);
  });
});

/* ── the inline Confirmation is an approval card, not wallpaper ───── */

const confirmationSpec = (props: Record<string, unknown>, state: Record<string, unknown> = {}, action = 'cancelSession'): Spec =>
  ({
    root: 'page',
    state,
    actions: { cancelSession: { kind: 'agent' } },
    elements: {
      page: { type: 'Stack', props: {}, children: ['c'] },
      c: {
        type: 'Confirmation',
        props: { message: 'Cancel this session?', confirmLabel: 'Cancel session', ...props },
        on: { commit: { action }, dismiss: { action } },
      },
    },
  }) as unknown as Spec;

/* Confirmation is a default carrier under the dynamic-action gate — its verdict
   buttons ARE the component (core/dynamic-gate.ts), so the latch tests below run
   under the default gate, exactly as they did before it existed. */

describe('the inline Confirmation', () => {
  it('a bound openPath of FALSE hides it — no live buttons at first paint', () => {
    const { container } = render(
      <FraymeRenderer spec={confirmationSpec({ openPath: '/confirmOpen' }, { confirmOpen: false })} mode="progressive" onDynamicAction={vi.fn()} />,
    );
    expect(container.textContent).not.toContain('Cancel this session?');
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('NEGATIVE: openPath TRUE shows it; no openPath at all shows it', () => {
    const a = render(
      <FraymeRenderer spec={confirmationSpec({ openPath: '/confirmOpen' }, { confirmOpen: true })} mode="progressive" onDynamicAction={vi.fn()} />,
    );
    expect(a.container.textContent).toContain('Cancel this session?');
    a.unmount();
    const b = render(<FraymeRenderer spec={confirmationSpec({})} mode="progressive" onDynamicAction={vi.fn()} />);
    expect(b.container.textContent).toContain('Cancel this session?');
  });

  it('NEGATIVE: an openPath naming a key the spec never seeded is UNSPECIFIED, not closed', () => {
    const { container } = render(
      <FraymeRenderer spec={confirmationSpec({ openPath: '/neverSeeded' }, { other: 1 })} mode="progressive" onDynamicAction={vi.fn()} />,
    );
    expect(container.textContent).toContain('Cancel this session?');
  });

  it('honours cancelLabel as an alias of denyLabel (regression pin — this already held)', () => {
    const { container } = render(
      <FraymeRenderer spec={confirmationSpec({ cancelLabel: 'Keep session' })} mode="progressive" onDynamicAction={vi.fn()} />,
    );
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Cancel session', 'Keep session']);
  });

  it('latches BOTH buttons once the gate is answered — a verdict is given once', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={confirmationSpec({ cancelLabel: 'Keep session' })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(btn('Cancel session'));
    await settle();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(btn('Cancel session').disabled).toBe(true);
    expect(btn('Keep session').disabled).toBe(true);
  });

  it('NEGATIVE: declining the confirm leaves the gate answerable', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={confirmationSpec({ cancelLabel: 'Keep session' })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(btn('Cancel session'));
    await settle();
    await decline();
    expect(onDynamicAction).not.toHaveBeenCalled();
    expect(btn('Cancel session').disabled).toBe(false);
  });

  it('NEGATIVE: a builtin-only Confirmation never latches', async () => {
    render(<FraymeRenderer spec={confirmationSpec({ cancelLabel: 'Keep' }, { x: 1 }, 'setState')} mode="progressive" onDynamicAction={vi.fn()} />);
    fireEvent.click(btn('Cancel session'));
    await settle();
    await accept();
    expect(btn('Cancel session').disabled).toBe(false);
  });
});

/* ── the latch is per ROW, not per element definition ─────────────── */

const repeatSpec = (): Spec =>
  ({
    root: 'list',
    state: { alerts: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] },
    actions: { ack: { kind: 'agent' } },
    elements: {
      list: { type: 'Stack', props: {}, repeat: { statePath: '/alerts', key: 'id' }, children: ['row'] },
      row: { type: 'Button', props: { label: 'Acknowledge' }, on: { commit: { action: 'ack', params: { id: { $item: 'id' } } } } },
    },
  }) as unknown as Spec;

describe('acknowledging one alert must not grey the other three', () => {
  it('latches only the row that fired', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={repeatSpec()} mode="progressive" onDynamicAction={onDynamicAction} />);
    expect(buttons('Acknowledge')).toHaveLength(4);
    fireEvent.click(buttons('Acknowledge')[0]);
    await settle();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(buttons('Acknowledge').map((b) => b.disabled)).toEqual([true, false, false, false]);
  });

  it('and the next row still answers independently', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={repeatSpec()} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(buttons('Acknowledge')[0]);
    await settle();
    await accept();
    fireEvent.click(buttons('Acknowledge')[2]);
    await settle();
    await accept();
    expect(onDynamicAction).toHaveBeenCalledTimes(2);
    expect(buttons('Acknowledge').map((b) => b.disabled)).toEqual([true, false, true, false]);
  });

  it('NEGATIVE: outside a repeat the latch is unchanged — one button, one death', async () => {
    const spec = {
      root: 'page',
      state: {},
      actions: { ack: { kind: 'agent' } },
      elements: {
        page: { type: 'Stack', props: {}, children: ['go'] },
        go: { type: 'Button', props: { label: 'Acknowledge' }, on: { commit: { action: 'ack' } } },
      },
    } as unknown as Spec;
    render(<FraymeRenderer spec={spec} mode="progressive" onDynamicAction={vi.fn()} />);
    fireEvent.click(btn('Acknowledge'));
    await settle();
    await accept();
    expect(btn('Acknowledge').disabled).toBe(true);
  });

  it('NEGATIVE: declining in a repeat row latches nothing at all', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={repeatSpec()} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(buttons('Acknowledge')[1]);
    await settle();
    await decline();
    expect(onDynamicAction).not.toHaveBeenCalled();
    expect(buttons('Acknowledge').map((b) => b.disabled)).toEqual([false, false, false, false]);
  });
});
