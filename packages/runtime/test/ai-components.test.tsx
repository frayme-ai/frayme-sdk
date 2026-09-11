/**
 * AI + filter + social family regression tests — ai-chat / ai-content /
 * ai-flow / filter-compose / social-media. Follows test/value-channels.test.tsx
 * patterns:
 *   - render via FraymeRenderer mode="progressive"
 *   - additive props → the UNSET render is BYTE-IDENTICAL to the prop being absent
 *   - behavioral items → userEvent/fireEvent + assert DOM / DynamicActionEvent
 * Intrinsic-payload items go through the REAL emit→handlers pipeline with
 * an `on` block + onDynamicAction, the intrinsic-payloads.test.tsx setup.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

/** Render a single element WITH an `on` block + onDynamicAction, for the real
 *  emit→handlers→dispatch pipeline (intrinsic payload assertions). */
function drawWithHandler(
  type: string,
  props: Record<string, unknown>,
  on: Record<string, unknown>,
) {
  const onDynamicAction = vi.fn();
  const spec = {
    root: 'el',
    elements: { el: { type, props, on } },
    state: {},
  } as unknown as Spec;
  // The host under test is widened INTO the dynamic-action gate (core/dynamic-
  // gate.ts): PromptInput is not a carrier by default, and these assertions are
  // about the intrinsic payload it sends when it is allowed to dispatch.
  const utils = render(
    <FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onDynamicAction} dynamicActionTypes={['Button', 'DataTable', type]} />,
  );
  return { onDynamicAction, ...utils };
}

/** Canonicalise React's per-MOUNT `useId` token. Trigger↔panel ids (aria-controls)
 *  carry it so two `repeat` rows cannot share one id; two separate renders then
 *  differ in that token alone, which has nothing to do with the null-vs-absent
 *  question below. Measured: without this the assertion fails even when both
 *  sides are given IDENTICAL props, i.e. it would stop testing props at all. */
const canonIds = (html: string): string => html.replace(/_r_[0-9a-z]+_/g, '_rID_');

/** innerHTML with prop set to null vs the prop absent must be byte-identical. */
function assertUnsetByteIdentical(type: string, base: Record<string, unknown>, channel: string) {
  const withNull = draw(type, { ...base, [channel]: null });
  const nullHtml = withNull.container.innerHTML;
  withNull.unmount();
  const without = draw(type, { ...base });
  expect(canonIds(nullHtml)).toBe(canonIds(without.container.innerHTML));
}

/* ── Message — avatar column ───────────────────────────────────────── */

describe('Message avatar column', () => {
  it('hides the avatar bubble when there is no avatar AND no derivable initials', () => {
    const { container } = draw('Message', { role: 'assistant', content: 'Hi' });
    // No author → initials '' → no avatar bubble (would be an empty grey circle).
    expect(container.querySelector('.rounded-full')).toBeNull();
  });

  it('shows the avatar bubble (initials) when author is present', () => {
    const { container } = draw('Message', { role: 'assistant', author: 'Ada Lovelace', content: 'Hi' });
    const bubble = container.querySelector('span.rounded-full');
    expect(bubble).not.toBeNull();
    expect(bubble!.textContent).toBe('AL');
  });

  it('showAvatar:false force-hides the bubble even when initials exist', () => {
    const { container } = draw('Message', {
      role: 'assistant',
      author: 'Ada Lovelace',
      content: 'Hi',
      showAvatar: false,
    });
    expect(container.querySelector('span.rounded-full')).toBeNull();
  });

  it('showAvatar unset is byte-identical to absent (author present)', () => {
    assertUnsetByteIdentical('Message', { role: 'assistant', author: 'Ada', content: 'Hi' }, 'showAvatar');
  });
});

/* ── Conversation — autoScroll ─────────────────────────────────────── */

describe('Conversation autoScroll', () => {
  it('pins scrollTop to scrollHeight after render when autoScroll is on (default)', () => {
    // jsdom leaves scrollHeight 0 by default; stub it so the effect has an effect.
    const proto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 500 });
    try {
      const { container } = draw('Conversation', {});
      const log = container.querySelector('[role="log"]') as HTMLElement;
      expect(log.scrollTop).toBe(500);
    } finally {
      if (proto) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', proto);
    }
  });

  it('does NOT scroll when autoScroll:false', () => {
    const proto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 500 });
    try {
      const { container } = draw('Conversation', { autoScroll: false });
      const log = container.querySelector('[role="log"]') as HTMLElement;
      expect(log.scrollTop).toBe(0);
    } finally {
      if (proto) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', proto);
    }
  });

  it('autoScroll unset is byte-identical to absent (no markup change)', () => {
    assertUnsetByteIdentical('Conversation', { bordered: true }, 'autoScroll');
  });
});

/* ── PromptInput — attach button → commit {control:'attach'} ────────── */

describe('PromptInput attach button', () => {
  it('the attach button emits `commit` with intrinsic params {control:"attach"}', () => {
    const { onDynamicAction } = drawWithHandler(
      'PromptInput',
      { attach: true, placeholder: 'Ask…' },
      { commit: { action: 'do_attach' } },
    );
    fireEvent.click(screen.getByLabelText('Attach file'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({
      action: 'do_attach',
      event: 'commit',
      params: { control: 'attach' },
    });
  });

  it('the attach button no-ops while loading', () => {
    const { onDynamicAction } = drawWithHandler(
      'PromptInput',
      { attach: true, loading: true },
      { commit: { action: 'do_attach' } },
    );
    fireEvent.click(screen.getByLabelText('Attach file'));
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('the send path still emits commit {value} (no control key)', () => {
    const { onDynamicAction } = drawWithHandler(
      'PromptInput',
      { attach: true, value: 'hello' },
      { commit: { action: 'send' } },
    );
    fireEvent.click(screen.getByLabelText('Send message'));
    const call = onDynamicAction.mock.calls[0]![0];
    expect(call.params).toMatchObject({ value: 'hello' });
    expect(call.params.control).toBeUndefined();
  });
});

/* ── Artifact — copy button labels ─────────────────────────────────── */

describe('Artifact copy labels', () => {
  it('defaults to Copy and applies copyLabel override', () => {
    const { container: base } = draw('Artifact', { title: 't', content: 'x' });
    expect(base.textContent).toContain('Copy');
    const { getByText } = draw('Artifact', { title: 't', content: 'x', copyLabel: 'Copier' });
    expect(getByText('Copier')).not.toBeNull();
  });

  it('copyLabel/copiedLabel unset are byte-identical to absent', () => {
    assertUnsetByteIdentical('Artifact', { title: 't', content: 'x' }, 'copyLabel');
    assertUnsetByteIdentical('Artifact', { title: 't', content: 'x' }, 'copiedLabel');
  });
});

/* ── DiffView — maxHeight scroll body ──────────────────────────────── */

describe('DiffView maxHeight', () => {
  it('maxHeight adds a capped scroll wrapper reading --fr-diff-maxh', () => {
    const { container } = draw('DiffView', { before: 'a\nb', after: 'a\nc', maxHeight: '400px' });
    // the figure carries the validated var
    const figure = container.querySelector('figure')!;
    expect(figure.getAttribute('style') ?? '').toContain('--fr-diff-maxh');
    // a scroll wrapper reading the var wraps the body
    const wrapper = container.querySelector('.overflow-y-auto');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain('[max-height:var(--fr-diff-maxh)]');
  });

  it('maxHeight unset is byte-identical to absent (no wrapper, no var)', () => {
    assertUnsetByteIdentical('DiffView', { before: 'a\nb', after: 'a\nc' }, 'maxHeight');
    const { container } = draw('DiffView', { before: 'a\nb', after: 'a\nc' });
    expect(container.querySelector('.overflow-y-auto')).toBeNull();
    expect(container.querySelector('figure')!.getAttribute('style') ?? '').not.toContain('--fr-diff-maxh');
  });
});

/* ── Reasoning — header text ───────────────────────────────────────── */

describe('Reasoning headerLabel', () => {
  it('defaults to the English header (with/without duration)', () => {
    expect(draw('Reasoning', { content: 'x' }).container.textContent).toContain('Thought process');
    expect(draw('Reasoning', { content: 'x', duration: '4s' }).container.textContent).toContain('Thought for 4s');
  });

  it('headerLabel substitutes the {duration} placeholder', () => {
    const { container } = draw('Reasoning', { content: 'x', duration: '4s', headerLabel: 'Réfléchi {duration}' });
    expect(container.textContent).toContain('Réfléchi 4s');
    expect(container.textContent).not.toContain('Thought');
  });

  it('headerLabel with no duration renders an empty substitution', () => {
    const { container } = draw('Reasoning', { content: 'x', headerLabel: 'Thinking {duration}' });
    expect(container.textContent).toContain('Thinking');
  });

  it('headerLabel unset is byte-identical to absent', () => {
    assertUnsetByteIdentical('Reasoning', { content: 'x', duration: '4s' }, 'headerLabel');
  });
});

/* ── ToolCall — state pill + section labels ────────────────────────── */

describe('ToolCall labels', () => {
  it('defaults to Done/Input/Output; overrides apply', () => {
    const base = draw('ToolCall', { name: 'run', state: 'success', input: 'i', output: 'o', defaultOpen: true });
    expect(base.container.textContent).toContain('Done');
    expect(base.container.textContent).toContain('Input');
    expect(base.container.textContent).toContain('Output');
    const over = draw('ToolCall', {
      name: 'run',
      state: 'success',
      input: 'i',
      output: 'o',
      defaultOpen: true,
      stateLabels: { success: 'Terminé' },
      inputLabel: 'Entrée',
      outputLabel: 'Sortie',
    });
    expect(over.container.textContent).toContain('Terminé');
    expect(over.container.textContent).toContain('Entrée');
    expect(over.container.textContent).toContain('Sortie');
    expect(over.container.textContent).not.toContain('Done');
  });

  it('a partial stateLabels object falls back to English for unspecified states', () => {
    const { container } = draw('ToolCall', {
      name: 'run',
      state: 'running',
      stateLabels: { success: 'Terminé' },
    });
    expect(container.textContent).toContain('Running');
  });

  it('label channels unset are byte-identical to absent', () => {
    const base = { name: 'run', state: 'success', input: 'i', output: 'o', defaultOpen: true };
    assertUnsetByteIdentical('ToolCall', base, 'stateLabels');
    assertUnsetByteIdentical('ToolCall', base, 'inputLabel');
    assertUnsetByteIdentical('ToolCall', base, 'outputLabel');
  });
});

/* ── RichComposer — disabled / loading ─────────────────────────────── */

describe('RichComposer disabled/loading', () => {
  it('disabled blocks the editor + toolbar + send and dims the surface', () => {
    const { container } = draw('RichComposer', { disabled: true });
    const editor = container.querySelector('[role="textbox"]') as HTMLElement;
    // contentEditable is off
    expect(editor.getAttribute('contenteditable')).toBe('false');
    expect(editor.getAttribute('aria-disabled')).toBe('true');
    // toolbar + send buttons are disabled
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    // the composer root surface dims (it is the parent of the formatting toolbar)
    const root = container.querySelector('[role="toolbar"]')!.parentElement as HTMLElement;
    expect(root.className).toContain('opacity-60');
  });

  it('loading shows the send spinner + aria-busy and blocks submit', () => {
    const { onDynamicAction, container } = drawWithHandler(
      'RichComposer',
      { loading: true },
      { commit: { action: 'send' } },
    );
    const root = container.querySelector('[aria-busy="true"]');
    expect(root).not.toBeNull();
    // a spinner (animate-spin) sits in the send button, not the send Icon
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    // clicking send no-ops while loading
    const send = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Send'))!;
    fireEvent.click(send);
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('disabled/loading unset are byte-identical to absent', () => {
    assertUnsetByteIdentical('RichComposer', { placeholder: 'Write…' }, 'disabled');
    assertUnsetByteIdentical('RichComposer', { placeholder: 'Write…' }, 'loading');
  });
});

/* ── FeedItem + Comment — action active + count format ─────────────── */

describe('FeedItem/Comment action active + count format', () => {
  it('FeedItem: an active action reads the accent chain; a resting action reads the muted chain', () => {
    const { container } = draw('FeedItem', {
      authorName: 'Ada',
      body: 'hi',
      accent: '#ff0000',
      actions: [
        { icon: 'heart', label: 'Like', count: 3, active: true },
        { icon: 'send', label: 'Share', count: 1 },
      ],
    });
    const buttons = [...container.querySelectorAll('button')];
    const like = buttons.find((b) => b.getAttribute('aria-label') === 'Like')!;
    const share = buttons.find((b) => b.getAttribute('aria-label') === 'Share')!;
    // active → accent reader + aria-pressed; resting → muted reader, no accent
    expect(like.className).toContain('[color:var(--fr-feed-accent,var(--fr-accent))]');
    expect(like.getAttribute('aria-pressed')).toBe('true');
    expect(share.className).toContain('[color:var(--fr-feed-muted,var(--color-muted-foreground))]');
    expect(share.className).not.toContain('--fr-feed-accent');
    expect(share.getAttribute('aria-pressed')).toBeNull();
    // the accent var rides the article
    expect(container.querySelector('article')!.getAttribute('style') ?? '').toContain('--fr-feed-accent');
  });

  it('FeedItem: countFormat "compact" abbreviates the counter (24000 → 24k)', () => {
    const { container } = draw('FeedItem', {
      authorName: 'Ada',
      body: 'hi',
      countFormat: 'compact',
      actions: [{ icon: 'heart', label: 'Like', count: 24000 }],
    });
    expect(container.textContent).toContain('24k');
    expect(container.textContent).not.toContain('24000');
  });

  it('FeedItem: default countFormat renders the raw number', () => {
    const { container } = draw('FeedItem', {
      authorName: 'Ada',
      body: 'hi',
      actions: [{ icon: 'heart', label: 'Like', count: 24000 }],
    });
    expect(container.textContent).toContain('24000');
  });

  it('Comment: an active action reads the comment accent chain', () => {
    const { container } = draw('Comment', {
      authorName: 'Grace',
      body: 'nice',
      accent: '#00ff00',
      actions: [{ icon: 'heart', label: 'Like', count: 2, active: true }],
    });
    const like = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Like')!;
    expect(like.className).toContain('[color:var(--fr-comment-accent,var(--fr-accent))]');
    expect(like.getAttribute('aria-pressed')).toBe('true');
  });

  it('FeedItem: no active action + default format is byte-identical to before (accent/countFormat unset)', () => {
    const base = {
      authorName: 'Ada',
      body: 'hi',
      actions: [
        { icon: 'heart', label: 'Like', count: 24 },
        { icon: 'send', label: 'Share', count: 3 },
      ],
    };
    assertUnsetByteIdentical('FeedItem', base, 'accent');
    assertUnsetByteIdentical('FeedItem', base, 'countFormat');
  });

  it('Comment: accent/countFormat unset are byte-identical to absent', () => {
    const base = {
      authorName: 'Grace',
      body: 'nice',
      actions: [{ icon: 'heart', label: 'Like', count: 2 }],
    };
    assertUnsetByteIdentical('Comment', base, 'accent');
    assertUnsetByteIdentical('Comment', base, 'countFormat');
  });
});
