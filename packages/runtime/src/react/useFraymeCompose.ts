'use client';
import {
  APIUserAbortError,
  FraymeError,
  type ComposeRequest,
  type ComposeStream,
  type Frayme,
  type FinalSpec,
  type RequestMethodOptions,
} from '@frayme/api';
import type { Spec } from '@json-render/core';
import { useCallback, useRef, useState } from 'react';
import { useFrayme } from './FraymeProvider.js';

export type ComposeStatus = 'idle' | 'streaming' | 'restarting' | 'complete' | 'error';

/** Shared with useFraymeScreen, so both entry points fail with the same guidance. */
export const MISSING_CLIENT_MESSAGE =
  'useFraymeCompose needs a client. Pass one to the hook, or set `client` or `endpoint` on <FraymeProvider> ' +
  '(in the browser, use keyless proxy mode: new Frayme({ apiKey: null, baseURL: "/api/your-proxy" })).';

export interface UseFraymeComposeReturn {
  /** Start (or replace) a streaming composition. Resolves with the validated final spec. */
  compose: (
    request: Omit<ComposeRequest, 'stream'>,
    options?: RequestMethodOptions,
  ) => Promise<FinalSpec | undefined>;
  /** Live spec snapshot — render it with <FraymeRenderer mode="progressive">. */
  spec: Spec | null;
  status: ComposeStatus;
  /** Bump-on-restart counter — pass straight to <FraymeRenderer restartKey>. */
  restartKey: number;
  /** The model that produced the current attempt (changes on restarts). */
  model: string | undefined;
  /**
   * The generation the current compose belongs to: known from the stream's
   * first event, confirmed on completion, cleared when a new compose starts.
   * A restart keeps it (a restart is a new attempt, not a new generation).
   * Optional in the type so a host's own implementation or test double of
   * this interface, written before the field existed, still compiles.
   */
  generationId?: string;
  error: FraymeError | undefined;
  abort: () => void;
}

/**
 * A new object for every op. The stream's `op` snapshot is its live
 * accumulator, patched in place, so the SAME object arrives on every op. React
 * skips a state update whose value is the object it already holds, and the
 * renderer caches on spec identity, so passing it straight through rendered the
 * first op and then stopped updating; even a re-render for another reason kept
 * the renderer's cached view of that first op. A deep copy also means a
 * snapshot the host kept never changes under it. The shallow copy is only the
 * fallback for a spec structuredClone refuses, which must not throw here.
 */
function freshSnapshot(snapshot: Spec): Spec {
  try {
    return structuredClone(snapshot);
  } catch {
    return { ...snapshot };
  }
}

/**
 * Frontend-direct streaming compose with full `compose.restarted` handling:
 * ops update the snapshot live; a restart clears the snapshot AND bumps
 * `restartKey` so the renderer remounts its state tree (agent-authoritative
 * discard); completion commits the validated spec.
 */
export function useFraymeCompose(clientOverride?: Frayme): UseFraymeComposeReturn {
  const ctx = useFrayme();
  const client = clientOverride ?? ctx.client;

  const [spec, setSpec] = useState<Spec | null>(null);
  const [status, setStatus] = useState<ComposeStatus>('idle');
  const [restartKey, setRestartKey] = useState(0);
  const [model, setModel] = useState<string | undefined>(undefined);
  // Named apart from the `generationId` local read off the final envelope below.
  const [currentGenerationId, setGenerationId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<FraymeError | undefined>(undefined);
  const streamRef = useRef<{ abort: () => void } | null>(null);

  const compose = useCallback(
    async (
      request: Omit<ComposeRequest, 'stream'>,
      options?: RequestMethodOptions,
    ): Promise<FinalSpec | undefined> => {
      if (!client) {
        throw new Error(MISSING_CLIENT_MESSAGE);
      }
      streamRef.current?.abort();
      setSpec(null);
      setError(undefined);
      setGenerationId(undefined);
      setStatus('streaming');

      let stream: ComposeStream;
      try {
        stream = client.compose.stream(request, options);
      } catch (err) {
        // A stream that cannot even start (an engine without AbortSignal.any,
        // say) must still leave the hook in a state the UI can show, not stuck
        // on 'streaming' behind an unhandled rejection.
        streamRef.current = null;
        setError(err instanceof FraymeError ? err : new FraymeError(String(err)));
        setStatus('error');
        return undefined;
      }
      streamRef.current = stream;
      // Stale-stream guard: a replaced/aborted stream must never clobber the
      // state of the one that superseded it.
      const isCurrent = (): boolean => streamRef.current === stream;

      stream.on('started', (e) => {
        if (!isCurrent()) return;
        setModel(e.model);
        setGenerationId(e.generation_id);
      });
      stream.on('op', (_op, snapshot) => {
        if (!isCurrent()) return;
        setSpec(freshSnapshot(snapshot));
        setStatus('streaming');
      });
      stream.on('restarted', (e) => {
        if (!isCurrent()) return;
        setSpec(null);
        setModel(e.model);
        setStatus('restarting');
        setRestartKey((k) => k + 1);
      });

      try {
        const final = await stream.finalSpec();
        if (!isCurrent()) return undefined;
        // Carry the generation_id ON the spec — a user action on the rendered UI
        // reads `spec.generation_id` (DynamicActionEvent.generation_id) to correlate
        // back to its compose. The envelope carries it as a sibling; stamp it so the
        // field works on the canvas path even before the platform stamps the spec.
        const generationId = (final as { generationId?: string }).generationId;
        const finalSpec = final.spec as unknown as Record<string, unknown>;
        if (generationId && finalSpec.generation_id == null) finalSpec.generation_id = generationId;
        setSpec(final.spec);
        setModel(final.model);
        if (generationId) setGenerationId(generationId);
        setStatus('complete');
        return final;
      } catch (err) {
        if (!isCurrent()) return undefined;
        if (err instanceof APIUserAbortError) {
          setStatus('idle');
          return undefined;
        }
        setError(err instanceof FraymeError ? err : new FraymeError(String(err)));
        setStatus('error');
        return undefined;
      }
    },
    [client],
  );

  const abort = useCallback(() => streamRef.current?.abort(), []);

  return { compose, spec, status, restartKey, model, generationId: currentGenerationId, error, abort };
}
