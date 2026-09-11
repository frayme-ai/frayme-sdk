export interface ScriptedResponse {
  status: number;
  headers?: Record<string, string>;
  /** String for JSON bodies; a factory receiving the request signal for streams. */
  body?: string | ((signal: AbortSignal | undefined) => ReadableStream<Uint8Array>);
  sse?: boolean;
}

export interface RecordedCall {
  url: string;
  method: string;
  headers: Headers;
  body: string | undefined;
}

export interface MockFetch {
  fetch: typeof globalThis.fetch;
  calls: RecordedCall[];
}

export function buildMockFetch(script: ScriptedResponse[]): MockFetch {
  const queue = [...script];
  const calls: RecordedCall[] = [];

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (init?.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const next = queue.shift();
    if (!next) throw new Error(`mock fetch script exhausted (call #${calls.length + 1})`);

    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : undefined,
    });

    const headers = new Headers({
      'content-type': next.sse ? 'text/event-stream; charset=utf-8' : 'application/json',
      ...next.headers,
    });
    const body =
      typeof next.body === 'function'
        ? next.body(init?.signal ?? undefined)
        : (next.body ?? null);
    return new Response(body, { status: next.status, headers });
  };

  return { fetch: fetchImpl as typeof globalThis.fetch, calls };
}
