import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const buttonSpec = (action: string): Spec =>
  ({
    root: 'b1',
    elements: {
      b1: {
        type: 'Button',
        props: { label: 'Go', variant: 'primary', disabled: false },
        on: { press: { action, params: { source: 'pricing' }, confirm: false } },
      },
    },
    state: {},
  }) as unknown as Spec;

describe('FraymeRenderer', () => {
  it('strict mode rejects a spec with an unknown component type', () => {
    const spec = {
      root: 'x',
      elements: { x: { type: 'Bogus', props: {} } },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="strict" />);
    expect(container.querySelector('.frayme-invalid')).toBeTruthy();
  });

  it('strict mode + skipValidation renders best-effort instead of failing closed', () => {
    const spec = {
      root: 'x',
      elements: { x: { type: 'Bogus', props: {} } },
    } as unknown as Spec;
    const { container } = render(
      <FraymeRenderer spec={spec} mode="strict" skipValidation />,
    );
    // The strict catalog gate is skipped — no InvalidSpec error card...
    expect(container.querySelector('.frayme-invalid')).toBeNull();
    // ...and the registry whitelist still guards: unknown types render inert.
    expect(container.querySelector('[data-frayme-fallback="Bogus"]')).toBeTruthy();
  });

  it('survives the first-patch snapshot: {root} with no elements yet (live-demo regression)', () => {
    const spec = { root: 'page' } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(container.querySelector('.frayme-root')).toBeTruthy();
  });

  it('Heading coerces malformed level values (numbers, bare digits) instead of throwing', () => {
    for (const level of [2, '3', 'h4', 'banana', null]) {
      const spec = {
        root: 'h',
        elements: { h: { type: 'Heading', props: { text: 'Hi', level } } },
      } as unknown as Spec;
      const { container, unmount } = render(<FraymeRenderer spec={spec} mode="progressive" />);
      expect(container.querySelector('h1, h2, h3, h4')?.textContent).toBe('Hi');
      unmount();
    }
  });

  it('progressive mode renders unknown types as the inert Fallback', () => {
    const spec = {
      root: 'x',
      elements: { x: { type: 'Bogus', props: {} } },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(container.querySelector('[data-frayme-fallback="Bogus"]')).toBeTruthy();
  });

  it('forwards spec-bound named actions to onDynamicAction with params', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'submit_form',
      params: { source: 'pricing' },
    });
  });

  it('applies theme tokens as CSS variables on the root', () => {
    const { container } = render(
      <FraymeRenderer
        spec={buttonSpec('noop')}
        mode="progressive"
        theme={{ primary: '#ff0000', radius: '1rem' }}
      />,
    );
    const root = container.querySelector('.frayme-root') as HTMLElement;
    expect(root.style.getPropertyValue('--frayme-primary')).toBe('#ff0000');
    expect(root.style.getPropertyValue('--frayme-radius')).toBe('1rem');
  });

  it('bumping restartKey remounts the state tree and discards client edits', () => {
    const formSpec = {
      root: 'i1',
      elements: {
        i1: {
          type: 'Input',
          props: {
            label: 'Name',
            name: 'name',
            type: 'text',
            placeholder: null,
            value: { $bindState: '/form/name' },
            checks: null,
            validateOn: null,
          },
        },
      },
      state: { form: { name: '' } },
    } as unknown as Spec;

    const { container, rerender } = render(
      <FraymeRenderer spec={formSpec} mode="progressive" restartKey={0} />,
    );
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'alice' } });
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('alice');

    rerender(<FraymeRenderer spec={formSpec} mode="progressive" restartKey={1} />);
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('');
  });

  // B2 — the patch path: a settled NEW spec at an UNCHANGED restartKey is an
  // in-place evolve. The agent owns which state keys exist (its new /note field
  // must land); the client owns the value of any key it still carries (the
  // in-progress /form/name edit must survive). The pre-B2 uncontrolled renderer
  // dropped the agent field silently — mergeOnRehydrate was dead code.
  it('patch (new spec, same restartKey) preserves a client edit AND lands an agent-added state field', () => {
    const input = (id: string, label: string, path: string) => ({
      type: 'Input',
      props: {
        label,
        name: id,
        type: 'text',
        placeholder: null,
        value: { $bindState: path },
        checks: null,
        validateOn: null,
      },
    });
    const before = {
      root: 'stk',
      elements: {
        stk: { type: 'Stack', props: {}, children: ['i1'] },
        i1: input('i1', 'Name', '/form/name'),
      },
      state: { form: { name: '' } },
    } as unknown as Spec;
    const after = {
      root: 'stk',
      elements: {
        stk: { type: 'Stack', props: {}, children: ['i1', 'i2'] },
        i1: input('i1', 'Name', '/form/name'),
        i2: input('i2', 'Note', '/note'), // agent-added element + /note state field
      },
      state: { form: { name: '' }, note: 'from-agent' },
    } as unknown as Spec;

    const { container, rerender } = render(
      <FraymeRenderer spec={before} mode="progressive" restartKey={0} />,
    );
    fireEvent.change(container.querySelectorAll('input[type="text"]')[0]!, {
      target: { value: 'alice' },
    });
    expect(
      (container.querySelectorAll('input[type="text"]')[0] as HTMLInputElement).value,
    ).toBe('alice');

    rerender(<FraymeRenderer spec={after} mode="progressive" restartKey={0} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    // client edit survived the patch...
    expect((inputs[0] as HTMLInputElement).value).toBe('alice');
    // ...and the agent's new /note field landed in the live store.
    expect((inputs[1] as HTMLInputElement).value).toBe('from-agent');
  });
});

describe('FraymeRenderer — interactive prop (B1)', () => {
  it('interactive={false} still renders controls but clicks are inert', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        onDynamicAction={onDynamicAction}
        interactive={false}
      />,
    );
    // the control renders...
    expect(screen.getByText('Go')).toBeTruthy();
    // ...but the click is inert regardless of the handler being present.
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('default (handler present) forwards the click', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('data-interactive reflects the resolved value (explicit false · default+handler · default no-handler)', () => {
    const root = (c: HTMLElement) =>
      c.querySelector('.frayme-root')?.getAttribute('data-interactive');

    const explicitFalse = render(
      <FraymeRenderer
        spec={buttonSpec('a')}
        mode="progressive"
        interactive={false}
        onDynamicAction={() => undefined}
      />,
    );
    expect(root(explicitFalse.container)).toBe('false');

    const defaultWithHandler = render(
      <FraymeRenderer spec={buttonSpec('a')} mode="progressive" onDynamicAction={() => undefined} />,
    );
    expect(root(defaultWithHandler.container)).toBe('true');

    const defaultNoHandler = render(<FraymeRenderer spec={buttonSpec('a')} mode="progressive" />);
    expect(root(defaultNoHandler.container)).toBe('false');
  });
});

describe('FraymeRenderer — action kinds (handler map)', () => {
  it('local kind runs a deterministic fn with the resolved params', () => {
    const run = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        actions={{ submit_form: { kind: 'local', run } }}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(run).toHaveBeenCalledTimes(1);
    // Authored params + the Button's intrinsic {label} (additive contract).
    expect(run.mock.calls[0]![0]).toEqual({ label: 'Go', source: 'pricing' });
  });

  it('a bare function is sugar for kind:local', () => {
    const fn = vi.fn();
    render(
      <FraymeRenderer spec={buttonSpec('submit_form')} mode="progressive" actions={{ submit_form: fn }} />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('agent kind forwards to onDynamicAction', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        actions={{ submit_form: { kind: 'agent' } }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'submit_form', params: { label: 'Go', source: 'pricing' } }),
    );
  });

  it('false denies — the action is inert, never forwarded', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        actions={{ submit_form: false }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('unmapped actions are FAIL-CLOSED (inert) without a defaultActionKind', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        actions={{ other: { kind: 'agent' } }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('defaultActionKind="agent" forwards unmapped actions to the handler', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        actions={{ other: { kind: 'agent' } }}
        defaultActionKind="agent"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('an action map alone makes the UI interactive (isInteractive footgun fix)', () => {
    const run = vi.fn();
    const { container } = render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        actions={{ submit_form: { kind: 'local', run } }}
      />,
    );
    // No onDynamicAction, yet it must NOT render inert.
    expect(container.querySelector('.frayme-root')?.getAttribute('data-interactive')).toBe('true');
    fireEvent.click(screen.getByText('Go'));
    expect(run).toHaveBeenCalled();
  });

  it('recompose calls compose with prior_spec and lands the result via onRecompose', async () => {
    const evolved = { root: 'b1', elements: {}, state: {} };
    const create = vi.fn(() => Promise.resolve({ spec: evolved }));
    const onRecompose = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonSpec('submit_form')}
        mode="progressive"
        actions={{ submit_form: { kind: 'recompose', prompt: 'evolve it' } }}
        compose={{ create }}
        onRecompose={onRecompose}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    await waitFor(() => expect(onRecompose).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'evolve it', mode: 'edit', data: { label: 'Go', source: 'pricing' } }),
    );
    expect(onRecompose).toHaveBeenCalledWith(evolved, { state: 'merge' });
  });
});

describe('FraymeRenderer — spec.actions (Modal-authored handlers)', () => {
  const specWithActions = (action: string, blk: Record<string, unknown>): Spec =>
    ({ ...(buttonSpec(action) as object), actions: blk }) as unknown as Spec;

  it('reads the handler from spec.actions when no consumer prop is set', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={specWithActions('submit_form', { submit_form: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'submit_form', params: { label: 'Go', source: 'pricing' } }),
    );
  });

  it('spec.actions alone makes the UI interactive (no prop, no onDynamicAction)', () => {
    const { container } = render(
      <FraymeRenderer
        spec={specWithActions('submit_form', { submit_form: { kind: 'recompose', prompt: 'x' } })}
        mode="progressive"
      />,
    );
    expect(container.querySelector('.frayme-root')?.getAttribute('data-interactive')).toBe('true');
  });

  it('a consumer actions prop overrides spec.actions per-name', () => {
    const run = vi.fn();
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={specWithActions('submit_form', { submit_form: { kind: 'agent' } })}
        mode="progressive"
        actions={{ submit_form: { kind: 'local', run } }}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(run).toHaveBeenCalledTimes(1); // the consumer override ran
    expect(onDynamicAction).not.toHaveBeenCalled(); // the spec's agent kind did NOT
  });

  it('spec.actions is additive, not a restriction — an undeclared action still forwards', () => {
    // Unlike a consumer `actions` MAP (which fail-closes unmapped names), a spec's
    // own actions block only ADDS handlers; undeclared names fall through to the
    // handler. This is what keeps blanket-forward chats working when a spec also
    // carries a deterministic handler.
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={specWithActions('submit_form', { other: { kind: 'agent' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'submit_form', params: { label: 'Go', source: 'pricing' } }),
    );
  });

  it('with no handler at all, an undeclared spec.actions name is simply inert (chatless)', () => {
    // Chatless passes no onDynamicAction: an undeclared action has nowhere to go,
    // so it is a harmless no-op (no throw).
    expect(() =>
      render(
        <FraymeRenderer
          spec={specWithActions('submit_form', { other: { kind: 'agent' } })}
          mode="progressive"
        />,
      ),
    ).not.toThrow();
    expect(() => fireEvent.click(screen.getByText('Go'))).not.toThrow();
  });

  it('a recompose declared in spec.actions calls compose + onRecompose (the chatless path)', async () => {
    const evolved = { root: 'b1', elements: {}, state: {} };
    const create = vi.fn(() => Promise.resolve({ spec: evolved }));
    const onRecompose = vi.fn();
    render(
      <FraymeRenderer
        spec={specWithActions('bookTrip', { bookTrip: { kind: 'recompose', prompt: 'mark booked' } })}
        mode="progressive"
        compose={{ create }}
        onRecompose={onRecompose}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    await waitFor(() => expect(onRecompose).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'mark booked', mode: 'edit', data: { label: 'Go', source: 'pricing' } }),
    );
    expect(onRecompose).toHaveBeenCalledWith(evolved, { state: 'merge' });
  });

  it('a spec.actions recompose with no compose/onRecompose falls back to onDynamicAction', () => {
    // Interactive-Chat backward-compat: the spec carries a recompose handler but
    // the chat variant injects no compose client — it must fall back to the forwarder.
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={specWithActions('bookTrip', { bookTrip: { kind: 'recompose', prompt: 'mark booked' } })}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'bookTrip', params: { label: 'Go', source: 'pricing' } }),
    );
  });

  it('a consumer MAP is authoritative — a spec.actions handler for an UNMAPPED name is ignored', () => {
    // Security: a (less-trusted) spec must not smuggle in a handler for a name the
    // consumer did not list. With a map present, spec.actions is ignored entirely.
    const create = vi.fn(() => Promise.resolve({ spec: {} }));
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={specWithActions('bookTrip', { bookTrip: { kind: 'recompose', prompt: 'mark booked' } })}
        mode="progressive"
        actions={{ other: { kind: 'agent' } }}
        compose={{ create }}
        onRecompose={vi.fn()}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(create).not.toHaveBeenCalled(); // the spec's recompose did NOT run
    expect(onDynamicAction).not.toHaveBeenCalled(); // bookTrip is unmapped → inert
  });

  it('an empty consumer map {} is authoritative too — it ignores spec.actions', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={specWithActions('bookTrip', { bookTrip: { kind: 'agent' } })}
        mode="progressive"
        actions={{}}
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).not.toHaveBeenCalled();
  });
});
