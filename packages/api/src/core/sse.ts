/**
 * Minimal, spec-complete Server-Sent Events parser over a byte stream.
 *
 * Grammar handled (WHATWG EventSource spec):
 *  - line terminators: \r\n, \n, and bare \r (incl. \r\n split across chunks)
 *  - multi-line `data:` fields joined with '\n'
 *  - one leading space after the colon is stripped
 *  - comment lines (starting with ':') are ignored — this is how `: ping` arrives
 *  - `id:` / `retry:` fields are parsed but unused
 *  - a UTF-8 BOM at stream start is stripped
 *  - events are dispatched on blank lines; an unterminated trailing event at
 *    EOF is discarded (per spec — our server always terminates frames)
 */
export interface SSEMessage {
  event: string | undefined;
  data: string;
}

export async function* parseSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEMessage, void, undefined> {
  const decoder = new TextDecoder('utf-8');
  const reader = body.getReader();

  let buf = '';
  let strippedBom = false;
  let eventName: string | undefined;
  let dataLines: string[] = [];
  let pending: SSEMessage[] = [];

  const dispatch = (): void => {
    if (dataLines.length > 0) {
      pending.push({ event: eventName, data: dataLines.join('\n') });
    }
    eventName = undefined;
    dataLines = [];
  };

  const handleLine = (line: string): void => {
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) return; // comment (keepalive pings)
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') dataLines.push(value);
    else if (field === 'event') eventName = value;
    // 'id' and 'retry' intentionally ignored
  };

  /** Consume complete lines from `buf`; keep a trailing partial (or lone '\r') buffered. */
  const drainBuffer = (eof: boolean): void => {
    let start = 0;
    let i = 0;
    while (i < buf.length) {
      const c = buf.charCodeAt(i);
      if (c === 10 /* \n */) {
        handleLine(buf.slice(start, i));
        i += 1;
        start = i;
      } else if (c === 13 /* \r */) {
        if (i + 1 < buf.length) {
          handleLine(buf.slice(start, i));
          i += buf.charCodeAt(i + 1) === 10 ? 2 : 1;
          start = i;
        } else if (eof) {
          handleLine(buf.slice(start, i));
          i += 1;
          start = i;
        } else {
          break; // lone \r at buffer end — might be half of \r\n; wait for more bytes
        }
      } else {
        i += 1;
      }
    }
    buf = buf.slice(start);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      let text = done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (!strippedBom && text.length > 0) {
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        strippedBom = true;
      }
      buf += text;
      drainBuffer(done);
      if (pending.length > 0) {
        const out = pending;
        pending = [];
        yield* out;
      }
      if (done) return; // unterminated trailing event (if any) is discarded per spec
    }
  } finally {
    // Cancel the underlying body before releasing — on an early `break` (consumer
    // stops iterating) releaseLock alone leaves the HTTP connection open.
    await reader.cancel().catch(() => {});
  }
}
