import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/* Radio.options was typed string[], but models consistently emit [{label,value}]
   — every other option component in the catalog takes that shape. The object
   then reached the option <span> as a raw React child and threw "Objects are not
   valid as a React child", which unmounted the whole subtree: most affected specs
   rendered a BLANK CARD, not just a broken field. These tests pin the render, the
   emitted value, and the blast radius. */

/* eslint-disable @typescript-eslint/no-explicit-any */
const OBJ = [
  { value: 'classic', label: 'Classic Room - $189' },
  { value: 'deluxe', label: 'Deluxe Room - $259' },
];

function draw(options: any, on: any = {}) {
  const onAction = vi.fn();
  const spec: any = {
    root: 'c',
    elements: {
      c: { type: 'Card', props: { title: 'Pick a room' }, children: ['r'] },
      r: { type: 'Radio', props: { label: 'Room', name: 'room', options }, on },
    },
    state: {},
    actions: { doIt: { kind: 'agent' } },
  };
  /* Radio is not a carrier under the dynamic-action gate (core/dynamic-gate.ts):
     its declared change stays local by default. The gate is WIDENED here so the
     option-VALUE assertion below can read the dispatched params. */
  const r = render(
    <FraymeRenderer spec={spec} mode="progressive" onDynamicAction={onAction} dynamicActionTypes={['Button', 'DataTable', 'Radio']} />,
  );
  return { r, onAction };
}

describe('Radio accepts {label,value} options', () => {
  it('renders the label text of each object option', () => {
    const { r } = draw(OBJ);
    expect(r.container.textContent).toContain('Classic Room - $189');
    expect(r.container.textContent).toContain('Deluxe Room - $259');
  });

  it('renders one radio input per option, carrying the VALUE not the label', () => {
    const { r } = draw(OBJ);
    const inputs = [...r.container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect(inputs.map((i) => i.value)).toEqual(['classic', 'deluxe']);
  });

  it('never prints "[object Object]" (the pre-fix stringification)', () => {
    const { r } = draw(OBJ);
    expect(r.container.textContent).not.toContain('[object Object]');
  });

  it('does not blank the surrounding card (the real blast radius)', () => {
    // The crash unmounted the whole subtree, so the sibling copy vanished too.
    const { r } = draw(OBJ);
    expect(r.container.textContent, 'the Card title must survive').toContain('Pick a room');
    expect(r.container.querySelectorAll('input[type="radio"]').length).toBeGreaterThan(0);
  });

  it('emits the option VALUE on change, not the object', () => {
    const { r, onAction } = draw(OBJ, { change: { action: 'doIt', confirm: false } });
    const inputs = [...r.container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
    fireEvent.click(inputs[1]!);
    const params = onAction.mock.calls.map((c) => c[0]?.params).find((p) => p?.value != null);
    expect(params?.value).toBe('deluxe');
  });

  it('still renders the plain string form unchanged', () => {
    const { r } = draw(['Standard', 'Express']);
    const inputs = [...r.container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(['Standard', 'Express']);
    expect(r.container.textContent).toContain('Standard');
  });

  it('survives a malformed option instead of taking the card down', () => {
    // Defence in depth: the filter drops anything without a string `value`.
    const { r } = draw([{ label: 'no value' }, 'Standard', null]);
    expect(r.container.textContent).toContain('Pick a room');
    expect(r.container.querySelectorAll('input[type="radio"]').length).toBe(1);
  });
});
