/**
 * The AI SDK glue for Frayme tools in the host's own chat
 * (ai-sdk/index.tsx): `fraymePart` picks what `<FraymeResult>` should draw
 * out of a message part, and `pressMessage` turns a press into the user's
 * next message so that `fraymePart` finds it again on the way back.
 *
 * Also pinned here: `FraymeMessageRenderer` builds its spec from COPIES of the
 * `data-spec` parts, because json-render's `buildSpecFromParts` writes into a
 * flat part's spec when later patches apply.
 */
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DynamicActionEvent } from '../src/core/events.js';
import {
  FraymeMessageRenderer,
  SPEC_DATA_PART_TYPE,
  createDynamicActionForwarder,
  fraymePart,
  pressMessage,
} from '../src/ai-sdk/index.js';

const output = { status: 'complete', generation_id: 'gen_1', op_count: 2, restart_count: 0, spec: { root: 't1', elements: {} } };

const toolPart = (over: Record<string, unknown> = {}) => ({
  type: 'tool-frayme_compose',
  toolCallId: 'call_1',
  state: 'output-available',
  input: { prompt: 'x' },
  output,
  ...over,
});

const event: DynamicActionEvent = {
  action: 'approveRefund',
  params: { orderId: '4821', label: 'Approve' },
  event: 'commit',
  state: { _ui: { table: { sort: { sortBy: 'amount', sortDir: 'asc' } } } },
  element_id: 'approve',
  generation_id: 'gen_1',
  label: 'Approve',
  description: 'Refund the order.',
};

describe('fraymePart: tool outputs', () => {
  it('a finished frayme_compose output is a final result', () => {
    const hit = fraymePart(toolPart());
    expect(hit).toEqual({ output, final: true });
    // Handed on as it is: no copy, no rewrite.
    expect((hit as { output: unknown }).output).toBe(output);
  });

  it('a preliminary output is not final', () => {
    expect(fraymePart(toolPart({ preliminary: true }))).toEqual({ output, final: false });
    expect(fraymePart(toolPart({ preliminary: false }))).toEqual({ output, final: true });
  });

  it('frayme_action parts count too', () => {
    expect(fraymePart(toolPart({ type: 'tool-frayme_action' }))).toEqual({ output, final: true });
  });

  it('dynamic tools are matched by toolName', () => {
    expect(fraymePart(toolPart({ type: 'dynamic-tool', toolName: 'frayme_compose' }))).toEqual({ output, final: true });
    expect(fraymePart(toolPart({ type: 'dynamic-tool', toolName: 'frayme_action', preliminary: true }))).toEqual({
      output,
      final: false,
    });
    expect(fraymePart(toolPart({ type: 'dynamic-tool', toolName: 'weather' }))).toBeNull();
    expect(fraymePart(toolPart({ type: 'dynamic-tool' }))).toBeNull();
  });

  it('other tools are not Frayme results, even with a status', () => {
    expect(fraymePart(toolPart({ type: 'tool-weather' }))).toBeNull();
    expect(fraymePart(toolPart({ type: 'tool-frayme_compose_extra' }))).toBeNull();
    expect(fraymePart(toolPart({ type: 'tool-' }))).toBeNull();
  });

  it.each(['input-streaming', 'input-available', 'output-error', 'approval-requested', undefined])(
    'state %s is not a result yet',
    (state) => {
      expect(fraymePart(toolPart({ state }))).toBeNull();
    },
  );

  it('an output without a string status is not a result', () => {
    for (const bad of [undefined, null, 'complete', 42, [output], { spec: {} }, { status: 1 }]) {
      expect(fraymePart(toolPart({ output: bad }))).toBeNull();
    }
  });

  it('a tool part is never read as a press, whoever sent it', () => {
    expect(fraymePart(toolPart({ output: undefined }), { role: 'user', metadata: { frayme: event } })).toBeNull();
  });
});

describe('fraymePart: presses', () => {
  const textPart = { type: 'text', text: 'Approve refund' };
  const userMessage = { role: 'user', metadata: { frayme: event } };

  it('a user text part carrying an event under metadata.frayme is a press', () => {
    const hit = fraymePart(textPart, userMessage);
    expect(hit).toEqual({ press: event });
    expect((hit as { press: unknown }).press).toBe(event);
  });

  it('only a USER message carries a press', () => {
    for (const role of ['assistant', 'system', undefined]) {
      expect(fraymePart(textPart, { role, metadata: { frayme: event } })).toBeNull();
    }
    expect(fraymePart(textPart)).toBeNull();
  });

  it('only a text part carries it', () => {
    expect(fraymePart({ type: 'file', url: 'x' }, userMessage)).toBeNull();
    expect(fraymePart({ type: 'reasoning', text: 'x' }, userMessage)).toBeNull();
  });

  it('the event must name an action', () => {
    for (const frayme of [undefined, null, 'approve', { params: {} }, { action: 7 }, [event]]) {
      expect(fraymePart(textPart, { role: 'user', metadata: { frayme } })).toBeNull();
    }
    for (const metadata of [undefined, null, 'x', [], { other: event }]) {
      expect(fraymePart(textPart, { role: 'user', metadata })).toBeNull();
    }
  });

  it('an event with unusable params is handed on with empty params, not mutated', () => {
    const odd = { action: 'go', params: 'nope' };
    const hit = fraymePart(textPart, { role: 'user', metadata: { frayme: odd } }) as { press: DynamicActionEvent };
    expect(hit.press).toEqual({ action: 'go', params: {} });
    expect(odd.params).toBe('nope');
    const missing = fraymePart(textPart, { role: 'user', metadata: { frayme: { action: 'go' } } }) as {
      press: DynamicActionEvent;
    };
    expect(missing.press.params).toEqual({});
  });
});

describe('fraymePart: anything else', () => {
  it('returns null and never throws', () => {
    for (const part of [undefined, null, 0, 'text', [], {}, { type: 7 }, { type: 'text' }, { type: 'data-spec', data: {} }]) {
      expect(fraymePart(part)).toBeNull();
      expect(fraymePart(part, { role: 'user', metadata: 'x' })).toBeNull();
    }
  });
});

const PRESS_LINE =
  'frayme_action {"action":"approveRefund","event":"commit","element_id":"approve","label":"Approve","generation_id":"gen_1"}';

describe('fraymePart: what the user should not see', () => {
  it('a refused output is null', () => {
    const refused = { status: 'error', op_count: 0, restart_count: 0, spec: null, refused: true, error: { message: 'x', code: 'NO_PRESS' } };
    expect(fraymePart(toolPart({ output: refused }))).toBeNull();
  });

  it('an error the model retried later in the same message is null; the last error stays', () => {
    const failed = { status: 'error', op_count: 0, restart_count: 0, spec: null, error: { message: 'boom' } };
    const refused = { ...failed, refused: true };
    const first = toolPart({ toolCallId: 'a', output: failed });
    const retry = toolPart({ toolCallId: 'b', output });
    const message = { role: 'assistant', parts: [first, { type: 'text', text: 'trying again' }, retry] };
    expect(fraymePart(first, message)).toBeNull();
    expect(fraymePart(retry, message)).toEqual({ output, final: true });

    // A retry still running also hides the old error.
    const running = { type: 'tool-frayme_compose', toolCallId: 'c', state: 'input-available', input: {} };
    expect(fraymePart(first, { role: 'assistant', parts: [first, running] })).toBeNull();

    // A later refusal is not a retry: the error stays.
    const later = toolPart({ toolCallId: 'd', output: refused });
    expect(fraymePart(first, { role: 'assistant', parts: [first, later] })).toEqual({ output: failed, final: true });
    // Without the message, every error stays.
    expect(fraymePart(first)).toEqual({ output: failed, final: true });
  });
});

describe('pressMessage', () => {
  it('writes the forwarder text, then the press line, with the full event in metadata', () => {
    const sendMessage = vi.fn();
    createDynamicActionForwarder({ sendMessage })(event);
    const message = pressMessage(event);
    expect(message.text).toBe(`${sendMessage.mock.calls[0][0].text}\n\n${PRESS_LINE}`);
    expect(message.text).toContain('Approve refund');
    expect(message.text).toContain('Also recorded');
    expect(message.metadata.frayme).toBe(event);
  });

  it('includeState: false drops the state block, as the forwarder does', () => {
    const sendMessage = vi.fn();
    createDynamicActionForwarder({ sendMessage, includeState: false })(event);
    const message = pressMessage(event, { includeState: false });
    expect(message.text).toBe(`${sendMessage.mock.calls[0][0].text}\n\n${PRESS_LINE}`);
    expect(message.text).not.toContain('Also recorded');
  });

  it('the press line carries the action name but never params or state', () => {
    const line = pressMessage(event).text.split('\n').at(-1) ?? '';
    const forwarded = JSON.parse(line.slice('frayme_action '.length));
    expect(forwarded).toEqual({
      action: 'approveRefund',
      event: 'commit',
      element_id: 'approve',
      label: 'Approve',
      generation_id: 'gen_1',
    });
    expect(line).not.toContain('4821');
    expect(line).not.toContain('sortBy');
  });

  it('is the same function on the server-safe root, with its parts', async () => {
    const root = await import('../src/index.js');
    expect(root.pressMessage).toBe(pressMessage);
    const message = pressMessage(event);
    expect(message.text).toBe(`${root.pressThreadText(event)}\n\n${root.pressLine(event)}`);
  });

  it('the press line leaves out fields the event does not have', () => {
    const bare: DynamicActionEvent = { action: 'refresh', params: {} };
    expect(pressMessage(bare).text.split('\n').at(-1)).toBe('frayme_action {"action":"refresh"}');
  });

  it('round-trips: fraymePart finds the press in the message it builds', () => {
    const message = pressMessage(event);
    const hit = fraymePart({ type: 'text', text: message.text }, { role: 'user', metadata: message.metadata });
    expect(hit).toEqual({ press: event });
  });
});

describe('FraymeMessageRenderer builds from copies of the parts', () => {
  const flat = () => ({
    type: SPEC_DATA_PART_TYPE,
    data: {
      type: 'flat',
      spec: {
        root: 'page',
        elements: {
          page: { type: 'Stack', props: {}, children: ['a'] },
          a: { type: 'Text', props: { text: 'first', variant: 'body' } },
        },
      },
    },
  });
  const patches = () => [
    {
      type: SPEC_DATA_PART_TYPE,
      data: {
        type: 'patch',
        patch: { op: 'add', path: '/elements/b', value: { type: 'Text', props: { text: 'second', variant: 'body' } } },
      },
    },
    { type: SPEC_DATA_PART_TYPE, data: { type: 'patch', patch: { op: 'add', path: '/elements/page/children/-', value: 'b' } } },
  ];

  it('leaves the message parts exactly as they were', () => {
    const parts = [flat(), ...patches()];
    const before = JSON.parse(JSON.stringify(parts));
    const { container } = render(createElement(FraymeMessageRenderer, { message: { parts } }));
    expect(container.textContent).toContain('first');
    expect(container.textContent).toContain('second');
    expect(parts).toEqual(before);
  });

  it('a rebuild of the same parts does not apply the patches twice', () => {
    const parts = [flat(), ...patches()];
    const first = render(createElement(FraymeMessageRenderer, { message: { parts } }));
    expect(first.container.querySelectorAll('p, span, div').length).toBeGreaterThan(0);
    // A new array with the same part objects: what a chat store hands over as
    // the next part streams in.
    const second = render(createElement(FraymeMessageRenderer, { message: { parts: [...parts] } }));
    const count = (second.container.textContent ?? '').split('second').length - 1;
    expect(count).toBe(1);
  });

  it('skips null parts and a missing parts array', () => {
    const parts = [null, flat()] as unknown as Parameters<typeof FraymeMessageRenderer>[0]['message']['parts'];
    expect(render(createElement(FraymeMessageRenderer, { message: { parts } })).container.textContent).toContain('first');
    expect(render(createElement(FraymeMessageRenderer, { message: {} })).container.innerHTML).toBe('');
  });

  it('still renders parts that structuredClone refuses', () => {
    const part = flat();
    (part.data.spec as Record<string, unknown>).hook = () => undefined;
    const { container } = render(createElement(FraymeMessageRenderer, { message: { parts: [part] } }));
    expect(container.textContent).toContain('first');
  });
});
