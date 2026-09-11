'use client';
import {
  APIUserAbortError,
  FraymeError,
  type ComposeRequest,
  type Frayme,
  type FinalSpec,
  type RequestMethodOptions,
} from '@frayme/api';
import type { Spec } from '@json-render/core';
import { useCallback, useRef, useState } from 'react';
import { useFrayme } from './FraymeProvider.js';

export type ComposeStatus = 'idle' | 'streaming' | 'restarting' | 'complete' | 'error';

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
  error: FraymeError | undefined;
  abort: () => void;
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
  const [error, setError] = useState<FraymeError | undefined>(undefined);
  const streamRef = useRef<{ abort: () => void } | null>(null);

  const compose = useCallback(
    async (
      request: Omit<ComposeRequest, 'stream'>,
      options?: RequestMethodOptions,
    ): Promise<FinalSpec | undefined> => {
      if (!client) {
        throw new Error(
          'useFraymeCompose needs a client — pass one to the hook or set `client` on <FraymeProvider> ' +
            '(use keyless proxy mode in the browser: new Frayme({ apiKey: null, baseURL: "/api/your-proxy" })).',
        );
      }
      streamRef.current?.abort();
      setSpec(null);
      setError(undefined);
      setStatus('streaming');

      const stream = client.compose.stream(request, options);
      streamRef.current = stream;
      // Stale-stream guard: a replaced/aborted stream must never clobber the
      // state of the one that superseded it.
      const isCurrent = (): boolean => streamRef.current === stream;

      stream.on('started', (e) => isCurrent() && setModel(e.model));
      stream.on('op', (_op, snapshot) => {
        if (!isCurrent()) return;
        setSpec(snapshot);
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

  return { compose, spec, status, restartKey, model, error, abort };
}
