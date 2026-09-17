import type { ComposeStream } from '@frayme/api';
import type { JsonPatch, Spec, SpecDataPart } from '@json-render/core';

/**
 * The AI SDK part type json-render's `buildSpecFromParts` reads: `'data-spec'`.
 * Declared here rather than re-exported from `@json-render/core` so the
 * server-safe root stays free of runtime imports from it (only its types are
 * used here). The ai-sdk subpath re-exports json-render's own constant, and a
 * test pins the two to the same string.
 */
export const SPEC_DATA_PART_TYPE = 'data-spec' as const;

/**
 * A NEW empty spec per part. json-render's `buildSpecFromParts` folds a flat
 * part in with `Object.assign`, so the client's accumulator ends up holding this
 * object's `elements` and patches it in place; one shared constant would carry
 * the elements of one message into the next.
 */
function emptySpec(): Spec {
  return { root: null, elements: {} } as unknown as Spec;
}

/**
 * SERVER-SIDE bridge: turn a Frayme {@link ComposeStream} into json-render
 * `data-spec` parts for an AI SDK UI message stream.
 *
 *   const stream = frayme.compose.stream({ prompt });
 *   for await (const part of composeStreamToDataParts(stream)) {
 *     writer.write({ type: 'data-spec', data: part });
 *   }
 *
 * Mapping:
 *  - `op`                → `{ type: 'patch', patch }`   (progressive render)
 *  - `compose.restarted` → `{ type: 'flat', spec: EMPTY }` (client discards everything)
 *  - `compose.completed` → `{ type: 'flat', spec: final }` (validated commit)
 *  - the stream throws   → `{ type: 'flat', spec: EMPTY }`, then the error is
 *                          rethrown. Ops before a failure are provisional and
 *                          the failure means they will never be confirmed, so
 *                          the half-built screen is cleared rather than left
 *                          looking finished; the caller still sees the error.
 *
 * Lives in the server-safe core because "use client" modules cannot be
 * imported from route handlers.
 */
export async function* composeStreamToDataParts(
  stream: ComposeStream,
): AsyncGenerator<SpecDataPart, void, undefined> {
  try {
    for await (const event of stream) {
      switch (event.type) {
        case 'op': {
          const { type: _type, ...patch } = event;
          yield { type: 'patch', patch: patch as unknown as JsonPatch };
          break;
        }
        case 'compose.restarted':
          yield { type: 'flat', spec: emptySpec() };
          break;
        case 'compose.completed':
          yield { type: 'flat', spec: stream.currentSpec() };
          break;
        default:
          break;
      }
    }
  } catch (err) {
    yield { type: 'flat', spec: emptySpec() };
    throw err;
  }
}
