/**
 * State policy across `compose.restarted` and in-place re-compose (Chat+):
 *
 * On a FULL replace (`compose.restarted`, a `flat`/`nested` spec part) the
 * renderer remounts and the agent's `state` wins outright. On an in-place PATCH
 * (`prior_spec` mode) the canvas morphs without a remount, and
 * `mergeOnRehydrate` decides whose state survives.
 */
export function resolveInitialState(spec: unknown): Record<string, unknown> {
  const state = (spec as { state?: unknown } | null | undefined)?.state;
  return state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
}

/**
 * Field-level state merge for an in-place patch:
 *  - the AGENT is authoritative for STRUCTURE — which keys exist. New fields it
 *    adds come through; fields it removed (present only on the client) are
 *    dropped.
 *  - the CLIENT is authoritative for the VALUE of any field it still carries —
 *    the user's in-progress edit wins over the agent's redelivered value.
 *
 * AG-UI ships no conflict resolution (last-writer-wins); this is the deliberate
 * answer. v0 merges top-level fields (the common case — flat state paths like
 * `/amount`); deeper object merges are a later refinement.
 */
export function mergeOnRehydrate(
  agentState: Record<string, unknown>,
  clientState: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!clientState) return agentState;
  const merged: Record<string, unknown> = { ...agentState };
  for (const key of Object.keys(merged)) {
    if (
      Object.prototype.hasOwnProperty.call(clientState, key) &&
      clientState[key] !== undefined
    ) {
      merged[key] = clientState[key];
    }
  }
  return merged;
}
