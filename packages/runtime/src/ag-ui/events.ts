'use client';
/**
 * AG-UI event decoding — PLAIN DATA ONLY.
 *
 * @ag-ui/core is still on zod 3 internally; we never import or re-export its
 * zod schemas. Events are treated as structural JSON, so the zod-3/zod-4
 * boundary can never leak into consumer apps.
 *
 * Frayme's spec-delivery convention over AG-UI (out-of-band — never a
 * model-visible tool result):
 *   CUSTOM event  { type: 'CUSTOM', name: 'frayme:spec', value: SpecDataPart }
 */
import { applySpecStreamPatch, type Spec, type SpecDataPart } from '@json-render/core';

export const FRAYME_SPEC_EVENT = 'frayme:spec';
export const FRAYME_ACTION_TOOL = 'frayme:action';

const EMPTY_SPEC = { root: null, elements: {} } as unknown as Spec;

interface CustomEventLike {
  type?: string;
  name?: string;
  value?: unknown;
}

/** Extract a SpecDataPart from an AG-UI CUSTOM event (or return undefined). */
export function specPartFromAgUiEvent(event: unknown): SpecDataPart | undefined {
  const e = event as CustomEventLike | null | undefined;
  if (!e || e.type !== 'CUSTOM' || e.name !== FRAYME_SPEC_EVENT) return undefined;
  const value = e.value as SpecDataPart | undefined;
  if (!value || typeof value !== 'object' || !('type' in value)) return undefined;
  return value;
}

/** Fold a SpecDataPart into the current spec snapshot (flat replaces; patch applies). */
export function foldSpecPart(current: Spec | null, part: SpecDataPart): Spec | null {
  switch (part.type) {
    case 'flat':
      return part.spec;
    case 'nested':
      return part.spec as unknown as Spec;
    case 'patch': {
      const base = (current ?? structuredClone(EMPTY_SPEC)) as unknown as Record<string, unknown>;
      return applySpecStreamPatch(base, part.patch) as unknown as Spec;
    }
    default:
      return current;
  }
}
