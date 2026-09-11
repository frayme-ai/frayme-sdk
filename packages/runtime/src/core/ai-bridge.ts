import type { ComposeStream } from '@frayme/api';
import type { JsonPatch, Spec, SpecDataPart } from '@json-render/core';

const EMPTY_SPEC: Spec = { root: null, elements: {} } as unknown as Spec;

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
 *
 * Lives in the server-safe core because "use client" modules cannot be
 * imported from route handlers.
 */
export async function* composeStreamToDataParts(
  stream: ComposeStream,
): AsyncGenerator<SpecDataPart, void, undefined> {
  for await (const event of stream) {
    switch (event.type) {
      case 'op': {
        const { type: _type, ...patch } = event;
        yield { type: 'patch', patch: patch as unknown as JsonPatch };
        break;
      }
      case 'compose.restarted':
        yield { type: 'flat', spec: EMPTY_SPEC };
        break;
      case 'compose.completed':
        yield { type: 'flat', spec: stream.currentSpec() };
        break;
      default:
        break;
    }
  }
}
