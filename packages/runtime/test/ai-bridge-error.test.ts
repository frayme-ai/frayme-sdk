/**
 * The server-side bridge on failure (core/ai-bridge.ts), and the part type the
 * server-safe root now exports.
 *
 * A stream that fails after some ops has shown a half-built screen that will
 * never be confirmed. The bridge writes one empty flat part before rethrowing,
 * so the client clears it; the error still reaches the route handler.
 */
import { readFileSync } from 'node:fs';
import { SPEC_DATA_PART_TYPE as jsonRenderPartType } from '@json-render/core';
import { describe, expect, it } from 'vitest';
import { SPEC_DATA_PART_TYPE as aiSdkPartType } from '../src/ai-sdk/index.js';
import { composeStreamToDataParts, SPEC_DATA_PART_TYPE as corePartType } from '../src/core/ai-bridge.js';
import * as root from '../src/index.js';

type Event = Record<string, unknown>;

/** A ComposeStream stand-in that yields `events`, then throws `error` if given. */
function failingStream(events: Event[], error?: Error) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
      if (error) throw error;
    },
    currentSpec: () => ({ root: 'final', elements: {} }),
  } as never;
}

async function drain(stream: never) {
  const parts: Record<string, unknown>[] = [];
  let thrown: unknown;
  try {
    for await (const part of composeStreamToDataParts(stream)) parts.push(part as unknown as Record<string, unknown>);
  } catch (err) {
    thrown = err;
  }
  return { parts, thrown };
}

const op = (path: string, value: unknown): Event => ({ type: 'op', op: 'add', path, value });

describe('composeStreamToDataParts on failure', () => {
  it('clears the screen with an empty flat part, then rethrows the same error', async () => {
    const boom = new Error('connection lost');
    const { parts, thrown } = await drain(
      failingStream([{ type: 'compose.started', generation_id: 'g', model: 'm' }, op('/root', 't1')], boom),
    );
    expect(parts).toEqual([
      { type: 'patch', patch: { op: 'add', path: '/root', value: 't1' } },
      { type: 'flat', spec: { root: null, elements: {} } },
    ]);
    expect(thrown).toBe(boom);
  });

  it('clears even when the stream fails before any event', async () => {
    const boom = new Error('401');
    const { parts, thrown } = await drain(failingStream([], boom));
    expect(parts).toEqual([{ type: 'flat', spec: { root: null, elements: {} } }]);
    expect(thrown).toBe(boom);
  });

  it('a stream that completes is unchanged: no extra part, no throw', async () => {
    const { parts, thrown } = await drain(
      failingStream([
        op('/root', 't1'),
        { type: 'compose.completed', generation_id: 'g', model: 'm', operation_count: 1 },
      ]),
    );
    expect(thrown).toBeUndefined();
    expect(parts.map((p) => p.type)).toEqual(['patch', 'flat']);
    expect(parts[1]).toEqual({ type: 'flat', spec: { root: 'final', elements: {} } });
  });

  it('every empty spec is a new object, so a client patching one cannot touch another', async () => {
    const { parts } = await drain(
      failingStream(
        [{ type: 'compose.restarted', generation_id: 'g', model: 'm', reason: { code: 'x' } }],
        new Error('then failed'),
      ),
    );
    const [restart, failure] = parts as { spec: { elements: Record<string, unknown> } }[];
    expect(restart.spec).toEqual(failure.spec);
    expect(restart.spec).not.toBe(failure.spec);
    restart.spec.elements.leaked = { type: 'Text' };
    expect(failure.spec.elements).toEqual({});
  });
});

describe('SPEC_DATA_PART_TYPE', () => {
  it("is 'data-spec' everywhere it is exported", () => {
    expect(corePartType).toBe('data-spec');
    expect(root.SPEC_DATA_PART_TYPE).toBe('data-spec');
    expect(aiSdkPartType).toBe(jsonRenderPartType);
    expect(corePartType).toBe(jsonRenderPartType);
  });

  it('the server-safe bridge imports only types from json-render', () => {
    // cwd-relative, as css-specificity.test.ts reads files (vitest runs from the package root).
    const source = readFileSync('src/core/ai-bridge.ts', 'utf8');
    const imports = source.match(/^import .* from '@json-render\/core';$/gm) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line.startsWith('import type ')).toBe(true);
  });
});
