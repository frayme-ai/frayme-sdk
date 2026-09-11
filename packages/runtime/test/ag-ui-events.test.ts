import { describe, expect, it } from 'vitest';
import { foldSpecPart, specPartFromAgUiEvent, FRAYME_SPEC_EVENT } from '../src/ag-ui/events.js';
import type { Spec, SpecDataPart } from '@json-render/core';

describe('specPartFromAgUiEvent', () => {
  it('extracts SpecDataParts only from CUSTOM frayme:spec events', () => {
    const part: SpecDataPart = { type: 'flat', spec: { root: 'a', elements: {} } as unknown as Spec };
    expect(specPartFromAgUiEvent({ type: 'CUSTOM', name: FRAYME_SPEC_EVENT, value: part })).toEqual(part);
    expect(specPartFromAgUiEvent({ type: 'CUSTOM', name: 'other', value: part })).toBeUndefined();
    expect(specPartFromAgUiEvent({ type: 'TEXT_MESSAGE_CONTENT', delta: 'x' })).toBeUndefined();
    expect(specPartFromAgUiEvent(null)).toBeUndefined();
  });
});

describe('foldSpecPart', () => {
  it('flat replaces the snapshot (= restart semantics); patch applies incrementally', () => {
    const s1 = foldSpecPart(null, { type: 'patch', patch: { op: 'add', path: '/root', value: 'a' } });
    const s2 = foldSpecPart(s1, {
      type: 'patch',
      patch: { op: 'add', path: '/elements/a', value: { type: 'Text', props: { text: 'hi' } } },
    });
    expect((s2 as { root?: string }).root).toBe('a');
    expect((s2 as { elements: Record<string, unknown> }).elements.a).toBeTruthy();

    const replacement = { root: 'b', elements: {} } as unknown as Spec;
    const s3 = foldSpecPart(s2, { type: 'flat', spec: replacement });
    expect(s3).toBe(replacement);
  });
});
