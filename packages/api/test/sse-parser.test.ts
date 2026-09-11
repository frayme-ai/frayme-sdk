import { describe, expect, it } from 'vitest';
import { parseSSE, type SSEMessage } from '../src/core/sse.js';
import { sseStream } from './helpers/fixtures.js';

async function collect(stream: ReadableStream<Uint8Array>): Promise<SSEMessage[]> {
  const out: SSEMessage[] = [];
  for await (const msg of parseSSE(stream)) out.push(msg);
  return out;
}

const CANONICAL =
  ': ping\n\n' +
  'event: compose.started\ndata: {"a":1}\n\n' +
  'event: op\ndata: {"emoji":"héllo ✨"}\n\n' +
  ': ping\n\n' +
  'event: compose.completed\ndata: {"done":true}\n\n';

const EXPECTED: SSEMessage[] = [
  { event: 'compose.started', data: '{"a":1}' },
  { event: 'op', data: '{"emoji":"héllo ✨"}' },
  { event: 'compose.completed', data: '{"done":true}' },
];

describe('parseSSE', () => {
  it('parses the canonical payload in one chunk', async () => {
    expect(await collect(sseStream(CANONICAL))).toEqual(EXPECTED);
  });

  it('yields identical events for EVERY possible 2-chunk byte split (incl. mid-UTF-8)', async () => {
    const total = new TextEncoder().encode(CANONICAL).byteLength;
    for (let split = 1; split < total; split++) {
      const events = await collect(sseStream(CANONICAL, { splitAt: [split] }));
      expect(events, `split at byte ${split}`).toEqual(EXPECTED);
    }
  });

  it('handles CRLF and bare-CR line endings, including \\r\\n split across chunks', async () => {
    const crlf = CANONICAL.replaceAll('\n', '\r\n');
    expect(await collect(sseStream(crlf))).toEqual(EXPECTED);
    // split exactly between \r and \n of a terminator
    const idx = new TextEncoder().encode(crlf).indexOf(13) + 1;
    expect(await collect(sseStream(crlf, { splitAt: [idx] }))).toEqual(EXPECTED);
    const bareCr = CANONICAL.replaceAll('\n', '\r');
    expect(await collect(sseStream(bareCr))).toEqual(EXPECTED);
  });

  it('joins multi-line data with newlines and strips exactly one leading space', async () => {
    const payload = 'event: op\ndata: line1\ndata:  spaced\ndata:\n\n';
    expect(await collect(sseStream(payload))).toEqual([
      { event: 'op', data: 'line1\n spaced\n' },
    ]);
  });

  it('ignores comments, id and retry fields; strips a leading BOM', async () => {
    const payload = '﻿: hello\nid: 9\nretry: 100\nevent: op\ndata: x\n\n';
    expect(await collect(sseStream(payload))).toEqual([{ event: 'op', data: 'x' }]);
  });

  it('a comment-only stream yields nothing', async () => {
    expect(await collect(sseStream(': ping\n\n: ping\n\n'))).toEqual([]);
  });

  it('discards an unterminated trailing event at EOF (per spec)', async () => {
    const payload = 'event: op\ndata: complete\n\nevent: op\ndata: incomplete';
    expect(await collect(sseStream(payload))).toEqual([{ event: 'op', data: 'complete' }]);
  });

  it('an event field without data dispatches nothing', async () => {
    expect(await collect(sseStream('event: lonely\n\n'))).toEqual([]);
  });
});
