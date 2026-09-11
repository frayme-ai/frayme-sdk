'use client';
/**
 * React delivery of the carrier list (see ../core/dynamic-gate.ts).
 *
 * FraymeRenderer provides the `dynamicActionTypes` in force; `useCommitLatch`
 * reads it so a control the gate would DENY never latches — for that control
 * "the action fired" now means "its state mirror was written", and disabling it
 * would freeze 927 Select/Switch bindings after one touch. Outside a provider
 * (a renderer mounted directly in a test) the default carrier list applies, so
 * the latch's answer matches what the Proxy would do.
 */
import { createContext, useContext } from 'react';
import { DEFAULT_DYNAMIC_ACTION_TYPES } from '../core/dynamic-gate.js';

export const DynamicGateContext = createContext<readonly string[]>(DEFAULT_DYNAMIC_ACTION_TYPES);

/** The carrier list in force for this renderer instance (the default outside one). */
export function useDynamicGateTypes(): readonly string[] {
  return useContext(DynamicGateContext);
}
