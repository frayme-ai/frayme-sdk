import { fireEvent, render, screen } from '@testing-library/react';
import type { Spec } from '@json-render/core';
import { describe, expect, it, vi } from 'vitest';

import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/**
 * Ingestion hook: `normalizeSpecProps` canonicalizes a spec's `on` event
 * keys, so a Button (which emits the canonical `commit`) fires for BOTH a
 * canonical `on:{commit}` key (the model-facing vocabulary) AND a legacy
 * `on:{press}` key (back-compat with older specs).
 */
const buttonOn = (key: string): Spec =>
  ({
    root: 'b1',
    elements: {
      b1: {
        type: 'Button',
        props: { label: 'Go', variant: 'primary', disabled: false },
        on: { [key]: { action: 'do_it', params: { x: 1 }, confirm: false } },
      },
    },
    state: {},
  }) as unknown as Spec;

describe('canonical on-key resolution', () => {
  it('fires a canonical on:{commit} key', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonOn('commit')}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    const ev = onDynamicAction.mock.calls[0]![0];
    expect(ev).toMatchObject({ action: 'do_it', params: { x: 1 } });
    // the enriched event carries the canonical verb + a live state snapshot.
    expect(ev.event).toBe('commit');
    expect(ev.state).toBeDefined();
  });

  it('still fires a legacy on:{press} key (back-compat — Paris demo)', () => {
    const onDynamicAction = vi.fn();
    render(
      <FraymeRenderer
        spec={buttonOn('press')}
        mode="progressive"
        onDynamicAction={onDynamicAction}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
    expect(onDynamicAction.mock.calls[0]![0]).toMatchObject({ action: 'do_it', params: { x: 1 } });
  });
});
