/**
 * FRAYME RESULT: one Frayme tool result inside the host's own chat
 * (react/result.tsx).
 *
 * The branches, each pinned below: a press draws the thread card; an error
 * draws a notice and never a spec; a final complete output renders under the
 * strict gate; a live output renders progressively and never flashes the
 * invalid box; a final output that never completed says so and shows what
 * arrived, display-only. Across all of them the output object is never
 * written to, and a press on the rendered screen still carries the output's
 * generation id.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import type { DynamicActionEvent } from '../src/core/events.js';
import { FraymeResult, type FraymeResultOutput } from '../src/react/result.js';
import { FraymeResult as FromIndex } from '../src/react/index.js';

const textSpec = (text: string): Spec =>
  ({ root: 't1', elements: { t1: { type: 'Text', props: { text, variant: 'body' } } } }) as unknown as Spec;

/** Fails the strict gate (unknown component), renders inert in progressive mode. */
const offCatalogSpec = (): Spec =>
  ({
    root: 'page',
    elements: {
      page: { type: 'Stack', props: {}, children: ['t1', 'x'] },
      t1: { type: 'Text', props: { text: 'partial text', variant: 'body' } },
      x: { type: 'Bogus', props: {} },
    },
  }) as unknown as Spec;

const buttonSpec = (): Spec =>
  ({
    root: 'b1',
    elements: {
      b1: {
        type: 'Button',
        props: { label: 'Approve', variant: 'primary' },
        on: { commit: { action: 'approveRefund', params: { orderId: '4821' }, confirm: false } },
      },
    },
    state: {},
    actions: { approveRefund: { kind: 'agent' } },
  }) as unknown as Spec;

const output = (over: Partial<FraymeResultOutput>): FraymeResultOutput => ({
  status: 'complete',
  generation_id: 'gen_1',
  op_count: 1,
  restart_count: 0,
  spec: textSpec('done'),
  ...over,
});

const invalidBox = (container: HTMLElement) => container.querySelector('.frayme-invalid');
const notice = (container: HTMLElement) => container.querySelector('.frayme-notice') as HTMLElement | null;
const renderRoot = (container: HTMLElement) =>
  container.querySelector('.frayme-root:not(.frayme-notice):not(.frayme-receipt)') as HTMLElement | null;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('FraymeResult', () => {
  it('is exported from the react entry', () => {
    expect(FromIndex).toBe(FraymeResult);
  });

  it('a press draws the thread card, not the output', () => {
    const press: DynamicActionEvent = {
      action: 'approveRefund',
      params: { orderId: '4821' },
      label: 'Approve',
      description: 'Refund the order.',
    };
    const { container } = render(<FraymeResult press={press} output={output({})} scheme="dark" />);
    const card = container.querySelector('.frayme-receipt') as HTMLElement;
    expect(card.querySelector('.frayme-receipt__title')?.textContent).toBe('Approve');
    expect(card.classList.contains('frayme-dark')).toBe(true);
    expect(container.textContent).not.toContain('done');
  });

  it('showState reaches the card', () => {
    const press: DynamicActionEvent = { action: 'save', params: {}, state: { draft: 'x' } };
    const { container } = render(<FraymeResult press={press} showState />);
    expect(container.querySelector('.frayme-receipt__state')).toBeTruthy();
  });

  it('no output and no press renders nothing', () => {
    expect(render(<FraymeResult />).container.innerHTML).toBe('');
  });

  describe('final and complete', () => {
    it('renders a valid spec under the strict gate', () => {
      const { container } = render(<FraymeResult output={output({})} final />);
      expect(container.textContent).toContain('done');
      expect(invalidBox(container)).toBeNull();
    });

    it('fails closed on an off-catalog spec (skipValidation stays off)', () => {
      const { container } = render(<FraymeResult output={output({ spec: offCatalogSpec() })} final />);
      expect(invalidBox(container)).toBeTruthy();
    });

    it('final defaults to true once the status is complete', () => {
      const { container } = render(<FraymeResult output={output({ spec: offCatalogSpec() })} />);
      expect(invalidBox(container)).toBeTruthy();
    });

    it('is interactive, and a press carries the output generation id without writing it onto the output', () => {
      const onPress = vi.fn();
      const out = deepFreeze(output({ spec: buttonSpec(), generation_id: 'gen_42' }));
      render(<FraymeResult output={out} final onPress={onPress} />);
      fireEvent.click(screen.getByText('Approve'));
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onPress.mock.calls[0][0]).toMatchObject({ action: 'approveRefund', generation_id: 'gen_42' });
      expect('generation_id' in (out.spec as object)).toBe(false);
    });

    it("keeps the spec's own generation id when it already carries one", () => {
      const onPress = vi.fn();
      const spec = { ...buttonSpec(), generation_id: 'gen_on_spec' } as unknown as Spec;
      render(<FraymeResult output={output({ spec, generation_id: 'gen_sibling' })} onPress={onPress} />);
      fireEvent.click(screen.getByText('Approve'));
      expect(onPress.mock.calls[0][0].generation_id).toBe('gen_on_spec');
    });
  });

  describe('live (not final)', () => {
    it('streaming renders progressively and never flashes the invalid box', () => {
      const { container } = render(<FraymeResult output={output({ status: 'streaming', spec: offCatalogSpec() })} final={false} />);
      expect(container.textContent).toContain('partial text');
      expect(invalidBox(container)).toBeNull();
      expect(notice(container)).toBeNull();
    });

    it('final defaults to false while streaming', () => {
      const { container } = render(<FraymeResult output={output({ status: 'streaming', spec: offCatalogSpec() })} />);
      expect(container.textContent).toContain('partial text');
      expect(invalidBox(container)).toBeNull();
      expect(notice(container)).toBeNull();
    });

    it('a complete but preliminary output is still progressive', () => {
      const { container } = render(<FraymeResult output={output({ spec: offCatalogSpec() })} final={false} />);
      expect(invalidBox(container)).toBeNull();
      expect(container.textContent).toContain('partial text');
    });

    it('restarted with no spec renders nothing and no notice', () => {
      const { container } = render(
        <FraymeResult output={output({ status: 'restarted', spec: null, restart_count: 1 })} final={false} />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('a live screen takes no presses until it finishes', () => {
      const onPress = vi.fn();
      const { container, rerender } = render(
        <FraymeResult output={output({ status: 'streaming', spec: buttonSpec() })} onPress={onPress} />,
      );
      expect(renderRoot(container)?.getAttribute('data-interactive')).toBe('false');
      fireEvent.click(screen.getByText('Approve'));
      expect(onPress).not.toHaveBeenCalled();
      // The same control, once the screen is final, fires: the inert press never latched it.
      rerender(<FraymeResult output={output({ status: 'complete', spec: buttonSpec() })} onPress={onPress} />);
      fireEvent.click(screen.getByText('Approve'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('a restart_count bump discards the state the user entered', () => {
      const inputSpec = {
        root: 'in',
        elements: { in: { type: 'Input', props: { label: 'Name', value: { $bindState: '/name' } } } },
        state: { name: '' },
      } as unknown as Spec;
      const { container, rerender } = render(
        <FraymeResult output={output({ status: 'streaming', spec: inputSpec, restart_count: 0 })} />,
      );
      const field = () => container.querySelector('input') as HTMLInputElement;
      fireEvent.change(field(), { target: { value: 'Ada' } });
      expect(field().value).toBe('Ada');
      // Same attempt, new snapshot: the input survives.
      rerender(<FraymeResult output={output({ status: 'streaming', spec: { ...inputSpec } as Spec, restart_count: 0 })} />);
      expect(field().value).toBe('Ada');
      // A new attempt: the store is discarded.
      rerender(<FraymeResult output={output({ status: 'streaming', spec: { ...inputSpec } as Spec, restart_count: 1 })} />);
      expect(field().value).toBe('');
    });
  });

  describe('error', () => {
    it('draws a notice with the message and never the spec', () => {
      const { container } = render(
        <FraymeResult
          output={output({ status: 'error', spec: textSpec('stale'), error: { message: 'Quota exceeded', code: 'QUOTA_EXCEEDED' } })}
          final
        />,
      );
      const el = notice(container)!;
      expect(el.textContent).toBe('Quota exceeded');
      // The chat that owns the tool call owns any retry: no button here.
      expect(el.querySelector('button')).toBeNull();
      expect(el.getAttribute('role')).toBe('alert');
      expect(el.getAttribute('data-tone')).toBe('error');
      expect(el.classList.contains('frayme-root')).toBe(true);
      expect(container.textContent).not.toContain('stale');
      expect(renderRoot(container)).toBeNull();
    });

    it('a missing or blank message still gives a sentence', () => {
      const { container } = render(<FraymeResult output={output({ status: 'error', spec: null })} />);
      expect(notice(container)!.textContent).toBe('The screen could not be composed.');
      const blank = render(<FraymeResult output={output({ status: 'error', spec: null, error: { message: '  ' } })} />);
      expect(notice(blank.container)!.textContent).toBe('The screen could not be composed.');
    });

    it('the notice is themed like the renderer', () => {
      const { container } = render(
        <FraymeResult
          output={output({ status: 'error', spec: null, error: { message: 'x' } })}
          theme={{ light: { danger: '#aa0000' }, dark: { danger: '#ff8888' } }}
          scheme="dark"
          className="mine"
        />,
      );
      const el = notice(container)!;
      expect(el.style.getPropertyValue('--frayme-danger')).toBe('#ff8888');
      expect(el.classList.contains('frayme-dark')).toBe(true);
      expect(el.classList.contains('mine')).toBe(true);
    });
  });

  describe('final but not complete (an interrupted stream)', () => {
    it('says the screen did not finish and shows what arrived, display-only', () => {
      const onPress = vi.fn();
      const { container } = render(
        <FraymeResult output={output({ status: 'streaming', spec: buttonSpec() })} final onPress={onPress} />,
      );
      const el = notice(container)!;
      expect(el.textContent).toBe('This screen did not finish.');
      expect(el.getAttribute('role')).toBe('status');
      const rendered = renderRoot(container)!;
      expect(rendered.getAttribute('data-interactive')).toBe('false');
      fireEvent.click(screen.getByText('Approve'));
      expect(onPress).not.toHaveBeenCalled();
      // Progressive: a partial spec is shown, not failed.
      expect(invalidBox(container)).toBeNull();
    });

    it('a partial off-catalog spec is shown, not the invalid box', () => {
      const { container } = render(<FraymeResult output={output({ status: 'streaming', spec: offCatalogSpec() })} final />);
      expect(container.textContent).toContain('partial text');
      expect(invalidBox(container)).toBeNull();
    });

    it('with nothing received, only the notice', () => {
      const { container } = render(<FraymeResult output={output({ status: 'restarted', spec: null })} final />);
      expect(notice(container)!.textContent).toBe('This screen did not finish.');
      expect(renderRoot(container)).toBeNull();
    });
  });

  describe('refused and not yet interactive', () => {
    it('a refused output draws nothing', () => {
      const { container } = render(
        <FraymeResult
          output={output({ status: 'error', spec: null, refused: true, error: { message: 'Do not call again', code: 'ONE_COMPOSE_PER_TURN' } })}
        />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('interactive={false} keeps a finished screen inert, and true lets the same control fire', () => {
      const onPress = vi.fn();
      const { rerender } = render(
        <FraymeResult output={output({ status: 'complete', spec: buttonSpec() })} onPress={onPress} interactive={false} />,
      );
      fireEvent.click(screen.getByText('Approve'));
      expect(onPress).not.toHaveBeenCalled();
      rerender(<FraymeResult output={output({ status: 'complete', spec: buttonSpec() })} onPress={onPress} interactive />);
      fireEvent.click(screen.getByText('Approve'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  it('never mutates the output, in any branch', () => {
    const outputs = [
      output({ spec: buttonSpec() }),
      output({ status: 'streaming', spec: buttonSpec() }),
      output({ status: 'restarted', spec: null }),
      output({ status: 'error', spec: buttonSpec(), error: { message: 'x' } }),
    ];
    for (const out of outputs) {
      const before = JSON.stringify(out);
      deepFreeze(out);
      for (const final of [true, false, undefined]) {
        const { unmount } = render(<FraymeResult output={out} final={final} />);
        unmount();
      }
      expect(JSON.stringify(out)).toBe(before);
    }
  });

  it('never throws on an output it does not recognise', () => {
    const odd = [
      { status: 'weird', spec: textSpec('odd status') },
      { status: 'complete', spec: 'not a spec' },
      { status: 'complete' },
      { status: 'streaming', spec: [1, 2] },
      { status: 'error', error: 'boom' },
    ] as unknown as FraymeResultOutput[];
    for (const out of odd) {
      expect(() => render(<FraymeResult output={out} />)).not.toThrow();
    }
    expect(() => render(<FraymeResult output={'nope' as unknown as FraymeResultOutput} />)).not.toThrow();
  });
});
