/**
 * Upstream contract gate — verifies @json-render/react@0.19 behaves as documented in
 * src/react/upstream.ts, using a minimal hand-rolled component map (no Frayme
 * code). If this fails after an upstream bump, fix upstream.ts first.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import {
  JSONUIProvider,
  Renderer,
  type ComponentRegistry,
  type ComponentRenderProps,
} from '../src/react/upstream.js';

const miniRegistry: ComponentRegistry = {
  Card: ({ element, children }: ComponentRenderProps) => (
    <section data-testid="card">
      <h3>{(element.props as { title?: string }).title}</h3>
      {children}
    </section>
  ),
  Text: ({ element }: ComponentRenderProps) => <p>{(element.props as { text: string }).text}</p>,
  Button: ({ element, emit }: ComponentRenderProps) => (
    <button onClick={() => emit('press')}>{(element.props as { label: string }).label}</button>
  ),
};

const spec = {
  root: 'card1',
  elements: {
    card1: { type: 'Card', props: { title: 'Hello' }, children: ['t1', 'b1'] },
    t1: { type: 'Text', props: { text: 'World' } },
    b1: {
      type: 'Button',
      props: { label: 'Go' },
      on: { press: { action: 'ping', params: { from: 'b1' } } },
    },
  },
  state: {},
} as unknown as Spec;

describe('upstream contract', () => {
  it('renders a nested spec through registry components with children', () => {
    render(
      <JSONUIProvider registry={miniRegistry} initialState={{}}>
        <Renderer spec={spec} registry={miniRegistry} />
      </JSONUIProvider>,
    );
    expect(screen.getByTestId('card')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText('World')).toBeTruthy();
  });

  it('emit("press") resolves the element `on` binding to a named action handler', () => {
    const ping = vi.fn();
    render(
      <JSONUIProvider registry={miniRegistry} initialState={{}} handlers={{ ping }}>
        <Renderer spec={spec} registry={miniRegistry} />
      </JSONUIProvider>,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(ping).toHaveBeenCalledTimes(1);
    expect(ping.mock.calls[0]![0]).toMatchObject({ from: 'b1' });
  });
});
