import { describe, expect, it, vi } from 'vitest';

import { FRAYME_ACTION_TOOL, createAgUiActionForwarder, fraymeActionToolDefinition } from '../src/ag-ui/index.js';
import { createDynamicActionForwarder } from '../src/ai-sdk/index.js';
import type { DynamicActionEvent } from '../src/core/events.js';

const ev: DynamicActionEvent = {
  action: 'doIt',
  params: { x: 1 },
  event: 'commit',
  state: { x: 1 },
  generation_id: 'g1',
};

/** A labelled Button's event as the renderer dispatches it: the payload `label` is folded into params. */
const pressed: DynamicActionEvent = {
  action: 'approveRefund',
  params: { label: 'Approve', orderId: '4821' },
  event: 'commit',
  element_id: 'approve',
  label: 'Approve',
  description: 'Refunds the order.',
};

describe('structured action forwarders', () => {
  it('ai-sdk onAction receives the FULL enriched event (lossless)', () => {
    const onAction = vi.fn();
    createDynamicActionForwarder({ onAction })(ev);
    expect(onAction).toHaveBeenCalledWith(ev);
  });

  it('ai-sdk falls back to sendMessage (text) when onAction is absent', () => {
    const sendMessage = vi.fn();
    createDynamicActionForwarder({ sendMessage })(ev);
    // The default text is threadText(action, params) — the humanized action name, then
    // one bullet per param (the thread-text shape; the receipt work made it
    // the forwarder default). The old `action: {json}` message shape is gone.
    // Under it, after a blank line, the state block (by design — the
    // agent reads name + params + STATE): `ev` carries a bound value, so it rides along.
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Do it\n- X: 1\n\nAlso recorded\n- X: 1' });
  });

  /**
   * THE THIRD CHANNEL. `onAction` always carried
   * `event.state`; the text path sent name + params and dropped it, so a Kanban
   * move the carrier gate had batched into `state._ui` reached a structured host
   * and vanished on a text one. The default text now appends `threadState` —
   * minus the firing control's own mirror entry, which threadText just printed.
   */
  it('ai-sdk default text carries the state block: the batched gestures and bound values, minus the press itself', () => {
    const sendMessage = vi.fn();
    const save: DynamicActionEvent = {
      action: 'saveBoard',
      params: { label: 'Save changes' },
      event: 'commit',
      element_id: 'save',
      label: 'Save changes',
      state: {
        board: [{ title: 'To do', cards: [] }, { title: 'In progress', cards: [{ title: 'Fix login bug' }] }],
        _ui: {
          board: { move: { card: 'Fix login bug', fromColumn: 'To do', toColumn: 'In progress', fromIndex: 0, toIndex: 1 } },
          save: { commit: { label: 'Save changes' } },
        },
      },
    };
    createDynamicActionForwarder({ sendMessage })(save);
    expect(sendMessage).toHaveBeenCalledWith({
      text: 'Save board\n\nAlso recorded\n- Board · move: Fix login bug, To do → In progress\n- Board: 2 items',
    });
  });

  it('ai-sdk includeState:false restores the name + params text alone', () => {
    const sendMessage = vi.fn();
    createDynamicActionForwarder({ sendMessage, includeState: false })(ev);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Do it\n- X: 1' });
  });

  it('ai-sdk sends threadText alone when the event has no state, or nothing in it beyond the press', () => {
    const sendMessage = vi.fn();
    createDynamicActionForwarder({ sendMessage })({ action: 'refreshFeed', params: {} });
    expect(sendMessage).toHaveBeenLastCalledWith({ text: 'Refresh feed' });
    createDynamicActionForwarder({ sendMessage })({ ...pressed, state: { _ui: { approve: { commit: { label: 'Approve' } } } } });
    expect(sendMessage).toHaveBeenLastCalledWith({ text: 'Approve refund\n- Order ID: 4821' });
    // a state that is not an object is nothing to say, never a throw
    createDynamicActionForwarder({ sendMessage })({ ...pressed, state: 'junk' as unknown as Record<string, unknown> });
    expect(sendMessage).toHaveBeenLastCalledWith({ text: 'Approve refund\n- Order ID: 4821' });
  });

  /**
   * The thread shape is "the action name, then its params — no button
   * label". A Button's payload `{ label }` is folded into params by the renderer,
   * so without the receipt rule the default text read "Approve refund / Label:
   * Approve / Order ID: 4821". The card drops the same entry
   * (core/receipt.ts paramsWithoutTitleLabel); the two surfaces must agree.
   */
  it('ai-sdk default text leaves the pressed control\'s own label OUT of the bullets', () => {
    const sendMessage = vi.fn();
    createDynamicActionForwarder({ sendMessage })(pressed);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Approve refund\n- Order ID: 4821' });
    // an authored `label` param that DIFFERS from the control's label is data and stays
    createDynamicActionForwarder({ sendMessage })({ ...pressed, params: { label: 'Shelf A', orderId: '4821' } });
    expect(sendMessage).toHaveBeenLastCalledWith({ text: 'Approve refund\n- Label: Shelf A\n- Order ID: 4821' });
  });

  it('ai-sdk hands a custom `format` the params AS DISPATCHED plus the full event', () => {
    const sendMessage = vi.fn();
    const format = vi.fn((action: string, params: Record<string, unknown>, event: DynamicActionEvent) =>
      `${event.label ?? action}: ${Object.keys(params).join(',')} — ${event.description ?? ''}`);
    createDynamicActionForwarder({ sendMessage, format })(pressed);
    expect(format).toHaveBeenCalledWith('approveRefund', pressed.params, pressed);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Approve: label,orderId — Refunds the order.' });
  });

  it('ai-sdk custom `format` is unaffected by the state block — it replaces the whole text', () => {
    const sendMessage = vi.fn();
    const format = (action: string): string => `custom:${action}`;
    createDynamicActionForwarder({ sendMessage, format })({ ...ev, state: { region: 'EU', _ui: { r: { change: { value: 'EU' } } } } });
    expect(sendMessage).toHaveBeenCalledWith({ text: 'custom:doIt' });
    createDynamicActionForwarder({ sendMessage, format, includeState: true })(ev);
    expect(sendMessage).toHaveBeenLastCalledWith({ text: 'custom:doIt' });
  });

  it('ai-sdk prefers onAction over sendMessage when both are set', () => {
    const onAction = vi.fn();
    const sendMessage = vi.fn();
    createDynamicActionForwarder({ onAction, sendMessage })(ev);
    expect(onAction).toHaveBeenCalledOnce();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ag-ui forwarder emits a structured CUSTOM payload carrying the event', () => {
    const emit = vi.fn();
    createAgUiActionForwarder({ emit })(ev);
    expect(emit).toHaveBeenCalledWith({ name: FRAYME_ACTION_TOOL, value: ev });
  });

  /**
   * The frontend-tool schema must declare every field the forwarder sends: a host
   * deriving its handler's typed args from it (CopilotKit useFrontendTool, a
   * strict-mode registration) sees only what the schema names. `label` and
   * `description` arrived unnamed until the receipt work — the
   * same drift element_id had before the carrier gate.
   */
  it('ag-ui tool schema declares every enriched-event field, the receipt fields included', () => {
    const keys = Object.keys(fraymeActionToolDefinition.parameters.properties);
    for (const k of ['action', 'event', 'params', 'state', 'element_id', 'generation_id', 'label', 'description']) {
      expect(keys, `schema names ${k}`).toContain(k);
    }
    expect(fraymeActionToolDefinition.parameters.properties.label.type).toBe('string');
    expect(fraymeActionToolDefinition.parameters.properties.description.type).toBe('string');
    expect(fraymeActionToolDefinition.parameters.required).toEqual(['action']);
  });
});
