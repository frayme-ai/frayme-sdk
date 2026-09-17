/**
 * Canonical request-shape limits for `POST /v1/compose` — the single source of
 * truth for the wire contract.
 *
 * The SDK tool schema (`tools/index.ts`) enforces these, and they are exported
 * so any consumer (and the Frayme platform's compose route) can reference the
 * same numbers instead of re-hardcoding them. The platform enforces identical
 * values server-side in its compose request schema — keep them in lockstep.
 */
export const COMPOSE_PROMPT_MIN_CHARS = 1;
export const COMPOSE_PROMPT_MAX_CHARS = 4000;

export const COMPOSE_MIN_OPERATIONS = 1;
export const COMPOSE_MAX_OPERATIONS = 200;

export const CONTEXT_THEME_MAX_CHARS = 40;
export const CONTEXT_FRAMEWORK_HINT_MAX_CHARS = 60;

/**
 * Serialized-size ceilings (`JSON.stringify(value).length`) for the free-form
 * JSON fields. A body over any of them is a 400 before any model call.
 */
export const COMPOSE_DATA_MAX_CHARS = 48_000;
export const PRIOR_SPEC_MAX_CHARS = 48_000;
export const ACTION_CONTEXT_MAX_CHARS = 16_000;

export const ACTION_NAME_MIN_CHARS = 1;
export const ACTION_NAME_MAX_CHARS = 60;
export const ACTION_ROLE_MAX_CHARS = 40;
export const ACTION_DESCRIPTION_MAX_CHARS = 160;
export const MAX_ACTIONS_PER_REQUEST = 20;

/** `actions[].requiredItems`: at most this many param names, each at most this long. */
export const ACTION_REQUIRED_ITEMS_MAX = 20;
export const ACTION_PARAM_NAME_MAX_CHARS = 60;

/**
 * @deprecated Legacy archetype vocabulary — not part of the compose contract.
 * Kept only for backwards compatibility of stored specs. `/v1/compose` does
 * not accept an archetype — steer with `signals` instead.
 */
export const UI_TYPES = [
  'form',
  'dashboard',
  'pricing_table',
  'list_table',
  'detail_view',
  'settings_panel',
  'wizard',
  'confirmation',
  'empty_state',
  'calendar',
  'board',
  'map',
  'editor',
  'other',
] as const;

/** Compose mode: fresh UI · in-place edit (with prior_spec) · journey step. */
export const COMPOSE_MODES = ['create', 'edit', 'continue_journey'] as const;
