import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import {
  FraymeMessageRenderer,
  createDynamicActionForwarder,
  SPEC_DATA_PART_TYPE,
} from '../src/ai-sdk/index.js';
import { composeStreamToDataParts } from '../src/core/ai-bridge.js';

const textSpec = (text: string): Spec =>
  ({
    root: 't1',
    elements: { t1: { type: 'Text', props: { text, variant: 'body' } } },
  }) as unknown as Spec;

describe('FraymeMessageRenderer', () => {
  it('renders the spec carried in data-spec parts (flat)', () => {
    const message = {
      parts: [
        { type: 'text', text: 'Here is your UI:' },
        { type: SPEC_DATA_PART_TYPE, data: { type: 'flat', spec: textSpec('hello from agent') } },
      ],
    };
    const { container } = render(<FraymeMessageRenderer message={message} />);
    expect(container.textContent).toContain('hello from agent');
  });

  it('folds patch parts progressively and lets a later flat part REPLACE everything (restart)', () => {
    const patches = [
      { type: SPEC_DATA_PART_TYPE, data: { type: 'patch', patch: { op: 'add', path: '/root', value: 't1' } } },
      {
        type: SPEC_DATA_PART_TYPE,
        data: {
          type: 'patch',
          patch: { op: 'add', path: '/elements/t1', value: { type: 'Text', props: { text: 'draft', variant: 'body' } } },
        },
      },
    ];
    const r1 = render(<FraymeMessageRenderer message={{ parts: patches }} />);
    expect(r1.container.textContent).toContain('draft');

    const withRestart = {
      parts: [...patches, { type: SPEC_DATA_PART_TYPE, data: { type: 'flat', spec: textSpec('final') } }],
    };
    const r2 = render(<FraymeMessageRenderer message={withRestart} />);
    expect(r2.container.textContent).toContain('final');
    expect(r2.container.textContent).not.toContain('draft');
  });

  it('renders nothing for messages without spec parts', () => {
    const { container } = render(
      <FraymeMessageRenderer message={{ parts: [{ type: 'text', text: 'plain prose' }] }} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('createDynamicActionForwarder', () => {
  it('delivers actions through sendMessage with a readable default format', () => {
    const sendMessage = vi.fn();
    const forward = createDynamicActionForwarder({ sendMessage });
    forward({ action: 'submit_form', params: { email: 'a@b.c' } });
    // threadText shape (core/thread-text.ts): humanized name, then `- Key: value` bullets.
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Submit form\n- Email: a@b.c' });
    forward({ action: 'regenerate', params: {} });
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Regenerate' }); // no params → the heading alone
  });

  /**
   * END TO END through a RENDERED Button. The hand-built events
   * above carry no `label` in params; a real press does — the renderer folds the
   * Button's `{ label }` payload into the params — and the default text then
   * printed "- Label: Approve" under "Approve refund", against the thread-text shape
   * ("no button label") and the docs' own example. This pins the real output.
   */
  it('a rendered labelled Button produces the documented text — no "Label:" bullet', () => {
    const sendMessage = vi.fn();
    const spec = {
      root: 'approve',
      elements: {
        approve: {
          type: 'Button',
          props: { label: 'Approve' },
          on: { commit: { action: 'approveRefund', params: { orderId: '4821' }, confirm: false } },
        },
      },
      state: {},
      actions: { approveRefund: { kind: 'agent' } },
    } as unknown as Spec;
    render(
      <FraymeMessageRenderer
        message={{ parts: [{ type: SPEC_DATA_PART_TYPE, data: { type: 'flat', spec } }] }}
        onDynamicAction={createDynamicActionForwarder({ sendMessage })}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Approve refund\n- Order ID: 4821' });
  });
});

describe('composeStreamToDataParts (server bridge)', () => {
  it('maps op→patch, restarted→flat reset, completed→flat final', async () => {
    const events = [
      { type: 'compose.started', generation_id: 'g', model: 'frayme' },
      { type: 'op', op: 'add', path: '/root', value: 't1' },
      { type: 'compose.restarted', generation_id: 'g', model: 'fallback', reason: { code: 'x' } },
      { type: 'op', op: 'add', path: '/root', value: 't2' },
      { type: 'compose.completed', generation_id: 'g', model: 'fallback', operation_count: 1, usage: { input_tokens: 1, output_tokens: 1 }, validated: true },
    ];
    const finalSpec = textSpec('done');
    const fakeStream = {
      async *[Symbol.asyncIterator]() {
        yield* events as never[];
      },
      currentSpec: () => finalSpec,
    };
    const parts = [];
    for await (const part of composeStreamToDataParts(fakeStream as never)) parts.push(part);

    expect(parts.map((p) => p.type)).toEqual(['patch', 'flat', 'patch', 'flat']);
    expect(parts[1]).toEqual({ type: 'flat', spec: { root: null, elements: {} } });
    expect(parts[3]).toEqual({ type: 'flat', spec: finalSpec });
    expect((parts[0] as { patch: { op: string } }).patch).toEqual({ op: 'add', path: '/root', value: 't1' });
  });
});
