/**
 * FRAYME SCREEN: chatless compose (react/screen.tsx), driven end to end
 * through a real keyless `Frayme` client whose `fetch` answers with the API's
 * own SSE wire format.
 *
 * Pinned: the props are the request, compared by value; a fresh create
 * remounts and never shows the new renderer the old screen; `edit` and
 * `continue` send the right body, and only ever a finished screen as
 * `prior_spec`; the renderer (and the user's input in it) survives a
 * follow-up, and the screen a follow-up started from stays up until the new
 * one streams or if it fails; a failure worth retrying offers "Try again";
 * the client comes from props, then the provider (including its `endpoint`),
 * else the setup error.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Frayme } from '@frayme/api';
import { FraymeProvider, useFrayme } from '../src/react/FraymeProvider.js';
import {
  FraymeScreen,
  useFraymeScreen,
  type FraymeScreenHandle,
  type UseFraymeScreenOptions,
} from '../src/react/screen.js';
import * as reactEntry from '../src/react/index.js';
import { MISSING_CLIENT_MESSAGE } from '../src/react/useFraymeCompose.js';

/* ── Environment ─────────────────────────────────────────────────────────── */

// jsdom's AbortSignal has no `any()`, which the client uses to join its
// signals. Every engine the SDK supports has it; this shim only stands in for
// it here, with jsdom's own AbortController.
const hadAny = typeof (AbortSignal as { any?: unknown }).any === 'function';
beforeAll(() => {
  if (hadAny) return;
  (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any = (signals) => {
    const joined = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        joined.abort(signal.reason);
        break;
      }
      signal.addEventListener('abort', () => joined.abort(signal.reason), { once: true });
    }
    return joined.signal;
  };
});
afterAll(() => {
  if (!hadAny) delete (AbortSignal as { any?: unknown }).any;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/* ── Wire fixtures (the API's SSE format) ────────────────────────────────── */

const encoder = new TextEncoder();
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const frame = {
  started: (generationId: string) =>
    sse('compose.started', { type: 'compose.started', generation_id: generationId, model: 'frayme' }),
  op: (patch: Record<string, unknown>) => sse('op', { type: 'op', ...patch }),
  restarted: (generationId: string) =>
    sse('compose.restarted', {
      type: 'compose.restarted',
      generation_id: generationId,
      model: 'frayme/fallback',
      reason: { code: 'catalog_validation_failed' },
    }),
  completed: (generationId: string, count: number) =>
    sse('compose.completed', {
      type: 'compose.completed',
      generation_id: generationId,
      model: 'frayme',
      operation_count: count,
      usage: { input_tokens: 1, output_tokens: 1 },
      validated: true,
    }),
  error: (code: string, message: string) => sse('error', { type: 'error', error: { code, message } }),
};

const textOps = (text: string) => [
  { op: 'add', path: '/root', value: 't1' },
  { op: 'add', path: '/elements/t1', value: { type: 'Text', props: { text, variant: 'body' } } },
];
const buttonOps = [
  { op: 'add', path: '/root', value: 'b1' },
  {
    op: 'add',
    path: '/elements/b1',
    value: {
      type: 'Button',
      props: { label: 'Refund', variant: 'primary' },
      on: { commit: { action: 'refund', params: { orderId: 'A1' }, confirm: false } },
    },
  },
];
const payload = (ops: Record<string, unknown>[], generationId = 'gen_1') =>
  frame.started(generationId) + ops.map(frame.op).join('') + frame.completed(generationId, ops.length);

interface Call {
  url: string;
  body: Record<string, unknown>;
  headers: Headers;
  signal: AbortSignal | undefined;
}

type Reply = (signal: AbortSignal | undefined) => Response;

const sseReply = (text: string): Reply => () =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );

/** The request never gets a response: what a dropped connection looks like to the client. */
const networkDown: Reply = () => {
  throw new TypeError('Failed to fetch');
};

const jsonError = (status: number, code: string, message: string): Reply => () =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** A stream the test feeds by hand; it errors like a real body when the request aborts. */
function openReply() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const reply: Reply = (signal) => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        signal?.addEventListener('abort', () => {
          try {
            c.error(new DOMException('The operation was aborted.', 'AbortError'));
          } catch {
            /* already closed */
          }
        });
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  return {
    reply,
    push: async (text: string) => {
      await act(async () => {
        controller.enqueue(encoder.encode(text));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    },
    close: async () => {
      await act(async () => {
        controller.close();
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    },
  };
}

function mockFetch(replies: Reply[]) {
  const calls: Call[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const signal = init?.signal ?? undefined;
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      headers: new Headers(init?.headers),
      signal,
    });
    const next = replies.shift();
    if (!next) throw new Error(`no scripted reply for call #${calls.length}`);
    return next(signal);
  };
  return { fetch: fetchImpl as typeof globalThis.fetch, calls };
}

const clientFor = (fetchImpl: typeof globalThis.fetch) =>
  new Frayme({ apiKey: null, baseURL: 'https://app.test/api/frayme', fetch: fetchImpl, maxRetries: 0 });

/** Renders the hook alone and exposes its latest return value. */
function probe(options: UseFraymeScreenOptions) {
  const ref: { current: ReturnType<typeof useFraymeScreen> | null } = { current: null };
  function Probe(props: UseFraymeScreenOptions) {
    ref.current = useFraymeScreen(props);
    return null;
  }
  const view = render(<Probe {...options} />);
  return { ref, view, Probe };
}

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)));

/* ── Tests ───────────────────────────────────────────────────────────────── */

describe('FraymeScreen: the props are the request', () => {
  it('is exported from the react entry', () => {
    expect(reactEntry.FraymeScreen).toBe(FraymeScreen);
    expect(reactEntry.useFraymeScreen).toBe(useFraymeScreen);
  });

  it('composes on mount with exactly the props given, and renders the result', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('Open orders')))]);
    render(
      <FraymeScreen
        client={clientFor(fetch)}
        prompt="The open orders"
        data={{ orders: [{ id: 'A1' }] }}
        actions={[{ name: 'refund', params: ['orderId'] }]}
        signals={{ density: 'compact' }}
        context={{ theme: 'dark' }}
      />,
    );
    await screen.findByText('Open orders');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://app.test/api/frayme/v1/compose');
    expect(calls[0].body).toEqual({
      prompt: 'The open orders',
      data: { orders: [{ id: 'A1' }] },
      actions: [{ name: 'refund', params: ['orderId'] }],
      signals: { density: 'compact' },
      context: { theme: 'dark' },
      stream: true,
    });
    expect(calls[0].headers.has('authorization')).toBe(false);
  });

  it('leaves unset props off the wire', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('x')))]);
    render(<FraymeScreen client={clientFor(fetch)} prompt="Just a prompt" />);
    await screen.findByText('x');
    expect(calls[0].body).toEqual({ prompt: 'Just a prompt', stream: true });
  });

  it('shows the fallback until the first op, streams progressively, then applies the strict gate', async () => {
    const stream = openReply();
    const { fetch } = mockFetch([stream.reply]);
    const { container } = render(
      <FraymeScreen client={clientFor(fetch)} prompt="p" fallback={<p>Loading screen</p>} />,
    );
    await stream.push(frame.started('gen_1'));
    expect(screen.getByText('Loading screen')).toBeTruthy();

    // An off-catalog element: fine while streaming, rejected once complete.
    await stream.push(frame.op({ op: 'add', path: '/root', value: 'page' }));
    await stream.push(
      frame.op({ op: 'add', path: '/elements/page', value: { type: 'Stack', props: {}, children: ['t1', 'x'] } }),
    );
    await stream.push(
      frame.op({ op: 'add', path: '/elements/t1', value: { type: 'Text', props: { text: 'first part', variant: 'body' } } }),
    );
    await stream.push(frame.op({ op: 'add', path: '/elements/x', value: { type: 'Bogus', props: {} } }));
    expect(screen.queryByText('Loading screen')).toBeNull();
    expect(container.textContent).toContain('first part');
    expect(container.querySelector('.frayme-invalid')).toBeNull();

    await stream.push(frame.completed('gen_1', 4));
    await stream.close();
    expect(container.querySelector('.frayme-invalid')).toBeTruthy();
  });

  it('does not recompose for equal props, whatever their identity or key order', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('one'))), sseReply(payload(textOps('two'), 'gen_2'))]);
    const client = clientFor(fetch);
    function Host({ flip, extra }: { flip: boolean; extra?: Record<string, unknown> }) {
      const data = flip ? { b: 2, a: 1, ...extra } : { a: 1, b: 2, ...extra };
      return <FraymeScreen client={client} prompt="p" data={data} actions={[{ name: 'go' }]} />;
    }
    const { rerender } = render(<Host flip={false} />);
    await screen.findByText('one');
    rerender(<Host flip />);
    rerender(<Host flip={false} />);
    await settle();
    expect(calls).toHaveLength(1);

    rerender(<Host flip extra={{ c: 3 }} />);
    await screen.findByText('two');
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toMatchObject({ prompt: 'p', data: { a: 1, b: 2, c: 3 } });
    expect(calls[1].body).not.toHaveProperty('mode');
    expect(calls[1].body).not.toHaveProperty('prior_spec');
  });

  it('a Date in data is compared by what it sends', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('one'))), sseReply(payload(textOps('two')))]);
    const client = clientFor(fetch);
    const { rerender } = render(<FraymeScreen client={client} prompt="p" data={{ at: new Date(0) }} />);
    await screen.findByText('one');
    rerender(<FraymeScreen client={client} prompt="p" data={{ at: new Date(0) }} />);
    await settle();
    expect(calls).toHaveLength(1);
    rerender(<FraymeScreen client={client} prompt="p" data={{ at: new Date(1000) }} />);
    await screen.findByText('two');
    expect(calls).toHaveLength(2);
  });

  it('a cyclic or BigInt data value never throws or loops', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('one')))]);
    const cyclic: Record<string, unknown> = { n: 10n };
    cyclic.self = cyclic;
    const client = clientFor(fetch);
    const { rerender } = render(<FraymeScreen client={client} prompt="p" data={cyclic} />);
    rerender(<FraymeScreen client={client} prompt="p" data={cyclic} />);
    await settle();
    // The body cannot be serialised, so the compose fails; it is attempted once.
    expect(calls.length).toBeLessThanOrEqual(1);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('a prop-driven fresh create mounts a new renderer', async () => {
    const { fetch } = mockFetch([sseReply(payload(textOps('one'))), sseReply(payload(textOps('two'), 'gen_2'))]);
    const client = clientFor(fetch);
    const { container, rerender } = render(<FraymeScreen client={client} prompt="first" />);
    await screen.findByText('one');
    const before = container.querySelector('.frayme-root');
    rerender(<FraymeScreen client={client} prompt="second" />);
    await screen.findByText('two');
    expect(container.querySelector('.frayme-root')).not.toBe(before);
  });

  it('the handle exposes status and the generation id as soon as the stream names it', async () => {
    const stream = openReply();
    const { fetch } = mockFetch([stream.reply]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await stream.push(frame.started('gen_7'));
    expect(ref.current!.status).toBe('streaming');
    expect(ref.current!.generationId).toBe('gen_7');
    for (const op of textOps('hi')) await stream.push(frame.op(op));
    await stream.push(frame.completed('gen_7', 2));
    await stream.close();
    expect(ref.current!.status).toBe('complete');
    expect(ref.current!.spec).toMatchObject({ root: 't1', generation_id: 'gen_7' });
  });

  it('a server restart clears the screen and bumps the restart key', async () => {
    const stream = openReply();
    const { fetch } = mockFetch([stream.reply]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await stream.push(frame.started('gen_1'));
    for (const op of textOps('draft')) await stream.push(frame.op(op));
    expect(ref.current!.spec).not.toBeNull();
    await stream.push(frame.restarted('gen_1'));
    expect(ref.current!.status).toBe('restarting');
    expect(ref.current!.spec).toBeNull();
    expect(ref.current!.restartKey).toBe(1);
  });
});

describe('FraymeScreen: edit', () => {
  it('sends mode edit, the current spec as prior_spec, and the props again', async () => {
    const edited = [{ op: 'replace', path: '/elements/t1/props/text', value: 'edited' }];
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('original'))), sseReply(payload(edited, 'gen_2'))]);
    const { ref } = probe({
      client: clientFor(fetch),
      prompt: 'Orders',
      data: { a: 1 },
      actions: [{ name: 'refund' }],
    });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    const current = ref.current!.spec;

    await act(async () => {
      await ref.current!.edit('Make it shorter');
    });
    expect(calls[1].body).toEqual({
      prompt: 'Make it shorter',
      data: { a: 1 },
      actions: [{ name: 'refund' }],
      mode: 'edit',
      prior_spec: JSON.parse(JSON.stringify(current)),
      stream: true,
    });
    expect(ref.current!.status).toBe('complete');
    expect((ref.current!.spec as unknown as { elements: { t1: { props: { text: string } } } }).elements.t1.props.text).toBe(
      'edited',
    );
  });

  it('extra overrides the props but never the mode or prior_spec', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('original'))), sseReply(payload([], 'gen_2'))]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'Orders', data: { a: 1 } });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    await act(async () => {
      await ref.current!.edit('Change', {
        data: { a: 2 },
        mode: 'create',
        prior_spec: { root: 'other' },
        stream: false,
        max_operations: 10,
      });
    });
    expect(calls[1].body).toMatchObject({
      prompt: 'Change',
      data: { a: 2 },
      mode: 'edit',
      prior_spec: { root: 't1' },
      max_operations: 10,
      stream: true,
    });
  });

  it('with nothing on screen yet, sends a fresh create instead', async () => {
    const stream = openReply();
    const { fetch, calls } = mockFetch([stream.reply, sseReply(payload(textOps('fresh')))]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'Orders' });
    await stream.push(frame.started('gen_1'));
    act(() => ref.current!.abort());
    await settle();
    expect(ref.current!.status).toBe('idle');
    expect(ref.current!.spec).toBeNull();
    await act(async () => {
      await ref.current!.edit('Try again');
    });
    expect(calls[1].body).toEqual({ prompt: 'Try again', stream: true });
  });

  it("keeps the renderer, the user's input and the old screen up until the edit streams", async () => {
    const formOps = [
      { op: 'add', path: '/state', value: { name: '' } },
      { op: 'add', path: '/root', value: 'page' },
      { op: 'add', path: '/elements/page', value: { type: 'Stack', props: {}, children: ['in', 'save'] } },
      {
        op: 'add',
        path: '/elements/in',
        value: { type: 'Input', props: { name: 'name', label: 'Name', value: { $bindState: '/name' } } },
      },
      {
        op: 'add',
        path: '/elements/save',
        value: {
          type: 'Button',
          props: { label: 'Save', variant: 'primary' },
          on: { commit: { action: 'save', params: {}, confirm: false } },
        },
      },
    ];
    const editStream = openReply();
    const { fetch } = mockFetch([sseReply(payload(formOps)), editStream.reply]);
    // The handle reaches the host through onAction; a press captures it.
    let handle: FraymeScreenHandle | undefined;
    const { container } = render(
      <FraymeScreen
        client={clientFor(fetch)}
        prompt="A name form"
        fallback={<p>Loading screen</p>}
        onAction={(_event, h) => {
          handle = h;
        }}
      />,
    );
    fireEvent.click(await screen.findByText('Save'));
    expect(handle).toBeDefined();

    const input = () => container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input(), { target: { value: 'Ada' } });
    expect(input().value).toBe('Ada');
    const rootBefore = container.querySelector('.frayme-root');

    let editDone!: Promise<void>;
    act(() => {
      editDone = handle!.edit('Add a note under the field');
    });
    await editStream.push(frame.started('gen_2'));
    // Before the first op: the old screen is still up, with no fallback flash.
    expect(screen.queryByText('Loading screen')).toBeNull();
    expect(container.querySelector('.frayme-root')).toBe(rootBefore);
    expect(input().value).toBe('Ada');

    await editStream.push(
      frame.op({ op: 'add', path: '/elements/note', value: { type: 'Text', props: { text: 'A note', variant: 'body' } } }),
    );
    await editStream.push(frame.op({ op: 'add', path: '/elements/page/children/-', value: 'note' }));
    await editStream.push(frame.completed('gen_2', 2));
    await editStream.close();
    await act(async () => {
      await editDone;
    });
    expect(container.textContent).toContain('A note');
    expect(container.querySelector('.frayme-invalid')).toBeNull();
    // Same renderer, same state store: the typed value survived the edit.
    expect(container.querySelector('.frayme-root')).toBe(rootBefore);
    expect(input().value).toBe('Ada');
  });

  it('a failed edit keeps the last good screen under the notice, and a retry edits that screen', async () => {
    const { fetch, calls } = mockFetch([
      sseReply(payload(buttonOps)),
      jsonError(422, 'VALIDATION_ERROR', 'That edit is not possible'),
      sseReply(payload([], 'gen_3')),
    ]);
    let handle: FraymeScreenHandle | undefined;
    const { container } = render(
      <FraymeScreen
        client={clientFor(fetch)}
        prompt="p"
        onAction={(_event, h) => {
          handle = h;
        }}
      />,
    );
    fireEvent.click(await screen.findByText('Refund'));
    const good = JSON.parse(JSON.stringify(handle!.spec));
    expect(good).toMatchObject({ root: 'b1' });

    await act(async () => {
      await handle!.edit('Impossible');
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('That edit is not possible');
    // A validation error fails the same way twice, so no "Try again".
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    // The good screen is still there, below the notice, and still validated.
    expect(screen.getByText('Refund')).toBeTruthy();
    expect(container.querySelector('.frayme-invalid')).toBeNull();
    expect(alert.nextElementSibling?.classList.contains('frayme-root')).toBe(true);

    // The handle's methods read the screen as it is NOW, so the one captured at
    // the press still works, and it edits the good screen rather than nothing.
    await act(async () => {
      await handle!.edit('Possible');
    });
    expect(calls[2].body).toMatchObject({ mode: 'edit', prior_spec: good, prompt: 'Possible' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('FraymeScreen: continue', () => {
  it('a press reaches onAction with the handle, and continue sends a create carrying its values', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(buttonOps)), sseReply(payload(textOps('Refunded'), 'gen_2'))]);
    const onAction = vi.fn((event, handle: FraymeScreenHandle) => handle.continue(event));
    render(
      <FraymeScreen
        client={clientFor(fetch)}
        prompt="Orders"
        data={{ orders: 1 }}
        actions={[{ name: 'refund', params: ['orderId'] }]}
        onAction={onAction}
      />,
    );
    fireEvent.click(await screen.findByText('Refund'));
    await screen.findByText('Refunded');

    expect(onAction).toHaveBeenCalledTimes(1);
    const [event, handle] = onAction.mock.calls[0];
    expect(event).toMatchObject({ action: 'refund', label: 'Refund', generation_id: 'gen_1', element_id: 'b1' });
    expect(typeof handle.edit).toBe('function');

    const body = calls[1].body;
    // A PRESS IS A CREATE: named in the prompt, with its values in `data`.
    expect(body).toMatchObject({
      prompt: 'The user pressed "Refund". Show the next step.',
      actions: [{ name: 'refund', params: ['orderId'] }],
      stream: true,
    });
    // The pressed action's params ride OVER the props' data, which described the
    // screen just left.
    expect(body.data).toEqual({ orders: 1, orderId: 'A1' });
    expect(body).not.toHaveProperty('mode');
    expect(body).not.toHaveProperty('prior_spec');
    expect(body).not.toHaveProperty('action_context');
    // Nothing of the screen, and no press meta, on the wire.
    const wire = JSON.stringify(body);
    expect(wire).not.toContain('element_id');
    expect(wire).not.toContain('generation_id');
  });

  it('a prompt and extra steer the next step, and naming data opts out of the derived values', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('one'))), sseReply(payload(textOps('two'), 'gen_2'))]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'Orders', data: { a: 1 } });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    const event = {
      action: 'pick',
      params: { id: 7 },
      label: 'Pick',
      description: 'Picks a row.',
      state: { _ui: {} },
      stray: 'not on the wire',
    } as unknown as Parameters<FraymeScreenHandle['continue']>[0];
    await act(async () => {
      await ref.current!.continue(event, 'Show the picked row', {
        data: { row: 7 },
        mode: 'edit',
        action_context: { action: 'other' },
      });
    });
    expect(calls[1].body).toMatchObject({ prompt: 'Show the picked row' });
    // `data` was named, so the params are NOT merged in: the caller knew better.
    expect(calls[1].body.data).toEqual({ row: 7 });
    // mode and action_context are ignored in `extra`, and neither is sent anyway.
    expect(calls[1].body).not.toHaveProperty('mode');
    expect(calls[1].body).not.toHaveProperty('action_context');
    // Nothing of the event reaches the wire, including a stray key on it.
    const wire = JSON.stringify(calls[1].body);
    expect(wire).not.toContain('not on the wire');
    expect(wire).not.toContain('Picks a row');
    expect(wire).not.toContain('_ui');
  });

  it('a press on a huge table sends its params and none of the table', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('one'))), sseReply(payload(textOps('two'), 'gen_2'))]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'Orders' });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    const rows = Array.from({ length: 400 }, (_, i) => ({ id: `R-${i}`, note: 'x'.repeat(40) }));
    await act(async () => {
      await ref.current!.continue({ action: 'reassign', params: { row: { id: 'R-1' } }, state: { rows } });
    });
    expect(calls[1].body.data).toEqual({ row: { id: 'R-1' } });
    expect(calls[1].body).not.toHaveProperty('prior_spec');
    const wire = JSON.stringify(calls[1].body);
    expect(wire).not.toContain('R-399');
    expect(wire.length).toBeLessThan(500);
  });

  it('extra.prompt is used when no prompt argument is given', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('one'))), sseReply(payload([], 'gen_2'))]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'Orders' });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    await act(async () => {
      await ref.current!.continue({ action: 'next', params: {} }, undefined, { prompt: 'From extra' });
    });
    expect(calls[1].body.prompt).toBe('From extra');
  });
});

describe('FraymeScreen: errors, aborts and the client', () => {
  it('an error before the first event shows the API message as a notice', async () => {
    const { fetch } = mockFetch([jsonError(402, 'QUOTA_EXCEEDED', 'Monthly quota reached')]);
    const { container } = render(<FraymeScreen client={clientFor(fetch)} prompt="p" fallback={<p>Loading</p>} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Monthly quota reached');
    expect(alert.classList.contains('frayme-notice')).toBe(true);
    expect(screen.queryByText('Loading')).toBeNull();
    expect(container.querySelectorAll('.frayme-root')).toHaveLength(1);
  });

  it('an in-band error after some ops shows the notice, not the partial screen', async () => {
    const text = frame.started('gen_1') + textOps('half built').map(frame.op).join('') + frame.error('COMPOSITION_FAILED', 'Could not finish');
    const { fetch } = mockFetch([sseReply(text)]);
    const { container } = render(<FraymeScreen client={clientFor(fetch)} prompt="p" />);
    const alert = await screen.findByRole('alert');
    expect(alert.querySelector('.frayme-notice__message')?.textContent).toBe('Could not finish');
    expect(container.textContent).not.toContain('half built');
    // A composition failure is the server's, so it may pass the second time.
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('abort stops the stream and the request', async () => {
    const stream = openReply();
    const { fetch, calls } = mockFetch([stream.reply]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await stream.push(frame.started('gen_1'));
    act(() => ref.current!.abort());
    await settle();
    expect(ref.current!.status).toBe('idle');
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it('unmounting aborts the compose in flight', async () => {
    const stream = openReply();
    const { fetch, calls } = mockFetch([stream.reply]);
    const { unmount } = render(<FraymeScreen client={clientFor(fetch)} prompt="p" />);
    await stream.push(frame.started('gen_1'));
    expect(calls[0].signal?.aborted).toBe(false);
    unmount();
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it('takes the client from the provider', async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('from provider')))]);
    render(
      <FraymeProvider client={clientFor(fetch)}>
        <FraymeScreen prompt="p" />
      </FraymeProvider>,
    );
    await screen.findByText('from provider');
    expect(calls).toHaveLength(1);
  });

  it("builds a keyless client from the provider's endpoint", async () => {
    const { fetch, calls } = mockFetch([sseReply(payload(textOps('from endpoint')))]);
    vi.stubGlobal('fetch', fetch);
    render(
      <FraymeProvider endpoint="/api/frayme">
        <FraymeScreen prompt="p" />
      </FraymeProvider>,
    );
    await screen.findByText('from endpoint');
    expect(calls[0].url).toBe('/api/frayme/v1/compose');
    expect(calls[0].headers.has('authorization')).toBe(false);
  });

  it("the provider's explicit client wins over its endpoint", async () => {
    const own = mockFetch([sseReply(payload(textOps('own client')))]);
    const global = mockFetch([]);
    vi.stubGlobal('fetch', global.fetch);
    render(
      <FraymeProvider client={clientFor(own.fetch)} endpoint="/api/frayme">
        <FraymeScreen prompt="p" />
      </FraymeProvider>,
    );
    await screen.findByText('own client');
    expect(own.calls).toHaveLength(1);
    expect(global.calls).toHaveLength(0);
  });

  it("the provider's endpoint client is built once, not per render", () => {
    vi.stubGlobal('fetch', mockFetch([]).fetch);
    const clients = new Set<unknown>();
    function Spy() {
      clients.add(useFrayme().client);
      return null;
    }
    const { rerender } = render(
      <FraymeProvider endpoint="/api/frayme">
        <Spy />
      </FraymeProvider>,
    );
    rerender(
      <FraymeProvider endpoint="/api/frayme">
        <Spy />
      </FraymeProvider>,
    );
    expect(clients.size).toBe(1);
    expect([...clients][0]).toBeInstanceOf(Frayme);
    rerender(
      <FraymeProvider endpoint="/api/other">
        <Spy />
      </FraymeProvider>,
    );
    expect(clients.size).toBe(2);
  });

  it('a provider with neither client nor endpoint provides no client', () => {
    let client: unknown = 'unset';
    function Spy() {
      client = useFrayme().client;
      return null;
    }
    render(
      <FraymeProvider>
        <Spy />
      </FraymeProvider>,
    );
    expect(client).toBeUndefined();
  });

  it('with no client anywhere, throws the same setup error as useFraymeCompose', () => {
    class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
      state: { error?: Error } = {};
      static getDerivedStateFromError(error: Error) {
        return { error };
      }
      render() {
        return this.state.error ? <p data-testid="caught">{this.state.error.message}</p> : this.props.children;
      }
    }
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Boundary>
        <FraymeScreen prompt="p" />
      </Boundary>,
    );
    quiet.mockRestore();
    expect(screen.getByTestId('caught').textContent).toBe(MISSING_CLIENT_MESSAGE);
  });
});

describe('FraymeScreen: a fresh create starts clean', () => {
  // A Text that shows a state value, so the test sees which screen's state won.
  const stateOps = (tab: string) => [
    { op: 'add', path: '/state', value: { tab } },
    { op: 'add', path: '/root', value: 't1' },
    { op: 'add', path: '/elements/t1', value: { type: 'Text', props: { text: { $state: '/tab' }, variant: 'body' } } },
  ];

  it("a new prompt shows the new screen's state, not the old screen's", async () => {
    const second = openReply();
    const { fetch } = mockFetch([sseReply(payload(stateOps('first-tab'))), second.reply]);
    const client = clientFor(fetch);
    const { container, rerender } = render(<FraymeScreen client={client} prompt="first" />);
    await screen.findByText('first-tab');

    rerender(<FraymeScreen client={client} prompt="second" />);
    await second.push(frame.started('gen_2'));
    for (const op of stateOps('second-tab')) await second.push(frame.op(op));
    await second.push(frame.completed('gen_2', 3));
    await second.close();
    await waitFor(() => expect(container.textContent).toContain('second-tab'));
    expect(container.textContent).not.toContain('first-tab');
  });

  it('the renderer for a new request is never handed the previous screen or its status', async () => {
    const second = openReply();
    const { fetch } = mockFetch([sseReply(payload(textOps('old screen'))), second.reply]);
    const client = clientFor(fetch);
    const seen: Array<{ screenKey: number; status: string; spec: unknown }> = [];
    function Spy(props: UseFraymeScreenOptions) {
      const s = useFraymeScreen(props);
      seen.push({ screenKey: s.screenKey, status: s.status, spec: s.spec });
      return null;
    }
    const { rerender } = render(<Spy client={client} prompt="first" />);
    await waitFor(() => expect(seen.at(-1)!.status).toBe('complete'));
    const old = seen.at(-1)!.spec;
    expect(old).not.toBeNull();

    rerender(<Spy client={client} prompt="second" />);
    await settle();
    const after = seen.filter((r) => r.screenKey === 1);
    expect(after.length).toBeGreaterThan(0);
    for (const r of after) {
      expect(r.spec).toBeNull();
      expect(r.status).toBe('streaming');
    }
  });

  it("a new request does not show the previous request's error, even for one render", async () => {
    const second = openReply();
    const { fetch } = mockFetch([jsonError(503, 'MODEL_UNAVAILABLE', 'Busy'), second.reply]);
    const client = clientFor(fetch);
    const seen: Array<{ screenKey: number; status: string; error: unknown }> = [];
    function Spy(props: UseFraymeScreenOptions) {
      const s = useFraymeScreen(props);
      seen.push({ screenKey: s.screenKey, status: s.status, error: s.error });
      return null;
    }
    const { rerender } = render(<Spy client={client} prompt="first" />);
    await waitFor(() => expect(seen.at(-1)!.status).toBe('error'));

    rerender(<Spy client={client} prompt="second" />);
    await settle();
    const after = seen.filter((r) => r.screenKey === 1);
    expect(after.length).toBeGreaterThan(0);
    for (const r of after) {
      expect(r.status).toBe('streaming');
      expect(r.error).toBeUndefined();
    }
  });
});

describe('FraymeScreen: only a finished screen is carried forward', () => {
  // Patched onto a finished screen, these leave a root whose child never arrived.
  const halfBuilt = [
    { op: 'add', path: '/elements/page', value: { type: 'Stack', props: {}, children: ['t1', 'missing'] } },
    { op: 'replace', path: '/root', value: 'page' },
  ];

  it('with nothing finished, an edit after an abort mid-stream is a fresh create', async () => {
    const first = openReply();
    const { fetch, calls } = mockFetch([first.reply, sseReply(payload(textOps('fresh'), 'gen_2'))]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await first.push(frame.started('gen_1'));
    await first.push(frame.op({ op: 'add', path: '/root', value: 'page' }));
    await first.push(
      frame.op({ op: 'add', path: '/elements/page', value: { type: 'Stack', props: {}, children: ['t1', 'missing'] } }),
    );
    act(() => ref.current!.abort());
    await settle();
    // The partial stays on screen after the abort, but it is not a screen to edit.
    expect(ref.current!.status).toBe('idle');
    expect(ref.current!.spec).toMatchObject({ root: 'page' });

    await act(async () => {
      await ref.current!.edit('change');
    });
    expect(calls[1].body).toEqual({ prompt: 'change', stream: true });
    expect(ref.current!.status).toBe('complete');
  });

  it('an edit aborted mid-stream is not the next prior_spec; the finished screen is', async () => {
    const editStream = openReply();
    const { fetch, calls } = mockFetch([
      sseReply(payload(textOps('finished'))),
      editStream.reply,
      sseReply(payload([], 'gen_3')),
    ]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    const finished = JSON.parse(JSON.stringify(ref.current!.spec));

    act(() => {
      void ref.current!.edit('first change');
    });
    await editStream.push(frame.started('gen_2'));
    for (const op of halfBuilt) await editStream.push(frame.op(op));
    expect(ref.current!.spec).toMatchObject({ root: 'page' });
    act(() => ref.current!.abort());
    await settle();

    await act(async () => {
      await ref.current!.edit('second change');
    });
    expect(calls[2].body).toMatchObject({ mode: 'edit', prompt: 'second change' });
    expect(calls[2].body.prior_spec).toEqual(finished);
  });

  it('a press while an edit streams continues from the finished screen', async () => {
    const editStream = openReply();
    const { fetch, calls } = mockFetch([
      sseReply(payload(textOps('finished'))),
      editStream.reply,
      sseReply(payload(textOps('next'), 'gen_3')),
    ]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    const finished = JSON.parse(JSON.stringify(ref.current!.spec));

    act(() => {
      void ref.current!.edit('change');
    });
    await editStream.push(frame.started('gen_2'));
    for (const op of halfBuilt) await editStream.push(frame.op(op));
    await act(async () => {
      await ref.current!.continue({ action: 'go', params: {} });
    });
    // No screen is attached at all now, so the half-built one cannot leak either.
    expect(calls[2].body).not.toHaveProperty('mode');
    expect(calls[2].body).not.toHaveProperty('prior_spec');
    expect(JSON.stringify(calls[2].body)).not.toContain('elements');
    expect(finished).toBeTruthy();
  });

  it('a failed edit after an aborted one shows the finished screen, never the partial', async () => {
    const editStream = openReply();
    const { fetch, calls } = mockFetch([
      sseReply(payload(buttonOps)),
      editStream.reply,
      jsonError(422, 'VALIDATION_ERROR', 'Rejected'),
    ]);
    let handle: FraymeScreenHandle | undefined;
    const { container } = render(
      <FraymeScreen
        client={clientFor(fetch)}
        prompt="p"
        onAction={(_event, h) => {
          handle = h;
        }}
      />,
    );
    fireEvent.click(await screen.findByText('Refund'));

    act(() => {
      void handle!.edit('first');
    });
    await editStream.push(frame.started('gen_2'));
    await editStream.push(
      frame.op({ op: 'add', path: '/elements/page', value: { type: 'Stack', props: {}, children: ['b1', 'missing'] } }),
    );
    await editStream.push(frame.op({ op: 'replace', path: '/root', value: 'page' }));
    act(() => handle!.abort());
    await settle();

    await act(async () => {
      await handle!.edit('second');
    });
    expect(calls[2].body.prior_spec).toMatchObject({ root: 'b1' });
    expect(screen.getByRole('alert').textContent).toBe('Rejected');
    expect(container.querySelector('.frayme-invalid')).toBeNull();
    expect(screen.getByText('Refund')).toBeTruthy();
  });
});

describe('FraymeScreen: the generation id follows the screen shown', () => {
  it("reports the held screen's generation until the follow-up's first op", async () => {
    const editStream = openReply();
    const { fetch } = mockFetch([sseReply(payload(textOps('one'), 'gen_1')), editStream.reply]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    expect(ref.current!.generationId).toBe('gen_1');

    act(() => {
      void ref.current!.edit('change');
    });
    await editStream.push(frame.started('gen_2'));
    expect(ref.current!.spec).toMatchObject({ root: 't1', generation_id: 'gen_1' });
    expect(ref.current!.generationId).toBe('gen_1');

    await editStream.push(frame.op({ op: 'replace', path: '/elements/t1/props/text', value: 'two' }));
    expect(ref.current!.generationId).toBe('gen_2');
  });

  it('after a failed follow-up, reports the generation of the screen left up', async () => {
    const { fetch } = mockFetch([
      sseReply(payload(textOps('one'), 'gen_1')),
      sseReply(frame.started('gen_2') + frame.error('COMPOSITION_FAILED', 'Could not finish')),
    ]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    await act(async () => {
      await ref.current!.continue({ action: 'go', params: {} });
    });
    expect(ref.current!.status).toBe('error');
    expect(ref.current!.spec).toMatchObject({ generation_id: 'gen_1' });
    expect(ref.current!.generationId).toBe('gen_1');
  });
});

describe('FraymeScreen: trying again', () => {
  it('a continue lost to the network offers Try again, which sends the same request', async () => {
    const { fetch, calls } = mockFetch([
      sseReply(payload(buttonOps)),
      networkDown,
      sseReply(payload(textOps('Refunded'), 'gen_2')),
    ]);
    const { container } = render(
      <FraymeScreen client={clientFor(fetch)} prompt="Orders" onAction={(event, s) => s.continue(event)} />,
    );
    fireEvent.click(await screen.findByText('Refund'));
    const alert = await screen.findByRole('alert');
    // The pressed control is latched, and the screen it sits on stays up.
    expect(screen.getByText('Refund').closest('button')?.disabled).toBe(true);
    expect(container.querySelector('.frayme-invalid')).toBeNull();

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await screen.findByText('Refunded');
    expect(calls).toHaveLength(3);
    expect(calls[2].body).toEqual(calls[1].body);
    // The retried request is the same CREATE: the press named in the prompt, its
    // values in data, and no screen attached on either attempt.
    expect(calls[2].body).toMatchObject({
      prompt: 'The user pressed "Refund". Show the next step.',
      data: { orderId: 'A1' },
    });
    expect(calls[2].body).not.toHaveProperty('mode');
    expect(calls[2].body).not.toHaveProperty('prior_spec');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a first compose lost to the network can be tried again', async () => {
    const { fetch, calls } = mockFetch([networkDown, sseReply(payload(textOps('arrived')))]);
    render(<FraymeScreen client={clientFor(fetch)} prompt="p" />);
    const alert = await screen.findByRole('alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await screen.findByText('arrived');
    expect(calls[1].body).toEqual(calls[0].body);
  });

  it('retry() sends the failed request again, and does nothing when nothing failed', async () => {
    const { fetch, calls } = mockFetch([
      sseReply(payload(textOps('one'))),
      jsonError(503, 'MODEL_UNAVAILABLE', 'Busy'),
      sseReply(payload([], 'gen_2')),
    ]);
    const { ref } = probe({ client: clientFor(fetch), prompt: 'p' });
    await waitFor(() => expect(ref.current!.status).toBe('complete'));
    await act(async () => {
      await ref.current!.retry();
    });
    expect(calls).toHaveLength(1);

    await act(async () => {
      await ref.current!.edit('change');
    });
    expect(ref.current!.status).toBe('error');
    await act(async () => {
      await ref.current!.retry();
    });
    expect(calls).toHaveLength(3);
    expect(calls[2].body).toEqual(calls[1].body);
    expect(calls[2].body).toMatchObject({ mode: 'edit', prompt: 'change', prior_spec: { root: 't1' } });
    expect(ref.current!.status).toBe('complete');
  });

  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'AUTHENTICATION_REQUIRED'],
    [402, 'PAYMENT_REQUIRED'],
    [403, 'FORBIDDEN'],
    [422, 'VALIDATION_ERROR'],
    [429, 'QUOTA_EXCEEDED'],
  ])('no Try again after a %i %s, which would fail the same way', async (status, code) => {
    const { fetch } = mockFetch([jsonError(status, code, 'No')]);
    render(<FraymeScreen client={clientFor(fetch)} prompt="p" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('No');
    expect(within(alert).queryByRole('button')).toBeNull();
  });

  it.each([
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_SERVER_ERROR'],
    [503, 'MODEL_UNAVAILABLE'],
  ])('Try again after a %i %s, which may pass next time', async (status, code) => {
    const { fetch } = mockFetch([jsonError(status, code, 'Later')]);
    render(<FraymeScreen client={clientFor(fetch)} prompt="p" />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
